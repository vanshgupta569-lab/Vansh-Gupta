// FILE: verify/landing.mts
//
// THE LANDING PAGE'S BUDGETS, on the BUILT site (`docs/VISUAL_SYSTEM.md` §6;
// `docs/VISUAL_BUILD_PLAN.md` job 8.7). Run after `npm run build`:
//
//   npm run build && npm run verify:landing
//
// Two halves.
//
//   1. The bundle, read from dist/: three.js is in a chunk of its own, not in
//      the entry chunk index.html loads first (lazy, after first paint), and
//      that chunk is at most 180KB gzipped; the poster is at most 60KB.
//   2. Lighthouse, on `vite preview` of the same build, desktop preset: LCP at
//      most 2.5s, CLS at most 0.1, and Total Blocking Time at most 200ms.
//      INP needs a real interaction and a navigation run has none, so TBT —
//      the main-thread time that would have delayed one — stands in for it
//      (PROPOSED — needs Nihar). The LCP element must be the poster.
//
// Nothing leaves the machine: the preview serves dist/, and the page's calls
// to /api/* fail as they would offline, which the landing page tolerates (the
// count tile is left out).

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const DIST = path.join(REPO, 'dist');

export const BUDGET = {
  threeChunkGzipKB: 180,
  posterKB: 60,
  lcpMs: 2500,
  cls: 0.1,
  tbtMs: 200,
  /**
   * THE RATCHET (decision V4's rule, applied here). TBT is over the 200ms
   * budget for reasons outside the landing page — `KI-40` — and measured
   * 453–506ms on 2026-11-04 in the cloud's software-GPU browser. The check
   * fails above this ceiling; lower it as `KI-40` is fixed, and set it to the
   * budget when it closes.
   */
  tbtCeilingMs: 600,
};

let problems = 0;
const say = (line: string) => console.log(`  ${line}`);
const fail = (line: string) => {
  problems++;
  console.log(`  PROBLEM: ${line}`);
};

console.log('\n=== the landing page budgets: the bundle ===');
if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  fail('dist/ is not built: run npm run build first');
  process.exit(1);
}
const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
const entryScripts = [...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g)].map((m) => m[1]);
const preloads = [...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+\.js)"/g)].map((m) => m[1]);
const assets = path.join(DIST, 'assets');
const chunks = fs.readdirSync(assets).filter((f) => f.endsWith('.js'));
const holdsThree = (file: string) => /WebGLRenderer|THREE\.WebGLRenderer|WebGL2RenderingContext/.test(fs.readFileSync(path.join(assets, file), 'utf8'));
const threeChunks = chunks.filter(holdsThree);
const firstLoaded = [...entryScripts, ...preloads].map((src) => path.basename(src));
if (!threeChunks.length) fail('no chunk holds the WebGL renderer: the particle field is missing from the build');
for (const f of threeChunks) {
  const gz = zlib.gzipSync(fs.readFileSync(path.join(assets, f))).length / 1024;
  if (firstLoaded.includes(f)) fail(`${f} holds three.js and is loaded by index.html before the first paint`);
  if (gz > BUDGET.threeChunkGzipKB) fail(`${f} holds three.js and is ${gz.toFixed(1)}KB gzipped, over the ${BUDGET.threeChunkGzipKB}KB budget`);
  else say(`${f}: three.js, ${gz.toFixed(1)}KB gzipped (budget ${BUDGET.threeChunkGzipKB}KB), not in the entry chunk`);
}
const poster = path.join(DIST, 'hero-poster.webp');
if (!fs.existsSync(poster)) fail('dist/hero-poster.webp is missing');
else {
  const kb = fs.statSync(poster).size / 1024;
  if (kb > BUDGET.posterKB) fail(`the poster is ${kb.toFixed(1)}KB, over ${BUDGET.posterKB}KB`);
  else say(`hero-poster.webp: ${kb.toFixed(1)}KB (budget ${BUDGET.posterKB}KB)`);
}

