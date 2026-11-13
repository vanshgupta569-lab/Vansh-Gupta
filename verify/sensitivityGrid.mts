// FILE: verify/sensitivityGrid.mts
//
//   npm run verify:grid
//
// THE SENSITIVITY GRID HAS CELLS IN IT (2026-11-13).
//
// The valuation screen's grid rendered EMPTY on the live site: twenty-five
// blanks and one line reading "Hover a cell to inspect the valuation at that
// pair." The engine had computed the grid all along; `calculateDCFFor` builds
// its result field by field and never carried `sensitivity` or
// `sensitivityAxes` through, so the screen read `undefined` and mapped over
// nothing.
//
// NOTHING IN `verify` COULD SEE IT, and that is the lesson. Every check of the
// grid's ARITHMETIC passed, because the arithmetic was never wrong — the
// figures simply never reached the screen. A handover loses a field silently;
// only something that looks at the rendered page can tell.
//
// So this renders the valuation screen and counts the cells:
//
//   1. TWENTY-FIVE CELLS, each carrying the pair of inputs it was computed at.
//   2. EVERY ADMISSIBLE CELL PRINTS A VALUE; an inadmissible one prints `n.m.`
//      and never a number, because a perpetuity with growth at or above the
//      discount rate has no value rather than a large one.
//   3. THE ROW AND COLUMN HEADS PRINT THE RATES, so a reader can say what any
//      cell is (STUDIO §4.5).
//   4. THE READOUT IS FIXED, not hover-only: a tapped cell reports, because a
//      phone has no hover and a grid that only answers a mouse answers half
//      its readers.
//   5. AND THE TITLE IS SENTENCE CASE.
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..').split(path.sep).join('/');
const OUT = path.join(HERE, 'out');
const PORT = 7500 + Math.floor(Math.random() * 200);
const SHOTS = process.argv.includes('--shots');
const CELLS = 25;

let problems = 0;
const say = (line: string) => console.log(`  ${line}`);
const fail = (line: string) => {
  problems++;
  console.log(`  PROBLEM: ${line}`);
};

fs.mkdirSync(OUT, { recursive: true });

// EVERY COMPANY THAT HAS A VALUATION, not one of them. The screen is the same
// component for all of them, but the grid depends on the engine's output and a
// refusal, a bank or a missing input can each produce a different shape.
const { COMPANIES_DATA, calculateDCFFor, defaultDriversFor } = await import(
  `file:///${REPO}/src/data/companies.ts`
);
const { buildCompanyFrom } = await import(`file:///${REPO}/src/data/autoCompany.ts`);
const { readPayload } = await import(`file:///${REPO}/verify/payloadSet.mts`);

console.log('\n=== the sensitivity grid has cells in it ===');

// ---- FIRST, WITHOUT A BROWSER: does the engine's grid reach the result? ----
//
// This is the exact handover that broke, checked over every company in the
// set in a second rather than one company in a browser in a minute.
{
  let valued = 0;
  let withGrid = 0;
  const missing: string[] = [];
  for (const file of fs.readdirSync(path.join(HERE, 'payloads')).filter((f) => f.endsWith('.json'))) {
    let payload: any;
    try {
      payload = readPayload(file);
    } catch {
      continue;
    }
    let rec: any;
    try {
      rec = buildCompanyFrom(payload);
    } catch {
      continue;
    }
    const drivers = { ...rec.defaultDrivers, ...defaultDriversFor(rec.modelData) };
    let dcf: any;
    try {
      dcf = calculateDCFFor(rec.modelData, drivers, payload?.quote?.price ?? null);
    } catch {
      continue;
    }
    if (!dcf?.applicable) continue;
    valued++;
    const rows = dcf?.sensitivity?.perpetuity;
    const axes = dcf?.sensitivityAxes;
    const ok =
      Array.isArray(rows) &&
      rows.length === 5 &&
      rows.every((r: any) => Array.isArray(r) && r.length === 5) &&
      Array.isArray(axes?.wacc) &&
      axes.wacc.length === 5 &&
      Array.isArray(axes?.growth) &&
      axes.growth.length === 5;
    if (ok) withGrid++;
    else if (missing.length < 6) missing.push(payload.ticker);
  }
  if (!valued) {
    fail('no company in the set produces a valuation, so the grid is unchecked');
  } else if (withGrid !== valued) {
    fail(`${valued - withGrid} of ${valued} valued companies reach the screen with no grid: ${missing.join(', ')}`);
  } else {
    say(`${valued} valued companies, every one carrying a 5x5 grid and both axes to the screen`);
  }
}

