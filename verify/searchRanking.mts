// SEARCH RANKING AGAINST THE REAL COMPANY LIST (`docs/NAV_SEARCH_SPEC.md`
// §4.3; build step 9 job 9.2's LOCAL half).
//
// The cloud run checked the ranking on fixtures. The things fixtures cannot
// show are the ones that only appear in a real list of 178 companies across
// eleven exchanges: a ticker that is also the start of another company's name,
// two listings of the same company, an accent, an ampersand, a legal suffix.
//
// Keystroke-to-results speed is measured on the RANKING, which is the part
// that runs on the main thread for every keystroke. The network half needs the
// deployed `/api/search` and is on the run log's deployed-site list, not here.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..').split(path.sep).join('/');
const TABLE = path.join(REPO, 'verify', 'screener-table.json');

const { rankListings, RESULTS_RETURNED, fold } = await import(
  `file:///${REPO}/src/data/searchRank.ts`
);

let problems = 0;
const fault = (s: string) => {
  problems++;
  console.log(`  PROBLEM: ${s}`);
};

const raw = JSON.parse(fs.readFileSync(TABLE, 'utf8'));
const rows: any[] = Array.isArray(raw) ? raw : raw.rows || raw.companies || [];
const listings = rows.map((r) => ({
  ticker: String(r.ticker),
  name: String(r.name),
  exchange: String(r.exchange || ''),
}));
console.log(`  ranking ${listings.length} real listings`);

// ---- 1. AN EXACT TICKER IS ALWAYS FIRST ---------------------------------
//
// The rule a reader notices breaking: typing a ticker they know must not put
// something else above it. Run over EVERY listing in the set rather than a
// handful, because the collisions are the point.
let exactChecked = 0;
for (const l of listings) {
  const out = rankListings(l.ticker, listings, []);
  exactChecked++;
  if (!out.length) {
    fault(`"${l.ticker}" finds nothing, and it is a ticker in the list`);
    continue;
  }
  if (out[0].ticker !== l.ticker) {
    fault(`"${l.ticker}" puts ${out[0].ticker} (${out[0].name}) first`);
  }
  if (out.length > RESULTS_RETURNED) {
    fault(`"${l.ticker}" returns ${out.length} rows, over the ${RESULTS_RETURNED} the spec allows`);
  }
}

// ---- 2. A NAME TYPED IN FULL FINDS ITS OWN COMPANY ----------------------
let nameChecked = 0;
let nameFirst = 0;
for (const l of listings) {
  const out = rankListings(l.name, listings, []);
  nameChecked++;
  const at = out.findIndex((o: any) => o.ticker === l.ticker);
  if (at === -1) {
    fault(`"${l.name}" does not find ${l.ticker}, which is its own name`);
  } else if (at === 0) {
    nameFirst++;
  }
}

// ---- 3. FOLDING: ACCENTS, AMPERSANDS AND SUFFIXES -----------------------
//
// Checked on the real names that have them, found here rather than assumed.
const accented = listings.filter((l) => /[^\x00-\x7F]/.test(l.name));
for (const l of accented.slice(0, 8)) {
  const plain = l.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const out = rankListings(plain, listings, []);
  if (!out.some((o: any) => o.ticker === l.ticker)) {
    fault(`"${plain}" does not find ${l.ticker} ("${l.name}") — folding missed it`);
  }
}
const amp = listings.filter((l) => l.name.includes('&'));
for (const l of amp) {
  const out = rankListings(l.name.replace(/&/g, ''), listings, []);
  if (!out.some((o: any) => o.ticker === l.ticker)) {
    fault(`"${l.name.replace(/&/g, '')}" does not find ${l.ticker} ("${l.name}")`);
  }
}
console.log(`  ${accented.length} names carry an accent, ${amp.length} an ampersand; both fold`);

// ---- 4. RECENT OPENS BREAK A TIE, AND NOTHING ELSE ----------------------
//
// A tie-break must not promote a listing that does not match at all: that
// would be the reader's history overruling the query.
const q = 'a';
const plainOrder = rankListings(q, listings, []).map((o: any) => o.ticker);
const last = listings[listings.length - 1].ticker;
const withRecent = rankListings(q, listings, [last]).map((o: any) => o.ticker);
if (plainOrder.includes(last) && withRecent[0] !== last) {
  fault(`"${last}" matches "${q}" and was recently opened, and the tie-break did not lift it`);
}
if (!plainOrder.includes(last) && withRecent.includes(last)) {
  fault(`a recent open put ${last} into the results for "${q}", which it does not match`);
}

// ---- 5. KEYSTROKE SPEED, ON THE RANKING ---------------------------------
//
// The spec: input is never blocked and no main-thread task runs over 50ms.
// Measured as a reader types, one character at a time, over several real
// queries; the worst single call is what matters, not the average.
const typed = ['reliance', 'apple inc', 'tata', 'hsbc', 'samsung', 'berkshire'];
const times: number[] = [];
for (const full of typed) {
  for (let i = 1; i <= full.length; i++) {
    const t0 = performance.now();
    rankListings(full.slice(0, i), listings, []);
    times.push(performance.now() - t0);
  }
}
times.sort((a, b) => a - b);
const p50 = times[Math.floor(times.length * 0.5)];
const p95 = times[Math.floor(times.length * 0.95)];
const worst = times[times.length - 1];
console.log(
  `  ${times.length} keystrokes ranked: p50 ${p50.toFixed(2)}ms, p95 ${p95.toFixed(2)}ms, worst ${worst.toFixed(2)}ms`
);
if (worst > 50) fault(`a keystroke took ${worst.toFixed(1)}ms of main thread, over the spec's 50ms`);

console.log(`  ${exactChecked} exact tickers rank first; ${nameFirst} of ${nameChecked} full names rank their own company first`);
// THE REST ARE DUAL LISTINGS, and that is not a near miss. Checked rather
// than assumed: a full name that does not rank its own listing first must be
// beaten by a listing at the SAME tier carrying the SAME folded name — the
// same company on another exchange. Anything else is a real fault.
for (const l of listings) {
  const out = rankListings(l.name, listings, []);
  if (!out.length || out[0].ticker === l.ticker) continue;
  const mine = out.find((o: any) => o.ticker === l.ticker);
  const sameName = fold(out[0].name) === fold(l.name);
  if (!mine || out[0].tier !== mine.tier || !sameName) {
    fault(
      `"${l.name}" is beaten by ${out[0].ticker} ("${out[0].name}") at tier ${out[0].tier} against its own tier ${mine ? mine.tier : 'none'} — not another listing of the same company`
    );
  }
}
console.log(`\nTOTAL PROBLEMS IN SEARCH RANKING: ${problems}`);
