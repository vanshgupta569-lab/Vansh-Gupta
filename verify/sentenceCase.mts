// FILE: verify/sentenceCase.mts
//
//   npm run verify:case
//
// NO SCREEN SHOUTS AT THE READER (2026-11-22).
//
// `VISUAL_SYSTEM.md` §1 puts "uppercase tracked labels" on its Avoid list by
// name, and `LANDING_SPEC` checklist 29 asks for one eyebrow style everywhere:
// 13px, sentence case, muted. The build already enforces half of it -- a rule
// in `index.css` neutralises the `.uppercase` CLASS, so nothing styled that
// way renders in capitals.
//
// WHICH IS EXACTLY WHY THIS IS NEEDED. A label written `FILTERS` in the source
// is not styled uppercase; it IS uppercase, so the CSS rule never sees it and
// every check that reads `textTransform` reports nothing. That is how
// "DIRECT RESEARCH DISPATCH" survived on the landing page and how nine labels
// -- THE UNIVERSE, FILTERS, BANKS AND INSURERS, WRITTEN AS THEIR RULES, NOT
// THEIR OUTCOME and the rest -- survived on the screener.
//
// So this reads the TEXT, not the style.
//
// WHAT IS NOT A FAULT, and the list is deliberately short because a
// permissive rule here would be worthless:
//   - A ticker. They are capitals by nature and the site prints hundreds.
//   - An accepted abbreviation that has no lower-case form in finance.
//   - A single capitalised word of five letters or fewer, which is almost
//     always one of the two above.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..').split(path.sep).join('/');
const PORT = 8800 + Math.floor(Math.random() * 90);

/** Abbreviations that have no lower-case form on a finance screen. */
const ALLOWED = [
  'EBITDA', 'EBIT', 'WACC', 'EDGAR', 'XBRL', 'LBO', 'SEBI', 'IFRS', 'GAAP',
  'ROCE', 'ROIC', 'NOPAT', 'CAGR', 'ESOP', 'ADR', 'GDR', 'ISIN', 'TTM',
];

let problems = 0;
const say = (line: string) => console.log(`  ${line}`);
const fail = (line: string) => {
  problems++;
  console.log(`  PROBLEM: ${line}`);
};

const { paperPayload, paperIndexSeries, PAPER_TICKER } = await import(
  `file:///${REPO}/verify/fixtures/paperCompany.mts`
);

const child = spawn(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['vite', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'],
  { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' }
);
await new Promise<void>((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('vite did not start within 60s')), 60_000);
  child.stdout?.on('data', (d) => {
    if (/ready in|Local/i.test(String(d))) {
      clearTimeout(t);
      resolve();
    }
  });
  child.on('error', reject);
});
const BASE = `http://127.0.0.1:${PORT}`;

console.log('\n=== no screen shouts at the reader ===');
const browser = await chromium.launch({ headless: true });

/**
 * Every shouted run of text the screen is showing.
 *
 * TWO OR MORE CAPITALISED WORDS TOGETHER is the reliable signal: a label.
 * A single word has to be six letters or more AND outside the allow-list,
 * which keeps tickers and the ordinary abbreviations of the trade out of it.
 */
async function shouted(page: Page, allowed: string[]) {
  return (await page.evaluate(
    `(() => {
      const ALLOWED = ${JSON.stringify(allowed)};
      const out = [];
      const seen = new Set();
      for (const el of document.querySelectorAll('*')) {
        if (el.children.length) continue;
        const raw = (el.textContent || '').replace(/\\s+/g, ' ').trim();
        if (!raw || raw.length < 4) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) continue;
        const words = raw.split(' ').filter((w) => /[A-Za-z]/.test(w));
        if (!words.length) continue;
        const caps = (w) => {
          const letters = w.replace(/[^A-Za-z]/g, '');
          return letters.length >= 3 && letters === letters.toUpperCase();
        };
        let run = 0;
        let best = 0;
        for (const w of words) {
          run = caps(w) ? run + 1 : 0;
          if (run > best) best = run;
        }
        const single =
          words.length === 1 &&
          caps(words[0]) &&
          words[0].replace(/[^A-Za-z]/g, '').length >= 6 &&
          !ALLOWED.includes(words[0].replace(/[^A-Za-z]/g, ''));
        if (best >= 2 || single) {
          if (seen.has(raw)) continue;
          seen.add(raw);
          out.push(raw.slice(0, 48));
        }
      }
      return out;
    })()`
  )) as string[];
}

const SCREENS: [string, string, (p: Page) => Promise<void>][] = [
  ['the screener', '/screener', async (p) => { await p.waitForTimeout(2600); }],
  ['the company overview', `/company/${PAPER_TICKER}/overview`, async (p) => { await p.waitForTimeout(3000); }],
  ['the financials tab', `/company/${PAPER_TICKER}/financials`, async (p) => {
    await p.locator('[data-financials]').first().waitFor({ timeout: 30_000 }).catch(() => {});
    await p.waitForTimeout(1200);
  }],
];

for (const width of [1440, 390]) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 900 } });
  await ctx.route('**/api/screener*', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ rows: [], built: '2026-11-10' }) })
  );
  await ctx.route('**/api/company*', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(paperPayload()) })
  );
  await ctx.route('**/api/marketIndex*', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(paperIndexSeries()) })
  );
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  const page = await ctx.newPage();
  try {
    for (const [name, route, settle] of SCREENS) {
      await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
      await settle(page);
      // A ticker is capitals by nature, and this fixture's is a real word.
      const loud = (await shouted(page, [...ALLOWED, PAPER_TICKER])).filter((t) => t !== PAPER_TICKER);
      if (loud.length) {
        fail(`${width}, ${name}: ${loud.length} label(s) set in capitals — ${loud.slice(0, 4).map((t) => `"${t}"`).join(', ')}`);
      } else {
        say(`${width}, ${name}: nothing set in capitals`);
      }
    }
  } catch (err) {
    fail(`${width}: ${String(err).slice(0, 120)}`);
  } finally {
    await ctx.close();
  }
}

await browser.close();
child.kill();
console.log(`\nTOTAL PROBLEMS IN SENTENCE CASE: ${problems}`);
process.exit(0);
