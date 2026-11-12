// The revenue definition, shared with the base-rate builder (job D1). A
// SIBLING in `api/`, never `src/`: a file here is packaged on its own and
// an import reaching into `src/` takes the route down.
import {
  FINANCIAL_REVENUE_TAGS,
  TOTAL_REVENUE_FIRST,
  annualYearsOf,
  annualFiguresOf,
} from './_revenueDefinition.js';
// Re-exported because `verify/scenarios.mts` asks `company.js` for the order
// it actually used, and should keep asking the thing under test.
export { TOTAL_REVENUE_FIRST, FINANCIAL_REVENUE_TAGS } from './_revenueDefinition.js';

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

// The same test the engine uses for the bank template
// (`src/data/residualIncome.js`, `isFinancialCompany`), minus the sector
// field, which the profile supplies and the profile is fetched after this
// runs. Every SEC filer carries a SIC code, so for the companies this decides
// anything about the two tests agree. Deliberately a second copy: each file
// in `api/` is packaged on its own by the host and a shared import there
// takes the route down, which is the same reason `payloadVersion.ts` exists.
function filerIsFinancial(sicCode, sicDescription) {
  const sic = sicCode != null ? Number(sicCode) : null;
  if (sic != null && sic >= 6000 && sic <= 6799) return true;
  return /financ|bank|insur|capital market|credit/i.test(String(sicDescription || ''));
}



/**
 * WHICH TAG IS THIS COMPANY'S TOP LINE (`KI-39`).
 *
 * The revenue tags were read in order of preference and the first one present
 * won: `RevenueFromContractWithCustomerExcludingAssessedTax`, then the
 * including-assessed-tax form, then `Revenues`, then `SalesRevenueNet`. For
 * most filers the first of those IS the top line. For a company whose revenue
 * is not all revenue from contracts with customers — a pipeline selling
 * commodities, a utility with regulated and unregulated streams — it is a
 * COMPONENT of the top line, and the filing's own total sits in `Revenues`,
 * further down the list, where nothing read it.
 *
 * Measured on 2026-11-04: Enbridge's FY2021 revenue read **19,432** where its
 * own 10-K files `Revenues` of **47,071** — 59% short. It was found by the new
 * "other operating items" row, because the cost of sales alone then exceeded
 * the revenue being shown.
 *
 * THE RULE IS THE TAG THAT MEANS "TOTAL REVENUE", not the largest figure.
 *
 * I WROTE IT AS THE LARGEST FIRST, on the reasoning that a component cannot
 * exceed the total it is part of, and the measurement disproved it on the same
 * afternoon. Mastercard tags its GROSS revenue — before the rebates and
 * incentives it pays out — under the contract-revenue tag, and its NET revenue,
 * which is the top line of its income statement, under `Revenues`: 29,845
 * against 18,884 in FY2021. The larger figure there is not the top line, it is
 * the line above two deductions. "Largest" would have published it.
 *
 * So the order is the one US GAAP's own definitions give. `Revenues` is the
 * total revenue line as presented; `SalesRevenueNet` is what a filer that has
 * not moved to ASC 606 calls the same thing; the two contract-revenue tags are
 * revenue FROM CONTRACTS WITH CUSTOMERS, which is the whole of the top line for
 * most companies and a component of it for a pipeline selling commodities. The
 * first of those a filer tags, and that reaches its latest reported year, is its
 * top line — and every candidate's figure is recorded beside it so the choice
 * can be read rather than trusted.
 *
 * `KI-32` settled this question for FINANCIAL companies on 2026-11-01, where the
 * answer is `RevenuesNetOfInterestExpense` where it is tagged, for the same
 * reason: it is the line the filer puts on the face of its income statement,
 * and it is SMALLER than the gross revenue above it. That path is untouched;
 * this one is every other company.
 */
// EXPORTED so `npm run verify` reads this order rather than keeping a second
// copy of it. A check with its own list stops checking the rule the day the
// rule changes.

function topLineTag(facts, candidates) {
  const considered = candidates
    .map((tag) => ({ tag, figures: annualFiguresOf(facts, tag) }))
    .filter((c) => c.figures.size > 0);
  if (!considered.length) return null;

  const latest = Math.max(...considered.flatMap((c) => [...c.figures.keys()]));
  const atLatest = considered.filter((c) => c.figures.has(latest));
  if (!atLatest.length) return null;

  // THE FIRST TAG THAT MEANS "TOTAL REVENUE" AND REACHES THE LATEST YEAR. The
  // order is `TOTAL_REVENUE_FIRST`, not the order the extraction reads fields
  // in, and not the size of the figure.
  const chosen =
    TOTAL_REVENUE_FIRST.map((tag) => atLatest.find((c) => c.tag === tag)).find(Boolean) || atLatest[0];

  const figureOf = (c) => c.figures.get(latest)?.val ?? null;
  const total = figureOf(chosen);
  // HOW EVERY OTHER CANDIDATE DIFFERS FROM THE ONE CHOSEN, in the latest year.
  // Positive where the other tag is SMALLER — a component of the top line;
  // negative where it is LARGER — a gross figure above a deduction. Both are
  // facts about the filing, and the payload carries them so the choice can be
  // read rather than trusted.
  const shortfall = atLatest
    .filter((c) => c.tag !== chosen.tag && total)
    .map((c) => ({
      tag: c.tag,
      figure: figureOf(c),
      shortOfTotalPct: Number((((total - figureOf(c)) / total) * 100).toFixed(2)),
    }));

  return {
    tag: chosen.tag,
    latestYear: latest,
    years: [...chosen.figures.keys()].sort((a, b) => a - b),
    basis:
      'total revenue as the filer reports it: `Revenues` where it is tagged, `SalesRevenueNet` for a ' +
      'filer that has not moved to ASC 606, and revenue from contracts with customers otherwise — one ' +
      'tag for the whole series, chosen by what the tag MEANS rather than by the size of the figure ' +
      '(`KI-39`)',
    considered: considered.map((c) => ({
      tag: c.tag,
      years: c.figures.size,
      reachesLatest: c.figures.has(latest),
      figureAtLatest: figureOf(c),
    })),
    shortfall,
  };
}

/**
 * Which revenue tag a financial company’s top line is read from, and the
 * record of how that was decided. Returns null where no candidate carries an
 * annual figure at all, and the caller then falls back to the ordinary list.
 */
function financialRevenueTag(facts) {
  const considered = FINANCIAL_REVENUE_TAGS.map((tag) => ({ tag, years: annualYearsOf(facts, tag) })).filter(
    (c) => c.years.size > 0
  );
  if (!considered.length) return null;
  const latest = Math.max(...considered.flatMap((c) => [...c.years]));
  const chosen = considered.find((c) => c.years.has(latest));
  if (!chosen) return null;
  return {
    tag: chosen.tag,
    latestYear: latest,
    years: [...chosen.years].sort((a, b) => a - b),
    basis:
      'total revenue as the filer reports it on the face of its income statement: ' +
      '`RevenuesNetOfInterestExpense` where it is tagged, `Revenues` otherwise, and one tag for the ' +
      'whole series',
    considered: considered.map((c) => ({
      tag: c.tag,
      years: c.years.size,
      reachesLatest: c.years.has(latest),
    })),
  };
}

