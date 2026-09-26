// FILE: api/company.js
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

// ---------------------------------------------------------------------------
// REQUEST GUARD
//
// This block is deliberately repeated in each of the five API files rather
// than imported from one shared file. A shared helper is better engineering,
// but on Vercel each file in /api is packaged as its own small program, and a
// missing or unbundled helper takes the whole route down with a server error
// that says nothing useful. Five copies of forty lines cannot fail that way.
//
// If any rule here changes, it has to change in all five files: company.js,
// search.js, news.js, comps.js and verify.js.
//
// What this does NOT do: stop someone calling the API from a script. CORS is a
// browser rule, so it only stops OTHER WEBSITES using this API inside a
// visitor's browser. Rate limiting is the tool for scripts, and that lives in
// the Vercel firewall rule.
// ---------------------------------------------------------------------------

const ALLOWED_EXACT = new Set([
  'https://marginalia-iota-one.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
]);

function isAllowedOrigin(origin) {
  if (ALLOWED_EXACT.has(origin)) return true;
  try {
    const url = new URL(origin);
    return url.protocol === 'https:' && url.hostname.endsWith('.vercel.app');
  } catch {
    return false;
  }
}

// Errors must never be cached, or one bad answer is served to everybody.
function noStore(res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
}

// Returns true if the request may continue. When it returns false it has
// already answered, and the route must simply return.
function guardRequest(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'GET, HEAD, OPTIONS');
    res.status(204).end();
    return false;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    noStore(res);
    res.setHeader('Allow', 'GET, HEAD, OPTIONS');
    res.status(405).json({ error: 'Method not allowed.' });
    return false;
  }
  // Browsers send an Origin header only when the page making the call sits on
  // a different address from the one it calls. Our own pages send nothing.
  const origin = req.headers.origin;
  if (origin && !isAllowedOrigin(origin)) {
    noStore(res);
    res.status(403).json({ error: 'This API is not open to other sites.' });
    return false;
  }
  res.setHeader('Vary', 'Origin');
  return true;
}

// The real reason goes to the Vercel log, where only you can read it. Echoing
// it back to the caller is how a plain error message becomes an attack.
function logAndHide(scope, error, detail) {
  const reason = error && error.message ? error.message : String(error);
  console.error(`[${scope}]${detail ? ' ' + detail : ''} — ${reason}`);
}

// Tickers use a very small alphabet: letters, digits, and the dot and hyphen
// that separate exchange suffixes (RELIANCE.NS, BRK-B).
const TICKER_PATTERN = /^[A-Z0-9][A-Z0-9.\-]{0,19}$/;