// ---- THEN THE SCREEN ITSELF -------------------------------------------
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
const BASE = `http://127.0.0.1:${PORT}`;
const browser = await chromium.launch({ headless: true });

// THE PAPER COMPANY, which is what the rest of the browser checks drive.
// A bare `{}` for `/api/company` is refused by the payload-version guard —
// correctly: a figure from a source that did not say which shape it is in is
// not a figure. The fixture carries the version, so the journey gets through.
const { paperPayload, paperIndexSeries, PAPER_TICKER } = await import(
  `file:///${REPO}/verify/fixtures/paperCompany.mts`
);

/** The paper company: a complete payload, no network. */
async function openValuation(page: Page) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  const enter = page.getByRole('button', { name: /value a listed company/i }).first();
  for (let i = 0; i < 4; i++) {
    if (await page.getByPlaceholder(/Apple, Reliance/i).isVisible().catch(() => false)) break;
    await enter.click({ timeout: 3_000 }).catch(() => {});
    await page.waitForTimeout(600);
  }
  await page.getByPlaceholder(/Apple, Reliance/i).fill(PAPER_TICKER);
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: /^build model$/i }).locator('visible=true').first().click({ timeout: 10_000 });
  await page.waitForTimeout(1500);
  // The company page, then its Model tab, then the figures, then the build.
  await page.getByRole('tab', { name: /^model$/i }).first().click({ timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: /^open the figures for/i }).first().click({ timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: /build the model/i }).locator('visible=true').first().click({ timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: /skip and build the model/i }).click({ timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(3000);
}

for (const width of [1440, 390]) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 900 } });
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await ctx.route('**/api/company*', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(paperPayload()) })
  );
  await ctx.route('**/api/marketIndex*', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(paperIndexSeries()) })
  );
  await ctx.route('**/api/search*', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ results: [{ ticker: PAPER_TICKER, name: 'Fenwick Paper Mills Inc.', exchange: 'NYSE' }] }),
    })
  );
  const page = await ctx.newPage();
  try {
    await openValuation(page);
    const grid = page.locator('[data-sensitivity-cell]');
    const count = await grid.count();
    if (count !== CELLS) {
      // SAY WHERE THE JOURNEY ENDED. "0 cells" is true whether the grid is
      // empty or the valuation screen was never reached, and those are
      // different faults with different fixes.
      const where: any = await page.evaluate(`({
        url: location.pathname,
        heading: (document.querySelector('h1, h2')?.textContent || '').trim().slice(0, 60),
        hasValuation: /sensitivit/i.test(document.body.innerText),
      })`);
      fail(
        `${width}: the grid has ${count} cells, not ${CELLS} — at ${where.url}, "${where.heading}", ` +
          `${where.hasValuation ? 'on the valuation screen' : 'NOT on the valuation screen'}`
      );
      if (SHOTS) await page.screenshot({ path: path.join(OUT, `grid-missing-${width}.png`) }).catch(() => {});
      continue;
    }
    say(`${width}: ${count} cells`);

    // Every cell: the pair it was computed at, and a value or `n.m.`.
    const cells: any[] = await page.evaluate(
      `Array.from(document.querySelectorAll('[data-sensitivity-cell]')).map((el) => ({
        pair: el.getAttribute('data-sensitivity-cell'),
        text: (el.textContent || '').trim(),
      }))`
    );
    let withValue = 0;
    let notMeaningful = 0;
    for (const c of cells) {
      if (!/^[\d.-]+\|[\d.-]+$/.test(String(c.pair || ''))) {
        fail(`${width}: a cell carries the pair "${c.pair}", which is not a rate and a growth`);
      }
      const hasNumber = /\d/.test(c.text.replace(/n\.m\./g, ''));
      if (/n\.m\./.test(c.text)) {
        notMeaningful++;
        if (hasNumber) fail(`${width}: a cell reads "${c.text}" — both a refusal and a figure`);
      } else if (hasNumber) withValue++;
      else fail(`${width}: a cell is blank`);
    }
    say(`${width}: ${withValue} cells print a value, ${notMeaningful} print n.m.`);
    if (!withValue) fail(`${width}: not one cell prints a value`);

    // ---- 3. EVERY ROW AND COLUMN PRINTS ITS OWN RATE (STUDIO §4.5) ----
    //
    // Naming the axes once at the foot — "X-Axis: Term Growth (+/-1%)" —
    // says what VARIES and never what any particular cell IS. A cell is a
    // pair of inputs and has to be readable as one.
    const heads: any = await page.evaluate(`({
      rows: Array.from(document.querySelectorAll('[data-sensitivity-row]')).map((e) => (e.textContent || '').trim()),
      cols: Array.from(document.querySelectorAll('[data-sensitivity-col]')).map((e) => (e.textContent || '').trim()),
      title: (document.body.innerText.match(/DCF SENSITIVITY MATRIX/) || [])[0] || '',
    })`);
    if (heads.rows.length !== 5 || heads.cols.length !== 5) {
      fail(`${width}: ${heads.rows.length} row heads and ${heads.cols.length} column heads, not 5 and 5`);
    } else if (!heads.rows.every((t: string) => /%/.test(t)) || !heads.cols.every((t: string) => /%/.test(t))) {
      fail(`${width}: a head prints no rate — rows ${heads.rows.join(', ')}; columns ${heads.cols.join(', ')}`);
    } else {
      say(`${width}: rows ${heads.rows.join(' ')} against columns ${heads.cols.join(' ')}`);
    }
    // ---- 5. THE TITLE IS SENTENCE CASE --------------------------------
    if (heads.title) fail(`${width}: the grid is titled "${heads.title}" in capitals`);

    // The readout answers a TAP, not only a hover.
    await grid.nth(12).click({ timeout: 5_000 }).catch(() => {});
    await page.waitForTimeout(500);
    const readout = await page.evaluate(`document.body.innerText`);
    if (/Hover a cell to inspect/i.test(String(readout))) {
      fail(`${width}: after tapping a cell the readout still says "Hover a cell" — a phone has no hover`);
    } else {
      say(`${width}: a tapped cell reports, so the readout is not hover-only`);
    }

    // ---- 6. THE REVENUE CHART'S TALLEST FIGURE CLEARS THE UNITS NOTE ---
    //
    // Each bar's figure sits just above its bar, so the tallest — which by
    // definition reaches the top of the plot — printed into the
    // "$ bn · as filed" note beside the title.
    const collide: any = await page.evaluate(`(() => {
      const note = document.querySelector('[data-revenue-units]');
      const figures = Array.from(document.querySelectorAll('[data-revenue-figure]'));
      if (!note || !figures.length) return null;
      const n = note.getBoundingClientRect();
      let worst = null;
      for (const f of figures) {
        const r = f.getBoundingClientRect();
        const overlaps = r.left < n.right && n.left < r.right && r.top < n.bottom && n.top < r.bottom;
        const gap = Math.round(r.top - n.bottom);
        if (!worst || gap < worst.gap) worst = { year: f.getAttribute('data-revenue-figure'), gap, overlaps };
      }
      return worst;
    })()`);
    if (!collide) {
      fail(`${width}: the revenue chart's figures or its units note could not be found`);
    } else if (collide.overlaps) {
      fail(`${width}: the ${collide.year} bar's figure overlaps the "bn · as filed" note`);
    } else if (collide.gap < 4) {
      fail(`${width}: only ${collide.gap}px between the ${collide.year} bar's figure and the units note`);
    } else {
      say(`${width}: the tallest bar's figure clears the units note by ${collide.gap}px`);
    }

    if (SHOTS) {
      await page
        .locator('[data-sensitivity-cell]')
        .first()
        .evaluate((el: any) => el.closest('section, div[class*="border"]')?.scrollIntoView({ block: 'center' }))
        .catch(() => {});
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(OUT, `grid-${width}.png`) }).catch(() => {});
    }
  } catch (err) {
    fail(`${width}: ${String(err).slice(0, 110)}`);
  } finally {
    await ctx.close();
  }
}

await browser.close();
child.kill();
console.log(`\nTOTAL PROBLEMS IN THE SENSITIVITY GRID: ${problems}`);
process.exit(0);
