// FILE: src/data/excelSheets.ts
//
// Marginalia — Excel export: Ratios, Checks and Sources sheets
//
// These three sheets READ the model built in excelExport.ts; nothing here
// rebuilds it. Every figure on Ratios and Checks is a live cross-sheet
// formula pointing at '3-StatementModel' (row numbers come from the row
// registry `R` that sheet already built), so moving an assumption there
// moves these sheets too. The Sources sheet is the one exception, by
// design: it echoes what the filing said, untouched, so it is written as
// hard values rather than formulas.
//
// The model sheet's name starts with a digit and contains a hyphen, so
// every cross-sheet reference below quotes it: '3-StatementModel'!E10.
//
// THREE THINGS THAT WILL CATCH YOU OUT (kept here so the next edit doesn't
// relearn them the hard way):
//
//  - Costs are stored as NEGATIVE numbers on the model sheet (cost of
//    sales, R&D, SG&A, interest expense, depreciation...). A ratio that
//    doesn't already account for that sign comes out backwards.
//  - The reported years are hard-coded from the filings and the first of
//    them has no opening balance. A roll-forward check (end = beginning +
//    movement) run across reported years fails on all of them, not just
//    the first, so it starts at the first FORECAST year instead.
//  - The summary cell below tests the VALUE of each check cell, never the
//    "OK" / "Error" text — that text comes from a number format applied to
//    a number, so a COUNTIF for the word "Error" matches nothing.

import ExcelJS from 'exceljs';

type Sheet = ExcelJS.Worksheet;

const isNum = (v: any): v is number => typeof v === 'number' && isFinite(v);

// A check cell shows "OK" when the difference is exactly zero and "Error"
// for any other number, whichever side of zero it falls on. Unlike CHECK in
// excelExport.ts (which prints the numeric difference so a modeller can see
// how far off it is), these cells exist purely to be scanned for the word
// "Error", so the format collapses straight to that word.
const CHECK_OK_ERROR = '"Error";"Error";"OK"';
const DAYS_FMT = '#,##0.0';

export interface SupportingSheetsContext {
  R: Record<string, number>;
  modelSheetName: string;
  years: number[];
  nH: number;
  nT: number;
  FIRST: number;
  cOf: (i: number) => number;
  L: (index: number) => string;
  lastCol: number;
  companyName: string;
  source: any;
  newSheet: (name: string, tab: string, freeze?: boolean) => Sheet;
  title: (ws: Sheet, a: string, b: string) => void;
  band: (ws: Sheet, row: number, text: string, fill: string, colour: string, endCol: number) => void;
  label: (ws: Sheet, row: number, name: string, unit: string, o?: any) => void;
  styleHard: (cell: ExcelJS.Cell, fmt: string, o?: any) => void;
  styleCalc: (cell: ExcelJS.Cell, fmt: string, o?: any) => void;
  fmt: { PCT1: string; MULT: string; money: (symbol?: string) => string; money2: (symbol?: string) => string };
  colors: { OXBLOOD: string; WHITE: string; BLACK: string; BLUE: string; GREY: string };
  FONT: { name: string; size: number };
}

/**
 * Standard year header, identical to the one on 3-StatementModel. Defaults to
 * the model's own years; Sources passes the filing's years instead.
 */
function yearHeader(
  ctx: SupportingSheetsContext,
  ws: Sheet,
  labels: string[] = ctx.years.map((y) => `FY${String(y).slice(2)}`),
  nReported: number = ctx.nH,
  rowLabel = 'Year'
) {
  const { FIRST, cOf, FONT, colors } = ctx;
  ws.getCell(5, FIRST).value = 'Reported';
  ws.getCell(5, FIRST).font = { ...FONT, italic: true, color: { argb: colors.GREY } };
  if (nReported < labels.length) {
    ws.getCell(5, FIRST + nReported).value = 'Forecast';
    ws.getCell(5, FIRST + nReported).font = { ...FONT, italic: true, color: { argb: colors.GREY } };
  }
  ws.getCell(6, 3).value = rowLabel;
  ws.getCell(6, 3).font = { ...FONT, bold: true };
  labels.forEach((text, i) => {
    const cell = ws.getCell(6, cOf(i));
    cell.value = text;
    cell.font = { ...FONT, bold: true };
    cell.alignment = { horizontal: 'right' };
    cell.border = { bottom: { style: 'thin', color: { argb: colors.BLACK } } };
  });
}