function readTicker(value) {
  const raw = String(value == null ? '' : value).trim().toUpperCase();
  if (!TICKER_PATTERN.test(raw)) return null;
  if (raw.includes('..') || raw.endsWith('.') || raw.endsWith('-')) return null;
  return raw;
}

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
  // Interest expense as filed, so the reported income statement can carry it
  // on its own line between operating income and pretax income.
  interestExpense: [
    'InterestExpense',
    'InterestExpenseNonoperating',
    'InterestExpenseDebt',
    'InterestAndDebtExpense',
  ],

  cash: [
    'CashAndCashEquivalentsAtCarryingValue',
    'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents',
  ],
  // Marketable securities, split by where they sit on the balance sheet.
  // Short-term securities are money the company can turn into cash on a few
  // days' notice and are part of net debt; long-term ones are fetched to be
  // reported, not netted off (see deriveModel's net debt).
  //
  // The tag lists are ordered by what filers use NOW: a filer that once used
  // AvailableForSaleSecuritiesCurrent may have moved to MarketableSecurities-
  // Current years ago (Apple's last AvailableForSale is 2018), and the
  // earlier-tag-wins rule would otherwise keep reading the stale one.
  shortTermInvestments: [
    'ShortTermInvestments',
    'MarketableSecuritiesCurrent',
    'AvailableForSaleSecuritiesDebtSecuritiesCurrent',
    'AvailableForSaleSecuritiesCurrent',
    'OtherShortTermInvestments',
    'HeldToMaturitySecuritiesCurrent',
  ],
  longTermInvestments: [
    'LongTermInvestments',
    'MarketableSecuritiesNoncurrent',
    'AvailableForSaleSecuritiesDebtSecuritiesNoncurrent',
    'AvailableForSaleSecuritiesNoncurrent',
    'HeldToMaturitySecuritiesNoncurrent',
    'OtherLongTermInvestments',
  ],
  // Securities the filing reports WITHOUT saying how much is current. On its
  // own this says only that securities exist: Dell reports investments of
  // 1,700 and tags no current portion at all. It is evidence, never an amount
  // to net off, and it stops a missing split being read as "none".
  securitiesNotSplit: [
    'MarketableSecurities',
    'AvailableForSaleSecuritiesDebtSecurities',
    'AvailableForSaleSecurities',
    'Investments',
  ],
  receivables: [
    'AccountsReceivableNetCurrent',
    'ReceivablesNetCurrent',
  ],
  inventory: ['InventoryNet'],
  currentAssets: ['AssetsCurrent'],
  // Net property, plant and equipment. Filers that put finance-lease
  // right-of-use assets on the same line renamed the tag, and several did so
  // in their latest year only (Alphabet, Home Depot and Tesla all stopped
  // tagging the plain one after FY2024/25). Where both exist they agree to the
  // million, so this is the same measure under a longer name, not a second
  // basis. Without it the last reported year has no asset base at all, which
  // now refuses the company.
  ppeNet: [
    'PropertyPlantAndEquipmentNet',
    'PropertyPlantAndEquipmentAndFinanceLeaseRightOfUseAssetAfterAccumulatedDepreciationAndAmortization',
  ],
  totalAssets: ['Assets'],
  payables: ['AccountsPayableCurrent'],
  currentLiabilities: ['LiabilitiesCurrent'],
  longTermDebt: [
    'LongTermDebtNoncurrent',
    'LongTermDebt',
    'LongTermNotesPayable',
  ],
  // ---- the rest of the borrowings, and the leases -------------------------
  //
  // These overlap, and the overlaps are where a careless total goes wrong, so
  // each is fetched on its own and deriveModel decides what to add:
  //
  //   LongTermDebt            the WHOLE loan, current portion included
  //                           (Apple 90,678 = 78,328 noncurrent + 12,350
  //                           current). Home Depot tags only this one.
  //   LongTermDebtNoncurrent  the part due after a year, above.
  //   DebtCurrent             every borrowing due within a year, short-term
  //                           borrowings and current maturities together.
  //   LongTermDebtAndCapitalLeaseObligationsCurrent
  //                           the current maturities WITH the current finance
  //                           lease inside them (Home Depot 4,967).
  longTermDebtTotal: ['LongTermDebt'],
  // The noncurrent tag on its own, so the derivation can tell which of the two
  // the `longTermDebt` field above came from: that list falls back to the
  // whole-loan tag, and adding current maturities to a whole loan counts them
  // twice (Home Depot tags no noncurrent figure at all).
  longTermDebtNoncurrent: ['LongTermDebtNoncurrent'],
  // The non-current borrowings WITH the finance leases already inside them.
  // Where a filer gives this, it is the most inclusive figure it publishes and
  // the lease is not added again (Home Depot: 46,341, of which 2,675 leases).
  longTermDebtAndLeaseNoncurrent: ['LongTermDebtAndCapitalLeaseObligations'],
  debtCurrent: ['DebtCurrent'],
  longTermDebtCurrent: ['LongTermDebtCurrent'],
  debtAndLeaseCurrent: ['LongTermDebtAndCapitalLeaseObligationsCurrent'],
  shortTermBorrowings: [
    'ShortTermBorrowings',
    'CommercialPaper',
    'OtherShortTermBorrowings',
    'LinesOfCreditCurrent',
    'ShortTermBankLoansAndNotesPayable',
    'NotesPayableCurrent',
  ],
  // Finance (formerly capital) leases: borrowing to use an asset. Their cost
  // reaches profit as depreciation plus interest, so operating profit carries
  // only the depreciation and the liability is debt.
  financeLeaseCurrent: ['FinanceLeaseLiabilityCurrent', 'CapitalLeaseObligationsCurrent'],
  financeLeaseNoncurrent: ['FinanceLeaseLiabilityNoncurrent', 'CapitalLeaseObligationsNoncurrent'],
  financeLeaseTotal: ['FinanceLeaseLiability'],
  // Operating leases: reported, never netted off. See deriveModel for why.
  operatingLeaseCurrent: ['OperatingLeaseLiabilityCurrent'],
  operatingLeaseNoncurrent: ['OperatingLeaseLiabilityNoncurrent'],
  operatingLeaseTotal: ['OperatingLeaseLiability'],
  // A right-of-use asset with no liability beside it says leases exist and
  // their amount was not tagged: evidence, not an amount.
  financeLeaseRightOfUseAsset: [
    'FinanceLeaseRightOfUseAsset',
    'CapitalLeasedAssetsGross',
  ],
  operatingLeaseRightOfUseAsset: ['OperatingLeaseRightOfUseAsset'],
  totalLiabilities: ['Liabilities'],

  // Goodwill and other intangibles. Needed for TANGIBLE book value, which is
  // book value with the accounting fictions removed: goodwill is the premium
  // paid over the value of what was actually bought, and it is worth nothing
  // in a break-up. Many filers do not tag these at all, and an absent figure
  // must stay absent — treating a missing goodwill line as zero would silently
  // claim the company has none, which is a different statement.
  goodwill: ['Goodwill'],
  intangibles: [
    'IntangibleAssetsNetExcludingGoodwill',
    'FiniteLivedIntangibleAssetsNet',
  ],
  equity: [
    'StockholdersEquity',
    'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest',
  ],

  depreciation: [
    'DepreciationDepletionAndAmortization',
    'DepreciationAmortizationAndAccretionNet',
    'Depreciation',
  ],
  // Depreciation of property, plant & equipment on its own, and amortisation of
  // intangibles on its own, where the filing separates them. The total above
  // mixes the two, and they behave differently: depreciation follows the assets
  // capital spending buys, amortisation runs an acquired intangible pool down.
  // Amazon files 41,860 of depreciation and 817 of amortisation inside 65,756
  // of total D&A.
  depreciationOfPpe: ['Depreciation'],
  // Claims on the group that do not belong to its common shareholders, which
  // the equity bridge deducts from enterprise value. Minority (non-controlling)
  // interests in equity, and the redeemable kind carried outside it; preferred
  // stock, and the preferred dividends that show it exists even where its
  // carrying value is not tagged; the minority share of net income, which shows
  // minority interests exist even where their balance is not tagged; and equity
  // including minority interests, the other half of that balance.
  minorityInterest: ['MinorityInterest'],
  redeemableMinorityInterest: [
    'RedeemableNoncontrollingInterestEquityCarryingAmount',
    'RedeemableNoncontrollingInterestEquityFairValue',
  ],
  preferredStock: [
    'PreferredStockValue',
    'PreferredStockIncludingAdditionalPaidInCapital',
    'PreferredStockIncludingAdditionalPaidInCapitalNetOfDiscount',
    'PreferredStockValueOutstanding',
    'PreferredStockLiquidationPreferenceValue',
  ],
  // Common shares the diluted count already includes for the conversion of
  // preferred stock. Where it is filed, the preferred holders' claim is in the
  // per-share denominator, and taking the preferred off value as well would
  // count it twice (Procter & Gamble: 68.3 million shares).
  preferredConversionShares: ['IncrementalCommonSharesAttributableToConversionOfPreferredStock'],
  preferredDividends: [
    'DividendsPreferredStock',
    'PreferredStockDividendsIncomeStatementImpact',
    'DividendsPreferredStockCash',
  ],
  netIncomeToMinority: [
    'NetIncomeLossAttributableToNoncontrollingInterest',
    'MinorityInterestInNetIncomeLossOfConsolidatedEntities',
  ],
  equityIncludingMinority: ['StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'],
  amortisationOfIntangibles: [
    'AmortizationOfIntangibleAssets',
    'AmortizationOfIntangibleAssetsExcludingGoodwill',
    'FiniteLivedIntangibleAssetsAmortizationExpense',
  ],
  capex: [
    'PaymentsToAcquirePropertyPlantAndEquipment',
    'PaymentsToAcquireProductiveAssets',
  ],
  operatingCashFlow: [
    'NetCashProvidedByUsedInOperatingActivities',
    'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations',
  ],
  // The other two totals of the filed cash flow statement. The reported
  // column of a cash flow statement is meant to be what the company filed,
  // and without these two the model could only rebuild them from the lines it
  // happens to carry — capital expenditure, dividends and buybacks — which
  // leaves out acquisitions, securities, debt raised and repaid, and every
  // other movement (KI-7).
  investingCashFlow: [
    'NetCashProvidedByUsedInInvestingActivities',
    'NetCashProvidedByUsedInInvestingActivitiesContinuingOperations',
  ],
  financingCashFlow: [
    'NetCashProvidedByUsedInFinancingActivities',
    'NetCashProvidedByUsedInFinancingActivitiesContinuingOperations',
  ],
  stockComp: ['ShareBasedCompensation', 'AllocatedShareBasedCompensationExpense'],
  dividendsPaid: [
    'PaymentsOfDividendsCommonStock',
    'PaymentsOfDividends',
    'PaymentsOfDistributionsToAffiliates',
    'PaymentsOfOrdinaryDividends',
  ],
  // Dividends to common shareholders alone. The list above falls back to tags
  // that include preferred dividends (Bank of America 9,563: 8,083 common plus
  // preferred) while others file common only (Wells Fargo), so dividends paid
  // cannot say whose they were; residual income needs the common figure.
  commonDividendsPaid: ['PaymentsOfDividendsCommonStock'],
  buybacks: ['PaymentsForRepurchaseOfCommonStock'],
  dilutedShares: [
    'WeightedAverageNumberOfDilutedSharesOutstanding',
    'WeightedAverageNumberOfSharesOutstandingBasic',
  ],
};

