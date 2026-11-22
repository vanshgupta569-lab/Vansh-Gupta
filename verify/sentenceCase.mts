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
  // Names of things, which are capitals because that is their name.
  'SEC', 'NASDAQ', 'NYSE', 'LSE', 'NSE', 'BSE', 'XETRA', 'OTC', 'IOB', 'ASX',
  'KSE', 'MCE', 'SES', 'DCF', 'FCF', 'PP', 'USD', 'GBP', 'EUR', 'INR', 'JPY',
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
        /* AN ALLOWED WORD DOES NOT BUILD A RUN. "SEC EDGAR" is two
           capitalised words in a row and is simply the name of the archive;
           counting it as a shouted label would make this check noise on the
           one sentence that states a figure's provenance. */
        const bare = (w) => w.replace(/[^A-Za-z]/g, '');
        let run = 0;
        let best = 0;
        for (const w of words) {
          run = caps(w) && !ALLOWED.includes(bare(w)) ? run + 1 : 0;
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
  // THE VALUATION SCREEN, reached the way a reader reaches it. It is the
  // densest screen on the site and the one with the most labels on it.
  ['the valuation screen', '/', async (p) => {
    await p.waitForTimeout(1400);
    for (let i = 0; i < 4; i++) {
      if (await p.getByPlaceholder(/Apple, Reliance/i).isVisible().catch(() => false)) break;
      await p.getByRole('button', { name: /value a listed company/i }).first().click({ timeout: 3_000 }).catch(() => {});
      await p.waitForTimeout(600);
    }
    await p.getByPlaceholder(/Apple, Reliance/i).fill(PAPER_TICKER).catch(() => {});
    await p.waitForTimeout(700);
    await p.getByRole('button', { name: /^build model$/i }).locator('visible=true').first().click({ timeout: 10_000 }).catch(() => {});
    await p.waitForTimeout(1500);
    await p.getByRole('tab', { name: /^model$/i }).first().click({ timeout: 10_000 }).catch(() => {});
    await p.waitForTimeout(1200);
    await p.getByRole('button', { name: /^open the figures for/i }).first().click({ timeout: 10_000 }).catch(() => {});
    await p.waitForTimeout(2500);
    await p.getByRole('button', { name: /build the model/i }).locator('visible=true').first().click({ timeout: 20_000 }).catch(() => {});
    await p.waitForTimeout(2500);
    await p.getByRole('button', { name: /skip and build the model/i }).click({ timeout: 20_000 }).catch(() => {});
    await p.waitForTimeout(3000);
  }],
];

for (const width of [1440, 390]) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 900 } });
  // THE CATCH-ALL IS REGISTERED FIRST, AND THAT ORDER IS THE WHOLE POINT.
  // Playwright matches the LAST route registered, so a catch-all added after
  // the specific ones silently answers an empty object to every company
  // request -- and three of these four screens then render their error state
  // while the check happily reports "nothing set in capitals" about it. That
  // is this repository's own recorded trap, and it caught me with it.
  //
  // (Written as line comments on purpose: a glob with a star-slash in it ends
  // a block comment early, which is how this file last failed to parse.)
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await ctx.route('**/api/screener*', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ rows: [], built: '2026-11-10' }) })
  );
  await ctx.route('**/api/company*', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(paperPayload()) })
  );
  await ctx.route('**/api/marketIndex*', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(paperIndexSeries()) })
  );
  const page = await ctx.newPage();
  try {
    for (const [name, route, settle] of SCREENS) {
      await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
      await settle(page);
      // A ticker is capitals by nature, and this fixture's is a real word.
      /* THE SCREEN HAS TO BE THE SCREEN. The valuation journey is six clicks
         long and every one of them can miss; a check that then reads whatever
         page it happens to be on and reports "nothing set in capitals" is
         reporting on the search screen. Each screen names something only it
         carries. */
      const SIGN: Record<string, RegExp> = {
        'the screener': /the universe/i,
        'the company overview': /change on the day/i,
        'the financials tab': /income statement/i,
        'the valuation screen': /sensitivity/i,
      };
      const here = String(await page.evaluate('document.body.innerText'));
      if (!SIGN[name].test(here)) {
        fail(`${width}, ${name}: the journey did not arrive -- nothing on the page matches ${SIGN[name]}`);
        continue;
      }
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
