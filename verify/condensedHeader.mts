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