// Pull one line item out of the giant XBRL blob, for the annual periods only.
// Returns an object like { 2023: 383285000000, 2024: 391035000000 }
function extractUSFact(facts, tagList, unitsSeen) {
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
    // The unit a figure is filed in is the filing's own statement of its
    // currency (USD, EUR, CAD...). Recorded so the currency is read from the
    // filing rather than assumed.
    if (unitsSeen) unitsSeen.add(unitKey);

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

/**
 * The date each fiscal year actually ended, per year, read the same way the
 * figures are.
 *
 * The fiscal YEAR is not the period end. Apple's 2025 ended on 27 September,
 * Microsoft's on 30 June, Walmart's on 31 January 2026. Without the date every
 * forecast year-end was assumed to be 31 December, so a non-calendar filer's
 * cash flows were discounted over the wrong period, in the same direction every
 * year.
 *
 * Read from the same tag list, in the same order of preference, so the date
 * belongs to the figure that anchors the year.
 */
function extractPeriodEnds(facts, tagList) {
  const merged = {};
  for (const tag of tagList) {
    const entry = facts['us-gaap']?.[tag];
    if (!entry) continue;
    const unitKey = Object.keys(entry.units || {})[0];
    if (!unitKey) continue;
    const thisTag = {};
    for (const point of entry.units[unitKey]) {
      if (!point.form?.startsWith('10-K') || !point.end) continue;
      if (point.start) {
        const days = (new Date(point.end) - new Date(point.start)) / 86400000;
        if (days < 300 || days > 400) continue;
      }
      const year = Number(point.end.slice(0, 4));
      if (!year) continue;
      thisTag[year] = point.end;
    }
    for (const [year, end] of Object.entries(thisTag)) {
      if (merged[year] === undefined) merged[year] = end;
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
  // A 404 HERE IS AN ANSWER, NOT A FAILURE. The SEC's ticker list carries every
  // registrant, including foreign private issuers that file a 20-F and ADR
  // shells that file nothing but their registration, and the XBRL company-facts
  // API holds none of them: ICICI Bank (20-F), Rio Tinto (20-F) and the ADR
  // registered under CYATY all have a CIK, submissions, and no facts at all.
  // Throwing here took the whole request down with a 502, so the company could
  // not be loaded from anywhere (KI-6). Returning null says "the SEC has
  // nothing for this one" and lets the caller try the other source.
  //
  // A 5xx or a network error still throws: that is the SEC being unavailable
  // rather than empty, and a transient outage must not silently change which
  // source a US filer's figures came from.
  if (res.status === 404) return null;
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
  // Share counts, filed in shares: not money, so they neither vote on the
  // reporting currency nor get divided into millions.
  const SEC_COUNT_FIELDS = new Set(['dilutedShares', 'preferredConversionShares']);
  const extracted = {};
  const monetaryUnits = new Set();
  for (const [field, tags] of Object.entries(US_TAGS)) {
    extracted[field] = extractUSFact(facts, tags, SEC_COUNT_FIELDS.has(field) ? null : monetaryUnits);
  }
  // The currency every monetary figure was filed in, from the XBRL units. A
  // single ISO code is the reporting currency; anything else (no units, mixed
  // currencies) leaves it unestablished, and the model refuses a valuation.
  const filedCurrencies = [...monetaryUnits].filter((u) => /^[A-Z]{3}$/.test(u));
  const reportingCurrency =
    filedCurrencies.length === 1 && filedCurrencies.length === monetaryUnits.size
      ? filedCurrencies[0]
      : null;

  // Which fiscal years do we actually have? Use revenue as the anchor, since a
  // company with no revenue figure is unusable anyway.
  const years = Object.keys(extracted.revenue)
    .map(Number)
    .sort((a, b) => b - a)
    .slice(0, YEARS_WANTED)
    .reverse();

  if (years.length === 0) return null;

  // The date each of those years ended, from the same tags that anchored them.
  const periodEnds = extractPeriodEnds(facts, US_TAGS.revenue);

  const statements = years.map((year) => {
    const row = { fiscalYear: year, periodEnd: periodEnds[year] ?? null };
    for (const field of Object.keys(US_TAGS)) {
      const value = extracted[field][year];
      // Convert to millions — the engine and the Excel model both work in
      // millions, and raw XBRL is in whole currency units.
      row[field] = typeof value === 'number' ? value / 1e6 : null;
    }
    // Share counts must NOT be divided; they are counts, not currency.
    for (const field of SEC_COUNT_FIELDS) {
      const count = extracted[field][year];
      row[field] = typeof count === 'number' ? count : null;
    }
    return row;
  });

  return {
    source: 'SEC EDGAR',
    sourceUrl: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${match.cik}&type=10-K`,
    name: match.name,
    currency: reportingCurrency || 'USD',
    currencySymbol: currencySymbolFor(reportingCurrency || 'USD'),
    currencyEvidence: {
      reportingCurrency,
      reportingCurrencySource: 'the units the SEC XBRL facts are filed in',
      statementCurrencies: [...monetaryUnits].sort(),
    },
    // A 10-K filer's statements count the registered shares that trade under
    // its own ticker, so the share count and the price are for the same security.
    listing: { shareBasis: 'registeredShares' },
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
  interestExpense: 'annualInterestExpense',

  cash: 'annualCashAndCashEquivalents',
  // See the SEC lists above. Yahoo publishes the short-term securities on
  // their own, and cash-plus-short-term-securities as a total, which is used
  // to fill the figure where the first is absent (they agree where both are
  // present: Reliance 1,373,270 + 1,398,850 = 2,772,120).
  shortTermInvestments: 'annualOtherShortTermInvestments',
  cashAndShortTermInvestments: 'annualCashCashEquivalentsAndShortTermInvestments',
  longTermInvestments: 'annualInvestmentsAndAdvances',
  receivables: 'annualAccountsReceivable',
  inventory: 'annualInventory',
  currentAssets: 'annualCurrentAssets',
  ppeNet: 'annualNetPPE',
  totalAssets: 'annualTotalAssets',
  payables: 'annualAccountsPayable',
  currentLiabilities: 'annualCurrentLiabilities',
  longTermDebt: 'annualLongTermDebt',
  // See the SEC lists above. Yahoo publishes debt with and without the lease
  // obligations folded in; under IFRS there is no operating/finance split, so
  // the "AndCapitalLeaseObligation" figures are the whole borrowing.
  currentDebt: 'annualCurrentDebt',
  currentDebtAndLease: 'annualCurrentDebtAndCapitalLeaseObligation',
  longTermDebtAndLease: 'annualLongTermDebtAndCapitalLeaseObligation',
  leaseObligations: 'annualCapitalLeaseObligations',
  totalDebtReported: 'annualTotalDebt',
  totalLiabilities: 'annualTotalLiabilitiesNetMinorityInterest',
  equity: 'annualStockholdersEquity',
  goodwill: 'annualGoodwill',
  intangibles: 'annualOtherIntangibleAssets',

  depreciation: 'annualDepreciationAndAmortization',
  // Yahoo carries depreciation alone for some listings (Tencent 32,799 of
  // 66,028) and repeats the total for others; it publishes no amortisation of
  // intangibles, so that stays null on this path and the model says what it
  // does without it.
  depreciationOfPpe: 'annualDepreciation',
  // See the SEC list above. Yahoo's minority share of net income is signed as
  // a deduction; only whether it is non-zero is used.
  minorityInterest: 'annualMinorityInterest',
  preferredStock: 'annualPreferredStock',
  preferredDividends: 'annualPreferredStockDividends',
  netIncomeToMinority: 'annualMinorityInterests',
  equityIncludingMinority: 'annualTotalEquityGrossMinorityInterest',
  capex: 'annualCapitalExpenditure',
  operatingCashFlow: 'annualOperatingCashFlow',
  investingCashFlow: 'annualInvestingCashFlow',
  financingCashFlow: 'annualFinancingCashFlow',
  dividendsPaid: 'annualCashDividendsPaid',
  commonDividendsPaid: 'annualCommonStockDividendPaid',
  buybacks: 'annualRepurchaseOfCapitalStock',
  stockComp: 'annualStockBasedCompensation',
  dilutedShares: 'annualDilutedAverageShares',
};

// Yahoo reports money leaving the company as a negative number. The engine
// expects these as positive amounts, matching how they appear in the Excel
// model, so their sign gets flipped on the way in.
const OUTFLOW_FIELDS = new Set(['capex', 'dividendsPaid', 'commonDividendsPaid', 'buybacks']);

// Share counts are counts, not currency — they must not be divided into
// millions the way every monetary figure is.
const COUNT_FIELDS = new Set(['dilutedShares']);

async function fetchFromYahoo(symbol) {
  const auth = await getYahooAuth();

  // First call: the company's name, sector, listing and reporting currency.
  // financialData and earnings carry financialCurrency, the currency the
  // statements are in, which is not necessarily the currency the listing trades
  // in (Toyota's New York listing trades in dollars; its statements are in yen).
  let profile = {};
  try {
    const profileRes = await fetch(
      `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
        symbol
      )}?modules=price%2CassetProfile%2CfinancialData%2Cearnings%2CdefaultKeyStatistics&crumb=${encodeURIComponent(auth.crumb)}`,
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
  const periodEnds = {};
  // Every currency code Yahoo stamps on a monetary figure, as a cross-check on
  // financialCurrency.
  const statementCurrencies = new Set();
  for (const [ourName, yahooName] of Object.entries(YAHOO_FIELDS)) {
    byField[ourName] = {};
    const block = series.find((entry) => entry?.meta?.type?.[0] === yahooName);
    for (const point of block?.[yahooName] || []) {
      if (!point?.asOfDate) continue;
      const raw = point.reportedValue?.raw;
      if (typeof raw !== 'number') continue;
      byField[ourName][Number(point.asOfDate.slice(0, 4))] = raw;
      // asOfDate IS the period end date, not just its year. Kept for revenue,
      // which is the field the year list is anchored on, so the forecast is
      // timed from the date the company's year actually ends.
      if (ourName === 'revenue') periodEnds[Number(point.asOfDate.slice(0, 4))] = point.asOfDate;
      if (!COUNT_FIELDS.has(ourName) && typeof point.currencyCode === 'string') {
        statementCurrencies.add(point.currencyCode);
      }
    }
  }

  const years = Object.keys(byField.revenue)
    .map(Number)
    .sort((a, b) => b - a)
    .slice(0, YEARS_WANTED)
    .reverse();

  if (years.length === 0) return null;

  const statements = years.map((year) => {
    const row = { fiscalYear: year, periodEnd: periodEnds[year] ?? null };
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
    // Short-term securities where Yahoo gives only the combined total: the
    // total less cash. Not a guess — the two are the same figure filed twice,
    // and where both are present they agree.
    if (
      row.shortTermInvestments === null &&
      typeof row.cashAndShortTermInvestments === 'number' &&
      typeof row.cash === 'number'
    ) {
      const derived = row.cashAndShortTermInvestments - row.cash;
      row.shortTermInvestments = derived >= 0 ? derived : null;
    }
    return row;
  });

  // The currency the statements are in, as Yahoo states it. Never inferred
  // from the size of the figures and never taken from the listing's price: when
  // Yahoo does not say, it stays null and the model refuses a valuation.
  const reportingCurrency =
    profile.financialData?.financialCurrency || profile.earnings?.financialCurrency || null;
  const count = (v) => (typeof v?.raw === 'number' && v.raw > 0 ? v.raw : null);

  return {
    source: 'Yahoo Finance',
    sourceUrl: `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}`,
    name: profile.price?.longName || profile.price?.shortName || symbol,
    currency: reportingCurrency || 'USD',
    currencySymbol: currencySymbolFor(reportingCurrency || 'USD'),
    currencyEvidence: {
      reportingCurrency,
      reportingCurrencySource: profile.financialData?.financialCurrency
        ? 'Yahoo financialData.financialCurrency'
        : profile.earnings?.financialCurrency
        ? 'Yahoo earnings.financialCurrency'
        : null,
      statementCurrencies: [...statementCurrencies].sort(),
    },
    // What the listing is, so the model can tell whether its price and the
    // statements' share count describe the same security.
    listing: {
      shareBasis: null,
      exchange: profile.price?.exchange || null,
      exchangeName: profile.price?.exchangeName || null,
      market: profile.price?.market || null,
      country: profile.assetProfile?.country || null,
      priceCurrency: profile.price?.currency || null,
      sharesOutstanding:
        count(profile.defaultKeyStatistics?.impliedSharesOutstanding) ??
        count(profile.defaultKeyStatistics?.sharesOutstanding),
    },
    sicCode: null,
    sicDescription: profile.assetProfile?.industry || null,
    sector: profile.assetProfile?.sector || null,
    statements,
  };
}

function currencySymbolFor(code) {
  const map = {
    USD: '$', INR: '₹', EUR: '€', GBP: '£', JPY: '¥', CNY: 'CN¥', HKD: 'HK$',
    CAD: 'CA$', AUD: 'A$', KRW: '₩', TWD: 'NT$', BRL: 'R$',
  };
  return map[code] || (code ? `${code} ` : '$');
}

// Yahoo quotes some markets in a minor unit: London in pence, Johannesburg in
// cents, Tel Aviv in agorot. The price must be brought to the major unit before
// it can be compared with statements, which are always in the major unit.
const MINOR_UNITS = {
  GBp: { currency: 'GBP', factor: 0.01 },
  GBX: { currency: 'GBP', factor: 0.01 },
  ZAc: { currency: 'ZAR', factor: 0.01 },
  ZAC: { currency: 'ZAR', factor: 0.01 },
  ILA: { currency: 'ILS', factor: 0.01 },
};

// The currency a price is quoted in, as an ISO code and the factor that brings
// the quoted figure to it. Null when the code is not one we can read.
function tradingCurrencyOf(code) {
  if (typeof code !== 'string') return null;
  if (MINOR_UNITS[code]) return MINOR_UNITS[code];
  if (/^[A-Z]{3}$/.test(code)) return { currency: code, factor: 1 };
  return null;
}

// One exchange rate from Yahoo's chart endpoint, the same free endpoint the
// price comes from. The pair "GBPUSD=X" is priced in USD per GBP. A rate is
// returned only when Yahoo confirms the pair's quote currency and the rate is
// no more than a week old.
async function fetchExchangeRate(from, to) {
  const pair = `${from}${to}=X`;
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(pair)}?range=5d&interval=1d`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Marginalia/1.0)' } }
    );
    if (!res.ok) return { pair, rate: null, asOf: null, reason: `Yahoo did not answer (${res.status})` };
    const meta = (await res.json())?.chart?.result?.[0]?.meta;
    const rate = meta?.regularMarketPrice;
    const asOf = meta?.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : null;
    if (typeof rate !== 'number' || !isFinite(rate) || rate <= 0) {
      return { pair, rate: null, asOf, reason: 'Yahoo returned no rate' };
    }
    if (meta.currency !== to) {
      return { pair, rate: null, asOf, reason: `the pair is quoted in ${meta.currency}, not ${to}` };
    }
    const ageDays = asOf ? (Date.now() - Date.parse(asOf)) / 86400000 : Infinity;
    if (!(ageDays <= 7)) return { pair, rate: null, asOf, reason: 'the latest rate is more than a week old' };
    return { pair, rate, asOf, reason: null };
  } catch {
    return { pair, rate: null, asOf: null, reason: 'the request failed' };
  }
}

