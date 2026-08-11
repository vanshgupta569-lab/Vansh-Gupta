// @ts-ignore — JS engine and data files have no TS declarations
import AAPL_DATA from './AAPL.js';
// @ts-ignore
import { buildModel, buildDCF } from '../engine/model.js';

import { CompanyData, ValuationDrivers, DCFResult, ForecastRow } from '../types';

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------
const r = (n: number | null, dp = 0): number => {
  if (n == null) return 0;
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
};

// ---------------------------------------------------------------------------
// BUILD A MODEL RUN WITH SLIDER OVERRIDES
// ---------------------------------------------------------------------------
function buildOverridden(source: any, drivers: ValuationDrivers): any {
  // Deep-clone so we never mutate the original data file
  const d = JSON.parse(JSON.stringify(source));

  // 1. Revenue growth — apply as a uniform blended rate across all segments
  const rg = drivers.revenueGrowthPct / 100;
  for (const seg of Object.keys(d.assumptions.segmentGrowth)) {
    d.assumptions.segmentGrowth[seg] = [rg, rg, rg, rg, rg];
  }

  // 2. Operating margin — keep R&D and SG&A, adjust gross margin to hit target
  //    Target operating margin = gross margin - R&D margin - SG&A margin
  const rndBase: number = d.assumptions.researchDevelopmentMargin[0];
  const histRev: number[] = d.historical.incomeStatement.revenue;
  const histSga: number[] = d.historical.incomeStatement.sellingGeneralAdmin;
  const sgaAvg = histRev.reduce((sum: number, rev: number, i: number) =>
    sum + (-histSga[i] / rev), 0) / histRev.length;
  const targetGross = drivers.operatingMarginPct / 100 + rndBase + sgaAvg;
  d.assumptions.grossMargin = [targetGross, targetGross, targetGross, targetGross, targetGross];

  // 3. Tax rate override
  d.assumptions.taxRate = drivers.taxRatePct / 100;

  // 4. Capex as % of revenue
  d.assumptions.capexMethod = 'percentOfRevenue';
  d.assumptions.capexRatio = drivers.capexPctOfRev / 100;

  // 5. WACC direct override (bypasses CAPM)
  d.dcf.waccOverride = drivers.waccPct / 100;

  // 6. Terminal growth
  d.dcf.longTermGrowthRate = drivers.terminalGrowthPct / 100;

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

// Health score: derived from real model ratios
const _roe = Math.abs(_M.ratios.roe[_lastH] ?? 0);
const _roa = _M.ratios.roa[_lastH] ?? 0;
const _netMargin = (_M.netIncome[_lastH] ?? 0) / _revLast;
const _fcfM = _histOCF[_lastH] - _histCapex[_lastH];
const _fcfMargin = _fcfM / _revLast;
// Scale to 0-100 (capped)
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const AAPL_HEALTH: import('../types').HealthScoreMetrics = {
  balanceSheetStrength: clamp(r((_M.balanceSheet.cashAndSecurities[_lastH] ?? 0) / (_M.balanceSheet.totalAssets[_lastH] ?? 1) * 200), 0, 100),
  earningsQuality:      clamp(r(_fcfMargin * 400), 0, 100),
  accrualRisk:          clamp(r(90 - Math.abs(_netMargin - _fcfMargin) * 500), 0, 100),
  cashFlowCoverage:     clamp(r(_fcfMargin * 500), 0, 100),
  valuationMoat:        clamp(r(_netMargin * 400), 0, 100),
  overallScore:         0,
};
AAPL_HEALTH.overallScore = r((AAPL_HEALTH.balanceSheetStrength + AAPL_HEALTH.earningsQuality + AAPL_HEALTH.cashFlowCoverage + AAPL_HEALTH.valuationMoat) / 4);

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
    defaultDrivers:  AAPL_DEFAULT_DRIVERS,
    healthMetrics:   AAPL_HEALTH,
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

  // -------------------------------------------------------------------------
  // The four companies below do not yet have a real engine data file.
  // Historical numbers are placeholder / illustrative and are clearly marked.
  // -------------------------------------------------------------------------

  META: {
    ticker: 'META', name: 'Meta Platforms Inc.', isin: 'US30303M1027',
    currency: 'USD', currencySymbol: '$', price: 588.77, priceChangePct: 0.83,
    marketCapStr: '1.51T', roePct: 35.2, roaPct: 19.8, opMarginPct: 38.0,
    netDebtEbitda: '0.1x net cash', sector: 'Technology', exchange: 'NASDAQ',
    description: 'Family of social applications and next-generation computing platforms.',
    engineBacked: false,
    financials: {
      years: ['FY22', 'FY23', 'FY24'],
      revenue: [116609, 134902, 164501],
      revenueGrowth: [-1.1, 15.7, 21.9],
      grossMargin: [78.5, 80.8, 81.7],
      ebitdaMargin: [34.8, 42.7, 52.6],
      netIncome: [23200, 39098, 53997],
      operatingCashFlow: [35613, 71113, 91780],
      freeCashFlow: [18913, 43015, 52046],
      totalDebt: [9559, 18387, 29062],
      cashAndEquivalents: [40740, 65401, 77813],
      capex: [32277, 28096, 39657],
    },
    defaultDrivers: {
      revenueGrowthPct: 14.0, operatingMarginPct: 37.0, taxRatePct: 18.0,
      capexPctOfRev: 20.0, waccPct: 10.5, terminalGrowthPct: 4.0,
      sharesOutstandingBillion: 2.56, netDebtBillion: -48.75,
    },
    healthMetrics: { balanceSheetStrength: 88, earningsQuality: 91, accrualRisk: 85, cashFlowCoverage: 87, valuationMoat: 86, overallScore: 87 },
    recentNews: [{ id: '1', time: '—', headline: 'News feed not yet connected for this company.', source: 'Marginalia', type: 'PLACEHOLDER' }],
  },

  NVDA: {
    ticker: 'NVDA', name: 'NVIDIA Corporation', isin: 'US67066G1040',
    currency: 'USD', currencySymbol: '$', price: 137.34, priceChangePct: 2.15,
    marketCapStr: '3.36T', roePct: 123.8, roaPct: 55.1, opMarginPct: 61.1,
    netDebtEbitda: '0.1x net cash', sector: 'Technology', exchange: 'NASDAQ',
    description: 'Designer of graphics processing units and system-on-chip for AI, gaming and data centres.',
    engineBacked: false,
    financials: {
      years: ['FY23', 'FY24', 'FY25'],
      revenue: [26974, 60922, 130497],
      revenueGrowth: [0.2, 122.0, 114.2],
      grossMargin: [56.9, 72.7, 74.6],
      ebitdaMargin: [20.9, 57.7, 62.4],
      netIncome: [4368, 29760, 72880],
      operatingCashFlow: [5641, 28083, 64083],
      freeCashFlow: [3808, 26942, 60847],
      totalDebt: [9702, 8462, 9283],
      cashAndEquivalents: [13622, 25984, 53626],
      capex: [976, 1069, 3116],
    },
    defaultDrivers: {
      revenueGrowthPct: 35.0, operatingMarginPct: 58.0, taxRatePct: 14.0,
      capexPctOfRev: 2.5, waccPct: 12.0, terminalGrowthPct: 4.5,
      sharesOutstandingBillion: 24.41, netDebtBillion: -44.34,
    },
    healthMetrics: { balanceSheetStrength: 90, earningsQuality: 94, accrualRisk: 90, cashFlowCoverage: 95, valuationMoat: 95, overallScore: 93 },
    recentNews: [{ id: '1', time: '—', headline: 'News feed not yet connected for this company.', source: 'Marginalia', type: 'PLACEHOLDER' }],
  },

  RELIANCE: {
    ticker: 'RELIANCE', name: 'Reliance Industries Ltd.', isin: 'INE002A01018',
    currency: 'INR', currencySymbol: '₹', price: 2890.50, priceChangePct: -0.45,
    marketCapStr: '₹19.6L Cr', roePct: 8.9, roaPct: 4.3, opMarginPct: 13.2,
    netDebtEbitda: '1.8x', sector: 'Conglomerate / Energy & Retail', exchange: 'NSE',
    description: 'India\'s largest conglomerate spanning O2C, Jio telecom, retail and new energy.',
    engineBacked: false,
    financials: {
      years: ['FY22', 'FY23', 'FY24'],
      revenue: [721634, 900112, 899041],
      revenueGrowth: [50.8, 24.7, -0.1],
      grossMargin: [22.6, 17.6, 19.2],
      ebitdaMargin: [17.1, 15.1, 17.6],
      netIncome: [60705, 73670, 79020],
      operatingCashFlow: [111860, 115820, 159110],
      freeCashFlow: [7510, 25340, 50660],
      totalDebt: [359015, 339022, 344990],
      cashAndEquivalents: [193432, 187540, 157870],
      capex: [104350, 90480, 108450],
    },
    defaultDrivers: {
      revenueGrowthPct: 8.0, operatingMarginPct: 12.5, taxRatePct: 25.0,
      capexPctOfRev: 12.0, waccPct: 11.0, terminalGrowthPct: 5.5,
      sharesOutstandingBillion: 6.77, netDebtBillion: 0.1882,
    },
    healthMetrics: { balanceSheetStrength: 70, earningsQuality: 75, accrualRisk: 68, cashFlowCoverage: 72, valuationMoat: 76, overallScore: 72 },
    recentNews: [{ id: '1', time: '—', headline: 'News feed not yet connected for this company.', source: 'Marginalia', type: 'PLACEHOLDER' }],
  },

  SPCX: {
    ticker: 'SPCX', name: 'Space Exploration Technologies Corp.', isin: 'US84612A1007',
    currency: 'USD', currencySymbol: '$', price: 185.40, priceChangePct: 3.21,
    marketCapStr: '$420B', roePct: 4.2, roaPct: 2.1, opMarginPct: 6.8,
    netDebtEbitda: '1.2x', sector: 'Aerospace & Defence', exchange: 'NASDAQ',
    description: 'Designer and operator of reusable rockets, Starship, and the Starlink satellite internet constellation.',
    engineBacked: false,
    financials: {
      years: ['FY24*', 'FY25E*', 'FY26E*'],
      revenue: [13000, 15200, 19800],
      revenueGrowth: [0, 16.9, 30.3],
      grossMargin: [18.0, 21.0, 24.0],
      ebitdaMargin: [5.0, 8.0, 13.0],
      netIncome: [-270, 380, 1200],
      operatingCashFlow: [1100, 2100, 3800],
      freeCashFlow: [-2400, -1200, 800],
      totalDebt: [6800, 6200, 5800],
      cashAndEquivalents: [1900, 2800, 3800],
      capex: [3500, 3300, 3000],
    },
    defaultDrivers: {
      revenueGrowthPct: 28.0, operatingMarginPct: 9.0, taxRatePct: 21.0,
      capexPctOfRev: 16.0, waccPct: 13.5, terminalGrowthPct: 5.0,
      sharesOutstandingBillion: 2.27, netDebtBillion: 4.9,
    },
    healthMetrics: { balanceSheetStrength: 55, earningsQuality: 50, accrualRisk: 58, cashFlowCoverage: 48, valuationMoat: 82, overallScore: 59 },
    recentNews: [{ id: '1', time: '—', headline: 'News feed not yet connected for this company.', source: 'Marginalia', type: 'PLACEHOLDER' }],
  },
};