// =============================================================================
// RATIOS
// =============================================================================

function buildRatiosSheet(ctx: SupportingSheetsContext) {
  const { R, nT, FIRST, cOf, L, lastCol, companyName, newSheet, title, band, label, styleCalc, fmt, colors } = ctx;
  const MS = `'${ctx.modelSheetName}'`;
  const ref = (rowKey: string, i: number) => `${MS}!${L(cOf(i))}${R[rowKey]}`;
  const prv = (rowKey: string, i: number) => `${MS}!${L(cOf(i) - 1)}${R[rowKey]}`;

  const ws = newSheet('Ratios', colors.OXBLOOD);
  title(
    ws,
    `${companyName} - ratios`,
    'Every figure here is a formula reading the 3-statement model. Move an assumption there and these move with it.'
  );
  yearHeader(ctx, ws);

  let r = 8;
  const dataBarRows: number[] = [];

  const group = (text: string) => {
    band(ws, r, text, colors.OXBLOOD, colors.WHITE, lastCol);
    r++;
  };
  const blank = () => {
    r++;
  };

  const row = (
    name: string,
    build: (i: number) => string,
    o: { fmt?: string; unit?: string; from?: number; bars?: boolean } = {}
  ) => {
    const thisRow = r++;
    label(ws, thisRow, name, o.unit ?? '%', { indent: 1 });
    const from = o.from ?? 0;
    for (let i = from; i < nT; i++) {
      const cell = ws.getCell(thisRow, cOf(i));
      cell.value = { formula: `IFERROR(${build(i)},"")` } as any;
      styleCalc(cell, o.fmt ?? fmt.PCT1, { cross: true });
    }
    if (o.bars) dataBarRows.push(thisRow);
    return thisRow;
  };

  // ---- growth & margins ----------------------------------------------------
  group('Growth & margins');
  row('Revenue growth', (i) => `${ref('rev', i)}/${prv('rev', i)}-1`, { from: 1 });
  row('Gross margin', (i) => `${ref('gp', i)}/${ref('rev', i)}`, { bars: true });
  row('Operating margin', (i) => `${ref('ebit', i)}/${ref('rev', i)}`, { bars: true });
  row('EBITDA margin', (i) => `${ref('ebitda', i)}/${ref('rev', i)}`, { bars: true });
  row('Net margin', (i) => `${ref('ni', i)}/${ref('rev', i)}`, { bars: true });
  blank();

  // ---- returns --------------------------------------------------------------
  // Every return here uses the AVERAGE of the opening and closing balance,
  // which needs a prior column. The first year has none, so it is left
  // blank rather than dividing by a balance that was never modelled.
  group('Returns');
  row('Return on equity, average equity', (i) => `${ref('ni', i)}/((${ref('bsTe', i)}+${prv('bsTe', i)})/2)`, {
    from: 1,
    bars: true,
  });
  row('Return on assets, average assets', (i) => `${ref('ni', i)}/((${ref('bsTa', i)}+${prv('bsTa', i)})/2)`, {
    from: 1,
    bars: true,
  });
  const invCap = (i: number) => `(${ref('bsDebt', i)}+${ref('bsRevolver', i)}+${ref('bsTe', i)}-${ref('bsCash', i)})`;
  const invCapPrv = (i: number) => `(${prv('bsDebt', i)}+${prv('bsRevolver', i)}+${prv('bsTe', i)}-${prv('bsCash', i)})`;
  row(
    'Return on invested capital, average capital',
    (i) => `(${ref('ebit', i)}*(1-${ref('taxRate', i)}))/((${invCap(i)}+${invCapPrv(i)})/2)`,
    { from: 1, bars: true }
  );
  blank();

  // ---- working capital --------------------------------------------------
  group('Working capital');
  const dsoRow = row('Days sales outstanding', (i) => `${ref('bsAr', i)}/${ref('rev', i)}*365`, {
    fmt: DAYS_FMT,
    unit: 'days',
  });
  const dioRow = row('Days inventory outstanding', (i) => `${ref('bsInv', i)}/-${ref('cogs', i)}*365`, {
    fmt: DAYS_FMT,
    unit: 'days',
  });
  const dpoRow = row('Days payable outstanding', (i) => `${ref('bsAp', i)}/${ref('rev', i)}*365`, {
    fmt: DAYS_FMT,
    unit: 'days',
  });
  row(
    'Cash conversion cycle',
    (i) => `${L(cOf(i))}${dsoRow}+${L(cOf(i))}${dioRow}-${L(cOf(i))}${dpoRow}`,
    { fmt: DAYS_FMT, unit: 'days' }
  );
  blank();

  // ---- liquidity & leverage -----------------------------------------------
  group('Liquidity & leverage');
  const curAssets = (i: number) => `(${ref('bsCash', i)}+${ref('bsAr', i)}+${ref('bsInv', i)}+${ref('bsOca', i)}+${ref('bsDta', i)})`;
  const curLiab = (i: number) => `(${ref('bsAp', i)}+${ref('bsAcc', i)}+${ref('bsRevolver', i)})`;
  row('Current ratio', (i) => `${curAssets(i)}/${curLiab(i)}`, { fmt: fmt.MULT, unit: 'x' });
  row('Quick ratio', (i) => `(${curAssets(i)}-${ref('bsInv', i)})/${curLiab(i)}`, { fmt: fmt.MULT, unit: 'x' });
  row('Debt / equity', (i) => `(${ref('bsDebt', i)}+${ref('bsRevolver', i)})/${ref('bsTe', i)}`, {
    fmt: fmt.MULT,
    unit: 'x',
  });
  row(
    'Net debt / EBITDA',
    (i) => `(${ref('bsDebt', i)}+${ref('bsRevolver', i)}-${ref('bsCash', i)})/${ref('ebitda', i)}`,
    { fmt: fmt.MULT, unit: 'x' }
  );
  row('Interest coverage, EBIT / interest expense', (i) => `${ref('ebit', i)}/-${ref('intExp', i)}`, {
    fmt: fmt.MULT,
    unit: 'x',
  });
  blank();

  // ---- cash -------------------------------------------------------------
  group('Cash');
  row('Free cash flow margin', (i) => `(${ref('cfo', i)}+${ref('cfi', i)})/${ref('rev', i)}`);
  row('Cash conversion, CFO / net income', (i) => `${ref('cfo', i)}/${ref('ni', i)}`, {
    fmt: fmt.MULT,
    unit: 'x',
  });

  // ---- data bars ----------------------------------------------------------
  // One call per row, so each bar scales to that row's own range rather than
  // a shared scale across every margin and return on the sheet.
  let priority = 1;
  dataBarRows.forEach((barRow) => {
    const rangeRef = `${L(FIRST)}${barRow}:${L(lastCol)}${barRow}`;
    ws.addConditionalFormatting({
      ref: rangeRef,
      rules: [
        {
          type: 'dataBar',
          gradient: false,
          minLength: 0,
          maxLength: 100,
          border: false,
          cfvo: [{ type: 'min' }, { type: 'max' }],
          color: { argb: colors.OXBLOOD },
          priority: priority++,
        } as any,
      ],
    });
  });
}