// Put the quote in the currency the statements are in, so that every price on
// the site (the header, the live refresh, the 52-week range, the valuation's
// comparison) is in the same currency as the value it sits beside. The figures
// as quoted are kept alongside, with the rate used. When no rate can be
// fetched the quote is left as quoted and the conversion is marked unavailable;
// the model then refuses a valuation rather than compare different currencies.
async function quoteInReportingCurrency(quote, reportingCurrency) {
  if (!quote) return { quote, conversion: null };
  const trading = tradingCurrencyOf(quote.currency);
  const base = {
    quotedCurrency: quote.currency ?? null,
    tradingCurrency: trading?.currency ?? null,
    minorUnitFactor: trading?.factor ?? null,
    reportingCurrency: reportingCurrency ?? null,
  };
  if (!trading || !reportingCurrency) {
    return {
      quote,
      conversion: {
        ...base, converted: false, rate: null, pair: null, asOf: null,
        reason: trading ? 'the reporting currency is not known' : 'the quote currency could not be read',
      },
    };
  }
  let rate = trading.factor;
  let fx = { pair: null, asOf: null };
  if (trading.currency !== reportingCurrency) {
    fx = await fetchExchangeRate(trading.currency, reportingCurrency);
    if (fx.rate === null) {
      return { quote, conversion: { ...base, converted: false, rate: null, pair: fx.pair, asOf: fx.asOf, reason: fx.reason } };
    }
    rate = trading.factor * fx.rate;
  }
  if (rate === 1) {
    return { quote, conversion: { ...base, converted: false, rate: 1, pair: null, asOf: null, reason: null } };
  }
  const scale = (v) => (typeof v === 'number' && isFinite(v) ? v * rate : v);
  const round2 = (v) => (typeof v === 'number' && isFinite(v) ? Number(v.toFixed(2)) : v);
  return {
    quote: {
      ...quote,
      price: scale(quote.price),
      previousClose: scale(quote.previousClose),
      fiftyTwoWeekHigh: round2(scale(quote.fiftyTwoWeekHigh)),
      fiftyTwoWeekLow: round2(scale(quote.fiftyTwoWeekLow)),
      currency: reportingCurrency,
      asQuoted: {
        currency: quote.currency,
        price: quote.price,
        previousClose: quote.previousClose,
        fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
      },
    },
    conversion: { ...base, converted: true, rate, pair: fx.pair, asOf: fx.asOf, reason: null },
  };
}

