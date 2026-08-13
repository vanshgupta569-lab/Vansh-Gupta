// Marginalia — universal company data fetcher
//
// Give it a ticker, it gives back up to five years of financial statements plus
// the current share price, in one consistent shape, for any listed company.
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

// How many years of history to return. Five gives the growth calculations a
// longer base than three did. This is a CEILING, not a requirement: SEC EDGAR
// normally has five or more, while Yahoo often carries only four. Whatever
// exists is returned, and a company with fewer years still works.
const YEARS_WANTED = 5;

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
    'PaymentsOfDistributionsToAffiliates',
    'PaymentsOfOrdinaryDividends',
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
  // Two different ideas of "which value wins" apply here, and they must not be
  // confused — mixing them up is how Apple's SG&A briefly came back as bare
  // G&A, missing the selling costs entirely:
  //
  //   WITHIN one tag  -> the most recently filed figure wins, so that a
  //                      restated number supersedes the original.
  //   ACROSS tags     -> the earliest tag in the list wins, because the list
  //                      is written in order of preference. A fallback tag may
  //                      only fill a year the preferred tag left empty.
  const merged = {};

  for (const tag of tagList) {
    const entry = facts['us-gaap']?.[tag];
    if (!entry) continue;

    const unitKey = Object.keys(entry.units || {})[0];
    if (!unitKey) continue;

    // Collect this tag's figures on their own first.
    const thisTag = {};

    for (const point of entry.units[unitKey]) {
      if (!point.form?.startsWith('10-K') || !point.end) continue;

      // Do not trust point.fy — that is the fiscal year of the FILING, not of
      // the figure. Every 10-K restates two prior years as comparatives, all
      // stamped with the filing's own fy. The figure's real period is in its
      // start and end dates.
      if (point.start) {
        // A flow item (revenue, profit, cash flow) spans a period. Keep only
        // full-year spans, discarding quarters and half-years.
        const days = (new Date(point.end) - new Date(point.start)) / 86400000;
        if (days < 300 || days > 400) continue;
      }
      // A stock item (cash, assets, equity) is a snapshot dated by end alone.

      const year = Number(point.end.slice(0, 4));
      if (!year) continue;

      // Later entries come from more recent filings, so let them overwrite.
      thisTag[year] = point.val;
    }

    // Now fold into the result, never displacing a preferred tag's figure.
    for (const [year, value] of Object.entries(thisTag)) {
      if (merged[year] === undefined) merged[year] = value;
    }
  }

  return merged;
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

  // The industry classification (SIC) code lives in a different SEC endpoint
  // from the financial facts. We need it because it is how banks, insurers and
  // other financial companies get identified — those are the companies where a
  // discounted cash flow model does not apply and must be suppressed.
  let sicCode = null;
  let sicDescription = null;
  try {
    const profileRes = await fetch(
      `https://data.sec.gov/submissions/CIK${match.cik}.json`,
      { headers: { 'User-Agent': SEC_CONTACT } }
    );
    if (profileRes.ok) {
      const profile = await profileRes.json();
      sicCode = profile.sic || null;
      sicDescription = profile.sicDescription || null;
    }
  } catch {
    // Non-fatal — the financial statements matter more than the label.
  }

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
    sicCode,
    sicDescription,
    statements,
  };
}

// ===========================================================================
// SECTION 2 — YAHOO FINANCE (everything that isn't a US filer)
// ===========================================================================

// Yahoo now rejects anonymous requests to its financial data with a 401.
// Access requires two things obtained in sequence: a session cookie, then a
// short "crumb" token tied to that cookie. Both are free and need no account.
let yahooAuth = null;

async function getYahooAuth() {
  if (yahooAuth) return yahooAuth;

  const browserHeaders = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  };

  // Step one: ask for any Yahoo page and keep the cookie it hands back.
  const cookieRes = await fetch('https://fc.yahoo.com', {
    headers: browserHeaders,
    redirect: 'follow',
  });

  const rawCookie = cookieRes.headers.get('set-cookie');
  if (!rawCookie) throw new Error('Yahoo did not issue a session cookie');

  const cookie = rawCookie
    .split(',')
    .map((part) => part.split(';')[0].trim())
    .filter(Boolean)
    .join('; ');

  // Step two: exchange the cookie for a crumb token.
  const crumbRes = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
    headers: { ...browserHeaders, Cookie: cookie },
  });

  const crumb = (await crumbRes.text()).trim();
  if (!crumb || crumb.length > 20 || crumb.includes('<')) {
    throw new Error('Yahoo did not issue a crumb token');
  }

  yahooAuth = { cookie, crumb, browserHeaders };
  return yahooAuth;
}

