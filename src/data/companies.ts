// @ts-ignore — JS engine and data files have no TS declarations
import AAPL_DATA from './AAPL.js';
// @ts-ignore
import { buildModel, buildDCF } from '../engine/model.js';
// @ts-ignore
import { computeHealthScore, toRadarMetrics } from './healthScore.js';

import { CompanyData, CompanyFinancials, ValuationDrivers, DCFResult, ForecastRow } from '../types';

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------
const r = (n: number | null, dp = 0): number => {
  if (n == null) return 0;
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
};

// ---------------------------------------------------------------------------
// DEFAULT SLIDER POSITIONS FOR A GIVEN DATA FILE
// ---------------------------------------------------------------------------
// What the sliders read when nobody has touched them. These are taken from the
// model's FIRST forecast year, which is how the dashboard has always populated
// them. Recomputed here from the same source so that buildOverridden can tell
// an untouched slider from a moved one.
//
// This function is exported because the dashboard needs the same numbers to
// show the default in grey beside anything the user has changed.
export function defaultDriversFor(source: any): Partial<ValuationDrivers> {
  try {
    const M: any = buildModel(source);
    const D: any = buildDCF(M, source);
    const nH: number = M.nH;
    const revLast: number = M.revenue[nH - 1] ?? 1;
    const revNext: number = M.revenue[nH] ?? revLast;
    const ebitNext: number = M.ebit[nH] ?? 0;
    return {
      revenueGrowthPct: r((revNext / revLast - 1) * 100, 1),
      operatingMarginPct: r((ebitNext / revNext) * 100, 1),
      taxRatePct: r((M.taxRate[nH] ?? 0.21) * 100, 1),
      capexPctOfRev: r(Math.abs((M.ppe.capex[nH] ?? 0) / revNext) * 100, 1),
      waccPct: D.applicable ? r(D.wacc * 100, 1) : undefined,
      terminalGrowthPct: r((source.dcf?.longTermGrowthRate ?? 0.025) * 100, 1),

      // Deeper assumptions, adjustable from the full-screen model views.
      betaValue: r(
        D.waccDetail?.beta ?? source.dcf?.costOfCapital?.equityBeta ?? 1,
        2
      ),
      riskFreeRatePct: r((source.dcf?.costOfCapital?.riskFreeRate ?? 0.045) * 100, 2),
      marketRiskPremiumPct: r(
        (source.dcf?.costOfCapital?.marketRiskPremium ?? 0.05) * 100,
        2
      ),
      exitMultipleX: r(source.dcf?.exitEbitdaMultiple ?? 12, 1),
      rndMarginPct: r(((M.rndMargin?.[nH] ?? 0) as number) * 100, 1),
      sgaMarginPct: r(((M.sgaMargin?.[nH] ?? 0) as number) * 100, 1),
      depreciationPctOfCapex: r(
        ((M.depreciationPercentOfCapex?.[nH] ?? 0) as number) * 100,
        1
      ),
      dividendPayoutPct: r(((M.dividendPayoutRatio?.[nH] ?? 0) as number) * 100, 1),
    };
  } catch {
    // If the clean run fails for any reason, fall back to overriding
    // everything, which is the behaviour this file had before.
    return {};
  }
}