// ===========================================================================
// SECTION 2b — COMPANY PROFILE (for the qualitative screen)
// ===========================================================================
// Judging a moat, a management team or a regulatory risk needs more than the
// accounts. This pulls the business description, the industry, the head count
// and the named officers from Yahoo's assetProfile module, which is free and
// covers US filers as well as everything else.
//
// It is strictly best-effort. If it fails the qualitative screen simply shows
// less; nothing else on the site depends on it. And it is never mixed into the
// financial statements: this is descriptive context, not reported figures.
async function fetchProfile(symbol) {
  try {
    const auth = await getYahooAuth();
    const res = await fetch(
      `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
        symbol
      )}?modules=assetProfile%2CsummaryProfile&crumb=${encodeURIComponent(auth.crumb)}`,
      { headers: { ...auth.browserHeaders, Cookie: auth.cookie } }
    );
    if (!res.ok) return null;

    const body = await res.json();
    const result = body?.quoteSummary?.result?.[0] || {};
    const asset = result.assetProfile || result.summaryProfile || {};

    const officers = Array.isArray(asset.companyOfficers)
      ? asset.companyOfficers
          .filter((o) => o && o.name && o.title)
          .slice(0, 8)
          .map((o) => ({
            name: String(o.name),
            title: String(o.title),
          }))
      : [];

    const hasSomething =
      asset.longBusinessSummary || asset.industry || asset.sector || officers.length;
    if (!hasSomething) return null;

    return {
      summary: asset.longBusinessSummary || null,
      industry: asset.industry || null,
      sector: asset.sector || null,
      website: asset.website || null,
      country: asset.country || null,
      employees:
        typeof asset.fullTimeEmployees === 'number' ? asset.fullTimeEmployees : null,
      officers,
    };
  } catch {
    return null;
  }
}

