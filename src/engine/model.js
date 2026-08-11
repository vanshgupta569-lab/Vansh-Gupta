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

  // Margins: history is derived, forecast comes from the assumptions.
  S.grossMargin = blank();
  S.rndMargin = blank();
  S.sgaMargin = blank();
  S.taxRate = blank();
  S.cogs = blank();
  S.grossProfit = blank();
  S.rnd = blank();
  S.sga = blank();

  for (let t = 0; t < nH; t++) {
    S.cogs[t] = h.incomeStatement.cogs[t];
    S.rnd[t] = h.incomeStatement.researchDevelopment[t];
    S.sga[t] = h.incomeStatement.sellingGeneralAdmin[t];
    S.grossProfit[t] = S.revenue[t] + S.cogs[t];
    S.grossMargin[t] = S.grossProfit[t] / S.revenue[t];
    S.rndMargin[t] = -S.rnd[t] / S.revenue[t];
    S.sgaMargin[t] = -S.sga[t] / S.revenue[t];
  }

  const sgaFcst = a.sellingGeneralAdminMargin === 'avgOfHistory'
    ? avg(S.sgaMargin.slice(0, nH))
    : a.sellingGeneralAdminMargin;

  for (let t = nH; t < nH + nF; t++) {
    S.grossMargin[t] = a.grossMargin[t - nH];
    S.rndMargin[t] = a.researchDevelopmentMargin[t - nH];
    S.sgaMargin[t] = Array.isArray(sgaFcst) ? sgaFcst[t - nH] : sgaFcst;
    S.grossProfit[t] = S.revenue[t] * S.grossMargin[t];
    S.cogs[t] = -(S.revenue[t] - S.grossProfit[t]);   // COGS is the balancing line
    S.rnd[t] = -(S.revenue[t] * S.rndMargin[t]);
    S.sga[t] = -(S.revenue[t] * S.sgaMargin[t]);
  }

  S.cogsGrowth = blank();
  for (let t = 1; t < nH + nF; t++) {
    S.cogsGrowth[t] = (S.cogs[t] - S.cogs[t - 1]) / S.cogs[t - 1];
  }

  S.ebit = blank();
  for (let t = 0; t < nH + nF; t++) {
    S.ebit[t] = S.grossProfit[t] + S.rnd[t] + S.sga[t];
  }

  // Interest and tax need the debt / cash schedules, so they are filled in
  // later. Placeholders are set up here to keep the line order readable.
  S.interestIncome = blank();
  S.interestExpense = blank();
  S.otherIncomeExpense = blank();
  S.pretaxProfit = blank();
  S.taxes = blank();
  S.netIncome = blank();

  for (let t = 0; t < nH; t++) {
    S.otherIncomeExpense[t] = h.incomeStatement.otherIncomeExpense[t];
    S.taxes[t] = h.incomeStatement.taxes[t];
    S.pretaxProfit[t] = S.ebit[t] + S.otherIncomeExpense[t];
    S.netIncome[t] = S.pretaxProfit[t] + S.taxes[t];
    S.taxRate[t] = -S.taxes[t] / S.pretaxProfit[t];
  }

  const taxFcst = a.taxRate === 'avgOfFirstAndLast'
    ? avg([S.taxRate[0], S.taxRate[nH - 1]])
    : a.taxRate === 'avgOfHistory' ? avg(S.taxRate.slice(0, nH)) : a.taxRate;

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
    if (inv != null) S.inventoryTurnover[t] = -S.cogs[t] / inv;
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
  S.ppe = { beginning: blank(), capex: blank(), depreciation: blank(), ending: blank() };
  S.depreciationPercentOfCapex = blank();

  for (let t = 0; t < nH; t++) {
    S.ppe.ending[t] = h.balanceSheet.propertyPlantEquipment[t];
    S.ppe.capex[t] = h.cashFlow.capex[t];
  }
  // First historical year that has a full schedule
  const firstPpeYear = h.balanceSheet.propertyPlantEquipment.findIndex((v) => v != null);
  S.ppe.beginning[firstPpeYear] = h.ppeOpeningBalance;
  for (let t = firstPpeYear + 1; t < nH; t++) S.ppe.beginning[t] = S.ppe.ending[t - 1];
  for (let t = firstPpeYear; t < nH; t++) {
    S.ppe.depreciation[t] = -(S.ppe.beginning[t] + S.ppe.capex[t] - S.ppe.ending[t]);
    S.depreciationPercentOfCapex[t] = -S.ppe.depreciation[t] / S.ppe.capex[t];
  }

  const depPct = a.depreciationAsPercentOfCapex === 'avgOfHistory'
    ? avg(S.depreciationPercentOfCapex.slice(firstPpeYear, nH))
    : a.depreciationAsPercentOfCapex;

  for (let t = nH; t < nH + nF; t++) {
    S.ppe.beginning[t] = S.ppe.ending[t - 1];
    S.ppe.capex[t] = a.capexMethod === 'percentOfRnD'
      ? -S.rnd[t] * a.capexRatio                    // capex = R&D spend × ratio
      : a.capexMethod === 'percentOfRevenue'
        ? -(S.revenue[t] * a.capexRatio)             // capex = revenue × ratio
        : S.ppe.capex[t - 1] * (1 + a.capexRatio);  // capex grows at the ratio
    S.depreciationPercentOfCapex[t] = depPct;
    S.ppe.depreciation[t] = -(S.ppe.capex[t] * depPct);
    S.ppe.ending[t] = S.ppe.beginning[t] + S.ppe.capex[t] + S.ppe.depreciation[t];
  }

  // D&A and SBC feed both the income statement (via EBITDA) and the cash flow
  S.depreciationAmortisation = blank();
  S.stockBasedCompensation = blank();
  for (let t = 0; t < nH; t++) {
    S.depreciationAmortisation[t] = h.cashFlow.depreciationAmortisation[t];
    S.stockBasedCompensation[t] = h.cashFlow.stockBasedCompensation[t];
  }
  for (let t = nH; t < nH + nF; t++) {
    S.depreciationAmortisation[t] = -S.ppe.depreciation[t];
  }

  S.sbcPercentOfOpex = blank();
  for (let t = 0; t < nH; t++) {
    const opex = S.cogs[t] + S.rnd[t] + S.sga[t];
    S.sbcPercentOfOpex[t] = -S.stockBasedCompensation[t] / opex;
  }
  const sbcPct = a.sbcAsPercentOfOperatingExpenses === 'lastHistoricalYear'
    ? S.sbcPercentOfOpex[nH - 1]
    : a.sbcAsPercentOfOperatingExpenses === 'avgOfHistory'
      ? avg(S.sbcPercentOfOpex.slice(0, nH))
      : a.sbcAsPercentOfOperatingExpenses;

  for (let t = nH; t < nH + nF; t++) {
    S.sbcPercentOfOpex[t] = sbcPct;
    S.stockBasedCompensation[t] = -sbcPct * (S.cogs[t] + S.rnd[t] + S.sga[t]);
  }

  // ------------------------------------------------------- 5. DEBT SCHEDULE
  S.debt = {
    beginning: blank(), borrowing: blank(), pikAccrual: blank(), ending: blank(),
    interestExpense: blank(), weightedAverageRate: blank(),
  };
  for (let t = 0; t < nH; t++) S.debt.ending[t] = h.balanceSheet.longTermDebt[t];
  S.debt.interestExpense[nH - 1] = a.interestExpenseFY2025;
  S.debt.pikAccrual[nH - 1] = a.pikAccrualFY2025;
  const pikPct = a.pikAccrualFY2025 / a.interestExpenseFY2025;
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
    S.ebitda[t] = S.ebit[t] + S.depreciationAmortisation[t] + S.stockBasedCompensation[t];
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
    S.dividends[t] = h.cashFlow.dividends[t];
    S.dividendPayoutRatio[t] = -S.dividends[t] / S.netIncome[t];
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
    S.buybackCeiling[t] = a.authorisedBuybackCeiling.historical[t];
    S.shareRepurchases[t] = h.cashFlow.shareRepurchases[t];
    S.repurchasePercent[t] = -S.shareRepurchases[t] / S.buybackCeiling[t];
  }
  const repurchasePct = a.repurchasePercentOfCeiling === 'avgOfHistory'
    ? avg(S.repurchasePercent.slice(0, nH))
    : a.repurchasePercentOfCeiling;

  for (let t = nH; t < nH + nF; t++) {
    const rule = a.authorisedBuybackCeiling.forecast[t - nH];
    // 'avgOfPriorFour' = the average of the three historical ceilings plus the
    // first forecast ceiling, held constant thereafter (a fixed window, not a
    // rolling one — the Excel uses an absolute range here).
    S.buybackCeiling[t] = rule === 'avgOfPriorFour'
      ? avg(S.buybackCeiling.slice(0, nH + 1))
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

export function checkValuationApplicability(model, data, wacc) {
  const { nH, nF } = model;
  const meta = data.meta;
  const sic = meta.sicCode;

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
  const terminalDep = M.depreciationAmortisation[last];
  const terminalCapex =
    d.terminalCapexTreatment === 'excludeCapex' ? 0
      : d.terminalCapexTreatment === 'capexEqualsDepreciation' ? -terminalDep
        : -M.ppe.capex[last];

  // Lines listed in `terminalExclusions` are stripped out of the terminal year
  // only. Deferred tax movements, for example, are a timing item with no reason
  // to persist in perpetuity — they stay in the explicit forecast years and come
  // out of the normalised figure.
  R.normalisedFCF =
    R.unleveredCFO[nF - 1] - R.terminalExcludedAmount[nF - 1] + terminalCapex;
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
  R.netDebt = d.netDebt.cashAndSecurities + d.netDebt.longTermDebt;
  R.dilutedShares = d.dilutedSharesCount;
  R.marketPrice = d.sharePrice;

  R.perpetuity = equityBridge(R.enterpriseValuePerpetuity, R.netDebt, R.dilutedShares, d.sharePrice);
  R.exitMultipleValuation = equityBridge(R.enterpriseValueMultiple, R.netDebt, R.dilutedShares, d.sharePrice);

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

function equityBridge(enterpriseValue, netDebt, shares, marketPrice) {
  const equityValue = enterpriseValue - netDebt;
  const perShare = equityValue / shares;
  return {
    enterpriseValue,
    lessNetDebt: -netDebt,
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
  return (ev - R.netDebt) / R.dilutedShares;
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

  // Beta — either the stated equity beta or the delevered industry average
  const comps = c.comparables.map((k) => {
    const marketCap = k.sharePrice * k.dilutedShares;
    const delevered = (k.equityBeta * marketCap) / (((k.debt - k.cash) * (1 - k.taxRate)) + marketCap);
    return { ...k, marketCap, delevered };
  });
  const industryDelevered = avg(comps.map((k) => k.delevered));

  const netDebt = data.dcf.netDebt.cashAndSecurities + data.dcf.netDebt.longTermDebt;
  const marketCap = data.dcf.sharePrice * data.dcf.dilutedSharesCount;
  const relevered = (industryDelevered * (netDebt * (1 - taxRate) + marketCap)) / marketCap;

  const beta = c.betaSource === 'industryUnlevered' ? relevered : c.equityBeta;
  const costOfEquity = c.riskFreeRate + c.marketRiskPremium * beta;

  const totalCapital = marketCap + netDebt;
  const weightEquity = marketCap / totalCapital;
  const weightDebt = netDebt / totalCapital;

  return {
    costOfDebt, taxRate, afterTaxCostOfDebt,
    riskFreeRate: c.riskFreeRate, marketRiskPremium: c.marketRiskPremium,
    beta, costOfEquity, comps, industryDelevered, releveredBeta: relevered,
    marketCap, netDebt, weightEquity, weightDebt,
    wacc: weightEquity * costOfEquity + weightDebt * afterTaxCostOfDebt,
  };
}

export default { buildModel, buildDCF, computeWACC, checkValuationApplicability };
