// FILE: src/engine/model.js
// ===========================================================================
// MARGINALIA — SHARED CALCULATION ENGINE
// ===========================================================================
// This file contains NO company-specific numbers. It takes a data file
// (src/data/AAPL.js, src/data/META.js, ...) and returns a fully built
// 3-statement model plus a DCF. Every company runs through this same code.
//
// Order of calculation (each step only needs the ones above it, which is why
// no circular reference is required):
//   1  segment revenue build      6  debt schedule
//   2  income statement           7  capital stock / retained earnings /
//   3  working capital schedule      treasury / OCI
//   4  PP&E schedule              8  cash flow statement
//   5  other assets & liabilities 9  revolver & cash, balance sheet, ratios
// ===========================================================================

const sum = (a) => a.reduce((t, x) => t + (x || 0), 0);
const avg = (a) => sum(a) / a.length;
const isNum = (v) => typeof v === 'number' && isFinite(v);
// The mean of the figures that exist. A line the filing does not report is
// null, not zero, and must not pull an average towards zero; null when there
// is nothing to average.
const avgReported = (a) => {
  const reported = a.filter(isNum);
  return reported.length ? reported.reduce((t, x) => t + x, 0) / reported.length : null;
};

/** Least-squares linear regression, evaluated at a given x. */
function forecastLinear(x, ys, xs) {
  const mx = avg(xs), my = avg(ys);
  let num = 0, den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  return my + slope * (x - mx);
}

/** Year fraction between two dates, Excel YEARFRAC basis 0 (30/360 US). */
function yearFrac(startISO, endISO) {
  const s = new Date(startISO + 'T00:00:00Z');
  const e = new Date(endISO + 'T00:00:00Z');
  let d1 = s.getUTCDate(), d2 = e.getUTCDate();
  const m1 = s.getUTCMonth() + 1, m2 = e.getUTCMonth() + 1;
  const y1 = s.getUTCFullYear(), y2 = e.getUTCFullYear();
  if (d1 === 31) d1 = 30;
  if (d2 === 31 && d1 === 30) d2 = 30;
  return ((y2 - y1) * 360 + (m2 - m1) * 30 + (d2 - d1)) / 360;
}

