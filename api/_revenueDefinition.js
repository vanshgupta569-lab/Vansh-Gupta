// FILE: api/_revenueDefinition.js
//
// WHICH LINE A COMPANY'S REVENUE IS, IN ONE PLACE (build step 5, job D1).
//
// The fetcher settles a top line for every SEC filer, and the base-rate builder
// (`scripts/buildBaseRates.mts`, job D2) has to settle it the same way over
// 18,000 of them. Two copies of that decision would mean the base rates
// described a universe this site does not model, and nothing would say so.
//
// WHY IT IS IN `api/` AND NOT IN `src/data/`. `docs/STEP5_BUILD_PLAN.md` D1
// says "a shared module both the fetcher and the base-rate builder import",
// and the obvious home would be `src/data/`. It cannot be: each file in `api/`
// is packaged on its own by the host, and an import reaching into `src/` takes
// the deployed route down — which is why `payloadVersion.ts` exists as a
// mirror rather than an import. A SIBLING in `api/` is fine and is already
// proven: `marketIndex.js` and `search.js` both import `./_guard.js`. The
// base-rate builder runs locally under tsx and can import from anywhere, so it
// imports this.
//
// So the plan's intent is kept — one definition, imported by both — and the
// constraint the code records is kept with it.
//
// NOTHING HERE DECIDES ANYTHING NEW. Every list and every rule below was in
// `company.js` and is unchanged; `verify:sweep` either side of the move shows
// every company's revenue identical in every year.

// ---------------------------------------------------------------------------
// WHAT THE TOP LINE OF A FINANCIAL COMPANY IS (`KI-32`)
// ---------------------------------------------------------------------------
//
// Which fiscal years a company has is anchored on revenue: the years that
// carry a revenue tag are the years the model is built from. So the tag that
// is read is not a detail of presentation — it decides which years exist.
// Morgan Stanley and Wells Fargo both stopped tagging `Revenues` and moved to
// `RevenuesNetOfInterestExpense`, which was not in the list, so their models
// were built from whatever years still carried the old tag: Morgan Stanley
// stopped at FY2014 and Wells Fargo at FY2019, eleven and six years stale,
// every figure correctly labelled with a year that was simply the wrong one.
//
// THE DEFINITION, settled on 2026-11-01 and measured over all twelve
// SEC-sourced financial companies in the set before it was written down:
//
//   A financial company’s top line is TOTAL REVENUE AS THE FILER REPORTS IT
//   ON THE FACE OF ITS INCOME STATEMENT. In XBRL that is
//   `RevenuesNetOfInterestExpense` where the filer tags it, and `Revenues`
//   otherwise. `RevenueFromContractWithCustomer...` is NEVER the top line of
//   a financial company, because it is an ASC 606 measure: it excludes net
//   interest income, lease income under ASC 842 and investment results, each
//   of which is revenue to a financial company rather than a side issue.
//
// ONE TAG FOR THE WHOLE SERIES, NEVER A MIX. Everywhere else a later tag may
// fill a year the preferred one left empty; here it may not. Two tags that
// disagree would put a step in the series that no reader could see and no
// growth rate should be taken from.
//
// AND THE CHOSEN TAG MUST REACH THE LATEST YEAR ANY CANDIDATE REACHES, which
// is the clause that makes the order safe rather than merely plausible. A tag
// a filer has stopped using is not the tag it reports on now: BlackRock files
// `Revenues` for 2022 to 2024 at about half its contract revenue and nothing
// for 2025, so preferring `Revenues` blindly would have cost it its latest
// year and halved its top line.
//
// MEASURED AT THE FILINGS, tag against tag, year against year:
//   JPM   the two tags are IDENTICAL in all thirteen overlapping years
//   MS    identical in 2013 and 2014, the only two years both exist — so the
//         move was a rename and the series is continuous across it
//   WFC   identical in 2018; 2019 differs by 2.0%, which is a restatement of
//         the same line and not a different measure of it
// So for the three companies where both tags exist, this definition does not
// change a single figure that was already being read; it only reaches the
// years the old list could not.
export const FINANCIAL_REVENUE_TAGS = [
  'RevenuesNetOfInterestExpense',
  'Revenues',
  'RevenueFromContractWithCustomerExcludingAssessedTax',
  'RevenueFromContractWithCustomerIncludingAssessedTax',
];

export const TOTAL_REVENUE_FIRST = [
  // The total revenue line as presented, and what a filer that has not moved to
  // ASC 606 calls the same thing.
  'Revenues',
  'SalesRevenueNet',
  // Revenue from contracts with customers: the whole of the top line for most
  // companies, a component of it for some, and GROSS of rebates for a few.
  'RevenueFromContractWithCustomerExcludingAssessedTax',
  'RevenueFromContractWithCustomerIncludingAssessedTax',
];

/** The fiscal years one tag carries an annual 10-K figure for. */
export function annualYearsOf(facts, tag) {
  const entry = facts['us-gaap']?.[tag];
  const years = new Set();
  if (!entry) return years;
  const unitKey = Object.keys(entry.units || {})[0];
  if (!unitKey) return years;
  for (const point of entry.units[unitKey] || []) {
    if (typeof point.val !== 'number' || !point.end) continue;
    if (!String(point.form || '').startsWith('10-K')) continue;
    if (point.start) {
      const days = (new Date(point.end) - new Date(point.start)) / 86400000;
      if (days < 300 || days > 400) continue;
    }
    const year = Number(point.end.slice(0, 4));
    if (year) years.add(year);
  }
  return years;
}

/**
 * ONE TAG'S ANNUAL FIGURES, BY YEAR, as the filer filed them.
 *
 * `annualYearsOf` says WHICH years a tag covers; this says WHAT it reported in
 * each, which is what settling a top line needs. Undimensioned facts only, one
 * figure per year, the most recently filed winning — the same three rules the
 * extraction itself reads by, so a figure compared here is the figure that
 * would be shown.
 */
export function annualFiguresOf(facts, tag) {
  const entry = facts['us-gaap']?.[tag];
  const out = new Map();
  if (!entry) return out;
  const unitKey = Object.keys(entry.units || {})[0];
  if (!unitKey) return out;
  for (const point of entry.units[unitKey] || []) {
    if (typeof point.val !== 'number' || !point.end) continue;
    if (!String(point.form || '').startsWith('10-K')) continue;
    if (point.start) {
      const days = (new Date(point.end) - new Date(point.start)) / 86400000;
      if (days < 300 || days > 400) continue;
    }
    const year = Number(point.end.slice(0, 4));
    if (!year) continue;
    const held = out.get(year);
    if (!held || String(point.filed || '') >= String(held.filed || '')) {
      out.set(year, { val: point.val, filed: point.filed || null });
    }
  }
  return out;
}
