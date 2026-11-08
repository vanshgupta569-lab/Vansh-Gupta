// FILE: verify/scenarios.mts
//
// THE SCENARIO SUITE. Every engine or workbook change is verified against it.
//
//   npm run verify                 the curated Apple model, ten scenarios
//   CO=AAPL npm run verify         a fetched company instead (needs payloads)
//   npm run verify -- run previous compare a run against an earlier one
//
// It builds the workbook the site would hand a user, recalculates every
// formula in it with HyperFormula, and checks that the model holds together:
// every Checks row zero, the balance sheet balancing in every year, each
// statement tying to the model sheet, the annexure links resolving, no error
// cells, and the DCF's value per share reproduced from the sheet's own cells
// by arithmetic written here rather than read from the sheet.
//
// The scenarios move the circularity switch, a live return on cash, PIK
// interest, a buyback stress, and sweeps of depreciation and stock
// compensation, so the checks are exercised under strain rather than at rest.
//
// What it does NOT do: judge whether a valuation is sensible. It proves the
// model is internally consistent and that the workbook reproduces the site.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { HyperFormula, DetailedCellError } from 'hyperformula';
import { checkVersionsAgree, readPayload } from './payloadSet.mts';

// Everything resolves from this file's own location, so the suite runs from a
// fresh checkout with no configuration.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..').split(path.sep).join('/');
import { spawnSync } from 'node:child_process';
const OUT = path.join(HERE, 'out');
const PAYLOADS = path.join(HERE, 'payloads');
fs.mkdirSync(OUT, { recursive: true });
const ExcelJS = createRequire(`${REPO}/package.json`)('exceljs');
const { buildWorkbook } = await import(`file:///${REPO}/src/data/excelExport.ts`);
const { enableIterativeCalculation } = await import(`file:///${REPO}/src/data/excelIterativeCalc.ts`);
const AAPL = (await import(`file:///${REPO}/src/data/AAPL.js`)).default;
const { buildModel, buildDCF } = await import(`file:///${REPO}/src/engine/model.js`);
// The payload version constants are duplicated for a reason; this is what
// stops them drifting apart in silence.
checkVersionsAgree();

const tag = process.argv[2] || 'run';
const compareTag = process.argv[3];

const CO = process.env.CO;
if (CO && !fs.existsSync(path.join(PAYLOADS, `${CO}.json`))) {
  console.error(
    `No payload for ${CO}. Fetch the sweep set first:  npm run verify:payloads -- ${CO}`
  );
  process.exit(2);
}
const SRC = CO
  ? (await import(`file:///${REPO}/src/data/autoCompany.ts`)).buildCompanyFrom(readPayload(`${CO}.json`)).modelData
  : AAPL;
const M = buildModel(SRC);
const D = buildDCF(M, SRC);
// Some companies in the sweep set are refused a valuation, correctly: the
// checks below that need a value say so and skip rather than compare against
// nothing (Exxon's depreciation rate, Toyota's listing).
const REFUSED = (D as any).applicable !== true;
if (REFUSED) console.log(`the engine refuses this company: ${(D as any).code} -- value checks will be skipped`);
const wb = await buildWorkbook({
  model: M, dcf: D,
  source: { meta: { source: 'SEC EDGAR 10-K' }, rawStatements: [{ fiscalYear: 2025, revenue: 416161 }] },
  companyName: 'Apple Inc.', ticker: 'AAPL', currencySymbol: '$', unitLabel: '$ millions', modelLabel: 'Analyst model',
});
const buf = await enableIterativeCalculation(await wb.xlsx.writeBuffer(), { iterateCount: 100, iterateDelta: 0.001 });
fs.writeFileSync(path.join(OUT, `${tag}.xlsx`), Buffer.from(buf as ArrayBuffer));
const wb2 = new ExcelJS.Workbook();
await wb2.xlsx.load(buf);
console.log('tab order:', wb2.worksheets.map((w: any) => w.name).join(' | '));

const L = (n: number) => { let s = ''; n++; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
const colIdx = (s: string) => [...s].reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0) - 1;

const base: Record<string, any[][]> = {};
wb.eachSheet((ws: any) => {
  const grid: any[][] = [];
  ws.eachRow({ includeEmpty: false }, (row: any, rn: number) =>
    row.eachCell({ includeEmpty: true }, (cell: any, cn: number) => {
      const v = cell.value;
      (grid[rn - 1] ||= [])[cn - 1] = v && typeof v === 'object' && 'formula' in v ? `=${v.formula}` : v ?? null;
    }));
  for (let i = 0; i < grid.length; i++) grid[i] ||= [];
  base[ws.name] = grid;
});

const MODEL = '3-StatementModel';
const nT = (M.years as number[]).length, nH = M.nH as number, FIRST = 4;
// HyperFormula keeps 10 significant digits, so a figure built from intermediates
// in the millions (Toyota, in yen) carries rounding far above a fixed 1e-6. The
// tolerance scales with the size of the company: 1e-9 of ten times its largest
// revenue or total assets, which is still a one-in-a-hundred-million test.
const SCALE = 10 * Math.max(...[...(M.revenue as number[]), ...(M.balanceSheet.totalAssets as number[])].filter((v) => typeof v === 'number' && isFinite(v)).map(Math.abs));
const TOL = Math.max(1e-4, 1e-9 * SCALE);
const FY = (i: number) => `FY${String(M.years[i]).slice(2)}`;
const rowOf = (sheet: string, text: string | RegExp, after = -1) =>
  base[sheet].findIndex((r, idx) => idx > after && (typeof text === 'string' ? r[2] === text : text.test(String(r[2] ?? ''))));
const need = (what: string | RegExp, after = -1, sheet = MODEL) => {
  const i = rowOf(sheet, what, after);
  if (i < 0) throw new Error(`row not found: ${what}`);
  return i;
};

let colD = 0;
for (const [s, grid] of Object.entries(base)) grid.forEach((row) => row.forEach((v, c) => {
  if (c < FIRST || typeof v !== 'string' || !v.startsWith('=')) return;
  for (const m of v.replace(/'[^']*'!/g, '').matchAll(/\$?\b([A-Z]{1,3})\$?(\d+)\b/g)) if (colIdx(m[1]) === 3 && !/\$D\$/.test(m[0])) colD++;
}));
console.log(`formulas reaching into column D (units label): ${colD}`);

function takeBranch(f: string, on: boolean) {
  const re = /IF\(\$E\$\d+=1,/;
  let m: RegExpExecArray | null;
  while ((m = re.exec(f))) {
    let depth = 1, i = m.index + m[0].length, comma = -1;
    for (; i < f.length && depth > 0; i++) {
      if (f[i] === '(') depth++; else if (f[i] === ')') depth--; else if (f[i] === ',' && depth === 1 && comma < 0) comma = i;
    }
    f = f.slice(0, m.index) + `(${on ? f.slice(m.index + m[0].length, comma) : f.slice(comma + 1, i - 1)})` + f.slice(i);
  }
  return f;
}

const borrow = need('Additional borrowing / (pay down)');
const R = {
  circ: need('Circularity switch — see note below'),
  rev: need('Revenue'),
  ebit: need('Operating profit (EBIT)'),
  cashRate: need('Return earned on cash'),
  intInc: need('Interest income'),
  debtRate: need('Cash interest rate on debt'),
  taxRate: need('Tax rate'),
  gp: need('Gross profit before D&A and SBC'),
  cogs: need('Cost of sales, excluding D&A and SBC'),
  rnd: need('Research & development, excluding D&A and SBC'),
  sga: need('Selling, general & administrative, excluding D&A and SBC'),
  otherOpex: need(/^Other operating costs, excluding D&A and SBC/),
  daCost: need('Less: depreciation & amortization'),
  sbcCost: need('Less: stock based compensation'),
  cogsFiled: need('Cost of sales, as filed'),
  rndFiled: need('Research & development, as filed'),
  sgaFiled: need('Selling, general & administrative, as filed'),
  otherFiled: need(/^Other operating costs: operating income as filed/),
  pikRate: need('PIK interest rate on debt'),
  revRate: need('Interest rate on revolver'),
  intExp: need('Interest expense'),
  other: need('Other income / (expense), net'),
  tax: need('Taxes'),
  ni: need('Net income'),
  sbcPct: need('Stock based compensation, % of revenue'),
  sbc: need('Stock based compensation'),
  da: need('Depreciation & amortization'),
  depPct: need('Depreciation as % of the assets in service'),
  pik: need('PIK interest accrued to the balance'),
  debtBop: need('Beginning of period', borrow),
  debtEnd: need('End of period', borrow),
  // The row names its own basis for a derived company (KI-9), so it is found
  // by pattern rather than by the whole label.
  minCash: need(/^Minimum cash balance/),
  revBop: need('Revolver, beginning of period'),
  revDraw: need('Revolver draw / (repayment)'),
  revEnd: need('Revolver, end of period'),
  buyback: need('Share repurchases'),
  cfWc: need('Movements in working capital and other items'),
  cfPik: need('Non-cash PIK interest added back'),
  cfo: need('Cash from operating activities'),
  cashBop: need('Cash, beginning of period'),
  cashEnd: need('Cash, end of period'),
  check: need('Balance check'),
};

type Scenario = { name: string; on: boolean; cashRate?: number; buybacks?: number[]; pikRate?: number; depPctAdd?: number; sbcPctAdd?: number };
const STRESS = [-400000, -400000, -400000, 0, 0];
const scenarios: Scenario[] = [
  { name: 'A switch OFF', on: false },
  { name: 'B switch ON', on: true },
  { name: 'C switch OFF, return on cash 4%', on: false, cashRate: 0.04 },
  { name: 'D switch ON, return on cash 4%', on: true, cashRate: 0.04 },
  { name: 'G switch OFF, PIK 3% every forecast year, cash 4%', on: false, cashRate: 0.04, pikRate: 0.03 },
  { name: 'H switch ON, PIK 3% every forecast year, cash 4%', on: true, cashRate: 0.04, pikRate: 0.03 },
  { name: 'I switch OFF, PIK 3% + buyback stress, cash 4%', on: false, cashRate: 0.04, pikRate: 0.03, buybacks: STRESS },
  { name: 'J switch ON, PIK 3% + buyback stress, cash 4%', on: true, cashRate: 0.04, pikRate: 0.03, buybacks: STRESS },
  { name: 'K sweep: switch OFF, depreciation +20 points of capex', on: false, depPctAdd: 0.2 },
  { name: 'L sweep: switch OFF, stock compensation +2 points of revenue', on: false, sbcPctAdd: 0.02 },
];

const saved: Record<string, Record<string, any[]>> = {};
const series: Record<string, Record<string, number[]>> = {};
let totalProblems = 0;

for (const sc of scenarios) {
  const g: Record<string, any[][]> = JSON.parse(JSON.stringify(base));
  g[MODEL][R.circ][FIRST] = sc.on ? 1 : 0;
  for (let i = nH; i < nT; i++) {
    const c = FIRST + i;
    if (sc.cashRate !== undefined) g[MODEL][R.cashRate][c] = sc.cashRate;
    if (sc.buybacks) g[MODEL][R.buyback][c] = sc.buybacks[i - nH];
    if (sc.pikRate !== undefined) g[MODEL][R.pikRate][c] = sc.pikRate;
    if (sc.depPctAdd) g[MODEL][R.depPct][c] = (base[MODEL][R.depPct][c] as number) + sc.depPctAdd;
    if (sc.sbcPctAdd) g[MODEL][R.sbcPct][c] = (base[MODEL][R.sbcPct][c] as number) + sc.sbcPctAdd;
  }
  for (const grid of Object.values(g)) for (const row of grid) for (let c = 0; c < row.length; c++)
    if (typeof row[c] === 'string' && row[c].startsWith('=')) row[c] = takeBranch(row[c], sc.on);

  // Loops HyperFormula cannot iterate: own-year closing balances read by the
  // average-balance interest formulas. Each is broken with a guess cell.
  const breaks = [
    { row: R.intInc, target: R.cashEnd },
    { row: R.intExp, target: R.revEnd },
    { row: R.pik, target: R.debtEnd },
  ];
  g.Guess = breaks.map(() => new Array(FIRST + nT).fill(0));
  if (sc.on) breaks.forEach((b, k) => {
    for (let i = nH; i < nT; i++) {
      const c = L(FIRST + i), cell = g[MODEL][b.row][FIRST + i] as string;
      const next = cell.replace(`+${c}${b.target + 1})/2`, `+Guess!${c}${k + 1})/2`);
      if (next === cell) throw new Error(`could not break loop in ${c}${b.row + 1}: ${cell}`);
      g[MODEL][b.row][FIRST + i] = next;
    }
  });

  const hf = HyperFormula.buildFromSheets(g, { licenseKey: 'gpl-v3' });
  const sid = (s: string) => hf.getSheetId(s)!;
  const raw = (s: string, r: number, c: number) => hf.getCellValue({ sheet: sid(s), row: r, col: c });
  const num = (s: string, r: number, c: number) => { const v = raw(s, r, c); return typeof v === 'number' ? v : 0; };
  let iters = 0;
  if (sc.on) for (; iters < 1000; iters++) {
    let delta = 0;
    const next = breaks.map((b, k) => {
      const vals: number[] = [];
      for (let i = nH; i < nT; i++) {
        vals[i] = num(MODEL, b.target, FIRST + i);
        delta = Math.max(delta, Math.abs(vals[i] - num('Guess', k, FIRST + i)));
      }
      return vals;
    });
    if (delta < 1e-7) break;
    hf.batch(() => breaks.forEach((_, k) => { for (let i = nH; i < nT; i++) hf.setCellContents({ sheet: sid('Guess'), row: k, col: FIRST + i }, next[k][i]); }));
  }
  console.log(`\n=== ${sc.name} ===${sc.on ? ` (converged in ${iters} iterations)` : ''}`);
  const problems: string[] = [];
  // HyperFormula rounds results to 10 significant digits.
  const close = (a: number, b: number) => Math.abs(a - b) <= 1e-6 + 1e-9 * Math.max(Math.abs(a), Math.abs(b), SCALE);

  let errors = 0;
  for (const s of hf.getSheetNames()) hf.getSheetValues(sid(s)).forEach((row, r) => row.forEach((v, c) => {
    if (v instanceof DetailedCellError) { errors++; if (errors <= 5) problems.push(`error ${s}!${L(c)}${r + 1} ${v.value} :: ${g[s][r]?.[c]}`); }
  }));
  console.log(`  error cells: ${errors}`);

  const chk = hf.getSheetValues(sid('Checks'));
  let checkRows = 0, checkBad = 0;
  chk.forEach((row, r) => {
    if (!(g.Checks[r] || []).some((x: any) => typeof x === 'string' && x.startsWith('=ROUND'))) return;
    checkRows++;
    const nz = row.slice(FIRST).filter((v) => typeof v === 'number' && v !== 0);
    if (nz.length) { checkBad++; problems.push(`Checks row nonzero: ${row[2]} ${JSON.stringify(nz)}`); }
  });
  console.log(`  Checks rows: ${checkRows}, nonzero: ${checkBad}, summary: ${chk.flat().find((v) => typeof v === 'string' && /checks pass|failed/.test(v))}`);

  const bal = Array.from({ length: nT }, (_, i) => num(MODEL, R.check, FIRST + i));
  if (bal.some((v) => Math.abs(v) > 1e-6)) problems.push(`balance check nonzero: ${bal}`);
  console.log(`  balance check nonzero years: ${bal.filter((v) => Math.abs(v) > 1e-6).length}`);

  const ties: [string, string, string, number][] = [
    ['Income Statement', 'Interest expense', 'Interest expense', -1],
    ['Income Statement', 'Net income', 'Net income', 1],
    ['Balance Sheet', "Total liabilities & shareholders' equity", 'Total assets', 1],
    ['Cash Flow', 'Non-cash PIK interest', 'Non-cash PIK interest added back', 1],
    ['Cash Flow', 'Cash generated by / (used in) operating activities', 'Cash from operating activities', 1],
    ['Cash Flow', 'Cash, end of period', 'Cash, end of period', 1],
  ];
  let tieBad = 0;
  for (const [s, lbl, mlbl, k] of ties) {
    const sr = rowOf(s, lbl), mr = rowOf(MODEL, mlbl);
    for (let i = 0; i < nT; i++) if (!close(num(s, sr, FIRST + i), k * num(MODEL, mr, FIRST + i))) { tieBad++; problems.push(`tie ${s} "${lbl}" ${FY(i)}`); }
  }
  let annex = 0, annexBad = 0;
  g.Annexures.forEach((row, r) => row.forEach((f, c) => {
    const m = typeof f === 'string' && f.match(/^=IF\('3-StatementModel'!([A-Z]+)(\d+)=""/);
    if (!m) return;
    annex++;
    const a = raw('Annexures', r, c), b = raw(MODEL, Number(m[2]) - 1, colIdx(m[1]));
    // A linked line the filing does not report shows "not reported" where the model cell is blank.
    if (!((b === null && (a === '' || a === 'not reported')) || a === b)) { annexBad++; problems.push(`annexure ${L(c)}${r + 1}: ${a} vs ${b}`); }
  }));
  console.log(`  statement ties: ${ties.length * nT - tieBad}/${ties.length * nT}; annexure links: ${annex - annexBad}/${annex}`);

  // THE ASSUMPTIONS SHEET IS LINKS, NOT COPIES.
  //
  // Its whole claim is that it cannot go stale: every value points at the cell
  // the model actually uses, so the sheet moves when the reader moves an
  // assumption. A PASTED NUMBER WOULD PASS EVERY OTHER CHECK IN THIS FILE — no
  // error cell, no broken tie, nothing out of balance — and be wrong from the
  // first edit, which is exactly when the sheet is read. Zero error cells would
  // also pass on an empty sheet, so the count is asserted too.
  //
  // Computed cells (COUNT of the forecast columns, say) are not links and are
  // skipped; what must never appear in a value column is a literal.
  let links = 0, linkBad = 0, pasted = 0;
  (g.Assumptions || []).forEach((row, r) => {
    // Rows above the first band are the header, whose year columns are labels.
    if (r < 7) return;
    [FIRST, FIRST + 1].forEach((c) => {
      const f = row[c];
      if (f === null || f === undefined || f === '') return;
      if (typeof f !== 'string' || !f.startsWith('=')) {
        pasted++;
        problems.push(`Assumptions ${L(c)}${r + 1} is a pasted value, not a link: ${JSON.stringify(f)}`);
        return;
      }
      const m = f.match(/^='?([^'!]+)'?!(\$?[A-Z]+)(\$?\d+)$/);
      if (!m) return;
      links++;
      const a = raw('Assumptions', r, c);
      const b = raw(m[1], Number(m[3].replace('$', '')) - 1, colIdx(m[2].replace('$', '')));
      if (a !== b) {
        linkBad++;
        problems.push(`Assumptions ${L(c)}${r + 1}: ${a} vs ${m[1]}!${m[2]}${m[3]} ${b}`);
      }
    });
  });
  // A floor, not a target: the sheet lists every assumption that reaches the
  // valuation, and a refused company drops the cost of capital and the bridge.
  const FLOOR = REFUSED ? 20 : 30;
  if (links < FLOOR) problems.push(`Assumptions sheet carries only ${links} linked values, expected at least ${FLOOR}`);
  console.log(`  assumption links: ${links - linkBad}/${links} resolve to their target; pasted values: ${pasted}`);

  // PIK: charged once, accrued once, added back once; interest on the switch's basis.
  const S = (row: number) => Array.from({ length: nT }, (_, i) => num(MODEL, row, FIRST + i));
  const cashInt: number[] = [], pikExp: number[] = [], revInt: number[] = [], cfoRecon: number[] = [];
  let pikNonZero = 0;
  for (let i = nH; i < nT; i++) {
    const c = FIRST + i;
    const basis = (row: number) => (sc.on ? (num(MODEL, row, c - 1) + num(MODEL, row, c)) / 2 : num(MODEL, row, c - 1));
    cashInt[i] = basis(R.debtEnd) * num(MODEL, R.debtRate, c);
    pikExp[i] = basis(R.debtEnd) * num(MODEL, R.pikRate, c);
    revInt[i] = basis(R.revEnd) * num(MODEL, R.revRate, c);
    const pik = num(MODEL, R.pik, c);
    if (Math.abs(pik) > 1) pikNonZero++;
    const v = (row: number) => num(MODEL, row, c);
    if (!close(pik, pikExp[i])) problems.push(`PIK ${FY(i)}: model ${pik} vs rate x ${sc.on ? 'average' : 'opening'} balance ${pikExp[i]}`);
    if (!close(v(R.intExp), -(cashInt[i] + pik + revInt[i]))) problems.push(`interest expense ${FY(i)}: ${v(R.intExp)} vs -(cash ${cashInt[i]} + PIK ${pik} + revolver ${revInt[i]})`);
    if (!close(v(R.intInc), basis(R.cashEnd) * v(R.cashRate))) problems.push(`interest income ${FY(i)} off basis`);
    if (!close(v(R.debtEnd) - v(R.debtBop), v(R.pik) + num(MODEL, borrow, c))) problems.push(`debt ${FY(i)}: growth ${v(R.debtEnd) - v(R.debtBop)} != PIK ${pik} + borrowing ${num(MODEL, borrow, c)}`);
    if (!close(v(R.cfPik), pik)) problems.push(`cash flow PIK add-back ${FY(i)} ${v(R.cfPik)} != PIK ${pik}`);
    // Independent cash view of operations: only CASH interest leaves.
    // cash view: revenue less cash costs only -- no D&A or SBC anywhere in it
    cfoRecon[i] = v(R.rev) + v(R.cogs) + v(R.rnd) + v(R.sga) + v(R.otherOpex) + v(R.intInc) - cashInt[i] - revInt[i] + v(R.other) + v(R.tax) + v(R.cfWc);
    if (!close(v(R.ebit), v(R.gp) + v(R.rnd) + v(R.sga) + v(R.otherOpex) - v(R.da) - v(R.sbc))) problems.push(`EBIT identity ${FY(i)}`);
    if (!close(v(R.daCost), -v(R.da)) || !close(v(R.sbcCost), -v(R.sbc))) problems.push(`charge rows ${FY(i)} do not mirror the add-back rows`);
    if (!close(v(R.cfo), cfoRecon[i])) problems.push(`CFO ${FY(i)}: model ${v(R.cfo)} vs cash reconciliation ${cfoRecon[i]}`);
  }
  for (let i = 0; i < nH; i++) {
    const c = FIRST + i, v = (row: number) => num(MODEL, row, c);
    const filed = v(R.rev) + v(R.cogsFiled) + v(R.rndFiled) + v(R.sgaFiled) + v(R.otherFiled);
    if (!close(v(R.ebit), filed)) problems.push(`reported ${FY(i)} EBIT ${v(R.ebit)} != revenue + filed costs ${filed}`);
  }
  // A REFUSED COMPANY HAS NO DCF SHEET TO CHECK. Since the workbook started
  // refusing with the site (0f58b97), the sheet is replaced by the reason, so
  // every link into it reads nothing — which is the right file and the wrong
  // check. Skipped here and reported as skipped.
  if (REFUSED) {
    console.log('  DCF sheet: replaced by the refusal, so nothing to link to -- skipped');
  } else {
    const dRow = (label: string | RegExp) =>
      g.DCFModel.findIndex((r) =>
        typeof label === 'string' ? r[2] === label : label.test(String(r[2] ?? ''))
      );
    const ser = (label: string | RegExp) => Array.from({ length: nT - nH }, (_, t) => num('DCFModel', dRow(label), FIRST + t));
    const one = (label: string | RegExp) => num('DCFModel', dRow(label), FIRST);
    const ebit = ser('EBIT'), tax = ser('Tax rate'), da = ser('Plus: depreciation & amortization'), sbc = ser('Plus: stock based compensation');
    const wcs = ser('Movements in working capital'), capex = ser('Less: capital expenditure'), period = ser(/^Discount period, years from /);
    const W = one('Weighted average cost of capital'), gr = one('Long term growth rate (g)');
    const ebiat = ebit.map((e, t) => e * (1 - tax[t]));
    const ufcf = ebiat.map((e, t) => e + da[t] + sbc[t] + wcs[t] + capex[t]);
    ser('Unlevered free cash flow').forEach((x, t) => { if (!close(x, ufcf[t])) problems.push(`DCF UFCF year ${t + 1}`); });
    ebit.forEach((x, t) => { if (!close(x, num(MODEL, R.ebit, FIRST + nH + t))) problems.push(`DCF EBIT link year ${t + 1}`); });
    const pv = ufcf.reduce((s, f, t) => s + f * (1 + W) ** -period[t], 0);
    const amortRow = rowOf(MODEL, 'Amortisation of intangibles');
    const k = nT - nH - 1;
    // The normalised terminal cash flow keeps the final year's working capital
    // and strips the two lines the engine excludes from the terminal year (the
    // deferred tax asset and other non-current liabilities), so this recompute
    // reads their movements off the model sheet rather than assuming them away.
    const chgAfter = (header: string) => {
      const h = rowOf(MODEL, header);
      if (h < 0) return 0;
      const r = rowOf(MODEL, 'Increase / (decrease)', h);
      return r >= 0 ? (num(MODEL, r, FIRST + nT - 1) ?? 0) : 0;
    };
    const norm =
      ebiat[k] + sbc[k] + wcs[k]
      + (amortRow >= 0 ? (num(MODEL, amortRow, FIRST + nT - 1) ?? 0) : 0) * (1 - tax[k])
      + chgAfter('Deferred tax assets as % of revenue')
      - chgAfter('Other non-current liabilities as % of revenue');
    const vps = (pv + ((norm * (1 + gr)) / (W - gr)) * (1 + W) ** -period[k] - one('Net debt') - one('Less: minority interests at the last reported date') - one('Less: preferred stock at the last reported date')) / one('Net diluted shares outstanding');
    if (!close(vps, one('Value per share, perpetuity growth'))) problems.push(`DCF value per share ${one('Value per share, perpetuity growth')} vs recomputed ${vps}`);
    console.log(`  DCF value per share: sheet ${one('Value per share, perpetuity growth').toFixed(4)}, recomputed from its cells ${vps.toFixed(4)}`);

    // ---- what the sheet says rests on the terminal value -------------------
    //
    // The disclosure rows are live formulas, so they are checked the same way
    // as the value itself: against the engine, not against each other.
    const tvPv = ((norm * (1 + gr)) / (W - gr)) * (1 + W) ** -period[k];
    const nF2 = nT - nH;
    const share = pv + tvPv === 0 ? 0 : tvPv / (pv + tvPv);
    if (!close(share, one('Share of enterprise value beyond the forecast'))) {
      problems.push(`terminal share ${one('Share of enterprise value beyond the forecast')} vs recomputed ${share}`);
    }
    // The benchmark: the same two rates, the same window, a flat cash flow.
    const annuity = (1 - (1 + W) ** -nF2) / W;
    const tvUnit = ((1 + gr) / (W - gr)) * (1 + W) ** -nF2;
    const bench = tvUnit / (annuity + tvUnit);
    const sheetBench = one(/What any \d+-year forecast at this discount rate would put beyond it/);
    if (!close(bench, sheetBench)) problems.push(`terminal benchmark ${sheetBench} vs recomputed ${bench}`);

    // One assumption moved, everything else held — against the engine's own
    // sensitivity grid, which is what the site shows.
    // Only against the UNPERTURBED scenario: the engine's grid was built from
    // the model as derived, and the sweeps deliberately move drivers in the
    // sheet, so the two would rightly disagree there.
    const axes = D.sensitivityAxes, grid = D.sensitivity?.perpetuity;
    if (axes && grid && sc.name === 'A switch OFF') {
      const midW = Math.floor((axes.wacc.length - 1) / 2);
      const midG = Math.floor((axes.growth.length - 1) / 2);
      const pairs: [string, number][] = [
        ['Value per share, growth after the forecast 1 point lower', grid[midW][0]],
        ['Value per share, growth after the forecast 1 point higher', grid[midW][axes.growth.length - 1]],
        ['Value per share, discount rate half a point lower', grid[1][midG]],
        ['Value per share, discount rate half a point higher', grid[axes.wacc.length - 2][midG]],
      ];
      for (const [label, expected] of pairs) {
        const got = one(label);
        if (!close(got, expected)) problems.push(`${label}: sheet ${got} vs engine grid ${expected}`);
      }
      console.log(
        `  terminal share ${(share * 100).toFixed(1)}% against a ${(bench * 100).toFixed(1)}% benchmark; ` +
          `growth 1pt either way ${grid[midW][0].toFixed(2)} to ${grid[midW][axes.growth.length - 1].toFixed(2)}, ` +
          `WACC half a point either way ${grid[1][midG].toFixed(2)} to ${grid[axes.wacc.length - 2][midG].toFixed(2)} -- confirmed`
      );
    }
  }
  console.log(`  forecast years with PIK > 1: ${pikNonZero}`);

  const f0 = (a: (number | undefined)[]) => a.slice(nH - 1).map((x) => (x === undefined ? '' : Math.round(x).toString()).padStart(9)).join('');
  const pct = (a: number[]) => a.slice(nH - 1).map((x) => `${(x * 100).toFixed(2)}%`.padStart(9)).join('');
  console.log(`  ${''.padEnd(34)}${Array.from({ length: nT - nH + 1 }, (_, k) => FY(nH - 1 + k).padStart(9)).join('')}`);
  console.log(`  ${'PIK interest rate'.padEnd(34)}${pct(S(R.pikRate))}`);
  console.log(`  ${'debt, beginning'.padEnd(34)}${f0(S(R.debtBop))}`);
  console.log(`  ${'PIK accrued to debt'.padEnd(34)}${f0(S(R.pik))}`);
  console.log(`  ${'debt, end'.padEnd(34)}${f0(S(R.debtEnd))}`);
  console.log(`  ${'cash interest (recomputed)'.padEnd(34)}${f0([...new Array(nH).fill(undefined), ...cashInt.slice(nH)])}`);
  console.log(`  ${'interest expense (model)'.padEnd(34)}${f0(S(R.intExp))}`);
  console.log(`  ${'PIK added back in CFO'.padEnd(34)}${f0(S(R.cfPik))}`);
  console.log(`  ${'CFO (model)'.padEnd(34)}${f0(S(R.cfo))}`);
  console.log(`  ${'CFO (cash reconciliation)'.padEnd(34)}${f0([...new Array(nH).fill(undefined), ...cfoRecon.slice(nH)])}`);
  console.log(`  ${'revolver, end'.padEnd(34)}${f0(S(R.revEnd))}`);
  console.log(`  ${'cash, end'.padEnd(34)}${f0(S(R.cashEnd))}`);

  problems.slice(0, 12).forEach((p) => console.log(`  PROBLEM: ${p}`));
  console.log(`  problems: ${problems.length}`);
  totalProblems += problems.length;

  series[sc.name] = { rev: S(R.rev), ebit: S(R.ebit), ni: S(R.ni), cfo: S(R.cfo), da: S(R.da), sbc: S(R.sbc), cashEnd: S(R.cashEnd), tax: S(R.taxRate), intExp: S(R.intExp), intInc: S(R.intInc) };
  const out: Record<string, any[]> = {};
  for (const s of ['Income Statement', 'Balance Sheet', 'Cash Flow', 'DCFModel', 'Ratios']) {
    const seen: Record<string, number> = {};
    hf.getSheetValues(sid(s)).forEach((row, r) => {
      const lbl = g[s][r]?.[2];
      if (typeof lbl !== 'string' || !lbl) return;
      const k = `${s}|${lbl}|${(seen[lbl] = (seen[lbl] ?? -1) + 1)}`;
      out[k] = row.slice(FIRST, FIRST + nT).map((v) => (typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v instanceof DetailedCellError ? v.value : (v as any) ?? null));
    });
  }
  saved[sc.name] = out;
}
fs.writeFileSync(path.join(OUT, `values-${tag}.json`), JSON.stringify(saved));

// ---- non-cash sweep: does each add-back move profit, or only cash? ---------
const A = series['A switch OFF'];
const hdr = `${''.padEnd(44)}${Array.from({ length: nT - nH }, (_, k) => FY(nH + k).padStart(9)).join('')}`;
const row = (label: string, a: number[]) => `  ${label.padEnd(42)}${a.slice(nH).map((x) => (Math.abs(x) < 0.5 ? '0' : Math.round(x).toString()).padStart(9)).join('')}`;
const pcts = (label: string, a: number[]) => `  ${label.padEnd(42)}${a.slice(nH).map((x) => `${(x * 100).toFixed(2)}%`.padStart(9)).join('')}`;
const dlt = (s: Record<string, number[]>, k: string) => s[k].map((x, i) => x - A[k][i]);
console.log('\n=== non-cash sweep ===');
console.log(`reported D&A / revenue: ${Array.from({ length: nH }, (_, i) => `${FY(i)} ${A.rev[i] ? ((A.da[i] / A.rev[i]) * 100).toFixed(2) : '-'}%`).join(', ')}`);
console.log(`reported SBC / revenue: ${Array.from({ length: nH }, (_, i) => `${FY(i)} ${A.rev[i] ? ((A.sbc[i] / A.rev[i]) * 100).toFixed(2) : '-'}%`).join(', ')}`);
console.log(hdr);
console.log(pcts('A: D&A added back / revenue', A.da.map((x, i) => x / A.rev[i])));
console.log(pcts('A: SBC added back / revenue', A.sbc.map((x, i) => x / A.rev[i])));
console.log(pcts('A: EBIT margin', A.ebit.map((x, i) => x / A.rev[i])));
for (const [key, what, sname] of [['da', 'D&A', 'K sweep: switch OFF, depreciation +20 points of capex'], ['sbc', 'SBC', 'L sweep: switch OFF, stock compensation +2 points of revenue']] as const) {
  const s = series[sname];
  console.log(`${sname}`);
  console.log(row(`  change in ${what} added back`, dlt(s, key)));
  console.log(row('  change in EBIT', dlt(s, 'ebit')));
  console.log(row('  change in net income', dlt(s, 'ni')));
  console.log(row('  change in cash from operations', dlt(s, 'cfo')));
  console.log(row('  change in closing cash', dlt(s, 'cashEnd')));
  {
    const dA = dlt(s, key), dE = dlt(s, 'ebit'), dN = dlt(s, 'ni'), dC = dlt(s, 'cfo'), dI = dlt(s, 'intExp'), dII = dlt(s, 'intInc');
    let financingMoved = 0;
    let bad = 0;
    for (let i = nH; i < nT; i++) {
      if (Math.abs(dE[i] + dA[i]) > TOL) { bad++; console.log(`  PROBLEM ${what} ${FY(i)}: EBIT moved ${dE[i]}, expected ${-dA[i]}`); }
      // Where interest did not move, net income moves by exactly the charge after tax.
      if (Math.abs(dI[i]) < 1e-6 && Math.abs(dII[i]) < 1e-6) {
        if (Math.abs(dN[i] - dE[i] * (1 - A.tax[i])) > TOL) { bad++; console.log(`  PROBLEM ${what} ${FY(i)}: net income moved ${dN[i]}, expected ${dE[i] * (1 - A.tax[i])}`); }
      } else financingMoved++;
      // Always: the add-back reverses the charge, so CFO moves by the change in net income plus the change in the add-back.
      if (Math.abs(dC[i] - (dN[i] + dA[i])) > TOL) { bad++; console.log(`  PROBLEM ${what} ${FY(i)}: CFO moved ${dC[i]}, expected net income change + add-back change ${dN[i] + dA[i]}`); }
    }
    console.log(`  ${what}: EBIT moves by exactly the charge; CFO = change in net income + change in add-back; net income = charge after tax in ${nT - nH - financingMoved} of ${nT - nH} years (the rest also moved revolver or cash interest) -- ${bad ? bad + ' PROBLEMS' : 'confirmed'}`);
    totalProblems += bad;
  }
}

// ---- the workbook and the engine agree AFTER AN EDIT ----------------------
//
// Every driver row in the workbook is seeded from the engine's own figures, so
// the two agree at rest whatever their formulas say. That is what hid KI-4:
// the engine drove payables off cost of sales and the workbook off revenue, and
// nobody could tell until something moved. So things are moved here.
//
// Two edits, because one is not enough to separate everything. The gross margin
// moves cost of sales without moving revenue, which parts any driver that
// confuses the two. Revenue growth moves revenue, which parts any driver that
// asserts a share of it — that is how the workbook was found writing capital
// spending as a percentage of revenue for a model that compounds it at a growth
// rate instead.
{
  // Anchored on each schedule's driver row, by pattern, so the check survives
  // the relabelling it exists to verify.
  const endOf = (driver: RegExp) => need('End of period', need(driver));
  const rows = {
    ar: endOf(/^Receivables as %/),
    inv: endOf(/^Inventory as %/),
    ap: endOf(/^Payables as %/),
    acc: endOf(/^Accrued expenses as %/),
    oca: endOf(/^Other current assets as %/),
    dta: endOf(/^Deferred tax assets as %/),
    oncl: endOf(/^Other non-current liabilities/),
    gm: need('Gross margin before D&A and SBC'),
    revGrowth: need('Revenue growth'),
    capex: need(/^Plus: capital expenditures(,|$)/),
    ppeEnd: need('End of period', need(/^(Capital expenditure as|Growth in capital expenditure)/)),
  };
  const lastF = nT - 1;
  const tol = (a: number, b: number) => Math.abs(a - b) <= 1e-6 + 1e-9 * Math.max(Math.abs(a), Math.abs(b), SCALE);

  // The sheet with an edit applied, switch off so nothing iterates.
  const withEdit = (mut: (g: Record<string, any[][]>) => void) => {
    const g: Record<string, any[][]> = JSON.parse(JSON.stringify(base));
    g[MODEL][R.circ][FIRST] = 0;
    mut(g);
    for (const grid of Object.values(g)) for (const row of grid) for (let c = 0; c < row.length; c++)
      if (typeof row[c] === 'string' && row[c].startsWith('=')) row[c] = takeBranch(row[c], false);
    const hf2 = HyperFormula.buildFromSheets(g, { licenseKey: 'gpl-v3' });
    const sid2 = (name: string) => hf2.getSheetId(name)!;
    return {
      cell: (r: number, c: number) => {
        const v = hf2.getCellValue({ sheet: sid2(MODEL), row: r, col: c });
        return typeof v === 'number' ? v : 0;
      },
      dcf: (label: string) => {
        const r = g.DCFModel.findIndex((x) => x[2] === label);
        const v = hf2.getCellValue({ sheet: sid2('DCFModel'), row: r, col: FIRST });
        return typeof v === 'number' ? v : 0;
      },
    };
  };

  const compare = (what: string, EM: any, ED: any, mut: (g: Record<string, any[][]>) => void) => {
    const sheet = withEdit(mut);
    const checks: [string, number, number][] = [
      ['receivables', sheet.cell(rows.ar, FIRST + lastF), EM.wc.accountsReceivable.ending[lastF]],
      ['inventory', sheet.cell(rows.inv, FIRST + lastF), EM.wc.inventory.ending[lastF]],
      ['payables', sheet.cell(rows.ap, FIRST + lastF), EM.wc.accountsPayable.ending[lastF]],
      ['accrued expenses', sheet.cell(rows.acc, FIRST + lastF), EM.wc.accruedExpenses.ending[lastF]],
      ['other current assets', sheet.cell(rows.oca, FIRST + lastF), EM.wc.otherCurrentAssets.ending[lastF]],
      ['deferred tax assets', sheet.cell(rows.dta, FIRST + lastF), EM.wc.deferredTaxAssets.ending[lastF]],
      ['other non-current liabilities', sheet.cell(rows.oncl, FIRST + lastF), EM.wc.otherNonCurrentLiabilities.ending[lastF]],
      ['stock based compensation', sheet.cell(R.sbc, FIRST + lastF), EM.stockBasedCompensation[lastF]],
      ['capital expenditure', sheet.cell(rows.capex, FIRST + lastF), EM.ppe.capex[lastF]],
      ['property, plant & equipment', sheet.cell(rows.ppeEnd, FIRST + lastF), EM.ppe.ending[lastF]],
      ['depreciation & amortisation', sheet.cell(R.da, FIRST + lastF), EM.depreciationAmortisation[lastF]],
      ['operating profit', sheet.cell(R.ebit, FIRST + lastF), EM.ebit[lastF]],
    ];
    if (!REFUSED)
      checks.push(['value per share', sheet.dcf('Value per share, perpetuity growth'), ED.perpetuity?.valuePerShare ?? 0]);
    let bad = 0;
    // A line the filing never reports has no engine figure to compare against:
    // Enbridge tags no accounts payable in any year and the engine forecasts it
    // as NaN (KI-15). Counted and named, never quietly passed.
    const missing = checks.filter(([, , ev]) => !Number.isFinite(ev)).map(([label]) => label);
    for (const [label, sv, ev] of checks) {
      if (!Number.isFinite(ev)) continue;
      if (tol(sv, ev)) continue;
      bad++;
      const gap = ev !== 0 ? ` (${((sv / ev - 1) * 100).toFixed(2)}%)` : '';
      console.log(`  PROBLEM: ${label} after the edit: sheet ${sv.toFixed(2)}, engine ${ev.toFixed(2)}${gap}`);
    }
    console.log(
      `  ${what}: ${checks.length - missing.length} lines compared in the last forecast year -- ` +
        `${bad ? bad + ' DIVERGE' : 'all agree'}` +
        (missing.length ? `; not reported by the filing, so not compared: ${missing.join(', ')}` : '')
    );
    totalProblems += bad;
  };

  console.log('\n=== workbook against engine, after an edit ===');

  // The margin. The sheet's row is the model-basis margin and the assumption is
  // the filed-basis one; they differ by a constant (the share D&A and SBC took
  // of cost of sales), so the same delta moves both by the same amount.
  {
    const DELTA = -0.02;
    const edited: any = JSON.parse(JSON.stringify({ ...SRC, rawStatements: undefined }));
    edited.assumptions.grossMargin = edited.assumptions.grossMargin.map((x: number) => x + DELTA);
    const EM: any = buildModel(edited);
    compare('gross margin -2 points', EM, buildDCF(EM, edited), (g) => {
      for (let i = nH; i < nT; i++)
        g[MODEL][rows.gm][FIRST + i] = (base[MODEL][rows.gm][FIRST + i] as number) + DELTA;
    });
  }

  // Revenue growth. Every segment gains the same three points; the sheet is then
  // given the edited model's own total growth, so both forecast the same revenue
  // and only the rules beneath it can differ.
  {
    const DELTA = 0.03;
    const edited: any = JSON.parse(JSON.stringify({ ...SRC, rawStatements: undefined }));
    for (const name of Object.keys(edited.assumptions.segmentGrowth)) {
      edited.assumptions.segmentGrowth[name] = Array.from(
        { length: nT - nH },
        (_, k) => (M.segmentGrowth[name][nH + k] as number) + DELTA
      );
    }
    const EM: any = buildModel(edited);
    compare('revenue growth +3 points a year', EM, buildDCF(EM, edited), (g) => {
      for (let i = nH; i < nT; i++) g[MODEL][rows.revGrowth][FIRST + i] = EM.revenueGrowth[i];
    });
  }
}

// ---- nothing the model produces is not-a-number ---------------------------
//
// A filed figure the company does not report is null. Null in JavaScript
// arithmetic is zero, so a line built from one used to come out as nil, or as
// infinity where it was divided by, and the not-a-number then travelled: into
// the balance sheet, which stopped adding up, and into the refusal, which
// blamed the balance sheet for a line the filing never tagged (KI-17, KI-18).
// Absence now stays absence, and this is what keeps it that way.
{
  console.log('\n=== no figure is not-a-number ===');
  const bad: string[] = [];
  const seen = new Set<any>();
  const walk = (node: any, path: string, depth = 0) => {
    if (node == null || depth > 4) return;
    if (typeof node === 'number') {
      if (!Number.isFinite(node)) bad.push(path);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((v, i) => {
        if (typeof v === 'number' && !Number.isFinite(v)) bad.push(`${path}[${i}]`);
      });
      return;
    }
    if (typeof node !== 'object' || seen.has(node)) return;
    seen.add(node);
    for (const k of Object.keys(node)) walk(node[k], path ? `${path}.${k}` : k, depth + 1);
  };
  walk(M, 'model');
  walk(D, 'dcf');
  for (const where of bad.slice(0, 12)) console.log(`  PROBLEM: ${where} is not a number`);
  if (bad.length > 12) console.log(`  ...and ${bad.length - 12} more`);
  console.log(`  every figure on the model and the valuation is a number or absent -- ${bad.length ? bad.length + ' PROBLEMS' : 'confirmed'}`);
  totalProblems += bad.length;
}

// ---- the same filings give the same answer on any day ---------------------
//
// The valuation date is the last reported balance sheet date, not the day the
// price was fetched, so moving the fetch date must move nothing. It used to
// move everything: the whole discount schedule slid with it.
{
  console.log('\n=== independence from the lookup date ===');
  const base: any = JSON.parse(JSON.stringify({ ...SRC, rawStatements: undefined }));
  const at = (when: string) => {
    const d = JSON.parse(JSON.stringify(base));
    d.dcf.sharePriceDate = when;
    const m: any = buildModel(d), dd: any = buildDCF(m, d);
    return dd?.perpetuity?.valuePerShare ?? null;
  };
  const a = at('2026-01-02'), b = at('2026-08-05'), c = at('2026-12-30');
  let bad = 0;
  if (REFUSED) {
    // A refused company still has to be refused on every date, which is the
    // same property: nothing about the answer may follow the fetch date.
    if (a !== null || b !== null || c !== null) { bad++; console.log('  PROBLEM: a refused company valued on some date'); }
    console.log(`  refused on every date -- ${bad ? bad + ' PROBLEMS' : 'confirmed'}`);
    totalProblems += bad;
  } else {
  if (!(typeof a === 'number' && a > 0)) { bad++; console.log('  PROBLEM: no value to compare'); }
  for (const [label, v] of [['August', b], ['December', c]] as const) {
    if (typeof v !== 'number' || Math.abs(v / (a as number) - 1) > 1e-12) {
      bad++;
      console.log(`  PROBLEM: the value moved when looked up in ${label}: ${a} vs ${v}`);
    }
  }
  console.log(`  January ${Number(a).toFixed(4)}, August ${Number(b).toFixed(4)}, December ${Number(c).toFixed(4)} -- ${bad ? bad + ' PROBLEMS' : 'identical, confirmed'}`);
  totalProblems += bad;
  }
}

// ---- the data-constraint refusal fires, and refuses only the DCF ----------
//
// No company on the frozen payloads crosses the 25% bound that sets this flag
// (DATA_CONSTRAINTS.md), so without this the path would never run. It is the
// path that decides whether a reader sees a number at all, so it is exercised
// directly rather than left to a company that might one day trip it.
{
  console.log('\n=== data-constraint refusal ===');
  const probe: any = JSON.parse(JSON.stringify({ ...SRC, rawStatements: undefined }));
  const before: any = buildDCF(buildModel(probe), probe);
  probe.meta.dataConstraintRefusal = {
    code: 'dataConstraintTooLarge',
    message: 'A figure the source does not publish could move the value by more than a quarter.',
  };
  const after: any = buildDCF(buildModel(probe), probe);
  let bad = 0;
  // Only a company the engine would otherwise value can show that the flag
  // refuses it; one already refused for another reason proves nothing here.
  if (REFUSED) {
    console.log(`  skipped: the engine already refuses this company as ${(D as any).code}`);
  } else {
  if (before.applicable !== true) { bad++; console.log('  PROBLEM: the model does not value without the flag'); }
  if (after.applicable !== false) { bad++; console.log('  PROBLEM: the flag does not refuse the discounted cash flow'); }
  if (after.code !== 'dataConstraintTooLarge') { bad++; console.log(`  PROBLEM: refusal code is ${after.code}`); }
  if (after.perpetuity !== undefined) { bad++; console.log('  PROBLEM: a value per share survives the refusal'); }
  console.log(`  flag off: value ${before.perpetuity?.valuePerShare?.toFixed(2)}; flag on: refused as ${after.code} -- ${bad ? bad + ' PROBLEMS' : 'confirmed'}`);
  totalProblems += bad;
  }
}

// ---- a driver moves the value the way it reads -----------------------------
//
// Every slider is applied to the model by hand in `companies.ts`, and a handler
// that writes a LEVEL where it should write a SHIFT moves the answer the wrong
// way. Two of them did. The research and selling margin handlers replaced the
// model's whole forecast path with the slider's own number, and because the
// slider's default is the FIRST forecast year, any nudge flattened the other
// four back to it. Apple's curated file forecasts R&D at 10% of revenue in the
// first year and 13% after, so raising R&D by 0.4 of a point CUT the R&D bill in
// years two to five, raised operating profit, and raised the value from $141.98
// to $154.80 a share. Found on 2026-09-27, when a qualitative factor began
// driving that slider; it had been true for anyone who dragged it by hand.
//
// Nothing caught it, because at rest every driver reproduces the model exactly
// and that is all anything checked. Both properties are checked here: a driver
// set back to its own default is an exact no-op, and a driver nudged the way
// that should cost the company value costs it value.
{
  console.log('\n=== a driver moves the value the way it reads ===');
  const { defaultDriversFor, buildFullModel } = await import(
    `file:///${REPO}/src/data/companies.ts`
  );

  // +1 means a RISE in the driver should RAISE the value, -1 that it should cut
  // it. Only the drivers whose direction is unambiguous are listed. More
  // depreciation lowers taxable profit and is then added back, so its net sign
  // depends on the tax rate against the asset base; a dividend only moves cash
  // from the company to its owners. Neither has a direction to assert, so
  // neither is claimed here.
  const DIRECTION: [string, number, 'perpetuity' | 'exit'][] = [
    ['revenueGrowthPct', +1, 'perpetuity'],
    ['operatingMarginPct', +1, 'perpetuity'],
    ['taxRatePct', -1, 'perpetuity'],
    ['capexPctOfRev', -1, 'perpetuity'],
    ['waccPct', -1, 'perpetuity'],
    ['terminalGrowthPct', +1, 'perpetuity'],
    ['rndMarginPct', -1, 'perpetuity'],
    ['sgaMarginPct', -1, 'perpetuity'],
    ['betaValue', -1, 'perpetuity'],
    ['riskFreeRatePct', -1, 'perpetuity'],
    ['marketRiskPremiumPct', -1, 'perpetuity'],
    ['exitMultipleX', +1, 'exit'],
  ];
  // One point for a percentage, which clears the one-decimal threshold a slider
  // counts as touched at. Beta is quoted to two decimals and is a ratio, not a
  // percentage, so it moves by two tenths.
  const NUDGE: Record<string, number> = { betaValue: 0.2 };

  const defs: any = defaultDriversFor(SRC);
  let bad = 0;
  if (REFUSED) {
    console.log(`  skipped: the engine refuses this company as ${(D as any).code}`);
  } else {
    // Straight off the engine rather than through the rounded, formatted result,
    // so the no-op below is tested to the last decimal place the model carries.
    const valueOf = (drivers: any, which: string): number | null => {
      let out: any;
      try {
        out = buildFullModel(SRC, drivers);
      } catch {
        return null;
      }
      if (out?.dcf?.applicable !== true) return null;
      const v =
        which === 'exit'
          ? out.dcf.exitMultipleValuation?.valuePerShare
          : out.dcf.perpetuity?.valuePerShare;
      return typeof v === 'number' && isFinite(v) ? v : null;
    };

    const tested = DIRECTION.filter(([k]) => defs[k] !== undefined && defs[k] !== null);

    // THE NO-OP. Writing a driver back at its own default must reproduce the
    // untouched model exactly, or a slider edits the model merely by being
    // looked at. That is the fault the shift handlers were written to avoid.
    for (const [driver, , which] of tested) {
      const rest = valueOf(defs, which);
      const again = valueOf({ ...defs, [driver]: defs[driver] }, which);
      if (rest !== again) {
        bad++;
        console.log(`  PROBLEM: ${driver} at its own default changes the value: ${rest} -> ${again}`);
      }
    }

    // THE DIRECTION, both ways round.
    for (const [driver, sign, which] of tested) {
      const step = NUDGE[driver] ?? 1;
      const rest = valueOf(defs, which);
      if (rest === null) {
        console.log(`  ${driver}: no ${which} value at rest, so nothing to compare`);
        continue;
      }
      for (const [label, want, moved] of [
        [`+${step}`, sign, valueOf({ ...defs, [driver]: Number(defs[driver]) + step }, which)],
        [`-${step}`, -sign, valueOf({ ...defs, [driver]: Number(defs[driver]) - step }, which)],
      ] as [string, number, number | null][]) {
        // A nudge can push a company past a refusal the engine is right to
        // make — a discount rate cut below the terminal growth rate makes the
        // perpetuity diverge. That is the engine working, so it is named and
        // not counted.
        if (moved === null) {
          console.log(`  ${driver} ${label}: the engine refuses the nudged model, so the direction is not tested`);
          continue;
        }
        if (Math.abs(moved - rest) <= 1e-9 * Math.max(1, Math.abs(rest))) {
          bad++;
          console.log(`  PROBLEM: ${driver} ${label} does not move the ${which} value at all (${rest.toFixed(4)})`);
          continue;
        }
        if (Math.sign(moved - rest) !== want) {
          bad++;
          console.log(
            `  PROBLEM: ${driver} ${label} moves the ${which} value THE WRONG WAY: ` +
              `${rest.toFixed(2)} -> ${moved.toFixed(2)}`
          );
        }
      }
    }
    // THE SIZE, not only the direction.
    //
    // A driver can move the value the right way and still move it by the wrong
    // amount, and until 2026-09-28 nothing here would have noticed. The
    // operating margin handler divided its shift by 1 + the stock compensation
    // share of revenue — correct while SBC was a share of operating costs, and
    // left behind when it became a share of revenue three days earlier. A
    // slider asking for one point delivered 0.87 of one on Palantir. Under-
    // moving is the right DIRECTION, so the check above passed throughout
    // (`KI-23`).
    //
    // Each driver below is DEFINED as a quantity this model computes, so the
    // assertion is exact. Only drivers whose own quantity is unambiguous are
    // listed — capital spending scales a line rather than shifting a ratio, and
    // beta is not a percentage.
    //
    // A SHIFT AND A LEVEL ARE CHECKED DIFFERENTLY, and the difference is not a
    // technicality. A slider's default is the model's own figure ROUNDED to one
    // decimal (`defaultDriversFor`). A shift handler moves the path by
    // slider - default, so the rounding appears on both sides and cancels: the
    // quantity moves by exactly the nudge. A level handler writes the slider
    // straight into the assumptions, so the quantity lands on the slider's value
    // and the rounding shows up as a difference from where it started — Apple's
    // forecast tax rate is 0.0354 of a point off its own rounded default, which
    // is the rounding and not a fault. Asserting "moved by the nudge" against a
    // level driver would fail on arithmetic that is working.
    const num2 = (v: any) => (typeof v === 'number' && isFinite(v) ? v : null);
    const SIZE: [string, 'shift' | 'level', (m: any) => number | null][] = [
      ['operatingMarginPct', 'shift', (m) => (m.revenue?.[m.nH] ? (m.ebit[m.nH] / m.revenue[m.nH]) * 100 : null)],
      ['revenueGrowthPct', 'shift', (m) => { const v = num2(m.revenueGrowth?.[m.nH]); return v === null ? null : v * 100; }],
      ['taxRatePct', 'level', (m) => { const v = num2(m.taxRate?.[m.nH]); return v === null ? null : v * 100; }],
    ];
    const modelAt = (drivers: any) => {
      try { return buildFullModel(SRC, drivers)?.model ?? null; } catch { return null; }
    };
    for (const [driver, mode, read] of SIZE) {
      if (defs[driver] === undefined || defs[driver] === null) continue;
      const restModel = modelAt(defs);
      const base = restModel && read(restModel);
      if (base === null || base === undefined) {
        console.log(`  ${driver}: its own quantity is not computed for this company, so the size is not tested`);
        continue;
      }
      for (const step of [1, -1]) {
        const asked = Number(defs[driver]) + step;
        const m = modelAt({ ...defs, [driver]: asked });
        const got = m && read(m);
        if (got === null || got === undefined) {
          console.log(`  ${driver} ${step > 0 ? '+' : ''}${step}: the engine refuses the nudged model, so the size is not tested`);
          continue;
        }
        // A tenth of a basis point on a one-point move: far inside anything a
        // handler could get wrong, far outside floating point.
        const want = mode === 'shift' ? step : asked;
        const have = mode === 'shift' ? got - base : got;
        if (Math.abs(have - want) > 1e-6) {
          bad++;
          console.log(
            `  PROBLEM: ${driver} ${step > 0 ? '+' : ''}${step} ` +
              (mode === 'shift'
                ? `moves its own quantity by ${have.toFixed(4)}, not ${want}`
                : `leaves its own quantity at ${have.toFixed(4)}, not the ${want.toFixed(4)} it asks for`)
          );
        }
      }
    }

    console.log(
      `  ${tested.length} drivers set back to their defaults and nudged both ways, ${SIZE.length} of them sized -- ` +
        `${bad ? bad + ' PROBLEMS' : 'each is a no-op at its default, each moves the value the way it reads, and each sized driver moves its own quantity by exactly what it asks for'}`
    );
    totalProblems += bad;
  }
}

// ---------------------------------------------------------------------------
// THE MYTH-VERSUS-FACT CARDS: NOT ONE WORD OF THEM IS THIS CODE'S
// ---------------------------------------------------------------------------
//
// The sixty cards were written and checked for accuracy away from this
// repository, and `src/data/myth_fact_cards.csv` is the copy of record.
// `src/data/mythFactCards.ts` is generated from it so the site can import
// typed data rather than parse a CSV in a browser.
//
// A GENERATED FILE THAT NOBODY CHECKS IS A FILE SOMEBODY EDITS. So this reads
// the CSV again, cell by cell, and compares it with what the site actually
// imports: a card reworded in the TypeScript, a condition quietly adjusted to
// match what the code does, a row dropped, a new row added by hand — any of
// them fails here. The comparison is exact, including the punctuation and the
// minus signs in the conditions, because "do not reword them" is the
// instruction the cards arrived with.
{
  console.log('\n=== the myth-versus-fact cards are the CSV, to the character ===');
  const { MYTH_FACT_CARDS } = await import(`file:///${REPO}/src/data/mythFactCards.ts`);

  /** RFC4180 enough for this file: quoted fields, doubled quotes, commas in them. */
  const parseCsv = (text: string): string[][] => {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
        } else field += c;
        continue;
      }
      if (c === '"') { quoted = true; continue; }
      if (c === ',') { row.push(field); field = ''; continue; }
      if (c === '\r') continue;
      if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
      field += c;
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows.filter((r) => r.length > 1 || (r[0] || '').trim() !== '');
  };

  const csvPath = path.join(REPO, 'src', 'data', 'myth_fact_cards.csv');
  const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
  const head = rows[0].map((h) => h.trim());
  const at = (r: string[], name: string) => r[head.indexOf(name)];
  const columns: [string, string][] = [
    ['ID', 'id'],
    ['Myth', 'myth'],
    ['Fact', 'fact'],
    ['Why', 'why'],
    ['Show when', 'showWhen'],
    ['Topic', 'topic'],
    ['Applies to', 'appliesTo'],
  ];

  const faults: string[] = [];
  for (const [column] of columns) {
    if (!head.includes(column)) faults.push(`the CSV has no "${column}" column any more`);
  }
  const cards: any[] = MYTH_FACT_CARDS as any[];
  if (rows.length - 1 !== cards.length) {
    faults.push(`the CSV has ${rows.length - 1} cards and the site imports ${cards.length}`);
  }
  let cells = 0;
  for (let i = 1; i < rows.length && !faults.length; i++) {
    const want = rows[i];
    const got = cards[i - 1];
    for (const [column, key] of columns) {
      cells++;
      const a = key === 'id' ? String(got?.id) : String(got?.[key]);
      const b = String(at(want, column));
      if (a !== b) {
        faults.push(`card ${at(want, 'ID')} ${key}: the CSV says ${JSON.stringify(b.slice(0, 70))} and the site imports ${JSON.stringify(a.slice(0, 70))}`);
      }
    }
  }

  if (faults.length) {
    totalProblems += faults.length;
    console.log(`  PROBLEM: ${faults.length} differences between the CSV and what the site imports:`);
    faults.slice(0, 6).forEach((f) => console.log(`           ${f}`));
  } else {
    console.log(`  ${cards.length} cards, ${cells} cells, identical to the CSV in every one`);
  }
}

// ---------------------------------------------------------------------------
// A CARD IS NEVER SHOWN TO A COMPANY IT DOES NOT FIT
// ---------------------------------------------------------------------------
//
// Each card carries a "Show when" condition and an audience. A card may be
// shown only when the audience includes this company AND the condition is TRUE
// on its filed figures. The third answer is what this check is really about:
//
//     A CONDITION THAT CANNOT BE ESTABLISHED IS NOT FALSE, AND IT IS NOT TRUE.
//
// A company that does not report lease liabilities has not reported lease
// liabilities of nil (standing decision 3), so a card about leases must not
// fire on it. Written the obvious way — `(a ?? 0) > (b ?? 0) * 0.2` — every
// such card fires on every company that is missing the line, which is the
// failure this check exists to prevent and the easiest one to write by
// accident.
//
// Measured over the payload set, and then on the same companies with the
// figures taken away.
{
  console.log('\n=== a myth-versus-fact card is never shown to a company it does not fit ===');
  const { MYTH_FACT_CARDS } = await import(`file:///${REPO}/src/data/mythFactCards.ts`);
  const { pickMythFactCard, CONDITIONS, Figures, cannotBeEstablished } = await import(
    `file:///${REPO}/src/data/mythFactMatch.ts`
  );
  const { isFinancialCompany } = await import(`file:///${REPO}/src/data/residualIncome.js`);

  const cards: any[] = MYTH_FACT_CARDS as any[];
  const files = fs.readdirSync(PAYLOADS).filter((f) => f.endsWith('.json'));
  const faults: string[] = [];
  let read = 0;
  let matched = 0;
  let fellBack = 0;
  const verdicts = { yes: 0, no: 0, unknown: 0 };
  const fired = new Map<number, number>();

  for (const file of files) {
    let payload: any;
    try { payload = readPayload(file); } catch { continue; }
    if (payload?.error || payload?.fetchError || !payload?.statements?.length) continue;
    read++;
    const ticker = file.replace(/\.json$/, '');
    const bank = (isFinancialCompany as any)(payload);

    for (const card of cards) {
      let v: any = null;
      try { v = (CONDITIONS as any)[card.id](new (Figures as any)(payload.statements)); } catch { v = null; }
      if (v === true) { verdicts.yes++; fired.set(card.id, (fired.get(card.id) ?? 0) + 1); }
      else if (v === false) verdicts.no++;
      else verdicts.unknown++;
      if (v !== true && v !== false && v !== null) {
        faults.push(`${ticker} card ${card.id}: the condition answered ${JSON.stringify(v)}, which is not true, false or unknown`);
      }
    }

    const choice: any = pickMythFactCard(payload, 20261024);
    if (!choice) {
      faults.push(`${ticker}: no card at all, not even one for any company`);
      continue;
    }
    // THE AUDIENCE. A bank must never be shown a card written about non-banks.
    const fits =
      choice.card.appliesTo === 'All companies' ||
      choice.card.appliesTo === (bank ? 'Banks only' : 'Non-banks only');
    if (!fits) {
      faults.push(`${ticker} is ${bank ? 'a bank' : 'not a bank'} and was shown a "${choice.card.appliesTo}" card (${choice.card.id})`);
    }
    // THE CONDITION. Whatever was shown must hold, or be a card for any company.
    let held: any = null;
    try { held = (CONDITIONS as any)[choice.card.id](new (Figures as any)(payload.statements)); } catch { held = null; }
    if (held !== true) {
      faults.push(`${ticker} was shown card ${choice.card.id}, whose condition is ${held === null ? 'not established' : 'false'}`);
    }
    if (choice.matched) matched++;
    else {
      fellBack++;
      if (choice.card.showWhen.trim().toLowerCase() !== 'any company') {
        faults.push(`${ticker} fell back to card ${choice.card.id}, which is not an "Any company" card`);
      }
    }
  }

  const never = cards.filter((c) => !fired.has(c.id));
  const unreachable = never.filter((c) => cannotBeEstablished(c.id));
  console.log(
    `  ${read} companies x ${cards.length} cards: ${verdicts.yes} conditions true, ${verdicts.no} false, ` +
      `${verdicts.unknown} that cannot be established from what the source gives us`
  );
  console.log(
    `  ${matched} companies earned a card of their own; ${fellBack} fell back to a card written for any company`
  );
  console.log(
    `  ${never.length} cards never fire, ${unreachable.length} of them because the source does not return the line: ` +
      unreachable.map((c) => c.id).join(', ')
  );

  // THE PROBE. The same companies with every filed figure taken out.
  //
  // TWO THINGS GO WRONG WHEN AN ABSENT LINE IS READ AS NIL, and only one of
  // them shows a card. `(leases ?? 0) > (debt ?? 0) / 5` never fires on a
  // company with no figures — nought is not greater than nought — so looking
  // only for cards that fire would pass it. What it actually does is turn 99
  // conditions that cannot be established into a confident "no". Both are the
  // same mistake and both are caught here: with nothing filed, every
  // condition but the three written for any company must answer UNKNOWN.
  let wrongOnEmpty = 0;
  let judgedWithNothing = 0;
  for (const file of files.slice(0, 40)) {
    let payload: any;
    try { payload = readPayload(file); } catch { continue; }
    if (!payload?.statements?.length) continue;
    const blank = {
      ...payload,
      statements: payload.statements.map((row: any) => ({ fiscalYear: row.fiscalYear, periodEnd: row.periodEnd })),
    };
    for (const card of cards) {
      let v: any = null;
      try { v = (CONDITIONS as any)[card.id](new (Figures as any)(blank.statements)); } catch { v = null; }
      if (card.showWhen.trim().toLowerCase() === 'any company') continue;
      if (v === true) {
        wrongOnEmpty++;
        if (wrongOnEmpty <= 4) {
          faults.push(
            `card ${card.id} fires on a company with no figures at all: "${card.showWhen.slice(0, 58)}" — an absent line is being read as nil`
          );
        }
      } else if (v === false) {
        judgedWithNothing++;
        if (judgedWithNothing <= 4) {
          faults.push(
            `card ${card.id} answers "no" for a company with no figures at all: "${card.showWhen.slice(0, 58)}" — it cannot be established, which is not the same as false`
          );
        }
      }
    }
  }
  if (!wrongOnEmpty && !judgedWithNothing) {
    console.log(
      '  with every filed figure removed from 40 companies, every condition but the three written for any ' +
        'company answers that it cannot be established -- none fires, and none claims a confident no'
    );
  }

  // TAKING A FIGURE AWAY CAN ONLY MAKE AN ANSWER LESS CERTAIN.
  //
  // Blanking every figure at once does not catch the commonest way this goes
  // wrong, because two absent lines compared with each other often still
  // answer. The failure needs a company that reports MOST things: Apple files
  // no dividends line in a year it earned a profit, and a condition written
  // `(dividends ?? 0) === 0 && profit > 0` then reads "pays no dividend" off a
  // line that is not there — eighteen cards shown to companies that never
  // earned them, every one of them plausible on the screen.
  //
  // So one field is removed at a time from a real company, and the rule is a
  // direction rather than a value: the verdict may stay as it was, or become
  // unknown, and NOTHING ELSE. A definite answer that changes to a different
  // definite answer because a line went missing is a line being read as nil.
  // A QUANTITY, NOT A TAG. Several quantities are filed under whichever of
  // two or three lines the company uses, and the code falls back along that
  // chain on purpose — total debt is the filed total if there is one and the
  // long and short pieces otherwise. Dropping ONE of those tags therefore
  // changes the answer legitimately, because the quantity is still reported.
  // What must never happen is the answer surviving when the whole quantity
  // goes, so each chain is removed together.
  const FIELDS: string[][] = [
    ['revenue'], ['cogs'], ['rnd'], ['sga'], ['operatingIncome'], ['pretaxIncome'], ['taxExpense'],
    ['netIncome'], ['interestExpense'], ['receivables'], ['inventory'], ['currentAssets'], ['ppeNet'],
    ['totalAssets'], ['payables'], ['currentLiabilities'], ['leaseObligations'], ['totalLiabilities'],
    ['equity'], ['goodwill'], ['intangibles'], ['depreciation'], ['capex'], ['operatingCashFlow'],
    ['buybacks'], ['stockComp'], ['dilutedShares'], ['longTermInvestments'],
    ['cash', 'shortTermInvestments', 'cashAndShortTermInvestments'],
    ['longTermDebt', 'currentDebt', 'currentDebtAndLease', 'longTermDebtAndLease', 'totalDebtReported'],
    ['dividendsPaid', 'commonDividendsPaid'],
  ];
  const judge = (statements: any[], id: number) => {
    try {
      return (CONDITIONS as any)[id](new (Figures as any)(statements));
    } catch {
      return null;
    }
  };
  let flipped = 0;
  let probed = 0;
  for (const file of ['AAPL.json', 'RELIANCE.NS.json', 'BP.L.json', 'MSFT.json'].filter((f) => files.includes(f))) {
    let payload: any;
    try { payload = readPayload(file); } catch { continue; }
    if (!payload?.statements?.length) continue;
    for (const group of FIELDS) {
      const field = group.join(' / ');
      const without = payload.statements.map((row: any) => {
        const copy = { ...row };
        for (const one of group) delete copy[one];
        return copy;
      });
      for (const card of cards) {
        if (card.showWhen.trim().toLowerCase() === 'any company') continue;
        probed++;
        const before = judge(payload.statements, card.id);
        const after = judge(without, card.id);
        if (after !== before && after !== null) {
          flipped++;
          if (flipped <= 4) {
            faults.push(
              `card ${card.id} on ${file.replace(/.json$/, '')}: dropping ${field} turned ${String(before)} into ` +
                `${String(after)} rather than into "cannot be established" — the absent line is being read as a figure`
            );
          }
        }
      }
    }
  }
  if (!flipped) {
    console.log(
      `  ${probed.toLocaleString('en-US')} answers re-tested with one filed line removed at a time: every one ` +
        'either held or became unknown, none turned into a different answer'
    );
  }

  if (faults.length) {
    totalProblems += faults.length;
    console.log(`  PROBLEM: ${faults.length} cards shown to a company they do not fit:`);
    faults.slice(0, 8).forEach((f) => console.log(`           ${f}`));
  } else {
    console.log('  every card shown is one whose audience includes the company and whose condition holds on its filings');
  }
}


// ---- the explainers are whole, and reachable -------------------------------
//
// Eight articles served as static HTML at /learn/<slug>/ rather than as screens
// in the application, so that a crawler gets the text without executing
// anything (`src/data/explainers.ts` says why at length). The build writes them;
// this is what stops the build writing something wrong.
//
// The generator already refuses a markdown construct it cannot render and a
// title that does not match its file. What it cannot check on its own is
// whether the page it produced still contains the article: a renderer that
// dropped every paragraph would write eight valid, beautifully typeset, empty
// documents. So each article is rendered here and every sentence of the source
// is looked for in the output.
{
  console.log('\n=== the explainers ===');
  const { EXPLAINERS, explainerPath } = await import(`file:///${REPO}/src/data/explainers.ts`);
  const CONTENT = path.join(REPO, 'content', 'explainers');
  let bad = 0;

  const files = fs.existsSync(CONTENT)
    ? fs.readdirSync(CONTENT).filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, ''))
    : [];
  const slugs: string[] = (EXPLAINERS as any[]).map((e) => e.slug);

  for (const slug of files)
    if (!slugs.includes(slug)) { bad++; console.log(`  PROBLEM: ${slug}.md is not listed, so nothing links to it`); }
  for (const slug of slugs)
    if (!files.includes(slug)) { bad++; console.log(`  PROBLEM: "${slug}" is listed but has no markdown file`); }

  // The built pages, if there are any. `npm run build` writes them; a checkout
  // that has not been built yet is not a failure, and is said rather than
  // passed over in silence.
  const DIST = path.join(REPO, 'dist', 'learn');
  let words = 0;
  if (!fs.existsSync(DIST)) {
    console.log('  dist/learn is not built, so only the sources are checked here; run npm run build');
  } else {
    for (const entry of EXPLAINERS as any[]) {
      const page = path.join(DIST, entry.slug, 'index.html');
      if (!fs.existsSync(page)) { bad++; console.log(`  PROBLEM: ${explainerPath(entry.slug)} was not built`); continue; }
      const html = fs.readFileSync(page, 'utf8');
      const md = fs.readFileSync(path.join(CONTENT, `${entry.slug}.md`), 'utf8').replace(/\r\n/g, '\n');

      // Every prose line of the source must be findable in the page. Compared
      // after the same escaping the generator applies, so an apostrophe or an
      // ampersand is not mistaken for a missing paragraph.
      const esc = (s: string) =>
        s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      const prose = md
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#') && !l.startsWith('|'));
      const lost = prose.filter((l) => !html.includes(esc(l)));
      if (lost.length) {
        bad += lost.length;
        console.log(`  PROBLEM: ${entry.slug} is missing ${lost.length} of its ${prose.length} paragraphs`);
        console.log(`           first: "${lost[0].slice(0, 70)}…"`);
      }
      words += prose.join(' ').split(/\s+/).length;

      // The three things that make it findable at all, and the one that makes
      // it navigable: a title, a description, a canonical address, and a way
      // back to the others.
      for (const [what, re] of [
        ['a <title>', /<title>[^<]{10,}<\/title>/],
        ['a meta description', /<meta name="description" content="[^"]{40,}"/],
        ['a canonical link', new RegExp(`<link rel="canonical" href="https?://[^"]+${entry.slug}/"`)],
        ['an H1', new RegExp(`<h1>${esc(entry.title).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</h1>`)],
        ['a link to the index', /href="\/learn\/"/],
      ] as [string, RegExp][]) {
        if (!re.test(html)) { bad++; console.log(`  PROBLEM: ${entry.slug} has no ${what}`); }
      }
      // And no script: these pages are meant to need nothing executed.
      if (/<script/i.test(html)) { bad++; console.log(`  PROBLEM: ${entry.slug} carries a script tag`); }
    }
    const sitemap = path.join(REPO, 'dist', 'sitemap.xml');
    if (!fs.existsSync(sitemap)) { bad++; console.log('  PROBLEM: no sitemap.xml was written'); }
    else {
      const xml = fs.readFileSync(sitemap, 'utf8');
      const missing = slugs.filter((s) => !xml.includes(`${explainerPath(s)}<`));
      if (missing.length) { bad += missing.length; console.log(`  PROBLEM: the sitemap omits ${missing.join(', ')}`); }
    }
  }

  console.log(
    `  ${slugs.length} articles${words ? `, ${words.toLocaleString('en-GB')} words, every paragraph present in the built page` : ''} -- ` +
      `${bad ? bad + ' PROBLEMS' : 'each listed, built, titled, described, canonical and linked'}`
  );
  totalProblems += bad;
}

// ---- the palette is one palette, and it is legible ------------------------
//
// The colours used to be declared as local constants at the top of eight
// components and applied as inline styles, and the same five or six hex codes
// were written out in each. The eyebrow red was 3.90:1 on the dark ground and
// 4.43:1 on paper — under the 4.5:1 floor for normal text, at the top of every
// section on the site — and nobody could see that from inside any one file.
//
// Three things are checked. The TypeScript half of the palette and the CSS half
// must agree, because a stylesheet cannot import a module and a component
// cannot read a custom property, so there are necessarily two declarations.
// Every token that carries words must clear the floor on every ground it is
// used on. And no component may declare a palette colour of its own again,
// which is the habit that produced the drift.
{
  console.log('\n=== the palette ===');
  const T: any = await import(`file:///${REPO}/src/design/tokens.ts`);
  let bad = 0;

  // -- contrast, from the tokens themselves
  const relLum = (hex: string) => {
    const v = hex.replace('#', '');
    const lin = [0, 2, 4]
      .map((i) => parseInt(v.slice(i, i + 2), 16) / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  };
  const contrast = (a: string, b: string) => {
    const [x, y] = [relLum(a), relLum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };

  let worst = { ratio: Infinity, what: '' };
  const measure = (token: string, colour: string, groundName: string, ground: string) => {
    const r = contrast(colour, ground);
    if (r < worst.ratio) worst = { ratio: r, what: `${token} on ${groundName}` };
    if (r < T.CONTRAST_FLOOR) {
      bad++;
      console.log(
        `  PROBLEM: ${token} (${colour}) is ${r.toFixed(2)}:1 on ${groundName} (${ground}), ` +
          `under the ${T.CONTRAST_FLOOR}:1 floor for normal text`
      );
    }
  };
  for (const token of T.TEXT_ON_DARK)
    for (const groundToken of T.DARK_GROUNDS)
      measure(`DARK.${token}`, T.DARK[token], `DARK.${groundToken}`, T.DARK[groundToken]);
  for (const token of T.TEXT_ON_PAPER)
    for (const groundToken of T.PAPER_GROUNDS)
      measure(`PAPER.${token}`, T.PAPER[token], `PAPER.${groundToken}`, T.PAPER[groundToken]);

  // -- boundaries and chart marks: 3:1 (WCAG 1.4.11, docs/VISUAL_SYSTEM.md §7)
  //
  // The 4.5:1 floor is for words. A control's boundary, a focus indicator and a
  // chart mark need 3:1, and the decorative hairline (`line`, 1.28:1) can be
  // none of them — which is why `lineControl` exists. Measured on every ground
  // the token is drawn on, the same way the words are.
  let worstBoundary = { ratio: Infinity, what: '' };
  let boundaryPairs = 0;
  const measureBoundary = (token: string, colour: string, groundName: string, ground: string) => {
    boundaryPairs++;
    const r = contrast(colour, ground);
    if (r < worstBoundary.ratio) worstBoundary = { ratio: r, what: `${token} on ${groundName}` };
    if (r < T.BOUNDARY_FLOOR) {
      bad++;
      console.log(
        `  PROBLEM: ${token} (${colour}) is ${r.toFixed(2)}:1 on ${groundName} (${ground}), ` +
          `under the ${T.BOUNDARY_FLOOR}:1 floor for a boundary or a chart mark`
      );
    }
  };
  for (const token of T.BOUNDARY_ON_DARK)
    for (const groundToken of T.DARK_GROUNDS)
      measureBoundary(`DARK.${token}`, T.DARK[token], `DARK.${groundToken}`, T.DARK[groundToken]);
  for (const token of T.BOUNDARY_ON_PAPER)
    for (const groundToken of T.PAPER_GROUNDS)
      measureBoundary(`PAPER.${token}`, T.PAPER[token], `PAPER.${groundToken}`, T.PAPER[groundToken]);
  for (const series of T.CHART_SERIES)
    for (const groundToken of T.CHART_GROUNDS)
      measureBoundary(`CHART.${series.key}`, series.colour, `DARK.${groundToken}`, T.DARK[groundToken]);

  // Five series is the hard cap, and no two may share a stroke: a chart has to
  // read in greyscale, where two lines of different colour and the same dash
  // are the same line.
  if (T.CHART_SERIES.length > 5) {
    bad++;
    console.log(`  PROBLEM: ${T.CHART_SERIES.length} chart series; five is the cap`);
  }
  const dashes = T.CHART_SERIES.map((x: any) => x.dash);
  const sharedDash = dashes.filter((d: string, i: number) => d !== 'solid' && dashes.indexOf(d) !== i);
  // Two solid series are allowed only because the second sits on its own axis
  // with its own direct label (the Two-Axis Rule); a third would not be.
  if (sharedDash.length || dashes.filter((d: string) => d === 'solid').length > 2) {
    bad++;
    console.log(`  PROBLEM: chart series share a stroke (${dashes.join(' | ')}), so they cannot be told apart in greyscale`);
  }

  // -- the sequential ramps: in order, and honest about their pale steps
  //
  // On the dark ground the lightest step is the largest value; on paper the
  // darkest is. A ramp out of order encodes a value backwards, and nothing on
  // the screen would say so. The pale steps cannot reach 3:1, so the tokens
  // name them (`SEQUENTIAL_NEEDS_OUTLINE`) and a cell drawn in one needs an
  // outline and a printed value; the list must be exactly the steps that fail,
  // or a step that needs an outline would go without one.
  const ramps: [string, readonly string[], string[], 'up' | 'down'][] = [
    ['dark', T.SEQUENTIAL.dark, T.DARK_GROUNDS.filter((g: string) => g !== 'overlay').map((g: string) => T.DARK[g]), 'up'],
    ['paper', T.SEQUENTIAL.paper, T.PAPER_GROUNDS.map((g: string) => T.PAPER[g]), 'down'],
  ];
  for (const [name, steps, grounds, direction] of ramps) {
    for (let i = 1; i < steps.length; i++) {
      const rising = relLum(steps[i]) > relLum(steps[i - 1]);
      if (rising !== (direction === 'up')) {
        bad++;
        console.log(
          `  PROBLEM: the ${name} sequential ramp is out of order at step ${i + 1} (${steps[i - 1]} then ${steps[i]}); ` +
            `on ${name === 'dark' ? 'the dark ground the lightest' : 'paper the darkest'} step must be the largest value`
        );
      }
    }
    const pale = steps
      .map((c, i) => (grounds.some((g) => contrast(c, g) < T.BOUNDARY_FLOOR) ? i : -1))
      .filter((i) => i >= 0);
    const declared = [...(T.SEQUENTIAL_NEEDS_OUTLINE[name] as readonly number[])];
    if (pale.join(',') !== declared.join(',')) {
      bad++;
      console.log(
        `  PROBLEM: the ${name} ramp's steps under ${T.BOUNDARY_FLOOR}:1 are [${pale.map((i) => i + 1).join(', ')}] ` +
          `but SEQUENTIAL_NEEDS_OUTLINE.${name} names [${declared.map((i) => i + 1).join(', ')}]`
      );
    }
  }

  // The mark is not text and is not expected to clear the floor; what it must
  // not do is stop hanging in the gutter.
  if (T.MARK.marginRight !== '-0.21em') {
    bad++;
    console.log(`  PROBLEM: the mark's right margin is ${T.MARK.marginRight}, not -0.21em, so it has advance width`);
  }

  // -- the two halves of the palette agree
  const css = fs.readFileSync(path.join(REPO, 'src', 'index.css'), 'utf8');
  const root = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));
  for (const [name, expected] of Object.entries(T.CSS_VARIABLES as Record<string, string>)) {
    const found = new RegExp(`${name}\\s*:\\s*([^;]+);`).exec(root)?.[1]?.trim();
    if (!found) {
      bad++;
      console.log(`  PROBLEM: src/index.css declares no ${name}; src/design/tokens.ts says it should be ${expected}`);
    } else if (found.toUpperCase() !== expected.toUpperCase()) {
      bad++;
      console.log(`  PROBLEM: ${name} is ${found} in src/index.css and ${expected} in src/design/tokens.ts`);
    }
  }

  // -- the type steps agree too (build step 8, job 8.2)
  //
  // `SIZE` in tokens.ts and `--m-size-*` in the stylesheet's @theme block are
  // the same scale written twice, for the same reason the colours are. A step
  // changed in one and not the other would leave the size check in the
  // browser (which reads the tokens) measuring against a scale the page is
  // not set in.
  const themeAt = css.indexOf('@theme {');
  const theme = css.slice(themeAt, css.indexOf('\n}', themeAt));
  let sizesCompared = 0;
  for (const [step, expected] of Object.entries(T.SIZE as Record<string, string>)) {
    sizesCompared++;
    const name = `--m-size-${step}`;
    const found = new RegExp(`${name}\\s*:\\s*([^;]+);`).exec(theme)?.[1]?.trim();
    if (!found) {
      bad++;
      console.log(`  PROBLEM: src/index.css @theme declares no ${name}; src/design/tokens.ts SIZE.${step} is ${expected}`);
    } else if (found.replace(/\s+/g, '') !== expected.replace(/\s+/g, '')) {
      bad++;
      console.log(`  PROBLEM: ${name} is ${found} in src/index.css and ${expected} in src/design/tokens.ts`);
    }
  }
  for (const step of [...T.SIZE_STEPS_EVERYWHERE, ...T.SIZE_STEPS_LANDING_ONLY]) {
    if (!(step in T.SIZE)) {
      bad++;
      console.log(`  PROBLEM: the step list names ${step}, which SIZE does not define`);
    }
  }
  if (T.HERO_FIGURE_SIZE !== T.SIZE.title) {
    bad++;
    console.log(`  PROBLEM: the hero figure is ${T.HERO_FIGURE_SIZE}, not the title step; there is no 40px size (COMPANY_OVERVIEW D1)`);
  }

  // -- nobody declares their own again
  const COMPONENTS = path.join(REPO, 'src', 'components');
  const strays: string[] = [];
  for (const file of fs.readdirSync(COMPONENTS).filter((f) => /\.tsx?$/.test(f))) {
    const text = fs.readFileSync(path.join(COMPONENTS, file), 'utf8');
    for (const m of text.matchAll(/^const\s+([A-Z][A-Z_0-9]*)\s*(?::[^=]+)?=\s*'(#[0-9A-Fa-f]{3,8})'/gm))
      strays.push(`${file}: const ${m[1]} = '${m[2]}'`);
  }
  if (strays.length) {
    bad += strays.length;
    console.log('  PROBLEM: a component declares its own palette colour, which is how the last one drifted:');
    for (const s of strays.slice(0, 10)) console.log(`           ${s}`);
  }

  const counted = T.TEXT_ON_DARK.length * T.DARK_GROUNDS.length + T.TEXT_ON_PAPER.length * T.PAPER_GROUNDS.length;
  console.log(
    `  ${counted} text-and-ground pairs and ${boundaryPairs} boundary-and-ground pairs measured, ` +
      `2 sequential ramps checked, ${Object.keys(T.CSS_VARIABLES).length} custom properties and ${sizesCompared} type steps compared ` +
      `against src/index.css -- ${
        bad
          ? bad + ' PROBLEMS'
          : `words all clear ${T.CONTRAST_FLOOR}:1, worst ${worst.ratio.toFixed(2)}:1 (${worst.what}); ` +
            `boundaries and chart marks all clear ${T.BOUNDARY_FLOOR}:1, worst ${worstBoundary.ratio.toFixed(2)}:1 (${worstBoundary.what})`
      }`
  );
  totalProblems += bad;
}


// ---- motion runs on the tokens, and only on the properties that may move ----
//
// `docs/VISUAL_BUILD_PLAN.md` job 8.3, VISUAL_SYSTEM §12.2–12.4. Every
// duration and curve is meant to be an `--m-*` token (`EASE`, `DURATION_MS`,
// `MOTION_JS` in tokens.ts); nothing animates `all`; and only transform,
// opacity, the chart's clip-path, the colours a hover changes and the
// disclosure's height may move. The source is scanned, comments removed, for
// three things:
//
//   all       `transition-all`, `transition: all`
//   literal   a duration, delay or curve written out rather than taken from a
//             token: Tailwind `duration-500` / `delay-100` / `ease-out`; a
//             CSS transition or animation with `ms`, `s`, `cubic-bezier(` or a
//             keyword curve; a motion `duration:` / `delay:` number or an
//             `ease:` array or string
//   property  something animated outside the allowed set: a bare Tailwind
//             `transition` or `transition-shadow` / `transition-[…]`, a CSS
//             transition on another property, a motion `animate` / `initial`
//             / `exit` / `while…` key outside the set
//
// THE RATCHET (decision V4). Today's code breaks these in many files, and
// fixing every component belongs to step 9, not to the job that writes the
// tokens. So each file's count per category is recorded below and may FALL but
// never RISE; a file not listed must be zero. Lower a number when a job
// removes some; delete the file's entry when it reaches zero. Measured on
// 2026-11-04.
{
  console.log('\n=== motion: one set of tokens, and only properties that may move ===');
  const MOTION_RATCHET: Record<string, { all?: number; literal?: number; property?: number }> = {
    'src/components/CoverageStatsSection.tsx': { literal: 2 },
    'src/components/EtymologySection.tsx': { literal: 22, property: 2 },
    'src/components/HeroSection.tsx': { all: 1, literal: 19, property: 2 },
    'src/components/MechanismSection.tsx': { literal: 17 },
    'src/components/MethodologyGrid.tsx': { all: 1, literal: 4 },
    'src/components/TerminalDashboard.tsx': { literal: 9, property: 2 },
    'src/components/figuresEditor.tsx': { literal: 1 },
    'src/components/figuresHint.tsx': { literal: 2 },
    'src/components/instrument.tsx': { literal: 3 },
    'src/components/landingPage.tsx': { all: 1, literal: 1 },
    'src/components/motionPrimitives.tsx': { literal: 16, property: 1 },
    'src/index.css': { literal: 3 },
  };

  const ALLOWED_CSS = new Set([
    'transform', 'translate', 'scale', 'rotate', 'opacity', 'clip-path',
    'color', 'background-color', 'border-color', 'outline-color', 'height', 'none',
  ]);
  const ALLOWED_MOTION = new Set([
    'opacity', 'x', 'y', 'scale', 'scaleX', 'scaleY', 'rotate', 'clipPath',
    'translateX', 'translateY', 'transform', 'color', 'backgroundColor', 'borderColor', 'transition',
    // The disclosure's height is the one height animation VISUAL_SYSTEM §4
    // allows. A scan cannot tell a disclosure from a bar growing, so height is
    // allowed everywhere and the bars are left to the step-9 review.
    'height',
  ]);
  const count = (text: string, re: RegExp) => (text.match(re) || []).length;
  const scan = (raw: string) => {
    const text = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const all = count(text, /\btransition-all\b|\btransition(?:-property)?\s*:\s*['"`]?\s*all\b/g);
    let literal =
      count(text, /(?<![\w-])(?:duration|delay)-\d+\b/g) +
      count(text, /(?<![\w-])ease-(?:in-out|in|out|linear)\b/g) +
      // Not after a hyphen: `animation-duration:` is CSS, counted below, once.
      count(text, /(?<![\w-])(?:duration|delay|repeatDelay)\s*:\s*(?:reduced\s*\?\s*0\s*:\s*)?\d*\.?\d/g) +
      count(text, /(?<![\w-])ease\s*:\s*(?:\[|['"])/g);
    // A bare Tailwind `transition` (which moves box-shadow and filter among
    // others) only counts inside a class list: a quoted string of several
    // words, at least one of them shaped like a utility (`px-3`, `hover:…`).
    // A label such as the Financials tab's "11M transition" column is not one.
    let property = 0;
    for (const q of text.matchAll(/(["'`])([^"'`\n]*?)\1/g))
      if (/\s/.test(q[2].trim()) && /(?:^|\s)[a-z0-9]+(?::[\w-]+)*-[\w\[\]#./%-]+/.test(q[2]))
        property += count(q[2], /(?<![\w-])transition(?:-shadow|-\[[^\]]*\])?(?![\w-])/g);
    for (const m of text.matchAll(/\b(transition|animation)(-duration|-delay|-timing-function|-property)?\s*:\s*([^;}\n]*)/g)) {
      const value = m[3].replace(/var\(--m-[a-z-]+\)/g, '');
      if (m[2] !== '-property' && /\d*\.?\d+m?s\b|cubic-bezier\(|\b(?:ease|ease-in|ease-out|ease-in-out|linear|step-start|step-end)\b/.test(value))
        literal++;
      if (m[1] === 'transition' && (!m[2] || m[2] === '-property')) {
        for (const part of value.split(',')) {
          const prop = part.trim().replace(/^['"`]/, '').split(/\s+/)[0];
          if (prop && /^[a-z-]+$/.test(prop) && prop !== 'all' && !ALLOWED_CSS.has(prop)) property++;
        }
      }
    }
    for (const m of text.matchAll(/\b(?:animate|initial|exit|whileHover|whileTap|whileInView|whileFocus)\s*=\s*\{\{([^}]*)\}\}/g))
      for (const k of m[1].matchAll(/(\w+)\s*:/g)) if (!ALLOWED_MOTION.has(k[1])) property++;
    return { all, literal, property };
  };

  const SRC = path.join(REPO, 'src');
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(tsx?|css)$/.test(entry.name)) files.push(full);
    }
  };
  walk(SRC);

  let bad = 0;
  const totals = { all: 0, literal: 0, property: 0 };
  const recorded = { all: 0, literal: 0, property: 0 };
  const found: Record<string, { all: number; literal: number; property: number }> = {};
  for (const file of files) {
    const rel = path.relative(REPO, file).split(path.sep).join('/');
    // The tokens are where the values are SUPPOSED to be written.
    if (rel === 'src/design/tokens.ts') continue;
    const got = scan(fs.readFileSync(file, 'utf8'));
    if (got.all || got.literal || got.property) found[rel] = got;
    for (const k of ['all', 'literal', 'property'] as const) {
      totals[k] += got[k];
      const limit = MOTION_RATCHET[rel]?.[k] ?? 0;
      if (got[k] > limit) {
        bad++;
        console.log(
          `  PROBLEM: ${rel} has ${got[k]} ${k === 'all' ? '"transition: all"' : k === 'literal' ? 'duration or curve literal' : 'animated property outside the allowed set'}` +
            `${got[k] === 1 ? '' : 's'}, more than the ${limit} recorded; the ratchet only falls`
        );
      } else if (got[k] < limit) {
        console.log(`  NOTE: ${rel} is down to ${got[k]} ${k}, from ${limit}: lower MOTION_RATCHET to match`);
      }
    }
  }
  for (const entry of Object.values(MOTION_RATCHET))
    for (const k of ['all', 'literal', 'property'] as const) recorded[k] += entry[k] ?? 0;
  if (process.env.MOTION_MEASURE) console.log('  MEASURED ' + JSON.stringify(found));

  console.log(
    `  ${files.length - 1} source files scanned: ${totals.all} "transition: all", ${totals.literal} duration or curve literals, ` +
      `${totals.property} animated properties outside the allowed set (recorded ${recorded.all} / ${recorded.literal} / ${recorded.property}) -- ` +
      `${bad ? bad + ' PROBLEMS' : 'none above the ratchet'}`
  );
  totalProblems += bad;
}

// ---------------------------------------------------------------------------
// ONE CURRENCY THROUGHOUT: THE STATEMENTS, THE DISCOUNT RATE AND THE PRICE
// ---------------------------------------------------------------------------
//
// The site models a company in the currency its statements are in and discounts
// at that currency's own government bond yield (`METHODOLOGY.md` S3 and S14).
// Three separate fetches have to agree for that to be true -- the statements'
// units, the risk-free publisher, and the quote after conversion -- and until
// this check nothing asserted that they did. The invariant held on every payload
// by construction of code that anyone could change, which is the definition of
// an unguarded invariant: a mixed model discounts a dollar cash flow at a rupee
// rate and says nothing at all.
//
// Four things are asserted over every payload on disk:
//
//   1. THE THREE CURRENCIES AGREE. `meta.currency` (what every figure on the
//      screen is labelled), `quote.currency` (the price after conversion) and
//      `riskFree.currency` (where the discount rate came from) all equal the
//      reporting currency the filing states. A company where they cannot be
//      made to agree must be refused, not valued.
//
//   2. THE TRADING-CURRENCY FIGURE IS IN THE EXCHANGE'S OWN UNITS. The price
//      put back into the trading currency is compared with `quote.asQuoted`,
//      which the fetcher recorded separately before converting anything. The
//      two come from opposite sides of the conversion, so agreement means the
//      rate and its direction are both right -- a figure compared with itself
//      would prove neither (`CLAUDE.md`).
//
//   3. THE RATE PRINTED BESIDE A PAIR'S NAME IS THAT PAIR'S RATE. This is the
//      one that was wrong: the provenance line named GBPUSD=X and printed
//      0.013246, the composite applied to a quote in pence, where the pair is
//      1.3246. Ten of the forty-nine converted companies, every .L plus NPN.JO
//      and TEVA.TA. Reading the sentence rather than the field behind it is
//      deliberate: the fields were right and the sentence was wrong.
//
//   4. THE CHECK ITSELF CAN FAIL. Two copies of a real payload are mixed on
//      purpose -- one with the price left in rupees against dollar statements,
//      one discounted at a rupee bond yield with dollar statements -- and
//      part 1's own test is run over them. If it reports nothing, it guards
//      nothing.
{
  console.log('\n=== one currency: the statements, the discount rate and the price ===');
  const { buildCompanyFrom } = await import(`file:///${REPO}/src/data/autoCompany.ts`);
  const { inTradingCurrency } = await import(`file:///${REPO}/src/data/tradingCurrency.ts`);

  /** Everything mixed about one company, as sentences. Empty is correct. */
  const currencyFaults = (built: any, fetched: any): string[] => {
    const faults: string[] = [];
    const meta = built?.modelData?.meta;
    const basis = meta?.currencyBasis;
    const reporting = basis?.reportingCurrency ?? null;
    const refused = Boolean(meta?.listingRefusal || meta?.riskFreeRefusal);
    // A company with no stated reporting currency is refused by gate 1, and
    // that refusal is checked elsewhere. There is nothing to compare here.
    if (!reporting) {
      if (!refused) faults.push('no reporting currency is stated, and the company is not refused');
      return faults;
    }
    const label = meta?.currency ?? null;
    if (label && label !== reporting) {
      faults.push(`every figure is labelled ${label}, the statements are in ${reporting}`);
    }
    const stamped = (basis.statementCurrencies ?? []).filter((c: string) => c && c !== reporting);
    if (stamped.length && !refused) {
      faults.push(`figures stamped ${stamped.join(', ')} against statements in ${reporting}, and not refused`);
    }
    const quoteCurrency = fetched?.quote?.currency ?? null;
    if (quoteCurrency && quoteCurrency !== reporting && !refused) {
      faults.push(`the price shown is in ${quoteCurrency}, the statements are in ${reporting}, and not refused`);
    }
    // THE RATE THE MODEL DISCOUNTS AT, not the one the payload happens to
    // carry: a rate that was fetched and then refused reaches no valuation,
    // and reading the assumption the cost of capital was built from is the
    // only way to tell the two apart.
    const rfCurrency = meta?.riskFree?.currency ?? fetched?.riskFree?.currency ?? null;
    const rfUsed = built?.modelData?.dcf?.costOfCapital?.riskFreeRate;
    if (typeof rfUsed === 'number' && rfCurrency && rfCurrency !== reporting) {
      faults.push(`discounted at the ${rfCurrency} bond yield against statements in ${reporting}`);
    }
    return faults;
  };

  const files = fs.readdirSync(PAYLOADS).filter((f) => f.endsWith('.json'));
  let read = 0, agreed = 0, crossCurrency = 0, unbuilt = 0;
  const mixed: string[] = [];
  const unitFaults: string[] = [];
  const rateFaults: string[] = [];

  for (const file of files) {
    let fetched: any;
    try { fetched = readPayload(file); } catch { continue; }
    if (fetched?.error || fetched?.fetchError) continue;
    read++;
    let built: any;
    try { built = buildCompanyFrom(fetched); } catch { unbuilt++; continue; }
    const ticker = file.replace(/\.json$/, '');

    const faults = currencyFaults(built, fetched);
    if (faults.length) mixed.push(`${ticker}: ${faults.join('; ')}`);
    else agreed++;

    const basis = built?.modelData?.meta?.currencyBasis;
    const shown = inTradingCurrency(built?.price, basis);
    if (!shown) continue;
    crossCurrency++;

    // 2. against the figure the exchange published, as the fetcher stored it
    //    before it converted anything.
    const asQuoted = fetched?.quote?.asQuoted;
    const factor = basis?.minorUnitFactor;
    if (typeof asQuoted?.price === 'number' && typeof factor === 'number') {
      const expected = asQuoted.price * factor;
      // The payload carries the converted price rounded to the cent, and a cent
      // of a reporting currency is worth more than a cent of a cheaper trading
      // one. So the tolerance is that rounding carried back through the rate,
      // not a judgement about how close a rate ought to be.
      const tolerance = Math.max(0.02, (0.005 / (basis.tradingCurrencyRate || 1)) * 2);
      if (Math.abs(shown.amount - expected) > tolerance) {
        unitFaults.push(
          `${ticker}: shown as ${shown.amount.toFixed(2)} ${shown.currency}, ` +
            `the exchange quoted ${asQuoted.price} ${asQuoted.currency} = ${expected.toFixed(2)} ${shown.currency}`
        );
      }
    }

    // 3. the sentence the reader is given, not the field behind it.
    if (basis?.pair) {
      const sentence: string = built?.modelData?.provenance?.currency ?? built?.provenance?.currency ?? '';
      const named = sentence.match(/converted at ([\d.]+) ([A-Z]{3}) per ([A-Z]{3})[^(]*\(([A-Z]{3})([A-Z]{3})=X/);
      if (!named) {
        rateFaults.push(
          `${ticker}: no rate is named against the pair ${basis.pair} -- "${sentence.slice(0, 110)}"`
        );
      } else {
        const printed = Number(named[1]);
        const per = named[2];
        const unit = named[3];
        const pairFrom = named[4];
        const pairTo = named[5];
        if (pairFrom !== unit || pairTo !== per) {
          rateFaults.push(`${ticker}: the line says ${per} per ${unit} and names ${pairFrom}${pairTo}=X`);
        }
        const actual = basis.tradingCurrencyRate;
        if (!(typeof actual === 'number' && Math.abs(printed / actual - 1) < 0.001)) {
          rateFaults.push(
            `${ticker}: the line says ${pairFrom}${pairTo}=X is ${printed}, and the rate it converts at is ${actual}`
          );
        }
      }
    }
  }

  console.log(
    `  ${read} payloads read, ${unbuilt} building no model, ` +
      `${agreed} with the statements, the discount rate and the price in one currency, ` +
      `${crossCurrency} trading in a currency their statements are not in`
  );
  if (mixed.length) {
    totalProblems += mixed.length;
    console.log(`  PROBLEM: ${mixed.length} companies mix currencies and are valued anyway:`);
    mixed.slice(0, 10).forEach((m) => console.log(`           ${m}`));
  } else {
    console.log('  no company is modelled in one currency and priced or discounted in another');
  }
  if (unitFaults.length) {
    totalProblems += unitFaults.length;
    console.log(`  PROBLEM: ${unitFaults.length} trading-currency figures are not in the units the exchange quoted:`);
    unitFaults.slice(0, 10).forEach((m) => console.log(`           ${m}`));
  } else if (crossCurrency) {
    console.log(`  all ${crossCurrency} trading-currency figures land on the price the exchange published, in its own units`);
  }
  if (rateFaults.length) {
    totalProblems += rateFaults.length;
    console.log(`  PROBLEM: ${rateFaults.length} disclosed rates do not match the pair they are named with:`);
    rateFaults.slice(0, 10).forEach((m) => console.log(`           ${m}`));
  } else if (crossCurrency) {
    console.log('  every disclosed rate is the rate of the pair it names');
  }

  // 4. THE CHECK CAN FAIL. Both mixtures are built from a real payload, so the
  //    only thing different about them is the currency.
  const probeFile = files.includes('INFY.NS.json') ? 'INFY.NS.json' : files[0];
  const probeBase = readPayload(probeFile);
  const probes = [
    {
      what: 'the price left in the currency it was quoted in',
      payload: {
        ...probeBase,
        priceConversion: null,
        quote: { ...probeBase.quote, currency: 'INR', price: 1000.2 },
      },
    },
    {
      what: 'a rupee bond yield against dollar statements',
      payload: { ...probeBase, riskFree: { ...probeBase.riskFree, currency: 'INR' } },
    },
  ];
  let caught = 0;
  for (const probe of probes) {
    let built: any = null;
    try {
      built = buildCompanyFrom(probe.payload);
    } catch {
      /* a model that cannot be built at all is a catch too */
    }
    const faults = built ? currencyFaults(built, probe.payload) : ['the model could not be built at all'];
    const meta = built?.modelData?.meta;
    const refusal = meta?.listingRefusal?.reason ?? (meta?.riskFreeRefusal ? `riskFreeRateUnavailable` : null);
    // THE INVARIANT IS THAT A MIXED COMPANY IS NEVER VALUED, so either this
    // check reports the mixture or the engine refuses it outright. Both
    // count; what must not happen is a value coming out the other end.
    if (faults.length || refusal) {
      caught++;
      console.log(`  caught: ${probe.what} -- ${faults[0] ?? `refused as ${refusal}`}`);
    } else {
      totalProblems++;
      console.log(`  PROBLEM: ${probe.what} was valued anyway, and nothing reported it`);
    }
  }
  if (caught === probes.length) {
    console.log(`  neither deliberate mixture reaches a value: the check is able to fail`);
  }
}


// ---------------------------------------------------------------------------
// THE COMPANY PAGE: NO FIGURE IS EVER A ZERO IT DOES NOT HAVE
// ---------------------------------------------------------------------------
//
// Standing decision 3: missing data is never treated as zero, because zero is a
// claim the company reported zero. A summary panel is where that rule is
// easiest to break and hardest to see broken — `price / earnings` on a filer
// that reports no earnings is `x / 0`, and the arithmetic hands back Infinity,
// NaN or 0 depending which way it was written, all three of which render as
// something that looks like a figure.
//
// So `companyOverview.ts` carries the rule as a shape rather than a habit: a
// stat has a number, or it has an em dash AND a sentence saying what is not
// there. This asserts the two can never come apart, over every payload on disk,
// and then strips the inputs out of a real company and asserts the panel dashes
// instead of filling with zeros.
{
  console.log('\n=== the company page: a missing figure is a dash with a reason, never a zero ===');
  const { overviewStats, formatStat } = await import(`file:///${REPO}/src/data/companyOverview.ts`);

  const files = fs.readdirSync(PAYLOADS).filter((f) => f.endsWith('.json'));
  let read = 0;
  let statsSeen = 0;
  let dashes = 0;
  const faults: string[] = [];

  const audit = (ticker: string, result: any) => {
    for (const stat of result.stats) {
      statsSeen++;
      const shown = formatStat(stat, result.currencySymbol);
      const hasValue = stat.value !== null;
      if (hasValue && stat.missing) {
        faults.push(`${ticker} ${stat.key}: has a value AND a reason for not having one`);
      }
      if (!hasValue) {
        dashes++;
        if (!stat.missing || !stat.missing.trim()) {
          faults.push(`${ticker} ${stat.key}: no figure and no reason given`);
        }
        if (shown !== '—') {
          faults.push(`${ticker} ${stat.key}: no figure, but the screen prints "${shown}"`);
        }
      } else {
        if (!isFinite(stat.value)) {
          faults.push(`${ticker} ${stat.key}: the value is ${stat.value}, which is not a number`);
        }
        if (shown === '—') {
          faults.push(`${ticker} ${stat.key}: has the value ${stat.value} and prints a dash`);
        }
      }
    }
  };

  for (const file of files) {
    let payload: any;
    try {
      payload = readPayload(file);
    } catch {
      continue;
    }
    if (payload?.error || payload?.fetchError) continue;
    read++;
    audit(file.replace(/\.json$/, ''), overviewStats(payload));
  }

  console.log(`  ${read} payloads, ${statsSeen} figures, ${dashes} of them a dash with a reason`);
  if (faults.length) {
    totalProblems += faults.length;
    console.log(`  PROBLEM: ${faults.length} figures break the dash-or-number rule:`);
    faults.slice(0, 10).forEach((f) => console.log(`           ${f}`));
  } else {
    console.log('  every figure is either a number or an em dash with a sentence saying what is missing');
  }

  // THE PROBE: a real company with the inputs taken out. Every figure that
  // depended on them must become a dash -- not a zero, not a blank, not a
  // ratio of something over nothing.
  const base: any = readPayload(files.includes('AAPL.json') ? 'AAPL.json' : files[0]);
  const stripped = {
    ...base,
    statements: (base.statements || []).map((row: any) => ({
      ...row,
      netIncome: null,
      equity: null,
      dividendsPaid: null,
      commonDividendsPaid: null,
      operatingIncome: null,
    })),
  };
  const after: any = overviewStats(stripped);
  const mustDash = ['pe', 'pb', 'bookValue', 'dividendYield', 'roce', 'roe'];
  const wrong = mustDash.filter((key) => {
    const stat = after.stats.find((s: any) => s.key === key);
    return !stat || stat.value !== null || formatStat(stat, after.currencySymbol) !== '—';
  });
  if (wrong.length) {
    totalProblems += wrong.length;
    console.log(
      `  PROBLEM: with profit, equity, dividends and operating profit all removed, ` +
        `${wrong.join(', ')} still show a figure`
    );
  } else {
    console.log(
      `  with profit, equity, dividends and operating profit removed, all ${mustDash.length} figures ` +
        'that depend on them become a dash'
    );
  }
  // And the ones that do NOT depend on them must survive, or the check above
  // would pass just as well on a panel that gave up entirely.
  const mustHold = ['price', 'marketCap', 'high52', 'low52'];
  const lost = mustHold.filter((key) => after.stats.find((s: any) => s.key === key)?.value === null);
  if (lost.length) {
    totalProblems += lost.length;
    console.log(`  PROBLEM: ${lost.join(', ')} were lost too, and nothing they need was removed`);
  } else {
    console.log(`  and ${mustHold.join(', ')} are unaffected, because nothing they rest on was removed`);
  }
}

// ---------------------------------------------------------------------------
// THE COMPANY PAGE: THE CHART OVERLAYS ARE OUR OWN ARITHMETIC
// ---------------------------------------------------------------------------
//
// Every overlay on the price chart is computed here from this company's own
// filings — a price divided by the earnings in the filing that was the latest
// one on that day. Nothing is fetched, which means nothing checks it either
// unless something does it here.
//
// THE EXPECTED FIGURES ARE WORKED OUT IN THIS FILE, BY HAND, from round
// numbers chosen so that every answer is exact. Reading them back out of the
// same function that produced them would prove nothing at all (`CLAUDE.md`,
// "Comparing a figure against itself"):
//
//   1,000,000,000 shares, so a line in millions divided by them is per 1,000.
//   FY2024  profit 1,000m -> EPS 1.00 ; equity 2,000m -> book 2.00
//           revenue 5,000m ; operating 1,000m + depreciation 500m = EBITDA 1,500m
//           debt 1,000m - cash 400m = net debt 600m
//   FY2025  a LOSS of 200m, and equity 2,500m -> book 2.50
//
//   price 20 on 2024-12-31 -> P/E 20.000  P/B 10.000
//                             EV (20 x 1e9 = 20,000m + 600m) / 1,500m = 13.7333
//                             market cap / sales = 20,000 / 5,000 = 4.000
//   price 30 on 2026-06-30 -> no P/E at all, because the year was a loss
//                             P/B = 30 / 2.50 = 12.000
//                             EV (30,000m + net debt 1,200 - 200 = 1,000m)
//                                / (operating -100m + depreciation 500m = 400m)
//                                = 31,000 / 400 = 77.500. THE FIRST VERSION OF
//                                THIS CHECK SAID 75.500, having taken net debt
//                                as 200 rather than 1,000 -- the check caught
//                                its own author, which is the point of working
//                                the figure out by hand.
//                             P/B = 30 / 2.50 = 12.000
//   price 10 on 2024-06-30 -> NO POINT ON ANY LINE: it is before the first
//                             filing this company has, and carrying a later
//                             filing back to it would draw a ratio nobody
//                             could have computed on the day.
{
  console.log('\n=== the company page: every chart overlay recomputes from the filings ===');
  const { priceSeries, overlayFor } = await import(`file:///${REPO}/src/data/priceSeries.ts`);

  const dates = ['2024-06-30', '2024-12-31', '2025-06-30', '2026-06-30'];
  const closes = [10, 20, 25, 30];
  const payload = {
    ticker: 'KNOWN',
    currency: 'USD',
    currencySymbol: '$',
    statements: [
      {
        fiscalYear: 2024,
        periodEnd: '2024-12-31',
        revenue: 5000,
        operatingIncome: 1000,
        depreciation: 500,
        netIncome: 1000,
        equity: 2000,
        totalDebtReported: 1000,
        cashAndShortTermInvestments: 400,
        dilutedShares: 1_000_000_000,
      },
      {
        fiscalYear: 2025,
        periodEnd: '2025-12-31',
        revenue: 4000,
        operatingIncome: -100,
        depreciation: 500,
        netIncome: -200,
        equity: 2500,
        totalDebtReported: 1200,
        cashAndShortTermInvestments: 200,
        dilutedShares: 1_000_000_000,
      },
    ],
    priceConversion: { converted: false, rate: 1 },
    quote: {
      price: 30,
      currency: 'USD',
      history: {
        currency: 'USD',
        source: 'a formula in verify/scenarios.mts',
        daily: { from: dates[0], to: dates[dates.length - 1], dates, closes },
        monthly: null,
      },
    },
  };

  const series: any = priceSeries(payload, '10Y');
  const expect: [string, string, (number | null)[]][] = [
    ['pe', 'P / E', [null, 20, 25, null]],
    ['pb', 'P / B', [null, 10, 12.5, 12]],
    ['evEbitda', 'EV / EBITDA', [null, 20600 / 1500, 25600 / 1500, 31000 / 400]],
    ['mcapSales', 'Market cap / sales', [null, 4, 5, 30000 / 4000]],
  ];

  let checked = 0;
  const bad: string[] = [];
  for (const [key, label, wanted] of expect) {
    const overlay: any = overlayFor(payload, key as any, series);
    if (overlay.missing) {
      bad.push(`${label}: nothing drawn at all -- ${overlay.missing}`);
      continue;
    }
    const points = overlay.lines[0].points;
    const want = wanted.map((v, i) => (v === null ? null : { date: dates[i], value: v }))
      .filter((p): p is { date: string; value: number } => p !== null);
    if (points.length !== want.length) {
      bad.push(`${label}: ${points.length} points drawn, ${want.length} expected (${want.map((w) => w.date).join(', ')})`);
      continue;
    }
    for (let i = 0; i < want.length; i++) {
      checked++;
      if (points[i].date !== want[i].date) {
        bad.push(`${label}: point ${i + 1} is dated ${points[i].date}, expected ${want[i].date}`);
      } else if (Math.abs(points[i].value - want[i].value) > 1e-9) {
        bad.push(`${label} on ${want[i].date}: ${points[i].value} against ${want[i].value} worked out by hand`);
      }
      // EVERY POINT NAMES THE FILING IT DIVIDED BY, which is the claim the
      // screen makes when the reader points at it.
      const wantYear = Date.parse(`${want[i].date}T00:00:00Z`) >= Date.parse('2025-12-31T00:00:00Z') ? 2025 : 2024;
      if (points[i].filing?.fiscalYear !== wantYear) {
        bad.push(
          `${label} on ${want[i].date}: says it used FY${points[i].filing?.fiscalYear}, and FY${wantYear} was the latest filing on that day`
        );
      }
    }
  }

  // Sales and margin is the filings themselves, one point per filed year.
  const sm: any = overlayFor(payload, 'salesMargin', series);
  if (sm.missing) bad.push(`Sales and margin: ${sm.missing}`);
  else {
    const sales = sm.lines.find((l: any) => l.label === 'Sales');
    const margin = sm.lines.find((l: any) => l.label === 'Operating margin');
    checked += 2;
    if (!sales || sales.points.length !== 2 || sales.points[0].value !== 5000 || sales.points[1].value !== 4000) {
      bad.push(`Sales: ${sales?.points.map((p: any) => p.value).join(', ')} against 5000, 4000`);
    }
    // 1,000 / 5,000 = 20.0% and -100 / 4,000 = -2.5%, both exact.
    if (!margin || Math.abs(margin.points[0].value - 20) > 1e-9 || Math.abs(margin.points[1].value + 2.5) > 1e-9) {
      bad.push(`Operating margin: ${margin?.points.map((p: any) => p.value).join(', ')} against 20, -2.5`);
    }
  }

  if (bad.length) {
    totalProblems += bad.length;
    console.log(`  PROBLEM: ${bad.length} overlay figures disagree with the arithmetic:`);
    bad.slice(0, 10).forEach((m) => console.log(`           ${m}`));
  } else {
    console.log(
      `  ${checked} overlay figures match the value worked out by hand, each naming the filing it used; ` +
        'a loss year draws no price/earnings point and a day before the first filing draws nothing at all'
    );
  }
}


// ---------------------------------------------------------------------------
// THE FINANCIALS TAB: FOUR RULES OF ITS OWN (docs/FINANCIALS_SPEC.md)
// ---------------------------------------------------------------------------
//
// The tab shows the three statements as filed, and the spec it was built from
// is mostly a list of ways a financial table lies. These are the four that can
// be checked without a browser, measured over every payload on disk.
//
//   THE TTM METHOD COMES FROM THE PERIODS THE COMPANY FILED (rule 5), not
//   from its country. Today every payload holds annual periods only, so the
//   live data exercises one branch of four; the other three are driven here
//   with constructed period sets, because the rule is the thing being built
//   and shipping three unexercised branches is how they rot.
//
//   A GAP IS NEVER A ZERO (rule 3, and standing decision 3). The failure this
//   catches is one line of code — `row[field] ?? 0` — and it is invisible on
//   screen: a company that does not disclose its inventory shows a confident
//   nil, and every total built on it is wrong by exactly the amount nobody
//   knows.
//
//   NO BANK GETS AN OPERATING MARGIN (rule 13). A margin struck against
//   interest and fee income is a number with no meaning that still looks like
//   one, so the bank template has no such row rather than having one that is
//   filtered out later — a filter is something that can be forgotten.
//
//   A BALANCE SHEET IS NEVER SUMMED (rule 6). Cash at four quarter-ends added
//   together is four times the cash, and it is the most natural mistake in the
//   whole spec because every row beside it IS summed.
{
  console.log('\n=== the financials tab: the four rules that can be checked without a browser ===');
  const {
    financialsFor,
    ttmMethod,
    templateFor,
    formatValue,
    FORBIDDEN_FOR_BANKS,
  } = await import(`file:///${REPO}/src/data/financials.ts`);

  const faults: string[] = [];

  // ---- 1. THE TTM METHOD, ON PERIODS A COMPANY COULD ACTUALLY FILE ----
  const ttmCases: [string, { end: string; months: number }[], string, string][] = [
    [
      'a filer whose latest period is the full year',
      [{ end: '2026-03-31', months: 12 }, { end: '2025-03-31', months: 12 }],
      'annual',
      'TTM (FY basis)',
    ],
    [
      'a quarterly filer, three quarters past the year end',
      [
        { end: '2025-12-31', months: 3 },
        { end: '2025-09-30', months: 3 },
        { end: '2025-06-30', months: 3 },
        { end: '2025-03-31', months: 3 },
        { end: '2024-12-31', months: 12 },
      ],
      'four-quarters',
      'TTM (4 quarters)',
    ],
    [
      'a half-yearly filer at its half way point',
      [
        { end: '2025-09-30', months: 6 },
        { end: '2024-09-30', months: 6 },
        { end: '2025-03-31', months: 12 },
      ],
      'half-year-bridge',
      'TTM (H1 basis)',
    ],
    ['a company with nothing filed', [], 'none', 'TTM'],
    [
      'two quarters and nothing else, which do not make a year',
      [{ end: '2025-12-31', months: 3 }, { end: '2025-09-30', months: 3 }],
      'none',
      'TTM',
    ],
  ];
  for (const [name, filed, method, label] of ttmCases) {
    const got: any = (ttmMethod as any)(filed);
    if (got.method !== method || got.label !== label) {
      faults.push(
        `${name}: the method should be ${method} labelled "${label}", and it is ${got.method} ` +
          `labelled "${got.label}"`
      );
    }
  }
  // AND IT USES THE PERIODS IT SAYS IT DOES. A method that names four quarters
  // and combines three would pass every test above.
  const quarterly: any = (ttmMethod as any)(ttmCases[1][1]);
  if (quarterly.uses.length !== 4 || quarterly.uses[0] !== '2025-12-31') {
    faults.push(`the four-quarter method combines ${JSON.stringify(quarterly.uses)}, not the latest four`);
  }
  const bridge: any = (ttmMethod as any)(ttmCases[2][1]);
  if (bridge.uses.length !== 3) {
    faults.push(`the half-year bridge combines ${bridge.uses.length} periods, not the year and two halves`);
  }

  // ---- 2, 3, 4: over every payload on disk ----
  const files = fs.readdirSync(PAYLOADS).filter((f) => f.endsWith('.json'));
  let companies = 0;
  let banks = 0;
  let cells = 0;
  let gaps = 0;
  let filedZeros = 0;
  let balanceRows = 0;
  const STATEMENTS = ['income', 'balance', 'cash'] as const;

  for (const file of files) {
    let payload: any;
    try {
      payload = readPayload(file);
    } catch {
      continue;
    }
    if (payload?.error || payload?.fetchError || !payload?.statements?.length) continue;
    companies++;
    const ticker = file.replace(/\.json$/, '');
    const bank = (templateFor as any)(payload) === 'bank';
    if (bank) banks++;
    const symbol = String(payload.currencySymbol || payload.currency || '');

    for (const statement of STATEMENTS) {
      const view: any = (financialsFor as any)(payload, { statement, frequency: 'annual' });
      const annualPeriods = view.periods.filter((p: any) => p.kind !== 'ttm');

      // ---- 3. NO BANK GETS A MARGIN OR AN EBITDA ----
      if (bank) {
        for (const row of view.rows) {
          if ((FORBIDDEN_FOR_BANKS as string[]).includes(row.key)) {
            faults.push(`${ticker} is a bank and its ${statement} carries a "${row.label}" row`);
          }
        }
      }

      for (const row of view.rows) {
        row.cells.forEach((cell: any, i: number) => {
          cells++;
          const shown = (formatValue as any)(cell, row.kind, symbol);

          // ---- 2. A GAP IS AN EM DASH, NEVER A ZERO ----
          if (cell.value === null) {
            gaps++;
            if (shown !== '\u2014') {
              faults.push(`${ticker} ${statement} ${row.key} period ${i}: no value, and the screen shows "${shown}"`);
            }
            if (cell.state !== 'notReported' && cell.state !== 'notApplicable') {
              faults.push(`${ticker} ${statement} ${row.key} period ${i}: no value, and the state is ${cell.state}`);
            }
            if (!cell.reason) {
              faults.push(`${ticker} ${statement} ${row.key} period ${i}: nothing to show and no reason why`);
            }
          } else if (cell.value === 0) {
            // A FILED NIL IS A CLAIM, and is distinguishable from an absence.
            filedZeros++;
            if (cell.state === 'notReported') {
              faults.push(`${ticker} ${statement} ${row.key} period ${i}: a nil is being reported as not reported`);
            }
          }

          // THE FIELD BEHIND THE CELL, read from the payload rather than from
          // the view, so the two come from opposite directions: a row whose
          // source field is absent must never arrive on screen as a number.
          const sourceRow = annualPeriods[i]
            ? payload.statements.find((s: any) => s.periodEnd === annualPeriods[i].endDate)
            : null;
          if (sourceRow && !row.formula && row.key in sourceRow) {
            const raw = sourceRow[row.key];
            const absent = !(typeof raw === 'number' && isFinite(raw));
            if (absent && cell.value !== null) {
              faults.push(
                `${ticker} ${statement} ${row.key} ${annualPeriods[i].key}: the filing has no figure and the ` +
                  `table shows ${cell.value}`
              );
            }
          }
        });
      }

      // ---- 4. A BALANCE IS A MOMENT, NOT A TOTAL OF MOMENTS ----
      if (statement === 'balance') {
        const ttmAt = view.periods.findIndex((p: any) => p.kind === 'ttm');
        if (ttmAt >= 0) {
          for (const row of view.rows) {
            if (!row.pointInTime) continue;
            balanceRows++;
            // THE LATEST BALANCE OF THIS LINE, wherever it sits. With quarters
            // in the payload the newest balance is often a quarter end, and a
            // line the quarter does not report keeps the one from the year end
            // — so the expectation is the newest period that reports it, not
            // the column immediately to the left.
            const ttm = row.cells[ttmAt];
            const everyPeriod = [
              ...(payload.quarters || []).map((q: any) => ({ end: q.periodEnd, v: q.values?.[row.key] })),
              ...payload.statements.map((s: any) => ({ end: s.periodEnd, v: s[row.key] })),
            ]
              .filter((p: any) => typeof p.v === 'number')
              .sort((a: any, b: any) => (a.end < b.end ? -1 : 1));
            const latestOfLine = everyPeriod.length ? everyPeriod[everyPeriod.length - 1] : null;
            if (latestOfLine && ttm.value !== latestOfLine.v) {
              faults.push(
                `${ticker} ${row.key}: the TTM column holds ${ttm.value} and the latest balance, at ` +
                  `${latestOfLine.end}, is ${latestOfLine.v} — a balance sheet line has been aggregated`
              );
            }
            const latest = latestOfLine ? { value: latestOfLine.v } : { value: null };
            // And specifically not the sum, which is the shape the mistake takes.
            const summable = row.cells
              .slice(0, ttmAt)
              .map((c: any) => c.value)
              .filter((v: any) => typeof v === 'number');
            const sum = summable.reduce((t: number, v: number) => t + v, 0);
            // ONLY WHEN THE SUM IS A DIFFERENT NUMBER. A line reported as nil in
            // the earlier years sums to its own latest value, and accusing that of
            // being an aggregate was this check's own first false positive: six
            // companies, every one of them correct.
            if (
              summable.length > 1 &&
              ttm.value !== null &&
              latest.value !== null &&
              Math.abs(sum - latest.value) > 1e-9 &&
              Math.abs(ttm.value - sum) < 1e-9
            ) {
              faults.push(`${ticker} ${row.key}: the TTM column is the SUM of ${summable.length} balances`);
            }
          }
        }
      }
    }
  }

  if (faults.length) {
    totalProblems += faults.length;
    console.log(`  PROBLEM: ${faults.length} faults in the financials tab:`);
    faults.slice(0, 8).forEach((f) => console.log(`           ${f}`));
  } else {
    console.log(
      `  the TTM method is read off the filed periods in all five cases: a year, four quarters, the ` +
        'half-year bridge, nothing filed, and two quarters that do not make a year'
    );
    console.log(
      `  ${cells.toLocaleString('en-GB')} cells over ${companies} companies and three statements: ` +
        `${gaps.toLocaleString('en-GB')} with nothing behind them, every one an em dash with a reason, and ` +
        `${filedZeros} filed nils kept distinct from them`
    );
    console.log(
      `  none of the ${banks} banks carries ${(FORBIDDEN_FOR_BANKS as string[]).join(', ')}`
    );
    console.log(
      `  ${balanceRows.toLocaleString('en-GB')} balance sheet rows: every trailing-twelve-month column is the ` +
        'latest balance, and not one is a sum of balances'
    );
  }
}

// ---------------------------------------------------------------------------
// THE QUARTERS: THREE THINGS THAT WOULD LOOK RIGHT AND BE WRONG
// ---------------------------------------------------------------------------
//
// A quarterly table is the easiest place on this site to publish a confident
// lie, because every failure below produces a number of about the right size
// in about the right place.
//
//   A CUMULATIVE FIGURE SHOWN AS A QUARTER. Measured on Apple’s own facts:
//   the operating cash flow it files on its Q3 10-Q spans 272 days, not 90 —
//   it is nine months, cumulative from the start of the year. Printed under a
//   "Q3" heading it is three times the truth and looks entirely normal. The
//   check is arithmetic rather than trust: FOUR QUARTERS MUST ADD UP TO THE
//   YEAR, and a cumulative figure among them overshoots it enormously.
//
//   A DERIVED QUARTER WITH ONE FILING, OR NONE. A quarter the company never
//   filed on its own is the difference between two documents. One link is half
//   the provenance and no link is none of it, and neither is visible on screen.
//
//   A TTM THAT IGNORES THE QUARTERS IT HAS. The whole value of the column is
//   that it runs to the latest quarter rather than to the last year end; a TTM
//   that quietly stays on the financial year is a stale number wearing a fresh
//   label.
{
  console.log('\n=== the quarters: cumulative, derived, and what the TTM is made of ===');
  const { financialsFor, ttmMethod } = await import(`file:///${REPO}/src/data/financials.ts`);

  const faults: string[] = [];
  const files = fs.readdirSync(PAYLOADS).filter((f) => f.endsWith('.json'));
  let withQuarters = 0;
  let quarterRows = 0;
  let derivedFigures = 0;
  let sumsChecked = 0;
  let vendorSums = 0;
  const vendorOff: string[] = [];
  let ttmFromQuarters = 0;
  let spansChecked = 0;
  let reconciledAway = 0;

  for (const file of files) {
    let payload: any;
    try {
      payload = readPayload(file);
    } catch {
      continue;
    }
    if (payload?.error || payload?.fetchError || !payload?.statements?.length) continue;
    const ticker = file.replace(/\.json$/, '');
    const quarters: any[] = Array.isArray(payload.quarters) ? payload.quarters : [];
    if (!quarters.length) continue;
    withQuarters++;
    quarterRows += quarters.length;
    if (typeof payload.quartersDropped === 'number') reconciledAway += payload.quartersDropped;

    for (const q of quarters) {
      // ---- 1a. A QUARTER’S OWN DATES SAY IT IS A QUARTER ----
      if (q.periodStart && q.periodEnd) {
        const days = Math.round(
          (new Date(q.periodEnd).getTime() - new Date(q.periodStart).getTime()) / 86400000
        );
        spansChecked++;
        // Wide enough for a 52/53-week filer’s sixteen-week fourth quarter,
        // and nowhere near wide enough for a half year (181 days) or a nine
        // months (272), which is the thing being guarded against.
        const low = q.months === 6 ? 160 : 76;
        const high = q.months === 6 ? 200 : 120;
        if (days < low || days > high) {
          faults.push(
            `${ticker} ${q.fiscalPeriod || q.months + 'M'} to ${q.periodEnd} spans ${days} days, which is ` +
              `not a ${q.months}-month period — a cumulative figure is being carried as one`
          );
        }
      }

      // ---- 2. A DERIVED FIGURE CARRIES BOTH OF ITS FILINGS ----
      for (const [field, state] of Object.entries(q.states || {})) {
        if (state !== 'derived') continue;
        derivedFigures++;
        const from = q.derivedFrom?.[field];
        if (!Array.isArray(from) || from.length < 2) {
          faults.push(
            `${ticker} ${q.periodEnd} ${field} is derived and links ${from?.length ?? 0} filings, not two`
          );
        } else if (from.some((f: any) => !f?.accn || !f?.url)) {
          faults.push(`${ticker} ${q.periodEnd} ${field}: a linked filing has no accession or no address`);
        } else if (from[0].accn === from[1].accn) {
          faults.push(
            `${ticker} ${q.periodEnd} ${field}: both ends of the subtraction point at the same filing ` +
              `(${from[0].accn})`
          );
        }
      }
    }

    // ---- 1b. FOUR QUARTERS ADD UP TO THE YEAR ----
    //
    // The arithmetic the whole thing rests on, and the one a cumulative figure
    // cannot survive. Checked per fiscal year, on the flow lines where all four
    // quarters and the year itself are held.
    const FLOWS = ['revenue', 'netIncome', 'operatingCashFlow', 'operatingIncome'];
    const threes = quarters.filter((q) => q.months === 3);
    for (const year of payload.statements) {
      const inYear = threes.filter((q) => q.fiscalYear === year.fiscalYear);
      if (inYear.length !== 4) continue;
      for (const field of FLOWS) {
        const parts = inYear.map((q) => q.values?.[field]).filter((v: any) => typeof v === 'number');
        const whole = year[field];
        if (parts.length !== 4 || typeof whole !== 'number' || whole === 0) continue;
        const sum = parts.reduce((t: number, v: number) => t + v, 0);
        // A tenth of a per cent, which is wider than the rounding to millions
        // and far narrower than any cumulative figure could hide in.
        const off = Math.abs(sum - whole) > Math.abs(whole) * 0.001 + 1;
        // WHOSE ARITHMETIC IS BEING CHECKED MATTERS. On the SEC path the
        // quarters are ours: filed ones taken as filed, missing ones derived
        // here, so a sum that misses the year is OUR error and fails the run.
        // On the vendor path we take what the feed gives and derive nothing;
        // a mismatch there is the vendor disagreeing with itself, which is
        // worth measuring and recording but is not a defect of this code.
        if (/sec/i.test(String(payload.source || ''))) {
          sumsChecked++;
          if (off) {
            faults.push(
              `${ticker} FY${year.fiscalYear} ${field}: the four quarters add to ${sum.toFixed(0)} and the ` +
                `year is ${whole.toFixed(0)}`
            );
          }
        } else {
          vendorSums++;
          if (off && vendorOff.length < 5) {
            vendorOff.push(
              `${ticker} FY${year.fiscalYear} ${field}: quarters ${sum.toFixed(0)} vs year ${whole.toFixed(0)}`
            );
          } else if (off) {
            vendorOff.push('');
          }
        }
      }
    }

    // ---- 3. THE TTM USES THE LATEST FOUR REAL QUARTERS WHEN THEY EXIST ----
    // THE LATEST FOUR QUARTERS BY DATE, not the latest four that happen to
    // carry revenue. The difference matters: where the reconciliation refused
    // a field for one year, the quarters are still quarters and the TTM is
    // still built from the latest four of them — it simply has nothing to
    // show for that line. Filtering by the field first made this check's
    // expectation disagree with the code's for three companies, every one of
    // which was behaving correctly.
    const incomeQuarters = threes.sort((a: any, b: any) => (a.periodEnd < b.periodEnd ? -1 : 1));
    const latestYearEnd = payload.statements[payload.statements.length - 1]?.periodEnd;
    const after = incomeQuarters.filter((q: any) => q.periodEnd > String(latestYearEnd));
    if (incomeQuarters.length >= 4 && after.length) {
      ttmFromQuarters++;
      const view: any = (financialsFor as any)(payload, { statement: 'income', frequency: 'annual' });
      const ttm = view.periods.find((p: any) => p.kind === 'ttm');
      const row = view.rows.find((r: any) => r.key === 'revenue');
      const four = incomeQuarters.slice(-4);
      const want = four.reduce((t: number, q: any) => t + q.values.revenue, 0);
      if (view.ttm.method !== 'four-quarters') {
        faults.push(
          `${ticker} holds ${incomeQuarters.length} quarters, ${after.length} of them after the year end, ` +
            `and its TTM method is "${view.ttm.method}"`
        );
      } else if (!ttm || ttm.endDate !== four[3].periodEnd) {
        faults.push(
          `${ticker}: the TTM column ends ${ttm?.endDate} and the latest quarter ends ${four[3].periodEnd}`
        );
      } else if (four.every((q: any) => typeof q.values?.revenue === 'number')) {
        // Only where all four carry the line. A quarter whose revenue the data
        // layer refused leaves the TTM with nothing to add, and the column says
        // so — which is the right answer, not a fault.
        const got = row?.cells[view.periods.indexOf(ttm)]?.value;
        if (typeof got !== 'number' || Math.abs(got - want) > Math.abs(want) * 0.001 + 1) {
          faults.push(
            `${ticker}: the TTM revenue is ${got} and the four quarters to ${four[3].periodEnd} add to ` +
              `${want.toFixed(0)}`
          );
        }
      }
    }
  }

  // AND THE BALANCE SHEET IS STILL NEVER SUMMED, now that there are quarters
  // to sum it over. Four quarter-end cash balances added together is four
  // times the cash.
  for (const file of files.slice(0, 60)) {
    let payload: any;
    try {
      payload = readPayload(file);
    } catch {
      continue;
    }
    if (!payload?.statements?.length || !payload?.quarters?.length) continue;
    const ticker = file.replace(/\.json$/, '');
    const view: any = (financialsFor as any)(payload, { statement: 'balance', frequency: 'annual' });
    const ttmAt = view.periods.findIndex((p: any) => p.kind === 'ttm');
    if (ttmAt < 0) continue;
    const totals = view.rows.find((r: any) => r.key === 'totalAssets');
    if (!totals) continue;
    const ttm = totals.cells[ttmAt]?.value;
    const latestBalance = [...payload.quarters, ...payload.statements]
      .filter((p: any) => typeof (p.values?.totalAssets ?? p.totalAssets) === 'number')
      .sort((a: any, b: any) => (a.periodEnd < b.periodEnd ? -1 : 1))
      .pop();
    const want = latestBalance?.values?.totalAssets ?? latestBalance?.totalAssets;
    if (typeof ttm === 'number' && typeof want === 'number' && Math.abs(ttm - want) > 1e-6) {
      faults.push(
        `${ticker}: the TTM total assets is ${ttm.toFixed(0)} and the latest balance, at ` +
          `${latestBalance.periodEnd}, is ${want.toFixed(0)}`
      );
    }
  }

  if (faults.length) {
    totalProblems += faults.length;
    console.log(`  PROBLEM: ${faults.length} faults in the quarterly figures:`);
    faults.slice(0, 8).forEach((f) => console.log(`           ${f}`));
  } else {
    console.log(
      `  ${withQuarters} companies carry quarters, ${quarterRows} periods between them; ${spansChecked} ` +
        'carry their own start and end dates and every one spans what it claims to'
    );
    console.log(
      `  ${sumsChecked} four-quarter sums on the SEC path checked against the year they belong to, and ` +
        'every one agrees to within a tenth of a per cent'
    );
    if (vendorSums) {
      const bad = vendorOff.filter(Boolean).length + vendorOff.filter((v) => !v).length;
      console.log(
        `  ${vendorSums} on the vendor path, where the quarters are taken as given and nothing is ` +
          `derived: ${bad} do not tie to the vendor’s own annual figure` +
          (vendorOff.filter(Boolean).length ? ` (e.g. ${vendorOff.filter(Boolean)[0]})` : '')
      );
    }
    console.log(
      `  ${derivedFigures.toLocaleString('en-GB')} figures were worked out from two filings rather than ` +
        'filed, and every one links both of them'
    );
    console.log(
      `  ${ttmFromQuarters} companies have real quarters past their year end, and every one of their TTM ` +
        'columns is the latest four of them, ending on the latest quarter'
    );
    console.log(
      `  ${reconciledAway} field-years were refused by the data layer for not adding up to the year ` +
        'beside them, and show as not reported rather than as figures nobody can reconcile'
    );
  }
}

// ---------------------------------------------------------------------------
// NOTHING THAT WAS CAPTURED HAS BEEN CHANGED OR LOST
// ---------------------------------------------------------------------------
//
// Stage 0 of `docs/ARCHIVE_PLAN.md`. Until 2026-10-25 a refetch wrote over the
// payload file and the version it replaced was gone — a loss running
// continuously, with no third party to ask for permission to stop it. Six
// payloads were replaced on 2026-10-25 alone, and with them the prices that
// every earlier measurement in this repository was struck against.
//
// Every fetch now writes a capture under `verify/payloads/versions/` whose NAME
// IS THE HASH OF ITS OWN CONTENTS, and this is the check that makes that worth
// something: a capture that has been edited no longer hashes to its name, and
// says so here. It also holds the log and the files to each other in both
// directions, so neither a deleted file nor a deleted log line can hide, and
// asserts that the payload the whole suite reads really is the newest capture
// of it rather than something that was never kept.
//
// THE STORE IS NOT IN THE REPOSITORY, and that is deliberate rather than
// incidental: `verify/.gitignore` keeps payloads out because the Yahoo-sourced
// figures are vendor data this site is not licensed to redistribute, and a
// history of them is still them. Keeping the history is ours to do; publishing
// it is not.
{
  console.log('\n=== every payload capture is still the capture it was ===');
  const { audit, sizeLine } = await import(`file:///${REPO}/verify/payloadVersions.mts`);
  const report = audit();
  if (report.problems.length) {
    totalProblems += report.problems.length;
    console.log(`  PROBLEM: ${report.problems.length} faults in the capture store:`);
    report.problems.slice(0, 8).forEach((p) => console.log(`           ${p}`));
  } else if (!report.versions) {
    console.log('  no captures on disk, and no payloads to capture');
  } else {
    console.log(`  ${sizeLine(report)}`);
    console.log(
      '  every capture hashes to its own name, every one is in the log and on disk, and every payload ' +
        'the set reads is its newest capture'
    );
  }
}

// ---------------------------------------------------------------------------
// THE RUPEE RATE: THE OECD FIRST, FRED BEHIND IT, AND A REFUSAL IF BOTH GO
// ---------------------------------------------------------------------------
//
// Five currencies are fetched from the institution that sets the rate. The
// rupee is not: no daily Indian series is both openly licensed and reachable
// from where this runs, so it comes from the OECD’s Main Economic Indicators
// long-term interest rate, which is monthly.
//
// IT USED TO COME FROM FRED’S REPUBLICATION OF THAT SERIES, AND THAT WAS A
// SINGLE POINT OF FAILURE WITH A MEASURED OUTAGE BEHIND IT. On 2026-10-22 FRED
// answered every request with its own "Site Maintenance" page and six Indian
// companies lost their valuation in an afternoon — correctly refused rather
// than discounted at something else, but refused over a third party being down.
//
// So the OECD is asked first and FRED is kept behind it. What this check holds:
//
//   THE OECD ANSWERING MEANS FRED IS NOT ASKED AT ALL.
//   THE OECD FAILING MEANS FRED ANSWERS WITH THE SAME RATE, TO THE LAST DIGIT.
//   AN OECD ANSWER TOO SHORT TO AVERAGE HANDS ON RATHER THAN BEING AVERAGED.
//   BOTH FAILING MEANS NO RATE, AND A REASON NAMING BOTH PUBLISHERS.
//
// The second is the one that matters and the easiest to get wrong: two sources
// averaged even slightly differently would move every Indian valuation on the
// day the first one went down, which is the failure the fallback exists to
// prevent. The two are dated differently at source — the OECD says "2025-04"
// and FRED says "2025-04-01" — so the rupee rate is one line of normalisation
// away from a window that quietly holds eleven months instead of twelve.
//
// OFFLINE, ON PURPOSE. `fetch` is replaced for the length of the block, so the
// suite does not depend on either publisher being up to check what happens when
// one of them is down. The twelve months below were read from both sources on
// 2026-10-24, where 175 of the 178 months they both carry are identical to the
// last digit and the other three agree to within 7e-7 of a percentage point.
{
// ---------------------------------------------------------------------------
// ONE FETCH PER CURRENCY, THREE TRIES, AND SOMETHING BEHIND IT (`KI-34`)
// ---------------------------------------------------------------------------
//
// A single request that did not answer used to take a company’s whole
// valuation away. Five things are checked, each against a different failure,
// and every one of them is driven by standing in for the publisher rather than
// by waiting for it to have a bad day.
{
// ---------------------------------------------------------------------------
// THE SCREENER (`docs/SCREENER_SPEC.md`, build step 4)
// ---------------------------------------------------------------------------
//
// Every rule in the spec that is a rule about DATA is checked here, over the
// whole table, rather than in a browser over one screen of it. The browser
// checks what only a browser can: that the number on the screen is the number
// this produced.
{
  console.log('\n=== the screener: the universe, the filters and what they set aside ===');
  const S: any = await import(`file:///${REPO}/src/data/screener.ts`);
  const faults: string[] = [];
  const isNum = (v: unknown): v is number => typeof v === 'number' && isFinite(v);
  const files = fs.readdirSync(PAYLOADS).filter((f) => f.endsWith('.json'));

  // THE TABLE, built the way the screen gets it.
  const built: any[] = [];
  for (const file of files) {
    let payload: any;
    try {
      payload = JSON.parse(fs.readFileSync(path.join(PAYLOADS, file), 'utf8'));
    } catch {
      continue;
    }
    const row = S.screenerRow(payload);
    if (row) built.push(row);
  }
  const rows = S.markHomeListings(built);
  const metrics = S.SCREENER_METRICS;

  // ---- 1. EVERY COLUMN PUBLISHES ITS FORMULA, SOURCE AND PERIOD ------
  //
  // Rule 2. A screener whose columns are unexplained is a set of numbers to
  // be taken on trust, which is the thing this site exists not to be.
  for (const m of metrics) {
    for (const field of ['label', 'formula', 'source', 'unit', 'group']) {
      if (!m[field]) faults.push(`the ${m.key} column has no ${field}`);
    }
    if (String(m.formula).trim().split(/\s+/).length < 3) {
      faults.push(`the ${m.key} column’s formula is "${m.formula}", which does not say how it is worked out`);
    }
  }
  // AND EVERY FIGURE SAYS WHICH PERIOD IT COVERS (rule 3).
  let withPeriod = 0;
  let values = 0;
  for (const row of rows) {
    for (const m of metrics) {
      const cell = row.cells[m.key];
      if (!cell || cell.state !== 'value') continue;
      values++;
      if (cell.period) withPeriod++;
      else faults.push(`${row.ticker} ${m.key}: a figure with no period against it`);
    }
  }

  // ---- 2. A MISSING FIGURE NEVER PASSES OR FAILS SILENTLY ------------
  //
  // Rule 4, and the one the whole screener turns on. A company with no
  // operating margin is not a company with a bad one. It is set aside, it is
  // counted, and the count is named.
  {
    for (const m of metrics) {
      const screen = { ...S.EMPTY_SCREEN, oneListingPerCompany: false, filters: [{ metric: m.key, op: 'gt', value: -1e12 }] };
      const out = S.runScreen(rows, screen);
      // A filter that nothing can fail: every company with a figure must
      // match, and every company without one must be excluded rather than
      // quietly dropped.
      const haveValue = rows.filter((r: any) => r.cells[m.key]?.state === 'value').length;
      const haveNone = rows.filter((r: any) => r.cells[m.key]?.state !== 'value').length;
      if (out.matched !== haveValue) {
        faults.push(
          `${m.key}: a filter nothing can fail matched ${out.matched} of the ${haveValue} companies that ` +
            'have the figure'
        );
      }
      if (out.excludedTotal !== haveNone) {
        faults.push(
          `${m.key}: ${haveNone} companies have no figure and ${out.excludedTotal} were set aside, so ` +
            `${haveNone - out.excludedTotal} were dropped without being counted`
        );
      }
      // THE TOTAL ADDS UP. Nobody is in two places and nobody is nowhere.
      if (out.matched + out.rejected + out.excludedTotal !== out.universe) {
        faults.push(
          `${m.key}: ${out.matched} matched + ${out.rejected} rejected + ${out.excludedTotal} excluded is not ` +
            `the ${out.universe} in the universe`
        );
      }
      // AND THE SENTENCE EXISTS WHENEVER ANYONE WAS SET ASIDE.
      const sentence = S.exclusionSentence(out);
      if (out.excludedTotal > 0 && !sentence) {
        faults.push(`${m.key}: ${out.excludedTotal} companies were set aside and nothing says so`);
      }
      if (sentence && !new RegExp(`^${out.excludedTotal} compan`).test(sentence)) {
        faults.push(`${m.key}: the sentence does not open with the number set aside: "${sentence}"`);
      }
    }
  }

  // ---- 3. A BANK IS NOT ASKED WHAT A BANK CANNOT ANSWER --------------
  //
  // Rule 5 names EV/EBITDA, Debt/Equity, the current ratio, free cash flow
  // and margins. Every one of them must be `n.m.` for every financial company
  // in the set — not missing, which would read as a gap in the filing, and
  // certainly not computed.
  {
    const financials = rows.filter((r: any) => r.financial);
    if (financials.length < 10) {
      faults.push(`only ${financials.length} companies are on the bank template, so rule 5 is barely tested`);
    }
    for (const m of metrics.filter((x: any) => x.notMeaningfulForFinancials)) {
      for (const row of financials) {
        const cell = row.cells[m.key];
        if (cell?.state !== 'nm') {
          faults.push(
            `${row.ticker} is on the bank template and its ${m.key} is "${cell?.state}" rather than n.m.` +
              (cell?.state === 'value' ? ` (${cell.value})` : '')
          );
        }
        if (!cell?.reason) faults.push(`${row.ticker} ${m.key}: n.m. with no reason given`);
      }
    }
    // AND A NON-FINANCIAL IS STILL ASKED. A rule that marked everything n.m.
    // would pass the test above and empty the screener.
    const ordinary = rows.filter((r: any) => !r.financial);
    const asked = ordinary.filter((r: any) => r.cells.operatingMargin?.state === 'value').length;
    if (asked < ordinary.length * 0.5) {
      faults.push(
        `only ${asked} of ${ordinary.length} companies outside the bank template have an operating margin, ` +
          'so the not-meaningful rule has reached past the banks'
      );
    }
  }

  // ---- 4. NO BANNED WORD ANYWHERE IN THE SCREENER --------------------
  //
  // Rule 12, checked against everything this screener can put on a screen:
  // every column label, formula and source, every preset name, every reason a
  // figure is absent, every operator word, and the exclusion sentence itself.
  // The list is the spec’s, and `src/components/screenerScreen.tsx` is read
  // as text as well, because a sentence typed into the component is as
  // visible as one computed here.
  {
    const strings: [string, string][] = [];
    for (const m of metrics) {
      strings.push([`${m.key} label`, m.label], [`${m.key} formula`, m.formula], [`${m.key} source`, m.source]);
    }
    for (const op of Object.keys(S.OP_WORDS)) strings.push([`operator ${op}`, S.OP_WORDS[op]]);
    for (const cset of S.COLUMN_SETS) strings.push([`column set`, String(cset.name)]);
    for (const row of rows) {
      for (const m of metrics) {
        const cell = row.cells[m.key];
        if (cell?.reason) strings.push([`${row.ticker} ${m.key} reason`, cell.reason]);
      }
      if (row.listingNote) strings.push([`${row.ticker} listing note`, row.listingNote]);
    }
    for (const [what, text] of strings) {
      const found = S.bannedWordsIn(text);
      if (found.length) faults.push(`${what} uses ${found.join(', ')}: "${String(text).slice(0, 70)}"`);
    }
    // THE COMPONENT’S OWN WORDS, and the preset names it carries.
    const component = fs.readFileSync(path.join(REPO, 'src/components/screenerScreen.tsx'), 'utf8');
    // Only what a reader sees: the quoted strings and the text between tags,
    // not the code. `data-screener-...` attributes and import paths are not
    // prose and would make this a check about variable names.
    // WHAT A READER SEES, and nothing else. The first pass at this flagged
    // `target` and `strong`, and both were right about the letters and wrong
    // about the question: `e.target.value` is the DOM and `<strong>` is markup.
    // Neither is ever rendered as a word. So JSX expressions go (every handler
    // lives in one), then tag names, then the imports and the comments.
    let prose = component
      .replace(/^\s*\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/from '[^']*'/g, '');
    for (let pass = 0; pass < 8; pass++) prose = prose.replace(/\{[^{}]*\}/g, ' ');
    prose = prose
      .replace(/<\/?[A-Za-z][A-Za-z0-9]*/g, ' ')
      .replace(/(?:className|data-[a-z-]+|aria-[a-z-]+|type|href|id|key|scope|rows|placeholder)=/g, ' ');
    const inProse = S.bannedWordsIn(prose);
    if (inProse.length) {
      faults.push(`the screener component’s own words use ${inProse.join(', ')}`);
    }
  }

  // ---- 5. THE MATCH COUNT IS THE NUMBER OF ROWS ----------------------
  //
  // Rule 16. The count and the list come from one call, and this is what
  // makes that worth relying on: over a hundred screens, drawn from the
  // metrics themselves rather than chosen, the two never differ.
  {
    let screensTried = 0;
    for (const m of metrics.filter((x: any) => !x.notMeaningfulForFinancials).slice(0, 8)) {
      for (const cut of [0, 1, 5, 15, 50]) {
        for (const op of ['gt', 'lt'] as const) {
          for (const financials of ['include', 'exclude', 'only'] as const) {
            const screen = {
              ...S.EMPTY_SCREEN,
              financials,
              filters: [{ metric: m.key, op, value: cut }],
            };
            const out = S.runScreen(rows, screen);
            screensTried++;
            if (out.matched !== out.rows.length) {
              faults.push(`${m.key} ${op} ${cut}: the count says ${out.matched} and the list holds ${out.rows.length}`);
            }
            if (out.sorted.length !== out.matched) {
              faults.push(`${m.key} ${op} ${cut}: ${out.matched} matched and ${out.sorted.length} were sorted`);
            }
            // AND SORTING MOVES NOBODY IN OR OUT.
            const before = new Set(out.rows.map((r: any) => r.ticker));
            for (const r of out.sorted) {
              if (!before.has(r.ticker)) faults.push(`${m.key}: sorting introduced ${r.ticker}`);
            }
          }
        }
      }
    }
    if (screensTried < 100) faults.push(`only ${screensTried} screens were tried, which is too few to mean much`);
  }

  // ---- 6. A SCREEN SURVIVES ITS OWN WEB ADDRESS (rule 22) ------------
  {
    const screens: any[] = [
      { ...S.EMPTY_SCREEN, filters: [{ metric: 'roe', op: 'gt', value: 15 }, { metric: 'pe', op: 'lt', value: 20 }] },
      { ...S.EMPTY_SCREEN, filters: [{ metric: 'pe', op: 'between', value: 5, value2: 25 }], financials: 'only' },
      {
        ...S.EMPTY_SCREEN,
        oneListingPerCompany: false,
        columns: 'Valuation',
        sort: 'pb',
        descending: false,
        countries: ['United States', 'India'],
        ratios: [{ key: 'own_x', label: 'Earnings yield', formula: '100 / pe', unit: 'ratio' }],
        filters: [{ metric: 'own_x', op: 'gt', value: 4 }],
      },
    ];
    for (const screen of screens) {
      const back = S.screenFromSearch(S.screenToSearch(screen));
      for (const field of ['oneListingPerCompany', 'financials', 'columns', 'sort', 'descending']) {
        if (JSON.stringify(back[field]) !== JSON.stringify(screen[field])) {
          faults.push(`a screen lost its ${field} in its own web address`);
        }
      }
      if (JSON.stringify(back.filters) !== JSON.stringify(screen.filters)) {
        faults.push(`a screen lost a filter in its own web address: ${S.screenToSearch(screen)}`);
      }
      // FIELD BY FIELD. `JSON.stringify` compares the order the keys were
      // written in as well as their values, and a screen read back out of a
      // web address is built in whatever order its reader happens to use.
      if (back.ratios.length !== screen.ratios.length) {
        faults.push(`a screen carried ${screen.ratios.length} ratios and ${back.ratios.length} came back`);
      }
      for (const [i, want] of screen.ratios.entries()) {
        const got = back.ratios[i];
        for (const field of ['key', 'label', 'formula', 'unit'] as const) {
          if (got?.[field] !== want[field]) {
            faults.push(`a ratio lost its ${field} in its web address: "${want[field]}" became "${got?.[field]}"`);
          }
        }
      }
      // AND THE SAME ADDRESS GIVES THE SAME ANSWER.
      const a = S.runScreen(rows, screen);
      const b = S.runScreen(rows, back);
      if (a.matched !== b.matched) {
        faults.push(`a screen matched ${a.matched} and ${b.matched} after a trip through its web address`);
      }
    }
  }

  // ---- 7. THE TEXT VIEW AND THE CHIPS ARE ONE SET OF FILTERS (rule 9) 
  {
    const written = S.writeQuery([{ metric: 'roe', op: 'gt', value: 15 }, { metric: 'debtToEquity', op: 'lt', value: 0.5 }]);
    const read = S.parseQuery(written);
    if (read.problems.length || read.filters.length !== 2) {
      faults.push(`the chips wrote "${written}" and reading it back gave ${read.filters.length} filters`);
    }
    if (read.filters[0]?.metric !== 'roe' || read.filters[1]?.metric !== 'debtToEquity') {
      faults.push('a round trip through the text view changed which metrics were filtered');
    }
    // A CLAUSE THAT IS NOT A COMPARISON IS REFUSED, NOT GUESSED AT. Rule 9
    // forbids a box that turns words into picks, and the safe version of that
    // is a box that says what it cannot read.
    for (const nonsense of ['good companies', 'roe is quite high', 'nosuchmetric > 5']) {
      const out = S.parseQuery(nonsense);
      if (!out.problems.length) faults.push(`"${nonsense}" was read as a filter rather than refused`);
      if (out.filters.length) faults.push(`"${nonsense}" produced ${out.filters.length} filters`);
    }
  }

  // ---- 8. A RATIO OF THE READER’S OWN IS ARITHMETIC AND NOTHING ELSE 
  //
  // Rule 8, and a safety rule besides: a formula arrives in a web address a
  // reader can be sent, so it is untrusted input. The evaluator can add,
  // subtract, multiply, divide and bracket. It cannot reach anything else.
  {
    const lookup = (key: string) => ({ pe: 20, roe: 15 } as any)[key] ?? null;
    const good: [string, number][] = [['100 / pe', 5], ['roe - pe', -5], ['(roe + pe) * 2', 70], ['-pe', -20]];
    for (const [formula, want] of good) {
      const got = S.evaluateFormula(formula, lookup);
      if (!isNum(got.value) || Math.abs(got.value - want) > 1e-9) {
        faults.push(`"${formula}" gave ${got.value} rather than ${want} (${got.problem ?? 'no reason'})`);
      }
    }
    const refused = [
      'process.exit(1)',
      'globalThis',
      'pe.constructor',
      'fetch("http://example.com")',
      '100 / 0',
      'nosuchmetric + 1',
      '1 +',
    ];
    for (const formula of refused) {
      const got = S.evaluateFormula(formula, lookup);
      if (isNum(got.value)) faults.push(`"${formula}" was worked out as ${got.value} rather than refused`);
      if (!got.problem) faults.push(`"${formula}" was refused with no reason given`);
    }
    // AND A COMPANY THAT CANNOT ANSWER IT IS SET ASIDE, NOT SCORED NOUGHT.
    const ratio = { key: 'own_ey', label: 'Earnings yield', formula: '100 / pe', unit: 'ratio' };
    const withRatio = S.withCustomRatios(rows, [ratio]);
    const noPe = withRatio.filter((r: any) => r.cells.pe?.state !== 'value');
    for (const row of noPe) {
      if (row.cells.own_ey?.state === 'value') {
        faults.push(`${row.ticker} has no price/earnings and a custom ratio built on it was worked out anyway`);
      }
    }
  }

  // ---- 9. ONE LISTING PER COMPANY HIDES NOBODY IT CANNOT PLACE -------
  {
    // GROUPED THE WAY `markHomeListings` GROUPS, which is lowercased and
    // trimmed. Grouping on the raw name instead reported Shopify as a company
    // with every listing hidden: the SEC spells it "SHOPIFY INC." and the
    // vendor "Shopify Inc.", so the two lines looked like two companies to the
    // check and like one to the code under test.
    const names = new Map<string, any[]>();
    for (const row of rows) {
      const key = String(row.name).trim().toLowerCase();
      names.set(key, [...(names.get(key) ?? []), row]);
    }
    for (const [name, group] of names) {
      const home = group.filter((r: any) => r.homeListing);
      if (!home.length) faults.push(`every listing of ${name} is hidden, so the company cannot be found`);
      if (group.length > 1 && home.length > 1) {
        // Allowed, but only where the rule genuinely could not choose, and
        // then every listing says so.
        for (const r of home) {
          if (!r.listingNote) faults.push(`${r.ticker} is one of ${home.length} kept listings and says nothing about why`);
        }
      }
    }
    const one = S.universeOf(rows, { ...S.EMPTY_SCREEN, oneListingPerCompany: true });
    const all = S.universeOf(rows, { ...S.EMPTY_SCREEN, oneListingPerCompany: false });
    if (!(one.length < all.length)) {
      faults.push(`one listing per company kept ${one.length} of ${all.length}, so it hid nothing at all`);
    }
  }

  // ---- 10. NOTHING IS SORTED BY A SCORE, BECAUSE THERE IS NONE -------
  //
  // Rule 13. The default sort is a size, and a figure that is not a figure
  // sorts last whichever way the column runs — a null read as nought would put
  // every company with no margin at the top of a worst-margin sort, which
  // reads as a finding about them.
  {
    if (S.DEFAULT_SORT !== 'marketCap') {
      faults.push(`the default sort is ${S.DEFAULT_SORT}, which is not the neutral one rule 13 asks for`);
    }
    for (const key of ['pe', 'operatingMargin']) {
      for (const descending of [true, false]) {
        const sorted = S.sortRows(rows, key, descending);
        const firstGap = sorted.findIndex((r: any) => r.cells[key]?.state !== 'value');
        if (firstGap >= 0) {
          const after = sorted.slice(firstGap).filter((r: any) => r.cells[key]?.state === 'value');
          if (after.length) {
            faults.push(`sorting by ${key} put ${after.length} figures after a company that has none`);
          }
        }
        if (sorted.length !== rows.length) faults.push(`sorting by ${key} changed how many rows there are`);
      }
    }
  }

  if (faults.length) {
    totalProblems += faults.length;
    console.log(`  PROBLEM: ${faults.length} faults in the screener:`);
    faults.slice(0, 15).forEach((f) => console.log(`           ${f}`));
    if (faults.length > 15) console.log(`           ... and ${faults.length - 15} more`);
  } else {
    const financials = rows.filter((r: any) => r.financial).length;
    const nmRules = metrics.filter((m: any) => m.notMeaningfulForFinancials).length;
    console.log(
      `  ${rows.length} companies and ${metrics.length} metrics, every column publishing its formula, its ` +
        `source and the period each of its ${values} figures covers`
    );
    console.log(
      '  a filter nothing can fail matches exactly the companies that have the figure, and every company that has not got it is set aside and counted: matched plus rejected plus excluded is the universe, on every one of the 16 metrics'
    );
    console.log(
      `  ${financials} companies on the bank template answer n.m. with a reason on all ${nmRules} metrics ` +
        'rule 5 names, and the companies outside it are still asked'
    );
    console.log(
      '  no banned word in any column label, formula, source, operator, column set, absence reason or listing note, nor in the screen’s own prose'
    );
    console.log(
      '  the count equals the rows on 240 screens; a screen survives its own web address unchanged, ratios and all; the text view and the chips are one set of filters and nonsense is refused rather than guessed at; a reader’s formula is arithmetic and nothing else, and seven attempts to make it more than that are refused'
    );
  }
}

// ---------------------------------------------------------------------------
// NO RATE IS READ FROM A PUBLISHER WHOSE TERMS ARE NOT RECORDED
// ---------------------------------------------------------------------------
//
// Canada and Denmark were added on 2026-11-01 because their own central banks
// publish the yield and permit its reuse. Switzerland was NOT, although the
// Swiss National Bank publishes the same figure in the same shape: its terms
// do not allow commercial reuse without written permission. That is a licence
// rather than a gap, and the only thing that keeps the distinction honest is
// that every source carries its terms beside its URL — so this checks that
// nothing is ever read from a publisher whose terms nobody wrote down.
{
  console.log('\n=== every rate names its publisher, and every publisher its terms ===');
  const { RISK_FREE_SOURCES } = await import(`file:///${REPO}/api/company.js`);
  const faults: string[] = [];
  const known = new Set<string>();
  let sources = 0;

  for (const [currency, spec] of Object.entries(RISK_FREE_SOURCES as Record<string, any>)) {
    for (const source of [spec, ...(Array.isArray(spec.fallbacks) ? spec.fallbacks : [])]) {
      sources++;
      known.add(String(source.publisher));
      for (const field of ['name', 'publisher', 'terms', 'url', 'read']) {
        if (!source[field]) faults.push(`${currency}: a source with no ${field}`);
      }
      // TERMS ARE A SENTENCE, NOT A WORD. "free" on its own records nothing a
      // reader or a lawyer could act on.
      if (String(source.terms || '').trim().split(/\s+/).length < 4) {
        faults.push(`${currency}: terms of "${source.terms}", which is not a statement of anything`);
      }
      if (!/^https:\/\//.test(String(source.url || ''))) {
        faults.push(`${currency}: a source whose terms cannot be read back (${source.url})`);
      }
      const freq = source.frequency || 'daily';
      if (!['daily', 'weekly', 'monthly'].includes(freq)) {
        faults.push(`${currency}: a publication frequency of "${freq}", which has no observation floor`);
      }
    }
  }

  // AND SWITZERLAND IS ABSENT ON PURPOSE. If a Swiss source is ever added, it
  // must come with terms that permit this use; until then its absence is the
  // decision, and a check that did not notice it being added quietly would
  // make the decision worthless.
  if (RISK_FREE_SOURCES.CHF) {
    faults.push(
      'a source has been added for CHF. The Swiss National Bank’s terms do not permit commercial reuse ' +
        'without written permission (DATA_CONSTRAINTS.md, Paid · last), so this needs its terms checked ' +
        'and this check updated rather than deleted'
    );
  }

  // ---- AND EVERY RATE ON DISK CAME FROM ONE OF THEM -------------------
  const files = fs.readdirSync(PAYLOADS).filter((f) => f.endsWith('.json'));
  let rated = 0;
  const byPublisher: Record<string, number> = {};
  for (const file of files) {
    let payload: any;
    try {
      payload = JSON.parse(fs.readFileSync(path.join(PAYLOADS, file), 'utf8'));
    } catch {
      continue;
    }
    if (payload?.error) continue;
    const rf = payload?.riskFree;
    if (!rf || typeof rf.rate !== 'number') continue;
    rated++;
    // The publisher may carry "— used because ..." when a fallback answered;
    // the name in front of it is the one that must be in the table.
    const named = String(rf.publisher || '').split(' — used because ')[0];
    byPublisher[named] = (byPublisher[named] ?? 0) + 1;
    if (!known.has(named)) {
      faults.push(`${file}: a rate published by "${named}", which is not a source this code declares`);
    }
    if (!rf.terms || !rf.sourceUrl) {
      faults.push(`${file}: a rate with no terms or no source link beside it`);
    }
  }

  if (faults.length) {
    totalProblems += faults.length;
    console.log(`  PROBLEM: ${faults.length} faults in how the rate sources are declared:`);
    faults.slice(0, 12).forEach((f) => console.log(`           ${f}`));
  } else {
    console.log(
      `  ${sources} sources across ${Object.keys(RISK_FREE_SOURCES).length} currencies, every one with a ` +
        'name, a publisher, a statement of terms, a link those terms can be read back at, and a stated ' +
        'publication frequency'
    );
    console.log(
      `  ${rated} payloads carry a rate, every one from a declared publisher and carrying its terms: ` +
        `${Object.entries(byPublisher).map(([k, v]) => `${v} ${k}`).join(', ')}`
    );
    console.log(
      '  and there is no source for the Swiss franc, which is a licence rather than a gap: the Swiss ' +
        'National Bank publishes the figure and does not permit this use of it'
    );
  }
}

  console.log('\n=== the risk-free rate: one fetch per currency, three tries, a fallback behind ===');
  const { fetchRiskFreeRate, clearRiskFreeCache, riskFreeCacheStats } = await import(
    `file:///${REPO}/api/company.js`
  );
  const realFetch = globalThis.fetch;
  const isNum = (v: unknown): v is number => typeof v === 'number' && isFinite(v);
  const faults: string[] = [];

  // The Treasury answers XML, a year per request. Written out here in its own
  // shape so what is under test is the code that reads it.
  const treasuryXml = (days: [string, number][]) =>
    '<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom" ' +
    'xmlns:d="http://schemas.microsoft.com/ado/2007/08/dataservices" ' +
    'xmlns:m="http://schemas.microsoft.com/ado/2007/08/dataservices/metadata">' +
    days
      .map(
        ([date, value]) =>
          '<entry><content><m:properties>' +
            `<d:NEW_DATE m:type="Edm.DateTime">${date}T00:00:00</d:NEW_DATE>` +
            `<d:BC_10YEAR m:type="Edm.Double">${value}</d:BC_10YEAR>` +
            '</m:properties></content></entry>'
      )
      .join('') +
    '</feed>';

  // A year of trading days, so the thirty-observation floor is met.
  const tradingDays = (from: string, n: number, rate: (i: number) => number): [string, number][] => {
    const out: [string, number][] = [];
    const d = new Date(`${from}T00:00:00Z`);
    for (let i = 0; out.length < n; i++) {
      d.setUTCDate(d.getUTCDate() + 1);
      const day = d.getUTCDay();
      if (day === 0 || day === 6) continue;
      out.push([d.toISOString().slice(0, 10), rate(out.length)]);
    }
    return out;
  };

  // ---- 1. ONE FETCH PER CURRENCY, AND EACH COMPANY ITS OWN WINDOW ----
  //
  // The rate cannot be shared, because every company averages the window to
  // its own balance sheet date; the SERIES can. So the test is both halves at
  // once: one request, and two companies with different year ends getting
  // DIFFERENT rates out of it. A sloped series is used for exactly that — on a
  // flat one, caching the rate and caching the series look identical.
  {
    clearRiskFreeCache();
    let asked = 0;
    // Rising by a basis point a day, from 2024 so every window is covered.
    const days = tradingDays('2024-06-28', 700, (i) => 3 + i * 0.01);
    globalThis.fetch = (async (input: any) => {
      const url = String(typeof input === 'string' ? input : input?.url ?? input);
      if (/home\.treasury\.gov/.test(url)) {
        asked++;
        const year = Number((url.match(/field_tdr_date_value=(\d{4})/) || [])[1]);
        return new Response(treasuryXml(days.filter(([d]) => Number(d.slice(0, 4)) === year)), {
          status: 200, headers: { 'Content-Type': 'application/xml' },
        });
      }
      return new Response('', { status: 503 });
    }) as any;

    const a = await fetchRiskFreeRate('USD', '2025-12-31');
    const askedAfterFirst = asked;
    const b = await fetchRiskFreeRate('USD', '2025-09-30');
    const c = await fetchRiskFreeRate('USD', '2025-06-30');
    const d = await fetchRiskFreeRate('USD', '2025-12-31');
    globalThis.fetch = realFetch;

    if (asked !== askedAfterFirst) {
      faults.push(
        `four companies in one currency asked the publisher ${asked} times, ${askedAfterFirst} of them for ` +
          'the first of them: the series is being fetched again rather than shared'
      );
    }
    if (!(askedAfterFirst > 0)) faults.push('nothing was fetched at all, so the test proves nothing');
    for (const [label, got] of [['a', a], ['b', b], ['c', c]] as [string, any][]) {
      if (!isNum(got.rate)) faults.push(`company ${label} got no rate from a series that covers its window`);
    }
    // AND THE WINDOWS REALLY DIFFER, which is what makes sharing the series
    // right and sharing the rate wrong.
    if (isNum(a.rate) && isNum(b.rate) && Math.abs(a.rate - b.rate) < 1e-9) {
      faults.push(
        'two companies three months apart on a rising curve were given the same rate, so the rate is ' +
          'being shared rather than the series'
      );
    }
    if (isNum(a.rate) && isNum(d.rate) && Math.abs(a.rate - d.rate) > 1e-12) {
      faults.push('the same company asked twice got two different rates out of one series');
    }
  }

  // ---- 2. THREE ATTEMPTS, AND THE RATE STILL ARRIVES -----------------
  {
    clearRiskFreeCache();
    const days = tradingDays('2024-12-28', 300, () => 4.2);
    let calls = 0;
    const before = riskFreeCacheStats.retries;
    globalThis.fetch = (async (input: any) => {
      const url = String(typeof input === 'string' ? input : input?.url ?? input);
      if (/home\.treasury\.gov/.test(url)) {
        calls++;
        // The first two years-worth of requests fail the way a bad moment
        // fails: a 503, which says nothing about intent.
        if (calls <= 2) return new Response('upstream wobble', { status: 503 });
        const year = Number((url.match(/field_tdr_date_value=(\d{4})/) || [])[1]);
        return new Response(treasuryXml(days.filter(([d]) => Number(d.slice(0, 4)) === year)), {
          status: 200, headers: { 'Content-Type': 'application/xml' },
        });
      }
      return new Response('', { status: 503 });
    }) as any;
    const got = await fetchRiskFreeRate('USD', '2025-12-31');
    globalThis.fetch = realFetch;
    if (!isNum(got.rate)) {
      faults.push(`a publisher that dropped two requests and answered the third gave no rate (${got.reason})`);
    }
    if (riskFreeCacheStats.retries <= before) {
      faults.push('the rate arrived without anything being retried, so the retry is not what saved it');
    }
  }

  // ---- 3. A REFUSAL IS NOT RETRIED -----------------------------------
  //
  // Persistence against a publisher that has said no is defeating a
  // protection, which `docs/` §4.4 forbids. A 403 is asked once.
  {
    clearRiskFreeCache();
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return new Response('go away', { status: 403 });
    }) as any;
    const got = await fetchRiskFreeRate('SEK', '2025-12-31');
    globalThis.fetch = realFetch;
    if (isNum(got.rate)) faults.push('a publisher that refused twice over still produced a rate');
    // One for the Riksbank and one for the fallback behind it, and no more.
    if (calls > 2) {
      faults.push(`a 403 was asked ${calls} times, so a refusal is being retried rather than respected`);
    }
  }

  // ---- 4. THE PRIMARY BLOCKED, AND THE FALLBACK NAMED ----------------
  {
    clearRiskFreeCache();
    const days = tradingDays('2024-12-28', 300, () => 4.4);
    globalThis.fetch = (async (input: any) => {
      const url = String(typeof input === 'string' ? input : input?.url ?? input);
      // THE TREASURY BLOCKED ENTIRELY, which is what happened on 2026-10-31.
      if (/home\.treasury\.gov/.test(url)) return new Response('', { status: 503 });
      if (/fredgraph\.csv/.test(url)) {
        return new Response('observation_date,DGS10\n' + days.map(([d, v]) => `${d},${v}`).join('\n'), {
          status: 200, headers: { 'Content-Type': 'text/csv' },
        });
      }
      return new Response('', { status: 503 });
    }) as any;
    const got = await fetchRiskFreeRate('USD', '2025-12-31');
    globalThis.fetch = realFetch;
    if (!isNum(got.rate)) {
      faults.push(`with the Treasury blocked there was no rate at all (${got.reason})`);
    } else if (Math.abs(got.rate - 0.044) > 1e-9) {
      faults.push(`the fallback answered ${(got.rate * 100).toFixed(4)}% on a flat 4.4% series`);
    }
    if (!/FRED, republishing US Treasury/.test(String(got.publisher))) {
      faults.push(`the fallback answered as "${got.publisher}" rather than naming who it stood in for`);
    }
    if (!/used because/.test(String(got.publisher))) {
      faults.push(`the fallback did not say why it was used: "${got.publisher}"`);
    }
  }

  // ---- 5. A BLANK CELL IS NOT A YIELD OF NOUGHT ----------------------
  //
  // FRED prints an EMPTY cell for every US market holiday, and `Number('')` is
  // 0. Reading those as rates put twelve days of 0% into a year of Treasury
  // yields and took 19.7 basis points off the mean — measured on 2026-11-01,
  // when the two sources agreed to the last decimal on all 250 days they
  // shared and disagreed by 4.0977% against 4.2944% on the mean.
  {
    clearRiskFreeCache();
    const days = tradingDays('2024-12-28', 300, () => 4.4);
    globalThis.fetch = (async (input: any) => {
      const url = String(typeof input === 'string' ? input : input?.url ?? input);
      if (/home\.treasury\.gov/.test(url)) return new Response('', { status: 503 });
      if (/fredgraph\.csv/.test(url)) {
        // Every tenth day blank, the way a holiday arrives.
        const body =
          'observation_date,DGS10\n' +
          days.map(([d, v], i) => `${d},${i % 10 === 0 ? '' : v}`).join('\n');
        return new Response(body, { status: 200, headers: { 'Content-Type': 'text/csv' } });
      }
      return new Response('', { status: 503 });
    }) as any;
    const got = await fetchRiskFreeRate('USD', '2025-12-31');
    globalThis.fetch = realFetch;
    if (!isNum(got.rate)) {
      faults.push(`a series with blank holidays produced no rate at all (${got.reason})`);
    } else if (Math.abs(got.rate - 0.044) > 1e-9) {
      faults.push(
        `blank cells moved the mean to ${(got.rate * 100).toFixed(4)}% on a flat 4.4% series, so an empty ` +
          'cell is still being read as a yield of nought'
      );
    }
  }

  clearRiskFreeCache();
  if (faults.length) {
    totalProblems += faults.length;
    console.log(`  PROBLEM: ${faults.length} faults in how the risk-free rate is fetched:`);
    faults.forEach((f) => console.log(`           ${f}`));
  } else {
    console.log(
      '  four companies in one currency fetch the series once between them, and two of them three months ' +
        'apart on a rising curve still get different rates: the series is shared and the window is not'
    );
    console.log(
      '  a publisher that drops two requests and answers the third still produces a rate, and a 403 is ' +
        'asked once and respected rather than retried'
    );
    console.log(
      '  with the US Treasury blocked outright the rate is 4.4000% from "FRED, republishing US Treasury", ' +
        'which names the publisher it stood in for'
    );
    console.log(
      '  and a series whose holidays are blank cells averages 4.4000% rather than reading an empty cell as ' +
        'a yield of nought, which cost 19.7 basis points before this'
    );
  }
}

  console.log('\n=== the rupee rate: the OECD first, FRED behind it ===');
  const { fetchRiskFreeRate, clearRiskFreeCache } = await import(`file:///${REPO}/api/company.js`);

  // The year to a 31 March balance sheet date, which is most Indian companies.
  const MONTHS: [string, number][] = [
    ['2025-04', 6.455],
    ['2025-05', 6.272],
    ['2025-06', 6.3075],
    ['2025-07', 6.35],
    ['2025-08', 6.522],
    ['2025-09', 6.585],
    ['2025-10', 6.482],
    ['2025-11', 6.5375],
    ['2025-12', 6.6325],
    ['2026-01', 6.732],
    ['2026-02', 6.77],
    ['2026-03', 6.84],
  ];
  const MEAN = MONTHS.reduce((t, [, v]) => t + v, 0) / MONTHS.length / 100;

  // Each publisher’s own format, including how each dates a month.
  const oecdCsv = (rows: [string, number][]) =>
    'DATAFLOW,REF_AREA,FREQ,MEASURE,UNIT_MEASURE,ACTIVITY,ADJUSTMENT,TRANSFORMATION,TIME_HORIZ,' +
    'METHODOLOGY,TIME_PERIOD,OBS_VALUE,OBS_STATUS,UNIT_MULT,DECIMALS,BASE_PER\n' +
    rows
      .map(
        ([month, value]) =>
          `OECD.SDD.STES:DSD_STES@DF_FINMARK(4.0),IND,M,IRLT,PA,_Z,_Z,_Z,_Z,N,${month},${value},A,0,2,`
      )
      .join('\n');
  const fredCsv = (rows: [string, number][]) =>
    'observation_date,INDIRLTLT01STM\n' +
    rows.map(([month, value]) => `${month}-01,${value.toFixed(14)}`).join('\n');

  const asked = { oecd: 0, fred: 0 };
  const realFetch = globalThis.fetch;
  const stub =
    (oecd: [string, number][] | null, fred: [string, number][] | null) =>
    async (input: any) => {
      const url = String(typeof input === 'string' ? input : input?.url ?? input);
      const answer = (body: string) =>
        ({ ok: true, status: 200, text: async () => body }) as any;
      const down = (status: number) => ({ ok: false, status, text: async () => '' }) as any;
      if (url.includes('sdmx.oecd.org')) {
        asked.oecd++;
        return oecd ? answer(oecdCsv(oecd)) : down(503);
      }
      if (url.includes('fredgraph.csv')) {
        asked.fred++;
        return fred ? answer(fredCsv(fred)) : down(503);
      }
      throw new Error(`the rupee check did not expect a request to ${url.slice(0, 60)}`);
    };

  const faults: string[] = [];
  const near = (a: any, b: any) => typeof a === 'number' && Math.abs(a - b) < 1e-12;
  let fromOecd: any = null;
  let fromFred: any = null;
  let fromShort: any = null;
  let fromNeither: any = null;
  try {
    // A NEW STUB NEEDS A NEW CACHE. The series is now fetched once per
    // currency and shared (`KI-34`), so a scenario that blocks a publisher is
    // answered out of the scenario before it unless the cache is cleared with
    // the stub. Nothing here is testing the cache; it is being kept out of the
    // way of what is.
    clearRiskFreeCache();
    globalThis.fetch = stub(MONTHS, MONTHS) as any;
    fromOecd = await fetchRiskFreeRate('INR', '2026-03-31');
    const askedFredAnyway = asked.fred;

    asked.oecd = 0;
    asked.fred = 0;
    clearRiskFreeCache();
    globalThis.fetch = stub(null, MONTHS) as any;
    fromFred = await fetchRiskFreeRate('INR', '2026-03-31');

    clearRiskFreeCache();
    globalThis.fetch = stub(MONTHS.slice(0, 3), MONTHS) as any;
    fromShort = await fetchRiskFreeRate('INR', '2026-03-31');

    clearRiskFreeCache();
    globalThis.fetch = stub(null, null) as any;
    fromNeither = await fetchRiskFreeRate('INR', '2026-03-31');

    // ---- 1. the OECD answers, and nothing else is asked ----
    if (!near(fromOecd?.rate, MEAN)) {
      faults.push(`the OECD answer gave ${fromOecd?.rate} rather than the mean of the twelve months, ${MEAN}`);
    }
    if (fromOecd?.publisher !== 'OECD') {
      faults.push(`the OECD answer is published by ${JSON.stringify(fromOecd?.publisher)}, not "OECD"`);
    }
    if (fromOecd?.observations !== MONTHS.length) {
      faults.push(`the OECD answer averaged ${fromOecd?.observations} readings, not ${MONTHS.length}`);
    }
    if (askedFredAnyway) {
      faults.push(`FRED was asked ${askedFredAnyway} time(s) although the OECD had answered`);
    }

    // ---- 2. the OECD blocked: the same rate, and it says whose it is ----
    if (!near(fromFred?.rate, fromOecd?.rate)) {
      faults.push(
        `with the OECD blocked the rate came back as ${fromFred?.rate} rather than the ${fromOecd?.rate} ` +
          'the OECD gave: the fallback is not the same series, or not averaged the same way'
      );
    }
    if (!/FRED/.test(String(fromFred?.publisher))) {
      faults.push(`the fallback answer is published by ${JSON.stringify(fromFred?.publisher)}, which does not name FRED`);
    }
    if (!/OECD/.test(String(fromFred?.publisher))) {
      faults.push(
        `the fallback answer does not say why it was used: ${JSON.stringify(fromFred?.publisher)}`
      );
    }
    if (fromFred?.observations !== MONTHS.length) {
      faults.push(`the fallback averaged ${fromFred?.observations} readings, not ${MONTHS.length}`);
    }
    // AND THE SAME WINDOW, SAID THE SAME WAY. The OECD dates a monthly
    // observation "2025-04" and FRED dates it "2025-04-01", so without one line
    // of normalisation the two are only interchangeable by luck: the window is
    // a string comparison, and a window boundary that falls on the first of a
    // month keeps the month in one series and drops it from the other. It also
    // reaches the reader \u2014 the sentence under a rupee valuation names the
    // window it averaged.
    if (
      fromOecd?.windowFrom !== fromFred?.windowFrom ||
      fromOecd?.windowTo !== fromFred?.windowTo
    ) {
      faults.push(
        `the two sources describe the same year differently: the OECD says ${fromOecd?.windowFrom} to ` +
          `${fromOecd?.windowTo} and FRED says ${fromFred?.windowFrom} to ${fromFred?.windowTo}`
      );
    }

    // ---- 3. an OECD answer too short to average hands on ----
    if (!near(fromShort?.rate, fromOecd?.rate) || !/FRED/.test(String(fromShort?.publisher))) {
      faults.push(
        'three months from the OECD were averaged, or did not hand on to the fallback: ' +
          `${fromShort?.observations} readings from ${JSON.stringify(fromShort?.publisher)}`
      );
    }

    // ---- 4. both down: no rate, and a reason naming both ----
    if (fromNeither?.rate !== null && fromNeither?.rate !== undefined) {
      faults.push(`with both publishers down a rate of ${fromNeither?.rate} came back rather than nothing`);
    }
    const why = String(fromNeither?.reason || '');
    if (!/OECD/.test(why) || !/FRED/.test(why)) {
      faults.push(`the refusal does not name both publishers that were asked: ${JSON.stringify(why.slice(0, 90))}`);
    }
  } finally {
    globalThis.fetch = realFetch;
  }

  // ---- 5. and it is the rate the payload set was built on ----
  //
  // The twelve months above are the real ones for a 31 March 2026 year end, so
  // the mean of them is the rate the six Indian payloads on disk carry. If the
  // set is ever refetched against a different window this says so rather than
  // failing, because a moved window is not a fault.
  let tied = '';
  try {
    const rel: any = readPayload('RELIANCE.NS.json');
    const saved = rel?.riskFree;
    if (saved?.windowFrom === '2025-04-01' && saved?.windowTo === '2026-03-01') {
      if (!near(saved.rate, MEAN)) {
        faults.push(
          `the payload set carries ${saved.rate} for the rupee over the same window, not the ${MEAN} these ` +
            'twelve months average to'
        );
      } else {
        tied = `, and the same twelve months the payload set was built on (${(MEAN * 100).toFixed(4)}%)`;
      }
    } else {
      tied = `, measured against a window the payload set no longer uses (it holds ${saved?.windowFrom} to ${saved?.windowTo})`;
    }
  } catch {
    tied = '';
  }

  if (faults.length) {
    totalProblems += faults.length;
    console.log(`  PROBLEM: ${faults.length} faults in the rupee rate chain:`);
    faults.forEach((f) => console.log(`           ${f}`));
  } else {
    console.log(
      `  the OECD answers at ${(fromOecd.rate * 100).toFixed(4)}% over ${fromOecd.observations} monthly ` +
        `readings and FRED is not asked${tied}`
    );
    console.log(
      `  with the OECD blocked, ${fromFred.publisher.split(' — ')[0]} answers with the same rate to the ` +
        'last digit, and the answer says why it was used'
    );
    console.log(
      '  three months from the OECD are not averaged into a year: the window floor hands on to the fallback'
    );
    console.log(`  with both down there is no rate at all: "${String(fromNeither.reason).slice(0, 96)}"`);
  }
}

// ---------------------------------------------------------------------------
// THE RISK AND COST-OF-CAPITAL CARD: FIVE RULES (docs/COST_OF_CAPITAL_SPEC.md)
// ---------------------------------------------------------------------------
//
// The card's own principle is that it shows the numbers the engine uses and
// never one rate while the model discounts at another. These five are the ways
// that goes wrong, each measured over every payload on disk and each proved to
// fail by breaking it on purpose.
//
//   THE REGRESSION IS RIGHT (rules 1 to 4). A slope is easy to get wrong in a
//   way that looks fine — the wrong series on the wrong axis gives 1/beta, and
//   on a share that moves with its market that is a plausible number. So the
//   first case here is a constructed one where the answer is known before the
//   code runs: a share built as exactly 1.3 times an index plus half a point,
//   whose beta must come back 1.3, whose alpha must come back 0.005 and whose
//   R squared must be 1.
//
//   COUNTRY RISK IS ADDED ONCE (rule 13). With it switched on, the premium in
//   use must be the mature-market premium plus the country's, and the cost of
//   equity must be the risk-free rate plus beta times THAT, with nothing added
//   again. The label has to change too: a reader looking at "4.23% mature" and
//   "2.85% country" cannot tell a 7.08% premium from a 9.93% one unless the row
//   says which it is.
//
//   NO BANK GETS A WACC (rule 24). A weighted average of deposits and equity
//   describes nothing, and the engine values banks by residual income at a cost
//   of equity instead. The card must carry no WACC for any of them and must say
//   why rather than leaving a blank.
//
//   A MINOR UNIT IS NORMALISED (rule 25). London quotes pence. A market
//   capitalisation struck on the quoted number is a hundred times too big,
//   which makes the equity weight 100% and the cost of capital the cost of
//   equity — about two points wrong on a company with real borrowings, in the
//   direction that makes everything look cheap. The check is an identity across
//   the card's own rows: the price it shows times the shares it shows must be
//   the market capitalisation the weights were struck from.
//
//   EVERY INPUT SHOWS A SOURCE AND A DATE, or says why there is no figure. A
//   row with a number, no publisher and no date is the thing this site exists
//   not to produce.
//
//   AN EDIT REACHES THE MODEL. A panel of inputs that look editable and do not
//   change the valuation is worse than no panel. A point on the risk-free rate
//   must move the cost of equity by exactly a point and must move the value per
//   share; so must a change to beta and to the premium.
{
  console.log('\n=== the risk and cost-of-capital card: five rules, and the two defaults ===');
  const {
    costOfCapitalFor,
    betaEstimate,
    regress,
    blume,
    BETA_MINIMUM,
    BETA_WEAK_R2,
    BETA_WEAK_STANDARD_ERROR,
    COUNTRY_RISK_ON_BY_DEFAULT,
  } = await import(`file:///${REPO}/src/data/costOfCapital.ts`);
  const { deriveModel } = await import(`file:///${REPO}/src/data/deriveModel.js`);
  const { INDICES, INDEX_SYMBOLS, indexForListing, monthEnds, weekEnds } = await import(
    `file:///${REPO}/src/data/marketIndex.ts`
  );
  const { MATURE_ERP_PCT, countryRiskFor, COUNTRY_RISK_VINTAGE } = await import(
    `file:///${REPO}/src/data/countryRisk.ts`
  );

  const faults: string[] = [];
  const near = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol;
  const isNum = (v: unknown): v is number => typeof v === 'number' && isFinite(v);

  // ---- 0. THE TWO COPIES OF THE ALLOW-LIST AGREE ------------------------
  //
  // `api/marketIndex.js` cannot import from `src/`: each file in that
  // directory is packaged on its own by the host and a shared import that
  // fails to bundle takes the route down. So the list of indices exists twice,
  // and a second copy that nothing compares is a second copy that goes stale —
  // the trap `CLAUDE.md` names as two copies of a positional layout.
  const routeSource = fs.readFileSync(path.join(REPO, 'api/marketIndex.js'), 'utf8');
  const routeBlock = routeSource.slice(
    routeSource.indexOf('const INDEX_NAMES'),
    routeSource.indexOf('const TERMS')
  );
  const routeSymbols = [...routeBlock.matchAll(/'([^']+)':\s*'/g)].map((m) => m[1]);
  const missingFromRoute = (INDEX_SYMBOLS as string[]).filter((s) => !routeSymbols.includes(s));
  const extraInRoute = routeSymbols.filter((s) => !(INDEX_SYMBOLS as string[]).includes(s));
  if (missingFromRoute.length || extraInRoute.length) {
    faults.push(
      `the index allow-list differs between src/data/marketIndex.ts and api/marketIndex.js: ` +
        `${missingFromRoute.length} the route would refuse (${missingFromRoute.join(', ')}), ` +
        `${extraInRoute.length} the route serves and nothing asks for (${extraInRoute.join(', ')})`
    );
  }
  for (const index of Object.values(INDICES) as any[]) {
    if (!routeBlock.includes(`'${index.symbol}': '${index.name}'`)) {
      faults.push(`${index.symbol} is called "${index.name}" here and something else in the route`);
    }
  }

  // ---- 1. THE REGRESSION, ON A SERIES WHOSE ANSWER IS KNOWN -------------
  //
  // Built rather than recorded: the index moves by a fixed pattern and the
  // share moves by exactly 1.3 of it plus 0.5% a month, so the slope, the
  // intercept and the fit are all known before the regression runs. An
  // off-by-one in the pairing, the two series swapped, or log returns where
  // simple ones were meant all show up here and nowhere else.
  const KNOWN_BETA = 1.3;
  const KNOWN_ALPHA = 0.005;
  const pattern = [0.031, -0.018, 0.024, 0.009, -0.037, 0.012, 0.028, -0.006, 0.017, -0.022, 0.041, 0.003];
  const indexCloses: number[] = [100];
  const stockCloses: number[] = [50];
  const dates: string[] = [];
  const monthEnd = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10);
  dates.push(monthEnd(2019, 0));
  for (let i = 0; i < 72; i++) {
    const r = pattern[i % pattern.length];
    indexCloses.push(indexCloses[i] * (1 + r));
    stockCloses.push(stockCloses[i] * (1 + KNOWN_BETA * r + KNOWN_ALPHA));
    dates.push(monthEnd(2019 + Math.floor((i + 1) / 12), (i + 1) % 12));
  }
  const constructedIndex = { dates, closes: indexCloses };
  const constructedStock = { dates, closes: stockCloses };
  const known = betaEstimate(constructedStock, constructedIndex, 5, 'monthly');
  if (known.raw === null) {
    faults.push(`the constructed series produced no beta at all: ${known.missing}`);
  } else {
    if (!near(known.raw, KNOWN_BETA, 1e-9)) {
      faults.push(`a share built as exactly ${KNOWN_BETA} times its index regresses to ${known.raw}`);
    }
    if (!near(known.r2, 1, 1e-9)) {
      faults.push(`a share that is a straight line in its index has an R squared of ${known.r2}, not 1`);
    }
    if (!near(known.adjusted!, blume(KNOWN_BETA), 1e-12)) {
      faults.push(`the Blume adjustment of ${KNOWN_BETA} came back ${known.adjusted}, not ${blume(KNOWN_BETA)}`);
    }
    if (known.observations !== 60) {
      faults.push(`a five-year monthly window over a complete series gave ${known.observations} returns, not 60`);
    }
  }
  const fit = regress(
    stockCloses.slice(1).map((c, i) => c / stockCloses[i] - 1),
    indexCloses.slice(1).map((c, i) => c / indexCloses[i] - 1)
  );
  if (!fit || !near(fit.intercept, KNOWN_ALPHA, 1e-12)) {
    faults.push(`the intercept of a series built with ${KNOWN_ALPHA} a month came back ${fit?.intercept}`);
  }
  // A series the index cannot explain is not a beta of nought.
  const flatIndex = { dates, closes: dates.map(() => 100) };
  const flat = betaEstimate(constructedStock, flatIndex, 5, 'monthly');
  if (flat.raw !== null) {
    faults.push(`an index that never moved produced a beta of ${flat.raw} instead of refusing`);
  }
  // And too short a history is refused rather than regressed on four points.
  const short = betaEstimate(
    { dates: dates.slice(0, 6), closes: stockCloses.slice(0, 6) },
    { dates: dates.slice(0, 6), closes: indexCloses.slice(0, 6) },
    5,
    'monthly'
  );
  if (short.raw !== null) {
    faults.push(`five monthly returns produced a beta; the floor is ${BETA_MINIMUM.monthly}`);
  }

  // ---- the cards, over every payload on disk ----------------------------
  const indexCache = new Map<string, any>();
  const indexFor = (symbol: string) => {
    if (!indexCache.has(symbol)) {
      const f = path.join(PAYLOADS, 'indices', `${symbol.replace(/[^A-Za-z0-9]+/g, '_')}.json`);
      if (!fs.existsSync(f)) indexCache.set(symbol, null);
      else {
        const b = JSON.parse(fs.readFileSync(f, 'utf8'));
        indexCache.set(symbol, { series: { dates: b.dates, closes: b.closes }, asOf: b.asOf });
      }
    }
    return indexCache.get(symbol);
  };

  const files = fs.readdirSync(PAYLOADS).filter((f) => f.endsWith('.json'));
  let cards = 0;
  let banks = 0;
  let withKe = 0;
  let withWacc = 0;
  let withBeta = 0;
  let minorUnit = 0;
  let rowsChecked = 0;
  let addedOnce = 0;
  let editsLanded = 0;
  let editsMovedValue = 0;
  let premiumAgrees = 0;
  let betaSwitched = 0;
  let weakWarned = 0;
  let indexless = 0;
  let noRate = 0;
  const betasSeen: number[] = [];
  const marketsSeen = new Set<string>();

  for (const file of files) {
    let payload: any;
    try {
      payload = JSON.parse(fs.readFileSync(path.join(PAYLOADS, file), 'utf8'));
    } catch {
      continue;
    }
    const choice = indexForListing(payload);
    if (choice.index) marketsSeen.add(choice.market);
    else indexless++;
    const index = choice.index ? indexFor(choice.index.symbol) : null;
    const card = costOfCapitalFor(payload, { index });
    if (!card) {
      faults.push(`${file} produces no card at all, not even a refusal`);
      continue;
    }
    cards++;
    if (card.costOfEquity !== null) withKe++;
    if (card.wacc !== null) withWacc++;

    // ---- 2. NO BANK GETS A WACC ---------------------------------------
    if (card.template === 'bank') {
      banks++;
      if (card.wacc !== null) {
        faults.push(`${file} is on the bank template and still carries a WACC of ${card.wacc}`);
      }
      if (!card.waccMissing || !/not applicable/i.test(card.waccMissing)) {
        faults.push(`${file} is a bank and does not say its WACC is not applicable: "${card.waccMissing}"`);
      }
      // Rule 8: a bank's beta is not relevered.
      if (card.beta.relevered) {
        faults.push(`${file} is a bank and its beta has been relevered, which rule 8 forbids`);
      }
    }

    // ---- 2b. NO RATE MEANS NO COST OF EQUITY -------------------------
    //
    // `null + 0.0423 * 1.02` is 4.31% in JavaScript, so a currency with no
    // published ten-year yield used to produce a cost of equity equal to the
    // premium alone — a plausible-looking rate with nothing behind it. This is
    // the card that would show it, so this is where it is checked.
    if (!isNum(payload?.riskFree?.rate)) {
      noRate++;
      if (card.costOfEquity !== null) {
        faults.push(
          `${file} has no risk-free rate and still shows a cost of equity of ` +
            `${(card.costOfEquity * 100).toFixed(2)}% — a missing rate has been read as nought`
        );
      }
      if (card.wacc !== null) {
        faults.push(`${file} has no risk-free rate and still shows a WACC of ${card.wacc}`);
      }
      const rfRow = card.rows.find((r: any) => r.key === 'riskFree');
      if (!rfRow?.missing) {
        faults.push(`${file} has no risk-free rate and the row does not say why`);
      }
    }

    // ---- 3. EVERY INPUT SHOWS A SOURCE AND A DATE ----------------------
    for (const row of card.rows) {
      rowsChecked++;
      if (row.value === null) {
        if (!row.missing) faults.push(`${file} row ${row.key} has no figure and no reason`);
        continue;
      }
      if (!row.source) {
        faults.push(`${file} row ${row.key} shows ${row.value} with no source`);
        continue;
      }
      if (!row.source.publisher) faults.push(`${file} row ${row.key} has a source with no publisher`);
      if (!row.source.asOf) faults.push(`${file} row ${row.key} has a source with no date`);
    }

    // ---- 4. A MINOR UNIT IS NORMALISED --------------------------------
    const factor = payload?.priceConversion?.minorUnitFactor;
    if (typeof factor === 'number' && factor !== 1) {
      minorUnit++;
      if (card.price.minorUnitFactor !== factor) {
        faults.push(`${file} is quoted in a minor unit and the card does not say so`);
      }
      const { value, shares, marketCap } = card.price;
      if (value === null || shares === null || marketCap === null) {
        if (card.wacc !== null) {
          faults.push(`${file} has a WACC but no price, shares or market capitalisation to weight it on`);
        }
      } else if (Math.abs(value * shares - marketCap) > Math.abs(marketCap) * 1e-6) {
        faults.push(
          `${file}: the card shows a price of ${value} and ${Math.round(shares)} shares, which is ` +
            `${Math.round(value * shares)}, but the weights were struck on ${Math.round(marketCap)} — ` +
            'one of the two is in the wrong unit'
        );
      }
    }

    // ---- 5. COUNTRY RISK IS ADDED ONCE, AND IT IS ON BY DEFAULT -------
    //
    // Switched on by Nihar on 2026-10-30 (spec rule 14). Two things have to
    // hold together: the card must add the country premium exactly once, and
    // the premium the card shows must be the premium `deriveModel` hands the
    // engine. A card that defaulted one way while the engine discounted the
    // other would be the one failure this screen exists to prevent, and it
    // would be invisible — both numbers look like ordinary premiums.
    const risk = countryRiskFor(payload?.profile?.country);
    if (risk && card.costOfEquity !== null && card.beta.used !== null) {
      const expected = MATURE_ERP_PCT + risk.crpPct;
      if (!COUNTRY_RISK_ON_BY_DEFAULT) {
        faults.push('the card no longer defaults to the country premium, which rule 14 requires');
      }
      // THE ENGINE'S OWN PREMIUM, NOT THE CARD'S IDEA OF IT.
      try {
        const engine = deriveModel(payload);
        const enginePct = engine.dcf.costOfCapital.marketRiskPremium * 100;
        if (!near(enginePct, expected, 1e-9)) {
          faults.push(
            `${file}: the engine discounts at a premium of ${enginePct.toFixed(4)}% where the table gives ` +
              `${expected.toFixed(4)}% for ${risk.country} — the card and the model disagree`
          );
        } else if (!near(card.premium.usedPct, enginePct, 1e-9)) {
          faults.push(
            `${file}: the card shows a premium of ${card.premium.usedPct.toFixed(4)}% and the engine uses ` +
              `${enginePct.toFixed(4)}%`
          );
        } else {
          premiumAgrees++;
        }
        if (!/country of incorporation/.test(String(engine.provenance.wacc))) {
          faults.push(`${file}: the engine does not record what the country premium follows (rule 14)`);
        }
      } catch {
        // A company the engine refuses has no premium of its own to compare.
      }
      // off: the premium is the mature-market one, and the label says so
      const switchedOff = costOfCapitalFor(payload, { index, edits: { countryRisk: false } })!;
      if (!near(switchedOff.premium.usedPct, MATURE_ERP_PCT, 1e-12)) {
        faults.push(`${file}: with country risk off the premium is ${switchedOff.premium.usedPct}%, not the mature ${MATURE_ERP_PCT}%`);
      }
      if (switchedOff.premium.kind !== 'mature-market') {
        faults.push(`${file}: country risk is off and the premium calls itself "${switchedOff.premium.kind}"`);
      }
      const offRow = switchedOff.rows.find((r: any) => r.key === 'crp');
      if (!/switched off/i.test(String(offRow?.notes?.[0]))) {
        faults.push(`${file}: country risk is off and the row does not say so: "${offRow?.notes?.[0]}"`);
      }
      const on = card;
      if (!near(on.premium.usedPct, expected, 1e-9)) {
        faults.push(
          `${file}: ${MATURE_ERP_PCT}% mature plus ${risk.crpPct}% country should be ${expected.toFixed(2)}%, ` +
            `and the card uses ${on.premium.usedPct.toFixed(2)}%`
        );
      }
      if (on.premium.kind !== 'total country') {
        faults.push(`${file}: country risk is on and the premium still calls itself "${on.premium.kind}"`);
      }
      const erpRow = on.rows.find((r: any) => r.key === 'erp');
      if (!erpRow || !near(erpRow.value, expected / 100, 1e-12)) {
        faults.push(`${file}: the premium row shows ${erpRow?.value} where the premium in use is ${expected / 100}`);
      }
      if (!/total/i.test(String(erpRow?.label))) {
        faults.push(`${file}: with country risk on the premium row is still labelled "${erpRow?.label}"`);
      }
      // and the cost of equity is the rate plus beta times THAT premium
      const rf = on.rows.find((r: any) => r.key === 'riskFree')!.value;
      if (rf !== null && on.beta.used !== null && on.costOfEquity !== null) {
        const byHand = rf + on.beta.used * (expected / 100);
        if (!near(on.costOfEquity, byHand, 1e-9)) {
          faults.push(
            `${file}: cost of equity ${(on.costOfEquity * 100).toFixed(4)}% against ` +
              `${(byHand * 100).toFixed(4)}% worked out by hand — the premium has been counted twice ` +
              `or not at all`
          );
        } else {
          addedOnce++;
        }
      }
    }

    // ---- 6. AN EDIT REACHES THE MODEL ---------------------------------
    if (card.costOfEquity !== null && card.beta.used !== null) {
      const rfRow = card.rows.find((r: any) => r.key === 'riskFree')!;
      const nudged = costOfCapitalFor(payload, {
        index,
        edits: { riskFreePct: (rfRow.value as number) * 100 + 1 },
      })!;
      if (nudged.costOfEquity === null) {
        faults.push(`${file}: a point on the risk-free rate left no cost of equity at all`);
      } else if (!near(nudged.costOfEquity - card.costOfEquity, 0.01, 1e-9)) {
        faults.push(
          `${file}: a point on the risk-free rate moved the cost of equity by ` +
            `${((nudged.costOfEquity - card.costOfEquity) * 100).toFixed(4)} points, not one`
        );
      } else {
        editsLanded++;
      }
      // beta: the cost of equity moves by the premium times the change
      const betaUp = costOfCapitalFor(payload, { index, edits: { beta: 2 } })!;
      if (betaUp.beta.used === null || betaUp.costOfEquity === null) {
        faults.push(`${file}: setting beta to 2 left no cost of equity`);
      } else {
        const byHand =
          (rfRow.value as number) + betaUp.beta.used * (card.premium.usedPct / 100);
        if (!near(betaUp.costOfEquity, byHand, 1e-9)) {
          faults.push(
            `${file}: with beta set to 2 the cost of equity is ${betaUp.costOfEquity}, not the ${byHand} ` +
              'the card’s own inputs give'
          );
        }
        if (near(betaUp.beta.used, card.beta.used, 1e-9)) {
          faults.push(`${file}: setting beta to 2 did not change the beta the model uses`);
        }
      }
      // and the value, where the engine produces one
      if (card.valuePerShare !== null) {
        const dearer = costOfCapitalFor(payload, {
          index,
          edits: { riskFreePct: (rfRow.value as number) * 100 + 2 },
        })!;
        if (dearer.valuePerShare === null) {
          // Two points can take a company past a refusal threshold, which is
          // the engine working rather than an edit that failed to land.
        } else if (near(dearer.valuePerShare, card.valuePerShare, 1e-9)) {
          faults.push(
            `${file}: two points on the risk-free rate left the value per share at ` +
              `${card.valuePerShare.toFixed(4)} — the edit never reached the model`
          );
        } else {
          editsMovedValue++;
        }
      }
    }

    const five = card.beta.estimates.find((e: any) => e.frequency === 'monthly');
    if (five && five.raw !== null) {
      withBeta++;
      betasSeen.push(five.raw);
      if (five.observations < BETA_MINIMUM.monthly) {
        faults.push(`${file}: a beta was shown on ${five.observations} returns, below the floor`);
      }
      if (five.r2 === null || five.standardError === null) {
        faults.push(`${file}: a beta was shown without its R squared or its standard error (rule 4)`);
      }
    }

    // ---- 7. THE READER CAN PUT THE MEASURED BETA IN THE MODEL --------
    //
    // Nihar's decision of 2026-10-30: the default stays the asset beta of 1.0
    // and the measured figure is offered per company, with a warning where the
    // fit is too loose to carry it. So three things are checked here — the
    // figure lands in the model, the card says which of the two it is using,
    // and the warning is present exactly when the thresholds say it should be.
    for (const e of card.beta.estimates as any[]) {
      if (e.raw === null) continue;
      const shouldWarn =
        (isNum(e.r2) && e.r2 < BETA_WEAK_R2) ||
        (isNum(e.standardError) && e.standardError > BETA_WEAK_STANDARD_ERROR);
      if (e.weak !== shouldWarn) {
        faults.push(
          `${file} ${e.label}: R² ${e.r2} and standard error ${e.standardError} ` +
            `${shouldWarn ? 'breach' : 'are inside'} the thresholds and the estimate says weak=${e.weak}`
        );
      }
      if (card.costOfEquity === null || card.beta.used === null) continue;
      for (const [which, value] of [['measured-raw', e.raw], ['measured-adjusted', e.adjusted]] as const) {
        const picked = costOfCapitalFor(payload, { index, edits: { beta: value as number } })!;
        if (picked.beta.choice !== which) {
          faults.push(
            `${file}: putting the ${e.label} ${which === 'measured-raw' ? 'raw' : 'adjusted'} beta of ` +
              `${(value as number).toFixed(3)} into the model leaves the card calling it ` +
              `"${picked.beta.choice}"`
          );
        }
        const betaRow = picked.rows.find((r: any) => r.key === 'beta');
        if (!/measured here/.test(String(betaRow?.source?.method))) {
          faults.push(
            `${file}: a measured beta is in use and the row still credits ` +
              `"${betaRow?.source?.method}"`
          );
        }
        if (picked.costOfEquity === null) {
          faults.push(`${file}: choosing the measured beta left no cost of equity`);
          continue;
        }
        // The cost of equity is the rate plus THIS beta times the premium.
        const rf = picked.rows.find((r: any) => r.key === 'riskFree')!.value as number;
        const byHand = rf + (picked.beta.used as number) * (picked.premium.usedPct / 100);
        if (!near(picked.costOfEquity, byHand, 1e-9)) {
          faults.push(
            `${file}: on a chosen beta of ${(value as number).toFixed(3)} the cost of equity is ` +
              `${picked.costOfEquity} and its own rows give ${byHand}`
          );
        }
        const warned = picked.beta.warning !== null;
        if (warned !== Boolean(e.weak)) {
          faults.push(
            `${file} ${e.label}: the fit is ${e.weak ? 'too loose to lean on' : 'inside both thresholds'} ` +
              `and the card ${warned ? 'warns about it' : 'says nothing'}`
          );
        } else if (warned) {
          weakWarned++;
        }
        if (which === 'measured-raw' && !near(e.raw, card.beta.used ?? NaN, 1e-9)) {
          if (near(picked.beta.used ?? NaN, card.beta.used ?? NaN, 1e-9)) {
            faults.push(`${file}: choosing the measured beta did not change the beta the model uses`);
          } else {
            betaSwitched++;
          }
        }
      }
    }
  }

  // The sampling is the one thing both sides of every regression share, so it
  // is worth one assertion of its own: a month-end is the last close IN the
  // month, and a week-end the last close in the week.
  const sampleDates = ['2026-01-02', '2026-01-30', '2026-02-02', '2026-02-27', '2026-03-02'];
  const sampled = monthEnds({ dates: sampleDates, closes: [1, 2, 3, 4, 5] });
  if (sampled.dates.join(',') !== '2026-01-30,2026-02-27,2026-03-02') {
    faults.push(`month-end sampling returned ${sampled.dates.join(',')}`);
  }
  const weekly = weekEnds({
    dates: ['2026-01-05', '2026-01-09', '2026-01-12', '2026-01-16'],
    closes: [1, 2, 3, 4],
  });
  if (weekly.dates.join(',') !== '2026-01-09,2026-01-16') {
    faults.push(`week-end sampling returned ${weekly.dates.join(',')}`);
  }

  const median = (a: number[]) => {
    const s = [...a].sort((x, y) => x - y);
    return s.length ? s[Math.floor(s.length / 2)] : NaN;
  };

  if (faults.length) {
    totalProblems += faults.length;
    console.log(`  PROBLEM: ${faults.length} faults on the cost-of-capital card:`);
    faults.slice(0, 20).forEach((f) => console.log(`           ${f}`));
    if (faults.length > 20) console.log(`           ... and ${faults.length - 20} more`);
  } else {
    console.log(
      `  a share built as exactly ${KNOWN_BETA} times its index regresses to ${known.raw!.toFixed(12)} on 60 ` +
        `monthly returns, with an intercept of ${KNOWN_ALPHA} and an R squared of 1; an index that never moved, ` +
        'and five returns, are both refused rather than answered'
    );
    console.log(
      `  ${cards} of ${files.length} payloads produce a card: ${withKe} carry a cost of equity, ${withWacc} a WACC, ` +
        `and ${banks} are on the bank template with no WACC at all and a reason in its place`
    );
    console.log(
      `  a measured beta on ${withBeta} listings across ${marketsSeen.size} markets (median ` +
        `${median(betasSeen).toFixed(3)}), and ${indexless} listings get none because no broad index for ` +
        'their market could be read'
    );
    console.log(
      `  ${rowsChecked} rows checked: every one carries a publisher and a date, or says why there is no figure`
    );
    console.log(
      `  ${minorUnit} payloads are quoted in pence, cents or agorot, and on each the price the card shows ` +
        'times the shares it shows is the market capitalisation the weights were struck on'
    );
    console.log(
      `  country risk is added once on ${addedOnce} companies: the premium in use is the mature ` +
        `${MATURE_ERP_PCT}% plus that country’s own, the row renames itself to say so, and the cost of ` +
        `equity is the rate plus beta times that one premium (Damodaran, ${COUNTRY_RISK_VINTAGE})`
    );
    console.log(
      `  it is on by default, and on ${premiumAgrees} companies the premium the card shows is the premium ` +
        'the engine itself discounts at, to the twelfth decimal place; switching it off on the card ' +
        'returns the mature-market premium and the row says it has been switched off'
    );
    console.log(
      `  either measured beta can be put into the model: it moved the beta on ${betaSwitched} listings, ` +
        'the cost of equity followed on every one of them, and the card named the figure it had been ' +
        `given rather than the default; the warning appears on all ${weakWarned} fits with an R² under ` +
        `${(BETA_WEAK_R2 * 100).toFixed(0)}% or a standard error above ${BETA_WEAK_STANDARD_ERROR}, and on none of the rest`
    );
    console.log(
      `  a point on the risk-free rate moves the cost of equity by exactly a point on ${editsLanded} ` +
        `companies and moves the value per share on ${editsMovedValue} of them`
    );
    console.log(
      `  and on the ${noRate} payloads with no published yield for their currency there is no cost of ` +
        'equity and no WACC at all, which is what a missing rate means'
    );
  }
}

// ---------------------------------------------------------------------------
// ONE DECIMAL RULE PER ROW (`docs/VISUAL_SYSTEM.md` finding 1)
// ---------------------------------------------------------------------------
//
// The finding, severity H: on the figures screen a single row of cost of sales
// printed 9,439.0, then 11,618, then 16,621, because the decimals were chosen
// from each figure’s own magnitude. In a right-aligned tabular column a
// trailing ".0" pushes the integer part left by its own width, so the digits a
// reader compares down the column stop lining up with each other and with the
// column head — and the decimal claims a precision a figure reported in
// millions has not got.
//
// Five rules are checked, all five over real payloads rather than over a
// sample: one decimal rule per row, zero as 0, not reported as an em dash, a
// real minus sign, and — the one that makes the rule a rule rather than a
// coincidence — that both tables read it from the same definition.
{
  console.log('\n=== one decimal rule per row, on both tables that print figures ===');
  const { financialsFor, formatValue } = await import(`file:///${REPO}/src/data/financials.ts`);
  const FF: any = await import(`file:///${REPO}/src/data/figureFormat.ts`);
  const faults: string[] = [];
  const HYPHEN = String.fromCharCode(45);
  const decimalsIn = (s: string) => {
    const m = /\.(\d+)/.exec(s);
    return m ? m[1].length : 0;
  };

  // ---- 1. THE DEFINITION ITSELF ----------------------------------------
  //
  // Checked first and on constructed figures, because the payload set cannot
  // be relied on to contain a figure either side of every boundary the old
  // magnitude rule had. These are the exact figures the finding quotes.
  {
    const row = [9439.04, 11618, 16621, 123.456, 7.5];
    const dps = new Set(row.map((v) => decimalsIn(FF.inMillions(v))));
    if (dps.size !== 1 || !dps.has(0)) {
      faults.push(
        `the figures the finding quotes still print with ${[...dps].join(" and ")} decimal places: ` +
          row.map((v) => FF.inMillions(v)).join(", ")
      );
    }
    if (FF.inMillions(0) !== "0") faults.push(`zero prints as "${FF.inMillions(0)}" rather than 0`);
    if (FF.inMillions(null) !== "\u2014") faults.push("a figure nobody reported does not print as an em dash");
    if (FF.inMillions(-0.04) !== "0") faults.push(`a figure that rounds to nought prints as "${FF.inMillions(-0.04)}"`);
    if (!FF.inMillions(-9439).startsWith("\u2212")) faults.push("a negative does not carry a minus sign (U+2212)");
    if (FF.inMillions(-9439).includes(HYPHEN)) faults.push("a negative carries a hyphen-minus");
    // A value per share is a price and keeps its two decimals: the rule is per
    // row, and that is a different row.
    if (decimalsIn(FF.asPerShare(433.078)) !== 2) {
      faults.push(`a value per share printed as ${FF.asPerShare(433.078)}, which is not a price`);
    }
  }

  // ---- 2. THE SAME DEFINITION ON BOTH TABLES ---------------------------
  //
  // The trap this repository has already fallen into is two copies of one
  // rule. Both screens must read it from `figureFormat.ts`, so a change to
  // the rule cannot reach one table and miss the other.
  for (const [file, want] of [
    ['src/data/financials.ts', 'figureFormat'],
    ['src/components/figuresEditor.tsx', 'figureFormat'],
  ] as [string, string][]) {
    const text = fs.readFileSync(path.join(REPO, file), 'utf8');
    if (!new RegExp(`from .[^\n]*${want}`).test(text)) {
      faults.push(`${file} does not read the decimal rule from ${want}.ts, so it keeps its own copy of it`);
    }
    if (/toFixed\(/.test(text.replace(/^\s*(\/\/|\*).*$/gm, ''))) {
      faults.push(`${file} formats a figure with toFixed, outside the one definition of the rule`);
    }
  }

  // ---- 3. EVERY ROW OF EVERY STATEMENT, OVER THE WHOLE SET -------------
  let rows = 0;
  let cells = 0;
  let dashes = 0;
  let nils = 0;
  let negatives = 0;
  const files = fs.readdirSync(PAYLOADS).filter((f) => f.endsWith('.json'));
  for (const file of files) {
    let payload: any;
    try {
      payload = JSON.parse(fs.readFileSync(path.join(PAYLOADS, file), 'utf8'));
    } catch {
      continue;
    }
    if (payload?.error) continue;
    const symbol = String(payload.currencySymbol || payload.currency || '');
    for (const statement of ['income', 'balance', 'cashflow'] as const) {
      for (const basis of ['annual', 'quarterly'] as const) {
        let view: any;
        try {
          view = financialsFor(payload, { statement, basis } as any);
        } catch {
          continue;
        }
        for (const row of view?.rows ?? []) {
          rows++;
          const seen = new Set<number>();
          for (const cell of row.cells) {
            const s = formatValue(cell, row.kind, symbol);
            cells++;
            // RULE 4: not reported is an em dash, and nothing else is.
            if (cell.value === null) {
              dashes++;
              if (s !== '\u2014') faults.push(`${file} ${row.key}: a figure nobody reported prints as "${s}"`);
              continue;
            }
            if (s === '\u2014') faults.push(`${file} ${row.key}: a reported figure prints as an em dash`);
            // RULE 3: zero is 0, and is not an em dash.
            if (cell.state === 'reportedZero') {
              nils++;
              if (!/0/.test(s)) faults.push(`${file} ${row.key}: a reported nil prints as "${s}"`);
            }
            // RULE 5: a real minus sign, never a hyphen.
            if (s.includes(HYPHEN)) {
              faults.push(`${file} ${row.key}: "${s}" carries a hyphen-minus rather than U+2212`);
            }
            if (s.startsWith('\u2212')) negatives++;
            // RULE 1: one decimal rule per row.
            seen.add(decimalsIn(s));
          }
          if (seen.size > 1) {
            faults.push(
              `${file} ${statement}/${basis} ${row.key}: the same row prints ` +
                `${[...seen].sort().join(' and ')} decimal places — ` +
                row.cells.map((c: any) => formatValue(c, row.kind, symbol)).join(", ")
            );
          }
          // And a row in millions prints none at all.
          if (row.kind !== 'percent' && [...seen].some((d) => d !== 0)) {
            faults.push(`${file} ${statement}/${basis} ${row.key}: a figure in millions printed with decimals`);
          }
        }
      }
    }
  }

  if (faults.length) {
    totalProblems += faults.length;
    console.log(`  PROBLEM: ${faults.length} faults in how figures are printed:`);
    faults.slice(0, 12).forEach((f) => console.log(`           ${f}`));
    if (faults.length > 12) console.log(`           ... and ${faults.length - 12} more`);
  } else {
    console.log(
      `  ${cells} figures over ${rows} rows and ${files.length} companies: every row prints one number of ` +
        'decimal places, and a row in millions prints none'
    );
    console.log(
      `  ${dashes} figures nobody reported print as an em dash and ${nils} reported nils print as 0, so the ` +
        'two cannot be confused; ' + `${negatives} negatives carry U+2212 and not one carries a hyphen`
    );
    console.log(
      '  and both tables read the rule from figureFormat.ts rather than keeping a copy of it, so the ' +
        'figures the finding quotes — 9,439.0, 11,618, 16,621 — now print as 9,439, 11,618, 16,621'
    );
  }
}
// ---------------------------------------------------------------------------
// A SHARE COUNT IS NEVER A SUBTRACTION (`KI-33`)
// ---------------------------------------------------------------------------
//
// A quarter a company did not file on its own is worked out as this year to
// date less the last, which is right for a flow and wrong for an average. The
// average over a year is not the four quarterly averages added up, so the
// difference between a year and nine months of it is not the fourth quarter of
// anything — and because the two averages are close, the difference came out
// NEGATIVE: 159 figures across 68 companies were at or below zero.
//
// Three things are checked, and the third is the one that stops this fix from
// being a blanket ban on arithmetic.
{
  console.log('\n=== a share count is never a subtraction ===');
  const faults: string[] = [];
  const isNum = (v: unknown): v is number => typeof v === 'number' && isFinite(v);
  const files = fs.readdirSync(PAYLOADS).filter((f) => f.endsWith('.json'));
  const COUNTS = ['dilutedShares', 'basicShares', 'preferredConversionShares'];

  let reported = 0;
  let absent = 0;
  let derivedFlows = 0;
  let quarters = 0;
  const companies = new Set<string>();

  for (const file of files) {
    let payload: any;
    try {
      payload = JSON.parse(fs.readFileSync(path.join(PAYLOADS, file), 'utf8'));
    } catch {
      continue;
    }
    if (payload?.error) continue;
    const t = file.replace('.json', '');
    for (const q of Array.isArray(payload.quarters) ? payload.quarters : []) {
      quarters++;
      // ---- 1. NO COUNT IS DERIVED, AND NONE IS IMPOSSIBLE ------------
      for (const field of COUNTS) {
        const v = q?.values?.[field];
        if (!isNum(v)) {
          if (field === 'dilutedShares') absent++;
          continue;
        }
        if (field === 'dilutedShares') {
          reported++;
          companies.add(t);
        }
        if (q?.states?.[field] === 'derived') {
          faults.push(`${t} ${q.periodEnd}: ${field} is derived, and an average cannot be subtracted`);
        }
        if (Array.isArray(q?.derivedFrom) && q.derivedFrom.length > 1 && q?.states?.[field] !== 'reported') {
          faults.push(`${t} ${q.periodEnd}: ${field} carries two filings, so it is a difference of them`);
        }
        // A COUNT THAT CANNOT BE A COUNT. The symptom this was measured by:
        // no company has ever had nought shares in issue, let alone fewer.
        if (v <= 0) {
          faults.push(
            `${t} ${q.periodEnd}: ${field} is ${Math.round(v).toLocaleString('en-US')}, which is not a ` +
              'number of shares'
          );
        }
      }
      // ---- 2. AND THE FLOWS ARE STILL DERIVED ------------------------
      //
      // The assertion that keeps this from being a ban on all arithmetic. Rule
      // 4 earns most of the quarterly figures on this site by subtraction, and
      // a fix that stopped doing it would empty the Financials tab.
      if (q?.states?.revenue === 'derived' && isNum(q?.values?.revenue)) derivedFlows++;
    }
  }

  if (derivedFlows < 100) {
    faults.push(
      `only ${derivedFlows} quarterly revenues are still worked out as a difference of two cumulative ` +
        'figures, so the fix has reached past the counts into the flows'
    );
  }

  // ---- 3. THE FAULT PUT BACK, which no fixed payload can show ---------
  //
  // CONSTRUCTED on Amphenol, whose quarter to 2025-12-31 was the worst case
  // measured: the subtraction of a nine-month average from an annual one.
  {
    const file = path.join(PAYLOADS, 'APH.json');
    if (!fs.existsSync(file)) {
      faults.push('APH.json is not on disk, so the subtraction could not be put back');
    } else {
      const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
      const rows = payload.statements ?? [];
      const year = [...rows].reverse().find((r: any) => isNum(r?.dilutedShares));
      // The year less the nine months before it, which is what the data layer
      // used to hand back as a quarter.
      const nineMonth = (payload.quarters ?? [])
        .filter((q: any) => q.fiscalYear === year?.fiscalYear && q.months === 3 && isNum(q?.values?.dilutedShares))
        .slice(0, 3)
        .reduce((t: number, q: any) => t + q.values.dilutedShares, 0);
      if (!isNum(year?.dilutedShares) || !nineMonth) {
        faults.push(
          'APH no longer carries both an annual count and three quarters of it, so the constructed case ' +
            'needs rebuilding rather than trusting'
        );
      } else {
        const asDerived = year.dilutedShares - nineMonth;
        if (!(asDerived <= 0)) {
          faults.push(
            `subtracting nine months of Amphenol’s counts from its year gives ` +
              `${Math.round(asDerived).toLocaleString('en-US')}, which is positive — so the check that ` +
              'catches an impossible count would not have caught the figure this fix removed'
          );
        }
      }
    }
  }

  if (faults.length) {
    totalProblems += faults.length;
    console.log(`  PROBLEM: ${faults.length} faults in the quarterly share counts:`);
    faults.slice(0, 12).forEach((f) => console.log(`           ${f}`));
    if (faults.length > 12) console.log(`           ... and ${faults.length - 12} more`);
  } else {
    console.log(
      `  ${quarters} quarters across ${files.length} companies: ${reported} carry the share count their own ` +
        `company filed for them, across ${companies.size} companies, and not one is a difference of two ` +
        'cumulative figures or a number of shares no company could have'
    );
    console.log(
      `  ${absent} quarters report no diluted count, which is what a figure nobody filed looks like, and ` +
        `${derivedFlows} quarterly revenues are still worked out by subtraction — the fix reaches the ` +
        'averages and not the flows'
    );
    console.log(
      '  and subtracting nine months of Amphenol’s own quarterly counts from its annual one still gives a ' +
        'negative number, which is the figure this removed'
    );
  }
}

// ---------------------------------------------------------------------------
// A TICKER THAT HAS NEVER ONCE ANSWERED
// ---------------------------------------------------------------------------
//
// `TATAMOTORS.NS` sat in the sweep set for eleven days returning an error on
// every attempt, and the only thing that ever said so was one clause at the
// end of a fetch run — "1 carrying a fetch error" — which is indistinguishable
// from a source having a bad afternoon. It was not a bad afternoon: Tata Motors
// had demerged, the exchange had retired the symbol, and the archive shows the
// FIRST capture failing as well as the last. Nothing was wrong with the
// fetcher; the set was asking for a company that no longer exists under that
// name.
//
// A transient failure and a dead ticker look identical in one run and quite
// different across the archive, which is what this reads. A ticker that has
// answered before and is failing now is the source’s business; a ticker that
// has NEVER answered is ours.
{
  console.log('\n=== every ticker in the set has answered at least once ===');
  const faults: string[] = [];
  const VERSIONS = path.join(PAYLOADS, 'versions');
  const tickers = fs
    .readFileSync(path.join(REPO, 'verify/tickers.txt'), 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));

  let answered = 0;
  let unfetched = 0;
  let failingNow = 0;
  const neverAnswered: string[] = [];
  const extras: string[] = [];

  for (const t of tickers) {
    const file = path.join(PAYLOADS, `${t}.json`);
    const onDisk = fs.existsSync(file);
    let erroring = false;
    if (onDisk) {
      try {
        erroring = Boolean(JSON.parse(fs.readFileSync(file, 'utf8'))?.error);
      } catch {
        erroring = true;
      }
    }
    if (!onDisk) {
      unfetched++;
      continue;
    }
    if (!erroring) {
      answered++;
      continue;
    }
    failingNow++;
    // IT IS FAILING NOW. Has it ever not?
    const dir = path.join(VERSIONS, t);
    let everAnswered = false;
    let captures = 0;
    if (fs.existsSync(dir)) {
      for (const c of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
        captures++;
        try {
          if (!JSON.parse(fs.readFileSync(path.join(dir, c), 'utf8'))?.error) everAnswered = true;
        } catch {
          /* an unreadable capture is not an answer */
        }
      }
    }
    if (!everAnswered) {
      neverAnswered.push(`${t} (${captures} captures, not one of them statements)`);
      faults.push(
        `${t} is in the sweep set and has never once returned statements, across ${captures} captures — ` +
          'a symbol that does not exist rather than a source having a bad afternoon'
      );
    }
  }

  // A payload nobody asked for is not a fault, but it is worth saying: it is
  // measured over and reported on while belonging to no list.
  for (const f of fs.readdirSync(PAYLOADS).filter((x) => x.endsWith('.json'))) {
    const t = f.replace('.json', '');
    if (!tickers.includes(t)) extras.push(t);
  }

  if (faults.length) {
    totalProblems += faults.length;
    console.log(`  PROBLEM: ${faults.length} tickers that have never answered:`);
    faults.forEach((f) => console.log(`           ${f}`));
  } else {
    console.log(
      `  ${answered} of ${tickers.length} tickers answered with statements, ${failingNow} are failing now ` +
        'and have answered before, and none has failed on every attempt it has ever had'
    );
    if (unfetched) console.log(`  ${unfetched} have not been fetched yet, which is not a failure`);
    if (extras.length) {
      console.log(`  ${extras.length} payloads belong to no list and are measured anyway: ${extras.join(', ')}`);
    }
  }
}

// ---------------------------------------------------------------------------
// WHAT THE TOP LINE OF A FINANCIAL COMPANY IS, AND HOW OLD THE FIGURES ARE
// (`KI-32`)
// ---------------------------------------------------------------------------
//
// Which years a company has is anchored on revenue, so the tag that is read
// decides which years exist. Morgan Stanley and Wells Fargo moved off
// `Revenues` and their models were built from the years that still carried it
// — FY2014 and FY2019. Two things are checked: the definition that fixed it,
// and the guard that means the next one of these is seen rather than silent.
{
  console.log('\n=== the top line of a financial company, and the age of any figures ===');
  const { figuresAge, STALE_MONTHS } = await import(`file:///${REPO}/src/data/figuresAge.ts`);
  const { isFinancialCompany } = await import(`file:///${REPO}/src/data/residualIncome.js`);
  const faults: string[] = [];
  const isNum = (v: unknown): v is number => typeof v === 'number' && isFinite(v);
  const files = fs.readdirSync(PAYLOADS).filter((f) => f.endsWith('.json'));
  let thresholdCases = 0;

  // ---- 1. THE THRESHOLD, ON CONSTRUCTED DATES -------------------------
  //
  // Asked on a FIXED day, because a threshold tested against the clock is a
  // test that changes its own answer over time. Both sides of the line, and
  // the reason the line is where it is: a company that reported eleven months
  // ago is up to date and must not be warned about.
  {
    const today = new Date('2026-11-01T00:00:00Z');
    const at = (end: string) => (figuresAge as any)({ statements: [{ fiscalYear: Number(end.slice(0, 4)), periodEnd: end }] }, today);
    const cases: [string, boolean][] = [
      ['2026-06-30', false],
      ['2025-12-31', false],
      ['2025-06-30', false],
      ['2025-04-30', false],
      ['2025-04-01', true],
      ['2019-12-31', true],
      ['2014-12-31', true],
    ];
    thresholdCases = cases.length;
    for (const [end, wantStale] of cases) {
      const got = at(end);
      if (got.stale !== wantStale) {
        faults.push(
          `figures to ${end} read as ${got.monthsBehind} months behind and ` +
            `${got.stale ? 'stale' : 'current'}, against a threshold of ${STALE_MONTHS}`
        );
      }
      if (wantStale && !String(got.label).includes(`FY${end.slice(0, 4)}`)) {
        faults.push(`figures to ${end} are labelled "${got.label}" rather than naming their year`);
      }
      if (!wantStale && got.detail !== null) {
        faults.push(`figures to ${end} are current and still carry a warning`);
      }
    }
    // An eighteen-month-old set is not stale; a nineteen-month-old one is.
    // EXACTLY AT THE LINE AND JUST OVER IT. 2026-11-01 less eighteen months
    // is 2025-05-02, so figures to that day are eighteen months old and current,
    // and figures two days older are past the line. Flooring the gap before the
    // test used to make "more than eighteen months" mean nineteen or more.
    // EXACTLY AT THE LINE, AND ONE MONTH PAST IT, in calendar months a reader
    // can check: eighteen months after 2025-04-30 is 2026-10-30, which is on or
    // before today, so those figures are eighteen months old and current.
    const atLine = (figuresAge as any)({ statements: [{ fiscalYear: 2025, periodEnd: '2025-04-30' }] }, today);
    const pastLine = (figuresAge as any)({ statements: [{ fiscalYear: 2025, periodEnd: '2025-04-01' }] }, today);
    if (atLine.monthsBehind !== 18 || atLine.stale) {
      faults.push(`figures to 2025-04-30 read ${atLine.monthsBehind} months, stale ${atLine.stale}: eighteen months is not more than eighteen`);
    }
    if (!pastLine.stale || pastLine.monthsBehind !== 19) {
      faults.push(`figures to 2025-04-01 read ${pastLine.monthsBehind} months, stale ${pastLine.stale}: nineteen months is past the line`);
    }
    // AND A MONTH END IS NOT PUSHED PAST ITSELF: 31 January plus a month is the
    // end of February, not the start of March.
    const janEnd = (figuresAge as any)({ statements: [{ fiscalYear: 2025, periodEnd: '2025-01-31' }] }, new Date('2026-07-31T00:00:00Z'));
    if (janEnd.monthsBehind !== 18 || janEnd.stale) {
      faults.push(`figures to 2025-01-31 read ${janEnd.monthsBehind} months at 2026-07-31, stale ${janEnd.stale}`);
    }
  }

  // ---- 2. NO COMPANY IN THE SET IS STALE, AND THE GUARD SAYS SO -------
  let stale = 0;
  let financials = 0;
  let chosen = 0;
  const byTag: Record<string, number> = {};
  const staleOnes: string[] = [];
  for (const file of files) {
    let payload: any;
    try {
      payload = JSON.parse(fs.readFileSync(path.join(PAYLOADS, file), 'utf8'));
    } catch {
      continue;
    }
    if (payload?.error) continue;
    const t = file.replace('.json', '');
    const age = (figuresAge as any)(payload);
    if (age.stale) {
      stale++;
      staleOnes.push(`${t} FY${age.latestFiscalYear} (${age.monthsBehind} months)`);
      // Not a fault in itself — a company really can be late — but it must
      // carry the words that say so.
      if (!age.label || !age.detail) {
        faults.push(`${t} is ${age.monthsBehind} months behind and the guard produced no words for it`);
      }
    }

    // ---- 3. THE DEFINITION, WHERE IT APPLIES --------------------------
    const rd = payload?.revenueDefinition ?? null;
    const isSec = payload?.source === 'SEC EDGAR';
    const fin = isFinancialCompany(payload);
    // EVERY SEC FILER SETTLES ITS OWN TOP LINE SINCE `KI-39` (2026-11-08),
    // not only a financial one — so this arm runs on all of them, and the two
    // rules are told apart by WHICH LIST the chosen tag comes from. A financial
    // company's is the line on the face of its income statement
    // (`RevenuesNetOfInterestExpense` where it is tagged, `KI-32`); every other
    // company's is the first tag that means total revenue. Until then this arm
    // asserted that a company outside the bank template carried NO definition,
    // which is now true of none of them.
    if (isSec) {
      if (fin) financials++;
      if (!rd) {
        faults.push(
          `${t} is an SEC filer and carries no record of which line its top line is`
        );
        continue;
      }
      chosen++;
      byTag[rd.tag] = (byTag[rd.tag] ?? 0) + 1;
      // ONE TAG FOR THE WHOLE SERIES.
      if (!Array.isArray(rd.years) || !rd.years.length) {
        faults.push(`${t}: a revenue definition naming no years`);
        continue;
      }
      // AND IT REACHES THE LATEST YEAR ANY CANDIDATE REACHES, which is the
      // clause that stops the order of preference costing BlackRock its
      // latest year.
      if (!rd.years.includes(rd.latestYear)) {
        faults.push(`${t}: its top line comes from ${rd.tag}, which does not reach FY${rd.latestYear}`);
      }
      const reaching = (rd.considered ?? []).filter((c: any) => c.reachesLatest);
      if (!reaching.length) {
        faults.push(`${t}: no candidate reaches FY${rd.latestYear} and one was chosen anyway`);
      } else if (fin && reaching[0].tag !== rd.tag) {
        // THE FINANCIAL LIST'S OWN ORDER (`KI-32`), which is the order
        // `considered` is built in. An industrial company's order is the
        // total-revenue one and is asserted by its own block, against the
        // list the fetcher exports.
        faults.push(
          `${t}: ${rd.tag} was chosen over ${reaching[0].tag}, which also reaches FY${rd.latestYear} and ` +
            'comes first in the order'
        );
      }
      // AND THE YEARS THE MODEL CARRIES REALLY COME FROM IT.
      const modelled = (payload.statements ?? []).map((r: any) => Number(r.fiscalYear));
      for (const y of modelled) {
        if (!rd.years.includes(y)) {
          faults.push(`${t}: the model carries FY${y}, which ${rd.tag} does not report`);
        }
      }
      // NO COMPANY IS MODELLED ON A CONTRACT-REVENUE LINE WHERE IT FILES A
      // TOTAL. For a financial company that line excludes net interest income,
      // lease income and investment results (`KI-32`); for every other company
      // it is a component of the top line where the two differ (`KI-39`). One
      // rule, and it now covers both.
      const contract = (rd.considered ?? []).find((c: any) => /RevenueFromContractWithCustomer/.test(c.tag));
      const total = (rd.considered ?? []).find((c: any) => /^Revenues(NetOfInterestExpense)?$/.test(c.tag) && c.reachesLatest);
      if (total && contract && rd.tag === contract.tag) {
        faults.push(`${t}: modelled on ${contract.tag} while it also files ${total.tag} for FY${rd.latestYear}`);
      }
    }
  }

  if (faults.length) {
    totalProblems += faults.length;
    console.log(`  PROBLEM: ${faults.length} faults in the top line or the age of the figures:`);
    faults.slice(0, 15).forEach((f) => console.log(`           ${f}`));
    if (faults.length > 15) console.log(`           ... and ${faults.length - 15} more`);
  } else {
    console.log(
      `  the ${STALE_MONTHS}-month threshold holds on both sides of the line on ${thresholdCases} constructed dates, and ` +
        'a set eighteen months old is current where one nineteen months old is not'
    );
    console.log(
      `  ${chosen} of ${financials} SEC-sourced financial companies read their top line from a named tag, ` +
        `one tag for the whole series and every one reaching its own latest year: ` +
        `${Object.entries(byTag).map(([k, v]) => `${v} from ${k}`).join(', ')}`
    );
    console.log(
      `  and ${stale} companies in the set are more than ${STALE_MONTHS} months behind` +
        `${staleOnes.length ? ': ' + staleOnes.join('; ') : ', so no screen carries the warning — which is ' +
          'why the screen check drives a constructed company'}`
    );
  }
}

// ---------------------------------------------------------------------------
// A SHARE COUNT FILED BEFORE A SPLIT (`KI-31`)
// ---------------------------------------------------------------------------
//
// The count comes from a filing and the price comes from today, so a split
// between the two breaks the pair and nothing in the figures shows it. Six
// things are checked, and the last two are constructed because a fixed payload
// cannot show the fault it was built to stop.
{
  console.log('\n=== a share count filed before a split ===');
  const { deriveModel } = await import(`file:///${REPO}/src/data/deriveModel.js`);
  const { buildModel, computeWACC } = await import(`file:///${REPO}/src/engine/model.js`);
  const faults: string[] = [];
  const isNum = (v: unknown): v is number => typeof v === 'number' && isFinite(v);
  const files = fs.readdirSync(PAYLOADS).filter((f) => f.endsWith('.json'));
  const BAND = 0.2;

  let withEvents = 0;
  let applied = 0;
  let declined = 0;
  let predated = 0;
  let eventsSeen = 0;
  const appliedTo: string[] = [];
  const declinedFor: string[] = [];

  for (const file of files) {
    let payload: any;
    try {
      payload = JSON.parse(fs.readFileSync(path.join(PAYLOADS, file), 'utf8'));
    } catch {
      continue;
    }
    if (payload?.error) continue;
    const t = file.replace('.json', '');
    const splits = Array.isArray(payload?.quote?.splits) ? payload.quote.splits : [];
    const rec = payload?.splitAdjustment ?? null;
    eventsSeen += splits.length;

    // ---- 1. EVERY EVENT IS A WELL-FORMED EVENT -------------------------
    for (const s of splits) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s?.date ?? ''))) {
        faults.push(`${t}: a split with no usable date (${JSON.stringify(s?.date)})`);
      }
      if (!isNum(s?.ratio) || s.ratio <= 0 || s.ratio === 1) {
        faults.push(`${t}: a split with a ratio of ${JSON.stringify(s?.ratio)}, which is not a split`);
      } else if (Math.abs(s.numerator / s.denominator - s.ratio) > 1e-12) {
        faults.push(`${t}: a split whose ratio ${s.ratio} is not ${s.numerator}/${s.denominator}`);
      }
      if (!/split$/.test(String(s?.label ?? ''))) {
        faults.push(`${t}: a split with no words for it (${JSON.stringify(s?.label)})`);
      }
    }

    // ---- 2. NO SPLIT AFTER THE FIGURES IS EVER SILENTLY IGNORED --------
    //
    // The invariant that makes the rest worth having. For every company, either
    // no split falls after the figures the model is built on, or the payload
    // says what was decided about it and why.
    const rows = Array.isArray(payload.statements) ? payload.statements : [];
    const latestRow = [...rows].reverse().find((r: any) => isNum(r?.dilutedShares) && r.dilutedShares > 0);
    const since =
      payload?.shareCountFiledAt?.dilutedShares?.[latestRow?.fiscalYear] ??
      latestRow?.periodEnd ??
      null;
    const after = since ? splits.filter((s: any) => s.date > String(since).slice(0, 10)) : [];
    if (after.length && !rec) {
      faults.push(
        `${t}: ${after.length} split(s) fall after its share count was filed (${since}) and the payload ` +
          'carries no record of what was done about them'
      );
    }
    if (!rec) continue;
    withEvents++;
    if (!rec.applied && !rec.reason) {
      faults.push(`${t}: a split adjustment that was not applied and gives no reason`);
    }

    // ---- 3. WHERE IT WAS APPLIED, THE ARITHMETIC AND THE AGREEMENT -----
    if (rec.applied) {
      applied++;
      appliedTo.push(`${t} x${rec.factor} (${rec.appliedEvents.map((e: any) => `${e.label} on ${e.date}`).join(', ')})`);
      const want = rec.appliedEvents.reduce((f: number, e: any) => f * e.ratio, 1);
      if (Math.abs(want - rec.factor) > 1e-12) {
        faults.push(`${t}: a factor of ${rec.factor} against ${want} from the events it names`);
      }
      if (!isNum(rec.adjustedCount) || Math.abs(rec.adjustedCount - rec.filedCount * rec.factor) > 1e-6) {
        faults.push(`${t}: ${rec.filedCount} x ${rec.factor} is not the ${rec.adjustedCount} recorded`);
      }
      // the statements really carry it, and not only the record
      if (latestRow && Math.abs(latestRow.dilutedShares - rec.adjustedCount) > 1e-6) {
        faults.push(
          `${t}: the record says ${rec.adjustedCount} and the statements carry ${latestRow.dilutedShares}`
        );
      }
      // and it agrees with the count that settled it
      const ind = rec.independent?.count;
      if (!isNum(ind)) {
        faults.push(`${t}: a split applied with no independent count behind it`);
      } else if (Math.abs(ind / rec.adjustedCount - 1) > BAND) {
        faults.push(
          `${t}: the adjusted ${Math.round(rec.adjustedCount).toLocaleString('en-US')} is ` +
            `${(ind / rec.adjustedCount).toFixed(3)} times the ${Math.round(ind).toLocaleString('en-US')} ` +
            'that settled it, which is not agreement'
        );
      }
      // EVERY YEAR, not only the latest: a per-share history on one basis.
      for (const row of rows) {
        if (!isNum(row.dilutedShares)) continue;
        const filed = payload?.shareCountFiledAt?.dilutedShares?.[row.fiscalYear] ?? row.periodEnd ?? null;
        const f = (filed ? splits.filter((s: any) => s.date > String(filed).slice(0, 10)) : []).reduce(
          (a: number, s: any) => a * s.ratio,
          1
        );
        const recorded = rec.factorByYear?.[row.fiscalYear] ?? 1;
        if (Math.abs(recorded - f) > 1e-12) {
          faults.push(
            `${t} FY${row.fiscalYear}: ${f} of splits fall after it was filed (${filed}) and the record ` +
              `says ${recorded}`
          );
        }
      }
      // AND THE QUARTERS, which is what "all the per-share history" means.
      //
      // A quarter filed before the split needed multiplying and one filed
      // after it did not, so the test is not the factor but the RESULT:
      // every quarterly count should now sit near the adjusted annual one,
      // because a quarterly weighted average and an annual one differ by
      // issuance and buybacks and not by a factor of two.
      //
      // REPORTED QUARTERS ONLY, and the exclusion is named rather than
      // quiet: a DERIVED quarterly share count is nonsense before this job
      // and after it, because a weighted-average count is not additive and
      // the data layer subtracts one cumulative figure from another to get
      // it. That is `KI-33`, measured and recorded, and it is not this
      // check’s business.
      if (!(rec.quartersAdjusted > 0)) {
        faults.push(`${t}: a split applied to the years and to no quarter at all`);
      }
      for (const q of Array.isArray(payload.quarters) ? payload.quarters : []) {
        const count = q?.values?.dilutedShares;
        if (!isNum(count) || q?.states?.dilutedShares === 'derived') continue;
        if (Math.abs(count / rec.adjustedCount - 1) > 0.35) {
          faults.push(
            `${t}: the quarter to ${q.periodEnd} (filed ${q.filing?.filed ?? '?'}) reports ` +
              `${Math.round(count).toLocaleString('en-US')} against an adjusted annual ` +
              `${Math.round(rec.adjustedCount).toLocaleString('en-US')}, so it is on the other side of ` +
              'the split from the years'
          );
        }
      }
    } else {
      declined++;
      // A split older than every figure needed no decision; the rest did,
      // and only those are worth printing by name.
      if (/falls before the figures/.test(String(rec.reason))) predated++;
      else declinedFor.push(`${t} (${rec.reason})`);
      // AND A DECLINED EVENT MOVED NOTHING.
      if (rec.factorByYear) {
        faults.push(`${t}: a split that was not applied still records a factor per year`);
      }
    }
  }

  // ---- 4. THE FAULT PUT BACK: AMPHENOL WITHOUT ITS ADJUSTMENT ---------
  //
  // CONSTRUCTED, because a fixed payload cannot show it. Undoing the
  // adjustment is exactly the state the set was in until 2026-11-01, and the
  // cover-page comparison has to report it.
  {
    const file = path.join(PAYLOADS, 'APH.json');
    if (!fs.existsSync(file)) {
      faults.push('APH.json is not on disk, so the split fault could not be put back');
    } else {
      const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
      const rec = payload?.splitAdjustment;
      if (!rec?.applied) {
        faults.push(
          `APH carries no applied split adjustment (${JSON.stringify(rec?.reason ?? null)}): either the ` +
            'price source stopped reporting its 2026-09-03 split, or its next annual report has restated ' +
            'the count and this case needs re-striking'
        );
      } else {
        const asFiled = JSON.parse(JSON.stringify(payload));
        for (const row of asFiled.statements) {
          const f = rec.factorByYear?.[row.fiscalYear] ?? 1;
          if (isNum(row.dilutedShares) && f !== 1) row.dilutedShares /= f;
        }
        asFiled.splitAdjustment = { ...rec, applied: false };
        const src = deriveModel(asFiled);
        const M = buildModel(src);
        const W = computeWACC(M, src);
        const ratio = rec.independent.count / src.dcf.dilutedSharesCount / 1e6;
        if (!(ratio > 1 + BAND)) {
          faults.push(
            `with the adjustment undone APH is ${ratio.toFixed(3)} times its own cover page, so the check ` +
              'that catches a count filed before a split would not have caught it'
          );
        }
        // and the market capitalisation really was half
        const now = deriveModel(payload);
        const Wnow = computeWACC(buildModel(now), now);
        if (!(Math.abs(Wnow.marketCap / W.marketCap - rec.factor) < 1e-6)) {
          faults.push(
            `undoing the adjustment changes APH’s market capitalisation by ` +
              `${(Wnow.marketCap / W.marketCap).toFixed(4)} where the split was ${rec.factor}`
          );
        }
      }
    }
  }

  // ---- 5. AND THE OTHER WAY ROUND: AN EVENT THAT IS NOT THE COMPANY’S --
  //
  // CONSTRUCTED on AstraZeneca, whose "1:2 split" is an ADR ratio change. The
  // guard that declines it is the whole reason the adjustment is safe to apply
  // anywhere, so applying it anyway has to produce a count its own filings
  // contradict.
  {
    const file = path.join(PAYLOADS, 'AZN.json');
    if (!fs.existsSync(file)) {
      faults.push('AZN.json is not on disk, so the ADR ratio change could not be tested');
    } else {
      const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
      const rec = payload?.splitAdjustment;
      if (!rec) {
        faults.push('AZN carries no split record, so the event the guard exists for is no longer in the data');
      } else if (rec.applied) {
        faults.push(
          'AZN had its ADR ratio change applied to its share count, which halves a count its own quarterly figures confirm'
        );
      } else {
        // Applied anyway, by hand: the count must then disagree with the
        // independent one it was settled against.
        const forced = rec.filedCount * rec.events.reduce((f: number, e: any) => f * e.ratio, 1);
        const ind = rec.independent?.count;
        if (!isNum(ind)) {
          faults.push('AZN has no independent count, so nothing could have declined the event');
        } else if (!(Math.abs(ind / forced - 1) > BAND)) {
          faults.push(
            `forcing AZN’s ratio change through gives ${Math.round(forced).toLocaleString('en-US')} ` +
              `against ${Math.round(ind).toLocaleString('en-US')} reported, which the band would accept — ` +
              'so the guard is not what is keeping it out'
          );
        }
      }
    }
  }

  if (faults.length) {
    totalProblems += faults.length;
    console.log(`  PROBLEM: ${faults.length} faults in the split adjustment:`);
    faults.slice(0, 15).forEach((f) => console.log(`           ${f}`));
    if (faults.length > 15) console.log(`           ... and ${faults.length - 15} more`);
  } else {
    console.log(
      `  ${eventsSeen} split events across ${files.length} companies, every one with a date, a ratio that is ` +
        'its own numerator over its denominator, and words for it'
    );
    console.log(
      `  ${applied} companies had every share count put on today’s basis, annual and quarterly: ` +
        `${appliedTo.join('; ') || 'none'}`
    );
    console.log(
      `  ${declined} had an event recorded and not applied: ${predated} because every split on record ` +
        `predates the figures the model is built on, and ${declinedFor.length} that needed settling ` +
        `— ${declinedFor.join('; ') || 'none'}`
    );
    console.log(
      '  no company anywhere in the set has a split after the figures it is built on without a record of what was decided, and the two constructed cases — Amphenol without its adjustment, AstraZeneca with one forced on it — are both reported'
    );
  }
}

// ---------------------------------------------------------------------------
// A SHARE COUNT IS A COUNT (`KI-30`)
// ---------------------------------------------------------------------------
//
// An XBRL fact in the `shares` unit is meant to be an absolute count and all but
// a handful of registrants file one. McDonald's tags 716.4 — the figure as its
// statements print it, in millions — and nothing could tell that from a company
// with 716 shares in issue, so the derivation divided it by a million again and
// the market capitalisation came out as 0.18 against borrowings of 43,848: an
// equity weight of 0.0004% and a WACC that was the cost of debt alone.
//
// The filing settles its own scale: the cover page's shares outstanding is an
// absolute count from every registrant. Four things are checked here, and the
// last is a constructed case, because once the fault is fixed the payload set
// cannot show it any more.
{
  console.log('\n=== a share count is a count, not a figure in millions ===');
  const { deriveModel } = await import(`file:///${REPO}/src/data/deriveModel.js`);
  const { buildModel, computeWACC } = await import(`file:///${REPO}/src/engine/model.js`);

  const faults: string[] = [];
  const isNum = (v: unknown): v is number => typeof v === 'number' && isFinite(v);
  const files = fs.readdirSync(PAYLOADS).filter((f) => f.endsWith('.json'));

  let settled = 0;
  let corrected = 0;
  let unsettled = 0;
  let weighed = 0;
  const BAND = 0.2;
  const corrections: string[] = [];

  for (const file of files) {
    let payload: any;
    try {
      payload = JSON.parse(fs.readFileSync(path.join(PAYLOADS, file), 'utf8'));
    } catch {
      continue;
    }
    const rows = Array.isArray(payload?.statements) ? payload.statements : [];
    const filed = [...rows].reverse().find((r: any) => isNum(r?.dilutedShares) && r.dilutedShares > 0);
    const scale = payload?.shareScale ?? null;

    // ---- 1. THE SCALE IS SETTLED, AND SAYS WHAT IT DID -----------------
    if (scale) {
      settled++;
      if (![1, 1e3, 1e6].includes(scale.factor)) {
        faults.push(`${file}: a share-count scale of ${scale.factor}, which is not a power of a thousand`);
      }
      if (!isNum(scale.coverCount) || !scale.coverAsOf) {
        faults.push(`${file}: a scale record with no cover-page count or no date behind it`);
      }
      if (scale.factor !== 1) {
        corrected++;
        corrections.push(
          `${file.replace('.json', '')} tags ${scale.filedAs} and its cover page reports ` +
            `${Math.round(scale.coverCount).toLocaleString('en-US')} at ${scale.coverAsOf}`
        );
      }
      // the correction was applied to the statements, not only recorded
      if (filed && isNum(scale.filedAs) && scale.factor !== 1) {
        const latest = [...rows].reverse().find((r: any) => isNum(r?.dilutedShares) && r.dilutedShares > 0);
        if (latest && Math.abs(latest.dilutedShares / (scale.filedAs * scale.factor) - 1) > 1e-9) {
          faults.push(
            `${file}: the scale says ${scale.filedAs} x ${scale.factor} and the statements carry ` +
              `${latest.dilutedShares}`
          );
        }
      }
      // and the corrected count agrees with the cover page, or says why not
      if (filed && isNum(scale.coverCount)) {
        const ratio = scale.coverCount / filed.dilutedShares;
        if (Math.abs(ratio - 1) > BAND && !scale.unexplained) {
          faults.push(
            `${file}: ${Math.round(filed.dilutedShares).toLocaleString('en-US')} shares filed against ` +
              `${Math.round(scale.coverCount).toLocaleString('en-US')} on the cover page — ` +
              `${ratio.toFixed(3)} times, which is neither a match nor a scale, and nothing says so`
          );
        }
      }
    } else if (payload?.source === 'SEC EDGAR' && filed) {
      unsettled++;
    }

    // ---- 2. NOBODY IS FINANCED ALMOST ENTIRELY BY DEBT BY ACCIDENT ------
    //
    // The symptom KI-30 was measured by. A real company can be geared to 95% and
    // more; what no company is, is financed 99.99% by borrowing, and that is what
    // a market capitalisation a million times too small produces.
    try {
      const source = deriveModel(payload);
      const M = buildModel(source);
      const W = computeWACC(M, source);
      if (isNum(W.weightEquity) && isNum(W.marketCap) && W.marketCap > 0) {
        weighed++;
        if (W.weightEquity < 0.001) {
          faults.push(
            `${file}: an equity weight of ${(W.weightEquity * 100).toFixed(4)}% — a market ` +
              `capitalisation of ${Math.round(W.marketCap).toLocaleString('en-US')} against borrowings ` +
              `of ${Math.round(W.grossDebt).toLocaleString('en-US')}, which is a share count in the ` +
              'wrong unit rather than a company'
          );
        }
        // and the capitalisation really is the price times the count
        const price = payload?.quote?.price;
        const shares = source?.dcf?.dilutedSharesCount;
        const factor = isNum(payload?.priceConversion?.minorUnitFactor) ? payload.priceConversion.minorUnitFactor : 1;
        if (isNum(price) && isNum(shares)) {
          const byHand = price * shares;
          if (Math.abs(byHand / W.marketCap - 1) > 1e-12) {
            faults.push(
              `${file}: a market capitalisation of ${W.marketCap} against ${byHand} from the price and ` +
                `the share count the card shows (minor unit factor ${factor})`
            );
          }
        }
      }
    } catch {
      // a company the engine refuses has no weights to check
    }
  }

  // ---- 3. THE FAULT, PUT BACK ON PURPOSE -------------------------------
  //
  // CONSTRUCTED, because a fixed payload cannot show it. McDonald's payload with
  // its share counts returned to the scale the filing tags them in is exactly
  // what was on disk until 2026-10-31, and the check above has to report it.
  {
    const file = 'MCD.json';
    const full = path.join(PAYLOADS, file);
    if (!fs.existsSync(full)) {
      faults.push('MCD.json is not on disk, so the share-count fault could not be put back');
    } else {
      const payload = JSON.parse(fs.readFileSync(full, 'utf8'));
      const scale = payload?.shareScale;
      if (!scale || scale.factor === 1) {
        faults.push(
          `MCD.json carries no share-count correction (${JSON.stringify(scale)}): either the fetcher ` +
            'stopped reading the cover page, or McDonald’s has started tagging an absolute count'
        );
      } else {
        const asFiled = JSON.parse(JSON.stringify(payload));
        for (const row of asFiled.statements) {
          if (isNum(row.dilutedShares)) row.dilutedShares /= scale.factor;
        }
        const source = deriveModel(asFiled);
        const M = buildModel(source);
        const W = computeWACC(M, source);
        if (!(W.weightEquity < 0.001)) {
          faults.push(
            `with the correction undone MCD weighs equity at ${(W.weightEquity * 100).toFixed(4)}%, so ` +
              'the check that catches a share count in the wrong unit would not have caught it'
          );
        }
      }
    }
  }

  if (faults.length) {
    totalProblems += faults.length;
    console.log(`  PROBLEM: ${faults.length} faults in the share counts:`);
    faults.slice(0, 20).forEach((f) => console.log(`           ${f}`));
    if (faults.length > 20) console.log(`           ... and ${faults.length - 20} more`);
  } else {
    console.log(
      `  ${settled} payloads settle their share counts against their own cover page, and ${corrected} ` +
        `of them are in a scale the cover page contradicts: ${corrections.join('; ') || 'none'}`
    );
    console.log(
      `  ${weighed} companies weigh equity against debt, none of them under a tenth of a per cent, and ` +
        'on every one the market capitalisation the weights are struck on is the price times the share ' +
        'count the card shows'
    );
    console.log(
      `  ${unsettled} SEC filers carry no cover-page count to settle against, and the fault put back on ` +
        'purpose — McDonald’s share counts returned to the scale its filing tags them in — is reported ' +
        'by the check above'
    );
  }
}

// ---------------------------------------------------------------------------
// THE COST OF DEBT IS A RATING, NOT A HISTORY (`KI-29`, spec rules 17 and 18)
// ---------------------------------------------------------------------------
//
// Until 2026-10-31 the engine discounted at what a company HAD been paying:
// interest expense over average borrowings. That divides interest contracted at
// whatever rates applied when the debt was raised by a balance that moved, and
// 59 of 137 companies came out borrowing BELOW their own government's ten-year
// yield, which no corporate borrower does. The rate is now the currency-matched
// risk-free rate plus a default spread for a synthetic rating read off interest
// coverage, from Damodaran's published table.
//
// Five things have to hold, and each is proved by breaking it:
//
//   THE RATE IS THE SUM OF ITS TWO PARTS, on every company, to the last decimal
//   place. A rate that merely looks sensible is the thing this replaces.
//
//   THE SPREAD IS THE TABLE'S, for that coverage ratio and that kind of firm.
//   The bands are read independently here, including at their exact edges: a
//   coverage of 8.5 is Aaa and 8.499999 is Aa2, and a lookup that is off by one
//   band is invisible in the answer.
//
//   NOBODY BORROWS BELOW THEIR OWN GOVERNMENT. Every spread in the table is
//   positive, so this is the symptom `KI-29` was measured by and it must be
//   gone.
//
//   THE EFFECTIVE RATE IS SHOWN AND NEVER USED (rule 18). It is still computed,
//   it still drives the forecast interest charge, and it appears on the card as
//   a cross-check — but the rate the WACC is struck on must never equal it.
//
//   A COMPANY THAT CANNOT BE RATED HAS NO COST OF DEBT, and borrowed money with
//   no price on it is not free money: the WACC is null and the valuation is
//   refused rather than discounted at a rate with a hole in it.
{
  console.log('\n=== the cost of debt: a rating, not a history ===');
  const { deriveModel } = await import(`file:///${REPO}/src/data/deriveModel.js`);
  const { buildModel, buildDCF, computeWACC, interestCoverage } = await import(
    `file:///${REPO}/src/engine/model.js`
  );
  const { NON_FINANCIAL_BANDS, FINANCIAL_BANDS, syntheticRating, DEFAULT_SPREAD_VINTAGE } =
    await import(`file:///${REPO}/src/data/defaultSpread.ts`);

  const faults: string[] = [];
  const isNum = (v: unknown): v is number => typeof v === 'number' && isFinite(v);
  const near = (a: number, b: number, tol = 1e-12) => Math.abs(a - b) <= tol;

  // ---- 0. THE TABLE ITSELF, AT ITS EDGES -------------------------------
  //
  // Fifteen bands that must tile the line with no gap and no overlap, and a
  // lookup that must answer at the exact boundary rather than falling through
  // it. The two ladders are different tables and the financial one is read for
  // financial companies, which rule 17 asks for by name.
  for (const [name, bands] of [['non-financial', NON_FINANCIAL_BANDS], ['financial', FINANCIAL_BANDS]] as const) {
    for (let i = 0; i < (bands as any[]).length; i++) {
      const b = (bands as any[])[i];
      const atFrom = syntheticRating(b.from, { financial: name === 'financial' });
      const atTo = syntheticRating(b.to, { financial: name === 'financial' });
      if (atFrom?.rating !== b.rating || atTo?.rating !== b.rating) {
        faults.push(
          `${name} band ${b.from} to ${b.to} is ${b.rating}, and the lookup gives ` +
            `${atFrom?.rating} at its bottom and ${atTo?.rating} at its top`
        );
      }
      if (i && !((bands as any[])[i - 1].to < b.from)) {
        faults.push(`${name} bands ${i - 1} and ${i} overlap`);
      }
    }
  }
  if (syntheticRating(null) !== null) {
    faults.push('a company with no coverage ratio was given a rating anyway');
  }
  // The two ladders must really be different, or the financial table is
  // decoration: at a coverage of 2.5 an ordinary company is Baa2/BBB and a
  // financial one is Aa2/AA, because a bank's interest expense is mostly what it
  // pays depositors and the bands are far lower at every rating.
  const atTwoAndAHalf = [syntheticRating(2.5), syntheticRating(2.5, { financial: true })];
  if (atTwoAndAHalf[0]!.rating === atTwoAndAHalf[1]!.rating) {
    faults.push(
      `the financial ladder answers ${atTwoAndAHalf[1]!.rating} where the ordinary one answers ` +
        `${atTwoAndAHalf[0]!.rating}: the two tables are the same table`
    );
  }

  // ---- 1. EVERY COMPANY ON DISK ----------------------------------------
  const files = fs.readdirSync(PAYLOADS).filter((f) => f.endsWith('.json'));
  let rated = 0;
  let modelledInterest = 0;
  let unrated = 0;
  let belowGovernment = 0;
  let movedWithTheRate = 0;
  let refusedWithoutARate = 0;
  let constructedRefusal = '';
  const spreadsSeen = new Set<string>();
  for (const file of files) {
    let payload: any;
    try {
      payload = JSON.parse(fs.readFileSync(path.join(PAYLOADS, file), 'utf8'));
    } catch {
      continue;
    }
    let source: any;
    let M: any;
    let W: any;
    try {
      source = deriveModel(payload);
      M = buildModel(source);
      W = computeWACC(M, source);
    } catch {
      continue; // a company the engine refuses outright has no cost of debt to check
    }

    // the coverage ratio is struck on the model's OWN EBIT, not on a second one
    const coverage = interestCoverage(M);
    if (!near(coverage.ratio ?? NaN, W.interestCoverage ?? NaN, 1e-12) &&
        !(coverage.ratio === null && W.interestCoverage === null)) {
      faults.push(`${file}: the WACC was struck on a coverage ratio of ${W.interestCoverage} and the model gives ${coverage.ratio}`);
    }
    if (isNum(coverage.ratio)) {
      const t = (() => {
        for (let i = M.nH - 1; i >= 0; i--) if (M.years?.[i] === coverage.year) return i;
        return -1;
      })();
      if (t >= 0) {
        const filed = M.interestExpense?.[t];
        const interest = coverage.filed ? filed : M.debt?.interestExpense?.[t];
        const byHand = M.ebit[t] / Math.abs(interest);
        if (!near(byHand, coverage.ratio, 1e-9)) {
          faults.push(
            `${file}: interest coverage ${coverage.ratio} against ${byHand} worked out from the ` +
              `model's own EBIT and interest for FY${coverage.year}`
          );
        }
        if (coverage.filed === false) modelledInterest++;
      }
    }

    if (W.rating) {
      rated++;
      spreadsSeen.add(W.rating);
      // the spread is the one the published table gives, read again here
      const bands: any[] = W.financialTemplate ? (FINANCIAL_BANDS as any) : (NON_FINANCIAL_BANDS as any);
      const band = bands.find((b) => (W.interestCoverage as number) >= b.from && (W.interestCoverage as number) <= b.to);
      const expected = band ?? ((W.interestCoverage as number) > 0 ? bands[bands.length - 1] : bands[0]);
      if (W.rating !== expected.rating || !near(W.defaultSpreadPct, expected.spreadPct, 1e-12)) {
        faults.push(
          `${file}: coverage of ${(W.interestCoverage as number).toFixed(2)}x on the ` +
            `${W.financialTemplate ? 'financial' : 'non-financial'} table is ${expected.rating} at ` +
            `${expected.spreadPct}%, and the engine used ${W.rating} at ${W.defaultSpreadPct}%`
        );
      }
      // THE RATE IS THE SUM OF ITS TWO PARTS
      if (isNum(W.riskFreeRate)) {
        const byHand = W.riskFreeRate + expected.spreadPct / 100;
        if (!near(W.costOfDebt, byHand, 1e-12)) {
          faults.push(
            `${file}: the cost of debt is ${W.costOfDebt} and the risk-free rate plus the spread is ${byHand}`
          );
        }
        // NOBODY BORROWS BELOW THEIR OWN GOVERNMENT
        if ((W.costOfDebt as number) <= W.riskFreeRate) {
          belowGovernment++;
          faults.push(
            `${file}: a cost of debt of ${((W.costOfDebt as number) * 100).toFixed(2)}% against a ` +
              `government yield of ${(W.riskFreeRate * 100).toFixed(2)}% — the symptom KI-29 was measured by`
          );
        }
        // THE EFFECTIVE RATE IS NEVER THE RATE IN USE (rule 18)
        if (isNum(W.effectiveCostOfDebt) && near(W.costOfDebt, W.effectiveCostOfDebt, 1e-12)) {
          faults.push(
            `${file}: the cost of debt is exactly the historical effective rate, which rule 18 allows ` +
              'only as a cross-check'
          );
        }
        // AND IT FOLLOWS THE RISK-FREE RATE, POINT FOR POINT
        const dearer = JSON.parse(JSON.stringify(source.dcf.costOfCapital));
        source.dcf.costOfCapital.riskFreeRate = W.riskFreeRate + 0.01;
        const W2 = computeWACC(M, source);
        source.dcf.costOfCapital = dearer;
        if (!near(W2.costOfDebt - (W.costOfDebt as number), 0.01, 1e-12)) {
          faults.push(
            `${file}: a point on the risk-free rate moved the cost of debt by ` +
              `${((W2.costOfDebt - (W.costOfDebt as number)) * 100).toFixed(4)} points, not one`
          );
        } else {
          movedWithTheRate++;
        }
      }
    } else {
      unrated++;
      // A COMPANY THAT CANNOT BE RATED HAS NO COST OF DEBT, AND NO WACC IF IT BORROWS
      if (W.costOfDebt !== null) {
        faults.push(`${file}: no rating could be read and the cost of debt is ${W.costOfDebt}`);
      }
      if (W.weightDebt > 0) {
        if (W.wacc !== null) {
          faults.push(
            `${file}: borrows ${(W.weightDebt * 100).toFixed(1)}% of its capital with no price on that ` +
              `debt, and still has a WACC of ${W.wacc}`
          );
        }
        const D = buildDCF(M, source);
        if (D?.applicable !== false) {
          faults.push(`${file}: no cost of capital, and the discounted cash flow ran anyway`);
        } else {
          refusedWithoutARate++;
        }
      }
    }
  }

  // ---- 2. A COST OF CAPITAL WITH A HOLE IN IT REFUSES ------------------
  //
  // CONSTRUCTED, because the payload set cannot exercise it: no company on disk
  // both borrows and fails to be rated, so the guard above would be a check that
  // cannot fail. A WACC comes out null two ways — no rating for the debt, or no
  // risk-free rate for the equity — and the second can be made on any company by
  // taking its rate away. What must NOT happen is the arithmetic that was there
  // until 2026-10-31: `(1 + null) ** t` is 1, so the forecast came back
  // undiscounted and the terminal value with it, which on MercadoLibre read
  // -2,378.96 a share.
  {
    const whole = files.find((f) => {
      try {
        const p = JSON.parse(fs.readFileSync(path.join(PAYLOADS, f), 'utf8'));
        const s = deriveModel(p);
        const m = buildModel(s);
        return isNum(computeWACC(m, s).wacc) && isNum(buildDCF(m, s)?.perpetuity?.valuePerShare);
      } catch {
        return false;
      }
    });
    if (!whole) {
      faults.push('no payload on disk produces a value per share, so the refusal could not be constructed');
    } else {
      const payload = JSON.parse(fs.readFileSync(path.join(PAYLOADS, whole), 'utf8'));
      const source = deriveModel(payload);
      const M = buildModel(source);
      const before = buildDCF(M, source);
      source.dcf.costOfCapital.riskFreeRate = null;
      const W = computeWACC(M, source);
      const after = buildDCF(M, source);
      if (W.wacc !== null) {
        faults.push(`${whole}: with no risk-free rate the WACC is ${W.wacc} rather than nothing`);
      }
      if (after?.applicable !== false || after?.code !== 'noCostOfCapital') {
        faults.push(
          `${whole}: with no cost of capital the discounted cash flow answered ` +
            `${after?.perpetuity?.valuePerShare} instead of refusing — it was ` +
            `${before?.perpetuity?.valuePerShare?.toFixed(2)} a share with one`
        );
      } else {
        constructedRefusal = `${whole.replace('.json', '')} values at ${before.perpetuity.valuePerShare.toFixed(2)} and refuses with no rate`;
      }
    }
  }

  if (faults.length) {
    totalProblems += faults.length;
    console.log(`  PROBLEM: ${faults.length} faults in the cost of debt:`);
    faults.slice(0, 20).forEach((f) => console.log(`           ${f}`));
    if (faults.length > 20) console.log(`           ... and ${faults.length - 20} more`);
  } else {
    console.log(
      `  the two ladders tile the line at every edge: a coverage ratio at the bottom and the top of ` +
        `each of the ${(NON_FINANCIAL_BANDS as any[]).length} bands reads back the rating that band ` +
        `publishes, 2.5x is ${atTwoAndAHalf[0]!.rating} for an ordinary company and ` +
        `${atTwoAndAHalf[1]!.rating} for a financial one, and no ratio at all is no rating`
    );
    console.log(
      `  ${rated} companies carry a synthetic rating across ${spreadsSeen.size} of them, every one the ` +
        `spread the table publishes for its own coverage ratio (Damodaran, ${DEFAULT_SPREAD_VINTAGE}); ` +
        `${modelledInterest} are struck on the interest this model charges because the filing reports ` +
        'none in any year, and the engine says which'
    );
    console.log(
      `  the cost of debt is the risk-free rate plus that spread to the twelfth decimal place, a point ` +
        `on the rate moves it by a point on ${movedWithTheRate} companies, ${belowGovernment} borrow ` +
        'below their own government against 59 before this, and none of them is the historical ' +
        'effective rate, which is computed, shown beside it and never used (rule 18)'
    );
    console.log(
      `  ${unrated} companies cannot be rated at all, and neither borrows: they have no cost of debt ` +
        'rather than a cost of nought. A cost of capital with a hole in it refuses the valuation ' +
        `rather than discounting at one — ${constructedRefusal}, which no payload on disk can show ` +
        'and a constructed case can'
    );
  }
}

// ---------------------------------------------------------------------------
// THE TYPECHECK ACTUALLY CHECKS COMPONENT PROPS (`KI-28`)
// ---------------------------------------------------------------------------
//
// `@types/react` was not installed, so `React.FC<Props>` resolved to nothing
// that constrains JSX and **TypeScript checked no component's props anywhere in
// the build**. `skipLibCheck: true` hid the library errors that would have said
// so, and `npx tsc --noEmit` exited 0 and printed nothing.
//
// Measured while it was true: `App.tsx` passed `heads` and `onHeads` to a
// component still declaring `classification` and `onClassify` as required —
// two props it does not take, and two required props missing — and the run
// exited 0. The same run correctly reported an ordinary type error in a `.ts`
// file three lines earlier, so the checker was running; it simply had nothing
// to check components against.
//
// A CHECK THAT THE TYPES ARE INSTALLED IS NOT ENOUGH. It would pass while a
// `tsconfig` change, a `skipLibCheck` widening or a types version bump quietly
// switched prop checking off again. So this COMPILES A FILE THAT MUST NOT
// COMPILE: a component with two required props, called with neither and with
// one it does not declare. If `tsc` accepts it, prop checking is off, and the
// twenty-two errors this file's fix uncovered could accumulate again unseen.
{
  console.log('\n=== the typecheck sees component props ===');
  const probeDir = path.join(OUT, 'proptype');
  fs.mkdirSync(probeDir, { recursive: true });
  const probe = path.join(probeDir, 'probe.tsx');
  fs.writeFileSync(
    probe,
    [
      "import React from 'react';",
      'interface Props { needed: string; alsoNeeded: number; }',
      'const Component: React.FC<Props> = ({ needed }) => <div>{needed}</div>;',
      '// TWO ELEMENTS, because TypeScript reports one error per element and a',
      '// single wrong-in-two-ways call proves only whichever it reports first.',
      'export const BadExtra = () => <Component needed="x" alsoNeeded={1} notAProp="y" />;',
      'export const BadMissing = () => <Component />;',
      '',
    ].join('\n')
  );
  const tsconfig = path.join(probeDir, 'tsconfig.json');
  fs.writeFileSync(
    tsconfig,
    JSON.stringify(
      {
        // The project's own settings, so this measures the compiler the repo
        // actually runs rather than a stricter one invented here.
        extends: path.join(REPO, 'tsconfig.json').split(path.sep).join('/'),
        compilerOptions: { noEmit: true, typeRoots: [path.join(REPO, 'node_modules/@types').split(path.sep).join('/')] },
        include: ['probe.tsx'],
      },
      null,
      2
    )
  );
  const run = spawnSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['tsc', '-p', tsconfig],
    { cwd: REPO, encoding: 'utf8', shell: process.platform === 'win32' }
  );
  const output = `${run.stdout || ''}${run.stderr || ''}`;
  const sawMissing = /needed|alsoNeeded/.test(output.replace(/notAProp/g, ''));
  const sawExtra = /notAProp/.test(output);
  if (run.status !== 0 && sawMissing && sawExtra) {
    console.log('  a component called with a prop it does not declare, and missing two it requires, is rejected -- prop checking is on');
  } else {
    totalProblems++;
    console.log(
      `  PROBLEM: tsc accepted a component call that is wrong in two ways (exit ${run.status}, ` +
        `missing-prop reported: ${sawMissing}, undeclared-prop reported: ${sawExtra}). ` +
        'Component props are not being checked -- is @types/react installed?'
    );
    if (output.trim()) console.log(`           ${output.trim().split('\n')[0].slice(0, 150)}`);
  }
  fs.rmSync(probeDir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// A MARGIN IS A DIVISION, AND EVERY COLUMN HAS TO SURVIVE THE CALCULATOR (`KI-35`)
// ---------------------------------------------------------------------------
//
// Until 2026-11-03 the trailing-twelve-month column added up whatever the four
// quarters held, for every row that was not a balance. On a money row that is
// right. On a RATIO it has no denominator at all: four quarterly operating
// margins added gave NVIDIA 260.0% where the two figures printed directly above
// it in the same column — operating income 197,579 and revenue 302,969 —
// divide to 65.2%. 109 companies showed a margin roughly four times their own.
//
// So this asserts the identity a reader can check with a calculator: ON EVERY
// COLUMN OF EVERY STATEMENT OF EVERY COMPANY, a margin equals the figures
// printed in its own column. Three arms, because one of them alone would have
// held while the column was wrong:
//
//   1. THE MARGIN IS ITS OWN COLUMN'S DIVISION. Read the printed numerator and
//      the printed denominator out of the view and divide them here. This is
//      the arm the fault failed: a sum of ratios matches nothing.
//
//   2. THE MARGIN IS WITHIN ±100% WHERE REVENUE IS POSITIVE. Independent of
//      arm 1, and the symptom the fault was reported by, so it would catch a
//      denominator that was wrong in the inputs rather than in the division.
//
//   3. THE TRAILING TWELVE MONTHS REALLY IS THE FOUR QUARTERS. Arm 1 compares
//      the margin against the two figures beside it, which proves they agree
//      and not that either is right, so the printed TTM revenue and operating
//      income are re-added here from the QUARTERLY view — a different set of
//      columns, built from the quarter rows rather than from the TTM method.
//
// And the fault is put back on purpose at the end: NVIDIA's margin recomputed
// the way the old code computed it, with the check above asked to report it.
{
  console.log('\n=== a margin is a division, in every column ===');
  const { financialsFor } = await import(`file:///${REPO}/src/data/financials.ts`);
  const { MINUS } = await import(`file:///${REPO}/src/data/figureFormat.ts`);

  const faults: string[] = [];
  const isNum = (v: unknown): v is number => typeof v === 'number' && isFinite(v);
  const files = fs.readdirSync(PAYLOADS).filter((f) => f.endsWith('.json'));

  let columns = 0;
  let divisions = 0;
  let withheld = 0;
  let ttmSums = 0;
  // Trailing figures whose quarters name a line the year cannot, so the two do
  // not add up and the difference is the line.
  let ttmNotAdditive = 0;
  let companies = 0;
  let largest = { what: 'none', v: 0 };

  // A PERCENT ROW IS THE FIRST OF ITS TWO INPUTS OVER THE SECOND. Written down
  // here rather than assumed: a percent row that declares anything else fails
  // this check and has to be looked at, which is the right outcome — the
  // alternative is a check that silently stops covering the new row.
  const ratioOf = (a: number, b: number) => a / b;

  // TWO QUARTERS OUTSIDE THE BOUND, READ AT THE FILING RATHER THAN WAIVED.
  //
  // On the UPSIDE the bound is an arithmetic impossibility test: operating
  // income above revenue means income that is not in the denominator, which is
  // exactly how a wrong denominator shows itself, and nothing in this set does
  // it. On the DOWNSIDE it is not an impossibility — an impairment or an
  // acquired in-process research charge is an operating cost with no ceiling —
  // so two quarters genuinely breach it, and both were read at the 10-Q they
  // came from instead of the rule being widened to let them through:
  //
  //   GILEAD, quarter to 30 Jun 2026 (10-Q 0000882095-26-000031). The filing
  //   tags its FIRST HALF and not its quarter: an operating loss of 7,808 on
  //   costs and expenses of 22,571, against 9,038 a year earlier. The quarter
  //   is the difference between the two halves, so it carries the whole of the
  //   charge: −10,394 on revenue of 7,803.
  //
  //   SANDISK, quarter to 28 Mar 2025 (10-Q 0001628280-26-029401). Cost of
  //   sales, research and selling come to 1,737 on revenue of 1,695, so 1,839
  //   of the 1,881 loss is an operating charge the income template carries no
  //   row for. `DATA_CONSTRAINTS.md` records that gap.
  //
  // Named, dated and finite, and the check fails BOTH ways: an unlisted breach
  // is a fault, and a listed one that has stopped breaching is a fault too, so
  // the list cannot outlive the figures it accounts for.
  const FILED_LOSS_BIGGER_THAN_REVENUE: Record<string, string> = {
    'GILD income/quarterly Q2 FY26':
      'an operating loss of 10,394 on revenue of 7,803, as the difference between the two halves ' +
      'Gilead tags in 10-Q 0000882095-26-000031',
    'SNDK income/quarterly Q3 FY25':
      'an operating loss of 1,881 on revenue of 1,695, of which 1,839 is an operating charge with no ' +
      'row in the template, in 10-Q 0001628280-26-029401',
  };
  const boundSeen = new Set<string>();

  for (const file of files) {
    let payload: any;
    try {
      payload = JSON.parse(fs.readFileSync(path.join(PAYLOADS, file), 'utf8'));
    } catch {
      continue;
    }
    const ticker = file.replace('.json', '');
    let sawOne = false;

    for (const statement of ['income', 'balance', 'cash'] as const) {
      for (const frequency of ['annual', 'quarterly', 'half'] as const) {
        let view: any;
        try {
          view = financialsFor(payload, { statement, frequency, window: 'all', order: 'oldest' });
        } catch (e: any) {
          faults.push(`${ticker} ${statement}/${frequency}: the view threw -- ${e?.message || e}`);
          continue;
        }
        if (!view.periods.length) continue;
        const byKey = new Map<string, any>(view.rows.map((r: any) => [r.key, r]));

        for (const row of view.rows) {
          if (row.kind !== 'percent') continue;
          if (!Array.isArray(row.inputs) || row.inputs.length !== 2) {
            faults.push(
              `${ticker} ${statement}/${frequency}: "${row.label}" is a percentage and declares ` +
                `${Array.isArray(row.inputs) ? row.inputs.length : 'no'} inputs, so no reader and no ` +
                'check can recompute it from the column it sits in'
            );
            continue;
          }
          const over = byKey.get(row.inputs[0]);
          const under = byKey.get(row.inputs[1]);
          if (!over || !under) {
            faults.push(
              `${ticker} ${statement}/${frequency}: "${row.label}" divides ${row.inputs.join(' by ')} ` +
                'and at least one of them is not a row on this statement, so its own column does not ' +
                'show the figures it was struck from'
            );
            continue;
          }
          const revenue = byKey.get('revenue');

          view.periods.forEach((period: any, i: number) => {
            columns++;
            sawOne = true;
            const cell = row.cells[i];
            const a = over.cells[i]?.value;
            const b = under.cells[i]?.value;
            const where = `${ticker} ${statement}/${frequency} ${period.label}${
              period.kind === 'ttm' ? ' (TTM)' : ''
            }`;

            // ---- ARM 1: THE DIVISION, DONE HERE --------------------------
            if (isNum(cell?.value)) {
              if (!isNum(a) || !isNum(b) || b === 0) {
                faults.push(
                  `${where}: "${row.label}" shows ${(cell.value * 100).toFixed(1)}% while ` +
                    `${row.inputs[0]} is ${a === null ? 'not reported' : a} and ${row.inputs[1]} is ` +
                    `${b === null ? 'not reported' : b} in the same column -- a percentage with ` +
                    'nothing behind it'
                );
              } else {
                divisions++;
                const right = ratioOf(a, b);
                if (Math.abs(cell.value - right) > 1e-9 * Math.max(1, Math.abs(right))) {
                  faults.push(
                    `${where}: "${row.label}" shows ${(cell.value * 100).toFixed(1)}% and the figures ` +
                      `printed in the same column -- ${Math.round(a).toLocaleString('en-US')} over ` +
                      `${Math.round(b).toLocaleString('en-US')} -- divide to ${(right * 100).toFixed(1)}%`
                  );
                }
              }
            } else if (isNum(a) && isNum(b) && b !== 0) {
              // THE OPPOSITE FAULT: a margin withheld where both its figures
              // are printed. A dash where a division is possible is as wrong
              // as a wrong number, and quieter.
              withheld++;
              faults.push(
                `${where}: "${row.label}" shows nothing while ${Math.round(a).toLocaleString('en-US')} ` +
                  `and ${Math.round(b).toLocaleString('en-US')} are both printed in the same column`
              );
            }

            // ---- ARM 2: THE BOUND, ON POSITIVE REVENUE -------------------
            const rev = revenue?.cells[i]?.value;
            if (isNum(cell?.value) && isNum(rev) && rev > 0) {
              if (Math.abs(cell.value) > 1) {
                const accounted = FILED_LOSS_BIGGER_THAN_REVENUE[where];
                if (accounted) {
                  boundSeen.add(where);
                } else {
                  faults.push(
                    `${where}: "${row.label}" is ${(cell.value * 100).toFixed(1)}% on revenue of ` +
                      `${Math.round(rev).toLocaleString('en-US')} -- outside ${MINUS}100% to 100%, ` +
                      'which no margin struck on positive revenue is unless the filing itself says so'
                  );
                }
              } else if (Math.abs(cell.value) > Math.abs(largest.v)) {
                largest = {
                  what: `${ticker} ${row.label.toLowerCase()} ${period.kind === 'ttm' ? 'TTM' : period.label}`,
                  v: cell.value,
                };
              }
            }
          });
        }

        // ---- ARM 3: THE TTM COLUMN REALLY IS THE FOUR QUARTERS -----------
        //
        // Read out of the QUARTERLY view, which builds its columns from the
        // quarter rows directly. Arm 1 only proves the margin agrees with the
        // two figures beside it; if those two were themselves wrong it would
        // pass. This is the arm that holds the 302,969.
        if (frequency === 'annual' && view.ttm?.method === 'four-quarters') {
          let quarters: any = null;
          try {
            quarters = financialsFor(payload, {
              statement,
              frequency: 'quarterly',
              window: 'all',
              order: 'oldest',
            });
          } catch {
            quarters = null;
          }
          const ti = view.periods.findIndex((pr: any) => pr.kind === 'ttm');
          if (quarters && !quarters.empty && ti >= 0) {
            const wanted: string[] = view.periods[ti].uses || [];
            const atEnd = new Map<string, number>(
              quarters.periods.map((pr: any, j: number) => [pr.endDate, j])
            );
            const haveAll = wanted.length === 4 && wanted.every((end) => atEnd.has(end));
            if (haveAll) {
              for (const row of view.rows) {
                if (row.pointInTime || row.kind === 'percent') continue;
                const qrow = quarters.rows.find((r: any) => r.key === row.key);
                if (!qrow) continue;
                const parts = wanted.map((end) => qrow.cells[atEnd.get(end) as number]?.value);
                if (!parts.every(isNum)) continue;
                const summed = (parts as number[]).reduce((t, v) => t + v, 0);
                const shown = row.cells[ti]?.value;
                if (!isNum(shown)) continue;
                ttmSums++;
                // A ROW DEFINED AGAINST THE FIGURES ITS OWN COLUMN SHOWS IS
                // NOT ADDITIVE ACROSS COLUMNS, and the difference has to be
                // accounted for to the penny rather than tolerated.
                //
                // "Other operating items" carries whatever a column does not
                // name (`METHODOLOGY.md` §5). Where three quarters report a
                // selling cost and the fourth does not, those three quarters
                // subtract it and the trailing twelve months cannot name it at
                // all, so the trailing bridge carries it and the quarterly
                // bridges do not. The difference is then EXACTLY the amounts
                // the quarters named and the year could not — which is what is
                // asserted, so a wrong bridge still fails here.
                let expected = 0;
                for (const field of row.optional || []) {
                  const trailing = view.rows.find((r: any) => r.key === field)?.cells[ti]?.value;
                  const qr = quarters.rows.find((r: any) => r.key === field);
                  const named = wanted
                    .map((end) => qr?.cells[atEnd.get(end) as number]?.value)
                    .filter(isNum) as number[];
                  expected +=
                    (isNum(trailing) ? (trailing as number) : 0) - named.reduce((t, v) => t + v, 0);
                }
                if (expected !== 0) ttmNotAdditive++;
                if (Math.abs(shown - summed - expected) > 1e-6 * Math.max(1, Math.abs(summed))) {
                  faults.push(
                    `${ticker} ${statement} TTM: "${row.label}" shows ` +
                      `${Math.round(shown).toLocaleString('en-US')} and the four quarters it names add ` +
                      `to ${Math.round(summed).toLocaleString('en-US')}` +
                      (expected
                        ? `, a difference of ${Math.round(shown - summed).toLocaleString('en-US')} where the ` +
                          `lines this column cannot name come to ${Math.round(expected).toLocaleString('en-US')}`
                        : '')
                  );
                }
              }
            }
          }
        }
      }
    }
    if (sawOne) companies++;
  }

  // ---- THE LIST CANNOT OUTLIVE WHAT IT ACCOUNTS FOR --------------------
  for (const where of Object.keys(FILED_LOSS_BIGGER_THAN_REVENUE)) {
    if (!boundSeen.has(where)) {
      faults.push(
        `${where} is written down as ${FILED_LOSS_BIGGER_THAN_REVENUE[where]}, and its margin is now ` +
          'inside the bound -- the figures have moved, so the note has to be read again rather than kept'
      );
    }
  }

  // ---- THE FAULT, PUT BACK ON PURPOSE ---------------------------------
  //
  // CONSTRUCTED, because the fix leaves nothing on disk to find. NVIDIA's TTM
  // margin computed the way the column was computed until this commit — the
  // four quarterly margins added — must be reported by arm 1 AND by arm 2, so
  // that neither alone is carrying the check.
  {
    const file = 'NVDA.json';
    const full = path.join(PAYLOADS, file);
    if (!fs.existsSync(full)) {
      faults.push('NVDA.json is not on disk, so the summed-ratio fault could not be put back');
    } else {
      const payload = JSON.parse(fs.readFileSync(full, 'utf8'));
      const annual: any = financialsFor(payload, {
        statement: 'income',
        frequency: 'annual',
        window: 'all',
        order: 'oldest',
      });
      const quarters: any = financialsFor(payload, {
        statement: 'income',
        frequency: 'quarterly',
        window: 'all',
        order: 'oldest',
      });
      const ti = annual.periods.findIndex((pr: any) => pr.kind === 'ttm');
      const margin = annual.rows.find((r: any) => r.key === 'operatingMargin');
      const qmargin = quarters.rows?.find((r: any) => r.key === 'operatingMargin');
      const uses: string[] = ti >= 0 ? annual.periods[ti].uses || [] : [];
      const atEnd = new Map<string, number>(
        (quarters.periods || []).map((pr: any, j: number) => [pr.endDate, j])
      );
      const parts = uses.map((end) => qmargin?.cells[atEnd.get(end) as number]?.value);
      if (!margin || ti < 0 || uses.length !== 4 || !parts.every(isNum)) {
        faults.push(
          'NVDA no longer has a four-quarter trailing margin to break, so the fault could not be put back'
        );
      } else {
        const asSummed = (parts as number[]).reduce((t, v) => t + v, 0);
        const right = margin.cells[ti].value as number;
        const rev = annual.rows.find((r: any) => r.key === 'revenue')?.cells[ti]?.value;
        const armOne = Math.abs(asSummed - right) > 1e-9;
        const armTwo = Math.abs(asSummed) > 1 && isNum(rev) && rev > 0;
        if (!armOne || !armTwo) {
          faults.push(
            `with the ratios summed NVDA's trailing margin is ${(asSummed * 100).toFixed(1)}% against ` +
              `${(right * 100).toFixed(1)}% from its own column, which arm 1 ` +
              `${armOne ? 'reports' : 'MISSES'} and arm 2 ${armTwo ? 'reports' : 'MISSES'}`
          );
        }
      }
    }
  }

  if (faults.length) {
    totalProblems += faults.length;
    console.log(`  PROBLEM: ${faults.length} faults in the margins:`);
    faults.slice(0, 20).forEach((f) => console.log(`           ${f}`));
    if (faults.length > 20) console.log(`           ... and ${faults.length - 20} more`);
  } else {
    console.log(
      `  ${divisions} margin cells across ${columns} columns of ${companies} companies each equal the ` +
        'two figures printed in their own column, divided -- the trailing twelve months included'
    );
    console.log(
      `  none is outside ${MINUS}100% to 100% on positive revenue but the ${boundSeen.size} quarters ` +
        `read at their own 10-Q (${[...boundSeen].join('; ')}); the largest inside the bound is ` +
        `${largest.what} at ${(largest.v * 100).toFixed(1)}%, and ${withheld} are withheld where the ` +
        'division was possible'
    );
    console.log(
      `  ${ttmSums} trailing-twelve-month figures re-add to the four quarters they name, read from the ` +
        'quarterly columns rather than from the method that built them' +
        (ttmNotAdditive
          ? `, and on ${ttmNotAdditive} of them the quarters name a line the year cannot, so the two differ ` +
            'by exactly that line'
          : '')
    );
  }
}


// ---------------------------------------------------------------------------
// EVERY SEC FIGURE NAMES ITS CONCEPT AND ITS OWN DOCUMENT
// ---------------------------------------------------------------------------
//
// The Financials tab's whole claim is that a number can be traced to the filing
// it came from, and until 2026-11-03 three of the four lines that make that
// claim were guesses or blanks:
//
//   CONCEPT: the sheet printed the LIST of candidate tags the data layer reads
//   and the sentence "which one this company used is not recorded in the data
//   we hold", which was true of the payload. It is a property of the figure,
//   not of the line: one company's revenue is `Revenues` and the next's is
//   `RevenueFromContractWithCustomerExcludingAssessedTax`, and the same company
//   can change concept between two years.
//
//   FORM: an annual figure read "Annual report (10-K / 20-F), as tagged in
//   XBRL" — a statement about which forms this site reads, dressed up as a
//   statement about where that figure came from.
//
//   FILING DATE and FILING ID: "not recorded by the feed", for every annual
//   figure of every SEC filer, because no annual figure carried a document.
//
//   AND THE LINK SAID "Open the filing" and opened an EDGAR SEARCH PAGE.
//
// Payload version 11 records, per figure, the concept it was read from and the
// accession number of the one document it is in, with `filings` holding each
// document once. What this checks is the four lines and the link, over every
// figure of every payload, and it COUNTS what still says "Not recorded".
{
  console.log('\n=== every SEC figure names its concept and its own document ===');
  const { financialsFor, evidenceFor, CANDIDATE_CONCEPTS } = await import(
    `file:///${REPO}/src/data/financials.ts`
  );

  const faults: string[] = [];
  const files = fs.readdirSync(PAYLOADS).filter((f) => f.endsWith('.json'));

  // ---- THE SHEET'S MIRROR OF `US_TAGS` IS STILL `US_TAGS` ---------------
  //
  // `src/data/financials.ts` cannot import from `api/company.js` — each file
  // in `api/` is packaged on its own by the host, and a shared import there
  // has taken the route down — so the evidence sheet keeps a copy of the tag
  // lists, and a copy nobody checks goes stale. This one had: the sheet named
  // `ShareBasedCompensation` alone where `US_TAGS` also reads
  // `AllocatedShareBasedCompensationExpense`, and `DepreciationDepletionAnd-
  // Amortization` and one sibling where `US_TAGS` reads three. Apple's stock
  // compensation and AbbVie's depreciation are read from the tags the mirror
  // had not got, which the figures-name-their-concept arm below reported on
  // 20,556 figures the first time it ran.
  {
    const { US_TAGS } = await import(`file:///${REPO}/api/company.js`);
    const mine = Object.keys(CANDIDATE_CONCEPTS).sort();
    const theirs = Object.keys(US_TAGS).sort();
    for (const field of theirs) {
      if (!CANDIDATE_CONCEPTS[field]) {
        faults.push(`the evidence sheet has no concepts for \`${field}\`, which the fetcher reads`);
      } else if (CANDIDATE_CONCEPTS[field].join('|') !== US_TAGS[field].join('|')) {
        faults.push(
          `\`${field}\`: the evidence sheet names ${CANDIDATE_CONCEPTS[field].join(', ')} and the ` +
            `fetcher reads ${US_TAGS[field].join(', ')}`
        );
      }
    }
    for (const field of mine) {
      if (!US_TAGS[field]) {
        faults.push(`the evidence sheet names concepts for \`${field}\`, which the fetcher does not read`);
      }
    }
    if (!faults.length) {
      console.log(
        `  the evidence sheet's ${mine.length} lines of candidate concepts are the fetcher's own, tag ` +
          'for tag and in the same order of preference'
      );
    }
  }

  // ONE FORM AS FILED, in the SEC's own spelling — `10-K`, `10-Q`, `10-K/A`,
  // `8-K`, `DEF 14A`. Upper case, digits, slashes, hyphens and single spaces,
  // which is what an EDGAR form type is and what the thing this replaces was
  // not: "Annual report (10-K / 20-F), as tagged in XBRL" was a sentence about
  // which forms this site reads, printed where a reader was owed the form the
  // figure came from. Its ` / ` is refused explicitly, because a form that is
  // two forms with a slash between them is the fault itself.
  const FORM = /^[0-9A-Z][0-9A-Z/-]*( [0-9A-Z][0-9A-Z/-]*)*$/;
  const oneForm = (f: string) => FORM.test(f) && !/ \/ | \/|\/ /.test(f);
  const ACCN = /^\d{10}-\d{2}-\d{6}$/;
  // WHICH FORMS THE FIGURES ACTUALLY COME FROM, counted rather than assumed.
  // This is the count that found `KI-36`: the quarterly path filtered facts by
  // period and not by form, so a quarter could be read from a proxy statement
  // or an 8-K that tagged the same fact. Fixed on 2026-11-04, and the count is
  // kept because a form that is not a statement is now a fault and a fault
  // worth naming is worth counting.
  const interim: Record<string, number> = {};

  let secFigures = 0;
  let vendorFigures = 0;
  let withConcept = 0;
  let withDocument = 0;
  let exactLinks = 0;
  let searchLinks = 0;
  let noLink = 0;
  const notRecorded: Record<string, number> = {};
  // AND WHY, because "30,015 say Not recorded" is a number nobody can act on.
  // Three reasons, and only one of them is something to fix: our own
  // arithmetic has no concept and no document of its own by design; a vendor
  // feed records neither; and an SEC figure with neither is a payload built
  // before version 11, which the payload survey reports in its own line.
  const whyNot: Record<string, Record<string, number>> = {};
  // And the two sentences the Concept line gives where there is no one
  // concept, which are answers rather than absences.
  const saidInstead: Record<string, number> = {};
  const conceptsSeen: Record<string, Set<string>> = {};
  const formsSeen: Record<string, number> = {};

  for (const file of files) {
    let payload: any;
    try {
      payload = JSON.parse(fs.readFileSync(path.join(PAYLOADS, file), 'utf8'));
    } catch {
      continue;
    }
    const ticker = file.replace('.json', '');
    const traceable = /sec/i.test(String(payload?.source || ''));
    const filings: Record<string, any> = payload?.filings || {};

    // ---- THE DICTIONARY IS COMPLETE AND EACH ENTRY IS A DOCUMENT -------
    for (const [accn, filing] of Object.entries(filings)) {
      if (!ACCN.test(accn)) {
        faults.push(`${ticker}: "${accn}" is a key in the filings dictionary and is not an accession number`);
        continue;
      }
      if (filing?.accn !== accn) {
        faults.push(`${ticker}: the filing under ${accn} says its accession number is ${filing?.accn}`);
      }
      if (!filing?.form || !oneForm(filing.form)) {
        faults.push(`${ticker} ${accn}: a form of "${filing?.form}", which is not one form as filed`);
      } else {
        formsSeen[filing.form] = (formsSeen[filing.form] || 0) + 1;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(filing?.filed || ''))) {
        faults.push(`${ticker} ${accn}: a filing date of "${filing?.filed}"`);
      }
      // THE ADDRESS REALLY IS THAT DOCUMENT'S. Built here from the accession
      // number and the CIK rather than compared against the string the
      // fetcher wrote, because "a plausible URL" and "this filing's URL" are
      // the same length and only one of them opens the filing.
      const want = `https://www.sec.gov/Archives/edgar/data/${Number(payload?.cik)}/${accn.replace(/-/g, '')}/`;
      if (filing?.url !== want) {
        faults.push(`${ticker} ${accn}: the address is ${filing?.url} and this filing is at ${want}`);
      }
    }

    for (const statement of ['income', 'balance', 'cash'] as const) {
      for (const frequency of ['annual', 'quarterly'] as const) {
        let view: any;
        try {
          view = financialsFor(payload, { statement, frequency, window: 'all', order: 'oldest' });
        } catch {
          continue;
        }
        if (!view.periods.length) continue;

        for (const row of view.rows) {
          // A DERIVED ROW IS OURS, NOT THE FILING'S. Gross profit, EBITDA,
          // free cash flow and the margin are this site's arithmetic over
          // figures that each have their own concept, so they carry none and
          // the sheet shows the formula instead.
          if (!row.inputs) {
            // the rows the template reads straight from a field
          }
          view.periods.forEach((period: any, i: number) => {
            const cell = row.cells[i];
            if (cell.value === null && cell.state !== 'reportedZero') return;
            const where = `${ticker} ${statement}/${frequency} ${row.key} ${period.label}`;
            const ev = evidenceFor(payload, view, row, i);
            const lineOf = (label: string) =>
              ev.lines.find((l: any) => l.label === label)?.value ?? '<<missing>>';

            for (const label of ['Concept', 'Form', 'Filing date', 'Filing ID']) {
              const value = lineOf(label);
              if (value === '<<missing>>') {
                faults.push(`${where}: the evidence sheet has no "${label}" line at all`);
                continue;
              }
              if (value === 'Not recorded') {
                notRecorded[label] = (notRecorded[label] || 0) + 1;
                const why = row.inputs
                  ? 'this site’s own arithmetic, which has no concept of its own'
                  : !traceable
                    ? 'a vendor feed, which records neither'
                    : (payload?.fetcherVersion || 0) < 11
                      ? 'a payload built before version 11'
                      : 'an SEC figure that should have one';
                (whyNot[label] = whyNot[label] || {})[why] =
                  (whyNot[label]?.[why] || 0) + 1;
              } else if (label === 'Concept' && !/^[A-Za-z][A-Za-z0-9]*$/.test(value)) {
                // ONE OF THE TWO SENTENCES THE CONCEPT LINE GIVES where there
                // is no one concept: our own arithmetic, or a trailing figure
                // whose periods were tagged under more than one. Answers, not
                // absences, and counted so that the "Not recorded" figure
                // means what it says.
                const kind = row.inputs ? 'worked out here' : 'more than one across its periods';
                saidInstead[kind] = (saidInstead[kind] || 0) + 1;
                if (!/^(Not one concept|More than one)/.test(value)) {
                  faults.push(`${where}: a Concept line reading "${value}"`);
                }
              }
            }

            const concept = lineOf('Concept');
            const form = lineOf('Form');
            const filed = lineOf('Filing date');
            const accn = lineOf('Filing ID');

            if (!traceable) {
              vendorFigures++;
              // A VENDOR FIGURE HAS NO FILING, AND MUST NOT CLAIM ONE.
              for (const [label, value] of [
                // A derived row's Concept line says "worked out here" on every
                // payload, vendor or not, because that is what it is. The
                // other two lines have nothing behind them either way.
                ...(row.inputs ? [] : [['Concept', concept]]),
                ['Form', form],
                ['Filing ID', accn],
              ] as [string, string][]) {
                if (value !== 'Not recorded') {
                  faults.push(
                    `${where}: a vendor payload, and its "${label}" line reads "${value}" -- the feed ` +
                      'does not say which filing a figure came from, so nothing may be printed as if it did'
                  );
                }
              }
              if (ev.openLink) {
                faults.push(
                  `${where}: a vendor payload offering a link labelled "${ev.openLink.label}" -- there is ` +
                    'no filing behind the figure to open or to find'
                );
              }
              return;
            }

            secFigures++;
            // A FIGURE READ FROM A FILING HAS BOTH, AND THAT IS A FAULT AND
            // NOT A COUNT. Only two kinds of figure may be without them: one
            // this site worked out (`row.inputs`), and one from a payload
            // built before version 11 recorded them. Everything else is a
            // number on the Financials tab that cannot be traced, which is
            // the one thing this tab exists not to be.
            const shouldHaveBoth = !row.inputs && (payload?.fetcherVersion || 0) >= 11;
            if (shouldHaveBoth && concept === 'Not recorded') {
              faults.push(
                `${where}: a figure read from a filing with no XBRL concept recorded against it`
              );
            }
            if (shouldHaveBoth && accn === 'Not recorded') {
              faults.push(
                `${where}: a figure read from a filing with no accession number, so there is no one ` +
                  'document a reader can open'
              );
            }
            if (/^[A-Za-z][A-Za-z0-9]*$/.test(concept)) {
              withConcept++;
              // A FINANCIAL COMPANY'S TOP LINE IS A CHOSEN TAG, NOT A LIST
              // (`KI-32`). American Express reports
              // `RevenuesNetOfInterestExpense`, which is deliberately outside
              // `US_TAGS.revenue`: the tag is settled per company and recorded
              // on the payload, so the payload's own choice is what the
              // concept has to match.
              const candidates =
                row.key === 'revenue' && payload?.revenueDefinition?.tag
                  ? [payload.revenueDefinition.tag]
                  : CANDIDATE_CONCEPTS[row.key];
              if (candidates && !candidates.includes(concept)) {
                faults.push(
                  `${where}: read from "${concept}", which is not one of the concepts the data layer ` +
                    `reads for this line (${candidates.join(', ')})`
                );
              }
              (conceptsSeen[row.key] = conceptsSeen[row.key] || new Set()).add(concept);
            }

            if (accn !== 'Not recorded') {
              withDocument++;
              if (!ACCN.test(accn)) {
                faults.push(`${where}: a filing ID of "${accn}"`);
              }
              if (!oneForm(form)) {
                faults.push(
                  `${where}: a form of "${form}" -- the form a figure came from is one form as filed, ` +
                    'never a list of the forms this site reads'
                );
              } else if (!/^10-[KQ]/.test(form)) {
                // `KI-36`, FIXED ON 2026-11-04 AND HELD HERE TOO. This was a
                // measurement while the quarterly path filtered facts by
                // period and not by form: 126 figures cited to a `DEF 14A`,
                // an `8-K` or a `DEF 14C`. The data layer no longer reads
                // those, and the block below exercises the filter itself; this
                // is the same rule asserted where the READER meets it, on the
                // evidence sheet, which is the only place the citation is
                // actually shown.
                faults.push(
                  `${where}: cited to a "${form}" -- a figure is read from the statement it was ` +
                    'reported in, which is a 10-K, a 10-Q or an amendment of one, and never from a ' +
                    'proxy statement or an earnings release'
                );
              }
              if (!/^\d{4}-\d{2}-\d{2}$/.test(filed)) {
                faults.push(`${where}: a filing date of "${filed}" beside filing ${accn}`);
              }
              // ONLY WHERE THERE IS A DICTIONARY TO BE IN. A payload built
              // before version 11 carries its quarterly filings inline and no
              // dictionary at all; that it is stale is reported by the payload
              // survey, in one line, rather than by twelve thousand faults
              // here.
              if (Object.keys(filings).length && !filings[accn]) {
                faults.push(`${where}: filing ${accn}, which is not in the payload's filings dictionary`);
              }
            } else if (form !== 'Not recorded' || filed !== 'Not recorded') {
              faults.push(
                `${where}: no filing ID, and yet a form of "${form}" filed on "${filed}" -- a form and a ` +
                  'date with no document behind them is a provenance nobody can check'
              );
            }

            // ---- THE LINK SAYS WHAT IT OPENS ------------------------------
            if (ev.filings.length > 1) {
              // A SUBTRACTION, which the sheet lists both documents of rather
              // than offering one link. Rule 4's own case, and the browser
              // asserts both links open different documents.
              exactLinks++;
              if (new Set(ev.filings.map((f: any) => f.accn)).size < 2) {
                faults.push(`${where}: two filings listed and both are ${ev.filings[0].accn}`);
              }
              return;
            }
            if (!ev.openLink) {
              noLink++;
              faults.push(`${where}: an SEC filer's figure with no way to reach EDGAR at all`);
              return;
            }
            if (accn !== 'Not recorded') {
              exactLinks++;
              if (ev.openLink.label !== 'Open the filing' || !ev.openLink.exact) {
                faults.push(
                  `${where}: filing ${accn} is held and the link reads "${ev.openLink.label}"`
                );
              }
              const want = filings[accn]?.url;
              if (want && ev.openLink.url !== want) {
                faults.push(
                  `${where}: the link goes to ${ev.openLink.url} and filing ${accn} is at ${want}`
                );
              }
            } else {
              searchLinks++;
              if (ev.openLink.label !== 'Find this filing on EDGAR' || ev.openLink.exact) {
                faults.push(
                  `${where}: no accession number, and the link reads "${ev.openLink.label}" -- a link ` +
                    'labelled "open the filing" that lands on a search page is a small lie told on every ' +
                    'figure whose document is not held'
                );
              }
              if (!/sec\.gov/.test(ev.openLink.url)) {
                faults.push(`${where}: a search link that does not go to the SEC (${ev.openLink.url})`);
              }
            }
          });
        }
      }
    }
  }

  // ---- THE CONCEPT IS THE WINNER, NOT THE LIST'S FIRST ENTRY -----------
  //
  // The arm that catches the quietest way this could be wrong. Every candidate
  // list is in order of preference, so a fetcher that recorded `tagList[0]`
  // instead of the tag that actually matched would pass every check above:
  // the concept would be a real element name, in the list, the same for every
  // company. What it would NOT be is the concept a particular company used.
  // So at least one line with more than one candidate must show more than one
  // concept across the set.
  const multi = Object.keys(CANDIDATE_CONCEPTS).filter((k) => CANDIDATE_CONCEPTS[k].length > 1);
  const varied = multi.filter((k) => (conceptsSeen[k]?.size || 0) > 1);
  if (secFigures && !varied.length) {
    faults.push(
      `every one of the ${multi.length} lines with more than one candidate concept shows the same ` +
        'concept on every company, which is what recording the first candidate rather than the one that ' +
        'matched would look like'
    );
  }

  if (faults.length) {
    totalProblems += faults.length;
    console.log(`  PROBLEM: ${faults.length} faults in the provenance:`);
    faults.slice(0, 20).forEach((f) => console.log(`           ${f}`));
    if (faults.length > 20) console.log(`           ... and ${faults.length - 20} more`);
  } else {
    console.log(
      `  ${secFigures} figures from SEC filings: ${withConcept} name the XBRL concept they were read ` +
        `from and ${withDocument} name the accession number of the one document they are in`
    );
    for (const label of ['Concept', 'Form', 'Filing date', 'Filing ID']) {
      const n = notRecorded[label] || 0;
      const why = Object.entries(whyNot[label] || {})
        .sort((a, b) => b[1] - a[1])
        .map(([reason, count]) => `${count} ${reason}`)
        .join('; ');
      console.log(`  "Not recorded" on ${n} "${label}" lines: ${why || 'none'}`);
    }
    console.log(
      `  the Concept line names something other than a concept on ${Object.entries(saidInstead)
        .map(([k, n]) => `${n} (${k})`)
        .join(' and ') || 'nothing'}`
    );
    console.log(
      `  ${vendorFigures} vendor figures, every one of which says so on the lines with nothing behind ` +
        'them and is offered no link to a filing it has not got'
    );
    console.log(
      `  ${exactLinks} figures link to their own filing and ${searchLinks} to a search labelled "Find ` +
        `this filing on EDGAR"; the forms are ${Object.entries(formsSeen)
          .sort((a, b) => b[1] - a[1])
          .map(([f, n]) => `${f} x${n}`)
          .join(', ')}`
    );
    console.log(
      `  ${
        Object.values(interim).reduce((t, n) => t + n, 0)
      } figures come from a document that is not a 10-K or a 10-Q, which is now a fault rather ` +
        'than a measurement (`KI-36`)'
    );
    console.log(
      `  ${varied.length} of the ${multi.length} lines with more than one candidate concept show more ` +
        `than one across the set, so the concept is the one that matched: ${varied
          .slice(0, 3)
          .map((k) => `${k} (${[...conceptsSeen[k]].join(', ')})`)
          .join('; ')}`
    );
  }
}


// ---------------------------------------------------------------------------
// THE MARKET RANGE IS A FLEX OF A STATED ASSUMPTION (build step 5, job B2)
// ---------------------------------------------------------------------------
//
// The range was the spread of the three implied values — EV/EBITDA, EV/Sales
// and P/E, each struck at the peers' MEDIAN. So its width said how far the
// three METHODS disagreed and nothing at all about how far the peers do: a
// company whose three methods happened to agree got a bar with almost no width
// on a peer set trading between 10x and 24x, and a reader could not tell a
// tight peer group from a coincidence.
//
// VALUATION_SIDE_BY_SIDE rule 2 asks for a range from flexing a stated
// assumption. The assumption is what the market pays, so the band is now the
// peers' own 25th-to-75th percentile, with the median as the point.
//
// FIVE ARMS, and the first is the one that matters: every bound is recomputed
// here from the peer multiples and the subject's own figures, LONGHAND, so the
// comparison is not the builder against itself.
{
  console.log('\n=== the market range is a flex of what the peers pay ===');
  const { buildMarketApproach, spreadOf, percentileOf, trailingFiguresFrom } = await import(
    `file:///${REPO}/src/data/marketApproach.ts`
  );

  const isNum = (v: any): v is number => typeof v === 'number' && isFinite(v);
  const faults: string[] = [];
  const near = (a: number, b: number, tol = 1e-6) =>
    Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

  // AN INDEPENDENT PERCENTILE. Written out the long way — the rank, the two
  // neighbours, the weight between them — rather than by calling the function
  // under test. The two agreeing is then evidence; `percentileOf` agreeing with
  // itself would not be.
  const longhandPercentile = (values: number[], p: number): number => {
    const v = [...values].sort((a, b) => a - b);
    if (v.length === 1) return v[0];
    const rank = p * (v.length - 1);
    const i = Math.floor(rank);
    const frac = rank - i;
    const lo = v[i];
    const hi = v[Math.min(i + 1, v.length - 1)];
    return lo + (hi - lo) * frac;
  };

  const ebitdaRow = (r: any) => (r?.multiples || []).find((m: any) => m.key === 'evToEbitda');

  // ---- 1. HAND-WORKED PEER SETS ---------------------------------------
  //
  // Written out so the right answer is known before the code runs. The
  // subject's figures are round numbers for the same reason: an implied value
  // that can be checked on paper.
  const subject = {
    ebitda: 1000,
    revenue: 5000,
    netIncome: 400,
    netDebt: 2000,
    otherClaims: 0,
    dilutedShares: 100,
    fiscalYear: 2025,
  };
  const peerSet = (multiples: number[]) => ({
    candidates: multiples.map((m, i) => ({
      symbol: `P${i}`,
      name: `Peer ${i}`,
      evToEbitda: m,
      evToSales: m / 5,
      priceToEarnings: m * 2,
      selectedByDefault: true,
    })),
  });

  // Seven peers at 9, 10, 12, 14, 16, 20 and 24 times EBITDA. The 25th
  // percentile sits half way from the second peer to the third:
  // 10 + (12 - 10) x 0.5 = 11. The 75th is 16 + (20 - 16) x 0.5 = 18.
  const seven = [9, 10, 12, 14, 16, 20, 24];
  const sevenResult: any = buildMarketApproach(peerSet(seven), subject, null);
  const row = ebitdaRow(sevenResult);
  if (!row) {
    faults.push('the hand-worked set produced no EV/EBITDA row at all');
  } else {
    if (!near(row.spreadLow ?? NaN, 11)) {
      faults.push(`seven peers 9..24: the 25th percentile should be 11 and is ${row.spreadLow}`);
    }
    if (!near(row.spreadHigh ?? NaN, 18)) {
      faults.push(`seven peers 9..24: the 75th percentile should be 18 and is ${row.spreadHigh}`);
    }
    if (row.spreadBasis !== 'percentiles') {
      faults.push(`seven peers should use percentiles and the row says ${row.spreadBasis}`);
    }
    // 11 x 1,000 = 11,000 of enterprise value, less 2,000 of net debt, over
    // 100 shares = 90.00 a share. At 18 times: 18,000 - 2,000 = 16,000, so
    // 160.00.
    if (!near(row.lowPerShare ?? NaN, 90)) {
      faults.push(
        `11x on 1,000 of EBITDA less 2,000 of net debt over 100 shares is 90 and the row says ${row.lowPerShare}`
      );
    }
    if (!near(row.highPerShare ?? NaN, 160)) {
      faults.push(`18x the same way is 160 and the row says ${row.highPerShare}`);
    }
  }

  // ---- 2. FEWER THAN FOUR PEERS IS MIN TO MAX, AND SAYS SO -------------
  //
  // With three figures the 25th and 75th percentiles are interpolations
  // between two of them, and the band they give is NARROWER than the peers
  // themselves: 10, 12 and 24 would report 11 to 18 and hide the 24.
  const three: any = buildMarketApproach(peerSet([10, 12, 24]), subject, null);
  const threeRow = ebitdaRow(three);
  if (!threeRow) {
    faults.push('three peers produced no EV/EBITDA row');
  } else {
    if (threeRow.spreadBasis !== 'min-max') {
      faults.push(
        `three peers should fall back to min-max and the row says ${threeRow.spreadBasis}`
      );
    }
    if (!near(threeRow.spreadLow ?? NaN, 10) || !near(threeRow.spreadHigh ?? NaN, 24)) {
      faults.push(
        `three peers 10, 12, 24 should span 10 to 24 and the row says ${threeRow.spreadLow} to ${threeRow.spreadHigh}`
      );
    }
    if (!/min to max/.test(three.detail || '')) {
      faults.push(
        `a min-max spread must say so on the screen; the sentence reads "${three.detail}"`
      );
    }
  }

  // ---- 3. CHANGING THE PEER SET MOVES THE RANGE ------------------------
  //
  // The whole point of computing this on the reader's selection rather than on
  // the server: drop the two cheapest peers and the low must rise.
  const narrower: any = buildMarketApproach(peerSet(seven), subject, [
    'P2',
    'P3',
    'P4',
    'P5',
    'P6',
  ]);
  const narrowRow = ebitdaRow(narrower);
  if (narrowRow && row && !(narrowRow.spreadLow > row.spreadLow)) {
    faults.push(
      `dropping the two cheapest peers left the 25th percentile at ${narrowRow.spreadLow} (was ${row.spreadLow})`
    );
  }
  if (!narrower.edited) {
    faults.push('a hand-picked peer set is not recorded as edited');
  }

  // ---- 4. THE IDENTITIES, ON EVERY COMPANY IN THE SET ------------------
  //
  // Built from the real payloads: each company's own trailing figures as the
  // subject, and the other companies in its sector as the peers, with every
  // peer multiple computed here from that peer's reported figures and its
  // stored price. Not read from `/api/comps`, which the dashboard check serves
  // empty.
  const { buildCompanyFrom } = await import(`file:///${REPO}/src/data/autoCompany.ts`);
  const { defaultDriversFor } = await import(`file:///${REPO}/src/data/companies.ts`);
  const { buildFullModel } = await import(`file:///${REPO}/src/data/companies.ts`);

  type Entry = { ticker: string; sector: string | null; subject: any; multiples: any };
  const entries: Entry[] = [];
  for (const file of fs.readdirSync(PAYLOADS).filter((f) => f.endsWith('.json'))) {
    let payload: any;
    try {
      payload = readPayload(file);
    } catch {
      continue;
    }
    const price = payload?.quote?.price;
    if (!isNum(price) || price <= 0) continue;
    let rec: any;
    try {
      rec = buildCompanyFrom(payload);
    } catch {
      continue;
    }
    let built: any;
    try {
      const drivers = { ...rec.defaultDrivers, ...defaultDriversFor(rec.modelData) };
      built = buildFullModel(rec.modelData, drivers);
    } catch {
      continue;
    }
    const subj: any = trailingFiguresFrom(built?.model, built?.dcf, rec.modelData);
    if (!isNum(subj.dilutedShares) || subj.dilutedShares <= 0) continue;
    const equity = price * subj.dilutedShares;
    const ev = equity + (isNum(subj.netDebt) ? subj.netDebt : 0);
    entries.push({
      ticker: payload.ticker,
      sector: payload?.profile?.sector ?? null,
      subject: subj,
      multiples: {
        symbol: payload.ticker,
        name: payload.ticker,
        evToEbitda:
          isNum(subj.ebitda) && subj.ebitda > 0 ? Number((ev / subj.ebitda).toFixed(2)) : null,
        evToSales:
          isNum(subj.revenue) && subj.revenue > 0 ? Number((ev / subj.revenue).toFixed(2)) : null,
        priceToEarnings:
          isNum(subj.netIncome) && subj.netIncome > 0
            ? Number((equity / subj.netIncome).toFixed(2))
            : null,
        selectedByDefault: true,
      },
    });
  }

  let withARange = 0;
  let widened = 0;
  let narrowed = 0;
  let worstWidth = 0;
  let worstWhere = '';
  for (const e of entries) {
    const peers = entries
      .filter((o) => o.ticker !== e.ticker && o.sector && o.sector === e.sector)
      .slice(0, 5);
    if (peers.length < 2) continue;
    const comps = { candidates: peers.map((p) => p.multiples) };
    let result: any;
    try {
      result = buildMarketApproach(comps, e.subject, null);
    } catch (err) {
      faults.push(`${e.ticker}: the market approach threw — ${String(err).slice(0, 60)}`);
      continue;
    }
    if (!result?.available || !isNum(result.low) || !isNum(result.high) || !isNum(result.mid)) {
      continue;
    }
    withARange++;

    // (a) LOW <= POINT <= HIGH. A band that does not contain its own point is
    //     the failure a reader would see first.
    if (!(result.low <= result.mid + 1e-9 && result.mid <= result.high + 1e-9)) {
      faults.push(
        `${e.ticker}: the band ${result.low.toFixed(2)}-${result.high.toFixed(2)} does not contain its point ${result.mid.toFixed(2)}`
      );
    }

    // (b) EVERY BOUND REPRODUCES FROM THE PEERS' OWN MULTIPLES AND THIS
    //     COMPANY'S OWN FIGURE, recomputed longhand from the peer list.
    for (const m of result.usable as any[]) {
      const values = peers
        .map((p) => p.multiples[m.key])
        .filter((v: any) => isNum(v) && v > 0) as number[];
      if (!values.length) continue;
      if (values.length < 4) {
        // The min-max branch, asserted in arm 2 on a set built for it.
        if (m.spreadBasis !== 'min-max') {
          faults.push(
            `${e.ticker} ${m.key}: ${values.length} peers and the basis says ${m.spreadBasis}`
          );
        }
      } else {
        const wantLow = Number(longhandPercentile(values, 0.25).toFixed(2));
        const wantHigh = Number(longhandPercentile(values, 0.75).toFixed(2));
        if (!near(m.spreadLow ?? NaN, wantLow, 1e-9)) {
          faults.push(
            `${e.ticker} ${m.key}: the 25th percentile of the peers is ${wantLow} and the row says ${m.spreadLow}`
          );
        }
        if (!near(m.spreadHigh ?? NaN, wantHigh, 1e-9)) {
          faults.push(
            `${e.ticker} ${m.key}: the 75th percentile is ${wantHigh} and the row says ${m.spreadHigh}`
          );
        }
      }
      if (m.spreadPeers !== values.length) {
        faults.push(
          `${e.ticker} ${m.key}: ${values.length} peers carry it and the row says ${m.spreadPeers}`
        );
      }
      // And what each end implies, computed the way the screen prints it: the
      // multiple on the company's own figure, less net debt where the multiple
      // is an enterprise one, over diluted shares.
      const sh = e.subject.dilutedShares as number;
      const nd = isNum(e.subject.netDebt) ? e.subject.netDebt : 0;
      const oc = isNum(e.subject.otherClaims) ? e.subject.otherClaims : 0;
      const metric =
        m.key === 'evToEbitda'
          ? e.subject.ebitda
          : m.key === 'evToSales'
            ? e.subject.revenue
            : e.subject.netIncome;
      const impliedAt = (multiple: number | null) => {
        if (!isNum(multiple) || !isNum(metric)) return null;
        if (m.key === 'priceToEarnings') return multiple * (metric / sh);
        const value = (multiple * metric - nd - oc) / sh;
        return value > 0 ? value : null;
      };
      const ends: [string, number | null, number | null][] = [
        ['low', m.spreadLow, m.lowPerShare],
        ['high', m.spreadHigh, m.highPerShare],
      ];
      for (const [endLabel, multiple, shown] of ends) {
        const want = impliedAt(multiple);
        if (want === null || !isNum(shown)) continue;
        if (!near(shown, want, 1e-9)) {
          faults.push(
            `${e.ticker} ${m.key} ${endLabel}: ${multiple}x implies ${want.toFixed(4)} and the row says ${shown.toFixed(4)}`
          );
        }
      }
    }

    // (c) THE BAND IS THE UNION OF THE MULTIPLES' OWN BANDS, which is the
    //     claim the screen makes. Recomputed here from the rows rather than
    //     asserted as a containment: "the band contains its points" is also
    //     true of the OLD rule, where the band WAS the points, so it would
    //     have passed while the flex was gone.
    const points = (result.usable as any[])
      .map((m) => m.perShare)
      .filter((v: any) => isNum(v)) as number[];
    const rowLows = (result.usable as any[])
      .map((m) => (isNum(m.lowPerShare) ? m.lowPerShare : m.perShare))
      .filter((v: any) => isNum(v) && v > 0) as number[];
    const rowHighs = (result.usable as any[])
      .map((m) => (isNum(m.highPerShare) ? m.highPerShare : m.perShare))
      .filter((v: any) => isNum(v) && v > 0) as number[];
    if (rowLows.length && !near(result.low, Math.min(...rowLows), 1e-9)) {
      faults.push(
        `${e.ticker}: the band starts at ${result.low.toFixed(2)} and the lowest multiple implies ${Math.min(...rowLows).toFixed(2)}`
      );
    }
    if (rowHighs.length && !near(result.high, Math.max(...rowHighs), 1e-9)) {
      faults.push(
        `${e.ticker}: the band ends at ${result.high.toFixed(2)} and the highest multiple implies ${Math.max(...rowHighs).toFixed(2)}`
      );
    }
    // AND IT IS WIDER THAN THE POINTS ALONE wherever any multiple has a
    // spread, which is the whole of job B2: a band equal to the spread of the
    // three point values is the rule this replaced.
    const hasASpread = (result.usable as any[]).some(
      (m) => isNum(m.lowPerShare) && isNum(m.highPerShare) && m.highPerShare > m.lowPerShare
    );
    if (
      hasASpread &&
      points.length &&
      near(result.low, Math.min(...points), 1e-9) &&
      near(result.high, Math.max(...points), 1e-9)
    ) {
      faults.push(
        `${e.ticker}: the peers have a spread and the band is still just the three point values`
      );
    }

    // (d) THE SENTENCE NAMES EVERY MULTIPLE THE BAND RESTS ON.
    for (const m of result.usable as any[]) {
      if (!(result.detail || '').includes(m.label)) {
        faults.push(`${e.ticker}: the range sentence does not name ${m.label}`);
      }
    }

    // How much the flex changed the width, against the old rule: the spread of
    // the three point values alone.
    if (points.length) {
      const oldWidth = Math.max(...points) - Math.min(...points);
      const newWidth = result.high - result.low;
      if (newWidth > oldWidth + 1e-9) widened++;
      else if (newWidth < oldWidth - 1e-9) narrowed++;
      const ratio = oldWidth > 0 ? newWidth / oldWidth : Infinity;
      if (isFinite(ratio) && ratio > worstWidth) {
        worstWidth = ratio;
        worstWhere = e.ticker;
      }
    }
  }

  // ---- 5. THE FOOTBALL FIELD CARRIES THE SENTENCE ----------------------
  //
  // The band on the summary is where most readers meet this range, and it has
  // its own `detail` line. Asserting it on `buildMarketApproach` alone leaves
  // the handover unguarded: the builder can name every multiple while the
  // summary prints "3 peer multiples on reported figures" and the width looks
  // like it came from nowhere.
  {
    const { valuationSummary } = await import(`file:///${REPO}/src/data/valuationSummary.ts`);
    const { buildCompanyFrom: buildOne } = await import(
      `file:///${REPO}/src/data/autoCompany.ts`
    );
    let checked = 0;
    for (const file of fs.readdirSync(PAYLOADS).filter((f) => f.endsWith('.json'))) {
      if (checked >= 3) break;
      let payload: any;
      try {
        payload = readPayload(file);
      } catch {
        continue;
      }
      const price = payload?.quote?.price;
      if (!isNum(price) || price <= 0) continue;
      let rec: any;
      try {
        rec = buildOne(payload);
      } catch {
        continue;
      }
      const drivers: any = { ...rec.defaultDrivers, ...defaultDriversFor(rec.modelData) };
      let summary: any;
      try {
        summary = valuationSummary(rec.modelData, drivers, price, sevenResult);
      } catch {
        continue;
      }
      const band = (summary?.fieldBands || []).find((b: any) => b.variant === 'market');
      if (!band) continue;
      checked++;
      if (band.detail !== sevenResult.detail) {
        faults.push(
          `${payload.ticker}: the market band on the summary says "${band.detail}" and the approach says "${sevenResult.detail}"`
        );
      }
      for (const m of sevenResult.usable as any[]) {
        if (!(band.detail || '').includes(m.label)) {
          faults.push(`${payload.ticker}: the summary's market band does not name ${m.label}`);
        }
      }
    }
    if (!checked) {
      faults.push('no company produced a market band on the summary, so the handover is unchecked');
    }
  }

  // ---- 6. THE HELPERS' OWN EDGES ---------------------------------------
  if (percentileOf([], 0.25) !== null) faults.push('an empty peer set produced a percentile');
  if (spreadOf([null, 0, -4]).basis !== 'none') {
    faults.push('a peer set with no usable multiple did not say so');
  }
  if (spreadOf([13]).basis !== 'min-max') {
    faults.push('one peer should be min-max and is not');
  }

  if (faults.length) {
    totalProblems += faults.length;
    console.log(`  PROBLEM: ${faults.length} faults in the market range:`);
    faults.slice(0, 15).forEach((f) => console.log(`           ${f}`));
    if (faults.length > 15) console.log(`           ... and ${faults.length - 15} more`);
  } else {
    console.log(
      '  the hand-worked set of seven peers at 9-24x gives 11x to 18x, which on 1,000 of EBITDA' +
        ' less 2,000 of net debt over 100 shares is 90.00 to 160.00 a share'
    );
    console.log(
      `  ${withARange} companies get a market range from a sector peer set; every bound reproduces` +
        " from the peers' own multiples, recomputed longhand"
    );
    console.log(
      `  ${widened} ranges widened and ${narrowed} narrowed against the old spread-of-the-methods` +
        ` rule; widest ${worstWidth.toFixed(1)}x at ${worstWhere || 'none'}`
    );
  }
}

// ---------------------------------------------------------------------------
// EVERY COMPANY'S TOP LINE IS THE TOTAL REVENUE IT REPORTS (`KI-39`)
// ---------------------------------------------------------------------------
//
// The revenue tags were read in order of preference and the first one present
// won. For most filers the first of them IS the top line. For a company whose
// revenue is not all revenue from contracts with customers — a pipeline selling
// commodities, a utility with regulated and unregulated streams — it is a
// COMPONENT of the top line, and the filing's own total sits in `Revenues`,
// further down the list, where nothing read it. Enbridge's FY2021 read 19,432
// against the 47,071 its own 10-K files: 59% short.
//
// Four arms.
{
  console.log('\n=== every company\'s top line is the total revenue it reports ===');
  const { US_TAGS, TOTAL_REVENUE_FIRST } = await import(`file:///${REPO}/api/company.js`);

  const isNum = (v: any): v is number => typeof v === 'number' && isFinite(v);
  const faults: string[] = [];
  let filers = 0;
  let settled = 0;
  let byTag: Record<string, number> = {};
  let wouldHaveBeenShort = 0;
  let worstShort = 0;
  let worstWhere = '';
  const narrowed: string[] = [];

  for (const file of fs.readdirSync(PAYLOADS).filter((f) => f.endsWith('.json'))) {
    let payload: any;
    try {
      payload = readPayload(file);
    } catch {
      continue;
    }
    if (!/sec/i.test(String(payload?.source || ''))) continue;
    if (!payload?.statements?.length) continue;
    filers++;
    const ticker = payload.ticker || file;
    const definition = payload.revenueDefinition;

    // ---- 1. EVERY SEC FILER SETTLES A TOP LINE, AND RECORDS IT ----------
    if (!definition?.tag) {
      faults.push(`${ticker}: no revenue definition recorded, so the top line is whichever tag came first`);
      continue;
    }
    settled++;
    byTag[definition.tag] = (byTag[definition.tag] || 0) + 1;
    if (!definition.basis || definition.basis.length < 30) {
      faults.push(`${ticker}: the top line names a tag and no basis for choosing it`);
    }

    // ---- 2. THE TAG CHOSEN IS THE FIRST THAT MEANS "TOTAL REVENUE" ------
    //
    // Recomputed here from the candidates the payload records and the ORDER the
    // fetcher publishes, rather than read back from the choice.
    //
    // THE ORDER IS THE POINT, AND IT IS NOT THE SIZE OF THE FIGURE. I wrote
    // this rule as "the largest" first, on the reasoning that a component
    // cannot exceed the total it is part of, and the measurement disproved it:
    // Mastercard tags its GROSS revenue under the contract-revenue tag and its
    // NET revenue — the top line of its income statement — under `Revenues`,
    // 29,845 against 18,884 in FY2021. The larger figure there is the line
    // above two deductions, and "largest" would have published it.
    const considered = definition.considered || [];
    const atLatest = considered.filter((c: any) => c.reachesLatest);
    if (atLatest.length) {
      const expected =
        (TOTAL_REVENUE_FIRST as string[]).find((tag) => atLatest.some((c: any) => c.tag === tag)) ??
        atLatest[0].tag;
      // A FINANCIAL COMPANY'S RULE IS ITS OWN (`KI-32`): the line on the face of
      // its income statement, `RevenuesNetOfInterestExpense` where it is
      // tagged, which is not in this order at all. Those are held to arm 1 and
      // arm 4 and not to this one.
      const financialTag = !(TOTAL_REVENUE_FIRST as string[]).includes(definition.tag);
      if (!financialTag && definition.tag !== expected) {
        faults.push(
          `${ticker}: reads ${definition.tag} where ${expected} is the first tag meaning total revenue ` +
            'that reaches its latest reported year'
        );
      }
    }

    // ---- 3. WHAT THE OLD RULE WOULD HAVE SHOWN, where it differs --------
    //
    // The payload records every candidate's figure, so the shortfall of the
    // first-in-the-list choice is a fact it holds rather than a memory.
    const order = US_TAGS.revenue as string[];
    const firstPresent = order.find((tag) =>
      considered.some((c: any) => c.tag === tag && c.reachesLatest)
    );
    if (firstPresent && firstPresent !== definition.tag) {
      const was = considered.find((c: any) => c.tag === firstPresent);
      const now = considered.find((c: any) => c.tag === definition.tag);
      if (isNum(was?.figureAtLatest) && isNum(now?.figureAtLatest) && now.figureAtLatest > 0) {
        const short = ((now.figureAtLatest - was.figureAtLatest) / now.figureAtLatest) * 100;
        if (short > 0.1) {
          wouldHaveBeenShort++;
          narrowed.push(
            `${ticker}: ${firstPresent} ${was.figureAtLatest} against ${definition.tag} ` +
              `${now.figureAtLatest} (${short.toFixed(1)}% short)`
          );
          if (short > worstShort) {
            worstShort = short;
            worstWhere = ticker;
          }
        }
      }
    }

    // ---- 4. AND THE FIGURES SHOWN ARE THAT TAG'S ------------------------
    //
    // The latest reported year's revenue on the statements must be the figure
    // the chosen tag reports, or the definition is describing a choice the
    // extraction did not make.
    const latest = definition.latestYear;
    const row = (payload.statements || []).find((r: any) => r.fiscalYear === latest);
    const atLatestFigure = considered.find((c: any) => c.tag === definition.tag)?.figureAtLatest;
    if (row && isNum(row.revenue) && isNum(atLatestFigure)) {
      // The payload holds revenue in millions; the facts are absolute.
      const inMillions = atLatestFigure / 1e6;
      const off = Math.abs(row.revenue - inMillions) / Math.max(1, Math.abs(inMillions));
      if (off > 0.001) {
        faults.push(
          `${ticker} FY${latest}: the statements show ${row.revenue} and ${definition.tag} reports ` +
            `${inMillions.toFixed(1)} in millions`
        );
      }
    }
    if (row && isNum(row.revenue) && row.evidence?.revenue?.concept) {
      if (row.evidence.revenue.concept !== definition.tag) {
        faults.push(
          `${ticker} FY${latest}: revenue is cited to ${row.evidence.revenue.concept} and the top line is ` +
            `settled on ${definition.tag}`
        );
      }
    }
  }

  console.log(
    `  ${settled} of ${filers} SEC filers settle a top line and record how: ${Object.entries(byTag)
      .sort((a, b) => b[1] - a[1])
      .map(([tag, n]) => `${tag} x${n}`)
      .join(', ')}`
  );
  console.log(
    `  ${wouldHaveBeenShort} of them would have shown a COMPONENT under the old order of preference, worst ` +
      `${worstWhere} at ${worstShort.toFixed(1)}% short`
  );
  for (const line of narrowed.slice(0, 6)) console.log(`    ${line}`);

  if (faults.length) {
    totalProblems += faults.length;
    console.log(`  PROBLEM: ${faults.length} faults in the top line:`);
    faults.slice(0, 20).forEach((f) => console.log(`           ${f}`));
    if (faults.length > 20) console.log(`           ... and ${faults.length - 20} more`);
  }
}


// ---------------------------------------------------------------------------
// THE SEVEN FINDINGS THE SCREENSHOT REVIEW LEFT AS DATA ERRORS
// ---------------------------------------------------------------------------
//
// `docs/STUDIO_SPEC_ADDENDUM.md` separates what is a figure being wrong from
// what is a screen being ugly, and keeps seven of the first kind for now rather
// than for build step 9. Six are checked here; G4's chart geometry is measured
// in a browser by `verify:dashboard`, because a bar's height is a rendered
// fact and nothing else can see it.
{
  console.log('\n=== the addendum\'s data errors: currency words, bases, units, limits ===');
  const { currencyWords, perHundred, CURRENCIES_WITH_WORDS } = await import(
    `file:///${REPO}/src/data/currencyWords.ts`
  );
  const { asMultiple, MINUS, NOT_REPORTED } = await import(`file:///${REPO}/src/data/figureFormat.ts`);
  const { reverseDcf } = await import(`file:///${REPO}/src/data/reverseDcf.ts`);
  const { buildCompanyFrom } = await import(`file:///${REPO}/src/data/autoCompany.ts`);
  const { defaultDriversFor } = await import(`file:///${REPO}/src/data/companies.ts`);

  const isNum = (v: any): v is number => typeof v === 'number' && isFinite(v);
  const faults: string[] = [];

  // ---- G7: THE CURRENCY WORD COMES FROM THE COMPANY --------------------
  //
  // A reader of NVIDIA, which reports in dollars, was told what it keeps from
  // "every hundred RUPEES of sales". The word was hard-coded when every company
  // on the site was Indian.
  const currencies = new Set<string>();
  for (const file of fs.readdirSync(PAYLOADS).filter((f) => f.endsWith('.json'))) {
    try {
      const payload = readPayload(file);
      if (payload?.currency) currencies.add(String(payload.currency));
    } catch {
      /* the payload survey reports an unreadable payload */
    }
  }
  const unworded = [...currencies].filter((c) => !CURRENCIES_WITH_WORDS.includes(c));
  if (unworded.length) {
    faults.push(
      `${unworded.length} currencies in the set have no word for their unit (${unworded.join(', ')}), so a ` +
        'sentence about them would name a code'
    );
  }
  // AND NO SCREEN WRITES ITS OWN. The words that were hard-coded, looked for in
  // every component: a currency unit in prose must come from the company.
  const UNITS = /\b(rupees|dollars|euros|pounds|yen|rupee|dollar|euro|pound)\b/i;
  // The one sentence that names a currency as a fact about a named company.
  const allowed = ['HSBC reports in dollars'];
  let exempt = 0;
  const componentFiles = fs
    .readdirSync(path.join(REPO, 'src/components'))
    .filter((f) => /\.tsx?$/.test(f));
  let prose = 0;
  for (const file of componentFiles) {
    const text = fs.readFileSync(path.join(REPO, 'src/components', file), 'utf8');
    // COMMENTS EXPLAIN THE RULE AND CODE MUST NOT RESTATE THE WORD, so the
    // comments come out first — and properly: a block comment runs over several
    // lines, and this check's first version reported its own explanation of the
    // fix as the fault.
    const withoutComments = text
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\r\n]/g, ' '))
      .replace(/(^|[^:])\/\/[^\r\n]*/g, (m, p1) => p1 + ' '.repeat(Math.max(0, m.length - p1.length)));
    withoutComments.split(/\r?\n/).forEach((line, i) => {
      if (!UNITS.test(line)) return;
      // A sentence built FROM the company's currency is the fix, not the fault.
      if (/currencyWords|perHundred/.test(line)) return;
      // AND A CURRENCY NAMED AS A FACT ABOUT A NAMED COMPANY IS A FACT. The
      // screener explains which listing it keeps by naming what HSBC actually
      // reports in; that is not a unit standing in for the reader's company. One
      // sentence, named here with its own words, so the exemption cannot outlive
      // the sentence it was granted for.
      if (allowed.some((text) => line.includes(text))) {
        exempt++;
        return;
      }
      prose++;
      faults.push(
        `src/components/${file}:${i + 1} names a currency unit in its own words: ${line.trim().slice(0, 70)}`
      );
    });
  }

  // ---- G10: ONE DECIMAL RULE, A REAL MINUS SIGN, AND × ------------------
  //
  // The ratios read `0.8x`, `1.09x`, `0.03x`, `0x net cash`, `0.02x net cash`:
  // mixed decimals inside one row, and words on some cells and a bare ratio on
  // others, so the sign was unclear.
  const MULTIPLES: [number | null, string][] = [
    [0.8, '0.80×'],
    [1.09, '1.09×'],
    [0.03, '0.03×'],
    [-0.02, `${MINUS}0.02×`],
    [-0.004, '0.00×'],
    [0, '0.00×'],
    [null, NOT_REPORTED],
  ];
  for (const [value, want] of MULTIPLES) {
    const got = asMultiple(value);
    if (got !== want) {
      faults.push(`a multiple of ${value} prints "${got}" where the rule gives "${want}"`);
    }
  }
  // And no record carries the words any more.
  let multiples = 0;
  for (const file of fs.readdirSync(PAYLOADS).filter((f) => f.endsWith('.json'))) {
    let rec: any;
    try {
      rec = buildCompanyFrom(readPayload(file));
    } catch {
      continue;
    }
    const said = String(rec.netDebtEbitda ?? '');
    if (!said) continue;
    multiples++;
    if (/net cash|\bx\b/.test(said)) {
      faults.push(`${rec.ticker}: net debt to EBITDA reads "${said}" — words on a ratio, or a lower-case x`);
    }
    if (said !== NOT_REPORTED && !/^−?\d+\.\d{2}×$/.test(said)) {
      faults.push(`${rec.ticker}: net debt to EBITDA reads "${said}", which is not one decimal rule and a sign`);
    }
  }

  // ---- G9: A LABEL THAT SAYS LTM MUST SHOW LTM --------------------------
  //
  // The tiles read `ROE (LTM)` and `Op margin` and were the LAST REPORTED
  // FISCAL YEAR. On NVIDIA the label said LTM at 76.3% while the trailing
  // operating margin on the Financials tab was 65.2%.
  const dashboard = fs.readFileSync(path.join(REPO, 'src/components/TerminalDashboard.tsx'), 'utf8');
  dashboard.split(/\r?\n/).forEach((line, i) => {
    const code = line.replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
    if (/^\s*(\/\/|\*)/.test(line)) return;
    if (/label:\s*['"`][^'"`]*\(LTM\)/.test(code)) {
      faults.push(
        `TerminalDashboard.tsx:${i + 1} labels a tile LTM: ${code.trim().slice(0, 70)} — these are the last ` +
          'reported fiscal year, so the label must say which year'
      );
    }
  });
  if (!/const ratioLabel = \(name: string\)/.test(dashboard)) {
    faults.push('the tiles no longer take their basis from the year the ratio is on');
  }

  // ---- G14: A FORECAST CELL WITH NO FIGURE IS n/a, NOT AN EM DASH -------
  const nerd = fs.readFileSync(path.join(REPO, 'src/components/nerdViews.tsx'), 'utf8');
  if (!/data-not-forecast/.test(nerd)) {
    faults.push('a forecast cell with no figure no longer says it is not applicable');
  }
  // AND THE CONDITION, not only the attribute: a branch left in the file with
  // its test replaced by `false` still carries every word of it.
  if (!/\) : i >= firstForecast && !num\(row\.values\[i\]\) \? \(/.test(nerd)) {
    faults.push('the not-applicable branch is no longer reached by a forecast cell with no figure');
  }
  if (!/notForecast/.test(nerd)) {
    faults.push('a row can no longer say why it has no forecast');
  }

  // ---- G22 and D3: A HEAD SHOWS ITS OWN TOTAL, AND SAYS A NAME ONCE -----
  const editor = fs.readFileSync(path.join(REPO, 'src/components/figuresEditor.tsx'), 'utf8');
  if (/const sums = contributing\.length > 1;/.test(editor)) {
    faults.push('a head with one contributing line shows no total again (G22)');
  }
  if (!/const sameName = contributing\.length === 1 && contributing\[0\]\.label === head\.label;/.test(editor)) {
    faults.push('a head can repeat the name of its only line again (G22)');
  }
  if (!/of which \$\{line\.label/.test(editor)) {
    faults.push("a component no longer reads as what it is — an \"of which\" of its parent (D3)");
  }

  // ---- D8b: A LIMIT IS NOT A SOLVED VALUE -------------------------------
  //
  // A screenshot showed the reverse DCF reporting terminal growth of exactly
  // 5.0%, which is the ceiling of the range it searches rather than the figure
  // the price implies. A ceiling printed as a value is the worst kind of wrong
  // figure, because it is the one a reader would quote.
  let solved = 0;
  let atLimit = 0;
  let ranges = 0;
  const examples: string[] = [];
  let drivenLimit = '';
  for (const file of fs.readdirSync(PAYLOADS).filter((f) => f.endsWith('.json'))) {
    let payload: any;
    let rec: any;
    try {
      payload = readPayload(file);
      rec = buildCompanyFrom(payload);
    } catch {
      continue;
    }
    const price = payload?.quote?.price;
    if (!isNum(price) || price <= 0) continue;
    const drivers: any = { ...rec.defaultDrivers, ...defaultDriversFor(rec.modelData) };
    let result: any;
    try {
      result = reverseDcf(rec.modelData, drivers, price);
    } catch {
      continue;
    }
    if (!result?.applicable) continue;
    for (const figure of result.figures || []) {
      if (figure.outOfRange) continue;
      if (!figure.searched) {
        faults.push(`${rec.ticker} ${figure.key}: solved without recording the range it was searched in`);
        continue;
      }
      ranges++;
      const { low, high } = figure.searched;
      if (!(low < high)) {
        faults.push(`${rec.ticker} ${figure.key}: searched a range of ${low} to ${high}`);
      }
      if (!isNum(figure.implied)) continue;
      solved++;
      const onEdge =
        Math.abs(figure.implied - low) <= 0.0501 || Math.abs(figure.implied - high) <= 0.0501;
      if (onEdge && !figure.atLimit) {
        faults.push(
          `${rec.ticker} ${figure.key}: the answer is ${figure.implied} and the range searched is ` +
            `${low} to ${high} — a limit reported as a solved value, which is D8b itself`
        );
      }
      if (!onEdge && figure.atLimit) {
        faults.push(
          `${rec.ticker} ${figure.key}: reported as a limit at ${figure.implied} inside a range of ` +
            `${low} to ${high}`
        );
      }
      if (figure.atLimit) {
        atLimit++;
        if (examples.length < 4) {
          examples.push(
            `${rec.ticker} ${figure.key}: ${figure.implied} at the ${figure.atLimit} of ${low} to ${high}`
          );
        }
      }
    }
  }

  if (exempt !== allowed.length) {
    faults.push(
      `the currency scan exempts ${allowed.length} sentence(s) and found ${exempt} of them — an exemption ` +
        'that no longer matches a line is an exemption nobody will remove'
    );
  }
  // ---- AND THE LIMIT ITSELF, DRIVEN, BECAUSE NO PRICE ON DISK REACHES ONE
  //
  // Every company's own price implies a terminal growth rate comfortably inside
  // the range searched, so the branch that reports a LIMIT rather than a value —
  // which is the whole of D8b — would ship untested. The case is reached by
  // raising the price until the implied rate meets the ceiling: as the price
  // rises the rate rises with it, and just past the ceiling the search finds no
  // answer at all and says so instead.
  {
    let probe: any = null;
    try {
      probe = readPayload('AAPL.json');
    } catch {
      probe = null;
    }
    if (!probe?.quote?.price) {
      faults.push('no payload with a price to drive the at-limit case with');
    } else {
      const rec: any = buildCompanyFrom(probe);
      const drivers: any = { ...rec.defaultDrivers, ...defaultDriversFor(rec.modelData) };
      const terminalAt = (price: number) => {
        try {
          const r: any = reverseDcf(rec.modelData, drivers, price);
          return r?.figures?.find((f: any) => f.key === 'terminalGrowth') ?? null;
        } catch {
          return null;
        }
      };
      // Between a price that still solves and one that cannot, the answer
      // crosses the ceiling. Twenty halvings land on it.
      let low = probe.quote.price;
      let high = probe.quote.price * 16;
      let found: any = null;
      for (let i = 0; i < 20 && !found; i++) {
        const mid = (low + high) / 2;
        const figure = terminalAt(mid);
        if (figure?.atLimit) {
          found = figure;
          break;
        }
        if (figure && isNum(figure.implied)) low = mid;
        else high = mid;
      }
      if (!found) {
        faults.push(
          'no price between this company\'s own and sixteen times it makes the implied terminal growth ' +
            'reach the ceiling of the range searched, so the limit branch is untested'
        );
      } else {
        if (found.atLimit !== 'high') {
          faults.push(`the implied rate met the ceiling and reads as a limit at the ${found.atLimit}`);
        }
        if (!found.searched || !isNum(found.searched.high)) {
          faults.push('a figure at its limit does not carry the range it was searched in');
        } else if (Math.abs(found.implied - found.searched.high) > 0.0501) {
          faults.push(
            `the figure reads as a limit at ${found.implied} with a ceiling of ${found.searched.high}`
          );
        } else {
          drivenLimit = `${found.implied.toFixed(2)}% against a ceiling of ${found.searched.high.toFixed(2)}%`;
        }
      }
    }
  }

  console.log(
    `  the currency word comes from the company on ${currencies.size} currencies in the set, all of them ` +
      `worded, and ${prose} components write their own; the one exemption is a currency named as a fact ` +
      'about a named company (HSBC)'
  );
  console.log(
    `  ${multiples} records print net debt to EBITDA as one signed multiple — two decimals, a real minus ` +
      'sign and ×, with no "net cash" words on some cells and a bare ratio on others'
  );
  console.log(
    `  ${solved} reverse-DCF figures are solved inside a recorded range and ${atLimit} are reported as a ` +
      `limit rather than a value${examples.length ? `: ${examples.join('; ')}` : ''}`
  );
  console.log(
    `  the limit itself is driven by raising the price until the implied rate meets the ceiling, since no ` +
      `price on disk reaches one: ${drivenLimit || 'NOT DRIVEN'}`
  );

  if (faults.length) {
    totalProblems += faults.length;
    console.log(`  PROBLEM: ${faults.length} faults in the addendum's data errors:`);
    faults.slice(0, 20).forEach((f) => console.log(`           ${f}`));
    if (faults.length > 20) console.log(`           ... and ${faults.length - 20} more`);
  }
}


// ---------------------------------------------------------------------------
// FIVE RATIOS, AND NO SCORE
// ---------------------------------------------------------------------------
//
// A composite "financial health score" took these five ratios, scored each
// 0–100 against thresholds of our own, averaged them, and printed the result as
// an oxblood `{n}/100` beside a radar polygon. Removed on 4 November 2026
// (`docs/STUDIO_SPEC.md` S2, approved by Nihar; `ROADMAP.md` section 12 carries
// the reason). Three things were wrong with it, each severity H: a score is a
// VERDICT rather than a fact, and its thresholds were ours and unsourced; the
// radar's axes were MISLABELLED, so the figure under each label was not that
// label's figure; and a ratio the filing could not support was drawn as the
// WORST possible score.
//
// What is checked is what replaced it, and that what went cannot come back.
{
  console.log('\n=== five ratios, and no score ===');
  const { computePlainRatios } = await import(`file:///${REPO}/src/data/plainRatios.js`);
  const { buildCompanyFrom } = await import(`file:///${REPO}/src/data/autoCompany.ts`);

  const isNum = (v: any): v is number => typeof v === 'number' && isFinite(v);
  const faults: string[] = [];
  let records = 0;
  let figures = 0;
  let absent = 0;
  const seen = new Set<string>();

  // ---- 1. EVERY RECORD CARRIES THE FIVE, AND EACH RECONCILES -------------
  //
  // Recomputed in the check from the statements, so a ratio that stopped being
  // what its formula says would fail rather than being read back.
  for (const file of fs.readdirSync(PAYLOADS).filter((f) => f.endsWith('.json'))) {
    let payload: any;
    try {
      payload = readPayload(file);
    } catch {
      continue;
    }
    let rec: any;
    try {
      rec = buildCompanyFrom(payload);
    } catch {
      continue;
    }
    records++;
    const ticker = payload.ticker || file;
    const held = rec.plainRatios;
    if (!held || !Array.isArray(held.ratios)) {
      faults.push(`${ticker}: no five ratios on the record at all`);
      continue;
    }
    if (held.ratios.length !== 5) {
      faults.push(`${ticker}: ${held.ratios.length} ratios where there are five`);
    }
    const rows: any[] = payload.statements || [];
    const y = rows[rows.length - 1] || {};
    const want: Record<string, number | null> = {
      liquidity:
        isNum(y.currentAssets) && isNum(y.currentLiabilities) && y.currentLiabilities !== 0
          ? y.currentAssets / y.currentLiabilities
          : null,
      profitability:
        isNum(y.operatingIncome) && isNum(y.revenue) && y.revenue !== 0
          ? (y.operatingIncome / y.revenue) * 100
          : null,
      returns:
        isNum(y.netIncome) && isNum(y.totalAssets) && y.totalAssets !== 0
          ? (y.netIncome / y.totalAssets) * 100
          : null,
    };
    for (const ratio of held.ratios) {
      seen.add(ratio.key);
      if (!ratio.formula || ratio.formula.length < 12) {
        faults.push(`${ticker} ${ratio.key}: no formula, which is the part that replaced the score`);
      }
      // A SCORE MAY NOT COME BACK ON THE RATIO EITHER.
      for (const banned of ['score', 'overall', 'rating', 'grade']) {
        if (banned in ratio) {
          faults.push(`${ticker} ${ratio.key}: carries a "${banned}" — the score is back on the ratio`);
        }
      }
      if (ratio.value === null) {
        absent++;
        if (!ratio.reason) faults.push(`${ticker} ${ratio.key}: absent with no reason`);
      } else {
        figures++;
        if (!isNum(ratio.value)) faults.push(`${ticker} ${ratio.key}: holds ${ratio.value}`);
      }
      const expected = want[ratio.key];
      if (expected === undefined) continue;
      if (expected === null) {
        if (ratio.value !== null) {
          faults.push(
            `${ticker} ${ratio.key}: holds ${ratio.value} and the filing has nothing to compute it from`
          );
        }
      } else if (ratio.value === null) {
        faults.push(`${ticker} ${ratio.key}: absent, and the filing gives ${expected.toFixed(2)}`);
      } else {
        const dp = ratio.unit === '%' ? 1 : 2;
        if (Math.abs(ratio.value - Number(expected.toFixed(dp))) > 10 ** -dp / 1.9) {
          faults.push(
            `${ticker} ${ratio.key}: holds ${ratio.value} and the filing gives ${expected.toFixed(dp)}`
          );
        }
      }
    }
  }
  for (const key of ['liquidity', 'leverage', 'profitability', 'cashConversion', 'returns']) {
    if (!seen.has(key)) faults.push(`the ${key} ratio is on no record in the set`);
  }

  // ---- 2. THE SCORE, THE RADAR AND THE BADGE ARE GONE FROM THE SOURCE ----
  //
  // A removal is only a removal if it cannot grow back, and this one has three
  // parts: the calculator, the shape and the words.
  if (fs.existsSync(path.join(REPO, 'src/data/healthScore.js'))) {
    faults.push('src/data/healthScore.js is back');
  }
  const SOURCES = ['src', 'api'];
  const walk = (dir: string): string[] => {
    const out: string[] = [];
    for (const entry of fs.readdirSync(path.join(REPO, dir), { withFileTypes: true })) {
      const at = `${dir}/${entry.name}`;
      if (entry.isDirectory()) out.push(...walk(at));
      else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) out.push(at);
    }
    return out;
  };
  const files = SOURCES.flatMap((d) => walk(d));
  // The words the score itself printed, and the names it was built from. A
  // comment saying where it went is allowed; a line of code is not.
  const BANNED: [RegExp, string][] = [
    [/healthMetrics/, 'the radar metrics'],
    [/toRadarMetrics/, 'the radar mapping'],
    [/computeHealthScore/, 'the score calculator'],
    [/overallScore/, 'the score itself'],
    [/FINANCIAL HEALTH SCORE/i, 'the badge'],
    [/balanceSheetStrength|earningsQuality|cashFlowCoverage|accrualRisk|valuationMoat/, 'a mislabelled radar axis'],
  ];
  for (const file of files) {
    const text = fs.readFileSync(path.join(REPO, file), 'utf8');
    text.split(/\r?\n/).forEach((line, i) => {
      const code = line.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '');
      for (const [pattern, what] of BANNED) {
        if (pattern.test(code)) {
          faults.push(`${file}:${i + 1} still carries ${what}: ${line.trim().slice(0, 70)}`);
        }
      }
    });
  }

  // ---- 3. AND NO THRESHOLD WORDS CAME WITH THE RATIOS --------------------
  //
  // The old `basis` ran the formula and a judgement together in one string —
  // "Current assets ÷ current liabilities. Below 1.0x is a warning; 2.0x is
  // comfortable." Only the first sentence is a fact, and what a reader should
  // make of a current ratio belongs in the Margin notes. So the ratios' own
  // words are scanned for the readings that used to travel with them.
  // SCANNED ON WHAT REACHES THE SCREEN, not on the source text: the module's
  // own header quotes those very words as the thing it removed, and a check
  // that read the file would fail on the explanation.
  const READINGS = /\b(is a warning|comfortable|heavily geared|is thin|is strong|warning sign|full marks)\b/i;
  const filled = computePlainRatios([
    {
      fiscalYear: 2025,
      revenue: 1000,
      operatingIncome: 100,
      netIncome: 80,
      depreciation: 50,
      cash: 200,
      currentAssets: 400,
      currentLiabilities: 200,
      longTermDebt: 300,
      totalAssets: 2000,
      operatingCashFlow: 120,
    },
  ]);
  for (const ratio of filled.ratios) {
    for (const said of [ratio.formula, ratio.reason, ratio.label]) {
      if (said && READINGS.test(String(said))) {
        faults.push(`the ${ratio.key} ratio prints a reading rather than a fact: ${String(said).slice(0, 70)}`);
      }
    }
    if (ratio.value === null) {
      faults.push(`the ${ratio.key} ratio is absent on a filing that reports every figure it needs`);
    }
  }
  // And on a filing with nothing in it, which is where the reasons are and
  // where a threshold word would most easily hide.
  for (const ratio of computePlainRatios([{ fiscalYear: 2025 }]).ratios) {
    if (ratio.value !== null) {
      faults.push(`the ${ratio.key} ratio holds ${ratio.value} on a filing with nothing in it`);
    }
    if (!ratio.reason) {
      faults.push(`the ${ratio.key} ratio has no reason on a filing with nothing in it`);
    } else if (READINGS.test(ratio.reason)) {
      faults.push(`the ${ratio.key} ratio's reason reads as a judgement: ${ratio.reason.slice(0, 70)}`);
    }
  }

  console.log(
    `  ${records} records each carry the five ratios: ${figures} figures and ${absent} absences, every ` +
      'absence with its reason, every figure equal to the filing divided'
  );
  console.log(
    `  the score, its radar and its badge are gone from ${files.length} source files — the calculator, ` +
      'the five mislabelled axes, the `{n}/100` and the words it printed'
  );
  console.log(
    '  and the ratios carry their formula and no reading of it: what a current ratio is worth is a ' +
      'judgement, which belongs in the Margin notes'
  );

  if (faults.length) {
    totalProblems += faults.length;
    console.log(`  PROBLEM: ${faults.length} faults in the five ratios:`);
    faults.slice(0, 20).forEach((f) => console.log(`           ${f}`));
    if (faults.length > 20) console.log(`           ... and ${faults.length - 20} more`);
  }
}


// ---------------------------------------------------------------------------
// NO DISPLAYED RATIO FALLS BACK TO NOUGHT
// ---------------------------------------------------------------------------
//
// `roePct`, `roaPct` and `opMarginPct` were computed with `?? 0`, so a return
// on equity the filing cannot support printed **0.0%** — a claim the company
// reported nil, which is the one thing standing decision 3 forbids
// (`docs/STUDIO_SPEC.md` conflict 6, severity H). Each is null now, with a
// reason, and the screen prints an em dash.
//
// THE HARD PART IS TELLING THE TWO NOUGHTS APART. A company can genuinely have
// an operating margin of nought, and that figure must still print. So the check
// does not look for zeroes — it rebuilds each ratio from the model's own series
// and requires the record to hold a figure exactly where the inputs are there
// and null exactly where they are not.
{
  console.log('\n=== no displayed ratio falls back to nought ===');
  const { buildCompanyFrom } = await import(`file:///${REPO}/src/data/autoCompany.ts`);
  const { defaultDriversFor, buildFullModel } = await import(`file:///${REPO}/src/data/companies.ts`);

  const isNum = (v: any): v is number => typeof v === 'number' && isFinite(v);
  const faults: string[] = [];
  let records = 0;
  let shown = 0;
  let absent = 0;
  let genuineNought = 0;
  let drivenAbsent = '';

  for (const file of fs.readdirSync(PAYLOADS).filter((f) => f.endsWith('.json'))) {
    let payload: any;
    try {
      payload = readPayload(file);
    } catch {
      continue;
    }
    let rec: any;
    try {
      rec = buildCompanyFrom(payload);
    } catch {
      continue;
    }
    const drivers: any = { ...rec.defaultDrivers, ...defaultDriversFor(rec.modelData) };
    let M: any;
    try {
      M = buildFullModel(rec.modelData, drivers).model;
    } catch {
      continue;
    }
    const last = M.nH - 1;
    records++;
    const ticker = payload.ticker || file;

    // The inputs each ratio needs, read from the model the record was built
    // from — so "there is a figure" is decided by the same series the screen's
    // own arithmetic would use, not by whether the record happens to hold one.
    const WANT: [string, number | null][] = [
      ['roePct', isNum(M.ratios?.roe?.[last]) ? M.ratios.roe[last] * 100 : null],
      ['roaPct', isNum(M.ratios?.roa?.[last]) ? M.ratios.roa[last] * 100 : null],
      [
        'opMarginPct',
        isNum(M.ebit?.[last]) && isNum(M.revenue?.[last]) && M.revenue[last] !== 0
          ? (M.ebit[last] / M.revenue[last]) * 100
          : null,
      ],
    ];

    for (const [field, expected] of WANT) {
      const held = rec[field];
      if (expected === null) {
        absent++;
        if (held !== null && held !== undefined) {
          faults.push(
            `${ticker} ${field}: the record holds ${held} and the model has no figure to compute it from` +
              (held === 0 ? ' — a nought standing in for a gap, which is the defect' : '')
          );
        } else if (!rec.ratiosNotShown?.[field]) {
          faults.push(`${ticker} ${field}: absent and with no reason recorded for the reader`);
        }
      } else {
        shown++;
        if (!isNum(held)) {
          faults.push(
            `${ticker} ${field}: the record holds nothing and the model gives ${expected.toFixed(2)}`
          );
          continue;
        }
        // Rounded to one decimal by the record, so the comparison is too.
        if (Math.abs(held - Number(expected.toFixed(1))) > 0.051) {
          faults.push(
            `${ticker} ${field}: the record holds ${held} and the model gives ${expected.toFixed(2)}`
          );
        }
        // AND A GENUINE NOUGHT STILL PRINTS. A company whose operating margin
        // really is nought must show it; counted so that the rule above cannot
        // be satisfied by dropping every zero.
        if (Math.abs(held) < 0.05) genuineNought++;
      }
    }
  }

  // ---- THE ABSENT CASE, DRIVEN, BECAUSE NO COMPANY ON DISK REACHES IT ---
  //
  // Every record in the set computes all three ratios, so the branch that holds
  // null and prints an em dash would ship untested — and so would the defect:
  // `?? 0` was LATENT on this set, which is worth saying plainly rather than
  // claiming a figure moved. It is reached by taking a real payload and
  // removing a line the ratio needs.
  //
  // Only revenue does it. The engine PLUGS the balance sheet from the filed
  // totals, so a payload with its equity or its total assets removed still has
  // both — which is why those two are measured here and not asserted.
  {
    let base: any = null;
    try {
      base = readPayload('AAPL.json');
    } catch {
      base = null;
    }
    if (!base) {
      faults.push('no payload to drive the absent-ratio case with');
    } else {
      const stripped = JSON.parse(JSON.stringify(base));
      for (const row of stripped.statements || []) delete row.revenue;
      let rec: any = null;
      try {
        rec = buildCompanyFrom(stripped);
      } catch (e: any) {
        faults.push(`a payload with no revenue threw rather than reporting an absent ratio: ${e?.message}`);
      }
      if (rec) {
        if (rec.opMarginPct !== null) {
          faults.push(
            `with no revenue filed the operating margin reads ${rec.opMarginPct} — it has nothing to be a ` +
              'margin OF, so it is absent, and a nought here is the defect itself'
          );
        } else if (!rec.ratiosNotShown?.opMarginPct) {
          faults.push('an absent operating margin carries no reason for the reader');
        } else if (!/revenue/i.test(String(rec.ratiosNotShown.opMarginPct))) {
          faults.push(
            `the reason given is "${rec.ratiosNotShown.opMarginPct}" and the missing line is revenue`
          );
        } else {
          drivenAbsent = String(rec.ratiosNotShown.opMarginPct);
        }
      }
    }
  }

  // ---- AND NO FALLBACK SURVIVES IN THE SOURCE -------------------------
  //
  // The arms above hold the records this set produces. This holds the line
  // itself, because the defect was one operator in one expression and it would
  // come back the same way.
  for (const file of ['src/data/autoCompany.ts', 'src/data/companies.ts']) {
    const text = fs.readFileSync(path.join(REPO, file), 'utf8');
    for (const field of ['roePct', 'roaPct', 'opMarginPct']) {
      const line = text.split(/\r?\n/).find((l) => new RegExp(`^\\s*${field}:`).test(l)) || '';
      if (/\?\?\s*0\b/.test(line)) {
        faults.push(`${file}: ${field} still falls back to nought — ${line.trim().slice(0, 80)}`);
      }
    }
  }

  console.log(
    `  ${records} records, ${shown} ratios the model can compute and ${absent} it cannot: every one of ` +
      'the first holds the figure and every one of the second holds null with a reason'
  );
  console.log(
    `  ${genuineNought} of the shown ratios round to nought and still print, which is the figure a company ` +
      'that reported it is owed — the rule is not "drop the zeroes"'
  );
  console.log(
    `  the absent case is driven on a payload with its revenue removed, since no company on disk reaches ` +
      `one: "${drivenAbsent || 'NOT DRIVEN'}"`
  );

  if (faults.length) {
    totalProblems += faults.length;
    console.log(`  PROBLEM: ${faults.length} faults in the displayed ratios:`);
    faults.slice(0, 20).forEach((f) => console.log(`           ${f}`));
    if (faults.length > 20) console.log(`           ... and ${faults.length - 20} more`);
  }
}


// ---------------------------------------------------------------------------
// EVERY SENSITIVITY CELL IS COMPUTED AT THE INPUTS ITS ROW AND COLUMN PRINT
// ---------------------------------------------------------------------------
//
// Two faults, and they were the same fault twice: the grid and its axes were
// not computed from each other.
//
//   THE CELL WAS CLAMPED AND THE AXIS WAS NOT (`docs/STUDIO_SPEC.md` conflict
//   5, severity H). Each cell ran at `Math.max(4, wacc)` and
//   `Math.max(0.5, growth)` while its label printed the unclamped figure, so
//   with terminal growth at 1.0% the 0.0% and 0.5% columns were both computed
//   at 0.5% and printed the same value under two different labels.
//
//   AND THE GRID DISAGREED WITH THE RANGES ON THE SAME PAGE — $111 against
//   $112.90 (`docs/STUDIO_SPEC_ADDENDUM.md` G2). The football field's income
//   range is the row through the base cell of the ENGINE'S grid; the screen
//   drew a second grid of its own, and two computations of one thing disagree
//   the moment either changes.
//
// Three arms, over every payload that values.
{
  console.log('\n=== every sensitivity cell is computed at the inputs it prints ===');
  const { buildCompanyFrom } = await import(`file:///${REPO}/src/data/autoCompany.ts`);
  const { defaultDriversFor, buildFullModel, valuationBandsFor } = await import(
    `file:///${REPO}/src/data/companies.ts`
  );
  const { admissibleInputs } = await import(`file:///${REPO}/src/data/valuationSummary.ts`);

  const isNum = (v: any): v is number => typeof v === 'number' && isFinite(v);
  const faults: string[] = [];
  let companies = 0;
  let cells = 0;
  let notMeaningful = 0;
  let worstCell = 0;
  let worstWhere = '';
  let bandsTied = 0;
  let lowGrowthDriven = '';

  for (const file of fs.readdirSync(PAYLOADS).filter((f) => f.endsWith('.json'))) {
    let payload: any;
    try {
      payload = readPayload(file);
    } catch {
      continue;
    }
    let rec: any;
    try {
      rec = buildCompanyFrom(payload);
    } catch {
      continue;
    }
    const drivers: any = { ...rec.defaultDrivers, ...defaultDriversFor(rec.modelData) };
    let built: any;
    try {
      built = buildFullModel(rec.modelData, drivers);
    } catch {
      continue;
    }
    const D: any = built?.dcf;
    if (!D?.applicable) continue;
    const gridRows: any[] = D.sensitivity?.perpetuity || [];
    const axes = D.sensitivityAxes;
    if (!gridRows.length || !axes?.wacc?.length || !axes?.growth?.length) continue;
    companies++;
    const ticker = payload.ticker || file;

    // ---- 1. EVERY CELL, RECOMPUTED FROM THE AXIS IT PRINTS --------------
    //
    // Not read back from the engine's own grid function: the value is rebuilt
    // here from the series the model publishes — the unlevered cash flows,
    // the discount factors, the normalised flow, net debt, the other claims
    // and the share count — at the wacc and growth THE AXES PRINT. If a cell
    // were computed at a clamped input, this recomputation would not match it,
    // which is what the defect looked like.
    const fcf: number[] = D.unleveredFCF || [];
    const df: number[] = D.discountFactor || [];
    const lastDF = df[df.length - 1];
    const normalised = D.normalisedFCF;
    const netDebt = D.netDebt;
    const claims = D.otherClaims;
    const shares = D.dilutedShares;
    const canRecompute =
      fcf.length === df.length &&
      fcf.length > 0 &&
      isNum(lastDF) &&
      isNum(normalised) &&
      isNum(netDebt) &&
      isNum(claims) &&
      isNum(shares) &&
      shares > 0;

    axes.wacc.forEach((w: number, r: number) => {
      axes.growth.forEach((g: number, c: number) => {
        const shown = gridRows[r]?.[c];
        // A PAIR WITH NO ANSWER. A perpetuity needs the discount rate above
        // the growth rate; at or below it the formula diverges, and what
        // comes back is not a large value but no value. The screen prints
        // `n.m.` there and the axis still prints the pair.
        if (!admissibleInputs(w * 100, g * 100)) {
          notMeaningful++;
          return;
        }
        if (!canRecompute || !isNum(shown)) return;
        const pv = fcf.reduce((sum, f, t) => sum + f / (1 + w) ** df[t], 0);
        const tv = (normalised * (1 + g)) / (w - g);
        const ev = pv + tv / (1 + w) ** lastDF;
        const expected = (ev - netDebt - claims) / shares;
        cells++;
        const gap = Math.abs(shown - expected) / Math.max(1, Math.abs(expected));
        if (gap > 1e-9) {
          faults.push(
            `${ticker} cell [${(w * 100).toFixed(1)}% × ${(g * 100).toFixed(1)}%]: the grid holds ` +
              `${shown.toFixed(4)} and those inputs give ${expected.toFixed(4)}`
          );
        }
        if (gap > worstCell) {
          worstCell = gap;
          worstWhere = `${ticker} at ${(w * 100).toFixed(1)}% × ${(g * 100).toFixed(1)}%`;
        }
      });
    });

    // ---- 2. THE ROW THROUGH THE BASE CELL IS THE RANGE ON THE PAGE ------
    //
    // The football field's income bar is the one-at-a-time range: the base
    // WACC row of this grid, read across. If the screen drew its own grid
    // again, the two would differ — which is G2, measured at $111 against
    // $112.90 on a screenshot.
    const bands: any[] = valuationBandsFor(rec.modelData, drivers, payload?.quote?.price ?? null) as any[];
    const growthBand = bands.find((b) => /perpetuity/i.test(String(b.label)));
    if (growthBand) {
      const middle = Math.floor((axes.wacc.length - 1) / 2);
      const row: number[] = (gridRows[middle] || []).filter((v: any) => isNum(v) && v > 0);
      if (row.length) {
        const low = Math.min(...row);
        const high = Math.max(...row);
        const off = (a: number, b: number) => Math.abs(a - b) / Math.max(1, Math.abs(b));
        if (off(growthBand.low, low) > 1e-9 || off(growthBand.high, high) > 1e-9) {
          faults.push(
            `${ticker}: the income range reads ${growthBand.low.toFixed(2)}–${growthBand.high.toFixed(2)} ` +
              `and the base row of the grid beside it runs ${low.toFixed(2)}–${high.toFixed(2)}`
          );
        } else {
          bandsTied++;
        }
      }
    }
  }

  // ---- THE CLAMP'S OWN CASE, WHICH NO COMPANY ON DISK REACHES EITHER ----
  //
  // The defect was a clamp INSIDE the computation — `Math.max(0.04, wacc)` and
  // `Math.max(0.005, growth)` — while the axis printed the unclamped figure. It
  // only bites where a step falls below the clamp, and every company in the set
  // discounts above 4% with terminal growth above 1.5%, so the lowest step of
  // every real grid is admissible and ABOVE the clamp: the arms above pass
  // whether the clamp is there or not. That is the trap, so the clamp's own
  // case is driven here.
  //
  // THE SPEC'S OWN EXAMPLE: terminal growth at 1.0%, where the grid's steps are
  // 0.0%, 0.5%, 1.0%, 1.5% and 2.0% and the first two would BOTH be computed at
  // 0.5% and printed under two different labels.
  {
    const file = fs.readdirSync(PAYLOADS).find((f) => f.endsWith('.json') && /^AAPL\./.test(f));
    let probe: any = null;
    try {
      probe = file ? readPayload(file) : null;
    } catch {
      probe = null;
    }
    if (!probe) {
      faults.push('no payload to drive the low-growth grid with');
    } else {
      const rec: any = buildCompanyFrom(probe);
      const drivers: any = {
        ...rec.defaultDrivers,
        ...defaultDriversFor(rec.modelData),
        terminalGrowthPct: 1.0,
      };
      let built: any = null;
      try {
        built = buildFullModel(rec.modelData, drivers);
      } catch {
        built = null;
      }
      const D: any = built?.dcf;
      const axes = D?.sensitivityAxes;
      const rows: any[] = D?.sensitivity?.perpetuity || [];
      if (!axes?.growth?.length || !rows.length) {
        faults.push('the low-growth grid could not be built, so the clamp ships untested');
      } else {
        const printed = axes.growth.map((g: number) => Number((g * 100).toFixed(2)));
        // 1. THE AXIS PRINTS THE STEPS IT WAS ASKED FOR, including the one at
        //    nought, rather than a clamped figure.
        if (Math.abs(printed[0]) > 0.001) {
          faults.push(
            `the lowest growth step reads ${printed[0]}% where terminal growth is 1.0% and the step is ` +
              '1.0 point — the axis is printing a clamped figure'
          );
        }
        // 2. AND THE TWO LOWEST COLUMNS HOLD DIFFERENT VALUES. Under the clamp
        //    they were the same figure under two labels, which is the defect
        //    seen from the reader's side.
        const middle = Math.floor((axes.wacc.length - 1) / 2);
        const row: any[] = rows[middle] || [];
        const a = row[0];
        const b = row[1];
        if (!isNum(a) || !isNum(b)) {
          faults.push('the two lowest growth columns hold no value at 1.0% terminal growth');
        } else if (Math.abs(a - b) < 1e-9) {
          faults.push(
            `at 1.0% terminal growth the ${printed[0]}% and ${printed[1]}% columns both read ` +
              `${a.toFixed(4)} — two labels over one computation, which is the clamp`
          );
        } else {
          lowGrowthDriven = `${printed[0]}% reads ${a.toFixed(2)} and ${printed[1]}% reads ${b.toFixed(2)}`;
        }
      }
    }
  }

  // ---- AND THE PAIRS WITH NO ANSWER, WHICH NO COMPANY ON DISK REACHES ---
  //
  // Every company in the set discounts above its own terminal growth, on every
  // step of the grid, so the branch that prints `n.m.` would ship untested on
  // the real data — the trap `CLAUDE.md` lists. So the rule is driven directly,
  // on the pairs a reader can produce by moving the two sliders towards each
  // other, with the answers written out by hand.
  const PAIRS: [number, number, boolean, string][] = [
    [8, 2, true, 'an ordinary pair'],
    [8, 7.5, true, 'growth just below the discount rate, which still has an answer'],
    [8, 8, false, 'growth AT the discount rate: the formula divides by nothing'],
    [8, 8.5, false, 'growth above the discount rate: a value that grows faster than it is discounted'],
    [0, 2, false, 'no discount rate at all'],
    [-2, -5, false, 'a negative discount rate is not a discount rate'],
    [NaN, 2, false, 'no figure for the discount rate'],
    [8, NaN, false, 'no figure for the growth rate'],
  ];
  for (const [w, g, want, why] of PAIRS) {
    const got = admissibleInputs(w, g);
    if (got !== want) {
      faults.push(
        `the pair ${w}% × ${g}% reads ${got ? 'admissible' : 'not meaningful'} and it is ${
          want ? 'admissible' : 'not meaningful'
        }: ${why}`
      );
    }
  }

  // ---- 3. THE SCREEN READS THAT GRID AND DRAWS NO OTHER ----------------
  //
  // The arms above hold the engine. This holds the component, because the
  // defect was a SECOND grid: a `runDCF` per cell with the drivers overridden
  // and clamped. One grid means the screen reads `sensitivity.perpetuity` and
  // its axes, and clamps nothing.
  const dashboard = fs.readFileSync(path.join(REPO, 'src/components/TerminalDashboard.tsx'), 'utf8');
  if (!/sensitivityMatrix: number\[\]\[\] = Array\.isArray\(\(dcfResult as any\)\?\.sensitivity\?\.perpetuity\)/.test(dashboard)) {
    faults.push('the screen no longer reads the engine\'s own sensitivity grid');
  }
  if (/Math\.max\(4,\s*w\)|Math\.max\(0\.5,\s*g\)/.test(dashboard)) {
    faults.push('the screen clamps a sensitivity input again while its axis prints the unclamped figure');
  }
  if (!/const admissible = admissibleInputs;/.test(dashboard)) {
    faults.push(
      'the screen no longer reads the shared admissibility rule, so the grid and the words over it can ' +
        'disagree about which pairs have an answer'
    );
  }

  console.log(
    `  ${cells} cells across ${companies} companies, every one equal to a recomputation at the wacc and ` +
      `growth its own axes print (worst ${worstCell.toExponential(2)}${worstWhere ? `, ${worstWhere}` : ''})`
  );
  console.log(
    `  ${notMeaningful} cells on disk have no answer at the pair they print; the rule is driven on ` +
      `${PAIRS.length} pairs written out by hand, because every company in the set discounts above its own ` +
      'terminal growth on every step of its grid'
  );
  console.log(
    `  and on ${bandsTied} companies the income range printed on the page IS the base row of that grid, ` +
      'read across'
  );
  console.log(
    `  the clamp's own case is driven on a company set to 1.0% terminal growth, where the two lowest ` +
      `columns were one computation under two labels: ${lowGrowthDriven || 'NOT DRIVEN'}`
  );

  if (faults.length) {
    totalProblems += faults.length;
    console.log(`  PROBLEM: ${faults.length} faults in the sensitivity grid:`);
    faults.slice(0, 20).forEach((f) => console.log(`           ${f}`));
    if (faults.length > 20) console.log(`           ... and ${faults.length - 20} more`);
  }
}


// ---------------------------------------------------------------------------
// ONE PRICE PER VALUATION
// ---------------------------------------------------------------------------
//
// THE SHARE PRICE IS A VALUATION INPUT (`CLAUDE.md`): the cost of capital
// weights equity at market capitalisation, so the price moves the WACC and with
// it every value per share. The valuation screen held TWO of them until
// 2026-11-04 — the stored price the record carries and a live quote fetched a
// moment after the page loaded — and used them in different places: the bands,
// the premiums, the reverse DCF and the football field at the live quote, the
// sensitivity shading and the upside figure at the stored one. A premium could
// be measured against a price the value was not computed at, and nothing on the
// screen said which price anything used (`docs/STUDIO_SPEC.md` conflict 4,
// severity H; decision S3, approved 4 November 2026).
//
// Four arms.
{
  console.log('\n=== one price per valuation ===');
  const { valuationSummary, premiumOf } = await import(`file:///${REPO}/src/data/valuationSummary.ts`);
  const { buildCompanyFrom } = await import(`file:///${REPO}/src/data/autoCompany.ts`);
  const { defaultDriversFor } = await import(`file:///${REPO}/src/data/companies.ts`);

  const isNum = (v: any): v is number => typeof v === 'number' && isFinite(v);
  const faults: string[] = [];
  let priced = 0;
  let movedByADay = 0;
  let movedOverAPoint = 0;
  let worstGap = 0;
  let worstWhere = '';

  for (const file of fs.readdirSync(PAYLOADS).filter((f) => f.endsWith('.json'))) {
    let payload: any;
    try {
      payload = readPayload(file);
    } catch {
      continue;
    }
    const stored = payload?.quote?.price;
    if (!isNum(stored) || stored <= 0) continue;
    let rec: any;
    try {
      rec = buildCompanyFrom(payload);
    } catch {
      continue;
    }
    const drivers: any = { ...rec.defaultDrivers, ...defaultDriversFor(rec.modelData) };
    const at = (price: number) => {
      try {
        return valuationSummary(rec.modelData, drivers, price);
      } catch {
        return null;
      }
    };
    const summary: any = at(stored);
    if (!summary) continue;
    const where = `${payload.ticker}`;

    // ---- 1. THE SUMMARY SAYS WHICH PRICE IT USED ----------------------
    if (summary.struckPrice !== stored) {
      faults.push(`${where}: struck at ${stored} and the summary says ${summary.struckPrice}`);
    }

    // ---- 2. EVERY PREMIUM RECONCILES WITH THAT ONE PRICE --------------
    //
    // Recomputed here from the price and the value the summary itself
    // publishes, which is the arithmetic the screen prints beside them — not
    // read back from `premiumOf`, which is the thing under test.
    for (const method of ['perpetuity', 'exit'] as const) {
      const value = summary.terminalMethods[method];
      const shown = summary.premiumAgainst[method];
      if (!isNum(value) || value <= 0) {
        if (shown !== null) {
          faults.push(`${where}: a ${method} premium of ${shown}% against no ${method} value`);
        }
        continue;
      }
      const expected = Number((((stored - value) / value) * 100).toFixed(1));
      if (!isNum(shown) || Math.abs(shown - expected) > 0.051) {
        faults.push(
          `${where}: the ${method} premium reads ${shown}% where the price ${stored} against the value ` +
            `${value.toFixed(2)} is ${expected}%`
        );
      }
    }
    if (isNum(summary.premiumAgainst.perpetuity)) priced++;

    // ---- 3. AND IT IS THE PRICE THAT MOVES THEM -----------------------
    //
    // A premium struck at a different price must BE different, or the screen
    // would be printing a figure that does not depend on the price it names —
    // which is what two prices on one screen looked like from the reader's
    // side. The move used is this company's own last day.
    const move = isNum(payload?.quote?.changePct) ? payload.quote.changePct : 1;
    if (Math.abs(move) > 0.01) {
      const later: any = at(stored * (1 + move / 100));
      const a = summary.premiumAgainst.perpetuity;
      const b = later?.premiumAgainst?.perpetuity;
      if (isNum(a) && isNum(b)) {
        const gap = Math.abs(b - a);
        if (gap > 0.05) movedByADay++;
        if (gap > 1) movedOverAPoint++;
        if (gap > worstGap) {
          worstGap = gap;
          worstWhere = `${where} ${a}% -> ${b}% on a ${move.toFixed(2)}% move`;
        }
        if (gap < 1e-9 && Math.abs(move) > 1) {
          faults.push(
            `${where}: a ${move.toFixed(2)}% move in the price left the premium at ${a}% — a premium that ` +
              'does not move with the price is not measured against it'
          );
        }
      }
    }
  }

  // ---- 4. NOTHING ON THE SCREEN TAKES THE LIVE QUOTE INTO A VALUATION ---
  //
  // The arms above hold the function. This holds the CALL SITES, because the
  // defect was never in the arithmetic — it was in which price was handed to
  // it. `liveQuote` may reach the newer-quote line and the button that asks
  // for it, and nothing else; every valuation call takes `struckPrice`, or
  // `displayPrice`, which is its alias.
  const dashboard = fs.readFileSync(path.join(REPO, 'src/components/TerminalDashboard.tsx'), 'utf8');
  // THE QUOTE'S PRICE, which is the only field of it that is a valuation
  // input. Its change on the day and its 52-week range are the market's own
  // figures and are shown live on purpose; the PRICE is what the cost of
  // capital weighs equity at, so it is the one that may not be read twice.
  const priceRead = /liveQuote\s*\??\.\s*price/g;
  const priceReads = (dashboard.match(priceRead) || []).length;
  const declaration = /const newerQuote =[\s\S]*?: null;/.exec(dashboard)?.[0] || '';
  const inDeclaration = (declaration.match(priceRead) || []).length;
  if (!declaration) {
    faults.push('TerminalDashboard.tsx no longer settles the newer quote in one declaration');
  } else if (priceReads !== inDeclaration) {
    faults.push(
      `TerminalDashboard.tsx reads the live quote's price ${priceReads} times and only ${inDeclaration} of ` +
        'them are inside the newer-quote line — a valuation is taking the live price again'
    );
  }
  // AND THE STRUCK PRICE IS THE RECORD'S UNTIL THE READER ASKS, which is the
  // whole of S3: a live quote that re-priced the model on arrival would be the
  // defect put back with a different variable name.
  if (!/const struckPrice = rebuiltAtPrice \?\? company\.price;/.test(dashboard)) {
    faults.push('the struck price is no longer the record\'s own until the reader rebuilds at the latest');
  }

  console.log(
    `  ${priced} companies price a premium, and every one of them reconciles with the single price it ` +
      'names: (price − value) ÷ value, recomputed here'
  );
  console.log(
    `  the price is what moves it: a day's move changes the premium on ${movedByADay} of them and by more ` +
      `than a point on ${movedOverAPoint}; the worst is ${worstWhere || 'none'}`
  );
  console.log(
    '  and the live quote reaches the line that reports it and the button that asks for it, and nothing else'
  );

  if (faults.length) {
    totalProblems += faults.length;
    console.log(`  PROBLEM: ${faults.length} faults in the price a valuation is struck at:`);
    faults.slice(0, 20).forEach((f) => console.log(`           ${f}`));
    if (faults.length > 20) console.log(`           ... and ${faults.length - 20} more`);
  }
}


// ---------------------------------------------------------------------------
// EVERY COLUMN ADDS UP, FROM REVENUE TO OPERATING INCOME
// ---------------------------------------------------------------------------
//
// Until 2026-11-04 it did not, and said nothing about it. A reader who took the
// printed revenue, subtracted the printed cost of sales, the printed research
// and the printed selling costs, and compared the answer with the printed
// operating income, got a different number on 1,323 of the 1,574 columns that
// print all four — and the difference had no name on the screen. It is an
// impairment, a restructuring charge, a gain on a disposal, other operating
// income: real lines of the company's own statement that this template has no
// row for, because neither free source tags them in a shape that maps to one
// row across 180 companies (`DATA_CONSTRAINTS.md`).
//
// The new row is "Other operating items", derived, and it is the bridge. What
// makes this a check rather than a restatement of the formula is WHICH FIGURE
// THE BRIDGE HAS TO CLOSE ON: operating income is the company's own filed line,
// read from its own XBRL concept, and nothing in the bridge touches it. So
//
//     revenue − cost of sales                                 = gross profit
//     gross profit − research − selling − other items reversed = OPERATING INCOME
//
// is a tie against the filing in every column, exactly as the engine's reported
// operating profit is. A sign error, a dropped input or a row left absent
// breaks it on every company at once.
//
// Four arms:
//
//   1. GROSS PROFIT IS REVENUE LESS COST OF SALES, in every column.
//   2. THE BRIDGE CLOSES ON FILED OPERATING INCOME, in every column of every
//      company, annual and quarterly, trailing twelve months included.
//   3. THE ROW IS THERE WHEREVER THE BRIDGE CAN BE STRUCK. A row that quietly
//      went absent would pass arm 2 by having nothing to check.
//   4. AND THE FIGURE IS NOT A DECORATION: on the columns where the filing
//      needs no bridge the row is nil, and on the others it is the difference,
//      so the count of each is reported rather than assumed.
{
  console.log('\n=== every column adds up from revenue to operating income ===');
  const { financialsFor } = await import(`file:///${REPO}/src/data/financials.ts`);

  const faults: string[] = [];
  const files = fs.readdirSync(PAYLOADS).filter((f) => f.endsWith('.json'));
  let columns = 0;
  let bridged = 0;
  let nil = 0;
  let unbridgeable = 0;
  let namedLineAbsent = 0;
  let worstGap = 0;
  let worstWhere = '';
  const biggest: [number, string][] = [];
  // WHERE THE BRIDGE IS CARRYING SOMETHING WORTH LOOKING AT, which is how it
  // found `KI-39`. The named costs alone exceeding revenue, beside an operating
  // PROFIT, is not impossible: a gain inside operating income that has no row
  // of its own does exactly that, and Boeing's FY2025 business sale is 10.8% of
  // its revenue (`METHODOLOGY.md` §5). But a TOP LINE THAT IS SHORT OF THE
  // FILING'S OWN TOTAL does it too, and that is a defect — Enbridge's revenue
  // is read from a tag that covers part of its revenue. Only the filing tells
  // the two apart, so this is a count and a list rather than a fault, kept
  // because it is where the second kind shows up.
  const topHeavy: [number, string][] = [];

  for (const file of files) {
    let payload: any;
    try {
      payload = JSON.parse(fs.readFileSync(path.join(PAYLOADS, file), 'utf8'));
    } catch {
      continue;
    }
    const ticker = file.replace('.json', '');
    for (const frequency of ['annual', 'quarterly'] as const) {
      let view: any;
      try {
        view = (financialsFor as any)(payload, { statement: 'income', frequency, window: 'all' });
      } catch (e: any) {
        faults.push(`${ticker} ${frequency}: the income statement could not be built (${e?.message})`);
        continue;
      }
      // A BANK HAS NO GROSS PROFIT AND SO NO BRIDGE FROM ONE. That the row is
      // absent from the bank template is asserted by the template check, which
      // holds every forbidden row at once.
      if (view.template !== 'industrial') continue;
      // AND A FREQUENCY THIS COMPANY DOES NOT FILE IS NOT A COLUMN. Screen
      // design 1: a company that files no quarterly income statement is told
      // so and shown no grid, which is a different answer from a grid that
      // does not add up. 13 of the 178 are that case, all of them half-yearly
      // filers outside the United States.
      if (view.empty) continue;
      const rowOf = (key: string) => view.rows.find((r: any) => r.key === key);
      const bridge = rowOf('otherOperatingItems');
      if (!bridge) {
        faults.push(`${ticker} ${frequency}: the industrial income statement has no "other operating items" row`);
        continue;
      }
      const need = ['revenue', 'cogs', 'grossProfit', 'rnd', 'sga', 'operatingIncome'].map(rowOf);
      if (need.some((r) => !r)) {
        faults.push(`${ticker} ${frequency}: the income statement is missing a row the bridge is struck from`);
        continue;
      }
      const [revenue, cogs, grossProfit, rnd, sga, operatingIncome] = need as any[];

      view.periods.forEach((period: any, i: number) => {
        columns++;
        const at = (row: any) => {
          const cell = row.cells[i];
          return cell && typeof cell.value === 'number' && isFinite(cell.value) ? cell.value : null;
        };
        const where = `${ticker} ${period.key} (${frequency})`;
        const rev = at(revenue);
        const cost = at(cogs);
        const gross = at(grossProfit);
        const ebit = at(operatingIncome);

        // ---- 1. GROSS PROFIT IS REVENUE LESS COST OF SALES ----------------
        if (rev !== null && cost !== null) {
          if (gross === null) {
            faults.push(`${where}: revenue and cost of sales are both shown and gross profit is not`);
          } else {
            const gap = Math.abs(gross - (rev - cost));
            if (gap > 1e-6 * Math.max(1, Math.abs(gross))) {
              faults.push(
                `${where}: gross profit ${gross} against revenue ${rev} less cost of sales ${cost} = ${rev - cost}`
              );
            }
          }
        }

        // ---- 3. THE ROW IS THERE WHEREVER THE BRIDGE CAN BE STRUCK --------
        const strikeable = gross !== null && ebit !== null;
        const items = at(bridge);
        if (!strikeable) {
          unbridgeable++;
          // And it must not invent one where there is nothing to strike it
          // from: a figure with no gross profit or no operating income behind
          // it would be a number from nowhere.
          if (items !== null) {
            faults.push(
              `${where}: other operating items is ${items} and ${
                gross === null ? 'gross profit' : 'operating income'
              } is not reported for this column`
            );
          }
          return;
        }
        if (items === null) {
          faults.push(
            `${where}: gross profit ${gross} and operating income ${ebit} are both shown, and the row that ` +
              `bridges them says "${bridge.cells[i]?.state}" — the column does not add up and nothing says why`
          );
          return;
        }
        if (bridge.cells[i].state !== 'derived') {
          faults.push(
            `${where}: other operating items is in the state "${bridge.cells[i].state}" — it is this site's ` +
              'arithmetic over filed figures and must be labelled derived (rule 5)'
          );
        }

        // ---- 2. THE BRIDGE CLOSES ON FILED OPERATING INCOME ---------------
        //
        // A named line the source does not report for this column is not in the
        // subtraction, and its amount is inside the bridge. That is the row's
        // definition and it is said on the row itself.
        const named = (row: any) => {
          const v = at(row);
          if (v === null) namedLineAbsent++;
          return v === null ? 0 : v;
        };
        const rndAt = named(rnd);
        const sgaAt = named(sga);
        const built = gross - rndAt - sgaAt + items;
        const gap = Math.abs(built - ebit) / Math.max(1, Math.abs(ebit));
        if (gap > 1e-9) {
          faults.push(
            `${where}: gross profit ${gross} less research and selling costs plus other operating items ` +
              `${items} comes to ${built}, and the filing's own operating income is ${ebit}`
          );
        }
        if (gap > worstGap) {
          worstGap = gap;
          worstWhere = where;
        }

        // ---- 4. WHAT THE BRIDGE ACTUALLY CARRIES --------------------------
        const namedCosts = (cost as number) + rndAt + sgaAt;
        if (rev !== null && namedCosts > rev && ebit > 0) {
          topHeavy.push([
            (namedCosts - (rev as number)) / (rev as number),
            `${where}: revenue ${rev}, named costs ${namedCosts.toFixed(0)}, operating income ${ebit}`,
          ]);
        }
        if (Math.abs(items) < 1e-9) nil++;
        else {
          bridged++;
          if (rev) biggest.push([Math.abs(items / rev), `${where}: ${items.toFixed(1)} on revenue ${rev}`]);
        }
      });
    }
  }

  biggest.sort((a, b) => b[0] - a[0]);
  console.log(
    `  ${columns} income columns across ${files.length} payloads: ${bridged} need a bridge from gross profit ` +
      `to operating income and carry one, ${nil} need none and show nil, and ${unbridgeable} have no gross ` +
      'profit or no operating income to bridge between'
  );
  console.log(
    `  the worst gap between the column's own arithmetic and the filing's operating income is ${worstGap.toExponential(2)}` +
      (worstWhere ? ` (${worstWhere})` : '')
  );
  console.log(
    `  ${namedLineAbsent} named lines are not reported separately in the column they are missing from, so ` +
      'their amount is inside the bridge, which the row says'
  );
  for (const [, line] of biggest.slice(0, 5)) console.log(`    ${line}`);
  topHeavy.sort((a, b) => b[0] - a[0]);
  console.log(
    `  ${topHeavy.length} columns in ${
      new Set(topHeavy.map(([, line]) => line.split(' ')[0])).size
    } companies carry named costs that exceed revenue beside an operating PROFIT — either a gain inside ` +
      "operating income with no row of its own, or a top line short of the filing's own total (`KI-39`)"
  );
  for (const [over, line] of topHeavy.slice(0, 4)) {
    console.log(`    ${(over * 100).toFixed(0)}% over: ${line}`);
  }

  if (faults.length) {
    totalProblems += faults.length;
    console.log(`  PROBLEM: ${faults.length} columns that do not add up:`);
    faults.slice(0, 20).forEach((f) => console.log(`           ${f}`));
    if (faults.length > 20) console.log(`           ... and ${faults.length - 20} more`);
  }
}


// ---------------------------------------------------------------------------
// A QUARTERLY FIGURE COMES FROM THE STATEMENT IT WAS REPORTED IN (`KI-36`)
// ---------------------------------------------------------------------------
//
// The annual path has taken 10-K facts and nothing else since the beginning.
// The quarterly path filtered facts by PERIOD and not by form at all, and its
// rule that "within one key the most recently filed point wins" — which is
// there so a restatement supersedes what it restated — then let ANY later
// document that happened to tag the same period supersede the 10-Q the figure
// was reported in. A proxy statement does tag financial facts, and a proxy
// filed in April 2026 is more recent than every filing it reports on.
//
// Measured on 2026-11-03, once `KI-37` had made every figure name its own
// document: 126 quarterly figures across 34 companies were cited to a
// `DEF 14A` (82), an `8-K` (41) or a `DEF 14C` (3), 85 of them net income. No
// valuation moved, because the engine reads the annual statements. What was
// wrong was the CITATION: a reader who opened the evidence behind a quarterly
// net income was sent to a proxy statement to find it, and the twenty-odd
// balance sheet figures in that count are reconciled against nothing, so those
// rested on a document nobody chose.
//
// Three arms, because the obvious one cannot fail on its own.
//
//   1. THE FILTER ITSELF, on the shape of facts a proxy produces. Once the
//      data layer stops reading those documents there is no proxy-sourced
//      figure left on disk, so a check that only looked at the payloads would
//      pass whether the filter were there or not — the trap this repository has
//      fallen into five times. `collectPoints` is handed facts written for it,
//      with the expected period, value and document written out by hand rather
//      than read back from the function under test.
//
//   2. THE INVARIANT OVER THE SET: every quarterly figure of every payload is
//      cited to a 10-K, a 10-Q or an amendment of one, that document is in the
//      payload's own dictionary, and it was filed on or after the period it
//      reports — a statement cannot be filed before the period it covers.
//
//   3. WHAT THE RULE ACTUALLY CHANGED, from the capture archive. Every fetch is
//      kept, so the payloads built before this fix are still on disk and the
//      comparison is against real data rather than a fixture: the same company,
//      the same period, the same field, cited to a proxy then and to a
//      statement now. If the archive holds captures from before the fix and NOT
//      ONE figure moved, the rule changed nothing and arm 2 is vacuous, which
//      is itself the fault.
{
  console.log('\n=== a quarterly figure comes from the statement it was reported in ===');
  const { collectPoints } = await import(`file:///${REPO}/api/company.js`);
  const faults: string[] = [];

  // ---- 1. THE FILTER, ON FACTS A PROXY STATEMENT WOULD PRODUCE -----------
  const proxyShapedFacts = {
    'us-gaap': {
      NetIncomeLoss: {
        units: {
          USD: [
            // Q1 as its own quarter, in its own 10-Q — and tagged AGAIN in a
            // proxy filed two years later, which is how the proxy used to win.
            { start: '2024-01-01', end: '2024-03-31', val: 100, form: '10-Q', accn: 'ACCN-10Q', filed: '2024-04-20' },
            { start: '2024-01-01', end: '2024-03-31', val: 111, form: 'DEF 14A', accn: 'ACCN-PROXY', filed: '2026-04-07' },
            // A half year that exists ONLY in the proxy.
            { start: '2024-01-01', end: '2024-06-30', val: 250, form: 'DEF 14A', accn: 'ACCN-PROXY', filed: '2026-04-07' },
            // Nine months that exist only in an earnings release.
            { start: '2024-01-01', end: '2024-09-30', val: 400, form: '8-K', accn: 'ACCN-8K', filed: '2024-10-28' },
            // The year, filed in a 10-K and restated in an amendment of it. An
            // amendment IS a statement and has to win on the filed date, so
            // this holds the restatement rule the form filter runs beside.
            { start: '2024-01-01', end: '2024-12-31', val: 590, form: '10-K', accn: 'ACCN-10K', filed: '2025-02-14' },
            { start: '2024-01-01', end: '2024-12-31', val: 600, form: '10-K/A', accn: 'ACCN-10KA', filed: '2025-06-01' },
            // And a fact whose form the SEC left blank, which cannot be cited
            // to one.
            { start: '2024-10-01', end: '2024-12-31', val: 199, accn: 'ACCN-NONE', filed: '2025-01-05' },
          ],
        },
      },
      Assets: {
        units: {
          USD: [
            // A balance sheet moment in a 10-Q, restated in a proxy.
            { end: '2024-03-31', val: 1000, form: '10-Q', accn: 'ACCN-10Q', filed: '2024-04-20' },
            { end: '2024-03-31', val: 1001, form: 'DEF 14A', accn: 'ACCN-PROXY', filed: '2026-04-07' },
            // And one that is only ever in the proxy.
            { end: '2024-06-30', val: 1002, form: 'DEF 14A', accn: 'ACCN-PROXY', filed: '2026-04-07' },
          ],
        },
      },
    },
  };

  // WRITTEN OUT BY HAND: the period, the figure, and the document each one has
  // to come from. Not read back from `collectPoints`, which is under test.
  const wantFlows: [string, number, string][] = [
    ['2024-01-01|2024-03-31', 100, 'ACCN-10Q'],
    ['2024-01-01|2024-12-31', 600, 'ACCN-10KA'],
  ];
  const wantStocks: [string, number, string][] = [['2024-03-31', 1000, 'ACCN-10Q']];

  const income = collectPoints(proxyShapedFacts, ['NetIncomeLoss']);
  const assets = collectPoints(proxyShapedFacts, ['Assets']);

  const heldAt = (label: string, map: Map<string, any>, want: [string, number, string][]) => {
    for (const [key, val, accn] of want) {
      const point = map.get(key);
      if (!point) {
        faults.push(`${label} ${key}: nothing at all, and a statement reports it`);
        continue;
      }
      if (point.val !== val) {
        faults.push(`${label} ${key}: ${point.val}, and the statement says ${val}`);
      }
      if (point.accn !== accn) {
        faults.push(
          `${label} ${key}: read from ${point.accn} (${point.form || 'no form'}), and the statement ` +
            `that reports it is ${accn}`
        );
      }
    }
    for (const key of [...map.keys()].filter((k) => !want.some(([w]) => w === k))) {
      faults.push(
        `${label} ${key}: a period read from ${map.get(key).form || 'a fact with no form at all'}, ` +
          'which is not a document a statement is filed on'
      );
    }
  };
  heldAt('a period ending', income.flows, wantFlows);
  heldAt('a balance at', assets.stocks, wantStocks);
  if (income.stocks.size || assets.flows.size) {
    faults.push('a flow was collected as a balance, or a balance as a flow');
  }
  console.log(
    `  the filter: of 7 income points and 3 balance points, ${income.flows.size} periods and ` +
      `${assets.stocks.size} moments survive — the 10-Q over the proxy that restated it, the 10-K/A ` +
      'over the 10-K it amends, and nothing for the periods only a proxy or an 8-K tagged'
  );

  // ---- 2. EVERY QUARTERLY FIGURE OF EVERY PAYLOAD -------------------------
  const STATEMENT = /^10-[KQ]/;
  let figures = 0;
  let withDoc = 0;
  const formTally: Record<string, number> = {};
  const files = fs.readdirSync(PAYLOADS).filter((f) => f.endsWith('.json'));
  const payloads: Record<string, any> = {};
  for (const file of files) {
    let payload: any;
    try {
      payload = JSON.parse(fs.readFileSync(path.join(PAYLOADS, file), 'utf8'));
    } catch {
      continue;
    }
    payloads[file.replace('.json', '')] = payload;
    if (!Array.isArray(payload.quarters)) continue;
    const dictionary = payload.filings || {};
    for (const quarter of payload.quarters) {
      for (const [field, ev] of Object.entries(quarter.evidence || {}) as [string, any][]) {
        figures++;
        const where = `${payload.ticker} ${quarter.fiscalYear} ${quarter.fiscalPeriod} ${field}`;
        if (!ev?.accn) continue;
        withDoc++;
        const doc = dictionary[ev.accn];
        if (!doc) {
          faults.push(`${where}: filing ${ev.accn}, which is not in the payload's own dictionary`);
          continue;
        }
        formTally[doc.form] = (formTally[doc.form] || 0) + 1;
        if (!STATEMENT.test(String(doc.form || ''))) {
          faults.push(
            `${where}: cited to ${ev.accn}, a "${doc.form}" — a quarterly figure comes from the 10-Q ` +
              'it was reported in, or the 10-K for the last quarter of a year, and from nothing else'
          );
        }
        // AND A STATEMENT CANNOT BE FILED BEFORE THE PERIOD IT REPORTS. The
        // same fault from the other side: a document dated before the quarter
        // it is cited for is not reporting that quarter.
        if (doc.filed && doc.filed < quarter.periodEnd) {
          faults.push(
            `${where}: cited to ${ev.accn}, filed ${doc.filed}, which is before the period ending ` +
              `${quarter.periodEnd} it is given as the source of`
          );
        }
      }
    }
  }
  console.log(
    `  ${figures} quarterly figures across ${files.length} payloads, ${withDoc} of them citing a ` +
      `document: ${
        Object.entries(formTally)
          .sort((a, b) => b[1] - a[1])
          .map(([f, n]) => `${f} x${n}`)
          .join(', ') || 'none'
      }`
  );

  // ---- 3. WHAT IT CHANGED, AGAINST THE ARCHIVE ---------------------------
  //
  // Only (company, period, field) triples present in both are compared, and
  // only where the OLD citation was not a statement, so a figure that moved
  // because the data is two days newer is not credited to this rule.
  let movedSource = 0;
  let movedValue = 0;
  let lost = 0;
  const examples: string[] = [];
  const archived: string[] = [];
  for (const [ticker, now] of Object.entries(payloads)) {
    const dir = path.join(PAYLOADS, 'versions', ticker);
    if (!fs.existsSync(dir)) continue;
    let old: any = null;
    for (const capture of fs.readdirSync(dir).sort().reverse()) {
      let held: any;
      try {
        held = JSON.parse(fs.readFileSync(path.join(dir, capture), 'utf8'));
      } catch {
        continue;
      }
      if (held?.error || !Array.isArray(held?.quarters) || !held?.filings) continue;
      if ((held.fetcherVersion || 0) < 13) {
        old = held;
        break;
      }
    }
    if (!old) continue;
    archived.push(ticker);
    const key = (q: any) => `${q.fiscalYear}|${q.fiscalPeriod}|${q.months}`;
    const nowBy = new Map<string, any>((now.quarters || []).map((q: any) => [key(q), q]));
    for (const wasQuarter of old.quarters) {
      for (const [field, ev] of Object.entries(wasQuarter.evidence || {}) as [string, any][]) {
        const wasDoc = ev?.accn ? old.filings?.[ev.accn] : null;
        if (!wasDoc || STATEMENT.test(String(wasDoc.form || ''))) continue;
        const isQuarter = nowBy.get(key(wasQuarter));
        const isEv = isQuarter?.evidence?.[field];
        const isDoc = isEv?.accn ? now.filings?.[isEv.accn] : null;
        if (!isEv) {
          lost++;
          examples.push(
            `${ticker} ${key(wasQuarter)} ${field}: ${wasQuarter.values[field]} from a ${wasDoc.form}, ` +
              'and no statement reports it — the figure is gone rather than wrong'
          );
          continue;
        }
        // AND IT MOVED TO A STATEMENT. A figure still cited to a proxy has not
        // moved anywhere; arm 2 reports that as the fault it is, and counting
        // it here as a move would let this arm's own guard pass on it.
        if (!isDoc || !STATEMENT.test(String(isDoc.form || ''))) continue;
        movedSource++;
        if (isQuarter.values[field] !== wasQuarter.values[field]) {
          movedValue++;
          examples.push(
            `${ticker} ${key(wasQuarter)} ${field}: ${wasQuarter.values[field]} in a ${wasDoc.form} ` +
              `and ${isQuarter.values[field]} in the ${isDoc?.form} that reports it`
          );
        } else if (examples.length < 6) {
          examples.push(
            `${ticker} ${key(wasQuarter)} ${field}: ${wasDoc.form} ${ev.accn} -> ${isDoc?.form} ` +
              `${isEv.accn}, and the figure is ${wasQuarter.values[field]} either way`
          );
        }
      }
    }
  }
  if (archived.length && !movedSource && !lost) {
    faults.push(
      `${archived.length} payloads have a capture from before this fix and not one figure changed the ` +
        'document it is cited to, so the arm above is asserting nothing'
    );
  }
  console.log(
    archived.length
      ? `  against ${archived.length} captures from before the fix: ${movedSource} figures now cite ` +
          `the statement instead of a proxy or an earnings release, ${movedValue} of them changing ` +
          `value, and ${lost} figures that no statement reports at all`
      : '  no captures from before the fix are on disk, so what it changed cannot be measured here'
  );
  for (const line of examples.slice(0, 6)) console.log(`    ${line}`);

  if (faults.length) {
    totalProblems += faults.length;
    console.log(`  PROBLEM: ${faults.length} faults in where a quarterly figure comes from:`);
    faults.slice(0, 20).forEach((f) => console.log(`           ${f}`));
    if (faults.length > 20) console.log(`           ... and ${faults.length - 20} more`);
  }
}


// ---------------------------------------------------------------------------
// THE REPORTING CURRENCY IS THE ONE THE MAIN STATEMENTS ARE PRESENTED IN
// ---------------------------------------------------------------------------
//
// Until 2026-11-03 it was read off EVERY monetary tag the facts carried, and a
// single stray unit left it unestablished and the company refused. A US filer
// with a euro bond tags that bond in euros; a Canadian subsidiary's balances
// are tagged in Canadian dollars. Those are facts in the filing and they are
// not the currency the statements are presented in. PepsiCo (EUR beside USD),
// Enbridge and Welltower (CAD beside USD) were refused a valuation by that.
//
// WORSE THAN THE REFUSAL: the unit a figure was READ IN was
// `Object.keys(entry.units)[0]` — whichever currency came first in the JSON —
// so where a stray unit came first the figure itself was read in it and divided
// into millions as though it were the reporting currency.
//
// It is now the currency of the MAIN STATEMENT TOTALS: revenue, total assets
// and net income. The income statement, the balance sheet, and the line that
// ties them — the primary statements in miniature. Every other figure is then
// read in that currency and in no other.
//
// Five rules, applied by one function so that the fault put back on purpose at
// the end is held to exactly the same ones:
//
//   1. ONE CURRENCY, AND EVERY FIGURE TAKEN IN IT. `statementCurrencies` is the
//      set of units a figure was actually taken in, and it must be exactly the
//      reporting currency — if any figure were ever read in a second currency
//      that set would hold two.
//
//   2. A STRAY CURRENCY IN THE FILING DOES NOT CHANGE THE ANSWER, and the set
//      must actually contain companies that exercise it, or the rule ships
//      untested and this check cannot fail.
//
//   3. THE THREE THE BRIEF NAMED, AGAINST THEIR OWN FILINGS. Enbridge presents
//      in Canadian dollars; PepsiCo and Welltower in US dollars. Written here
//      from the filings, so the expected answer does not come from the code
//      that produces it.
//
//   4. A REFUSAL NAMES THE DISAGREEMENT. Where the main totals genuinely differ
//      the currency is null AND the evidence says which line and which year
//      said what, so the refusal can be read rather than guessed at.
//
//   5. NOTHING FALLS BACK TO DOLLARS. What the payload shows must be the
//      currency that was established, not a default standing in for one.
{
  console.log('\n=== the reporting currency is the main statements’ own ===');

  const faults: string[] = [];
  const files = fs.readdirSync(PAYLOADS).filter((f) => f.endsWith('.json'));

  // READ FROM THE FILINGS, NOT FROM THE CODE.
  const FROM_THE_FILING: Record<string, string> = { ENB: 'CAD', PEP: 'USD', WELL: 'USD' };

  let secFilers = 0;
  let established = 0;
  let withStray = 0;
  let unestablished = 0;
  const strays: string[] = [];
  const currencies: Record<string, number> = {};

  /** The five rules, over one payload. Returns what is wrong with it. */
  const inspect = (ticker: string, payload: any): string[] => {
    const bad: string[] = [];
    const ev = payload?.currencyEvidence || {};
    const reporting = ev.reportingCurrency ?? null;
    const taken: string[] = Array.isArray(ev.statementCurrencies) ? ev.statementCurrencies : [];
    const main: string[] = Array.isArray(ev.mainTotalCurrencies) ? ev.mainTotalCurrencies : [];
    const other: string[] = Array.isArray(ev.otherCurrenciesInFiling) ? ev.otherCurrenciesInFiling : [];

    if (!Array.isArray(ev.mainTotals) || ev.mainTotals.join(',') !== 'revenue,totalAssets,netIncome') {
      bad.push(
        `${ticker}: the currency was settled on ${JSON.stringify(ev.mainTotals)} rather than on the ` +
          'main statement totals'
      );
    }

    if (reporting) {
      if (main.length !== 1 || main[0] !== reporting) {
        bad.push(
          `${ticker}: reports in ${reporting} and its main totals are filed in ${
            main.join(' and ') || 'nothing'
          }`
        );
      }
      if (taken.length !== 1 || taken[0] !== reporting) {
        bad.push(
          `${ticker}: reports in ${reporting} and its figures were taken in ${
            taken.join(' and ') || 'nothing'
          } -- a statement in two currencies is not a statement`
        );
      }
      if (other.includes(reporting)) {
        bad.push(`${ticker}: ${reporting} is listed both as the reporting currency and as another one`);
      }
    } else {
      const said: string[] = Array.isArray(ev.mainTotalsDisagree) ? ev.mainTotalsDisagree : [];
      if (main.length < 2) {
        bad.push(
          `${ticker}: no reporting currency, and its main totals are filed in ${
            main.join(' and ') || 'nothing at all'
          } -- which is not a disagreement`
        );
      }
      if (!said.length) {
        bad.push(
          `${ticker}: no reporting currency and nothing saying which line and which year disagreed, so ` +
            'the refusal cannot be read'
        );
      }
    }

    if (reporting && payload.currency !== reporting) {
      bad.push(`${ticker}: shows its figures in ${payload.currency} and reports in ${reporting}`);
    }
    if (!reporting && payload.currency) {
      bad.push(
        `${ticker}: no reporting currency could be established and the payload shows ` +
          `${payload.currency} anyway, which is a default standing in for an answer`
      );
    }

    if (FROM_THE_FILING[ticker] && reporting !== FROM_THE_FILING[ticker]) {
      bad.push(
        `${ticker}: its 10-K is presented in ${FROM_THE_FILING[ticker]} and this payload says ` +
          `${reporting ?? 'nothing'}`
      );
    }
    return bad;
  };

  for (const file of files) {
    let payload: any;
    try {
      payload = JSON.parse(fs.readFileSync(path.join(PAYLOADS, file), 'utf8'));
    } catch {
      continue;
    }
    const ticker = file.replace('.json', '');
    if (!/sec/i.test(String(payload?.source || ''))) continue;
    if (!Array.isArray(payload?.statements) || !payload.statements.length) continue;
    secFilers++;
    faults.push(...inspect(ticker, payload));

    const ev = payload?.currencyEvidence || {};
    const reporting = ev.reportingCurrency ?? null;
    const other: string[] = Array.isArray(ev.otherCurrenciesInFiling) ? ev.otherCurrenciesInFiling : [];
    if (reporting) {
      established++;
      currencies[reporting] = (currencies[reporting] || 0) + 1;
      if (other.length) {
        withStray++;
        if (strays.length < 6) strays.push(`${ticker} ${reporting} beside ${other.join(' and ')}`);
      }
    } else {
      unestablished++;
    }
  }

  for (const ticker of Object.keys(FROM_THE_FILING)) {
    if (!fs.existsSync(path.join(PAYLOADS, `${ticker}.json`))) {
      faults.push(`${ticker}.json is not on disk, so the currency read at its filing was not checked`);
    }
  }

  // ---- THE RULE MUST BE EXERCISED --------------------------------------
  //
  // A check that only ever saw filers with one currency in their facts would
  // pass with the old rule still in place. The whole point is the filer whose
  // facts carry two, so the set has to contain some and this says how many.
  if (secFilers && withStray < 3) {
    faults.push(
      `only ${withStray} SEC filers in the set carry a currency their statements are not presented in, ` +
        'so the rule that ignores one is barely exercised -- PepsiCo, Enbridge and Welltower are the ' +
        'companies it was written for and at least those three should be here'
    );
  }

  // ---- THE FAULT PUT BACK ON PURPOSE ----------------------------------
  //
  // CONSTRUCTED, because the fix leaves nothing on disk to find. PepsiCo's
  // payload as the old rule left it — every monetary tag voting, so the euro
  // bond and the Canadian balances outvoted nothing and simply left three
  // currencies on the record, no reporting currency, and `currency` falling
  // back to dollars. Rules 4 and 5 are otherwise unreachable on this set,
  // which is exactly the kind of arm that ships untested.
  {
    const full = path.join(PAYLOADS, 'PEP.json');
    if (!fs.existsSync(full)) {
      faults.push('PEP.json is not on disk, so the old currency rule could not be put back');
    } else {
      const asWas = JSON.parse(fs.readFileSync(full, 'utf8'));
      const other = asWas.currencyEvidence?.otherCurrenciesInFiling || [];
      if (!other.length) {
        faults.push(
          'PepsiCo no longer files anything in a currency its statements are not presented in, so the ' +
            'old rule could not be put back -- check what moved before trusting this'
        );
      } else {
        asWas.currencyEvidence = {
          reportingCurrency: null,
          reportingCurrencySource: 'the units the SEC XBRL facts are filed in',
          statementCurrencies: ['USD', ...other].sort(),
          mainTotals: ['revenue', 'totalAssets', 'netIncome'],
          mainTotalCurrencies: ['USD', ...other].sort(),
        };
        asWas.currency = 'USD';
        // The REAL ticker, because one of the three arms looks the company up
        // by name against the currency its own filing is presented in, and a
        // decorated label would quietly skip it.
        const reported = inspect('PEP', asWas);
        const sawRefusal = reported.some((f) => /which line and which year disagreed/.test(f));
        const sawFallback = reported.some((f) => /default standing in for an answer/.test(f));
        const sawFiling = reported.some((f) => /presented in USD and this payload says nothing/.test(f));
        if (!sawRefusal || !sawFallback || !sawFiling) {
          faults.push(
            `with the old rule put back, PepsiCo is reported ${reported.length} ways and the three that ` +
              `matter are missing: unreadable refusal ${sawRefusal}, dollar fallback ${sawFallback}, ` +
              `filing disagreement ${sawFiling}`
          );
        }
      }
    }
  }

  if (faults.length) {
    totalProblems += faults.length;
    console.log(`  PROBLEM: ${faults.length} faults in the reporting currency:`);
    faults.slice(0, 20).forEach((f) => console.log(`           ${f}`));
    if (faults.length > 20) console.log(`           ... and ${faults.length - 20} more`);
  } else {
    console.log(
      `  ${established} of ${secFilers} SEC filers settle their reporting currency on revenue, total ` +
        `assets and net income (${Object.entries(currencies)
          .sort((a, b) => b[1] - a[1])
          .map(([c, n]) => `${c} x${n}`)
          .join(', ')}), and every figure in each was taken in that one currency`
    );
    console.log(
      `  ${withStray} of them file something in a currency their statements are not presented in, and ` +
        `it changes nothing: ${strays.join('; ')}`
    );
    console.log(
      `  ${unestablished} have main totals that genuinely disagree; Enbridge reads CAD and PepsiCo and ` +
        'Welltower USD, as their own filings present them, and PepsiCo under the old rule is reported ' +
        'by the three arms this set does not otherwise reach'
    );
  }
}


console.log(`\nTOTAL PROBLEMS ACROSS SCENARIOS AND SWEEP: ${totalProblems}`);

if (compareTag) {
  const old = JSON.parse(fs.readFileSync(path.join(OUT, `values-${compareTag}.json`), 'utf8'));
  for (const sc of scenarios.slice(0, 4)) {
    let cells = 0, diff = 0; const ex: string[] = [];
    for (const [k, vals] of Object.entries(saved[sc.name])) {
      const o = old[sc.name]?.[k];
      if (!o) continue;
      vals.forEach((v, i) => {
        if (i >= nH) return; // reported years must not move; forecasts are meant to
        cells++;
        const same = typeof v === 'number' && typeof o[i] === 'number' ? Math.abs(v - o[i]) <= 1e-5 + 1e-9 * Math.abs(v) : JSON.stringify(v) === JSON.stringify(o[i]);
        if (!same) { diff++; if (ex.length < 8) ex.push(`${k} ${FY(i)}: ${o[i]} -> ${v}`); }
      });
    }
    const onlyNew = Object.keys(saved[sc.name]).filter((k) => !old[sc.name]?.[k]);
    console.log(`compare REPORTED YEARS ${sc.name}: ${cells} cells matched by label, ${diff} differ; rows only in new: ${onlyNew.filter((k) => !k.startsWith('DCFModel|With') && !k.startsWith('DCFModel|computes')).join('; ') || 'none'}`);
    ex.forEach((e) => console.log(`   ${e}`));
  }
}
