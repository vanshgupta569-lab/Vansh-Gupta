// FILE: api/screener.js
//
// Marginalia — the screener's table
//
// A screener is the one screen that cannot fetch what it needs when it is
// asked. Every other screen here reads one company; this one reads every
// company at once, and fetching 178 filings to answer one page view would take
// twenty-five minutes and hammer two public sources for a result nobody waits
// that long for.
//
// So `docs/SCREENER_SPEC.md` rule 10 settles it: precompute every metric for
// every company when its data changes, into one table, and filter on request.
// This route is the "one table" half of that. It reads the payload set already
// on disk — the same payloads the verification suite measures over — turns each
// into a screener row with `src/data/screener.ts`, and serves the lot.
//
// WHY THE SAME MODULE THE SCREEN USES, AND NOT A COPY. The metric list, the
// formulas, the three states and the not-meaningful rules are the product, not
// the plumbing. A second copy here would be a second set of formulas able to
// disagree with the column headers that publish them, which is the trap
// `CLAUDE.md` lists under "two copies of a positional layout". The screen
// filters and sorts with the same functions that built these rows.
//
// WHAT THIS DOES NOT DO, and says so rather than pretending.
//
//   NO NIGHTLY PRECOMPUTE YET. Rule 10 wants the table rebuilt when a
//   company's data changes. This builds it on first request and holds it for
//   six hours, which is the same life every other route gives a payload. The
//   scheduled rebuild belongs with the archive work, not here.
//
//   NO TABLE IN PRODUCTION. The payload set is deliberately not committed —
//   the vendor-sourced figures are data this site is not licensed to
//   redistribute — so a deployment has no `verify/payloads` to read and this
//   route answers with an empty table and the reason. That is the honest state
//   of a screener built on a development data set, and the screen shows it as
//   such rather than as an error.
//
//   NOTHING VENDOR-SOURCED LEAVES AS AN EXPORT. Rule 11. Every row carries the
//   source its figures came from, so the screen can mark the 92 vendor rows and
//   refuse to put them in a download. The row is shown because the site is
//   private (launch principle 1); it is not exportable because the licence does
//   not turn on whether a page is private.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// REQUEST GUARD
//
// Repeated rather than imported, for the reason the other five routes give: on
// Vercel each file in /api is packaged as its own program, and a helper that
// does not get bundled takes the whole route down with a server error that says
// nothing useful. If any rule here changes it changes in all six files.
// ---------------------------------------------------------------------------
const ALLOWED_EXACT = new Set([
  'https://marginalia-research.vercel.app',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);

function allowedOrigin(origin) {
  if (!origin) return true;
  if (ALLOWED_EXACT.has(origin)) return true;
  return /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin);
}

function guardRequest(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Only GET is supported.' });
    return false;
  }
  const origin = req.headers?.origin;
  if (!allowedOrigin(origin)) {
    res.status(403).json({ error: 'Not an allowed origin.' });
    return false;
  }
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  return true;
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const PAYLOADS = path.join(REPO, 'verify', 'payloads');

/** Six hours, the same life a payload gets, so nothing outlives its figures. */
const TABLE_LIFE_MS = 6 * 60 * 60 * 1000;
let held = null;

// THE TABLE IS BUILT BY A SCRIPT AND SERVED AS BYTES. This route reads JSON and
// parses nothing else: a serverless function here is plain JavaScript and
// cannot import the TypeScript module the screen shares, and a JavaScript copy
// of that module would be exactly the second set of formulas this file exists
// to avoid. So `npm run screener:table` runs the real module under tsx and
// writes the result out — which is also what rule 10 asks for: precompute when
// the data changes rather than on the request.
const TABLE = path.join(REPO, 'verify', 'screener-table.json');

function readTable() {
  if (!fs.existsSync(TABLE)) {
    return {
      rows: [],
      built: null,
      unavailable:
        'The screener reads a precomputed table, and this deployment has none. The payload set it is ' +
        'built from is deliberately not committed, because the vendor-sourced figures in it are not ours ' +
        'to redistribute. Build it locally with the two commands in verify/README.md.',
    };
  }
  const table = JSON.parse(fs.readFileSync(TABLE, 'utf8'));
  return { ...table, unavailable: null };
}

export default async function handler(req, res) {
  if (!guardRequest(req, res)) return;

  try {
    if (!held || Date.now() - held.at > TABLE_LIFE_MS) {
      held = { at: Date.now(), table: readTable() };
    }
    // The table is the same for everybody, so it caches like one. A screen is
    // a question about the table, and the question is answered in the browser.
    res.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400');
    res.setHeader('Vary', 'Accept-Encoding');
    res.status(200).json(held.table);
  } catch (error) {
    // The upstream reason can name paths on the server, so it is logged and
    // never returned.
    console.error('[screener]', error && error.message ? error.message : error);
    res.setHeader('Cache-Control', 'no-store');
    res.status(502).json({
      error: 'The screener table could not be built right now.',
      rows: [],
    });
  }
}