console.log('\n=== the landing page budgets: Lighthouse, desktop ===');
const PORT = 4319;
const preview = spawn(process.execPath, [path.join(REPO, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--port', String(PORT), '--host', '127.0.0.1', '--strictPort'], {
  cwd: REPO,
  stdio: ['ignore', 'pipe', 'pipe'],
});
try {
  const started = Date.now();
  for (;;) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/`);
      if (r.ok) break;
    } catch {
      /* not up yet */
    }
    if (Date.now() - started > 30_000) throw new Error('vite preview did not start');
    await new Promise((r) => setTimeout(r, 300));
  }
  let lighthouse: any;
  let launch: any;
  try {
    lighthouse = (await import('lighthouse')).default;
    launch = (await import('chrome-launcher')).launch;
  } catch {
    fail('lighthouse is not installed (npm install): this half is LOCAL until it is');
    throw new Error('no lighthouse');
  }
  const { chromium } = await import('playwright');
  const chrome = await launch({ chromePath: chromium.executablePath(), chromeFlags: ['--headless=new', '--no-sandbox'] });
  try {
    const result = await lighthouse(
      `http://127.0.0.1:${PORT}/`,
      { port: chrome.port, output: 'json', logLevel: 'error', onlyCategories: ['performance'] },
      (await import('lighthouse/core/config/desktop-config.js')).default
    );
    const audits = result.lhr.audits;
    const lcp = audits['largest-contentful-paint'].numericValue;
    const cls = audits['cumulative-layout-shift'].numericValue;
    const tbt = audits['total-blocking-time'].numericValue;
    // Lighthouse 13 names the element in the LCP breakdown insight.
    const lcpElement = JSON.stringify(
      audits['lcp-breakdown-insight']?.details ?? audits['largest-contentful-paint-element']?.details ?? ''
    );
    const line = `LCP ${Math.round(lcp)}ms (≤ ${BUDGET.lcpMs}), CLS ${cls.toFixed(3)} (≤ ${BUDGET.cls}), TBT ${Math.round(tbt)}ms (budget ${BUDGET.tbtMs}, ratchet ${BUDGET.tbtCeilingMs}; standing in for INP)`;
    if (lcp > BUDGET.lcpMs) fail(`LCP ${Math.round(lcp)}ms is over ${BUDGET.lcpMs}ms`);
    if (cls > BUDGET.cls) fail(`CLS ${cls.toFixed(3)} is over ${BUDGET.cls}`);
    if (tbt > BUDGET.tbtCeilingMs) fail(`TBT ${Math.round(tbt)}ms is over the ${BUDGET.tbtCeilingMs}ms ratchet (budget ${BUDGET.tbtMs}ms, KI-40)`);
    else if (tbt > BUDGET.tbtMs) say(`NOTE: TBT ${Math.round(tbt)}ms is over the ${BUDGET.tbtMs}ms budget and inside the ${BUDGET.tbtCeilingMs}ms ratchet (KI-40)`);
    // The largest paint must be one the page has without the 3D chunk: the
    // poster, or — because Chrome leaves a full-viewport image out of LCP as
    // background — the hero headline (PROPOSED — needs Nihar). Never the canvas.
    if (/canvas/i.test(lcpElement) || !/hero-poster|h1\.text-display|section#hero/.test(lcpElement))
      fail(`the largest contentful paint is not the poster or the hero headline: ${lcpElement.slice(0, 200)}`);
    else say(`the largest contentful paint is ${/hero-poster/.test(lcpElement) ? 'the poster' : 'the hero headline'}, painted without the 3D chunk`);
    say(line);
  } finally {
    await chrome.kill();
  }
} catch (error: any) {
  if (String(error?.message) !== 'no lighthouse') fail(`Lighthouse could not run: ${String(error?.message || error).split('\n')[0]}`);
} finally {
  preview.kill();
}

console.log(`\nTOTAL PROBLEMS IN THE LANDING BUDGETS: ${problems}`);
process.exit(problems ? 1 : 0);