// ---------------------------------------------------------------------------
// REPORTED HISTORY, STRAIGHT FROM THE FILINGS
// ---------------------------------------------------------------------------
// Reported history is a FACT. It does not belong to a model, and it must not
// change when the user switches between the derived and analyst views. So this
// reads the fetched statements directly rather than anything the engine
// produced, which also means every company shows every year the filing gave us
// (five, where the source has five) instead of however many years a hand-built
// data file happens to carry.
//
// A figure the filing does not provide comes back as null, never 0. Apple's
// FY2023 balance sheet lines were previously printed as "$0" when what was
// meant was "not available".
export function financialsFromStatements(statements: any[]): CompanyFinancials {
  const rows = Array.isArray(statements) ? statements : [];
  const num = (v: any): number | null =>
    typeof v === 'number' && isFinite(v) ? v : null;

  const pick = (fn: (row: any, i: number) => number | null, dp = 0) =>
    rows.map((row, i) => {
      const v = fn(row, i);
      return v === null ? null : r(v, dp);
    });

  return {
    years: rows.map((row) => 'FY' + String(row.fiscalYear).slice(2)),
    revenue: pick((row) => num(row.revenue)),
    revenueGrowth: pick((row, i) => {
      const prev = num(rows[i - 1]?.revenue);
      const now = num(row.revenue);
      // The earliest year has no prior year to grow from. That is an absence,
      // not zero growth.
      if (prev === null || now === null || prev === 0) return null;
      return (now / prev - 1) * 100;
    }, 1),
    grossMargin: pick((row) => {
      const rev = num(row.revenue), cogs = num(row.cogs);
      if (rev === null || cogs === null || rev === 0) return null;
      return ((rev - cogs) / rev) * 100;
    }, 1),
    ebitdaMargin: pick((row) => {
      const rev = num(row.revenue);
      const ebit = num(row.operatingIncome), da = num(row.depreciation);
      if (rev === null || ebit === null || rev === 0) return null;
      return ((ebit + (da ?? 0)) / rev) * 100;
    }, 1),
    netIncome: pick((row) => num(row.netIncome)),
    operatingCashFlow: pick((row) => num(row.operatingCashFlow)),
    freeCashFlow: pick((row) => {
      const ocf = num(row.operatingCashFlow), capex = num(row.capex);
      if (ocf === null || capex === null) return null;
      return ocf - Math.abs(capex);
    }),
    totalDebt: pick((row) => num(row.longTermDebt)),
    cashAndEquivalents: pick((row) => num(row.cash)),
    capex: pick((row) => {
      const capex = num(row.capex);
      return capex === null ? null : Math.abs(capex);
    }),
  };
}