// =============================================================================
// CHECKS
// =============================================================================

function buildChecksSheet(ctx: SupportingSheetsContext) {
  const { R, nH, nT, FIRST, cOf, L, lastCol, companyName, newSheet, title, band, label, styleCalc, colors } = ctx;
  const MS = `'${ctx.modelSheetName}'`;
  const ref = (rowKey: string, i: number) => `${MS}!${L(cOf(i))}${R[rowKey]}`;

  const ws = newSheet('Checks', colors.OXBLOOD);
  title(
    ws,
    `${companyName} - checks`,
    'Every row below computes a difference that should be zero. "Error" means the model does not add up in that year.'
  );
  yearHeader(ctx, ws);

  let r = 8;
  const firstCheckDataRow = r + 1; // first row written below the first band

  const group = (text: string) => {
    band(ws, r, text, colors.OXBLOOD, colors.WHITE, lastCol);
    r++;
  };
  const blank = () => {
    r++;
  };

  const check = (name: string, build: (i: number) => string, from = 0) => {
    const thisRow = r++;
    label(ws, thisRow, name, '', { indent: 1 });
    for (let i = from; i < nT; i++) {
      const cell = ws.getCell(thisRow, cOf(i));
      cell.value = { formula: `ROUND(${build(i)},6)` } as any;
      styleCalc(cell, CHECK_OK_ERROR, { cross: true });
    }
    return thisRow;
  };

  // ---- income statement arithmetic -----------------------------------------
  group('Income statement arithmetic');
  check(
    'Revenue, costs and tax sum to net income',
    (i) =>
      `(${ref('rev', i)}+${ref('cogs', i)}+${ref('rnd', i)}+${ref('sga', i)}+${ref('intInc', i)}+${ref(
        'intExp',
        i
      )}+${ref('other', i)}+${ref('tax', i)})-${ref('ni', i)}`
  );
  blank();

  // ---- balance sheet balancing ----------------------------------------------
  group('Balance sheet balancing');
  check('Total assets = total liabilities + total equity', (i) => `${ref('bsTa', i)}-${ref('bsTl', i)}-${ref('bsTe', i)}`);
  blank();

  // ---- cash flow ties to the movement in cash --------------------------------
  // Reported-year cash balances are hard-coded from the filing and the first
  // of them has no opening balance, so this starts at the first forecast year.
  group('Cash flow ties to the movement in cash');
  check(
    'Change in cash = CFO + CFI + CFF',
    (i) => `(${ref('cashEnd', i)}-${ref('cashBop', i)})-(${ref('cfo', i)}+${ref('cfi', i)}+${ref('cff', i)})`,
    nH
  );
  blank();

  // ---- roll-forward schedules -------------------------------------------
  // Same reasoning: reported years are hard-coded and the first has no
  // opening balance, so every roll-forward check starts at the first
  // forecast year. Checked across every reported year, these fail on all of
  // them — not because anything is broken, but because the filing's own
  // ending balance was never derived from a beginning balance in this file.
  group('Roll-forward schedules');
  const rollSimple = (name: string, key: string) =>
    check(`${name}: end = beginning + movement`, (i) => `${ref(`${key}End`, i)}-${ref(`${key}Bop`, i)}-${ref(`${key}Chg`, i)}`, nH);
  rollSimple('Accounts receivable', 'ar');
  rollSimple('Inventory', 'inv');
  rollSimple('Accounts payable', 'ap');
  rollSimple('Accrued expenses & deferred revenue', 'acc');
  rollSimple('Other current assets', 'oca');
  rollSimple('Deferred tax assets', 'dta');
  rollSimple('Other assets', 'oa');
  rollSimple('Other non-current liabilities', 'oncl');
  check(
    'Property, plant & equipment: end = beginning + capex - depreciation',
    (i) => `${ref('ppeEnd', i)}-${ref('ppeBop', i)}-${ref('ppeCapex', i)}-${ref('ppeDep', i)}`,
    nH
  );
  check(
    'Debt: end = beginning + borrowing + PIK interest',
    (i) => `${ref('debtEnd', i)}-${ref('debtBop', i)}-${ref('debtBorrow', i)}-${ref('debtPik', i)}`,
    nH
  );
  check(
    'Common stock & APIC: end = beginning + issuance + stock compensation',
    (i) => `${ref('csEnd', i)}-${ref('csBop', i)}-${ref('csIssue', i)}-${ref('sbc', i)}`,
    nH
  );
  check(
    'Retained earnings: end = beginning + net income - dividends',
    (i) => `${ref('reEnd', i)}-${ref('reBop', i)}-${ref('ni', i)}-${ref('reDiv', i)}`,
    nH
  );
  check('Treasury stock: end = beginning + repurchases', (i) => `${ref('tsEnd', i)}-${ref('tsBop', i)}-${ref('buyback', i)}`, nH);
  check(
    'Other comprehensive income: end = beginning + movement',
    (i) => `${ref('ociEnd', i)}-${ref('ociBop', i)}-${ref('ociChg', i)}`,
    nH
  );
  blank();

  // ---- summary ------------------------------------------------------------
  // This tests the underlying VALUE of every check cell above, not the "OK"
  // / "Error" text the number format prints — that text only exists on
  // screen, and a cell holding a number is never equal to the string
  // "Error", so a COUNTIF for that word would silently match nothing.
  //
  // COUNTIF(range,"<>0") counts every cell that isn't the number zero —
  // which, in both Excel and here, includes genuinely blank cells (the
  // reported years a roll-forward check deliberately skips). Subtracting
  // COUNTBLANK(range) removes exactly those, leaving the count of cells
  // that are actually nonzero: the real failures.
  const lastCheckDataRow = r - 2; // step back over the trailing blank()
  const summaryRow = r++;
  const range = `${L(FIRST)}${firstCheckDataRow}:${L(lastCol)}${lastCheckDataRow}`;
  const failCount = `COUNTIF(${range},"<>0")-COUNTBLANK(${range})`;
  label(ws, summaryRow, 'Summary', '', { indent: 0, bold: true });
  ws.mergeCells(summaryRow, FIRST, summaryRow, lastCol);
  const summaryCell = ws.getCell(summaryRow, FIRST);
  summaryCell.value = {
    formula: `IF(${failCount}=0,"All checks pass","Error — "&${failCount}&" check(s) failed, see the flagged cells above")`,
  } as any;
  summaryCell.font = { ...ctx.FONT, bold: true };
  summaryCell.alignment = { horizontal: 'left' };
}

