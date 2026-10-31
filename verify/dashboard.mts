// FILE: verify/dashboard.mts
//
// THE DASHBOARD CHECK — does the page show what the engine produced?
//
//   npm run verify:dashboard
//   npm run verify:dashboard -- --headed      watch it drive the browser
//
// Every other check in this directory runs BELOW the screen. The scenario
// suite proves the model holds together, the workbook check proves the
// spreadsheet reproduces it, the sweep proves a change moved what we think it
// moved — and all three would pass with a dashboard that rendered the wrong
// field, dropped a minus sign, or showed a value for a company the engine
// refused. That gap was `KI-16`. This closes it.
//
// HOW IT WORKS
//
// It starts the real site with Vite, drives it in a real Chromium through the
// same screens a reader clicks through, and compares what is on the page with
// what the engine returns for the same company IN THIS PROCESS. The engine is
// the authority; the page is the thing under test.
//
// Figures are compared AS FORMATTED, not as numbers: the engine's figure is put
// through the same rule the component uses ($1,234 / 9.2% / 20.4x) and the
// strings must match. A check that parses the page back into a number would
// pass a page that prints a value per share to the nearest million.
//
// NO NETWORK. The browser's calls to /api/* are intercepted. The two derived
// companies are a paper company invented in verify/fixtures, so this runs from
// a clean checkout with no payloads, no API keys and no live source — the
// fetched payloads are vendor data and are not in the repository.
//
// WHAT IT COVERS
//
//   the headline value per share, both terminal methods, and the spread
//   the reported and forecast income statement and balance sheet
//   net debt and the equity bridge, line by line
//   the cost of capital and its parts
//   the refusal path: the reason shown, and no value anywhere — the headline,
//     the football field, the batch screen and the downloaded workbook
import fs from 'node:fs';
import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { chromium, type Page, type Browser, type BrowserContext } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..').split(path.sep).join('/');
const OUT = path.join(HERE, 'out');
fs.mkdirSync(OUT, { recursive: true });
const ExcelJS = createRequire(`${REPO}/package.json`)('exceljs');

const HEADED = process.argv.includes('--headed');
// A port nobody else is on. A fixed one is fine until a previous run's server
// outlives it, and then every check fails for a reason that has nothing to do
// with the dashboard.
const PORT = Number(process.env.PORT || 0) || (await freePort());
const BASE = `http://127.0.0.1:${PORT}`;

async function freePort(): Promise<number> {
  const net = await import('node:net');
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      probe.close(() => resolve(port));
    });
  });
}

const {
  paperPayload,
  paperIndexSeries,
  PAPER_TICKER,
  PAPER_NAME,
  CONVERTED_TICKER,
  CONVERTED_RATE,
  CONVERTED_MINOR_UNIT,
} = await import(`file:///${REPO}/verify/fixtures/paperCompany.mts`);
const { buildCompanyFrom } = await import(`file:///${REPO}/src/data/autoCompany.ts`);
const { COMPANIES_DATA } = await import(`file:///${REPO}/src/data/companies.ts`);
// The curated model the dashboard itself renders for Apple. The record in
// COMPANIES_DATA carries the screen furniture; this is the model behind it.
const AAPL_SOURCE: any = (await import(`file:///${REPO}/src/data/AAPL.js`)).default;
const { buildModel, buildDCF, computeWACC } = await import(`file:///${REPO}/src/engine/model.js`);
const { buildWorkbook } = await import(`file:///${REPO}/src/data/excelExport.ts`);
// The families the design system declares, which the font-request check below
// measures what the browser actually fetched against.
const { TYPE } = await import(`file:///${REPO}/src/design/tokens.ts`);

// Each variant of the paper company is reached under its own ticker, so one
// intercept answers for all of them without the browser knowing which is
// which. THE MAP IS WRITTEN ONCE: it used to be spelled out in all three
// routes, and a fourth ticker would have had to be added to each of them.
const REFUSED_TICKER = 'PAPERX';
const FIXTURES: Record<string, 'valued' | 'refused' | 'converted'> = {
  [PAPER_TICKER]: 'valued',
  [REFUSED_TICKER]: 'refused',
  [CONVERTED_TICKER]: 'converted',
};
/** The payload for a ticker this check knows, or null for one it does not. */
const fixtureFor = (ticker: string) =>
  FIXTURES[ticker] ? { ...paperPayload(FIXTURES[ticker]), ticker } : null;

let problems = 0;
const fail = (what: string, expected: string, got: string) => {
  problems++;
  console.log(`  PROBLEM: ${what}\n           engine: ${expected}\n           page:   ${got}`);
};
const ok = (line: string) => console.log(`  ${line}`);

// ---------------------------------------------------------------- formatting
// The same rules the components use. Kept here deliberately rather than
// imported: if a formatter changes, this check should notice rather than
// change with it.
const num = (v: any): v is number => typeof v === 'number' && isFinite(v);
const fmt = (v: any, dp = 0) =>
  num(v) ? v.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp }) : '—';
const money = (symbol: string) => (v: any, dp = 0) => (num(v) ? `${symbol}${fmt(v, dp)}` : '—');
const pct = (v: any, dp = 1) => (num(v) ? `${(v * 100).toFixed(dp)}%` : '—');
const mult = (v: any, dp = 1) => (num(v) ? `${v.toFixed(dp)}x` : '—');

// ------------------------------------------------------------- the dev server
function startServer(): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.platform === 'win32' ? 'npx.cmd' : 'npx',
      ['vite', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'],
      { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' }
    );
    let settled = false;
    const done = (err?: Error) => {
      if (settled) return;
      settled = true;
      err ? reject(err) : resolve(child);
    };
    child.stdout?.on('data', (d) => {
      if (/ready in|Local:/i.test(String(d))) done();
    });
    child.stderr?.on('data', (d) => {
      const text = String(d);
      if (/EADDRINUSE|error/i.test(text)) console.log(`  vite: ${text.trim().slice(0, 200)}`);
    });
    child.on('error', done);
    setTimeout(() => done(new Error('vite did not start within 60s')), 60_000);
  });
}

// ------------------------------------------------------------ reading the page
/**
 * The value shown beside a label. The rows are label/value pairs, so this
 * finds the element whose whole text IS the label and returns what the rest of
 * its row says. `within` scopes to a section, for the labels that appear twice
 * (both terminal methods carry a "Terminal value" and a "Value per share").
 */
async function beside(page: Page, label: string, within?: string): Promise<string> {
  return page.evaluate(
    ({ label, within }) => {
      // Both terminal methods carry a "Terminal value" and a "Value per share",
      // so a label alone is ambiguous and the panel has to be found first.
      // Every element whose text STARTS with the heading is a candidate — the
      // heading itself, the panel that opens with it, and the grid that holds
      // that panel — and the grid also holds the other method. So the tightest
      // one wins: sorted by how much text it contains, smallest first.
      const scopes: Element[] = [];
      if (within) {
        for (const el of Array.from(document.querySelectorAll('h3, h4, div, section'))) {
          const text = el.textContent?.trim() || '';
          if (!text.startsWith(within)) continue;
          if (el.children.length) scopes.push(el);
          if (el.parentElement) scopes.push(el.parentElement);
        }
        scopes.sort((a, b) => (a.textContent || '').length - (b.textContent || '').length);
      }
      const roots: (Element | Document)[] = scopes.length ? scopes : [document];
      for (const root of roots) {
        const labels = Array.from(root.querySelectorAll('span, div, td, th')).filter(
          (e) => e.textContent?.trim() === label
        );
        for (const el of labels) {
          let row: Element | null = el.parentElement;
          for (let up = 0; up < 3 && row; up++) {
            const text = (row.textContent || '').trim();
            const at = text.indexOf(label);
            if (at >= 0) {
              const rest = text.slice(at + label.length).trim();
              if (rest) return rest;
            }
            row = row.parentElement;
          }
        }
      }
      return '';
    },
    { label, within }
  );
}

/** A row of a statement table: the label, then one cell per year. */
async function rowCells(page: Page, label: string): Promise<string[]> {
  return page.evaluate((label) => {
    // The same line appears twice: once in the summary of reported years at the
    // top of the view, and once in the model itself, which carries the forecast
    // too. The model's row is the longer one, and it is the one under test.
    let best: string[] = [];
    for (const el of Array.from(document.querySelectorAll('td, th, div, span'))) {
      if (el.textContent?.trim() !== label) continue;
      const row = el.closest('tr');
      const cells = row
        ? Array.from(row.querySelectorAll('td, th')).slice(1)
        : el.parentElement && el.parentElement.children.length > 1
          ? Array.from(el.parentElement.children).slice(1)
          : [];
      const text = cells.map((c) => (c.textContent || '').trim());
      if (text.length > best.length) best = text;
    }
    return best;
  }, label);
}

const compare = (what: string, expected: string, got: string) => {
  const clean = got.replace(/\s+/g, ' ').trim();
  // A row may carry an adjuster control beside its figure; the figure is what
  // the check is about, so a value the page appends to is matched at its end.
  if (clean === expected || clean.endsWith(expected)) {
    ok(`${what}: ${expected}`);
    return true;
  }
  fail(what, expected, clean || '(nothing)');
  return false;
};

// --------------------------------------------------------------- the journeys
/** Type a ticker into the search and send it, from wherever the reader is. */
async function search(page: Page, ticker: string) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });

  // THE SEARCH BOX IS FOUND BY ITS PLACEHOLDER, NEVER BY ORDINAL, and the
  // difference is three green-or-red runs of this whole check.
  //
  // This used to wait a flat 1200ms, click through, and take
  // `input:visible.first()`. The button exists in the served HTML before React
  // attaches to it, so a click landing in that window does nothing at all and
  // the app stays on the landing page — and the landing page has exactly one
  // visible input: the feedback form's email field. It is visible, it is
  // fillable, and it accepts "AAPL" quite happily, so the fill loop below
  // succeeded on its first attempt and everything looked fine until
  // "Build model" timed out thirty seconds later against a screen that was
  // never going to have one. The failure screenshot showed the landing page and
  // the error named a button, which is why this took three occurrences to read.
  //
  // Named by placeholder, a missed navigation fails here, immediately, saying
  // the search box never appeared.
  const enter = page.getByRole('button', { name: /value a listed company/i }).first();
  await enter.waitFor({ state: 'visible', timeout: 30_000 });
  const box = page.getByPlaceholder(/Apple, Reliance/i);
  for (let attempt = 0; attempt < 6; attempt++) {
    if (await box.isVisible().catch(() => false)) break;
    // Clicking again is the fix for a click that landed pre-hydration: the
    // handler is attached now even if it was not a moment ago.
    //
    // THE SHORT TIMEOUT IS THE POINT. Playwright's click waits 30 seconds for
    // its target by default, and once the search screen is up this button is
    // gone — so a retry issued just after a successful navigation sat waiting
    // half a minute for an element that was never coming back, and the caller's
    // own 30-second wait expired first. That turned the fix for one flake into
    // a slower flake of its own, which the loading-screen check caught.
    await enter.click({ timeout: 2_000 }).catch(() => {});
    await page.waitForTimeout(400);
  }
  await box.waitFor({ state: 'visible', timeout: 30_000 });

  // The screen animates in, and an input filled while it is still arriving is
  // filled and then thrown away with the frame it was in. So the value is put
  // in and read back before anything is sent.
  let filled = false;
  for (let attempt = 0; attempt < 5; attempt++) {
    await page.waitForTimeout(800);
    await box.fill(ticker);
    if ((await box.inputValue()) === ticker) {
      filled = true;
      break;
    }
  }
  // Say so rather than walking on. The old loop gave up silently after five
  // tries and left the next line to discover it, which is how a filled-the-
  // wrong-box failure reached the operator as a button timeout.
  if (!filled) throw new Error(`the search box would not hold "${ticker}" after five attempts`);

  // The button, not the Enter key: it is disabled until the field holds
  // something, so clicking it proves the field's own state arrived, which
  // typing into a screen that is still animating in does not. `visible=true`
  // because there are two — the wide-screen one inside the field and the
  // narrow-screen one beneath it — and only one of them is ever on screen.
  await page
    .getByRole('button', { name: /^build model$/i })
    .locator('visible=true')
    .first()
    .click({ timeout: 30_000 });
}

/** A curated company: no fetch, straight to the questions. */
async function openCurated(page: Page, ticker: string) {
  await search(page, ticker);
  await page.getByRole('button', { name: /skip and build the model/i }).click({ timeout: 60_000 });
  await page.getByText(/how it was calculated/i).first().waitFor({ timeout: 60_000 });
}

/** A fetched company: the figures screen, then the questions. */
/**
 * A BAR PINNED OVER THE PAGE, AND THE PAGE'S OWN PADDING.
 *
 * A fixed bottom bar is painted over the page rather than laid out in it, so
 * the page clears it only if something tells the page how tall it is. This
 * used to be a 160px constant; measured at 360px wide with a figure edited,
 * the bar stands 184px. The failure is silent -- the page looks finished and
 * the last control on it is simply unreachable -- so it is checked rather
 * than reasoned about, at the narrow widths where the bar wraps.
 */
async function checkBottomBarClearance(page: Page, label: string) {
  const r: any = await page.evaluate(`(() => {
    const sc = document.scrollingElement;
    sc.scrollTop = sc.scrollHeight;
    const vh = innerHeight;
    let bar = null;
    for (const el of document.querySelectorAll('*')) {
      const s = getComputedStyle(el);
      if (s.position !== 'fixed' || s.display === 'none' || s.visibility === 'hidden') continue;
      const b = el.getBoundingClientRect();
      if (b.height < 4 || b.width < 40 || b.height > vh * 0.85) continue;
      if (Math.abs(b.bottom - vh) > 4) continue;
      bar = el;
    }
    if (!bar) return { none: true };
    const barTop = bar.getBoundingClientRect().top;
    // THE INVARIANT: scrolled as far as it goes, the page's own content must
    // END above the bar. Asking instead whether some control happens to land
    // under it is luck, not clearance -- it passed all through the defect,
    // because the last control sat just high enough to miss the overlap.
    // INK, not boxes: a container's rect includes its own bottom padding, so
    // measuring containers would say the page always reaches the page bottom
    // and the clearance could never be wrong. Only leaves that actually paint.
    let bottom = 0, worst = '';
    const PAINTS = /^(IMG|SVG|CANVAS|INPUT|SELECT|TEXTAREA|BUTTON|HR)$/;
    for (const el of document.querySelectorAll('body *')) {
      const s = getComputedStyle(el);
      if (s.visibility === 'hidden' || s.display === 'none') continue;
      const leaf = el.children.length === 0 && (el.textContent || '').trim().length > 0;
      if (!leaf && !PAINTS.test(el.tagName)) continue;
      let p = el, fixed = false;
      while (p) { if (getComputedStyle(p).position === 'fixed') { fixed = true; break; } p = p.parentElement; }
      if (fixed) continue;
      const b = el.getBoundingClientRect();
      if (b.height < 1 || b.width < 1) continue;
      if (b.bottom > bottom) { bottom = b.bottom; worst = (el.textContent || '').trim().slice(0, 30) || el.tagName; }
    }
    return { barH: Math.round(bar.getBoundingClientRect().height),
             over: Math.round(bottom - barTop), worst };
  })()`);
  if (r.none) return;
  if (r.over <= 0) ok(`the page ends clear of the standing bar (${label}: bar ${r.barH}px, ${-r.over}px to spare)`);
  else fail(`the page's clearance under the standing bar (${label})`,
    `content ending above the bar (${r.barH}px tall)`,
    `it runs ${r.over}px past the top of the bar — "${r.worst}"`);
}

/**
 * Search box to finished model, the way a reader goes.
 *
 * ONE DEFINITION, because three checks walked this route and each spelled it
 * out again — so when a search stopped landing in the figures editor and
 * started landing on the company page, all three broke separately.
 */
async function openModelled(page: Page, ticker: string) {
  await search(page, ticker);
  if (!(await openModelTab(page, ticker))) return;
  await page.getByRole('button', { name: /^build the model$/i }).click({ timeout: 90_000 });
  await page.getByRole('button', { name: /skip and build the model/i }).click({ timeout: 90_000 });
  await page.getByText(/how it was calculated/i).first().waitFor({ timeout: 60_000 });
}

/** From wherever a search lands, into the figures editor. */
async function openModelTab(page: Page, ticker: string): Promise<boolean> {
  // WAIT FOR THE COMPANY PAGE, NOT FOR AN <h1>. The search screen has one of
  // its own, so waiting on the heading resolved while the loading screen was
  // still up — the site holds that for 4.8 seconds on purpose — and the path
  // read back as "/" for a navigation that had not happened yet.
  // REPORTED, NOT THROWN. When a search stops landing on the company page
  // this is the thing that is wrong, and a check that dies on the wait prints
  // a Playwright timeout instead of naming it.
  const arrived = await page
    .locator('nav[aria-label="Company sections"]')
    .first()
    .waitFor({ timeout: 90_000 })
    .then(() => true)
    .catch(() => false);
  const landed = new URL(page.url()).pathname;
  if (!arrived || landed !== `/company/${ticker}/overview`) {
    fail(
      `where a search for ${ticker} lands`,
      `/company/${ticker}/overview, with the company page on screen`,
      arrived ? landed : `${landed} — no company page rendered`
    );
    return false;
  }
  ok(`a search for ${ticker} lands on its company page, at its own address`);
  await page.getByRole('button', { name: /^model$/i }).first().click({ timeout: 30_000 });
  await page
    .getByRole('button', { name: new RegExp(`open the figures for ${ticker}`, 'i') })
    .click({ timeout: 60_000 });
  return true;
}

