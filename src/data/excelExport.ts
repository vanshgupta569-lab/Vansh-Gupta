// FILE: src/data/excelExport.ts
//
// Marginalia — Excel export
//
// A working model, not a printout. Every forecast line is a formula pointing at
// an input cell, so changing beta or a growth rate moves the value per share in
// Excel, offline, with no connection to this site.
//
// FORMATTING FOLLOWS STANDARD BANKING CONVENTION, because the person opening
// this file reads models for a living and expects to know, at a glance, which
// cells they may change:
//
//   blue font        a hard-coded input or a piece of reported history
//   black font       a formula
//   green font       a link to another sheet in the same workbook
//   yellow fill      an assumption the reader is meant to drive
//   gridlines off    on every sheet
//   ( ) for negatives, accounting alignment, currency sign on the top and
//   bottom row of a schedule only
//   indentation for supporting rows, bold for subtotals, italics for
//   percentages that are there for information rather than as drivers
//   headers one column to the LEFT of the labels, so Ctrl+Arrow jumps between
//   schedules, and a Units column beside the labels
//
// The one place this departs from the textbook is colour: section headers use
// Marginalia's oxblood rather than the usual navy. The input conventions are
// left exactly as they are, because blue-means-you-can-change-this is a reading
// convention rather than a decorative choice, and breaking it to fit a brand
// would cost the reader more than the brand gains.
//
// LAYOUT
//   A  spacer      B  section headers      C  line labels
//   D  units       E  last reported year   F..  forecast years

import ExcelJS from 'exceljs';

const isNum = (v: any): v is number => typeof v === 'number' && isFinite(v);

// ---------------------------------------------------------------------------
// PALETTE AND FORMATS
// ---------------------------------------------------------------------------

const OXBLOOD = 'FF8B1E1E';
const SUBHEAD = 'FFE8E8EA';
const INPUT_FILL = 'FFFFF2CC';   // the usual input-box yellow
const INPUT_BORDER = 'FFBFBFBF';
const WHITE = 'FFFFFFFF';
const BLACK = 'FF000000';
const BLUE = 'FF0000CC';         // hard-coded inputs and reported history
const GREEN = 'FF008000';        // links to another sheet in this workbook

const FONT = { name: 'Calibri', size: 11 };

/** Accounting format, currency sign shown only where asked. */
const money = (symbol?: string) =>
  symbol
    ? `_("${symbol}"* #,##0_);_("${symbol}"* (#,##0);_("${symbol}"* "–"_);_(@_)`
    : '_(* #,##0_);_(* (#,##0);_(* "–"_);_(@_)';

const money2 = (symbol?: string) =>
  symbol
    ? `_("${symbol}"* #,##0.00_);_("${symbol}"* (#,##0.00);_("${symbol}"* "–"_);_(@_)`
    : '_(* #,##0.00_);_(* (#,##0.00);_(* "–"_);_(@_)';

// The percentage format from the guide: pads positives and text so that a
// column of percentages lines up whether or not any of them are negative.
const PCT1 = '_(0.0%_);(0.0%);_("–"_)_%;_(@_)_%';
const PCT2 = '_(0.00%_);(0.00%);_("–"_)_%;_(@_)_%';
const MULT = '0.0"x";[Red](0.0"x")';
const FACTOR = '0.0000';
const PLAIN2 = '0.00';

// ---------------------------------------------------------------------------
// CELL HELPERS
// ---------------------------------------------------------------------------

type Sheet = ExcelJS.Worksheet;

function styleInput(cell: ExcelJS.Cell, numFmt: string) {
  cell.numFmt = numFmt;
  cell.font = { ...FONT, color: { argb: BLUE } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INPUT_FILL } };
  cell.border = {
    top: { style: 'thin', color: { argb: INPUT_BORDER } },
    left: { style: 'thin', color: { argb: INPUT_BORDER } },
    bottom: { style: 'thin', color: { argb: INPUT_BORDER } },
    right: { style: 'thin', color: { argb: INPUT_BORDER } },
  };
  cell.alignment = { horizontal: 'right' };
}