// =============================================================================
// SOURCES
// =============================================================================

// Laid out exactly like Ratios and Checks — year header on rows 5-6 under the
// frozen panes, bands from row 8, labels through label(), figures through
// styleHard() in the model's own number formats — with the filing's years in
// place of the model's.
function buildSourcesSheet(ctx: SupportingSheetsContext) {
  const { FIRST, cOf, lastCol, companyName, source, newSheet, title, band, label, styleHard, fmt, colors, FONT } = ctx;

  const ws = newSheet('Sources', colors.OXBLOOD);
  title(
    ws,
    `${companyName} - sources`,
    'What the filing actually said. Every figure below is hard-coded from source.rawStatements, unrenamed and uncomputed.'
  );

  const rows: any[] = Array.isArray(source?.rawStatements) ? source.rawStatements : [];
  const nS = rows.length;
  const endCol = Math.max(lastCol, cOf(nS - 1));

  // The filing can carry more years than the model; size any extra year
  // columns the way newSheet sized the model's.
  for (let c = lastCol + 2; c <= endCol + 1; c++) ws.getColumn(c).width = ws.getColumn(FIRST).width;

  if (nS > 0) {
    yearHeader(
      ctx,
      ws,
      rows.map((row, i) => (isNum(row?.fiscalYear) ? `FY${String(row.fiscalYear).slice(2)}` : `Year ${i + 1}`)),
      nS,
      'Line (as fetched)'
    );
  }

  let r = 8;
  band(ws, r, 'Filing reference', colors.OXBLOOD, colors.WHITE, endCol);
  r++;
  const meta = source?.meta || {};
  const metaRow = (k: string, v: string) => {
    label(ws, r, k, '', { indent: 1 });
    const cell = ws.getCell(r, FIRST);
    cell.value = v;
    cell.font = { ...FONT, color: { argb: colors.BLUE } };
    r++;
  };
  metaRow('Filing source', meta.source || 'company filings');
  if (meta.sourceUrl) metaRow('Source URL', meta.sourceUrl);
  r++;

  if (nS === 0) {
    ws.getCell(r, 3).value = 'No raw filed statements were carried with this model.';
    ws.getCell(r, 3).font = { ...FONT, size: 10, italic: true, color: { argb: colors.GREY } };
    return;
  }

  // The set of every line the filing carried, in the order it first appears.
  // Not renamed: the label is the raw field name exactly as fetched.
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const k of Object.keys(row || {})) {
      if (k === 'fiscalYear' || seen.has(k)) continue;
      seen.add(k);
      keys.push(k);
    }
  }

  band(ws, r, 'As filed', colors.OXBLOOD, colors.WHITE, endCol);
  r++;

  keys.forEach((key) => {
    label(ws, r, key, '', { indent: 1 });
    // Whole-number lines in the model's money format; a line carrying any
    // fraction (per-share figures, share counts) in its two-decimal format.
    const fractional = rows.some((row) => isNum(row?.[key]) && !Number.isInteger(row[key]));
    const rowFmt = fractional ? fmt.money2() : fmt.money();
    rows.forEach((row, i) => {
      const cell = ws.getCell(r, cOf(i));
      const v = row?.[key];
      if (isNum(v)) {
        cell.value = v;
        styleHard(cell, rowFmt);
      } else {
        cell.value = 'Not disclosed';
        cell.font = { ...FONT, italic: true, color: { argb: colors.GREY } };
        cell.alignment = { horizontal: 'right' };
      }
    });
    r++;
  });
}

// =============================================================================

export function addSupportingSheets(ctx: SupportingSheetsContext) {
  buildRatiosSheet(ctx);
  buildChecksSheet(ctx);
  buildSourcesSheet(ctx);
}

export default { addSupportingSheets };
