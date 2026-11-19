// FILE: verify/sectionGlide.mts
//
//   npm run verify:glide
//
// ONE GESTURE, ONE SECTION (LANDING_SPEC decision 1, Nihar 16 November 2026).
//
// The landing page used to morph its object continuously as you scrolled, so
// a shape existed only while you kept moving and was always a blend of two.
// Now one scroll, swipe, arrow key or Page Down glides to the next section
// and the object forms there on its own.
//
// Checked at the three sizes the decision names -- 1440x900, 1366x768 and
// 390x844 -- because a section that fills one screen may not fill another,
// and 1366x768 is the size where a heading most easily creeps into view at
// the foot:
//
//   1. EACH SHAPE SECTION FILLS THE SCREEN, within a pixel or two.
//   2. THE NEXT HEADING IS NOT SHOWING at the foot before the reader moves.
//   3. ONE WHEEL GESTURE MOVES ONE SECTION, and a FLICK of twenty events in
//      a row still moves one -- the fault a naive implementation has.
//   4. THE KEYBOARD WORKS: Page Down and the arrows move, and Page Up comes
//      back.
//   5. THE READER IS NEVER TRAPPED: below the shape run the page scrolls
//      normally, so the footer and the long reading sections are reachable.
//   6. REDUCED MOTION GETS NO GLIDE AT ALL.
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from 'playwright';
import { litRows } from './fixtures/pngRows.mts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..').split(path.sep).join('/');
const OUT = path.join(HERE, 'out');
const PORT = 9800 + Math.floor(Math.random() * 90);
const SHOTS = process.argv.includes('--shots');

/** The sizes the decision names. */
const SIZES: [number, number][] = [
  [1440, 900],
  [1366, 768],
  [390, 844],
];

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

// ---- THE LETTING-GO STAYS INSIDE THE FRAME ----------------------------
//
// "And then it lets go" is the one section whose whole subject is the object
// coming apart. It used to open to a radius of 7.5-15 while the camera sees
// about 8.6 units of height, so most of the cloud was past the edge within a
// few hundred milliseconds and a reader arriving found an empty screen with a
// quote on it -- which is exactly what was reported.
//
// CHECKED AS GEOMETRY, NOT AS A PICTURE, and that choice is the point. Three
// picture-based versions of this were tried: the total light on the screen,
// the same compared against the settled state, and the share of screen rows
// carrying ink. None could tell the fixed version from the broken one,
// because a cloud letting go does not get BRIGHTER, it gets WIDER -- the same
// light spread further -- and because headless Chrome freezes this field to
// its poster about half the time, which makes any photograph a coin toss.
// The geometry is unambiguous and does not flake.
{
  const { CAMERA, DISPERSAL_RADIUS } = await import(`file:///${REPO}/src/components/particleField.tsx`);
  const half = (2 * Math.tan((CAMERA.fov * Math.PI) / 180 / 2) * CAMERA.dist) / 2;
  if (DISPERSAL_RADIUS.from >= half) {
    problems++;
    console.log(
      `  PROBLEM: the letting-go starts at a radius of ${DISPERSAL_RADIUS.from} and the camera sees ` +
        `${half.toFixed(1)} units from the centre — the cloud is off the edge before it begins`
    );
  } else if (DISPERSAL_RADIUS.to > half * 2.6) {
    problems++;
    console.log(
      `  PROBLEM: the letting-go opens to a radius of ${DISPERSAL_RADIUS.to} against ${half.toFixed(1)} ` +
        `visible — the points leave the frame before a reader can watch them go`
    );
  } else {
    console.log(
      `  the letting-go opens from ${DISPERSAL_RADIUS.from} to ${DISPERSAL_RADIUS.to} against ` +
        `${half.toFixed(1)} units the camera sees from centre — it happens in shot`
    );
  }
}

console.log('\n=== one gesture, one section ===');
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});

/** The shape sections, read from the page rather than written out here. */
const SHAPES = ['hero', 'routes', 'filings', 'forecast', 'cash', 'discount', 'answers', 'workbench', 'beyond', 'letgo'];

async function geometry(page: Page) {
  return (await page.evaluate(`(() => {
    const ids = ${JSON.stringify(SHAPES)};
    return ids.map((id) => {
      const el = document.getElementById(id);
      if (!el) return { id, missing: true };
      const r = el.getBoundingClientRect();
      return { id, top: Math.round(r.top + window.scrollY), h: Math.round(r.height) };
    });
  })()`)) as any[];
}

