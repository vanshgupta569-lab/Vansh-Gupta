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
// The type steps, read from the tokens so the size check moves with them.
const SIZE_TOKENS: any = await import(`file:///${REPO}/src/design/tokens.ts`);

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

// A COMPANY WHOSE STATEMENTS STOP TWELVE YEARS BACK (`KI-32`).
//
// Constructed, and it has to be: the whole point of the fix is that no
// company in the set is stale any more, so there is nothing on disk left to
// show the warning with. Built by shifting the valued fixture’s years rather
// than by writing a second fixture, so the two cannot drift apart — what is
// under test is the age of the figures and nothing else about them. The
// quarters go, because a quarter newer than every year is a different
// question from a year that is missing.
const STALE_TICKER = 'PAPEROLD';
const STALE_YEARS_BACK = 12;
const staleFixture = () => {
  const p = JSON.parse(JSON.stringify(paperPayload('valued')));
  for (const row of p.statements ?? []) {
    if (Number.isFinite(Number(row.fiscalYear))) row.fiscalYear = Number(row.fiscalYear) - STALE_YEARS_BACK;
    if (typeof row.periodEnd === 'string' && /^\d{4}-/.test(row.periodEnd)) {
      row.periodEnd = `${Number(row.periodEnd.slice(0, 4)) - STALE_YEARS_BACK}${row.periodEnd.slice(4)}`;
    }
  }
  p.quarters = [];
  p.ticker = STALE_TICKER;
  return p;
};

/** The payload for a ticker this check knows, or null for one it does not. */
const fixtureFor = (ticker: string) =>
  ticker === STALE_TICKER
    ? staleFixture()
    : FIXTURES[ticker]
      ? { ...paperPayload(FIXTURES[ticker]), ticker }
      : null;

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
  await page.getByRole('tab', { name: /^model$/i }).first().click({ timeout: 30_000 });
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
/**
 * ONE RIGHT EDGE, SHARED WITH THE COLUMN HEADER (`docs/VISUAL_SYSTEM.md`
 * finding 1, severity H). The finding measured the figures screen off a
 * screenshot: the rows printing a trailing ".0" ended about 6px from the
 * others and from the column head. Only a browser can settle it, because it
 * is a question about rendered glyphs and not about a format string — the
 * decimals were the cause, and right alignment plus tabular figures is what
 * makes the effect visible at all.
 *
 * Measured with a Range over each cell’s own text rather than the cell box,
 * so what is compared is where the digits actually stop, which is what a
 * reader sees. Every figure in a column, and that column’s header, must share
 * one right edge to within a pixel.
 */
async function checkSharedRightEdge(page: Page, label: string, table: string, headCell: string, figure: string) {
  const measured: any = await page.evaluate(`(() => {
    const t = document.querySelector(${JSON.stringify(table)});
    if (!t) return { error: 'no table' };
    const edge = (el) => {
      const r = document.createRange();
      r.selectNodeContents(el);
      const b = r.getBoundingClientRect();
      return b.width === 0 && b.height === 0 ? null : b.right;
    };
    // WHERE THE DIGITS STOP, which is not where the text stops. Right
    // alignment puts every LAST GLYPH on one edge whatever it is, so
    // a trailing ".0" still lines up — and pushes the units digit left by its
    // own width. The units digit is what a reader compares down a column, and
    // it is the 6px the finding measured. Taken by ending the range before
    // the decimal point rather than at the end of the text.
    const digitsEdge = (el) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let node = null;
      while (walker.nextNode()) node = walker.currentNode;
      if (!node) return null;
      const t = node.textContent || "";
      const dot = t.indexOf(".");
      const r = document.createRange();
      r.setStart(node, 0);
      r.setEnd(node, dot >= 0 ? dot : t.length);
      const b = r.getBoundingClientRect();
      return b.width === 0 && b.height === 0 ? null : b.right;
    };
    const heads = Array.from(t.querySelectorAll(${JSON.stringify(headCell)}));
    if (!heads.length) return { error: 'no column headers' };
    // ONE DECIMAL RULE PER ROW, measured as one digits edge per row: every
    // figure in a row must stop its digits the same distance from its own
    // right edge, which it does only if every cell in the row carries the
    // same number of decimal places.
    const rows = [];
    for (const row of Array.from(t.querySelectorAll("tbody tr"))) {
      const figs = Array.from(row.querySelectorAll(${JSON.stringify(figure)}));
      const offs = [];
      for (const fig of figs) {
        const text = (fig.textContent || "").trim();
        if (!/\\d/.test(text)) continue;
        const a = edge(fig);
        const b = digitsEdge(fig);
        if (a === null || b === null) continue;
        offs.push({ off: a - b, text });
      }
      if (offs.length < 2) continue;
      const lo = Math.min(...offs.map((o) => o.off));
      const hi = Math.max(...offs.map((o) => o.off));
      if (hi - lo > 1) {
        const label = (row.querySelector("th") || {}).textContent || "";
        rows.push({
          label: label.replace(/\\s+/g, " ").trim().slice(0, 40),
          spread: hi - lo,
          printed: offs.map((o) => o.text).slice(0, 6),
        });
      }
    }
    const cols = [];
    for (let c = 0; c < heads.length; c++) {
      const head = edge(heads[c]);
      const cells = [];
      for (const row of Array.from(t.querySelectorAll("tbody tr"))) {
        const figs = Array.from(row.querySelectorAll(${JSON.stringify(figure)}));
        if (!figs[c]) continue;
        const e = edge(figs[c]);
        if (e !== null) cells.push({ e, text: (figs[c].textContent || '').trim() });
      }
      if (head === null || !cells.length) continue;
      const all = [head, ...cells.map((x) => x.e)];
      const lo = Math.min(...all);
      const hi = Math.max(...all);
      const worst = cells.reduce((a, b) => (Math.abs(b.e - head) > Math.abs(a.e - head) ? b : a), cells[0]);
      cols.push({ c, spread: hi - lo, cells: cells.length, worstText: worst.text, worstBy: worst.e - head });
    }
    return { cols, rows };
  })()`);
  if (!measured || measured.error) {
    fail(`${label}: one right edge`, 'a table with headers and figures', String(measured?.error || 'nothing measured'));
    return;
  }
  const mixed = (measured.rows ?? []) as any[];
  if (mixed.length) {
    fail(
      `${label}: one decimal rule per row`,
      'every figure in a row stopping its digits on one edge',
      mixed
        .slice(0, 3)
        .map((r: any) => `“${r.label}” spreads ${r.spread.toFixed(1)}px across ${r.printed.join(", ")}`)
        .join('; ')
    );
  }
  const adrift = measured.cols.filter((c: any) => c.spread > 1);
  if (adrift.length) {
    fail(
      `${label}: every figure shares its column header’s right edge`,
      'a spread of at most 1px',
      adrift
        .slice(0, 3)
        .map((c: any) => `column ${c.c} spreads ${c.spread.toFixed(1)}px (“${c.worstText}” is ${c.worstBy.toFixed(1)}px off the head)`)
        .join('; ')
    );
  } else {
    const cells = measured.cols.reduce((n: number, c: any) => n + c.cells, 0);
    const worst = Math.max(0, ...measured.cols.map((c: any) => c.spread));
    ok(
      `${label}: ${cells} figures over ${measured.cols.length} columns each end on their column header’s ` +
        `right edge, worst spread ${worst.toFixed(2)}px, and every row stops its digits on one edge`
    );
  }
}
/**
 * HOW OLD THE FIGURES ARE, SAID ON THE SCREEN (`KI-32`).
 *
 * Every figure on this site is labelled with the year it belongs to, which is
 * honest about each figure and silent about the set: a reader looking at a
 * correctly labelled FY2014 column cannot tell whether 2014 is the latest year
 * that exists or the latest this site managed to read. Morgan Stanley was
 * presented for months as a company half its size with figures eleven years
 * out of date, and nothing on the screen said so.
 *
 * Driven on a constructed company, because the fix means no payload on disk is
 * stale any more. Both screens that present these statements are checked, and
 * so is the company that is NOT stale — a warning that is always on screen is
 * not a warning.
 */
/**
 * THE SCREENER, ON THE SCREEN (`docs/SCREENER_SPEC.md`, build step 4).
 *
 * `verify/scenarios.mts` holds the screener’s rules against all 178 companies
 * without a browser. This checks the one thing only a browser can: that the
 * number on the screen is the number the data layer produced, and that the
 * things the spec says must be ON the screen are on it.
 *
 * The table is intercepted rather than fetched. `/api/screener` reads a file
 * built from the payload set, and a check that depended on that file existing
 * would pass or fail on whether somebody had run a script.
 */
async function checkScreenerOnScreen(page: Page, context: BrowserContext) {
  console.log('\n=== the screener: the count, the headers and what was set aside ===');
  const S: any = await import(`file:///${REPO}/src/data/screener.ts`);

  // A TABLE WRITTEN HERE, so what the screen shows can be predicted exactly.
  // Four companies: two ordinary, one bank, and one with a hole in it.
  const cell = (value: number | null, state = 'value', reason: string | null = null) => ({
    value,
    state,
    reason,
    period: state === 'value' ? 'FY2025' : null,
    asOf: '2025-12-31',
  });
  const row = (over: any) => ({
    ticker: 'X',
    name: 'X',
    exchange: 'Testing Exchange',
    country: 'Narnia',
    currency: 'USD',
    currencySymbol: '$',
    dataSource: 'SEC EDGAR',
    financial: false,
    priceCurrency: 'USD',
    homeListing: true,
    listingNote: null,
    cells: Object.fromEntries(S.SCREENER_METRICS.map((m: any) => [m.key, cell(10)])),
    ...over,
  });
  const table = {
    built: '2026-11-02T00:00:00.000Z',
    rows: [
      row({ ticker: 'HIGH', name: 'Highmargin Mills', cells: { ...row({}).cells, roe: cell(30), operatingMargin: cell(40) } }),
      row({ ticker: 'LOW', name: 'Lowmargin Mills', cells: { ...row({}).cells, roe: cell(3), operatingMargin: cell(2) } }),
      row({
        ticker: 'BANKY',
        name: 'Banky Bank',
        financial: true,
        cells: {
          ...row({}).cells,
          evToEbitda: cell(null, 'nm', 'EV / EBITDA is not meaningful for a bank or insurer'),
          operatingMargin: cell(null, 'nm', 'Operating margin is not meaningful for a bank or insurer'),
          debtToEquity: cell(null, 'nm', 'Debt / equity is not meaningful for a bank or insurer'),
          currentRatio: cell(null, 'nm', 'Current ratio is not meaningful for a bank or insurer'),
        },
      }),
      row({
        ticker: 'HOLEY',
        name: 'Holey Holdings',
        cells: {
          ...row({}).cells,
          roe: cell(null, 'unavailable', 'No year reports both a profit and shareholders\u2019 equity'),
        },
      }),
    ],
  };

  await context.unroute('**/api/screener*').catch(() => {});
  await context.route('**/api/screener*', async (route) => {
    try {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(table) });
    } catch {
      /* the check has moved on and something else answered */
    }
  });

  // ---- 1. THE COUNT IS THE ROWS -------------------------------------
  //
  // Rule 16. Driven through a filter rather than on an empty screen, because
  // a count that matched when nothing was filtered would prove nothing.
  await page.goto(`${BASE}/screener?f=roe:gt:5`, { waitUntil: `domcontentloaded` });
  const countLine = page.locator(`[data-screener-count]`).first();
  try {
    await countLine.waitFor({ state: `visible`, timeout: 30_000 });
  } catch {
    fail('the screener', 'a screen with a match count on it', 'nothing rendered at /screener');
    await context.unroute('**/api/screener*').catch(() => {});
    return;
  }
  const said = ((await countLine.textContent()) || '').replace(/\s+/g, ' ').trim();
  const claimed = Number((said.match(/(\d+)/) || [])[1]);
  const shown = await page.locator(`[data-screener-row]`).count();
  // And what the data layer says, from the same table.
  const expected = S.runScreen(table.rows, S.screenFromSearch('?f=roe:gt:5'));
  if (claimed !== shown) {
    fail('the screener’s match count', `${shown} rows on the screen`, `the screen says ${claimed}`);
  } else if (claimed !== expected.matched) {
    fail('the screener’s match count', `${expected.matched} from the data layer`, `the screen says ${claimed}`);
  } else {
    ok(`${claimed} companies match, ${shown} rows are on the screen, and the data layer agrees`);
  }
  if (!/compan(y|ies) match/.test(said) || !/sorted by/.test(said)) {
    fail('the result line', 'the words rule 16 asks for', `"${said.slice(0, 80)}"`);
  } else {
    ok(`the result line reads "${said.slice(0, 64)}…"`);
  }

  // ---- 2. A MISSING FIGURE IS NAMED, NOT DROPPED --------------------
  //
  // Rule 4. `HOLEY` has no return on equity, so a filter on it must set that
  // company aside AND say so where a reader will see it.
  const excluded = page.locator(`[data-screener-excluded]`).first();
  if (!(await excluded.count())) {
    fail(
      'a company set aside for a figure it has not got',
      'a sentence on the screen saying how many and why',
      'nothing said'
    );
  } else {
    const sentence = ((await excluded.textContent()) || '').replace(/\s+/g, ' ').trim();
    const holeyShown = await page.locator(`[data-screener-row="HOLEY"]`).count();
    if (holeyShown) {
      fail('a company with no figure for a filtered metric', 'set aside', 'listed as a match');
    } else if (!/^1 company excluded/.test(sentence)) {
      fail('the exclusion sentence', 'it opens with the number set aside', `"${sentence}"`);
    } else {
      ok(`the company with no return on equity is set aside and named: "${sentence}"`);
    }
  }

  // ---- 3. A BANK SHOWS n.m., AND SAYS WHY ---------------------------
  //
  // Rule 5, on the screen rather than in the data: the cell must read n.m.
  // and carry its reason, not be blank or be a number.
  await page.goto(`${BASE}/screener?columns=Valuation`, { waitUntil: `domcontentloaded` });
  await page.locator(`[data-screener-table]`).first().waitFor({ timeout: 30_000 });
  {
    const banky = page.locator(`[data-screener-cell="BANKY:evToEbitda"]`).first();
    if (!(await banky.count())) {
      fail('the bank’s EV / EBITDA cell', 'on the screen', 'not rendered');
    } else {
      const text = ((await banky.textContent()) || '').trim();
      const state = await banky.getAttribute('data-state');
      const reason = (await banky.getAttribute('title')) || '';
      if (text !== 'n.m.') {
        fail(`the bank’s EV / EBITDA cell`, 'it reads "n.m."', `it reads "${text}"`);
      } else if (state !== 'nm') {
        fail(`the bank’s EV / EBITDA cell`, 'it is marked as not meaningful', `it is marked "${state}"`);
      } else if (!/not meaningful/i.test(reason)) {
        fail(`the bank’s EV / EBITDA cell`, 'it says why', `"${reason.slice(0, 60)}"`);
      } else {
        ok('a bank’s EV / EBITDA reads n.m. on the screen and says why when asked');
      }
    }
    // AND AN ORDINARY COMPANY IN THE SAME COLUMN STILL SHOWS A FIGURE.
    const ordinary = page.locator(`[data-screener-cell="HIGH:evToEbitda"]`).first();
    const ordinaryState = await ordinary.getAttribute('data-state').catch(() => null);
    if (ordinaryState !== 'value') {
      fail(
        'an ordinary company’s EV / EBITDA',
        'a figure, so the n.m. rule has not reached past the banks',
        `marked "${ordinaryState}"`
      );
    } else {
      ok('a company outside the bank template still shows a figure in the same column');
    }
  }

  // ---- 4. EVERY COLUMN HEADER PUBLISHES ITS FORMULA AND SOURCE ------
  //
  // Rule 2. Behind the ⓘ the rest of this site uses, and reachable by
  // keyboard rather than hover alone.
  {
    const header = page.locator(`[data-screener-column="pe"]`).first();
    const hint = header.locator(`button[data-hint]`).first();
    if (!(await hint.count())) {
      fail('the Price / earnings column header', 'an ⓘ with its formula behind it', 'no such control');
    } else {
      await hint.focus();
      await page.waitForTimeout(250);
      const opened = ((await page.textContent('body')) || '').replace(/\s+/g, ' ');
      const metric = S.METRICS_BY_KEY.pe;
      const wantFormula = metric.formula.replace(/\s+/g, ' ');
      if (!opened.includes(wantFormula)) {
        fail('the column header’s ⓘ', `the formula "${wantFormula}"`, 'the formula is not on the screen');
      } else if (!opened.includes(metric.source)) {
        fail('the column header’s ⓘ', `the source "${metric.source}"`, 'the source is not on the screen');
      } else {
        ok(`the Price / earnings header publishes its formula and its source on keyboard focus`);
      }
      await page.keyboard.press('Escape').catch(() => {});
    }
    // AND THE PERIOD IS UNDER THE FIGURE, because companies do not share a
    // financial year (rule 3).
    const periods = await page.locator(`[data-screener-row] .font-figure + div`).count();
    if (!periods) {
      fail('the period each figure covers', 'under the figure in the table', 'nowhere on the screen');
    } else {
      ok(`${periods} figures carry the period they cover under them`);
    }
  }

  // ---- 5. THE SCREEN IS ITS OWN WEB ADDRESS (rule 22) ---------------
  {
    await page.goto(`${BASE}/screener`, { waitUntil: `domcontentloaded` });
    await page.locator(`[data-screener-table]`).first().waitFor({ timeout: 30_000 });
    await page.locator(`[data-screener-metric]`).first().selectOption(`roe`);
    await page.locator(`[data-screener-op]`).first().selectOption(`gt`);
    await page.locator(`[data-screener-value]`).first().fill(`20`);
    await page.locator(`[data-screener-add]`).first().click();
    await page.waitForTimeout(300);
    const url = new URL(page.url());
    if (!url.search.includes('roe')) {
      fail(
        'a filter added on the screen',
        'it is in the web address, so the link is the screen',
        `the address is "${url.pathname}${url.search}"`
      );
    } else {
      // AND THE ADDRESS ALONE REBUILDS IT. Loaded fresh, with no clicking.
      const rowsAfterClick = await page.locator(`[data-screener-row]`).count();
      await page.goto(`${BASE}/screener${url.search}`, { waitUntil: `domcontentloaded` });
      await page.locator(`[data-screener-table]`).first().waitFor({ timeout: 30_000 });
      const rowsFromLink = await page.locator(`[data-screener-row]`).count();
      const chips = await page.locator(`[data-screener-chip="roe"]`).count();
      if (rowsFromLink !== rowsAfterClick || !chips) {
        fail(
          'the screen rebuilt from its own address',
          `${rowsAfterClick} rows and the filter as a chip`,
          `${rowsFromLink} rows and ${chips} chips`
        );
      } else {
        ok(`a filter added by hand lands in the address, and the address alone rebuilds the screen`);
      }
    }
  }

  // ---- 6. NO BANNED WORD ANYWHERE IN THE SCREENER -------------------
  //
  // Rule 12, read off the RENDERED page rather than the source: a word can
  // reach a reader through a label, a preset, a placeholder or a sentence, and
  // the rendered text is where all four end up.
  //
  // SCOPED TO THE SCREENER'S OWN REGION, and the exclusion is a decision
  // rather than a convenience. Scanning the whole body reported `buy` and
  // `sell` three times, and it was right about the letters: the site's footer
  // carries the disclaimer that nothing here is a recommendation to buy or sell
  // a security. That is the opposite of the thing rule 12 forbids — the rule
  // bans telling a reader to buy, and the footer exists to say nobody is being
  // told to. A check that made the disclaimer a fault would have had the
  // disclaimer deleted, which is the worst outcome available.
  {
    for (const where of ['', '?columns=All', '?f=pe:lt:15&financials=only']) {
      await page.goto(`${BASE}/screener${where}`, { waitUntil: `domcontentloaded` });
      await page.locator(`[data-screener-table]`).first().waitFor({ timeout: 30_000 });
      await page.locator(`[data-screener-universe-toggle]`).first().click();
      await page.locator(`[data-screener-text-toggle]`).first().click();
      await page.waitForTimeout(200);
      const region = page.locator(`[data-screener]`).first();
      const text = ((await region.textContent()) || '').replace(/\s+/g, ' ');
      if (text.length < 400) {
        fail(`the screener at /screener${where}`, 'a screen with words on it to check', `${text.length} characters`);
        continue;
      }
      const found = S.bannedWordsIn(text);
      if (found.length) {
        fail(`the screener at /screener${where}`, 'none of the words rule 12 bans', `it uses ${found.join(', ')}`);
      } else {
        ok(`no banned word anywhere on the screener at /screener${where || ' (no filters)'}`);
      }
    }
  }

  await context.unroute('**/api/screener*').catch(() => {});
}

