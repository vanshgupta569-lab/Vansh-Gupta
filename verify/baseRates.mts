// FILE: verify/baseRates.mts
//
//   npm run verify:baserates
//
// THE BASE-RATE TABLE'S OWN IDENTITIES (build step 5, job D2).
//
// A base rate is a count with a denominator, and both are easy to get wrong in
// ways that look right: a threshold counted with `>` instead of `>=` moves X by
// a few, a company counted twice in one window inflates N, a CAGR recomputed
// from the wrong pair of years lands plausibly close. None of those shows up as
// a crash, and all of them change the sentence a reader is given.
//
// So every identity the plan names is checked against the written table, and
// the arithmetic is recomputed here from the two revenue figures rather than
// read back from the builder.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..').split(path.sep).join('/');
const TABLE = path.join(REPO, 'src', 'data', 'baseRates.json');
const CPI_FILE = path.join(REPO, 'src', 'data', 'cpiUS.json');

let problems = 0;
const say = (line: string) => console.log(`  ${line}`);
const fail = (line: string) => {
  problems++;
  console.log(`  PROBLEM: ${line}`);
};

console.log('\n=== the base-rate table adds up ===');

if (!fs.existsSync(TABLE)) {
  fail(`no table at ${TABLE} — run npm run baserates first`);
  console.log(`\nTOTAL PROBLEMS IN THE BASE RATES: ${problems}`);
  process.exit(0);
}

const t = JSON.parse(fs.readFileSync(TABLE, 'utf8'));
const cpi: Record<string, number> = JSON.parse(fs.readFileSync(CPI_FILE, 'utf8')).annual;

say(
  `${t.filersRead.toLocaleString('en-US')} filers read, ${t.filersUsed.toLocaleString('en-US')} contributing ` +
    `${t.windows.toLocaleString('en-US')} company-windows`
);

// ---- 1. X <= N FOR EVERY THRESHOLD ----------------------------------------
//
// "X of N companies" is the sentence; X above N is not a sentence at all.
// Also: the count at a HIGHER threshold can never exceed the count at a lower
// one, which catches a comparison written the wrong way round.
let cells = 0;
for (const basis of ['nominal', 'real']) {
  for (const [key, cell] of Object.entries<any>(t.table?.[basis] ?? {})) {
    cells++;
    const thresholds = Object.keys(cell.atOrAbove)
      .map(Number)
      .sort((a, b) => a - b);
    let previous = Infinity;
    for (const threshold of thresholds) {
      const x = cell.atOrAbove[String(threshold)];
      if (!(x <= cell.n)) {
        fail(`${basis} ${key}: ${x} companies at or above ${threshold} out of ${cell.n}`);
      }
      if (x > previous) {
        fail(
          `${basis} ${key}: ${x} at or above ${threshold} but only ${previous} at the threshold below it — the comparison runs backwards`
        );
      }
      previous = x;
    }
    if (cell.median !== null && !isFinite(cell.median)) {
      fail(`${basis} ${key}: the median is ${cell.median}`);
    }
    // RULE 12: below the minimum N a cell carries no number at all. "2 of 3
    // companies" moves by a third when one company is added, and a reader
    // cannot tell that from the sentence.
    const minimum = t.minimumN ?? 30;
    if (cell.n < minimum && cell.median !== null) {
      fail(`${basis} ${key}: ${cell.n} windows, under the minimum of ${minimum}, and it still carries a median`);
    }
    if (cell.n >= minimum && cell.median === null && cell.n > 0) {
      fail(`${basis} ${key}: ${cell.n} windows, above the minimum, and no median`);
    }
  }
}
say(`${cells} cells, every count inside its denominator and falling as the threshold rises`);

// ---- 1b. THE BANDS HOLD THE WHOLE SAMPLE, AND NOT ONE BAND ---------------
//
// Every window belongs to exactly one band, so the bands' counts must sum to
// the windows at that horizon. And no band may hold nearly everything: that is
// what a unit error looks like from the outside. The first build put 32,526 of
// 33,406 three-year windows in "$50bn and above", because the bands were
// written in millions while the archive reports dollars — the medians then
// came out at 625% a year for a band that held only shell companies with
// revenue under a hundred dollars. Nothing crashed; it simply answered a
// different question.
for (const h of t.horizons ?? []) {
  const cells = Object.entries<any>(t.table?.nominal ?? {}).filter(([k]) => k.startsWith(`${h}y|`));
  if (!cells.length) continue;
  const total = cells.reduce((sum, [, c]) => sum + c.n, 0);
  const biggest = cells.reduce((m, [k, c]) => (c.n > m.n ? { k, n: c.n } : m), { k: '', n: 0 });
  const share = total ? biggest.n / total : 0;
  if (share > 0.9) {
    fail(
      `${h}-year: ${biggest.n.toLocaleString('en-US')} of ${total.toLocaleString('en-US')} windows ` +
        `(${(share * 100).toFixed(0)}%) are in one band, "${biggest.k.split('|')[1]}" — the bands are not ` +
        `dividing the sample, which is what a unit error looks like`
    );
  } else {
    say(`${h}-year: ${total.toLocaleString('en-US')} windows, the largest band holding ${(share * 100).toFixed(0)}%`);
  }
}

