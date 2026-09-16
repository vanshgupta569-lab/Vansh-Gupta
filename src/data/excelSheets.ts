// FILE: src/data/excelSheets.ts
//
// Marginalia — Excel export: statement, annexure, Ratios, Checks and Sources sheets
//
// These sheets READ the model built in excelExport.ts; nothing here
// rebuilds it. Every figure on the income statement, balance sheet, cash
// flow, annexures, Ratios and Checks is a live cross-sheet
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
  currencySymbol: string;
  UNIT: string;
  fmt: { PCT1: string; MULT: string; money: (symbol?: string) => string; money2: (symbol?: string) => string };
  colors: { OXBLOOD: string; SUBHEAD: string; WHITE: string; BLACK: string; BLUE: string; GREY: string };
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
  row('Gross margin before D&A and SBC', (i) => `${ref('gp', i)}/${ref('rev', i)}`, { bars: true });
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
  // On cost of sales as filed (D&A and SBC included), as the site computes it,
  // so reported years agree with the filings and forecast years with the site.
  const dioRow = row('Days inventory outstanding', (i) => `${ref('bsInv', i)}/-${ref('cogsFiledBasis', i)}*365`, {
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

  const check = (name: string, build: (i: number) => string, from = 0, to = nT) => {
    const thisRow = r++;
    label(ws, thisRow, name, '', { indent: 1 });
    for (let i = from; i < to; i++) {
      const cell = ws.getCell(thisRow, cOf(i));
      cell.value = { formula: `ROUND(${build(i)},6)` } as any;
      styleCalc(cell, CHECK_OK_ERROR, { cross: true });
    }
    return thisRow;
  };

  // ---- income statement arithmetic -----------------------------------------
  group('Income statement arithmetic');
  check(
    'Revenue, costs, D&A, SBC and tax sum to net income',
    (i) =>
      `(${ref('rev', i)}+${ref('cogs', i)}+${ref('rnd', i)}+${ref('sga', i)}+${ref('daCost', i)}+${ref(
        'sbcCost',
        i
      )}+${ref('intInc', i)}+${ref('intExp', i)}+${ref('other', i)}+${ref('tax', i)}+${ref('afterTax', i)})-${ref(
        'ni',
        i
      )}`
  );
  blank();

  // ---- reported years reconcile to the filings --------------------------------
  // The cost lines exclude D&A and SBC, split out of the filed lines. Moving
  // them must not change what a reported year reports, so operating profit is
  // checked against revenue less the filed cost lines, reported years only.
  group('Reported years reconcile to the filings');
  check(
    'Operating profit = revenue less the cost lines as filed',
    (i) =>
      `${ref('ebit', i)}-(${ref('rev', i)}+${ref('cogsFiled', i)}+${ref('rndFiled', i)}+${ref('sgaFiled', i)})`,
    0,
    nH
  );
  // A blank filed figure (a hand-built data file carries none) is nothing to
  // test, not a failure.
  check(
    'Pretax income = pretax income as filed',
    (i) => `IF(${ref('pretaxFiled', i)}="",0,${ref('pbt', i)}-${ref('pretaxFiled', i)})`,
    0,
    nH
  );
  check(
    'Net income = net income as filed',
    (i) => `IF(${ref('niFiled', i)}="",0,${ref('ni', i)}-${ref('niFiled', i)})`,
    0,
    nH
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
    'Revolver: end = beginning + draw / (repayment)',
    (i) => `${ref('revEnd', i)}-${ref('revBop', i)}-${ref('revDraw', i)}`,
    nH
  );
  check('Revolver: balance is never negative', (i) => `MIN(0,${ref('revEnd', i)})`, nH);
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
// STATEMENTS & ANNEXURES — shared builder
// =============================================================================
//
// Presentation sheets: every figure is a live link to '3-StatementModel' or a
// subtotal of those links on the same sheet. Nothing is copied as a value.
//
// Two signs travel with every line, and they are deliberately separate:
//
//  - flip: how the linked figure is DISPLAYED. The model stores costs as
//    negatives; a published income statement shows them as positives, so a
//    cost line links as -model.
//  - sign: how the displayed line ENTERS a subtotal, +1 added or -1
//    subtracted. A cost shown positive enters with -1.
//
// Subtotal formulas are generated from those signs rather than written as
// "revenue minus costs", so a tax benefit (a positive tax figure on the
// model, shown negative here) still adds to net income, and a line whose
// display is flipped for a reason other than being a cost (capex on the
// cash flow, shown as the negative cash effect it is) is not subtracted twice.

interface Line {
  row: number;
  sign: 1 | -1;
}

interface LineOpts {
  flip?: 1 | -1;
  sign?: 1 | -1;
  fmt?: string;
  unit?: string;
  bold?: boolean;
  italic?: boolean;
  indent?: number;
  /** Show a blank model cell as blank rather than 0. Only for lines no subtotal reads. */
  blankAsEmpty?: boolean;
}

function presentationBuilder(ctx: SupportingSheetsContext, ws: Sheet) {
  const { R, nH, nT, cOf, L, lastCol, band, label, styleCalc, fmt, colors, UNIT, FONT } = ctx;
  const MS = `'${ctx.modelSheetName}'`;
  let r = 8;

  const group = (text: string) => {
    band(ws, r, text, colors.OXBLOOD, colors.WHITE, lastCol);
    r++;
  };
  const sub = (text: string) => {
    band(ws, r, text, colors.SUBHEAD, colors.BLACK, lastCol);
    r++;
  };
  const blank = () => {
    r++;
  };
  const heading = (text: string) => {
    label(ws, r, text, '', { indent: 1, italic: true });
    r++;
  };
  const note = (lines: string[]) => {
    lines.forEach((text) => {
      const cell = ws.getCell(r, 3);
      cell.value = text;
      cell.font = { ...FONT, size: 10, italic: true, color: { argb: colors.GREY } };
      r++;
    });
  };

  /** A line linked to a model row, in every year. */
  const link = (name: string, key: string, o: LineOpts = {}): Line => {
    const modelRow = R[key];
    if (!modelRow) throw new Error(`Excel export: no model row registered as "${key}"`);
    const row = r++;
    label(ws, row, name, o.unit ?? UNIT, { indent: o.indent ?? 1, bold: o.bold, italic: o.italic });
    for (let i = 0; i < nT; i++) {
      const ref = `${MS}!${L(cOf(i))}${modelRow}`;
      const shown = o.flip === -1 ? `-${ref}` : ref;
      const cell = ws.getCell(row, cOf(i));
      cell.value = { formula: o.blankAsEmpty ? `IF(${ref}="","",${shown})` : shown } as any;
      styleCalc(cell, o.fmt ?? fmt.money(), { cross: true, bold: o.bold, italic: o.italic });
    }
    return { row, sign: o.sign ?? 1 };
  };

  /**
   * A subtotal of lines on this sheet. Its displayed value is
   * sign × Σ(part.sign × part), so each term's operator comes from the signs.
   */
  const total = (name: string, parts: Line[], o: LineOpts = {}): Line => {
    const row = r++;
    const sign = o.sign ?? 1;
    const bold = o.bold ?? true;
    label(ws, row, name, o.unit ?? UNIT, { indent: o.indent ?? 0, bold });
    for (let i = 0; i < nT; i++) {
      const c = L(cOf(i));
      const formula = parts
        .map((p, idx) => {
          const op = sign * p.sign < 0 ? '-' : idx === 0 ? '' : '+';
          return `${op}${c}${p.row}`;
        })
        .join('');
      const cell = ws.getCell(row, cOf(i));
      cell.value = { formula } as any;
      styleCalc(cell, o.fmt ?? fmt.money(), { bold });
    }
    return { row, sign };
  };

  /** A thin rule down the left edge of the first forecast year. */
  const finish = () => {
    if (nH <= 0 || nH >= nT) return;
    for (let row = 5; row < r; row++) {
      const cell = ws.getCell(row, cOf(nH));
      cell.border = { ...(cell.border || {}), left: { style: 'thin', color: { argb: colors.GREY } } };
    }
  };

  return { group, sub, blank, heading, note, link, total, finish };
}

// =============================================================================
// INCOME STATEMENT
// =============================================================================

function buildIncomeStatementSheet(ctx: SupportingSheetsContext) {
  const { companyName, newSheet, title, fmt, colors, currencySymbol } = ctx;
  const ws = newSheet('Income Statement', colors.OXBLOOD);
  title(
    ws,
    `${companyName} - income statement`,
    'Every figure links to the 3-statement model. Costs are shown as positive figures and subtracted, as in a published statement.'
  );
  yearHeader(ctx, ws);
  const b = presentationBuilder(ctx, ws);
  const sym = fmt.money(currencySymbol);
  // Stored negative on the model, shown positive here, subtracted in totals.
  const cost = (name: string, key: string) => b.link(name, key, { flip: -1, sign: -1 });
  // Stored positive on the model (the cash flow adds them back), shown
  // positive here, subtracted in totals.
  const nonCashCharge = (name: string, key: string) => b.link(name, key, { sign: -1 });

  b.group('Revenue & gross profit');
  const rev = b.link('Revenue', 'rev', { fmt: sym, bold: true, indent: 0 });
  const cogs = cost('Cost of sales, excluding D&A and SBC', 'cogs');
  const gp = b.total('Gross profit before D&A and SBC', [rev, cogs]);
  b.blank();

  b.group('Operating expenses');
  const rnd = cost('Research & development, excluding D&A and SBC', 'rnd');
  const sga = cost('Selling, general & administrative, excluding D&A and SBC', 'sga');
  const da = nonCashCharge('Depreciation & amortization', 'da');
  const sbc = nonCashCharge('Stock based compensation', 'sbc');
  const opex = b.total('Total operating expenses', [rnd, sga, da, sbc], { sign: -1 });
  b.blank();
  const ebit = b.total('Operating income', [gp, opex]);
  b.blank();

  b.group('Non-operating items & taxes');
  const intInc = b.link('Interest income', 'intInc');
  const intExp = cost('Interest expense', 'intExp');
  const other = b.link('Other income / (expense), net', 'other');
  const pbt = b.total('Income before provision for income taxes', [ebit, intInc, intExp, other]);
  const tax = cost('Provision for income taxes', 'tax');
  const afterTax = b.link('Items after tax: non-controlling interests, discontinued operations', 'afterTax');
  b.total('Net income', [pbt, tax, afterTax], { fmt: sym });
  b.blank();

  b.group('Supplementary');
  // EBITDA adds the two non-cash charges back to operating income, so here
  // the same lines enter with a plus.
  b.total('EBITDA', [ebit, { ...da, sign: 1 }, { ...sbc, sign: 1 }], { fmt: sym });
  b.blank();
  b.note([
    'Cost of sales, R&D and SG&A exclude depreciation & amortization and stock based compensation, which are charged',
    'as their own lines. In reported years each filed cost line gives up its pro-rata share of the filed D&A and SBC, so',
    'operating income is unchanged from the filing.',
    'A negative provision for income taxes is a tax benefit, and adds to net income.',
    'Interest expense includes PIK interest, which accrues to the debt balance rather than being paid in cash and is',
    'added back in operating cash flow.',
  ]);
  b.finish();
}

// =============================================================================
// BALANCE SHEET
// =============================================================================

function buildBalanceSheetSheet(ctx: SupportingSheetsContext) {
  const { companyName, newSheet, title, fmt, colors, currencySymbol } = ctx;
  const ws = newSheet('Balance Sheet', colors.OXBLOOD);
  title(
    ws,
    `${companyName} - balance sheet`,
    'Every figure links to the 3-statement model. Treasury stock and accumulated losses carry their own negative sign.'
  );
  yearHeader(ctx, ws);
  const b = presentationBuilder(ctx, ws);
  const sym = fmt.money(currencySymbol);

  b.group('Assets');
  b.sub('Current assets');
  const cash = b.link('Cash & equivalents', 'bsCash', { fmt: sym });
  const ar = b.link('Accounts receivable', 'bsAr');
  const inv = b.link('Inventory', 'bsInv');
  const dta = b.link('Deferred tax assets', 'bsDta');
  const oca = b.link('Other current assets', 'bsOca');
  const tca = b.total('Total current assets', [cash, ar, inv, dta, oca]);
  b.sub('Non-current assets');
  const ppe = b.link('Property, plant & equipment, net', 'bsPpe');
  const oa = b.link('Other non-current assets', 'bsOa');
  const tnca = b.total('Total non-current assets', [ppe, oa]);
  b.blank();
  b.total('Total assets', [tca, tnca], { fmt: sym });
  b.blank();

  b.group('Liabilities');
  b.sub('Current liabilities');
  const ap = b.link('Accounts payable', 'bsAp', { fmt: sym });
  const acc = b.link('Accrued expenses & deferred revenue', 'bsAcc');
  const rev = b.link('Revolver', 'bsRevolver');
  const tcl = b.total('Total current liabilities', [ap, acc, rev]);
  b.sub('Non-current liabilities');
  const debt = b.link('Long term debt', 'bsDebt');
  const oncl = b.link('Other non-current liabilities', 'bsOncl');
  const tncl = b.total('Total non-current liabilities', [debt, oncl]);
  b.blank();
  const tl = b.total('Total liabilities', [tcl, tncl]);
  b.blank();

  b.group("Shareholders' equity");
  const cs = b.link('Common stock & additional paid in capital', 'bsCs');
  const ts = b.link('Treasury stock', 'bsTs');
  const re = b.link('Retained earnings / (accumulated deficit)', 'bsRe');
  const oci = b.link('Accumulated other comprehensive income / (loss)', 'bsOci');
  const te = b.total("Total shareholders' equity", [cs, ts, re, oci]);
  b.blank();
  b.total("Total liabilities & shareholders' equity", [tl, te], { fmt: sym });
  b.finish();
}

// =============================================================================
// CASH FLOW
// =============================================================================

function buildCashFlowSheet(ctx: SupportingSheetsContext) {
  const { companyName, newSheet, title, fmt, colors, currencySymbol } = ctx;
  const ws = newSheet('Cash Flow', colors.OXBLOOD);
  title(
    ws,
    `${companyName} - cash flow statement`,
    'Every figure links to the 3-statement model. Inflows are positive, outflows in brackets.'
  );
  yearHeader(ctx, ws);
  const b = presentationBuilder(ctx, ws);
  const sym = fmt.money(currencySymbol);
  // Every line here is already a cash effect, so every line adds. An increase
  // in an asset balance uses cash, hence the flipped display on those.
  const assetMove = (name: string, key: string) => b.link(name, key, { flip: -1 });

  b.group('Operating activities');
  const ni = b.link('Net income', 'cfNi', { fmt: sym });
  b.heading('Adjustments to reconcile net income to cash from operations:');
  const da = b.link('Depreciation & amortization', 'cfDa');
  const sbc = b.link('Stock based compensation', 'cfSbc');
  const pik = b.link('Non-cash PIK interest', 'cfPik');
  b.heading('Changes in operating assets and liabilities:');
  const ar = assetMove('Accounts receivable', 'arChg');
  const inv = assetMove('Inventory', 'invChg');
  const dta = assetMove('Deferred tax assets', 'dtaChg');
  const oca = assetMove('Other current assets', 'ocaChg');
  // The movement excluding amortisation of intangibles, which D&A above adds back.
  const oa = b.link('Other non-current assets, excluding amortisation', 'oaMove', { flip: -1 });
  const ap = b.link('Accounts payable', 'apChg');
  const acc = b.link('Accrued expenses & deferred revenue', 'accChg');
  const oncl = b.link('Other non-current liabilities', 'onclChg');
  const cfo = b.total('Cash generated by / (used in) operating activities', [ni, da, sbc, pik, ar, inv, dta, oca, oa, ap, acc, oncl], {
    fmt: sym,
  });
  b.blank();

  b.group('Investing activities');
  const capex = b.link('Payments for acquisition of property, plant & equipment', 'ppeCapex', { flip: -1 });
  const cfi = b.total('Cash generated by / (used in) investing activities', [capex]);
  b.blank();

  b.group('Financing activities');
  const borrow = b.link('Proceeds from / (repayment of) term debt', 'debtBorrow');
  const revolver = b.link('Revolver draw / (repayment)', 'revDraw');
  const issue = b.link('Proceeds from issuance of common stock', 'csIssue');
  const div = b.link('Payments for dividends', 'reDiv');
  const buyback = b.link('Repurchases of common stock', 'buyback');
  const oci = b.link('Other comprehensive income / (loss)', 'ociChg');
  const cff = b.total('Cash generated by / (used in) financing activities', [borrow, revolver, issue, div, buyback, oci]);
  b.blank();

  b.group('Cash');
  b.total('Increase / (decrease) in cash', [cfo, cfi, cff]);
  b.link('Cash, beginning of period', 'cashBop');
  b.link('Cash, end of period', 'cashEnd', { fmt: sym, bold: true, indent: 0 });
  b.blank();
  b.note([
    'In reported years cash at the end of the period is the filed figure, while the flows above are derived from the',
    'filed balance sheets, so the two need not reconcile before the first forecast year. From then on they do exactly.',
  ]);
  b.finish();
}

// =============================================================================
// ANNEXURES
// =============================================================================

function buildAnnexuresSheet(ctx: SupportingSheetsContext) {
  const { companyName, newSheet, title, fmt, colors } = ctx;
  const ws = newSheet('Annexures', colors.OXBLOOD);
  title(
    ws,
    `${companyName} - annexures`,
    'The supporting schedules from the 3-statement model, linked live. Change assumptions on the model sheet, not here.'
  );
  yearHeader(ctx, ws);
  const b = presentationBuilder(ctx, ws);
  // No subtotal reads these lines, so a blank model cell stays blank here.
  const pct = (name: string, key: string) =>
    b.link(name, key, { blankAsEmpty: true, fmt: fmt.PCT1, unit: '%', italic: true, indent: 2 });
  const bal = (name: string, key: string, o: LineOpts = {}) => b.link(name, key, { blankAsEmpty: true, ...o });
  const end = (name: string, key: string) => bal(name, key, { bold: true });

  b.group('Annexure A - working capital & other balance sheet schedules');
  (
    [
      ['ar', 'Accounts receivable', 'Receivables as % of revenue'],
      ['inv', 'Inventory', 'Inventory as % of cost of sales'],
      ['ap', 'Accounts payable', 'Payables as % of revenue'],
      ['acc', 'Accrued expenses & deferred revenue', 'Accrued expenses as % of revenue'],
      ['oca', 'Other current assets', 'Other current assets as % of revenue'],
      ['dta', 'Deferred tax assets', 'Deferred tax assets as % of revenue'],
      ['oa', 'Other assets', 'Additions / (disposals), excluding amortisation of intangibles'],
      ['oncl', 'Other non-current liabilities', 'Other non-current liabilities as % of revenue'],
    ] as [string, string, string][]
  ).forEach(([k, name, driverName]) => {
    b.sub(name);
    // Other assets are held flat apart from amortisation of intangibles, so
    // their driver is a movement in money, not a percentage.
    if (k === 'oa') {
      bal(driverName, 'oaMove');
      bal('Less: amortisation of intangibles', 'amort');
    } else {
      pct(driverName, `${k}Pct`);
    }
    bal('Beginning of period', `${k}Bop`);
    bal('Increase / (decrease)', `${k}Chg`);
    end('End of period', `${k}End`);
    b.blank();
  });

  b.group('Annexure B - property, plant & equipment');
  pct('Capital expenditure as % of revenue', 'capexPct');
  pct('Depreciation as % of capital expenditure', 'depPct');
  bal('Beginning of period', 'ppeBop');
  bal('Plus: capital expenditures', 'ppeCapex');
  bal('Less: depreciation', 'ppeDep');
  end('End of period', 'ppeEnd');
  b.blank();
  b.sub('Amortisation of intangibles');
  bal('Annual amortisation, anchored to the last reported year', 'amortAnnual');
  bal('Amortisation of intangibles', 'amort');
  end('Intangible assets excluding goodwill, end of period', 'intangEnd');
  b.blank();

  b.group('Annexure C - debt & revolver');
  b.sub('Long term debt');
  pct('Cash interest rate on debt', 'debtRate');
  pct('PIK interest rate on debt', 'pikRate');
  bal('Beginning of period', 'debtBop');
  bal('Plus: additional borrowing / (pay down)', 'debtBorrow');
  bal('Plus: PIK interest accrued to the balance', 'debtPik');
  end('End of period', 'debtEnd');
  b.blank();
  b.sub('Revolver');
  bal('Minimum cash balance', 'minCash');
  bal('Beginning of period', 'revBop');
  bal('Plus: draw / (less: repayment)', 'revDraw');
  end('End of period', 'revEnd');
  b.blank();

  b.group("Annexure D - shareholders' equity");
  b.sub('Common stock & additional paid in capital');
  bal('Beginning of period', 'csBop');
  bal('Plus: new share issuances', 'csIssue');
  bal('Plus: stock based compensation', 'sbc');
  end('End of period', 'csEnd');
  b.blank();
  b.sub('Retained earnings');
  pct('Dividend payout ratio', 'payout');
  bal('Beginning of period', 'reBop');
  bal('Plus: net income', 'ni');
  bal('Less: common dividends', 'reDiv');
  end('End of period', 'reEnd');
  b.blank();
  b.sub('Treasury stock');
  bal('Beginning of period', 'tsBop');
  bal('Less: share repurchases', 'buyback');
  end('End of period', 'tsEnd');
  b.blank();
  b.sub('Other comprehensive income');
  bal('Beginning of period', 'ociBop');
  bal('Income / (loss) in the period', 'ociChg');
  end('End of period', 'ociEnd');
  b.finish();
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
  buildIncomeStatementSheet(ctx);
  buildBalanceSheetSheet(ctx);
  buildCashFlowSheet(ctx);
  buildAnnexuresSheet(ctx);
  buildRatiosSheet(ctx);
  buildChecksSheet(ctx);
  buildSourcesSheet(ctx);
}

export default { addSupportingSheets };
