// FILE: src/data/deriveModel.js
// Marginalia — assumption derivation
//
// Turns raw fetched statements (from /api/company) into the exact data shape
// the engine expects — the same shape as AAPL.js.
//
// The honest framing: AAPL.js came from Vansh's Excel, where roughly forty
// judgement calls were made by hand. Nothing can fetch those. What this file
// does instead is derive a defensible STARTING POINT from the company's own
// reported history — trailing growth, average margins, capex as a share of
// revenue — and then let the user move every one of them with the sliders.
//
// Every derived figure is recorded in `provenance` so the dashboard can show
// where each assumption came from rather than presenting it as fact.

const FORECAST_YEARS = 5;

// ---------------------------------------------------------------- helpers

const isNum = (v) => typeof v === 'number' && isFinite(v);

function mean(values) {
  const clean = values.filter(isNum);
  if (clean.length === 0) return null;
  return clean.reduce((a, b) => a + b, 0) / clean.length;
}

// Keep derived assumptions inside sane bounds. A company with one freak year
// can otherwise produce a growth rate that makes the DCF meaningless.
function clamp(value, low, high, fallback) {
  if (!isNum(value)) return fallback;
  return Math.min(high, Math.max(low, value));
}

// Compound annual growth rate across the historical revenue line.
function cagr(series) {
  const clean = series.filter(isNum);
  if (clean.length < 2) return null;
  const first = clean[0];
  const last = clean[clean.length - 1];
  if (first <= 0 || last <= 0) return null;
  return Math.pow(last / first, 1 / (clean.length - 1)) - 1;
}

// A balance line the filing does not give us directly, worked out from the
// totals that it does give. Returns null rather than a guess when the inputs
// are missing, so a hole stays visible instead of turning into a wrong number.
function plug(total, ...parts) {
  if (!isNum(total)) return null;
  let remainder = total;
  for (const part of parts) {
    if (!isNum(part)) return null;
    remainder -= part;
  }
  return remainder;
}

// ---------------------------------------------------------------- main

// ---------------------------------------------------------------------------
// IS THIS HISTORY ACTUALLY ONE COMPANY?
// ---------------------------------------------------------------------------
// A forecast built on a company's own history assumes the history describes the
// same company throughout. After a demerger or a spin-off it does not, and the
// data source gives no warning: it simply lists the periods side by side.
//
// Tata Motors is the case that exposed this. Its three reported periods were:
//
//   FY2024  revenue 4,312,120  — the old consolidated group, including JLR
//   FY2025  revenue   577,880  — depreciation was 187% of net PP&E
//   FY2026  revenue   833,900  — the demerged commercial vehicle business
//
// Read as one company that is trailing growth of -56%, capped to a permanent
// -10% decline, and average capex of 25.3% of revenue against an operating
// margin of 8.9%. Unlevered free cash flow came out negative in every forecast
// year and the model printed a value of -2.56 a share. The engine's own guards
// did not catch it: operating profit stayed positive, and normalised terminal
// cash flow was positive because the terminal year sets capex equal to
// depreciation, which strips the very distortion causing the problem.
//
// Two tests, both about whether a period can be compared with the ones around
// it. Neither guesses at causes; both refuse rather than repair.
function selectComparablePeriods(statements) {
  const rows = Array.isArray(statements) ? statements.slice() : [];
  const excluded = [];
  if (rows.length < 2) return { rows, excluded };

  // TEST 1 — a collapse in revenue means the reporting entity changed.
  //
  // Only a COLLAPSE counts. A surge is what fast growth looks like: Nvidia's
  // revenue more than doubled in a single year and that history is perfectly
  // usable. A fall of more than 60%, by contrast, is not something an operating
  // business does while remaining the same reporting entity. Everything before
  // the most recent such break is a different company and is dropped.
  let breakAt = -1;
  for (let i = 1; i < rows.length; i++) {
    const before = rows[i - 1]?.revenue;
    const after = rows[i]?.revenue;
    if (
      typeof before === 'number' &&
      typeof after === 'number' &&
      before > 0 &&
      after / before < 0.4
    ) {
      breakAt = i;
    }
  }
  let kept = rows;
  if (breakAt > 0) {
    for (const row of rows.slice(0, breakAt)) {
      excluded.push({
        fiscalYear: row.fiscalYear,
        reason: 'revenue falls by more than 60% after this period, which is a change of reporting entity rather than a trading result',
      });
    }
    kept = rows.slice(breakAt);
  }

  // TEST 2 — depreciation cannot exceed the assets being depreciated.
  //
  // A full year of depreciation larger than the closing net PP&E is not a
  // going concern writing down its assets, it is a period that does not line up
  // with the balance sheet beside it: a stub period, a restated set, or two
  // different entities stitched together. Tata Motors FY2025 charged 232,560
  // against net PP&E of 124,380.
  kept = kept.filter((row) => {
    if (
      typeof row.depreciation === 'number' &&
      typeof row.ppeNet === 'number' &&
      row.ppeNet > 0 &&
      row.depreciation > row.ppeNet
    ) {
      excluded.push({
        fiscalYear: row.fiscalYear,
        reason: 'depreciation for the period exceeds closing net property, plant and equipment, so the period does not line up with its own balance sheet',
      });
      return false;
    }
    return true;
  });

  return { rows: kept, excluded };
}