// ===========================================================================
// 3-STATEMENT MODEL
// ===========================================================================
export function buildModel(data) {
  const { meta, historical: h, assumptions: a } = data;
  const nH = meta.historicalYears.length;   // historical periods
  const nF = meta.forecastYears.length;     // forecast periods
  const years = [...meta.historicalYears, ...meta.forecastYears];
  const breakerOn = meta.circuitBreaker === 'ON';

  // Every series below is one array covering history THEN forecast, so that
  // index 0..nH-1 is actual and nH..nH+nF-1 is projected.
  const S = {};
  const blank = () => new Array(nH + nF).fill(null);

  // ------------------------------------------------- 1. SEGMENT REVENUE BUILD
  const segmentNames = Object.keys(h.segments);
  S.segments = {};
  S.segmentGrowth = {};

  for (const name of segmentNames) {
    const rev = [...h.segments[name], ...new Array(nF).fill(null)];
    const gr = blank();
    for (let t = 1; t < nH; t++) gr[t] = (rev[t] - rev[t - 1]) / rev[t - 1];

    const rule = a.segmentGrowth[name];
    for (let t = nH; t < nH + nF; t++) {
      gr[t] = rule === 'trailingTwoYearAverage'
        ? avg([gr[t - 2], gr[t - 1]])
        : rule[t - nH];
      rev[t] = rev[t - 1] * (1 + gr[t]);
    }
    S.segments[name] = rev;
    S.segmentGrowth[name] = gr;
  }

  // ------------------------------------------------------ 2. INCOME STATEMENT
  S.revenue = blank();
  for (let t = 0; t < nH; t++) S.revenue[t] = h.incomeStatement.revenue[t];
  for (let t = nH; t < nH + nF; t++) {
    S.revenue[t] = sum(segmentNames.map((n) => S.segments[n][t]));
  }

  S.revenueGrowth = blank();
  for (let t = 1; t < nH + nF; t++) {
    S.revenueGrowth[t] = (S.revenue[t] - S.revenue[t - 1]) / S.revenue[t - 1];
  }

  // COST LINES ON THE FILED BASIS
  //
  // The model's cost of sales, R&D and SG&A (S.cogs, S.rnd, S.sga, built in
  // section 4b) EXCLUDE depreciation & amortisation and stock based
  // compensation, which are charged as their own lines to reach operating
  // profit. Previously operating profit came from margins that merely
  // embedded the reported level of both, while the cash flow added back D&A
  // from the capex schedule and SBC from its own ratio: any growth in either
  // raised cash from operations one-for-one without touching profit.
  //
  // The lines here are the same costs on the basis the filings report them,
  // D&A and SBC inside. The assumptions are written against this basis, and
  // it is what capex, SBC and the working capital drivers have always read,
  // so none of those schedules moves because of the split.
  S.taxRate = blank();
  S.cogsReportedBasis = blank();
  S.rndReportedBasis = blank();
  S.sgaReportedBasis = blank();
  S.otherOperatingCostsReportedBasis = blank();
  S.grossMarginReportedBasis = blank();
  S.rndMarginReportedBasis = blank();
  S.sgaMarginReportedBasis = blank();
  S.otherOperatingCostsMarginReportedBasis = blank();

  // R&D and SG&A are null in a year the filing does not report them, and
  // their margins null with them: not reported is not nil. OTHER OPERATING
  // COSTS is the filing's operating income less the lines it names, so
  // operating income ties; a line the filing leaves out is inside it. A data
  // file that carries none (Apple's, whose named lines tie) has nil here,
  // which for that file is the computed figure, not an assumption.
  const ratioOrNull = (line, t) => (isNum(line) && S.revenue[t] ? -line / S.revenue[t] : null);
  for (let t = 0; t < nH; t++) {
    S.cogsReportedBasis[t] = h.incomeStatement.cogs[t];
    S.rndReportedBasis[t] = h.incomeStatement.researchDevelopment[t] ?? null;
    S.sgaReportedBasis[t] = h.incomeStatement.sellingGeneralAdmin[t] ?? null;
    S.otherOperatingCostsReportedBasis[t] = h.incomeStatement.otherOperatingCosts?.[t] ?? 0;
    S.grossMarginReportedBasis[t] = (S.revenue[t] + S.cogsReportedBasis[t]) / S.revenue[t];
    S.rndMarginReportedBasis[t] = ratioOrNull(S.rndReportedBasis[t], t);
    S.sgaMarginReportedBasis[t] = ratioOrNull(S.sgaReportedBasis[t], t);
    S.otherOperatingCostsMarginReportedBasis[t] = ratioOrNull(S.otherOperatingCostsReportedBasis[t], t);
  }

  const sgaFcst = a.sellingGeneralAdminMargin === 'avgOfHistory'
    ? avgReported(S.sgaMarginReportedBasis.slice(0, nH)) ?? 0
    : a.sellingGeneralAdminMargin;

  for (let t = nH; t < nH + nF; t++) {
    S.grossMarginReportedBasis[t] = a.grossMargin[t - nH];
    S.rndMarginReportedBasis[t] = a.researchDevelopmentMargin[t - nH];
    S.sgaMarginReportedBasis[t] = Array.isArray(sgaFcst) ? sgaFcst[t - nH] : sgaFcst;
    // COGS is the balancing line of the gross margin
    S.cogsReportedBasis[t] = -(S.revenue[t] - S.revenue[t] * S.grossMarginReportedBasis[t]);
    S.rndReportedBasis[t] = -(S.revenue[t] * S.rndMarginReportedBasis[t]);
    S.sgaReportedBasis[t] = -(S.revenue[t] * S.sgaMarginReportedBasis[t]);
    // Other operating costs forecast at a share of revenue (deriveModel.js says
    // why); nil for a data file that sets none.
    S.otherOperatingCostsMarginReportedBasis[t] = a.otherOperatingCostsMargin?.[t - nH] ?? 0;
    S.otherOperatingCostsReportedBasis[t] = -(S.revenue[t] * S.otherOperatingCostsMarginReportedBasis[t]);
  }

  S.cogsGrowth = blank();
  for (let t = 1; t < nH + nF; t++) {
    S.cogsGrowth[t] =
      (S.cogsReportedBasis[t] - S.cogsReportedBasis[t - 1]) / S.cogsReportedBasis[t - 1];
  }

  // Interest and tax need the debt / cash schedules, so they are filled in
  // later; operating profit needs D&A and SBC, so it is built in section 4b.
  // Placeholders are set up here to keep the line order readable.
  S.interestIncome = blank();
  S.interestExpense = blank();
  S.otherIncomeExpense = blank();
  S.pretaxProfit = blank();
  S.taxes = blank();
  S.netIncome = blank();

  // ---------------------------------------------- 3. WORKING CAPITAL SCHEDULE
  const wcLines = [
    ['accountsReceivable', 'accountsReceivable'],
    ['inventory', 'inventory'],
    ['accountsPayable', 'accountsPayable'],
    ['accruedExpenses', 'accruedExpenses'],
    ['otherCurrentAssets', 'otherCurrentAssets'],
    ['deferredTaxAssets', 'deferredTaxAssets'],
  ];

  S.wc = {};
  for (const [key] of wcLines) {
    const end = blank();
    for (let t = 0; t < nH; t++) end[t] = h.balanceSheet[key][t];
    const driver = a.workingCapitalDrivers[key];
    for (let t = nH; t < nH + nF; t++) {
      const g = driver === 'cogs' ? S.cogsGrowth[t] : S.revenueGrowth[t];
      end[t] = end[t - 1] * (1 + g);
    }
    const beg = blank(), chg = blank();
    for (let t = 1; t < nH + nF; t++) {
      if (end[t - 1] == null) continue;
      beg[t] = end[t - 1];
      chg[t] = end[t] - beg[t];
    }
    S.wc[key] = { beginning: beg, change: chg, ending: end };
  }

  // Ratios that make the working capital schedule readable
  S.dso = blank(); S.dpo = blank(); S.inventoryTurnover = blank();
  for (let t = 0; t < nH + nF; t++) {
    const ar = S.wc.accountsReceivable.ending[t];
    const ap = S.wc.accountsPayable.ending[t];
    const inv = S.wc.inventory.ending[t];
    if (ar != null) S.dso[t] = (ar / S.revenue[t]) * meta.daysInYear;
    if (ap != null) S.dpo[t] = (ap / S.revenue[t]) * meta.daysInYear;
    if (inv != null) S.inventoryTurnover[t] = -S.cogsReportedBasis[t] / inv;
  }

  // Other assets / other non-current liabilities — held flat by assumption
  for (const [key, flat] of [
    ['otherAssets', a.otherAssetsHeldFlat],
    ['otherNonCurrentLiabilities', a.otherNonCurrentLiabilitiesHeldFlat],
  ]) {
    const end = blank();
    for (let t = 0; t < nH; t++) end[t] = h.balanceSheet[key][t];
    for (let t = nH; t < nH + nF; t++) end[t] = flat ? end[nH - 1] : end[t - 1];
    const beg = blank(), chg = blank();
    for (let t = 1; t < nH + nF; t++) {
      if (end[t - 1] == null) continue;
      beg[t] = end[t - 1];
      chg[t] = end[t] - beg[t];
    }
    S.wc[key] = { beginning: beg, change: chg, ending: end };
  }

  // ------------------------------------------------------- 4. PP&E SCHEDULE
  S.ppe = {
    beginning: blank(), capex: blank(), depreciation: blank(), otherMovements: blank(), ending: blank(),
  };
  S.depreciationPercentOfCapex = blank();

  for (let t = 0; t < nH; t++) {
    S.ppe.ending[t] = h.balanceSheet.propertyPlantEquipment[t];
    S.ppe.capex[t] = h.cashFlow.capex[t];
  }
  // First historical year that has a full schedule
  const firstPpeYear = h.balanceSheet.propertyPlantEquipment.findIndex((v) => v != null);
  S.ppe.beginning[firstPpeYear] = h.ppeOpeningBalance;
  for (let t = firstPpeYear + 1; t < nH; t++) S.ppe.beginning[t] = S.ppe.ending[t - 1];
  // REPORTED YEARS. Depreciation is the filed figure where the derivation
  // resolved one (deriveModel.js, filedDepreciation); whatever else moved the
  // balance — disposals, impairments, finance leases, acquisitions, currency —
  // is shown on its own line instead of being called depreciation. Where
  // nothing is filed, the balance movement is all that can be measured, and
  // then only for a year with an opening balance: a derived model's first
  // reported year has none.
  const filedDepreciation = (t) => {
    const v = h.cashFlow.depreciationOfPpe?.[t];
    return typeof v === 'number' && isFinite(v) ? v : null;
  };
  for (let t = firstPpeYear; t < nH; t++) {
    const opening = S.ppe.beginning[t];
    const movement = opening != null && S.ppe.ending[t] != null
      ? S.ppe.ending[t] - opening - (S.ppe.capex[t] ?? 0)
      : null;
    const filed = filedDepreciation(t);
    if (filed !== null) {
      S.ppe.depreciation[t] = -filed;
      S.ppe.otherMovements[t] = movement === null ? null : movement - S.ppe.depreciation[t];
    } else {
      S.ppe.depreciation[t] = movement;
      S.ppe.otherMovements[t] = movement === null ? null : 0;
    }
    S.depreciationPercentOfCapex[t] =
      S.ppe.depreciation[t] != null && S.ppe.capex[t] ? -S.ppe.depreciation[t] / S.ppe.capex[t] : null;
  }

  // The forecast rate: the derivation's figure from filed depreciation, or the
  // average of whatever the reported years could measure. Years that measured
  // nothing are left out rather than counted as nil.
  const depPct = a.depreciationAsPercentOfCapex === 'avgOfHistory'
    ? avgReported(S.depreciationPercentOfCapex.slice(firstPpeYear, nH))
    : a.depreciationAsPercentOfCapex;

  // capexScale lifts or lowers the whole forecast capex line without changing
  // its shape. It exists for the capital-spending slider and for the
  // qualitative questions behind it: a model whose capex is a rising line
  // should stay a rising line when someone says the company spends heavily,
  // rather than being flattened to a single percentage of revenue. It is
  // applied to the finished figure and never fed back into the growth method,
  // so a scale of 1.1 raises every year by a tenth and does not compound.
  const capexScale = a.capexScale ?? 1;
  let capexRaw = S.ppe.capex[nH - 1];

  for (let t = nH; t < nH + nF; t++) {
    S.ppe.otherMovements[t] = 0;
    S.ppe.beginning[t] = S.ppe.ending[t - 1];
    // Capex is carried as a POSITIVE outflow, the sign the filings, the data
    // files and the historical years all use: PP&E closes at opening plus
    // capex less depreciation, investing cash flow is -capex, and D&A is
    // +capex × depreciation %. Every method below must return that sign. The
    // percentage-of-revenue method used to negate it, which for every derived
    // company turned forecast capex into a cash inflow, ran PP&E down towards
    // a negative balance, made D&A negative and added capex to free cash flow.
    capexRaw = a.capexMethod === 'percentOfRnD'
      ? -S.rndReportedBasis[t] * a.capexRatio       // capex = R&D spend (as filed, negative) × ratio
      : a.capexMethod === 'percentOfRevenue'
        ? S.revenue[t] * a.capexRatio                // capex = revenue × ratio
        : capexRaw * (1 + a.capexRatio);            // capex grows at the ratio
    S.ppe.capex[t] = capexRaw * capexScale;
    S.depreciationPercentOfCapex[t] = depPct;
    S.ppe.depreciation[t] = -(S.ppe.capex[t] * depPct);
    S.ppe.ending[t] = S.ppe.beginning[t] + S.ppe.capex[t] + S.ppe.depreciation[t];
  }

  // A rate that cannot be forecast from: not a positive number, or one that
  // depreciates the asset base past nothing inside the forecast. Recorded here
  // and refused in checkValuationApplicability, because a forecast built on it
  // is not a valuation (Union Pacific's balance-sheet rate was 419% of capital
  // spending, Amazon's -92%).
  S.depreciationRateUsed = typeof depPct === 'number' && isFinite(depPct) ? depPct : null;
  S.depreciationRateProblem =
    S.depreciationRateUsed === null
      ? 'no depreciation rate could be measured from the filing'
      : S.depreciationRateUsed <= 0
        ? `the depreciation rate measured from the filing is ${(S.depreciationRateUsed * 100).toFixed(1)}% of capital spending, which is not a rate anything can be depreciated at`
        : S.ppe.ending.slice(nH, nH + nF).some((v) => typeof v === 'number' && v < 0)
          ? `a depreciation rate of ${(S.depreciationRateUsed * 100).toFixed(1)}% of capital spending depreciates the property, plant & equipment balance past nothing inside the forecast`
          : null;

  // D&A and SBC are charged in operating profit (section 4b) and added back in
  // the cash flow statement
  S.depreciationAmortisation = blank();
  S.stockBasedCompensation = blank();
  for (let t = 0; t < nH; t++) {
    S.depreciationAmortisation[t] = h.cashFlow.depreciationAmortisation[t];
    S.stockBasedCompensation[t] = h.cashFlow.stockBasedCompensation[t];
  }
  for (let t = nH; t < nH + nF; t++) {
    S.depreciationAmortisation[t] = -S.ppe.depreciation[t];
  }

  // --------------------------------- AMORTISATION OF INTANGIBLES (RUNS OFF)
  // Reported D&A is the filed figure, depreciation of PP&E plus amortisation of
  // intangibles. Forecast depreciation came from the PP&E roll-forward alone,
  // so it measured something narrower than the reported years.
  //
  // ANCHOR. The amount by which the filed D&A of the last reported year exceeds
  // that year's capex at the historical depreciation rate: the part of the
  // filed figure the forecast's own depreciation formula does not produce. Not
  // the roll-forward's literal depreciation for that year, which the forecast
  // never charges (Microsoft's is 2.4% of revenue while the forecast charges
  // 5.4%); subtracting it would count the difference twice. The historical rate
  // is used rather than the forecast assumption, so the depreciation slider
  // still moves D&A instead of being cancelled here. No amortisation is charged
  // when the anchor cannot be measured: when the historical depreciation rate
  // is not positive (Amazon, where finance-lease additions push its PP&E
  // roll-forward depreciation below zero), when filed D&A does not exceed
  // depreciation at that rate (Coca-Cola, whose roll-forward counts disposals
  // as depreciation), or when the filing reports no intangible assets (Apple).
  //
  // IT RUNS OFF. The anchored amount is charged each year, flat rather than
  // growing with revenue, until the intangibles reported in the last year are
  // used up, and nothing replaces them. The filings show a finite pool being
  // consumed at about that rate: Microsoft's reported intangibles fell from
  // 27,597 to 18,609 over two years against an anchored 3,252 a year,
  // Caterpillar's from 1,042 to 241 against 193, Amgen's from 32,641 to 22,276
  // against 4,055. The forecast buys no intangibles, so persisting the charge
  // would mean reinvesting in an acquisition of that size every year for ever
  // (which cut Amgen's value by a third when tried). The charge reduces other
  // assets, where intangibles sit, and the other-assets movement excludes it so
  // operating cash flow does not add it back twice. The terminal value is
  // normalised as though the run-off is complete (see buildDCF).
  S.intangibleAssets = blank();
  S.amortisation = blank();
  {
    const anchorYear = nH - 1;
    const filedDA = h.cashFlow.depreciationAmortisation?.[anchorYear];
    // The filed amortisation of intangibles for that year, where the filing
    // reports it; failing that, filed D&A less the filed depreciation the
    // forecast charges against capital spending. It used to be filed D&A less
    // that year's capex at the historical rate, which inherited every
    // distortion in that rate (limitation L4).
    const filedAmortisation = h.cashFlow.amortisationOfIntangibles?.[anchorYear];
    const filedDep = filedDepreciation(anchorYear);
    const amortisationFiled =
      typeof filedAmortisation === 'number' && isFinite(filedAmortisation)
        ? filedAmortisation
        : typeof filedDA === 'number' && filedDep !== null
          ? filedDA - filedDep
          : null;
    const reportedPool = h.balanceSheet.intangibleAssets?.[anchorYear];
    const pool = typeof reportedPool === 'number' && isFinite(reportedPool) && reportedPool > 0 ? reportedPool : null;
    for (let t = 0; t < nH; t++) {
      const v = h.balanceSheet.intangibleAssets?.[t];
      S.intangibleAssets[t] = typeof v === 'number' ? v : null;
    }
    const annual = amortisationFiled !== null && amortisationFiled > 0 && pool !== null ? amortisationFiled : 0;
    S.amortisationAnchor = {
      year: years[anchorYear],
      filedDepreciationAmortisation: typeof filedDA === 'number' ? filedDA : null,
      filedDepreciation: filedDep,
      filedAmortisation: typeof filedAmortisation === 'number' ? filedAmortisation : null,
      amortisationUsed: amortisationFiled,
      intangiblePool: pool,
      annual,
      notChargedBecause:
        amortisationFiled === null
          ? 'the filing does not report amortisation of intangibles, and its D&A cannot be split without the depreciation figure'
          : amortisationFiled <= 0
            ? 'the filing reports no amortisation of intangibles'
            : pool === null
              ? 'the filing reports no intangible assets to amortise'
              : null,
    };

    let remaining = pool ?? 0;
    let cumulative = 0;
    const otherAssets = S.wc.otherAssets;
    otherAssets.amortisation = blank();
    for (let t = nH; t < nH + nF; t++) {
      const charge = Math.max(0, Math.min(annual, remaining));
      remaining -= charge;
      cumulative += charge;
      S.amortisation[t] = charge;
      S.intangibleAssets[t] = pool !== null ? remaining : null;
      S.depreciationAmortisation[t] += charge;
      // Other assets hold the intangibles, so they fall by the charge. Their
      // change line stays the movement EXCLUDING amortisation, which is what
      // operating cash flow and the DCF deduct.
      otherAssets.amortisation[t] = charge;
      if (otherAssets.ending[t] != null) otherAssets.ending[t] -= cumulative;
      if (otherAssets.ending[t - 1] != null) otherAssets.beginning[t] = otherAssets.ending[t - 1];
    }
  }

  // SBC as a share of total operating costs on the filed basis, which is the
  // basis the ratio is observed on.
  // Total operating costs on the filed basis: every cost line, other operating
  // costs included. A named line the filing does not report adds nothing here,
  // because its cost is already inside other operating costs.
  const operatingCostsFiled = (t) =>
    (S.cogsReportedBasis[t] ?? 0) + (S.rndReportedBasis[t] ?? 0) +
    (S.sgaReportedBasis[t] ?? 0) + (S.otherOperatingCostsReportedBasis[t] ?? 0);
  S.sbcPercentOfOpex = blank();
  for (let t = 0; t < nH; t++) {
    // Null in a year stock compensation is not reported.
    S.sbcPercentOfOpex[t] = isNum(S.stockBasedCompensation[t])
      ? -S.stockBasedCompensation[t] / operatingCostsFiled(t)
      : null;
  }
  // A rule that finds no reported year gives nil; the derivation already sets
  // nil explicitly, and says so, where the last reported year has none.
  const sbcPct = a.sbcAsPercentOfOperatingExpenses === 'lastHistoricalYear'
    ? S.sbcPercentOfOpex[nH - 1] ?? 0
    : a.sbcAsPercentOfOperatingExpenses === 'avgOfHistory'
      ? avgReported(S.sbcPercentOfOpex.slice(0, nH)) ?? 0
      : a.sbcAsPercentOfOperatingExpenses;

  for (let t = nH; t < nH + nF; t++) {
    S.sbcPercentOfOpex[t] = sbcPct;
    S.stockBasedCompensation[t] = -sbcPct * operatingCostsFiled(t);
  }

  // ------------------------- 4b. COST LINES EXCLUDING D&A AND SBC, AND EBIT
  // Reported years: each filed cost line gives up its pro-rata share of the
  // filed D&A and SBC. The filings do not say which line carries how much;
  // SBC is already modelled as a share of total operating costs, and D&A is
  // allocated the same way. The three lines plus D&A plus SBC equal the filed
  // operating costs exactly, so reported operating profit, and everything
  // below it, is unchanged.
  //
  // Forecast years: the assumptions are margins on the filed basis. Each cost
  // line gives up the share of revenue that D&A and SBC took of it in the last
  // reported year, and the forecast D&A and SBC are then charged in full. So
  // operating profit falls where D&A and SBC outgrow the level the reported
  // margins embedded, and rises where they shrink below it.
  // Stock compensation the filing does not report is not charged here (nor
  // added back in cash from operations): any the company paid stays inside
  // its cost lines, as the derivation records.
  const nonCash = (t) =>
    (S.depreciationAmortisation[t] ?? 0) + (S.stockBasedCompensation[t] ?? 0);
  const filedCosts = operatingCostsFiled;
  const withoutShare = (line, share) => (line == null ? null : line * (1 - share));

  S.cogs = blank();
  S.rnd = blank();
  S.sga = blank();
  S.otherOperatingCosts = blank();
  S.grossProfit = blank();
  S.grossMargin = blank();
  S.rndMargin = blank();
  S.sgaMargin = blank();
  S.otherOperatingCostsMargin = blank();
  S.nonCashShareOfCosts = blank();

  for (let t = 0; t < nH; t++) {
    const costs = filedCosts(t);
    const share = costs !== 0 ? nonCash(t) / -costs : 0;
    S.nonCashShareOfCosts[t] = share;
    S.cogs[t] = withoutShare(S.cogsReportedBasis[t], share);
    S.rnd[t] = withoutShare(S.rndReportedBasis[t], share);
    S.sga[t] = withoutShare(S.sgaReportedBasis[t], share);
    S.otherOperatingCosts[t] = withoutShare(S.otherOperatingCostsReportedBasis[t], share);
    // No filed cost lines to take them from: the whole charge leaves SG&A.
    if (costs === 0 && nonCash(t) !== 0) S.sga[t] = (S.sga[t] ?? 0) + nonCash(t);
  }

  const lastReported = nH - 1;
  const lastRevenue = S.revenue[lastReported];
  const lastShare = S.nonCashShareOfCosts[lastReported] ?? 0;
  const embeddedIn = (line) =>
    lastRevenue ? (-(line[lastReported] ?? 0) * lastShare) / lastRevenue : 0;
  // Share of revenue, per cost line, that D&A and SBC took in the last
  // reported year. Exported so a margin set on this basis (a slider) can be
  // turned back into the filed-basis assumption the engine reads.
  S.embeddedNonCashMargin = {
    cogs: embeddedIn(S.cogsReportedBasis),
    rnd: embeddedIn(S.rndReportedBasis),
    other: embeddedIn(S.otherOperatingCostsReportedBasis),
    sga:
      embeddedIn(S.sgaReportedBasis) +
      (lastRevenue && filedCosts(lastReported) === 0 ? nonCash(lastReported) / lastRevenue : 0),
  };

  for (let t = nH; t < nH + nF; t++) {
    S.cogs[t] = S.cogsReportedBasis[t] + S.revenue[t] * S.embeddedNonCashMargin.cogs;
    S.rnd[t] = S.rndReportedBasis[t] + S.revenue[t] * S.embeddedNonCashMargin.rnd;
    S.sga[t] = S.sgaReportedBasis[t] + S.revenue[t] * S.embeddedNonCashMargin.sga;
    S.otherOperatingCosts[t] =
      S.otherOperatingCostsReportedBasis[t] + S.revenue[t] * S.embeddedNonCashMargin.other;
  }

  S.ebit = blank();
  for (let t = 0; t < nH + nF; t++) {
    S.grossProfit[t] = S.revenue[t] + S.cogs[t];
    S.grossMargin[t] = S.grossProfit[t] / S.revenue[t];
    S.rndMargin[t] = isNum(S.rnd[t]) ? -S.rnd[t] / S.revenue[t] : null;
    S.sgaMargin[t] = isNum(S.sga[t]) ? -S.sga[t] / S.revenue[t] : null;
    S.otherOperatingCostsMargin[t] = isNum(S.otherOperatingCosts[t]) ? -S.otherOperatingCosts[t] / S.revenue[t] : null;
    // A named line the filing does not report adds nothing: its cost is inside
    // other operating costs, which is what makes operating income tie.
    S.ebit[t] =
      S.grossProfit[t] + (S.rnd[t] ?? 0) + (S.sga[t] ?? 0) + (S.otherOperatingCosts[t] ?? 0) - nonCash(t);
  }

  // Reported years are what the company filed. Interest expense and items
  // after tax (non-controlling interests, discontinued operations) are carried
  // where the data file provides them, so reported pretax profit and net income
  // are the filed figures rather than operating profit relabelled. Apple's
  // hand-built file folds interest into other income, as its filing does.
  // The filed pretax and net income themselves are kept alongside, so anything
  // that still does not tie is visible (the export's Checks sheet tests it).
  S.otherItemsAfterTax = blank();
  S.pretaxProfitAsFiled = blank();
  S.netIncomeAsFiled = blank();
  for (let t = 0; t < nH; t++) {
    const num = (v) => (typeof v === 'number' && isFinite(v) ? v : null);
    const interestIncome = num(h.incomeStatement.interestIncome?.[t]);
    const interestExpense = num(h.incomeStatement.interestExpense?.[t]);
    if (interestIncome !== null) S.interestIncome[t] = interestIncome;
    if (interestExpense !== null) S.interestExpense[t] = interestExpense;
    S.otherIncomeExpense[t] = num(h.incomeStatement.otherIncomeExpense[t]) ?? 0;
    S.otherItemsAfterTax[t] = num(h.incomeStatement.otherItemsAfterTax?.[t]);
    S.pretaxProfitAsFiled[t] = num(h.incomeStatement.pretaxIncomeAsFiled?.[t]);
    S.netIncomeAsFiled[t] = num(h.incomeStatement.netIncomeAsFiled?.[t]);
    S.taxes[t] = h.incomeStatement.taxes[t];
    S.pretaxProfit[t] =
      S.ebit[t] + (interestIncome ?? 0) + (interestExpense ?? 0) + S.otherIncomeExpense[t];
    S.netIncome[t] = S.pretaxProfit[t] + S.taxes[t] + (S.otherItemsAfterTax[t] ?? 0);
    S.taxRate[t] = -S.taxes[t] / S.pretaxProfit[t];
  }

  const taxFcst = a.taxRate === 'avgOfFirstAndLast'
    ? avg([S.taxRate[0], S.taxRate[nH - 1]])
    : a.taxRate === 'avgOfHistory' ? avg(S.taxRate.slice(0, nH)) : a.taxRate;

  // ------------------------------------------------------- 5. DEBT SCHEDULE
  S.debt = {
    beginning: blank(), borrowing: blank(), pikAccrual: blank(), ending: blank(),
    interestExpense: blank(), weightedAverageRate: blank(),
  };
  for (let t = 0; t < nH; t++) S.debt.ending[t] = h.balanceSheet.longTermDebt[t];
  S.debt.interestExpense[nH - 1] = a.interestExpenseFY2025;
  S.debt.pikAccrual[nH - 1] = a.pikAccrualFY2025;
  // No interest means no PIK. Dividing anyway made a company that reports no
  // debt (zero interest over zero interest) carry a not-a-number debt balance
  // through every forecast year.
  const pikPct = a.interestExpenseFY2025 ? (a.pikAccrualFY2025 ?? 0) / a.interestExpenseFY2025 : 0;
  S.cashInterestPct = 1 - pikPct;
  S.pikPct = pikPct;

  for (let t = nH; t < nH + nF; t++) {
    S.debt.beginning[t] = S.debt.ending[t - 1];
    S.debt.borrowing[t] = -a.debtRepaymentSchedule[t - nH];
    S.debt.interestExpense[t] = a.interestExpenseOnLongTermDebt[t - nH];
    S.debt.pikAccrual[t] = S.debt.interestExpense[t] * pikPct;
    S.debt.ending[t] = S.debt.beginning[t] + S.debt.borrowing[t] + S.debt.pikAccrual[t];
  }
  for (let t = nH - 1; t < nH + nF; t++) {
    if (S.debt.ending[t - 1] == null || S.debt.interestExpense[t] == null) continue;
    S.debt.weightedAverageRate[t] =
      S.debt.interestExpense[t] / avg([S.debt.ending[t - 1], S.debt.ending[t]]);
  }

  // ------------------------------------------------ 6. INCOME STATEMENT (rest)
  // With the circuit breaker ON there is no interest income and no revolver
  // interest, so the income statement closes without iterating.
  S.revolver = { beginning: blank(), change: blank(), ending: blank(), interestExpense: blank() };
  for (let t = 0; t < nH; t++) S.revolver.ending[t] = h.balanceSheet.revolver[t];

  for (let t = nH; t < nH + nF; t++) {
    S.interestIncome[t] = 0;              // zero while the breaker is ON
    S.revolver.interestExpense[t] = 0;    // zero while the breaker is ON
    S.interestExpense[t] = -(S.debt.interestExpense[t] + S.revolver.interestExpense[t]);
    S.otherIncomeExpense[t] = a.otherIncomeExpense[t - nH];
    S.pretaxProfit[t] = S.ebit[t] + S.interestIncome[t] + S.interestExpense[t] + S.otherIncomeExpense[t];
    S.taxRate[t] = taxFcst;
    S.taxes[t] = -(S.pretaxProfit[t] * taxFcst);
    S.netIncome[t] = S.pretaxProfit[t] + S.taxes[t];
  }

  S.ebitda = blank();
  for (let t = 0; t < nH + nF; t++) {
    // EBITDA is operating profit before depreciation and amortisation, and
    // NOT before stock compensation, which stays a cost.
    //
    // This is a definition the model does not get to choose. A multiple is
    // only meaningful against the same measure it was computed from, and the
    // peers' EV/EBITDA multiples come from a source that computes EBITDA as
    // operating income plus depreciation and amortisation, stock compensation
    // left in costs (checked against that source's own annual figures: for
    // Arm, Palantir, Salesforce and Apple its EBITDA equals its operating
    // income plus its depreciation to the last million, and is short of the
    // stock-compensation add-back by exactly the stock compensation). Adding
    // it back here and then applying their multiple valued a larger EBITDA at
    // a multiple derived from a smaller one.
    //
    // Stock compensation is also a real cost of employing people: it is paid
    // in shares rather than cash, and the dilution it causes is carried in the
    // share count, not waved through as a non-cash add-back. The unlevered
    // cash flow still adds it back, because that calculation is about cash.
    S.ebitda[t] = S.ebit[t] + S.depreciationAmortisation[t];
  }

  // --------------------------------------------- 7. EQUITY & SHARE SCHEDULES
  // Common stock / APIC
  S.commonStock = { beginning: blank(), issuances: blank(), sbc: blank(), ending: blank() };
  for (let t = 0; t < nH; t++) S.commonStock.ending[t] = h.balanceSheet.commonStockAPIC[t];
  for (let t = nH; t < nH + nF; t++) {
    S.commonStock.beginning[t] = S.commonStock.ending[t - 1];
    S.commonStock.issuances[t] = a.newShareIssuance[t - nH];
    S.commonStock.sbc[t] = S.stockBasedCompensation[t];
    S.commonStock.ending[t] =
      S.commonStock.beginning[t] + S.commonStock.issuances[t] + S.commonStock.sbc[t];
  }

  // Retained earnings and dividends
  S.dividendPayoutRatio = blank();
  S.dividends = blank();
  for (let t = 0; t < nH; t++) {
    // Null in a year the filing does not report dividends, and the ratio with it.
    S.dividends[t] = h.cashFlow.dividends[t] ?? null;
    S.dividendPayoutRatio[t] = isNum(S.dividends[t]) ? -S.dividends[t] / S.netIncome[t] : null;
  }
  const payoutFcst = a.dividendPayoutRatio === 'linearRegression'
    ? forecastLinear(
        meta.forecastYears[0],
        S.dividendPayoutRatio.slice(0, nH),
        meta.historicalYears,
      )
    : a.dividendPayoutRatio;

  S.retainedEarnings = { beginning: blank(), netIncome: blank(), dividends: blank(), ending: blank() };
  for (let t = 0; t < nH; t++) S.retainedEarnings.ending[t] = h.balanceSheet.retainedEarnings[t];
  for (let t = nH; t < nH + nF; t++) {
    S.dividendPayoutRatio[t] = payoutFcst;
    S.dividends[t] = -(S.netIncome[t] * payoutFcst);
    S.retainedEarnings.beginning[t] = S.retainedEarnings.ending[t - 1];
    S.retainedEarnings.netIncome[t] = S.netIncome[t];
    S.retainedEarnings.dividends[t] = S.dividends[t];
    S.retainedEarnings.ending[t] =
      S.retainedEarnings.beginning[t] + S.netIncome[t] + S.dividends[t];
  }

  // Treasury stock and buybacks
  S.buybackCeiling = blank();
  S.repurchasePercent = blank();
  S.shareRepurchases = blank();
  for (let t = 0; t < nH; t++) {
    // Null in a year the filing does not report repurchases, and the ratio with it.
    S.buybackCeiling[t] = a.authorisedBuybackCeiling.historical[t] ?? null;
    S.shareRepurchases[t] = h.cashFlow.shareRepurchases[t] ?? null;
    S.repurchasePercent[t] =
      isNum(S.shareRepurchases[t]) && isNum(S.buybackCeiling[t]) && S.buybackCeiling[t] !== 0
        ? -S.shareRepurchases[t] / S.buybackCeiling[t]
        : null;
  }
  // Averaged over the years that report repurchases. None reported: none forecast.
  const repurchasePct = a.repurchasePercentOfCeiling === 'avgOfHistory'
    ? avgReported(S.repurchasePercent.slice(0, nH)) ?? 0
    : a.repurchasePercentOfCeiling;

  for (let t = nH; t < nH + nF; t++) {
    const rule = a.authorisedBuybackCeiling.forecast[t - nH];
    // 'avgOfPriorFour' = the average of the three historical ceilings plus the
    // first forecast ceiling, held constant thereafter (a fixed window, not a
    // rolling one — the Excel uses an absolute range here). Only ceilings that
    // exist are averaged: a year that reports none, or a first forecast ceiling
    // that is itself this rule (a derived model), is left out rather than
    // counted as nil, which understated a derived model's ceiling by a fifth.
    S.buybackCeiling[t] = rule === 'avgOfPriorFour'
      ? avgReported(S.buybackCeiling.slice(0, nH + 1)) ?? 0
      : rule;
    S.repurchasePercent[t] = repurchasePct;
    S.shareRepurchases[t] = -(S.buybackCeiling[t] * repurchasePct);
  }

  S.treasury = { beginning: blank(), repurchases: blank(), ending: blank() };
  for (let t = 0; t < nH; t++) S.treasury.ending[t] = h.balanceSheet.treasuryStock[t];
  for (let t = nH; t < nH + nF; t++) {
    S.treasury.beginning[t] = S.treasury.ending[t - 1];
    S.treasury.repurchases[t] = S.shareRepurchases[t];
    S.treasury.ending[t] = S.treasury.beginning[t] + S.treasury.repurchases[t];
  }

  // Other comprehensive income — held flat
  S.oci = { beginning: blank(), change: blank(), ending: blank() };
  for (let t = 0; t < nH; t++) S.oci.ending[t] = h.balanceSheet.otherComprehensiveIncome[t];
  for (let t = nH; t < nH + nF; t++) {
    S.oci.beginning[t] = S.oci.ending[t - 1];
    S.oci.change[t] = 0;
    S.oci.ending[t] = S.oci.beginning[t] + S.oci.change[t];
  }

  // ------------------------------------------------- 8. CASH FLOW STATEMENT
  S.cashFlow = {
    operating: blank(), investing: blank(), financing: blank(), netChangeInCash: blank(),
  };
  for (let t = nH; t < nH + nF; t++) {
    S.cashFlow.operating[t] = sum([
      S.netIncome[t],
      S.depreciationAmortisation[t],
      S.stockBasedCompensation[t],
      -S.wc.accountsReceivable.change[t],
      -S.wc.inventory.change[t],
      S.wc.accountsPayable.change[t],
      S.wc.accruedExpenses.change[t],
      -S.wc.otherCurrentAssets.change[t],
      -S.wc.deferredTaxAssets.change[t],
      -S.wc.otherAssets.change[t],
      S.wc.otherNonCurrentLiabilities.change[t],
      S.debt.pikAccrual[t],
    ]);
    S.cashFlow.investing[t] = -S.ppe.capex[t];
  }

  // ------------------------------------- 9. REVOLVER, CASH AND BALANCE SHEET
  S.cash = { beginning: blank(), change: blank(), ending: blank() };
  for (let t = 0; t < nH; t++) S.cash.ending[t] = h.balanceSheet.cashAndSecurities[t];

  S.revolverAnalysis = { excessCash: blank(), freeCashFlow: blank(), available: blank() };

  for (let t = nH; t < nH + nF; t++) {
    // Financing lines other than the revolver
    const financingExRevolver = sum([
      S.debt.borrowing[t], S.dividends[t], S.commonStock.issuances[t],
      S.treasury.repurchases[t], S.oci.change[t],
    ]);

    S.cash.beginning[t] = S.cash.ending[t - 1];
    S.revolver.beginning[t] = S.revolver.ending[t - 1];
    S.revolverAnalysis.excessCash[t] = S.cash.beginning[t] - a.minimumCashDesired;
    S.revolverAnalysis.freeCashFlow[t] =
      S.cashFlow.operating[t] + S.cashFlow.investing[t] + financingExRevolver;
    S.revolverAnalysis.available[t] =
      S.revolverAnalysis.excessCash[t] + S.revolverAnalysis.freeCashFlow[t];

    // Sweep: pay the revolver down with whatever cash is spare, draw if short
    S.revolver.change[t] = -Math.min(S.revolver.beginning[t], S.revolverAnalysis.available[t]);
    S.revolver.ending[t] = S.revolver.beginning[t] + S.revolver.change[t];

    S.cashFlow.financing[t] = financingExRevolver + S.revolver.change[t];
    S.cashFlow.netChangeInCash[t] =
      S.cashFlow.operating[t] + S.cashFlow.investing[t] + S.cashFlow.financing[t];

    S.cash.change[t] = S.cashFlow.netChangeInCash[t];
    S.cash.ending[t] = S.cash.beginning[t] + S.cash.change[t];
  }

  // Balance sheet
  S.balanceSheet = {
    cashAndSecurities: S.cash.ending,
    accountsReceivable: S.wc.accountsReceivable.ending,
    inventory: S.wc.inventory.ending,
    deferredTaxAssets: S.wc.deferredTaxAssets.ending,
    otherCurrentAssets: S.wc.otherCurrentAssets.ending,
    propertyPlantEquipment: S.ppe.ending,
    otherAssets: S.wc.otherAssets.ending,
    accountsPayable: S.wc.accountsPayable.ending,
    accruedExpenses: S.wc.accruedExpenses.ending,
    revolver: S.revolver.ending,
    longTermDebt: S.debt.ending,
    otherNonCurrentLiabilities: S.wc.otherNonCurrentLiabilities.ending,
    commonStockAPIC: S.commonStock.ending,
    treasuryStock: S.treasury.ending,
    retainedEarnings: S.retainedEarnings.ending,
    otherComprehensiveIncome: S.oci.ending,
    totalAssets: blank(), totalLiabilities: blank(), totalEquity: blank(), balanceCheck: blank(),
  };
  const B = S.balanceSheet;
  for (let t = 0; t < nH + nF; t++) {
    if (B.cashAndSecurities[t] == null) continue;
    B.totalAssets[t] = sum([
      B.cashAndSecurities[t], B.accountsReceivable[t], B.inventory[t],
      B.deferredTaxAssets[t], B.otherCurrentAssets[t], B.propertyPlantEquipment[t], B.otherAssets[t],
    ]);
    B.totalLiabilities[t] = sum([
      B.accountsPayable[t], B.accruedExpenses[t], B.revolver[t],
      B.longTermDebt[t], B.otherNonCurrentLiabilities[t],
    ]);
    B.totalEquity[t] = sum([
      B.commonStockAPIC[t], B.treasuryStock[t], B.retainedEarnings[t], B.otherComprehensiveIncome[t],
    ]);
    B.balanceCheck[t] = Math.round((B.totalAssets[t] - B.totalLiabilities[t] - B.totalEquity[t]) * 1000) / 1000;
  }

  // ------------------------------------------------------- SHARE COUNT & EPS
  S.consensusEPS = blank();
  S.epsGrowth = blank();
  S.averageSharePrice = blank();
  S.shares = { beginning: blank(), issued: blank(), repurchased: blank(), ending: blank() };

  S.shares.ending[nH - 1] = h.basicSharesClosing;
  S.averageSharePrice[nH - 1] = h.averageSharePrice;

  S.basicShares = blank();
  S.dilutiveImpact = blank();
  S.dilutedShares = blank();
  S.basicEPS = blank();
  S.dilutedEPS = blank();
  for (let t = 0; t < nH; t++) {
    S.basicShares[t] = h.incomeStatement.basicShares[t];
    S.dilutedShares[t] = h.incomeStatement.dilutedShares[t];
    S.dilutiveImpact[t] = S.dilutedShares[t] - S.basicShares[t];
    S.basicEPS[t] = S.netIncome[t] / S.basicShares[t];
    S.dilutedEPS[t] = S.netIncome[t] / S.dilutedShares[t];
    S.consensusEPS[t] = S.dilutedEPS[t];
  }
  for (let t = 1; t < nH; t++) {
    S.epsGrowth[t] = (S.consensusEPS[t] - S.consensusEPS[t - 1]) / S.consensusEPS[t - 1];
  }

  for (let t = nH; t < nH + nF; t++) {
    const given = a.consensusEPS[t - nH];
    if (given != null) {
      S.consensusEPS[t] = given;
      S.epsGrowth[t] = (S.consensusEPS[t] - S.consensusEPS[t - 1]) / S.consensusEPS[t - 1];
    } else {
      S.epsGrowth[t] = a.epsGrowth[t - nH];
      S.consensusEPS[t] = S.consensusEPS[t - 1] * (1 + S.epsGrowth[t]);
    }
    S.averageSharePrice[t] = S.averageSharePrice[t - 1] * (1 + S.epsGrowth[t]);

    S.shares.beginning[t] = S.shares.ending[t - 1];
    S.shares.issued[t] = S.commonStock.issuances[t] / S.averageSharePrice[t];
    S.shares.repurchased[t] = S.shareRepurchases[t] / S.averageSharePrice[t];
    S.shares.ending[t] = S.shares.beginning[t] + S.shares.issued[t] + S.shares.repurchased[t];

    S.basicShares[t] = avg([S.shares.beginning[t], S.shares.ending[t]]);
    S.dilutiveImpact[t] = S.dilutiveImpact[nH - 1];
    S.dilutedShares[t] = S.basicShares[t] + S.dilutiveImpact[t];
    S.basicEPS[t] = S.netIncome[t] / S.basicShares[t];
    S.dilutedEPS[t] = S.netIncome[t] / S.dilutedShares[t];
  }

  // ------------------------------------------------------------------ RATIOS
  S.ratios = { netDebt: blank(), assetTurnover: blank(), netMargin: blank(), roa: blank(), roe: blank() };
  for (let t = 0; t < nH + nF; t++) {
    if (B.totalAssets[t] == null) continue;
    S.ratios.netDebt[t] = B.longTermDebt[t] - B.cashAndSecurities[t];
    S.ratios.assetTurnover[t] = S.revenue[t] / B.totalAssets[t];
    S.ratios.netMargin[t] = S.netIncome[t] / S.revenue[t];
    S.ratios.roa[t] = S.netIncome[t] / B.totalAssets[t];
    S.ratios.roe[t] = S.netIncome[t] / B.totalEquity[t];
  }

  return { years, nH, nF, meta, ...S };
}


