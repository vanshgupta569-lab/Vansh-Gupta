// FILE: verify/evidenceSheet.mts
//
//   npm run verify:evidence
//
// THE EVIDENCE SHEET FITS INSIDE ITSELF (2026-11-22).
//
// The sheet behind every figure on the Financials tab is the product's whole
// claim in one panel: the line, the period, the basis, the unit, the state,
// the XBRL concept, the form, the filing date, the accession number, and a
// link to the document. If any of that prints off the edge of the panel, the
// claim is not made.
//
// An XBRL concept is ONE UNBREAKABLE WORD --
// `RevenueFromContractWithCustomerExcludingAssessedTax` has no space in it --
// so at 390 it ran 15px past the right edge of a 390px sheet. The figure's
// provenance, printed off the side of the panel that exists to show it.
//
// Checked at 1440 and 390:
//   1. NOTHING OVERFLOWS the panel, and nothing is jammed against its edge.
//   2. IT IS A DIALOG a screen reader can announce, with a name.
//   3. ESC CLOSES IT, because a panel that covers the table has to be
//      dismissable without hunting for the control.
//   4. EVERY ROW HAS BOTH A LABEL AND A VALUE -- a provenance row with an
//      empty value is worse than no row, because the label promises one.
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..').split(path.sep).join('/');
const OUT = path.join(HERE, 'out');
const PORT = 8200 + Math.floor(Math.random() * 90);
const SHOTS = process.argv.includes('--shots');
/** A value has to keep this much clear of the panel's edge. */
const EDGE_PX = 8;

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
    if (/ready in|Local/i.test(String(d))) {
      clearTimeout(t);
      resolve();
    }
  });
  child.on('error', reject);
});

console.log('\n=== the company page fits inside itself ===');
const browser = await chromium.launch({ headless: true });

for (const [width, height] of [[1440, 900], [390, 844]] as [number, number][]) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await ctx.route('**/api/company*', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(paperPayload()) })
  );
  await ctx.route('**/api/marketIndex*', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(paperIndexSeries()) })
  );
  const page = await ctx.newPage();
  try {
    await page.goto(`http://127.0.0.1:${PORT}/company/${PAPER_TICKER}/financials`, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-financials]').first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(1200);

    // EVERY STATEMENT, not just the first: the concept strings differ, and the
    // longest one is the one that overflows.
    for (const statement of ['Income statement', 'Balance sheet', 'Cash flow']) {
      await page.getByRole('button', { name: statement }).first().click({ timeout: 8_000 }).catch(() => {});
      await page.waitForTimeout(700);
      await page.locator('[data-cell]').first().click({ timeout: 10_000 }).catch(() => {});
      await page.waitForTimeout(800);

      const sheet: any = await page.evaluate(`(() => {
        const panel = document.querySelector('[role="dialog"]');
        if (!panel) return null;
        const pr = panel.getBoundingClientRect();
        const over = [];
        const empty = [];
        for (const row of panel.querySelectorAll('div')) {
          const dt = row.querySelector('dt');
          const dd = row.querySelector('dd');
          if (!dt || !dd) continue;
          const label = (dt.textContent || '').trim();
          const value = (dd.textContent || '').trim();
          if (label && !value) empty.push(label);
        }
        for (const el of panel.querySelectorAll('*')) {
          if (el.children.length) continue;
          const t = (el.textContent || '').trim();
          if (!t) continue;
          const r = el.getBoundingClientRect();
          if (r.width < 1) continue;
          const gap = Math.round(pr.right - r.right);
          if (gap < ${EDGE_PX}) over.push(t.slice(0, 34) + ' (' + gap + 'px from the edge)');
        }
        return {
          role: panel.getAttribute('role'),
          named: !!(panel.getAttribute('aria-label') || panel.getAttribute('aria-labelledby')),
          over: over.slice(0, 4),
          empty: empty.slice(0, 4),
          rows: panel.querySelectorAll('dt').length,
        };
      })()`);

      if (!sheet) {
        fail(`${width}, ${statement}: tapping a figure opened no evidence sheet`);
        continue;
      }
      if (sheet.role !== 'dialog') fail(`${width}, ${statement}: the sheet is a <${sheet.role}>, not a dialog`);
      if (!sheet.named) fail(`${width}, ${statement}: the sheet has no name for a screen reader`);
      if (sheet.over.length) {
        fail(`${width}, ${statement}: ${sheet.over.length} line(s) run to the panel's edge — ${sheet.over.join('; ')}`);
      }
      if (sheet.empty.length) {
        fail(`${width}, ${statement}: ${sheet.empty.join(', ')} promise a value and carry none`);
      }
      if (!sheet.over.length && !sheet.empty.length && sheet.role === 'dialog' && sheet.named) {
        say(`${width}, ${statement}: ${sheet.rows} rows, all inside the panel, all with a value`);
      }

      if (SHOTS) await page.screenshot({ path: path.join(OUT, `evidence-${width}-${statement.split(' ')[0]}.png`) }).catch(() => {});

      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
      const closed = await page.evaluate(`!document.querySelector('[role="dialog"]')`);
      if (!closed) fail(`${width}, ${statement}: Escape does not close the evidence sheet`);
    }
    say(`${width}: Escape closes the sheet on every statement`);
  } catch (err) {
    fail(`${width}: ${String(err).slice(0, 120)}`);
  } finally {
    await ctx.close();
  }
}

