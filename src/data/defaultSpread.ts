// FILE: src/data/defaultSpread.ts
//
// THE COST OF BORROWING, FROM A RATING RATHER THAN FROM LAST YEAR'S INTEREST.
//
// `docs/COST_OF_CAPITAL_SPEC.md` rule 17: the cost of debt is the
// currency-matched risk-free rate plus a default spread from the company's
// rating, and where it has no rating, from a SYNTHETIC rating read off its
// interest coverage. This file is that table, captured whole rather than typed
// in, with a separate ladder for financial service firms as the rule requires.
//
//   Source:   https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datafile/ratings.html
//   Vintage:  the page's own "Date of Analysis: Data used is as of January 2026"
//   Captured: 2026-10-30
//   Bands:    15 in each of the two tables
//
// IN HIS OWN WORDS, from that page, because the sentence is the licence to use
// it this way: "This is a table that relates the interest coverage ratio of a
// firm to a 'synthetic' rating and a default spread that goes with that rating.
// The link between interest coverage ratios and ratings was developed by looking
// at all rated companies in the United States. The default spreads are obtained
// from traded bonds. Adding that number to a riskfree rate should yield the
// pre-tax cost of borrowing for a firm."
//
// WITH ACKNOWLEDGEMENT TO ASWATH DAMODARAN. He states that his data carries no
// strings attached and that permission need not be asked, and asks for
// acknowledgement; there is no licence text to quote. `DATA_CONSTRAINTS.md`
// records that his written agreement is a launch-time task.
//
// WHAT THE PAGE DOES NOT GIVE. It publishes two tables and no more: one headed
// "large non-financial service firms" and one for "financial service firms". The
// small-firm ladder he has published in other years is not on this vintage, so a
// small company is rated on the large-firm bands and `DATA_CONSTRAINTS.md`
// carries the bound that puts on its spread. The page says the financial
// spreads are "slighty different"; in THIS vintage the two ladders carry the
// same ratings and the same spreads and differ only in where the coverage bands
// fall, which the generator asserts rather than assumes.

/** One band: a coverage ratio from `from` up to and including `to`, the rating
 *  it implies, and the default spread that goes with that rating. */
export interface SpreadBand {
  from: number;
  to: number;
  rating: string;
  /** The default spread over the risk-free rate, in percentage points. */
  spreadPct: number;
}

/** The vintage of every figure here, which rule 12 requires be stored. */
export const DEFAULT_SPREAD_VINTAGE = 'January 2026';
export const DEFAULT_SPREAD_CAPTURED = '2026-10-30';
export const DEFAULT_SPREAD_SOURCE =
  'https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datafile/ratings.html';
export const DEFAULT_SPREAD_PUBLISHER = 'Aswath Damodaran, NYU Stern';

/** Large non-financial service firms: EBIT over interest expense. */
export const NON_FINANCIAL_BANDS: SpreadBand[] = [
  { from: -100000, to: 0.199999, rating: 'D2/D', spreadPct: 19.00 },
  { from: 0.2, to: 0.649999, rating: 'C2/C', spreadPct: 16.00 },
  { from: 0.65, to: 0.799999, rating: 'Ca2/CC', spreadPct: 12.61 },
  { from: 0.8, to: 1.249999, rating: 'Caa/CCC', spreadPct: 8.85 },
  { from: 1.25, to: 1.499999, rating: 'B3/B-', spreadPct: 5.09 },
  { from: 1.5, to: 1.749999, rating: 'B2/B', spreadPct: 3.21 },
  { from: 1.75, to: 1.999999, rating: 'B1/B+', spreadPct: 2.75 },
  { from: 2, to: 2.2499999, rating: 'Ba2/BB', spreadPct: 1.84 },
  { from: 2.25, to: 2.49999, rating: 'Ba1/BB+', spreadPct: 1.38 },
  { from: 2.5, to: 2.999999, rating: 'Baa2/BBB', spreadPct: 1.11 },
  { from: 3, to: 4.249999, rating: 'A3/A-', spreadPct: 0.89 },
  { from: 4.25, to: 5.499999, rating: 'A2/A', spreadPct: 0.78 },
  { from: 5.5, to: 6.499999, rating: 'A1/A+', spreadPct: 0.70 },
  { from: 6.5, to: 8.499999, rating: 'Aa2/AA', spreadPct: 0.55 },
  { from: 8.5, to: 100000, rating: 'Aaa/AAA', spreadPct: 0.40 },
];

/** Financial service firms, whose bands are far lower at every rating: a bank's
 *  interest expense is a cost of its raw material, not only a cost of its
 *  borrowings, so the same coverage ratio means something different. */
export const FINANCIAL_BANDS: SpreadBand[] = [
  { from: -100000, to: 0.049999, rating: 'D2/D', spreadPct: 19.00 },
  { from: 0.05, to: 0.099999, rating: 'C2/C', spreadPct: 16.00 },
  { from: 0.1, to: 0.199999, rating: 'Ca2/CC', spreadPct: 12.61 },
  { from: 0.2, to: 0.299999, rating: 'Caa/CCC', spreadPct: 8.85 },
  { from: 0.3, to: 0.399999, rating: 'B3/B-', spreadPct: 5.09 },
  { from: 0.4, to: 0.499999, rating: 'B2/B', spreadPct: 3.21 },
  { from: 0.5, to: 0.599999, rating: 'B1/B+', spreadPct: 2.75 },
  { from: 0.6, to: 0.749999, rating: 'Ba2/BB', spreadPct: 1.84 },
  { from: 0.75, to: 0.899999, rating: 'Ba1/BB+', spreadPct: 1.38 },
  { from: 0.9, to: 1.199999, rating: 'Baa2/BBB', spreadPct: 1.11 },
  { from: 1.2, to: 1.49999, rating: 'A3/A-', spreadPct: 0.89 },
  { from: 1.5, to: 1.99999, rating: 'A2/A', spreadPct: 0.78 },
  { from: 2, to: 2.49999, rating: 'A1/A+', spreadPct: 0.70 },
  { from: 2.5, to: 2.99999, rating: 'Aa2/AA', spreadPct: 0.55 },
  { from: 3, to: 100000, rating: 'Aaa/AAA', spreadPct: 0.40 },
];

/** What a coverage ratio implies, or null where there is no coverage ratio to
 *  read — which is a company that cannot be rated, not a company with no
 *  spread. */
export function syntheticRating(
  coverage: number | null,
  opts?: { financial?: boolean }
): { rating: string; spreadPct: number; band: SpreadBand } | null {
  if (typeof coverage !== 'number' || !isFinite(coverage)) return null;
  const bands = opts?.financial ? FINANCIAL_BANDS : NON_FINANCIAL_BANDS;
  const band = bands.find((b) => coverage >= b.from && coverage <= b.to) ?? null;
  // The table runs from -100000 to 100000. A coverage ratio outside that is not
  // a company with no spread: it is a figure to look at, so the ends are held
  // rather than returning nothing.
  const held = band ?? (coverage > 0 ? bands[bands.length - 1] : bands[0]);
  return { rating: held.rating, spreadPct: held.spreadPct, band: held };
}

export default { syntheticRating, NON_FINANCIAL_BANDS, FINANCIAL_BANDS };