// Yahoo's old quoteSummary statement modules still answer, but they now come
// back mostly empty — balance sheet and cash flow return nothing. The endpoint
// that does still carry full statements is the "fundamentals timeseries" one,
// so that is what we use. Each line item is requested by name.
//
// The names on the left are ours (identical to the SEC path, so the front end
// never cares where a company came from). The names on the right are Yahoo's.
const YAHOO_FIELDS = {
  revenue: 'annualTotalRevenue',
  cogs: 'annualCostOfRevenue',
  rnd: 'annualResearchAndDevelopment',
  sga: 'annualSellingGeneralAndAdministration',
  operatingIncome: 'annualOperatingIncome',
  pretaxIncome: 'annualPretaxIncome',
  taxExpense: 'annualTaxProvision',
  netIncome: 'annualNetIncome',

  cash: 'annualCashAndCashEquivalents',
  receivables: 'annualAccountsReceivable',
  inventory: 'annualInventory',
  currentAssets: 'annualCurrentAssets',
  ppeNet: 'annualNetPPE',
  totalAssets: 'annualTotalAssets',
  payables: 'annualAccountsPayable',
  currentLiabilities: 'annualCurrentLiabilities',
  longTermDebt: 'annualLongTermDebt',
  totalLiabilities: 'annualTotalLiabilitiesNetMinorityInterest',
  equity: 'annualStockholdersEquity',

  depreciation: 'annualDepreciationAndAmortization',
  capex: 'annualCapitalExpenditure',
  operatingCashFlow: 'annualOperatingCashFlow',
  dividendsPaid: 'annualCashDividendsPaid',
  buybacks: 'annualRepurchaseOfCapitalStock',
  stockComp: 'annualStockBasedCompensation',
  dilutedShares: 'annualDilutedAverageShares',
};

// Yahoo reports money leaving the company as a negative number. The engine
// expects these as positive amounts, matching how they appear in the Excel
// model, so their sign gets flipped on the way in.
const OUTFLOW_FIELDS = new Set(['capex', 'dividendsPaid', 'buybacks']);

// Share counts are counts, not currency — they must not be divided into
// millions the way every monetary figure is.
const COUNT_FIELDS = new Set(['dilutedShares']);

