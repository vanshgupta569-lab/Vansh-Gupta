import { CompanyData, ValuationDrivers } from '../types';

export const COMPANIES_DATA: Record<string, CompanyData> = {
  AAPL: {
    ticker: 'AAPL',
    name: 'Apple Inc.',
    isin: 'US0378331005',
    currency: 'USD',
    currencySymbol: '$',
    price: 189.43,
    priceChangePct: 1.24,
    marketCapStr: '3.02T',
    roePct: 145.6,
    roaPct: 28.2,
    opMarginPct: 30.0,
    netDebtEbitda: '2.3x',
    sector: 'Consumer Electronics & Software',
    exchange: 'NASDAQ',
    description: 'Global leader in consumer hardware, software services, and ecosystem integration.',
    financials: {
      years: ['FY21', 'FY22', 'FY23', 'FY24', 'FY25E'],
      revenue: [365817, 394328, 383285, 391035, 412500],
      revenueGrowth: [33.3, 7.8, -2.8, 2.0, 5.5],
      grossMargin: [41.8, 43.3, 44.1, 46.2, 46.8],
      ebitdaMargin: [32.9, 33.1, 33.7, 34.0, 34.8],
      netIncome: [94680, 99803, 96995, 93736, 101200],
      operatingCashFlow: [104038, 122151, 110543, 118250, 125000],
      freeCashFlow: [92953, 111443, 99584, 108800, 114500],
      totalDebt: [124719, 120069, 111088, 101200, 95000],
      cashAndEquivalents: [62639, 48304, 61555, 65200, 68000],
      capex: [11085, 10708, 10959, 9450, 10500],
    },
    defaultDrivers: {
      revenueGrowthPct: 5.2,
      operatingMarginPct: 30.5,
      taxRatePct: 15.8,
      capexPctOfRev: 4.2,
      waccPct: 8.2,
      terminalGrowthPct: 2.5,
      sharesOutstandingBillion: 15.2,
      netDebtBillion: 45.0,
    },
    healthMetrics: {
      balanceSheetStrength: 92,
      earningsQuality: 95,
      accrualRisk: 88,
      cashFlowCoverage: 96,
      valuationMoat: 90,
      overallScore: 92,
    },
    recentNews: [
      { id: '1', time: '09:42 AM', headline: 'Apple wins $178M enterprise defense contract for Vision Pro spatial computing', source: 'SEC Filing 8-K', type: 'CONTRACT' },
      { id: '2', time: '08:15 AM', headline: 'Analyst Upgrade: Services gross margins expected to expand to 74%', source: 'Morgan Stanley', type: 'UPGRADE' },
      { id: '3', time: 'Yesterday', headline: 'Q3 Earnings Call Transcript: Forensic accrual analysis shows zero revenue pulling', source: 'Marginalia Research', type: 'EARNINGS' },
      { id: '4', time: '2 Days Ago', headline: 'Form 10-Q Disclosure: Off-balance sheet supplier commitments reduced by 4.2%', source: 'SEC Filing 10-Q', type: 'FILING' },
    ],
  },
  META: {
    ticker: 'META',
    name: 'Meta Platforms',
    isin: 'US30303M1027',
    currency: 'USD',
    currencySymbol: '$',
    price: 485.58,
    priceChangePct: -0.12,
    marketCapStr: '1.23T',
    roePct: 32.4,
    roaPct: 18.6,
    opMarginPct: 38.2,
    netDebtEbitda: '0.4x',
    sector: 'Interactive Media & AI Infra',
    exchange: 'NASDAQ',
    description: 'Family of apps & AI infrastructure enterprise generating ultra-high free cash flow.',
    financials: {
      years: ['FY21', 'FY22', 'FY23', 'FY24', 'FY25E'],
      revenue: [117929, 116609, 134902, 156200, 182000],
      revenueGrowth: [37.2, -1.1, 15.7, 15.8, 16.5],
      grossMargin: [80.3, 79.6, 80.8, 81.5, 82.0],
      ebitdaMargin: [46.8, 36.2, 43.1, 47.2, 48.5],
      netIncome: [39370, 23200, 39098, 51200, 61500],
      operatingCashFlow: [57683, 50475, 71113, 82400, 94000],
      freeCashFlow: [38439, 18439, 43000, 52000, 60000],
      totalDebt: [14400, 27000, 37000, 38000, 35000],
      cashAndEquivalents: [48000, 40700, 65400, 72000, 78000],
      capex: [19244, 32036, 28113, 30400, 34000],
    },
    defaultDrivers: {
      revenueGrowthPct: 14.2,
      operatingMarginPct: 39.0,
      taxRatePct: 16.5,
      capexPctOfRev: 18.0,
      waccPct: 9.1,
      terminalGrowthPct: 3.0,
      sharesOutstandingBillion: 2.54,
      netDebtBillion: -34.0, // Net Cash
    },
    healthMetrics: {
      balanceSheetStrength: 95,
      earningsQuality: 91,
      accrualRisk: 86,
      cashFlowCoverage: 94,
      valuationMoat: 89,
      overallScore: 91,
    },
    recentNews: [
      { id: '1', time: '10:11 AM', headline: 'Llama 3.5 Enterprise adoption reaches 42% of Fortune 500 tech stack', source: 'Tech Intelligence', type: 'CONTRACT' },
      { id: '2', time: '07:30 AM', headline: 'SEC Footnote Audit: AI Capex capitalization matches hardware useful life tables', source: 'Marginalia Forensics', type: 'FILING' },
    ],
  },
  NVDA: {
    ticker: 'NVDA',
    name: 'Nvidia Corp',
    isin: 'US67066G1040',
    currency: 'USD',
    currencySymbol: '$',
    price: 875.28,
    priceChangePct: 2.15,
    marketCapStr: '2.15T',
    roePct: 118.2,
    roaPct: 52.4,
    opMarginPct: 61.5,
    netDebtEbitda: '0.1x',
    sector: 'Semiconductors & Compute',
    exchange: 'NASDAQ',
    description: 'Accelerated computing platform pioneer dominating data center AI compute.',
    financials: {
      years: ['FY21', 'FY22', 'FY23', 'FY24', 'FY25E'],
      revenue: [26914, 26974, 60922, 126000, 168000],
      revenueGrowth: [61.4, 0.2, 125.9, 106.8, 33.3],
      grossMargin: [64.9, 56.9, 72.7, 75.4, 76.2],
      ebitdaMargin: [41.2, 33.4, 58.2, 64.5, 66.0],
      netIncome: [9752, 4368, 29760, 68000, 92000],
      operatingCashFlow: [9108, 5641, 28090, 72000, 98000],
      freeCashFlow: [8132, 3808, 26947, 68000, 93000],
      totalDebt: [10946, 12034, 11056, 9500, 8000],
      cashAndEquivalents: [21200, 13296, 25980, 36000, 48000],
      capex: [976, 1833, 1143, 4000, 5000],
    },
    defaultDrivers: {
      revenueGrowthPct: 28.5,
      operatingMarginPct: 62.0,
      taxRatePct: 13.5,
      capexPctOfRev: 3.5,
      waccPct: 9.8,
      terminalGrowthPct: 3.5,
      sharesOutstandingBillion: 2.46,
      netDebtBillion: -26.5,
    },
    healthMetrics: {
      balanceSheetStrength: 98,
      earningsQuality: 93,
      accrualRisk: 90,
      cashFlowCoverage: 98,
      valuationMoat: 97,
      overallScore: 95,
    },
    recentNews: [
      { id: '1', time: '11:05 AM', headline: 'Blackwell architecture yield milestones confirmed via Taiwan TSMC filing', source: 'Supply Chain Audit', type: 'FILING' },
      { id: '2', time: '09:00 AM', headline: 'Hyperscaler capex commitment updates show zero deceleration in H2', source: 'Goldman Sachs', type: 'UPGRADE' },
    ],
  },
  RELIANCE: {
    ticker: 'RELIANCE',
    name: 'Reliance Industries',
    isin: 'INE002A01018',
    currency: 'INR',
    currencySymbol: '₹',
    price: 2954.10,
    priceChangePct: 0.45,
    marketCapStr: '₹20.0T',
    roePct: 11.2,
    roaPct: 6.8,
    opMarginPct: 17.8,
    netDebtEbitda: '1.8x',
    sector: 'Energy, Telecom & Retail Conglomerate',
    exchange: 'NSE',
    description: 'India\'s largest conglomerate spanning Digital Services (Jio), Retail, and New Energy.',
    financials: {
      years: ['FY21', 'FY22', 'FY23', 'FY24', 'FY25E'],
      revenue: [466924, 699962, 879468, 914472, 1020000],
      revenueGrowth: [-22.0, 49.9, 25.6, 4.0, 11.5],
      grossMargin: [30.2, 28.5, 29.1, 31.0, 32.2],
      ebitdaMargin: [16.8, 15.8, 16.2, 17.8, 18.5],
      netIncome: [53739, 60705, 66702, 69624, 78500],
      operatingCashFlow: [26185, 110654, 115200, 132000, 148000],
      freeCashFlow: [-72200, -18200, -25000, 12000, 32000],
      totalDebt: [251811, 266305, 313961, 320000, 300000],
      cashAndEquivalents: [254000, 241846, 222000, 235000, 250000],
      capex: [98335, 128854, 140200, 120000, 116000],
    },
    defaultDrivers: {
      revenueGrowthPct: 10.8,
      operatingMarginPct: 18.2,
      taxRatePct: 22.0,
      capexPctOfRev: 11.5,
      waccPct: 11.2,
      terminalGrowthPct: 4.5,
      sharesOutstandingBillion: 6.76,
      netDebtBillion: 75.0,
    },
    healthMetrics: {
      balanceSheetStrength: 84,
      earningsQuality: 88,
      accrualRisk: 82,
      cashFlowCoverage: 85,
      valuationMoat: 94,
      overallScore: 86,
    },
    recentNews: [
      { id: '1', time: '02:15 PM', headline: 'Jio 5G ARPU expansion reaches ₹186.2 with enterprise lease momentum', source: 'NSE Disclosure', type: 'EARNINGS' },
      { id: '2', time: '11:40 AM', headline: 'New Energy Gigafactory commissioning timeline ahead of Schedule in Jamnagar', source: 'Marginalia Field Note', type: 'CONTRACT' },
    ],
  },
  SPCX: {
    ticker: 'SPCX',
    name: 'SpaceX (Private/Pre-IPO)',
    isin: 'US84852P1088',
    currency: 'USD',
    currencySymbol: '$',
    price: 42.15,
    priceChangePct: 0.00,
    marketCapStr: '$180B',
    roePct: 18.5,
    roaPct: 12.1,
    opMarginPct: 22.4,
    netDebtEbitda: '0.8x',
    sector: 'Aerospace & Orbital Communications',
    exchange: 'PRIVATE',
    description: 'Pioneer in reusable launch technology and Starlink orbital satellite broadband network.',
    financials: {
      years: ['FY21', 'FY22', 'FY23', 'FY24', 'FY25E'],
      revenue: [2300, 4600, 8700, 13200, 18500],
      revenueGrowth: [80.0, 100.0, 89.1, 51.7, 40.2],
      grossMargin: [22.0, 35.0, 48.0, 56.0, 62.0],
      ebitdaMargin: [10.0, 20.0, 31.0, 38.0, 44.0],
      netIncome: [-400, 150, 1200, 2800, 4900],
      operatingCashFlow: [200, 900, 3100, 5400, 8100],
      freeCashFlow: [-1800, -1200, 400, 2100, 4200],
      totalDebt: [3200, 4100, 4800, 4500, 4000],
      cashAndEquivalents: [2800, 3400, 4200, 5800, 7500],
      capex: [2000, 2100, 2700, 3300, 3900],
    },
    defaultDrivers: {
      revenueGrowthPct: 32.0,
      operatingMarginPct: 38.0,
      taxRatePct: 18.0,
      capexPctOfRev: 18.5,
      waccPct: 10.5,
      terminalGrowthPct: 4.0,
      sharesOutstandingBillion: 4.27,
      netDebtBillion: -1.5,
    },
    healthMetrics: {
      balanceSheetStrength: 89,
      earningsQuality: 92,
      accrualRisk: 87,
      cashFlowCoverage: 91,
      valuationMoat: 99,
      overallScore: 91,
    },
    recentNews: [
      { id: '1', time: '01:20 PM', headline: 'Starlink subscriber count passes 3.2 million globally with positive cash flow per user', source: 'Private Tender Offer Memo', type: 'EARNINGS' },
      { id: '2', time: '08:45 AM', headline: 'Starship Flight 5 FAA orbital clearance granted for catch tower retrieval test', source: 'FAA Filing', type: 'FILING' },
    ],
  },
};

