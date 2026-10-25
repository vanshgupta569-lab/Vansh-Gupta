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
    measure(`PAPER.${token}`, T.PAPER[token], 'PAPER.ground', T.PAPER.ground);

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

  const counted = T.TEXT_ON_DARK.length * T.DARK_GROUNDS.length + T.TEXT_ON_PAPER.length;
  console.log(
    `  ${counted} token-and-ground pairs measured, ${Object.keys(T.CSS_VARIABLES).length} custom properties compared ` +
      `against src/index.css -- ${bad ? bad + ' PROBLEMS' : `all clear ${T.CONTRAST_FLOOR}:1, worst ${worst.ratio.toFixed(2)}:1 (${worst.what})`}`
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
  console.log('\n=== the rupee rate: the OECD first, FRED behind it ===');
  const { fetchRiskFreeRate } = await import(`file:///${REPO}/api/company.js`);

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
    globalThis.fetch = stub(MONTHS, MONTHS) as any;
    fromOecd = await fetchRiskFreeRate('INR', '2026-03-31');
    const askedFredAnyway = asked.fred;

    asked.oecd = 0;
    asked.fred = 0;
    globalThis.fetch = stub(null, MONTHS) as any;
    fromFred = await fetchRiskFreeRate('INR', '2026-03-31');

    globalThis.fetch = stub(MONTHS.slice(0, 3), MONTHS) as any;
    fromShort = await fetchRiskFreeRate('INR', '2026-03-31');

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
