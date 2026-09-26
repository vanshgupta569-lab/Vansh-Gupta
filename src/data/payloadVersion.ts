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
//
// `api/company.js` carries the same number in its own FETCHER_VERSION. The two
// are deliberately not imported from one place: each file in `api/` is packaged
// on its own by the host, and a missing shared import there takes the route
// down. Two constants that must agree are checked at runtime instead — which is
// the whole point of this file.
export const PAYLOAD_VERSION = 4;

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