// ===========================================================================
// VALUATION APPLICABILITY
// ===========================================================================
// Runs BEFORE any valuation is displayed. If this returns applicable: false,
// the dashboard must show the reported historicals and the message — and must
// NOT show an implied value, a premium/discount, or a sensitivity grid.
// A wrong number with a caveat beside it is still a wrong number.

const FINANCIAL_SECTOR = /financial|bank|insurance|capital market|asset management|nbfc/i;

// ---------------------------------------------------------------------------
// BALANCE SHEET INTEGRITY
// ---------------------------------------------------------------------------
// Assets less liabilities less equity, in every year that carries a balance
// sheet at all (a hand-built file may leave an early year blank), reported and
// forecast, rounded to a thousandth as the balance check is. A model whose
// balance sheet does not balance has lost money somewhere between its
// statements, so every figure built on them is suspect: no valuation of any
// kind may be shown for it. This measures the lines directly rather than
// reading balanceSheet.balanceCheck, which skips any year with no cash figure.
const BALANCE_ASSETS = ['cashAndSecurities', 'accountsReceivable', 'inventory', 'deferredTaxAssets',
  'otherCurrentAssets', 'propertyPlantEquipment', 'otherAssets'];
const BALANCE_LIABILITIES = ['accountsPayable', 'accruedExpenses', 'revolver', 'longTermDebt',
  'otherNonCurrentLiabilities'];