// ===========================================================================
// SECTION 3 — LIVE PRICE (works for every market, no key needed)
// ===========================================================================

// ---------------------------------------------------------------------------
// THE RISK-FREE RATE, PER CURRENCY, FROM THE BODY THAT PUBLISHES IT
// ---------------------------------------------------------------------------
// The first term of the cost of equity. A risk-free rate belongs to a currency:
// discounting a yen cash flow at a US Treasury yield is not an approximation,
// it is a different country's rate.
//
// One vendor's chart endpoint publishes only the US curve, which is what this
// site read at first — but that is a fact about one vendor, not about the data.
// The institutions that set these rates publish them themselves, and four of
// them answer a plain HTTP request with a full daily history:
//
//   USD  US Treasury, daily par yield curve (BC_10YEAR). Public domain as a
//        work of the US government.
//   EUR  European Central Bank Data Portal, euro-area AAA government bond spot
//        rate, 10-year (YC.B.U2.EUR.4F.G_N_A.SV_C_YM.SR_10Y). The ECB allows
//        reuse of its statistics with the source acknowledged.
//   JPY  Japan's Ministry of Finance, JGB daily interest rates, 10Y column,
//        published back to 1974. Japanese government standard terms of use,
//        which permit free reuse with attribution.
//   GBP  Bank of England, IADB series IUDMNZC, daily 10-year nominal par yield.
//        The Bank permits reuse of its statistical data with acknowledgement.
//   SEK  Sveriges Riksbank SWEA API, SEGVB10YC, daily 10-year government
//        benchmark. Published as open data.
//
// Checked and fetched on 2026-09-27; each returned a complete year for a window
// ending eighteen months in the past, which is what this model asks of it.
//
// WHAT IS STILL MISSING, and why each company stays refused: no reachable
// publisher was found for the Indian rupee, the Korean won, the new Taiwan
// dollar, the renminbi or the Danish krone. India is the sharpest case and is
// set out in DATA_CONSTRAINTS.md: the published Indian benchmark is FBIL's, a
// licensed commercial benchmark, and the Reserve Bank republishes only its
// latest observations on a page that carries no history, while the Bank's own
// historical database does not answer from outside India.
//
// THE TEN-YEAR, not the thirty. The rate is added to a market risk premium, and
// an equity risk premium is quoted against the ten-year benchmark by
// convention; pairing a thirty-year yield with a premium measured against the
// ten would be the inconsistency CONVENTIONS.md's horizon test is about.
//
// AN AVERAGE OVER A YEAR, NOT A CLOSE, and the window ENDS AT THE VALUATION
// DATE — the last reported balance sheet date, which is what everything else in
// the model is struck at. One day's close would make every valuation move with
// one day's bond market; a window anchored to the filing means the same filings
// give the same rate for ever.
const RISK_FREE_WINDOW_DAYS = 365;

const ymd = (d) => d.toISOString().slice(0, 10);
const asRate = (v) => {
  const n = Number(v);
  return typeof n === 'number' && isFinite(n) ? n : null;
};

