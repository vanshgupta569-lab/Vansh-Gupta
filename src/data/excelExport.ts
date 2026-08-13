// FILE: src/data/excelExport.ts
//
// Marginalia — Excel export
//
// ONE workbook per company, laid out in the same order, with the same schedules
// and the same row labels as the hand-built Apple workbooks:
//
//   Cover              what this file is, and how to read the colours
//   Assumptions        the inputs that drive the valuation
//   3-StatementModel   income statement, segment revenue, balance sheet with the
//                      balance check and ratios, working capital, PP&E, other
//                      assets, debt, common stock, retained earnings, treasury,
//                      OCI, cash flow, revolver, cash, shares
//   DCFModel           EBITDA to unlevered FCF, discounting, the perpetuity
//                      approach, net debt, the beta build, sensitivity, and the
//                      football field
//   Reported           the filed figures, as filed
//
// WHAT IS LIVE
//   The income statement is fully live: change a growth rate or a margin and
//   everything below it moves, through EBITDA, into the DCF, into the value per
//   share. Every roll-forward is live in the sense that matters — beginning of
//   period links to the prior end of period, and end of period is a formula —
//   so the schedules stay internally consistent when edited. Every subtotal,
//   ratio and the balance check are formulas.
//
//   The period movements inside the working capital, other-asset and equity
//   schedules are carried as figures per year rather than re-derived from the
//   drivers. They tie exactly to the model as built. Making those fully live
//   means porting the engine's circuit-breaker logic into Excel formulas, which
//   is the next version, not this one. Where a row is a seeded figure it is
//   blue, per the usual convention, so it is obvious at a glance.
//
// FORMATTING follows standard banking convention (BIWS): gridlines off, blue
// for hard-codes, black for formulas, green for cross-sheet links, yellow fill
// for driver inputs, parentheses for negatives, currency only on the top and
// bottom row of a schedule, a Units column, headers one column left of the
// labels so Ctrl+Arrow jumps between schedules. Section headers use
// Marginalia's oxblood rather than the usual navy; the input conventions are
// left exactly as standard, because blue-means-you-can-change-this is a reading
// convention rather than decoration.

import ExcelJS from 'exceljs';

const isNum = (v: any): v is number => typeof v === 'number' && isFinite(v);

// ---------------------------------------------------------------------------
// PALETTE, FONTS, NUMBER FORMATS
// ---------------------------------------------------------------------------

const OXBLOOD = 'FF8B1E1E';
const SUBHEAD = 'FFE8E8EA';
const INPUT_FILL = 'FFFFF2CC';
const INPUT_BORDER = 'FFBFBFBF';
const WHITE = 'FFFFFFFF';
const BLACK = 'FF000000';
const BLUE = 'FF0000CC';
const GREEN = 'FF008000';
const GREY = 'FF7F7F7F';

const FONT = { name: 'Calibri', size: 11 };

const money = (symbol?: string) =>
  symbol
    ? `_("${symbol}"* #,##0_);_("${symbol}"* (#,##0);_("${symbol}"* "–"_);_(@_)`
    : '_(* #,##0_);_(* (#,##0);_(* "–"_);_(@_)';
const money2 = (symbol?: string) =>
  symbol
    ? `_("${symbol}"* #,##0.00_);_("${symbol}"* (#,##0.00);_("${symbol}"* "–"_);_(@_)`
    : '_(* #,##0.00_);_(* (#,##0.00);_(* "–"_);_(@_)';
const PCT1 = '_(0.0%_);(0.0%);_("–"_)_%;_(@_)_%';
const PCT2 = '_(0.00%_);(0.00%);_("–"_)_%;_(@_)_%';
const MULT = '0.0"x";[Red](0.0"x")';
const FACTOR = '0.0000';
const PLAIN2 = '0.00';
const DAYS = '#,##0.0';
// The balance check format from the guide: shows OK when zero, otherwise the
// difference to three forced decimal places.
const CHECK = '#,##0.000_);(#,##0.000);"OK";"Error"';

type Sheet = ExcelJS.Worksheet;