async function checkStaleFigures(page: Page) {
  console.log('\n=== how old the figures are, said on the screen ===');
  const { figuresAge, STALE_MONTHS } = await import(`file:///${REPO}/src/data/figuresAge.ts`);
  const fixture = staleFixture();
  const age: any = (figuresAge as any)(fixture);
  if (!age.stale) {
    fail(
      'the constructed stale company',
      `statements more than ${STALE_MONTHS} months old`,
      `${age.monthsBehind} months, so the case under test is not stale at all`
    );
    return;
  }

  // ---- 1. THE COMPANY PAGE, WHICH IS EVERY TAB ----------------------
  //
  // One band above the tab bar rather than one per tab: all nine tabs present
  // the same statements, so the age belongs to the company. Checked on two
  // tabs to show that it is the page and not the Overview.
  for (const tab of ['overview', 'financials']) {
    await page.goto(`${BASE}/company/${STALE_TICKER}/${tab}`, { waitUntil: `domcontentloaded` });
    const band = page.locator(`[data-stale-figures]`).first();
    try {
      await band.waitFor({ state: `visible`, timeout: 30_000 });
    } catch {
      fail(`the ${tab} tab of a company whose figures stop in FY${age.latestFiscalYear}`, 'a warning saying so', 'nothing on the screen');
      continue;
    }
    const said = ((await band.textContent()) || '').replace(/\s+/g, ' ').trim();
    const year = await band.getAttribute(`data-stale-figures`);
    if (year !== String(age.latestFiscalYear)) {
      fail(`the ${tab} tab’s warning`, `the year FY${age.latestFiscalYear}`, `FY${year}`);
    } else if (!said.includes(`Latest figures: FY${age.latestFiscalYear}`)) {
      fail(`the ${tab} tab’s warning`, `"Latest figures: FY${age.latestFiscalYear}"`, `"${said.slice(0, 90)}"`);
    } else {
      ok(`the ${tab} tab says "Latest figures: FY${age.latestFiscalYear}" — ${age.monthsBehind} months behind`);
    }
  }

  // ---- 2. AND THE FIGURES SCREEN, which is a screen of its own ------
  await search(page, STALE_TICKER);
  const onFigures = page.locator(`[data-stale-figures]`).first();
  try {
    await onFigures.waitFor({ state: `visible`, timeout: 30_000 });
    ok('the figures screen carries the same warning, from the same rule');
  } catch {
    fail('the figures screen', 'the same warning as the company page', 'nothing on the screen');
  }

  // ---- 3. AND A COMPANY THAT IS CURRENT CARRIES NO WARNING ----------
  //
  // The assertion that makes the other two worth having.
  await page.goto(`${BASE}/company/${PAPER_TICKER}/overview`, { waitUntil: `domcontentloaded` });
  await page.locator(`[data-coc-card]`).first().waitFor({ timeout: 30_000 }).catch(() => {});
  const current: any = (figuresAge as any)(fixtureFor(PAPER_TICKER));
  const strays = await page.locator(`[data-stale-figures]`).count();
  if (strays) {
    fail(
      'a company whose figures are current',
      'no warning about their age',
      `a warning, on figures ${current.monthsBehind} months old against a threshold of ${STALE_MONTHS}`
    );
  } else {
    ok(`a company ${current.monthsBehind} months behind carries no warning, so the band is a warning and not furniture`);
  }
}

/**
 * THE HEADER FITS ON ONE LINE, AT THE WIDTH IT IS TIGHTEST.
 *
 * One header now serves every screen (`DESIGN.md`, 2026-11-04): the wordmark,
 * four nav links, the way back to the figures, a ghost search and the theme
 * control, in a bar 64px tall that does not wrap. The inner row is
 * `flex items-center` with NO wrap, so a bar that does not fit does not fold
 * onto a second line — it OVERFLOWS, silently, and the control at the end goes
 * off the edge of the screen where nobody finds it.
 *
 * 1100px IS THE WIDTH IT IS TIGHTEST AT. The nav links and the figures label
 * appear at the `lg` breakpoint (1024px) and the bar has least spare room just
 * above it; below 1024px the links are hidden and the label collapses to an
 * icon, so the bar carries less.
 *
 * Driven on two screens, because they do not carry the same controls: the
 * routed company page, and the valuation screen, which is the only one with
 * the way back to the figures in it.
 */
async function checkHeaderOneLine(page: Page, label: string) {
  const was = page.viewportSize();
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.waitForTimeout(400);
  const measured: any = await page.evaluate(`(() => {
    const header = document.querySelector('header');
    if (!header) return { error: 'no header element' };
    const row = header.querySelector(':scope > div');
    if (!row) return { error: 'no row inside the header' };
    const box = header.getBoundingClientRect();
    const out = [];
    for (const el of Array.from(row.children)) {
      const st = getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      out.push({
        what: (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 30),
        top: Math.round(r.top * 10) / 10,
        bottom: Math.round(r.bottom * 10) / 10,
        right: Math.round(r.right * 10) / 10,
      });
    }
    return {
      height: Math.round(box.height),
      headerTop: Math.round(box.top * 10) / 10,
      headerBottom: Math.round(box.bottom * 10) / 10,
      scrollWidth: row.scrollWidth,
      clientWidth: row.clientWidth,
      bodyScrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      controls: row.querySelectorAll('a,button,input').length,
      children: out,
    };
  })()`);
  if (measured?.error) {
    fail(`the header at 1100px (${label})`, 'a header with a row of controls', String(measured.error));
  } else {
    // 1. NOTHING OVERFLOWS THE ROW. A flex row that cannot fit pushes its last
    //    child past the edge rather than wrapping.
    const over = measured.scrollWidth - measured.clientWidth;
    // 2. AND EVERY CONTROL IS INSIDE THE 64px BAND, which is what "one line"
    //    means for a bar whose children could otherwise sit below it.
    const outside = (measured.children || []).filter(
      (c: any) => c.top < measured.headerTop - 0.5 || c.bottom > measured.headerBottom + 0.5
    );
    const pastEdge = (measured.children || []).filter((c: any) => c.right > measured.innerWidth + 0.5);
    if (over > 1) {
      fail(
        `the header at 1100px (${label})`,
        'a row of controls that fits the bar',
        `${over}px of overflow (${measured.scrollWidth} into ${measured.clientWidth})`
      );
    } else if (outside.length) {
      fail(
        `the header at 1100px (${label})`,
        `every control inside the ${measured.height}px bar`,
        `${outside.length} below or above it: ${outside.map((c: any) => c.what).join(', ')}`
      );
    } else if (pastEdge.length) {
      fail(
        `the header at 1100px (${label})`,
        'every control inside the window',
        `${pastEdge.map((c: any) => c.what).join(', ')} past the right edge`
      );
    } else if (measured.bodyScrollWidth > measured.innerWidth + 1) {
      fail(
        `the page at 1100px (${label})`,
        'no horizontal scroll',
        `${measured.bodyScrollWidth}px of content in ${measured.innerWidth}px`
      );
    } else {
      ok(
        `the header fits on one line at 1100px (${label}): ${measured.controls} controls in a ` +
          `${measured.height}px bar, ${measured.scrollWidth}px of row in ${measured.clientWidth}px`
      );
    }
  }
  if (was) {
    await page.setViewportSize(was);
    await page.waitForTimeout(300);
  }
}

