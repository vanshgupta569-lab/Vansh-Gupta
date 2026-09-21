// FILE: verify/fetch-payloads.mts
//
// Fetches the sweep set into verify/payloads/, which is not in the repository
// (see the README: the Yahoo-sourced figures are vendor data the site is not
// licensed to redistribute).
//
//   npm run verify:payloads              every ticker in tickers.txt
//   npm run verify:payloads -- AAPL MSFT just those
//   npm run verify:payloads -- --force   refetch ones already on disk
//
// It calls the site's own API handler, so what lands on disk is exactly what
// the site would receive. Expect a few failures: sources rate-limit, and some
// tickers have no statements any more. Those are reported and skipped, and the
// sweeps ignore them.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..').split(path.sep).join('/');
const OUT = path.join(HERE, 'payloads');
fs.mkdirSync(OUT, { recursive: true });

const args = process.argv.slice(2);
const force = args.includes('--force');
const asked = args.filter((a) => !a.startsWith('--'));
const tickers = asked.length
  ? asked
  : fs
      .readFileSync(path.join(HERE, 'tickers.txt'), 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'));

const handler = (await import(`file:///${REPO}/api/company.js`)).default;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let done = 0;
let failed = 0;
let next = 0;

const worker = async () => {
  while (next < tickers.length) {
    const t = tickers[next++];
    const file = path.join(OUT, `${t}.json`);
    if (fs.existsSync(file) && !force) continue;

    const res: any = {
      code: 200,
      body: null,
      status(c: number) { this.code = c; return this; },
      json(b: any) { this.body = b; return this; },
      setHeader() {},
      end() { return this; },
    };
    try {
      await handler({ method: 'GET', query: { ticker: t }, headers: {} }, res);
    } catch (e: any) {
      res.body = { error: `handler threw: ${e.message}` };
    }
    const body = res.body || { error: `no body (${res.code})` };
    body.ticker = body.ticker || t;
    fs.writeFileSync(file, JSON.stringify(body));
    if (body.error) {
      failed++;
      console.log(`${t.padEnd(14)} ERROR  ${String(body.error).slice(0, 70)}`);
    } else {
      done++;
      const last = body.statements?.at?.(-1);
      console.log(`${t.padEnd(14)} FY${last?.fiscalYear ?? '?'}  ${body.statements?.length ?? 0} years`);
    }
    // Both sources rate-limit; three workers at this pace has been reliable.
    await sleep(250);
  }
};

await Promise.all([worker(), worker(), worker()]);
console.log(
  `\nfetched ${done}, failed ${failed}, already on disk ${tickers.length - done - failed}; ` +
    `payloads in ${OUT}`
);