// EXPORTED so that `npm run verify` can hold the evidence sheet's own copy of
// this list against it. `src/data/financials.ts` cannot import from here —
// each file in `api/` is packaged on its own by the host and a shared import
// there has taken the route down — so the sheet keeps a mirror, and a mirror
// nobody checks goes stale. It had: the sheet named one concept for stock
// compensation where this list has two, one for depreciation where this has
// three, and so on, so a figure read from the second tag was reported as read
// from a list that did not contain it.
export const US_TAGS = {
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

// WHAT SCALE A FILER TAGS ITS SHARE COUNTS IN, SETTLED AGAINST ITS OWN COVER
// PAGE (`KI-30`).
//
// An XBRL fact in the `shares` unit is meant to be an absolute count, and all
// but a handful of registrants file one. McDonald's does not: its 10-K tags
// `WeightedAverageNumberOfDilutedSharesOutstanding` as **716.4**, the figure as
// it appears in a statement headed "in millions". Nothing downstream could tell
// that from a company with 716 shares in issue, so the derivation divided it by
// a million again and McDonald's market capitalisation came out as 0.18 against
// borrowings of 43,848 — an equity weight of 0.0004% and a WACC that was its
// cost of debt alone.
//
// The filing settles it itself. Every cover page asks for the number of shares
// outstanding, and the answer is tagged `dei:EntityCommonStockSharesOutstanding`
// — an absolute count from every registrant, McDonald's included: 710,398,642 on
// its 10-K cover against the 716.4 inside. The MOST RECENT such fact is used,
// from whichever filing carries it, so McDonald's settles against the 707,641,531
// on its latest 10-Q; the ratio only has to establish an order of magnitude and
// the form it came from is recorded beside it.
//
// The ratio can only be a power of a thousand: anything else is a different
// question (a second share class, a year of buybacks) and is left alone and
// recorded rather than guessed at.
function coverPageShares(facts) {
  const points = facts?.dei?.EntityCommonStockSharesOutstanding?.units?.shares;
  if (!Array.isArray(points)) return null;
  let best = null;
  for (const p of points) {
    if (typeof p.val !== 'number' || !isFinite(p.val) || p.val <= 0 || !p.end) continue;
    if (!best || p.end > best.end) best = p;
  }
  return best ? { count: best.val, asOf: best.end, form: best.form || null } : null;
}

// A fifth either way: wide enough for a year of buybacks between the cover date
// and the fiscal year end, and nowhere near the thousand that separates one
// scale from the next.
const SHARE_SCALE_BAND = 0.2;

function shareCountScale(cover, filed) {
  if (!cover || typeof filed !== 'number' || !isFinite(filed) || filed <= 0) return null;
  const ratio = cover.count / filed;
  for (const factor of [1, 1e3, 1e6]) {
    if (Math.abs(ratio / factor - 1) <= SHARE_SCALE_BAND) {
      return {
        factor,
        ratio,
        coverCount: cover.count,
        coverAsOf: cover.asOf,
        coverForm: cover.form,
        filedAs: filed,
      };
    }
  }
  // Neither a scale nor a near match: reported as it stands, and said so.
  return {
    factor: 1,
    ratio,
    coverCount: cover.count,
    coverAsOf: cover.asOf,
    coverForm: cover.form,
    filedAs: filed,
    unexplained: true,
  };
}

// ---------------------------------------------------------------------------
// A SHARE COUNT FILED BEFORE A SPLIT (`KI-31`)
// ---------------------------------------------------------------------------
//
// The share count comes from a filing; the price comes from today. A stock
// split between the two breaks the pair, and nothing in the figures shows it:
// a split leaves no trace in an income statement. Amphenol split 2 for 1 on
// 2026-09-03 and CrowdStrike 4 for 1 on 2026-07-02, both after their last
// annual report, so Amphenol’s market capitalisation came out as half what it
// is and its value per share as 89.58 against 43.99 — a 45% overvaluation
// reported as a 13% undervaluation.
//
// A SPLIT IS NOT A PROPERTY OF A COMPANY, IT IS A PROPERTY OF A FIGURE. Each
// share count is on the basis of whatever was true when it was filed, and a
// filer restates its comparatives at the next report. Amphenol’s own data says
// so: the quarter to 2023-09-30, filed 2024-10-25, carries 1,244,100,000, and
// the quarter to 2026-09-30, filed 2026-10-30, carries 2,582,900,000. So the
// factor applied to a figure is the product of the splits that fall AFTER the
// date that figure was filed — which puts every year of share-count history on
// today’s basis, and not only the latest.
//
// AND A SPLIT ON A PRICE LINE IS NOT ALWAYS A SPLIT AT THE COMPANY. Yahoo
// reports an ADR ratio change as a split, and a ratio change does not alter
// the issuer’s share count at all: AstraZeneca shows a "1:2 split" on
// 2026-02-02, and its 1,562,000,000 shares are unchanged by it. Halving them
// would have put a correct market capitalisation out by half.
//
// So the event supplies the factor and the date, and an INDEPENDENTLY REPORTED
// COUNT OF SHARES OUTSTANDING decides whether it applies to the issuer: the
// event is applied only where the adjusted count agrees with that independent
// count and the filed count does not. On Amphenol the filed 1,277,500,000 is
// 1.93 times its cover page and the adjusted 2,555,000,000 is 0.97 of it, so it
// applies; on AstraZeneca the filed count is already 0.99 of the shares
// outstanding its source reports and the adjusted one would be 1.99, so it does
// not. Where neither agrees, or both do, nothing is adjusted and the reason is
// recorded — refuse rather than approximate.

const isFiniteNum = (v) => typeof v === 'number' && isFinite(v);

/**
 * The split events on a chart response, oldest first.
 *
 * Yahoo gives `numerator` and `denominator` the way the market says them: a
 * 2-for-1 is 2/1, so the share count multiplies by 2, and a 1-for-10 reverse
 * split is 1/10. A ratio of exactly 1 is not an event and is dropped.
 */
function splitsFrom(result) {
  const raw = result?.events?.splits;
  if (!raw || typeof raw !== 'object') return [];
  const out = [];
  for (const key of Object.keys(raw)) {
    const s = raw[key];
    const numerator = Number(s?.numerator);
    const denominator = Number(s?.denominator);
    const stamp = Number(s?.date);
    if (!isFiniteNum(numerator) || !isFiniteNum(denominator)) continue;
    if (numerator <= 0 || denominator <= 0 || !isFiniteNum(stamp)) continue;
    const ratio = numerator / denominator;
    if (!isFiniteNum(ratio) || ratio <= 0 || ratio === 1) continue;
    out.push({
      date: new Date(stamp * 1000).toISOString().slice(0, 10),
      ratio,
      numerator,
      denominator,
      label: splitWords(numerator, denominator),
      asQuoted: typeof s.splitRatio === 'string' ? s.splitRatio : null,
    });
  }
  out.sort((a, b) => (a.date < b.date ? -1 : 1));
  return out;
}

/** "a 2-for-1 split", "a 1-for-10 reverse split" — words, not a ratio. */
function splitWords(numerator, denominator) {
  const tidy = (n) => (Number.isInteger(n) ? String(n) : String(Number(n.toFixed(4))));
  return numerator > denominator
    ? `${tidy(numerator / denominator)}-for-1 split`
    : `1-for-${tidy(denominator / numerator)} reverse split`;
}

/** The product of every split after a date, with the events that made it. */
function splitFactorAfter(splits, since) {
  const out = { factor: 1, events: [] };
  if (!Array.isArray(splits) || !since) return out;
  const at = String(since).slice(0, 10);
  for (const s of splits) {
    if (s.date > at) {
      out.factor *= s.ratio;
      out.events.push(s);
    }
  }
  return out;
}

// The same fifth either way as the scale band, and for the same reason: an
// independent count is dated differently from a filed one, so buybacks,
// issuance and the difference between a point-in-time count and a weighted
// average all sit inside it — while the thing being told apart is a factor of
// two or more.
const SPLIT_RECONCILE_BAND = 0.2;

const agrees = (count, independent) =>
  isFiniteNum(count) &&
  count > 0 &&
  isFiniteNum(independent) &&
  independent > 0 &&
  Math.abs(independent / count - 1) <= SPLIT_RECONCILE_BAND;

/**
 * The best independently reported count of shares outstanding, and where it
 * came from. In order of preference:
 *
 *   1. the filing’s own cover page (`dei:EntityCommonStockSharesOutstanding`),
 *      which is a count of shares in issue on a stated date;
 *   2. the latest quarterly diluted count, which an SEC filer restates for a
 *      split at its next report, so a quarter filed after one is already on the
 *      new basis — and ONLY where the quarter carries the date it was filed,
 *      because that date is the whole of what makes it interpretable. A
 *      quarterly count with no filing date cannot be placed on one side of a
 *      split or the other, and on the vendor path it is not even reliably on
 *      the same basis as the annual series it sits beside: HDFC Bank's quarter
 *      to 2025-06-30 reports 2,565,958,018 against an annual 5,106,289,404 for
 *      the year that ended three months earlier. Taking that as the arbiter
 *      made a company whose count is fine look unsettleable;
 *   3. the shares outstanding the vendor reports for the listing, which is all
 *      there is for a company whose statements do not come from the SEC, and
 *      which is at least the same kind of figure: a count on a date.
 */
function independentShareCount(data) {
  const cover = data?.shareScale;
  if (cover && isFiniteNum(cover.coverCount) && cover.coverCount > 0) {
    return {
      count: cover.coverCount,
      asOf: cover.coverAsOf ?? null,
      source: `the cover page of its ${cover.coverForm || 'filing'}`,
    };
  }
  const quarters = Array.isArray(data?.quarters) ? data.quarters : [];
  for (let i = quarters.length - 1; i >= 0; i--) {
    const q = quarters[i];
    const count = q?.values?.dilutedShares;
    if (!q?.filing?.filed) continue;
    if (isFiniteNum(count) && count > 0) {
      return {
        count,
        asOf: q.periodEnd ?? null,
        source: `its own quarter to ${q.periodEnd}, filed ${q.filing.filed}`,
      };
    }
  }
  const listed = data?.listing?.sharesOutstanding;
  if (isFiniteNum(listed) && listed > 0) {
    return { count: listed, asOf: null, source: 'the shares outstanding its data source reports for the listing' };
  }
  return null;
}

// Every share count in a payload, annual and quarterly. Named here so the
// adjustment cannot miss one that is added later without the check noticing.
const SHARE_COUNT_FIELDS = ['dilutedShares', 'basicShares', 'preferredConversionShares'];

/**
 * Puts every share count on today’s basis, or says why it did not.
 *
 * Mutates `data.statements` and `data.quarters` and returns the record that
 * goes on the payload. Returns null only where there is nothing to say: no
 * split events at all.
 */
function applySplitAdjustment(data, splits) {
  const events = Array.isArray(splits) ? splits : [];
  const rows = Array.isArray(data?.statements) ? data.statements : [];
  if (!events.length || !rows.length) return null;

  const source = 'Yahoo Finance (chart, events=split)';
  // The date a figure is on the basis of: when it was FILED where the filing
  // says (SEC), and otherwise the end of the period it covers, which is the
  // best a vendor feed gives and is weaker — a figure published months after
  // its period end may already be on the new basis.
  const filedAt = data?.shareCountFiledAt || null;
  const basis = filedAt ? 'the date each count was filed' : 'the end of the period each count covers';
  const sinceFor = (field, row) =>
    filedAt?.[field]?.[row.fiscalYear] ??
    row.periodEnd ??
    (row.fiscalYear ? `${row.fiscalYear}-12-31` : null);

  // THE LATEST COUNT DECIDES, because it is the one every weight, every
  // multiple and every value per share is struck on.
  const latestRow = [...rows].reverse().find((r) => isFiniteNum(r?.dilutedShares) && r.dilutedShares > 0);
  const record = { source, events, basis, applied: false, factor: 1, appliedEvents: [], reason: null };
  if (!latestRow) {
    record.reason = 'no share count is reported in any year, so there is nothing to adjust';
    return record;
  }

  const latest = splitFactorAfter(events, sinceFor('dilutedShares', latestRow));
  record.filedCount = latestRow.dilutedShares;
  record.filedFor = latestRow.fiscalYear ?? null;
  record.filedAsOf = sinceFor('dilutedShares', latestRow);
  if (latest.factor === 1) {
    record.reason = 'every split on record falls before the figures this model is built on, so they already carry it';
    return record;
  }

  const independent = independentShareCount(data);
  const adjusted = latestRow.dilutedShares * latest.factor;
  record.adjustedCount = adjusted;
  record.independent = independent;
  const filedAgrees = agrees(latestRow.dilutedShares, independent?.count);
  const adjustedAgrees = agrees(adjusted, independent?.count);

  if (!independent) {
    record.reason =
      'there is no independently reported count of shares outstanding to settle it against, and a ' +
      'split on a price line is not always a split at the company';
    return record;
  }
  if (filedAgrees && !adjustedAgrees) {
    record.reason =
      `the count as filed already agrees with ${independent.source}, so either this event did not ` +
      `change the issuer’s share count — which is what an ADR ratio change looks like on a price ` +
      `line — or the figures already carry it, which is what the vendor feed does: it restates its ` +
      `own share-count history for a split`;
    return record;
  }
  if (!adjustedAgrees) {
    record.reason =
      `neither the filed count nor the adjusted one agrees with ${independent.source}, so what ` +
      `the event means for this company cannot be settled from the data`;
    return record;
  }
  if (filedAgrees && adjustedAgrees) {
    record.reason =
      `both the filed count and the adjusted one agree with ${independent.source}, so the event ` +
      `cannot be settled either way`;
    return record;
  }

  // APPLIED, field by field and year by year.
  record.applied = true;
  record.factor = latest.factor;
  record.appliedEvents = latest.events;
  const byYear = {};
  for (const row of rows) {
    for (const field of SHARE_COUNT_FIELDS) {
      if (!isFiniteNum(row[field]) || row[field] === 0) continue;
      const f = splitFactorAfter(events, sinceFor(field, row));
      if (f.factor === 1) continue;
      row[field] *= f.factor;
      if (field === 'dilutedShares') byYear[row.fiscalYear] = f.factor;
    }
  }
  // AND THE QUARTERS, each on the basis of the filing that reported it. A
  // derived quarter is a difference of two filings, so it is on the basis of
  // the later one.
  let quartersMoved = 0;
  for (const q of Array.isArray(data?.quarters) ? data.quarters : []) {
    const dates = [q?.filing?.filed, ...(Array.isArray(q?.derivedFrom) ? q.derivedFrom.map((d) => d?.filed) : [])]
      .filter(Boolean)
      .sort();
    const since = dates.at(-1) ?? q?.periodEnd ?? null;
    const f = splitFactorAfter(events, since);
    if (f.factor === 1) continue;
    for (const field of SHARE_COUNT_FIELDS) {
      if (!q?.values || !isFiniteNum(q.values[field]) || q.values[field] === 0) continue;
      q.values[field] *= f.factor;
      if (field === 'dilutedShares') quartersMoved++;
    }
  }
  record.factorByYear = byYear;
  record.quartersAdjusted = quartersMoved;

  // AND THE SCALE RECORD IS RE-READ, because `KI-30`’s cover-page ratio was
  // struck against the count as filed and that count has just moved. Left
  // alone it would go on reporting Amphenol as 1.93 times its own cover page
  // when it is now 0.97 of it.
  if (data?.shareScale && isFiniteNum(data.shareScale.coverCount)) {
    const ratio = data.shareScale.coverCount / (latestRow.dilutedShares || 1);
    data.shareScale.ratio = ratio;
    data.shareScale.filedAs = latestRow.dilutedShares;
    data.shareScale.splitAdjusted = true;
    if (Math.abs(ratio - 1) <= SHARE_SCALE_BAND) delete data.shareScale.unexplained;
  }
  return record;
}

// Pull one line item out of the giant XBRL blob, for the annual periods only.
// Returns an object like { 2023: 383285000000, 2024: 391035000000 }
//
// `provOut`, where one is passed, is filled with the PROVENANCE OF EACH YEAR'S
// FIGURE: `{ concept, accn, form, filed }`, straight off the fact that won.
// Until 2026-11-03 the only thing recorded was the filed date of a share
// count, and the evidence sheet named a LIST of candidate concepts with the
// sentence "which one this company used is not recorded in the data we hold" —
// which was true, and is the thing this removes. The concept is a property of
// the figure and not of the line: one company's revenue is `Revenues` and the
// next company's is `RevenueFromContractWithCustomerExcludingAssessedTax`, and
// the same company can change concept between two years.
//
// `unit`, where one is given, is the only unit read. Until 2026-11-03 this took
// `Object.keys(entry.units)[0]` — whichever currency happened to come first in
// the JSON — and ADDED IT TO THE SET THAT DECIDED THE REPORTING CURRENCY, even
// for a tag no figure was taken from. Three companies were refused a valuation
// by that: PepsiCo (EUR beside USD), Enbridge and Welltower (CAD beside USD),
// each of which reports in dollars and files a borrowing in another currency.
// Worse than the refusal, where the stray unit came first the FIGURE was read
// in it and divided into millions as though it were the reporting currency.
function extractUSFact(facts, tagList, unitsSeen, provOut, unit = null) {
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

    // THE UNIT THE CALLER ASKED FOR, or the tag's own where it asked for none
    // (a share count, whose unit is `shares`). A tag that does not carry the
    // reporting currency at all contributes nothing rather than contributing
    // its own currency.
    const unitKey = unit && entry.units?.[unit] ? unit : unit ? null : Object.keys(entry.units || {})[0];
    if (!unitKey) continue;
    // The unit a figure is filed in is the filing's own statement of its
    // currency (USD, EUR, CAD...). Recorded so the currency is read from the
    // filing rather than assumed.
    if (unitsSeen) unitsSeen.add(unitKey);

    // Collect this tag's figures on their own first.
    const thisTag = {};
    // WHERE EACH FIGURE CAME FROM, recorded alongside it and never used to
    // choose between figures — the order of preference above is unchanged.
    // `KI-31` needs the filed date, because a share count is on the basis of
    // whatever was true when it was filed, so a split after that date is not
    // in it yet. The accession number, the form and the concept are what the
    // evidence sheet needs to open the one document the figure is in.
    const thisTagProv = {};

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
      thisTagProv[year] = {
        concept: tag,
        accn: point.accn || null,
        form: point.form || null,
        filed: point.filed || null,
        unit: unitKey,
      };
    }

    // Now fold into the result, never displacing a preferred tag's figure.
    for (const [year, value] of Object.entries(thisTag)) {
      if (merged[year] === undefined) {
        merged[year] = value;
        if (provOut) provOut[year] = thisTagProv[year] ?? null;
      }
    }
  }

  return merged;
}

