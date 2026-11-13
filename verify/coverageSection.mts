// FILE: verify/coverageSection.mts
//
//   npm run verify:coverage
//
// THE COVERAGE SECTION SAYS HOW MANY COMPANIES (2026-11-12).
//
// On the live site it did not. The count came from `/api/screener`, and a
// failed request left it null — which removed the whole tile, so the section
// shipped with a wide blank where its headline figure belongs. A number that
// disappears when a request fails is worse than no number, because the layout
// still reserves the room for it.
//
// THE CHECK RUNS WITH THE REQUEST FAILING, which is the state the live site
// was in. Everything here is asserted with `/api/screener` answering 500: if
// the count survives that, it survives anything.
//
//   1. THE COUNT IS THERE, and it is the listings this build ships.
//   2. THE LABELS ARE SENTENCES. "Up to, of filed history" is a sentence with
//      its middle missing, and no amount of layout makes it one.
//   3. THE EYEBROW IS MUTED, SENTENCE CASE AND UNNUMBERED.
//   4. NO WIDE BLANK: the stats that exist fill the row they are given.
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..').split(path.sep).join('/');
const OUT = path.join(HERE, 'out');
const PORT = 6900 + Math.floor(Math.random() * 200);
const SHOTS = process.argv.includes('--shots');

const INSTANT = (await import(`file:///${REPO}/src/data/instantListings.ts`)).default as any[];

let problems = 0;
const say = (line: string) => console.log(`  ${line}`);
const fail = (line: string) => {
  problems++;
  console.log(`  PROBLEM: ${line}`);
};

fs.mkdirSync(OUT, { recursive: true });

const child = spawn(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['vite', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'],
  { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' }
);
await new Promise<void>((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('vite did not start within 60s')), 60_000);
  child.stdout?.on('data', (d) => {
    if (/ready in|Local:/i.test(String(d))) {
      clearTimeout(t);
      resolve();
    }
  });
  child.on('error', reject);
});

console.log('\n=== the coverage section says how many companies ===');

const browser = await chromium.launch({ headless: true });

for (const width of [1440, 390]) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 900 } });
  // THE FAILING REQUEST IS THE POINT. This is the live site's own state.
  await ctx.route('**/api/screener*', (r) => r.fulfill({ status: 500, contentType: 'application/json', body: '{}' }));
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  const page = await ctx.newPage();
  try {
    await page.goto(`http://127.0.0.1:${PORT}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const section = page.locator('[data-coverage-stats]').first();
    await section.scrollIntoViewIfNeeded({ timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(1200);

    if (!(await section.count())) {
      fail(`${width}: the coverage section is not on the page at all`);
      continue;
    }

    // ---- 1. THE COUNT --------------------------------------------------
    const companies = page.locator('[data-stat="companies"]').first();
    if (!(await companies.count())) {
      fail(`${width}: no company count, with the screener request failing — the tile is dropped again`);
    } else {
      const text = ((await companies.textContent()) || '').replace(/\s+/g, ' ').trim();
      // The printed figure must be a floor of what the build ships, never more.
      const named = Number((text.match(/([\d,]+)\s*\+/) || [])[1]?.replace(/,/g, '') || 0);
      if (!named) {
        fail(`${width}: the count tile reads "${text.slice(0, 50)}" with no figure in it`);
      } else if (named > INSTANT.length) {
        fail(`${width}: the page claims ${named} companies and the build ships ${INSTANT.length}`);
      } else {
        say(`${width}: the count is there with the request failing — "${text.slice(0, 44)}"`);
      }
    }

    // ---- 1b. AND THE SOURCE LINE IS TRUE OF THAT FIGURE ----------------
    //
    // With the table unavailable the count is the build's own, and a line
    // reading "counted from the screener table" would be a false provenance
    // on a page whose whole claim is that every figure has one.
    // A SHORT WAIT AND A CATCH. When the tile is missing this read hung for
    // thirty seconds and took the rest of the arms down with it, so a run
    // that found one fault reported only that one.
    const source = (
      (await page
        .locator('[data-stat="companies"] [data-stat-source]')
        .first()
        .textContent({ timeout: 2_000 })
        .catch(() => '')) || ''
    ).trim();
    if (!source) {
      fail(`${width}: the count has no source line`);
    } else if (/screener table/i.test(source)) {
      fail(`${width}: the count came from the build and its source line says "${source}"`);
    } else if (!/build/i.test(source)) {
      fail(`${width}: the count's source line does not say where it came from — "${source}"`);
    } else {
      say(`${width}: its source line reads "${source}"`);
    }

    // ---- 2. THE LABELS ARE SENTENCES -----------------------------------
    const labels: string[] = await page.evaluate(
      `Array.from(document.querySelectorAll('[data-stat]')).map((el) => (el.children[1]?.textContent || '').trim())`
    );
    for (const label of labels) {
      if (/,\s*(of|in|for)\b/i.test(label) || /^\s*Up to,\s*/i.test(label)) {
        fail(`${width}: the label "${label}" is a sentence with its middle missing`);
      }
    }
    say(`${width}: ${labels.length} labels, each a sentence: ${labels.map((l) => `"${l}"`).join(', ')}`);

    // ---- 3. THE EYEBROW -------------------------------------------------
    const eyebrow: any = await page.evaluate(`(() => {
      const el = Array.from(document.querySelectorAll('p')).find((n) => /^\\s*Coverage\\s*$/i.test(n.textContent || ''));
      if (!el) return null;
      const s = getComputedStyle(el);
      return { text: (el.textContent || '').trim(), transform: s.textTransform, colour: s.color };
    })()`);
    if (!eyebrow) {
      fail(`${width}: the coverage eyebrow is not a plain "Coverage"`);
    } else {
      if (eyebrow.transform === 'uppercase') fail(`${width}: the eyebrow is still set in capitals`);
      if (/\d/.test(eyebrow.text)) fail(`${width}: the eyebrow still carries a number — "${eyebrow.text}"`);
      say(`${width}: the eyebrow reads "${eyebrow.text}", ${eyebrow.transform}, ${eyebrow.colour}`);
    }

    // ---- 4. NO WIDE BLANK ----------------------------------------------
    const fill: any = await page.evaluate(`(() => {
      const grid = document.querySelector('[data-coverage-stats]');
      if (!grid) return null;
      const g = grid.getBoundingClientRect();
      const kids = Array.from(grid.children).map((k) => k.getBoundingClientRect());
      if (!kids.length) return null;
      const right = Math.max(...kids.map((k) => k.right));
      return { gridWidth: Math.round(g.width), used: Math.round(right - g.left), stats: kids.length };
    })()`);
    if (!fill) {
      fail(`${width}: the stats grid could not be measured`);
    } else {
      const share = fill.used / fill.gridWidth;
      if (share < 0.75) {
        fail(
          `${width}: ${fill.stats} stat(s) fill only ${(share * 100).toFixed(0)}% of the row — a wide blank where a figure belongs`
        );
      } else {
        say(`${width}: ${fill.stats} stats fill ${(share * 100).toFixed(0)}% of the row`);
      }
    }

    if (SHOTS) {
      await page
        .locator('[data-coverage-stats]')
        .first()
        .screenshot({ path: path.join(OUT, `coverage-${width}.png`) })
        .catch(() => {});
    }
  } catch (err) {
    fail(`${width}: ${String(err).slice(0, 100)}`);
  } finally {
    await ctx.close();
  }
}

await browser.close();
child.kill();
console.log(`\nTOTAL PROBLEMS IN THE COVERAGE SECTION: ${problems}`);
process.exit(0);
