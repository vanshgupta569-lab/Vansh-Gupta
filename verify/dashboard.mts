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

const { paperPayload, PAPER_TICKER, PAPER_NAME } = await import(
  `file:///${REPO}/verify/fixtures/paperCompany.mts`
);
const { buildCompanyFrom } = await import(`file:///${REPO}/src/data/autoCompany.ts`);
const { COMPANIES_DATA } = await import(`file:///${REPO}/src/data/companies.ts`);
// The curated model the dashboard itself renders for Apple. The record in
// COMPANIES_DATA carries the screen furniture; this is the model behind it.
const AAPL_SOURCE: any = (await import(`file:///${REPO}/src/data/AAPL.js`)).default;
const { buildModel, buildDCF, computeWACC } = await import(`file:///${REPO}/src/engine/model.js`);
const { buildWorkbook } = await import(`file:///${REPO}/src/data/excelExport.ts`);

// The refused company is reached under its own ticker, so one intercept can
// answer for both without the browser knowing which is which.
const REFUSED_TICKER = 'PAPERX';

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

async function openFetched(page: Page, ticker: string) {
  await search(page, ticker);
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
    const sentence = `the two methods are ${(spread * 100).toFixed(0)}% apart`;
    if (headline?.includes(sentence)) ok(sentence);
    else fail('the spread between the two methods', sentence, '(not on the page)');
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
// screen nothing rendered checked, because in a fast harness it is gone before
// anything can look at it. So the fetch is held open on purpose and the overlay
// is read while it waits.
//
// Two things are asserted. A note is shown at all — one of the fifty-three in
// the data file, with its belief, its correction and its mechanism, not a
// truncated fragment. And it CHANGES: a reader who waits twenty seconds must not
// spend twenty seconds on one sentence, which is the failure this exists to
// prevent rather than a nicety.
async function checkSlowBuild(context: BrowserContext, page: Page) {
  console.log('\n=== the loading screen, on a slow build ===');
  const { DID_YOU_KNOW } = await import(`file:///${REPO}/src/data/didYouKnow.ts`);
  const facts: string[] = (DID_YOU_KNOW as any[]).map((n) => n.fact);

  // Held for longer than two turns of the note so a second one is certain,
  // then released; the route is put back afterwards so nothing later inherits
  // a slow fetch.
  const HOLD_MS = 17_000;
  await context.unroute('**/api/company*');
  await context.route('**/api/company*', async (route) => {
    await new Promise((r) => setTimeout(r, HOLD_MS));
    const url = new URL(route.request().url());
    const ticker = (url.searchParams.get('ticker') || '').toUpperCase();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...paperPayload('valued'), ticker }),
    });
  });

  const overlay = page.getByRole('status').filter({ hasText: /building the model/i }).first();
  const shown = async (): Promise<string | null> => {
    const text = (await overlay.textContent().catch(() => null)) || '';
    return facts.find((f) => text.includes(f)) ?? null;
  };

  // Deliberately NOT awaited: the click starts a fetch that will not answer for
  // seventeen seconds, and the overlay is read while it is outstanding.
  const started = search(page, PAPER_TICKER);
  await overlay.waitFor({ state: 'visible', timeout: 30_000 });

  const seen: string[] = [];
  for (let waited = 0; waited < HOLD_MS - 1000; waited += 1000) {
    const fact = await shown();
    if (fact && seen[seen.length - 1] !== fact) seen.push(fact);
    await page.waitForTimeout(1000);
  }
  await started.catch(() => {});

  if (!seen.length) {
    fail('a note on the loading screen', 'one of the entries in didYouKnow.ts', 'none of them');
  } else if (seen.length < 2) {
    fail(
      'the note changing during a slow build',
      `at least 2 notes across ${Math.round(HOLD_MS / 1000)} seconds`,
      `1: "${seen[0].slice(0, 60)}…" held the whole wait`
    );
  } else {
    ok(`${seen.length} notes over ${Math.round(HOLD_MS / 1000)} seconds, the first "${seen[0].slice(0, 54)}…"`);
    ok('a slow build does not leave one note on screen for the whole wait');
  }

  // Put the instant fixture back for anything that runs after this.
  await context.unroute('**/api/company*');
  await context.route('**/api/company*', async (route) => {
    const url = new URL(route.request().url());
    const ticker = (url.searchParams.get('ticker') || '').toUpperCase();
    if (ticker !== PAPER_TICKER && ticker !== REFUSED_TICKER) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: `No fixture for ${ticker}` }) });
      return;
    }
    const payload = paperPayload(ticker === REFUSED_TICKER ? 'refused' : 'valued');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...payload, ticker }) });
  });
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
    if (ticker !== PAPER_TICKER && ticker !== REFUSED_TICKER) {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: `No fixture for ${ticker}` }),
      });
      return;
    }
    const payload = paperPayload(ticker === REFUSED_TICKER ? 'refused' : 'valued');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...payload, ticker }),
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
  const page = await context.newPage();
  page.on('pageerror', (error) => {
    problems++;
    console.log(`  PROBLEM: the page threw — ${String(error).slice(0, 160)}`);
  });

  // 1. The curated model, which the site renders without fetching anything.
  const apple: any = (COMPANIES_DATA as any).AAPL;
  await readContrast(page, 'the landing page');
  await openCurated(page, 'AAPL');
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

  // 3. The same company, refused.
  const refusedPayload = { ...paperPayload('refused'), ticker: REFUSED_TICKER };
  const refused: any = buildCompanyFrom(refusedPayload);
  await openFetched(page, REFUSED_TICKER);
  await checkRefused(page, refused.modelData, refused, refused.currencySymbol || '$');
  await readContrast(page, 'a refused company');

  // 4. A build slow enough to read: the loading screen must carry a note, and
  //    must not hold the same one for the whole wait.
  await checkSlowBuild(context, page);

  // 5. Nothing anywhere on any of those screens is below WCAG AA.
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