const BALANCE_EQUITY = ['commonStockAPIC', 'treasuryStock', 'retainedEarnings', 'otherComprehensiveIncome'];

export function balanceSheetIntegrity(model) {
  const B = model.balanceSheet || {};
  const failures = [];
  let yearsChecked = 0;
  let reportedYearsChecked = 0;
  for (let t = 0; t < model.years.length; t++) {
    const keys = [...BALANCE_ASSETS, ...BALANCE_LIABILITIES, ...BALANCE_EQUITY];
    const values = keys.map((k) => B[k]?.[t]);
    if (!values.some((v) => typeof v === 'number' && v !== 0)) continue;
    yearsChecked++;
    if (t < model.nH) reportedYearsChecked++;
    const broken = values.some((v) => typeof v === 'number' && !isFinite(v));
    const total = (ks) => ks.reduce((s, k) => s + (typeof B[k]?.[t] === 'number' ? B[k][t] : 0), 0);
    const gap = Math.round((total(BALANCE_ASSETS) - total(BALANCE_LIABILITIES) - total(BALANCE_EQUITY)) * 1000) / 1000;
    if (broken || !isFinite(gap) || gap !== 0) {
      failures.push({ year: model.years[t], gap: broken ? NaN : gap, forecast: t >= model.nH });
    }
  }
  return { balances: failures.length === 0, failures, yearsChecked, reportedYearsChecked };
}

