// FILE: scripts/buildBaseRates.mts
//
//   npm run baserates
//
// HOW OFTEN COMPANIES ACTUALLY GREW AT A GIVEN RATE (build step 5, job D2).
// `docs/BASE_RATE_SPEC.md`.
//
// When a reader assumes 15% revenue growth for five years, the question this
// answers is "how many comparable companies managed that in the past" — a fact
// about a group's history, never a forecast for this company and never a
// verdict on the assumption (rule 16).
//
// WHERE THE NUMBERS COME FROM. The SEC's bulk company-facts archive: 20,571
// filers, 1.33GB compressed and 18.16GB unpacked (job D0). It is STREAMED
// entry by entry and never expanded, because 18GB of JSON on disk to read each
// file once is a cost with nothing to show for it.
//
// THE RULES THIS FOLLOWS, each from the spec, each visible in the output:
//
//   - ONE REVENUE DEFINITION, shared with the fetcher (job D1,
//     `api/_revenueDefinition.js`). A base rate built on a different revenue
//     line from the one the site models would describe a universe this site
//     does not model, and nothing would say so.
//   - A MISSING YEAR IS NEVER FILLED (standing decision 3). A window with a
//     hole is excluded and counted, not interpolated; interpolation would
//     invent the very growth being measured.
//   - USD ONLY in version 1 (spec item 2 and rule 11), and a filer whose
//     figures are in another currency is excluded and counted rather than
//     converted at a rate nobody has.
//   - REAL AND NOMINAL BOTH, labelled (rule 7), deflated with BLS CPI-U
//     (`src/data/cpiUS.json`). A window whose years are not all covered by the
//     CPI table gets a nominal figure and no real one, rather than a real
//     figure deflated with a guess.
//   - EVERY COUNT WITH ITS DENOMINATOR (rule 5), and the excluded counts
//     reported rather than hidden in a difference.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..').split(path.sep).join('/');
const ZIP = path.join(REPO, '.sec-bulk', 'companyfacts.zip');
const OUT = path.join(REPO, 'src', 'data', 'baseRates.json');
const CPI_FILE = path.join(REPO, 'src', 'data', 'cpiUS.json');

const { TOTAL_REVENUE_FIRST, FINANCIAL_REVENUE_TAGS } = await import(
  `file:///${REPO}/api/_revenueDefinition.js`
);

/** The horizons the spec names. */
const HORIZONS = [3, 5, 10];

/**
 * THE SIZE BANDS, in starting revenue, one stated currency (rule 8).
 *
 * Fixed in advance and never chosen per question, because a group picked after
 * seeing the answer is not a base rate. The boundaries are round numbers in
 * millions of USD, which is the unit the filings are in.
 */
// IN DOLLARS, WHICH IS WHAT THE ARCHIVE REPORTS. Written in millions first,
// and the mistake was invisible until the table was read: every real company's
// revenue in dollars is above 50,000, so 32,526 of 33,406 three-year windows
// landed in the top band and "under $100m" held only shell companies with
// revenue under a hundred DOLLARS — whose medians came out at 625% a year.
// A unit error does not crash; it just answers a different question.
const M = 1_000_000;
const BANDS: [string, number, number][] = [
  ['under $100m', 0, 100 * M],
  ['$100m–$1bn', 100 * M, 1_000 * M],
  ['$1bn–$5bn', 1_000 * M, 5_000 * M],
  ['$5bn–$25bn', 5_000 * M, 25_000 * M],
  ['$25bn–$50bn', 25_000 * M, 50_000 * M],
  ['$50bn and above', 50_000 * M, Infinity],
];

/**
 * BELOW THIS MANY WINDOWS A CELL CARRIES NO NUMBER (rule 12, DECIDED: 30).
 *
 * "2 of 3 companies" is arithmetic, not a base rate: it moves by a third if
 * one company is added, and a reader cannot tell that from the sentence. Such
 * a cell says "too few comparable companies" instead, and the builder writes
 * `median: null` so nothing downstream can print one by accident. No cell is
 * below it today — the smallest holds 150 — but that is the data's doing, not
 * a rule, and a narrower band in a later rebuild would publish a number.
 */
const MINIMUM_N = 30;

/** The thresholds a reader's assumption is compared against (rule 5). */
const THRESHOLDS = [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3];