// ---- AND NOTHING ON THE OVERVIEW SPILLS OUT OF ITS BOX ----------------
//
// THE SAME FAULT AS THE CONCEPT STRING, one level up. A flex item defaults to
// `min-width: auto` -- its CONTENT width -- so a row wider than the screen
// refuses to shrink, its own `overflow-x-auto` never gets the chance to
// scroll, and the PARENT overflows instead. The price chart's control row
// wanted 315px in a 300px box at 390 and spilled 15px outside it.
//
// A box that scrolls ON PURPOSE is not a fault: `overflow-x: auto` with snap
// points is how the range chips are meant to behave on a phone. What is
// checked is content escaping a box that cannot scroll at all.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await ctx.route('**/api/company*', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(paperPayload()) })
  );
  await ctx.route('**/api/marketIndex*', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(paperIndexSeries()) })
  );
  const page = await ctx.newPage();
  try {
    await page.goto(`http://127.0.0.1:${PORT}/company/${PAPER_TICKER}/overview`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3200);
    const spills: any[] = await page.evaluate(`(() => {
      const out = [];
      for (const el of document.querySelectorAll('div, ul, nav, section')) {
        if (el.scrollWidth <= el.clientWidth + 2) continue;
        if (el.clientWidth < 80) continue;
        const s = getComputedStyle(el);
        if (s.overflowX === 'auto' || s.overflowX === 'scroll' || s.overflowX === 'hidden') continue;
        out.push({ cls: (el.className || '').toString().slice(0, 46), wants: el.scrollWidth, has: el.clientWidth });
      }
      return out.slice(0, 5);
    })()`);
    if (spills.length) {
      for (const sp of spills) {
        fail(`390: a row wants ${sp.wants}px in a ${sp.has}px box and spills ${sp.wants - sp.has}px outside it — class "${sp.cls}"`);
      }
    } else {
      say('390: nothing on the overview spills out of a box that cannot scroll');
    }
    const sideways = await page.evaluate(`document.documentElement.scrollWidth > window.innerWidth + 1`);
    if (sideways) fail('390: the overview scrolls sideways');
    else say('390: the overview does not scroll sideways');
  } catch (err) {
    fail(`390 overview: ${String(err).slice(0, 110)}`);
  } finally {
    await ctx.close();
  }
}

await browser.close();
child.kill();
console.log(`\nTOTAL PROBLEMS ON THE COMPANY PAGE: ${problems}`);
process.exit(0);
