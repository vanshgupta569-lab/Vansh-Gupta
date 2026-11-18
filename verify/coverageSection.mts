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
/* THE FIGURE IS NO LONGER "WHAT THIS BUILD SHIPS" (Nihar, 16 November 2026).
   It is what the site can VALUE: the SEC filers whose filings carry the line
   the engine needs, plus the listings held here that no SEC archive contains.
   This check used to assert the printed count was at most `INSTANT.length`,
   which was right while the count WAS the search index and became a ceiling
   180 times too low the moment it stopped being. It is measured against the
   same function the page calls now, so a hand-written number fails. */
const { coverageCount, coverageCountLabel } = await import(`file:///${REPO}/src/data/coverageCount.ts`);
const COVERED = coverageCount();

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

/**
 * THE TWO WAYS THE TABLE LETS THIS SECTION DOWN.
 *
 * The first is the one this check was written for: the request fails.
 * The second is worse and is what the live site was actually doing -- the
 * request SUCCEEDS and answers with nothing. A 200 carrying no usable rows
 * overwrote a true count of 178 with nought, `companyCountLabel(0)` returned
 * null, and the whole tile came off the page. The section shipped showing one
 * stat, "5Y", because a worse answer was allowed to replace a better one on
 * the strength of its status code.
 *
 * A check that only ever tested the 500 could not see it.
 */
const BREAKAGES = [
  { what: 'the request fails', status: 500, body: '{}' },
  { what: 'the table answers with nothing', status: 200, body: JSON.stringify({ rows: [] }) },
];

for (const { what, status, body } of BREAKAGES)
for (const width of [1440, 390]) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 900 } });
  // THE BROKEN TABLE IS THE POINT. This is the live site's own state.
  await ctx.route('**/api/screener*', (r) => r.fulfill({ status, contentType: 'application/json', body }));
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
      fail(`${width}, ${what}: no company count — the tile is dropped again`);
    } else {
      const text = ((await companies.textContent()) || '').replace(/\s+/g, ' ').trim();
      // The printed figure must be a floor of what the build ships, never more.
      const named = Number((text.match(/([\d,]+)\s*\+/) || [])[1]?.replace(/,/g, '') || 0);
      const expected = coverageCountLabel(COVERED.total);
      if (!named) {
        fail(`${width}: the count tile reads "${text.slice(0, 50)}" with no figure in it`);
      } else if (named > COVERED.total) {
        fail(
          `${width}: the page claims ${named} companies and the measured universe is ${COVERED.total} ` +
            `(${COVERED.secFilers} SEC filers + ${COVERED.nonUsListings} listed elsewhere)`
        );
      } else if (expected && !text.includes(expected)) {
        fail(`${width}: the count reads "${text.slice(0, 24)}" where the data gives "${expected}"`);
      } else {
        say(`${width}, ${what}: the count stands — "${text.slice(0, 44)}"`);
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
    } else if (!/\d/.test(source)) {
      // IT HAS TO SAY WHAT WAS COUNTED, with the figures in it. "Counted from
      // our data" is not a provenance on a page whose whole claim is that
      // every figure has one.
      fail(`${width}: the count's source line carries no figures — "${source}"`);
    } else if (!source.includes(COVERED.secFilers.toLocaleString('en-GB'))) {
      fail(
        `${width}: the count's source line does not name the ${COVERED.secFilers.toLocaleString('en-GB')} ` +
          `SEC filers it is mostly made of — "${source}"`
      );
    } else {
      say(`${width}: its source line reads "${source}"`);
    }

    // ---- 1c. EVERY STAT IS A REAL FIGURE, NOT A NOUGHT -----------------
    //
    // A stat printing 0 is a claim that this site covers nothing, and it is
    // how the count vanished: nought is falsy twice over, once in the label
    // and once in the tile's own condition.
    const figures: any[] = await page.evaluate(
      `Array.from(document.querySelectorAll('[data-stat]')).map((el) => ({
        key: el.getAttribute('data-stat'),
        // The VISIBLE figure. The settled value also sits in an sr-only span
        // so a screen reader is given the number rather than forty of them,
        // and reading the tile's whole text returned both.
        shown: (el.querySelector('[data-stat-shown]')?.textContent || '').trim(),
        read: (el.querySelector('[data-stat-final]')?.textContent || '').trim(),
      }))`
    );
    const nought = figures.filter((f: any) => /^0\b|^0$/.test(f.shown));
    if (nought.length) {
      fail(`${width}, ${what}: ${nought.map((f: any) => `${f.key} reads "${f.shown}"`).join(', ')}`);
    } else if (figures.length < 2) {
      fail(`${width}, ${what}: only ${figures.length} stat on the page — ${figures.map((f: any) => f.key).join(', ')}`);
    } else {
      say(`${width}, ${what}: ${figures.length} stats — ${figures.map((f: any) => `${f.key} ${f.shown}`).join(', ')}`);
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

    // ---- 5. ONE ROW AT 1440, TWO BY TWO ON A PHONE -------------------
    const rows: any = await page.evaluate(`(() => {
      const grid = document.querySelector('[data-coverage-stats]');
      if (!grid) return null;
      const tops = new Set();
      for (const kid of grid.children) tops.add(Math.round(kid.getBoundingClientRect().top));
      return { rows: tops.size, tiles: grid.children.length };
    })()`);
    if (!rows) {
      fail(`${width}: the stats grid could not be measured for its rows`);
    } else {
      const want = width >= 1024 ? 1 : 2;
      if (rows.rows !== want) {
        fail(`${width}: ${rows.tiles} tiles sit on ${rows.rows} rows, and should sit on ${want}`);
      } else {
        say(`${width}: ${rows.tiles} tiles on ${rows.rows} row${rows.rows === 1 ? '' : 's'}`);
      }
    }

    // ---- 6. NO WALL OF NAMES IN THE BAND ------------------------------
    //
    // Twenty-six exchange names as a comma run were three lines of the
    // busiest text on an otherwise disciplined page. They belong behind a
    // control, so the tile stays a number, a label and one line.
    const wall: any = await page.evaluate(`(() => {
      const grid = document.querySelector('[data-coverage-stats]');
      if (!grid) return null;
      let worst = 0;
      let who = '';
      for (const tile of grid.children) {
        const text = (tile.textContent || '').trim();
        if (text.length > worst) { worst = text.length; who = (tile.getAttribute('data-stat') || '') + ': ' + text.slice(0, 40); }
      }
      return { worst, who };
    })()`);
    if (wall && wall.worst > 190) {
      fail(`${width}: a tile carries ${wall.worst} characters — "${wall.who}…"`);
    } else if (wall) {
      say(`${width}: the longest tile is ${wall.worst} characters`);
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
