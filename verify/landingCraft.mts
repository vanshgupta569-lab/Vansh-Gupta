// FILE: verify/landingCraft.mts
//
//   npm run verify:craft
//
// THE LANDING PAGE'S OWN RULES, CHECKED AT 1440 AND 390 (2026-11-13).
//
// From the Impeccable review of 13 November. Every arm here is a rule this
// repository already published and the page was breaking:
//
//   1. NO UNVERIFIABLE CLAIM. "VERIFIED LEAD" under a shield icon was a
//      credibility badge attached to nothing -- no document, no verifier, no
//      claim stated (standing decision 7). This fails on the words rather
//      than on the markup, so putting the badge back in any form trips it.
//   2. NO VENDOR NAME, AND NO SECURITY CLAIM NOBODY CAN CHECK, in the UI
//      (LANDING_SPEC checklist 34).
//   3. SQUARE, AND NO SHADOWS. DESIGN.md: "Every panel, tile, chip, pill and
//      button has a 0px radius"; "There are no shadows in this system. Not
//      one box-shadow is declared anywhere in the build." That sentence was
//      false in four places when this was written.
//   4. ONE GREEN. The form's success state used three Tailwind emeralds --
//      a second green, and a cool one, which the Avoid list rules out twice.
//   5. THE WHOLE WORDMARK AT EVERY WIDTH. One poster served both viewports
//      through `object-cover`, so at 390 the name read "rgina".
//
// WHY THIS RUNS AT 390 AT ALL: `verify/heroWordmark.mts` only ever opens
// 1440, so every arm it has was blind to the width where the hero actually
// failed. A check that only looks at the width that works is a check that
// cannot fail.
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..').split(path.sep).join('/');
const OUT = path.join(HERE, 'out');
const PORT = 8100 + Math.floor(Math.random() * 90);
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

console.log('\n=== the landing page keeps its own rules ===');
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});

/** Scroll the whole page so every section that fades in has faded in. */
const revealAll = `(async () => {
  const step = window.innerHeight * 0.8;
  for (let y = 0; y < document.body.scrollHeight; y += step) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 160));
  }
  window.scrollTo(0, 0);
})()`;