// Each source returns [{ date: 'YYYY-MM-DD', percent: number }] covering at
// least the window asked for. Anything it cannot answer, it throws.
const RISK_FREE_SOURCES = {
  USD: {
    name: '10-year US Treasury par yield',
    publisher: 'US Treasury',
    terms: 'a work of the US government, in the public domain',
    url: 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve',
    async read(from, to) {
      const years = [];
      for (let y = from.getUTCFullYear(); y <= to.getUTCFullYear(); y++) years.push(y);
      const out = [];
      for (const year of years) {
        const res = await fetch(
          'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml' +
            `?data=daily_treasury_yield_curve&field_tdr_date_value=${year}`,
          { headers: { 'User-Agent': SEC_CONTACT } }
        );
        if (!res.ok) throw new Error(`Treasury ${year} ${res.status}`);
        const xml = await res.text();
        const dates = [...xml.matchAll(/<d:NEW_DATE[^>]*>([^<]+)</g)].map((m) => m[1].slice(0, 10));
        const tens = [...xml.matchAll(/<d:BC_10YEAR[^>]*>([^<]*)</g)].map((m) => asRate(m[1]));
        dates.forEach((date, i) => {
          if (tens[i] !== null) out.push({ date, percent: tens[i] });
        });
      }
      return out;
    },
  },

  EUR: {
    name: '10-year euro area AAA government bond spot rate',
    publisher: 'European Central Bank',
    terms: 'ECB statistics, reusable with the source acknowledged',
    url: 'https://data.ecb.europa.eu/data/datasets/YC',
    async read(from, to) {
      const res = await fetch(
        'https://data-api.ecb.europa.eu/service/data/YC/B.U2.EUR.4F.G_N_A.SV_C_YM.SR_10Y' +
          `?startPeriod=${ymd(from)}&endPeriod=${ymd(to)}&format=csvdata`,
        { headers: { 'User-Agent': SEC_CONTACT } }
      );
      if (!res.ok) throw new Error(`ECB ${res.status}`);
      const lines = (await res.text()).trim().split('\n');
      const head = lines[0].split(',');
      const dateAt = head.indexOf('TIME_PERIOD');
      const valueAt = head.indexOf('OBS_VALUE');
      if (dateAt < 0 || valueAt < 0) throw new Error('ECB: no TIME_PERIOD/OBS_VALUE column');
      const out = [];
      for (const line of lines.slice(1)) {
        const cells = line.split(',');
        const percent = asRate(cells[valueAt]);
        if (percent !== null) out.push({ date: String(cells[dateAt]).slice(0, 10), percent });
      }
      return out;
    },
  },

  JPY: {
    name: '10-year Japanese government bond yield',
    publisher: 'Ministry of Finance, Japan',
    terms: 'Japanese government standard terms of use, free reuse with attribution',
    url: 'https://www.mof.go.jp/english/policy/jgbs/reference/interest_rate/',
    async read() {
      // The archive runs from 1974; the current year sits in its own file.
      const out = [];
      for (const file of ['historical/jgbcme_all.csv', 'jgbcme.csv']) {
        const res = await fetch(
          `https://www.mof.go.jp/english/policy/jgbs/reference/interest_rate/${file}`,
          { headers: { 'User-Agent': SEC_CONTACT } }
        );
        if (!res.ok) continue;
        const lines = (await res.text()).trim().split('\n');
        const header = lines.findIndex((l) => l.startsWith('Date,'));
        if (header < 0) continue;
        const tenAt = lines[header].split(',').findIndex((c) => c.trim() === '10Y');
        if (tenAt < 0) continue;
        for (const line of lines.slice(header + 1)) {
          const cells = line.split(',');
          const percent = asRate(cells[tenAt]);
          const parts = String(cells[0]).trim().split('/');
          if (percent === null || parts.length !== 3) continue;
          const date = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
          out.push({ date, percent });
        }
      }
      if (!out.length) throw new Error('MOF: no rows');
      return out;
    },
  },

  GBP: {
    name: '10-year UK government bond nominal par yield',
    publisher: 'Bank of England',
    terms: 'Bank of England statistics, reusable with acknowledgement',
    url: 'https://www.bankofengland.co.uk/boeapps/database/',
    async read(from, to) {
      const uk = (d) =>
        `${String(d.getUTCDate()).padStart(2, '0')}/${
          ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]
        }/${d.getUTCFullYear()}`;
      const res = await fetch(
        'https://www.bankofengland.co.uk/boeapps/iadb/fromshowcolumns.asp?csv.x=yes' +
          `&Datefrom=${uk(from)}&Dateto=${uk(to)}&SeriesCodes=IUDMNZC&CSVF=TN&UsingCodes=Y&VPD=Y&VFD=N`,
        { headers: { 'User-Agent': SEC_CONTACT } }
      );
      if (!res.ok) throw new Error(`BoE ${res.status}`);
      const lines = (await res.text()).trim().split('\n');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const out = [];
      for (const line of lines.slice(1)) {
        const [rawDate, rawValue] = line.split(',');
        const percent = asRate(rawValue);
        const bits = String(rawDate).trim().split(' ');
        if (percent === null || bits.length !== 3) continue;
        const month = months.indexOf(bits[1]);
        if (month < 0) continue;
        out.push({
          date: `${bits[2]}-${String(month + 1).padStart(2, '0')}-${bits[0].padStart(2, '0')}`,
          percent,
        });
      }
      return out;
    },
  },

  SEK: {
    name: '10-year Swedish government benchmark bond yield',
    publisher: 'Sveriges Riksbank',
    terms: 'Riksbank open data',
    url: 'https://www.riksbank.se/en-gb/statistics/',
    async read(from, to) {
      const res = await fetch(
        `https://api.riksbank.se/swea/v1/Observations/SEGVB10YC/${ymd(from)}/${ymd(to)}`,
        { headers: { 'User-Agent': SEC_CONTACT, Accept: 'application/json' } }
      );
      if (!res.ok) throw new Error(`Riksbank ${res.status}`);
      const body = await res.json();
      if (!Array.isArray(body)) throw new Error('Riksbank: not a list');
      return body
        .map((row) => ({ date: String(row.date).slice(0, 10), percent: asRate(row.value) }))
        .filter((row) => row.percent !== null);
    },
  },
};

