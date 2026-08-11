// Marginalia — universal company data fetcher
//
// Give it a ticker, it gives back three years of financial statements plus the
// current share price, in one consistent shape, for any listed company.
//
//   /api/company?ticker=AAPL       -> US filer, comes from SEC EDGAR
//   /api/company?ticker=RELIANCE.NS -> not a US filer, comes from Yahoo Finance
//
// IMPORTANT: this file returns DATA ONLY. It does not calculate anything.
// The engine still runs in the browser, exactly as it does today, so the
// sliders keep recalculating instantly without asking the server again.
//
// ---------------------------------------------------------------------------
// EDIT THIS BEFORE DEPLOYING
// The SEC requires every automated request to identify itself with a real
// contact email. They block requests that don't. Put your own email here.
const SEC_CONTACT = 'Marginalia Research vanshgupta569@gmail.com';
// ---------------------------------------------------------------------------

const YEARS_WANTED = 3;

// ===========================================================================
// SECTION 1 — SEC EDGAR (United States filers)
// ===========================================================================

// A company's filings are filed under a CIK number, not a ticker. This is the
// SEC's official ticker -> CIK lookup table. It's one file for all US filers.
let cikCache = null;

async function lookupCIK(ticker) {
  if (!cikCache) {
    const res = await fetch('https://www.sec.gov/files/company_tickers.json', {
      headers: { 'User-Agent': SEC_CONTACT },
    });
    if (!res.ok) throw new Error(`SEC ticker list unavailable (${res.status})`);
    cikCache = await res.json();
  }

  for (const key of Object.keys(cikCache)) {
    const row = cikCache[key];
    if (row.ticker === ticker) {
      return {
        cik: String(row.cik_str).padStart(10, '0'),
        name: row.title,
      };
    }
  }
  return null;
}

// XBRL is the structured data format inside SEC filings. The same real-world
// number can be filed under different tag names by different companies, so for
// each line item we try several tags and take the first that exists.
const US_TAGS = {
  revenue: [
    'RevenueFromContractWithCustomerExcludingAssessedTax',
    'RevenueFromContractWithCustomerIncludingAssessedTax',
    'Revenues',
    'SalesRevenueNet',
  ],
  cogs: ['CostOfGoodsAndServicesSold', 'CostOfRevenue', 'CostOfServices'],
  rnd: ['ResearchAndDevelopmentExpense'],
  sga: [
    'SellingGeneralAndAdministrativeExpense',
    'GeneralAndAdministrativeExpense',
  ],
  operatingIncome: ['OperatingIncomeLoss'],
  pretaxIncome: [
    'IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest',
    'IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments',
  ],
  taxExpense: ['IncomeTaxExpenseBenefit'],
  netIncome: ['NetIncomeLoss', 'ProfitLoss'],

  cash: [
    'CashAndCashEquivalentsAtCarryingValue',
    'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents',
  ],
  receivables: [
    'AccountsReceivableNetCurrent',
    'ReceivablesNetCurrent',
  ],
  inventory: ['InventoryNet'],
  currentAssets: ['AssetsCurrent'],
  ppeNet: ['PropertyPlantAndEquipmentNet'],
  totalAssets: ['Assets'],
  payables: ['AccountsPayableCurrent'],
  currentLiabilities: ['LiabilitiesCurrent'],
  longTermDebt: [
    'LongTermDebtNoncurrent',
    'LongTermDebt',
    'LongTermNotesPayable',
  ],
  totalLiabilities: ['Liabilities'],
  equity: [
    'StockholdersEquity',
    'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest',
  ],

  depreciation: [
    'DepreciationDepletionAndAmortization',
    'DepreciationAmortizationAndAccretionNet',
    'Depreciation',
  ],
  capex: [
    'PaymentsToAcquirePropertyPlantAndEquipment',
    'PaymentsToAcquireProductiveAssets',
  ],
  operatingCashFlow: [
    'NetCashProvidedByUsedInOperatingActivities',
    'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations',
  ],
  stockComp: ['ShareBasedCompensation', 'AllocatedShareBasedCompensationExpense'],
  dividendsPaid: [
    'PaymentsOfDividendsCommonStock',
    'PaymentsOfDividends',
  ],
  buybacks: ['PaymentsForRepurchaseOfCommonStock'],
  dilutedShares: [
    'WeightedAverageNumberOfDilutedSharesOutstanding',
    'WeightedAverageNumberOfSharesOutstandingBasic',
  ],
};