// ---------------------------------------------------------------------------
// BUILD A MODEL RUN WITH SLIDER OVERRIDES
// ---------------------------------------------------------------------------
// IMPORTANT: an override is applied ONLY where the user has actually moved that
// slider away from its default. Previously every driver was written into the
// data file on every run, which quietly replaced the file's own assumptions
// even when nobody had touched anything.
//
// That mattered. Apple's curated file forecasts DECAYING segment growth (iPhone
// 3.0% falling to 1.0%, Services 13% falling to 11%). The old code read the
// first forecast year's blended rate, 5.5%, and held it flat for all five
// years, which compounded into a larger 2030 and a larger valuation: $169.61 a
// share instead of the workbook's $154.34. The site was showing an overridden
// model and calling it the analyst model.
//
// With this change, an untouched dashboard reproduces the data file exactly,
// and the sliders do what they appear to do: change one thing at a time.
function buildOverridden(source: any, drivers: ValuationDrivers): any {
  // Deep-clone so we never mutate the original data file
  const d = JSON.parse(JSON.stringify(source));

  const defaults = defaultDriversFor(source);

  // A driver counts as "touched" when it differs from its default. Both sides
  // are rounded to one decimal place, which is the precision the sliders work
  // in, so floating-point noise never counts as a change.
  const touchedNum = (key: keyof ValuationDrivers, dp: number): boolean => {
    const fallback = defaults[key];
    if (fallback === undefined || fallback === null) return false;
    return r(Number(drivers[key]), dp) !== r(Number(fallback), dp);
  };

  const touched = (key: keyof ValuationDrivers): boolean => {
    const fallback = defaults[key];
    if (fallback === undefined || fallback === null) return true; // no default known: honour the slider
    return r(Number(drivers[key]), 1) !== r(Number(fallback), 1);
  };

  // 1. Revenue growth — apply as a uniform blended rate across all segments
  if (touched('revenueGrowthPct')) {
    const rg = drivers.revenueGrowthPct / 100;
    for (const seg of Object.keys(d.assumptions.segmentGrowth)) {
      d.assumptions.segmentGrowth[seg] = [rg, rg, rg, rg, rg];
    }
  }

  // 2. Operating margin — keep R&D and SG&A, adjust gross margin to hit target
  //    Target operating margin = gross margin - R&D margin - SG&A margin
  if (touched('operatingMarginPct')) {
    const rndBase: number = d.assumptions.researchDevelopmentMargin[0];
    const histRev: number[] = d.historical.incomeStatement.revenue;
    const histSga: number[] = d.historical.incomeStatement.sellingGeneralAdmin;
    const sgaAvg = histRev.reduce((sum: number, rev: number, i: number) =>
      sum + (-histSga[i] / rev), 0) / histRev.length;
    const targetGross = drivers.operatingMarginPct / 100 + rndBase + sgaAvg;
    d.assumptions.grossMargin = [targetGross, targetGross, targetGross, targetGross, targetGross];
  }

  // 3. Tax rate override
  if (touched('taxRatePct')) {
    d.assumptions.taxRate = drivers.taxRatePct / 100;
  }

  // 4. Capex as % of revenue
  if (touched('capexPctOfRev')) {
    d.assumptions.capexMethod = 'percentOfRevenue';
    d.assumptions.capexRatio = drivers.capexPctOfRev / 100;
  }

  // 5. WACC direct override (bypasses CAPM). Left alone when untouched, so the
  //    engine's own CAPM figure is used at full precision rather than the
  //    one-decimal rounded version the slider displays.
  if (touched('waccPct')) {
    d.dcf.waccOverride = drivers.waccPct / 100;
  }

  // 6. Terminal growth
  if (touched('terminalGrowthPct')) {
    d.dcf.longTermGrowthRate = drivers.terminalGrowthPct / 100;
  }

  // 7. The deeper assumptions, adjustable from the full-screen model views.
  //    Beta, the risk-free rate and the market risk premium are the three
  //    inputs the discount rate is actually built from, so changing them is
  //    more honest than dragging the finished WACC: the reader can see the
  //    figure they moved flow through the CAPM line into the rate.
  if (drivers.betaValue !== undefined && d.dcf?.costOfCapital) {
    if (r(Number(drivers.betaValue), 2) !== r(Number(defaults.betaValue), 2)) {
      d.dcf.costOfCapital.equityBeta = Number(drivers.betaValue);
      d.dcf.costOfCapital.betaSource = 'equityBeta';
      // A hand-set beta replaces the CAPM output, so any WACC override that
      // was sitting there from the slider must go, or it would win.
      delete d.dcf.waccOverride;
    }
  }
  if (drivers.riskFreeRatePct !== undefined && d.dcf?.costOfCapital) {
    if (r(Number(drivers.riskFreeRatePct), 2) !== r(Number(defaults.riskFreeRatePct), 2)) {
      d.dcf.costOfCapital.riskFreeRate = Number(drivers.riskFreeRatePct) / 100;
      delete d.dcf.waccOverride;
    }
  }
  if (drivers.marketRiskPremiumPct !== undefined && d.dcf?.costOfCapital) {
    if (
      r(Number(drivers.marketRiskPremiumPct), 2) !==
      r(Number(defaults.marketRiskPremiumPct), 2)
    ) {
      d.dcf.costOfCapital.marketRiskPremium = Number(drivers.marketRiskPremiumPct) / 100;
      delete d.dcf.waccOverride;
    }
  }
  if (drivers.exitMultipleX !== undefined && d.dcf) {
    if (r(Number(drivers.exitMultipleX), 1) !== r(Number(defaults.exitMultipleX), 1)) {
      d.dcf.exitEbitdaMultiple = Number(drivers.exitMultipleX);
    }
  }
  if (drivers.rndMarginPct !== undefined && touchedNum('rndMarginPct', 1)) {
    d.assumptions.researchDevelopmentMargin = Array(5).fill(
      Number(drivers.rndMarginPct) / 100
    );
  }
  if (drivers.sgaMarginPct !== undefined && touchedNum('sgaMarginPct', 1)) {
    d.assumptions.sellingGeneralAdminMargin = Number(drivers.sgaMarginPct) / 100;
  }
  if (
    drivers.depreciationPctOfCapex !== undefined &&
    touchedNum('depreciationPctOfCapex', 1)
  ) {
    d.assumptions.depreciationAsPercentOfCapex =
      Number(drivers.depreciationPctOfCapex) / 100;
  }
  if (drivers.dividendPayoutPct !== undefined && touchedNum('dividendPayoutPct', 1)) {
    d.assumptions.dividendPayoutRatio = Number(drivers.dividendPayoutPct) / 100;
  }

  return d;
}

