// FILE: src/data/payloadVersion.ts
//
// WHAT SHAPE OF PAYLOAD THIS CODE EXPECTS.
//
// `/api/company` answers are cached — at the edge for six hours for everyone
// who asks, and on disk indefinitely for the verification set. The cache key
// was the ticker alone, so for six hours after any change to what is fetched,
// code that expected a new field was handed a payload built before it existed
// and read the field as absent. That is `KI-15`, and it has bitten repeatedly:
// payloads from before the fiscal period end date was fetched, from before
// filed interest expense, from before the risk-free rate. Every job in the last
// fortnight began by refetching the whole set because a measurement taken over
// a mixed set looks valid and is not.
//
// So the version is part of the request. The browser asks for the shape it
// knows how to read, the answer says which shape it is, and the two are
// compared rather than assumed. A bumped version is a different URL, so no
// cache anywhere can serve the old shape to new code.
//
// BUMP THIS whenever `api/company.js` changes what it puts in a payload: a new
// field, a field removed, a field whose meaning or units change. Record why in
// the table below, because the number on its own says nothing.
//
//   1  the shape before this was tracked
//   2  fiscal period end dates on every statement row
//   3  filed investing and financing cash flow totals
//   4  the risk-free rate, fetched per currency from its own publisher
//   5  the daily price series the quote was already downloading and throwing
//      away: ten years daily plus monthly to the start, as the exchange quoted
//      it, with the rate the price was converted at recorded beside it
//   6  `quarters`: the quarterly and half-year periods each company filed,
//      with the state of every figure (reported or derived) and, for an SEC
//      filer, the filing each one came from — both filings where a quarter
//      is the difference between two cumulative figures
//   7  `shareScale`: what scale an SEC filer tags its share counts in, read
//      off its own cover page, and the counts corrected to an absolute
//      number of shares. McDonald's tags 716.4 where every other filer tags
//      716,400,000 (`KI-30`)
//  10  a quarterly share count is never derived by subtracting one
//      cumulative figure from another: a weighted average is not a sum, so
//      the difference between a year and nine months of it is not the
//      fourth quarter of anything. The quarter carries the count the
//      company filed for it, or it is not reported (`KI-33`)
//   9  `revenueDefinition`: which revenue tag a FINANCIAL company's top
//      line is read from, chosen rather than taken in order, because the
//      tag decides which fiscal years exist. Morgan Stanley and Wells Fargo
//      moved to `RevenuesNetOfInterestExpense` and their models were being
//      built from the years that still carried `Revenues`  FY2014 and
//      FY2019 (`KI-32`)
//   8  `splitAdjustment` and `quote.splits`: every stock split the price
//      source reports, and every share count put on today's basis by the
//      splits that fall after the date that count was filed — so a count
//      filed before a split is no longer paired with a price struck after
//      one. `shareCountFiledAt` carries the filing date each annual count
//      came from. An event that did not change the issuer's share count, such
//      as an ADR ratio change, is recorded and not applied (`KI-31`)
//  11  `statements[].evidence` and `quarters[].evidence`: for every figure an
//      SEC filer's payload carries, the XBRL CONCEPT it was read from and the
//      ACCESSION NUMBER of the one document it is in, with `filings` holding
//      each of those documents once — its form as filed (`10-K`, `10-Q`,
//      `10-K/A`), its filing date and the address it can be opened at — and
//      `cik` so a search link can be built where there is no accession
//      number. Until this the evidence sheet named a LIST of candidate
//      concepts and said which one the company used was not recorded, and an
//      annual figure's Form line read "Annual report (10-K / 20-F), as tagged
//      in XBRL" because no form was held either
//  12  the REPORTING CURRENCY is the currency the MAIN STATEMENT TOTALS are
//      filed in — revenue, total assets and net income — and every other
//      monetary figure is read in that currency and in no other. It used to
//      be read off every monetary tag the facts carried, so one stray unit
//      left it unestablished and the company refused: a US filer with a euro
//      bond, or a Canadian subsidiary's balances, tags those in their own
//      currency, and that is a fact about the bond rather than about the
//      statements. `currencyEvidence` now carries `mainTotals`,
//      `mainTotalCurrencies`, `mainTotalsDisagree` where they do, and
//      `otherCurrenciesInFiling` for what the filing holds and this payload
//      does not use. Worse than the refusal was that the unit a figure was
//      READ IN was whichever came first in the JSON, so a figure could be
//      read in the stray currency and divided into millions as though it
//      were the reporting one
//  13  a QUARTERLY figure is taken only from a form a statement is filed on —
//      `10-K`, `10-Q` and their amendments. The quarterly path filtered facts
//      by period and not by form at all, so a later document that happened to
//      tag the same period superseded the 10-Q it was reported in: 126 figures
//      across 34 companies were cited to a `DEF 14A`, an `8-K` or a `DEF 14C`
//      (`KI-36`). Nothing in the shape changes; what changes is which document
//      a quarterly figure comes from, and for a few periods whether the figure
//      exists at all
//  14  EVERY COMPANY SETTLES ITS OWN TOP LINE, not only a financial one. The
//      revenue tags were read in order of preference and the first one present
//      won, so a company whose revenue is not all revenue from contracts with
//      customers had a COMPONENT of its top line shown as the top line:
//      Enbridge's FY2021 read 19,432 where its own 10-K files `Revenues` of
//      47,071, 59% short (`KI-39`). `revenueDefinition` is now on every SEC
//      filer, carrying the tag chosen, every candidate's figure in the latest
//      reported year, and how far short of the total the old rule's choice was
//
// `api/company.js` carries the same number in its own FETCHER_VERSION. The two
// are deliberately not imported from one place: each file in `api/` is packaged
// on its own by the host, and a missing shared import there takes the route
// down. Two constants that must agree are checked at runtime instead — which is
// the whole point of this file.
export const PAYLOAD_VERSION = 14;

/** The query the browser sends, so a cache cannot answer for another shape. */
export const payloadQuery = (ticker: string) =>
  `ticker=${encodeURIComponent(ticker)}&v=${PAYLOAD_VERSION}`;

/**
 * What to do with an answer whose shape is not the one this code reads.
 *
 * It returns a sentence rather than throwing, because the two directions mean
 * different things and neither is the reader's fault:
 *
 *   the answer is OLDER  a cache somewhere served a payload built before this
 *                        code. With the version in the URL this should be
 *                        unreachable, so it is worth saying loudly.
 *   the answer is NEWER  the site was deployed while this tab was open. The
 *                        page is the stale thing, and reloading fixes it.
 */
export function payloadVersionProblem(fetched: any): string | null {
  const got = fetched?.fetcherVersion;
  if (got === PAYLOAD_VERSION) return null;
  if (typeof got !== 'number') {
    return (
      'These figures came from a source that did not say which shape they are in — a cached answer from before ' +
      'this site started tracking that. Reload to fetch them again.'
    );
  }
  return got < PAYLOAD_VERSION
    ? `These figures were fetched by an older version of the data layer (v${got}, this page reads v${PAYLOAD_VERSION}), ` +
        'so fields this page expects may be missing. Reload to fetch them again.'
    : `This page is older than the data it was given (it reads v${PAYLOAD_VERSION}, the figures are v${got}). ` +
        'The site was updated while this page was open; reload to pick it up.';
}

export default { PAYLOAD_VERSION, payloadQuery, payloadVersionProblem };
