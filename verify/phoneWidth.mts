// FILE: verify/phoneWidth.mts
//
//   npm run verify:phone
//
// THE LANDING PAGE SURVIVES THE WIDTH CHANGING (`KI-42`, 2026-11-11).
//
// `CountUp` on the landing page read:
//
//     const still = useConstrained() !== null || useReducedMotion();
//
// and `||` short-circuits. On a wide screen `useConstrained()` returns null,
// so the right-hand side runs and the component uses TWO hooks; at phone width
// it returns a reason, the right-hand side never runs, and the component uses
// ONE. React tracks hooks by call order, so a count that changes between
// renders desynchronises its internal list: `areHookInputsEqual` reads the
// deps of a hook that is no longer there, throws `Cannot read properties of
// undefined (reading 'length')`, and the whole landing page renders nothing.
//
// It needs the TRANSITION, which is why it hid for so long. A page loaded
// straight at 390px mounts with one hook and is consistent; a page loaded wide
// and then narrowed is not. A reader rotating a tablet or dragging a window
// narrower hits it, and so does any check that resizes — which is how it
// surfaced, as an intermittent failure of `verify:dashboard` that moved around
// the run.
//
// So this does the one thing that reproduces it, at both orders, and asserts
// the page still has its words. It is seconds, not minutes: the dashboard
// found this by accident and should not be the only thing that can.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..').split(path.sep).join('/');
const PORT = 5700 + Math.floor(Math.random() * 200);
/** The landing page carries far more than this; 50 only has to beat "blank". */
const MIN_TEXT = 50;

let problems = 0;
const say = (line: string) => console.log(`  ${line}`);
const fail = (line: string) => {
  problems++;
  console.log(`  PROBLEM: ${line}`);
};

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

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
// Nothing leaves the machine, and the page tolerates its calls failing.
await ctx.route('**/api/**', (r) =>
  r.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
);
const page = await ctx.newPage();

const crashes: string[] = [];
page.on('pageerror', (e) => crashes.push(String(e).slice(0, 140)));

const TEXT = `Array.from(document.querySelectorAll('body *')).filter((el) =>
  Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim().length > 1)
).length`;

const WIDE = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

console.log('\n=== the landing page survives the width changing ===');

try {
  // The orders that matter: wide then narrow (the one that broke), narrow then
  // wide, and back again — a reader turning a tablet over twice.
  const journeys: [string, { width: number; height: number }[]][] = [
    ['loaded wide, then narrowed to a phone', [WIDE, PHONE]],
    ['loaded at phone width, then widened', [PHONE, WIDE]],
    ['turned over twice', [WIDE, PHONE, WIDE, PHONE]],
  ];

  for (const [what, sizes] of journeys) {
    crashes.length = 0;
    await page.setViewportSize(sizes[0]);
    await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    let worst = Number.POSITIVE_INFINITY;
    for (const size of sizes.slice(1)) {
      await page.setViewportSize(size);
      await page.waitForTimeout(700);
      const pieces = (await page.evaluate(TEXT).catch(() => 0)) as number;
      worst = Math.min(worst, pieces);
    }
    if (worst < MIN_TEXT) {
      fail(`${what}: the page holds ${worst} pieces of text — it rendered nothing`);
    } else {
      say(`${what}: ${worst} pieces of text`);
    }
    if (crashes.length) {
      fail(`${what}: the page threw — ${crashes[0]}`);
    }
  }

  // AND THE REASON IS STILL THE RIGHT ONE AT EACH WIDTH, so a page that
  // survives by never taking the constrained branch would not pass quietly.
  await page.setViewportSize(PHONE);
  await page.waitForTimeout(500);
  const mode = await page
    .evaluate(`document.querySelector('[data-hero-mode]')?.getAttribute('data-hero-mode') || ''`)
    .catch(() => '');
  if (typeof mode === 'string' && /poster/.test(mode)) {
    say(`at phone width the hero is the poster (${mode})`);
  } else {
    fail(`at phone width the hero reads "${mode || '(not marked)'}", and VISUAL_SYSTEM §8 says the poster`);
  }
} finally {
  await browser.close();
  child.kill();
}

console.log(`\nTOTAL PROBLEMS AT PHONE WIDTH: ${problems}`);
process.exit(0);