async function openFetched(page: Page, ticker: string) {
  // A SEARCH LANDS ON THE COMPANY PAGE, not inside the figures editor, so
  // this goes the way a reader does: the Overview, then the Model tab, then
  // the figures. The assertions below are unchanged — only the route to them
  // is, which is the point of driving the site rather than calling into it.
  await search(page, ticker);
  if (!(await openModelTab(page, ticker))) return;
  // The figures screen shows the filings before anything is modelled, and the
  // site holds it for a few seconds on purpose, so this waits rather than races.
  await page.getByRole('button', { name: /^build the model$/i }).waitFor({ timeout: 90_000 });
  // While the only screen with a standing bar is up, check the page clears it.
  // Narrow first, because the bar wraps to two rows there and the wide case
  // never fails.
  const was = page.viewportSize();
  await page.setViewportSize({ width: 360, height: 640 });
  await page.waitForTimeout(500);
  await checkBottomBarClearance(page, '360px, as filed');
  // WITH A FIGURE CORRECTED, which is the state that actually fails: the bar
  // gains a "Reset to as filed" button, wraps to a third row and stands 184px
  // against the 160px constant this check was written for. Checking only the
  // untouched screen would have passed throughout the defect.
  const field = page.locator('input[inputmode], input[type="text"]').first();
  if (await field.count()) {
    await field.fill('999');
    await field.blur();
    await page.waitForTimeout(600);
    await checkBottomBarClearance(page, '360px, one figure corrected');
    // THE LINK IS CALLED "Reset all" NOW, and the old name matched nothing —
    // so the figure this check corrects stayed corrected, and the next check
    // along counted two changes where it expected one. A selector that no
    // longer matches fails silently; the count downstream is what caught it.
    const reset = page.getByRole('button', { name: /^reset all$/i });
    if (await reset.count()) { await reset.click(); await page.waitForTimeout(500); }
  }
  if (was) { await page.setViewportSize(was); await page.waitForTimeout(400); }
  await checkBottomBarClearance(page, 'as opened');
  // THE FIGURES SCREEN HAS NEVER BEEN IN THE CONTRAST PASS, which is how a
  // whole band of new type could have arrived on it unmeasured.
  await readContrast(page, 'the figures screen');
  await checkHeadsOnScreen(page);
  await checkBridgeOnScreen(page);
  await page.getByRole('button', { name: /^build the model$/i }).click({ timeout: 90_000 });
  await page.getByRole('button', { name: /skip and build the model/i }).click({ timeout: 90_000 });
  await page.getByText(/how it was calculated/i).first().waitFor({ timeout: 60_000 });
}

/**
 * THE JUDGEMENT LAYER ON SCREEN (ROADMAP.md §19b).
 *
 * The arithmetic is checked below the screen by `verify/heads.mts`. What only a
 * browser can check is that the judgement is actually offered, that making one
 * does the four things the roadmap requires -- states where the default came
 * from, takes a reason, offers a visible way back, and rebuilds the model at
 * once with the previous value still beside it -- that it can be made WITHOUT A
 * MOUSE, and that undoing it leaves the screen where it started.
 */
/**
 * OPEN A ⓘ AND READ WHAT IT SAYS.
 *
 * Every explanation on the figures screen moved behind one of these, so a
 * check that reads the page text finds none of them — the panel is not in the
 * DOM until the ⓘ is hovered, focused or tapped. Scoped to a container rather
 * than the page, because every row has one and a body-wide search would open
 * somebody else's.
 */
async function readHint(page: Page, within: any, nth = 0): Promise<string> {
  const hint = within.locator('[data-hint]').nth(nth);
  if (!(await hint.count())) return '';
  await hint.click();
  await page.waitForTimeout(260);
  const text = (await page.locator('[role="tooltip"]').first().textContent().catch(() => '')) || '';
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(160);
  return text;
}

/** Move a line to a head through its ⋯ menu, which is the keyboard's way in. */
async function moveLineTo(page: Page, field: string, headLabel: RegExp): Promise<boolean> {
  const row = page.locator(`[data-line="${field}"]`).first();
  const menu = row.locator('[data-row-menu]').first();
  if (!(await menu.count())) return false;
  await menu.click();
  await page.waitForTimeout(300);
  const item = page.locator('[role="menuitem"]', { hasText: headLabel }).first();
  if (!(await item.count())) {
    await page.keyboard.press('Escape');
    return false;
  }
  await item.click();
  await page.waitForTimeout(1100);
  return true;
}

/**
 * THE JUDGEMENT LAYER ON SCREEN (ROADMAP.md §19b).
 *
 * The arithmetic is checked below the screen by `verify/heads.mts`. What only a
 * browser can check is that the judgement is actually offered, that making one
 * does the four things the roadmap requires -- states where the default came
 * from, takes a reason, offers a visible way back, and rebuilds the model at
 * once with the previous value still beside it -- that it can be made WITHOUT A
 * MOUSE, that a figure can be edited BY CLICKING IT, and that undoing it all
 * leaves the screen where it started.
 */
async function checkHeadsOnScreen(page: Page) {
  console.log(`\n=== the figures screen: the lines under their heads ===`);
  const title = page.getByRole('heading', { name: /^reported figures/i });
  if (!(await title.count())) {
    fail('the Reported figures table', 'on the figures screen', '(not there)');
    return;
  }
  ok('the figures table is on the screen, before the model');

  // THE SCREEN IS SHORT. The whole profit and loss is meant to fit a laptop
  // screen without scrolling, and "meant to" is not a measurement: the table's
  // own height is read off the page.
  const tableHeight = await page.evaluate(
    `(() => { const t = document.querySelector('.mg-table'); return t ? Math.round(t.getBoundingClientRect().height) : -1; })()`
  );
  if (typeof tableHeight === 'number' && tableHeight > 0 && tableHeight <= 720) {
    ok(`the profit and loss is ${tableHeight}px tall, inside a 1080p screen`);
  } else {
    fail('the height of the profit and loss', 'at most 720px', `${tableHeight}px`);
  }

  // NO EXPLANATORY PARAGRAPHS ARE LEFT ON THE SCREEN. The prose moved behind
  // the ⓘ, and the way to tell it actually moved is to count what is left.
  const strayProse = await page.evaluate(
    `(() => {
       const out = [];
       document.querySelectorAll('.mg-table td, .mg-table th').forEach(function (cell) {
         const t = (cell.textContent || '').trim();
         if (t.split(/\s+/).length > 14) out.push(t.slice(0, 60));
       });
       return out;
     })()`
  );
  if (Array.isArray(strayProse) && strayProse.length === 0) {
    ok('no cell in the table carries a paragraph; the prose is behind the ⓘ');
  } else {
    fail('prose left in the table', 'none', JSON.stringify(strayProse).slice(0, 160));
  }

  // THE HONESTY NOTE IS REACHABLE, in the ⓘ beside the one line of instruction.
  const intro = await readHint(page, page.locator('p', { hasText: /As filed by/i }).first());
  if (/not yet .*own line captions/i.test(intro)) {
    ok('the hint says these are the source fields and not the filing own captions');
  } else {
    fail('the honesty note about the captions', 'in the hint beside the instruction', intro.slice(0, 80) || '(not there)');
  }
  if (/four states/i.test(intro)) ok('the same hint carries the four states');
  else fail('the four states', 'in the intro hint', '(not there)');

  // THE HEADS ARE ROWS, with their forecast rule behind a ⓘ.
  const bands = page.locator('[data-head-band]');
  const bandCount = await bands.count();
  if (bandCount >= 6) ok(`${bandCount} heads on the statement in view`);
  else fail('heads', 'at least 6', String(bandCount));

  // A HEAD THE ENGINE CANNOT HONOUR SAYS SO, in its own ⓘ. Both are on the
  // balance sheet, so the tab is switched.
  await page.getByRole('tab', { name: /balance sheet/i }).click();
  await page.waitForTimeout(500);
  const debtBand = page.locator('[data-head-band="debt"]');
  if (await debtBand.count()) {
    const said = await readHint(page, debtBand, 0);
    if (/not a drop target/i.test(said)) ok('a head the engine cannot honour says so in its hint');
    else fail('the not-a-drop-target note', 'in the debt head hint', said.slice(0, 80) || '(not there)');
    if (said.replace(/.*Not a drop target\./i, '').trim().length > 60) {
      ok('and gives the reason with it');
    } else {
      fail('the reason a head is not a drop target', 'stated in the hint', '(too short or absent)');
    }
  } else {
    fail('the debt head', 'on the balance sheet', '(not there)');
  }
  await page.getByRole('tab', { name: /profit and loss/i }).click();
  await page.waitForTimeout(500);

  // THE DEFAULT SAYS WHERE IT CAME FROM, in the ⓘ on the line itself.
  const cogsRow = page.locator('[data-line="cogs"]').first();
  const cogsSaid = await readHint(page, cogsRow, 0);
  if (/cost of the units sold by its own description/i.test(cogsSaid)) {
    ok('the basis for a default head is stated in the line hint');
  } else {
    fail('the stated basis', 'cost of the units sold by its own description', cogsSaid.slice(0, 80) || '(not there)');
  }
  if (/balancing line the gross margin is derived from/i.test(cogsSaid)) {
    ok('a line that cannot be set aside as a one-off says why');
  } else {
    fail('why cost of sales cannot be a one-off', 'in its hint', '(not there)');
  }

  // ====================================================================
  // A FIGURE IS EDITED BY CLICKING IT
  // ====================================================================
  //
  // This is the bug the redesign fixed, and it is why the check drives the
  // whole gesture rather than taking it on trust. The row used to be a
  // component declared inside the screen's own render, so every keystroke gave
  // React a new component type and it REMOUNTED the input — measured, clicking
  // a cell left `document.activeElement` on BODY and typing changed nothing.
  await editAFigure(page, 'the figures screen');

  // ---- move a line WITHOUT A MOUSE, and watch the model rebuild ----
  if (!(await moveLineTo(page, 'sga', /^One-offs$/))) {
    fail('the row menu on SG&A', 'offering the heads it may move to', '(not there)');
    return;
  }
  const landedOn = await page.locator('[data-line="sga"]').first().getAttribute('data-head');
  if (landedOn === 'oneOffs') ok('the row menu moved the line, so a keyboard can make the judgement');
  else fail('the head after the menu move', 'oneOffs', String(landedOn));

  const movedSaid = await readHint(page, page.locator('[data-line="sga"]').first(), 0);
  if (/Yours\. The default is selling, general and administrative\./i.test(movedSaid)) {
    ok('the filed default stays beside the reader choice');
  } else {
    fail('the default kept beside the choice', 'Yours. The default is ...', movedSaid.slice(0, 80) || '(not there)');
  }

  const why = page.locator('input#why-sga');
  if (await why.count()) ok('the move takes an optional one-line reason, inline');
  else fail('the reason field', 'on the moved line', '(not there)');
  await why.fill('their delivery fleet sits in this line');
  await page.waitForTimeout(800);

  // REBUILT AT ONCE, WITH THE PREVIOUS VALUE STILL ON SCREEN.
  // REBUILT AT ONCE — or refused, which is also an answer. A company the
  // engine cannot value on these judgements has no figure to put beside
  // anything and must say so; the paper fixture is one. Both outcomes are
  // correct, and the two used to be asserted in the wrong order, so a refusal
  // reported a missing rebuild before reporting itself.
  const rebuilt = (await page.textContent('body')) || '';
  const both = rebuilt.match(/Perpetuity[\s\S]{0,120}?was\s*\S*[\d.,]+/i);
  const refusedHere = /the engine refuses a value/i.test(rebuilt);
  if (both) {
    ok('the model is rebuilt on the judgement, on this screen');
    ok(`the previous value is still beside the new one: ${both[0].replace(/\s+/g, ' ').slice(-46)}`);
  } else if (refusedHere) {
    ok('the engine refuses a value on these judgements, and says so rather than printing a blank');
  } else {
    fail('the rebuilt value', 'the new figure beside the old one, or a stated refusal', '(neither on the page)');
  }

  await readContrast(page, 'the figures screen, one line moved to another head');

  // ---- a visible way back, through the same menu ----
  if (await moveLineTo(page, 'sga', /Back to Selling, general/i)) {
    const back = await page.locator('[data-line="sga"]').first().getAttribute('data-head');
    if (back === 'sga') ok('the row menu offers the way back to the engine default');
    else fail('the head after going back', 'sga', String(back));
  } else {
    fail('the way back', 'in the row menu', '(not offered)');
  }

  // ---- AND THE DRAG, which is the other half of the control ----
  //
  // Checked by dispatching the real drag events rather than by moving the
  // mouse: Playwright's `dragTo` does not drive HTML5 drag-and-drop, and a
  // mouse-move that silently does nothing would leave this check passing while
  // the drag was broken. The grip is what carries `draggable` now — the row no
  // longer does, because a draggable ancestor is what stopped the figures in
  // it being clicked into.
  const dragged = await page.evaluate(
    `(() => {
       const row = document.querySelector('[data-line="rnd"]') || document.querySelector('[data-line="sga"]');
       const band = document.querySelector('[data-head-band="oneOffs"]');
       if (!row || !band) return 'no row or no band';
       const grip = row.querySelector('.mg-grip');
       if (!grip) return 'no grip on the row';
       const dt = new DataTransfer();
       dt.setData('text/plain', row.getAttribute('data-line'));
       grip.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
       band.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
       band.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
       return row.getAttribute('data-line');
     })()`
  );
  await page.waitForTimeout(1100);
  if (typeof dragged === 'string' && /^(rnd|sga)$/.test(dragged)) {
    const landed = await page.locator(`[data-line="${dragged}"]`).first().getAttribute('data-head');
    if (landed === 'oneOffs') ok(`dragging ${dragged} by its grip onto the one-offs head moved it there`);
    else fail(`the head after dragging ${dragged}`, 'oneOffs', String(landed));
    await moveLineTo(page, dragged, dragged === 'rnd' ? /Back to Research/i : /Back to Selling/i);
  } else {
    fail('the drag', 'a grip and a one-offs head to drag between', String(dragged));
  }

  const undone = (await page.textContent('body')) || '';
  if (/Rebuilt on your judgements/i.test(undone)) {
    fail('after returning to the default', 'no rebuilt-value band', 'it is still there');
  } else {
    ok('returning to the default puts the screen back where it started');
  }
}

/**
 * CLICK A FIGURE, TYPE OVER IT, AND SEE THE SCREEN ANSWER.
 *
 * Driven on two companies, because the bug it guards was in the screen rather
 * than in any one company's data and a single fixture could pass by luck.
 */
async function editAFigure(page: Page, label: string) {
  const row = page.locator('[data-line="cogs"]').first();
  const cell = row.locator('input.mg-cell').first();
  if (!(await cell.count())) {
    fail(`an editable figure, ${label}`, 'a cell on the cost of sales line', '(not there)');
    return;
  }
  await cell.scrollIntoViewIfNeeded();
  const num = (t: string) => Number(String(t).replace(/,/g, ''));
  const was = num(await cell.inputValue());
  const box = await cell.boundingBox();
  if (!box) {
    fail(`an editable figure, ${label}`, 'a cell with a box', '(none)');
    return;
  }
  // A REAL CLICK, not `.fill()`. `fill` sets the value through the DOM and
  // would pass against a cell no person could put a caret in, which is exactly
  // the state this screen was in.
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(280);
  const focused = await page.evaluate(`document.activeElement ? document.activeElement.tagName : 'none'`);
  if (focused === 'INPUT') ok(`${label}: clicking a figure puts the caret in it`);
  else fail(`${label}: clicking a figure`, 'focuses the input', `focus went to ${focused}`);

  await page.keyboard.press('Control+a');
  await page.keyboard.type(String(Math.round(was * 0.8) || 1234));
  await page.keyboard.press('Tab');
  await page.waitForTimeout(1200);
  const now = num(await cell.inputValue());
  if (now !== was) ok(`${label}: typing over it changed the figure, ${was} to ${now}`);
  else fail(`${label}: typing over a figure`, 'changes it', `it stayed at ${was}`);

  // THE COUNT SAYS SO, and the filed figure is one hover away.
  const counted = ((await page.locator('[data-change-count]').first().textContent()) || '').trim();
  if (/1 figure changed/i.test(counted)) ok(`${label}: the change is counted at the top of the screen`);
  else fail(`${label}: the change count`, '1 figure changed', counted || '(empty)');

  const marker = await readHint(page, row, 1);
  if (/Filed/i.test(marker) && /yours/i.test(marker)) {
    ok(`${label}: the edited cell keeps the filed figure behind its marker`);
  } else {
    fail(`${label}: the filed figure beside the change`, 'Filed ... yours ...', marker.slice(0, 70) || '(not there)');
  }

  // Put it back, so the next check starts where this one found the screen.
  const reset = page.getByRole('button', { name: /^reset all$/i }).first();
  if (await reset.count()) {
    await reset.click();
    await page.waitForTimeout(800);
    const after = ((await page.locator('[data-change-count]').first().textContent()) || '').trim();
    if (/no changes/i.test(after)) ok(`${label}: Reset all puts every figure back`);
    else fail(`${label}: Reset all`, 'No changes', after);
  } else {
    fail(`${label}: the Reset all link`, 'beside the change count', '(not there)');
  }
}

/**
 * THE TICKER ONLY TICKS WHEN IT HAS SOMEWHERE TO GO (`KI-25`).
 *
 * The strip was animated unconditionally, so headlines that fitted their
 * window were dragged off the left edge anyway until nothing was left. Nothing
 * caught it: the page rendered, the contrast passed, and the only symptom was
 * a screenshot taken mid-cycle reading "oading..." where it should have read
 * "[Loading...]".
 *
 * BOTH BRANCHES ARE DRIVEN, because a check that only sees one of them is half
 * a check. A short set of headlines must sit still; a long set must move. The
 * news route is swapped per branch and the company reopened, which is the only
 * way to get real headlines of a known width in front of the real component.
 *
 * The strip's position is read as a transform rather than as a screenshot, and
 * sampled twice a second apart, so "it is not moving" is a measurement rather
 * than a glance.
 */
