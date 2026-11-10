// FILE: src/data/searchRank.ts
//
// HOW THE SEARCH PALETTE ORDERS WHAT IT FINDS (`docs/NAV_SEARCH_SPEC.md`
// §4.3; build step 9, job 9.2). The listings come from `/api/search` (one
// row per listing, as the search screen already shows them); this decides
// their order, so the order is the spec's whatever the source returns.
//
//   1. the ticker exactly, including the TICKER.EXCHANGE form (RELIANCE.NS);
//   2. an ISIN — not offered: no listing carries one yet ([CONFIRM] in the
//      spec; PROPOSED — needs Nihar: ISIN search ships with the field);
//   3. the name starts with the query;
//   4. a word of the name starts with the query;
//   5. a near miss on the name: one edit for a query of 5 or more
//      characters, two for 9 or more;
//   6. the ticker starts with the query.
//
// Matching ignores case, accents and punctuation (Nestlé = Nestle, AT&T =
// ATT) and legal suffixes (Inc, Ltd, plc, AG …); the display name keeps
// them. Ties go to this reader's recent opens, then the source's own order,
// then the name A→Z. The spec's second tie-break, market capitalisation,
// needs a figure the search source does not return; the source ranks by
// relevance and size, so its order stands in (PROPOSED — needs Nihar). No
// location bias. A listing none of the six explains is kept, last, in the
// source's own order, so a search never hides a listing the source found.

export interface Listing {
  ticker: string;
  name: string;
  exchange: string;
  type?: string;
}

export interface Ranked extends Listing {
  tier: number;
  /** ISO 3166 alpha-2, from the exchange, or '' when the exchange is unknown. */
  country: string;
  /** [start, end) ranges of `name` that matched, for the bold. */
  matched: [number, number][];
}

export const RESULTS_RETURNED = 10;
export const RESULTS_SHOWN = 8;

const LEGAL = new Set([
  'inc', 'incorporated', 'corp', 'corporation', 'co', 'company', 'ltd', 'limited', 'plc', 'llc', 'lp', 'llp',
  'ag', 'sa', 'se', 'nv', 'bv', 'spa', 'ab', 'asa', 'oyj', 'as', 'kk', 'pte', 'pty', 'bhd', 'tbk', 'the',
]);

/** Lower case, no accents, no punctuation; words kept apart by single spaces. */
export function fold(text: string): string {
  return String(text ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[&'\u2019.]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** The words that identify a company, legal suffixes dropped. */
export function nameWords(name: string): string[] {
  const words = fold(name).split(' ').filter(Boolean);
  const kept = words.filter((w) => !LEGAL.has(w));
  return kept.length ? kept : words;
}

/** Levenshtein distance, stopping early once it passes `limit`. */
export function editDistance(a: string, b: string, limit = 2): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, cur[j]);
    }
    if (best > limit) return limit + 1;
    prev = cur;
  }
  return prev[b.length];
}

/** The exchange a listing trades on, as a country code (no flag). */
export function countryFor(exchange: string): string {
  const e = String(exchange || '').toUpperCase();
  if (/NASDAQ|NYSE|AMEX|ARCA|OTC|BATS|CBOE/.test(e)) return 'US';
  if (/\bNSE\b|\bBSE\b|NATIONAL STOCK EXCHANGE OF INDIA|BOMBAY/.test(e)) return 'IN';
  if (/\bLSE\b|LONDON|\bIOB\b/.test(e)) return 'GB';
  if (/TSX|TORONTO|\bCSE\b|NEO/.test(e)) return 'CA';
  if (/TOKYO|\bTSE\b|JPX/.test(e)) return 'JP';
  if (/XETRA|FRANKFURT|\bGER\b/.test(e)) return 'DE';
  if (/PARIS|EURONEXT PARIS/.test(e)) return 'FR';
  if (/AMSTERDAM/.test(e)) return 'NL';
  if (/HKSE|HONG KONG|\bHKG\b/.test(e)) return 'HK';
  if (/\bASX\b|AUSTRALIA/.test(e)) return 'AU';
  if (/SWISS|\bSIX\b/.test(e)) return 'CH';
  return '';
}

const tierOf = (q: string, l: Listing): { tier: number; matched: [number, number][] } => {
  const ticker = l.ticker.toLowerCase();
  const qt = q.trim().toLowerCase();
  const fq = fold(q);
  const words = nameWords(l.name);
  const joined = words.join(' ');
  const where = (needle: string): [number, number][] => {
    // Bold the first place the folded query appears in the display name,
    // compared character by character in folded form.
    const name = l.name;
    const foldedChars = Array.from(name).map((ch) => fold(ch));
    let flat = '';
    const map: number[] = [];
    foldedChars.forEach((f, i) => { for (const c of f) { flat += c; map.push(i); } });
    const at = flat.indexOf(needle.replace(/ /g, ''));
    if (at < 0 || !needle) return [];
    return [[map[at], map[at + needle.replace(/ /g, '').length - 1] + 1]];
  };
  if (qt && ticker === qt) return { tier: 1, matched: [] };
  if (fq && joined.startsWith(fq)) return { tier: 3, matched: where(fq) };
  if (fq && words.some((w, i) => words.slice(i).join(' ').startsWith(fq))) return { tier: 4, matched: where(fq) };
  if (fq.length >= 5) {
    const limit = fq.length >= 9 ? 2 : 1;
    const head = joined.slice(0, fq.length);
    const near = editDistance(fq, head, limit) <= limit || words.some((w) => editDistance(fq, w, limit) <= limit);
    if (near) return { tier: 5, matched: [] };
  }
  if (qt && ticker.startsWith(qt)) return { tier: 6, matched: [] };
  return { tier: 7, matched: [] };
};

/**
 * The listings in the spec's order, at most `RESULTS_RETURNED`. `recent` is
 * the reader's recently opened tickers, newest first.
 */
export function rankListings(query: string, listings: Listing[], recent: string[] = []): Ranked[] {
  const seen = new Set<string>();
  const rows = listings
    .filter((l) => l && l.ticker && !seen.has(l.ticker.toUpperCase()) && seen.add(l.ticker.toUpperCase()))
    .map((l, i) => {
      const t = tierOf(query, l);
      const r = recent.indexOf(l.ticker);
      return { ...l, ...t, country: countryFor(l.exchange), _i: i, _recent: r < 0 ? Infinity : r };
    });
  rows.sort(
    (a, b) =>
      a.tier - b.tier ||
      a._recent - b._recent ||
      a._i - b._i ||
      a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) ||
      a.ticker.localeCompare(b.ticker)
  );
  return rows.slice(0, RESULTS_RETURNED).map(({ _i, _recent, ...r }) => r);
}

export default { fold, nameWords, editDistance, countryFor, rankListings, RESULTS_RETURNED, RESULTS_SHOWN };
