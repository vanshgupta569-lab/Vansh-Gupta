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

// Everything resolves from this file's own location, so the suite runs from a
// fresh checkout with no configuration.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..').split(path.sep).join('/');
const OUT = path.join(HERE, 'out');
const PAYLOADS = path.join(HERE, 'payloads');
fs.mkdirSync(OUT, { recursive: true });
const ExcelJS = createRequire(`${REPO}/package.json`)('exceljs');
const { buildWorkbook } = await import(`file:///${REPO}/src/data/excelExport.ts`);
const { enableIterativeCalculation } = await import(`file:///${REPO}/src/data/excelIterativeCalc.ts`);
const AAPL = (await import(`file:///${REPO}/src/data/AAPL.js`)).default;
const { buildModel, buildDCF } = await import(`file:///${REPO}/src/engine/model.js`);
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
  ? (await import(`file:///${REPO}/src/data/autoCompany.ts`)).buildCompanyFrom(JSON.parse(fs.readFileSync(path.join(PAYLOADS, `${CO}.json`), 'utf8'))).modelData
  : AAPL;
const M = buildModel(SRC);
const D = buildDCF(M, SRC);
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
const need = (what: string, after = -1, sheet = MODEL) => {
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
  depPct: need('Depreciation as % of capital expenditure'),
  pik: need('PIK interest accrued to the balance'),
  debtBop: need('Beginning of period', borrow),
  debtEnd: need('End of period', borrow),
  minCash: need('Minimum cash balance'),
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
  {
    const dRow = (label: string) => g.DCFModel.findIndex((r) => r[2] === label);
    const ser = (label: string) => Array.from({ length: nT - nH }, (_, t) => num('DCFModel', dRow(label), FIRST + t));
    const one = (label: string) => num('DCFModel', dRow(label), FIRST);
    const ebit = ser('EBIT'), tax = ser('Tax rate'), da = ser('Plus: depreciation & amortization'), sbc = ser('Plus: stock based compensation');
    const wcs = ser('Movements in working capital'), capex = ser('Less: capital expenditure'), period = ser('Discount period, years from the valuation date');
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