async function checkTickerOnScreen(page: Page, ticker: string) {
  console.log(`\n=== the news ticker: it moves only when it must ===`);

  const serve = async (headlines: string[]) => {
    await page.route('**/api/news*', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: headlines.map((headline, i) => ({
            id: `t${i}`,
            time: '09:30',
            headline,
            source: 'Verification',
            url: null,
          })),
        }),
      })
    );
    await openModelled(page, ticker);
    await page.waitForTimeout(1200);
  };

  /** The strip, its window, whether it says it is scrolling, and where it sits. */
  const readStrip = () =>
    page.evaluate(
      `(() => {
         const strip = document.querySelector('[data-ticker-strip]');
         if (!strip) return null;
         const copy = strip.querySelector('.mg-marquee-copy');
         const box = strip.parentElement;
         return {
           scrolling: strip.getAttribute('data-scrolling') === 'true',
           copy: Math.round(copy ? copy.getBoundingClientRect().width : 0),
           window: Math.round(box ? box.clientWidth : 0),
           left: Math.round(strip.getBoundingClientRect().left - (box ? box.getBoundingClientRect().left : 0)),
           copies: strip.querySelectorAll('.mg-marquee-copy').length,
         };
       })()`
    );

  // ---- 1. HEADLINES THAT FIT MUST NOT MOVE ----
  await serve(['Board meets Thursday.', 'Dividend declared.']);
  let a: any = await readStrip();
  if (!a) {
    fail('the news ticker', 'a strip on the analysis screen', '(not there)');
    await page.unroute('**/api/news*');
    return;
  }
  if (a.copy > 0 && a.copy <= a.window) {
    ok(`short headlines fit: the strip is ${a.copy}px in a ${a.window}px window`);
  } else {
    fail('a set of headlines that fits', 'narrower than its window', `${a.copy}px in ${a.window}px`);
  }
  if (!a.scrolling) ok('a strip that fits is not animated');
  else fail('a strip that fits', 'no animation', 'it is animated anyway');
  if (a.copies === 1) ok('and is not duplicated, because there is no loop to hide');
  else fail('copies of a strip that fits', '1', String(a.copies));
  await page.waitForTimeout(1600);
  const settled: any = await readStrip();
  if (settled && Math.abs(settled.left - a.left) <= 1) {
    ok(`it is still at ${settled.left}px after 1.6 seconds, so nothing is being dragged out of view`);
  } else {
    fail(
      'the position of a strip that fits',
      `unchanged at ${a.left}px`,
      `it moved to ${settled ? settled.left : '?'}px — the text is being scrolled away`
    );
  }

  // ---- 2. HEADLINES THAT OVERFLOW MUST MOVE ----
  await serve(
    Array.from({ length: 14 }, (_, i) =>
      `Headline ${i + 1}: a sentence long enough that fourteen of them cannot possibly fit one window.`
    )
  );
  const b: any = await readStrip();
  if (b && b.copy > b.window) {
    ok(`long headlines overflow: the strip is ${b.copy}px in a ${b.window}px window`);
  } else {
    fail('a set of headlines that overflows', 'wider than its window', `${b ? b.copy : '?'}px in ${b ? b.window : '?'}px`);
  }
  if (b && b.scrolling) ok('a strip that overflows is animated');
  else fail('a strip that overflows', 'animated', 'it sits still');
  if (b && b.copies === 2) {
    ok('and is duplicated, so the loop closes without a blank gap');
  } else {
    fail('copies of a strip that overflows', '2', String(b ? b.copies : '?'));
  }

  await page.unroute('**/api/news*');
}

/**
 * EVERY FONT THE PAGE FETCHES IS A FONT THE SITE USES (`KI-26`).
 *
 * The page was loading a second Google Fonts stylesheet for Material Symbols,
 * an icon family nothing on the site draws with: every icon is an inline SVG
 * from lucide-react, and there was no `material-symbols` class, no matching
 * font-family and no ligature text anywhere in the source. The font FILE was
 * never fetched — a browser loads a webfont only when a glyph needs one — so
 * the cost was the stylesheet request itself, render-blocking, to a
 * third-party origin, on every page load, for a resource with no consumer.
 *
 * Nothing could have caught it. The build does not know which families the
 * markup asks for, and no check looked at what the page fetched.
 *
 * THE CHECK IS TIED TO THE TOKENS, not to a list kept here. `DESIGN.md` says
 * families live in `src/design/tokens.ts` and nowhere else, so a stylesheet
 * request naming a family that `TYPE` does not mention is either a font nobody
 * uses or a font used behind the tokens' back. Both are faults, and this
 * reports either.
 */