export function deriveModel(fetched) {
  const { rows, excluded } = selectComparablePeriods(fetched.statements || []);

  // Refuse rather than model a history that is not one company. Two comparable
  // periods is the minimum for any growth rate at all.
  if (rows.length < 2) {
    const dropped = excluded
      .map((e) => `FY${e.fiscalYear} (${e.reason})`)
      .join('; ');
    throw new Error(
      `${fetched.ticker || 'This company'} does not have two comparable years of reported history, ` +
        `so no forecast can be built from it. Periods set aside: ${dropped}. ` +
        `This usually follows a demerger, spin-off or restatement, where the ` +
        `figures published side by side describe different businesses. The ` +
        `reported figures themselves are unaffected and can still be read below.`
    );
  }
  if (rows.length === 0) throw new Error('No statements to model from');

  const years = rows.map((r) => r.fiscalYear);
  const lastYear = years[years.length - 1];
  const forecastYears = Array.from(
    { length: FORECAST_YEARS },
    (_, i) => lastYear + i + 1
  );

  const pick = (field) => rows.map((r) => (isNum(r[field]) ? r[field] : null));
  // The Excel stores costs, dividends and buybacks as negative numbers; the
  // fetcher returns them positive. Flip on the way in.
  const pickNeg = (field) =>
    rows.map((r) => (isNum(r[field]) ? -r[field] : null));

  const revenue = pick('revenue');
  const cogs = pick('cogs');
  const provenance = {};
  if (excluded.length) {
    provenance.excludedPeriods =
      'set aside as not comparable: ' +
      excluded.map((e) => `FY${e.fiscalYear} — ${e.reason}`).join('; ');
  }

  // ---- Tying operating profit to what the company actually reported -------
  //
  // The engine builds operating profit from the cost lines: revenue less COGS,
  // R&D and SG&A. That works when those lines account for every operating cost,
  // which is true of SEC filings — Apple's revenue less COGS, R&D and SG&A comes
  // to its reported operating income to the last dollar.
  //
  // It is NOT true of every source. Yahoo's SG&A for Reliance is a narrow
  // selling-and-admin figure that leaves out depreciation and a large block of
  // other operating expenses. Built from those lines alone the model gave
  // Reliance an operating profit of 2,320,970 against the 1,213,770 it actually
  // reported: a 91% overstatement, carried straight into the valuation, which
  // is where the model's claim that the shares were worth more than twice their
  // market price came from.
  //
  // So where the filing reports operating income, the gap between it and the
  // cost lines is treated as an operating cost and added to SG&A. The forecast
  // is then anchored to a margin the company has actually earned. Where the gap
  // is nil, as with every SEC filer, nothing changes.
  const unexplainedOperatingCosts = rows.map((row) => {
    if (!isNum(row.operatingIncome) || !isNum(row.revenue) || !isNum(row.cogs)) return 0;
    const fromCostLines =
      row.revenue - row.cogs - (isNum(row.rnd) ? row.rnd : 0) - (isNum(row.sga) ? row.sga : 0);
    const gap = fromCostLines - row.operatingIncome;
    // A tiny gap is rounding in the source, not a missing cost line.
    return Math.abs(gap) > Math.abs(row.revenue) * 0.001 ? gap : 0;
  });

  // SG&A as the model uses it: the reported figure plus whatever else the
  // company charged above the operating profit line.
  const sgaTotal = rows.map((row, i) =>
    isNum(row.sga) || unexplainedOperatingCosts[i] !== 0
      ? (isNum(row.sga) ? row.sga : 0) + unexplainedOperatingCosts[i]
      : null
  );
  const anyPlugged = unexplainedOperatingCosts.some((v) => v !== 0);
  if (anyPlugged) {
    provenance.operatingCostReconciliation =
      'the source does not break out every operating cost, so the difference ' +
      'between the reported operating profit and the cost lines is carried in SG&A';
  }

  // ------------------------------------------------------------ historicals

  // Balance sheet lines the filing doesn't break out, derived from totals.
  // Built this way, assets equal liabilities plus equity by construction —
  // which is what keeps the engine's balance check passing.
  const otherCurrentAssets = rows.map((r) =>
    plug(r.currentAssets, r.cash, r.receivables, r.inventory)
  );
  const otherAssets = rows.map((r) =>
    plug(r.totalAssets, r.currentAssets, r.ppeNet)
  );
  const accruedExpenses = rows.map((r) => plug(r.currentLiabilities, r.payables));
  const otherNonCurrentLiabilities = rows.map((r) =>
    plug(r.totalLiabilities, r.currentLiabilities, r.longTermDebt)
  );

  const historical = {
    incomeStatement: {
      revenue,
      cogs: pickNeg('cogs'),
      researchDevelopment: pickNeg('rnd').map((v, i) =>
        v === null && isNum(revenue[i]) ? 0 : v
      ),
      sellingGeneralAdmin: sgaTotal.map((v) => (isNum(v) ? -v : null)),
      otherIncomeExpense: rows.map(() => 0),
      taxes: pickNeg('taxExpense'),
      basicShares: pick('dilutedShares').map((v) => (isNum(v) ? v / 1e6 : null)),
      dilutedShares: pick('dilutedShares').map((v) => (isNum(v) ? v / 1e6 : null)),
    },

    // Segment detail lives in filing footnotes and is not machine-readable
    // from any free source. An auto-generated model therefore runs on a single
    // combined revenue line. This is the main quality gap against a curated
    // model like Apple's, and the dashboard must say so.
    segments: { 'Total revenue': revenue },

    balanceSheet: {
      cashAndSecurities: pick('cash'),
      accountsReceivable: pick('receivables'),
      inventory: pick('inventory'),
      deferredTaxAssets: rows.map(() => 0),
      otherCurrentAssets,
      propertyPlantEquipment: pick('ppeNet'),
      otherAssets,
      accountsPayable: pick('payables'),
      accruedExpenses,
      revolver: rows.map(() => 0),
      longTermDebt: pick('longTermDebt'),
      otherNonCurrentLiabilities,
      // The filing gives total equity but not its internal split. Putting the
      // whole balance in one line keeps the balance sheet correct; the split
      // between paid-in capital and retained earnings is presentational and
      // does not affect the valuation.
      //
      // Equity is taken as total assets less total liabilities rather than the
      // reported equity line, because the two are not always the same figure.
      // Yahoo reports Reliance's equity excluding minority interests, so the
      // reported line left the balance sheet out by 1.1 to 1.8 million lakh and
      // the balance check failed every year. For an SEC filer the two are
      // identical: Apple's 359,241 less 285,508 is exactly its reported 73,733.
      commonStockAPIC: rows.map((row) => plug(row.totalAssets, row.totalLiabilities)),
      treasuryStock: rows.map(() => 0),
      retainedEarnings: rows.map(() => 0),
      otherComprehensiveIncome: rows.map(() => 0),
    },

    cashFlow: {
      depreciationAmortisation: pick('depreciation'),
      stockBasedCompensation: pick('stockComp').map((v) => (isNum(v) ? v : 0)),
      capex: pick('capex'),
      dividends: pickNeg('dividendsPaid').map((v) => (v === null ? 0 : v)),
      shareRepurchases: pickNeg('buybacks').map((v) => (v === null ? 0 : v)),
    },

    ppeOpeningBalance: rows[0]?.ppeNet ?? null,
    basicSharesClosing: isNum(rows[rows.length - 1]?.dilutedShares)
      ? rows[rows.length - 1].dilutedShares / 1e6
      : null,
    averageSharePrice: fetched.quote?.price ?? null,
  };

  // ------------------------------------------------------------ assumptions
  //
  // Forecast conventions follow the approach set out in the Wall Street Prep
  // financial statement modeling cheat sheet. Where the cheat sheet allows more
  // than one method, the one actually used is named in `provenance` so a reader
  // can check the working rather than take it on trust.

  // The most recent reported value in a series. Used wherever the convention is
  // "last actual year" rather than an average.
  const latest = (series) => {
    for (let i = series.length - 1; i >= 0; i--) {
      if (isNum(series[i])) return series[i];
    }
    return null;
  };

  // REVENUE — cheat sheet approach 1: an aggregate growth rate. Approach 2
  // (segment level, price x volume) needs segment detail, which is not
  // machine-readable from any free source. Capped either side: a company
  // growing 60% for three years will not do so for five more, and a shrinking
  // one should not be extrapolated into oblivion.
  const rawGrowth = cagr(revenue);
  const growth = clamp(rawGrowth, -0.10, 0.25, 0.03);
  provenance.revenueGrowth = `${(growth * 100).toFixed(1)}% — trailing ${
    revenue.filter(isNum).length
  }-year compound growth${
    isNum(rawGrowth) && rawGrowth !== growth ? ', capped' : ''
  }`;

  // MARGINS — the cheat sheet says to make a % margin assumption but does not
  // say which years to read it from. This model uses the LAST REPORTED YEAR,
  // not an average of the reported years, for the same reason the cheat sheet
  // uses the last actual effective tax rate: an average taken across a company
  // that has changed shape describes no year that ever existed. Nvidia is the
  // clearest case — its five-year average operating margin sits far below
  // anything the current business earns.
  const grossMargins = revenue.map((rev, i) =>
    isNum(rev) && isNum(cogs[i]) && rev !== 0 ? (rev - cogs[i]) / rev : null
  );
  const grossMargin = clamp(latest(grossMargins), 0.01, 0.95, 0.35);
  provenance.grossMargin = `${(grossMargin * 100).toFixed(
    1
  )}% — the last reported year, held flat`;

  const rndMargins = revenue.map((rev, i) => {
    const rnd = rows[i]?.rnd;
    return isNum(rev) && isNum(rnd) && rev !== 0 ? rnd / rev : null;
  });
  const rndMargin = clamp(latest(rndMargins), 0, 0.5, 0);

  const sgaMargins = revenue.map((rev, i) => {
    const sga = sgaTotal[i];
    return isNum(rev) && isNum(sga) && rev !== 0 ? sga / rev : null;
  });
  const sgaMargin = clamp(latest(sgaMargins), 0, 0.6, 0.1);
  provenance.operatingCosts = `R&D ${(rndMargin * 100).toFixed(1)}% and SG&A ${(
    sgaMargin * 100
  ).toFixed(1)}% of revenue — the last reported year, held flat`;

  // TAXES — the cheat sheet is explicit: apply the last actual year's effective
  // rate. Previously this averaged the first and last years, which let a year
  // with a one-off charge sit in the forecast forever. Apple FY2024 is exactly
  // that case: a European State-aid charge pushed the effective rate to 24%.
  const effectiveTaxRates = rows.map((row) =>
    isNum(row.taxExpense) && isNum(row.pretaxIncome) && row.pretaxIncome !== 0
      ? row.taxExpense / row.pretaxIncome
      : null
  );
  const taxRate = clamp(latest(effectiveTaxRates), 0, 0.5, 0.21);
  provenance.taxRate = `${(taxRate * 100).toFixed(
    1
  )}% — the last reported year's effective rate`;

  // CAPEX — "in line with historical trends as a % of sales". Capex is lumpy
  // year to year in a way margins are not, so this one stays an average: a
  // single heavy building year should not become the permanent run rate.
  const capexRatios = revenue.map((rev, i) => {
    const capex = rows[i]?.capex;
    return isNum(rev) && isNum(capex) && rev !== 0 ? capex / rev : null;
  });
  const capexRatio = clamp(mean(capexRatios), 0.001, 0.4, 0.04);
  provenance.capex = `${(capexRatio * 100).toFixed(
    1
  )}% of revenue — average of the reported years`;

  // DIVIDENDS — the cheat sheet says to use the historical average payout ratio
  // (common dividends / net income). This replaces a linear regression through
  // the payout history, which could trend the ratio somewhere the company has
  // never been, including above 100% of earnings.
  const payoutRatios = rows.map((row) =>
    isNum(row.dividendsPaid) && isNum(row.netIncome) && row.netIncome > 0
      ? row.dividendsPaid / row.netIncome
      : null
  );
  const payoutRatio = clamp(mean(payoutRatios), 0, 1, 0);
  provenance.dividends = `${(payoutRatio * 100).toFixed(
    1
  )}% of net income — average payout ratio across the reported years`;

  // INTEREST — the cheat sheet computes interest as average debt x an interest
  // rate. No free source publishes the coupon on each tranche, so a flat rate
  // is applied to the average of the reported debt balances. Debt is then held
  // flat (straight-lined) rather than run down a maturity ladder we cannot see,
  // which the cheat sheet says is the safer treatment in any case.
  const debtBalances = rows.map((row) =>
    isNum(row.longTermDebt) ? row.longTermDebt : null
  );
  const averageDebt = mean(debtBalances) ?? 0;
  const interestExpense = Math.round(averageDebt * 0.045);
  provenance.interest = `average debt of ${Math.round(
    averageDebt
  ).toLocaleString()} at an assumed 4.5%`;

  const assumptions = {
    grossMargin: Array(FORECAST_YEARS).fill(grossMargin),
    researchDevelopmentMargin: Array(FORECAST_YEARS).fill(rndMargin),
    sellingGeneralAdminMargin: sgaMargin,
    taxRate,

    segmentGrowth: { 'Total revenue': Array(FORECAST_YEARS).fill(growth) },

    // Non-recurring items are forecast as 0, per the cheat sheet.
    otherIncomeExpense: Array(FORECAST_YEARS).fill(0),

    capexRatio,
    capexMethod: 'percentOfRevenue',
    // PP&E roll-forward: opening balance + capex - depreciation = closing,
    // with depreciation as a % of capex guided by history.
    depreciationAsPercentOfCapex: 'avgOfHistory',

    // Working capital, per the cheat sheet:
    //   receivables grow at the revenue growth rate  (constant DSO)
    //   inventory grows at the COGS growth rate      (constant turnover)
    //   payables grow at the COGS growth rate
    //   accrued expenses grow with revenue
    // Payables previously grew with revenue, which is the convention used in
    // the hand-built Apple workbook. The cheat sheet ties them to COGS, and
    // that is what the derived models now follow.
    workingCapitalDrivers: {
      accountsReceivable: 'revenue',
      inventory: 'cogs',
      accountsPayable: 'cogs',
      accruedExpenses: 'revenue',
      otherCurrentAssets: 'cogs',
      deferredTaxAssets: 'revenue',
    },
    otherAssetsHeldFlat: true,
    otherNonCurrentLiabilitiesHeldFlat: true,

    interestExpenseOnLongTermDebt: Array(FORECAST_YEARS).fill(interestExpense),
    interestExpenseFY2025: interestExpense,
    pikAccrualFY2025: 0,
    // Straight-lined: no free source publishes a maturity ladder, and the
    // cheat sheet notes that most companies refinance maturing debt anyway.
    debtRepaymentSchedule: Array(FORECAST_YEARS).fill(0),

    newShareIssuance: Array(FORECAST_YEARS).fill(0),
    // SBC as a share of operating expenses. The cheat sheet gives two formulas,
    // SBC/revenue and SBC/operating expense; the engine implements the second,
    // and both are sanctioned.
    sbcAsPercentOfOperatingExpenses: 'lastHistoricalYear',

    dividendPayoutRatio: payoutRatio,
    authorisedBuybackCeiling: {
      historical: rows.map((r) => (isNum(r.buybacks) ? r.buybacks : 0)),
      forecast: Array(FORECAST_YEARS).fill('avgOfPriorFour'),
    },
    repurchasePercentOfCeiling: 'avgOfHistory',

    minimumCashDesired: isNum(rows[rows.length - 1]?.cash)
      ? Math.round(rows[rows.length - 1].cash * 0.5)
      : 0,
    interestRateOnCash: Array(FORECAST_YEARS).fill(0),

    consensusEPS: Array(FORECAST_YEARS).fill(null),
    epsGrowth: Array(FORECAST_YEARS).fill(growth),
  };

  // ------------------------------------------------------------------- DCF

  const price = fetched.quote?.price ?? null;
  const shares = isNum(rows[rows.length - 1]?.dilutedShares)
    ? rows[rows.length - 1].dilutedShares / 1e6
    : null;

  // Without a share count there is no such thing as a value per share. Dividing
  // by nothing produced an intrinsic value of infinity and a market
  // capitalisation of zero for Reliance Infrastructure, which reported no
  // diluted share figure. Refuse instead: an absent denominator is a missing
  // input, not a company worth infinity.
  if (!isNum(shares) || shares <= 0) {
    throw new Error(
      `${fetched.ticker || 'This company'} does not report a diluted share count in the ` +
        `data available, so no value per share can be calculated. The reported ` +
        `figures below are unaffected.`
    );
  }

  const lastRow = rows[rows.length - 1] || {};

  const dcf = {
    sharePrice: price,
    sharePriceDate: (fetched.fetchedAt || new Date().toISOString()).slice(0, 10),
    basicSharesCount: shares,
    dilutedSharesCount: shares,

    netDebt: {
      cashAndSecurities: isNum(lastRow.cash) ? -lastRow.cash : 0,
      longTermDebt: isNum(lastRow.longTermDebt) ? lastRow.longTermDebt : 0,
    },

    longTermGrowthRate: 0.025,
    exitEbitdaMultiple: 12,

    terminalCapexTreatment: 'capexEqualsDepreciation',
    terminalExclusions: ['deferredTaxAssets', 'otherNonCurrentLiabilities'],

    costOfCapital: {
      riskFreeRate: 0.045,
      marketRiskPremium: 0.0423,
      equityBeta: 1.0,
      betaSource: 'equityBeta',
      comparables: [],
    },

    sensitivity: {
      waccSteps: [-0.01, -0.005, 0, 0.005, 0.01],
      growthSteps: [-0.01, -0.005, 0, 0.005, 0.01],
      multipleSteps: [-1.0, -0.5, 0, 0.5, 1.0],
    },
  };

  provenance.terminalGrowth = '2.5% — a flat default, not company-specific';
  provenance.wacc = 'CAPM with a beta of 1.0 — no comparable set is derived';
  provenance.segments =
    'single combined revenue line — segment detail is not machine-readable from free sources';

  return {
    meta: {
      name: fetched.name || fetched.ticker,
      ticker: fetched.ticker,
      currency: fetched.currency || 'USD',
      unitLabel: `${fetched.currencySymbol || '$'} millions`,
      historicalYears: years,
      forecastYears,
      latestFiscalYearEnd: `${lastYear}-12-31`,
      forecastYearEndDates: forecastYears.map((y) => `${y}-12-31`),
      daysInYear: 365,
      circuitBreaker: 'ON',
      sicCode: fetched.sicCode ? Number(fetched.sicCode) : null,
      sector: fetched.sector || fetched.sicDescription || null,
      // Marks this as derived rather than hand-built, so the dashboard can
      // label it honestly against a curated model like Apple's.
      derived: true,
      source: fetched.source,
      sourceUrl: fetched.sourceUrl,
    },
    historical,
    assumptions,
    dcf,
    provenance,
  };
}

export default deriveModel;