const fiscalYearList = (years) => {
  const runs = [];
  for (const y of [...years].sort((a, b) => a - b)) {
    const run = runs[runs.length - 1];
    if (run && y === run[1] + 1) run[1] = y;
    else runs.push([y, y]);
  }
  return runs.map(([a, b]) => (a === b ? `FY${a}` : `FY${a}–FY${b}`)).join(', ');
};

// The refusal for a balance sheet that does not balance, or a filing missing a
// line the valuation itself depends on. Null when neither applies.
function balanceSheetRefusal(model, data) {
  const integrity = balanceSheetIntegrity(model);
  const gaps = Array.isArray(data?.meta?.balanceSheetGaps) ? data.meta.balanceSheetGaps : [];
  const blocking = gaps.filter((g) => g.blocksValuation);
  if (integrity.balances && blocking.length === 0) return null;

  const missing = gaps.length
    ? 'The filing did not report ' +
      gaps
        .map((g) => `${g.label} (${fiscalYearList(g.years)}${g.derivedAs ? `, worked out as ${g.derivedAs}` : ''})`)
        .join(', ') +
      '. '
    : 'No balance sheet line is missing from the data, so the difference lies in the reported figures themselves. ';

  if (!integrity.balances) {
    const measurable = integrity.failures.filter((f) => isFinite(f.gap));
    const unmeasurable = integrity.failures.filter((f) => !isFinite(f.gap));
    const worst = measurable.reduce((a, f) => (!a || Math.abs(f.gap) > Math.abs(a.gap) ? f : a), null);
    const everyYear = integrity.failures.length === integrity.yearsChecked;
    const inputGaps = Array.isArray(data?.meta?.forecastInputGaps) ? data.meta.forecastInputGaps : [];
    const inputs = inputGaps.length
      ? `The filing never reported ${inputGaps.map((g) => `${g.label} (${g.drives})`).join('; ')}. `
      : '';
    const parts = [];
    if (measurable.length) {
      parts.push(
        `total assets differ from liabilities plus equity in ${fiscalYearList(measurable.map((f) => f.year))}, ` +
          `by as much as ${Math.abs(worst.gap).toLocaleString('en-US', { maximumFractionDigits: 0 })} (FY${worst.year})`
      );
    }
    if (unmeasurable.length) {
      parts.push(`in ${fiscalYearList(unmeasurable.map((f) => f.year))} some of its lines cannot be computed at all and come out as not-a-number`);
    }
    return {
      code: 'balanceSheetDoesNotBalance',
      integrity,
      balanceSheetGaps: gaps,
      message:
        `The balance sheet this model is built from does not balance${everyYear && !unmeasurable.length ? ' in any year' : ''}: ` +
        `${parts.join('; and ')}. ${inputs}${missing}` +
        'A valuation built on a balance sheet that does not add up is a wrong number, so none is ' +
        'shown. The reported figures below are unaffected.',
    };
  }

  const reasons = blocking
    .map((g) => `${g.label} for ${fiscalYearList(g.years)}${g.reportedIn ? ` (it did for ${fiscalYearList(g.reportedIn)})` : ''}, and ${g.reason}`)
    .join('; ');
  return {
    code: 'filingMissingValuationInput',
    integrity,
    balanceSheetGaps: gaps,
    message:
      `The filing did not report ${reasons}. The balance sheet can be made to add up without it, ` +
      'but the valuation cannot, so none is shown. The reported figures below are unaffected.',
  };
}