async function checkHeadsOnScreen(page: Page) {
  console.log(`\n=== the figures screen: the lines under their heads ===`);
  const title = page.getByRole('heading', { name: /^reported figures/i });
  if (!(await title.count())) {
    fail('the Reported figures table', 'on the figures screen', '(not there)');
    return;
  }
  ok('the figures table is on the screen, before the model');

  // ONE DECIMAL RULE PER ROW shows up here as one right edge: this is the
  // table the finding was measured on.
  await checkSharedRightEdge(page, 'the figures screen', '.mg-table', 'thead th.mg-fig', 'td.mg-fig');

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

  // A HEAD THE ENGINE CANNOT HONOUR SAYS SO, in its own ⓘ.
  //
  // READ ON TAX, which is a head the engine will never honour: the effective
  // rate every forecast year is taxed at is measured on the filed charge, so a
  // cost moved there would be read as tax the company paid. The debt head was
  // this check's subject until 2026-11-04, when the debt hook made it a drop
  // target (ROADMAP.md §19b), and the balance sheet's other refused head —
  // equity — carries only an anchor, so it renders no band of its own.
  const taxBand = page.locator('[data-head-band="tax"]');
  if (await taxBand.count()) {
    const said = await readHint(page, taxBand, 0);
    if (/not a drop target/i.test(said)) ok('a head the engine cannot honour says so in its hint');
    else fail('the not-a-drop-target note', 'in the tax head hint', said.slice(0, 80) || '(not there)');
    if (said.replace(/.*Not a drop target\./i, '').trim().length > 60) {
      ok('and gives the reason with it');
    } else {
      fail('the reason a head is not a drop target', 'stated in the hint', '(too short or absent)');
    }
  } else {
    fail('the tax head', 'on the profit and loss', '(not there)');
  }
  await page.getByRole('tab', { name: /balance sheet/i }).click();
  await page.waitForTimeout(500);
  // AND THE DEBT HEAD IS NOW ONE, which is what the hook built: a reader can
  // put a lease on it, and the hint says what that does to the valuation.
  const debtBand = page.locator('[data-head-band="debt"]');
  if (await debtBand.count()) {
    const said = await readHint(page, debtBand, 0);
    if (/not a drop target/i.test(said)) {
      fail('the debt head', 'a drop target, since the debt hook', 'still refused in its hint');
    } else if (/net debt reads it/i.test(said)) {
      ok('the debt head is a drop target and its hint says what a move does to the equity value');
    } else {
      fail('the debt head hint', 'what a move here does', said.slice(0, 80) || '(not there)');
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
  // THE FULLEST BAR THERE IS, measured where it is already on screen: the
  // valuation screen carries the wordmark, the nav, the way back to the
  // figures, the search and the theme control at once.
  await checkHeaderOneLine(page, 'the valuation screen');
  const figuresButton = page
    .getByRole('button', { name: /check the figures|corrected figure|moved line/i })
    .first();
  if (!(await figuresButton.count())) {
    fail('the way back to the figures', 'in the header', '(not there)');
    return;
  }
  // AND IN THOSE WORDS, with nothing corrected or moved yet. The walk below
  // would fail without the button at all, but it would fail as a restore that
  // did not restore, hundreds of lines from the header that dropped it.
  if (await page.getByRole('button', { name: /^check the figures$/i }).count()) {
    ok('the header carries "Check the figures" with nothing yet corrected or moved');
  } else {
    fail(
      'the way back to the figures',
      '"Check the figures", before any judgement is made',
      ((await figuresButton.textContent()) || '').trim() || '(no label)'
    );
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

// ---- every size on the screen is one of the type steps --------------------
//
// `docs/VISUAL_BUILD_PLAN.md` job 8.2. The remapping block in `index.css`
// snaps the class names it knows onto the steps; a size can still arrive
// through a class it does not list (`text-[60px]`), an inline style, a
// Tailwind named step, or an SVG attribute, and only the computed style shows
// it. So every element holding its own text, and every SVG <text>, is read
// for its computed font size, which must be one of the steps allowed on that
// screen, and never below the 13px floor.
const TYPE_PROBE = `(() => {
  const out = [];
  const seen = new Set();
  const own = (el) => Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim().length > 0);
  for (const el of document.querySelectorAll('*')) {
    const svg = el instanceof SVGElement;
    if (svg ? !(el.tagName === 'text' || el.tagName === 'tspan') : !own(el)) continue;
    if (svg && !own(el)) continue;
    const st = getComputedStyle(el);
    if (st.visibility === 'hidden' || st.display === 'none') continue;
    const box = el.getBoundingClientRect();
    if (!box.width || !box.height) continue;
    // A visually-hidden accessibility label (clip to 1px) is not set type.
    if (box.width <= 1 && box.height <= 1) continue;
    const size = Math.round(parseFloat(st.fontSize) * 100) / 100;
    out.push({ size, svg, tag: el.tagName.toLowerCase(), text: (el.textContent || '').trim().slice(0, 40), cls: String(el.getAttribute('class') || '').slice(0, 80) });
  }
  return { width: window.innerWidth, items: out };
})()`;

// Which screens are the landing page: the only ones the landing steps may use.
const LANDING_TYPE_SCREEN = 'the landing page, loaded';

// THE RATCHET (`docs/VISUAL_BUILD_PLAN.md` §3, decision V4). One off-step size
// still reaches the screen from component code that no stylesheet can
// overrule: the figures screen sets 14px in inline styles and in its own
// embedded <style> block (`figuresEditor.tsx`). That is build step 9's job
// (9.17), not this one. Until then the count of elements at each recorded size
// may FALL but never RISE, and any off-step size not listed here fails at
// once. Measured 2026-11-04 over every screen this check drives. Lower the
// number when a job removes some; delete the entry when it reaches zero.
//
// RAISED ONCE, ON THE DAY IT WAS WRITTEN, AND SAID RATHER THAN SLIPPED IN. It
// was recorded at 347 in the cloud, against a main that did not yet have the
// two judgement-layer hooks (`8a13663`). Those made three more heads drop
// targets, and every movable line's row menu lists each head it can go to, so
// 36 more elements of exactly the same kind appeared in exactly the same file:
// 383. Nothing else on any screen moved. A rise this check cannot explain is
// still a failure, which is the whole point of it.
const TYPE_RATCHET: Record<string, { count: number; why: string }> = {
  '14': { count: 383, why: 'the figures screen, figuresEditor.tsx inline styles and its embedded <style>' },
};

const typeSeen = new Map<string, any>();
const typeOffStep = new Map<string, number>();
let typeScreens = 0;
let typeElements = 0;

// The steps as the browser resolves them at a given width, from the tokens
// rather than from a list written here, so a step changed in tokens.ts moves
// the check with it.
const resolveStep = (value: string, width: number): number => {
  const m = /clamp\(\s*([\d.]+)px\s*,\s*([\d.]+)vw\s*,\s*([\d.]+)px\s*\)/.exec(value);
  if (m) return Math.min(Math.max(Number(m[1]), (Number(m[2]) * width) / 100), Number(m[3]));
  return parseFloat(value);
};
const allowedSizes = (width: number, landing: boolean): number[] =>
  [...SIZE_TOKENS.SIZE_STEPS_EVERYWHERE, ...(landing ? SIZE_TOKENS.SIZE_STEPS_LANDING_ONLY : [])].map(
    (k: string) => resolveStep(SIZE_TOKENS.SIZE[k], width)
  );

async function readType(page: Page, where: string) {
  const { width, items }: any = await page.evaluate(TYPE_PROBE);
  typeScreens++;
  const landing = where.startsWith(LANDING_TYPE_SCREEN);
  const allowed = allowedSizes(width, landing);
  for (const it of items) {
    typeElements++;
    const onStep = allowed.some((a) => Math.abs(a - it.size) < 0.05);
    const below = it.size < 12.95;
    if (onStep && !below) continue;
    const ratcheted = !below && TYPE_RATCHET[String(it.size)];
    if (ratcheted) {
      typeOffStep.set(String(it.size), (typeOffStep.get(String(it.size)) ?? 0) + 1);
      continue;
    }
    const key = `${where} | ${it.size}px${it.svg ? ' svg' : ''}`;
    if (!typeSeen.has(key)) typeSeen.set(key, { ...it, where, width, allowed, below, count: 0 });
    typeSeen.get(key).count++;
  }
}

function reportType() {
  console.log('\n=== every size on the screen is a type step ===');
  for (const r of [...typeSeen.values()].sort((a, b) => a.where.localeCompare(b.where) || a.size - b.size)) {
    problems++;
    console.log(
      `  PROBLEM: ${r.count} element${r.count === 1 ? '' : 's'} at ${r.size}px${r.svg ? ' (SVG text)' : ''} on ${r.where} ` +
        `(width ${r.width}) — ${r.below ? 'under the 13px floor' : `not a step here (${r.allowed.map((a: number) => Math.round(a * 100) / 100).join(', ')})`}; ` +
        `e.g. <${r.tag} class="${r.cls}"> "${r.text}"`
    );
  }
  for (const [size, entry] of Object.entries(TYPE_RATCHET)) {
    const now = typeOffStep.get(size) ?? 0;
    if (now > entry.count) {
      problems++;
      console.log(`  PROBLEM: ${now} elements at ${size}px, more than the ${entry.count} recorded (${entry.why}); the ratchet only falls`);
    } else if (now < entry.count) {
      console.log(`  NOTE: ${now} elements at ${size}px, fewer than the ${entry.count} recorded: lower TYPE_RATCHET['${size}'] to ${now}`);
    }
  }
  if (!typeSeen.size)
    ok(
      `${typeScreens} screens, ${typeElements.toLocaleString('en-GB')} pieces of type: every size a step, none under 13px` +
        Object.entries(TYPE_RATCHET)
          .map(([size, e]) => `; ratchet ${size}px at ${typeOffStep.get(size) ?? 0} of ${e.count} (${e.why})`)
          .join('')
    );
}

// A LANDING PAGE WITH FEWER PIECES OF TEXT THAN THIS IS NOT THE LANDING PAGE:
// an empty tab, an error screen, or a page whose sections never faded in.
// The loaded page measured 2026-11-04 holds well over two hundred.
const LANDING_MINIMUM_TEXT = 150;

/** Scroll top to bottom in viewport steps, so every reveal-on-scroll has run. */
async function revealWholePage(page: Page) {
  await page.waitForTimeout(1200);
  const height: number = await page.evaluate('document.documentElement.scrollHeight') as number;
  const step: number = await page.evaluate('window.innerHeight') as number;
  for (let y = 0; y < height; y += Math.max(200, step * 0.6)) {
    await page.evaluate(`window.scrollTo(0, ${y})`);
    await page.waitForTimeout(250);
  }
  await page.evaluate('window.scrollTo(0, 0)');
  await page.waitForTimeout(800);
}

async function readContrast(page: Page, where: string, opts: { minimumText?: number } = {}) {
  if (opts.minimumText) {
    const pieces = (await page.evaluate(
      `Array.from(document.querySelectorAll('body *')).filter(el => Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim().length > 1)).length`
    )) as number;
    if (pieces < opts.minimumText) {
      problems++;
      console.log(
        `  PROBLEM: ${where} holds ${pieces} pieces of text, fewer than the ${opts.minimumText} the page has — ` +
          `the read measured something other than the page`
      );
    }
  }
  await readType(page, where);
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

  const overlay = page.locator('[data-build-modal]').filter({ hasText: /building the model/i }).first();
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

  // HELD UNTIL THIS CHECK SAYS SO, not for a fixed number of seconds.
  //
  // It used to sleep 17 seconds while the check watched for 15 of them and
  // then read the screen, which left under a second a half of margin — and a
  // change that made the figures screen a few hundred milliseconds slower to
  // render was enough to spend it. The build then finished BEFORE the last two
  // assertions, so `getByRole(’status’)` matched a live region still holding
  // its last announcement rather than the overlay, and the body read behind it
  // picked up the cost-of-capital card on the company page — reporting a
  // “this company” on the loading screen that was never on the loading screen.
  // That is the body-wide text search `CLAUDE.md` warns about, decided by a
  // race.
  //
  // So the fetch now waits on a promise this check resolves when it has
  // finished looking, and the overlay cannot close underneath an assertion
  // about it. `WATCH_MS` is only how long the card is watched for, which is
  // the app’s own timing and nothing to do with the fetch.
  const WATCH_MS = 17_000;
  let release = () => {};
  const held = new Promise<void>((r) => {
    release = () => r();
  });
  await context.unroute('**/api/company*');
  await context.route('**/api/company*', async (route) => {
    await held;
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

  // THE MODAL, not the role=status inside it: the card sits outside the live
  // region on purpose (it is not announced), so the overlay is read whole.
  const overlay = page.locator('[data-build-modal]').filter({ hasText: /building the model/i }).first();
  // WHEN EACH PART APPEARED, stamped in the page (NAV_SEARCH §8 items 22–24;
  // job 9.3): the page rule, the modal, the belief, the correction.
  await context.addInitScript(`(() => {
    window.__build = {};
    const stamp = () => {
      const now = performance.now();
      for (const [k, sel] of [['rule', '[data-build-rule]'], ['modal', '[data-build-modal]'], ['belief', '[data-myth]'], ['fact', '[data-fact]']])
        if (window.__build[k] === undefined && document.querySelector(sel)) window.__build[k] = now;
    };
    new MutationObserver(stamp).observe(document, { childList: true, subtree: true });
  })()`);
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

  // ---- 0. THE FIRST SECOND IS THE PAGE RULE ALONE (NAV §8 items 22–24) ----
  //
  // Timed in the page from the moment the 2px rule appeared (the build's
  // start as the reader sees it): the modal at 1,000ms, the belief with it,
  // the correction 2,200ms after the belief. A quick build closes on the rule
  // alone; that case is checked by the loading-timeline section.
  const t: any = await page.evaluate(`window.__build || {}`);
  const gap = (a: string, b: string) => (t[a] === undefined || t[b] === undefined ? null : Math.round(t[b] - t[a]));
  const modalGap = gap('rule', 'modal');
  const beliefGap = gap('modal', 'belief');
  if (modalGap === null || modalGap < 950 || modalGap > 1250)
    fail('the modal held back for the first second', 'the page rule alone, then the modal at 1,000ms', modalGap === null ? `stamps ${JSON.stringify(t)}` : `the modal ${modalGap}ms after the rule`);
  else if (beliefGap === null || beliefGap > 150)
    fail('the belief with the modal', 'the belief as the modal opens', beliefGap === null ? 'no belief' : `${beliefGap}ms after it`);
  else ok(`the page rule alone for ${modalGap}ms, then the modal and its belief together (${beliefGap}ms apart)`);

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
  for (let waited = 0; waited < WATCH_MS - 2000; waited += 900) {
    const now = await read();
    const state = `${now.myth?.id ?? '-'}/${now.fact?.id ?? '-'}`;
    if (states[states.length - 1] !== state) states.push(state);
    if (now.fact && !sawFact) sawFact = now.fact;
    await page.waitForTimeout(900);
  }

  const t2: any = await page.evaluate(`window.__build || {}`);
  const factGap = t2.fact !== undefined && t2.belief !== undefined ? Math.round(t2.fact - t2.belief) : null;
  if (!sawFact) {
    fail('the fact following the myth', "the card's own correction", 'the myth held the screen alone');
  } else if (factGap === null || factGap < 2100 || factGap > 2500) {
    fail('the correction 2,200ms after the belief', 'belief + 2,200ms', factGap === null ? 'not stamped' : `${factGap}ms after the belief`);
  } else {
    ok(`the fact follows it ${factGap}ms after the belief: "${sawFact.fact.slice(0, 56)}…"`);
  }
  if (states.length < 2) {
    fail(
      'the loading screen changing during a slow build',
      `at least two states across ${Math.round(WATCH_MS / 1000)} seconds`,
      `one: ${states[0] ?? '(nothing)'} held the whole wait`
    );
  } else {
    ok(`${states.length} states over ${Math.round(WATCH_MS / 1000)} seconds (${states.join(' then ')}), so nothing holds the screen for the whole wait`);
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
  //
  // THAT THIS IS THE LOADING SCREEN IS ASSERTED, NOT ASSUMED. Everything
  // below reads the whole body on purpose (the Hint renders its text in a
  // portal), and a body read is only about the loading screen while the
  // loading screen is what is on it. `getByRole('status')` will happily match
  // a live region holding a stale announcement, so the overlay is required to
  // still be showing a card of its own first.
  const stillBuilding =
    (await overlay.isVisible().catch(() => false)) &&
    (await overlay.locator('[data-myth-card]').count()) > 0;
  if (!stillBuilding) {
    fail(
      'the loading screen, still on screen to be read',
      'the overlay and its card, with the build still held',
      'the build finished first, so what follows would be read off the company page behind it'
    );
  }
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

  // THE BUILD IS LET GO ONLY NOW, with every assertion about the loading
  // screen already made, and then waited for so nothing later starts while a
  // model is still being built.
  release();
  await started.catch(() => {});

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

  // THE HEADER, ON THE SCREEN A LINK LANDS ON. The valuation screen's fuller
  // bar is driven where that screen is already up, further down.
  await page.goto(`${BASE}/company/${PAPER_TICKER}/overview`, { waitUntil: 'domcontentloaded' });
  try {
    await page.getByRole('heading', { name: PAPER_NAME, level: 1 }).first().waitFor({ timeout: 60_000 });
    await checkHeaderOneLine(page, 'a company screen');
  } catch {
    fail('the company page at 1100px', 'the company heading', 'it never rendered');
  }

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

      // ---- THE CONCEPT, THE FORM, THE DATE AND THE LINK -------------------
      //
      // Four lines of the evidence sheet that were guesses or blanks until
      // 2026-11-03, and the link that said "Open the filing" and opened a
      // search page. All four are read HERE, in the browser, on named cells of
      // the fixture, because the data layer's own answer is checked over the
      // whole set in `npm run verify` and what a reader is shown is a
      // different question.
      //
      // The fixture is built for this: FY2023's revenue is tagged `Revenues`
      // where every other year is tagged
      // `RevenueFromContractWithCustomerExcludingAssessedTax`, so a sheet that
      // printed a constant would pass on one year and fail on the other; and
      // interest expense carries a concept and NO accession number, which is
      // the only path to the search link.
      {
        const sheet = page.locator('[data-evidence-sheet]');
        const lineOf = async (label: string) => {
          const dt = sheet.locator('dt', { hasText: new RegExp(`^${label}$`) }).first();
          if (!(await dt.count())) return '<<missing>>';
          return ((await dt.locator('xpath=following-sibling::dd[1]').textContent()) || '').trim();
        };
        const openCell = async (key: string) => {
          const cell = table.locator(`[data-cell="${key}"]`).first();
          if (!(await cell.count())) return false;
          await cell.evaluate((el: any) => el.click());
          await page.waitForTimeout(200);
          return await sheet.isVisible().catch(() => false);
        };

        // 1. A YEAR'S FIGURE NAMES ITS OWN CONCEPT, and two years of one row
        //    do not have to name the same one.
        const concepts: Record<string, string> = {};
        for (const fy of ['FY2023', 'FY2025']) {
          if (!(await openCell(`revenue:${fy}`))) {
            fail('the evidence for a year', `a revenue cell for ${fy}`, 'no such cell on the screen');
            continue;
          }
          concepts[fy] = await lineOf('Concept');
          const form = await lineOf('Form');
          const filed = await lineOf('Filing date');
          const accn = await lineOf('Filing ID');
          if (form !== '10-K') {
            fail(
              `the form behind ${fy} revenue`,
              'the one form the figure was filed on, 10-K',
              `"${form}"`
            );
          } else if (!/^\d{4}-\d{2}-\d{2}$/.test(filed)) {
            fail(`the filing date behind ${fy} revenue`, 'a date', `"${filed}"`);
          } else if (!/^\d{10}-\d{2}-\d{6}$/.test(accn)) {
            fail(`the filing behind ${fy} revenue`, 'an accession number', `"${accn}"`);
          } else {
            const link = sheet.locator('[data-evidence-link="filing"]').first();
            const href = (await link.count()) ? await link.getAttribute('href') : null;
            const label = ((await link.count()) ? await link.textContent() : '') || '';
            if (!href) {
              fail(`the link behind ${fy} revenue`, 'a link to that filing', 'no exact-filing link');
            } else if (!href.includes(accn.replace(/-/g, ''))) {
              fail(
                `the link behind ${fy} revenue`,
                `an address containing ${accn.replace(/-/g, '')}, which is filing ${accn}`,
                href
              );
            } else if (!/Open the filing/.test(label)) {
              fail(`the link behind ${fy} revenue`, '"Open the filing"', `"${label.trim()}"`);
            } else {
              ok(
                `${fy} revenue names its concept (${concepts[fy]}), its form (${form}), its date ` +
                  `(${filed}) and opens filing ${accn} itself`
              );
            }
          }
          await page.keyboard.press('Escape');
          await page.waitForTimeout(120);
        }
        if (concepts.FY2023 && concepts.FY2025 && concepts.FY2023 === concepts.FY2025) {
          fail(
            'the concept behind a figure',
            'the concept THAT figure was tagged under -- the fixture tags FY2023 revenue as `Revenues` ' +
              'and FY2025 as `RevenueFromContractWithCustomerExcludingAssessedTax`',
            `both years show ${concepts.FY2023}, so the sheet is printing the line's concept and not ` +
              "the figure's"
          );
        } else if (concepts.FY2023 && concepts.FY2025) {
          ok(
            `two years of one row name two different concepts (${concepts.FY2023} and ` +
              `${concepts.FY2025}), so the sheet names the figure's own`
          );
        }

        // 2. AND WHERE THERE IS NO ACCESSION NUMBER, THE LINK SAYS SO.
        //    Interest expense is a detail row, so the detail rows come out
        //    first. A link labelled "open the filing" that lands on a search
        //    page is a small lie told on every figure whose document is not
        //    held, which is what this used to be.
        const moreLines = page.getByRole('button', { name: /more lines/i });
        if (await moreLines.count()) {
          await moreLines.evaluate((el: any) => el.click());
          await page.waitForTimeout(200);
        }
        if (!(await openCell('interestExpense:FY2025'))) {
          fail(
            'the evidence for a figure with no document',
            'the interest expense cell the fixture gives no accession number',
            'no such cell on the screen'
          );
        } else {
          const accn = await lineOf('Filing ID');
          const form = await lineOf('Form');
          const concept = await lineOf('Concept');
          const search = sheet.locator('[data-evidence-link="search"]').first();
          const exact = sheet.locator('[data-evidence-link="filing"]').first();
          const label = ((await search.count()) ? await search.textContent() : '') || '';
          const href = (await search.count()) ? await search.getAttribute('href') : null;
          if (accn !== 'Not recorded' || form !== 'Not recorded') {
            fail(
              'a figure whose document is not held',
              'Not recorded on the Form and Filing ID lines',
              `form "${form}", filing ID "${accn}"`
            );
          } else if (concept === 'Not recorded') {
            fail(
              'a figure whose document is not held',
              'its concept, which is recorded even where the document is not',
              'Not recorded'
            );
          } else if (await exact.count()) {
            fail(
              'the link for a figure with no accession number',
              'a search link',
              'a link offered as that exact filing'
            );
          } else if (!/Find this filing on EDGAR/.test(label)) {
            fail(
              'the link for a figure with no accession number',
              '"Find this filing on EDGAR"',
              `"${label.trim()}"`
            );
          } else if (!href || !/sec\.gov/.test(href)) {
            fail('the search link', 'an address at the SEC', String(href));
          } else {
            ok(
              `a figure with no accession number names its concept (${concept}), reads "Not recorded" ` +
                'for the form and the filing, and offers "Find this filing on EDGAR"'
            );
          }
          await page.keyboard.press('Escape');
          await page.waitForTimeout(120);
        }
        const fewer = page.getByRole('button', { name: /Fewer lines/i });
        if (await fewer.count()) {
          await fewer.evaluate((el: any) => el.click());
          await page.waitForTimeout(150);
        }
      }

      // ---- AND THE COLUMN ADDS UP, ON THE SCREEN -------------------------
      //
      // The statement had no row for the difference between the printed costs
      // and the printed operating income, so a reader who added the column up
      // got a different number and nothing said why. "Other operating items"
      // is that row. What is asserted here is the arithmetic A READER CAN DO:
      // the figures as they are PRINTED, not the figures behind them, because
      // the printed column is the thing that did not add up.
      //
      // The paper company's own statement needs no bridge — its costs are
      // fixed shares of revenue and its operating income is what is left — so
      // the row must read nil here rather than a dash or a gap, and the
      // arithmetic over 2,025 real columns is held in `npm run verify`, where
      // 1,267 of them carry a bridge that is not nil.
      {
        const moreLines = page.getByRole('button', { name: /more lines/i });
        if (await moreLines.count()) {
          await moreLines.evaluate((el: any) => el.click());
          await page.waitForTimeout(200);
        }
        const printed = async (key: string): Promise<number | null> => {
          const cell = table.locator(`[data-cell="${key}:FY2025"]`).first();
          if (!(await cell.count())) return null;
          const said = ((await cell.textContent()) || '').trim();
          // The screen's own characters: a real minus sign, thousands commas
          // and a currency symbol inside the sign.
          const n = Number(said.replace(/−/g, '-').replace(/[^0-9.-]/g, ''));
          return Number.isFinite(n) ? n : null;
        };
        const figures: Record<string, number | null> = {};
        for (const key of ['revenue', 'cogs', 'grossProfit', 'rnd', 'sga', 'otherOperatingItems', 'operatingIncome']) {
          figures[key] = await printed(key);
        }
        const missing = Object.entries(figures)
          .filter(([, v]) => v === null)
          .map(([k]) => k);
        if (missing.length) {
          fail(
            'the income statement bridging revenue to operating income',
            'a printed figure on every line of the bridge',
            `no ${missing.join(', ')} cell on the screen`
          );
        } else {
          const gross = (figures.revenue as number) - (figures.cogs as number);
          const built =
            gross - (figures.rnd as number) - (figures.sga as number) + (figures.otherOperatingItems as number);
          // Three printed figures and one derived one, each rounded to the
          // nearest million, so the slack is the rounding and nothing else.
          if (Math.abs(gross - (figures.grossProfit as number)) > 3) {
            fail(
              'the printed gross profit',
              `revenue ${figures.revenue} less cost of sales ${figures.cogs} = ${gross}`,
              String(figures.grossProfit)
            );
          } else if (Math.abs(built - (figures.operatingIncome as number)) > 3) {
            fail(
              'the printed column adding up to the printed operating income',
              `${built} from the lines above it`,
              `operating income ${figures.operatingIncome}`
            );
          } else if (Math.abs(figures.otherOperatingItems as number) > 3) {
            fail(
              'other operating items on a statement whose named lines account for all of it',
              'nil',
              String(figures.otherOperatingItems)
            );
          } else {
            ok(
              `the printed column adds up: revenue ${figures.revenue} less cost of sales ${figures.cogs} ` +
                `less research ${figures.rnd} and selling ${figures.sga}, plus other operating items ` +
                `${figures.otherOperatingItems}, is the printed operating income ${figures.operatingIncome}`
            );
          }
        }
        // AND IT IS LABELLED AS OURS. The figure is this site's arithmetic over
        // the company's figures, so it is derived — one of the four visible
        // states — and the sheet shows the formula rather than a concept it has
        // not got.
        const bridgeCell = table.locator('[data-cell="otherOperatingItems:FY2025"]').first();
        if (await bridgeCell.count()) {
          await bridgeCell.evaluate((el: any) => el.click());
          await page.waitForTimeout(200);
          const sheet = page.locator('[data-evidence-sheet]');
          const said = ((await sheet.textContent()) || '').replace(/\s+/g, ' ');
          if (!/State\s*Derived/.test(said.replace(/\s+/g, ' ')) && !/Derived/.test(said)) {
            fail('the state of other operating items', 'Derived', said.slice(0, 80));
          } else if (!/Operating income/.test(said) || !/gross profit/.test(said)) {
            fail(
              'the evidence for other operating items',
              'the formula it was worked out by',
              said.slice(0, 120)
            );
          } else {
            ok('other operating items is labelled derived and shows the formula it was worked out by');
          }
          await page.keyboard.press('Escape');
          await page.waitForTimeout(120);
        }
        const fewer = page.getByRole('button', { name: /Fewer lines/i });
        if (await fewer.count()) {
          await fewer.evaluate((el: any) => el.click());
          await page.waitForTimeout(150);
        }
      }

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

// ---- reduced motion: nothing travels, and the progress rule ---------------
//
// `docs/VISUAL_BUILD_PLAN.md` job 8.4, VISUAL_SYSTEM §7 and §12.6. Under
// reduced motion — the operating system's, or the site's own stored setting —
// no transform may run and no fade may last longer than --m-dur-fast (110ms).
// A CSS override cannot see motion driven from JavaScript, so this does not
// read the stylesheet: it samples every element's computed transform and
// opacity after a scroll, at 150, 400 and 700ms, and anything still changing
// between samples is motion that outlived the rule. Every running Web
// Animation longer than 110ms is reported too.
//
// THE CONTROL PASS. The same probe runs once with motion ON and must see
// something move; if it sees nothing, it could not have seen anything in the
// reduced passes either, and says so rather than passing.
const MOTION_SAMPLE = `(() => {
  const ids = (window.__mgIds = window.__mgIds || new WeakMap());
  let next = window.__mgNext || 0;
  const out = {};
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('[data-progress-rule]')) continue;
    if (!ids.has(el)) ids.set(el, next++);
    const st = getComputedStyle(el);
    if (st.display === 'none') continue;
    out[ids.get(el)] = { t: st.transform, o: st.opacity, d: (el.getAttribute('class') || el.tagName).toString().slice(0, 70) };
  }
  window.__mgNext = next;
  return out;
})()`;

const LONG_ANIMATIONS = `(() => document.getAnimations()
  .filter(a => a.playState === 'running')
  .map(a => ({ d: Number(a.effect && a.effect.getComputedTiming().duration) || 0, i: a.effect && a.effect.getComputedTiming().iterations, t: (a.effect && a.effect.target && (a.effect.target.getAttribute('class') || a.effect.target.tagName)) || '?' }))
  .filter(x => x.d > 110 || x.i === Infinity)
  .map(x => ({ ...x, t: String(x.t).slice(0, 70) })))()`;

// A KNOWN MOVER. Neither screen this pass visits animates anything after it
// has loaded (measured 2026-11-04: no running animation and no changing
// transform on either, with motion on), so the real screens alone cannot show
// that the probe sees motion. This element is put on the page by the check: a
// 400ms transform and opacity transition, started, and asked how long it will
// run. With motion on it is 400ms; under reduced motion the stylesheet must
// have cut it to at most --m-dur-fast. The duration is read from the running
// transition rather than inferred from where the element is after a wait:
// on the landing page at 1440 the particle canvas keeps the main thread busy
// enough that the animation clock had not ticked when it was read, so a
// position read called a finished transition "part-way".
const KNOWN_MOVER = `(() => {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;left:0;top:0;width:8px;height:8px;opacity:1;transform:none;transition:transform 400ms linear, opacity 400ms linear;pointer-events:none';
  document.body.appendChild(el);
  el.getBoundingClientRect();
  el.style.transform = 'translateX(200px)';
  el.style.opacity = '0.2';
  el.getBoundingClientRect();
  const longest = Math.max(0, ...el.getAnimations().map(a => Number(a.effect.getComputedTiming().duration) || 0));
  el.remove();
  return longest;
})()`;

async function knownMoverIsMoving(page: Page): Promise<boolean> {
  const longest = (await page.evaluate(KNOWN_MOVER)) as number;
  return longest > 110;
}

async function movingAfterScroll(page: Page): Promise<{ moved: string[]; long: any[] }> {
  const moved = new Set<string>();
  const long: any[] = [];
  const height = (await page.evaluate('document.documentElement.scrollHeight')) as number;
  const step = (await page.evaluate('window.innerHeight')) as number;
  for (let y = 0; y < Math.min(height, step * 6); y += step * 0.8) {
    await page.evaluate(`window.scrollTo(0, ${Math.round(y)})`);
    await page.waitForTimeout(150);
    const a: any = await page.evaluate(MOTION_SAMPLE);
    await page.waitForTimeout(250);
    const b: any = await page.evaluate(MOTION_SAMPLE);
    await page.waitForTimeout(300);
    const c: any = await page.evaluate(MOTION_SAMPLE);
    for (const [first, second] of [[a, b], [b, c]] as any[])
      for (const id of Object.keys(second))
        if (first[id] && (first[id].t !== second[id].t || first[id].o !== second[id].o)) moved.add(second[id].d);
    long.push(...((await page.evaluate(LONG_ANIMATIONS)) as any[]));
  }
  // AND AN INTERACTION: the first closed disclosure on the page, opened. A
  // disclosure is the one element VISUAL_SYSTEM gives a 200ms movement, and
  // under reduced motion it must snap open.
  await page.evaluate('window.scrollTo(0, 0)');
  const disclose = page.locator('button[aria-expanded="false"][aria-controls]').first();
  if (await disclose.count()) {
    await disclose.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const before: any = await page.evaluate(MOTION_SAMPLE);
    await disclose.click();
    await page.waitForTimeout(60);
    const a: any = await page.evaluate(MOTION_SAMPLE);
    await page.waitForTimeout(90);
    const b: any = await page.evaluate(MOTION_SAMPLE);
    await page.waitForTimeout(300);
    const c: any = await page.evaluate(MOTION_SAMPLE);
    void before;
    for (const [first, second] of [[a, b], [b, c]] as any[])
      for (const id of Object.keys(second))
        if (first[id] && (first[id].t !== second[id].t || first[id].o !== second[id].o)) moved.add(`${second[id].d} (opening a disclosure)`);
    long.push(...((await page.evaluate(LONG_ANIMATIONS)) as any[]));
  }
  return { moved: [...moved], long };
}

async function checkReducedMotion(browser: Browser) {
  console.log('\n=== reduced motion: nothing travels, and the progress rule ===');
  const passes: { name: string; width: number; media: 'reduce' | 'no-preference'; stored: string | null; expectStill: boolean }[] = [
    { name: 'motion on (control)', width: 1440, media: 'no-preference', stored: null, expectStill: false },
    { name: 'the system asks for reduced motion, 1440', width: 1440, media: 'reduce', stored: null, expectStill: true },
    { name: 'the system asks for reduced motion, 360', width: 360, media: 'reduce', stored: null, expectStill: true },
    { name: 'the stored setting asks for it, 1440', width: 1440, media: 'no-preference', stored: 'reduced', expectStill: true },
  ];
  for (const pass of passes) {
    const ctx = await browser.newContext({ viewport: { width: pass.width, height: pass.width > 600 ? 900 : 740 }, reducedMotion: pass.media });
    await installFixtureRoutes(ctx);
    if (pass.stored) await ctx.addInitScript(`try { localStorage.setItem('marginalia:motion', '${pass.stored}'); } catch (e) {}`);
    const p = await ctx.newPage();
    let controlSaw = 0;
    for (const route of ['/', `/company/${PAPER_TICKER}/overview`]) {
      await p.goto(BASE + route, { waitUntil: 'networkidle' });
      await p.waitForTimeout(1200);
      const attribute = await p.evaluate('document.documentElement.dataset.motion');
      const want = pass.expectStill ? 'reduced' : 'full';
      if (attribute !== want) {
        problems++;
        console.log(`  PROBLEM: ${pass.name}, ${route}: <html data-motion> is "${attribute}", not "${want}"`);
      }
      const { moved, long } = await movingAfterScroll(p);
      const mover = await knownMoverIsMoving(p);
      if (pass.expectStill && mover) moved.push('the check\'s own 400ms transition, still set to run for longer than 110ms');
      if (!pass.expectStill && mover) moved.push('the check\'s own 400ms transition');
      if (pass.expectStill) {
        if (moved.length || long.length) {
          problems++;
          console.log(
            `  PROBLEM: ${pass.name}, ${route}: ${moved.length} element${moved.length === 1 ? '' : 's'} still moving or fading after 150ms` +
              `${long.length ? ` and ${long.length} animation${long.length === 1 ? '' : 's'} longer than 110ms` : ''}` +
              ` — e.g. ${[...moved.slice(0, 3), ...long.slice(0, 2).map((x) => `${x.t} (${x.d}ms)`)].join(' | ')}`
          );
        } else ok(`${pass.name}, ${route}: nothing moves or fades for longer than 110ms`);
      } else {
        controlSaw += moved.length + long.length;
        ok(`${pass.name}, ${route}: ${moved.length + long.length} moving or fading things seen with motion on`);
      }
    }
    if (!pass.expectStill && !controlSaw) {
      problems++;
      console.log(`  PROBLEM: ${pass.name}: nothing moved on either screen with motion on, so the probe cannot see motion at all`);
    }

    // THE PROGRESS RULE: on the header's bottom edge, oxblood, no shadow.
    if (pass.name.startsWith('the system') && pass.width === 1440) {
      await p.goto(BASE, { waitUntil: 'networkidle' });
      await p.waitForTimeout(800);
      const rule: any = await p.evaluate(`(() => {
        const r = document.querySelector('[data-progress-rule]');
        const h = document.querySelector('header');
        if (!r || !h) return null;
        const bar = r.firstElementChild;
        const shadows = [r, bar].map(el => getComputedStyle(el).boxShadow);
        return { top: r.getBoundingClientRect().top, header: h.getBoundingClientRect().bottom, shadows, colour: getComputedStyle(bar).backgroundColor, height: r.getBoundingClientRect().height };
      })()`);
      if (!rule) {
        problems++;
        console.log('  PROBLEM: no [data-progress-rule] element, or no header, on the landing page');
      } else {
        const issues: string[] = [];
        if (Math.abs(rule.top - rule.header) > 1) issues.push(`its top is at ${rule.top}px and the header ends at ${rule.header}px`);
        if (rule.shadows.some((x: string) => x !== 'none')) issues.push(`it carries a box-shadow (${rule.shadows.join(' / ')})`);
        if (rule.colour !== 'rgb(139, 30, 30)') issues.push(`its colour is ${rule.colour}, not the accent`);
        if (issues.length) {
          problems++;
          console.log(`  PROBLEM: the scroll-progress rule: ${issues.join('; ')}`);
        } else ok(`the scroll-progress rule sits on the header's bottom edge (${rule.header}px), ${rule.height}px tall, accent, no shadow`);
      }
    }
    await ctx.close();
  }
}

// ---- focus and targets: the ring, the header, the ⓘ ---------------------
//
// `docs/VISUAL_BUILD_PLAN.md` job 8.5, VISUAL_SYSTEM §7. Tabbing forward and
// then back through the landing page (which has a paper band), the Margin
// notes screen (paper) and the company overview, every element that takes
// focus must show a 2px solid outline, 2px off it, in ink on the dark ground
// and paper-ink on paper; and none may sit under the fixed header (WCAG
// 2.4.11), which is what `scroll-padding-top` is for — tabbing BACK up the
// page is the direction that would leave one there. Then every ⓘ is hit at
// the corners of a 24px square around its centre with a mouse, and of a 44px
// square in a touch context, and each point must land on that ⓘ.
const FOCUS_PROBE = `(() => {
  const el = document.activeElement;
  if (!el || el === document.body || el === document.documentElement) return null;
  const parse = (s) => { const m = s.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(',').map(Number); return { r:p[0], g:p[1], b:p[2], a:p.length>3?p[3]:1 }; };
  const lum = (c) => { const f=[c.r,c.g,c.b].map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);}); return 0.2126*f[0]+0.7152*f[1]+0.0722*f[2]; };
  let n = el.parentElement, bg = null;
  while (n && n !== document.documentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c && c.a > 0.85) { bg = c; break; } n = n.parentElement; }
  const st = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  const header = document.querySelector('header');
  return {
    desc: (el.tagName.toLowerCase() + ' ' + (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40)) + (el.matches(':focus-visible') ? '' : ' [not :focus-visible]'),
    style: st.outlineStyle, width: st.outlineWidth, offset: st.outlineOffset, colour: st.outlineColor,
    paper: bg ? lum(bg) > 0.5 : false,
    top: r.top, bottom: r.bottom, height: r.height,
    headerBottom: header ? header.getBoundingClientRect().bottom : 0,
    inHeader: !!el.closest('header'),
  };
})()`;

const INK_RGB = 'rgb(242, 240, 234)';
const PAPER_INK_RGB = 'rgb(22, 21, 15)';

async function walkFocus(page: Page, where: string, found: Map<string, string>): Promise<number> {
  let focused = 0;
  const look = async () => {
    const f: any = await page.evaluate(FOCUS_PROBE);
    if (!f) return;
    focused++;
    const want = f.paper ? PAPER_INK_RGB : INK_RGB;
    const issues: string[] = [];
    if (f.style !== 'solid' || f.width !== '2px') issues.push(`outline ${f.style} ${f.width}, not solid 2px`);
    if (f.offset !== '2px') issues.push(`offset ${f.offset}, not 2px`);
    if (f.colour !== want) issues.push(`outline ${f.colour}, not ${f.paper ? 'paper-ink' : 'ink'} (${want})`);
    if (!f.inHeader && f.height > 0 && f.bottom > 0 && f.top < f.headerBottom - 1)
      issues.push(`its top is at ${Math.round(f.top)}px, under the header, which ends at ${Math.round(f.headerBottom)}px`);
    for (const issue of issues) {
      const key = `${where}: ${issue}`;
      if (!found.has(key)) found.set(key, f.desc);
    }
  };
  for (let i = 0; i < 45; i++) { await page.keyboard.press('Tab'); await look(); }
  for (let i = 0; i < 30; i++) { await page.keyboard.press('Shift+Tab'); await look(); }
  return focused;
}

const HINT_HITS = `((half) => {
  const out = { count: 0, missed: [] };
  // A reading is only fair where the whole square is in view and below the
  // fixed header: a scroll step can leave an ⓘ half under the header, and the
  // header being on top there is the header doing its job.
  const header = document.querySelector('header');
  const top = header ? header.getBoundingClientRect().bottom : 0;
  for (const el of document.querySelectorAll('[data-hint]')) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (cx - half < 0 || cy - half < top + 1 || cx + half > innerWidth || cy + half > innerHeight) continue;
    out.count++;
    for (const [dx, dy] of [[-half, -half], [half, -half], [-half, half], [half, half]]) {
      const hit = document.elementFromPoint(cx + dx, cy + dy);
      if (!hit || hit.closest('[data-hint]') !== el) {
        const what = hit ? (hit.tagName.toLowerCase() + '.' + String(hit.getAttribute('class') || '').split(' ').slice(0, 3).join('.') + ' "' + (hit.textContent || '').trim().slice(0, 24) + '"') : 'nothing';
        out.missed.push((el.getAttribute('aria-label') || 'ⓘ').slice(0, 40) + ' at ' + dx + ',' + dy + ', where ' + what + ' is on top');
        break;
      }
    }
  }
  return out;
})`;

async function hintHitAreas(page: Page, size: number): Promise<{ count: number; missed: string[] }> {
  const half = size / 2 - 0.5;
  const total = { count: 0, missed: [] as string[] };
  const height = (await page.evaluate('document.documentElement.scrollHeight')) as number;
  const step = (await page.evaluate('window.innerHeight')) as number;
  const seen = new Set<string>();
  for (let y = 0; y < height; y += step * 0.7) {
    await page.evaluate(`window.scrollTo(0, ${Math.round(y)})`);
    await page.waitForTimeout(150);
    const r: any = await page.evaluate(`${HINT_HITS}(${half})`);
    total.count += r.count;
    for (const m of r.missed) if (!seen.has(m)) { seen.add(m); total.missed.push(m); }
  }
  return total;
}

async function checkFocusAndTargets(browser: Browser) {
  console.log('\n=== focus and targets: the ring, the header, the hit area ===');
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  await installFixtureRoutes(ctx);
  const p = await ctx.newPage();
  const found = new Map<string, string>();
  const counts: string[] = [];

  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1200);
  counts.push(`landing page ${await walkFocus(p, 'the landing page', found)}`);
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.getByRole('button', { name: /^All \d+ notes$/ }).click();
  await p.waitForTimeout(800);
  counts.push(`Margin notes ${await walkFocus(p, 'the Margin notes screen', found)}`);
  await p.goto(`${BASE}/company/${PAPER_TICKER}/overview`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1200);
  counts.push(`company overview ${await walkFocus(p, 'the company overview', found)}`);

  for (const [issue, element] of found) {
    problems++;
    console.log(`  PROBLEM: ${issue} (e.g. ${element})`);
  }
  if (!found.size) ok(`focus walked forward 45 and back 30 on each screen (${counts.join(', ')} focused): every ring 2px solid, 2px off, ink or paper-ink, none under the header`);

  // Measured from rest: the walk above leaves focus on whatever it reached
  // last, and a focused ⓘ or source opens its tooltip over its neighbours.
  // Which element that is depends on how many stops the header has, so
  // without this the reading changed with the menu (job 9.1).
  await p.evaluate(`document.activeElement && document.activeElement.blur && document.activeElement.blur()`);
  await p.mouse.move(1, 1);
  await p.waitForTimeout(200);
  const fine = await hintHitAreas(p, 24);
  await ctx.close();

  const touch = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await installFixtureRoutes(touch);
  const t = await touch.newPage();
  await t.goto(`${BASE}/company/${PAPER_TICKER}/overview`, { waitUntil: 'networkidle' });
  await t.waitForTimeout(1200);
  const coarse = await t.evaluate(`matchMedia('(pointer: coarse)').matches`);
  const finger = coarse ? await hintHitAreas(t, 44) : { count: 0, missed: [] };
  await touch.close();

  for (const [name, size, r] of [['mouse', 24, fine], ['touch', 44, finger]] as const) {
    if (!r.count) {
      problems++;
      console.log(`  PROBLEM: no ⓘ measured with the ${name} on the company overview${name === 'touch' && !coarse ? ' (the touch context does not match pointer: coarse)' : ''}`);
    } else if (r.missed.length) {
      problems++;
      console.log(`  PROBLEM: ${r.missed.length} ⓘ miss${r.missed.length === 1 ? 'es' : ''} a ${size}×${size} hit with the ${name}: ${r.missed.slice(0, 3).join(' | ')}`);
    } else ok(`${r.count} ⓘ readings with the ${name}: every corner of a ${size}×${size} square lands on its ⓘ`);
  }
}

// ---- the valuation bridge in a worker (build step 5, job C4) -------------
//
// Ten drivers are 1,024 engine runs, 3–4 seconds, so a screen asks for the
// bridge through `bridgeInWorker` (`src/data/bridgeRunner.ts`), which runs it
// in a Web Worker and answers once, with the finished bridge. This loads the
// runner in the real browser, sends it the ten-driver paper fixture, and
// checks that what comes back is the whole bridge — every driver, parts equal
// to the total to the cent — and the same, part for part, as the bridge the
// same code gives in Node: what is under test is the trip through the worker,
// not the arithmetic, which `npm run verify` checks.
async function checkBridgeWorker(browser: Browser) {
  console.log('\n=== the valuation bridge, in a worker ===');
  const BRM: any = await import(`file:///${REPO}/verify/bridge.mts`);
  const BRL: any = await import(`file:///${REPO}/src/data/bridge.ts`);
  const { A, B } = BRM.tenDriverVersions();
  const inNode = BRL.bridgeBetween(A, B);
  // A quiet page: the company overview, with reduced motion so nothing on it
  // animates. The landing page's particle canvas keeps the main thread busy
  // on its own, which is not what this measures.
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, reducedMotion: 'reduce' });
  await installFixtureRoutes(ctx);
  const p = await ctx.newPage();
  await p.goto(`${BASE}/company/${PAPER_TICKER}/overview`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1000);
  const r: any = await p.evaluate(`(async () => {
    const m = await import('/src/data/bridgeRunner.ts');
    // The page's own rate first: how often a 50ms timer gets the thread back
    // when nothing is being asked of it.
    let idle = 0;
    const idleTimer = setInterval(() => { idle++; }, 50);
    await new Promise((r) => setTimeout(r, 1000));
    clearInterval(idleTimer);
    const started = performance.now();
    // The page must stay free while the worker runs: a 50ms timer counts how
    // often it got the main thread back. Run on the page instead, the bridge
    // would hold the thread for seconds and the timer would barely tick.
    let ticks = 0;
    const timer = setInterval(() => { ticks++; }, 50);
    const result = await m.bridgeInWorker(${JSON.stringify(A)}, ${JSON.stringify(B)});
    clearInterval(timer);
    const ms = performance.now() - started;
    return { result, ms, ticks, idlePerSecond: idle, workerAvailable: typeof Worker !== 'undefined' };
  })()`);
  await ctx.close();
  const res = r.result;
  const cents = (res.parts || []).reduce((t: number, x: any) => t + Math.round(x.rounded * 100), 0);
  const issues: string[] = [];
  if (!r.workerAvailable) issues.push('the browser has no Worker, so the bridge ran on the page');
  // Half the page's own idle rate, over the time the bridge took.
  const expectedTicks = (r.idlePerSecond * r.ms) / 1000;
  if (r.ticks < expectedTicks * 0.5)
    issues.push(
      `the page's 50ms timer ticked ${r.ticks} times in ${Math.round(r.ms)}ms against ${r.idlePerSecond} a second when idle ` +
        `(${Math.round(expectedTicks)} expected), so the bridge held the main thread`
    );
  if (!res.ok) issues.push(`the worker returned no bridge (${(res.refused || []).map((x: any) => x.refusal).join('; ')})`);
  if ((res.parts || []).length !== inNode.parts.length) issues.push(`the worker returned ${(res.parts || []).length} parts, not ${inNode.parts.length}`);
  if (cents !== Math.round(res.totalRounded * 100)) issues.push(`its parts sum to ${cents / 100}, not its total ${res.totalRounded}`);
  const differ = (res.parts || []).filter((x: any, i: number) => !inNode.parts[i] || x.key !== inNode.parts[i].key || x.rounded !== inNode.parts[i].rounded);
  if (differ.length) issues.push(`${differ.length} parts differ from the same bridge in Node (e.g. ${differ[0].key} ${differ[0].rounded})`);
  for (const issue of issues) {
    problems++;
    console.log(`  PROBLEM: the bridge in a worker: ${issue}`);
  }
  if (!issues.length)
    ok(
      `10 drivers, ${res.runs} runs in a Web Worker, ${Math.round(r.ms)}ms in the browser with the page's timer ticking ${r.ticks} of ~${Math.round(expectedTicks)} times, answered once and whole: ` +
        `${res.parts.length} parts summing to ${res.totalRounded.toFixed(2)}, each equal to the Node bridge`
    );
}

// ---- the landing page claims only what has shipped (build step 8, 8.6) ---
//
// LANDING §2.4: the page may describe in the present tense only what the
// feature register says has shipped; everything else keeps its place, carries
// its status, is in the future tense, and opens nothing. §2.3: the company
// count is read from the data and printed by the spec's own rule. This loads
// the landing page with a screener table of 250 companies (and 12 duplicate
// listings) and reads what it says.
async function checkFeatureGate(browser: Browser) {
  console.log('\n=== the landing page claims only what has shipped ===');
  const FR: any = await import(`file:///${REPO}/src/data/featureRegister.ts`);
  const exchanges = ['NYSE', 'NASDAQ', 'NSE', 'LSE'];
  const rows = [
    ...Array.from({ length: 250 }, (_, i) => ({ ticker: `C${i}`, exchange: exchanges[i % 4], homeListing: true })),
    ...Array.from({ length: 12 }, (_, i) => ({ ticker: `D${i}`, exchange: 'TSX', homeListing: false })),
  ];
  // Worked out here, by the rule in LANDING §2.3, not by the code under test.
  const wantCount = '200+';
  const wantExchanges = [...exchanges].sort().join(' · ');
  const built = '2026-11-01T00:00:00Z';
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  await installFixtureRoutes(ctx);
  await ctx.route('**/api/screener*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ rows, built }) })
  );
  const p = await ctx.newPage();
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await revealWholePage(p);
  const page: any = await p.evaluate(`(() => ({
    text: document.body.innerText,
    features: Array.from(document.querySelectorAll('[data-feature]')).map((el) => ({
      id: el.getAttribute('data-feature'),
      status: el.getAttribute('data-feature-status'),
      text: el.innerText,
      opens: !!(el.matches('a[href], button:not([disabled])') || el.querySelector('a[href], button:not([disabled])')),
    })),
    stats: Array.from(document.querySelectorAll('[data-stat]')).map((el) => ({ key: el.getAttribute('data-stat'), text: el.innerText })),
  }))()`);
  await ctx.close();
  const issues: string[] = [];
  const unshipped = FR.FEATURES.filter((f: any) => f.status !== 'shipped');
  for (const f of unshipped) {
    if (f.does && page.text.includes(f.does)) issues.push(`the page describes "${f.title}" in the present tense, and it is ${f.status}: "${f.does.slice(0, 60)}…"`);
  }
  for (const el of page.features) {
    const f = FR.featureById(el.id);
    if (!f) { issues.push(`an element claims feature "${el.id}", which the register does not list`); continue; }
    if (el.status && el.status !== f.status) issues.push(`"${f.title}" is marked ${el.status} on the page and ${f.status} in the register`);
    if (f.status !== 'shipped' && el.opens) issues.push(`"${f.title}" is ${f.status} and its element opens something`);
    const label = FR.statusLabel(f);
    if (f.status !== 'shipped' && el.id !== 'three-approaches' && !el.text.includes(label)) issues.push(`"${f.title}" is ${f.status} and its element does not say "${label}"`);
  }
  const quarters = page.text.match(/\bQ[1-4] 20\d\d\b/g) || [];
  const recorded = FR.FEATURES.map((f: any) => f.quarter).filter(Boolean);
  const invented = quarters.filter((q: string) => !recorded.includes(q));
  if (invented.length) issues.push(`the page prints ${invented.join(', ')}, which no register entry records`);
  const count = page.stats.find((x: any) => x.key === 'companies');
  if (!count) issues.push('there is no company-count tile with a screener table to count');
  else {
    if (!count.text.includes(wantCount)) issues.push(`the count reads "${count.text.split('\n')[0]}", not ${wantCount} for 250 companies`);
    if (!count.text.includes(wantExchanges)) issues.push(`the exchanges read "${count.text}", not ${wantExchanges}`);
    if (!/as at 1 Nov 2026/.test(count.text)) issues.push('the count does not say what date the table is as at');
  }
  if (/10,000\+/.test(page.text)) issues.push('the page says 10,000+ with 250 companies in the table');
  if (!FR.CLAIMS.showFreeToUse && /cost to use|free to use/i.test(page.text)) issues.push('the page says it is free to use before pricing is decided (decision 2)');
  if (!FR.isShipped('three-approaches') && page.stats.some((x: any) => x.key === 'approaches'))
    issues.push('the page counts three valuation approaches before build step 5 has shipped (decision 4)');
  if (!FR.isShipped('private-company') && /value a private company/i.test(page.text) && page.features.some((x: any) => x.id === 'private-company' && x.opens))
    issues.push('the hero still offers "Value a private company" as a button');
  for (const stat of page.stats) if (!/\S/.test(stat.text.split('\n').slice(-1)[0])) issues.push(`the ${stat.key} tile has no source line`);
  for (const issue of issues) {
    problems++;
    console.log(`  PROBLEM: ${issue}`);
  }
  if (!issues.length)
    ok(
      `${page.features.length} feature elements, each with the register's status and nothing that opens unless shipped; ` +
        `${unshipped.length} unshipped features, none described in the present tense; no invented quarter; ` +
        `the count reads ${wantCount} from 250 companies over ${wantExchanges}, as at 1 Nov 2026; no free-to-use or three-approaches claim`
    );
}

// ---- the hero's particle field keeps its budgets (build step 8, job 8.7) -
//
// VISUAL_SYSTEM §6: at most 12,000 points, drawn at no more than 1.5 device
// pixels per CSS pixel; a pause control 24×24; settled — no frames at all —
// once nothing has happened for five seconds; stopped while the tab is hidden;
// the poster painted first and shown again whenever the field gives up; no
// field at all under reduced motion.
//
// This browser draws WebGL in software and cannot keep a frame under 20ms, so
// left alone the field halves its points twice and freezes on the poster —
// which is checked as it is. For the rest, the page's clock is slowed to a
// quarter for the field's own frame timing, so it behaves as it does on a
// real GPU (a sixth and a bit, so frames up to ~130ms real pass); every wait
// below is in real milliseconds.
async function checkHeroField(browser: Browser) {
  console.log('\n=== the hero: the particle field keeps its budgets ===');
  const PF: any = await import(`file:///${REPO}/src/components/particleField.tsx`).catch(() => null);
  const budget = PF?.PARTICLE_BUDGET ?? 12000;
  const issues: string[] = [];
  const counters = `(() => { window.__raf = 0; const raf = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = (cb) => { window.__raf++; return raf(cb); }; })()`;
  // A sixth and a bit: frames up to ~130ms real read as under 20ms, so the
  // field neither halves nor freezes here; five settling seconds become ~33.
  const slow = `(() => { const real = performance.now.bind(performance); performance.now = () => real() * 0.1; })()`;
  const state = (p: Page) => p.evaluate(`document.querySelector('canvas')?.dataset.state || null`) as Promise<string | null>;

  // 1. A 2x screen, the clock slowed: budgets, the pause control, settling.
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    await installFixtureRoutes(ctx);
    await ctx.addInitScript(CAPABLE_DEVICE);
    await ctx.addInitScript(counters);
    await ctx.addInitScript(slow);
    const p = await ctx.newPage();
    await p.goto(BASE, { waitUntil: 'networkidle' });
    await p.locator('canvas').first().waitFor({ timeout: 15_000 }).catch(() => {});
    await p.waitForTimeout(1500);
    const c: any = await p.evaluate(`(() => { const c = document.querySelector('canvas'); const poster = document.querySelector('[data-hero-poster]'); return c ? { particles: Number(c.dataset.particles), ratio: c.width / c.clientWidth, posterOpacity: poster ? getComputedStyle(poster).opacity : null } : null; })()`);
    if (!c) issues.push('no particle canvas mounted on the landing page');
    else {
      if (!(c.particles > 0 && c.particles <= budget)) issues.push(`the field draws ${c.particles} points, over the ${budget} budget`);
      if (c.ratio > 1.5 + 1e-6) issues.push(`the canvas is drawn at ${c.ratio.toFixed(2)} device pixels per CSS pixel on a 2x screen, over 1.5`);
      if (c.posterOpacity !== '0') issues.push(`the poster is still showing (opacity ${c.posterOpacity}) after the field drew its first frame`);
    }
    const toggle = p.locator('[data-motion-toggle]').first();
    const box = await toggle.boundingBox();
    if (!box) issues.push('no pause control under the hero');
    else {
      if (box.width < 24 || box.height < 24) issues.push(`the pause control is ${box.width}×${box.height}, under 24×24`);
      await toggle.click();
      await p.waitForTimeout(400);
      if ((await state(p)) !== 'paused') issues.push(`pressing pause leaves the field ${await state(p)}`);
      await toggle.click();
      await p.waitForTimeout(400);
    }
    // Leave it alone: within five (slowed) seconds of the last input it must
    // stop drawing altogether.
    let settled = false;
    for (let i = 0; i < 90 && !settled; i++) {
      await p.waitForTimeout(1000);
      settled = (await state(p)) === 'settled';
    }
    if (!settled) issues.push(`left alone for 90 seconds the field is still ${await state(p)}, not settled`);
    else {
      const before = (await p.evaluate('window.__raf')) as number;
      await p.waitForTimeout(2000);
      const after = (await p.evaluate('window.__raf')) as number;
      if (after - before > 2) issues.push(`settled, the page still asked for ${after - before} frames in two seconds`);
      await p.mouse.wheel(0, 40);
      await p.waitForTimeout(500);
      const woke = await state(p);
      if (woke !== 'running') issues.push(`a scroll after settling leaves the field ${woke}, not running`);
      await p.evaluate(`(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); })()`);
      await p.waitForTimeout(600);
      if ((await state(p)) !== 'hidden') issues.push(`with the tab hidden the field is ${await state(p)}, not stopped`);
    }
    await ctx.close();
  }

  // 2. The real clock: this software GPU is slow, and the field must give up
  //    gracefully — halving, then freezing with the poster back on screen.
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await installFixtureRoutes(ctx);
    await ctx.addInitScript(CAPABLE_DEVICE);
    const p = await ctx.newPage();
    await p.goto(BASE, { waitUntil: 'networkidle' });
    await p.waitForTimeout(12_000);
    const r: any = await p.evaluate(`(() => { const c = document.querySelector('canvas'); const poster = document.querySelector('[data-hero-poster]'); return { canvas: !!c, live: c ? c.dataset.live || null : null, particles: c ? c.dataset.particles : null, poster: poster ? getComputedStyle(poster).opacity : null }; })()`);
    if (!r.canvas && r.poster !== '1') issues.push(`the field froze and the poster is not showing (opacity ${r.poster})`);
    ok(r.canvas ? `on this browser's own clock the field is still drawing (${r.live ?? r.particles} points live)` : `on this browser's software GPU the field's first second averaged over 24ms a frame and the poster is back (opacity ${r.poster})`);
    await ctx.close();
  }

  // 3. Reduced motion: the poster, and no WebGL at all.
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    await installFixtureRoutes(ctx);
    await ctx.addInitScript(CAPABLE_DEVICE);
    const p = await ctx.newPage();
    await p.goto(BASE, { waitUntil: 'networkidle' });
    await p.waitForTimeout(2500);
    const r: any = await p.evaluate(`(() => ({ canvas: !!document.querySelector('canvas'), poster: getComputedStyle(document.querySelector('[data-hero-poster]')).opacity, toggle: !!document.querySelector('[data-motion-toggle]') }))()`);
    if (r.canvas) issues.push('under reduced motion the particle canvas still mounts');
    if (r.poster !== '1') issues.push(`under reduced motion the poster is not showing (opacity ${r.poster})`);
    if (r.toggle) issues.push('under reduced motion a pause control is offered for motion that is not there');
    await ctx.close();
  }

  for (const issue of issues) {
    problems++;
    console.log(`  PROBLEM: the hero: ${issue}`);
  }
  if (!issues.length)
    ok(`at most ${budget} points at ≤ 1.5 device pixels a pixel; the poster gives way to the first frame; pause holds the frame; settled after five seconds with no frames asked for; a scroll wakes it; a hidden tab stops it; reduced motion shows only the poster`);
}

// ---- one WebGL context on the page (build step 8, job 8.8) ---------------
//
// VISUAL_SYSTEM §6: one WebGL context per page. A second scene — the hexagon
// in an early screenshot — must reuse the hero's canvas or be a still SVG.
// Every getContext call for WebGL is counted from before the page's first
// script runs, while the whole landing page is scrolled through, at desktop
// and phone widths.
async function checkOneWebglContext(browser: Browser) {
  console.log('\n=== one WebGL context on the landing page ===');
  const issues: string[] = [];
  const counted: string[] = [];
  for (const width of [1440, 390]) {
    const ctx = await browser.newContext({ viewport: { width, height: width > 600 ? 900 : 844 } });
    await installFixtureRoutes(ctx);
    await ctx.addInitScript(CAPABLE_DEVICE);
    await ctx.addInitScript(`(() => {
      window.__webgl = 0;
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (kind, ...rest) {
        const made = original.call(this, kind, ...rest);
        if (made && /webgl/i.test(String(kind))) {
          // One canvas asking twice is one context; count canvases.
          if (!this.__counted) { this.__counted = true; window.__webgl++; }
        }
        return made;
      };
    })()`);
    const p = await ctx.newPage();
    await p.goto(BASE, { waitUntil: 'networkidle' });
    await revealWholePage(p);
    const n = (await p.evaluate('window.__webgl')) as number;
    counted.push(`${n} at ${width}`);
    if (n > 1) issues.push(`${n} WebGL contexts at ${width}px, over the one the page may have`);
    await ctx.close();
  }
  for (const issue of issues) {
    problems++;
    console.log(`  PROBLEM: ${issue}`);
  }
  if (!issues.length) ok(`WebGL contexts made while the whole landing page is scrolled: ${counted.join(', ')} — never more than one`);
}

// ---- the accent budget, sections 1–4 of the landing page (job 8.9) -------
//
// LANDING §9 items 14 and 23 and §3.1. At every scroll position, in 100px
// steps from the top of the page to the end of "Being built next", at 1440×900
// and 390×844, the viewport may hold at most one oxblood-washed primary, at
// most three oxblood fills or washes (rules of 2px or less and the heading
// mark are not fills), and at most five words set in the accent text colour.
// No text in those sections may be uppercased by CSS, and their copy holds
// none of LANDING §2.3's banned words. Reduced motion, so every block is
// visible as it is reached and the field does not draw.
const ACCENT_BUDGET = { washedPrimary: 1, fills: 3, accentWords: 5 };
async function checkLandingAccentBudget(browser: Browser) {
  console.log('\n=== the accent budget on landing sections 1–4 ===');
  const FR: any = await import(`file:///${REPO}/src/data/featureRegister.ts`);
  const issues: string[] = [];
  const worst: string[] = [];
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
    await installFixtureRoutes(ctx);
    const p = await ctx.newPage();
    await p.goto(BASE, { waitUntil: 'networkidle' });
    const end = (await p.evaluate(`(() => { const b = document.getElementById('beyond'); return b ? b.getBoundingClientRect().bottom + scrollY - innerHeight : -1; })()`)) as number;
    if (end < 0) { issues.push(`no #beyond section at ${width}px: the range to scan is unknown`); await ctx.close(); continue; }
    let most = { washed: 0, fills: 0, words: 0 };
    const seenUpper = new Set<string>();
    const reported = new Set<string>();
    for (let y = 0; y <= end + 99; y += 100) {
      await p.evaluate(`window.scrollTo(0, ${Math.min(y, end)})`);
      await p.waitForTimeout(30);
      const v: any = await p.evaluate(`(() => {
        const vh = innerHeight, vw = innerWidth;
        const ox = (c) => {
          const m = /rgba?\\(([^)]+)\\)/.exec(c);
          if (!m) return 0;
          const [r, g, b, a] = m[1].split(',').map(Number);
          return r === 139 && g === 30 && b === 30 ? (a === undefined || isNaN(a) ? 1 : a) : 0;
        };
        const ACCENT_TEXT = ['rgb(208, 94, 88)'];
        let washed = 0, fills = 0, words = 0;
        const fillWhere = [], wordWhere = [], upper = [];
        for (const el of document.querySelectorAll('body *')) {
          const r = el.getBoundingClientRect();
          if (!(r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw && r.width > 0 && r.height > 0)) continue;
          if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
          const cs = getComputedStyle(el);
          const a = ox(cs.backgroundColor);
          if (a > 0 && r.width > 2 && r.height > 2 && !el.hasAttribute('data-mark')) {
            fills++;
            fillWhere.push((el.tagName + ' ' + (el.textContent || '').trim()).slice(0, 40));
            if (a < 1 && el.matches('button, a, [role=button]')) washed++;
          }
          const own = Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ').trim();
          if (own) {
            if (ACCENT_TEXT.includes(cs.color)) { const n = own.split(/\\s+/).length; words += n; wordWhere.push(own.slice(0, 40)); }
            if (cs.textTransform === 'uppercase') upper.push(own.slice(0, 40));
          }
        }
        return { washed, fills, words, fillWhere, wordWhere, upper };
      })()`);
      most = { washed: Math.max(most.washed, v.washed), fills: Math.max(most.fills, v.fills), words: Math.max(most.words, v.words) };
      const at = `at ${width}px, scrolled to ${Math.min(y, end)}`;
      const once = (key: string, line: string) => { if (!reported.has(key)) { reported.add(key); issues.push(line); } };
      if (v.washed > ACCENT_BUDGET.washedPrimary) once('w', `${v.washed} oxblood-washed primaries in one viewport ${at}, over ${ACCENT_BUDGET.washedPrimary}: ${v.fillWhere.join(' | ')}`);
      if (v.fills > ACCENT_BUDGET.fills) once('f', `${v.fills} oxblood fills in one viewport ${at}, over ${ACCENT_BUDGET.fills}: ${v.fillWhere.join(' | ')}`);
      if (v.words > ACCENT_BUDGET.accentWords) once('t', `${v.words} accent-text words in one viewport ${at}, over ${ACCENT_BUDGET.accentWords}: ${v.wordWhere.join(' | ')}`);
      for (const u of v.upper) seenUpper.add(u);
    }
    for (const u of seenUpper) issues.push(`uppercase set by CSS at ${width}px: "${u}"`);
    const copy = (await p.evaluate(`(() => ['hero','routes','filings','forecast','cash','discount','answers','workbench','beyond'].map((id) => { const el = document.getElementById(id); return el ? el.textContent : ''; }).join(' '))()`)) as string;
    const banned = FR.landingBannedIn(copy);
    if (banned.length && width === 1440) issues.push(`LANDING §2.3 banned words in sections 1–4: ${banned.join(', ')}`);
    worst.push(`${width}px: at most ${most.washed} washed primary, ${most.fills} fills, ${most.words} accent words`);
    await ctx.close();
  }
  for (const issue of issues) {
    problems++;
    console.log(`  PROBLEM: ${issue}`);
  }
  if (!issues.length) ok(`landing sections 1–4 in 100px steps — ${worst.join('; ')}; no CSS uppercase; no banned words`);
}

// ---- phone and low-end: the poster, no WebGL (job 8.11) -----------------
//
// VISUAL_SYSTEM §8. The machines this harness runs on report 4 cores, which
// is itself low-end, so a check that needs the field says what device it is
// (CAPABLE_DEVICE: 8 cores, 8GB, no Data Saver, 4g) and each low-end case
// below changes one signal from that. On each: no WebGL context is made, no
// canvas is in the page, the poster is showing and the hero says why
// (`data-hero-mode`). The capable device at 1440 must get the field, or the
// check would pass on a page that never draws it. Then the whole landing page
// at 390 and 320 wide, scrolled top to bottom, must never scroll sideways.
const CAPABLE_DEVICE = `(() => {
  const def = (o, k, v) => { try { Object.defineProperty(o, k, { get: () => v, configurable: true }); } catch {} };
  def(navigator, 'hardwareConcurrency', 8);
  def(navigator, 'deviceMemory', 8);
  const conn = { saveData: false, effectiveType: '4g', addEventListener() {}, removeEventListener() {} };
  def(navigator, 'connection', conn);
  window.__device = conn;
})()`;
const WEBGL_COUNTER = `(() => {
  window.__webgl = 0;
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (kind, ...rest) {
    const made = original.call(this, kind, ...rest);
    if (made && /webgl/i.test(String(kind)) && !this.__counted) { this.__counted = true; window.__webgl++; }
    return made;
  };
})()`;
async function checkPhoneAndLowEnd(browser: Browser) {
  console.log('\n=== phone and low-end: the poster, no WebGL ===');
  const issues: string[] = [];
  const seen: string[] = [];
  // VISUAL_BUILD_PLAN V7 (Nihar, 4 November 2026): 4 cores and 4GB are not
  // low-end and get the field; 2 cores, 2GB, no WebGL2 and a first second
  // averaging over 24ms a frame get the poster.
  const SLOW_FRAMES = `(() => { const raf = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = (cb) => raf((t) => { const end = performance.now() + 32; while (performance.now() < end) {} cb(t); }); })();`;
  const cases: { name: string; width: number; height: number; tweak: string; wantField: boolean; reason?: string; drawsFirst?: boolean }[] = [
    { name: 'a capable desktop', width: 1440, height: 900, tweak: '', wantField: true },
    { name: '4 cores', width: 1440, height: 900, tweak: `Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 });`, wantField: true },
    { name: '4GB of memory', width: 1440, height: 900, tweak: `Object.defineProperty(navigator, 'deviceMemory', { get: () => 4 });`, wantField: true },
    { name: '2 cores', width: 1440, height: 900, tweak: `Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 2 });`, wantField: false, reason: 'few-cores' },
    { name: '2GB of memory', width: 1440, height: 900, tweak: `Object.defineProperty(navigator, 'deviceMemory', { get: () => 2 });`, wantField: false, reason: 'low-memory' },
    { name: 'no WebGL2', width: 1440, height: 900, tweak: `delete window.WebGL2RenderingContext;`, wantField: false, reason: 'no-webgl2' },
    { name: 'frames over 24ms', width: 1440, height: 900, tweak: SLOW_FRAMES, wantField: false, reason: 'slow-frames', drawsFirst: true },
    { name: 'Data Saver', width: 1440, height: 900, tweak: `window.__device.saveData = true;`, wantField: false, reason: 'save-data' },
    { name: 'a 3g connection', width: 1440, height: 900, tweak: `window.__device.effectiveType = '3g';`, wantField: false, reason: 'slow-connection' },
    { name: 'a 390px phone', width: 390, height: 844, tweak: '', wantField: false, reason: 'narrow' },
  ];
  for (const k of cases) {
    const ctx = await browser.newContext({ viewport: { width: k.width, height: k.height } });
    await installFixtureRoutes(ctx);
    await ctx.addInitScript(WEBGL_COUNTER);
    await ctx.addInitScript(CAPABLE_DEVICE);
    if (k.tweak) await ctx.addInitScript(`(() => { ${k.tweak} })()`);
    const p = await ctx.newPage();
    await p.goto(BASE, { waitUntil: 'networkidle' });
    if (k.wantField) await p.locator('canvas').first().waitFor({ timeout: 15_000 }).catch(() => {});
    else if (k.drawsFirst) {
      await p.waitForFunction(`document.querySelector('[data-hero-mode]')?.getAttribute('data-hero-mode') === 'poster:slow-frames'`, null, { timeout: 20_000 }).catch(() => {});
      await p.waitForTimeout(2000); // the poster fades back in
    }
    else await p.waitForTimeout(3000);
    const v: any = await p.evaluate(`(() => {
      const poster = document.querySelector('[data-hero-poster]');
      const hero = document.querySelector('[data-hero-mode]');
      return {
        webgl: window.__webgl, canvases: document.querySelectorAll('canvas').length,
        poster: poster ? getComputedStyle(poster).opacity : null,
        mode: hero ? hero.getAttribute('data-hero-mode') : null,
      };
    })()`);
    seen.push(`${k.name}: ${v.webgl} WebGL, ${v.mode}`);
    if (k.wantField) {
      if (v.webgl !== 1) issues.push(`${k.name}: ${v.webgl} WebGL contexts, where the field should draw (the check would pass a page that never draws it)`);
    } else {
      // A measured first second needs drawing to measure, so that one case
      // may have made its one context; it must then have given it up.
      if (v.webgl > (k.drawsFirst ? 1 : 0)) issues.push(`${k.name}: ${v.webgl} WebGL context made, where VISUAL_SYSTEM §8 asks for the poster`);
      if (v.canvases > 0) issues.push(`${k.name}: ${v.canvases} canvas in the page, where there should be none`);
      if (v.poster !== '1') issues.push(`${k.name}: the poster is not showing (opacity ${v.poster})`);
      if (v.mode !== `poster:${k.reason}`) issues.push(`${k.name}: the hero says "${v.mode}", not "poster:${k.reason}"`);
    }
    await ctx.close();
  }
  // 320px reflow (WCAG 1.4.10) and 390.
  const wide: string[] = [];
  for (const width of [390, 320]) {
    const ctx = await browser.newContext({ viewport: { width, height: 740 }, reducedMotion: 'reduce' });
    await installFixtureRoutes(ctx);
    const p = await ctx.newPage();
    await p.goto(BASE, { waitUntil: 'networkidle' });
    const total = (await p.evaluate(`document.documentElement.scrollHeight`)) as number;
    let worst = 0;
    let where = '';
    for (let y = 0; y < total; y += 600) {
      await p.evaluate(`window.scrollTo(0, ${y})`);
      await p.waitForTimeout(40);
      const r: any = await p.evaluate(`(() => {
        const over = document.documentElement.scrollWidth - document.documentElement.clientWidth;
        let el = null;
        if (over > 0) for (const e of document.querySelectorAll('body *')) { const b = e.getBoundingClientRect(); if (b.right > innerWidth + 1 && b.width > 0 && getComputedStyle(e).position !== 'fixed') { el = (e.tagName + '.' + String(e.className).slice(0, 50) + ' ' + (e.textContent || '').trim().slice(0, 30)); break; } }
        return { over, el };
      })()`);
      if (r.over > worst) { worst = r.over; where = `${r.el} at y ${y}`; }
    }
    wide.push(`${width}px ${worst}px`);
    if (worst > 0) issues.push(`at ${width}px the landing page scrolls sideways by ${worst}px (${where})`);
    await ctx.close();
  }
  for (const issue of issues) {
    problems++;
    console.log(`  PROBLEM: ${issue}`);
  }
  if (!issues.length) ok(`${seen.join('; ')}; sideways scroll ${wide.join(', ')}`);
}

// ---- the Margin notes at their own addresses (job 9.8) -------------------
//
// LEARN_STATES §2.2 (L1) and §2.5. Every note is loaded directly at
// /learn/notes/<key>/ and must open that note, by its title; /learn/notes/
// opens the first note of the index. Back returns to the note before. Walking
// "next" from the first note of the index must visit every note in the
// index's own printed order, and "previous" from the last must walk it back
// — the expected order is read from the rendered index, not from the code
// that orders it. On a phone the index is one closed disclosure. A key no
// note has lands on /learn/notes/. The landing page's "All n notes" goes to
// /learn/notes/.
async function checkNotesAddresses(browser: Browser) {
  console.log('\n=== the Margin notes at their own addresses ===');
  const MN: any = await import(`file:///${REPO}/src/data/marginNotes.ts`);
  const notes: { key: string; title: string }[] = MN.MARGIN_NOTES;
  const issues: string[] = [];
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await installFixtureRoutes(ctx);
  const p = await ctx.newPage();
  const shown = async () =>
    (await p.evaluate(`(() => { const a = document.querySelector('article[data-note]'); return a ? { key: a.getAttribute('data-note'), title: (a.querySelector('h2')?.textContent || '').trim() } : null; })()`)) as { key: string; title: string } | null;
  const path = () => new URL(p.url()).pathname;
  const waitNote = async (key?: string) =>
    p.waitForFunction(key ? `document.querySelector('article[data-note="${key}"]') !== null` : `document.querySelector('article[data-note]') !== null`, null, { timeout: 15_000 }).catch(() => {});

  // 1. Every note by its own address.
  let direct = 0;
  for (const n of notes) {
    await p.goto(`${BASE}/learn/notes/${n.key}/`, { waitUntil: 'domcontentloaded' });
    await waitNote(n.key);
    const s = await shown();
    if (!s || s.key !== n.key || s.title !== n.title) issues.push(`/learn/notes/${n.key}/ opens ${s ? `"${s.title}" (${s.key})` : 'no note'}, not "${n.title}"`);
    else direct++;
  }
  // 2. The screen's own address, and the order its index prints.
  await p.goto(`${BASE}/learn/notes/`, { waitUntil: 'domcontentloaded' });
  await waitNote();
  const indexOrder = (await p.evaluate(`Array.from(document.querySelectorAll('nav[data-notes-index] a[data-note-link]')).map((a) => a.getAttribute('data-note-link'))`)) as string[];
  const first = await shown();
  if (!indexOrder.length) issues.push('the notes index prints no note links');
  if (indexOrder.length !== notes.length) issues.push(`the index prints ${indexOrder.length} notes, the data holds ${notes.length}`);
  if (!first || first.key !== indexOrder[0]) issues.push(`/learn/notes/ opens ${first?.key ?? 'nothing'}, not the index's first note (${indexOrder[0]})`);
  // 3. Next, all the way down, then previous all the way back, by clicking.
  const walk = async (rel: 'next' | 'prev') => {
    const seen: string[] = [(await shown())?.key ?? '?'];
    for (let i = 0; i < notes.length + 2; i++) {
      const link = p.locator(`article a[rel="${rel}"]`);
      if (!(await link.count())) break;
      const to = await link.getAttribute('data-note-link');
      await link.click();
      await waitNote(to || undefined);
      seen.push((await shown())?.key ?? '?');
    }
    return seen;
  };
  const down = await walk('next');
  if (down.join(',') !== indexOrder.join(',')) issues.push(`"next" from the first note walks ${down.length} notes in an order other than the index's (first difference at ${down.findIndex((k, i) => k !== indexOrder[i]) + 1}: ${down.find((k, i) => k !== indexOrder[i])})`);
  const up = await walk('prev');
  if (up.join(',') !== [...indexOrder].reverse().join(',')) issues.push(`"previous" from the last note does not walk the index back in order`);
  // 4. Back.
  await p.goto(`${BASE}/learn/notes/${indexOrder[0]}/`, { waitUntil: 'domcontentloaded' });
  await waitNote(indexOrder[0]);
  await p.locator('article a[rel="next"]').click();
  await waitNote(indexOrder[1]);
  const afterNext = path();
  await p.goBack();
  await waitNote(indexOrder[0]);
  const afterBack = { path: path(), note: (await shown())?.key };
  if (afterNext !== `/learn/notes/${indexOrder[1]}/`) issues.push(`"next" moved the address to ${afterNext}, not /learn/notes/${indexOrder[1]}/`);
  if (afterBack.path !== `/learn/notes/${indexOrder[0]}/` || afterBack.note !== indexOrder[0]) issues.push(`Back from ${indexOrder[1]} lands on ${afterBack.path} showing ${afterBack.note}, not ${indexOrder[0]}`);
  // 5. A key no note has.
  await p.goto(`${BASE}/learn/notes/no-such-note/`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(`location.pathname === '/learn/notes/'`, null, { timeout: 10_000 }).catch(() => {});
  if (path() !== '/learn/notes/') issues.push(`/learn/notes/no-such-note/ stays at ${path()}, not /learn/notes/`);
  // 6. From the landing page.
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.getByRole('button', { name: /^All \d+ notes$/ }).first().click();
  await waitNote();
  if (path() !== '/learn/notes/') issues.push(`the landing page's "All notes" goes to ${path()}, not /learn/notes/`);
  await ctx.close();
  // 7. On a phone, the index is one closed disclosure.
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await installFixtureRoutes(phone);
  const q = await phone.newPage();
  await q.goto(`${BASE}/learn/notes/${notes[3].key}/`, { waitUntil: 'domcontentloaded' });
  await q.waitForSelector('article[data-note]', { timeout: 15_000 }).catch(() => {});
  const ph: any = await q.evaluate(`(() => {
    const b = document.querySelector('[data-notes-disclose]');
    const links = Array.from(document.querySelectorAll('nav[data-notes-index] a[data-note-link]')).filter((a) => a.getBoundingClientRect().height > 0);
    const art = document.querySelector('article[data-note]');
    return { button: b ? b.getAttribute('aria-expanded') : null, label: b ? b.textContent.trim() : null, links: links.length, articleTop: art ? Math.round(art.getBoundingClientRect().top + scrollY) : null };
  })()`);
  if (ph.button !== 'false') issues.push(`at 390 the notes index is not a closed disclosure (aria-expanded ${ph.button})`);
  if (ph.links) issues.push(`at 390 ${ph.links} note links show before the index is opened`);
  if (ph.label !== `All ${notes.length} notes`) issues.push(`the phone index is labelled "${ph.label}", not "All ${notes.length} notes"`);
  await phone.close();
  for (const issue of issues) {
    problems++;
    console.log(`  PROBLEM: ${issue}`);
  }
  if (!issues.length) ok(`all ${direct} notes open at /learn/notes/<key>/; next walks the ${indexOrder.length} in index order and previous walks them back; Back returns; an unknown key lands on /learn/notes/; at 390 the index is a closed "${ph.label}" with the note at y ${ph.articleTop}`);
}

// ---- page not found, in the app (job 9.5) --------------------------------
//
// LEARN_STATES §3.6. The dev server sends every unknown path to the app, as
// a rewrite would, and the app must answer with its not-found screen and the
// path printed — not with the landing page at the wrong address. `/` must
// still be the landing page, and "Home" must take the reader there.
// (`verify:routes` checks the deployed routing: the static 404.html and the
// rewrites in vercel.json.)
async function checkInAppNotFound(browser: Browser) {
  console.log('\n=== page not found, in the app ===');
  const issues: string[] = [];
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await installFixtureRoutes(ctx);
  const p = await ctx.newPage();
  await p.goto(`${BASE}/definitely-not-a-page`, { waitUntil: 'domcontentloaded' });
  const shown = await p.waitForSelector('[data-not-found]', { timeout: 15_000 }).then(() => true).catch(() => false);
  const v: any = await p.evaluate(`(() => ({
    path: document.querySelector('[data-not-found-path]')?.textContent || null,
    h1: document.querySelector('[data-not-found] h1')?.textContent || null,
    landing: !!document.getElementById('routes'),
  }))()`);
  if (!shown) issues.push(`/definitely-not-a-page shows no not-found screen${v.landing ? ' — the landing page renders at the wrong address' : ''}`);
  else {
    if (v.path !== '/definitely-not-a-page') issues.push(`the not-found screen prints "${v.path}", not the path asked for`);
    if (!/^This page does not exist/.test(v.h1 || '')) issues.push(`the not-found title reads "${v.h1}"`);
    if (v.landing) issues.push('the landing page renders under the not-found screen');
    await p.getByRole('link', { name: 'Home' }).click();
    const home = await p.waitForSelector('#routes', { timeout: 15_000 }).then(() => true).catch(() => false);
    if (!home || new URL(p.url()).pathname !== '/') issues.push(`"Home" from the not-found screen lands on ${new URL(p.url()).pathname}${home ? '' : ' without the landing page'}`);
  }
  await p.goto(BASE, { waitUntil: 'domcontentloaded' });
  const landing = await p.waitForSelector('#routes', { timeout: 15_000 }).then(() => true).catch(() => false);
  if (!landing || (await p.locator('[data-not-found]').count())) issues.push('/ no longer shows the landing page');
  await ctx.close();
  for (const issue of issues) {
    problems++;
    console.log(`  PROBLEM: ${issue}`);
  }
  if (!issues.length) ok('an unknown path shows "This page does not exist" with the path printed; Home goes to the landing page; / is still the landing page');
}

// ---- the global header and the menu (job 9.1) ----------------------------
//
// NAV_SEARCH §8 items 1–12, on the landing page and the notes screen. At
// 1440: the bar 64px; in order the wordmark, the section triggers and the
// Search trigger, 320×36 with its right edge at 1392; no clock, no live dot,
// no animate-pulse anywhere in the header; every trigger muted at rest
// (#A8A29A) and none oxblood; at most one selected item; the triggers' names
// a subsequence of the seven in their fixed order, each with a shipped link.
// A panel opens on click, on Enter and on ↓, never on hover; Esc closes it and
// gives focus back to its trigger; at most 8 links, rows 36px, the overlay
// ground, no shadow; every "Coming" item is text with no link. At 390 (touch):
// the bar 64px, Search and Menu 44×44, the sheet's top at y = 64, section rows
// 56px, link rows 48px, every target in it at least 44 tall, Esc closes it
// and returns focus to Menu.
async function checkHeaderAndMenu(browser: Browser) {
  console.log('\n=== the global header and the menu ===');
  const SEVEN = ['Companies', 'Research', 'Markets', 'Invest', 'Tools', 'Learn', 'Deals'];
  const issues: string[] = [];
  const notes: string[] = [];
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await installFixtureRoutes(ctx);
  const p = await ctx.newPage();
  for (const [where, address] of [['the landing page', '/'], ['the notes screen', '/learn/notes/']] as const) {
    await p.goto(`${BASE}${address}`, { waitUntil: 'networkidle' });
    await p.waitForSelector('header [data-menu-trigger]', { timeout: 15_000 }).catch(() => {});
    const h: any = await p.evaluate(`(() => {
      const header = document.querySelector('header');
      const r = header.getBoundingClientRect();
      const kids = Array.from(header.querySelectorAll('[aria-label="Marginalia home"], [data-menu-trigger], [aria-label="Search companies"]'))
        .filter((e) => e.getBoundingClientRect().width > 0)
        .map((e) => { const b = e.getBoundingClientRect(); return { what: e.getAttribute('data-menu-trigger') || e.getAttribute('aria-label'), x: Math.round(b.left), right: Math.round(b.right), w: Math.round(b.width), h: Math.round(b.height), colour: getComputedStyle(e).color, current: e.getAttribute('aria-current') }; });
      const text = header.innerText;
      return {
        height: Math.round(r.height), kids,
        clock: /\\b\\d{1,2}:\\d{2}(:\\d{2})?\\b/.test(text),
        pulse: header.querySelectorAll('.animate-pulse').length,
        live: /\\blive\\b/i.test(text),
        selected: Array.from(header.querySelectorAll('[aria-current]')).filter((e) => e.getBoundingClientRect().width > 0).length,
        banned: ['Home', 'All companies', 'Check the figures'].filter((w) => Array.from(header.querySelectorAll('a, button')).some((e) => e.getBoundingClientRect().width > 0 && e.textContent.trim() === w)),
      };
    })()`);
    if (h.height !== 64) issues.push(`${where}: the header is ${h.height}px, not 64`);
    if (h.clock) issues.push(`${where}: the header shows a clock`);
    if (h.pulse) issues.push(`${where}: ${h.pulse} animate-pulse element(s) in the header`);
    if (h.live) issues.push(`${where}: the header says "live"`);
    if (h.banned.length) issues.push(`${where}: the header carries ${h.banned.join(', ')}`);
    if (h.selected > 1) issues.push(`${where}: ${h.selected} header items in the selected state, over 1`);
    const order = h.kids.map((k: any) => k.what);
    const names = order.filter((w: string) => SEVEN.includes(w));
    if (order[0] !== 'Marginalia home' || order[order.length - 1] !== 'Search companies') issues.push(`${where}: header order is ${order.join(' · ')}`);
    if (!names.length) issues.push(`${where}: no section triggers`);
    if (names.join() !== SEVEN.filter((n) => names.includes(n)).join()) issues.push(`${where}: sections out of the fixed order: ${names.join(', ')}`);
    const search = h.kids.find((k: any) => k.what === 'Search companies');
    if (search && (search.w !== 320 || search.h !== 36 || search.right !== 1392)) issues.push(`${where}: the Search trigger is ${search.w}×${search.h} with its right edge at ${search.right}, not 320×36 at 1392`);
    for (const k of h.kids.filter((k: any) => SEVEN.includes(k.what) && !k.current))
      if (k.colour !== 'rgb(168, 162, 154)') issues.push(`${where}: ${k.what} at rest is ${k.colour}, not #A8A29A`);
    notes.push(`${where}: ${names.join(' · ')}, ${h.selected} selected`);
  }
  // Panels: hover opens nothing; click, Enter and ↓ open; Esc closes and returns focus.
  await p.goto(BASE, { waitUntil: 'networkidle' });
  const names: string[] = await p.evaluate(`Array.from(document.querySelectorAll('header [data-menu-trigger]')).map((e) => e.getAttribute('data-menu-trigger'))`);
  for (const name of names) {
    const trigger = p.locator(`header [data-menu-trigger="${name}"]`);
    const panel = p.locator(`[data-menu-panel="${name}"]`);
    await trigger.hover();
    await p.waitForTimeout(250);
    if (await panel.count()) issues.push(`${name}: the panel opens on hover`);
    for (const how of ['click', 'Enter', 'ArrowDown'] as const) {
      if (how === 'click') await trigger.click();
      else { await trigger.focus(); await p.keyboard.press(how); }
      await p.waitForTimeout(80);
      if (!(await panel.count())) { issues.push(`${name}: ${how} does not open the panel`); continue; }
      if (how === 'click') {
        const d: any = await p.evaluate(`(() => {
          const el = document.querySelector('[data-menu-panel="${name}"]');
          const cs = getComputedStyle(el);
          const links = Array.from(el.querySelectorAll('[data-menu-link]'));
          const coming = Array.from(el.querySelectorAll('[data-menu-coming] [data-feature]'));
          return {
            links: links.length - el.querySelectorAll('[data-menu-coming] [data-menu-link]').length,
            heights: [...new Set(links.map((l) => Math.round(l.getBoundingClientRect().height)))],
            ground: cs.backgroundColor, shadow: cs.boxShadow,
            comingLinked: coming.filter((c) => c.closest('a') || c.querySelector('a, button')).length,
          };
        })()`);
        if (d.links > 8) issues.push(`${name}: ${d.links} links in the panel, over 8`);
        if (d.heights.some((x: number) => x !== 36)) issues.push(`${name}: panel rows are ${d.heights.join('/')}px, not 36`);
        if (d.ground !== 'rgb(22, 22, 26)') issues.push(`${name}: the panel ground is ${d.ground}, not the overlay`);
        if (d.shadow && d.shadow !== 'none') issues.push(`${name}: the panel has a shadow`);
        if (d.comingLinked) issues.push(`${name}: ${d.comingLinked} coming item(s) carry a link`);
      }
      await p.keyboard.press('Escape');
      await p.waitForTimeout(80);
      const back: any = await p.evaluate(`({ open: !!document.querySelector('[data-menu-panel]'), focus: document.activeElement?.getAttribute('data-menu-trigger') })`);
      if (back.open) issues.push(`${name}: Esc does not close the panel`);
      else if (back.focus !== name) issues.push(`${name}: after Esc focus is on ${back.focus ?? 'nothing'}, not the trigger`);
    }
  }
  await ctx.close();
  // The phone.
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  await installFixtureRoutes(phone);
  const q = await phone.newPage();
  await q.goto(BASE, { waitUntil: 'networkidle' });
  const bar: any = await q.evaluate(`(() => {
    const box = (sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.width), Math.round(b.height)]; };
    return { height: Math.round(document.querySelector('header').getBoundingClientRect().height), search: box('header [aria-label="Search companies"]'), menu: box('header [data-menu-button]') };
  })()`);
  if (bar.height !== 64) issues.push(`390: the header is ${bar.height}px, not 64`);
  for (const [what, b] of [['Search', bar.search], ['Menu', bar.menu]] as const)
    if (!b || b[0] < 44 || b[1] < 44) issues.push(`390: ${what} is ${b ? b.join('×') : 'missing'}, under 44×44`);
  if (bar.menu) {
    await q.locator('header [data-menu-button]').click();
    await q.waitForSelector('[data-menu-sheet]', { timeout: 5000 }).catch(() => {});
    const first = await q.locator('[data-sheet-section]').first();
    if (await first.count()) await first.click();
    await q.waitForTimeout(100);
    const sh: any = await q.evaluate(`(() => {
      const s = document.querySelector('[data-menu-sheet]');
      if (!s) return null;
      const rows = Array.from(s.querySelectorAll('[data-sheet-section]')).map((e) => Math.round(e.getBoundingClientRect().height));
      const links = Array.from(s.querySelectorAll('[data-menu-link]')).map((e) => Math.round(e.getBoundingClientRect().height));
      const small = Array.from(s.querySelectorAll('a, button')).filter((e) => e.getBoundingClientRect().height < 44).map((e) => e.textContent.trim().slice(0, 30));
      return { top: Math.round(s.getBoundingClientRect().top), rows: [...new Set(rows)], links: [...new Set(links)], small };
    })()`);
    if (!sh) issues.push('390: Menu opens no sheet');
    else {
      if (sh.top !== 64) issues.push(`390: the sheet's top is at y = ${sh.top}, not 64`);
      if (sh.rows.some((x: number) => x !== 56)) issues.push(`390: sheet section rows are ${sh.rows.join('/')}px, not 56`);
      if (!sh.links.length || sh.links.some((x: number) => x < 48)) issues.push(`390: sheet link rows are ${sh.links.join('/') || 'absent'}px, under 48`);
      if (sh.small.length) issues.push(`390: targets under 44px in the sheet: ${sh.small.join(', ')}`);
      await q.keyboard.press('Escape');
      await q.waitForTimeout(80);
      const after: any = await q.evaluate(`({ open: !!document.querySelector('[data-menu-sheet]'), menu: document.activeElement?.hasAttribute('data-menu-button') })`);
      if (after.open) issues.push('390: Esc does not close the sheet');
      else if (!after.menu) issues.push('390: after Esc focus is not on Menu');
      notes.push(`390: sheet at y ${sh.top}, rows ${sh.rows.join('/')}, links ${sh.links.join('/')}`);
    }
  }
  await phone.close();
  for (const issue of issues) {
    problems++;
    console.log(`  PROBLEM: ${issue}`);
  }
  if (!issues.length) ok(`${notes.join('; ')}; panels open by click, Enter and ↓, not hover, and Esc returns focus; no clock, live dot or pulse`);
}

// ---- the loading screen's timeline and controls (job 9.3) -----------------
//
// NAV_SEARCH §8 items 22–29. First the timeline itself
// (`src/data/loadingTimeline.ts`) with fake times, for every finishing time
// from 0 to 90 seconds in 50ms steps: a build done inside a second opens no
// modal and is not held; otherwise the modal opens at 1,000ms, the
// correction shows no later than belief + 2,200ms (at once if the build is
// done first), stays at least 1,200ms, the modal at least 500ms, and no build
// is held more than 1,200ms past finishing. Then in the browser: a build
// answered at once never opens the modal; a build held open shows "Step 1 of
// 2" with the fill at 0 (nothing creeps), no percentage and no counting
// seconds, a fixed 232px card area, "Taking longer than usual." by 15
// seconds; Esc closes it and gives focus back to the search field, and the
// late answer is ignored; Esc at 300ms, before the modal, cancels too.
async function checkLoadingScreen(browser: Browser) {
  console.log('\n=== the loading screen: timeline and controls ===');
  const LT: any = await import(`file:///${REPO}/src/data/loadingTimeline.ts`);
  const issues: string[] = [];
  let cases = 0;
  for (let done = 0; done <= 90_000; done += 50) {
    cases++;
    const t = LT.loadingTimeline(done);
    if (done < 1000) {
      if (t.modalAt !== null || t.closeAt !== done) { issues.push(`timeline: a build done at ${done}ms opens the modal or is held (close ${t.closeAt})`); break; }
      continue;
    }
    const bad =
      t.modalAt !== 1000 ? 'the modal is not at 1,000ms' :
      t.correctionAt === null || t.correctionAt > t.beliefAt + 2200 ? 'the correction is late' :
      t.correctionAt < Math.min(done, t.beliefAt + 2200) ? 'the correction comes before it is due' :
      t.closeAt - t.correctionAt < 1200 ? 'the correction is up under 1,200ms' :
      t.closeAt - t.modalAt < 500 ? 'the modal is up under 500ms' :
      t.closeAt - done > 1200 ? `the build is held ${t.closeAt - done}ms past finishing` : null;
    if (bad) { issues.push(`timeline at ${done}ms: ${bad}`); break; }
  }

  const stampScript = `(() => {
    window.__build = {};
    const stamp = () => {
      const now = performance.now();
      for (const [k, sel] of [['rule', '[data-build-rule]'], ['modal', '[data-build-modal]']])
        if (window.__build[k] === undefined && document.querySelector(sel)) window.__build[k] = now;
    };
    new MutationObserver(stamp).observe(document, { childList: true, subtree: true });
  })()`;

  // A build answered at once.
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await installFixtureRoutes(ctx);
    await ctx.addInitScript(stampScript);
    const p = await ctx.newPage();
    await search(p, PAPER_TICKER);
    await p.waitForURL(/\/company\//, { timeout: 30_000 }).catch(() => {});
    const t: any = await p.evaluate(`window.__build || {}`);
    if (t.modal !== undefined) issues.push(`a build answered at once opened the modal (${Math.round(t.modal - (t.rule ?? t.modal))}ms after the rule)`);
    if (t.rule === undefined) issues.push('a build answered at once showed no page rule either');
    await ctx.close();
  }

  // A build held open.
  let measured = '';
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await installFixtureRoutes(ctx);
    let release = () => {};
    const held = new Promise<void>((r) => { release = () => r(); });
    await ctx.unroute('**/api/company*');
    await ctx.route('**/api/company*', async (route) => {
      await held;
      try { await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixtureFor(PAPER_TICKER)) }); } catch { /* the check moved on */ }
    });
    const p = await ctx.newPage();
    const started = search(p, PAPER_TICKER).catch(() => {});
    const modal = p.locator('[data-build-modal]');
    await modal.waitFor({ state: 'visible', timeout: 30_000 }).catch(() => {});
    const v: any = await p.evaluate(`(() => {
      const m = document.querySelector('[data-build-modal]');
      const area = document.querySelector('[data-build-card-area]');
      return m ? {
        step: (document.querySelector('[data-build-step]')?.textContent || '').trim(),
        fill: document.querySelector('[data-build-modal] [data-build-fill]')?.getAttribute('data-build-fill'),
        area: area ? Math.round(area.getBoundingClientRect().height) : null,
        cancel: !!document.querySelector('[data-build-cancel]'),
        text: (m.querySelector('[role=status]')?.textContent || '') + ' ' + (m.querySelector('[data-build-cancel]')?.parentElement?.textContent || ''),
      } : null;
    })()`);
    if (!v) issues.push('a held build never opened the modal');
    else {
      if (v.step !== 'Step 1 of 2') issues.push(`a held build reads "${v.step}", not "Step 1 of 2"`);
      if (v.fill !== '0') issues.push(`the fill is ${v.fill} with no stage finished, not 0`);
      if (v.area !== 232) issues.push(`the card area is ${v.area}px high at 1440, not a fixed 232`);
      if (!v.cancel) issues.push('no Cancel on the loading screen');
      if (/\d\s*%/.test(v.text)) issues.push(`a percentage in the loading screen's progress: "${v.text.trim().slice(0, 80)}"`);
    }
    const a = (await modal.textContent().catch(() => '')) || '';
    await p.waitForTimeout(2000);
    const b = (await modal.textContent().catch(() => '')) || '';
    const secs = (x: string) => (x.match(/\b\d+\s*(s|sec|seconds)\b/g) || []).join();
    if (secs(a) !== secs(b) && secs(b)) issues.push('a counting number of seconds on the loading screen');
    await p.waitForFunction(`(document.querySelector('[data-build-modal]')?.textContent || '').includes('Taking longer than usual.')`, null, { timeout: 16_000 }).catch(() => {});
    const late = (await modal.textContent().catch(() => '')) || '';
    if (!late.includes('Taking longer than usual.')) issues.push('no "Taking longer than usual." by 15 seconds');
    await p.keyboard.press('Escape');
    await p.waitForTimeout(200);
    const after: any = await p.evaluate(`({ modal: !!document.querySelector('[data-build-modal], [data-build-rule]'), focus: document.activeElement?.tagName === 'INPUT' })`);
    if (after.modal) issues.push('Esc does not close the loading screen');
    if (!after.focus) issues.push('after Esc focus is not back on the search field');
    release();
    await p.waitForTimeout(6000);
    if (/\/company\//.test(p.url())) issues.push('the cancelled build still opened the company when its answer came');
    await started;
    measured = v ? `${v.step}, fill ${v.fill}, card area ${v.area}px` : '';
    await ctx.close();
  }

  // Esc before the modal.
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await installFixtureRoutes(ctx);
    let release = () => {};
    const held = new Promise<void>((r) => { release = () => r(); });
    await ctx.unroute('**/api/company*');
    await ctx.route('**/api/company*', async (route) => {
      await held;
      try { await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixtureFor(PAPER_TICKER)) }); } catch { /* moved on */ }
    });
    const p = await ctx.newPage();
    const started = search(p, PAPER_TICKER).catch(() => {});
    await p.locator('[data-build-rule]').waitFor({ state: 'attached', timeout: 30_000 }).catch(() => {});
    await p.waitForTimeout(300);
    await p.keyboard.press('Escape');
    await p.waitForTimeout(1200);
    if (await p.locator('[data-build-modal], [data-build-rule]').count()) issues.push('Esc at 300ms, before the modal, does not cancel the build');
    release();
    await started;
    await ctx.close();
  }

  for (const issue of issues) {
    problems++;
    console.log(`  PROBLEM: ${issue}`);
  }
  if (!issues.length) ok(`the timeline holds for ${cases} finishing times (0–90s); a quick build shows the rule and no modal; a held one reads ${measured}, says "Taking longer than usual." by 15s, and Esc closes it (also at 300ms) with focus back on the field and the late answer ignored`);
}

