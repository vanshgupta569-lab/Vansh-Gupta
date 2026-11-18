// FILE: verify/countUp.mts
//
//   npm run verify:countup
//
// THE COVERAGE FIGURES COUNT UP, ON THE BUILT SITE (Nihar, 16 November 2026).
//
// WHY THIS RUNS AGAINST `dist` AND NOT THE DEV SERVER. The owner's note said
// "check that it actually runs on the live build", and that is a different
// question from whether it runs in development: the built bundle is minified,
// its React is production React, and an IntersectionObserver that fires in dev
// can be defeated in a build by anything from a changed root margin to a
// component that mounts already in view. So this serves `dist/` as a static
// site and watches the real thing.
//
// What it asserts:
//   1. ALL FOUR FIGURES ANIMATE. Sampled repeatedly as the band comes into
//      view, each must be seen at more than one value -- a figure that is
//      only ever its final value never counted.
//   2. EACH ARRIVES AT ITS FIGURE and stays there.
//   3. ONCE PER VISIT. Scrolling away and back does not start it again.
//   4. THE FINAL FIGURE IS IN THE PAGE FROM THE FIRST RENDER, for a screen
//      reader, while the animating digits are hidden from it.
//   5. UNDER REDUCED MOTION there is no count at all: the figure is its value
//      on the first frame it is seen.
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..').split(path.sep).join('/');
const PORT = 9950 + Math.floor(Math.random() * 40);

let problems = 0;
const say = (line: string) => console.log(`  ${line}`);
const fail = (line: string) => {
  problems++;
  console.log(`  PROBLEM: ${line}`);
};

if (!fs.existsSync(path.join(REPO, 'dist', 'index.html'))) {
  console.log('\n=== the coverage figures count up ===');
  fail('there is no dist/index.html — run `npm run build` first');
  console.log(`\nTOTAL PROBLEMS IN THE COUNT-UP: ${problems}`);
  process.exit(0);
}

// `vite preview` serves the built bundle, which is the thing in question.
const child = spawn(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['vite', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'],
  { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' }
);
await new Promise<void>((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('vite preview did not start within 60s')), 60_000);
  child.stdout?.on('data', (d) => {
    // MATCHED WITHOUT THE COLON. vite colours its output, so the bytes are
    // "Local" then an ANSI escape then ":" -- and /Local:/ never matches.
    if (/127\.0\.0\.1|localhost|Local/i.test(String(d))) {
      clearTimeout(t);
      setTimeout(resolve, 400);
    }
  });
  child.on('error', reject);
});
const BASE = `http://127.0.0.1:${PORT}`;

console.log('\n=== the coverage figures count up, on the built site ===');
const browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });

/** Every visible figure, right now. */
const readFigures = (page: Page) =>
  page.evaluate(
    `Array.from(document.querySelectorAll('[data-stat]')).map((el) => ({
      key: el.getAttribute('data-stat'),
      shown: (el.querySelector('[data-stat-shown]')?.textContent || '').trim(),
      read: (el.querySelector('[data-stat-final]')?.textContent || '').trim(),
      hidden: el.querySelector('[data-stat-shown]')?.getAttribute('aria-hidden') === 'true',
    }))`
  ) as Promise<any[]>;

/** Bring the band to the top of the window without any smooth scrolling. */
async function toBand(page: Page) {
  const y = await page.evaluate(`(() => {
    const el = document.getElementById('numbers');
    return el ? Math.round(el.getBoundingClientRect().top + window.scrollY) : 0;
  })()`);
  await page.evaluate(`window.scrollTo(0, ${Number(y) - 80})`);
}

for (const reduced of [false, true]) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: reduced ? 'reduce' : 'no-preference',
  });
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  const page = await ctx.newPage();
  const where = reduced ? 'under reduced motion' : 'ordinarily';
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1800);

    // ---- 4. THE FIGURE IS THERE FOR A SCREEN READER FROM THE START ----
    const atRest = await readFigures(page);
    if (!atRest.length) {
      fail(`${where}: no coverage figures on the built page at all`);
      await ctx.close();
      continue;
    }
    const unread = atRest.filter((f) => !f.read);
    const exposed = atRest.filter((f) => !f.hidden);
    if (unread.length) {
      fail(`${where}: ${unread.map((f: any) => f.key).join(', ')} carry no settled figure for a screen reader`);
    } else if (exposed.length) {
      fail(`${where}: the animating digits of ${exposed.map((f: any) => f.key).join(', ')} are not hidden from the accessibility tree`);
    } else {
      say(`${where}: all ${atRest.length} figures are in the page for a screen reader before anything moves — ${atRest.map((f: any) => f.read).join(', ')}`);
    }

    // ---- 1 & 5. WATCH IT ---------------------------------------------
    const seen = new Map<string, Set<string>>();
    for (const f of atRest) seen.set(f.key, new Set());
    await toBand(page);
    // Sampled tightly: the token is 600ms, so a slow sample would miss it.
    for (let i = 0; i < 26; i++) {
      const now = await readFigures(page);
      for (const f of now) seen.get(f.key)?.add(f.shown);
      await page.waitForTimeout(28);
    }
    await page.waitForTimeout(900);
    const settled = await readFigures(page);

    const moved = [...seen.entries()].filter(([, vals]) => vals.size > 1).map(([k]) => k);
    const still = [...seen.entries()].filter(([, vals]) => vals.size <= 1).map(([k]) => k);

    if (reduced) {
      if (moved.length) {
        fail(`under reduced motion ${moved.join(', ')} counted up — the figure should simply be its value`);
      } else {
        say(`under reduced motion nothing counts: ${settled.map((f: any) => f.shown).join(', ')}`);
      }
    } else if (still.length) {
      fail(
        `ordinarily ${still.join(', ')} never counted — seen only at ` +
          still.map((k) => `"${[...(seen.get(k) || [])][0]}"`).join(', ')
      );
    } else {
      say(`ordinarily all ${moved.length} figures counted — ${moved.map((k) => `${k} through ${seen.get(k)!.size} values`).join(', ')}`);
    }

    // ---- 2. EACH ARRIVES AT ITS FIGURE -------------------------------
    const wrong = settled.filter((f: any) => f.shown !== f.read);
    if (wrong.length) {
      fail(`${where}: ${wrong.map((f: any) => `${f.key} settled at "${f.shown}" and not "${f.read}"`).join('; ')}`);
    } else {
      say(`${where}: each figure settled at its own value`);
    }

    // ---- 3. ONCE PER VISIT -------------------------------------------
    if (!reduced) {
      await page.evaluate('window.scrollTo(0, 0)');
      await page.waitForTimeout(700);
      await toBand(page);
      const again = new Set<string>();
      for (let i = 0; i < 10; i++) {
        const now = await readFigures(page);
        for (const f of now) if (f.shown !== settled.find((s: any) => s.key === f.key)?.shown) again.add(f.key);
        await page.waitForTimeout(40);
      }
      if (again.size) {
        fail(`coming back to the band started ${[...again].join(', ')} counting again — it should run once a visit`);
      } else {
        say('coming back to the band does not start it again');
      }
    }
  } catch (err) {
    fail(`${where}: ${String(err).slice(0, 120)}`);
  } finally {
    await ctx.close();
  }
}

await browser.close();
child.kill();
console.log(`\nTOTAL PROBLEMS IN THE COUNT-UP: ${problems}`);
process.exit(0);