// Pull one line item out of the giant XBRL blob, for the annual periods only.
// Returns an object like { 2023: 383285000000, 2024: 391035000000 }
function extractUSFact(facts, tagList) {
  for (const tag of tagList) {
    const entry = facts['us-gaap']?.[tag];
    if (!entry) continue;

    // Companies report in different units; take whichever unit this tag uses.
    const unitKey = Object.keys(entry.units || {})[0];
    if (!unitKey) continue;

    const byYear = {};
    for (const point of entry.units[unitKey]) {
      // fp === 'FY' and form 10-K keeps us to full-year audited figures only,
      // filtering out quarterly and amended noise.
      if (point.fp !== 'FY' || !point.form?.startsWith('10-K')) continue;
      if (!point.fy) continue;

      // Income statement items cover a period (start + end). Balance sheet
      // items are a snapshot (end only). Both are handled the same way here:
      // the most recently filed value for a fiscal year wins.
      byYear[point.fy] = point.val;
    }

    if (Object.keys(byYear).length > 0) return byYear;
  }
  return {};
}

async function fetchFromSEC(ticker) {
  const match = await lookupCIK(ticker);
  if (!match) return null;

  const res = await fetch(
    `https://data.sec.gov/api/xbrl/companyfacts/CIK${match.cik}.json`,
    { headers: { 'User-Agent': SEC_CONTACT } }
  );
  if (!res.ok) throw new Error(`SEC filings unavailable (${res.status})`);

  const body = await res.json();
  const facts = body.facts || {};

  // Build { fieldName: { year: value } } for every field we care about.
  const extracted = {};
  for (const [field, tags] of Object.entries(US_TAGS)) {
    extracted[field] = extractUSFact(facts, tags);
  }

  // Which fiscal years do we actually have? Use revenue as the anchor, since a
  // company with no revenue figure is unusable anyway.
  const years = Object.keys(extracted.revenue)
    .map(Number)
    .sort((a, b) => b - a)
    .slice(0, YEARS_WANTED)
    .reverse();

  if (years.length === 0) return null;

  const statements = years.map((year) => {
    const row = { fiscalYear: year };
    for (const field of Object.keys(US_TAGS)) {
      const value = extracted[field][year];
      // Convert to millions — the engine and the Excel model both work in
      // millions, and raw XBRL is in whole currency units.
      row[field] = typeof value === 'number' ? value / 1e6 : null;
    }
    // Share counts must NOT be divided; they are counts, not currency.
    const rawShares = extracted.dilutedShares[year];
    row.dilutedShares = typeof rawShares === 'number' ? rawShares : null;
    return row;
  });

  return {
    source: 'SEC EDGAR',
    sourceUrl: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${match.cik}&type=10-K`,
    name: match.name,
    currency: 'USD',
    currencySymbol: '$',
    sicCode: body.sic || null,
    sicDescription: body.sicDescription || null,
    statements,
  };
}

// ===========================================================================
// SECTION 2 — YAHOO FINANCE (everything that isn't a US filer)
// ===========================================================================

// Yahoo's field names, mapped onto the same shape SEC data produces, so the
// front end never has to care which source a company came from.
const YAHOO_INCOME = {
  revenue: ['totalRevenue'],
  cogs: ['costOfRevenue'],
  rnd: ['researchDevelopment'],
  sga: ['sellingGeneralAdministrative'],
  operatingIncome: ['operatingIncome', 'ebit'],
  pretaxIncome: ['incomeBeforeTax'],
  taxExpense: ['incomeTaxExpense'],
  netIncome: ['netIncome'],
};

const YAHOO_BALANCE = {
  cash: ['cash', 'cashAndCashEquivalents'],
  receivables: ['netReceivables'],
  inventory: ['inventory'],
  currentAssets: ['totalCurrentAssets'],
  ppeNet: ['propertyPlantEquipment'],
  totalAssets: ['totalAssets'],
  payables: ['accountsPayable'],
  currentLiabilities: ['totalCurrentLiabilities'],
  longTermDebt: ['longTermDebt'],
  totalLiabilities: ['totalLiab'],
  equity: ['totalStockholderEquity'],
};

const YAHOO_CASHFLOW = {
  depreciation: ['depreciation'],
  capex: ['capitalExpenditures'],
  operatingCashFlow: ['totalCashFromOperatingActivities'],
  dividendsPaid: ['dividendsPaid'],
  buybacks: ['repurchaseOfStock'],
};

function yahooValue(block, keys) {
  for (const key of keys) {
    const cell = block?.[key];
    if (cell && typeof cell.raw === 'number') return cell.raw;
    if (typeof cell === 'number') return cell;
  }
  return null;
}

async function fetchFromYahoo(symbol) {
  const modules = [
    'incomeStatementHistory',
    'balanceSheetHistory',
    'cashflowStatementHistory',
    'defaultKeyStatistics',
    'summaryDetail',
    'price',
    'assetProfile',
  ].join('%2C');

  const res = await fetch(
    `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
      symbol
    )}?modules=${modules}`,
    { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Marginalia/1.0)' } }
  );

  if (!res.ok) throw new Error(`Yahoo Finance unavailable (${res.status})`);

  const body = await res.json();
  const result = body?.quoteSummary?.result?.[0];
  if (!result) return null;

  const income = result.incomeStatementHistory?.incomeStatementHistory || [];
  const balance = result.balanceSheetHistory?.balanceSheetStatements || [];
  const cashflow = result.cashflowStatementHistory?.cashflowStatements || [];

  if (income.length === 0) return null;

  // Yahoo returns newest first; flip so oldest year comes first, like SEC.
  const periods = income.slice(0, YEARS_WANTED).reverse();

  const statements = periods.map((incomeRow, index) => {
    // Walk the balance and cash flow arrays in the same reversed order.
    const offset = Math.min(YEARS_WANTED, income.length) - 1 - index;
    const balanceRow = balance[offset] || {};
    const cashflowRow = cashflow[offset] || {};

    const row = {
      fiscalYear: new Date((incomeRow.endDate?.raw || 0) * 1000).getUTCFullYear(),
    };

    for (const [field, keys] of Object.entries(YAHOO_INCOME)) {
      const v = yahooValue(incomeRow, keys);
      row[field] = v === null ? null : v / 1e6;
    }
    for (const [field, keys] of Object.entries(YAHOO_BALANCE)) {
      const v = yahooValue(balanceRow, keys);
      row[field] = v === null ? null : v / 1e6;
    }
    for (const [field, keys] of Object.entries(YAHOO_CASHFLOW)) {
      const v = yahooValue(cashflowRow, keys);
      // Yahoo reports capex, dividends and buybacks as negative outflows.
      // The engine expects positive numbers for these, so flip the sign.
      const flip = field === 'capex' || field === 'dividendsPaid' || field === 'buybacks';
      row[field] = v === null ? null : Math.abs(v) / 1e6 * (flip ? 1 : Math.sign(v) || 1);
    }

    row.stockComp = null; // Yahoo does not expose this reliably.
    row.dilutedShares =
      result.defaultKeyStatistics?.sharesOutstanding?.raw ?? null;

    return row;
  });

  return {
    source: 'Yahoo Finance',
    sourceUrl: `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}`,
    name: result.price?.longName || result.price?.shortName || symbol,
    currency: result.price?.currency || 'USD',
    currencySymbol: currencySymbolFor(result.price?.currency),
    sicCode: null,
    sicDescription: result.assetProfile?.industry || null,
    sector: result.assetProfile?.sector || null,
    statements,
  };
}

function currencySymbolFor(code) {
  const map = { USD: '$', INR: '₹', EUR: '€', GBP: '£', JPY: '¥' };
  return map[code] || (code ? `${code} ` : '$');
}

// ===========================================================================
// SECTION 3 — LIVE PRICE (works for every market, no key needed)
// ===========================================================================

async function fetchQuote(symbol) {
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      symbol
    )}?range=5d&interval=1d`,
    { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Marginalia/1.0)' } }
  );
  if (!res.ok) return null;

  const body = await res.json();
  const meta = body?.chart?.result?.[0]?.meta;
  if (!meta) return null;

  const price = meta.regularMarketPrice ?? null;
  const previous = meta.chartPreviousClose ?? meta.previousClose ?? null;

  return {
    price,
    previousClose: previous,
    changePct:
      price && previous ? Number((((price - previous) / previous) * 100).toFixed(2)) : null,
    currency: meta.currency || null,
    exchange: meta.fullExchangeName || meta.exchangeName || null,
    asOf: meta.regularMarketTime
      ? new Date(meta.regularMarketTime * 1000).toISOString()
      : null,
  };
}