async function fetchFromYahoo(symbol) {
  const auth = await getYahooAuth();

  // First call: the company's name, currency and sector.
  let profile = {};
  try {
    const profileRes = await fetch(
      `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
        symbol
      )}?modules=price%2CassetProfile&crumb=${encodeURIComponent(auth.crumb)}`,
      { headers: { ...auth.browserHeaders, Cookie: auth.cookie } }
    );
    if (profileRes.ok) {
      const body = await profileRes.json();
      profile = body?.quoteSummary?.result?.[0] || {};
    }
  } catch {
    // Non-fatal — we can fall back to the ticker as a name.
  }

  // Second call: the actual financial statements.
  const types = Object.values(YAHOO_FIELDS).join(',');
  const now = Math.floor(Date.now() / 1000);

  const res = await fetch(
    `https://query2.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(
      symbol
    )}?symbol=${encodeURIComponent(symbol)}` +
      `&type=${types}&period1=0&period2=${now}&merge=false` +
      `&crumb=${encodeURIComponent(auth.crumb)}`,
    { headers: { ...auth.browserHeaders, Cookie: auth.cookie } }
  );

  if (!res.ok) throw new Error(`Yahoo Finance unavailable (${res.status})`);

  const body = await res.json();
  const series = body?.timeseries?.result || [];
  if (series.length === 0) return null;

  // Yahoo returns one array per line item, each entry stamped with its own
  // date. Reshape that into { fieldName: { year: value } }, matching how the
  // SEC path already works.
  const byField = {};
  for (const [ourName, yahooName] of Object.entries(YAHOO_FIELDS)) {
    byField[ourName] = {};
    const block = series.find((entry) => entry?.meta?.type?.[0] === yahooName);
    for (const point of block?.[yahooName] || []) {
      if (!point?.asOfDate) continue;
      const raw = point.reportedValue?.raw;
      if (typeof raw !== 'number') continue;
      byField[ourName][Number(point.asOfDate.slice(0, 4))] = raw;
    }
  }

  const years = Object.keys(byField.revenue)
    .map(Number)
    .sort((a, b) => b - a)
    .slice(0, YEARS_WANTED)
    .reverse();

  if (years.length === 0) return null;

  const statements = years.map((year) => {
    const row = { fiscalYear: year };
    for (const field of Object.keys(YAHOO_FIELDS)) {
      const value = byField[field][year];
      if (typeof value !== 'number') {
        row[field] = null;
      } else if (COUNT_FIELDS.has(field)) {
        row[field] = value;
      } else {
        row[field] = (OUTFLOW_FIELDS.has(field) ? Math.abs(value) : value) / 1e6;
      }
    }
    return row;
  });

  const currency = profile.price?.currency || 'USD';

  return {
    source: 'Yahoo Finance',
    sourceUrl: `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}`,
    name: profile.price?.longName || profile.price?.shortName || symbol,
    currency,
    currencySymbol: currencySymbolFor(currency),
    sicCode: null,
    sicDescription: profile.assetProfile?.industry || null,
    sector: profile.assetProfile?.sector || null,
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
  // A full year of daily closes rather than five days. Same endpoint, same
  // cost, no key: the extra range is what gives us the 52-week high and low
  // for the football field chart, without paying for a quote API.
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      symbol
    )}?range=1y&interval=1d`,
    { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Marginalia/1.0)' } }
  );
  if (!res.ok) return null;

  const body = await res.json();
  const result = body?.chart?.result?.[0];
  const meta = result?.meta;
  if (!meta) return null;

  const price = meta.regularMarketPrice ?? null;

  // The 52-week range, worked out from the year of daily highs and lows we
  // just fetched. Yahoo also publishes its own fiftyTwoWeek figures on the
  // meta block; those are used as a fallback when the series is unusable, but
  // the computed figures are preferred because they can be checked against
  // data we are holding rather than taken on trust.
  const quoteBlock = result?.indicators?.quote?.[0] || {};
  const highs = (quoteBlock.high || []).filter((v) => typeof v === 'number');
  const lows = (quoteBlock.low || []).filter((v) => typeof v === 'number');

  const fiftyTwoWeekHigh = highs.length
    ? Math.max(...highs)
    : typeof meta.fiftyTwoWeekHigh === 'number'
    ? meta.fiftyTwoWeekHigh
    : null;
  const fiftyTwoWeekLow = lows.length
    ? Math.min(...lows)
    : typeof meta.fiftyTwoWeekLow === 'number'
    ? meta.fiftyTwoWeekLow
    : null;

  // Yesterday's close. Over a one-year range Yahoo's chartPreviousClose is the
  // close from a YEAR ago, not the previous session, so using it would put a
  // twelve-month move in the little percentage beside the price. The last two
  // closes in the series are the honest source.
  const closes = (quoteBlock.close || []).filter((v) => typeof v === 'number');
  const previous =
    closes.length >= 2
      ? closes[closes.length - 2]
      : typeof meta.previousClose === 'number'
      ? meta.previousClose
      : null;

  return {
    price,
    previousClose: previous,
    changePct:
      price && previous ? Number((((price - previous) / previous) * 100).toFixed(2)) : null,
    currency: meta.currency || null,
    exchange: meta.fullExchangeName || meta.exchangeName || null,
    fiftyTwoWeekHigh:
      fiftyTwoWeekHigh === null ? null : Number(fiftyTwoWeekHigh.toFixed(2)),
    fiftyTwoWeekLow:
      fiftyTwoWeekLow === null ? null : Number(fiftyTwoWeekLow.toFixed(2)),
    // How many trading days the range was measured over, so a thin series is
    // visible rather than silently presented as a full year.
    rangeObservations: highs.length,
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