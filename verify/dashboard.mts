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
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: /value a listed company/i }).first().click();
  // The screen animates in, and an input filled while it is still arriving is
  // filled and then thrown away with the frame it was in. So the value is put
  // in and read back before anything is sent.
  const box = page.locator('input:visible').first();
  await box.waitFor({ state: 'visible', timeout: 30_000 });
  for (let attempt = 0; attempt < 5; attempt++) {
    await page.waitForTimeout(800);
    await box.fill(ticker);
    if ((await box.inputValue()) === ticker) break;
  }
  // The button, not the Enter key: it is disabled until the field holds
  // something, so clicking it proves the field's own state arrived, which
  // typing into a screen that is still animating in does not.
  await page.getByRole('button', { name: /^build model$/i }).first().click({ timeout: 30_000 });
}

/** A curated company: no fetch, straight to the questions. */
async function openCurated(page: Page, ticker: string) {
  await search(page, ticker);
  await page.getByRole('button', { name: /skip and build the model/i }).click({ timeout: 60_000 });
  await page.getByText(/how it was calculated/i).first().waitFor({ timeout: 60_000 });
}

/** A fetched company: the figures screen, then the questions. */
async function openFetched(page: Page, ticker: string) {
  await search(page, ticker);
  // The figures screen shows the filings before anything is modelled, and the
  // site holds it for a few seconds on purpose, so this waits rather than races.
  await page.getByRole('button', { name: /^build the model$/i }).click({ timeout: 90_000 });
  await page.getByRole('button', { name: /skip and build the model/i }).click({ timeout: 90_000 });
  await page.getByText(/how it was calculated/i).first().waitFor({ timeout: 60_000 });
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
  await page.getByRole('button', { name: /^run$/i }).first().click({ timeout: 30_000 });
  await page.getByText(new RegExp(firstSentence.slice(0, 40).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')).waitFor({ timeout: 60_000 });
  const batchText = (await page.textContent('body')) || '';
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
  await openCurated(page, 'AAPL');
  await checkValued(page, 'Apple, the curated model', AAPL_SOURCE, apple.currencySymbol || '$');

  // 2. A derived model, built through the fetch, the figures and the
  //    questions, the way a reader reaches one.
  const paper: any = buildCompanyFrom(paperPayload('valued'));
  await openFetched(page, PAPER_TICKER);
  await checkValued(page, `${PAPER_NAME}, derived`, paper.modelData, paper.currencySymbol || '$');

  // 3. The same company, refused.
  const refusedPayload = { ...paperPayload('refused'), ticker: REFUSED_TICKER };
  const refused: any = buildCompanyFrom(refusedPayload);
  await openFetched(page, REFUSED_TICKER);
  await checkRefused(page, refused.modelData, refused, refused.currencySymbol || '$');

  // 4. A build slow enough to read: the loading screen must carry a note, and
  //    must not hold the same one for the whole wait.
  await checkSlowBuild(context, page);
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