/**
 * THE REPORTING CURRENCY, READ OFF THE MAIN STATEMENT TOTALS.
 *
 * The three lines every set of statements has and no reader would call a
 * detail: the top line, total assets and the bottom line. A company's
 * reporting currency is the currency ITS OWN PRIMARY STATEMENTS are presented
 * in, and those three are the primary statements in miniature — revenue from
 * the income statement, total assets from the balance sheet, net income tying
 * the two.
 *
 * WHAT IT DELIBERATELY DOES NOT LOOK AT is every other monetary fact in the
 * filing. A US filer with a euro bond tags that bond in euros; a Canadian
 * subsidiary's balances are tagged in Canadian dollars. Those are facts in the
 * filing and they are not the currency the statements are presented in, and
 * treating them as a vote is what refused PepsiCo, Enbridge and Welltower.
 *
 * It returns `{ currency, evidence }`. `currency` is null only where the main
 * totals GENUINELY DISAGREE — a filer that presents revenue in one currency
 * and total assets in another, or that changed presentation currency inside
 * the years held — and the evidence says which line and which year said what,
 * so a refusal can be read rather than guessed at.
 */
const MAIN_TOTAL_FIELDS = ['revenue', 'totalAssets', 'netIncome'];

function reportingCurrencyOf(facts, tagsFor) {
  const isCurrency = (u) => /^[A-Z]{3}$/.test(String(u || ''));
  const byField = {};
  const found = new Set();

  for (const field of MAIN_TOTAL_FIELDS) {
    const perYear = {};
    for (const tag of tagsFor(field)) {
      const entry = facts['us-gaap']?.[tag];
      if (!entry) continue;
      for (const [unitKey, points] of Object.entries(entry.units || {})) {
        if (!isCurrency(unitKey)) continue;
        for (const point of points || []) {
          if (!point.form?.startsWith('10-K') || !point.end) continue;
          if (point.start) {
            const days = (new Date(point.end) - new Date(point.start)) / 86400000;
            if (days < 300 || days > 400) continue;
          }
          const year = Number(point.end.slice(0, 4));
          if (!year) continue;
          // THE PREFERRED TAG'S ANSWER FOR THAT YEAR, which is the same order
          // of preference the figures themselves are read in — so the currency
          // belongs to the figure that will be shown.
          const held = perYear[year];
          if (held && held.tag !== tag) continue;
          // AND WITHIN ONE TAG AND ONE YEAR, THE MOST RECENTLY FILED POINT.
          // A main total can itself carry a point in a second currency, and
          // collecting every unit a main-total tag mentions would be the same
          // mistake one level down: one stray fact against revenue would
          // refuse the company exactly as one against a bond used to. The
          // currency is the currency of the FIGURE THAT WILL BE SHOWN, so it
          // is settled per year, the way the figure is.
          if (held && String(point.filed || '') < String(held.filed || '')) continue;
          perYear[year] = { unit: unitKey, tag, filed: point.filed || null };
        }
      }
    }
    byField[field] = perYear;
    for (const at of Object.values(perYear)) found.add(at.unit);
  }

  const currencies = [...found].sort();
  const disagreements = [];
  if (currencies.length > 1) {
    for (const field of MAIN_TOTAL_FIELDS) {
      for (const [year, at] of Object.entries(byField[field] || {})) {
        disagreements.push(`${field} FY${year} in ${at.unit}`);
      }
    }
  }

  return {
    currency: currencies.length === 1 ? currencies[0] : null,
    evidence: {
      mainTotals: MAIN_TOTAL_FIELDS,
      mainTotalCurrencies: currencies,
      // Only where there is something to explain, because a list of every
      // year's currency on every company is noise that hides the one case
      // that matters.
      ...(currencies.length === 1 ? {} : { mainTotalsDisagree: disagreements.sort() }),
    },
  };
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

// ---------------------------------------------------------------------------
// QUARTERS, AND THE ONE RULE THAT MAKES THEM HONEST
// ---------------------------------------------------------------------------
//
// `docs/FINANCIALS_SPEC.md` rule 4: a discrete quarter is Q2 = H1 − Q1,
// Q3 = 9M − H1, Q4 = FY − 9M, and a cash flow quarter is YTD − prior YTD.
// Every one of those is the same subtraction — **this period’s cumulative
// figure less the previous period’s** — so there is one rule here rather than
// four, and Q4 = FY − 9M is not a special case but the last turn of it.
//
// THE FAILURE THIS GUARDS AGAINST, measured on Apple’s own facts on
// 2026-10-25: of its operating cash flow points filed on a 10-Q, the Q2 one
// spans 181 days and the Q3 one 272 — they are the half year and the nine
// months, cumulative from the start of the fiscal year, not quarters. A reader
// shown 81,754 as "Q3 cash flow" would be reading nine months of cash as three.
// So a point is only ever taken as a quarter when its own span says it is one:
// 80 to 100 days, measured from its start and end dates, never from its `fp`
// label or from the form it was filed on.
//
// AND A DERIVED QUARTER CARRIES BOTH FILINGS. It is the difference between two
// documents, so one link would be half the provenance; `derivedFrom` holds the
// pair, newest first, and `npm run verify` fails if a derived figure ever
// carries fewer than two.

// Screener shows thirteen: three years of seasonality plus the quarter a reader
// is actually looking at.
const QUARTERS_WANTED = 13;

// The lines the Financials tab shows, which is what the quarters are for. Not
// all 46: a quarterly payload of every field would roughly double what is
// stored to carry lines no screen reads.
const QUARTER_FIELDS = [
  'revenue', 'cogs', 'rnd', 'sga', 'operatingIncome', 'pretaxIncome', 'taxExpense', 'netIncome',
  'interestExpense', 'cash', 'shortTermInvestments', 'receivables', 'inventory', 'currentAssets',
  'ppeNet', 'goodwill', 'intangibles', 'totalAssets', 'payables', 'currentLiabilities', 'longTermDebt',
  'totalLiabilities', 'equity', 'minorityInterest', 'operatingCashFlow', 'capex', 'investingCashFlow',
  'financingCashFlow', 'depreciation', 'stockComp', 'dividendsPaid', 'buybacks', 'dilutedShares',
];

// THE ONES THAT ADD UP OVER A YEAR, which is not most of them.
//
// Only a flow can be reconciled against the year: four quarter-end cash
// balances added together are four times the cash, and a weighted average
// share count averages rather than sums. Reconciling those too deleted every
// balance sheet figure from every quarter of every completed year — 5,168
// field-years of them, measured before this list existed, and the quarterly
// balance sheet was empty for anything but the year in progress.
const QUARTER_FLOW_FIELDS = new Set([
  'revenue', 'cogs', 'rnd', 'sga', 'operatingIncome', 'pretaxIncome', 'taxExpense', 'netIncome',
  'interestExpense', 'operatingCashFlow', 'capex', 'investingCashFlow', 'financingCashFlow',
  'depreciation', 'stockComp', 'dividendsPaid', 'buybacks',
]);

// AND THE ONES THAT ARE A PERIOD BUT STILL DO NOT SUBTRACT (`KI-33`).
//
// `QUARTER_FLOW_FIELDS` above says which fields can be RECONCILED against the
// year. This says something narrower and more dangerous to get wrong: which
// fields may be DERIVED by taking one cumulative figure away from another.
//
// A weighted-average share count spans a period, so XBRL files it the way it
// files revenue and the subtraction Q4 = FY - 9M reaches it. But an average
// is not a sum: the average over a year is not the four quarterly averages
// added up, and the difference between a year and nine months of it is not
// the fourth quarter of anything. Because the two averages are close, the
// difference is usually NEGATIVE — Amphenol's quarter to 2025-12-31 came out
// at -1,270,100,000 shares, and 159 figures across 68 companies were at or
// below zero when this was measured on 2026-11-01.
//
// There is no honest way to work one out, so there is no figure: the quarter
// carries the count the company filed for it, or it is not reported. That is
// standing decision 3, and it is the whole of the fix.
//
// Earnings per share would belong here too and is not fetched at all — no EPS
// tag is read, annually or quarterly, and the per-share figures on the
// overview are divided out of ANNUAL rows that carry both halves from one
// filing. Named here so that adding EPS later lands on this list rather than
// rediscovering the arithmetic.
const NOT_ADDITIVE = new Set(['dilutedShares', 'basicShares', 'preferredConversionShares']);

const daySpan = (start, end) => Math.round((new Date(end) - new Date(start)) / 86400000);
const near = (a, b, slack) => Math.abs(a - b) <= slack;

/** Where a filing can be read, from its accession number. */
const filingRef = (cik, point) =>
  point && point.accn
    ? {
        accn: point.accn,
        form: point.form || null,
        filed: point.filed || null,
        url: `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${String(point.accn).replace(/-/g, '')}/`,
      }
    : null;

/**
 * Every point of one tag list, split into the two shapes XBRL facts come in.
 *
 * A FLOW spans a period and is keyed by both its dates, because the same end
 * date carries a quarter, a half year and a full year, and telling them apart
 * is the whole job. A STOCK is a moment and is keyed by its date alone.
 *
 * Within one key the most recently FILED point wins, so a restatement
 * supersedes what it restated; across tags the earlier tag in the list wins,
 * which is the same order of preference the annual path uses.
 *
 * AND ONLY FROM A FORM A STATEMENT IS FILED ON (`KI-36`). The annual path has
 * always taken 10-K facts and nothing else; this path filtered by PERIOD and
 * not by form at all, and the "most recently filed point wins" rule then let
 * any later document that happened to tag the same period supersede the 10-Q
 * it was reported in. A proxy statement does tag financial facts, and a proxy
 * filed in April 2026 is more recent than every filing it reports on, so 126
 * quarterly figures across 34 companies were being cited to a `DEF 14A` or an
 * `8-K`. A figure's own quarter is reported in a 10-Q, and the fourth in the
 * 10-K; those two forms and their amendments are where a statement is, so
 * those are the only forms a figure may be taken from.
 */
export const STATEMENT_FORM = /^10-[KQ]/;

// Exported for `verify/scenarios.mts`, which feeds it the shape of facts a
// proxy statement produces and checks that the 10-Q wins and the proxy is not
// read at all. The alternative is asserting the rule over the payloads on
// disk, and after the fix there is no proxy-sourced figure left on disk to
// find: a check that can only pass is the trap this repository keeps falling
// into, so the filter is exercised on facts written for it.
export function collectPoints(facts, tagList) {
  const flows = new Map();
  const stocks = new Map();
  for (const tag of tagList) {
    const entry = facts['us-gaap']?.[tag];
    if (!entry) continue;
    const unitKey = Object.keys(entry.units || {})[0];
    if (!unitKey) continue;
    for (const point of entry.units[unitKey] || []) {
      if (!point?.end) continue;
      // An unrecorded form is not a statement either. The annual path has read
      // it this way since the beginning: a fact that cannot name the form it
      // was filed on cannot be cited to one.
      if (!STATEMENT_FORM.test(String(point.form || ''))) continue;
      const map = point.start ? flows : stocks;
      const key = point.start ? `${point.start}|${point.end}` : point.end;
      const held = map.get(key);
      // A later filing of the same period supersedes an earlier one; a later
      // TAG never displaces an earlier one, so a key already held by a
      // preferred tag is left alone.
      if (held && held.tag !== tag) continue;
      if (!held || String(point.filed || '') >= String(held.filed || '')) {
        map.set(key, { ...point, tag });
      }
    }
  }
  return { flows, stocks };
}

/**
 * The reporting calendar: which periods this company actually filed.
 *
 * Read off the revenue points rather than taken from `fp` and `fy`, which
 * describe the FILING rather than the figure — the same trap the annual path's
 * comment warns about. A fiscal year is a span of about 365 days; the periods
 * inside it are the cumulative spans that start on the same day it does.
 */
function reportingCalendar(flows) {
  const years = [];
  for (const point of flows.values()) {
    const days = daySpan(point.start, point.end);
    if (days >= 300 && days <= 400) years.push({ start: point.start, end: point.end, days });
  }
  years.sort((a, b) => (a.end < b.end ? -1 : 1));

  const periods = [];
  const addYear = (start, end, fiscalYear) => {
    // Every cumulative period of this year: the ones that begin where it begins.
    const cumulative = [...flows.values()]
      .filter((p) => near(daySpan(p.start, start), 0, 5) && (!end || p.end <= end))
      .sort((a, b) => (a.end < b.end ? -1 : 1));
    const ends = [...new Set(cumulative.map((p) => p.end))];
    if (end && !ends.includes(end)) ends.push(end);
    ends.sort();
    ends.forEach((at, i) => {
      periods.push({
        fiscalYearEnd: end,
        fiscalYearStart: start,
        fiscalYear,
        end: at,
        index: i + 1,
        of: ends.length,
        previousEnd: i > 0 ? ends[i - 1] : null,
        cumulativeDays: daySpan(start, at),
      });
    });
  };

  for (const year of years) addYear(year.start, year.end, Number(year.end.slice(0, 4)));

  // THE YEAR THAT HAS NOT ENDED YET, which is the one a reader is waiting for.
  //
  // Measured on Apple on 2026-10-25: the SEC held three quarters of its FY2026
  // and this function dropped all three, because it only built periods inside
  // a COMPLETED fiscal year and FY2026 has no year-long span yet. The cost is
  // not three columns — it is the whole point of a trailing twelve months,
  // which exists to run past the last year end rather than stop at it.
  //
  // The unfinished year is found the same way as a finished one: by the
  // cumulative spans that begin the day after the last year ended.
  const last = years[years.length - 1];
  if (last) {
    const nextStart = [...flows.values()]
      .map((p) => p.start)
      .filter((start) => start > last.end && daySpan(last.end, start) <= 10)
      .sort()[0];
    if (nextStart) {
      // Its year end is a year away and has not happened, so the label comes
      // from where the year is going rather than from where it stopped.
      const projected = new Date(new Date(nextStart).getTime() + 350 * 86400000)
        .toISOString()
        .slice(0, 10);
      addYear(nextStart, null, Number(projected.slice(0, 4)));
    }
  }

  return periods;
}

/**
 * One field's figure for one period: reported where the company filed that
 * exact period, derived where it has to be worked out, and absent otherwise.
 *
 * Never a cumulative figure wearing a quarter’s label.
 */
function quarterValue(field, period, points, cik, wantMonths) {
  const { flows, stocks } = points;

  // A BALANCE IS A MOMENT. It is whatever was filed at that date, and it is
  // never derived, never summed and never carried from another date.
  if (stocks.size && !flows.size) {
    const at = stocks.get(period.end);
    if (!at) return null;
    return { value: at.val, state: 'reported', concept: at.tag, filing: filingRef(cik, at) };
  }

  const wantDays = wantMonths * 30.4;
  const slack = wantMonths === 3 ? 12 : 20;

  // 1. FILED AS THIS PERIOD, with its own start and end saying so.
  for (const point of flows.values()) {
    if (point.end !== period.end) continue;
    if (!near(daySpan(point.start, point.end), wantDays, slack)) continue;
    return { value: point.val, state: 'reported', concept: point.tag, filing: filingRef(cik, point) };
  }

  // 2. THE DIFFERENCE OF TWO CUMULATIVE FIGURES, which is rule 4 in one line:
  //    Q2 = H1 − Q1, Q3 = 9M − H1, Q4 = FY − 9M, and a cash flow quarter is
  //    this year-to-date less the last one.
  if (wantMonths === 3 && period.previousEnd && !NOT_ADDITIVE.has(field)) {
    const now = flows.get(`${period.fiscalYearStart}|${period.end}`);
    const before = flows.get(`${period.fiscalYearStart}|${period.previousEnd}`);
    // BOTH ENDS OF THE SUBTRACTION MUST BE THE SAME LINE. A company that files
    // `NetIncomeLoss` for nine months and `ProfitLoss` for the year is filing
    // two different measures, and the difference between them is not a
    // quarter — it is the gap between two definitions. Measured on Arista on
    // 2026-10-26: mixing them put its Q4 net income at −2,556 against a year
    // of 2,852. Where the tags differ this declines rather than subtracting.
    if (now && before && now.tag !== before.tag) return null;
    if (now && before) {
      return {
        value: now.val - before.val,
        state: 'derived',
        // BOTH ENDS ARE THE SAME CONCEPT, checked two lines above, so the
        // subtraction has one concept rather than a pair of them.
        concept: now.tag,
        derivedFrom: [filingRef(cik, now), filingRef(cik, before)],
        from: [now.end, before.end],
      };
    }
  }

  // 3. NOTHING THAT CAN BE SAID HONESTLY.
  return null;
}

/**
 * The quarters and half-years this company filed, newest last.
 *
 * Both are kept because both are filed: a US filer’s Q2 10-Q reports the six
 * months cumulatively as well as the quarter, and India files its balance sheet
 * and cash flow only at the half year and the year end (rule 5). A period that
 * no field can fill is dropped rather than carried as a row of dashes.
 */
// What the reconciliation above threw away, for the fetcher to report. A
// module-level list because it is a diagnostic, not part of any answer.
const quarterlyDropped = [];

// `shareScale` is the factor the cover page settled for this filer's share
// counts (`KI-30`); the quarters carry the same counts and must carry the same
// correction, or a quarterly share count disagrees with the annual one beside
// it by a million.
function extractQuarterlySEC(facts, cik, countFields, annualRows, shareScale = 1, revenueTags = US_TAGS.revenue) {
  // THE SAME TOP LINE THE YEARS WERE READ FROM (KI-32). The quarterly calendar
  // is anchored on revenue too, so a bank whose years come from
  // RevenuesNetOfInterestExpense and whose quarters came from Revenues would
  // have had a calendar that stopped years before its own statements.
  const anchor = collectPoints(facts, revenueTags);
  const calendar = reportingCalendar(anchor.flows);
  if (!calendar.length) return [];

  const byField = {};
  for (const field of QUARTER_FIELDS) {
    const tags = field === 'revenue' ? revenueTags : US_TAGS[field];
    if (tags) byField[field] = collectPoints(facts, tags);
  }

  const rows = [];
  for (const period of calendar) {
    for (const months of [3, 6]) {
      // A half year is only a period in its own right at the half way point.
      if (months === 6 && !near(period.cumulativeDays, 183, 25)) continue;
      // AND A QUARTER IS THREE MONTHS LONGER THAN THE REPORTING DATE BEFORE
      // IT. Not simply "a reporting date inside the year": a company that
      // files nothing between its year ends has one reporting date a year, and
      // measuring from the start of the year made its FULL YEAR the first
      // quarter — BlackRock's "Q1" came out 364 days long. The increment is
      // what makes a quarter a quarter, so the increment is what is checked.
      let incrementDays = null;
      if (months === 3) {
        incrementDays = period.previousEnd
          ? daySpan(period.previousEnd, period.end)
          : period.cumulativeDays;
        // 76 TO 120 DAYS, which is wide on purpose. A 52/53-week filer divides
        // its year 12, 12, 12 and 16 weeks, so Costco’s fourth quarter runs
        // 112 days and is a quarter in every sense that matters. A window
        // tight enough to exclude it silently gave that company three quarters
        // a year and no fourth. What this still cannot be mistaken for is a
        // cumulative figure: a half year is 181 days and nine months 272, both
        // far outside. Rule 9 asks for an unusual length to be LABELLED rather
        // than hidden, so the length travels with the row.
        if (incrementDays < 76 || incrementDays > 120) continue;
      }

      const values = {};
      const states = {};
      const derivedFrom = {};
      // PER FIGURE, NOT PER PERIOD. One 10-Q is the document behind most of a
      // quarter's lines, but not all of them: a line restated in a later
      // filing is read from that later filing, and a derived quarter is the
      // difference of two. The row-level `filing` below is kept for the code
      // that already reads it, and this is what the evidence sheet uses.
      const evidence = {};
      // EVERY DOCUMENT ANY OF THIS PERIOD'S FIGURES WAS READ FROM, so the
      // payload's `filings` dictionary can be complete. `filing` below is only
      // the FIRST field's document, and a line restated in a later filing is
      // read from that later one, so a dictionary built from `filing` alone
      // would be missing the document some figures point at.
      const docs = [];
      const noteDoc = (ref) => {
        if (ref?.accn && !docs.some((d) => d.accn === ref.accn)) docs.push(ref);
      };
      let filing = null;
      for (const field of QUARTER_FIELDS) {
        const points = byField[field];
        if (!points) continue;
        const got = quarterValue(field, period, points, cik, months);
        if (!got || typeof got.value !== 'number' || !isFinite(got.value)) continue;
        values[field] = countFields.has(field) ? got.value * shareScale : got.value / 1e6;
        if (got.state !== 'reported') states[field] = got.state;
        if (got.derivedFrom) derivedFrom[field] = got.derivedFrom.filter(Boolean);
        // `{ concept, accn }`, the same shape the annual rows use. The form
        // and the filing date live once in `filings`, keyed by this accession
        // number, rather than four times beside four figures of one filing —
        // two copies of one fact is how the two come to disagree.
        const refs = got.filing ? [got.filing] : (got.derivedFrom || []).filter(Boolean);
        for (const ref of refs) noteDoc(ref);
        evidence[field] = {
          concept: got.concept || null,
          accn: refs[0]?.accn || null,
        };
        if (!filing && got.filing) filing = got.filing;
      }
      if (!Object.keys(values).length) continue;

      rows.push({
        periodEnd: period.end,
        periodStart:
          months === 3 && period.previousEnd
            ? new Date(new Date(period.previousEnd).getTime() + 86400000).toISOString().slice(0, 10)
            : period.fiscalYearStart,
        fiscalYear: period.fiscalYear,
        fiscalPeriod: months === 6 ? 'H1' : `Q${period.index}`,
        months,
        ...(incrementDays ? { days: incrementDays } : {}),
        values,
        ...(Object.keys(states).length ? { states } : {}),
        ...(Object.keys(derivedFrom).length ? { derivedFrom } : {}),
        ...(Object.keys(evidence).length ? { evidence } : {}),
        ...(docs.length ? { docs } : {}),
        ...(filing ? { filing } : {}),
      });
    }
  }

  // THE QUARTERS MUST ADD UP TO THE YEAR BESIDE THEM, OR THEY ARE NOT SHOWN.
  //
  // Both tables are on one screen, and a reader adding four quarters and
  // getting a different number from the year above them is right to stop
  // trusting the page. Where the two disagree we do not know which is wrong,
  // so the honest answer is the one standing decision 3 gives: refuse rather
  // than approximate. The field is dropped for that year and shows as not
  // reported, and the year keeps its own figure.
  //
  // The disagreements are real and they are the filings’ own: a company can
  // tag nine months under one concept and the year under another, restate one
  // and not the other, or change concept mid-history.
  const dropped = [];
  for (const year of annualRows || []) {
    const four = rows.filter((r) => r.months === 3 && r.fiscalYear === year.fiscalYear);
    if (four.length !== 4) continue;
    for (const field of QUARTER_FIELDS) {
      if (!QUARTER_FLOW_FIELDS.has(field)) continue;
      const parts = four.map((r) => r.values[field]);
      if (parts.some((v) => typeof v !== 'number')) continue;
      const whole = year[field];
      if (typeof whole !== 'number' || whole === 0) continue;
      const sum = parts.reduce((t, v) => t + v, 0);
      if (Math.abs(sum - whole) > Math.abs(whole) * 0.001 + 1) {
        for (const r of four) {
          delete r.values[field];
          if (r.states) delete r.states[field];
          if (r.derivedFrom) delete r.derivedFrom[field];
          if (r.evidence) delete r.evidence[field];
        }
        dropped.push(`${year.fiscalYear}:${field}`);
      }
    }
  }
  if (dropped.length) quarterlyDropped.push(...dropped);

  rows.sort((a, b) => (a.periodEnd < b.periodEnd ? -1 : a.periodEnd > b.periodEnd ? 1 : a.months - b.months));
  // The latest thirteen quarters, and any half-years that fall inside them.
  const quarters = rows.filter((r) => r.months === 3).slice(-QUARTERS_WANTED);
  const from = quarters.length ? quarters[0].periodEnd : '0000-00-00';
  return rows.filter((r) => r.periodEnd >= from);
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
  // WHERE EVERY ANNUAL FIGURE CAME FROM: the concept it was read from, and the
  // accession number, form and filed date of the one document it is in. Every
  // field, not only the share counts — the share counts' filed dates
  // (`KI-31`) are now read out of this rather than collected separately.
  const annualProv = {};
  // WHICH REVENUE TAG THIS COMPANY'S TOP LINE IS READ FROM (`KI-32`). For a
  // financial company it is chosen rather than taken in order, and the choice
  // is recorded, because the tag decides which fiscal years exist at all.
  const financial = filerIsFinancial(sicCode, sicDescription);
  // EVERY COMPANY SETTLES ITS OWN TOP LINE. A financial company by the rule
  // `KI-32` established (the line on the face of its income statement); every
  // other by the filing's own arithmetic (`KI-39`, `topLineTag` above).
  const revenueDefinition = financial
    ? financialRevenueTag(facts)
    : topLineTag(facts, US_TAGS.revenue);
  const revenueTags = revenueDefinition ? [revenueDefinition.tag] : US_TAGS.revenue;
  const tagsFor = (field) => (field === 'revenue' ? revenueTags : US_TAGS[field]);

  // THE REPORTING CURRENCY FIRST, FROM THE MAIN STATEMENT TOTALS, because
  // every other monetary figure is then read in that currency and in no other.
  const reportingRead = reportingCurrencyOf(facts, tagsFor);
  const reportingCurrency = reportingRead.currency;

  for (const field of Object.keys(US_TAGS)) {
    const isCount = SEC_COUNT_FIELDS.has(field);
    annualProv[field] = {};
    extracted[field] = extractUSFact(
      facts,
      tagsFor(field),
      isCount ? null : monetaryUnits,
      annualProv[field],
      isCount ? null : reportingCurrency
    );
  }
  // WHAT THE FILING HOLDS IN SOME OTHER CURRENCY, so the evidence can say so.
  // Read separately and never used as a figure: a euro bond in a dollar
  // filer's statements is a fact about the bond, not about the statements.
  const otherCurrencies = new Set();
  if (reportingCurrency) {
    for (const field of Object.keys(US_TAGS)) {
      if (SEC_COUNT_FIELDS.has(field)) continue;
      for (const tag of tagsFor(field) || []) {
        for (const unitKey of Object.keys(facts['us-gaap']?.[tag]?.units || {})) {
          if (/^[A-Z]{3}$/.test(unitKey) && unitKey !== reportingCurrency) otherCurrencies.add(unitKey);
        }
      }
    }
  }
  // `KI-31` reads this, and it used to be collected by a second pass of its
  // own. One source for it, so the date beside a share count is the date on
  // the document the count was read from and cannot drift from it.
  const countFiledAt = {};
  for (const field of SEC_COUNT_FIELDS) {
    countFiledAt[field] = {};
    for (const [year, prov] of Object.entries(annualProv[field] || {})) {
      countFiledAt[field][year] = prov?.filed ?? null;
    }
  }
  // Every unit a figure was actually TAKEN in, which after the change above
  // is the reporting currency and nothing else. Kept as a check on that: if a
  // figure were ever read in a second currency this set would hold two, and
  // `npm run verify` fails on it.
  const takenCurrencies = [...monetaryUnits].filter((u) => /^[A-Z]{3}$/.test(u)).sort();

  // Which fiscal years do we actually have? Use revenue as the anchor, since a
  // company with no revenue figure is unusable anyway.
  const years = Object.keys(extracted.revenue)
    .map(Number)
    .sort((a, b) => b - a)
    .slice(0, YEARS_WANTED)
    .reverse();

  if (years.length === 0) return null;

  // THE SCALE THE SHARE COUNTS ARE IN, read off the filing's own cover page and
  // settled on the most recent year that reports one (`KI-30`). The same factor
  // applies to every year and to the quarters, because a filer tags one way.
  const cover = coverPageShares(facts);
  const latestFiled = years
    .map((y) => extracted.dilutedShares[y])
    .filter((v) => typeof v === 'number' && isFinite(v) && v > 0)
    .at(-1) ?? null;
  const shareScaleRecord = shareCountScale(cover, latestFiled);
  const shareScale = shareScaleRecord ? shareScaleRecord.factor : 1;

  // The date each of those years ended, from the same tags that anchored them.
  const periodEnds = extractPeriodEnds(facts, revenueTags);

  // EVERY DOCUMENT ANY FIGURE POINTS AT, once, keyed by its accession number.
  //
  // The quarters are noted after they are built, below, because the
  // reconciliation that drops a field it cannot tie to the year runs inside
  // `extractQuarterlySEC` and a document noted before it would be a document
  // nothing points at.
  // A dictionary rather than a copy beside every figure: one 10-K is the
  // document behind thirty-odd lines of one year, and thirty copies of the
  // same four strings is thirty chances for them to disagree.
  const filings = {};
  const noteFiling = (prov) => {
    if (!prov?.accn || filings[prov.accn]) return;
    filings[prov.accn] = {
      accn: prov.accn,
      form: prov.form || null,
      filed: prov.filed || null,
      url: `https://www.sec.gov/Archives/edgar/data/${Number(match.cik)}/${String(prov.accn).replace(/-/g, '')}/`,
    };
  };

  const statements = years.map((year) => {
    const row = { fiscalYear: year, periodEnd: periodEnds[year] ?? null };
    const evidence = {};
    for (const field of Object.keys(US_TAGS)) {
      const value = extracted[field][year];
      // Convert to millions — the engine and the Excel model both work in
      // millions, and raw XBRL is in whole currency units.
      row[field] = typeof value === 'number' ? value / 1e6 : null;
      const prov = annualProv[field]?.[year];
      if (typeof value === 'number' && prov) {
        evidence[field] = { concept: prov.concept || null, accn: prov.accn || null };
        noteFiling(prov);
      }
    }
    // Share counts must NOT be divided; they are counts, not currency — but they
    // must be in the scale the filer tagged them in, which is what `shareScale`
    // settles against the cover page (`KI-30`).
    for (const field of SEC_COUNT_FIELDS) {
      const count = extracted[field][year];
      row[field] = typeof count === 'number' ? count * shareScale : null;
    }
    row.evidence = evidence;
    return row;
  });

  // THE QUARTERS, from the same facts the years came from.
  quarterlyDropped.length = 0;
  const quarters = extractQuarterlySEC(facts, match.cik, SEC_COUNT_FIELDS, statements, shareScale, revenueTags);
  const quartersDropped = quarterlyDropped.length;

  // The quarters' documents, into the same dictionary. A quarter carries its
  // filings inline as well — `filing` and `derivedFrom` — and both shapes
  // agree because both are built from `filingRef`.
  for (const quarter of quarters) {
    for (const doc of quarter.docs || []) noteFiling(doc);
    if (quarter.filing) noteFiling(quarter.filing);
    for (const list of Object.values(quarter.derivedFrom || {})) {
      for (const one of list || []) noteFiling(one);
    }
    // `docs` has done its job; the dictionary is the one place the forms and
    // the filing dates live from here on.
    delete quarter.docs;
  }

  return {
    source: 'SEC EDGAR',
    sourceUrl: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${match.cik}&type=10-K`,
    name: match.name,
    currency: reportingCurrency || 'USD',
    currencySymbol: currencySymbolFor(reportingCurrency || 'USD'),
    currencyEvidence: {
      reportingCurrency,
      reportingCurrencySource:
        'the currency the main statement totals are filed in — revenue, total assets and net income',
      // Every unit a figure was taken in. One, by construction, once the
      // reporting currency is established.
      statementCurrencies: takenCurrencies,
      // WHICH LINES SETTLED IT, and where they disagree, which is the only
      // case the currency is left unestablished in.
      ...reportingRead.evidence,
      // What the filing holds in some other currency and this payload does
      // not use: a borrowing, a subsidiary's balances. Named so a reader can
      // see the figures were not mixed rather than taking it on trust.
      ...(otherCurrencies.size ? { otherCurrenciesInFiling: [...otherCurrencies].sort() } : {}),
    },
    // A 10-K filer's statements count the registered shares that trade under
    // its own ticker, so the share count and the price are for the same security.
    listing: { shareBasis: 'registeredShares' },
    // WHAT WAS DONE TO THE SHARE COUNTS, AND AGAINST WHAT. Null where the filing
    // has no cover-page count to settle it against, in which case the counts are
    // exactly as filed. Standing decision 5: a corrected figure is never shown as
    // filed, and this is the record that lets a screen say which it is.
    shareScale: shareScaleRecord,
    // WHEN EACH SHARE COUNT WAS FILED (`KI-31`). The split adjustment runs in
    // the handler, after the price request has reported the split events, and
    // this is what tells it which counts already carry them.
    shareCountFiledAt: countFiledAt,
    // EVERY SEC DOCUMENT THIS PAYLOAD'S FIGURES POINT AT, keyed by accession
    // number. `statements[].evidence` and `quarters[].evidence` carry
    // `{ concept, accn }` per figure and read the rest from here.
    filings,
    cik: match.cik,
    // WHICH LINE THE TOP LINE IS, and how that was decided (`KI-32`). Recorded
    // for a financial company, where it is a choice; null everywhere else,
    // where the ordinary order of preference applies unchanged.
    revenueDefinition,
    sicCode,
    sicDescription,
    statements,
    quarters,
    // How many field-years the reconciliation refused to show because the
    // quarters did not add up to the year beside them. Zero on most
    // companies; where it is not, the table has dashes rather than figures
    // nobody can reconcile.
    quartersDropped,
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

  // Second call: the actual financial statements, annual and quarterly in one
  // request. Every name Yahoo uses is the same word with a different prefix,
  // so the quarterly list is derived from the annual one rather than written
  // out again — a second hand-written map is a second thing to keep in step.
  const QUARTER_TYPES = QUARTER_FIELDS
    .map((field) => YAHOO_FIELDS[field])
    .filter(Boolean)
    .map((name) => name.replace(/^annual/, 'quarterly'));
  const types = [...Object.values(YAHOO_FIELDS), ...QUARTER_TYPES].join(',');
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

  // ---- THE QUARTERS THE FEED HAPPENS TO CARRY ---------------------------
  //
  // "Whatever quarterly data the feed provides", and the honest part is how
  // little that is: measured on 2026-10-25, Yahoo returned five quarters of
  // income for Reliance and **two** of balance sheet, both of them year ends;
  // two quarters of income for HDFC Bank and four of balance sheet. There is
  // no filing behind any of them and no form, date or accession number to
  // link — so these rows carry no `filing`, and the screen says what they
  // are: a vendor feed, for development only.
  //
  // PERIOD TYPE IS THE VENDOR’S OWN WORD AND IT IS BELIEVED RATHER THAN
  // GUESSED. A point marked `3M` is a quarter; one marked `6M` is a half
  // year; anything else is left alone. That is the same rule the SEC path
  // applies to its own spans, and it is what keeps a cumulative figure from
  // being shown as a quarter — the one thing neither source labels for us.
  const quarterPoints = {};
  for (const field of QUARTER_FIELDS) {
    const annualName = YAHOO_FIELDS[field];
    if (!annualName) continue;
    const quarterName = annualName.replace(/^annual/, 'quarterly');
    const block = series.find((entry) => entry?.meta?.type?.[0] === quarterName);
    for (const point of block?.[quarterName] || []) {
      if (!point?.asOfDate) continue;
      const raw = point.reportedValue?.raw;
      if (typeof raw !== 'number') continue;
      const months = point.periodType === '3M' ? 3 : point.periodType === '6M' ? 6 : null;
      if (!months) continue;
      const key = `${point.asOfDate}|${months}`;
      if (!quarterPoints[key]) quarterPoints[key] = { periodEnd: point.asOfDate, months, values: {} };
      quarterPoints[key].values[field] = COUNT_FIELDS.has(field)
        ? raw
        : (OUTFLOW_FIELDS.has(field) ? Math.abs(raw) : raw) / 1e6;
    }
  }
  const quarters = Object.values(quarterPoints)
    .filter((q) => Object.keys(q.values).length)
    .sort((a, b) => (a.periodEnd < b.periodEnd ? -1 : a.periodEnd > b.periodEnd ? 1 : a.months - b.months))
    .slice(-QUARTERS_WANTED * 2)
    .map((q) => ({
      periodEnd: q.periodEnd,
      // The vendor gives an end date and a length and no start date, so the
      // start is the one thing here that IS worked out rather than reported.
      periodStart: null,
      fiscalYear: Number(q.periodEnd.slice(0, 4)),
      fiscalPeriod: null,
      months: q.months,
      values: q.values,
    }));

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
    quarters,
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
      // THE SERIES IS LEFT AS QUOTED, and no second copy of the rate is put
      // beside it. Ten years of closes multiplied here would be ten years of
      // prices at one day’s rate with no way left to tell, and the shape of the
      // series is the whole point of keeping it. The one rate lives in
      //  and the screen converts with that, so there is nothing
      // for a second copy to drift from.
      history: quote.history,
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
//   INR  The OECD’s own SDMX API, Main Economic Indicators long-term
//        interest rates (IRLT), monthly. CC BY 4.0 since 1 July 2024.
//        FRED republishes the identical series and is kept as a fallback.
//
// Checked and fetched on 2026-09-27; each returned a complete year for a window
// ending eighteen months in the past, which is what this model asks of it.
//
// WHAT IS STILL MISSING, and why each company stays refused: no reachable
// publisher was found for the Korean won, the new Taiwan dollar, the renminbi
// or the Danish krone. The rupee is answered, monthly, by the OECD; what that
// costs and what would remove it are in DATA_CONSTRAINTS.md, along with the
// three candidate publishers that need permission before a public site may
// use them (SNB for the franc, MAS for the Singapore dollar, ChinaBond for the
// renminbi) and FBIL's licence for the Indian benchmark itself.

// A SOURCE MAY HAVE A FALLBACK, AND THE ANSWER SAYS WHICH ONE SPOKE.
//
// Only the rupee has one, and the reason is a measured outage rather than a
// precaution: on 2026-10-22 FRED answered every request with its own "Site
// Maintenance" page and six Indian companies lost their valuation in an
// afternoon. FRED was the only publisher this file read for the rupee, and it
// was a third party republishing a sixth.
//
// So the OECD, which is the body that actually compiles the series, is asked
// first through its own SDMX API, and FRED is kept behind it. Measured over
// the whole overlap on 2026-10-24: both carry 178 months from 2011-12 to
// 2026-09, 175 of them identical to the last digit and the other three equal
// to within 7e-7 of a percentage point, which is the OECD API rounding to six
// decimals where FRED prints more. They are the same series, so whichever
// answers gives the same rate.
//
// `publisher` on the answer names the one that did, and says so when it was
// not the first choice, because a reader told "Source: OECD" is owed the truth
// of where the number came from this time.
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
  // A BLANK IS NOT A NOUGHT, and `Number('')` is 0.
  //
  // FRED prints an EMPTY cell for a day its series has no observation — every
  // US market holiday — so reading the cell as a number put 1 January, Martin
  // Luther King Day, Good Friday, Independence Day and eight more into a year
  // of Treasury yields at 0%. Measured on 2026-11-01: the two sources agreed
  // to the last decimal on all 250 days they shared and the mean came out
  // 4.0977% against 4.2944%, because of twelve days that were not days. That
  // is 19.7 basis points straight onto every discount rate the fallback ever
  // served, and `CLAUDE.md`'s trap list names it: a blank cell reads as a
  // reported nil.
  //
  // A GENUINE NOUGHT IS KEPT. A ten-year government bond really can yield 0%
  // — Japan's did for years — so only the blank is refused, never the zero.
  if (v === null || v === undefined) return null;
  if (typeof v === 'string' && v.trim() === '') return null;
  const n = Number(v);
  return typeof n === 'number' && isFinite(n) ? n : null;
};

// Each source returns [{ date: 'YYYY-MM-DD', percent: number }] covering at
// least the window asked for. Anything it cannot answer, it throws.
//
// `frequency` is part of the contract, not decoration: it sets how many
// observations a year is allowed to contain before the window is trusted, and
// it is carried through to the page so a reader is never told a monthly series
// is a daily one. Daily is the default because every source here was daily
// until INR.
// ---------------------------------------------------------------------------
// ONE FETCH PER CURRENCY, THREE TRIES, AND SOMETHING BEHIND IT (`KI-34`)
// ---------------------------------------------------------------------------
//
// The rate was fetched once per COMPANY, with no retry and, for five of the
// six currencies, nothing standing behind the publisher. So a single HTTP
// request that did not answer took a company’s whole valuation away: no cost
// of equity, no WACC, no value per share, and a refusal naming a missing rate.
// The refusal was right — discounting at an invented number would be worse —
// but it was not a fact about the company. It was a fact about one request,
// and a reader could not tell the difference.
//
// MEASURED ACROSS ONE FULL REFETCH on 2026-11-01: 6 of the 115 dollar payloads
// came back with no US Treasury yield and 3 of the 6 rupee ones with no OECD
// yield, while the other 112 and 3 succeeded in the same run against the same
// publishers. The casualty moved between companies from one refetch to the
// next — Walmart on 2026-10-31, Coca-Cola on 2026-11-01 — which is how a
// transient failure looks and is nothing like a company with no bond market.
//
// Three things together, because each covers a different failure:
//
//   ONE FETCH PER CURRENCY. 115 companies asking one publisher for the same
//   number on the same day is both the reason some of them fail and the
//   easiest thing to stop doing. The SERIES is cached rather than the rate,
//   because the rate is not shareable: every company averages its own window,
//   anchored to its own last balance sheet date. The span is padded by a year
//   either side so that companies with different year ends share one fetch
//   instead of each widening it, and the arithmetic is untouched — the window
//   is filtered out of the cached series exactly as it was out of a fresh one.
//
//   THREE ATTEMPTS, BACKING OFF. A publisher that drops one request usually
//   answers the next. This is not a way around a refusal: a 403, a challenge
//   or a block page is a refusal and is not retried, because retrying it is
//   defeating a protection (the data-layer plan §4.4). Only a failure that
//   says nothing about intent — a timeout, a reset, a 5xx — is tried again.
//
//   SOMETHING BEHIND EACH PUBLISHER, where a free one exists and carries
//   enough observations to be averaged the same way. Checked at every source
//   on 2026-11-01; what was found and what was not is in
//   `DATA_CONSTRAINTS.md`.

/** Whether a failure is the publisher saying no, or just a bad moment. */
function worthRetrying(error) {
  const says = String(error && error.message ? error.message : error);
  // A REFUSAL IS NOT RETRIED. 401, 403, 404, 429 and a block page are the
  // publisher telling us something; asking again is not persistence.
  if (/\b(401|403|404|405|410|429)\b/.test(says)) return false;
  if (/block page|not the CSV|captcha|challenge/i.test(says)) return false;
  // Nor is an answer that arrived and was simply too thin: fetching it again
  // returns the same thin answer.
  if (/observations in the window|no observations|no TIME_PERIOD|unknown publication/i.test(says)) return false;
  return true;
}

const RISK_FREE_ATTEMPTS = 3;
const RISK_FREE_BACKOFF_MS = [400, 1200];

/** One source read, with three attempts and a widening pause between them. */
async function readWithRetry(spec, from, to) {
  let last;
  for (let attempt = 1; attempt <= RISK_FREE_ATTEMPTS; attempt++) {
    try {
      return await spec.read(from, to);
    } catch (error) {
      last = error;
      if (attempt === RISK_FREE_ATTEMPTS || !worthRetrying(error)) break;
      riskFreeCacheStats.retries++;
      await new Promise((r) => setTimeout(r, RISK_FREE_BACKOFF_MS[attempt - 1]));
    }
  }
  throw last;
}

// The cached series, per currency and per publisher within it. Keyed by the
// publisher as well as the currency so a fallback cannot be served the
// primary's numbers. Six hours is the same life the HTTP cache above gives a
// payload, so a warm instance cannot hold a yield curve longer than it holds
// the figures discounted at it.
const riskFreeSeries = new Map();
const RISK_FREE_CACHE_MS = 6 * 60 * 60 * 1000;
const RISK_FREE_PAD_DAYS = 366;

/** Reset between checks, so one test cannot be answered out of another. */
export function clearRiskFreeCache() {
  riskFreeSeries.clear();
}

/** What the cache has done, so a check can prove it did it. */
export const riskFreeCacheStats = { fetches: 0, hits: 0, retries: 0 };

async function readSeriesShared(spec, currency, from, to) {
  const key = `${currency}|${spec.publisher}|${spec.name}`;
  const held = riskFreeSeries.get(key);
  const fresh = held && Date.now() - held.at < RISK_FREE_CACHE_MS;
  if (fresh && held.from <= from.getTime() && held.to >= to.getTime()) {
    riskFreeCacheStats.hits++;
    return held.rows;
  }
  // Not held, or not wide enough: fetch a span that covers what is asked AND
  // what was already held, padded so the next company with a different year
  // end is answered from memory rather than from the publisher.
  //
  // THE PAD IS A YEAR, NOT "UP TO TODAY". Stretching the span to today looked
  // tidier and cost real requests: the Treasury is read a calendar year per
  // request, so a company with a 2025 year end was fetching four years to use
  // one. A year either side already covers every year end in the set.
  const pad = RISK_FREE_PAD_DAYS * 86400000;
  const wantFrom = new Date(Math.min(from.getTime() - pad, fresh ? held.from : Infinity));
  const wantTo = new Date(Math.max(to.getTime() + pad, fresh ? held.to : -Infinity));
  riskFreeCacheStats.fetches++;
  const rows = await readWithRetry(spec, wantFrom, wantTo);
  riskFreeSeries.set(key, { from: wantFrom.getTime(), to: wantTo.getTime(), rows, at: Date.now() });
  return rows;
}

/**
 * FRED's CSV for one series, read the one way, so four fallbacks do not become
 * four copies of a parser that can drift apart.
 */
function fredSeries({ id, name, frequency, standsIn }) {
  return {
    name,
    publisher: `FRED, republishing ${standsIn}`,
    terms: `${standsIn} data, redistributed by FRED`,
    url: `https://fred.stlouisfed.org/series/${id}`,
    frequency,
    async read(from, to) {
      const res = await fetch(
        `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=${ymd(from)}&coed=${ymd(to)}`,
        { headers: { 'User-Agent': SEC_CONTACT, Accept: 'text/csv' } }
      );
      if (!res.ok) throw new Error(`FRED ${res.status}`);
      const lines = (await res.text()).trim().split('\n');
      if (!/observation_date/i.test(lines[0] || '')) {
        throw new Error('FRED: not the CSV, probably a block page');
      }
      const out = [];
      for (const line of lines.slice(1)) {
        const [rawDate, rawValue] = line.split(',');
        const percent = asRate(rawValue);
        const date = String(rawDate).trim().slice(0, 10);
        // FRED prints a full stop for a day with no observation; `asRate`
        // returns null for it and it is dropped rather than read as nought.
        if (percent !== null && /^\d{4}-\d{2}-\d{2}$/.test(date)) out.push({ date, percent });
      }
      if (!out.length) throw new Error('FRED: no observations in the window');
      return out;
    },
  };
}

export const RISK_FREE_SOURCES = {
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
    // STANDING BEHIND THE TREASURY (`KI-34`). The same series, daily, from a
    // publisher that is not the Treasury's own web server: FRED's DGS10 IS the
    // Treasury's 10-year constant-maturity yield, redistributed. Verified at
    // source on 2026-11-01 — 259 daily observations over the window, against
    // the Treasury's own for the same days.
    fallbacks: [
      fredSeries({
        id: 'DGS10',
        name: '10-year US Treasury par yield',
        frequency: 'daily',
        standsIn: 'US Treasury',
      }),
    ],
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
    // NO FALLBACK, DELIBERATELY (`KI-34`). FRED republishes the OECD's euro
    // area long-term rate as `IRLTLT01EZM156N`, and it was verified at source
    // on 2026-11-01: it carried THREE observations over a twelve-month window,
    // against the nine a monthly series needs to be averaged here. A fallback
    // that cannot fill the window is not a fallback — it is a second failure
    // with a publisher's name on it — so none is installed and this says why.
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
    // Behind the Ministry of Finance: the OECD's long-term rate for Japan, as
    // FRED republishes it. A DIFFERENT SERIES FROM A DIFFERENT PUBLISHER, and
    // monthly where the primary is daily, so the page is told which it got —
    // `frequency` is carried through for exactly this reason. Verified at
    // source on 2026-11-01: 11 monthly observations over the window.
    fallbacks: [
      fredSeries({
        id: 'IRLTLT01JPM156N',
        name: '10-year Japanese government bond yield',
        frequency: 'monthly',
        standsIn: 'the OECD',
      }),
    ],
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
    // Behind the Bank of England, the OECD's long-term rate for the United
    // Kingdom as FRED republishes it; monthly, and labelled so. Verified at
    // source on 2026-11-01: 11 monthly observations over the window.
    fallbacks: [
      fredSeries({
        id: 'IRLTLT01GBM156N',
        name: '10-year UK gilt yield',
        frequency: 'monthly',
        standsIn: 'the OECD',
      }),
    ],
  },

  SEK: {
    name: '10-year Swedish government benchmark bond yield',
    publisher: 'Sveriges Riksbank',
    // UNCONFIRMED, AND SAID SO. The SWEA API is public and keyless, and the
    // Riksbank states no licence for its statistics on the pages read on
    // 2026-11-01  its only published conditions of use cover SWESTR, which is
    // a different series. Recorded as unconfirmed rather than described as
    // open, and listed in `DATA_CONSTRAINTS.md` so a public export or a
    // redistribution asks about it first.
    terms:
      'Riksbank SWEA open data, public and keyless; the Riksbank publishes no licence for its statistics, ' +
      'so these terms are UNCONFIRMED and a public redistribution needs them checked first',
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
    // Behind the Riksbank, the OECD's long-term rate for Sweden as FRED
    // republishes it; monthly, and labelled so. Verified at source on
    // 2026-11-01: 11 monthly observations over the window.
    fallbacks: [
      fredSeries({
        id: 'IRLTLT01SEM156N',
        name: '10-year Swedish government bond yield',
        frequency: 'monthly',
        standsIn: 'the OECD',
      }),
    ],
  },

  // THE INDIAN TEN-YEAR, AND WHY IT IS THE ONLY MONTHLY ONE HERE.
  //
  // The benchmark itself is FBIL's, and FBIL licenses it: a paid licence is
  // needed to show it on a website, so it is a launch-time purchase and not a
  // development one. RBI republishes a handful of weekly observations with no
  // history. CCIL operates the market and its Terms of Use forbid automated
  // collection outright. NSE answers from India, times out from a US
  // datacentre, and publishes a total-return index rather than a yield. The
  // World Bank has no government bond yield indicator at all -- every "yield"
  // series it carries is agricultural.
  //
  // That leaves the OECD's Main Economic Indicators long-term interest rate,
  // which is monthly. It is fetched from the OECD itself rather than from a
  // republication: the series is compiled by the OECD, OECD content published
  // from 1 July 2024 is under CC BY 4.0, and their SDMX API answers a plain
  // HTTPS request with the whole history and a two-hour cache header.
  //
  // Monthly is a real cost and it is stated rather than hidden: see
  // DATA_CONSTRAINTS.md, which carries the measured size of it.
  INR: {
    name: '10-year Indian government bond yield',
    publisher: 'OECD',
    terms: 'OECD statistics, CC BY 4.0 since 1 July 2024, reusable with attribution',
    url: 'https://www.oecd.org/en/data/indicators/long-term-interest-rates.html',
    frequency: 'monthly',
    async read(from, to) {
      // SDMX, nine key positions: reference area, frequency, measure, unit,
      // activity, adjustment, transformation, time horizon, methodology. Only
      // the first three are pinned; the rest are not applicable to this series
      // and are left open rather than guessed at.
      const month = (d) => ymd(d).slice(0, 7);
      const res = await fetch(
        'https://sdmx.oecd.org/public/rest/data/OECD.SDD.STES,DSD_STES@DF_FINMARK,4.0/IND.M.IRLT......' +
          `?startPeriod=${month(from)}&endPeriod=${month(to)}&format=csvfile`,
        { headers: { 'User-Agent': SEC_CONTACT, Accept: 'application/vnd.sdmx.data+csv' } }
      );
      if (!res.ok) throw new Error(`OECD ${res.status}`);
      const lines = (await res.text()).trim().split('\n');
      const head = (lines[0] || '').split(',').map((h) => h.trim());
      const dateAt = head.indexOf('TIME_PERIOD');
      const valueAt = head.indexOf('OBS_VALUE');
      if (dateAt < 0 || valueAt < 0) throw new Error('OECD: no TIME_PERIOD/OBS_VALUE column');
      const out = [];
      for (const line of lines.slice(1)) {
        const cells = line.split(',');
        if (cells.length <= Math.max(dateAt, valueAt)) continue;
        const percent = asRate(cells[valueAt]);
        const period = String(cells[dateAt]).trim();
        // A MONTHLY OBSERVATION IS DATED AT THE FIRST OF ITS MONTH, which is
        // the convention the fallback's republication uses. Dating them the
        // same way is what makes the two interchangeable: the same window
        // picks the same twelve months whichever source answered.
        if (percent !== null && /^\d{4}-\d{2}$/.test(period)) out.push({ date: `${period}-01`, percent });
      }
      if (!out.length) throw new Error('OECD: no observations in the window');
      return out;
    },
    fallbacks: [
      {
        name: '10-year Indian government bond yield',
        publisher: 'FRED, republishing the OECD series',
        terms: 'OECD statistics, reusable with attribution; redistributed by FRED',
        url: 'https://fred.stlouisfed.org/series/INDIRLTLT01STM',
        frequency: 'monthly',
        async read(from, to) {
          const res = await fetch(
            'https://fred.stlouisfed.org/graph/fredgraph.csv?id=INDIRLTLT01STM' +
              `&cosd=${ymd(from)}&coed=${ymd(to)}`,
            { headers: { 'User-Agent': SEC_CONTACT, Accept: 'text/csv' } }
          );
          if (!res.ok) throw new Error(`FRED ${res.status}`);
          const lines = (await res.text()).trim().split('\n');
          if (!/observation_date/i.test(lines[0] || '')) {
            throw new Error('FRED: not the CSV, probably a block page');
          }
          const out = [];
          for (const line of lines.slice(1)) {
            const [rawDate, rawValue] = line.split(',');
            const percent = asRate(rawValue);
            const date = String(rawDate).trim().slice(0, 10);
            if (percent !== null && /^\d{4}-\d{2}-\d{2}$/.test(date)) out.push({ date, percent });
          }
          return out;
        },
      },
    ],
  },
  // TWO CURRENCIES THAT HAD NO PUBLISHER AT ALL until 2026-11-01. Seven
  // Canadian and two Danish payloads were refused a cost of equity outright,
  // not because the rate was unknowable but because nobody here had looked for
  // it. Both sources below are the country's own, both were read at source
  // before being written down, and both were checked against their publisher's
  // terms rather than assumed to be free.
  //
  // SWITZERLAND IS DELIBERATELY ABSENT. The Swiss National Bank publishes the
  // Confederation bond yield in the same shape and its terms do not permit
  // commercial reuse without written permission, so it is not read. That is a
  // licence, not a gap in the data, and it is recorded in
  // `DATA_CONSTRAINTS.md` as Paid · last rather than left as a silent refusal.
  CAD: {
    name: '10-year Government of Canada benchmark bond yield',
    publisher: 'Bank of Canada',
    // Read at https://www.bankofcanada.ca/terms/ on 2026-11-01: "the Bank
    // permits you to freely use, copy, distribute and transmit its website
    // content" with the Bank credited as the source and any changes stated.
    // Where the content appears in a paid service, purchasers must be told it
    // is available free on the Bank's own website — which is why the publisher
    // and the source link travel with every figure on the card.
    terms:
      'Bank of Canada website content, freely usable with the Bank credited as the source; where it ' +
      "appears in a paid service, purchasers are told it is available free on the Bank's website",
    url: 'https://www.bankofcanada.ca/valet/docs',
    frequency: 'daily',
    async read(from, to) {
      const res = await fetch(
        'https://www.bankofcanada.ca/valet/observations/BD.CDN.10YR.DQ.YLD/json' +
          `?start_date=${ymd(from)}&end_date=${ymd(to)}`,
        { headers: { 'User-Agent': SEC_CONTACT, Accept: 'application/json' } }
      );
      if (!res.ok) throw new Error(`Bank of Canada ${res.status}`);
      const body = await res.json();
      const rows = Array.isArray(body?.observations) ? body.observations : [];
      const out = [];
      for (const row of rows) {
        // Valet nests each series under its own key, and a day with no
        // observation carries an empty string rather than being absent. A
        // blank is not a yield of nought; `asRate` refuses it.
        const percent = asRate(row?.['BD.CDN.10YR.DQ.YLD']?.v);
        const date = String(row?.d ?? '').trim().slice(0, 10);
        if (percent !== null && /^\d{4}-\d{2}-\d{2}$/.test(date)) out.push({ date, percent });
      }
      if (!out.length) throw new Error('Bank of Canada: no observations in the window');
      return out;
    },
    // Measured against the Bank's own figures over the year to 2025-12-31:
    // 3.2347% against 3.2366%, which is a fifth of a basis point apart.
    fallbacks: [
      fredSeries({
        id: 'IRLTLT01CAM156N',
        name: '10-year Government of Canada bond yield',
        frequency: 'monthly',
        standsIn: 'the OECD',
      }),
    ],
  },
  DKK: {
    // THE LONG-TERM RATE FOR CONVERGENCE PURPOSES, which is what the ECB calls
    // it and what it is: the yield on a Danish government bond of about ten
    // years, compiled on one definition across the European Union so member
    // states can be compared. Named here the way the publisher names it rather
    // than relabelled as a plain ten-year yield.
    name: '10-year Danish government bond yield (the long-term rate for convergence purposes)',
    publisher: 'European Central Bank',
    terms: 'ECB statistics, reusable with the source acknowledged',
    url: 'https://data.ecb.europa.eu/data/datasets/IRS',
    frequency: 'monthly',
    async read(from, to) {
      const month = (d) => ymd(d).slice(0, 7);
      const res = await fetch(
        'https://data-api.ecb.europa.eu/service/data/IRS/M.DK.L.L40.CI.0000.DKK.N.Z' +
          `?startPeriod=${month(from)}&endPeriod=${month(to)}&format=csvdata`,
        { headers: { 'User-Agent': SEC_CONTACT, Accept: 'text/csv' } }
      );
      if (!res.ok) throw new Error(`ECB ${res.status}`);
      const lines = (await res.text()).trim().split('\n');
      const head = (lines[0] || '').split(',').map((h) => h.trim());
      const dateAt = head.indexOf('TIME_PERIOD');
      const valueAt = head.indexOf('OBS_VALUE');
      if (dateAt < 0 || valueAt < 0) throw new Error('ECB: no TIME_PERIOD/OBS_VALUE column');
      const out = [];
      for (const line of lines.slice(1)) {
        const cells = line.split(',');
        if (cells.length <= Math.max(dateAt, valueAt)) continue;
        const percent = asRate(cells[valueAt]);
        const period = String(cells[dateAt]).trim();
        // DATED AT THE FIRST OF THE MONTH, the same way the fallback dates it,
        // so the same window picks the same months whichever answered.
        if (percent !== null && /^\d{4}-\d{2}$/.test(period)) out.push({ date: `${period}-01`, percent });
      }
      if (!out.length) throw new Error('ECB: no observations in the window');
      return out;
    },
    // Measured over the year to 2025-12-31: 2.4693% against the ECB's 2.4265%,
    // 4.3 basis points apart. Two compilations of the same bond market rather
    // than one series twice, and the difference is recorded rather than hidden.
    fallbacks: [
      fredSeries({
        id: 'IRLTLT01DKM156N',
        name: '10-year Danish government bond yield',
        frequency: 'monthly',
        standsIn: 'the OECD',
      }),
    ],
  },
};