// ===========================================================================
// SECTION 4 — THE HANDLER
// ===========================================================================

export default async function handler(req, res) {
  const raw = String(req.query.ticker || '').trim().toUpperCase();

  if (!raw || raw.length > 20 || !/^[A-Z0-9.\-]+$/.test(raw)) {
    res.status(400).json({ error: 'Provide a valid ticker, e.g. ?ticker=AAPL' });
    return;
  }

  try {
    let data = null;

    // A ticker containing a dot and a suffix (RELIANCE.NS, BP.L) is a foreign
    // listing and will never be in the SEC's list, so skip straight to Yahoo.
    const looksForeign = /\.[A-Z]{1,3}$/.test(raw);

    if (!looksForeign) {
      data = await fetchFromSEC(raw);
    }

    // Not a US filer, or the SEC had nothing usable — fall back to Yahoo.
    if (!data) {
      data = await fetchFromYahoo(raw);
    }

    if (!data) {
      res.status(404).json({
        error: `No financial statements found for "${raw}". Check the ticker — foreign listings need a suffix, for example RELIANCE.NS for India or BP.L for London.`,
      });
      return;
    }

    const quote = await fetchQuote(raw);

    // Cache for six hours. Financial statements change four times a year, so
    // this is generous, and it keeps us far inside every free tier.
    res.setHeader(
      'Cache-Control',
      'public, s-maxage=21600, stale-while-revalidate=86400'
    );

    res.status(200).json({
      ticker: raw,
      ...data,
      quote,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    res.status(502).json({
      error: `Could not retrieve data for "${raw}": ${error.message}`,
    });
  }
}
