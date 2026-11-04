// FILE: src/data/plainRatios.js
//
// FIVE RATIOS, AS RATIOS. NO SCORE, NO SHAPE, NO LETTER.
//
// This replaces `healthScore.js`, removed on 4 November 2026
// (`docs/STUDIO_SPEC.md` S2, approved by Nihar; `ROADMAP.md` section 12).
//
// ---------------------------------------------------------------------------
// WHY THE SCORE WENT
// ---------------------------------------------------------------------------
//
// It took these same five ratios, scored each 0–100 against thresholds of our
// own, averaged them and printed the result as `{n}/100` beside a radar
// polygon. Three things were wrong with that and all three were severity H:
//
//   **A score is a verdict, not a fact** (standing decision 6: explain
//   mechanics, not merit). Its own text characterised numbers — "below 1.0x is
//   a warning", "above 4.0x is heavily geared", "2% is thin, 25% is strong",
//   "the classic warning sign in accounting fraud" — and the thresholds behind
//   the arithmetic were ours and unsourced (standing decision 2).
//
//   **The radar's axes were mislabelled.** `toRadarMetrics` mapped leverage
//   onto `cashFlowCoverage`, profitability onto `accrualRisk` and return on
//   assets onto `valuationMoat`, so the figure under each label was not that
//   label's figure. The fallback grid printed "Moat Rating: {return-on-assets
//   score}%" and "Cash Flow: {leverage score}%".
//
//   **Missing data scored as zero.** `score ?? 0` and `overall ?? 0` drew a
//   ratio the filing cannot support as the WORST possible score (standing
//   decision 3).
//
// `docs/FEATURES.md` had already answered Simply Wall St's snowflake with
// factual checks rather than a scored shape, and `docs/VISION.md` never
// mentioned a score at all.
//
// ---------------------------------------------------------------------------
// WHAT IS LEFT
// ---------------------------------------------------------------------------
//
// The five ratios, each with the figures it was struck from and its formula in
// words. **The formula, and not the reading**: the old `basis` ran the formula
// and a judgement together in one string — "Current assets ÷ current
// liabilities. Below 1.0x is a warning; 2.0x is comfortable." — and only the
// first sentence of that is a fact. What a reader should make of a current
// ratio belongs in the Margin notes, which is where the definitions went.
//
// A ratio the filing cannot support is **null with a reason**, never nought.
// Nothing here uses the share price: this is the business as reported, not the
// market's opinion of it.

const isNum = (v) => typeof v === 'number' && isFinite(v);
const round = (v, dp = 0) => (v == null ? null : Math.round(v * 10 ** dp) / 10 ** dp);

/**
 * The five ratios for one company, off its own reported statements.
 *
 * Returns `{ ratios: [...], asOfYear, revenueTrend }`. Each ratio carries its
 * label, its value, the unit it is in, the formula it was struck by, and —
 * where it could not be struck — the reason.
 */
export function computePlainRatios(rows) {
  const y = (rows || [])[(rows || []).length - 1] || {};
  const prior = (rows || []).length > 1 ? rows[rows.length - 2] : null;

  const missing = (...names) =>
    `The filing does not report ${names.join(' and ')} for FY${y.fiscalYear ?? 'the last year'}.`;

  const ratios = [];

  // ---- 1. LIQUIDITY --------------------------------------------------------
  const haveCurrent =
    isNum(y.currentAssets) && isNum(y.currentLiabilities) && y.currentLiabilities !== 0;
  ratios.push({
    key: 'liquidity',
    label: 'Current ratio',
    value: haveCurrent ? round(y.currentAssets / y.currentLiabilities, 2) : null,
    unit: 'x',
    formula: 'Current assets ÷ current liabilities',
    inputs: haveCurrent ? { currentAssets: y.currentAssets, currentLiabilities: y.currentLiabilities } : null,
    reason: haveCurrent ? null : missing('current assets', 'current liabilities'),
  });

  // ---- 2. LEVERAGE ---------------------------------------------------------
  const ebitda =
    isNum(y.operatingIncome) && isNum(y.depreciation)
      ? y.operatingIncome + y.depreciation
      : isNum(y.operatingIncome)
        ? y.operatingIncome
        : null;
  const netDebt = isNum(y.longTermDebt) && isNum(y.cash) ? y.longTermDebt - y.cash : null;
  const haveLeverage = isNum(netDebt) && isNum(ebitda) && ebitda > 0;
  ratios.push({
    key: 'leverage',
    label: 'Net debt / EBITDA',
    value: haveLeverage ? round(netDebt / ebitda, 2) : null,
    unit: 'x',
    formula: '(Long-term debt − cash) ÷ (operating profit + depreciation)',
    inputs: haveLeverage ? { netDebt, ebitda } : null,
    reason: haveLeverage
      ? null
      : isNum(ebitda) && ebitda <= 0
        ? `FY${y.fiscalYear ?? 'the last year'} made no operating profit before depreciation, so there is nothing to measure the debt against.`
        : missing('long-term debt', 'cash', 'operating profit'),
  });

  // ---- 3. PROFITABILITY ----------------------------------------------------
  const haveMargin = isNum(y.operatingIncome) && isNum(y.revenue) && y.revenue !== 0;
  ratios.push({
    key: 'profitability',
    label: 'Operating margin',
    value: haveMargin ? round((y.operatingIncome / y.revenue) * 100, 1) : null,
    unit: '%',
    formula: 'Operating profit ÷ revenue',
    inputs: haveMargin ? { operatingIncome: y.operatingIncome, revenue: y.revenue } : null,
    reason: haveMargin ? null : missing('operating profit', 'revenue'),
  });

  // ---- 4. CASH CONVERSION --------------------------------------------------
  const haveConversion = isNum(y.operatingCashFlow) && isNum(y.netIncome) && y.netIncome > 0;
  ratios.push({
    key: 'cashConversion',
    label: 'Cash flow / profit',
    value: haveConversion ? round(y.operatingCashFlow / y.netIncome, 2) : null,
    unit: 'x',
    formula: 'Cash from operations ÷ profit after tax',
    inputs: haveConversion
      ? { operatingCashFlow: y.operatingCashFlow, netIncome: y.netIncome }
      : null,
    reason: haveConversion
      ? null
      : isNum(y.netIncome) && y.netIncome <= 0
        ? `FY${y.fiscalYear ?? 'the last year'} made no profit after tax, so cash against profit is not a ratio.`
        : missing('cash from operations', 'profit after tax'),
  });

  // ---- 5. RETURN ON ASSETS -------------------------------------------------
  const haveRoa = isNum(y.netIncome) && isNum(y.totalAssets) && y.totalAssets !== 0;
  ratios.push({
    key: 'returns',
    label: 'Return on assets',
    value: haveRoa ? round((y.netIncome / y.totalAssets) * 100, 1) : null,
    unit: '%',
    formula: 'Profit after tax ÷ total assets',
    inputs: haveRoa ? { netIncome: y.netIncome, totalAssets: y.totalAssets } : null,
    reason: haveRoa ? null : missing('profit after tax', 'total assets'),
  });

  // Shown alongside and never scored: growth is not health, and plenty of
  // sound businesses are flat.
  const revenueTrend =
    prior && isNum(y.revenue) && isNum(prior.revenue) && prior.revenue !== 0
      ? round((y.revenue / prior.revenue - 1) * 100, 1)
      : null;

  return { ratios, revenueTrend, asOfYear: y.fiscalYear ?? null };
}

export default { computePlainRatios };