// ---------------------------------------------------------------------------
// THE FILED BALANCE SHEET ALONE
// ---------------------------------------------------------------------------
// Residual income values a bank from its filed balance sheet and earnings, not
// from this engine's forecast. So it is gated on whether the FILED balance
// sheet balances (the reported years, after the lines the filing omits have
// been derived), and not on the forecast, which for a bank usually cannot be
// computed at all: banks do not report cost of sales, capital expenditure or
// PP&E the way the forecast needs. The discounted cash flow stays refused for
// such a company; only this value is exempt. Null when the filed sheet
// balances; otherwise the refusal, naming what failed.
export function filedBalanceSheetRefusal(model, data) {
  const integrity = balanceSheetIntegrity(model);
  const filedFailures = integrity.failures.filter((f) => !f.forecast);
  if (integrity.reportedYearsChecked > 0 && filedFailures.length === 0) return null;

  const gaps = Array.isArray(data?.meta?.balanceSheetGaps) ? data.meta.balanceSheetGaps : [];
  const missing = gaps.length
    ? 'The filing did not report ' +
      gaps
        .map((g) => `${g.label} (${fiscalYearList(g.years)}${g.derivedAs ? `, worked out as ${g.derivedAs}` : ''})`)
        .join(', ') +
      '. '
    : '';
  if (integrity.reportedYearsChecked === 0) {
    return {
      code: 'filedBalanceSheetUnavailable',
      message:
        'No filed balance sheet is available to check, and residual income is built on one, so no ' +
        'value is shown. The reported figures below are unaffected.',
    };
  }
  const measurable = filedFailures.filter((f) => isFinite(f.gap));
  const worst = measurable.reduce((a, f) => (!a || Math.abs(f.gap) > Math.abs(a.gap) ? f : a), null);
  const size = worst
    ? `, by as much as ${Math.abs(worst.gap).toLocaleString('en-US', { maximumFractionDigits: 0 })} (FY${worst.year})`
    : '';
  return {
    code: 'filedBalanceSheetDoesNotBalance',
    message:
      `The balance sheet this company filed does not balance, even after the lines it omits are ` +
      `worked out: total assets differ from liabilities plus equity in ` +
      `${fiscalYearList(filedFailures.map((f) => f.year))}${size}. ${missing}` +
      'Residual income is built on the filed balance sheet, so no value is shown. The reported ' +
      'figures below are unaffected.',
  };
}

// ---------------------------------------------------------------------------
// THE REPORTED INCOME STATEMENT MUST BE THE FILED ONE
// ---------------------------------------------------------------------------
// Reported operating income, pretax income, tax and net income have to be the
// filed figures. Where the filing does not report one of them in a reported
// year, the reported column could only be filled with the model's own
// estimate. Without filed operating income in particular, whatever the three
// named cost lines miss would be carried as "other income", below operating
// profit, where the forecast (which sets other income to nil) drops it and
// overstates profit. So the model is refused and the missing lines are named.
function incomeStatementRefusal(data) {
  const gaps = Array.isArray(data?.meta?.incomeStatementGaps) ? data.meta.incomeStatementGaps : [];
  if (!gaps.length) return null;
  const listed = gaps.map((g) => `${g.label} for ${fiscalYearList(g.years)}`).join(', ');
  return {
    code: 'filingMissingIncomeStatementLine',
    incomeStatementGaps: gaps,
    message:
      `The filing does not report ${listed}. The reported income statement is meant to be what the ` +
      `company filed, and without ${gaps.length > 1 ? 'those lines' : 'that line'} it would carry the ` +
      "model's own estimate instead, with the forecast built on it, so no value is shown. The reported " +
      'figures below are unaffected.',
  };
}

// ---------------------------------------------------------------------------
// THE PRICE MUST BE COMPARABLE WITH THE STATEMENTS
// ---------------------------------------------------------------------------
// Set by the derivation (deriveModel.js, listingComparability): the statements'
// currency is not established, the price could not be put in it, or the share
// count may not count the security the price is for (a depositary receipt).
// Every value per share, a bank's residual income included, would compare
// things that do not describe the same security in the same currency.
export function listingRefusal(data) {
  const refusal = data?.meta?.listingRefusal;
  return refusal && refusal.code ? refusal : null;
}

// The codes that mean "no valuation of any kind", not merely "no DCF". A bank's
// residual income is gated instead by filedBalanceSheetRefusal above, and by
// listingRefusal, which applies to it too.
export const INTEGRITY_REFUSAL_CODES = [
  'balanceSheetDoesNotBalance',
  'filingMissingValuationInput',
  'filingMissingIncomeStatementLine',
  'listingNotComparable',
  'nonCommonClaimNotReported',
];

