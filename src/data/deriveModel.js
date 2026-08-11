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

export function deriveModel(fetched) {
  const rows = fetched.statements || [];
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
      sellingGeneralAdmin: pickNeg('sga'),
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
      commonStockAPIC: pick('equity'),
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

  // Revenue growth: trailing CAGR, capped either side. A company growing 60%
  // for three years will not do so for five more, and a shrinking company
  // shouldn't be extrapolated into oblivion.
  const rawGrowth = cagr(revenue);
  const growth = clamp(rawGrowth, -0.10, 0.25, 0.03);
  provenance.revenueGrowth = `${(growth * 100).toFixed(1)}% — trailing ${
    revenue.filter(isNum).length
  }-year compound growth${
    isNum(rawGrowth) && rawGrowth !== growth ? ', capped' : ''
  }`;

  const grossMargins = revenue.map((rev, i) =>
    isNum(rev) && isNum(cogs[i]) && rev !== 0 ? (rev - cogs[i]) / rev : null
  );
  const grossMargin = clamp(mean(grossMargins), 0.01, 0.95, 0.35);
  provenance.grossMargin = `${(grossMargin * 100).toFixed(
    1
  )}% — average of the reported years, held flat`;

  const rndMargins = revenue.map((rev, i) => {
    const rnd = rows[i]?.rnd;
    return isNum(rev) && isNum(rnd) && rev !== 0 ? rnd / rev : null;
  });
  const rndMargin = clamp(mean(rndMargins), 0, 0.5, 0);

  const capexRatios = revenue.map((rev, i) => {
    const capex = rows[i]?.capex;
    return isNum(rev) && isNum(capex) && rev !== 0 ? capex / rev : null;
  });
  const capexRatio = clamp(mean(capexRatios), 0.001, 0.4, 0.04);
  provenance.capex = `${(capexRatio * 100).toFixed(
    1
  )}% of revenue — average of the reported years`;

  // Interest cost implied by the debt on the books. No free source gives the
  // actual coupon, so a conservative flat rate is applied to closing debt.
  const lastDebt = rows[rows.length - 1]?.longTermDebt;
  const interestExpense = isNum(lastDebt) ? Math.round(lastDebt * 0.045) : 0;
  provenance.interest = `estimated at 4.5% of closing debt`;

  const assumptions = {
    grossMargin: Array(FORECAST_YEARS).fill(grossMargin),
    researchDevelopmentMargin: Array(FORECAST_YEARS).fill(rndMargin),
    sellingGeneralAdminMargin: 'avgOfHistory',
    taxRate: 'avgOfFirstAndLast',

    segmentGrowth: { 'Total revenue': Array(FORECAST_YEARS).fill(growth) },

    otherIncomeExpense: Array(FORECAST_YEARS).fill(0),

    capexRatio,
    capexMethod: 'percentOfRevenue',
    depreciationAsPercentOfCapex: 'avgOfHistory',

    workingCapitalDrivers: {
      accountsReceivable: 'revenue',
      inventory: 'cogs',
      accountsPayable: 'revenue',
      accruedExpenses: 'revenue',
      otherCurrentAssets: 'cogs',
      deferredTaxAssets: 'revenue',
    },
    otherAssetsHeldFlat: true,
    otherNonCurrentLiabilitiesHeldFlat: true,

    interestExpenseOnLongTermDebt: Array(FORECAST_YEARS).fill(interestExpense),
    interestExpenseFY2025: interestExpense,
    pikAccrualFY2025: 0,
    // No free source publishes a maturity ladder, so debt is held flat rather
    // than invented. The user can change this.
    debtRepaymentSchedule: Array(FORECAST_YEARS).fill(0),

    newShareIssuance: Array(FORECAST_YEARS).fill(0),
    sbcAsPercentOfOperatingExpenses: 'lastHistoricalYear',

    dividendPayoutRatio: 'linearRegression',
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