export async function fetchRiskFreeRate(reportingCurrency, valuationDate) {
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

  // The source, then anything standing behind it. A source that throws, or
  // that cannot fill the window, hands on to the next; the failures are kept
  // so that whichever answers can say what it stood in for, and so that a
  // refusal names every publisher that was asked rather than only the last.
  const attempts = [spec, ...(Array.isArray(spec.fallbacks) ? spec.fallbacks : [])];
  const failures = [];
  for (const source of attempts) {
    try {
      return await readRiskFreeWindow(source, start, end, reportingCurrency, failures);
    } catch (error) {
      failures.push(`${source.publisher} could not be read (${String(error.message).slice(0, 60)})`);
    }
  }

  // NEVER A SILENT CONSTANT. A rate that could not be fetched is absent, and
  // the engine says so rather than discounting at a number nobody chose.
  return {
    rate: null,
    currency: reportingCurrency,
    publisher: spec.publisher,
    reason: `The ${spec.name} could not be fetched: ${failures.join('; ')}.`,
  };
}

/**
 * One source, read and averaged, or an exception saying why not.
 *
 * Split out of the function above so that every source in a chain is held to
 * exactly the same window, floor and arithmetic. A fallback that was averaged
 * a little differently from the source it stands in for would move the
 * valuation on the day the first one went down, which is the failure the
 * fallback exists to prevent.
 */
