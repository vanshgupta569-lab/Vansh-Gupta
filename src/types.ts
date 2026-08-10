export type TabType = 'HISTORICAL' | 'FORECASTED' | 'DRIVERS' | 'DCF_OUTPUT';
export type ScreenType = 'HOME' | 'DIRECTORY' | 'ANALYSIS';

export interface CompanyFinancials {
  years: string[];
  revenue: number[]; // in Millions
  revenueGrowth: number[]; // %
  grossMargin: number[]; // %
  ebitdaMargin: number[]; // %
  netIncome: number[]; // in Millions
  operatingCashFlow: number[]; // in Millions
  freeCashFlow: number[]; // in Millions
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
  netDebtBillion: number;
}

export interface HealthScoreMetrics {
  balanceSheetStrength: number; // 0-100
  earningsQuality: number; // 0-100
  accrualRisk: number; // 0-100 (lower is better or inverted)
  cashFlowCoverage: number; // 0-100
  valuationMoat: number; // 0-100
  overallScore: number;
}

export interface NewsItem {
  id: string;
  time: string;
  headline: string;
  source: string;
  type: 'FILING' | 'UPGRADE' | 'CONTRACT' | 'EARNINGS';
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
}

export interface AccessRequestForm {
  name: string;
  email: string;
  institution: string;
  role: string;
}
