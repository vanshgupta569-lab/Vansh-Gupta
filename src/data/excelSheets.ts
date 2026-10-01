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
  // The label the model sheet gave each registered row, so a sheet that repeats
  // a line can repeat its name too instead of keeping a second copy (KI-4).
  RL: Record<string, string>;
  modelSheetName: string;
  // The DCF sheet's row numbers, from the one place that defines them
  // (`excelExport.ts`). This sheet links into that one, and a second copy of a
  // positional layout is a copy that goes stale.
  DR: Record<string, number>;
  // The engine's model and its DCF, for the Assumptions sheet: it states the
  // basis of each assumption, and a basis is something the engine records
  // (provenance, the declared drivers, the amortisation anchor) rather than
  // something a sheet can work out from the cells.
  model: any;
  dcf: any;
  // True where the engine refuses to value the company, so the DCF sheet holds
  // the reason instead of a valuation and nothing may link into it.
  refused: boolean;
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
  // A sentence broken into lines a column can hold. Notes are written as
  // separate cells rather than one wrapped cell because a merged wrapped cell
  // does not auto-fit its row height in Excel, and guessing the height is worse
  // than laying the lines out.
  wrapText: (text: string, width?: number) => string[];
  styleHard: (cell: ExcelJS.Cell, fmt: string, o?: any) => void;
  styleCalc: (cell: ExcelJS.Cell, fmt: string, o?: any) => void;
  currencySymbol: string;
  UNIT: string;
  fmt: {
    PCT1: string;
    PCT2: string;
    PLAIN2: string;
    MULT: string;
    money: (symbol?: string) => string;
    money2: (symbol?: string) => string;
  };
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
      `(${ref('rev', i)}+${ref('cogs', i)}+${ref('rnd', i)}+${ref('sga', i)}+${ref('otherOpex', i)}+${ref('daCost', i)}+${ref(
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
      `${ref('ebit', i)}-(${ref('rev', i)}+${ref('cogsFiled', i)}+${ref('rndFiled', i)}+${ref('sgaFiled', i)}+${ref('otherFiled', i)})`,
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
    'Property, plant & equipment: end = beginning + capex - depreciation + other movements',
    (i) => `${ref('ppeEnd', i)}-${ref('ppeBop', i)}-${ref('ppeCapex', i)}-${ref('ppeDep', i)}-${ref('ppeOther', i)}`,
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
  /** The cell may hold the text "not reported"; subtotals read it through N(). */
  text?: boolean;
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
  /**
   * A line the filing may not report: a blank model cell shows as "not
   * reported" rather than 0, and subtotals count it as nil through N(), which
   * the sheet's note says.
   */
  notReported?: boolean;
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
      cell.value = {
        formula: o.notReported
          ? `IF(${ref}="","not reported",${shown})`
          : o.blankAsEmpty
          ? `IF(${ref}="","",${shown})`
          : shown,
      } as any;
      styleCalc(cell, o.fmt ?? fmt.money(), { cross: true, bold: o.bold, italic: o.italic });
      if (o.notReported) cell.alignment = { ...(cell.alignment || {}), horizontal: 'right' };
    }
    return { row, sign: o.sign ?? 1, text: Boolean(o.notReported) };
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
          return p.text ? `${op}N(${c}${p.row})` : `${op}${c}${p.row}`;
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
  const cost = (name: string, key: string, o: LineOpts = {}) => b.link(name, key, { flip: -1, sign: -1, ...o });
  // Stored positive on the model (the cash flow adds them back), shown
  // positive here, subtracted in totals.
  const nonCashCharge = (name: string, key: string, o: LineOpts = {}) => b.link(name, key, { sign: -1, ...o });

  b.group('Revenue & gross profit');
  const rev = b.link('Revenue', 'rev', { fmt: sym, bold: true, indent: 0 });
  const cogs = cost('Cost of sales, excluding D&A and SBC', 'cogs');
  const gp = b.total('Gross profit before D&A and SBC', [rev, cogs]);
  b.blank();

  b.group('Operating expenses');
  const rnd = cost('Research & development, excluding D&A and SBC', 'rnd', { notReported: true });
  const sga = cost('Selling, general & administrative, excluding D&A and SBC', 'sga', { notReported: true });
  const otherOpex = cost('Other operating costs, excluding D&A and SBC', 'otherOpex');
  const da = nonCashCharge('Depreciation & amortization', 'da');
  const sbc = nonCashCharge('Stock based compensation', 'sbc', { notReported: true });
  const opex = b.total('Total operating expenses', [rnd, sga, otherOpex, da, sbc], { sign: -1 });
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
  // EBITDA adds depreciation and amortisation back to operating income, so
  // that line enters with a plus. Stock compensation does not: it stays a
  // cost, which is the basis the peer multiples are on (see the engine's
  // EBITDA).
  b.total('EBITDA', [ebit, { ...da, sign: 1 }], { fmt: sym });
  b.blank();
  b.note([
    'Cost of sales, R&D and SG&A exclude depreciation & amortization and stock based compensation, which are charged',
    'as their own lines. In reported years each filed cost line gives up its pro-rata share of the filed D&A and SBC, so',
    'operating income is unchanged from the filing.',
    'Other operating costs are the filed operating income less the lines the filing names, so SG&A is the filed SG&A',
    'and operating income ties. A negative figure is operating income those lines leave out.',
    '"Not reported" marks a figure the filing does not report. Totals count it as nil: an unreported R&D or SG&A cost is',
    'inside other operating costs, and unreported stock compensation is neither charged nor added back.',
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
  // Every borrowing, not the long-term loan alone: short-term borrowings,
  // current maturities and finance leases are all in this line.
  const debt = b.link('Borrowings, including finance leases', 'bsDebt');
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
  // Linked to the stock compensation line itself, not the cash flow's formula
  // row, which would turn a blank (not reported) into 0.
  const sbc = b.link('Stock based compensation', 'sbc', { notReported: true });
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
  // Reported years: what the filed operating section holds that the lines above
  // do not carry, so this total is the company's filed figure rather than this
  // model's rebuild of it (KI-7). Nil from the first forecast year.
  const other = b.link('Other items in the filed statement, not carried by this model', 'cfOther');
  const cfo = b.total(
    'Cash generated by / (used in) operating activities',
    [ni, da, sbc, pik, ar, inv, dta, oca, oa, ap, acc, oncl, other],
    { fmt: sym }
  );
  b.blank();

  b.group('Investing activities');
  const capex = b.link('Payments for acquisition of property, plant & equipment', 'ppeCapex', { flip: -1 });
  const cfi = b.total('Cash generated by / (used in) investing activities', [capex]);
  b.blank();

  b.group('Financing activities');
  const borrow = b.link('Proceeds from / (repayment of) term debt', 'debtBorrow');
  const revolver = b.link('Revolver draw / (repayment)', 'revDraw');
  const issue = b.link('Proceeds from issuance of common stock', 'csIssue');
  const div = b.link('Payments for dividends', 'reDiv', { notReported: true });
  const buyback = b.link('Repurchases of common stock', 'buyback', { notReported: true });
  const oci = b.link('Other comprehensive income / (loss)', 'ociChg');
  const cff = b.total('Cash generated by / (used in) financing activities', [borrow, revolver, issue, div, buyback, oci]);
  b.blank();

  b.group('Cash');
  b.total('Increase / (decrease) in cash', [cfo, cfi, cff]);
  b.link('Cash, beginning of period', 'cashBop');
  b.link('Cash, end of period', 'cashEnd', { fmt: sym, bold: true, indent: 0 });
  b.blank();
  b.note([
    'In a reported year, cash from operations is the figure the company filed: the lines above it are this model’s',
    'build-up of it and the difference between the two is shown on its own line rather than absorbed into the total.',
    'Investing and financing here are the lines this model carries, which is not the whole of either section — a',
    'company that bought a business, or raised and repaid debt, moved cash this model never sees — so in a reported',
    'year they need not add to the movement in the cash balance. From the first forecast year every line is this',
    'model’s own and the three sections add to that movement exactly.',
    '"Not reported" marks a figure the filing does not report; totals count it as nil.',
  ]);
  b.finish();
}

// =============================================================================
// ANNEXURES
// =============================================================================

function buildAnnexuresSheet(ctx: SupportingSheetsContext) {
  const { companyName, newSheet, title, fmt, colors, R, RL } = ctx;
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
  // The driver row each schedule actually has, and the name the model sheet
  // gave it, are read from the registry rather than repeated here. Naming them
  // twice is how the workbook came to describe drivers the engine does not use
  // (KI-4); a line whose basis the model chooses cannot be labelled by hand in
  // two files and stay true in both.
  (
    [
      ['ar', 'Accounts receivable'],
      ['inv', 'Inventory'],
      ['ap', 'Accounts payable'],
      ['acc', 'Accrued expenses & deferred revenue'],
      ['oca', 'Other current assets'],
      ['dta', 'Deferred tax assets'],
      ['oa', 'Other assets'],
      ['oncl', 'Other non-current liabilities'],
    ] as [string, string][]
  ).forEach(([k, name]) => {
    b.sub(name);
    const driverName = RL[`${k}Pct`] ?? RL[`${k}Move`] ?? 'Driver';
    if (R[`${k}Pct`]) {
      pct(driverName, `${k}Pct`);
    } else {
      bal(driverName, `${k}Move`);
      // Other assets are the one held-flat line that also carries the
      // intangible amortisation charge.
      if (k === 'oa') bal('Less: amortisation of intangibles', 'amort');
    }
    bal('Beginning of period', `${k}Bop`);
    bal('Increase / (decrease)', `${k}Chg`);
    end('End of period', `${k}End`);
    b.blank();
  });

  b.group('Annexure B - property, plant & equipment');
  // Names and rows come from the registry: the capital spending row is named
  // for whichever rule the engine used, and where spending is split into
  // replacement and growth both parts are shown (KI-4). This sheet said
  // "% of revenue" and "% of capital expenditure" for years after the model
  // sheet had stopped saying either.
  const named = (key: string) => pct(RL[key] ?? key, key);
  if (R.capexPct) named('capexPct');
  named('depPct');
  if (R.ppeIntensity) named('ppeIntensity');
  bal('Beginning of period', 'ppeBop');
  // The model sheet's own order: where spending is split, replacement is the
  // depreciation charge and is struck before the total it feeds.
  if (R.ppeGrowthCapex) {
    bal(RL.ppeGrowthCapex ?? 'Plus: growth capital expenditures', 'ppeGrowthCapex');
    bal('Less: depreciation', 'ppeDep', { notReported: true });
    bal(RL.ppeCapex ?? 'Plus: capital expenditures', 'ppeCapex');
  } else {
    bal(RL.ppeCapex ?? 'Plus: capital expenditures', 'ppeCapex');
    bal('Less: depreciation', 'ppeDep', { notReported: true });
  }
  bal('Plus: other movements in the balance', 'ppeOther', { notReported: true });
  end('End of period', 'ppeEnd');
  b.blank();
  b.sub('Amortisation of intangibles');
  bal('Annual amortisation, anchored to the last reported year', 'amortAnnual');
  bal('Amortisation of intangibles', 'amort');
  end('Intangible assets excluding goodwill, end of period', 'intangEnd');
  b.blank();

  b.group('Annexure C - debt & revolver');
  b.sub('Borrowings, including finance leases');
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
  bal('Plus: stock based compensation', 'sbc', { notReported: true });
  end('End of period', 'csEnd');
  b.blank();
  b.sub('Retained earnings');
  pct('Dividend payout ratio', 'payout');
  bal('Beginning of period', 'reBop');
  bal('Plus: net income', 'ni');
  bal('Less: common dividends', 'reDiv', { notReported: true });
  end('End of period', 'reEnd');
  b.blank();
  b.sub('Treasury stock');
  bal('Beginning of period', 'tsBop');
  bal('Less: share repurchases', 'buyback', { notReported: true });
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
// ASSUMPTIONS
// =============================================================================
//
// EVERY CHOICE BEHIND THE NUMBER, ON ONE SHEET, WITH THE REASON IT WAS MADE.
//
// The workbook already carried every assumption — one yellow cell per year,
// spread across ten tabs. What it did not carry was WHY any of them is what it
// is. `METHODOLOGY.md` documents that for a reader with the repository open;
// the file that leaves with the reader documented none of it, so a reviewer
// had to hunt yellow cells across ten tabs and could still only see what was
// assumed, never what it was measured from.
//
// TWO RULES HOLD THIS SHEET TOGETHER.
//
//   1. EVERY VALUE IS A LINK, never a copy. A pasted number is right on the
//      day it is written and wrong the moment a reader edits the assumption it
//      claims to describe — which is exactly when this sheet is being read.
//      Every figure below points at the cell it comes from, so the sheet
//      cannot go stale and cannot disagree with the model beside it.
//
//   2. EVERY BASIS IS THE ENGINE'S OWN, never this file's. The basis text is
//      read from `provenance`, from the declared working-capital drivers, from
//      the amortisation anchor and the capital-spending method — the same
//      places `METHODOLOGY.md` describes. This is the `KI-4` rule applied to
//      prose: a sheet that writes its own account of a rule can describe a
//      rule the engine does not use, and nothing would ever catch it.
//
// WHERE THE ENGINE STATES NO BASIS, THIS SHEET SAYS SO. It does not compose
// one from what the cells appear to show. A dozen figures reach the valuation
// with no recorded basis — stock compensation, the buyback ceiling, the market
// risk premium, the revolver rate — and saying "not recorded" is the finding.
// Inventing a plausible sentence for each would bury it.
//
// The two rightmost columns are headed and left empty on purpose. They belong
// to the judgement layer (`ROADMAP.md` section 2): whether a value is still the
// default or the reader's own, and the reason the reader gave for changing it.
// Reserving the room now means the sheet does not get relaid out later.
function buildAssumptionsSheet(ctx: SupportingSheetsContext) {
  const {
    R, DR, model: M, dcf: D, refused, source, years, nH, nT, FIRST, cOf, L,
    modelSheetName, companyName, newSheet, title, band, label, styleCalc,
    fmt, colors, FONT, UNIT, currencySymbol, wrapText,
  } = ctx;

  const ws = newSheet('Assumptions', colors.OXBLOOD);
  // Wider than the other sheets in two places: the assumption names are
  // sentences, and the basis is a paragraph.
  ws.getColumn(3).width = 46;
  ws.getColumn(4).width = 10;
  ws.getColumn(5).width = 15;
  ws.getColumn(6).width = 15;
  ws.getColumn(7).width = 104;
  ws.getColumn(8).width = 20;
  ws.getColumn(9).width = 34;
  const END = 9;

  title(
    ws,
    `${companyName} - assumptions`,
    'Every assumption the forecast rests on, the value used, and the basis it was derived on. Each value is a live link to ' +
      'the cell it comes from, so this sheet moves when you move it.'
  );

  // The row registry places every model-sheet row; the DCF sheet's are fixed by
  // position (METHODOLOGY.md §22), so they are named once here rather than
  // spelled into each formula below.
  // Read from the one definition of the layout, passed in rather than copied:
  // this sheet used to keep its own numbers, which is the whole trouble with a
  // positional sheet.
  const DCF = {
    riskFree: DR.riskFree, mrp: DR.mrp, assetBeta: DR.assetBeta, beta: DR.equityBeta,
    costOfEquity: DR.costOfEquity, preTaxCostOfDebt: DR.preTaxCostOfDebt, costOfDebt: DR.costOfDebt,
    weightEquity: DR.weightEquity, weightDebt: DR.weightDebt, wacc: DR.wacc, period: DR.period,
    terminalGrowth: DR.growth, exitMultiple: DR.multiple,
    netDebt: DR.netDebt, minority: DR.minority, preferred: DR.preferred,
    shares: DR.shares, price: DR.price,
  };

  const MODEL = `'${modelSheetName}'`;
  const first = L(cOf(nH));
  const last = L(cOf(nT - 1));
  const one = L(FIRST);
  const nF = nT - nH;

  // Header. The two year columns are the first and last forecast year: an
  // assumption held flat reads the same in both, and one that moves — the
  // revenue growth fade — shows where it starts and where it arrives, which is
  // the whole of the rule in two cells.
  ws.getCell(6, 3).value = 'Assumption';
  ws.getCell(6, 4).value = 'Unit';
  ws.getCell(6, 5).value = nF > 0 ? `FY${String(years[nH]).slice(2)}` : 'Value';
  ws.getCell(6, 6).value = nF > 1 ? `FY${String(years[nT - 1]).slice(2)}` : '';
  ws.getCell(6, 7).value = 'The basis it was derived on';
  [3, 4, 5, 6, 7].forEach((c) => {
    const cell = ws.getCell(6, c);
    cell.font = { ...FONT, bold: true };
    cell.alignment = { horizontal: c === 3 || c === 7 ? 'left' : c === 4 ? 'center' : 'right' };
    cell.border = { bottom: { style: 'thin', color: { argb: colors.BLACK } } };
  });
  // RESERVED, NOT BUILT. The judgement layer fills these; the headers hold the
  // room so that adding them later is a change to two columns and not a
  // relayout of the sheet.
  (['Default or yours', "Your reason for changing it"] as string[]).forEach((text, i) => {
    const cell = ws.getCell(6, 8 + i);
    cell.value = text;
    cell.font = { ...FONT, bold: true, italic: true, color: { argb: colors.GREY } };
    cell.border = { bottom: { style: 'thin', color: { argb: colors.GREY } } };
  });

  const P: Record<string, string> = (source?.provenance as Record<string, string>) || {};
  const n0 = (v: any) =>
    isNum(v) ? v.toLocaleString('en-US', { maximumFractionDigits: 0 }) : 'not reported';
  const pct = (v: any, dp = 1) => (isNum(v) ? `${(v * 100).toFixed(dp)}%` : 'not measured');

  // A figure the engine carries no account of. Naming what it was seeded from
  // is not a basis and does not pretend to be one: it says where the number in
  // the cell came from and that nothing states why it is that number.
  const notRecorded = (seededFrom: string) =>
    `NOT RECORDED. The engine states no basis for this figure. ${seededFrom}`;

  let r = 8;

  const heading = (text: string) => {
    band(ws, r, text, colors.OXBLOOD, colors.WHITE, END);
    r++;
  };

  // A note under a band. A single string is wrapped to the width the empty
  // columns to the right of the label give it; an array is already laid out.
  const note = (lines: string | string[]) => {
    (Array.isArray(lines) ? lines : wrapText(lines, 150)).forEach((text) => {
      const cell = ws.getCell(r, 3);
      cell.value = text;
      cell.font = { ...FONT, size: 10, italic: true, color: { argb: colors.GREY } };
      r++;
    });
  };

  /**
   * One assumption. `firstRef` and `lastRef` are formulas pointing at the cells
   * the value actually lives in — never a copy of the value itself.
   */
  const row = (
    name: string,
    unit: string,
    numFmt: string,
    firstRef: string | null,
    lastRef: string | null,
    basis: string
  ) => {
    label(ws, r, name, unit, { indent: 1 });
    ([[5, firstRef], [6, lastRef]] as [number, string | null][]).forEach(([col, ref]) => {
      if (!ref) return;
      const cell = ws.getCell(r, col);
      cell.value = { formula: ref } as any;
      styleCalc(cell, numFmt, { cross: true });
    });
    const b = ws.getCell(r, 7);
    b.value = basis;
    b.font = { ...FONT, size: 10 };
    b.alignment = { wrapText: true, vertical: 'top' };
    r++;
  };

  // A model-sheet row, in the first and last forecast years.
  const mm = (key: string) => (isNum(R[key]) ? [`${MODEL}!${first}${R[key]}`, nF > 1 ? `${MODEL}!${last}${R[key]}` : null] : [null, null]);
  // A DCF-sheet row: one figure for the whole valuation, and nothing at all
  // where the company is refused and that sheet carries the reason instead.
  const dd = (dcfRow: number): string | null => (refused ? null : `DCFModel!${one}${dcfRow}`);

  const modelRow = (name: string, unit: string, numFmt: string, key: string, basis: string) => {
    const [a, b] = mm(key);
    if (a === null) return;
    row(name, unit, numFmt, a, b, basis);
  };

  // ---- THE FORECAST ------------------------------------------------------
  heading('Revenue');
  modelRow(
    'Revenue growth',
    '%',
    fmt.PCT1,
    'revGrowth',
    P.revenueGrowth ||
      notRecorded('The cell holds the growth rate the engine forecast for that year.')
  );
  note(
    'The two columns are the first and last forecast year. Revenue growth is the one assumption that moves between ' +
      'them: it fades in a straight line to the rate the terminal value assumes for ever, so the year being capitalised ' +
      `already grows at the rate the perpetuity continues. Every other assumption below is held flat across the ${nF} ` +
      'forecast years unless its basis says otherwise.'
  );

  heading('Operating margins');
  modelRow(
    'Gross margin, before D&A and SBC',
    '%',
    fmt.PCT1,
    'gm',
    (P.grossMargin || notRecorded('The cell holds the gross margin the engine forecast.')) +
      ' Cost of sales is the balancing line: it is revenue less this margin, not a forecast of its own.'
  );
  modelRow(
    'Research & development, % of revenue',
    '%',
    fmt.PCT1,
    'rndPct',
    P.rnd || notRecorded('The cell holds the share of revenue the engine forecast.')
  );
  modelRow(
    'Selling, general & administrative, % of revenue',
    '%',
    fmt.PCT1,
    'sgaPct',
    P.sga || notRecorded('The cell holds the share of revenue the engine forecast.')
  );
  modelRow(
    'Other operating costs, % of revenue',
    '%',
    fmt.PCT1,
    'otherPct',
    (P.otherOperatingCosts || notRecorded('The cell holds the share of revenue the engine forecast.')) +
      (P.operatingCostReconciliation ? ` This line exists because ${P.operatingCostReconciliation}.` : '')
  );
  modelRow(
    'Stock based compensation, % of revenue',
    '%',
    fmt.PCT1,
    'sbcPct',
    P.stockCompensation || notRecorded('The cell holds the share of revenue the engine charged.')
  );
  modelRow(
    'Other income / (expense), % of revenue',
    '%',
    fmt.PCT1,
    'otherIncPct',
    P.otherIncome || notRecorded('The cell holds the share of revenue the engine forecast.')
  );
  modelRow(
    'Tax rate',
    '%',
    fmt.PCT1,
    'taxRate',
    P.taxRate || notRecorded('The cell holds the effective rate the engine forecast.')
  );
  modelRow(
    'Items after tax',
    UNIT,
    fmt.money(),
    'afterTax',
    'Nil in every forecast year. Non-controlling interests and discontinued operations are carried in the reported ' +
      'years so that reported net income is the filed figure, and nothing in a filing says what either would be in a ' +
      'future year. METHODOLOGY.md §5.'
  );
  if (P.nonCashCharges) note(P.nonCashCharges.charAt(0).toUpperCase() + P.nonCashCharges.slice(1) + '.');

  // ---- PLANT -------------------------------------------------------------
  heading('Capital spending, depreciation and amortisation');
  const capexMethod = M?.capexMethodUsed ?? 'growth';
  modelRow(
    capexMethod === 'percentOfRnD'
      ? 'Capital expenditure, % of research & development'
      : capexMethod === 'growth'
        ? 'Growth in capital expenditure, year on year'
        : 'Capital expenditure, % of revenue',
    '%',
    fmt.PCT1,
    'capexPct',
    P.capex || notRecorded('The cell holds the rate the engine bought plant at.')
  );
  modelRow(
    'Net PP&E, % of revenue',
    '%',
    fmt.PCT1,
    'ppeIntensity',
    'How much plant this company carries for each unit of revenue, averaged across the reported years. The forecast ' +
      'adds plant in that proportion as revenue grows and replaces what wears out separately, so capital spending is ' +
      'split into the two. It works in both directions: a company whose revenue falls releases plant in the same ' +
      'proportion, and total spending is floored at nil because the model does not sell plant for cash. METHODOLOGY.md §7.'
  );
  modelRow(
    'Depreciation, % of the assets in service',
    '%',
    fmt.PCT1,
    'depPct',
    P.depreciation || notRecorded('The cell holds the rate the engine charged.')
  );
  const anchor = M?.amortisationAnchor;
  modelRow(
    'Amortisation of intangibles, a year',
    UNIT,
    fmt.money(),
    'amortAnnual',
    !anchor
      ? notRecorded('The cell holds the annual charge the engine carried.')
      : anchor.notChargedBecause
        ? `Nothing is charged, because ${anchor.notChargedBecause}. Filed depreciation and amortisation are therefore ` +
          'treated as depreciation of plant in full, and none of it runs off.'
        : `${n0(anchor.annual)} a year — the filed amortisation of intangibles for FY${anchor.year}, the last reported ` +
          `year${isNum(anchor.filedAmortisation) ? '' : ', taken as that year\'s filed D&A less the depreciation the forecast charges'}. ` +
          `It is charged flat until the ${n0(anchor.intangiblePool)} of intangible assets reported that year is used up, ` +
          'and nothing replaces it: the forecast buys no intangibles, so persisting the charge would mean an acquisition ' +
          'of that size every year for ever. Other assets fall by the charge, and the terminal value is taken on the ' +
          'business after the run-off is complete. METHODOLOGY.md §8.'
  );
  modelRow(
    'Other movements in plant',
    UNIT,
    fmt.money(),
    'ppeOther',
    'Nil in every forecast year. Disposals, impairments, finance-lease additions, acquisitions and currency moved the ' +
      'reported balance and are shown on their own line there rather than called depreciation; the forecast buys and ' +
      'sells nothing but capital expenditure. METHODOLOGY.md §7.'
  );

  // ---- WORKING CAPITAL ---------------------------------------------------
  //
  // THE BASIS IS THE ENGINE'S DECLARATION, not this sheet's reading of it. The
  // workbook used to name a driver per line in its own code and named three of
  // them wrongly (KI-4); the declaration is read here for the same reason the
  // schedules read it there.
  heading('Working capital');
  const drivers = M?.workingCapitalDriversUsed || {};
  const wcLines: [string, string, string][] = [
    ['ar', 'accountsReceivable', 'Accounts receivable'],
    ['inv', 'inventory', 'Inventory'],
    ['ap', 'accountsPayable', 'Accounts payable'],
    ['acc', 'accruedExpenses', 'Accrued expenses & deferred revenue'],
    ['oca', 'otherCurrentAssets', 'Other current assets'],
    ['dta', 'deferredTaxAssets', 'Deferred tax assets'],
    ['oa', 'otherAssets', 'Other assets'],
    ['oncl', 'otherNonCurrentLiabilities', 'Other non-current liabilities'],
  ];
  for (const [base, modelKey, name] of wcLines) {
    const declared = drivers[modelKey];
    const pctRow = isNum(R[`${base}Pct`]);
    const driverName =
      declared === 'cogs' ? 'cost of sales, as filed' : declared === 'revenue' ? 'revenue' : null;
    const basis = driverName
      ? `${driverName.charAt(0).toUpperCase()}${driverName.slice(1)} is the driver the engine declares for this line, ` +
        'and this sheet reads that declaration rather than naming one of its own — the workbook named three of them ' +
        'wrongly when it did (KI-4). The engine grows the prior year\'s balance at that driver\'s growth rate; the ' +
        'workbook writes the same rule as a ratio, so the cell is the balance over ' +
        `${driverName === 'revenue' ? 'revenue' : 'cost of sales as filed'} and moves with it. METHODOLOGY.md §6.`
      : declared === 'flat'
        ? `The engine declares this line held flat at the last reported balance${base === 'oa' ? ', less the amortisation of intangibles charged against it each year — the movement below excludes that charge, so operating cash flow does not add it back twice' : ''}. ` +
          'The cell is the movement on top of that, which is nil unless you type one. METHODOLOGY.md §6.'
        : notRecorded('The cell holds the movement the forecast carries for this line.');
    modelRow(
      `${name}, ${pctRow ? `% of ${driverName ?? 'its driver'}` : 'additions / (disposals)'}`,
      pctRow ? '%' : UNIT,
      pctRow ? fmt.PCT1 : fmt.money(),
      pctRow ? `${base}Pct` : `${base}Move`,
      basis
    );
  }

  // ---- DEBT, CASH AND THE REVOLVER ---------------------------------------
  heading('Debt, cash and the revolver');
  modelRow(
    'Cash interest rate on debt',
    '%',
    fmt.PCT2,
    'debtRate',
    P.interest
      ? `${P.interest.charAt(0).toUpperCase()}${P.interest.slice(1)}. The rate is charged on the balance the forecast ` +
        'carries — the last reported one held flat — because no free source publishes a maturity ladder and most ' +
        'companies refinance maturing debt. METHODOLOGY.md §9.'
      : notRecorded('The cell holds the rate the engine charged, less any part of it paid in kind.')
  );
  modelRow(
    'PIK interest rate on debt',
    '%',
    fmt.PCT2,
    'pikRate',
    'The share of the interest charge that accrues to the debt balance instead of being paid, so that the add-back in ' +
      'operating cash flow reverses a charge actually made. Nil for every derived company: the filings do not separate ' +
      'paid interest from accrued. METHODOLOGY.md §9.'
  );
  modelRow(
    'Interest rate on the revolver',
    '%',
    fmt.PCT2,
    'revRate',
    "This workbook's own assumption, not the engine's. The site charges no revolver interest at all — its circuit " +
      'breaker is on — so there is no rate on the model to carry across, and a revolver that draws needs one here. It ' +
      'is seeded at the all-in rate on term debt, on the reasoning that a revolving facility from the same lenders to ' +
      'the same borrower is priced near its term debt. Nothing in the filing establishes that, and no valuation rests ' +
      'on it: unlevered free cash flow starts from operating profit, so revolver interest reaches the balance sheet ' +
      'and never the value per share. METHODOLOGY.md §22.'
  );
  modelRow(
    'Return earned on cash',
    '%',
    fmt.PCT2,
    'cashRate',
    'Nil. The engine runs with its circuit breaker on, which means no interest income on cash and no revolver ' +
      'interest, so the income statement closes without iterating. This workbook can charge both — set a rate here ' +
      'and turn the circularity switch on at the top of the model sheet. METHODOLOGY.md §9.'
  );
  modelRow(
    'Additional borrowing / (pay down)',
    UNIT,
    fmt.money(),
    'debtBorrow',
    'Nil in every forecast year: debt is held flat at the last reported balance. No free source publishes a maturity ' +
      'ladder, and the convention this model follows treats straight-lining as the safer treatment where one cannot be ' +
      'seen. METHODOLOGY.md §9.'
  );
  modelRow(
    'Minimum cash balance',
    UNIT,
    fmt.money(),
    'minCash',
    P.minimumCash || notRecorded('The cell holds the floor the engine sized every revolver movement against.')
  );

  // ---- EQUITY ------------------------------------------------------------
  heading('Equity, dividends and shares');
  modelRow(
    'Dividend payout ratio',
    '%',
    fmt.PCT1,
    'payout',
    P.dividends || notRecorded('The cell holds the payout ratio the engine forecast.')
  );
  modelRow(
    'Share repurchases',
    UNIT,
    fmt.money(),
    'buyback',
    P.buybacks || notRecorded('The cell holds the repurchase the engine forecast.')
  );
  modelRow(
    'New share issuances',
    UNIT,
    fmt.money(),
    'csIssue',
    'Nil in every forecast year. Nothing in a filing says what a company will issue, and the dilution that stock ' +
      'compensation causes is carried in the share count rather than here. METHODOLOGY.md §10.'
  );
  modelRow(
    'Other comprehensive income, movement',
    UNIT,
    fmt.money(),
    'ociChg',
    'Nil in every forecast year: the balance is held flat at the last reported one. Currency translation and the other ' +
      'items that move it are not forecastable from a filing. METHODOLOGY.md §10.'
  );

  // ---- HOW INTEREST IS CHARGED -------------------------------------------
  heading('How this workbook computes');
  modelRow(
    'Circularity switch — 1 = average balances, 0 = opening',
    '0 / 1',
    '0',
    'circBreaker',
    'Off by default. Interest is charged on the OPENING balance of cash, term debt and the revolver, so nothing in the ' +
      'workbook depends on a figure it helps produce. Turned on, interest is charged on the average of the opening and ' +
      'closing balances, which is genuinely circular and is why this file keeps iterative calculation on. The engine ' +
      'avoids the loop entirely rather than iterating. The difference to the answer is small. METHODOLOGY.md §22.'
  );
  row(
    'Forecast length',
    'yrs',
    '0',
    // One range, not two references: a cross-sheet range names its sheet once.
    `COUNT(${MODEL}!${first}${R.rev}:${last}${R.rev})`,
    null,
    `${nF} years. The length is a judgement balancing how far a forecast can be trusted against how much value is left ` +
      'to the terminal value. Stretching the fade to seven or ten years lowers the terminal share but raises the value ' +
      'for most companies, and a smaller terminal share bought by assuming a company stays above its steady state for ' +
      'longer is not a better model. METHODOLOGY.md §13.'
  );

  // ---- THE COST OF CAPITAL -----------------------------------------------
  //
  // Refused companies have no DCF sheet to link into: it is replaced by the
  // engine's reason, so every reference below would read an empty cell. The
  // band states that instead of pointing at nothing.
  if (refused) {
    heading('The valuation assumptions');
    note([
      'There is no valuation in this file, so the assumptions that would only feed one — the cost of capital, the',
      'terminal value and the equity bridge — are not listed. The DCF sheet carries the reason in full. Everything',
      'above is built from what the company reported and is unaffected.',
    ]);
  } else {
    heading('The cost of capital');
    row('Risk free rate', '%', fmt.PCT2, dd(DCF.riskFree), null,
      P.riskFreeRate || notRecorded('The cell holds the rate the cost of equity starts from.'));
    row('Market risk premium', '%', fmt.PCT2, dd(DCF.mrp), null,
      'A flat 4.23%, the same for every company, and an assumption rather than a measurement. An equity risk premium ' +
        'is an estimate that reputable people disagree about by two points, not a figure anyone publishes, so there is ' +
        'nothing to derive it from — which makes it a constraint on the data rather than a gap in this model. ' +
        'DATA_CONSTRAINTS.md records it as such, with its own control and its own sensitivity grid.');
    const wd = D?.waccDetail;
    row('Beta', 'x', fmt.PLAIN2, dd(DCF.beta), null,
      (P.wacc ? `${P.wacc.charAt(0).toUpperCase()}${P.wacc.slice(1)}. ` : '') +
        (isNum(wd?.assetBeta)
          ? `The ${wd.assetBeta.toFixed(2)} carried is an ASSET beta — the risk of the business before borrowing — and it ` +
            `is relevered onto this company's own capital structure before the cost of equity is taken from it: asset beta ` +
            `x (1 + (1 - tax) x debt/equity), on debt to equity of ${pct(wd.debtToEquity)}. That is what stops a cheap cost ` +
            'of debt dragging the whole cost of capital below the risk-free rate as leverage rises. METHODOLOGY.md §14.'
          : 'METHODOLOGY.md §14.'));
    row('Cost of equity', '%', fmt.PCT2, dd(DCF.costOfEquity), null,
      'Computed, not assumed: the risk free rate plus beta times the market risk premium, off the three rows above. ' +
        'Change any of them and this moves with it.');
    row('After tax cost of debt', '%', fmt.PCT2, dd(DCF.costOfDebt), null,
      (P.interest ? `${P.interest.charAt(0).toUpperCase()}${P.interest.slice(1)}, ` : '') +
        'tax effected at the forecast rate. A company that owes nothing has no cost of debt, and no is not zero: it is ' +
        'left out of the weighted average rather than carried as 0%. METHODOLOGY.md §14.');
    row('Weight of equity, at market value', '%', fmt.PCT1, dd(DCF.weightEquity), null,
      'Market capitalisation over market capitalisation plus gross debt. Equity is at market value because that is the ' +
        'price this model is comparing itself against anyway.');
    row('Weight of debt, gross and at book value', '%', fmt.PCT1, dd(DCF.weightDebt), null,
      'GROSS debt, not net. A company that borrows 100 and holds 150 in the bank still has 100 of borrowed money in it, ' +
        'costing what it costs; weighting on net debt made that share negative and the whole cost of capital higher ' +
        'than the cost of equity alone, so holding cash made a company worth less. Cash returns in the equity bridge, ' +
        'and netting it here as well would count it twice. Book value because the market value of a company\'s bonds is ' +
        'not in any free source, which is a departure of necessity. METHODOLOGY.md §14.');
    row('Weighted average cost of capital', '%', fmt.PCT2, dd(DCF.wacc), null,
      'Computed from the four rows above.');
    note([
      'THIS DISCOUNT RATE MOVES WITH THE TAX RATE AND THE SHARE PRICE, as the engine does. The asset beta and the cost of',
      'debt before tax are the two figures the engine starts from, so they are the inputs here; the equity beta, the',
      'after tax cost of debt, both weights and the rate itself are computed from them and from the model sheet. Change',
      'the tax rate and the relevering, the tax shield and this rate all follow. Change the share price and the weights do.',
    ]);

    heading('Terminal value');
    row('Growth after the forecast (g)', '%', fmt.PCT1, dd(DCF.terminalGrowth), null,
      P.terminalGrowth || notRecorded('The cell holds the rate the perpetuity grows at for ever.'));
    note(
      M?.revenueGrowthRuleUsed?.method === 'fadeToTerminal'
        ? [
            'MOVING THIS CELL RE-FADES THE WHOLE FORECAST. The revenue growth row on the model sheet runs in a straight line',
            'from its first forecast year to this rate, reaching it in the last, so the year being capitalised already grows',
            'at the rate the perpetuity continues. Only the first forecast year is typed; the rest are that line. Move either',
            'end and the years between follow.',
          ]
        : [
            'This model forecasts each revenue segment on its own path, so there is no single fade for this rate to re-strike.',
            'Moving it changes the terminal value and leaves the forecast growth rates on the model sheet where they are.',
          ]
    );
    row('Exit EBITDA multiple', 'x', fmt.MULT, dd(DCF.exitMultiple), null,
      P.exitMultiple || notRecorded('The cell holds the multiple the last forecast year\'s EBITDA is capitalised at.'));
    row('Discount period, first forecast year', 'yrs', fmt.PLAIN2, dd(DCF.period), null,
      `Mid-year convention, measured from ${D?.valuationDate ?? 'the last reported balance sheet date'}, which is the ` +
        'valuation date. Each year is discounted half a year less than its end because cash arrives through the year ' +
        'rather than in a lump on the last day of it — the same reason depreciation is charged on the opening balance ' +
        'plus half the year\'s additions. The terminal value takes the last explicit year\'s period for the same reason, ' +
        'so one convention runs through both. The value is as at that date and is compared with a price from today. ' +
        'METHODOLOGY.md §13.');

    heading('From enterprise value to one share');
    row('Minority interests', UNIT, fmt.money(), dd(DCF.minority), null,
      P.equityBridge || notRecorded('The cell holds what comes off enterprise value for holders who are not the common shareholders.'));
    row('Preferred stock', UNIT, fmt.money(), dd(DCF.preferred), null,
      'The filing\'s carrying value, at book, because that is what a filing gives. Where the diluted share count already ' +
        'includes the common shares the preferred converts into, nothing comes off: the preferred holders are already in ' +
        'the denominator and taking the balance off as well would count them twice. METHODOLOGY.md §15.');
    row('Net diluted shares outstanding', '# M', fmt.money(), dd(DCF.shares), null,
      'The last reported diluted weighted-average count, rolled forward: shares issued at the average share price, ' +
        'shares repurchased at the same price, with the dilutive increment over basic held at the last reported year\'s. ' +
        'Rebuilding it by the treasury stock method needs option and warrant detail that is not machine-readable. ' +
        'METHODOLOGY.md §10.');
    row('Net debt at the last reported date', UNIT, fmt.money(), dd(DCF.netDebt), null,
      P.netDebt || notRecorded('The cell holds borrowings and the revolver less cash, off the model\'s own balance sheet.'));
    row('Share price', `${currencySymbol}/sh`, fmt.money2(currencySymbol), dd(DCF.price), null,
      'Not an assumption of the model: the last close, carried so the file can state a premium or discount against it. ' +
        'The valuation is struck at the last reported balance sheet date and compared with a price from today, which is ' +
        'stated rather than closed by a guess.');
  }

  r++;
  band(ws, r, 'What this sheet does not yet carry', colors.OXBLOOD, colors.WHITE, END);
  r++;
  note([
    'The two rightmost columns are reserved and empty. When the judgement layer lands, every assumption above becomes a',
    'choice you can make: the value says whether it is still the default or yours, and the reason you give is recorded',
    'beside it and travels with the file. Until then every figure here is the default the engine derived, and the basis',
    'column is the whole of the account it can give.',
    '',
    'A basis marked NOT RECORDED is a gap in the engine, not in this sheet. The figure is real and the model uses it;',
    'what is missing is a statement of what it was measured from, and the gap is written down rather than papered over',
    'with a plausible sentence. A derived company should show none: every assumption above is stated. A hand-built',
    'model carries no provenance at all, so all of them read that way, which is true of it.',
  ]);
}

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
  // Why it is that source and not the one a US ticker would suggest: a foreign
  // private issuer's 20-F is not in the SEC's XBRL company facts, so its
  // figures come from the other source (KI-6).
  if (meta.sourceNote) metaRow('Why this source', meta.sourceNote);
  if (meta.sourceUrl) metaRow('Source URL', meta.sourceUrl);
  if (source?.provenance?.currency) metaRow('Currency and share basis', source.provenance.currency);
  // What the cash in the bridge is made of, and where a securities balance
  // could not be read (deriveModel, provenance.netDebt).
  if (source?.provenance?.netDebt) metaRow('Net debt', source.provenance.netDebt);
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
  buildAssumptionsSheet(ctx);
  buildIncomeStatementSheet(ctx);
  buildBalanceSheetSheet(ctx);
  buildCashFlowSheet(ctx);
  buildAnnexuresSheet(ctx);
  buildRatiosSheet(ctx);
  buildChecksSheet(ctx);
  buildSourcesSheet(ctx);
}

export default { addSupportingSheets };
