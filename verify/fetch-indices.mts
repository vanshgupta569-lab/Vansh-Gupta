// FILE: verify/fetch-indices.mts
//
// Fetches each market index into verify/payloads/indices/, which is not in the
// repository for the same reason the payloads are not: index levels are vendor
// data this site is not licensed to redistribute
// (`docs/COST_OF_CAPITAL_SPEC.md` rule 6, **Paid · last**).
//
//   npm run verify:indices             the ones not on disk
//   npm run verify:indices -- --force  all of them again
//
// It calls the site's own route handler, so what lands on disk is exactly what
// the browser would receive — which is what lets `npm run verify` measure a
// real beta for every company in the set without a network.
//
// TWENTY-ONE REQUESTS, NOT ONE PER COMPANY. That is the whole point of the
// index having its own address: the S&P 500 is one series whether seventy-six
// companies are measured against it or one is.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..').split(path.sep).join('/');
const OUT = path.join(HERE, 'payloads', 'indices');
fs.mkdirSync(OUT, { recursive: true });

const { INDICES } = await import(`file:///${REPO}/src/data/marketIndex.ts`);
const handler = (await import(`file:///${REPO}/api/marketIndex.js`)).default;

const force = process.argv.slice(2).includes('--force');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The file one symbol is saved as. `^` and `.` are fine in a file name on
 *  every platform this runs on, but a symbol is a symbol and a file name is a
 *  file name, so the mapping is written down rather than assumed. */
export function indexFile(symbol: string): string {
  return `${symbol.replace(/[^A-Za-z0-9]+/g, '_')}.json`;
}

let done = 0;
let failed = 0;
let held = 0;

for (const index of Object.values(INDICES) as any[]) {
  const file = path.join(OUT, indexFile(index.symbol));
  if (fs.existsSync(file) && !force) {
    held++;
    continue;
  }
  const res: any = {
    code: 200,
    body: null,
    status(c: number) { this.code = c; return this; },
    json(b: any) { this.body = b; return this; },
    setHeader() {},
    end() { return this; },
  };
  try {
    await handler({ method: 'GET', query: { symbol: index.symbol }, headers: {} }, res);
  } catch (e: any) {
    res.body = { error: `handler threw: ${e.message}` };
  }
  const body = res.body || { error: `no body (${res.code})` };
  if (body.error) {
    failed++;
    console.log(`${index.symbol.padEnd(12)} ${index.name.padEnd(22)} ERROR  ${String(body.error).slice(0, 70)}`);
  } else {
    done++;
    fs.writeFileSync(file, JSON.stringify(body));
    console.log(
      `${index.symbol.padEnd(12)} ${index.name.padEnd(22)} ${String(body.closes.length).padStart(5)} closes  ` +
        `${body.from} to ${body.to}  ${body.currency}`
    );
  }
  // One request at a time, four seconds apart, as every other fetch in this
  // repository does.
  await sleep(4000);
}

console.log(`\nfetched ${done}, failed ${failed}, already on disk ${held}; indices in ${OUT}`);
