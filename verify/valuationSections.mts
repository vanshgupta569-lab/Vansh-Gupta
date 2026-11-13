// FILE: verify/valuationSections.mts
//
//   npm run verify:sections
//
// THE VALUATION SCREEN HAS PARTS A READER CAN TELL APART (2026-11-13).
//
// It had grown into a column of panels that all looked alike: the same
// border, the same ground, no heading of their own, and nothing to say where
// one ended and the next began. Two of the three valuation approaches were
// not on the screen at all — reachable only through a full-screen overlay
// behind a row of buttons headed "For the nerds" — and the sticky bar at the
// top listed five sections written out by hand while nine were rendering.
//
// STUDIO_SPEC §4.1 sets the order and the shape. This checks both, at 1440
// and 390:
//
//   1. EVERY SECTION IS A PANEL WITH A HEADING, and no two share an id.
//   2. THEY ARE IN THE SPEC'S ORDER, read off the rendered page rather than
//      off the source, because the source can be in one order and the screen
//      in another whenever a wrapper reorders its children.
//   3. 24px BETWEEN THEM. The spec names the figure, so the figure is checked.
//   4. THE LONG ONES ARE CLOSED TO A HEADLINE, and open on demand. A closed
//      section always SAYS what it holds: on a site whose claim is that every
//      figure can be traced, a collapsed heading with nothing under it reads
//      as an absence rather than as a fold.
//   5. THE CONTENTS LIST REACHES EVERY SECTION — every entry resolves to a
//      section that is on the page, and every section on the page has an
//      entry. A contents row that scrolls nowhere is worse than no contents.
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..').split(path.sep).join('/');
const OUT = path.join(HERE, 'out');
const PORT = 7700 + Math.floor(Math.random() * 200);
const SHOTS = process.argv.includes('--shots');

/** STUDIO_SPEC §4.1, in order. A section absent for this company is skipped. */
const SPEC_ORDER = ['football', 'implied', 'working', 'market', 'asset', 'terminal', 'constraints'];
/** The spec's gap between panels. */
const GAP_PX = 24;
/** The long ones, which collapse. */
const COLLAPSIBLE = ['working', 'market', 'asset', 'constraints'];

let problems = 0;
const say = (line: string) => console.log(`  ${line}`);
const fail = (line: string) => {
  problems++;
  console.log(`  PROBLEM: ${line}`);
};

fs.mkdirSync(OUT, { recursive: true });

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
    if (/ready in|Local:/i.test(String(d))) {
      clearTimeout(t);
      resolve();
    }
  });
  child.on('error', reject);
});
const BASE = `http://127.0.0.1:${PORT}`;

