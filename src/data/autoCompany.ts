// Marginalia — auto-generated company records
//
// Takes what /api/company returns for any ticker, derives a model from it,
// runs the same engine Apple uses, and produces the record the dashboard
// renders. No company-specific code lives here or anywhere else.

// @ts-ignore — plain JS module, no type declarations
import { deriveModel } from './deriveModel.js';
// @ts-ignore
import { buildModel, buildDCF } from '../engine/model.js';
import { CompanyData, HealthScoreMetrics, ValuationDrivers } from '../types';

const r = (n: number | null | undefined, dp = 0): number => {
  if (n == null || !isFinite(n)) return 0;
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// Fetch a company and build everything the dashboard needs. Throws with a
// readable message when the ticker isn't found or has no usable filings.
export async function loadCompany(ticker: string): Promise<CompanyData> {
  const response = await fetch(`/api/company?ticker=${encodeURIComponent(ticker)}`);
  const fetched = await response.json();

  if (!response.ok || fetched.error) {
    throw new Error(fetched.error || `Could not load ${ticker}`);
  }
  if (!fetched.statements || fetched.statements.length < 2) {
    throw new Error(
      `${ticker} does not have enough reported history to model. At least two full years are needed.`
    );
  }

  const modelData = deriveModel(fetched);
  return buildCompanyRecord(fetched, modelData);
}

export function buildCompanyRecord(fetched: any, modelData: any): CompanyData {
  const M: any = buildModel(modelData);
  const D: any = buildDCF(M, modelData);

  const nH: number = M.nH;
  const last = nH - 1;

  const revLast: number = M.revenue[last] ?? 1;
  const ebitdaLast: number = M.ebitda[last] ?? 1;
  const netDebtM: number =
    (M.balanceSheet.longTermDebt[last] ?? 0) -
    (M.balanceSheet.cashAndSecurities[last] ?? 0);

  const ebitNext = M.ebit[nH] ?? 0;
  const revNext = M.revenue[nH] ?? 1;

  const defaultDrivers: ValuationDrivers = {
    revenueGrowthPct: r((revNext / revLast - 1) * 100, 1),
    operatingMarginPct: r((ebitNext / revNext) * 100, 1),
    taxRatePct: r((M.taxRate[nH] ?? 0.21) * 100, 1),
    capexPctOfRev: r(Math.abs((M.ppe.capex[nH] ?? 0) / revNext) * 100, 1),
    waccPct: r((D.applicable ? D.wacc : 0.09) * 100, 1),
    terminalGrowthPct: r((modelData.dcf.longTermGrowthRate ?? 0.025) * 100, 1),
    netDebtBillion: r(netDebtM / 1000, 2),
    sharesOutstandingBillion: r((modelData.dcf.dilutedSharesCount ?? 0) / 1000, 3),
  };

  // Health score, on the same basis the curated Apple record uses.
  const netMargin = (M.netIncome[last] ?? 0) / revLast;
  const ocf =
    (M.netIncome[last] ?? 0) +
    (M.depreciationAmortisation[last] ?? 0) +
    (M.stockBasedCompensation[last] ?? 0);
  const fcfMargin = (ocf - Math.abs(M.ppe.capex[last] ?? 0)) / revLast;

  const health: HealthScoreMetrics = {
    balanceSheetStrength: clamp(
      r(((M.balanceSheet.cashAndSecurities[last] ?? 0) /
        (M.balanceSheet.totalAssets[last] ?? 1)) * 200), 0, 100),
    earningsQuality: clamp(r(fcfMargin * 400), 0, 100),
    accrualRisk: clamp(r(90 - Math.abs(netMargin - fcfMargin) * 500), 0, 100),
    cashFlowCoverage: clamp(r(fcfMargin * 500), 0, 100),
    valuationMoat: clamp(r(netMargin * 400), 0, 100),
    overallScore: 0,
  };
  health.overallScore = r(
    (health.balanceSheetStrength + health.earningsQuality +
     health.cashFlowCoverage + health.valuationMoat) / 4
  );

  const price = fetched.quote?.price ?? 0;
  const shares = modelData.dcf.dilutedSharesCount ?? 0;
  const marketCap = price * shares; // millions

  const years: number[] = M.years.slice(0, nH);
  const symbol = fetched.currencySymbol || '$';

  return {
    ticker: fetched.ticker,
    name: fetched.name || fetched.ticker,
    isin: '',
    currency: fetched.currency || 'USD',
    currencySymbol: symbol,
    price: r(price, 2),
    priceChangePct: fetched.quote?.changePct ?? 0,
    marketCapStr:
      marketCap >= 1e6
        ? r(marketCap / 1e6, 2) + 'T'
        : marketCap >= 1000
        ? r(marketCap / 1000, 1) + 'B'
        : r(marketCap, 0) + 'M',
    roePct: r((M.ratios.roe[last] ?? 0) * 100, 1),
    roaPct: r((M.ratios.roa[last] ?? 0) * 100, 1),
    opMarginPct: r(((M.ebit[last] ?? 0) / revLast) * 100, 1),
    netDebtEbitda:
      netDebtM / ebitdaLast < 0
        ? r(Math.abs(netDebtM / ebitdaLast), 2) + 'x net cash'
        : r(netDebtM / ebitdaLast, 2) + 'x',
    sector: modelData.meta.sector || 'Not classified',
    exchange: fetched.quote?.exchange || '',
    description: `${fetched.name || fetched.ticker} — model built automatically from ${fetched.source} filings.`,

    // True only for hand-verified models. An auto-generated one is honest
    // about being derived, and the dashboard labels it accordingly.
    engineBacked: false,

    financials: {
      years: years.map((y: number) => 'FY' + String(y).slice(2)),
      revenue: years.map((_, i) => r(M.revenue[i])),
      revenueGrowth: years.map((_, i) => r((M.revenueGrowth[i] ?? 0) * 100, 1)),
      grossMargin: years.map((_, i) => r((M.grossMargin[i] ?? 0) * 100, 1)),
      ebitdaMargin: years.map((_, i) =>
        r(((M.ebitda[i] ?? 0) / (M.revenue[i] ?? 1)) * 100, 1)),
      netIncome: years.map((_, i) => r(M.netIncome[i])),
      operatingCashFlow: years.map((_, i) =>
        r((M.netIncome[i] ?? 0) + (M.depreciationAmortisation[i] ?? 0) +
          (M.stockBasedCompensation[i] ?? 0))),
      freeCashFlow: years.map((_, i) =>
        r((M.netIncome[i] ?? 0) + (M.depreciationAmortisation[i] ?? 0) +
          (M.stockBasedCompensation[i] ?? 0) - Math.abs(M.ppe.capex[i] ?? 0))),
      totalDebt: years.map((_, i) => r(M.balanceSheet.longTermDebt[i])),
      cashAndEquivalents: years.map((_, i) => r(M.balanceSheet.cashAndSecurities[i])),
      capex: years.map((_, i) => r(Math.abs(M.ppe.capex[i] ?? 0))),
    },

    defaultDrivers,
    healthMetrics: health,
    recentNews: [],

    // Carried so the dashboard can re-run the engine on every slider move,
    // and so it can show where each assumption came from.
    modelData,
    provenance: modelData.provenance,
  } as CompanyData;
}