async function checkFontRequests(page: Page, requests: string[]) {
  console.log(`\n=== what the page fetches for fonts ===`);
  const sheets = requests.filter((u) => /fonts\.googleapis\.com\/css/.test(u));
  if (!sheets.length) {
    fail('a webfont stylesheet', 'at least one, for the type system', 'none requested');
    return;
  }
  // The families the tokens name, lower-cased and stripped of quotes, so
  // "Source Sans 3" in the stack matches "Source+Sans+3" in the URL.
  const declared = new Set<string>();
  for (const stack of Object.values(TYPE as Record<string, string>)) {
    for (const part of String(stack).split(',')) {
      const name = part.trim().replace(/^['"]|['"]$/g, '').toLowerCase();
      if (name) declared.add(name);
    }
  }
  const asked = new Set<string>();
  for (const url of sheets) {
    for (const m of url.matchAll(/family=([^&:]+)/g)) {
      asked.add(decodeURIComponent(m[1]).replace(/\+/g, ' ').toLowerCase());
    }
  }
  const stray = [...asked].filter((f) => !declared.has(f));
  if (stray.length) {
    fail(
      'a webfont the site actually uses',
      `only families named in tokens.ts (${[...declared].slice(0, 4).join(', ')}…)`,
      `${stray.join(', ')} fetched by ${sheets.length} stylesheet request${sheets.length === 1 ? '' : 's'} and used nowhere`
    );
  } else {
    ok(`${asked.size} font famil${asked.size === 1 ? 'y' : 'ies'} fetched (${[...asked].join(', ')}), every one named in tokens.ts`);
  }
  // AND ONE REQUEST, not two. Each stylesheet is its own render-blocking round
  // trip to a third-party origin; the families belong in one.
  if (sheets.length > 1) {
    fail('webfont stylesheet requests', 'one', `${sheets.length} — each is its own render-blocking round trip`);
  } else {
    ok('one stylesheet request carries the whole type system');
  }
}

/** The tie row read against the reported row it belongs to. */
async function checkBridgeTies(page: Page, label: string) {
  const pairs: { year: string; tie: string; reported: string }[] = await page.evaluate(
    `Array.from(document.querySelectorAll('[data-bridge-tie]')).map(function (cell) {
       var year = cell.getAttribute('data-bridge-tie') || '';
       var reported = document.querySelector('[data-bridge-reported="' + year + '"]');
       return {
         year: year,
         tie: (cell.textContent || '').replace(/\s|,/g, ''),
         reported: ((reported && reported.textContent) || '').replace(/\s|,/g, '')
       };
     })`
  );
  if (!pairs.length) {
    fail(`the bridge tie cells, ${label}`, 'one per reported year', 'none');
    return;
  }
  const bad = pairs.filter((p) => (p.reported === '\u2014' ? p.tie !== '\u2014' : p.tie !== '0'));
  const blank = pairs.filter((p) => p.reported === '\u2014').length;
  if (bad.length) {
    fail(
      `the bridge tie, ${label}`,
      'nil in every year with a reported EBITDA',
      bad.map((p) => `FY${p.year} tie ${p.tie} against reported ${p.reported}`).join(' / ')
    );
  } else if (blank === pairs.length) {
    ok(`${label}: no year has a reported EBITDA, and the bridge says so in all ${pairs.length} rather than printing nil`);
  } else {
    ok(`${label}: the bridge ties in all ${pairs.length - blank} years that have a reported EBITDA`);
  }
}

/**
 * THE ADJUSTED EBITDA BRIDGE ON SCREEN.
 *
 * The arithmetic is checked below the screen by `verify/ebitdaBridge.mts`, and
 * inside the written file by recalculating it. What only a browser can check is
 * that the bridge is on the screen that built it, that it states what it does
 * and does not include, that an adjustment arrives on it with a place to type
 * the reason, and that the tie row is nil on the page a reader is looking at.
 *
 * Driven right after the heads table, so it is read in the state that table
 * left behind: SG&A moved to one-offs, then put back.
 */
async function checkBridgeOnScreen(page: Page) {
  console.log(`\n=== the figures screen: the adjusted EBITDA bridge ===`);
  // THE BRIDGE IS FOLDED AWAY NOW, so it is opened before it is read. It is
  // not what a reader comes to this screen for, and leaving it open was most
  // of what made the page four screens long — but it is still the artefact a
  // valuer receives, so it is still here and still checked.
  const section = page.getByRole('button', { name: /the adjusted ebitda bridge/i }).first();
  if (await section.count()) {
    await section.click();
    await page.waitForTimeout(500);
  }
  const head = page.getByRole('button', { name: /the adjusted ebitda bridge/i });
  if (!(await head.count())) {
    fail('the EBITDA bridge', 'on the figures screen', '(not there)');
    return;
  }
  ok('the bridge is on the screen that built it');

  const body = (await page.textContent('body')) || '';
  // IT SAYS WHAT IT IS AND IS NOT. The disclosure is closed, so its text is in
  // the DOM but the assertions are about the words being there at all.
  for (const [re, what] of [
    [/Operating profit, as filed/i, 'filed operating profit at the top'],
    [/Plus: depreciation and amortisation/i, 'the D&A add-back on its own line'],
    [/Reported EBITDA/i, 'reported EBITDA'],
    [/Adjusted EBITDA/i, 'adjusted EBITDA'],
    [/Adjusted, less reported and every adjustment/i, 'the tie'],
  ] as [RegExp, string][]) {
    if (re.test(body)) ok(`the bridge shows ${what}`);
    else fail(`the bridge's ${what}`, 'on the page', '(not there)');
  }
  const whatsIn = page.locator('[data-hint]').last();
  if (await whatsIn.count()) {
    const bridgeHint = page.locator('table').last().locator('[data-hint]').first();
    await bridgeHint.click();
    await page.waitForTimeout(400);
    const open = (await page.locator('[role="tooltip"]').first().textContent().catch(() => '')) || '';
    await page.keyboard.press('Escape').catch(() => {});
    if (/not EBITDA before share-based pay/i.test(open)) ok('it says stock compensation is not added back');
    else fail('the stock-compensation statement', 'in the bridge', '(not there)');
    if (/classify the same money twice/i.test(open)) ok('it says why depreciation cannot be moved to another head');
    else fail('why depreciation cannot be moved', 'in the bridge', '(not there)');
  } else {
    fail('the "what is in it" disclosure', 'on the bridge', '(not there)');
  }

  // THE TIE IS NIL ON THE PAGE, in every year that has a reported EBITDA.
  //
  // A year the filing gives no operating profit for has no EBITDA, so its tie
  // is an em dash and that is correct. The two rows are read TOGETHER rather
  // than the tie alone, because a tie reading nothing is right beside a
  // reported figure reading nothing and wrong beside a figure.
  await checkBridgeTies(page, 'with nothing adjusted');

  // WITH NOTHING ADJUSTED, it says so rather than hiding.
  if (/you have made no adjustments/i.test(body)) ok('with nothing adjusted, the bridge says so');
  else fail('the no-adjustments sentence', 'on an untouched screen', '(not there)');

  // ---- make one, and watch it arrive on the bridge with a reason field ----
  if (!(await moveLineTo(page, 'sga', /^One-offs$/))) {
    fail('the row menu on SG&A', 'present', '(not there)');
    return;
  }
  const line = page.locator('input[data-adjustment="oneOff:sga"]');
  if (await line.count()) ok('the one-off arrives on the bridge with a place for its reason');
  else fail('the one-off on the bridge', 'a reason field', '(not there)');
  await line.fill('the promoter salary comes out on a sale');
  await page.waitForTimeout(700);
  const after = (await page.textContent('body')) || '';
  if (/One-off \u00b7 Selling, general and administrative/i.test(after)) ok('the bridge names the line and what kind of adjustment it is');
  else fail('the adjustment line', 'named on the bridge', '(not there)');
  // The recurrence count moved into the adjustment's own ⓘ with the rest of
  // the prose, so it is opened rather than read off the page.
  const adjRow = page.locator('tr', { hasText: /One-off · Selling, general/i }).first();
  const adjSaid = await readHint(page, adjRow, 0);
  if (/It moves EBITDA in/i.test(adjSaid)) ok('the adjustment says in how many years it moves EBITDA');
  else fail('the recurrence count', 'in the adjustment hint', adjSaid.slice(0, 70) || '(not there)');
  await checkBridgeTies(page, 'with an adjustment on it');

  // The reason typed on the bridge is the same store the heads table reads, so
  // it must show there too.
  const bandReason = await page.locator('input#why-sga').inputValue().catch(() => '');
  if (bandReason === 'the promoter salary comes out on a sale') {
    ok('a reason typed on the bridge is the same one the heads table holds');
  } else {
    fail('the shared reason', 'the promoter salary comes out on a sale', bandReason || '(empty)');
  }

  await readContrast(page, 'the figures screen, with an EBITDA bridge adjustment');

  // ---- and put it back ----
  await moveLineTo(page, 'sga', /Back to Selling, general/i);
  const undone = (await page.textContent('body')) || '';
  if (/you have made no adjustments/i.test(undone)) ok('returning to the default empties the bridge again');
  else fail('the bridge after a return to default', 'no adjustments', 'it still carries one');
}

/**
 * SAVING A SET OF JUDGEMENTS AND REOPENING IT (`KI-27`).
 *
 * The arithmetic is checked below the screen by `verify/savedModel.mts`, which
 * saves through the real wire format and reopens through the one restore path.
 * What only a browser can check is the wiring and the honesty: that the panel
 * gathers the judgements that are actually on screen, that a row it lists
 * reproduces itself, that reopening puts the headline back, and that a record
 * saved before the fix says in plain words what it never stored instead of
 * printing a figure it cannot stand behind.
 */
async function checkSavedModelsOnScreen(page: Page, label: string, ticker: string) {
  console.log(`\n=== ${label}: saving and reopening a set of judgements ===`);

  // WHAT THE ROW CLAIMS IS WHAT THE PAGE MUST SHOW.
  //
  // The figure to check against is not read off the analysis screen — the
  // headline there carries no label of its own, and the first money string on
  // the page is the share price. It is the figure the saved row itself prints
  // after being reopened to produce it, which is the promise a reader is given:
  // the row says it reopens at this, so opening it must put this on the page.

  // ---- FIRST, MAKE A JUDGEMENT, so the saved state is not the default one.
  //
  // Without this the check is vacuous: a restore that did nothing at all would
  // pass, because the page would already be showing the figure the row claims.
  // Proved by gutting `restoreSaved` and watching this pass, which is why the
  // walk back to the figures screen is here.
  const defaultValue = (await page.textContent('body')) || '';
  const figuresButton = page
    .getByRole('button', { name: /check the figures|corrected figure|moved line/i })
    .first();
  if (!(await figuresButton.count())) {
    fail('the way back to the figures', 'in the header', '(not there)');
    return;
  }
  await figuresButton.click();
  await page.getByRole('heading', { name: /^reported figures/i }).waitFor({ timeout: 60_000 });
  await moveLineTo(page, 'sga', /^One-offs$/);
  await page
    .getByRole('button', { name: /^rebuild with these judgements$/i })
    .click({ timeout: 60_000 });
  await page.getByText(/how it was calculated/i).first().waitFor({ timeout: 90_000 });
  await page.waitForTimeout(1200);
  const judgedValue = (await page.textContent('body')) || '';
  const moneyIn = (text: string) => (text.match(/\$[\d,]+\.\d\d/g) || []).join(' ');
  if (moneyIn(judgedValue) !== moneyIn(defaultValue)) {
    ok('setting a cost line aside as a one-off moved the figures on the analysis screen');
  } else {
    fail('the effect of a one-off', 'different figures', 'the page is unchanged');
  }

  // A VERSION 1 RECORD, put in the store the way one left behind by the old
  // code would be: no version, no judgements, and a stored value per share it
  // cannot reproduce.
  await page.evaluate(
    `window.localStorage.setItem('marginalia.savedModels.v1', JSON.stringify([{
       id: 'legacy-row',
       ticker: ${JSON.stringify(ticker)},
       companyName: 'Before the fix',
       name: 'saved before judgements were stored',
       viewMode: 'DERIVED',
       drivers: {},
       valuePerShare: 999.99,
       currencySymbol: '$',
       savedAt: '2026-10-01T00:00:00.000Z'
     }]))`
  );

  const open = page.getByRole('button', { name: /^saved models$/i }).first();
  if (!(await open.count())) {
    fail('the saved models button', 'on the analysis screen', '(not there)');
    return;
  }
  await open.click();
  await page.getByRole('heading', { name: /^saved models$/i }).first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1000);

  // ---- the old record says what it never stored ----
  const panel = (await page.textContent('body')) || '';
  for (const [re, what] of [
    [/Saved before judgements were stored/i, 'that it was saved before judgements were stored'],
    [/It did not store[\s\S]{0,80}corrections to the filed figures/i, 'what it did not store, by name'],
    [/Nothing has been guessed at on its behalf/i, 'that nothing was guessed at on its behalf'],
  ] as [RegExp, string][]) {
    if (re.test(panel)) ok(`an old record says ${what}`);
    else fail(`an old record saying ${what}`, 'on the row', '(not on the page)');
  }
  // BOTH FIGURES, because the one it stored is not one it can reproduce.
  if (/saved at \$999\.99 \u00b7 reopens at \$/.test(panel)) {
    ok('it prints what it was saved at beside what it reopens at');
  } else {
    fail('the two figures on an old record', 'saved at $999.99 \u00b7 reopens at …', '(not on the page)');
  }

  // ---- the panel gathers the judgements that are on screen ----
  if (/struck against a price of \$/.test(panel)) ok('the panel says which price the valuation is struck against');
  else fail('the price the valuation is struck against', 'in the save summary', '(not on the page)');

  // ---- save, and the row must reproduce itself ----
  await page.getByPlaceholder(/name this set of judgements/i).fill('a verification set');
  await page.getByRole('button', { name: /^save$/i }).first().click();
  await page.waitForTimeout(1500);
  // THE ROW'S OWN TEXT, NOT ITS NEIGHBOUR'S. The first version read 180
  // characters past the name, which ran into the legacy row below and reported
  // its two figures as this one's.
  const freshRow = (
    await page
      .locator('div', { hasText: /^a verification set$/ })
      .locator('xpath=ancestor::div[contains(@class,"px-4")][1]')
      .first()
      .textContent()
      .catch(() => '')
  )
    ?.replace(/\s+/g, ' ')
    .trim();
  let claimed = '';
  if (!freshRow) {
    fail('the saved row', 'a verification set', '(not on the page)');
  } else if (/reopens at/.test(freshRow)) {
    fail('a freshly saved row', 'one figure, because it reproduces itself', freshRow.slice(0, 140));
  } else {
    claimed = (freshRow.match(/[$\u20b9\u00a3\u20ac][\d,]+\.\d\d/) || [''])[0];
    if (claimed) ok(`a freshly saved row shows one figure, because it reopens at it: ${claimed}`);
    else fail('the figure on the saved row', 'a value per share', freshRow.slice(0, 90));
  }

  await readContrast(page, 'the saved models panel');

  // ---- reopen it, and the value comes back ----
  //
  // The LAST Open button, which is the legacy row's, would reopen a record that
  // stored no judgements. The one wanted is the row just saved, so it is found
  // inside that row rather than by position.
  const ourOpen = page
    .locator('div', { hasText: /^a verification set$/ })
    .locator('xpath=ancestor::div[contains(@class,"px-4")][1]')
    .first()
    .getByRole('button', { name: /^open$/i });
  if (!(await ourOpen.count())) {
    fail('the Open button on the saved row', 'present', '(not there)');
    return;
  }
  // FIRST OPEN THE LEGACY ROW, which stores no judgements and no sliders, so
  // the screen is moved OFF the saved state before our row is opened. Without
  // this, a restore that did nothing at all would pass: the page would already
  // be showing the figure the row claims.
  const legacyOpen = page
    .locator('div', { hasText: /^saved before judgements were stored$/ })
    .locator('xpath=ancestor::div[contains(@class,"px-4")][1]')
    .first()
    .getByRole('button', { name: /^open$/i });
  if (!(await legacyOpen.count())) {
    fail('the Open button on the old record', 'present', '(not there)');
    return;
  }
  await legacyOpen.first().click();
  await page.waitForTimeout(2500);
  const afterLegacy = (await page.textContent('body')) || '';
  // IT MUST LAND SOMEWHERE ELSE. The old record carries no judgements, so
  // opening it returns the model to the engine's own treatments \u2014 a different
  // page from the one just saved. If these agreed, the comparison below would
  // prove nothing.
  if (claimed && !afterLegacy.includes(claimed)) {
    ok('opening the old record moves the page off the saved figure, as it must');
  } else {
    fail(
      'opening a record with no judgements',
      `a page without ${claimed || 'the saved figure'}`,
      'the saved figure is still on screen'
    );
  }
  await page.getByRole('button', { name: /^saved models$/i }).first().click();
  await page.getByRole('heading', { name: /^saved models$/i }).first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(800);

  await ourOpen.first().click();
  await page.waitForTimeout(2500);
  const onScreen = (await page.textContent('body')) || '';
  if (!claimed) {
    fail('reopening', 'a figure to check against', '(the row showed none)');
  } else if (onScreen.includes(claimed)) {
    ok(`reopening puts ${claimed} on the page, which is what the row said it would`);
  } else {
    fail(
      'the value after reopening',
      claimed,
      (onScreen.match(/[$\u20b9][\d,]+\.\d\d/g) || []).slice(0, 6).join(' / ') || '(no figures on the page)'
    );
  }
  // And the panel is closed, so the figure above is on the analysis screen
  // rather than still in the list that produced it.
  if (await page.getByRole('heading', { name: /^saved models$/i }).count()) {
    fail('the saved models panel after reopening', 'closed', 'still open');
  } else {
    ok('the panel closes on reopening, so the figure is the analysis screen\u2019s own');
  }
  // And the badge is back, because the record was rebuilt WITH the judgement.
  if (/moved line/i.test(onScreen)) {
    ok('reopening the saved record puts the moved-line badge back');
  } else {
    fail('the badge after reopening the saved record', 'it counts the moved line', '(not on the page)');
  }
}

// ------------------------------------------------------------------ the checks
async function checkValued(page: Page, label: string, source: any, symbol: string) {
  console.log(`\n=== ${label}: the page against the engine ===`);
  const M: any = buildModel(source);
  const D: any = buildDCF(M, source);
  const W: any = computeWACC(M, source);
  const $ = money(symbol);

  // ---- the headline a reader acts on
  const headline = await page.textContent('body');
  const perpetuity = $(D.perpetuity?.valuePerShare, 2);
  const exit = $(D.exitMultipleValuation?.valuePerShare, 2);
  if (headline?.includes(perpetuity)) ok(`headline value per share: ${perpetuity}`);
  else fail('headline value per share', perpetuity, '(not on the page)');
  if (headline?.includes(exit)) ok(`headline exit multiple value: ${exit}`);
  else fail('headline exit multiple value', exit, '(not on the page)');

  const spread =
    num(D.perpetuity?.valuePerShare) && num(D.exitMultipleValuation?.valuePerShare)
      ? Math.abs(D.exitMultipleValuation.valuePerShare / D.perpetuity.valuePerShare - 1)
      : null;
  if (spread !== null) {
    // TO THE POINT, NOT TO THE LAST DIGIT. The page prints this percentage
    // rounded to nothing after the point, and the page's own model carries the
    // judgement `openFetched` made on the figures screen while the engine side
    // here does not — so the two agree to several decimal places and can still
    // straddle a rounding boundary. The paper company sits at 15.5010% on the
    // premium of 2026-10-30 and the string comparison turned into a coin toss.
    // What matters is that the page prints the measured spread rather than a
    // different number, so the figure is read off the page and compared.
    const printed = /the two methods are (\d+)% apart/.exec(headline || '');
    const sentence = `the two methods are ${(spread * 100).toFixed(0)}% apart`;
    if (!printed) {
      fail('the spread between the two methods', sentence, '(not on the page)');
    } else if (Math.abs(Number(printed[1]) - spread * 100) > 1) {
      fail(
        'the spread between the two methods',
        `${(spread * 100).toFixed(2)}%, as the engine measures it`,
        `the page says ${printed[1]}%`
      );
    } else {
      ok(`${printed[0]} on the page, ${(spread * 100).toFixed(2)}% in the engine`);
    }
  }

  // ---- the full working: both terminal methods, line by line
  await page.getByRole('button', { name: /^dcf model$/i }).click();
  await page.getByText('Method one — growing forever').waitFor({ timeout: 30_000 });

  const one = 'Method one';
  const two = 'Method two';
  compare('perpetuity — normalised free cash flow', $(D.normalisedFCF), await beside(page, 'Normalised free cash flow', one));
  compare('perpetuity — terminal value', $(D.terminalValuePerpetuity), await beside(page, 'Terminal value', one));
  compare('perpetuity — value of that today', $(D.pvTerminalPerpetuity), await beside(page, 'Value of that today', one));
  compare('perpetuity — value of the forecast years', $(D.pvStageOne), await beside(page, 'Value of the forecast years', one));
  compare('perpetuity — enterprise value', $(D.enterpriseValuePerpetuity), await beside(page, 'Enterprise value', one));
  compare('perpetuity — value per share', $(D.perpetuity?.valuePerShare, 2), await beside(page, 'Value per share', one));

  compare('exit multiple — terminal year EBITDA', $(D.terminalEBITDA), await beside(page, 'Terminal year EBITDA', two));
  compare('exit multiple — terminal value', $(D.terminalValueMultiple), await beside(page, 'Terminal value', two));
  compare('exit multiple — value of that today', $(D.pvTerminalMultiple), await beside(page, 'Value of that today', two));
  compare('exit multiple — enterprise value', $(D.enterpriseValueMultiple), await beside(page, 'Enterprise value', two));
  compare('exit multiple — implied perpetual growth', pct(D.impliedPerpetualGrowth, 2), await beside(page, 'Implied perpetual growth', two));
  compare('exit multiple — value per share', $(D.exitMultipleValuation?.valuePerShare, 2), await beside(page, 'Value per share', two));

  // ---- net debt and the equity bridge
  const bridge = 'From the whole company to one share';
  compare('bridge — enterprise value', $(D.perpetuity?.enterpriseValue), await beside(page, 'Enterprise value', bridge));
  compare(
    'bridge — net debt',
    $(Math.abs(D.netDebt)),
    await beside(page, D.netDebt < 0 ? 'Plus net cash' : 'Less net debt', bridge)
  );
  compare('bridge — equity value', $(D.perpetuity?.equityValue), await beside(page, 'Equity value', bridge));
  compare('bridge — diluted shares', fmt(D.dilutedShares, 1), await beside(page, 'Diluted shares', bridge));
  compare('bridge — value per share', $(D.perpetuity?.valuePerShare, 2), await beside(page, 'Value per share', bridge));

  // ---- the cost of capital
  compare('cost of capital — risk-free rate', pct(W.riskFreeRate, 2), await beside(page, 'Risk-free rate'));

  // AND THE SCREEN SAYS WHO PUBLISHED IT. A risk-free rate belongs to a
  // currency and comes from the body that publishes that currency’s
  // government yield; which body is part of the figure, and it matters most
  // where a source has something standing behind it — the rupee is fetched
  // from the OECD with FRED as a fallback, and "Source: OECD" and "Source:
  // FRED, because the OECD could not be reached" are different sentences.
  {
    // From the payload this company was built from, which is where the screen
    // reads it too. What is asserted is that the string reached the page, not
    // that the figure is right — the figures either side of it are checked
    // against the engine. A record carrying no publisher claims none on screen,
    // and the curated Apple file is one: it predates the field.
    const rf = source?.meta?.riskFree;
    const said = ((await page.textContent('body')) || '').replace(/\s+/g, ' ');
    if (!rf?.publisher) {
      ok('no publisher is recorded for this rate, and the screen claims none');
    } else if (said.includes(`Source: ${rf.publisher}`)) {
      ok(`the discount rate names its publisher on the screen: "Source: ${rf.publisher}"`);
    } else {
      fail(
        'the publisher of the risk-free rate',
        `"Source: ${rf.publisher}" under the rate`,
        'the screen does not say where the rate came from'
      );
    }
  }
  compare('cost of capital — market risk premium', pct(W.marketRiskPremium, 2), await beside(page, 'Market risk premium'));
  compare('cost of capital — cost of equity', pct(W.costOfEquity, 2), await beside(page, 'Cost of equity'));
  compare('cost of capital — weight of equity', pct(W.weightEquity, 1), await beside(page, 'Weight of equity, at market value'));
  compare('cost of capital — weight of debt', pct(W.weightDebt, 1), await beside(page, 'Weight of debt, gross and at book value'));
  // Three decimal places, not two: the component shows this one finer than the
  // rates above it, because it is the number every discounted figure turns on.
  compare('cost of capital — WACC', pct(W.wacc, 3), await beside(page, 'Weighted average cost of capital'));

  await page.keyboard.press('Escape');

  // ---- the statements, reported and forecast
  await page.getByRole('button', { name: /^3-statement model$/i }).click();
  await page.getByText('Operating profit (EBIT)').first().waitFor({ timeout: 30_000 });

  const years = (M.years as number[]).length;
  const statementLines: [string, any[], (v: any) => string][] = [
    ['Revenue', M.revenue, (v) => fmt(v)],
    ['Operating profit (EBIT)', M.ebit, (v) => fmt(v)],
    ['Net income', M.netIncome, (v) => fmt(v)],
    ['Total assets', M.balanceSheet.totalAssets, (v) => fmt(v)],
    ['Total liabilities', M.balanceSheet.totalLiabilities, (v) => fmt(v)],
    ['Total equity', M.balanceSheet.totalEquity, (v) => fmt(v)],
    // The cash flow statement: reported years are the filing's, forecast years
    // this model's, and the line between them carries the difference (KI-7).
    ['Cash from operating activities', M.cashFlow.operating, (v) => fmt(v)],
    ['of which items in the filing this model does not carry', M.cashFlow.otherOperatingItems, (v) => fmt(v)],
    ['Cash from investing activities', M.cashFlow.investing, (v) => fmt(v)],
    ['Cash from financing activities', M.cashFlow.financing, (v) => fmt(v)],
    ['Net change in cash', M.cashFlow.netChangeInCash, (v) => fmt(v)],
  ];
  for (const [label, values, format] of statementLines) {
    const cells = await rowCells(page, label);
    const expected = values.slice(0, years).map(format);
    const got = cells.slice(0, years);
    const same = expected.length === got.length && expected.every((v, i) => got[i] === v);
    if (same) ok(`${label}: ${expected.length} years match, ${expected[0]} … ${expected[expected.length - 1]}`);
    else fail(`${label} across ${expected.length} years`, expected.join(' | '), got.join(' | ') || '(no row)');
  }

  await page.keyboard.press('Escape');
}

async function checkRefused(page: Page, source: any, company: any, symbol: string) {
  console.log('\n=== the refused company: the reason, and no value anywhere ===');
  const M: any = buildModel(source);
  const D: any = buildDCF(M, source);
  if (D.applicable !== false) {
    problems++;
    console.log('  PROBLEM: the fixture is no longer refused by the engine, so this checks nothing');
    return;
  }

  const body = (await page.textContent('body')) || '';
  if (body.includes('NO VALUE SHOWN')) ok('the page says NO VALUE SHOWN');
  else fail('the refusal heading', 'NO VALUE SHOWN', '(not on the page)');

  // The reason, in the engine's own words. The first sentence is enough: the
  // page wraps and may hyphenate, and a substring match on the whole message
  // would fail on a soft break rather than on a wrong message.
  const firstSentence = String(D.message).split('. ')[0];
  if (body.includes(firstSentence)) ok(`the reason is stated: "${firstSentence.slice(0, 72)}…"`);
  else fail('the refusal message', firstSentence.slice(0, 90), '(not on the page)');

  // NO VALUE ANYWHERE. Not "no headline value" — anywhere. A premium against a
  // price, a football field bar, a reverse DCF: each would be a valuation of a
  // company the engine refused to value.
  const banned: [string, RegExp][] = [
    ['a premium or discount against the price', /\d+(\.\d+)?%\s*(premium|discount)/i],
    ['the football field', /INCOME — DCF/i],
    ['the reverse DCF', /THE PRICE IMPLIES/i],
    ['a terminal reliance panel', /BEYOND THE FORECAST/i],
    ['an intrinsic value heading', /INTRINSIC VALUE, BOTH TERMINAL METHODS/i],
  ];
  for (const [what, pattern] of banned) {
    if (pattern.test(body)) fail(`${what} is shown for a refused company`, 'nothing', 'shown');
    else ok(`no ${what}`);
  }

  // The batch screen: the same company in a list must carry the reason, not a
  // blank row and not a value.
  // Opened from the company's own page, the list arrives seeded with that
  // company, which is the journey a reader actually takes.
  await page.getByRole('button', { name: /model a list/i }).click();
  // SCOPED TO THE OVERLAY, because the company page behind it carries this same
  // sentence. Unscoped, the wait hit two elements and threw strict mode on the
  // runs where both had mounted -- and worse, the assertion below read the whole
  // body, so it would have passed on the page's own copy with the batch row
  // blank. The check now reads only the row it claims to be checking.
  const batch = page.getByRole('dialog', { name: /model a list of companies/i });
  await batch.waitFor({ timeout: 30_000 });
  await batch.getByRole('button', { name: /^run$/i }).first().click({ timeout: 30_000 });
  await batch.getByText(new RegExp(firstSentence.slice(0, 40).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')).first().waitFor({ timeout: 60_000 });
  const batchText = (await batch.textContent()) || '';
  if (batchText.includes(firstSentence.slice(0, 40))) ok('the batch row carries the reason');
  else fail('the batch row', firstSentence.slice(0, 40), '(not on the batch screen)');
  await page.keyboard.press('Escape');

  // The download. A workbook is a page too: it leaves with the reader, and it
  // used to carry a value per share for a company the site had just refused.
  const wb: any = await buildWorkbook({
    model: M,
    dcf: D,
    source,
    companyName: company.name,
    ticker: REFUSED_TICKER,
    currencySymbol: symbol,
    unitLabel: `${symbol} millions`,
    modelLabel: 'Derived model, assumptions taken from reported history',
  });
  const buf = await wb.xlsx.writeBuffer();
  fs.writeFileSync(path.join(OUT, 'refused.xlsx'), Buffer.from(buf as ArrayBuffer));
  const read = new ExcelJS.Workbook();
  await read.xlsx.load(buf);
  let valueRows = 0;
  let reasonFound = false;
  read.eachSheet((ws: any) => {
    ws.eachRow({ includeEmpty: false }, (row: any) => {
      const label = [1, 2, 3]
        .map((c) => String(row.getCell(c).value ?? ''))
        .filter(Boolean)
        .join(' ');
      if (/value per share/i.test(label)) {
        for (let c = 4; c <= 12; c++) {
          const v = row.getCell(c).value;
          if (v != null && v !== '' && !(typeof v === 'string' && /no value/i.test(v))) valueRows++;
        }
      }
      const cells = row.values ? JSON.stringify(row.values) : '';
      if (cells.includes(firstSentence.slice(0, 40))) reasonFound = true;
    });
  });
  if (valueRows === 0) ok('the downloaded workbook shows no value per share');
  else fail('the downloaded workbook', 'no value per share anywhere', `${valueRows} cells carry one`);
  if (reasonFound) ok('the downloaded workbook states the reason');
  else fail('the downloaded workbook', 'the refusal, in the engine’s words', '(not in the file)');
}

// ---- every word on the screen is legible against what is behind it --------
//
// The palette check in `npm run verify` measures the TOKENS. This measures what
// the browser actually paints, which is not the same thing: a colour reaches an
// element through a token, an inline style, a Tailwind arbitrary value, or one
// of the legacy remapping rules in `index.css` — and those rules match on the
// class attribute, which is case-sensitive, so ten classes written in lowercase
// hex were slipping past them entirely and keeping whatever they were written
// with. Nothing short of reading the computed style finds that.
//
// So: walk every element that holds text, take its computed colour and the
// first solid background behind it, and compare. The threshold is WCAG AA —
// 4.5:1 for normal text, 3:1 for large — and the floor per element is chosen
// from its own measured size and weight rather than assumed.
const CONTRAST_PROBE = `(() => {
  const lum = (r,g,b) => { const f=[r,g,b].map(c=>{c/=255;return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4);}); return 0.2126*f[0]+0.7152*f[1]+0.0722*f[2]; };
  const parse = (s) => { const m = s.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(',').map(Number); return { r:p[0], g:p[1], b:p[2], a:p.length>3?p[3]:1 }; };
  const hex = (c) => '#' + [c.r,c.g,c.b].map(v=>Math.round(v).toString(16).padStart(2,'0')).join('').toUpperCase();
  // The first ancestor with a solid fill. A translucent panel is skipped rather
  // than guessed at, which errs towards the page black underneath it.
  const bgOf = (el) => { let n = el; while (n && n !== document.documentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c && c.a > 0.85) return c; n = n.parentElement; } return { r:11, g:11, b:13, a:1 }; };
  const out = [];
  for (const el of document.querySelectorAll('*')) {
    // Only elements holding their OWN text: a wrapper inherits its colour and
    // would be reported once per level of nesting.
    if (!Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim().length > 1)) continue;
    const st = getComputedStyle(el);
    if (st.visibility === 'hidden' || st.display === 'none' || Number(st.opacity) < 0.3) continue;
    const box = el.getBoundingClientRect();
    if (!box.width || !box.height) continue;
    const fg = parse(st.color); if (!fg || fg.a < 0.5) continue;
    const bg = bgOf(el);
    const L1 = lum(fg.r,fg.g,fg.b), L2 = lum(bg.r,bg.g,bg.b);
    const ratio = (Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05);
    const size = parseFloat(st.fontSize), weight = Number(st.fontWeight) || 400;
    const floor = (size >= 24 || (size >= 18.66 && weight >= 700)) ? 3 : 4.5;
    if (ratio < floor) out.push({ fg: hex(fg), bg: hex(bg), ratio: Math.round(ratio*100)/100, floor, size: Math.round(size), text: (el.textContent||'').trim().slice(0,44) });
  }
  return out;
})()`;

const contrastSeen = new Map<string, any>();
let contrastScreens = 0;
let contrastElements = 0;

async function readContrast(page: Page, where: string) {
  const found: any[] = await page.evaluate(CONTRAST_PROBE);
  contrastScreens++;
  contrastElements += await page.evaluate(
    `document.querySelectorAll('*').length`
  ) as number;
  for (const f of found) {
    const key = `${f.fg} on ${f.bg} at ${f.size}px`;
    if (!contrastSeen.has(key)) contrastSeen.set(key, { ...f, where, count: 0 });
    contrastSeen.get(key).count++;
  }
}

function reportContrast() {
  console.log('\n=== every word against what is behind it ===');
  if (!contrastSeen.size) {
    ok(`${contrastScreens} screens, ${contrastElements.toLocaleString('en-GB')} elements: nothing below WCAG AA`);
    return;
  }
  for (const r of [...contrastSeen.values()].sort((a, b) => a.ratio - b.ratio)) {
    problems++;
    console.log(
      `  PROBLEM: ${r.fg} on ${r.bg} is ${r.ratio}:1, under the ${r.floor}:1 floor for ${r.size}px ` +
        `(${r.count} on ${r.where}, e.g. "${r.text}")`
    );
  }
}

// ---- the loading screen, on a build slow enough to read --------------------
//
// The overlay is the one screen a reader sees on every single build and the one
/**
 * THE CARD BECOMES THIS COMPANY'S CARD WHEN ITS FIGURES ARRIVE.
 *
 * The slow-build check above watches a fetch that never answers, so the card it
 * sees is one of the three written for any company — correct, and not the half
 * that matters. This one asserts the card on screen is one THIS COMPANY EARNED:
 * its condition true on the paper company's own filed statements, computed here
 * from the fixture rather than read off the page, so the two sides come from
 * opposite directions.
 *
 * AND IT IS DRIVEN AGAINST A COLD FETCH, THREE SECONDS SLOW, because that is
 * the shape the screen is hardest on and the shape the first version of it got
 * wrong. An instant fixture hands the figures over before the card has even
 * appeared, so the card is this company's from first sight and nothing about
 * the handover is exercised at all. Three seconds is inside the minimum hold
 * (4.8s in `App.tsx`), so the overlay is still on screen when the figures land
 * and the correction has to arrive before it closes.
 */
async function checkCardFromFigures(page: Page) {
  console.log('\n=== the card the company\u2019s own figures earn ===');
  const { MYTH_FACT_CARDS } = await import(`file:///${REPO}/src/data/mythFactCards.ts`);
  const { CONDITIONS, Figures } = await import(`file:///${REPO}/src/data/mythFactMatch.ts`);
  const cards: any[] = MYTH_FACT_CARDS as any[];

  const figures = new (Figures as any)((paperPayload as any)('valued').statements);
  const earned = cards.filter((c) => {
    if (c.showWhen.trim().toLowerCase() === 'any company') return false;
    if (c.appliesTo === 'Banks only') return false;
    try {
      return (CONDITIONS as any)[c.id](figures) === true;
    } catch {
      return false;
    }
  });
  if (!earned.length) {
    fail('the paper company earning a card', 'at least one condition true on its filings', 'none');
    return;
  }

  // A page route, which takes precedence over the fixture route on the context,
  // and is lifted again at the end of the check.
  const COLD_MS = 3_000;
  await page.route('**/api/company*', async (route) => {
    await new Promise((r) => setTimeout(r, COLD_MS));
    const url = new URL(route.request().url());
    const ticker = (url.searchParams.get('ticker') || '').toUpperCase();
    try {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(fixtureFor(ticker) ?? { ...paperPayload('valued'), ticker }),
      });
    } catch {
      // A HANDLER THAT SLEEPS CAN OUTLIVE ITS OWN CHECK. This one holds the
      // fetch for three seconds on purpose; a request that arrives in the last
      // moments is still asleep when the check lifts the route, the context
      // route answers it instead, and fulfilling then throws "Route is already
      // handled" — out of a promise nothing awaits, which takes the whole run
      // down mid-suite with no count at the end. That is the harness racing
      // itself, not a finding about the product, so it is swallowed here and
      // nowhere else: every assertion in this file still runs through `fail`.
    }
  });

  const overlay = page.getByRole('status').filter({ hasText: /building the model/i }).first();
  const started = search(page, PAPER_TICKER);
  await overlay.waitFor({ state: 'visible', timeout: 30_000 });

  // Sampled across the hold, because the card starts as one written for any
  // company and becomes this one's the moment the filings land.
  const seen = new Set<number>();
  const factsSeen = new Set<number>();
  let introduced = '';
  for (let i = 0; i < 14; i++) {
    const id = await overlay
      .locator('[data-myth-card]')
      .first()
      .getAttribute('data-myth-card')
      .catch(() => null);
    if (id) seen.add(Number(id));
    const text = (await overlay.textContent().catch(() => null)) || '';
    for (const card of cards) if (text.includes(card.fact)) factsSeen.add(card.id);
    // THE SENTENCE THAT INTRODUCES AN EARNED CARD, read while it is on screen
    // and with the mechanism OPEN, which is the only state it exists in: the
    // \u24D8 renders its text only when open, and the slow-build check cannot
    // reach this sentence at all because a fetch that never answers can only
    // ever show a card written for any company. Opened here, in the second and
    // a half between the correction arriving and the overlay closing.
    if (!introduced && [...factsSeen].some((id) => earned.some((c) => c.id === id))) {
      const hint = overlay.locator('button[data-hint]').first();
      if (await hint.count()) {
        await hint.focus().catch(() => {});
        await page.waitForTimeout(150);
        introduced = (await overlay.textContent().catch(() => null)) || '';
      }
    }
    if (!(await overlay.isVisible().catch(() => false))) break;
    await page.waitForTimeout(400);
  }
  await started.catch(() => {});

  const matched = [...seen].filter((id) => earned.some((c) => c.id === id));
  if (!matched.length) {
    fail(
      'the card on the loading screen once the figures land',
      `one of the ${earned.length} the paper company earns (${earned.map((c) => c.id).join(', ')})`,
      seen.size ? `only ${[...seen].join(', ')}, which it did not earn` : 'no card at all'
    );
  } else {
    const card = earned.find((c) => c.id === matched[0]);
    ok(
      `the card became one of the ${earned.length} this company earned \u2014 #${card.id}, because ` +
        `"${String(card.showWhen).slice(0, 62)}"`
    );
  }

  // AND ITS CORRECTION REACHED THE SCREEN BEFORE THE SCREEN CLOSED.
  //
  // This is the half the id on its own does not prove, and it was broken when
  // it shipped. The overlay lives until the fetch is done and the minimum hold
  // is served, and the first version of the card restarted both beats every
  // time the figures arrived — with the result that the earned card's fact
  // was scheduled 2.2 seconds after figures that arrive at the very moment the
  // screen is allowed to close. The reader got a belief and no correction,
  // which is worse than showing them nothing: the myth is the half that is
  // wrong.
  //
  // Checked against this ordinary search rather than the held fetch, because
  // an ordinary search is the one that closes on time.
  const earnedFact = [...factsSeen].filter((id) => earned.some((c) => c.id === id));
  if (!earnedFact.length) {
    fail(
      'the correction on the card the figures earned',
      'the fact, in the card\u2019s own words, before the overlay closed',
      factsSeen.size
        ? `only the fact of card ${[...factsSeen].join(", ")}, which it did not earn`
        : 'the myth, and then the screen went'
    );
  } else {
    ok(`and its correction was on screen before the overlay closed (card ${earnedFact[0]})`);
  }

  // A CARD IS NOT A VERDICT, and the sentence introducing an EARNED one is
  // where saying so is hardest: the condition that picked it really is about
  // these filings, the reader is owed that, and it still has to be put as what
  // it is \u2014 a common misunderstanding about accounts rather than a finding
  // about whoever is on screen. The sixty cards contain the phrase nowhere, and
  // the CSV check holds them to the character, so a match here came from this
  // screen.
  if (!introduced) {
    fail(
      'the sentence that introduces the card',
      'the mechanism opened while the earned card was on screen',
      'the overlay closed before it could be read'
    );
  } else {
    const verdict = introduced.match(/this compan(y|ies)[^.]{0,60}/i);
    if (verdict) {
      fail(
        'a card introduced as education rather than as a verdict',
        'no \u201cthis company\u201d in the sentence that says why this card',
        `"${verdict[0]}"`
      );
    } else {
      ok('the earned card is introduced as education, with no \u201cthis company\u201d anywhere in it');
    }
  }

  await page.unroute('**/api/company*');
}

// screen nothing rendered checked, because in a fast harness it is gone before
// anything can look at it. So the fetch is held open on purpose and the overlay
// is read while it waits.
//
// Four things are asserted, and the last is the one this check exists for.
//
//   THE MYTH IS SHOWN FIRST, on its own. A fact printed under the belief at the
//   same instant is a caption on it; a reader has to have had the chance to
//   agree with the myth for the correction to land.
//
//   THE FACT FOLLOWS, in the card's own words, not a fragment.
//
//   THE WHY IS BEHIND THE ⓘ and nowhere else. The mechanism is three lines of
//   prose, and three lines of prose on a screen somebody is waiting to leave is
//   three lines nobody reads. It opens on keyboard focus, which is also the
//   half that is easy to lose.
//
//   THE SCREEN DOES NOT HOLD ONE THING FOR THE WHOLE WAIT. A reader who waits
//   seventeen seconds must not spend seventeen seconds on one sentence. That
//   was asserted against the notes this card replaced, and `ROADMAP.md` §19c
//   says it applies to whatever replaces them.
//
//   NOTHING AT ALL FOR THE FIRST SECOND. A cached answer comes back in a few
//   hundred milliseconds, and a card that appears and goes inside that is a
//   flicker rather than a sentence. So the overlay is read the instant it is
//   visible, when there must be no card, and the card's own arrival is timed.
//
//   IT IS LABELLED A COMMON MYTH, AND SAYS NOTHING ABOUT THE COMPANY. Sixty
//   cards about how accounts behave are education; the same sixty introduced as
//   something about the company on screen are a verdict on a security, which
//   standing decision 6 does not allow. The label is asserted, and so is the
//   absence of the phrase.
async function checkSlowBuild(context: BrowserContext, page: Page) {
  console.log('\n=== the loading screen, on a slow build ===');
  const { MYTH_FACT_CARDS } = await import(`file:///${REPO}/src/data/mythFactCards.ts`);
  const cards: any[] = MYTH_FACT_CARDS as any[];

  // Held for longer than the myth's own beat so the second half is certain,
  // then released; the route is put back afterwards so nothing later inherits
  // a slow fetch.
  const HOLD_MS = 17_000;
  await context.unroute('**/api/company*');
  await context.route('**/api/company*', async (route) => {
    await new Promise((r) => setTimeout(r, HOLD_MS));
    const url = new URL(route.request().url());
    const ticker = (url.searchParams.get('ticker') || '').toUpperCase();
    // Swallowed for the same reason as the three-second handler above: a
    // sleeping handler whose route is lifted while it sleeps cannot fulfil, and
    // the throw comes out of a promise nothing awaits.
    try {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(fixtureFor(ticker) ?? { ...paperPayload('valued'), ticker }),
      });
    } catch {
      /* the check has ended and something else answered the request */
    }
  });

  const overlay = page.getByRole('status').filter({ hasText: /building the model/i }).first();
  const read = async () => {
    const text = (await overlay.textContent().catch(() => null)) || '';
    return {
      text,
      myth: cards.find((c) => text.includes(c.myth)) ?? null,
      fact: cards.find((c) => text.includes(c.fact)) ?? null,
    };
  };

  // Deliberately NOT awaited: the click starts a fetch that will not answer for
  // seventeen seconds, and the overlay is read while it is outstanding.
  const started = search(page, PAPER_TICKER);
  await overlay.waitFor({ state: 'visible', timeout: 30_000 });

  // ---- 0. NOT A FLICKER: NO CARD IN THE FIRST SECOND ----
  //
  // TWO ASSERTIONS, AND THE FIRST IS THE ONE THAT HOLDS.
  //
  // No card when the overlay is first read: that read lands wherever it lands
  // and the hold-off has to have outlasted it.
  //
  // Then the arrival is timed, from first sight rather than from the click,
  // which this check cannot see: the search is deliberately not awaited so the
  // overlay can be read while the fetch is outstanding. First sight trails the
  // overlay opening by about a third of a second in this harness (the measured
  // arrival is 671ms against a 1,000ms hold-off), so the floor is set below the
  // hold-off by more than that margin. Between them the two catch a hold-off
  // shortened to anything a reader could not read.
  const openedAt = Date.now();
  const atOnce = await overlay.locator('[data-myth-card]').count();
  if (atOnce) {
    fail(
      'the card held back while a quick build could still finish',
      'the progress rule alone for the first second',
      `a card ${Date.now() - openedAt}ms after the overlay opened`
    );
  }
  let appearedAfter: number | null = null;
  for (let waited = 0; waited < 5000; waited += 100) {
    if (await overlay.locator('[data-myth-card]').count()) {
      appearedAfter = Date.now() - openedAt;
      break;
    }
    await page.waitForTimeout(100);
  }
  if (appearedAfter === null) {
    fail('the card on the loading screen', 'a card within five seconds', 'none ever appeared');
  } else if (appearedAfter < 500) {
    fail(
      'the card held back while a quick build could still finish',
      'no card inside the first second',
      `the card appeared ${appearedAfter}ms in`
    );
  } else {
    ok(
      `no card when the overlay was first read, and the card ${appearedAfter}ms later: a build that ` +
        'finishes inside a second shows the progress rule and closes rather than flashing a myth'
    );
  }

  // ---- 1. THE MYTH BEFORE THE FACT ----
  const first = await read();
  if (!first.myth) {
    fail('a card on the loading screen', 'the myth from one of the sixty cards', `"${first.text.slice(0, 80)}"`);
  } else if (first.fact) {
    fail(
      'the myth shown on its own first',
      'the belief, with its correction a beat later',
      'both at once, which makes the fact a caption on the myth'
    );
  } else {
    ok(`the myth is shown first and alone: "${first.myth.myth.slice(0, 56)}…"`);
  }

  // ---- 2. AND THEN THE FACT, AND THE CARD CHANGES AT LEAST ONCE ----
  const states: string[] = [];
  let sawFact: any = null;
  for (let waited = 0; waited < HOLD_MS - 2000; waited += 900) {
    const now = await read();
    const state = `${now.myth?.id ?? '-'}/${now.fact?.id ?? '-'}`;
    if (states[states.length - 1] !== state) states.push(state);
    if (now.fact && !sawFact) sawFact = now.fact;
    await page.waitForTimeout(900);
  }
  await started.catch(() => {});

  if (!sawFact) {
    fail('the fact following the myth', "the card's own correction", 'the myth held the screen alone');
  } else {
    ok(`the fact follows it: "${sawFact.fact.slice(0, 56)}…"`);
  }
  if (states.length < 2) {
    fail(
      'the loading screen changing during a slow build',
      `at least two states across ${Math.round(HOLD_MS / 1000)} seconds`,
      `one: ${states[0] ?? '(nothing)'} held the whole wait`
    );
  } else {
    ok(`${states.length} states over ${Math.round(HOLD_MS / 1000)} seconds (${states.join(' then ')}), so nothing holds the screen for the whole wait`);
  }

  // ---- 2b. LABELLED A COMMON MYTH, AND NOT ABOUT THE COMPANY ----
  const panel = (await overlay.textContent().catch(() => null)) || '';
  if (!/common myth/i.test(panel)) {
    fail(
      'the card labelled as a common myth',
      'the words \u201cCommon myth\u201d beside the belief',
      `"${panel.replace(/\s+/g, " ").slice(0, 90)}"`
    );
  } else {
    ok('the card is labelled a common myth, so the belief is not read as a finding');
  }
  // ---- 3. THE WHY IS BEHIND THE ⓘ, AND REACHABLE BY KEYBOARD ----
  const body = (await page.textContent('body')) || '';
  const openWhy = cards.find((c) => body.includes(c.why));
  if (openWhy) {
    fail(
      'the mechanism behind the ⓘ',
      'the why reached by hover, focus or tap',
      `card ${openWhy.id}'s why is printed on the screen`
    );
  } else {
    ok('no card prints its mechanism in the open');
  }
  const hint = overlay.locator('button[data-hint]').first();
  if (!(await hint.count())) {
    fail('the ⓘ on the card', 'a button beside the fact', 'no such control');
  } else {
    await hint.focus();
    await page.waitForTimeout(300);
    const opened = (await page.textContent('body')) || '';
    const why = cards.find((c) => opened.includes(c.why));
    if (why) ok(`the ⓘ opens the mechanism on keyboard focus: "${why.why.slice(0, 54)}…"`);
    else fail('the ⓘ on the card', "the card's why, on keyboard focus", 'nothing opened');

    // ---- AND NOTHING ANYWHERE SAYS THE CARD IS ABOUT THIS COMPANY ----
    //
    // Read with the mechanism OPEN as well as closed, because the sentence that
    // introduces a card lives inside it and the Hint renders its text only
    // while it is open. Scanning the closed panel alone passed a card
    // introduced as \u201cShown because this company's filed figures meet\u201d,
    // which is the exact wording this is here to keep off the screen.
    //
    // The sixty cards are general by construction (none of them contains the
    // phrase) and the CSV check holds them to the character, so anything
    // matching came from this screen rather than from a card.
    const verdict = `${panel} ${opened}`.match(/this compan(y|ies)[^.]{0,60}/i);
    if (verdict) {
      fail(
        'a card that says nothing about the company it is shown beside',
        'no \u201cthis company\u201d on the loading screen, open or closed',
        `"${verdict[0]}"`
      );
    } else {
      ok(
        'nothing on the screen, with the mechanism open or closed, makes the card a statement ' +
          'about the company being built'
      );
    }
    await page.keyboard.press('Escape').catch(() => {});
  }

  // Put the instant fixture back for anything that runs after this.
  await context.unroute('**/api/company*');
  await context.route('**/api/company*', async (route) => {
    const url = new URL(route.request().url());
    const ticker = (url.searchParams.get('ticker') || '').toUpperCase();
    const payload = fixtureFor(ticker);
    if (!payload) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: `No fixture for ${ticker}` }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
  });
}