async function fetchRiskFreeRate(reportingCurrency, valuationDate) {
  const spec = RISK_FREE_SOURCES[reportingCurrency];
  if (!spec) {
    return {
      rate: null,
      currency: reportingCurrency || null,
      reason:
        `No publisher of a ten-year government bond yield for ${reportingCurrency || 'this currency'} could be ` +
        `reached. A US Treasury yield is not the risk-free rate for a ${reportingCurrency || 'non-dollar'} cash flow.`,
    };
  }

  const end = valuationDate ? new Date(`${valuationDate}T00:00:00Z`) : new Date();
  const start = new Date(end.getTime() - RISK_FREE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  try {
    const all = await spec.read(start, end);
    const from = ymd(start);
    const to = ymd(end);
    const window = all.filter((row) => row.date >= from && row.date <= to);
    if (window.length < 30) throw new Error(`only ${window.length} observations in the window`);
    window.sort((a, b) => (a.date < b.date ? -1 : 1));
    const mean = window.reduce((t, row) => t + row.percent, 0) / window.length;
    return {
      rate: mean / 100,
      currency: reportingCurrency,
      name: spec.name,
      publisher: spec.publisher,
      terms: spec.terms,
      sourceUrl: spec.url,
      tenorYears: 10,
      observations: window.length,
      windowFrom: window[0].date,
      windowTo: window[window.length - 1].date,
      latest: window[window.length - 1].percent / 100,
      reason: null,
    };
  } catch (error) {
    // NEVER A SILENT CONSTANT. A rate that could not be fetched is absent, and
    // the engine says so rather than discounting at a number nobody chose.
    return {
      rate: null,
      currency: reportingCurrency,
      publisher: spec.publisher,
      reason: `The ${spec.name} could not be fetched from the ${spec.publisher} (${String(error.message).slice(0, 60)}).`,
    };
  }
}

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

// WHAT SHAPE THIS FETCHER BUILDS. It must equal PAYLOAD_VERSION in
// src/data/payloadVersion.ts, which explains what each number means and when to
// bump it. The two are separate constants on purpose: each file in this
// directory is packaged on its own by the host, and a shared import that fails
// to bundle takes the whole route down. They are compared at runtime instead.
const FETCHER_VERSION = 4;

export default async function handler(req, res) {
  if (!guardRequest(req, res)) return;

  const raw = readTicker(req.query.ticker);

  if (!raw) {
    noStore(res);
    res.status(400).json({ error: 'Provide a valid ticker, for example ?ticker=AAPL' });
    return;
  }

  try {
    let data = null;
    // What was asked, in order, so a company that cannot be found says which
    // sources were tried rather than showing a blank page (KI-6).
    const tried = [];

    // A ticker containing a dot and a suffix (RELIANCE.NS, BP.L) is a foreign
    // listing and will never be in the SEC's list, so skip straight to Yahoo.
    const looksForeign = /\.[A-Z]{1,3}$/.test(raw);

    if (!looksForeign) {
      tried.push('the SEC\'s XBRL company facts');
      data = await fetchFromSEC(raw);
    }

    // Not a US filer, or the SEC had nothing usable — fall back to Yahoo. A
    // company that files a 20-F reaches this point with a CIK and no facts,
    // and is modelled from the other source with that source's own provenance,
    // currency evidence and listing, which the engine gates on exactly as it
    // does for any other non-SEC company.
    if (!data) {
      tried.push('Yahoo Finance');
      data = await fetchFromYahoo(raw);
      if (data && !looksForeign) {
        // Say where it came from and why, so a reader is never left to wonder
        // why a US-listed company's figures are not the SEC's.
        data.sourceNote =
          `The SEC's XBRL company facts hold no financial data for ${raw} — a foreign private issuer files a 20-F, ` +
          `and an ADR registration files no statements at all — so these figures come from Yahoo Finance.`;
      }
    }

    if (!data) {
      noStore(res);
      res.status(404).json({
        error:
          `No financial statements found for ${raw}. Tried ${tried.join(' and ')}. ` +
          'Check the spelling — foreign listings need a suffix, for example RELIANCE.NS for India or BP.L for London.',
      });
      return;
    }

    // Price and profile in parallel: neither depends on the other, and the
    // profile must never hold up the page if Yahoo is slow.
    // The valuation date: the last reported balance sheet date, which is what
    // the discounting and the equity bridge are struck at.
    const lastPeriodEnd =
      [...(data.statements || [])].reverse().find((r) => r?.periodEnd)?.periodEnd ?? null;

    const [quotedPrice, profile, riskFree] = await Promise.all([
      fetchQuote(raw),
      fetchProfile(raw).catch(() => null),
      fetchRiskFreeRate(data.currencyEvidence?.reportingCurrency ?? null, lastPeriodEnd),
    ]);
    data.riskFree = riskFree;
    const { quote, conversion } = await quoteInReportingCurrency(
      quotedPrice,
      data.currencyEvidence?.reportingCurrency ?? null
    );
    data.priceConversion = conversion;

    // Cache for six hours. Financial statements change four times a year, so
    // this is generous, and it keeps us far inside every free tier.
    //
    // THE VERSION IS PART OF THE URL the caller asked for, so a cache can only
    // ever answer for the shape it was filled with (KI-15). Before this, the
    // key was the ticker alone: for six hours after any change to what is
    // fetched, code expecting a new field was served a payload built before it
    // existed and read the field as absent. `Vary` is set as well, so a proxy
    // keying on something other than the query string cannot cross the streams
    // either.
    res.setHeader(
      'Cache-Control',
      'public, s-maxage=21600, stale-while-revalidate=86400'
    );
    res.setHeader('Vary', 'Accept-Encoding');

    // What the caller asked for, if it said. A caller from before this was
    // tracked sends nothing, and gets an answer stamped with the truth.
    const asked = Number(req.query.v);

    res.status(200).json({
      ticker: raw,
      ...data,
      quote,
      profile,
      // The shape this answer is in. The reader compares it with the shape it
      // knows how to read and says so if they differ, rather than treating a
      // missing field as a reported absence.
      fetcherVersion: FETCHER_VERSION,
      fetcherVersionAsked: Number.isFinite(asked) ? asked : null,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    // The upstream reason can name internal hosts and query strings, so it is
    // logged for you and never returned to the caller.
    logAndHide('company', error, raw);
    noStore(res);
    res.status(502).json({
      error:
        'Could not retrieve data for that ticker right now. The filing source did not answer. Please try again shortly.',
    });
  }
}