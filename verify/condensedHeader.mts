// FILE: verify/condensedHeader.mts
//
//   npm run verify:condensed
//
// THE SLIM BAR CARRIES THE NAME (2026-11-12).
//
// After 80px of scrolling the 64px header slides away and a 48px bar comes
// down. It carried a bare red square. On its own that is a shape, not a mark:
// the square is the full stop of a wordmark and says nothing without the word
// in front of it, so a reader who had scrolled past the header had no sign of
// whose site this is — which is the one thing a persistent bar exists to say.
//
// Four things, at 1440 and 390: the bar appears on scroll, it spells the name,
// it still offers Search and Menu, and the whole of it fits inside 48px
// without the name wrapping or being clipped.
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..').split(path.sep).join('/');
const OUT = path.join(HERE, 'out');
const PORT = 7100 + Math.floor(Math.random() * 200);
const SHOTS = process.argv.includes('--shots');
const BAR_HEIGHT = 48;

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

console.log('\n=== the slim bar on scroll carries the name ===');
const browser = await chromium.launch({ headless: true });

for (const width of [1440, 390]) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 900 } });
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  const page = await ctx.newPage();
  try {
    await page.goto(`http://127.0.0.1:${PORT}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1400);

    // Past the 80px the bar waits for, and settled.
    await page.evaluate('window.scrollTo(0, 600)');
    await page.waitForTimeout(1200);

    const condensed = await page.evaluate(
      `document.querySelector('[data-condensed]')?.getAttribute('data-condensed') === 'true'`
    );
    if (!condensed) {
      fail(`${width}: the slim bar has not come down after 600px of scrolling`);
      continue;
    }

    // ---- THE NAME ------------------------------------------------------
    const mark: any = await page.evaluate(`(() => {
      const el = document.querySelector('[data-condensed-wordmark]');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        text: (el.textContent || '').replace(/\\s+/g, ' ').trim(),
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        height: Math.round(r.height),
        width: Math.round(r.width),
        shown: !!(el.offsetWidth || el.offsetHeight),
      };
    })()`);
    if (!mark || !mark.shown) {
      fail(`${width}: the slim bar has no wordmark — a red square on its own is a shape, not a mark`);
    } else if (!/marginalia/i.test(mark.text)) {
      fail(`${width}: the slim bar's mark reads "${mark.text}" and does not spell the name`);
    } else {
      say(`${width}: the slim bar reads "${mark.text}", ${mark.width}x${mark.height}px`);
      // IT HAS TO FIT. A name that overflows a 48px bar is worse than a square.
      if (mark.height > BAR_HEIGHT) {
        fail(`${width}: the wordmark is ${mark.height}px tall in a ${BAR_HEIGHT}px bar`);
      }
      if (mark.top < 0 || mark.bottom > BAR_HEIGHT + 2) {
        fail(`${width}: the wordmark sits ${mark.top}–${mark.bottom}px against a bar of ${BAR_HEIGHT}px`);
      }
    }

    // ---- SEARCH AND MENU ARE STILL THERE --------------------------------
    for (const [what, name] of [
      ['Search', /search companies/i],
      ['Menu', /^menu$|close the menu/i],
    ] as [string, RegExp][]) {
      const found = await page
        .getByRole('button', { name })
        .locator('visible=true')
        .count()
        .catch(() => 0);
      if (!found) fail(`${width}: the slim bar offers no ${what}`);
      else say(`${width}: ${what} is on the bar`);
    }

    // ---- THE BAR'S TWO ICON SQUARES ARE THE SAME SIZE -----------------
    //
    // Below 640px the search square was 36x36 beside a 44x44 menu button:
    // two siblings in one bar at visibly different sizes, the smaller of
    // them under the 44px touch target. The `pointer-coarse` variant made
    // it 44 on a real phone, so it was worst in the case nobody tests --
    // a narrow window with a mouse.
    await page.evaluate('window.scrollTo(0, 0)');
    await page.waitForTimeout(700);
    // WITHIN ONE BAR, NOT ACROSS BOTH. The condensed bar is in the DOM
    // alongside the resting header, so a page-wide sweep compares a resting
    // 44px square against a condensed 36px one and calls the pair a fault.
    // The question is whether two buttons SIDE BY SIDE match.
    const squares: any[] = await page.evaluate(
      `Array.from(document.querySelectorAll('header button[aria-label]'))
        .filter((el) => !el.closest('[data-header-condensed]'))
        .map((el) => {
          const r = el.getBoundingClientRect();
          return { label: el.getAttribute('aria-label'), w: Math.round(r.width), h: Math.round(r.height) };
        })
        .filter((b) => b.w > 0 && b.w < 80 && b.h > 0)`
    );
    if (squares.length >= 2) {
      const heights = [...new Set(squares.map((b: any) => b.h))];
      if (heights.length > 1) {
        fail(
          `${width}: the bar's icon buttons are different heights — ` +
            squares.map((b: any) => `${b.label} ${b.w}x${b.h}`).join(', ')
        );
      } else {
        say(`${width}: ${squares.length} icon buttons, all ${heights[0]}px — ${squares.map((b: any) => b.label).join(', ')}`);
      }
    }

    // ---- THE SHEET IS AS TALL AS WHAT IS IN IT ------------------------
    //
    // It was pinned `top-16 bottom-0`, so three collapsed headings and one
    // switch reserved the whole screen. Measured against the viewport: a
    // sheet holding four rows should not be most of a phone.
    if (width < 500) {
      await page.getByRole('button', { name: /^menu$/i }).first().click({ timeout: 5_000 }).catch(() => {});
      await page.waitForTimeout(700);
      const sheet: any = await page.evaluate(`(() => {
        const el = document.querySelector('[data-menu-sheet]');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        let content = 0;
        for (const kid of el.children) content += kid.getBoundingClientRect().height;
        return { h: Math.round(r.height), content: Math.round(content), vh: window.innerHeight };
      })()`);
      if (!sheet) {
        fail(`${width}: the menu sheet did not open`);
      } else {
        // Closed, the sheet should sit near its content rather than near the
        // viewport. 80px of slack covers padding and the border.
        const slack = sheet.h - sheet.content;
        if (slack > 80) {
          fail(
            `${width}: the menu sheet is ${sheet.h}px tall around ${sheet.content}px of content — ` +
              `${slack}px of empty ground in a ${sheet.vh}px viewport`
          );
        } else {
          say(`${width}: the sheet is ${sheet.h}px around ${sheet.content}px of content`);
        }
        // AND THE SCRIM STILL COVERS WHAT THE SHEET NO LONGER DOES. Shrinking
        // a modal's panel must not expose the page behind it to a tap.
        const scrim: any = await page.evaluate(`(() => {
          const el = document.querySelector('[data-menu-root] [aria-hidden="true"]');
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { bottom: Math.round(r.bottom), vh: window.innerHeight };
        })()`);
        if (!scrim) fail(`${width}: the open sheet has no backdrop, so the page behind it is live`);
        else if (scrim.bottom < scrim.vh - 2) fail(`${width}: the backdrop stops at ${scrim.bottom}px in a ${scrim.vh}px viewport`);
        else say(`${width}: the backdrop still covers the page to the foot`);
      }
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    if (SHOTS) {
      await page
        .locator('[data-condensed]')
        .first()
        .screenshot({ path: path.join(OUT, `condensed-${width}.png`) })
        .catch(async () => {
          await page.screenshot({
            path: path.join(OUT, `condensed-${width}.png`),
            clip: { x: 0, y: 0, width, height: 60 },
          });
        });
    }
  } catch (err) {
    fail(`${width}: ${String(err).slice(0, 100)}`);
  } finally {
    await ctx.close();
  }
}

await browser.close();
child.kill();
console.log(`\nTOTAL PROBLEMS IN THE SLIM BAR: ${problems}`);
process.exit(0);
