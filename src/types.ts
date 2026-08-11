export type TabType = 'HISTORICAL' | 'FORECASTED' | 'DRIVERS' | 'DCF_OUTPUT';
export type ScreenType = 'HOME' | 'DIRECTORY' | 'ANALYSIS';

export interface CompanyFinancials {
  years: string[];
  revenue: number[];
  revenueGrowth: number[];        // %
  grossMargin: number[];          // %
  ebitdaMargin: number[];         // %
  netIncome: number[];
  operatingCashFlow: number[];
  freeCashFlow: number[];
  totalDebt: number[];
  cashAndEquivalents: number[];
  capex: number[];
}

export interface ValuationDrivers {
  revenueGrowthPct: number;
  operatingMarginPct: number;
  taxRatePct: number;
  capexPctOfRev: number;
  waccPct: number;
  terminalGrowthPct: number;
  sharesOutstandingBillion: number;
  netDebtBillion: number;         // positive = net debt; negative = net cash
}

// One row in the 5-year forecast table
export interface ForecastRow {
  year: number;
  revenue: number;
  revenueGrowthPct: number;
  ebit: number;
  operatingMarginPct: number;
  taxAmt: number;
  ebiat: number;
  da: number;
  capex: number;
  wcChange: number;
  ufcf: number;
  discountFactor: number;
  pvUfcf: number;
}

export interface DCFResult {
  applicable: boolean;
  message?: string;
  // Valuation outputs
  targetPrice: number;
  pvExplicitFCF: number;          // billions
  pvTerminalValue: number;        // billions
  enterpriseValueBillion: number;
  impliedEquityValueBillion: number;
  // For sensitivity grid
  wacc: number;
  terminalGrowthRate: number;
  // Forecast rows (drives the FORECASTED tab)
  forecastRows: ForecastRow[];
}

export interface HealthScoreMetrics {
  balanceSheetStrength: number;   // 0-100
  earningsQuality: number;        // 0-100
  accrualRisk: number;            // 0-100
  cashFlowCoverage: number;       // 0-100
  valuationMoat: number;          // 0-100
  overallScore: number;
}

export interface NewsItem {
  id: string;
  time: string;
  headline: string;
  source: string;
  type: 'FILING' | 'UPGRADE' | 'CONTRACT' | 'EARNINGS' | 'PLACEHOLDER' | 'NEWS';
  url?: string;
}

export interface CompanyData {
  ticker: string;
  name: string;
  isin: string;
  currency: string;
  currencySymbol: string;
  price: number;
  priceChangePct: number;
  marketCapStr: string;
  roePct: number;
  roaPct: number;
  opMarginPct: number;
  netDebtEbitda: string;
  sector: string;
  exchange: string;
  description: string;
  financials: CompanyFinancials;
  defaultDrivers: ValuationDrivers;
  healthMetrics: HealthScoreMetrics;
  recentNews: NewsItem[];
  // Engine-sourced flag — true for companies with a real data file
  engineBacked: boolean;
  // Present only on auto-generated companies: the engine-shaped data file the
  // model was derived from, so sliders can re-run the engine for this company.
  modelData?: any;
  // Plain-English note on where each derived assumption came from.
  provenance?: Record<string, string>;
  // The reasoning behind the health score: each ratio, its value, and the
  // threshold it was judged against.
  healthDetail?: any;
  // Downloadable Excel workbooks, for companies modelled by hand.
  excelModels?: { label: string; url: string }[];
}

export interface AccessRequestForm {
  name: string;
  email: string;
  institution: string;
  role: string;
}