export function checkValuationApplicability(model, data, wacc) {
  const { nH, nF } = model;
  const meta = data.meta;
  const sic = meta.sicCode;

  // 0. The balance sheet must balance in every year, and the filing must carry
  //    the lines net debt is built from. Checked first, so that when a model is
  //    broken this is the reason given, whatever else also applies.
  const brokenBalanceSheet = balanceSheetRefusal(model, data);
  if (brokenBalanceSheet) return { applicable: false, ...brokenBalanceSheet };
  const incompleteIncomeStatement = incomeStatementRefusal(data);
  if (incompleteIncomeStatement) return { applicable: false, ...incompleteIncomeStatement };
  const incomparableListing = listingRefusal(data);
  if (incomparableListing) return { applicable: false, ...incomparableListing };

  // 0. Minority interests or preferred stock the filing shows exist but does
  //    not give the amount of (deriveModel.js, otherClaimsRefusal). Every value
  //    per share would include what belongs to those holders.
  if (meta.otherClaimsRefusal?.code) return { applicable: false, ...meta.otherClaimsRefusal };

  // 0a. An input the forecast is built from that the filing never reports:
  //     cost of sales, capital expenditure, or two years of PP&E. The
  //     derivation records these (deriveModel.js, forecastInputGaps), and they
  //     used to refuse a company only by accident, through the not-a-number
  //     they left in the forecast balance sheet. Reading the depreciation rate
  //     from filed depreciation removes that accident: Meta, Micron and Philip
  //     Morris report no net PP&E at all, and their forecast would otherwise
  //     start from an opening balance of nil and depreciate only what the
  //     forecast itself spends. Refused explicitly instead, and named.
  const inputGaps = Array.isArray(meta.forecastInputGaps) ? meta.forecastInputGaps : [];
  if (inputGaps.length) {
    return {
      applicable: false,
      code: 'filingMissingValuationInput',
      message:
        'The filing never reported ' +
        inputGaps.map((g) => `${g.label} (${g.drives})`).join('; ') +
        '. The forecast cannot be built without it, so no implied value is shown. The reported ' +
        'figures below are unaffected.',
    };
  }

  // 0b. A depreciation rate that cannot be forecast from (see the PP&E schedule).
  if (model.depreciationRateProblem) {
    return {
      applicable: false,
      code: 'implausibleDepreciationRate',
      message:
        `${model.depreciationRateProblem[0].toUpperCase()}${model.depreciationRateProblem.slice(1)}. ` +
        'Depreciation drives the tax the forecast pays and the capital spending the terminal value ' +
        'assumes, so no implied value is shown rather than one built on it. The reported figures ' +
        'below are unaffected.',
    };
  }

  // 1. Financial-sector companies — unlevered FCF is not a meaningful concept
  const sicIsFinancial = sic != null && Number(sic) >= 6000 && Number(sic) <= 6799;
  const sectorIsFinancial = meta.sector != null && FINANCIAL_SECTOR.test(meta.sector);
  if (meta.forceValuationApplicable !== true && (sicIsFinancial || sectorIsFinancial)) {
    return {
      applicable: false,
      code: 'financialSector',
      message:
        'This model values companies through unlevered free cash flow. That does not ' +
        'apply to banks, NBFCs, insurers and other financial institutions, where ' +
        'borrowing is raw material rather than financing. Valuing this company needs a ' +
        'different method, so no implied value is shown.',
    };
  }

  // 2. Negative operating profit — there is no positive cash stream to discount
  for (let t = nH; t < nH + nF; t++) {
    if (model.ebit[t] <= 0) {
      return {
        applicable: false,
        code: 'negativeOperatingProfit',
        message:
          'Operating profit is negative in at least one forecast year. A discounted ' +
          'cash flow needs a positive cash stream to discount, so no implied value is ' +
          'shown. The reported financials below are unaffected.',
      };
    }
  }

  // 3. Terminal growth at or above the discount rate — the formula breaks
  const g = data.dcf.longTermGrowthRate;
  if (wacc != null && g >= wacc) {
    return {
      applicable: false,
      code: 'terminalGrowthExceedsWACC',
      message:
        'The long-term growth rate is at or above the cost of capital. The perpetuity ' +
        'formula has no finite answer in that case, so no implied value is shown. ' +
        'Lower the growth assumption or raise the discount rate.',
    };
  }

  return { applicable: true, code: null, message: null };
}

// ===========================================================================
// DCF
// ===========================================================================
export function buildDCF(model, data) {
  const { nH, nF } = model;
  const d = data.dcf;
  const M = model;

  // waccOverride: bypass CAPM and use a direct rate (e.g. from a slider)
  const waccResult = data.dcf.waccOverride != null
    ? { wacc: data.dcf.waccOverride }
    : computeWACC(model, data);

  const applicability = checkValuationApplicability(model, data, waccResult.wacc);
  if (!applicability.applicable) return { ...applicability, waccDetail: waccResult };

  const R = { applicable: true, wacc: waccResult.wacc, waccDetail: waccResult };

  const idx = (t) => nH + t; // t = 0..nF-1 maps to the forecast columns

  R.years = data.meta.forecastYears;
  R.ebitda = []; R.ebit = []; R.taxRate = []; R.ebiat = [];
  R.unleveredCFO = []; R.capex = []; R.unleveredFCF = []; R.terminalExcludedAmount = [];
  R.discountFactor = []; R.presentValue = [];

  for (let t = 0; t < nF; t++) {
    const i = idx(t);
    R.ebitda.push(M.ebitda[i]);
    R.ebit.push(M.ebit[i]);
    R.taxRate.push(M.taxRate[i]);
    const ebiat = M.ebit[i] * (1 - M.taxRate[i]);
    R.ebiat.push(ebiat);

    // Unlevered cash flow from operations: EBIAT plus non-cash items plus the
    // change in working capital. Net income is deliberately NOT here — it is
    // already inside EBIAT, and adding it again would count earnings twice.
    const cfo = sum([
      ebiat,
      M.depreciationAmortisation[i],
      M.stockBasedCompensation[i],
      -M.wc.accountsReceivable.change[i],
      -M.wc.inventory.change[i],
      M.wc.accountsPayable.change[i],
      M.wc.accruedExpenses.change[i],
      -M.wc.otherCurrentAssets.change[i],
      -M.wc.deferredTaxAssets.change[i],
      -M.wc.otherAssets.change[i],
      M.wc.otherNonCurrentLiabilities.change[i],
    ]);
    R.unleveredCFO.push(cfo);
    R.terminalExcludedAmount.push(sum(
      (d.terminalExclusions || []).map((k) => {
        const signIsNegative = ['accountsReceivable', 'inventory', 'otherCurrentAssets', 'deferredTaxAssets', 'otherAssets'].includes(k);
        return signIsNegative ? -M.wc[k].change[i] : M.wc[k].change[i];
      }),
    ));
    R.capex.push(-M.ppe.capex[i]);
    R.unleveredFCF.push(cfo - M.ppe.capex[i]);

    const df = yearFrac(d.sharePriceDate, data.meta.forecastYearEndDates[t]);
    R.discountFactor.push(df);
    R.presentValue.push(R.unleveredFCF[t] / (1 + R.wacc) ** df);
  }

  R.pvStageOne = sum(R.presentValue);
  const lastDF = R.discountFactor[nF - 1];
  const last = idx(nF - 1);

  // ---- Terminal value: perpetuity ----
  // Terminal capex treatment is a policy choice set in the data file.
  // The terminal year is normalised as though amortisation of intangibles has
  // run off, which it does (see the PP&E schedule): its amortisation comes out
  // of depreciation, so "capex equals depreciation" replaces PP&E only, and its
  // tax shield, which lasts only as long as the intangibles, is not
  // capitalised in perpetuity.
  const terminalAmortisation = M.amortisation?.[last] ?? 0;
  const terminalDep = M.depreciationAmortisation[last] - terminalAmortisation;
  const terminalCapex =
    d.terminalCapexTreatment === 'excludeCapex' ? 0
      : d.terminalCapexTreatment === 'capexEqualsDepreciation' ? -terminalDep
        : -M.ppe.capex[last];

  // Lines listed in `terminalExclusions` are stripped out of the terminal year
  // only. Deferred tax movements, for example, are a timing item with no reason
  // to persist in perpetuity — they stay in the explicit forecast years and come
  // out of the normalised figure.
  R.terminalAmortisation = terminalAmortisation;
  R.normalisedFCF =
    R.unleveredCFO[nF - 1] - R.terminalExcludedAmount[nF - 1] + terminalCapex
    - terminalAmortisation * M.taxRate[last];
  R.terminalExclusions = d.terminalExclusions || [];
  R.terminalCapex = terminalCapex;
  R.longTermGrowthRate = d.longTermGrowthRate;
  if (R.normalisedFCF <= 0) {
    return {
      applicable: false,
      code: 'negativeTerminalCashFlow',
      message:
        'Normalised terminal cash flow is not positive, so it cannot be capitalised ' +
        'into a terminal value. No implied value is shown. The reported financials ' +
        'below are unaffected.',
      waccDetail: R.waccDetail,
    };
  }
  R.terminalValuePerpetuity =
    (R.normalisedFCF * (1 + d.longTermGrowthRate)) / (R.wacc - d.longTermGrowthRate);
  R.pvTerminalPerpetuity = R.terminalValuePerpetuity / (1 + R.wacc) ** lastDF;
  R.enterpriseValuePerpetuity = R.pvTerminalPerpetuity + R.pvStageOne;

  // ---- Terminal value: exit multiple ----
  R.terminalEBITDA = M.ebitda[last];
  R.impliedExitMultiple = R.terminalValuePerpetuity / R.terminalEBITDA;
  R.exitMultiple = d.exitEbitdaMultiple;
  R.terminalValueMultiple = R.terminalEBITDA * d.exitEbitdaMultiple;
  R.pvTerminalMultiple = R.terminalValueMultiple / (1 + R.wacc) ** lastDF;
  R.enterpriseValueMultiple = R.pvTerminalMultiple + R.pvStageOne;
  R.impliedPerpetualGrowth =
    (R.terminalValueMultiple * R.wacc - R.normalisedFCF) / (R.normalisedFCF + R.terminalValueMultiple);

  // ---- Equity bridge ----
  // Enterprise value less net debt, less the claims that are not the common
  // shareholders': minority interests in subsidiaries the group consolidates
  // but does not wholly own, and preferred stock. The derivation reads both
  // from the filing (deriveModel.js); a data file that carries neither has
  // none (Apple's).
  // NET DEBT COMES OFF THE MODEL'S OWN BALANCE SHEET, at the last reported
  // date: the borrowings and revolver it shows, less the cash and securities
  // it shows. Not from a figure carried beside the model.
  //
  // The workbook always read the balance sheet, and the engine read a
  // hand-entered `dcf.netDebt`. For a derived company the two are the same by
  // construction, but the curated Apple file carried 146,517 of cash and
  // 82,347 of debt against a balance sheet showing 132,420 and 90,678, so the
  // site and the workbook bridged the same enterprise value to different
  // answers. The balance sheet wins: it is the statement the reader can see,
  // and a bridge that uses a figure appearing nowhere in the model cannot be
  // checked.
  R.netDebt = balanceSheetNetDebt(M, d);
  R.minorityInterest = typeof d.minorityInterest === 'number' && isFinite(d.minorityInterest) ? d.minorityInterest : 0;
  R.preferredStock = typeof d.preferredStock === 'number' && isFinite(d.preferredStock) ? d.preferredStock : 0;
  R.otherClaims = R.minorityInterest + R.preferredStock;
  R.dilutedShares = d.dilutedSharesCount;
  R.marketPrice = d.sharePrice;

  R.perpetuity = equityBridge(R.enterpriseValuePerpetuity, R.netDebt, R.minorityInterest, R.preferredStock, R.dilutedShares, d.sharePrice);
  R.exitMultipleValuation = equityBridge(R.enterpriseValueMultiple, R.netDebt, R.minorityInterest, R.preferredStock, R.dilutedShares, d.sharePrice);

  // ---- Sensitivity grids ----
  R.sensitivity = {
    perpetuity: grid(d.sensitivity.waccSteps, d.sensitivity.growthSteps, (dw, dg) =>
      valuePerShare(R, R.wacc + dw, d.longTermGrowthRate + dg, null, data)),
    exitMultiple: grid(d.sensitivity.waccSteps, d.sensitivity.multipleSteps, (dw, dm) =>
      valuePerShare(R, R.wacc + dw, null, d.exitEbitdaMultiple + dm, data)),
  };
  R.sensitivityAxes = {
    wacc: d.sensitivity.waccSteps.map((s) => R.wacc + s),
    growth: d.sensitivity.growthSteps.map((s) => d.longTermGrowthRate + s),
    multiple: d.sensitivity.multipleSteps.map((s) => d.exitEbitdaMultiple + s),
  };

  return R;
}