async function readRiskFreeWindow(spec, start, end, reportingCurrency, failures = []) {
  // THE SERIES IS SHARED; THE WINDOW IS NOT. Every company filters its own
  // window out of the same fetched series, so two companies with different
  // year ends still get different rates from one request (`KI-34`).
  const all = await readSeriesShared(spec, reportingCurrency, start, end);
  const from = ymd(start);
  const to = ymd(end);
  const window = all.filter((row) => row.date >= from && row.date <= to);
  // HOW MANY OBSERVATIONS IS ENOUGH DEPENDS ON HOW OFTEN THE SOURCE PUBLISHES.
  // 30 was the right floor while every source was daily -- roughly six weeks
  // of trading, enough that one quiet fortnight cannot carry the mean. Asking
  // a monthly series for 30 observations in a year asks for something that
  // cannot exist, and would have refused every INR company for the rest of
  // time while looking like a fetch failure. The floor is now stated per
  // frequency, against what a full year of that frequency actually holds.
  const frequency = spec.frequency || 'daily';
  const floor = { daily: 30, weekly: 20, monthly: 9 }[frequency];
  if (floor === undefined) throw new Error(`unknown publication frequency "${frequency}"`);
  if (window.length < floor) {
    throw new Error(
      `only ${window.length} ${frequency} observations in the window, below the ${floor} this source needs`
    );
  }
  window.sort((a, b) => (a.date < b.date ? -1 : 1));
  const mean = window.reduce((t, row) => t + row.percent, 0) / window.length;
  return {
    rate: mean / 100,
    currency: reportingCurrency,
    name: spec.name,
    // WHO ACTUALLY ANSWERED, and what it stood in for. One field rather than
    // a new one, deliberately: the payload shape is versioned, and a new key
    // would mark all 176 saved payloads stale and force a refetch of the
    // whole set to record a sentence that belongs beside the publisher
    // anyway.
    publisher: failures.length
      ? `${spec.publisher} — used because ${failures.join('; ')}`
      : spec.publisher,
    terms: spec.terms,
    sourceUrl: spec.url,
    tenorYears: 10,
    frequency,
    observations: window.length,
    windowFrom: window[0].date,
    windowTo: window[window.length - 1].date,
    latest: window[window.length - 1].percent / 100,
    reason: null,
  };
}