console.log('\n=== the valuation screen has parts a reader can tell apart ===');
const browser = await chromium.launch({ headless: true });

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

    // ---- 1. PANELS WITH HEADINGS, AND UNIQUE IDS ----------------------
    const sections: any[] = await page.evaluate(
      `Array.from(document.querySelectorAll('[data-valuation-section]')).map((el) => {
        const r = el.getBoundingClientRect();
        return {
          id: el.getAttribute('data-valuation-section'),
          open: el.getAttribute('data-section-open') === 'true',
          title: (el.querySelector('[data-section-title]')?.textContent || '').trim(),
          headline: (el.querySelector('[data-section-headline]')?.textContent || '').trim(),
          hasBody: !!el.querySelector('[data-section-body]'),
          hasToggle: !!el.querySelector('[data-section-toggle]'),
          top: Math.round(r.top + window.scrollY),
          bottom: Math.round(r.bottom + window.scrollY),
        };
      })`
    );
    if (sections.length < 4) {
      fail(`${width}: only ${sections.length} sections on the valuation screen`);
      if (SHOTS) await page.screenshot({ path: path.join(OUT, `sections-missing-${width}.png`), fullPage: true }).catch(() => {});
      continue;
    }
    say(`${width}: ${sections.length} sections — ${sections.map((s) => s.id).join(', ')}`);

    // The screen AS IT ARRIVES, before anything here opens a section.
    if (SHOTS) {
      await page.evaluate('window.scrollTo(0, 0)');
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(OUT, `sections-closed-${width}.png`) }).catch(() => {});
      const foot = sections[sections.length - 1];
      await page.evaluate(`window.scrollTo(0, ${Math.max(0, foot.top - 160)})`);
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(OUT, `sections-foot-${width}.png`) }).catch(() => {});
      await page.evaluate('window.scrollTo(0, 0)');
      await page.waitForTimeout(300);
    }

    const ids = sections.map((s) => s.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (dupes.length) fail(`${width}: two sections share the id ${[...new Set(dupes)].join(', ')}`);

    for (const sec of sections) {
      if (!sec.title) fail(`${width}: the section "${sec.id}" has no heading`);
      else if (sec.title === sec.title.toUpperCase() && /[A-Z]{4}/.test(sec.title)) {
        fail(`${width}: the heading "${sec.title}" is set in capitals, not sentence case`);
      }
    }

    // ---- 2. THE SPEC'S ORDER ------------------------------------------
    //
    // Read off the RENDERED page: the source can be in one order and the
    // screen in another whenever a wrapper reorders its children.
    const byTop = [...sections].sort((a, b) => a.top - b.top).map((s) => s.id);
    const expected = SPEC_ORDER.filter((id) => ids.includes(id));
    const actual = byTop.filter((id) => expected.includes(id));
    if (actual.join(' ') !== expected.join(' ')) {
      fail(`${width}: the sections run ${actual.join(' → ')}; the spec sets ${expected.join(' → ')}`);
    } else {
      say(`${width}: in the spec's order — ${actual.join(' → ')}`);
    }

    // ---- 3. 24px BETWEEN PANELS ---------------------------------------
    const ordered = [...sections].sort((a, b) => a.top - b.top);
    let worst: { pair: string; gap: number } | null = null;
    for (let i = 1; i < ordered.length; i++) {
      const gap = ordered[i].top - ordered[i - 1].bottom;
      if (!worst || Math.abs(gap - GAP_PX) > Math.abs(worst.gap - GAP_PX)) {
        worst = { pair: `${ordered[i - 1].id}/${ordered[i].id}`, gap };
      }
    }
    if (!worst) {
      say(`${width}: one section, so there is no gap to measure`);
    } else if (Math.abs(worst.gap - GAP_PX) > 1) {
      fail(`${width}: ${worst.gap}px between ${worst.pair}, and the spec sets ${GAP_PX}px`);
    } else {
      say(`${width}: ${GAP_PX}px between every pair of panels (worst ${worst.pair} at ${worst.gap}px)`);
    }

    // ---- 4. THE LONG ONES ARE CLOSED, AND SAY WHAT THEY HOLD ----------
    for (const id of COLLAPSIBLE) {
      const sec = sections.find((s) => s.id === id);
      if (!sec) continue;
      if (sec.open) {
        fail(`${width}: "${sec.title}" is open on arrival; the long sections collapse to their headline`);
      } else if (!sec.headline) {
        fail(`${width}: "${sec.title}" is closed with nothing under it — a fold that reads as an absence`);
      } else if (!sec.hasToggle) {
        fail(`${width}: "${sec.title}" is closed and offers no way to open it`);
      } else if (sec.hasBody) {
        fail(`${width}: "${sec.title}" is closed but its body is still mounted`);
      }
    }
    const closed = sections.filter((s) => !s.open);
    say(`${width}: ${closed.length} sections closed to a headline — ${closed.map((s) => s.id).join(', ')}`);

    // AND THEY OPEN. A fold nobody can unfold is just a deletion.
    const first = closed[0];
    if (first) {
      await page.click(`[data-section-toggle="${first.id}"]`, { timeout: 5_000 }).catch(() => {});
      await page.waitForTimeout(500);
      const nowOpen = await page.evaluate(
        `document.querySelector('[data-valuation-section="${first.id}"]')?.getAttribute('data-section-open') === 'true'`
      );
      const body = await page.locator(`[data-valuation-section="${first.id}"] [data-section-body]`).count();
      if (!nowOpen || !body) fail(`${width}: "${first.id}" did not open when its control was pressed`);
      else say(`${width}: "${first.id}" opens on demand`);
    }

    // ---- 5. THE CONTENTS LIST REACHES EVERY SECTION -------------------
    const contents: string[] = await page.evaluate(
      `Array.from(document.querySelectorAll('[data-contents-link]')).map((e) => e.getAttribute('data-contents-link'))`
    );
    if (!contents.length) {
      fail(`${width}: there is no in-page contents list`);
    } else {
      const onPage: string[] = await page.evaluate(
        `Array.from(document.querySelectorAll('[id]')).map((e) => e.id)`
      );
      const nowhere = contents.filter((id) => !onPage.includes(id));
      if (nowhere.length) fail(`${width}: the contents list offers ${nowhere.join(', ')}, which ${nowhere.length === 1 ? 'is' : 'are'} not on the page`);
      const unlisted = ids.filter((id) => !contents.includes(id));
      if (unlisted.length) fail(`${width}: ${unlisted.join(', ')} ${unlisted.length === 1 ? 'is a section' : 'are sections'} with no contents entry`);
      if (!nowhere.length && !unlisted.length) {
        say(`${width}: the contents list carries all ${contents.length} entries, each reaching a section`);
      }
    }

    // STICKY ON DESKTOP, so a reader deep in the full working can still move.
    if (width > 500) {
      const stuck = await page.evaluate(`(() => {
        const nav = document.querySelector('[data-valuation-contents]');
        if (!nav) return null;
        let el = nav;
        while (el) {
          if (getComputedStyle(el).position === 'sticky') return true;
          el = el.parentElement;
        }
        return false;
      })()`);
      if (stuck === false) fail(`${width}: the contents list does not stay with the reader on desktop`);
      else if (stuck) say(`${width}: the contents list is sticky`);
    }

    if (SHOTS) {
      await page.screenshot({ path: path.join(OUT, `sections-${width}.png`), fullPage: false }).catch(() => {});
    }
  } catch (err) {
    fail(`${width}: ${String(err).slice(0, 120)}`);
  } finally {
    await ctx.close();
  }
}

await browser.close();
child.kill();
console.log(`\nTOTAL PROBLEMS IN THE VALUATION SECTIONS: ${problems}`);
process.exit(0);