/**
 * Borrowings and revolver at the last reported date, less the cash and
 * securities held against them. The data file's own `dcf.netDebt` is used only
 * where the balance sheet does not carry the lines (it always does for a
 * derived company, and for the curated files).
 */
function balanceSheetNetDebt(M, d) {
  const t = M.nH - 1;
  const B = M.balanceSheet || {};
  const debt = B.longTermDebt?.[t];
  const revolver = B.revolver?.[t];
  const cash = B.cashAndSecurities?.[t];
  if (!isNum(debt) || !isNum(cash)) {
    return (d?.netDebt?.cashAndSecurities ?? 0) + (d?.netDebt?.longTermDebt ?? 0);
  }
  return debt + (isNum(revolver) ? revolver : 0) - cash;
}

function equityBridge(enterpriseValue, netDebt, minorityInterest, preferredStock, shares, marketPrice) {
  const equityValue = enterpriseValue - netDebt - minorityInterest - preferredStock;
  const perShare = equityValue / shares;
  return {
    enterpriseValue,
    lessNetDebt: -netDebt,
    lessMinorityInterest: -minorityInterest,
    lessPreferredStock: -preferredStock,
    equityValue,
    dilutedShares: shares,
    valuePerShare: perShare,
    marketPremiumToFairValue: (marketPrice - perShare) / perShare,
  };
}

/** Re-runs the valuation at a different WACC / growth / multiple. */
function valuePerShare(R, wacc, growth, multiple, data) {
  const lastDF = R.discountFactor[R.discountFactor.length - 1];
  const pvStage1 = sum(R.unleveredFCF.map((f, t) => f / (1 + wacc) ** R.discountFactor[t]));
  const tv = multiple == null
    ? (R.normalisedFCF * (1 + growth)) / (wacc - growth)
    : R.terminalEBITDA * multiple;
  const ev = pvStage1 + tv / (1 + wacc) ** lastDF;
  return (ev - R.netDebt - R.otherClaims) / R.dilutedShares;
}

function grid(rowSteps, colSteps, fn) {
  return rowSteps.map((r) => colSteps.map((c) => fn(r, c)));
}

// ===========================================================================
// WACC
// ===========================================================================
export function computeWACC(model, data) {
  const c = data.dcf.costOfCapital;
  const M = model;
  const lastFcst = M.nH + M.nF - 1;

  // Cost of debt = average weighted-average interest rate across the forecast
  const rates = [];
  for (let t = M.nH - 1; t <= lastFcst; t++) {
    if (M.debt.weightedAverageRate[t] != null) rates.push(M.debt.weightedAverageRate[t]);
  }
  const costOfDebt = avg(rates);
  const taxRate = M.taxRate[lastFcst];
  const afterTaxCostOfDebt = costOfDebt * (1 - taxRate);

  // CAPITAL IS WEIGHTED ON GROSS DEBT, NOT NET DEBT.
  //
  // The weights say how the business is financed: what share of the money in
  // it was borrowed and what share was put in by shareholders. A company that
  // borrows 100 and holds 150 in the bank still has 100 of borrowed money in
  // it, costing what it costs. Weighting on net debt made that share negative,
  // the equity weight more than 100%, and the whole cost of capital higher
  // than the cost of equity alone — so holding cash made a company worth less
  // (Equinor lost 4.2% when its securities were finally counted, b7432d6).
  //
  // Cash does not belong here for a second reason: it is already in the equity
  // bridge, where it is added to what the shareholders get. Netting it off the
  // weights as well counts it twice, once in the discount rate and once in the
  // bridge.
  //
  // Debt is at book value, which is what the filing gives; the market value of
  // a company's bonds is not in any free source. Equity is at market value,
  // which is the price the model is comparing itself against anyway.
  // The same balance sheet the bridge uses, so the weights and the bridge
  // cannot describe different capital structures.
  const lastReported = M.nH - 1;
  const grossDebt =
    (isNum(M.balanceSheet?.longTermDebt?.[lastReported]) ? M.balanceSheet.longTermDebt[lastReported] : 0) +
    (isNum(M.balanceSheet?.revolver?.[lastReported]) ? M.balanceSheet.revolver[lastReported] : 0);
  const netDebt = balanceSheetNetDebt(M, data.dcf);
  const marketCap = data.dcf.sharePrice * data.dcf.dilutedSharesCount;

  // Beta — either the stated equity beta or the delevered industry average.
  // Delevering and relevering carry gross debt for the same reason: the
  // formula is asking how much of the equity's risk comes from borrowing, and
  // a borrower's leverage is what it owes, not what it owes less its bank
  // balance. On net debt a company with more cash than debt came out with a
  // beta BELOW its industry's unlevered beta, which says its shares are safer
  // than the same business with no debt at all.
  const comps = c.comparables.map((k) => {
    const marketCap = k.sharePrice * k.dilutedShares;
    const delevered = (k.equityBeta * marketCap) / ((k.debt * (1 - k.taxRate)) + marketCap);
    return { ...k, marketCap, delevered };
  });
  const industryDelevered = avg(comps.map((k) => k.delevered));

  const relevered = (industryDelevered * (grossDebt * (1 - taxRate) + marketCap)) / marketCap;

  // BORROWING MAKES THE SHARES RISKIER, and the cost of equity has to say so.
  //
  // Debt is cheaper than equity, so weighting capital on gross debt (above)
  // means a company that borrows more gets a lower cost of capital. Left
  // there, that runs away: Reliance Infrastructure, borrowing more than twice
  // its market capitalisation, came out at a WACC of 4.27% — below the
  // risk-free rate the model starts from, which is not a defensible rate at
  // which to discount anybody's equity.
  //
  // What was missing is the other half of the trade. Borrowing does not make
  // a business safer; it moves risk onto the shareholders, who rank behind
  // the lenders. So the beta a derived company carries is its ASSET beta, the
  // risk of the business itself, and it is relevered onto this company's own
  // capital structure before the cost of equity is taken from it:
  //
  //     equity beta = asset beta x (1 + (1 - tax) x debt / equity)
  //
  // That is the same Hamada relation used for the comparables above. As
  // leverage rises the equity weight shrinks, but the cost of equity rises to
  // meet it, and the cost of capital falls only by the tax shield rather than
  // without limit.
  const debtToEquity = marketCap > 0 ? grossDebt / marketCap : 0;
  const leveredFromAsset = c.equityBeta * (1 + (1 - taxRate) * debtToEquity);
  const beta =
    c.betaSource === 'industryUnlevered'
      ? relevered
      : c.betaIsUnlevered
        ? leveredFromAsset
        : c.equityBeta;
  const costOfEquity = c.riskFreeRate + c.marketRiskPremium * beta;

  const totalCapital = marketCap + grossDebt;
  const weightEquity = totalCapital > 0 ? marketCap / totalCapital : 1;
  const weightDebt = totalCapital > 0 ? grossDebt / totalCapital : 0;

  return {
    costOfDebt, taxRate, afterTaxCostOfDebt,
    riskFreeRate: c.riskFreeRate, marketRiskPremium: c.marketRiskPremium,
    beta, costOfEquity, comps, industryDelevered, releveredBeta: relevered,
    // What the beta was before this company's own borrowings were put back on
    // it, so the screen can show both.
    assetBeta: c.betaIsUnlevered ? c.equityBeta : null,
    debtToEquity,
    // netDebt is reported because the bridge uses it; the weights do not.
    marketCap, netDebt, grossDebt, weightEquity, weightDebt,
    wacc: weightEquity * costOfEquity + weightDebt * afterTaxCostOfDebt,
  };
}

export default { buildModel, buildDCF, computeWACC, checkValuationApplicability, balanceSheetIntegrity };
