// FILE: scripts/buildScreenerTable.mts
//
//   npm run screener:table
//
// Turns the payload set into the one table the screener filters
// (`docs/SCREENER_SPEC.md` rule 10: precompute every metric for every company
// when its data changes, then filter on request).
//
// It runs the SAME module the screen uses — `src/data/screener.ts` — rather
// than a copy, so a formula published on a column header cannot differ from the
// one that produced the figure under it. That is why this is a script run under
// tsx and not code inside `api/screener.js`: a serverless function there is
// plain JavaScript and cannot import the TypeScript module.
//
// The output is NOT COMMITTED, for the same reason the payload set is not: 92
// of the 178 rows carry vendor-sourced figures this site is not licensed to
// redistribute. Every row says which source it came from so the screen can
// mark them and keep them out of any export (rule 11).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { screenerRow, markHomeListings, SCREENER_METRICS } from '../src/data/screener';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const PAYLOADS = path.join(REPO, 'verify', 'payloads');
const OUT = path.join(REPO, 'verify', 'screener-table.json');

if (!fs.existsSync(PAYLOADS)) {
  console.error(
    `No payload set at ${PAYLOADS}. Run \`npm run verify:payloads\` first — the screener has nothing to ` +
      'filter until the set exists.'
  );
  process.exit(1);
}

const files = fs.readdirSync(PAYLOADS).filter((f) => f.endsWith('.json'));
const rows: any[] = [];
const refused: string[] = [];
let unreadable = 0;

for (const file of files) {
  let payload: any;
  try {
    payload = JSON.parse(fs.readFileSync(path.join(PAYLOADS, file), 'utf8'));
  } catch {
    unreadable++;
    continue;
  }
  const row = screenerRow(payload);
  if (!row) {
    refused.push(file.replace('.json', ''));
    continue;
  }
  rows.push(row);
}

const table = {
  built: new Date().toISOString(),
  held: files.length,
  refused: refused.length,
  unreadable,
  metrics: SCREENER_METRICS.map((m) => m.key),
  rows: markHomeListings(rows),
};

fs.writeFileSync(OUT, JSON.stringify(table));

// WHAT THE TABLE IS, said by the tool that built it rather than left to be
// discovered by a measurement run that stops (the lesson of `KI-15`).
const kept = table.rows.length;
const home = table.rows.filter((r: any) => r.homeListing).length;
const vendor = table.rows.filter((r: any) => r.dataSource !== 'SEC EDGAR').length;
const financial = table.rows.filter((r: any) => r.financial).length;
const cells = kept * SCREENER_METRICS.length;
let values = 0;
let nm = 0;
let gone = 0;
for (const row of table.rows as any[]) {
  for (const key of Object.keys(row.cells)) {
    const state = row.cells[key].state;
    if (state === 'value') values++;
    else if (state === 'nm') nm++;
    else gone++;
  }
}

console.log(`screener table: ${kept} companies from ${files.length} payloads, written to ${OUT}`);
if (refused.length) {
  console.log(`  ${refused.length} carried no statements to screen on: ${refused.join(', ')}`);
}
console.log(
  `  ${home} are the listing quoted in their own reporting currency, so ${kept - home} are hidden when one ` +
    'listing per company is asked for'
);
console.log(`  ${financial} are on the bank template, which is what the not-meaningful rules are about`);
console.log(
  `  ${vendor} carry vendor-sourced figures and are marked as such, so nothing unlicensed can be exported`
);
console.log(
  `  ${cells} figures across ${SCREENER_METRICS.length} metrics: ${values} values, ${nm} not meaningful, ` +
    `${gone} not reported`
);
console.log(
  `  ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB. Not committed: ${vendor} rows are vendor data this site ` +
    'is not licensed to redistribute.'
);