// ---------------------------------------------------------------------------
// CALCULATE DCF — called by TerminalDashboard on every slider change
// ---------------------------------------------------------------------------
// `source` is any engine-shaped data file: the curated AAPL.js, or one derived
// on the fly from filings by deriveModel(). The engine treats both identically.
export function calculateDCFFor(
  source: any,
  drivers: ValuationDrivers,
  marketPriceOverride?: number | null
): DCFResult {
  const d = buildOverridden(source, drivers);

  // The premium/discount comparison must use the price the shares trade at
  // now, not the price frozen into the data file when the model was built.
  // The model's own valuation is unaffected — this only changes what it is
  // being compared against.
  if (typeof marketPriceOverride === 'number' && marketPriceOverride > 0) {
    d.dcf.sharePrice = marketPriceOverride;
  }
  const M: any = buildModel(d);
  const D: any = buildDCF(M, d);

  // Guard: engine said DCF is not applicable
  if (!D.applicable) {
    return {
      applicable: false,
      message: D.message,
      targetPrice: 0,
      pvExplicitFCF: 0,
      pvTerminalValue: 0,
      enterpriseValueBillion: 0,
      impliedEquityValueBillion: 0,
      wacc: drivers.waccPct / 100,
      terminalGrowthRate: drivers.terminalGrowthPct / 100,
      forecastRows: [],
    };
  }

  // Guard: a value per share at or below zero is a failed model, not a cheap
  // share. Rule: show the refusal, never a number the model cannot stand
  // behind. Tata Motors produced -2.56 a share from a history that spanned a
  // demerger; the derivation now sets non-comparable periods aside before it
  // gets here, but the same thing can arise from a heavily indebted company
  // whose net debt exceeds the discounted value of its cash flows, and a
  // negative price per share is meaningless in either case.
  if (!(D.perpetuity?.valuePerShare > 0)) {
    return {
      applicable: false,
      message:
        'This model produces a value per share at or below zero, which means ' +
        'the discounted cash flows do not cover the net debt subtracted from ' +
        'them. That is a failure of the model, not a cheap share, so no ' +
        'implied value is shown. The reported figures below are unaffected.',
      targetPrice: 0,
      pvExplicitFCF: 0,
      pvTerminalValue: 0,
      enterpriseValueBillion: 0,
      impliedEquityValueBillion: 0,
      wacc: D.wacc,
      terminalGrowthRate: d.dcf.longTermGrowthRate,
      forecastRows: [],
    };
  }

  // Build the 5-year forecast rows for the FORECASTED tab
  const forecastRows: ForecastRow[] = D.years.map((year: number, t: number) => {
    const i = M.nH + t;
    const wcChange =
      -(M.wc.accountsReceivable.change[i] ?? 0)
      - (M.wc.inventory.change[i] ?? 0)
      + (M.wc.accountsPayable.change[i] ?? 0)
      + (M.wc.accruedExpenses.change[i] ?? 0)
      - (M.wc.otherCurrentAssets.change[i] ?? 0)
      - (M.wc.deferredTaxAssets.change[i] ?? 0)
      - (M.wc.otherAssets.change[i] ?? 0)
      + (M.wc.otherNonCurrentLiabilities.change[i] ?? 0);
    return {
      year,
      revenue: r(M.revenue[i]),
      revenueGrowthPct: r((M.revenueGrowth[i] ?? 0) * 100, 1),
      ebit: r(M.ebit[i]),
      operatingMarginPct: r(((M.ebit[i] ?? 0) / (M.revenue[i] ?? 1)) * 100, 1),
      taxAmt: r(-(M.taxes[i] ?? 0)),
      ebiat: r(D.ebiat[t]),
      da: r(M.depreciationAmortisation[i] ?? 0),
      capex: r(-(M.ppe.capex[i] ?? 0)),   // positive = cash outflow
      wcChange: r(-wcChange),              // positive = cash outflow
      ufcf: r(D.unleveredFCF[t]),
      discountFactor: r(D.discountFactor[t], 4),
      pvUfcf: r(D.presentValue[t]),
    };
  });

  // Equity bridge uses netDebt from the engine (negative = net cash)
  const equityBridge = D.perpetuity;
  const evM = equityBridge.enterpriseValue;          // in $M
  const eqM = equityBridge.equityValue;              // in $M

  return {
    applicable: true,
    targetPrice: r(equityBridge.valuePerShare, 2),
    pvExplicitFCF: r(D.pvStageOne / 1000, 1),         // billions
    pvTerminalValue: r(D.pvTerminalPerpetuity / 1000, 1),
    enterpriseValueBillion: r(evM / 1000, 1),
    impliedEquityValueBillion: r(eqM / 1000, 1),
    wacc: D.wacc,
    terminalGrowthRate: d.dcf.longTermGrowthRate,
    forecastRows,
  };
}