/**
 * ONE CHART REQUEST, AND THE SERIES IS KEPT.
 *
 * This used to ask for a year of daily closes, take the highest and the
 * lowest, and throw the series away -- so the site held a 52-week range and
 * could not draw a price chart at all. The series is now kept.
 *
 * TEN YEARS DAILY, THEN MONTHLY TO THE START. Measured on 2026-10-22:
 * `range=max&interval=1d` does NOT return daily data. Yahoo silently
 * coarsens it -- Apple comes back with 169 points for 42 years, which is
 * monthly. So the daily series is asked for as `10y`, which does return one
 * point per trading day (2,513 for Apple), and the "Max" range is a second,
 * much smaller request at a monthly interval. Two requests, about 300KB and
 * 20KB, against one source that is already being called for the price.
 */
async function fetchQuote(symbol) {
  const chart = (range, interval, events) =>
    fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
        symbol
      )}?range=${range}&interval=${interval}${events ? `&events=${events}` : ''}`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Marginalia/1.0)' } }
    );
  // THE SPLIT EVENTS RIDE ON THE REQUEST THAT WAS ALREADY BEING MADE. `KI-31`
  // needs to know whether a split falls after the filing a share count came
  // from, and `events=split` puts them on this same ten-year daily response at
  // no extra request. Ten years is also the right window: a split older than
  // every figure the model holds cannot change one.
  const res = await chart('10y', '1d', 'split');
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
  const stamps = Array.isArray(result?.timestamp) ? result.timestamp : [];

  // THE RANGE IS STILL FIFTY-TWO WEEKS. The request grew to ten years for the
  // chart, and taking the high and low of everything returned would have
  // quietly turned the 52-week range into a ten-year range -- on Apple, a low
  // of $29 instead of $169. So the window is cut by date, from the series, and
  // the number of observations in it is reported as it always was.
  const yearAgo = Date.now() / 1000 - 365 * 86400;
  const inWindow = (i) => !stamps.length || stamps[i] >= yearAgo;
  const within = (series) => (series || []).filter((v, i) => typeof v === 'number' && inWindow(i));
  const highs = within(quoteBlock.high);
  const lows = within(quoteBlock.low);

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

  // The long view, best-effort: a chart that stops ten years back is still a
  // chart, so a failure here costs the "Max" range and nothing else.
  let monthly = null;
  try {
    const far = await chart('max', '1mo');
    if (far.ok) monthly = seriesFrom((await far.json())?.chart?.result?.[0]);
  } catch {
    monthly = null;
  }
  const daily = seriesFrom(result);
  const history =
    daily || monthly
      ? {
          currency: meta.currency || null,
          source: 'Yahoo Finance (chart)',
          daily,
          monthly,
        }
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
    // THE SERIES, AS THE EXCHANGE QUOTED IT. Never converted here: a payload
    // should carry what the source said, and the one rate the price is
    // converted at is recorded separately so the conversion can be undone or
    // checked. The screen converts it with that same rate.
    history,
    // EVERY SPLIT IN THE WINDOW, as the source reported it (`KI-31`). Kept
    // whether or not any of them turns out to apply to the share count, because
    // a reader is owed the event as well as the decision taken about it.
    splits: splitsFrom(result),
  };
}

/**
 * A chart response as two parallel arrays, with every gap dropped.
 *
 * Yahoo returns nulls in `close` for days the instrument did not trade, and a
 * null in a price series is not a price of nothing -- it is a day with no
 * close. Dropping the day is the only honest handling: interpolating would
 * invent a price, and plotting zero would draw a crash that did not happen.
 */
function seriesFrom(result) {
  const stamps = Array.isArray(result?.timestamp) ? result.timestamp : [];
  const closes = result?.indicators?.quote?.[0]?.close || [];
  const dates = [];
  const values = [];
  for (let i = 0; i < stamps.length; i++) {
    const close = closes[i];
    if (typeof close !== 'number' || !isFinite(close)) continue;
    if (typeof stamps[i] !== 'number') continue;
    dates.push(new Date(stamps[i] * 1000).toISOString().slice(0, 10));
    // Six significant figures: enough for a price in any currency this site
    // reaches, including a quote in agorot, and it keeps the payload small.
    values.push(Number(close.toPrecision(6)));
  }
  return dates.length ? { from: dates[0], to: dates[dates.length - 1], dates, closes: values } : null;
}

// ===========================================================================
// SECTION 4 — THE HANDLER
// ===========================================================================

// WHAT SHAPE THIS FETCHER BUILDS. It must equal PAYLOAD_VERSION in
// src/data/payloadVersion.ts, which explains what each number means and when to
// bump it. The two are separate constants on purpose: each file in this
// directory is packaged on its own by the host, and a shared import that fails
// to bundle takes the whole route down. They are compared at runtime instead.
const FETCHER_VERSION = 14;

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

    // EVERY SHARE COUNT ON TODAY'S BASIS (`KI-31`), which can only happen here:
    // the statements are built before the price is fetched, and it is the price
    // request that reports the splits. A share count filed before a split does
    // not carry it, and the price always does, so the two stop belonging to
    // each other until this runs. It mutates the counts and records both what
    // it did and, where it declined, why.
    data.splitAdjustment = applySplitAdjustment(data, quotedPrice?.splits);

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