/** Reported history: blue, because it is hard-coded, but no input box. */
function styleReported(cell: ExcelJS.Cell, numFmt: string) {
  cell.numFmt = numFmt;
  cell.font = { ...FONT, color: { argb: BLUE } };
  cell.alignment = { horizontal: 'right' };
}

function styleFormula(cell: ExcelJS.Cell, numFmt: string, opts: { bold?: boolean; italic?: boolean; cross?: boolean } = {}) {
  cell.numFmt = numFmt;
  cell.font = {
    ...FONT,
    bold: opts.bold,
    italic: opts.italic,
    color: { argb: opts.cross ? GREEN : BLACK },
  };
  cell.alignment = { horizontal: 'right' };
}

/** A full-width oxblood section header, starting in column B. */
function sectionHeader(ws: Sheet, row: number, label: string, lastCol: number) {
  for (let c = 2; c <= lastCol; c++) {
    const cell = ws.getCell(row, c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: OXBLOOD } };
    cell.font = { ...FONT, bold: true, color: { argb: WHITE } };
  }
  ws.getCell(row, 2).value = label;
}

/** A grey sub-header band, also starting in column B. */
function subHeader(ws: Sheet, row: number, label: string, lastCol: number) {
  for (let c = 2; c <= lastCol; c++) {
    const cell = ws.getCell(row, c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SUBHEAD } };
    cell.font = { ...FONT, bold: true, color: { argb: BLACK } };
  }
  ws.getCell(row, 2).value = label;
}

/** A line label in column C, with its unit in column D. */
function label(ws: Sheet, row: number, name: string, unit: string, opts: { indent?: number; bold?: boolean; italic?: boolean } = {}) {
  const c = ws.getCell(row, 3);
  c.value = name;
  c.font = { ...FONT, bold: opts.bold, italic: opts.italic };
  c.alignment = { indent: opts.indent ?? 0 };

  const u = ws.getCell(row, 4);
  u.value = unit;
  u.font = { ...FONT, italic: true, color: { argb: 'FF7F7F7F' } };
  u.alignment = { horizontal: 'center' };
}

function titleBlock(ws: Sheet, line1: string, line2: string) {
  ws.getCell('B2').value = line1;
  ws.getCell('B2').font = { ...FONT, size: 14, bold: true };
  ws.getCell('B3').value = line2;
  ws.getCell('B3').font = { ...FONT, size: 10, italic: true, color: { argb: 'FF7F7F7F' } };
}