// Both the model and the DCF for a source with the current slider positions
// applied, for the full-screen views. One run, so every schedule on those
// screens comes from the same calculation that produced the headline value.
export function buildFullModel(source: any, drivers: ValuationDrivers): any {
  const d = buildOverridden(source, drivers);
  const M: any = buildModel(d);
  const D: any = buildDCF(M, d);
  return { model: M, dcf: D, applied: d };
}

// The engine model for a source with the current slider positions applied.
// Exported so the dashboard can read forecast ratios off the same schedules the
// valuation uses, rather than rebuilding the forecast a second way.
export function buildModelFor(source: any, drivers?: ValuationDrivers): any {
  const d = drivers ? buildOverridden(source, drivers) : source;
  return buildModel(d);
}

// ---------------------------------------------------------------------------
// THE VALUATION RANGE — what feeds the football field chart
// ---------------------------------------------------------------------------
// The published range is not an invented band around a single number. It is the
// two valuation methods the model actually runs, each widened by the same
// sensitivity steps the grid already uses, which is exactly how the football
// field in the Excel workbook is built (DCF sheet rows 120 to 144):
//
//   perpetuity, at terminal growth plus and minus one percentage point
//   exit multiple, at the exit EBITDA multiple plus and minus one turn
//   the 52-week trading range, for comparison
//
// Nothing here is a confidence interval and none of it is a forecast of the
// share price. Each bar is a value the model produces under stated inputs.
export interface ValuationBand {
  label: string;
  low: number;
  high: number;
  point: number;
  detail: string;
}

export function valuationBandsFor(
  source: any,
  drivers: ValuationDrivers,
  marketPriceOverride?: number | null
): ValuationBand[] {
  try {
    const d = buildOverridden(source, drivers);
    if (typeof marketPriceOverride === 'number' && marketPriceOverride > 0) {
      d.dcf.sharePrice = marketPriceOverride;
    }
    const M: any = buildModel(d);
    const D: any = buildDCF(M, d);
    if (!D.applicable) return [];

    const bands: ValuationBand[] = [];

    // The sensitivity grids are [waccStep][otherStep]. The middle wacc row is
    // the base WACC, so reading across it varies only the terminal assumption.
    const middle = Math.floor((d.dcf.sensitivity.waccSteps.length - 1) / 2);
    const growthRow: number[] = (D.sensitivity?.perpetuity || [])[middle] || [];
    const multipleRow: number[] = (D.sensitivity?.exitMultiple || [])[middle] || [];

    const clean = (row: number[]) =>
      row.filter((v) => typeof v === 'number' && isFinite(v) && v > 0);

    const growthValues = clean(growthRow);
    if (growthValues.length) {
      const growthPct = (d.dcf.longTermGrowthRate ?? 0) * 100;
      const step = (d.dcf.sensitivity.growthSteps.slice(-1)[0] ?? 0.01) * 100;
      bands.push({
        label: 'DCF — perpetuity growth',
        low: Math.min(...growthValues),
        high: Math.max(...growthValues),
        point: r(D.perpetuity.valuePerShare, 2),
        detail: `terminal growth ${(growthPct - step).toFixed(1)}% to ${(
          growthPct + step
        ).toFixed(1)}%`,
      });
    }

    const multipleValues = clean(multipleRow);
    if (multipleValues.length) {
      const multiple = d.dcf.exitEbitdaMultiple ?? 0;
      const step = d.dcf.sensitivity.multipleSteps.slice(-1)[0] ?? 1;
      bands.push({
        label: 'DCF — EV / EBITDA exit',
        low: Math.min(...multipleValues),
        high: Math.max(...multipleValues),
        point: r(D.exitMultipleValuation.valuePerShare, 2),
        detail: `exit multiple ${(multiple - step).toFixed(1)}x to ${(
          multiple + step
        ).toFixed(1)}x`,
      });
    }

    return bands;
  } catch {
    return [];
  }
}