const cpi: Record<string, number> = JSON.parse(fs.readFileSync(CPI_FILE, 'utf8')).annual;

const bandOf = (revenue: number) =>
  BANDS.find(([, lo, hi]) => revenue >= lo && revenue < hi)?.[0] ?? null;

// ---------------------------------------------------------------------------
// READING THE ARCHIVE, ONE ENTRY AT A TIME
// ---------------------------------------------------------------------------
//
// The zip's central directory says where every entry's data begins; each is
// inflated on its own and thrown away. Peak memory is one company's facts.
function* entries(zipPath: string): Generator<{ name: string; data: Buffer }> {
  const fd = fs.openSync(zipPath, 'r');
  try {
    const { size } = fs.statSync(zipPath);
    const tail = Buffer.alloc(Math.min(size, 66 * 1024));
    fs.readSync(fd, tail, 0, tail.length, size - tail.length);
    let eocd = -1;
    for (let i = tail.length - 22; i >= 0; i--) if (tail.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('not a zip this can read');
    let dirSize = tail.readUInt32LE(eocd + 12);
    let dirAt = tail.readUInt32LE(eocd + 16);
    if (dirAt === 0xffffffff || dirSize === 0xffffffff) {
      for (let i = tail.length - 20; i >= 0; i--) {
        if (tail.readUInt32LE(i) === 0x07064b50) {
          const z64At = Number(tail.readBigUInt64LE(i + 8));
          const z64 = Buffer.alloc(56);
          fs.readSync(fd, z64, 0, 56, z64At);
          dirSize = Number(z64.readBigUInt64LE(40));
          dirAt = Number(z64.readBigUInt64LE(48));
          break;
        }
      }
    }
    const dir = Buffer.alloc(dirSize);
    fs.readSync(fd, dir, 0, dirSize, dirAt);
    let at = 0;
    while (at < dir.length - 46) {
      if (dir.readUInt32LE(at) !== 0x02014b50) break;
      const method = dir.readUInt16LE(at + 10);
      let compressed = dir.readUInt32LE(at + 20);
      const nameLen = dir.readUInt16LE(at + 28);
      const extraLen = dir.readUInt16LE(at + 30);
      const commentLen = dir.readUInt16LE(at + 32);
      let localAt = dir.readUInt32LE(at + 42);
      const name = dir.subarray(at + 46, at + 46 + nameLen).toString('utf8');
      if (compressed === 0xffffffff || localAt === 0xffffffff) {
        const extra = dir.subarray(at + 46 + nameLen, at + 46 + nameLen + extraLen);
        let e = 0;
        const got: number[] = [];
        while (e < extra.length - 4) {
          const id = extra.readUInt16LE(e);
          const len = extra.readUInt16LE(e + 2);
          if (id === 0x0001) for (let k = 0; k + 8 <= len; k += 8) got.push(Number(extra.readBigUInt64LE(e + 4 + k)));
          e += 4 + len;
        }
        // zip64 order: uncompressed, compressed, local header offset.
        if (got.length >= 2 && compressed === 0xffffffff) compressed = got[1];
        if (got.length >= 3 && localAt === 0xffffffff) localAt = got[2];
      }
      at += 46 + nameLen + extraLen + commentLen;
      if (!/\.json$/i.test(name)) continue;

      // The local header repeats the name and may carry its own extra field.
      const lh = Buffer.alloc(30);
      fs.readSync(fd, lh, 0, 30, localAt);
      const lhName = lh.readUInt16LE(26);
      const lhExtra = lh.readUInt16LE(28);
      const dataAt = localAt + 30 + lhName + lhExtra;
      const raw = Buffer.alloc(compressed);
      fs.readSync(fd, raw, 0, compressed, dataAt);
      let data: Buffer;
      try {
        data = method === 0 ? raw : zlib.inflateRawSync(raw);
      } catch {
        continue;
      }
      yield { name, data };
    }
  } finally {
    fs.closeSync(fd);
  }
}

// ---------------------------------------------------------------------------
// ONE FILER'S ANNUAL REVENUE, BY YEAR
// ---------------------------------------------------------------------------
//
// The same three rules the fetcher reads by: undimensioned annual facts from a
// 10-K, a period of about a year, and the most recently filed figure winning
// where a year was restated.
function revenueByYear(facts: any): { years: Map<number, number>; currency: string | null; tag: string | null } {
  const isFinancial = Boolean(facts['us-gaap']?.RevenuesNetOfInterestExpense);
  const order: string[] = isFinancial ? FINANCIAL_REVENUE_TAGS : TOTAL_REVENUE_FIRST;
  for (const tag of order) {
    const entry = facts['us-gaap']?.[tag];
    if (!entry?.units) continue;
    const unit = Object.keys(entry.units)[0];
    if (!unit) continue;
    const best = new Map<number, { val: number; filed: string }>();
    for (const point of entry.units[unit] || []) {
      if (typeof point.val !== 'number' || !point.end || !point.start) continue;
      if (!String(point.form || '').startsWith('10-K')) continue;
      const days = (Date.parse(point.end) - Date.parse(point.start)) / 86400000;
      if (days < 300 || days > 400) continue;
      const year = Number(String(point.end).slice(0, 4));
      if (!year) continue;
      const held = best.get(year);
      if (!held || String(point.filed || '') > held.filed) best.set(year, { val: point.val, filed: String(point.filed || '') });
    }
    if (best.size >= 2) {
      return { years: new Map([...best].map(([y, v]) => [y, v.val])), currency: unit, tag };
    }
  }
  return { years: new Map(), currency: null, tag: null };
}

/** The compound annual rate between two figures, h years apart. */
const cagr = (from: number, to: number, h: number) => Math.pow(to / from, 1 / h) - 1;

// ---------------------------------------------------------------------------
// THE RUN
// ---------------------------------------------------------------------------
if (!fs.existsSync(ZIP)) {
  console.log('no archive: run `npm run sec:bulk -- download` first');
  process.exit(1);
}

type Window = { cik: string; band: string; horizon: number; startYear: number; nominal: number; real: number | null };
const windows: Window[] = [];
const excluded = {
  nonUsd: 0,
  tooShort: 0,
  noRevenue: 0,
  missingYear: 0,
  startNotPositive: 0,
  noCpi: 0,
};
// THE CURRENCIES THAT ACTUALLY CONTRIBUTED A WINDOW. Writing down what was
// excluded proves nothing about what got IN: the check needs to see the
// currencies behind the table, or a filter that stops running is invisible.
const contributingCurrencies = new Set<string>();
let filers = 0;
let used = 0;
const started = Date.now();

for (const { name, data } of entries(ZIP)) {
  filers++;
  if (filers % 2000 === 0) {
    process.stdout.write(`  ${filers} filers read, ${windows.length} windows so far\r`);
  }
  let facts: any;
  try {
    facts = JSON.parse(data.toString('utf8')).facts;
  } catch {
    continue;
  }
  if (!facts) continue;
  const { years, currency } = revenueByYear(facts);
  if (!years.size) {
    excluded.noRevenue++;
    continue;
  }
  if (currency !== 'USD') {
    excluded.nonUsd++;
    continue;
  }
  const cik = (name.match(/CIK(\d{10})/i) || [])[1] || name;
  const sorted = [...years.keys()].sort((a, b) => a - b);
  if (sorted.length < 4) {
    excluded.tooShort++;
    continue;
  }
  let any = false;
  for (const h of HORIZONS) {
    for (const start of sorted) {
      const end = start + h;
      const from = years.get(start);
      const to = years.get(end);
      if (from === undefined || to === undefined) {
        // A hole is a hole: the window is excluded and counted, never filled.
        if (end <= sorted[sorted.length - 1]) excluded.missingYear++;
        continue;
      }
      if (!(from > 0)) {
        // A CAGR from zero or a negative start is undefined (rule, item 8).
        excluded.startNotPositive++;
        continue;
      }
      const band = bandOf(from);
      if (!band) continue;
      const nominal = cagr(from, to, h);
      // Real only where the CPI table covers BOTH ends. Never a guess.
      const pFrom = cpi[String(start)];
      const pTo = cpi[String(end)];
      let real: number | null = null;
      if (pFrom && pTo) real = cagr(from / pFrom, to / pTo, h);
      else excluded.noCpi++;
      windows.push({ cik, band, horizon: h, startYear: start, nominal, real });
      any = true;
    }
  }
  if (any) {
    used++;
    contributingCurrencies.add(String(currency));
  }
}
process.stdout.write('\r');

// ---- the table -------------------------------------------------------------
type Cell = { n: number; tooFew: boolean; atOrAbove: Record<string, number>; median: number | null; nominalOnTheSameWindows: number | null };
const table: Record<string, Record<string, Cell>> = {};
for (const basis of ['nominal', 'real'] as const) {
  for (const h of HORIZONS) {
    for (const [band] of BANDS) {
      const key = `${basis}|${h}|${band}`;
      const rows = windows
        .filter((w) => w.horizon === h && w.band === band)
        .map((w) => (basis === 'real' ? w.real : w.nominal))
        .filter((v): v is number => v !== null && isFinite(v))
        .sort((a, b) => a - b);
      if (!rows.length) continue;
      const atOrAbove: Record<string, number> = {};
      for (const t of THRESHOLDS) atOrAbove[String(t)] = rows.filter((v) => v >= t).length;
      const mid = Math.floor(rows.length / 2);
      // AND THE NOMINAL MEDIAN OVER THE WINDOWS THAT HAVE A REAL ONE, so the
      // two can be compared like for like. The real series covers fewer
      // windows (CPI has to reach both ends), and comparing a median over all
      // of them with a median over a subset compares two different samples —
      // which is how a real figure can come out ABOVE its nominal twin and
      // look like the deflator was applied backwards.
      const paired = windows
        .filter((w) => w.horizon === h && w.band === band && w.real !== null && isFinite(w.real))
        .map((w) => w.nominal)
        .sort((a, b) => a - b);
      const pmid = Math.floor(paired.length / 2);
      const tooFew = rows.length < MINIMUM_N;
      (table[basis] ||= {})[`${h}y|${band}`] = {
        n: rows.length,
        tooFew,
        atOrAbove,
        median: tooFew ? null : rows.length % 2 ? rows[mid] : (rows[mid - 1] + rows[mid]) / 2,
        nominalOnTheSameWindows: paired.length
          ? paired.length % 2
            ? paired[pmid]
            : (paired[pmid - 1] + paired[pmid]) / 2
          : null,
      };
    }
  }
}

const cpiYears = Object.keys(cpi).sort();
fs.writeFileSync(
  OUT,
  JSON.stringify(
    {
      builtAt: new Date().toISOString(),
      source: 'SEC XBRL bulk company facts; CPI-U from the US Bureau of Labor Statistics',
      universe: 'US filers reporting annual revenue in USD on a 10-K',
      revenueDefinition: 'api/_revenueDefinition.js, the same definition the site models with',
      horizons: HORIZONS,
      bands: BANDS.map(([label]) => label),
      thresholds: THRESHOLDS,
      minimumN: MINIMUM_N,
      cpiCovers: cpiYears.length ? `${cpiYears[0]}–${cpiYears[cpiYears.length - 1]}` : null,
      filersRead: filers,
      filersUsed: used,
      contributingCurrencies: [...contributingCurrencies].sort(),
      windows: windows.length,
      excluded,
      table,
    },
    null,
    2
  ) + '\n'
);

const secs = (Date.now() - started) / 1000;
console.log(`\n=== base rates built in ${secs.toFixed(0)}s ===`);
console.log(`  ${filers.toLocaleString('en-US')} filers read, ${used.toLocaleString('en-US')} contributed a window`);
console.log(`  ${windows.length.toLocaleString('en-US')} company-windows`);
console.log(
  `  excluded — not USD ${excluded.nonUsd.toLocaleString('en-US')}, no revenue ${excluded.noRevenue.toLocaleString('en-US')},` +
    ` too short ${excluded.tooShort.toLocaleString('en-US')}, a missing year ${excluded.missingYear.toLocaleString('en-US')},` +
    ` start not positive ${excluded.startNotPositive.toLocaleString('en-US')}, no CPI for both ends ${excluded.noCpi.toLocaleString('en-US')}`
);
for (const h of HORIZONS) {
  const cells = Object.entries(table.nominal || {}).filter(([k]) => k.startsWith(`${h}y|`));
  const n = cells.reduce((t, [, c]) => t + c.n, 0);
  console.log(`  ${h}-year, nominal: ${n.toLocaleString('en-US')} windows across ${cells.length} bands`);
}
console.log(`  written to ${OUT}`);