/**
 * A VALUE SHOWN IN THE CURRENCY THE SHARE TRADES IN, IN A BROWSER.
 *
 * The model is built in the currency the statements are in and discounted at
 * that currency's own bond yield (`METHODOLOGY.md` S3), so a company that files
 * in dollars and trades in another currency gets a dollar value per share. The
 * screen now carries the same figure in the trading currency as well, converted
 * at the one rate disclosed with the price.
 *
 * Three things are read off the rendered page:
 *
 *   1. THE FIGURE IS THE VALUE DIVIDED BY THE PAIR'S RATE. The hero's own
 *      number is read from the screen and divided by the rate this fixture
 *      states, here, as a literal. Dividing by a constant written in the check
 *      is the point: the screen cannot agree with itself.
 *
 *   2. THE PRICE'S OWN FIGURE IS WHAT THE EXCHANGE QUOTED. Compared against
 *      `quote.asQuoted`, which the fixture records before any conversion.
 *
 *   3. THE DISCLOSED RATE IS THE PAIR'S, NOT THE COMPOSITE. The header used to
 *      read "converted at 0.013246 (GBPUSD=X)" where GBPUSD=X is 1.3246,
 *      because it printed the number applied to a quote in pence beside the
 *      name of the pair that number came from. So this asserts 1.3246 is on
 *      the page and 0.013246 is not.
 */