// Apple's curated, Excel-verified data file, exported so the dashboard can run
// it directly.
export const AAPL_SOURCE = AAPL_DATA;

// Back-compatible wrapper: Apple's curated model.
export function calculateDCF(drivers: ValuationDrivers): DCFResult {
  return calculateDCFFor(AAPL_DATA, drivers);
}

// ---------------------------------------------------------------------------
// PRE-RUN THE BASE APPLE MODEL (module load time)
// ---------------------------------------------------------------------------
const _M: any = buildModel(AAPL_DATA);
const _D: any = buildDCF(_M, AAPL_DATA);
const _nH: number = _M.nH;

// Historical operating cash flow per year (from reported data in the data file)
// FY2023 and FY2024 are known filings; FY2025 is derived from model components.
const _histOCF: number[] = [110543, 118254, 0];
const _histCapex: number[] = [10959, 9447, 12715];
_histOCF[2] = r(
  (_M.netIncome[2] ?? 0)
  + (_M.depreciationAmortisation[2] ?? 0)
  + (_M.stockBasedCompensation[2] ?? 0)
  - (_M.wc.accountsReceivable.change[2] ?? 0)
  - (_M.wc.inventory.change[2] ?? 0)
  + (_M.wc.accountsPayable.change[2] ?? 0)
  + (_M.wc.accruedExpenses.change[2] ?? 0)
  - (_M.wc.otherCurrentAssets.change[2] ?? 0)
  - (_M.wc.deferredTaxAssets.change[2] ?? 0)
);

const _lastH = _nH - 1;
const _netDebtM: number =
  (_M.balanceSheet.longTermDebt[_lastH] ?? 0)
  - (_M.balanceSheet.cashAndSecurities[_lastH] ?? 0);
const _ebitdaLast: number = _M.ebitda[_lastH] ?? 1;
const _revLast: number = _M.revenue[_lastH] ?? 1;

// Default drivers from the real engine (first forecast year)
const _realWacc: number = (_D.applicable ? _D.wacc : 0.0936) * 100;
const _rg26 = r(((_M.revenue[_nH] ?? _revLast) / _revLast - 1) * 100, 1);
const _ebit26 = _M.ebit[_nH] ?? 0;
const _rev26  = _M.revenue[_nH] ?? 1;

const AAPL_DEFAULT_DRIVERS: ValuationDrivers = {
  revenueGrowthPct:   _rg26,
  operatingMarginPct: r((_ebit26 / _rev26) * 100, 1),
  taxRatePct:         r((_M.taxRate[_nH] ?? 0.152) * 100, 1),
  capexPctOfRev:      r(Math.abs((_M.ppe.capex[_nH] ?? 0) / _rev26) * 100, 1),
  waccPct:            r(_realWacc, 1),
  terminalGrowthPct:  r((AAPL_DATA.dcf.longTermGrowthRate ?? 0.04) * 100, 1),
  // net debt in billions; negative = net cash (Apple has net cash)
  netDebtBillion:     r(_netDebtM / 1000, 2),
  sharesOutstandingBillion: r((AAPL_DATA.dcf.dilutedSharesCount ?? 14714.676) / 1000, 3),
};

// Health score — the same five-ratio calculation every company gets, fed from
// Apple's reported years so the curated and derived views are comparable.
const _healthRows = _M.years.slice(0, _nH).map((year: number, i: number) => ({
  fiscalYear: year,
  revenue: _M.revenue[i],
  operatingIncome: _M.ebit[i],
  netIncome: _M.netIncome[i],
  depreciation: _M.depreciationAmortisation[i],
  cash: _M.balanceSheet.cashAndSecurities[i],
  currentAssets:
    (_M.balanceSheet.cashAndSecurities[i] ?? 0) +
    (_M.wc.accountsReceivable.ending[i] ?? 0) +
    (_M.wc.inventory.ending[i] ?? 0) +
    (_M.wc.otherCurrentAssets.ending[i] ?? 0) +
    (_M.wc.deferredTaxAssets.ending[i] ?? 0),
  currentLiabilities:
    (_M.wc.accountsPayable.ending[i] ?? 0) + (_M.wc.accruedExpenses.ending[i] ?? 0),
  longTermDebt: _M.balanceSheet.longTermDebt[i],
  totalAssets: _M.balanceSheet.totalAssets[i],
  operatingCashFlow: _histOCF[i],
}));

