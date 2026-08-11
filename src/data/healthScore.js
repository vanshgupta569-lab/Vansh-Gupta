// Marginalia — financial health score
//
// Five ratios, each scored against stated thresholds, averaged into one number.
// Nothing here is proprietary or clever on purpose: every input comes from the
// reported statements, every threshold is written down, and the reasoning can
// be read off the page. A score you cannot explain is worse than no score.
//
// Each component returns 0–100, plus the underlying ratio and a plain-English
// reading, so the dashboard can show WHY a company scored what it did.
//
// Deliberately excluded: anything based on share price or market sentiment.
// This measures the business as reported, not the market's opinion of it.

// Interpolate a ratio onto a 0–100 score between a weak and a strong anchor.
// Below `weak` scores 0, above `strong` scores 100, linear in between.
function scale(value, weak, strong) {
  if (value == null || !isFinite(value)) return null;
  if (strong > weak) {
    if (value <= weak) return 0;
    if (value >= strong) return 100;
    return ((value - weak) / (strong - weak)) * 100;
  }
  // Inverted: lower is better (leverage, for example)
  if (value >= weak) return 0;
  if (value <= strong) return 100;
  return ((weak - value) / (weak - strong)) * 100;
}

const isNum = (v) => typeof v === 'number' && isFinite(v);
const round = (v, dp = 0) => (v == null ? null : Math.round(v * 10 ** dp) / 10 ** dp);

export function computeHealthScore(rows) {
  // Use the most recent reported year, with the prior year for trend context.
  const y = rows[rows.length - 1] || {};
  const prior = rows.length > 1 ? rows[rows.length - 2] : null;

  const components = {};

  // ---- 1. LIQUIDITY — can it cover the next twelve months? -----------------
  // Current ratio. Below 1.0 means short-term obligations exceed short-term
  // assets. 2.0 is comfortable for most industries.
  const currentRatio =
    isNum(y.currentAssets) && isNum(y.currentLiabilities) && y.currentLiabilities !== 0
      ? y.currentAssets / y.currentLiabilities
      : null;

  components.liquidity = {
    label: 'Liquidity',
    score: scale(currentRatio, 0.8, 2.0),
    ratio: round(currentRatio, 2),
    unit: 'x current ratio',
    basis: 'Current assets ÷ current liabilities. Below 1.0x is a warning; 2.0x is comfortable.',
  };

  // ---- 2. LEVERAGE — how much debt against earnings? -----------------------
  // Net debt / EBITDA. Net cash scores full marks. Above 4x is heavily geared.
  const ebitda =
    isNum(y.operatingIncome) && isNum(y.depreciation)
      ? y.operatingIncome + y.depreciation
      : y.operatingIncome;

  const netDebt =
    isNum(y.longTermDebt) && isNum(y.cash) ? y.longTermDebt - y.cash : null;

  const netDebtEbitda =
    isNum(netDebt) && isNum(ebitda) && ebitda > 0 ? netDebt / ebitda : null;

  components.leverage = {
    label: 'Leverage',
    // Inverted: less debt is better. Net cash (negative) caps at 100.
    score: netDebtEbitda == null ? null : scale(netDebtEbitda, 4.0, 0.0),
    ratio: round(netDebtEbitda, 2),
    unit: 'x net debt / EBITDA',
    basis: 'Net debt ÷ EBITDA. Net cash scores full marks; above 4.0x is heavily geared.',
  };

  // ---- 3. PROFITABILITY — does the core business earn money? ---------------
  // Operating margin. Sector-dependent, so the band is wide: 5% weak, 25% strong.
  const opMargin =
    isNum(y.operatingIncome) && isNum(y.revenue) && y.revenue !== 0
      ? y.operatingIncome / y.revenue
      : null;

  components.profitability = {
    label: 'Profitability',
    score: scale(opMargin, 0.02, 0.25),
    ratio: round(opMargin == null ? null : opMargin * 100, 1),
    unit: '% operating margin',
    basis: 'Operating profit ÷ revenue. Varies widely by sector; 2% is thin, 25% is strong.',
  };

  // ---- 4. CASH CONVERSION — are the profits real? --------------------------
  // Operating cash flow ÷ net income. This is the accrual-quality check: profit
  // that never becomes cash is the classic warning sign in accounting fraud.
  const cashConversion =
    isNum(y.operatingCashFlow) && isNum(y.netIncome) && y.netIncome > 0
      ? y.operatingCashFlow / y.netIncome
      : null;

  components.cashConversion = {
    label: 'Cash conversion',
    score: scale(cashConversion, 0.6, 1.2),
    ratio: round(cashConversion, 2),
    unit: 'x cash flow / profit',
    basis: 'Operating cash flow ÷ net income. Below 1.0x means reported profit is not turning into cash.',
  };

  // ---- 5. RETURNS — how well is the asset base used? -----------------------
  // Return on assets. 2% weak, 15% strong.
  const roa =
    isNum(y.netIncome) && isNum(y.totalAssets) && y.totalAssets !== 0
      ? y.netIncome / y.totalAssets
      : null;

  components.returns = {
    label: 'Return on assets',
    score: scale(roa, 0.01, 0.15),
    ratio: round(roa == null ? null : roa * 100, 1),
    unit: '% return on assets',
    basis: 'Net income ÷ total assets. Measures how hard the asset base works.',
  };

  // ---- Overall -------------------------------------------------------------
  // Average of whichever components could be computed. A company missing half
  // its data gets a score based on what exists, and the count is reported so
  // the dashboard can say how complete the picture is.
  const scored = Object.values(components).filter((c) => c.score != null);
  const overall =
    scored.length === 0
      ? null
      : Math.round(scored.reduce((sum, c) => sum + c.score, 0) / scored.length);

  // Revenue trend, shown alongside rather than scored — growth is not health,
  // and plenty of healthy businesses are flat.
  const revenueTrend =
    prior && isNum(y.revenue) && isNum(prior.revenue) && prior.revenue !== 0
      ? round(((y.revenue / prior.revenue) - 1) * 100, 1)
      : null;

  return {
    overall,
    componentsScored: scored.length,
    componentsTotal: Object.keys(components).length,
    components,
    revenueTrend,
    asOfYear: y.fiscalYear ?? null,
  };
}

// Map onto the five radar axes the dashboard already draws.
export function toRadarMetrics(health) {
  const g = (key) => Math.round(health.components[key]?.score ?? 0);
  return {
    balanceSheetStrength: g('liquidity'),
    earningsQuality: g('cashConversion'),
    cashFlowCoverage: g('leverage'),
    accrualRisk: g('profitability'),
    valuationMoat: g('returns'),
    overallScore: health.overall ?? 0,
  };
}

export default computeHealthScore;