async function checkTradingCurrencyOnScreen(page: Page, ticker: string) {
  console.log('\n=== a value shown in the currency the share trades in ===');
  await openModelled(page, ticker);

  // 1. the hero. Scoped to the figure it belongs to rather than searched for
  //    across the body, because a body-wide match would also pass with the
  //    figure blank.
  const foot = page.getByText(/in GBP, the currency the share trades in/).first();
  if (!(await foot.count())) {
    fail(
      'the value in the currency the share trades in',
      'a line under the intrinsic value reading "£… in GBP, the currency the share trades in"',
      'no such line on the analysis screen'
    );
  } else {
    const figure = foot.locator('xpath=..');
    const text = ((await figure.textContent()) || '').replace(/\s+/g, ' ');
    const dollars = text.match(/\$([\d,]+\.\d\d)/);
    const pounds = text.match(/£([\d,]+\.\d\d)/);
    if (!dollars || !pounds) {
      fail('the two figures under the intrinsic value', 'a $ figure and a £ figure', `"${text.slice(0, 110)}"`);
    } else {
      const inUsd = Number(dollars[1].replace(/,/g, ''));
      const inGbp = Number(pounds[1].replace(/,/g, ''));
      const expected = inUsd / CONVERTED_RATE;
      if (Math.abs(inGbp - expected) <= 0.02) {
        ok(
          `the intrinsic value reads $${inUsd.toFixed(2)} and £${inGbp.toFixed(2)} beside it ` +
            `— the value divided by ${CONVERTED_RATE}, the rate the pair publishes`
        );
      } else {
        fail(
          'the value in the trading currency',
          `£${expected.toFixed(2)} ($${inUsd.toFixed(2)} ÷ ${CONVERTED_RATE})`,
          `£${inGbp.toFixed(2)}`
        );
      }
    }
  }

  // 2. the price, against the figure the exchange published.
  const quoted = (paperPayload('converted') as any).quote.asQuoted;
  const expectedPrice = quoted.price * CONVERTED_MINOR_UNIT;
  const priceFoot = page.getByText(/as quoted$/).first();
  if (!(await priceFoot.count())) {
    fail('the price in the currency it is quoted in', 'a line reading "£… as quoted"', 'no such line');
  } else {
    const text = ((await priceFoot.textContent()) || '').trim();
    const shown = Number((text.match(/£([\d,]+\.\d\d)/) || [, 'x'])[1].replace(/,/g, ''));
    if (Math.abs(shown - expectedPrice) <= 0.02) {
      ok(
        `the price reads "${text}" — the ${quoted.price.toFixed(1)} pence the exchange quoted, ` +
          'which is what the fixture recorded before anything was converted'
      );
    } else {
      fail('the price in the currency it is quoted in', `£${expectedPrice.toFixed(2)}`, text);
    }
  }

  // 3. the rate the reader is told, opened from its own summary so the
  //    assertion is scoped to the disclosure and not to the whole page.
  const summary = page.getByText(/What this price is quoted in, and what the value is worth in it/).first();
  if (!(await summary.count())) {
    fail('the currency disclosure', 'a row reading "What this price is quoted in…"', 'no such row');
  } else {
    await summary.click();
    await page.waitForTimeout(300);
    const body = ((await page.textContent('body')) || '').replace(/\s+/g, ' ');
    const saysPair = body.includes(`${CONVERTED_RATE} USD per GBP`) && body.includes('GBPUSD=X');
    const saysComposite = body.includes(String(CONVERTED_RATE * CONVERTED_MINOR_UNIT));
    if (saysPair && !saysComposite) {
      ok(`the disclosure says ${CONVERTED_RATE} USD per GBP (GBPUSD=X), and does not print the composite rate`);
    } else {
      fail(
        'the disclosed rate',
        `"${CONVERTED_RATE} USD per GBP (GBPUSD=X)" and not ${CONVERTED_RATE * CONVERTED_MINOR_UNIT}`,
        `pair rate on the page: ${saysPair}; composite on the page: ${saysComposite}`
      );
    }
    // Said once, where the pence are explained, so a reader is not left to
    // work out why a £ price is a hundred times the number on their screen.
    if (body.includes('100 to one GBP')) ok('the disclosure says the quote is in pence, 100 to one GBP');
    else fail('what the quoted unit is', '"100 to one GBP" in the disclosure', 'not said');
  }
}


/**
 * THE COMPANY PAGE: EVERY TAB HAS AN ADDRESS, AND EVERY ADDRESS LOADS.
 *
 * The point of the hub is that a reader can send somebody a link. So this walks
 * `COMPANY_TABS` rather than a list kept here — a tenth tab is checked the day
 * it is added, without anybody remembering — and for each one it NAVIGATES TO
 * THE ADDRESS DIRECTLY rather than clicking the tab. Clicking would only prove
 * the React state changes; typing the address is what a shared link does, and
 * it is the half that breaks when the host has no rewrite for deep paths.
 *
 * What each tab must show:
 *   every tab     the company's name, and its own tab marked as the current one
 *   overview      the figures, a drawn chart, and no figure printed as a zero
 *   model         the way into the figures → questions → valuation flow
 *   the other six one line saying what is being built, and nothing that looks
 *                 like data
 */
/**
 * THE RISK AND COST-OF-CAPITAL CARD, ON THE SCREEN (docs/COST_OF_CAPITAL_SPEC.md).
 *
 * `npm run verify` checks the arithmetic over every payload on disk. What can
 * only be checked here is whether a reader can SEE it: whether every input
 * carries a source and a date where a person would look for one, whether the
 * two figures at the top are the ones the rows underneath add up to, and
 * whether an edit made with a keyboard reaches the valuation.
 *
 * THE ARITHMETIC IS READ OFF THE SCREEN, not recomputed. The check parses the
 * risk-free rate, the beta and the premium as printed, works out what the cost
 * of equity must be from those three, and compares it with the cost of equity
 * as printed. That is exactly the sum a reader would do to decide whether to
 * trust the card, and it cannot pass by comparing a figure against itself: the
 * expected value comes from three other figures on the page.
 */