for (const [width, height] of SIZES) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  const page = await ctx.newPage();
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2600);

    // ---- 1. EACH SHAPE SECTION FILLS THE SCREEN ----------------------
    const geo = await geometry(page);
    const missing = geo.filter((g) => g.missing).map((g) => g.id);
    if (missing.length) {
      fail(`${width}x${height}: ${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} not on the page`);
      continue;
    }
    const short = geo.filter((g) => g.h < height - 2);
    if (short.length) {
      fail(
        `${width}x${height}: ${short.length} shape section(s) do not fill the screen — ` +
          short.map((g) => `${g.id} ${g.h}px`).join(', ')
      );
    } else {
      say(`${width}x${height}: all ${geo.length} shape sections fill the screen (shortest ${Math.min(...geo.map((g) => g.h))}px)`);
    }

    // ---- 2. THE NEXT HEADING IS NOT SHOWING AT THE FOOT --------------
    //
    // Measured from the top of each section: the FOLLOWING section's own
    // heading must sit at or below the fold.
    const peeking: string[] = [];
    for (let i = 0; i < geo.length - 1; i++) {
      await page.evaluate(`window.scrollTo(0, ${geo[i].top})`);
      await page.waitForTimeout(260);
      const peek = await page.evaluate(`(() => {
        const next = document.getElementById(${JSON.stringify('PLACEHOLDER')});
        if (!next) return null;
        const h = next.querySelector('h1, h2, h3');
        if (!h) return null;
        const r = h.getBoundingClientRect();
        return r.top < window.innerHeight - 4 ? Math.round(window.innerHeight - r.top) : 0;
      })()`.replace('"PLACEHOLDER"', JSON.stringify(geo[i + 1].id)));
      if (peek) peeking.push(`${geo[i + 1].id} by ${peek}px under ${geo[i].id}`);
    }
    if (peeking.length) {
      fail(`${width}x${height}: a following heading is already in view — ${peeking.slice(0, 3).join('; ')}`);
    } else {
      say(`${width}x${height}: no following heading shows before the reader moves`);
    }

    // ---- 1b. THE QUOTE IS CENTRED IN THE SCREEN ----------------------
    //
    // Giving the quote's section `flex items-center` on 16 November made its
    // pinned child a FLEX ITEM, and a flex item with no width sizes to its
    // contents -- so the pane stopped spanning the section and the quote,
    // centred inside that shrunken pane, sat in the left third of the screen
    // with the right side empty. Measured against the VIEWPORT, which is what
    // a reader sees, rather than against the pane, which was the thing that
    // was wrong.
    {
      const letgoTop = geo.find((g: any) => g.id === 'letgo')?.top ?? 0;
      await page.evaluate(`window.scrollTo(0, ${letgoTop})`);
      await page.waitForTimeout(450);
      const q: any = await page.evaluate(`(() => {
        const sec = document.getElementById('letgo');
        if (!sec) return null;
        const p = sec.querySelector('p');
        if (!p) return null;
        const r = p.getBoundingClientRect();
        return {
          mid: Math.round(r.left + r.width / 2),
          midY: Math.round(r.top + r.height / 2),
          vw: window.innerWidth,
          vh: window.innerHeight,
        };
      })()`);
      if (!q) {
        fail(`${width}x${height}: the quote could not be found`);
      } else {
        const offX = Math.abs(q.mid - q.vw / 2);
        const offY = Math.abs(q.midY - q.vh / 2);
        if (offX > 24) {
          fail(`${width}x${height}: the quote's centre is ${q.mid}px across a ${q.vw}px screen — ${offX}px off centre`);
        } else if (offY > Math.max(60, height * 0.12)) {
          fail(`${width}x${height}: the quote sits ${offY}px off the vertical centre of a ${q.vh}px screen`);
        } else {
          say(`${width}x${height}: the quote is centred (${offX}px across, ${offY}px down)`);
        }
      }
    }

    // ---- 6. REDUCED MOTION GETS NO GLIDE -----------------------------
    //
    // Done on its own context further down; here the ordinary path.
    await page.evaluate('window.scrollTo(0, 0)');
    await page.waitForTimeout(400);

    const glides = width >= 640;
    if (!glides) {
      // On a narrow screen the field does not run, so there is nothing to
      // glide between: the page must simply scroll.
      await page.mouse.move(width / 2, height / 2);
      await page.mouse.wheel(0, 400);
      await page.waitForTimeout(500);
      const y = Number(await page.evaluate('window.scrollY'));
      if (y < 100) fail(`${width}x${height}: the page did not scroll at all (${y}px) — a narrow screen must scroll normally`);
      else say(`${width}x${height}: scrolls normally (${y}px for a 400px wheel), no glide on a narrow screen`);
      await ctx.close();
      continue;
    }

    // ---- 3. ONE GESTURE, ONE SECTION --------------------------------
    await page.mouse.move(width / 2, height / 2);
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(1500);
    let y = Number(await page.evaluate('window.scrollY'));
    const after1 = geo.findIndex((g) => Math.abs(g.top - y) < 6);
    if (after1 !== 1) {
      fail(`${width}x${height}: one wheel gesture landed at ${y}px, which is ${after1 < 0 ? 'between sections' : `section ${after1}`}, not section 1`);
    } else {
      say(`${width}x${height}: one gesture moved one section (to ${geo[1].id})`);
    }

    // AND A FLICK IS STILL ONE SECTION. Twenty events in a row is what a
    // trackpad sends; a naive implementation jumps five sections.
    const before = y;
    /* A TRUE FLICK, NOT TWENTY SEPARATE GESTURES. Awaiting each
       `mouse.wheel` round-trips to the browser and spaces the events out by
       milliseconds, which is a reader scrolling twenty times, not a trackpad
       flicking once -- and an implementation with no lock at all passed it.
       Dispatched synchronously in the page, they arrive in one burst the way
       a trackpad actually sends them. */
    await page.evaluate(`(() => {
      for (let i = 0; i < 20; i++) {
        window.dispatchEvent(new WheelEvent('wheel', { deltaY: 90, cancelable: true, bubbles: true }));
      }
    })()`);
    await page.waitForTimeout(1800);
    y = Number(await page.evaluate('window.scrollY'));
    const landed = geo.findIndex((g) => Math.abs(g.top - y) < 6);
    const from = geo.findIndex((g) => Math.abs(g.top - before) < 6);
    const moved = landed - from;
    if (landed < 0) {
      fail(`${width}x${height}: a 20-event flick left the page at ${y}px, between sections`);
    } else if (moved > 1) {
      fail(`${width}x${height}: a 20-event flick moved ${moved} sections — a fast trackpad skips`);
    } else {
      say(`${width}x${height}: a 20-event flick moved ${moved} section`);
    }

    // ---- 4. THE KEYBOARD ---------------------------------------------
    await page.keyboard.press('PageDown');
    await page.waitForTimeout(1500);
    const afterKey = Number(await page.evaluate('window.scrollY'));
    const keyIdx = geo.findIndex((g) => Math.abs(g.top - afterKey) < 6);
    if (keyIdx !== landed + 1) {
      fail(`${width}x${height}: Page Down went from section ${landed} to ${keyIdx}`);
    } else {
      say(`${width}x${height}: Page Down moves one section`);
    }
    await page.keyboard.press('PageUp');
    await page.waitForTimeout(1500);
    const backY = Number(await page.evaluate('window.scrollY'));
    const backIdx = geo.findIndex((g) => Math.abs(g.top - backY) < 6);
    if (backIdx !== keyIdx - 1) fail(`${width}x${height}: Page Up went from section ${keyIdx} to ${backIdx}`);
    else say(`${width}x${height}: Page Up comes back`);

    // ---- 5. NEVER TRAPPED --------------------------------------------
    //
    // Below the shape run the page must scroll like any other page, or the
    // footer is unreachable.
    const end = geo[geo.length - 1].top + geo[geo.length - 1].h + 200;
    await page.evaluate(`window.scrollTo(0, ${end})`);
    await page.waitForTimeout(500);
    const atFoot = Number(await page.evaluate('window.scrollY'));
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(600);
    const afterFoot = Number(await page.evaluate('window.scrollY'));
    if (afterFoot <= atFoot + 50) {
      fail(`${width}x${height}: below the shapes the page moved only ${afterFoot - atFoot}px for a 500px wheel — the reader is held`);
    } else {
      say(`${width}x${height}: below the shapes the page scrolls freely (${afterFoot - atFoot}px for 500px)`);
    }

    // and the footer is actually reachable
    await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
    await page.waitForTimeout(700);
    const sawFooter = await page.evaluate(`(() => {
      const f = document.querySelector('footer');
      if (!f) return false;
      const r = f.getBoundingClientRect();
      return r.top < window.innerHeight;
    })()`);
    if (!sawFooter) fail(`${width}x${height}: the footer cannot be reached`);
    else say(`${width}x${height}: the footer is reachable`);

    if (SHOTS) await page.screenshot({ path: path.join(OUT, `glide-${width}.png`) }).catch(() => {});
  } catch (err) {
    fail(`${width}x${height}: ${String(err).slice(0, 120)}`);
  } finally {
    await ctx.close();
  }
}

// ---- 6. REDUCED MOTION: NO GLIDE, NO MORPH -----------------------------
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  const page = await ctx.newPage();
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2200);
    await page.mouse.move(720, 450);
    const before = Number(await page.evaluate('window.scrollY'));
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(500);
    const after = Number(await page.evaluate('window.scrollY'));
    const moved = after - before;
    // A plain page moves about as far as the wheel asked. A glide would land
    // on a section boundary instead, which at 900px is far further.
    if (moved > 420) {
      fail(`under reduced motion a 300px wheel moved ${moved}px — that is a glide, and there should be none`);
    } else if (moved < 100) {
      fail(`under reduced motion a 300px wheel moved ${moved}px — the page is being held`);
    } else {
      say(`under reduced motion the page scrolls plainly (${moved}px for a 300px wheel)`);
    }
  } catch (err) {
    fail(`reduced motion: ${String(err).slice(0, 110)}`);
  } finally {
    await ctx.close();
  }
}

await browser.close();
child.kill();
console.log(`\nTOTAL PROBLEMS IN THE SECTION GLIDE: ${problems}`);
process.exit(0);
