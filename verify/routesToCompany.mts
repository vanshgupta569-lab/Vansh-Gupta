// FILE: verify/routesToCompany.mts
//
//   npm run verify:open
//
// EVERY WAY OF CHOOSING A COMPANY OPENS THE COMPANY (2026-11-12).
//
// There are four ways in — the ⌘K palette, the search screen, the menu, and
// the directory grid — and they used to disagree. A company already in hand
// (the curated Apple file, or one fetched earlier in the session) went
// straight to the qualitative questions: no address, no chart, no profile, and
// ten judgements asked of a reader who had not yet seen the company. A company
// that had to be fetched went to `/company/<ticker>/overview`. So where a
// reader landed depended on whether the model happened to be in memory, which
// is not a distinction anyone can see.
//
// Nothing in the engine could catch that, because nothing about it is
// arithmetic. It is four buttons and where they go, so this drives all four
// and asserts the address and the screen.
//
// AAPL ON PURPOSE: it is the curated file, the one that took the wrong branch.
// A check written on a fetched ticker would have passed throughout.
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..').split(path.sep).join('/');
const OUT = path.join(HERE, 'out');
const PORT = 5400 + Math.floor(Math.random() * 200);
const TICKER = 'AAPL';
const SHOTS = process.argv.includes('--shots');

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

const BASE = `http://127.0.0.1:${PORT}`;
const browser = await chromium.launch({ headless: true });

console.log('\n=== every way of choosing a company opens the company ===');

/** Where did we end up, and does it look like the Overview tab? */
async function landed(page: Page) {
  await page.waitForTimeout(1600);
  const url = page.url().replace(BASE, '') || '/';
  const onOverview = await page
    .evaluate(`!!document.querySelector('[role="tab"][aria-selected="true"]')`)
    .catch(() => false);
  const tab = await page
    .evaluate(`document.querySelector('[role="tab"][aria-selected="true"]')?.textContent || ''`)
    .catch(() => '');
  const questions = await page
    .evaluate(`!!Array.from(document.querySelectorAll('button')).find((b) => /skip and build the model/i.test(b.textContent || ''))`)
    .catch(() => false);
  return { url, onOverview, tab: String(tab).trim(), questions };
}

async function check(width: number, name: string, drive: (page: Page) => Promise<void>) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 900 } });
  // THE CATCH-ALL FIRST, THEN THE ONE THAT MATTERS. Playwright matches the
  // LAST route registered, so a `**/api/**` added after `**/api/search*`
  // swallows it — which it did, and the palette answered "No company matches
  // AAPL" while the app was perfectly fine.
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  // The company itself is real: AAPL is curated and needs no network.
  await ctx.route('**/api/search*', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ results: [{ ticker: TICKER, name: 'Apple Inc.', exchange: 'NASDAQ' }] }),
    })
  );
  const page = await ctx.newPage();
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    await drive(page);
    const where = await landed(page);
    if (SHOTS) {
      await page
        .screenshot({ path: path.join(OUT, `open-${width}-${name.replace(/[^a-z]+/gi, '-')}.png`) })
        .catch(() => {});
    }
    const want = `/company/${TICKER}/overview`;
    if (where.questions) {
      fail(`${name} at ${width}: landed on the qualitative questions, not the company page`);
    } else if (where.url !== want) {
      fail(`${name} at ${width}: landed at ${where.url}, not ${want}`);
    } else if (!where.onOverview || !/overview/i.test(where.tab)) {
      fail(`${name} at ${width}: the address is right and the selected tab is "${where.tab || 'none'}"`);
    } else {
      say(`${name} at ${width}: ${where.url}, Overview selected`);
    }
  } catch (err) {
    fail(`${name} at ${width}: ${String(err).slice(0, 80)}`);
  } finally {
    await ctx.close();
  }
}