async function checkCostOfCapitalOnScreen(page: Page) {
  console.log('\n=== the company page: the risk and cost-of-capital card ===');
  const { PAPER_INDEX_BETA } = await import(`file:///${REPO}/verify/fixtures/paperCompany.mts`);

  await page.goto(`${BASE}/company/${PAPER_TICKER}/overview`, { waitUntil: 'domcontentloaded' });
  const card = page.locator('section[aria-label="Risk and cost of capital"]').first();
  try {
    await card.waitFor({ timeout: 60_000 });
  } catch {
    fail('the Overview tab', 'a risk and cost-of-capital card', 'no such card on the page');
    return;
  }

  const num = (text: string | null | undefined): number | null => {
    const m = /(-?[\d,]+\.?\d*)/.exec(String(text ?? '').replace(/\s+/g, ' '));
    return m ? Number(m[1].replace(/,/g, '')) : null;
  };
  const valueOf = async (key: string) =>
    num(await card.locator(`[data-coc-value="${key}"]`).first().textContent().catch(() => ''));
  const rowValue = async (key: string) => {
    const row = card.locator(`[data-coc-row="${key}"]`).first();
    const edit = row.locator(`[data-coc-edit]`).first();
    if (await edit.count()) return num(await edit.textContent());
    return num(await row.locator(`[data-coc-value="${key}"]`).first().textContent().catch(() => ''));
  };

  // ---- 1. THE TWO FIGURES, AND THE ROWS THEY ARE MADE OF ---------------
  const ke = await valueOf('costOfEquity');
  const wacc = await valueOf('wacc');
  const riskFree = await rowValue('riskFree');
  const beta = await rowValue('beta');
  const premium = await rowValue('erp');
  if (ke === null || wacc === null || riskFree === null || beta === null || premium === null) {
    fail(
      'the card',
      'a cost of equity, a WACC, a risk-free rate, a beta and a premium, all shown',
      `ke=${ke} wacc=${wacc} rf=${riskFree} beta=${beta} erp=${premium}`
    );
  } else {
    const byHand = riskFree + beta * premium;
    if (Math.abs(byHand - ke) > 0.02) {
      fail(
        'the cost of equity on the card',
        `${riskFree}% + ${beta} x ${premium}% = ${byHand.toFixed(2)}%, from the rows underneath it`,
        `${ke}%`
      );
    } else {
      ok(`the cost of equity is the three rows under it: ${riskFree}% + ${beta} x ${premium}% = ${ke}%`);
    }
    if (!(wacc < ke)) {
      fail(
        'the WACC against the cost of equity',
        'below it, because this company borrows and debt is cheaper after tax',
        `WACC ${wacc}% against a cost of equity of ${ke}%`
      );
    }
  }

  // ---- 2. EVERY INPUT SHOWS A SOURCE AND A DATE ------------------------
  //
  // Read from the rendered page rather than from the data, because a source
  // that exists in the object and is not drawn is a source the reader does not
  // have. A date is a date: either an ISO one or a named vintage.
  const rows = await card.locator('[data-coc-row]').all();
  let sourced = 0;
  const unsourced: string[] = [];
  for (const row of rows) {
    const key = (await row.getAttribute('data-coc-row')) || '?';
    const text = ((await row.textContent()) || '').replace(/\s+/g, ' ');
    if (/^(costOfEquity|wacc)$/.test(key)) continue; // the two figures, not inputs
    const sourceLine = row.locator('[data-coc-source]').first();
    if (!(await sourceLine.count())) {
      // A row with no figure must say why instead.
      if (/—/.test(text) && /\b(not|no|cannot|could not)\b/i.test(text)) continue;
      unsourced.push(`${key}: "${text.slice(0, 80)}"`);
      continue;
    }
    const line = ((await sourceLine.textContent()) || '').replace(/\s+/g, ' ');
    // A DATE IS A DAY, A MONTH-AND-YEAR OR A FISCAL YEAR. Damodaran's ratings
    // table is dated "January 2026" on its own page and his country table
    // "January 5, 2026"; a vintage with no day in it is still a date, and the row
    // carries what the publisher published rather than a day invented to satisfy
    // a pattern.
    if (!/\d{4}-\d{2}-\d{2}|\b[A-Z][a-z]+ \d{1,2}, \d{4}\b|\b[A-Z][a-z]+ \d{4}\b|\bFY\d{4}\b/.test(line)) {
      unsourced.push(`${key}: a source with no date — "${line.slice(0, 80)}"`);
      continue;
    }
    sourced++;
  }
  if (unsourced.length) {
    fail(
      'the inputs on the card',
      'a publisher and a date on every one, or a reason there is no figure',
      unsourced.join(' | ').slice(0, 220)
    );
  } else {
    ok(`${sourced} inputs on the card each name a publisher and a date on screen`);
  }

  // ---- 3. THE BETA WE MEASURED, WITH ITS DIAGNOSTICS -------------------
  const betaBlock = ((await card.textContent()) || '').replace(/\s+/g, ' ');
  const measured = /5 years, monthly: raw ([\d.]+), Blume-adjusted ([\d.]+) — (\d+) returns, R² ([\d.]+)%, standard error ([\d.]+)/.exec(
    betaBlock
  );
  if (!measured) {
    fail(
      'the measured beta',
      'the five-year monthly regression with its observations, R squared and standard error (rule 4)',
      `"${betaBlock.slice(betaBlock.indexOf('Beta, measured here'), betaBlock.indexOf('Beta, measured here') + 160)}"`
    );
  } else {
    const raw = Number(measured[1]);
    const adjusted = Number(measured[2]);
    // The fixture's share and index are built from one ratio of daily returns,
    // so the slope is 1.25 up to the compounding of months of unequal length.
    if (Math.abs(raw - PAPER_INDEX_BETA) > 0.03) {
      fail('the measured beta', `${PAPER_INDEX_BETA} give or take 0.03, by construction`, String(raw));
    } else if (Math.abs(adjusted - ((2 / 3) * raw + 1 / 3)) > 0.002) {
      fail('the Blume-adjusted beta', `two thirds of ${raw} plus a third of 1`, String(adjusted));
    } else if (!/not the measured figure above/.test(betaBlock)) {
      fail(
        'what the card says about which beta the model uses',
        'that the model is not using the measured figure (rule 9)',
        'no such sentence'
      );
    } else {
      ok(
        `the beta measured on screen is ${raw} raw and ${adjusted} adjusted over ${measured[3]} returns, ` +
          `R² ${measured[4]}%, standard error ${measured[5]} — and the card says the model is not using it`
      );
    }
  }

  // ---- 4. COUNTRY RISK IS IN THE PREMIUM, ONCE, AND SAYS SO ------------
  //
  // On by default since 2026-10-30 (spec rule 14), so the click here takes it
  // OUT and the arithmetic runs the other way: the premium must fall by this
  // country's own premium and the cost of equity by beta times it, and the row
  // must stop calling itself the total.
  const toggle = card.locator('[data-coc-country-risk]').first();
  if (!(await toggle.count())) {
    fail('the country risk premium row', 'a control saying whether it is included', 'no such control');
  } else {
    const before = await toggle.getAttribute('data-coc-country-risk');
    const crp = await rowValue('crp');
    const keBefore = await valueOf('costOfEquity');
    const erpLabelBefore = ((await card.locator('[data-coc-row="erp"] dt').first().textContent()) || '').trim();
    await toggle.evaluate((el: any) => el.click());
    await page.waitForTimeout(250);
    const after = await toggle.getAttribute('data-coc-country-risk');
    const keAfter = await valueOf('costOfEquity');
    const erpAfter = await rowValue('erp');
    const erpLabelAfter = ((await card.locator('[data-coc-row="erp"] dt').first().textContent()) || '').trim();
    if (before !== 'on' || after !== 'off') {
      fail('the country risk control', 'included by default, and switched off by a click', `${before} then ${after}`);
    } else if (crp === null || keBefore === null || keAfter === null || erpAfter === null || beta === null || premium === null) {
      fail('the country risk premium', 'a figure on the card', `crp=${crp} keBefore=${keBefore} keAfter=${keAfter}`);
    } else if (Math.abs(premium - (erpAfter + crp)) > 0.02) {
      fail(
        'the premium with country risk in it',
        `${erpAfter}% mature + ${crp}% country = ${(erpAfter + crp).toFixed(2)}%`,
        `${premium}% before the switch`
      );
    } else if (Math.abs(keBefore - keAfter - beta * crp) > 0.02) {
      fail(
        'what taking country risk out does to the cost of equity',
        `beta ${beta} times ${crp}% = ${(beta * crp).toFixed(2)} points less`,
        `${(keBefore - keAfter).toFixed(2)} points — it has been counted twice or not at all`
      );
    } else if (!/total/i.test(erpLabelBefore) || /total/i.test(erpLabelAfter)) {
      fail(
        'the premium row renaming itself',
        '"total" with country risk in and "mature market" with it switched off, so a reader can tell them apart',
        `"${erpLabelBefore}" then "${erpLabelAfter}"`
      );
    } else {
      ok(
        `the premium includes country risk by default (${premium}%), switching it off leaves the ` +
          `mature-market ${erpAfter}% and takes beta times ${crp}% off the cost of equity, and the row ` +
          `renames itself "${erpLabelAfter}"`
      );
    }
    await toggle.evaluate((el: any) => el.click());
    await page.waitForTimeout(200);
  }

  // ---- 4b. THE MEASURED BETA GOES INTO THE MODEL FROM THE SCREEN -------
  //
  // Nihar's decision of 2026-10-30: the model's default stays the asset beta of
  // 1.0 and the reader may put either measured figure in, per company. The
  // button has to do what it says — the beta row must show the figure printed
  // on the button, and the valuation must move — because an input that moves a
  // number beside it and not the valuation under it is the Editable Row Rule's
  // whole point (DESIGN.md).
  const useRaw = card.locator('[data-coc-use-beta="monthly-raw"]').first();
  if (!(await useRaw.count())) {
    fail('the measured beta', 'a control that puts it into the model', 'no such control');
  } else {
    const offered = num(await useRaw.textContent());
    const betaBefore = await rowValue('beta');
    const valueBefore = await valueOf('valuePerShare');
    const choiceBefore = await card.locator('[data-coc-beta-choice]').first().getAttribute('data-coc-beta-choice');
    await useRaw.evaluate((el: any) => el.click());
    await page.waitForTimeout(300);
    const betaAfter = await rowValue('beta');
    const keAfter = await valueOf('costOfEquity');
    const rfAfter = await rowValue('riskFree');
    const erpNow = await rowValue('erp');
    const valueAfter = await valueOf('valuePerShare');
    const choiceAfter = await card.locator('[data-coc-beta-choice]').first().getAttribute('data-coc-beta-choice');
    const warned = await card.locator('[data-coc-beta-warning]').count();
    if (offered === null || betaBefore === null || betaAfter === null || valueBefore === null || valueAfter === null) {
      fail(
        'putting the measured beta into the model',
        'a beta and a value per share before and after',
        `offered=${offered} beta ${betaBefore}->${betaAfter} value ${valueBefore}->${valueAfter}`
      );
    } else if (Math.abs(betaAfter - offered) > 0.0015) {
      fail(
        'the beta the model uses after choosing the measured one',
        `the ${offered} printed on the button, not a figure levered again`,
        String(betaAfter)
      );
    } else if (choiceBefore !== 'default' || choiceAfter !== 'measured-raw') {
      fail(
        'what the card says about where its beta came from',
        'the default before the click and the measured regression after it',
        `${choiceBefore} then ${choiceAfter}`
      );
    } else if (keAfter === null || rfAfter === null || erpNow === null || Math.abs(rfAfter + betaAfter * erpNow - keAfter) > 0.02) {
      fail(
        'the cost of equity on the measured beta',
        `${rfAfter}% + ${betaAfter} x ${erpNow}%, from the rows on the screen`,
        `${keAfter}%`
      );
    } else if (Math.abs(valueAfter - valueBefore) < 1e-9) {
      fail(
        'the value per share after choosing the measured beta',
        'a different value, because the beta the model discounts at has changed',
        `${valueBefore} both before and after — the button moved the row and not the model`
      );
    } else if (warned > 0) {
      fail(
        'the warning beside a measured beta',
        'nothing, on a fit this company is built to produce exactly',
        'a warning about a loose fit'
      );
    } else {
      ok(
        `choosing the measured beta of ${offered} takes the model from ${betaBefore} to ${betaAfter}, the ` +
          `cost of equity to ${keAfter}% and the value per share from ${valueBefore} to ${valueAfter}`
      );
    }
    const resetAll = card.locator('button', { hasText: 'Reset all' }).first();
    if (await resetAll.count()) {
      await resetAll.evaluate((el: any) => el.click());
      await page.waitForTimeout(250);
    }
  }

  // ---- 5. AN EDIT REACHES THE VALUATION -------------------------------
  const valueBefore = await valueOf('valuePerShare');
  const edit = card.locator('[data-coc-edit="riskFreePct"]').first();
  if (!(await edit.count()) || valueBefore === null) {
    fail(
      'editing the risk-free rate',
      'an editable risk-free rate and a value per share beside it',
      `editable: ${await edit.count()}, value: ${valueBefore}`
    );
  } else {
    await edit.evaluate((el: any) => el.click());
    const field = card.locator('input[type="text"]').first();
    await field.waitFor({ timeout: 10_000 });
    await field.fill(String(((riskFree ?? 4) + 2).toFixed(2)));
    await field.press('Enter');
    await page.waitForTimeout(350);
    const keAfter = await valueOf('costOfEquity');
    const valueAfter = await valueOf('valuePerShare');
    const onDefaults = await valueOf('valueOnDefaults');
    if (keAfter === null || ke === null || Math.abs(keAfter - ke - 2) > 0.02) {
      fail(
        'two points on the risk-free rate',
        `the cost of equity two points higher, at ${ke === null ? '?' : (ke + 2).toFixed(2)}%`,
        `${keAfter}%`
      );
    } else if (valueAfter === null || Math.abs(valueAfter - valueBefore) < 0.005) {
      fail(
        'two points on the risk-free rate',
        'a different value per share — the edit has to reach the model',
        `${valueBefore} then ${valueAfter}`
      );
    } else if (onDefaults === null || Math.abs(onDefaults - valueBefore) > 0.02) {
      fail(
        'what the card says the value was before the edit',
        `${valueBefore}, the figure it showed on the defaults`,
        String(onDefaults)
      );
    } else {
      ok(
        `two points on the risk-free rate takes the cost of equity from ${ke}% to ${keAfter}% and the value ` +
          `per share from ${valueBefore} to ${valueAfter}, with the default kept beside it`
      );
    }
  }

  await readContrast(page, 'the risk and cost-of-capital card');

  // ---- 6. A PRICE QUOTED IN PENCE IS BROUGHT TO POUNDS FIRST ----------
  await page.goto(`${BASE}/company/${CONVERTED_TICKER}/overview`, { waitUntil: 'domcontentloaded' });
  const converted = page.locator('section[aria-label="Risk and cost of capital"]').first();
  try {
    await converted.waitFor({ timeout: 60_000 });
  } catch {
    fail('the card on a company quoted in pence', 'the card', 'it never rendered');
    return;
  }
  const priceRow = ((await converted.locator('[data-coc-row="price"]').first().textContent()) || '').replace(/\s+/g, ' ');
  const weightsRow = ((await converted.locator('[data-coc-row="weights"]').first().textContent()) || '').replace(/\s+/g, ' ');
  const shownPrice = num(priceRow.replace(/^Share price/, ''));
  const capital = /capitalisation ([\d,]+)/.exec(weightsRow);
  if (!/GBp/.test(priceRow)) {
    fail('the price row on a company quoted in pence', 'that it was quoted in GBp', `"${priceRow.slice(0, 110)}"`);
  } else if (shownPrice === null || !capital) {
    fail('the price and the weights', 'a price and a market capitalisation on the card', `"${priceRow.slice(0, 80)}" / "${weightsRow.slice(0, 80)}"`);
  } else {
    // 100 million shares in the fixture, in millions, so the capitalisation is
    // the price times a hundred — and a hundred times that if the pence figure
    // had been used.
    const expected = shownPrice * 100;
    const shown = Number(capital[1].replace(/,/g, ''));
    if (Math.abs(expected - shown) > Math.max(1, shown * 0.001)) {
      fail(
        'the market capitalisation the weights were struck on',
        `${expected.toFixed(0)} — the price on the card times its own share count`,
        `${shown} (a factor of ${(shown / expected).toFixed(2)})`
      );
    } else {
      ok(
        `a share quoted in pence is brought to pounds before it is multiplied: the card shows ${shownPrice} ` +
          `and a capitalisation of ${shown}, and says where the pence went`
      );
    }
  }
  await readContrast(page, 'the cost-of-capital card, quoted in pence');
}

