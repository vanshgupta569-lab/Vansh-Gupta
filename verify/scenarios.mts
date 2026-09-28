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

// ---- the loading-screen notes hold together --------------------------------
//
// A content file, so most of what matters about it cannot be checked by a
// machine — whether a note states mechanics rather than merit is a reading, not
// a test. Three things can be: that no entry is missing a field a reader would
// be shown, that no key is duplicated (React would then reuse one note's DOM for
// another), and that the ordering rule the `group` field exists for actually
// holds. The last is the one worth having: it is a greedy rule over a shuffle,
// so it is exercised over many shuffles rather than reasoned about.
{
  console.log('\n=== the loading-screen notes ===');
  const { DID_YOU_KNOW, noteOrder } = await import(`file:///${REPO}/src/data/didYouKnow.ts`);
  let bad = 0;
  const GROUPS = ['income', 'balance', 'cash', 'valuation', 'reading'];

  const seen = new Set<string>();
  for (const n of DID_YOU_KNOW as any[]) {
    for (const field of ['key', 'group', 'belief', 'fact', 'why']) {
      if (typeof n[field] !== 'string' || !n[field].trim()) {
        bad++;
        console.log(`  PROBLEM: ${n.key ?? '(no key)'} has no ${field}`);
      }
    }
    if (!GROUPS.includes(n.group)) { bad++; console.log(`  PROBLEM: ${n.key} is in an unknown group "${n.group}"`); }
    if (seen.has(n.key)) { bad++; console.log(`  PROBLEM: the key "${n.key}" appears twice`); }
    seen.add(n.key);
  }

  // Every note must be shown once per pass, and no group three times running
  // until the remainder leaves no choice. The tail of a fifty-three-note order
  // can; the first twenty, which is over two minutes of waiting, must not.
  const SHUFFLES = 400;
  const HEAD = 20;
  let runs = 0;
  let incomplete = 0;
  for (let s = 0; s < SHUFFLES; s++) {
    const order: any[] = noteOrder();
    if (order.length !== DID_YOU_KNOW.length || new Set(order.map((n) => n.key)).size !== order.length) incomplete++;
    for (let i = 2; i < Math.min(HEAD, order.length); i++) {
      if (order[i].group === order[i - 1].group && order[i].group === order[i - 2].group) runs++;
    }
  }
  if (incomplete) { bad += incomplete; console.log(`  PROBLEM: ${incomplete} of ${SHUFFLES} orders drop or repeat a note`); }
  if (runs) { bad += runs; console.log(`  PROBLEM: ${runs} runs of three from one group inside the first ${HEAD} notes`); }

  const byGroup = GROUPS.map((g) => `${g} ${(DID_YOU_KNOW as any[]).filter((n) => n.group === g).length}`).join(', ');
  console.log(
    `  ${DID_YOU_KNOW.length} notes (${byGroup}); ${SHUFFLES} shuffles checked -- ` +
      `${bad ? bad + ' PROBLEMS' : 'each shown once, never three from one group in the first ' + HEAD}`
  );
  totalProblems += bad;
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