// ---- the company header and the tab row (job 9.9) ------------------------
//
// COMPANY_OVERVIEW §1.4–1.5 and checklist §7.1 (L2, L9–L11). On the paper
// company's overview at 1440 and 390: the header panel starts at y = 88
// (80 on a phone); the ticker line is muted, never oxblood; the name is on
// the Title step; nothing in the header is a clock, seconds or a live dot,
// and the stamp reads "Prices: close 30 Oct 2026[, 20:00 UTC]" and
// "Statements: FY2026, ended 25 Jan 2026"; every tab is 48 high (and 44 wide
// on the phone); the current tab is ink 600 with a 2px accent rule, and that
// rule is the only accent anywhere in the header at rest. Manual activation:
// → moves focus without changing the address, Enter selects. Switching tabs
// does not move the header. On the phone the row scrolls inside itself with
// the next tab clipped.
async function checkCompanyHeader(browser: Browser) {
  console.log('\n=== the company header and the tab row ===');
  const issues: string[] = [];
  const notes: string[] = [];
  for (const [width, height, touch] of [[1440, 900, false], [390, 844, true]] as const) {
    const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', isMobile: touch, hasTouch: touch });
    await installFixtureRoutes(ctx);
    const p = await ctx.newPage();
    await p.goto(`${BASE}/company/${PAPER_TICKER}/overview`, { waitUntil: 'networkidle' });
    await p.waitForSelector('[data-company-stamp]', { timeout: 30_000 }).catch(() => {});
    const h: any = await p.evaluate(`(() => {
      const panel = document.querySelector('[data-company-header]');
      if (!panel) return null;
      const accent = (c) => /rgba?\\(139, 30, 30|rgba?\\(208, 94, 88/.test(c);
      const tabs = Array.from(panel.querySelectorAll('[role=tab]'));
      const current = panel.querySelector('[role=tab][aria-selected=true]');
      const bar = current ? current.querySelector('span.absolute') : null;
      const accents = [];
      for (const el of panel.querySelectorAll('*')) {
        if (el === bar) continue;
        const cs = getComputedStyle(el);
        const own = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim());
        if ((own && accent(cs.color)) || accent(cs.backgroundColor) || (parseFloat(cs.borderTopWidth) > 0 && accent(cs.borderTopColor)) || (parseFloat(cs.borderBottomWidth) > 0 && accent(cs.borderBottomColor)))
          accents.push(el.tagName + ' ' + (el.textContent || '').trim().slice(0, 20));
      }
      const list = panel.querySelector('[role=tablist]');
      const lr = list.getBoundingClientRect();
      return {
        top: Math.round(panel.getBoundingClientRect().top + scrollY),
        ticker: getComputedStyle(panel.querySelector('[data-company-ticker]')).color,
        h1: getComputedStyle(panel.querySelector('h1')).fontSize,
        title: getComputedStyle(document.documentElement).getPropertyValue('--m-size-title').trim(),
        stamp: panel.querySelector('[data-company-stamp]')?.innerText.trim().split('\\n') ?? [],
        text: panel.innerText,
        pulse: panel.querySelectorAll('.animate-pulse').length,
        tabs: tabs.map((t) => ({ slug: t.getAttribute('data-tab'), h: Math.round(t.getBoundingClientRect().height), w: Math.round(t.getBoundingClientRect().width), right: Math.round(t.getBoundingClientRect().right) })),
        current: current ? { colour: getComputedStyle(current).color, weight: getComputedStyle(current).fontWeight, bar: bar ? Math.round(bar.getBoundingClientRect().height) + ' ' + getComputedStyle(bar).backgroundColor : null } : null,
        accents,
        scrolls: list.scrollWidth > list.clientWidth + 1,
        clipped: tabs.some((t) => { const r = t.getBoundingClientRect(); return r.left < lr.right - 1 && r.right > lr.right + 1; }),
      };
    })()`);
    const at = `${width}px`;
    // For a reviewer: SHOT_DIR=<folder> keeps a screenshot of each width.
    if (process.env.SHOT_DIR) await p.screenshot({ path: path.join(process.env.SHOT_DIR, `company-header-${width}.png`) });
    if (!h) { issues.push(`${at}: no company header`); await ctx.close(); continue; }
    const wantTop = width >= 640 ? 88 : 80;
    if (h.top !== wantTop) issues.push(`${at}: the header panel starts at y = ${h.top}, not ${wantTop}`);
    if (h.ticker !== 'rgb(168, 162, 154)') issues.push(`${at}: the ticker line is ${h.ticker}, not muted`);
    const titlePx = width >= 1286 ? '36px' : width <= 1000 ? '28px' : null;
    if (titlePx && h.h1 !== titlePx) issues.push(`${at}: the name is ${h.h1}, not the Title step (${titlePx})`);
    if (/\b\d{1,2}:\d{2}:\d{2}\b/.test(h.text) || h.pulse || /\blive\b/i.test(h.text)) issues.push(`${at}: a clock, seconds or a live dot in the header`);
    const [pr, st] = h.stamp;
    if (!/^Prices: (close \d{1,2} [A-Z][a-z]{2} \d{4}(, \d{2}:\d{2} UTC)?|not recorded)$/.test(pr || '')) issues.push(`${at}: the stamp's first line reads "${pr}"`);
    if (!/^Statements: (FY\d{4}|the last filed year)(, ended \d{1,2} [A-Z][a-z]{2} \d{4})?$/.test(st || '')) issues.push(`${at}: the stamp's second line reads "${st}"`);
    const short = h.tabs.filter((t: any) => t.h !== 48 || (touch && t.w < 44));
    if (short.length) issues.push(`${at}: tabs not 48 high${touch ? ' and 44 wide' : ''}: ${short.map((t: any) => `${t.slug} ${t.w}×${t.h}`).join(', ')}`);
    if (!h.current || h.current.colour !== 'rgb(242, 240, 234)' || h.current.weight !== '600') issues.push(`${at}: the current tab is ${JSON.stringify(h.current)}, not ink 600`);
    else if (!h.current.bar || !h.current.bar.startsWith('2 ') || !/139, 30, 30/.test(h.current.bar)) issues.push(`${at}: the current tab's rule is ${h.current.bar}, not 2px accent`);
    if (h.accents.length) issues.push(`${at}: accent in the header besides the current tab's rule: ${h.accents.slice(0, 3).join(' | ')}`);
    if (touch && !(h.scrolls && h.clipped)) issues.push(`${at}: the tab row does not scroll inside itself with the next tab clipped`);
    // Manual activation, and a switch that does not move the header.
    const before = p.url();
    await p.locator('[role=tab][aria-selected=true]').focus();
    await p.keyboard.press('ArrowRight');
    const focused = await p.evaluate(`document.activeElement?.getAttribute('data-tab')`);
    if (p.url() !== before) issues.push(`${at}: → changed the address (activation is manual)`);
    if (focused !== h.tabs[1]?.slug) issues.push(`${at}: → moved focus to ${focused}, not ${h.tabs[1]?.slug}`);
    const box = await p.locator('[data-company-header]').boundingBox();
    await p.keyboard.press('Enter');
    await p.waitForURL(new RegExp(`/${h.tabs[1]?.slug}$`), { timeout: 10_000 }).catch(() => {});
    if (!p.url().endsWith(`/${h.tabs[1]?.slug}`)) issues.push(`${at}: Enter on ${h.tabs[1]?.slug} did not select it (${p.url()})`);
    await p.waitForTimeout(300);
    const after = await p.locator('[data-company-header]').boundingBox();
    if (box && after && (Math.abs(box.y - after.y) > 0.5 || Math.abs(box.height - after.height) > 0.5)) issues.push(`${at}: switching tabs moved the header (${Math.round(box.y)}/${Math.round(box.height)} → ${Math.round(after.y)}/${Math.round(after.height)})`);
    notes.push(`${at}: top ${h.top}, name ${h.h1}, "${pr}" / "${st}"`);
    await ctx.close();
  }
  for (const issue of issues) {
    problems++;
    console.log(`  PROBLEM: ${issue}`);
  }
  if (!issues.length) ok(`${notes.join('; ')}; tabs 48 high, the current one ink 600 on a 2px accent rule, the only accent in the header; → moves focus, Enter selects, the header stays put`);
}