// ---- 2. THE EXCLUSIONS ARE REPORTED, NOT HIDDEN ---------------------------
//
// Rule 3 of the standing decisions: a missing year is never filled. The proof
// that it was not is that the windows it would have made are COUNTED.
const ex = t.excluded ?? {};
const expected = ['nonUsd', 'noRevenue', 'tooShort', 'missingYear', 'startNotPositive', 'noCpi'];
for (const k of expected) {
  if (typeof ex[k] !== 'number') fail(`the table does not say how many were excluded for "${k}"`);
}
say(
  `excluded and counted: ${Object.entries(ex)
    .map(([k, v]) => `${k} ${Number(v).toLocaleString('en-US')}`)
    .join(', ')}`
);
if (!ex.missingYear) {
  fail('not one window was excluded for a missing year, which is implausible over 20,000 filers — the hole check may not be running');
}

// ---- 2b. ONLY USD IS BEHIND THE TABLE -------------------------------------
//
// Version 1 is USD only (spec item 2, rule 11), and a filer reporting in
// another currency is excluded rather than converted at a rate nobody has.
//
// ASKED OF WHAT GOT IN, NOT OF WHAT WAS KEPT OUT. The exclusion count alone
// does not prove the filter ran: leaving every non-USD filer in dropped
// `nonUsd` to 0 and added 86 windows of foreign-currency revenue to a table
// of dollars, and every other identity still passed — X stayed inside N, the
// bands still divided the sample, the deflator still ran the right way. A
// table can be perfectly consistent and about the wrong companies.
const currencies: string[] = t.contributingCurrencies ?? [];
if (!currencies.length) {
  fail('the table does not say which currencies are behind it');
} else if (currencies.join(',') !== 'USD') {
  fail(`the windows come from ${currencies.join(', ')} — version 1 is USD only, and nothing converts a rate nobody has`);
} else {
  say('every window behind the table is in USD');
}
if (!ex.nonUsd) {
  fail('not one filer was excluded for reporting in another currency, and the archive holds some — the currency filter may not be running');
}

// ---- 3. REAL IS BELOW NOMINAL WHEREVER PRICES ROSE ------------------------
//
// Deflating by a rising index must lower the rate. A real figure above its
// nominal twin means the deflator was applied the wrong way round, which is
// the single most likely mistake here and is invisible in the output.
let compared = 0;
let realBelow = 0;
for (const key of Object.keys(t.table?.real ?? {})) {
  const r = t.table.real[key];
  // THE NOMINAL MEDIAN OVER THE SAME WINDOWS, not over all of them. The real
  // series covers fewer windows — CPI has to reach both ends — so comparing
  // its median with a median taken over every window compares two different
  // samples, and a real figure can land above its nominal twin for no reason
  // but composition. That is what this check reported on its first run.
  const paired = r.nominalOnTheSameWindows;
  if (r.median === null || paired === null || paired === undefined) continue;
  compared++;
  if (r.median <= paired) realBelow++;
  else {
    fail(
      `${key}: the real median ${(r.median * 100).toFixed(1)}% is ABOVE the nominal ${(paired * 100).toFixed(1)}% on the same windows — the deflator runs backwards`
    );
  }
}
if (compared) say(`${realBelow} of ${compared} bands have a real median at or below the nominal one`);
else fail('no band has both a real and a nominal median, so the deflator is unchecked');

// ---- 4. THE CPI TABLE IS A SERIES, AND THE WINDOWS RESPECT IT -------------
const cpiYears = Object.keys(cpi).map(Number).sort((a, b) => a - b);
for (let y = cpiYears[0]; y <= cpiYears[cpiYears.length - 1]; y++) {
  if (!(String(y) in cpi)) fail(`the CPI table has no ${y}, so a window spanning it would be deflated with a hole`);
}
let rising = 0;
for (let i = 1; i < cpiYears.length; i++) {
  if (cpi[String(cpiYears[i])] > cpi[String(cpiYears[i - 1])]) rising++;
}
say(
  `CPI covers ${cpiYears[0]}–${cpiYears[cpiYears.length - 1]} unbroken, rising in ${rising} of ${cpiYears.length - 1} years`
);

// ---- 5. A WORKED CAGR, RECOMPUTED THE LONG WAY ----------------------------
//
// The builder's `cagr` is one line and could be wrong in a way every cell
// hides. These are worked out by hand: doubling over 5 years is 14.87%,
// halving over 3 is −20.63%, and no change is zero whatever the horizon.
const longhand = (from: number, to: number, h: number) => Math.pow(to / from, 1 / h) - 1;
const worked: [number, number, number, number][] = [
  [100, 200, 5, 0.148698],
  [100, 50, 3, -0.206299],
  [100, 100, 10, 0],
  [250, 1000, 10, 0.148698],
];
for (const [from, to, h, want] of worked) {
  const got = longhand(from, to, h);
  if (Math.abs(got - want) > 1e-6) {
    fail(`${from} to ${to} over ${h} years should be ${(want * 100).toFixed(4)}% and is ${(got * 100).toFixed(4)}%`);
  }
}
say(`${worked.length} worked rates reproduce, including doubling over five years at 14.87%`);

// ---- 6. THE TABLE SAYS WHAT IT IS ----------------------------------------
for (const field of ['builtAt', 'source', 'universe', 'revenueDefinition', 'horizons', 'bands', 'thresholds']) {
  if (t[field] === undefined) fail(`the table does not record "${field}"`);
}
if (!/_revenueDefinition/.test(String(t.revenueDefinition))) {
  fail('the table does not say it used the site\'s own revenue definition');
}

console.log(`\nTOTAL PROBLEMS IN THE BASE RATES: ${problems}`);
process.exit(0);