const _aaplHealthDetail = computeHealthScore(_healthRows);
const AAPL_HEALTH: import('../types').HealthScoreMetrics = toRadarMetrics(_aaplHealthDetail);

// ---------------------------------------------------------------------------
// COMPANY RECORDS
// ---------------------------------------------------------------------------
export const COMPANIES_DATA: Record<string, CompanyData> = {

  AAPL: {
    ticker:          'AAPL',
    name:            'Apple Inc.',
    isin:            'US0378331005',
    currency:        'USD',
    currencySymbol:  '$',
    price:           AAPL_DATA.dcf.sharePrice,
    priceChangePct:  -1.23,   // placeholder — will come from fetcher
    marketCapStr:    r(AAPL_DATA.dcf.sharePrice * AAPL_DATA.dcf.dilutedSharesCount / 1e6, 2) + 'T',
    roePct:          r((_M.ratios.roe[_lastH] ?? 0) * 100, 1),
    roaPct:          r((_M.ratios.roa[_lastH] ?? 0) * 100, 1),
    opMarginPct:     r((_ebit26 / _rev26) * 100, 1),
    netDebtEbitda:   (_netDebtM / _ebitdaLast) < 0
      ? r(Math.abs(_netDebtM / _ebitdaLast), 2) + 'x net cash'
      : r(_netDebtM / _ebitdaLast, 2) + 'x',
    sector:          'Technology',
    exchange:        'NASDAQ',
    description:     'Designer and maker of iPhone, Mac, iPad, wearables, and the Services ecosystem.',
    engineBacked:    true,
    financials: {
      years: _M.years.slice(0, _nH).map((y: number) => 'FY' + String(y).slice(2)),
      revenue:           _M.revenue.slice(0, _nH).map((v: number | null) => r(v ?? 0)),
      revenueGrowth:     _M.revenueGrowth.slice(0, _nH).map((v: number | null) => r((v ?? 0) * 100, 1)),
      grossMargin:       _M.grossMargin.slice(0, _nH).map((v: number | null) => r((v ?? 0) * 100, 1)),
      ebitdaMargin:      _M.ebitda.slice(0, _nH).map((v: number | null, i: number) =>
        r(((v ?? 0) / (_M.revenue[i] ?? 1)) * 100, 1)),
      netIncome:         _M.netIncome.slice(0, _nH).map((v: number | null) => r(v ?? 0)),
      operatingCashFlow: _histOCF.slice(0, _nH),
      freeCashFlow:      _histOCF.slice(0, _nH).map((ocf, i) => ocf - _histCapex[i]),
      totalDebt:         _M.balanceSheet.longTermDebt.slice(0, _nH).map((v: number | null) => r(v ?? 0)),
      cashAndEquivalents:_M.balanceSheet.cashAndSecurities.slice(0, _nH).map((v: number | null) => r(v ?? 0)),
      capex:             _histCapex.slice(0, _nH),
    },
    dataSource:      'SEC EDGAR',
    defaultDrivers:  AAPL_DEFAULT_DRIVERS,
    healthMetrics:   AAPL_HEALTH,
    healthDetail:    _aaplHealthDetail,
    excelModels: [
      {
        label: '3-Statement Model',
        url: 'https://drive.google.com/file/d/1JXl7kpF8iZw5KVpKFd4IUkvUYcdoY51X/view?usp=sharing',
      },
      {
        label: 'DCF Valuation Model',
        url: 'https://drive.google.com/file/d/13pl9-M7EskMqasRM6dCHepnqnUfymS5D/view?usp=sharing',
      },
    ],
    recentNews: [
      {
        id: '1',
        time: 'Loading...',
        headline: 'Live news will appear here once the news fetcher is connected.',
        source: 'Marginalia',
        type: 'PLACEHOLDER',
      },
    ],
  },

  // Only companies with a real, hand-built data file live here. Everything
  // else is fetched and modelled on demand — see src/data/autoCompany.ts.

};