// NOTHING LEAVES THE MACHINE: every call the site makes, answered from the
// fixtures. A function so the reduced-motion and touch contexts (jobs 8.4,
// 8.5) are answered exactly as the main one is.
async function installFixtureRoutes(ctx: BrowserContext) {
  // NOTHING LEAVES THE MACHINE. Every call the site makes is answered here.
  await ctx.route('**/api/company*', async (route) => {
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
  await ctx.route('**/api/news*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"items":[]}' })
  );
  await ctx.route('**/api/search*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"results":[]}' })
  );
  await ctx.route('**/api/comps*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"comparables":[]}' })
  );
  // The index a beta is measured against, answered from the fixture: a series
  // built so the regression's answer is known before it runs.
  await ctx.route('**/api/marketIndex*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(paperIndexSeries()),
    })
  );
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

  await installFixtureRoutes(context);

  // ONE SECTION AT A TIME, FOR PROVING A CHECK FAILS. `DASHBOARD_ONLY=hero,webgl
  // npm run verify:dashboard` runs just those self-contained sections and
  // stops, so a deliberate break is reported by the check it was made for
  // rather than by whichever earlier journey it happened to slow down. The
  // full run, which is the one a commit quotes, takes no such variable.
  const ONLY: Record<string, () => Promise<void>> = {
    motion: () => checkReducedMotion(browser as Browser),
    focus: () => checkFocusAndTargets(browser as Browser),
    bridge: () => checkBridgeWorker(browser as Browser),
    features: () => checkFeatureGate(browser as Browser),
    hero: () => checkHeroField(browser as Browser),
    webgl: () => checkOneWebglContext(browser as Browser),
    accent: () => checkLandingAccentBudget(browser as Browser),
    lowend: () => checkPhoneAndLowEnd(browser as Browser),
    notes: () => checkNotesAddresses(browser as Browser),
    notfound: () => checkInAppNotFound(browser as Browser),
    header: () => checkHeaderAndMenu(browser as Browser),
    loading: () => checkLoadingScreen(browser as Browser),
    company: () => checkCompanyHeader(browser as Browser),
  };
  const only = (process.env.DASHBOARD_ONLY || '').split(',').map((x) => x.trim()).filter(Boolean);
  if (only.length) {
    for (const name of only) {
      if (!ONLY[name]) throw new Error(`DASHBOARD_ONLY names "${name}"; the sections are ${Object.keys(ONLY).join(', ')}`);
      await ONLY[name]();
    }
    console.log(`\n(DASHBOARD_ONLY=${only.join(',')}: only these sections ran)`);
    throw Object.assign(new Error('__only__'), { only: true });
  }

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
  await openCurated(page, 'AAPL');
  // AFTER THE FIRST REAL NAVIGATION, not before it. `readContrast` evaluates on
  // whatever is loaded and never navigates, so a font check placed above it
  // measured an about:blank page and reported no stylesheet at all — which is
  // a check that fails for the wrong reason, and would have gone on failing
  // after the fix.
  await checkFontRequests(page, requests);
  // THE LANDING PAGE, LOADED, at the desktop width and at a phone's.
  //
  // Until 2026-11-04 the contrast read for "the landing page" ran here, on
  // `page`, before the first navigation — so it measured about:blank and could
  // not fail. It now opens the landing page in a tab of its own (so the
  // journey in `page` and the font check's request count are untouched),
  // scrolls it top to bottom so every section that fades in on scroll has
  // faded in, and refuses to call a page with almost no text on it measured.
  {
    const landing = await context.newPage();
    for (const width of [1400, 390]) {
      await landing.setViewportSize({ width, height: width > 600 ? 1000 : 844 });
      await landing.goto(BASE, { waitUntil: 'networkidle' });
      await revealWholePage(landing);
      const where = width > 600 ? LANDING_TYPE_SCREEN : `${LANDING_TYPE_SCREEN}, at 390`;
      await readContrast(landing, where, { minimumText: LANDING_MINIMUM_TEXT });
    }
    await landing.close();
  }
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
  await checkSharedRightEdge(page, 'the Financials tab', '[data-financials]', 'thead th[scope="col"]:not(:first-child)', 'td [data-cell]');
  await page.locator(`[data-cell]`).first().evaluate((el: any) => el.click());
  await page.waitForTimeout(300);
  await readContrast(page, 'the evidence behind a figure');
  await page.keyboard.press(`Escape`);

  // 4b. HOW OLD THE FIGURES ARE, on both screens that show them.
  await checkStaleFigures(page);

  // 4c. THE SCREENER, which is a screen of its own at its own address.
  await checkScreenerOnScreen(page, context);
  await readContrast(page, 'the screener');

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
  await checkReducedMotion(browser);
  await checkFocusAndTargets(browser);
  await checkBridgeWorker(browser);
  await checkFeatureGate(browser);
  await checkHeroField(browser);
  await checkOneWebglContext(browser);
  await checkLandingAccentBudget(browser);
  await checkPhoneAndLowEnd(browser);
  await checkNotesAddresses(browser);
  await checkInAppNotFound(browser);
  await checkHeaderAndMenu(browser);
  await checkLoadingScreen(browser);
  await checkCompanyHeader(browser);
  reportContrast();
  reportType();
} catch (error: any) {
  if (!error?.only) {
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