for (const width of [1440, 390]) {
  const ctx = await browser.newContext({
    viewport: { width, height: width < 500 ? 844 : 900 },
    deviceScaleFactor: 1,
  });
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  const page = await ctx.newPage();
  try {
    await page.goto(`http://127.0.0.1:${PORT}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await page.evaluate(revealAll);
    await page.waitForTimeout(800);

    const text = String(await page.evaluate('document.body.innerText'));

    // ---- 1. NO UNVERIFIABLE CLAIM ------------------------------------
    //
    // On the WORDS, not the markup: a badge rebuilt with different classes
    // is the same claim.
    for (const [what, re] of [
      ['a "verified" badge', /\bverified\b/i],
      ['an "accredited" or "certified" badge', /\b(accredited|certified)\b/i],
    ] as [string, RegExp][]) {
      const m = re.exec(text);
      if (m) fail(`${width}: ${what} is on the page ("${m[0]}") with nothing a reader can open behind it`);
    }

    // ---- 2. NO VENDOR NAME, NO UNCHECKABLE SECURITY CLAIM -------------
    for (const [what, re] of [
      ['a form vendor is named', /web3forms|formspree|typeform|mailchimp/i],
      ['an unverifiable security claim', /\bsecure\s+(endpoint|form|connection)\b/i],
    ] as [string, RegExp][]) {
      const m = re.exec(text);
      if (m) fail(`${width}: ${what} in the interface ("${m[0]}")`);
    }
    say(`${width}: no unverifiable badge, no vendor name in the interface`);

    // ---- 3. SQUARE, AND NO SHADOWS ------------------------------------
    const chrome: any = await page.evaluate(`(() => {
      const shadows = [];
      const rounded = [];
      for (const el of document.querySelectorAll('section, div, button, input, textarea, a')) {
        const s = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        if (r.width < 24 || r.height < 12) continue;
        if (s.boxShadow && s.boxShadow !== 'none') {
          shadows.push({ tag: el.tagName.toLowerCase(), cls: (el.className || '').toString().slice(0, 48), v: s.boxShadow.slice(0, 44) });
        }
        const radii = [s.borderTopLeftRadius, s.borderTopRightRadius, s.borderBottomLeftRadius, s.borderBottomRightRadius]
          .map((v) => parseFloat(v) || 0);
        const biggest = Math.max(...radii);
        // A circle is a circle (the round icon buttons); a CARD is the fault.
        const isPill = radii.every((v) => v >= Math.min(r.width, r.height) / 2 - 1);
        if (biggest > 2 && !isPill) {
          rounded.push({ tag: el.tagName.toLowerCase(), cls: (el.className || '').toString().slice(0, 48), r: biggest });
        }
      }
      return { shadows: shadows.slice(0, 5), shadowN: shadows.length, rounded: rounded.slice(0, 5), roundedN: rounded.length };
    })()`);
    if (chrome.shadowN) {
      fail(
        `${width}: ${chrome.shadowN} box-shadow${chrome.shadowN === 1 ? '' : 's'} on the page, and DESIGN.md says not one is declared anywhere in the build — e.g. ` +
          chrome.shadows.map((s: any) => `<${s.tag} class="${s.cls}"> ${s.v}`).join(' | ')
      );
    } else {
      say(`${width}: no box-shadow anywhere on the page`);
    }
    if (chrome.roundedN) {
      fail(
        `${width}: ${chrome.roundedN} rounded corner${chrome.roundedN === 1 ? '' : 's'} over 2px, and the form language is square — e.g. ` +
          chrome.rounded.map((s: any) => `<${s.tag} class="${s.cls}"> ${s.r}px`).join(' | ')
      );
    } else {
      say(`${width}: every corner square`);
    }

    // ---- 4. ONE GREEN -------------------------------------------------
    //
    // Tailwind's emeralds are cool-cast and are a SECOND green. Read off the
    // computed colours rather than the class names, so a different utility
    // producing the same colour is caught too.
    const greens: any = await page.evaluate(`(() => {
      const out = new Set();
      for (const el of document.querySelectorAll('*')) {
        for (const prop of ['color', 'backgroundColor', 'borderTopColor']) {
          const v = getComputedStyle(el)[prop];
          const m = /rgba?\\((\\d+), ?(\\d+), ?(\\d+)/.exec(v || '');
          if (!m) continue;
          const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
          // Green-dominant and not grey.
          if (g > r + 14 && g > b + 6 && g > 40) out.add(r + ',' + g + ',' + b);
        }
      }
      return [...out];
    })()`);
    // The palette's one green and its line/fill, as tokens resolve them.
    const ALLOWED = new Set(['95,163,123', '47,92,69', '18,33,26']);
    const strays = (greens as string[]).filter((g) => !ALLOWED.has(g));
    if (strays.length) {
      fail(`${width}: ${strays.length} green(s) outside the one in the palette — rgb(${strays.join('), rgb(')})`);
    } else {
      say(`${width}: one green only`);
    }

    // ---- 5. THE WHOLE WORDMARK ----------------------------------------
    //
    // The poster is 1440x900. Under `object-cover` at 390 the sides are cut
    // off and the name reads "rgina". Measured from the rendered box against
    // the image's own aspect, which is what cropping actually is.
    const poster: any = await page.evaluate(`(() => {
      const el = document.querySelector('[data-hero-poster]');
      if (!el) return null;
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        fit: s.objectFit,
        boxW: Math.round(r.width),
        boxH: Math.round(r.height),
        natW: el.naturalWidth || 1440,
        natH: el.naturalHeight || 900,
      };
    })()`);
    if (!poster) {
      say(`${width}: no hero poster on this page`);
    } else {
      const boxAspect = poster.boxW / poster.boxH;
      const imgAspect = poster.natW / poster.natH;
      // How much of the image's WIDTH survives.
      const kept = poster.fit === 'cover' ? Math.min(1, boxAspect / imgAspect) : 1;
      if (kept < 0.92) {
        fail(
          `${width}: the hero poster keeps only ${(kept * 100).toFixed(0)}% of its width (object-fit: ${poster.fit}, ` +
            `box ${poster.boxW}x${poster.boxH} against an image of ${poster.natW}x${poster.natH}) — the name is cut off`
        );
      } else {
        say(`${width}: the hero poster keeps ${(kept * 100).toFixed(0)}% of its width (object-fit: ${poster.fit})`);
      }
    }

    if (SHOTS) {
      await page.screenshot({ path: path.join(OUT, `craft-${width}-hero.png`) }).catch(() => {});
    }
  } catch (err) {
    fail(`${width}: ${String(err).slice(0, 120)}`);
  } finally {
    await ctx.close();
  }
}

await browser.close();
child.kill();
console.log(`\nTOTAL PROBLEMS ON THE LANDING PAGE: ${problems}`);
process.exit(0);