for (const width of [1440, 390]) {
  // ---- 1. THE PALETTE (Ctrl K) ----------------------------------------
  await check(width, 'the palette', async (page) => {
    await page.keyboard.press('Control+KeyK');
    await page.waitForTimeout(700);
    await page.keyboard.type(TICKER, { delay: 40 });
    await page.waitForTimeout(900);
    await page.keyboard.press('Enter');
  });

  // ---- 2. THE SEARCH SCREEN -------------------------------------------
  await check(width, 'the search screen', async (page) => {
    const enter = page.getByRole('button', { name: /value a listed company/i }).first();
    for (let i = 0; i < 4; i++) {
      if (await page.getByPlaceholder(/Apple, Reliance/i).isVisible().catch(() => false)) break;
      await enter.click({ timeout: 3_000 }).catch(() => {});
      await page.waitForTimeout(600);
    }
    await page.getByPlaceholder(/Apple, Reliance/i).fill(TICKER);
    await page.waitForTimeout(800);
    await page
      .getByRole('button', { name: /^build model$/i })
      .locator('visible=true')
      .first()
      .click({ timeout: 10_000 })
      .catch(() => {});
  });

  // ---- 3. THE MENU ------------------------------------------------------
  //
  // The menu's own job is to REACH the palette — "Search a company" is a row
  // that opens it, not a company picker of its own. So this asserts the
  // palette opens from the menu at both widths, and then drives the palette,
  // which the arm above has already shown lands on the company.
  await check(width, 'the menu', async (page) => {
    const menu = page.getByRole('button', { name: /^menu$/i }).first();
    if (await menu.isVisible().catch(() => false)) {
      await menu.click({ timeout: 6_000 }).catch(() => {});
    } else {
      await page
        .getByRole('button', { name: /^companies$/i })
        .first()
        .click({ timeout: 6_000 })
        .catch(() => {});
    }
    await page.waitForTimeout(700);
    // THE PHONE SHEET OPENS WITH ITS SECTIONS CLOSED, so "Search a company"
    // does not exist yet — a reader taps Companies first. The desktop panel
    // shows its rows at once, so this expands only when it needs to.
    const rowsNow = await page
      .locator('[data-menu-link]')
      .filter({ hasText: /^search a company/i })
      .locator('visible=true')
      .count()
      .catch(() => 0);
    if (!rowsNow) {
      await page
        .getByRole('button', { name: /^companies$/i })
        .locator('visible=true')
        .first()
        .click({ timeout: 6_000 })
        .catch(() => {});
      await page.waitForTimeout(600);
    }
    // VISIBLE ONLY. The desktop panel's rows stay in the DOM at phone width,
    // so an unfiltered match can pick a hidden copy and click nothing at all —
    // which is what made this arm report a working menu as broken.
    await page
      .getByRole('button', { name: /^search a company/i })
      .locator('visible=true')
      .first()
      .click({ timeout: 8_000 })
      .catch(() => {});
    const field = page.locator('[role="dialog"] input, input[type="search"]').first();
    const opened = await field
      .waitFor({ state: 'visible', timeout: 8_000 })
      .then(() => true)
      .catch(() => false);
    if (!opened) {
      fail(`the menu at ${width}: "Search a company" did not open the palette`);
      return;
    }
    await field.fill(TICKER);
    await page.waitForTimeout(900);
    await page.keyboard.press('Enter');
  });

  // ---- 4. THE DIRECTORY GRID -------------------------------------------
  await check(width, 'the directory', async (page) => {
    const enter = page.getByRole('button', { name: /value a listed company/i }).first();
    for (let i = 0; i < 4; i++) {
      if (await page.getByPlaceholder(/Apple, Reliance/i).isVisible().catch(() => false)) break;
      await enter.click({ timeout: 3_000 }).catch(() => {});
      await page.waitForTimeout(600);
    }
    // THE SHELF OF HAND-BUILT MODELS IS BELOW THE FOLD. A click on a card
    // that has never been scrolled to lands on whatever is at those
    // coordinates, which is how this reported the directory broken while the
    // directory was fine.
    const card = page.getByRole('button', { name: /open apple/i }).first();
    await card.scrollIntoViewIfNeeded({ timeout: 8_000 }).catch(() => {});
    await page.waitForTimeout(500);
    await card.click({ timeout: 8_000 }).catch(() => {});
  });
}

// ---- EVERY FIELD A READER CAN TYPE IN HAS A NAME (2026-11-14) ----------
//
// The search screen's one input had no <label>, no aria-label and no id:
// a placeholder and nothing else. A screen reader announced an unlabelled
// text field, and a sighted reader lost the only description of it the
// moment they began typing. LANDING_SPEC checklist 34 asks for visible
// labels, and a placeholder is not one -- it is examples.
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  const page = await ctx.newPage();
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: /value a listed company/i }).first().click({ timeout: 8_000 }).catch(() => {});
    await page.waitForTimeout(2200);
    const unnamed: any[] = await page.evaluate(`(() => {
      const out = [];
      for (const el of document.querySelectorAll('input[type="text"], input:not([type]), input[type="search"], textarea')) {
        const r = el.getBoundingClientRect();
        if (r.width < 8 || r.height < 8) continue;
        const byLabel = el.id ? document.querySelector('label[for="' + el.id + '"]') : null;
        const named = !!(byLabel || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.closest('label'));
        if (!named) out.push({ ph: el.getAttribute('placeholder') || '(no placeholder)', id: el.id || '(no id)' });
      }
      return out;
    })()`);
    if (unnamed.length) {
      problems++;
      console.log(
        `  PROBLEM: ${unnamed.length} field(s) on the search screen have no name a screen reader can read — ` +
          unnamed.map((f: any) => `placeholder "${f.ph}"`).join(', ')
      );
    } else {
      console.log('  every field on the search screen carries a name');
    }
  } catch (err) {
    problems++;
    console.log(`  PROBLEM: the field check could not run — ${String(err).slice(0, 90)}`);
  } finally {
    await ctx.close();
  }
}

await browser.close();
child.kill();
console.log(`\nTOTAL PROBLEMS IN THE ROUTES INTO A COMPANY: ${problems}`);
process.exit(0);