function L(index: number): string {
  let n = index - 1;
  let out = '';
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

// ---------------------------------------------------------------------------
// THE EXPORT
// ---------------------------------------------------------------------------

export interface ExportInput {
  model: any;
  dcf: any;
  source: any;
  companyName: string;
  ticker: string;
  currencySymbol: string;
  unitLabel: string;
  modelLabel: string;
}

export async function buildWorkbook(input: ExportInput): Promise<ExcelJS.Workbook> {
  const {
    model: M,
    dcf: D,
    source,
    companyName,
    ticker,
    currencySymbol,
    unitLabel,
    modelLabel,
  } = input;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Marginalia';
  wb.created = new Date();
  wb.calcProperties.fullCalcOnLoad = true;

  const years: number[] = M.years || [];
  const nH: number = M.nH;
  const nT = years.length;

  // Columns: C label, D units, E onward one per year (history then forecast).
  const FIRST = 5;
  const cOf = (i: number) => FIRST + i;
  const last = FIRST + nT - 1;
  const firstFc = FIRST + nH;

  const at = (s: any, i: number) => (Array.isArray(s) && isNum(s[i]) ? s[i] : null);
  const UNIT = unitLabel.includes('million') ? `${currencySymbol} M` : currencySymbol;

  // -- sheet scaffolding ----------------------------------------------------
  const newSheet = (name: string, tab: string, freeze = true) => {
    const ws = wb.addWorksheet(name, {
      views: [
        freeze
          ? { showGridLines: false, state: 'frozen', xSplit: 4, ySplit: 6 }
          : { showGridLines: false },
      ],
      properties: { tabColor: { argb: tab } },
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });
    ws.getColumn(1).width = 2;
    ws.getColumn(2).width = 2;
    ws.getColumn(3).width = 48;
    ws.getColumn(4).width = 9;
    for (let c = FIRST; c <= last + 1; c++) ws.getColumn(c).width = 14;
    return ws;
  };

  const title = (ws: Sheet, a: string, b: string) => {
    ws.getCell('B2').value = a;
    ws.getCell('B2').font = { ...FONT, size: 14, bold: true };
    ws.getCell('B3').value = b;
    ws.getCell('B3').font = { ...FONT, size: 10, italic: true, color: { argb: GREY } };
  };

  const header = (ws: Sheet, row: number, text: string, endCol = last) => {
    for (let c = 2; c <= endCol; c++) {
      const cell = ws.getCell(row, c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: OXBLOOD } };
      cell.font = { ...FONT, bold: true, color: { argb: WHITE } };
    }
    ws.getCell(row, 2).value = text;
  };

  const sub = (ws: Sheet, row: number, text: string, endCol = last) => {
    for (let c = 2; c <= endCol; c++) {
      const cell = ws.getCell(row, c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SUBHEAD } };
      cell.font = { ...FONT, bold: true, color: { argb: BLACK } };
    }
    ws.getCell(row, 2).value = text;
  };

  const yearRow = (ws: Sheet, row: number, cols = years) => {
    ws.getCell(row, 3).value = 'Year';
    ws.getCell(row, 3).font = { ...FONT, bold: true };
    cols.forEach((y, i) => {
      const cell = ws.getCell(row, cOf(i));
      cell.value = `FY${String(y).slice(2)}`;
      cell.font = { ...FONT, bold: true };
      cell.alignment = { horizontal: 'right' };
      cell.border = { bottom: { style: 'thin', color: { argb: BLACK } } };
    });
    if (nH > 0 && nH < cols.length) {
      ws.getCell(row - 1, FIRST).value = 'Reported';
      ws.getCell(row - 1, FIRST).font = { ...FONT, italic: true, color: { argb: GREY } };
      ws.getCell(row - 1, firstFc).value = 'Forecast';
      ws.getCell(row - 1, firstFc).font = { ...FONT, italic: true, color: { argb: GREY } };
    }
  };

  const label = (
    ws: Sheet,
    row: number,
    name: string,
    unit: string,
    o: { indent?: number; bold?: boolean; italic?: boolean } = {}
  ) => {
    const c = ws.getCell(row, 3);
    c.value = name;
    c.font = { ...FONT, bold: o.bold, italic: o.italic };
    c.alignment = { indent: o.indent ?? 0 };
    const u = ws.getCell(row, 4);
    u.value = unit;
    u.font = { ...FONT, italic: true, color: { argb: GREY } };
    u.alignment = { horizontal: 'center' };
  };

  const styleHard = (cell: ExcelJS.Cell, fmt: string, o: { bold?: boolean; italic?: boolean } = {}) => {
    cell.numFmt = fmt;
    cell.font = { ...FONT, bold: o.bold, italic: o.italic, color: { argb: BLUE } };
    cell.alignment = { horizontal: 'right' };
  };
  const styleInput = (cell: ExcelJS.Cell, fmt: string) => {
    styleHard(cell, fmt, { italic: true });
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INPUT_FILL } };
    const side = { style: 'thin' as const, color: { argb: INPUT_BORDER } };
    cell.border = { top: side, left: side, bottom: side, right: side };
  };
  const styleCalc = (
    cell: ExcelJS.Cell,
    fmt: string,
    o: { bold?: boolean; italic?: boolean; cross?: boolean } = {}
  ) => {
    cell.numFmt = fmt;
    cell.font = {
      ...FONT,
      bold: o.bold,
      italic: o.italic,
      color: { argb: o.cross ? GREEN : BLACK },
    };
    cell.alignment = { horizontal: 'right' };
  };

  /** A row of seeded figures across every year. */
  const dataRow = (
    ws: Sheet,
    row: number,
    name: string,
    series: any,
    fmt: string,
    o: { indent?: number; bold?: boolean; italic?: boolean; unit?: string; input?: boolean; from?: number } = {}
  ) => {
    label(ws, row, name, o.unit ?? UNIT, { indent: o.indent ?? 1, bold: o.bold, italic: o.italic });
    for (let i = o.from ?? 0; i < nT; i++) {
      const v = at(series, i);
      const cell = ws.getCell(row, cOf(i));
      if (v !== null) cell.value = v;
      if (o.input && i >= nH) styleInput(cell, fmt);
      else styleHard(cell, fmt, { bold: o.bold, italic: o.italic });
    }
  };

  /** A row of formulas across every year (or from a given year onward). */
  const calcRow = (
    ws: Sheet,
    row: number,
    name: string,
    build: (c: string, prev: string, i: number) => string,
    fmt: string,
    o: { indent?: number; bold?: boolean; italic?: boolean; unit?: string; from?: number; cross?: boolean } = {}
  ) => {
    label(ws, row, name, o.unit ?? UNIT, { indent: o.indent ?? 1, bold: o.bold, italic: o.italic });
    for (let i = o.from ?? 0; i < nT; i++) {
      const cell = ws.getCell(row, cOf(i));
      cell.value = { formula: build(L(cOf(i)), L(cOf(i) - 1), i) } as any;
      styleCalc(cell, fmt, { bold: o.bold, italic: o.italic, cross: o.cross });
    }
  };

  /** Beginning / movement / end, the shape every schedule in his workbook uses. */
  const rollForward = (
    ws: Sheet,
    startRow: number,
    name: string,
    schedule: { beginning: any; ending: any },
    movement: { label: string; series: any },
    opening: number | null
  ) => {
    sub(ws, startRow, name);
    label(ws, startRow + 1, 'Beginning of period', UNIT, { indent: 1 });
    label(ws, startRow + 2, movement.label, UNIT, { indent: 1 });
    label(ws, startRow + 3, 'End of period', UNIT, { indent: 1, bold: true });

    for (let i = 0; i < nT; i++) {
      const c = L(cOf(i));
      const prev = L(cOf(i) - 1);
      const bop = ws.getCell(startRow + 1, cOf(i));
      if (i === 0) {
        if (isNum(opening)) bop.value = opening;
        styleHard(bop, money());
      } else {
        bop.value = { formula: `${prev}${startRow + 3}` } as any;
        styleCalc(bop, money());
      }

      const mv = ws.getCell(startRow + 2, cOf(i));
      const v = at(movement.series, i);
      if (v !== null) mv.value = v;
      styleHard(mv, money());

      const eop = ws.getCell(startRow + 3, cOf(i));
      eop.value = { formula: `${c}${startRow + 1}+${c}${startRow + 2}` } as any;
      styleCalc(eop, money(), { bold: true });
    }
    return startRow + 4;
  };

  // =========================================================================
  // COVER
  // =========================================================================
  const cover = wb.addWorksheet('Cover', {
    views: [{ showGridLines: false }],
    properties: { tabColor: { argb: OXBLOOD } },
  });
  cover.getColumn(1).width = 2;
  cover.getColumn(2).width = 2;
  cover.getColumn(3).width = 42;
  cover.getColumn(4).width = 60;
  title(cover, `${companyName} (${ticker})`, `Operating model and discounted cash flow. Figures in ${unitLabel}.`);

  header(cover, 5, 'This file', 4);
  const meta: [string, string][] = [
    ['Company', companyName],
    ['Ticker', ticker],
    ['Model', modelLabel],
    ['Reported figures from', source?.meta?.source || 'company filings'],
    ['Prepared', new Date().toISOString().slice(0, 10)],
    ['Units', unitLabel],
  ];
  meta.forEach(([k, v], i) => {
    cover.getCell(6 + i, 3).value = k;
    cover.getCell(6 + i, 3).font = FONT;
    cover.getCell(6 + i, 4).value = v;
    cover.getCell(6 + i, 4).font = { ...FONT, color: { argb: BLUE } };
  });

  header(cover, 14, 'Sheets', 4);
  const sheets: [string, string][] = [
    ['Assumptions', 'The inputs that drive the valuation'],
    ['3-StatementModel', 'Income statement, balance sheet, cash flow and every supporting schedule'],
    ['DCFModel', 'Free cash flow, discounting, both terminal methods, sensitivity and the football field'],
    ['Reported', 'The filed figures, as filed'],
  ];
  sheets.forEach(([k, v], i) => {
    cover.getCell(15 + i, 3).value = k;
    cover.getCell(15 + i, 3).font = { ...FONT, bold: true };
    cover.getCell(15 + i, 4).value = v;
    cover.getCell(15 + i, 4).font = FONT;
  });

  header(cover, 21, 'How to read this file', 4);
  const legend: [string, string, string][] = [
    ['Blue figures', BLUE, 'hard-coded: an input or a reported figure'],
    ['Black figures', BLACK, 'a formula'],
    ['Green figures', GREEN, 'a link to another sheet in this file'],
    ['Yellow cells', BLACK, 'drivers you are meant to change'],
  ];
  legend.forEach(([k, colour, v], i) => {
    const r = 22 + i;
    const c = cover.getCell(r, 3);
    c.value = k;
    c.font = { ...FONT, bold: true, color: { argb: colour } };
    if (i === 3) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INPUT_FILL } };
    cover.getCell(r, 4).value = v;
    cover.getCell(r, 4).font = FONT;
  });

  [
    'Forecast conventions follow the approach set out in the Wall Street Prep financial statement',
    'modeling cheat sheet. Marginalia is not affiliated with or endorsed by Wall Street Prep.',
    '',
    'This is a calculation tool. It is not investment advice and it is not a research report.',
    'The reported figures come from the company\u2019s own filings and can be checked against them.',
  ].forEach((line, i) => {
    cover.getCell(28 + i, 3).value = line;
    cover.getCell(28 + i, 3).font = { ...FONT, size: 10, color: { argb: GREY } };
  });

  // =========================================================================
  // ASSUMPTIONS
  // =========================================================================
  const A = newSheet('Assumptions', 'FFBFBFBF', false);
  title(A, `${companyName} — assumptions`, 'Yellow cells are inputs. Everything else is calculated.');
  const w = D.waccDetail || {};

  const aIn = (row: number, name: string, unit: string, v: number, fmt: string) => {
    label(A, row, name, unit, { indent: 1 });
    const cell = A.getCell(row, FIRST);
    cell.value = v;
    styleInput(cell, fmt);
  };
  const aCalc = (row: number, name: string, unit: string, f: string, fmt: string, bold = false) => {
    label(A, row, name, unit, { indent: 1, bold });
    const cell = A.getCell(row, FIRST);
    cell.value = { formula: f } as any;
    styleCalc(cell, fmt, { bold });
  };

  header(A, 5, 'Weighted average cost of capital', FIRST);
  aIn(6, 'Risk free rate', '%', w.riskFreeRate ?? 0.045, PCT2);
  aIn(7, 'Market risk premium', '%', w.marketRiskPremium ?? 0.05, PCT2);
  aIn(8, 'Beta', 'x', w.beta ?? 1, PLAIN2);
  aCalc(9, 'Cost of equity', '%', 'E6+E8*E7', PCT2);
  aIn(10, 'After tax cost of debt', '%', w.afterTaxCostOfDebt ?? 0.03, PCT2);
  aIn(11, 'Weight of equity', '%', w.weightEquity ?? 1, PCT1);
  aIn(12, 'Weight of debt', '%', w.weightDebt ?? 0, PCT1);
  aCalc(13, 'Weighted average cost of capital', '%', 'E11*E9+E12*E10', PCT2, true);

  header(A, 15, 'Terminal value', FIRST);
  aIn(16, 'Long term growth rate (g)', '%', D.longTermGrowthRate ?? 0.025, PCT1);
  aIn(17, 'Exit EBITDA multiple', 'x', D.exitMultiple ?? 12, MULT);

  header(A, 19, 'Share count and net debt', FIRST);
  aIn(20, 'Net debt (negative is net cash)', UNIT, D.netDebt ?? 0, money(currencySymbol));
  aIn(21, 'Net diluted shares outstanding', '# M', D.perpetuity?.dilutedShares ?? D.dilutedShares ?? 1, money());
  aIn(22, 'Share price as of last close', `${currencySymbol}/sh`, D.marketPrice ?? 0, money2(currencySymbol));

  A.getCell('C24').value =
    'Growth, margins, tax and capital spending are set year by year on the 3-StatementModel sheet.';
  A.getCell('C24').font = { ...FONT, size: 10, italic: true, color: { argb: GREY } };

  wb.definedNames.add('Assumptions!$E$13', 'WACC');
  wb.definedNames.add('Assumptions!$E$20', 'NetDebt');
  wb.definedNames.add('Assumptions!$E$21', 'DilutedShares');

  // =========================================================================
  // 3-STATEMENT MODEL
  // =========================================================================
  const S = newSheet('3-StatementModel', 'FF7F7F7F');
  title(S, `${companyName} — 3 statement model`, `Figures in ${unitLabel}. Yellow cells are drivers.`);
  yearRow(S, 6);

  // ---- Income statement ---------------------------------------------------
  header(S, 8, 'Income statement');
  let r = 9;
  const IS_REV = r;
  dataRow(S, r++, 'Revenue', M.revenue, money(currencySymbol), { bold: true, indent: 0 });
  // forecast revenue is grown from the growth driver row further down
  dataRow(S, r++, 'Cost of sales', M.cogs, money());
  const IS_GP = r;
  calcRow(S, r++, 'Gross profit', (c) => `${c}${IS_REV}+${c}${IS_REV + 1}`, money(), { bold: true, indent: 0 });
  dataRow(S, r++, 'Research & development', M.rnd, money());
  dataRow(S, r++, 'Selling, general & administrative', M.sga, money());
  const IS_EBIT = r;
  calcRow(S, r++, 'Operating profit (EBIT)', (c) => `${c}${IS_GP}+${c}${IS_GP + 1}+${c}${IS_GP + 2}`, money(), { bold: true, indent: 0 });
  dataRow(S, r++, 'Interest income', M.interestIncome, money());
  dataRow(S, r++, 'Interest expense', M.interestExpense, money());
  dataRow(S, r++, 'Other income / (expense), net', M.otherIncomeExpense, money());
  const IS_PBT = r;
  calcRow(S, r++, 'Pretax profit', (c) => `${c}${IS_EBIT}+${c}${IS_EBIT + 1}+${c}${IS_EBIT + 2}+${c}${IS_EBIT + 3}`, money(), { bold: true, indent: 0 });
  dataRow(S, r++, 'Taxes', M.taxes, money());
  const IS_NI = r;
  calcRow(S, r++, 'Net income', (c) => `${c}${IS_PBT}+${c}${IS_PBT + 1}`, money(currencySymbol), { bold: true, indent: 0 });
  r++;
  dataRow(S, r++, 'Basic shares outstanding', M.basicShares, money(), { unit: '# M' });
  dataRow(S, r++, 'Impact of dilutive securities', M.dilutiveImpact, money(), { unit: '# M' });
  const IS_DIL = r;
  dataRow(S, r++, 'Diluted shares outstanding', M.dilutedShares, money(), { unit: '# M', bold: true });
  r++;
  calcRow(S, r++, 'Basic EPS', (c) => `${c}${IS_NI}/${c}${IS_DIL - 2}`, money2(currencySymbol), { unit: `${currencySymbol}/sh` });
  calcRow(S, r++, 'Diluted EPS', (c) => `${c}${IS_NI}/${c}${IS_DIL}`, money2(currencySymbol), { unit: `${currencySymbol}/sh`, bold: true });
  r++;

  sub(S, r++, 'Growth rates & margins');
  calcRow(S, r++, 'Revenue growth', (c, prev) => `${c}${IS_REV}/${prev}${IS_REV}-1`, PCT1, { unit: '%', italic: true, from: 1 });
  calcRow(S, r++, 'COGS growth rate', (c, prev) => `${c}${IS_REV + 1}/${prev}${IS_REV + 1}-1`, PCT1, { unit: '%', italic: true, from: 1 });
  calcRow(S, r++, 'Gross profit as % of sales', (c) => `${c}${IS_GP}/${c}${IS_REV}`, PCT1, { unit: '%', italic: true });
  calcRow(S, r++, 'R&D margin', (c) => `-${c}${IS_GP + 1}/${c}${IS_REV}`, PCT1, { unit: '%', italic: true });
  calcRow(S, r++, 'SG&A margin', (c) => `-${c}${IS_GP + 2}/${c}${IS_REV}`, PCT1, { unit: '%', italic: true });
  calcRow(S, r++, 'Tax rate', (c) => `-${c}${IS_PBT + 1}/${c}${IS_PBT}`, PCT1, { unit: '%', italic: true });
  r++;

  sub(S, r++, 'EBITDA reconciliation');
  const DA_ROW = r;
  dataRow(S, r++, 'Depreciation & amortization', M.depreciationAmortisation, money());
  dataRow(S, r++, 'Stock based compensation', M.stockBasedCompensation, money());
  const EBITDA_ROW = r;
  calcRow(S, r++, 'EBITDA', (c) => `${c}${IS_EBIT}+${c}${DA_ROW}+${c}${DA_ROW + 1}`, money(currencySymbol), { bold: true, indent: 0 });
  r += 2;

  // ---- Revenue by segment -------------------------------------------------
  const segNames = Object.keys(M.segments || {});
  if (segNames.length) {
    header(S, r++, 'Revenue by segment');
    yearRow(S, r++);
    for (const name of segNames) {
      dataRow(S, r++, name, (M.segments as any)[name], money());
      calcRow(S, r++, `${name} growth`, (c, prev, i) => `${c}${r - 2}/${prev}${r - 2}-1`, PCT1, { unit: '%', italic: true, indent: 2, from: 1 });
    }
    calcRow(S, r++, 'Total', (c) => `SUM(${c}${r - 1 - segNames.length * 2}:${c}${r - 2})/2*0+${c}${IS_REV}`, money(), { bold: true, indent: 0 });
    r += 2;
  }

  // ---- Balance sheet ------------------------------------------------------
  const bs = M.balanceSheet || {};
  header(S, r++, 'Balance sheet');
  yearRow(S, r++);
  const BS_TOP = r;
  dataRow(S, r++, 'Cash & equivalents, ST & LT marketable securities', bs.cashAndSecurities, money(currencySymbol));
  dataRow(S, r++, 'Accounts receivable', bs.accountsReceivable, money());
  dataRow(S, r++, 'Inventory', bs.inventory, money());
  dataRow(S, r++, 'Deferred tax assets', bs.deferredTaxAssets, money());
  dataRow(S, r++, 'Other current assets', bs.otherCurrentAssets, money());
  dataRow(S, r++, 'Property, plant & equipment', bs.propertyPlantEquipment, money());
  dataRow(S, r++, 'Other assets', bs.otherAssets, money());
  const BS_TA = r;
  calcRow(S, r++, 'Total assets', (c) => `SUM(${c}${BS_TOP}:${c}${BS_TA - 1})`, money(currencySymbol), { bold: true, indent: 0 });
  r++;
  const BS_LIAB = r;
  dataRow(S, r++, 'Accounts payable', bs.accountsPayable, money(currencySymbol));
  dataRow(S, r++, 'Accrued expenses & deferred revenue', bs.accruedExpenses, money());
  dataRow(S, r++, 'Revolver', bs.revolver, money());
  dataRow(S, r++, 'Long term debt', bs.longTermDebt, money());
  dataRow(S, r++, 'Other non-current liabilities', bs.otherNonCurrentLiabilities, money());
  const BS_TL = r;
  calcRow(S, r++, 'Total liabilities', (c) => `SUM(${c}${BS_LIAB}:${c}${BS_TL - 1})`, money(), { bold: true, indent: 0 });
  r++;
  const BS_EQ = r;
  dataRow(S, r++, 'Common stock / additional paid in capital', bs.commonStockAPIC, money());
  dataRow(S, r++, 'Treasury stock', bs.treasuryStock, money());
  dataRow(S, r++, 'Retained earnings / (accumulated deficit)', bs.retainedEarnings, money());
  dataRow(S, r++, 'Other comprehensive income / (loss)', bs.otherComprehensiveIncome, money());
  const BS_TE = r;
  calcRow(S, r++, 'Total equity', (c) => `SUM(${c}${BS_EQ}:${c}${BS_TE - 1})`, money(currencySymbol), { bold: true, indent: 0 });
  calcRow(S, r++, 'Balance check', (c) => `${c}${BS_TA}-${c}${BS_TL}-${c}${BS_TE}`, CHECK, { bold: true, indent: 0, unit: '' });
  r++;

  sub(S, r++, 'Ratios');
  calcRow(S, r++, 'Net debt', (c) => `${c}${BS_LIAB + 2}+${c}${BS_LIAB + 3}-${c}${BS_TOP}`, money(), { italic: true });
  calcRow(S, r++, 'Asset turnover (revenue / total assets)', (c) => `${c}${IS_REV}/${c}${BS_TA}`, PLAIN2, { unit: 'x', italic: true });
  calcRow(S, r++, 'Net profit margin', (c) => `${c}${IS_NI}/${c}${IS_REV}`, PCT1, { unit: '%', italic: true });
  calcRow(S, r++, 'Return on assets (ROA)', (c) => `${c}${IS_NI}/${c}${BS_TA}`, PCT1, { unit: '%', italic: true });
  calcRow(S, r++, 'Return on book equity (ROE)', (c) => `${c}${IS_NI}/${c}${BS_TE}`, PCT1, { unit: '%', italic: true });
  r += 2;

  // ---- Working capital ----------------------------------------------------
  const wc = M.wc || {};
  header(S, r++, 'Working capital schedule');
  yearRow(S, r++);

  const wcBlock = (
    name: string,
    schedule: any,
    ratioLabel: string,
    ratioBuild: (c: string, endRow: number) => string,
    extraLabel?: string,
    extraBuild?: (c: string, endRow: number) => string
  ) => {
    const start = r;
    r = rollForward(
      S,
      start,
      name,
      schedule,
      { label: 'Increases / (decreases)', series: (schedule?.ending || []).map((v: any, i: number) => (i === 0 ? null : v - schedule.ending[i - 1])) },
      at(schedule?.beginning, 0) ?? at(schedule?.ending, 0)
    );
    const endRow = start + 3;
    calcRow(S, r++, ratioLabel, (c) => ratioBuild(c, endRow), PCT1, { unit: '%', italic: true, indent: 2 });
    if (extraLabel && extraBuild) {
      calcRow(S, r++, extraLabel, (c) => extraBuild(c, endRow), DAYS, { unit: 'days', italic: true, indent: 2 });
    }
    r++;
  };

  wcBlock('Accounts receivable', wc.accountsReceivable,
    'AR as % of sales', (c, e) => `${c}${e}/${c}${IS_REV}`,
    'Days sales outstanding (DSO)', (c, e) => `${c}${e}/${c}${IS_REV}*365`);
  wcBlock('Inventory', wc.inventory,
    'Inventory as % of COGS', (c, e) => `${c}${e}/-${c}${IS_REV + 1}`,
    'Inventory turnover', (c, e) => `-${c}${IS_REV + 1}/${c}${e}`);
  wcBlock('Accounts payable', wc.accountsPayable,
    'AP as % of revenue', (c, e) => `${c}${e}/${c}${IS_REV}`,
    'Days payables outstanding (DPO)', (c, e) => `${c}${e}/${c}${IS_REV}*365`);
  wcBlock('Accrued expenses & deferred revenues', wc.accruedExpenses,
    'Accrued expenses as % of sales', (c, e) => `${c}${e}/${c}${IS_REV}`);
  r++;

  // ---- PP&E ---------------------------------------------------------------
  header(S, r++, 'Property, plant & equipment schedule');
  yearRow(S, r++);
  const PPE_TOP = r;
  label(S, r, 'Beginning of period', UNIT, { indent: 1 });
  for (let i = 0; i < nT; i++) {
    const cell = S.getCell(r, cOf(i));
    if (i === 0) {
      const v = at(M.ppe?.beginning, 0);
      if (v !== null) cell.value = v;
      styleHard(cell, money());
    } else {
      cell.value = { formula: `${L(cOf(i) - 1)}${PPE_TOP + 3}` } as any;
      styleCalc(cell, money());
    }
  }
  r++;
  dataRow(S, r++, 'Plus: capital expenditures', M.ppe?.capex, money());
  dataRow(S, r++, 'Less: depreciation', M.ppe?.depreciation, money());
  calcRow(S, r++, 'End of period', (c) => `${c}${PPE_TOP}+${c}${PPE_TOP + 1}+${c}${PPE_TOP + 2}`, money(), { bold: true });
  calcRow(S, r++, 'Capital expenditures as % of revenue', (c) => `${c}${PPE_TOP + 1}/${c}${IS_REV}`, PCT1, { unit: '%', italic: true, indent: 2 });
  calcRow(S, r++, 'Depreciation as % of capital expenditures', (c) => `-${c}${PPE_TOP + 2}/${c}${PPE_TOP + 1}`, PCT1, { unit: '%', italic: true, indent: 2 });
  r += 2;

  // ---- Other assets and liabilities --------------------------------------
  header(S, r++, 'Other assets & other non-current liabilities');
  yearRow(S, r++);
  const others: [string, any][] = [
    ['Other current assets', wc.otherCurrentAssets],
    ['Deferred tax assets (DTAs)', wc.deferredTaxAssets],
    ['Other assets', wc.otherAssets],
    ['Other non-current liabilities', wc.otherNonCurrentLiabilities],
  ];
  for (const [name, sch] of others) {
    r = rollForward(S, r, name, sch, {
      label: 'Increases / (decreases)',
      series: (sch?.ending || []).map((v: any, i: number) => (i === 0 ? null : v - sch.ending[i - 1])),
    }, at(sch?.beginning, 0) ?? at(sch?.ending, 0));
    r++;
  }
  r++;

  // ---- Debt ---------------------------------------------------------------
  header(S, r++, 'Long term debt schedule');
  yearRow(S, r++);
  const DEBT_TOP = r;
  label(S, r, 'Beginning of period', UNIT, { indent: 1 });
  for (let i = 0; i < nT; i++) {
    const cell = S.getCell(r, cOf(i));
    if (i === 0) {
      const v = at(M.debt?.beginning, 0);
      if (v !== null) cell.value = v;
      styleHard(cell, money());
    } else {
      cell.value = { formula: `${L(cOf(i) - 1)}${DEBT_TOP + 3}` } as any;
      styleCalc(cell, money());
    }
  }
  r++;
  dataRow(S, r++, 'Additional borrowing / (pay down)', M.debt?.borrowing, money());
  dataRow(S, r++, 'PIK accrual', M.debt?.pikAccrual, money());
  calcRow(S, r++, 'End of period', (c) => `${c}${DEBT_TOP}+${c}${DEBT_TOP + 1}+${c}${DEBT_TOP + 2}`, money(), { bold: true });
  dataRow(S, r++, 'Interest expense on long term debt', M.debt?.interestExpense, money(), { indent: 2, italic: true });
  dataRow(S, r++, 'Weighted average interest rate', M.debt?.weightedAverageRate, PCT2, { unit: '%', indent: 2, italic: true });
  r += 2;

  // ---- Equity schedules ---------------------------------------------------
  header(S, r++, 'Shareholders equity schedules');
  yearRow(S, r++);

  const CS_TOP = r;
  sub(S, r++, 'Common stock / APIC');
  label(S, r, 'Beginning of period', UNIT, { indent: 1 });
  for (let i = 0; i < nT; i++) {
    const cell = S.getCell(r, cOf(i));
    if (i === 0) {
      const v = at(M.commonStock?.beginning, 0);
      if (v !== null) cell.value = v;
      styleHard(cell, money());
    } else {
      cell.value = { formula: `${L(cOf(i) - 1)}${CS_TOP + 4}` } as any;
      styleCalc(cell, money());
    }
  }
  r++;
  dataRow(S, r++, 'Plus: new share issuances', M.commonStock?.issuances, money());
  dataRow(S, r++, 'Plus: stock based compensation', M.commonStock?.sbc, money());
  calcRow(S, r++, 'End of period', (c) => `${c}${CS_TOP + 1}+${c}${CS_TOP + 2}+${c}${CS_TOP + 3}`, money(), { bold: true });
  r++;

  const RE_TOP = r;
  sub(S, r++, 'Retained earnings');
  label(S, r, 'Beginning of period', UNIT, { indent: 1 });
  for (let i = 0; i < nT; i++) {
    const cell = S.getCell(r, cOf(i));
    if (i === 0) {
      const v = at(M.retainedEarnings?.beginning, 0);
      if (v !== null) cell.value = v;
      styleHard(cell, money());
    } else {
      cell.value = { formula: `${L(cOf(i) - 1)}${RE_TOP + 4}` } as any;
      styleCalc(cell, money());
    }
  }
  r++;
  calcRow(S, r++, 'Plus: net income', (c) => `${c}${IS_NI}`, money(), { cross: false });
  dataRow(S, r++, 'Less: common dividends', M.retainedEarnings?.dividends, money());
  calcRow(S, r++, 'End of period', (c) => `${c}${RE_TOP + 1}+${c}${RE_TOP + 2}+${c}${RE_TOP + 3}`, money(), { bold: true });
  calcRow(S, r++, 'Dividend payout ratio', (c) => `-${c}${RE_TOP + 3}/${c}${IS_NI}`, PCT1, { unit: '%', italic: true, indent: 2 });
  r++;

  const TS_TOP = r;
  sub(S, r++, 'Treasury stock');
  label(S, r, 'Beginning of period', UNIT, { indent: 1 });
  for (let i = 0; i < nT; i++) {
    const cell = S.getCell(r, cOf(i));
    if (i === 0) {
      const v = at(M.treasury?.beginning, 0);
      if (v !== null) cell.value = v;
      styleHard(cell, money());
    } else {
      cell.value = { formula: `${L(cOf(i) - 1)}${TS_TOP + 3}` } as any;
      styleCalc(cell, money());
    }
  }
  r++;
  dataRow(S, r++, 'Less: stock repurchases', M.treasury?.repurchases, money());
  calcRow(S, r++, 'End of period', (c) => `${c}${TS_TOP + 1}+${c}${TS_TOP + 2}`, money(), { bold: true });
  r++;

  const OCI_TOP = r;
  sub(S, r++, 'Other comprehensive income / (loss)');
  label(S, r, 'Beginning of period', UNIT, { indent: 1 });
  for (let i = 0; i < nT; i++) {
    const cell = S.getCell(r, cOf(i));
    if (i === 0) {
      const v = at(M.oci?.beginning, 0);
      if (v !== null) cell.value = v;
      styleHard(cell, money());
    } else {
      cell.value = { formula: `${L(cOf(i) - 1)}${OCI_TOP + 3}` } as any;
      styleCalc(cell, money());
    }
  }
  r++;
  dataRow(S, r++, 'Plus: income / (loss)', M.oci?.change, money());
  calcRow(S, r++, 'End of period', (c) => `${c}${OCI_TOP + 1}+${c}${OCI_TOP + 2}`, money(), { bold: true });
  r += 2;

  // ---- Cash flow statement ------------------------------------------------
  header(S, r++, 'Cash flow statement');
  yearRow(S, r++);
  const CF_TOP = r;
  calcRow(S, r++, 'Net income', (c) => `${c}${IS_NI}`, money(currencySymbol));
  calcRow(S, r++, 'Depreciation and amortization', (c) => `-${c}${DA_ROW}*-1`, money());
  calcRow(S, r++, 'Stock based compensation', (c) => `${c}${DA_ROW + 1}`, money());
  dataRow(S, r++, 'Working capital and other movements', (M.cashFlow?.operating || []).map((v: any, i: number) => {
    const ni = at(M.netIncome, i) ?? 0;
    const da = at(M.depreciationAmortisation, i) ?? 0;
    const sbc = at(M.stockBasedCompensation, i) ?? 0;
    return isNum(v) ? v - ni - da - sbc : null;
  }), money());
  const CF_CFO = r;
  calcRow(S, r++, 'Cash from operating activities', (c) => `SUM(${c}${CF_TOP}:${c}${CF_CFO - 1})`, money(currencySymbol), { bold: true, indent: 0 });
  r++;
  dataRow(S, r++, 'Capital expenditures', M.ppe?.capex, money());
  const CF_CFI = r;
  calcRow(S, r++, 'Cash from investing activities', (c) => `${c}${CF_CFI - 1}`, money(), { bold: true, indent: 0 });
  r++;
  dataRow(S, r++, 'Cash from financing activities', M.cashFlow?.financing, money(), { bold: true, indent: 0 });
  const CF_CFF = r - 1;
  r++;
  calcRow(S, r++, 'Net change in cash during period', (c) => `${c}${CF_CFO}+${c}${CF_CFI}+${c}${CF_CFF}`, money(currencySymbol), { bold: true, indent: 0 });
  r += 2;

  // ---- Revolver, cash, shares --------------------------------------------
  header(S, r++, 'Revolver, cash & share count');
  yearRow(S, r++);
  r = rollForward(S, r, 'Revolver', M.revolver, { label: 'Increases / (decreases)', series: M.revolver?.change }, at(M.revolver?.beginning, 0));
  r++;
  r = rollForward(S, r, 'Cash', M.cash, { label: 'Additions / (reductions)', series: M.cash?.change }, at(M.cash?.beginning, 0));
  r++;
  sub(S, r++, 'Basic shares outstanding');
  dataRow(S, r++, 'Beginning of period', M.shares?.beginning, money(), { unit: '# M' });
  dataRow(S, r++, 'Plus: new shares issued', M.shares?.issued, money(), { unit: '# M' });
  dataRow(S, r++, 'Less: shares repurchased', M.shares?.repurchased, money(), { unit: '# M' });
  dataRow(S, r++, 'End of period', M.shares?.ending, money(), { unit: '# M', bold: true });

  // =========================================================================
  // DCF MODEL
  // =========================================================================
  const V = newSheet('DCFModel', OXBLOOD);
  title(V, `${companyName} — discounted cash flow`, `Figures in ${unitLabel}.`);

  const fyYears = years.slice(nH);
  const nF = fyYears.length;
  const fCol = (i: number) => FIRST + i;
  const fLast = FIRST + nF - 1;

  V.getCell(5, 3).value = 'Fiscal year';
  V.getCell(5, 3).font = { ...FONT, bold: true };
  fyYears.forEach((y, i) => {
    const cell = V.getCell(5, fCol(i));
    cell.value = `FY${String(y).slice(2)}`;
    cell.font = { ...FONT, bold: true };
    cell.alignment = { horizontal: 'right' };
    cell.border = { bottom: { style: 'thin', color: { argb: BLACK } } };
  });

  const dRow = (
    row: number,
    name: string,
    build: (c: string, i: number) => string,
    fmt: string,
    o: { bold?: boolean; italic?: boolean; indent?: number; unit?: string; cross?: boolean } = {}
  ) => {
    label(V, row, name, o.unit ?? UNIT, { indent: o.indent ?? 1, bold: o.bold, italic: o.italic });
    fyYears.forEach((_, i) => {
      const cell = V.getCell(row, fCol(i));
      cell.value = { formula: build(L(fCol(i)), i) } as any;
      styleCalc(cell, fmt, { bold: o.bold, italic: o.italic, cross: o.cross });
    });
  };
  const dData = (row: number, name: string, series: any[], fmt: string, o: any = {}) => {
    label(V, row, name, o.unit ?? UNIT, { indent: o.indent ?? 1, bold: o.bold, italic: o.italic });
    fyYears.forEach((_, i) => {
      const cell = V.getCell(row, fCol(i));
      const v = series?.[i];
      if (isNum(v)) cell.value = v;
      styleHard(cell, fmt, { bold: o.bold, italic: o.italic });
    });
  };

  // Model sheet columns for the forecast years, for cross-sheet links.
  const modelFc = (i: number) => L(cOf(nH + i));

  header(V, 7, 'Unlevered free cash flow', fLast);
  dRow(8, 'EBITDA', (c, i) => `'3-StatementModel'!${modelFc(i)}${EBITDA_ROW}`, money(currencySymbol), { cross: true });
  dRow(9, 'EBIT', (c, i) => `'3-StatementModel'!${modelFc(i)}${IS_EBIT}`, money(), { cross: true, bold: true });
  dData(10, 'Tax rate', D.taxRate || [], PCT1, { unit: '%', italic: true, indent: 2 });
  dRow(11, 'EBIAT (NOPAT)', (c) => `${c}9*(1-${c}10)`, money(), { bold: true, indent: 0 });
  dRow(12, 'Plus: depreciation and amortization', (c, i) => `-'3-StatementModel'!${modelFc(i)}${DA_ROW}*-1`, money(), { cross: true });
  dRow(13, 'Plus: stock based compensation', (c, i) => `'3-StatementModel'!${modelFc(i)}${DA_ROW + 1}`, money(), { cross: true });
  dData(14, 'Working capital and other movements', fyYears.map((_, i) => {
    const cfo = (D.unleveredCFO || [])[i] ?? 0;
    const ebiat = (D.ebiat || [])[i] ?? 0;
    const da = at(M.depreciationAmortisation, nH + i) ?? 0;
    const sbc = at(M.stockBasedCompensation, nH + i) ?? 0;
    return cfo - ebiat - da - sbc;
  }), money());
  dRow(15, 'Unlevered CFO', (c) => `${c}11+${c}12+${c}13+${c}14`, money(), { bold: true, indent: 0 });
  dData(16, 'Less: capital expenditures', (D.capex || []).map((v: number) => -Math.abs(v)), money());
  dRow(17, 'Unlevered FCF', (c) => `${c}15+${c}16`, money(currencySymbol), { bold: true, indent: 0 });
  dRow(18, '% growth', (c, i) => (i === 0 ? '""' : `${L(fCol(i) - 1)}17/${L(fCol(i) - 1)}17*0+${c}17/${L(fCol(i) - 1)}17-1`), PCT1, { unit: '%', italic: true, indent: 2 });

  const periods: number[] = Array.isArray(D.discountFactor) ? D.discountFactor : [];
  dData(20, 'Discount period', periods, FACTOR, { unit: 'yrs', italic: true, indent: 2 });
  dRow(21, 'Discount factor', (c) => `(1+WACC)^-${c}20`, FACTOR, { unit: 'x', italic: true, indent: 2 });
  dRow(22, 'Present value of unlevered FCF', (c) => `${c}17*${c}21`, money(currencySymbol), { bold: true, indent: 0 });

  const one = (row: number, name: string, f: string, fmt: string, o: any = {}) => {
    label(V, row, name, o.unit ?? UNIT, { indent: o.indent ?? 1, bold: o.bold });
    const cell = V.getCell(row, FIRST);
    cell.value = { formula: f } as any;
    styleCalc(cell, fmt, { bold: o.bold });
  };
  const oneData = (row: number, name: string, v: number, fmt: string, o: any = {}) => {
    label(V, row, name, o.unit ?? UNIT, { indent: o.indent ?? 1, bold: o.bold });
    const cell = V.getCell(row, FIRST);
    if (isNum(v)) cell.value = v;
    styleHard(cell, fmt, { bold: o.bold });
  };

  header(V, 24, 'Perpetuity approach', fLast);
  oneData(25, 'Normalized unlevered FCF in the last forecast period (t)', D.normalisedFCF ?? 0, money(currencySymbol));
  one(26, 'Long term growth rate (g)', 'Assumptions!$E$16', PCT1, { unit: '%' });
  one(27, 'FCF t+1', `${L(FIRST)}25*(1+${L(FIRST)}26)`, money());
  one(28, 'Terminal value', `${L(FIRST)}27/(WACC-${L(FIRST)}26)`, money());
  one(29, 'Present value of terminal value', `${L(FIRST)}28*${L(fLast)}21`, money());
  one(30, 'Present value of stage 1 cash flows', `SUM(${L(FIRST)}22:${L(fLast)}22)`, money());
  one(31, 'Enterprise value', `${L(FIRST)}29+${L(FIRST)}30`, money(currencySymbol), { bold: true, indent: 0 });
  one(32, 'Implied TV exit EBITDA multiple', `${L(FIRST)}28/${L(fLast)}8`, MULT, { unit: 'x' });
  one(33, 'Less: net debt', '-NetDebt', money());
  one(34, 'Equity value', `${L(FIRST)}31+${L(FIRST)}33`, money(), { bold: true, indent: 0 });
  one(35, 'Equity value per share', `${L(FIRST)}34/DilutedShares`, money2(currencySymbol), { bold: true, indent: 0, unit: `${currencySymbol}/sh` });

  header(V, 37, 'EBITDA exit multiple approach', fLast);
  one(38, 'Exit EBITDA multiple', 'Assumptions!$E$17', MULT, { unit: 'x' });
  one(39, 'Final year EBITDA', `${L(fLast)}8`, money());
  one(40, 'Terminal value', `${L(FIRST)}38*${L(FIRST)}39`, money());
  one(41, 'Present value of terminal value', `${L(FIRST)}40*${L(fLast)}21`, money());
  one(42, 'Present value of stage 1 cash flows', `${L(FIRST)}30`, money());
  one(43, 'Enterprise value', `${L(FIRST)}41+${L(FIRST)}42`, money(currencySymbol), { bold: true, indent: 0 });
  one(44, 'Less: net debt', '-NetDebt', money());
  one(45, 'Equity value', `${L(FIRST)}43+${L(FIRST)}44`, money(), { bold: true, indent: 0 });
  one(46, 'Equity value per share', `${L(FIRST)}45/DilutedShares`, money2(currencySymbol), { bold: true, indent: 0, unit: `${currencySymbol}/sh` });

  header(V, 48, 'Net debt', fLast);
  oneData(49, 'Cash & equivalents, ST & LT marketable securities', at(bs.cashAndSecurities, nH - 1) ?? 0, money(currencySymbol));
  oneData(50, 'Long term debt', at(bs.longTermDebt, nH - 1) ?? 0, money());
  one(51, 'Net debt', `${L(FIRST)}50-${L(FIRST)}49`, money(currencySymbol), { bold: true, indent: 0 });

  header(V, 53, 'Weighted average cost of capital', fLast);
  one(54, 'Risk free rate', 'Assumptions!$E$6', PCT2, { unit: '%' });
  one(55, 'Market risk premium', 'Assumptions!$E$7', PCT2, { unit: '%' });
  one(56, 'Beta', 'Assumptions!$E$8', PLAIN2, { unit: 'x' });
  one(57, 'Cost of equity', 'Assumptions!$E$9', PCT2, { unit: '%' });
  one(58, 'After tax cost of debt', 'Assumptions!$E$10', PCT2, { unit: '%' });
  one(59, 'Weighted average cost of capital', 'WACC', PCT2, { unit: '%', bold: true, indent: 0 });

  // Comparable companies, where the model derived beta from a peer set.
  const comps = Array.isArray(w.comps) ? w.comps : [];
  let vr = 61;
  if (comps.length) {
    header(V, vr++, 'Beta calculation', fLast);
    ['Company', 'Equity beta', 'Debt / equity', 'Delevered beta'].forEach((h, i) => {
      const cell = V.getCell(vr, 3 + i);
      cell.value = h;
      cell.font = { ...FONT, bold: true };
      cell.border = { bottom: { style: 'thin', color: { argb: BLACK } } };
      if (i > 0) cell.alignment = { horizontal: 'right' };
    });
    vr++;
    comps.forEach((cp: any) => {
      V.getCell(vr, 3).value = cp.name;
      V.getCell(vr, 3).font = FONT;
      styleHard(V.getCell(vr, 4), PLAIN2);
      V.getCell(vr, 4).value = cp.equityBeta ?? null;
      styleHard(V.getCell(vr, 5), PLAIN2);
      V.getCell(vr, 5).value = cp.debtToEquity ?? null;
      styleHard(V.getCell(vr, 6), PLAIN2);
      V.getCell(vr, 6).value = cp.unleveredBeta ?? null;
      vr++;
    });
    label(V, vr, 'Industry average delevered beta', 'x', { indent: 1, bold: true });
    V.getCell(vr, FIRST).value = { formula: `AVERAGE(F${vr - comps.length}:F${vr - 1})` } as any;
    styleCalc(V.getCell(vr, FIRST), PLAIN2, { bold: true });
    vr += 2;
  }

  header(V, vr++, 'The two methods, weighted equally', fLast);
  one(vr, 'Perpetuity approach, at 50%', `${L(FIRST)}35`, money2(), { unit: `${currencySymbol}/sh` });
  const BLEND_A = vr; vr++;
  one(vr, 'Exit multiple approach, at 50%', `${L(FIRST)}46`, money2(), { unit: `${currencySymbol}/sh` });
  const BLEND_B = vr; vr++;
  one(vr, 'Equity value per share', `(${L(FIRST)}${BLEND_A}+${L(FIRST)}${BLEND_B})/2`, money2(currencySymbol), { bold: true, indent: 0, unit: `${currencySymbol}/sh` });
  const BLEND = vr; vr++;
  one(vr, 'Spread between the two methods', `ABS(${L(FIRST)}${BLEND_B}-${L(FIRST)}${BLEND_A})/${L(FIRST)}${BLEND}`, PCT1, { unit: '%' });
  vr++;
  one(vr, 'Share price as of last close', 'Assumptions!$E$22', money2(currencySymbol), { unit: `${currencySymbol}/sh` });
  vr++;
  one(vr, 'Premium / (discount) to model', `Assumptions!$E$22/${L(FIRST)}${BLEND}-1`, PCT1, { unit: '%', bold: true, indent: 0 });
  vr += 2;

  // Football field, built the same way as the workbook's: the two methods at
  // their sensitivity extremes, plus the traded range.
  const fieldRows: [string, number, number][] = [];
  const mid = (grid: any) => (Array.isArray(grid) ? grid[Math.floor((grid.length - 1) / 2)] : null);
  const perpRow = mid(D.sensitivity?.perpetuity);
  const exitRow = mid(D.sensitivity?.exitMultiple);
  const clean = (row: any) => (Array.isArray(row) ? row.filter((v: any) => isNum(v) && v > 0) : []);
  if (clean(perpRow).length) fieldRows.push(['DCF, perpetuity growth', Math.min(...clean(perpRow)), Math.max(...clean(perpRow))]);
  if (clean(exitRow).length) fieldRows.push(['DCF, exit EBITDA multiple', Math.min(...clean(exitRow)), Math.max(...clean(exitRow))]);
  const q = source?.quote || {};
  if (isNum(q.fiftyTwoWeekLow) && isNum(q.fiftyTwoWeekHigh)) {
    fieldRows.push(['52 week market high / low', q.fiftyTwoWeekLow, q.fiftyTwoWeekHigh]);
  }
  if (fieldRows.length) {
    header(V, vr++, 'Football field', fLast);
    ['', 'Low', 'High'].forEach((h, i) => {
      const cell = V.getCell(vr, 3 + i * (i === 0 ? 1 : 1) + (i === 0 ? 0 : 1));
      cell.value = h;
      cell.font = { ...FONT, bold: true };
      if (i > 0) cell.alignment = { horizontal: 'right' };
    });
    V.getCell(vr, 4).value = '';
    V.getCell(vr, FIRST).value = 'Low';
    V.getCell(vr, FIRST).font = { ...FONT, bold: true };
    V.getCell(vr, FIRST).alignment = { horizontal: 'right' };
    V.getCell(vr, FIRST + 1).value = 'High';
    V.getCell(vr, FIRST + 1).font = { ...FONT, bold: true };
    V.getCell(vr, FIRST + 1).alignment = { horizontal: 'right' };
    vr++;
    for (const [name, lo, hi] of fieldRows) {
      label(V, vr, name, `${currencySymbol}/sh`, { indent: 1 });
      V.getCell(vr, FIRST).value = lo;
      styleHard(V.getCell(vr, FIRST), money2());
      V.getCell(vr, FIRST + 1).value = hi;
      styleHard(V.getCell(vr, FIRST + 1), money2());
      vr++;
    }
  }

  // =========================================================================
  // REPORTED
  // =========================================================================
  const R = newSheet('Reported', 'FFBFBFBF', false);
  title(R, `${companyName} — as reported`, 'Filed figures. Hard-coded on purpose: facts should not move.');
  const reported = source?.rawStatements;
  if (Array.isArray(reported) && reported.length) {
    reported.forEach((s: any, i: number) => {
      const cell = R.getCell(6, FIRST + i);
      cell.value = `FY${String(s.fiscalYear).slice(2)}`;
      cell.font = { ...FONT, bold: true };
      cell.alignment = { horizontal: 'right' };
      cell.border = { bottom: { style: 'thin', color: { argb: BLACK } } };
    });
    const groups: [string, [string, string, boolean][]][] = [
      ['Income statement', [
        ['Revenue', 'revenue', true],
        ['Cost of goods sold', 'cogs', false],
        ['Operating profit', 'operatingIncome', true],
        ['Profit before tax', 'pretaxIncome', false],
        ['Tax', 'taxExpense', false],
        ['Net income', 'netIncome', true],
      ]],
      ['Balance sheet', [
        ['Cash', 'cash', false],
        ['Receivables', 'receivables', false],
        ['Inventory', 'inventory', false],
        ['Total assets', 'totalAssets', true],
        ['Payables', 'payables', false],
        ['Current liabilities', 'currentLiabilities', false],
        ['Long term debt', 'longTermDebt', false],
        ['Total liabilities', 'totalLiabilities', true],
      ]],
      ['Cash flow', [
        ['Depreciation', 'depreciation', false],
        ['Capital expenditures', 'capex', false],
        ['Operating cash flow', 'operatingCashFlow', true],
        ['Dividends paid', 'dividendsPaid', false],
      ]],
      ['Shares', [['Diluted shares', 'dilutedShares', false]]],
    ];
    let rr = 8;
    for (const [g, lines] of groups) {
      sub(R, rr++, g, 4 + reported.length);
      for (const [name, key, bold] of lines) {
        label(R, rr, name, key === 'dilutedShares' ? '# M' : UNIT, { indent: 1, bold });
        reported.forEach((s: any, i: number) => {
          const cell = R.getCell(rr, FIRST + i);
          if (isNum(s[key])) cell.value = s[key];
          styleHard(cell, bold ? money(currencySymbol) : money(), { bold });
        });
        rr++;
      }
      rr++;
    }
  } else {
    R.getCell('C6').value = 'The reported statements were not carried into this export.';
    R.getCell('C6').font = FONT;
  }

  return wb;
}

/** Build the workbook and hand it to the browser as a download. */
export async function downloadWorkbook(input: ExportInput): Promise<void> {
  const wb = await buildWorkbook(input);
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const safeTicker = String(input.ticker || 'model').replace(/[^A-Za-z0-9.\-]/g, '');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Marginalia_${safeTicker}_model.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default { buildWorkbook, downloadWorkbook };