/** Column letter for a 1-based column index. */
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
  const { model: M, dcf: D, source, companyName, ticker, currencySymbol, unitLabel, modelLabel } = input;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Marginalia';
  wb.created = new Date();
  wb.calcProperties.fullCalcOnLoad = true;

  const nH: number = M.nH;
  const years: number[] = M.years || [];
  const forecastYears: number[] = years.slice(nH);
  const n = forecastYears.length;

  const at = (series: any, i: number) => (Array.isArray(series) && isNum(series[i]) ? series[i] : null);
  const lastActualRevenue = M.revenue[nH - 1];

  // Columns: E is the last reported year, F onward the forecast.
  const ACTUAL_COL = 5;
  const FIRST_FC = 6;
  const fcCol = (i: number) => FIRST_FC + i;
  const lastCol = FIRST_FC + n - 1;

  const UNIT_MONEY = unitLabel.includes('million') ? `${currencySymbol} M` : currencySymbol;

  const newSheet = (name: string, tabColour: string) => {
    const ws = wb.addWorksheet(name, {
      views: [{ showGridLines: false, state: 'frozen', xSplit: 4, ySplit: 6 }],
      properties: { tabColor: { argb: tabColour } },
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });
    ws.getColumn(1).width = 2;
    ws.getColumn(2).width = 2;
    ws.getColumn(3).width = 46;
    ws.getColumn(4).width = 9;
    for (let c = 5; c <= lastCol + 1; c++) ws.getColumn(c).width = 14;
    return ws;
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
  cover.getColumn(3).width = 40;
  cover.getColumn(4).width = 52;

  titleBlock(cover, `${companyName} (${ticker})`, `Operating model and discounted cash flow. Figures in ${unitLabel}.`);
  sectionHeader(cover, 5, 'This file', 4);

  const coverRows: [string, string][] = [
    ['Company', companyName],
    ['Ticker', ticker],
    ['Model', modelLabel],
    ['Source of the reported figures', source?.meta?.source || 'company filings'],
    ['Prepared', new Date().toISOString().slice(0, 10)],
    ['Units', unitLabel],
  ];
  coverRows.forEach(([k, v], i) => {
    cover.getCell(6 + i, 3).value = k;
    cover.getCell(6 + i, 3).font = FONT;
    cover.getCell(6 + i, 4).value = v;
    cover.getCell(6 + i, 4).font = { ...FONT, color: { argb: BLUE } };
  });

  sectionHeader(cover, 14, 'Sheets', 4);
  const sheetList: [string, string][] = [
    ['Assumptions', 'The discount rate, terminal assumptions and balance sheet inputs'],
    ['Model', 'The forecast. Yellow cells are the drivers'],
    ['DCF', 'Free cash flow, both terminal methods, and the value per share'],
    ['Reported', 'The filed figures, as reported'],
  ];
  sheetList.forEach(([k, v], i) => {
    cover.getCell(15 + i, 3).value = k;
    cover.getCell(15 + i, 3).font = { ...FONT, bold: true };
    cover.getCell(15 + i, 4).value = v;
    cover.getCell(15 + i, 4).font = FONT;
  });

  sectionHeader(cover, 21, 'How to read this file', 4);
  const legend: [string, string][] = [
    ['Blue figures', 'hard-coded: an input or a reported figure'],
    ['Black figures', 'a formula'],
    ['Green figures', 'a link to another sheet in this file'],
    ['Yellow cells', 'assumptions you are meant to change'],
  ];
  legend.forEach(([k, v], i) => {
    const r = 22 + i;
    cover.getCell(r, 3).value = k;
    cover.getCell(r, 3).font = {
      ...FONT,
      color: { argb: i === 0 ? BLUE : i === 1 ? BLACK : i === 2 ? GREEN : BLACK },
      bold: true,
    };
    if (i === 3) {
      cover.getCell(r, 3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INPUT_FILL } };
    }
    cover.getCell(r, 4).value = v;
    cover.getCell(r, 4).font = FONT;
  });

  const notes = [
    'Forecast conventions follow the approach set out in the Wall Street Prep financial statement',
    'modeling cheat sheet. Marginalia is not affiliated with or endorsed by Wall Street Prep.',
    '',
    'This is a calculation tool. It is not investment advice and it is not a research report.',
    'The reported figures come from the company\u2019s own filings and can be checked against them.',
  ];
  notes.forEach((line, i) => {
    cover.getCell(28 + i, 3).value = line;
    cover.getCell(28 + i, 3).font = { ...FONT, size: 10, color: { argb: 'FF7F7F7F' } };
  });

  // =========================================================================
  // ASSUMPTIONS
  // =========================================================================
  const A = newSheet('Assumptions', 'FFBFBFBF');
  A.views = [{ showGridLines: false }];
  titleBlock(A, `${companyName} — assumptions`, 'Yellow cells are inputs. Everything else is calculated.');

  const w = D.waccDetail || {};
  const put = (row: number, name: string, unit: string, v: number, fmt: string, indent = 1) => {
    label(A, row, name, unit, { indent });
    styleInput(A.getCell(row, 5), fmt);
    A.getCell(row, 5).value = v;
  };
  const calc = (row: number, name: string, unit: string, f: string, fmt: string, bold = false) => {
    label(A, row, name, unit, { indent: 1, bold });
    A.getCell(row, 5).value = { formula: f } as any;
    styleFormula(A.getCell(row, 5), fmt, { bold });
  };

  sectionHeader(A, 5, 'Discount rate', 5);
  put(6, 'Risk-free rate', '%', w.riskFreeRate ?? 0.045, PCT2);
  put(7, 'Market risk premium', '%', w.marketRiskPremium ?? 0.05, PCT2);
  put(8, 'Beta', 'x', w.beta ?? 1, PLAIN2);
  calc(9, 'Cost of equity', '%', 'E6+E8*E7', PCT2);
  put(10, 'Cost of debt, after tax', '%', w.afterTaxCostOfDebt ?? 0.03, PCT2);
  put(11, 'Weight of equity', '%', w.weightEquity ?? 1, PCT1);
  put(12, 'Weight of debt', '%', w.weightDebt ?? 0, PCT1);
  calc(13, 'WACC', '%', 'E11*E9+E12*E10', PCT2, true);

  sectionHeader(A, 15, 'Terminal value', 5);
  put(16, 'Growth after the forecast, forever', '%', D.longTermGrowthRate ?? 0.025, PCT1);
  put(17, 'Exit multiple of EBITDA', 'x', D.exitMultiple ?? 12, MULT);

  sectionHeader(A, 19, 'Balance sheet, at the last reported date', 5);
  put(20, 'Net debt (negative is net cash)', UNIT_MONEY, D.netDebt ?? 0, money(currencySymbol));
  put(21, 'Diluted shares, after option dilution', '# M', D.perpetuity?.dilutedShares ?? D.dilutedShares ?? 1, money());

  A.getCell('C23').value = 'Growth, margins, tax and capital spending are set year by year on the Model sheet,';
  A.getCell('C23').font = { ...FONT, size: 10, italic: true, color: { argb: 'FF7F7F7F' } };
  A.getCell('C24').value = 'because they are not flat across the forecast. Edit them there.';
  A.getCell('C24').font = { ...FONT, size: 10, italic: true, color: { argb: 'FF7F7F7F' } };

  // Named cells, as the guide suggests: only figures referred to throughout.
  wb.definedNames.add(`Assumptions!$E$13`, 'WACC');
  wb.definedNames.add(`Assumptions!$E$21`, 'DilutedShares');
  wb.definedNames.add(`Assumptions!$E$20`, 'NetDebt');

  // =========================================================================
  // MODEL
  // =========================================================================
  const Mo = newSheet('Model', 'FF7F7F7F');
  titleBlock(
    Mo,
    `${companyName} — operating model`,
    `Yellow cells are the drivers, one per year. Figures in ${unitLabel}.`
  );

  // Year header row, bold, one column left rule respected by the labels below.
  Mo.getCell(5, 5).value = 'Reported';
  Mo.getCell(5, 5).font = { ...FONT, bold: true, italic: true, color: { argb: 'FF7F7F7F' } };
  Mo.getCell(5, FIRST_FC).value = 'Forecast';
  Mo.getCell(5, FIRST_FC).font = { ...FONT, bold: true, italic: true, color: { argb: 'FF7F7F7F' } };

  const yearRow = 6;
  Mo.getCell(yearRow, ACTUAL_COL).value = `FY${String(years[nH - 1]).slice(2)}`;
  forecastYears.forEach((y, i) => {
    Mo.getCell(yearRow, fcCol(i)).value = `FY${String(y).slice(2)}`;
  });
  for (let c = ACTUAL_COL; c <= lastCol; c++) {
    const cell = Mo.getCell(yearRow, c);
    cell.font = { ...FONT, bold: true };
    cell.alignment = { horizontal: 'right' };
    cell.border = { bottom: { style: 'thin', color: { argb: BLACK } } };
  }

  // -- the engine's own per-year figures, used to seed the input rows --------
  const fRev = forecastYears.map((_, i) => at(M.revenue, nH + i) ?? 0);
  const prevRev = (i: number) => (i === 0 ? lastActualRevenue ?? 0 : fRev[i - 1]);
  const growthByYear = fRev.map((r, i) => (prevRev(i) ? r / prevRev(i) - 1 : 0));
  const grossByYear = fRev.map((r, i) => (r ? (at(M.grossProfit, nH + i) ?? 0) / r : 0));
  const rndByYear = fRev.map((r, i) => (r ? Math.abs(at(M.rnd, nH + i) ?? 0) / r : 0));
  const sgaByYear = fRev.map((r, i) => (r ? Math.abs(at(M.sga, nH + i) ?? 0) / r : 0));
  const taxByYear = forecastYears.map((_, i) => (D.taxRate || [])[i] ?? 0.21);
  const capexPctByYear = forecastYears.map((_, i) =>
    fRev[i] ? Math.abs((D.capex || [])[i] ?? 0) / fRev[i] : 0
  );
  const daByYear = forecastYears.map((_, i) => at(M.depreciationAmortisation, nH + i) ?? 0);
  const sbcByYear = forecastYears.map((_, i) => at(M.stockBasedCompensation, nH + i) ?? 0);
  const otherByYear = forecastYears.map((_, i) => {
    const cfo = (D.unleveredCFO || [])[i] ?? 0;
    const ebiat = (D.ebiat || [])[i] ?? 0;
    return cfo - ebiat - daByYear[i] - sbcByYear[i];
  });

  const inputRow = (row: number, name: string, unit: string, vals: number[], fmt: string, italic = true) => {
    label(Mo, row, name, unit, { indent: 2, italic });
    vals.forEach((v, i) => {
      const cell = Mo.getCell(row, fcCol(i));
      cell.value = v;
      styleInput(cell, fmt);
      if (italic) cell.font = { ...cell.font, italic: true };
    });
  };

  const formulaRow = (
    row: number,
    name: string,
    build: (c: string, prev: string) => string,
    fmt: string,
    opts: { bold?: boolean; indent?: number; unit?: string; italic?: boolean } = {}
  ) => {
    label(Mo, row, name, opts.unit ?? UNIT_MONEY, {
      indent: opts.indent ?? 1,
      bold: opts.bold,
      italic: opts.italic,
    });
    forecastYears.forEach((_, i) => {
      const cell = Mo.getCell(row, fcCol(i));
      cell.value = { formula: build(L(fcCol(i)), L(fcCol(i) - 1)) } as any;
      styleFormula(cell, fmt, { bold: opts.bold, italic: opts.italic });
    });
  };

  sectionHeader(Mo, 8, 'Income statement', lastCol);

  label(Mo, 9, 'Revenue', UNIT_MONEY, { bold: true });
  Mo.getCell(9, ACTUAL_COL).value = lastActualRevenue;
  styleReported(Mo.getCell(9, ACTUAL_COL), money(currencySymbol));
  formulaRow(9, 'Revenue', (c, prev) => `${prev}9*(1+${c}10)`, money(currencySymbol), { bold: true, indent: 0 });

  inputRow(10, 'Revenue growth', '%', growthByYear, PCT1);
  inputRow(11, 'Gross margin', '%', grossByYear, PCT1);
  formulaRow(12, 'Gross profit', (c) => `${c}9*${c}11`, money(), { indent: 1 });
  inputRow(13, 'Research and development, % of revenue', '%', rndByYear, PCT1);
  inputRow(14, 'Selling, general and administrative, % of revenue', '%', sgaByYear, PCT1);
  formulaRow(15, 'Operating profit (EBIT)', (c) => `${c}12-${c}9*${c}13-${c}9*${c}14`, money(), { bold: true, indent: 0 });
  formulaRow(16, 'Operating margin', (c) => `${c}15/${c}9`, PCT1, { indent: 2, italic: true, unit: '%' });

  inputRow(18, 'Depreciation and amortisation', UNIT_MONEY, daByYear, money());
  inputRow(19, 'Stock based compensation', UNIT_MONEY, sbcByYear, money());
  formulaRow(20, 'EBITDA', (c) => `${c}15+${c}18+${c}19`, money(currencySymbol), { bold: true, indent: 0 });

  sectionHeader(Mo, 22, 'Unlevered free cash flow', lastCol);
  inputRow(23, 'Tax rate', '%', taxByYear, PCT1);
  formulaRow(24, '(-) Tax on operating profit', (c) => `-${c}15*${c}23`, money(currencySymbol), { indent: 1 });
  formulaRow(25, 'Operating profit after tax (EBIAT)', (c) => `${c}15+${c}24`, money(), { bold: true, indent: 0 });
  formulaRow(26, '(+) Depreciation and amortisation', (c) => `${c}18`, money(), { indent: 1 });
  formulaRow(27, '(+) Stock based compensation', (c) => `${c}19`, money(), { indent: 1 });
  inputRow(28, 'Working capital and other movements', UNIT_MONEY, otherByYear, money(), false);
  formulaRow(29, 'Unlevered cash from operations', (c) => `${c}25+${c}26+${c}27+${c}28`, money(), { bold: true, indent: 0 });

  inputRow(30, 'Capital expenditure, % of revenue', '%', capexPctByYear, PCT1);
  formulaRow(31, '(-) Capital expenditure', (c) => `-${c}9*${c}30`, money(), { indent: 1 });
  formulaRow(32, 'Unlevered free cash flow', (c) => `${c}29+${c}31`, money(currencySymbol), { bold: true, indent: 0 });

  Mo.getCell('C34').value =
    'Working capital movements are carried as a figure per year here rather than as linked receivables, inventory and payables schedules.';
  Mo.getCell('C34').font = { ...FONT, size: 10, italic: true, color: { argb: 'FF7F7F7F' } };

  // =========================================================================
  // DCF
  // =========================================================================
  const V = newSheet('DCF', OXBLOOD);
  titleBlock(V, `${companyName} — discounted cash flow`, 'Both terminal methods, weighted equally.');

  V.getCell(6, ACTUAL_COL).value = '';
  forecastYears.forEach((y, i) => {
    const cell = V.getCell(6, fcCol(i));
    cell.value = `FY${String(y).slice(2)}`;
    cell.font = { ...FONT, bold: true };
    cell.alignment = { horizontal: 'right' };
    cell.border = { bottom: { style: 'thin', color: { argb: BLACK } } };
  });

  sectionHeader(V, 8, 'Present value of the forecast years', lastCol);
  const periods: number[] = Array.isArray(D.discountFactor) ? D.discountFactor : [];

  label(V, 9, 'Unlevered free cash flow', UNIT_MONEY, { indent: 1 });
  label(V, 10, 'Discount period, years from the valuation date', 'yrs', { indent: 2, italic: true });
  label(V, 11, 'Discount factor', 'x', { indent: 2, italic: true });
  label(V, 12, 'Present value', UNIT_MONEY, { indent: 1, bold: true });

  forecastYears.forEach((_, i) => {
    const c = L(fcCol(i));
    const linked = V.getCell(9, fcCol(i));
    linked.value = { formula: `Model!${L(fcCol(i))}32` } as any;
    styleFormula(linked, money(currencySymbol), { cross: true });

    const per = V.getCell(10, fcCol(i));
    per.value = periods[i] ?? i + 1;
    styleReported(per, FACTOR);
    per.font = { ...per.font, italic: true };

    const df = V.getCell(11, fcCol(i));
    df.value = { formula: `(1+WACC)^-${c}10` } as any;
    styleFormula(df, FACTOR, { italic: true });

    const pv = V.getCell(12, fcCol(i));
    pv.value = { formula: `${c}9*${c}11` } as any;
    styleFormula(pv, money(currencySymbol), { bold: true });
  });

  label(V, 13, 'Sum of the present values', UNIT_MONEY, { indent: 1, bold: true });
  V.getCell(13, FIRST_FC).value = { formula: `SUM(${L(FIRST_FC)}12:${L(lastCol)}12)` } as any;
  styleFormula(V.getCell(13, FIRST_FC), money(currencySymbol), { bold: true });

  const lastFcLetter = L(lastCol);
  const one = (row: number, name: string, unit: string, f: string, fmt: string, bold = false, indent = 1) => {
    label(V, row, name, unit, { indent, bold });
    V.getCell(row, FIRST_FC).value = { formula: f } as any;
    styleFormula(V.getCell(row, FIRST_FC), fmt, { bold });
  };
  const oneValue = (row: number, name: string, unit: string, v: number, fmt: string, indent = 1) => {
    label(V, row, name, unit, { indent });
    V.getCell(row, FIRST_FC).value = v;
    styleReported(V.getCell(row, FIRST_FC), fmt);
  };

  sectionHeader(V, 15, 'Method one — growing forever', lastCol);
  one(16, 'Growth after the forecast', '%', 'Assumptions!$E$16', PCT1);
  oneValue(17, 'Normalised final year cash flow', UNIT_MONEY, D.normalisedFCF ?? 0, money(currencySymbol));
  one(18, 'Terminal value at the end of the forecast', UNIT_MONEY, `${L(FIRST_FC)}17*(1+${L(FIRST_FC)}16)/(WACC-${L(FIRST_FC)}16)`, money());
  one(19, 'Value of that today', UNIT_MONEY, `${L(FIRST_FC)}18*${lastFcLetter}11`, money());
  one(20, 'Enterprise value', UNIT_MONEY, `${L(FIRST_FC)}13+${L(FIRST_FC)}19`, money(), true, 0);
  one(21, '(-) Net debt', UNIT_MONEY, '-NetDebt', money());
  one(22, 'Equity value', UNIT_MONEY, `${L(FIRST_FC)}20+${L(FIRST_FC)}21`, money(), true, 0);
  one(23, 'Value per share', `${currencySymbol}/sh`, `${L(FIRST_FC)}22/DilutedShares`, money2(currencySymbol), true, 0);

  sectionHeader(V, 25, 'Method two — sold at the end', lastCol);
  one(26, 'Exit multiple of EBITDA', 'x', 'Assumptions!$E$17', MULT);
  one(27, 'Final year EBITDA', UNIT_MONEY, `Model!${lastFcLetter}20`, money());
  one(28, 'Terminal value at the end of the forecast', UNIT_MONEY, `${L(FIRST_FC)}27*${L(FIRST_FC)}26`, money());
  one(29, 'Value of that today', UNIT_MONEY, `${L(FIRST_FC)}28*${lastFcLetter}11`, money());
  one(30, 'Enterprise value', UNIT_MONEY, `${L(FIRST_FC)}13+${L(FIRST_FC)}29`, money(), true, 0);
  one(31, '(-) Net debt', UNIT_MONEY, '-NetDebt', money());
  one(32, 'Equity value', UNIT_MONEY, `${L(FIRST_FC)}30+${L(FIRST_FC)}31`, money(), true, 0);
  one(33, 'Value per share', `${currencySymbol}/sh`, `${L(FIRST_FC)}32/DilutedShares`, money2(currencySymbol), true, 0);

  sectionHeader(V, 35, 'The two methods, weighted equally', lastCol);
  one(36, 'Growing forever, at 50%', `${currencySymbol}/sh`, `${L(FIRST_FC)}23`, money2());
  one(37, 'Sold at the end, at 50%', `${currencySymbol}/sh`, `${L(FIRST_FC)}33`, money2());
  one(38, 'Value per share', `${currencySymbol}/sh`, `(${L(FIRST_FC)}36+${L(FIRST_FC)}37)/2`, money2(currencySymbol), true, 0);
  one(39, 'Spread between the two methods', '%', `ABS(${L(FIRST_FC)}37-${L(FIRST_FC)}36)/((${L(FIRST_FC)}36+${L(FIRST_FC)}37)/2)`, PCT1);

  V.getCell('C41').value =
    'Neither method is more correct than the other, which is why both carry half the weight.';
  V.getCell('C41').font = { ...FONT, size: 10, italic: true, color: { argb: 'FF7F7F7F' } };
  V.getCell('C42').value =
    'A wide spread means the answer depends heavily on which view of the future you take.';
  V.getCell('C42').font = { ...FONT, size: 10, italic: true, color: { argb: 'FF7F7F7F' } };

  // =========================================================================
  // REPORTED
  // =========================================================================
  const R = newSheet('Reported', 'FFBFBFBF');
  titleBlock(R, `${companyName} — as reported`, 'Filed figures. Hard-coded on purpose: facts should not move.');

  const reported = source?.rawStatements;
  if (Array.isArray(reported) && reported.length) {
    reported.forEach((s: any, i: number) => {
      const cell = R.getCell(6, 5 + i);
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
        ['Capital expenditure', 'capex', false],
        ['Operating cash flow', 'operatingCashFlow', true],
        ['Dividends paid', 'dividendsPaid', false],
      ]],
      ['Shares', [['Diluted shares', 'dilutedShares', false]]],
    ];

    let row = 8;
    for (const [groupName, lines] of groups) {
      subHeader(R, row, groupName, 4 + reported.length);
      row += 1;
      for (const [name, key, bold] of lines) {
        label(R, row, name, key === 'dilutedShares' ? '# M' : UNIT_MONEY, { indent: 1, bold });
        reported.forEach((s: any, i: number) => {
          const cell = R.getCell(row, 5 + i);
          if (isNum(s[key])) cell.value = s[key];
          styleReported(cell, bold ? money(currencySymbol) : money());
          if (bold) cell.font = { ...cell.font, bold: true };
        });
        row += 1;
      }
      row += 1;
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