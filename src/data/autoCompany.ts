// FILE: src/data/autoCompany.ts
// Marginalia — auto-generated company records
//
// Takes what /api/company returns for any ticker, derives a model from it,
// runs the same engine Apple uses, and produces the record the dashboard
// renders. No company-specific code lives here or anywhere else.

// @ts-ignore — plain JS module, no type declarations
import { deriveModel } from './deriveModel.js';
// @ts-ignore
import { buildModel, buildDCF } from '../engine/model.js';
// @ts-ignore
import { computeHealthScore, toRadarMetrics } from './healthScore.js';
import { CompanyData, HealthScoreMetrics, ValuationDrivers } from '../types';
import { financialsFromStatements } from './companies';
import {
  applyCorrections,
  correctionCount,
  correctedFields,
  type Corrections,
} from './corrections';
import { isFinancialCompany, buildResidualIncome } from './residualIncome.js';

const r = (n: number | null | undefined, dp = 0): number => {
  if (n == null || !isFinite(n)) return 0;
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// Fetch the filings for a ticker and nothing more. Split out from loadCompany
// so the reader can be shown the figures BEFORE a model is built from them:
// the correction screen needs the payload, not a finished record.
export async function fetchCompanyPayload(ticker: string): Promise<any> {
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
  if (!fetched.ticker) fetched.ticker = ticker;
  return fetched;
}

/**
 * Build the record from a payload, with the reader's corrections applied.
 *
 * THE WHOLE OF FEATURE 11a IS THESE FOUR LINES. Every number the site shows is
 * downstream of one array — the statements the fetcher returned — so patching
 * that array and running exactly the same derivation corrects the forecast, the
 * discounted cash flow, the health score, the asset approach and the residual
 * income model together. A correction needing its own path through the engine
 * would have meant the design was wrong.
 */
export function buildCompanyFrom(fetched: any, corrections?: Corrections): CompanyData {
  const changed = corrections ? correctionCount(corrections) : 0;
  const source = changed ? applyCorrections(fetched, corrections as Corrections) : fetched;

  const modelData: any = deriveModel(source);
  // The filings themselves travel with the model, so the dashboard can show
  // reported history without going back through the engine.
  modelData.rawStatements = source.statements;

  const record = buildCompanyRecord(source, modelData);

  // The filed payload is carried untouched so the correction screen can be
  // reopened, every original is still recoverable, and "reset to as filed" never
  // needs another fetch.
  record.rawFetched = fetched;

  // A corrected model must never be able to pass as a filed one. This is what
  // every screen reads to say so.
  record.correctedInputs = changed
    ? { count: changed, fields: correctedFields(corrections as Corrections) }
    : undefined;

  return record;
}

// Fetch a company and build everything the dashboard needs, with no
// corrections. Kept for callers that have no reason to show the figures first.
export async function loadCompany(ticker: string): Promise<CompanyData> {
  const fetched = await fetchCompanyPayload(ticker);
  return buildCompanyFrom(fetched);
}

// Fetch a company and derive ONLY its model data — used when a curated company
// (Apple) also needs its derived counterpart, so the two can be compared.
export async function loadDerivedModelData(ticker: string): Promise<any> {
  const response = await fetch(`/api/company?ticker=${encodeURIComponent(ticker)}`);
  const fetched = await response.json();
  if (!response.ok || fetched.error || !fetched.statements) {
    throw new Error(fetched.error || `Could not load ${ticker}`);
  }
  const modelData: any = deriveModel(fetched);
  modelData.rawStatements = fetched.statements;
  return modelData;
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

  // Health score: five named ratios against stated thresholds. See
  // src/data/healthScore.js — every input is a reported figure and every
  // threshold is written down, so the number can be defended line by line.
  const healthDetail = computeHealthScore(fetched.statements);
  const health: HealthScoreMetrics = toRadarMetrics(healthDetail);

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
    fiftyTwoWeekHigh: fetched.quote?.fiftyTwoWeekHigh ?? null,
    fiftyTwoWeekLow: fetched.quote?.fiftyTwoWeekLow ?? null,
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

    // Reported history comes from the filings, not the model. See
    // financialsFromStatements in companies.ts.
    financials: financialsFromStatements(fetched.statements),
dataSource: fetched.source,
    profile: fetched.profile || null,

    // Banks and financials get a residual income valuation instead of a
    // discounted cash flow. The engine refuses them for good reason; this is
    // the different method it refuses in favour of.
    residualIncome: isFinancialCompany(fetched)
      ? buildResidualIncome(fetched, {
          riskFreeRate: modelData?.dcf?.costOfCapital?.riskFreeRate,
          marketRiskPremium: modelData?.dcf?.costOfCapital?.marketRiskPremium,
          beta: modelData?.dcf?.costOfCapital?.equityBeta,
        })
      : null,

    defaultDrivers,
    healthMetrics: health,
    healthDetail,
    recentNews: [],

    // Carried so the dashboard can re-run the engine on every slider move,
    // and so it can show where each assumption came from.
    modelData,
    provenance: modelData.provenance,
  } as CompanyData;
}