/**
 * Perform dynamic DCF valuation based on drivers
 */
export function calculateDCF(drivers: ValuationDrivers) {
  const {
    revenueGrowthPct,
    operatingMarginPct,
    taxRatePct,
    capexPctOfRev,
    waccPct,
    terminalGrowthPct,
    sharesOutstandingBillion,
    netDebtBillion,
  } = drivers;

  // Assume base revenue of $100 Billion for benchmark multiplier ratio
  const baseRevenue = 100;
  const years = 5;
  const fcfProjections: number[] = [];
  const discountFactors: number[] = [];

  let currentRev = baseRevenue;
  const waccDec = waccPct / 100;
  const termGrowthDec = terminalGrowthPct / 100;

  for (let t = 1; t <= years; t++) {
    currentRev *= 1 + revenueGrowthPct / 100;
    const ebit = currentRev * (operatingMarginPct / 100);
    const nopat = ebit * (1 - taxRatePct / 100);
    const capex = currentRev * (capexPctOfRev / 100);
    // Working capital assumption (~2% of rev growth)
    const nwcChange = currentRev * 0.02;
    const fcf = nopat - capex - nwcChange;
    fcfProjections.push(fcf);

    const discountFactor = Math.pow(1 + waccDec, t);
    discountFactors.push(1 / discountFactor);
  }

  // Sum of PV of explicitly projected 5-yr cash flows
  const pvExplicitFCF = fcfProjections.reduce((sum, fcf, idx) => sum + fcf * discountFactors[idx], 0);

  // Terminal Value using Gordon Growth
  const lastFCF = fcfProjections[years - 1];
  const terminalFCF = lastFCF * (1 + termGrowthDec);
  const terminalValue = (waccDec - termGrowthDec > 0.005)
    ? terminalFCF / (waccDec - termGrowthDec)
    : terminalFCF / 0.05; // Fallback to safe floor

  const pvTerminalValue = terminalValue * discountFactors[years - 1];

  // Enterprise Value (Scaled to absolute company scale ratio)
  const enterpriseValueBillion = (pvExplicitFCF + pvTerminalValue) * 32.5;
  const impliedEquityValueBillion = enterpriseValueBillion - netDebtBillion;
  const targetPrice = impliedEquityValueBillion / sharesOutstandingBillion;

  return {
    enterpriseValueBillion: Math.round(enterpriseValueBillion),
    impliedEquityValueBillion: Math.round(impliedEquityValueBillion),
    targetPrice: Number(targetPrice.toFixed(2)),
    pvExplicitFCF: Math.round(pvExplicitFCF * 32.5),
    pvTerminalValue: Math.round(pvTerminalValue * 32.5),
  };
}