async function checkCompanyTabsOnScreen(page: Page) {
  console.log('\n=== the company page: every tab has an address, and it loads ===');
  const { COMPANY_TABS } = await import(`file:///${REPO}/src/data/companyRoute.ts`);

  for (const tab of COMPANY_TABS as any[]) {
    const url = `${BASE}/company/${PAPER_TICKER}/${tab.slug}`;
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    const heading = page.getByRole('heading', { name: PAPER_NAME, level: 1 }).first();
    try {
      await heading.waitFor({ timeout: 60_000 });
    } catch {
      fail(`the address /company/${PAPER_TICKER}/${tab.slug}`, `the company page for ${PAPER_NAME}`, 'it never rendered');
      continue;
    }

    // THE ADDRESS IS STILL THE ADDRESS. A router that quietly rewrote the path
    // would break every link somebody had already sent.
    const landed = new URL(page.url()).pathname;
    if (landed !== `/company/${PAPER_TICKER}/${tab.slug}`) {
      fail(`the address for ${tab.label}`, `/company/${PAPER_TICKER}/${tab.slug}`, landed);
    }

    const current = page.locator('nav[aria-label="Company sections"] [aria-current="page"]');
    const currentLabel = ((await current.first().textContent().catch(() => '')) || '').trim();
    if (currentLabel !== tab.label) {
      fail(`the tab marked current at ${tab.slug}`, tab.label, currentLabel || '(none)');
    }

    if (!tab.built) {
      // The sentence from the plan, and the badge that says it is not built.
      const body = ((await page.textContent('main')) || '').replace(/\s+/g, ' ');
      const promised = String(tab.coming || '').slice(0, 45).replace(/\s+/g, ' ');
      if (!body.includes(promised)) {
        fail(`what the ${tab.label} tab says`, `"${promised}…"`, `"${body.slice(0, 90)}…"`);
      } else if (!/being built/i.test(body)) {
        fail(`the ${tab.label} tab`, 'a "being built" badge beside the heading', 'no such badge');
      } else {
        ok(`${tab.label} loads at its own address and says only what it will carry`);
      }
      continue;
    }

    if (tab.slug === 'model') {
      const open = page.getByRole('button', { name: new RegExp(`open the figures for ${PAPER_TICKER}`, 'i') });
      if (await open.count()) ok('Model loads at its own address and opens the figures flow that already exists');
      else fail('the Model tab', `a control reading "Open the figures for ${PAPER_TICKER}"`, 'no such control');
      continue;
    }

    if (tab.slug === 'financials') {
      // ---- THE STATEMENTS, AND THE EVIDENCE UNDER EVERY NUMBER ----
      //
      // The spec this tab was built from says its differentiator in one line:
      // of the five sites studied, none links a number to the filing behind
      // it. So the thing asserted here is not that a table rendered — it is
      // that EVERY NUMBER OPENS THE EVIDENCE, by tap and by keyboard, and that
      // the evidence says what period, what unit, what state and what source.
      const table = page.locator('[data-financials]').first();
      if (!(await table.count())) {
        fail('the Financials tab', 'the statement table', 'no table on the page');
        continue;
      }

      // The three statements, and the TTM column pinned beside the latest year.
      const header = ((await table.locator('thead').textContent()) || '').replace(/\s+/g, ' ');
      if (!/TTM/.test(header)) {
        fail('the TTM column', 'a TTM column beside the latest year', `"${header.slice(0, 70)}"`);
      } else if (!/TTM \((FY basis|4 quarters|H1 basis)\)/.test(header)) {
        fail(
          'the TTM column saying which basis it is on',
          'the basis in the header, as rule 5 requires',
          `"${header.slice(0, 90)}"`
        );
      } else {
        const basis = /TTM \(([^)]+)\)/.exec(header)?.[1];
        // AND IT IS THE RIGHT BASIS FOR WHAT THIS COMPANY FILED. The fixture
        // carries four quarters running past its year end, so a TTM still on
        // the financial year would be a stale figure wearing a fresh label.
        if (basis !== '4 quarters') {
          fail(
            'the TTM basis for a company with four quarters past its year end',
            'TTM (4 quarters)',
            `TTM (${basis})`
          );
        } else {
          ok(`Financials loads at its own address, and its TTM says it is the ${basis}`);
        }
      }

      // ---- EVERY NUMBER OPENS AN EVIDENCE SHEET ----
      const cells = table.locator('[data-cell]');
      const total = await cells.count();
      let opened = 0;
      let shortOfEvidence = 0;
      const wanted = ['Line', 'Period', 'Duration', 'Basis', 'Unit', 'State'];
      // Sampled across the grid rather than all of it: the first, the last, a
      // TTM cell and a derived one, which are the four shapes a cell comes in.
      const sample = [0, 1, Math.floor(total / 2), total - 2, total - 1].filter(
        (i, n, a) => i >= 0 && i < total && a.indexOf(i) === n
      );
      for (const i of sample) {
        const cell = cells.nth(i);
        const name = (await cell.getAttribute('data-cell')) || `cell ${i}`;
        await cell.evaluate((el: any) => el.click());
        const sheet = page.locator('[data-evidence-sheet]');
        if (!(await sheet.isVisible().catch(() => false))) {
          fail('the evidence behind a number', `a sheet for ${name}`, 'nothing opened');
          continue;
        }
        const said = ((await sheet.textContent()) || '').replace(/\s+/g, ' ');
        const missing = wanted.filter((w) => !said.includes(w));
        if (missing.length) {
          shortOfEvidence++;
          fail(
            `the evidence for ${name}`,
            `every field the spec asks for (${wanted.join(', ')})`,
            `no ${missing.join(', ')}`
          );
        } else {
          opened++;
        }
        await page.keyboard.press('Escape');
        await page.waitForTimeout(150);
      }
      if (opened === sample.length) {
        ok(`${opened} numbers sampled across ${total} in the table, and every one opened its evidence`);
      }

      // AND THE EVIDENCE IS HONEST ABOUT A VENDOR FEED. The paper company is
      // an SEC filer in the fixture, so the sentence asserted is that one; the
      // vendor sentence is checked in `npm run verify`, over the 92 payloads
      // that actually have it.
      await cells.first().evaluate((el: any) => el.click());
      const evidence = ((await page.locator('[data-evidence-sheet]').textContent()) || '').replace(/\s+/g, ' ');
      if (/SEC EDGAR/.test(evidence) && /XBRL/.test(evidence)) {
        ok('the evidence names the source and the concept it was read from');
      } else {
        fail('the evidence sheet', 'the source named', `"${evidence.slice(0, 80)}"`);
      }
      await page.keyboard.press('Escape');

      // ---- A GAP IS AN EM DASH ON THE SCREEN TOO ----
      //
      // On the BALANCE SHEET with its detail rows open, because that is where
      // this fixture actually has absences — goodwill, intangibles and minority
      // interest, none of which the paper company reports. Asserting it on a
      // statement with no gaps in it would pass for ever while proving nothing,
      // which this suite has been caught by before.
      await page
        .getByRole('button', { name: 'Balance sheet', exact: true })
        .evaluate((el: any) => el.click());
      await page.waitForTimeout(250);
      await page
        .getByRole('button', { name: /more lines/i })
        .evaluate((el: any) => el.click());
      await page.waitForTimeout(250);
      const dashes = await table.locator('[data-state="notReported"]').count();
      if (!dashes) {
        fail(
          'the check that a gap is an em dash',
          'at least one line this company does not report, to assert it on',
          'every cell on the balance sheet has a figure, so nothing was tested'
        );
      }
      let zeroed = 0;
      for (const text of await table.locator('[data-state="notReported"]').allTextContents()) {
        if (text.trim() !== '\u2014') zeroed++;
      }
      if (zeroed) {
        fail('a line the filing does not report', 'an em dash', `${zeroed} of them show something else`);
      } else {
        ok(`${dashes} cells with nothing behind them, every one an em dash on the screen`);
      }

      // ---- THE QUARTERS, AND THE TWO FILINGS BEHIND A DERIVED ONE ---------
      //
      // A quarter the company never filed on its own is the difference between
      // two documents. The screen has to say so and open both, because a
      // reader who wants to check the subtraction cannot do it with one.
      // Back to the income statement first: the block above left the balance
      // sheet showing, and a balance is never derived, so looking for a derived
      // cell there would be looking in the one place it cannot be.
      await page
        .getByRole('button', { name: 'Income statement', exact: true })
        .evaluate((el: any) => el.click());
      await page.waitForTimeout(200);
      await page
        .getByRole('button', { name: 'Quarterly', exact: true })
        .evaluate((el: any) => el.click());
      await page.waitForTimeout(300);
      const quarterCells = page.locator('[data-financials] [data-state="derived"]');
      const derivedCount = await quarterCells.count();
      if (!derivedCount) {
        fail(
          'the quarterly view',
          'at least one quarter worked out from two filings, which the fixture has',
          'no derived cell on the screen'
        );
      } else {
        await quarterCells.first().evaluate((el: any) => el.click());
        await page.waitForTimeout(250);
        const sheet = page.locator('[data-evidence-sheet]');
        const links = sheet.locator('[data-filing]');
        const n = await links.count();
        const said = ((await sheet.textContent()) || '').replace(/\s+/g, ' ');
        if (n < 2) {
          fail(
            'the evidence for a derived quarter',
            'both of the filings it is the difference of',
            `${n} filing link${n === 1 ? '' : 's'}`
          );
        } else if (!/difference of/i.test(said)) {
          fail(
            'the evidence for a derived quarter',
            'a heading saying the two filings are what it is the difference of',
            `"${said.slice(0, 80)}"`
          );
        } else {
          const accns = await links.evaluateAll((els: any[]) =>
            els.map((e) => e.getAttribute('data-filing'))
          );
          if (new Set(accns).size < 2) {
            fail(
              'the two filings behind a derived quarter',
              'two different documents',
              `both links point at ${accns[0]}`
            );
          } else {
            ok(
              `a derived quarter opens both the filings it is the difference of ` +
              `(${accns.join(' and ')})`
            );
          }
        }
        await page.keyboard.press('Escape');
        await page.waitForTimeout(150);
      }

      // ---- A FREQUENCY WITH NO PERIODS SAYS SO, rather than drawing a grid --
      await page
        .getByRole('button', { name: 'Half-year', exact: true })
        .evaluate((el: any) => el.click());
      await page.waitForTimeout(300);
      const halves = ((await page.textContent('main')) || '').replace(/\s+/g, ' ');
      if (/No half-year periods are held/i.test(halves) && !(await page.locator('[data-financials]').count())) {
        ok('a frequency with no periods behind it says so, and draws no empty table');
      } else {
        fail(
          'the Half-year view with no half-year periods held',
          'a sentence saying so and no table',
          `"${halves.slice(0, 90)}"`
        );
      }
      await page
        .getByRole('button', { name: 'Annual', exact: true })
        .evaluate((el: any) => el.click());
      await page.waitForTimeout(250);

      // ---- AND IT HOLDS AT 390px, where the table is the hard case --------
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(400);
      const phone: any = await page.evaluate(`(() => {
        const sc = document.scrollingElement;
        const table = document.querySelector('[data-financials]');
        const wrap = table && table.parentElement;
        const label = document.querySelector('[data-financials] tbody th');
        return {
          pageSideways: sc.scrollWidth > sc.clientWidth + 1,
          tableScrolls: wrap ? wrap.scrollWidth > wrap.clientWidth + 1 : false,
          labelPct: label ? (label.getBoundingClientRect().width / innerWidth) * 100 : null,
        };
      })()`);
      if (phone.pageSideways) {
        fail('the statements on a phone', 'the page never scrolling sideways', 'the whole page scrolls');
      } else if (!phone.tableScrolls) {
        fail(
          'the statements on a phone',
          'the table scrolling sideways inside itself',
          'it does not scroll at all, so the later periods are unreachable'
        );
      } else if (!(phone.labelPct <= 30.5)) {
        fail(
          'the label column on a phone',
          'no more than 30% of the width',
          `${phone.labelPct.toFixed(1)}%`
        );
      } else {
        ok(
          `at 390px the label column is ${phone.labelPct.toFixed(0)}% of the width, the table scrolls ` +
            'sideways inside itself, and the page does not'
        );
      }
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.waitForTimeout(300);
      continue;
    }

    // ---- the overview --------------------------------------------------
    const tiles = page.locator('section[aria-label="Summary figures"] >> div.border');
    const figures = ((await page.locator('section[aria-label="Summary figures"]').textContent()) || '').replace(/\s+/g, ' ');
    for (const wanted of ['Price', 'Market capitalisation', '52-week high', 'Price / earnings', 'Book value per share', 'ROCE', 'ROE', 'Face value']) {
      if (!figures.includes(wanted)) fail('the summary figures', `a tile for ${wanted}`, 'it is not on the page');
    }
    ok(`Overview loads at its own address, with ${await tiles.count()} summary figures`);

    // A MISSING FIGURE IS A DASH ON THE SCREEN, not a zero. Face value is the
    // one every company is missing — neither source publishes it — so it is
    // the one tile whose rendering can be asserted for certain.
    const faceTile = page.locator('section[aria-label="Summary figures"] div', { hasText: /^Face value/ }).first();
    const faceText = ((await faceTile.textContent().catch(() => '')) || '').replace(/\s+/g, ' ');
    if (/—/.test(faceText) && !/\b0(\.0+)?\b/.test(faceText.replace('52-week', ''))) {
      ok('a figure neither source publishes reads as an em dash, not as zero');
    } else {
      fail('a figure neither source publishes', 'an em dash', `"${faceText.slice(0, 60)}"`);
    }

    // And the reason for it is within reach of the dash, on a keyboard.
    const hint = faceTile.locator('button[data-hint]').first();
    if (await hint.count()) {
      await hint.focus();
      await page.waitForTimeout(250);
      const explained = ((await page.textContent('body')) || '').replace(/\s+/g, ' ');
      if (/does not publish|publishes a face value|par value/i.test(explained)) {
        ok('and its ⓘ says why, on keyboard focus');
      } else {
        fail('the reason beside a missing figure', 'an explanation on focus', 'nothing opened');
      }
      await page.keyboard.press('Escape').catch(() => {});
    } else {
      fail('the reason beside a missing figure', 'a ⓘ button beside the label', 'no such control');
    }

    // ---- the chart -------------------------------------------------------
    const chart = page.locator('section[aria-label="Price history"] svg[role="img"]').first();
    if (!(await chart.count())) {
      fail('the price chart', 'an svg on the Overview tab', 'no chart drew');
      continue;
    }
    const geometry = `(() => {
      const svg = document.querySelector('section[aria-label="Price history"] svg[role="img"]');
      if (!svg) return null;
      const paths = [...svg.querySelectorAll('path')].map((p) => (p.getAttribute('d') || '').length);
      return { paths: paths.length, longest: Math.max(0, ...paths) };
    })()`;
    let drawn: any = null;
    for (let tries = 0; tries < 20; tries++) {
      drawn = await page.evaluate(geometry);
      if (drawn && drawn.longest >= 200) break;
      await page.waitForTimeout(250);
    }
    if (!drawn || drawn.longest < 200) {
      fail('the price line', 'a path with real geometry in it', JSON.stringify(drawn));
    } else {
      ok(`the price line is drawn (${drawn.paths} paths, the longest ${drawn.longest} characters of geometry)`);
    }

    // AN OVERLAY IS A SECOND LINE, and choosing one must change the drawing.
    const before = await page.evaluate(`document.querySelectorAll('section[aria-label="Price history"] svg[role="img"] path').length`);
    const overlayButton = page.getByRole('button', { name: 'P / E', exact: true }).first();
    if (await overlayButton.count()) {
      await overlayButton.click();
      await page.waitForTimeout(400);
      const after = await page.evaluate(`document.querySelectorAll('section[aria-label="Price history"] svg[role="img"] path').length`);
      const says = ((await page.locator('section[aria-label="Price history"]').textContent()) || '').replace(/\s+/g, ' ');
      if (after > before && /P \/ E = price/.test(says)) {
        ok(`choosing an overlay draws another line (${before} paths to ${after}) and states its formula`);
      } else {
        fail('choosing the P / E overlay', 'another line, and the formula under the chart', `${before} to ${after} paths`);
      }
    } else {
      fail('the overlay controls', 'a "P / E" button', 'no such control');
    }

    // A RANGE IS A DIFFERENT NUMBER OF CLOSES, so switching must change it.
    const readout = () => page.locator('[data-chart-readout]').first().textContent();
    const month = page.getByRole('button', { name: '1M', exact: true }).first();
    if (await month.count()) {
      const wide = ((await readout()) || '').match(/([\d,]+) daily closes/)?.[1];
      await month.click();
      await page.waitForTimeout(400);
      const narrow = ((await readout()) || '').match(/([\d,]+) daily closes/)?.[1];
      if (wide && narrow && Number(narrow.replace(/,/g, '')) < Number(wide.replace(/,/g, ''))) {
        ok(`switching to 1M narrows the window (${wide} closes to ${narrow})`);
      } else {
        fail('switching the range', 'fewer closes on 1M than on 1Y', `${wide} then ${narrow}`);
      }
    }
  }

  // AN ADDRESS NOBODY TYPED CORRECTLY STILL LANDS ON THE COMPANY. A tab that
  // was renamed, or a typo, must not produce a page with nothing on it.
  await page.goto(`${BASE}/company/${PAPER_TICKER}/nonsense`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: PAPER_NAME, level: 1 }).first().waitFor({ timeout: 60_000 });
  // A SHORT TIMEOUT AND A REPORT, not an exception: when the fallback is
  // broken there is no current tab at all, and a check that throws there takes
  // the whole run down instead of naming the one thing that is wrong.
  const fellBack = (
    (await page
      .locator('nav[aria-label="Company sections"] [aria-current="page"]')
      .first()
      .textContent({ timeout: 5_000 })
      .catch(() => '')) || ''
  ).trim();
  if (fellBack === 'Overview') ok('an address with a tab that does not exist lands on the Overview, not on a blank page');
  else fail('an unknown tab', 'the Overview', fellBack || '(nothing current)');
}

// ------------------------------------------------------------------------ run
let server: ChildProcess | null = null;
let browser: Browser | null = null;
try {
  console.log(`starting the site on ${BASE} …`);
  server = await startServer();
  try {
    browser = await chromium.launch({ headless: !HEADED });
  } catch (error: any) {
    // The browser binary is downloaded separately from the npm package, so a
    // clean checkout has the library and not the browser. Say which command
    // fixes it rather than printing a stack trace about a missing executable.
    throw new Error(
      'Chromium is not installed for Playwright. Run:  npx playwright install chromium  ' +
        `(${String(error?.message || error).split('\n')[0]})`
    );
  }
  const context = await browser.newContext({ viewport: { width: 1400, height: 1000 } });

  // NOTHING LEAVES THE MACHINE. Every call the site makes is answered here.
  await context.route('**/api/company*', async (route) => {
    const url = new URL(route.request().url());
    const ticker = (url.searchParams.get('ticker') || '').toUpperCase();
    // Only the paper company exists here. A curated company also asks for its
    // derived counterpart on load, and answering that with the paper company
    // would put one company's figures under another's name; the site is built
    // to leave the comparison unavailable when the fetch fails, so it fails.
    const payload = fixtureFor(ticker);
    if (!payload) {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: `No fixture for ${ticker}` }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payload),
    });
  });
  await context.route('**/api/news*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"items":[]}' })
  );
  await context.route('**/api/search*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"results":[]}' })
  );
  await context.route('**/api/comps*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"comparables":[]}' })
  );
  // The index a beta is measured against, answered from the fixture: a series
  // built so the regression's answer is known before it runs.
  await context.route('**/api/marketIndex*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(paperIndexSeries()),
    })
  );
  const page = await context.newPage();
  page.on('pageerror', (error) => {
    problems++;
    console.log(`  PROBLEM: the page threw — ${String(error).slice(0, 160)}`);
  });

  // EVERY REQUEST THE PAGE MAKES, recorded from the first navigation, so the
  // font check below reads what the browser actually asked for rather than what
  // index.html appears to say.
  const requests: string[] = [];
  page.on('request', (r: any) => requests.push(r.url()));

  // 1. The curated model, which the site renders without fetching anything.
  const apple: any = (COMPANIES_DATA as any).AAPL;
  await readContrast(page, 'the landing page');
  await openCurated(page, 'AAPL');
  // AFTER THE FIRST REAL NAVIGATION, not before it. `readContrast` evaluates on
  // whatever is loaded and never navigates, so a font check placed above it
  // measured an about:blank page and reported no stylesheet at all — which is
  // a check that fails for the wrong reason, and would have gone on failing
  // after the fix.
  await checkFontRequests(page, requests);
  await readContrast(page, 'the questions screen');
  await checkValued(page, 'Apple, the curated model', AAPL_SOURCE, apple.currencySymbol || '$');
  await readContrast(page, 'the analysis screen, curated');

  // 2. A derived model, built through the fetch, the figures and the
  //    questions, the way a reader reaches one.
  const paper: any = buildCompanyFrom(paperPayload('valued'));
  await openFetched(page, PAPER_TICKER);
  await checkValued(page, `${PAPER_NAME}, derived`, paper.modelData, paper.currencySymbol || '$');
  await readContrast(page, 'the analysis screen, derived');
  // Saving and reopening, on the derived company: it came through the figures
  // screen with a line moved to another head, so there is a judgement to carry.
  await checkSavedModelsOnScreen(page, PAPER_NAME, PAPER_TICKER);
  await checkTickerOnScreen(page, PAPER_TICKER);

  // 3. The same company, refused.
  const refusedPayload = { ...paperPayload('refused'), ticker: REFUSED_TICKER };
  const refused: any = buildCompanyFrom(refusedPayload);
  await openFetched(page, REFUSED_TICKER);
  await checkRefused(page, refused.modelData, refused, refused.currencySymbol || '$');
  await readContrast(page, 'a refused company');

  // 4. The company page: the hub, and every tab at its own address.
  await checkCompanyTabsOnScreen(page);
  await readContrast(page, 'the company page, overview');

  // AND THE CARD ON IT, which is a screen of its own: nine inputs, each with a
  // source and a date, and an edit that has to reach the valuation.
  await checkCostOfCapitalOnScreen(page);

  // AND THE STATEMENTS, which is a screen of its own: a table of its own with
  // its own chips, states and evidence sheet, none of which the overview has.
  // Sweeping only the overview would leave the densest screen on the site
  // unmeasured.
  await page.goto(`${BASE}/company/${PAPER_TICKER}/financials`, { waitUntil: `domcontentloaded` });
  await page.locator(`[data-financials]`).first().waitFor({ timeout: 30_000 });
  // Waited for rather than clicked at: the table renders a frame before its
  // footer does, and one run of this check timed out on the race.
  const more = page.getByRole(`button`, { name: /more lines/i });
  await more.waitFor({ state: `visible`, timeout: 30_000 });
  await more.evaluate((el: any) => el.click());
  await page.waitForTimeout(300);
  await readContrast(page, 'the company page, the statements');
  await page.locator(`[data-cell]`).first().evaluate((el: any) => el.click());
  await page.waitForTimeout(300);
  await readContrast(page, 'the evidence behind a figure');
  await page.keyboard.press(`Escape`);

  // 5. The same company again, quoted in a currency its statements are not
  //    in: the one case where a value per share is shown twice.
  await checkTradingCurrencyOnScreen(page, CONVERTED_TICKER);
  await readContrast(page, 'a company quoted in another currency');

  // 6. The loading screen: the card this company’s own figures earn, then a
  //    build slow enough to read it in two beats.
  await checkCardFromFigures(page);

  //    must not hold the same one for the whole wait.
  await checkSlowBuild(context, page);

  // 7. Nothing anywhere on any of those screens is below WCAG AA.
  reportContrast();
} catch (error: any) {
  problems++;
  console.log(`\n  PROBLEM: the check could not finish — ${error?.message || error}`);
  // WHICH SCREEN IT WAS ON. A timeout on a button says nothing about where the
  // browser had got to, so the screen is written out to be looked at.
  try {
    const open = browser?.contexts()[0]?.pages()[0];
    if (open) {
      await open.screenshot({ path: path.join(OUT, 'dashboard-failure.png') });
      fs.writeFileSync(
        path.join(OUT, 'dashboard-failure.txt'),
        ((await open.textContent('body')) || '').replace(/\n{2,}/g, '\n')
      );
      console.log('           the screen it stopped on: verify/out/dashboard-failure.png and .txt');
    }
  } catch {
    /* the browser may already be gone */
  }
} finally {
  await browser?.close().catch(() => {});
  stopServer(server);
}

/** Vite is started through a shell, so killing the child leaves the server. */
function stopServer(child: ChildProcess | null) {
  if (!child?.pid) return;
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    child.kill();
  }
}

console.log(`\nTOTAL PROBLEMS ON THE DASHBOARD: ${problems}`);
process.exit(problems ? 1 : 0);
