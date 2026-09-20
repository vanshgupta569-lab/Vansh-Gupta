// FILE: src/data/excelExport.ts
//
// Marginalia — Excel export
//
// A WORKING model, not a printout with a few formulas painted on top.
//
// The previous version hard-coded the movements inside every schedule, so
// changing a growth rate moved the income statement and nothing else. The
// balance sheet, the working capital and the cash flow sat there unmoved. That
// is not a model.
//
// Now every schedule is driven by its own assumption row, one cell per year, in
// yellow: receivables as a % of revenue, inventory as a % of cost of sales,
// payables and accruals as a % of revenue, other assets, deferred tax assets
// and other liabilities the same, capital expenditure as a % of revenue,
// depreciation as a % of capital expenditure, borrowing, the interest rate on
// debt, the return earned on cash, stock compensation as a % of revenue, the
// dividend payout ratio, buybacks and share issuance.
//
// Every closing balance is opening plus movement. Every movement is its driver
// times the line it depends on. The cash flow statement is built from those
// movements rather than restated. The balance sheet reads from the schedules,
// and the balance check COMPUTES to zero rather than being asserted, so a
// broken edit announces itself.
//
// ONE DELIBERATE SIMPLIFICATION BY DEFAULT, governed by one cell
//
//   Interest on cash, term debt and the revolver is charged on OPENING
//   balances, not average balances. Average balances are circular in Excel:
//   interest changes profit, which changes cash, the revolver draw and the
//   closing balances, which change interest. The "Circularity switch" in the
//   model settings section (top of the model sheet) turns average balances
//   on; left at its default of off, nothing computes circularly.
//
//   The revolver is a roll-forward in both states, as in the engine
//   (src/engine/model.js): it draws when cash would fall below the minimum
//   cash balance, repays from any cash above it, and its closing balance
//   carries into next year's opening. On opening-balance interest that is not
//   circular, because this year's draw never feeds this year's interest.
//
//   Excel's circular-reference detection is structural, not value-based: it
//   is built from every cell a formula's text mentions, including inside an
//   IF() branch that never actually runs. So IF(switch=1, <the circular
//   formula>, <the safe one>) is still flagged as part of a circular region
//   whichever way the switch is set — turning it off changes what the
//   formula computes, not which cells it structurally names. That is the
//   ordinary shape of every circuit breaker in a real Excel model (Wall
//   Street Prep, cited on the Cover sheet, teaches this exact pattern), and
//   why such models keep iterative calculation on permanently rather than
//   only while the switch is on. This workbook does the same — see
//   src/data/excelIterativeCalc.ts, which patches the setting into the
//   serialized file since exceljs itself has no way to write it.
//
// Because everything is live, the workbook computes its own answer rather than
// echoing the site's. Each assumption is seeded from the model's own
// year-by-year figure, so it opens agreeing closely with the website and
// diverges only where the reader changes something. That is the whole point.
//
// HOW THE CODE IS ORGANISED
//
// Rows are allocated in one pass and written in a second. Every builder below
// reserves its row number immediately but defers the actual cell writing into a
// queue, so a formula may safely reference a row defined later in the sheet.
// Interest income needs the cash schedule, which sits two hundred rows further
// down; without this, that reference would be impossible.

import ExcelJS from 'exceljs';
import { addSupportingSheets } from './excelSheets';
import { enableIterativeCalculation } from './excelIterativeCalc';

const isNum = (v: any): v is number => typeof v === 'number' && isFinite(v);

// ---------------------------------------------------------------------------
// PALETTE AND NUMBER FORMATS (standard banking convention)
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
    ? `_("${symbol}"* #,##0_);_("${symbol}"* (#,##0);_("${symbol}"* "-"_);_(@_)`
    : '_(* #,##0_);_(* (#,##0);_(* "-"_);_(@_)';
const money2 = (symbol?: string) =>
  symbol
    ? `_("${symbol}"* #,##0.00_);_("${symbol}"* (#,##0.00);_("${symbol}"* "-"_);_(@_)`
    : '_(* #,##0.00_);_(* (#,##0.00);_(* "-"_);_(@_)';
const PCT1 = '0.0%;(0.0%)';
const PCT2 = '0.00%;(0.00%)';
const MULT = '0.0"x";[Red](0.0"x")';
const FACTOR = '0.0000';
const PLAIN2 = '0.00';
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
  // Only fullCalcOnLoad above actually reaches the file — exceljs 4.4.0 has
  // no way to write iterate/iterateCount/iterateDelta into <calcPr>. Setting
  // them here anyway keeps the intended values in one place; the values that
  // actually take effect are patched into the serialized file afterwards by
  // enableIterativeCalculation (src/data/excelIterativeCalc.ts), which every
  // caller that turns this workbook into bytes needs to run.
  (wb.calcProperties as any).iterate = true;
  (wb.calcProperties as any).iterateCount = 100;
  (wb.calcProperties as any).iterateDelta = 0.001;

  const years: number[] = M.years || [];
  const nH: number = M.nH;
  const nT = years.length;
  const nF = nT - nH;

  const FIRST = 5;
  const cOf = (i: number) => FIRST + i;
  const lastCol = FIRST + nT - 1;

  const at = (s: any, i: number) => (Array.isArray(s) && isNum(s[i]) ? s[i] : null);
  const UNIT = unitLabel.includes('million') ? `${currencySymbol} M` : currencySymbol;

  const styleHard = (cell: ExcelJS.Cell, fmt: string, o: any = {}) => {
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
  const styleCalc = (cell: ExcelJS.Cell, fmt: string, o: any = {}) => {
    cell.numFmt = fmt;
    cell.font = {
      ...FONT,
      bold: o.bold,
      italic: o.italic,
      color: { argb: o.cross ? GREEN : BLACK },
    };
    cell.alignment = { horizontal: 'right' };
  };

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
    ws.getColumn(3).width = 50;
    ws.getColumn(4).width = 9;
    for (let c = FIRST; c <= lastCol + 1; c++) ws.getColumn(c).width = 14;
    return ws;
  };

  const title = (ws: Sheet, a: string, b: string) => {
    ws.getCell('B2').value = a;
    ws.getCell('B2').font = { ...FONT, size: 14, bold: true };
    ws.getCell('B3').value = b;
    ws.getCell('B3').font = { ...FONT, size: 10, italic: true, color: { argb: GREY } };
  };
  const band = (ws: Sheet, row: number, text: string, fill: string, colour: string, endCol: number) => {
    for (let c = 2; c <= endCol; c++) {
      const cell = ws.getCell(row, c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
      cell.font = { ...FONT, bold: true, color: { argb: colour } };
    }
    ws.getCell(row, 2).value = text;
  };
  const label = (ws: Sheet, row: number, name: string, unit: string, o: any = {}) => {
    const c = ws.getCell(row, 3);
    c.value = name;
    c.font = { ...FONT, bold: o.bold, italic: o.italic };
    c.alignment = { indent: o.indent ?? 0 };
    const u = ws.getCell(row, 4);
    u.value = unit;
    u.font = { ...FONT, italic: true, color: { argb: GREY } };
    u.alignment = { horizontal: 'center' };
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
  cover.getColumn(3).width = 46;
  cover.getColumn(4).width = 62;
  title(cover, `${companyName} (${ticker})`, `Operating model and discounted cash flow. Figures in ${unitLabel}.`);

  band(cover, 5, 'This file', OXBLOOD, WHITE, 4);
  ([
    ['Company', companyName],
    ['Ticker', ticker],
    ['Model', modelLabel],
    ['Reported figures from', source?.meta?.source || 'company filings'],
    ['Prepared', new Date().toISOString().slice(0, 10)],
    ['Units', unitLabel],
  ] as [string, string][]).forEach(([k, v], i) => {
    cover.getCell(6 + i, 3).value = k;
    cover.getCell(6 + i, 3).font = FONT;
    cover.getCell(6 + i, 4).value = v;
    cover.getCell(6 + i, 4).font = { ...FONT, color: { argb: BLUE } };
  });

  band(cover, 14, 'How to read this file', OXBLOOD, WHITE, 4);
  ([
    ['Yellow cells', 'assumptions. These are yours to change', BLACK, true],
    ['Blue figures', 'reported history, hard-coded on purpose', BLUE, false],
    ['Black figures', 'formulas', BLACK, false],
    ['Green figures', 'links to another sheet in this file', GREEN, false],
  ] as [string, string, string, boolean][]).forEach(([k, v, colour, fill], i) => {
    const row = 15 + i;
    const c = cover.getCell(row, 3);
    c.value = k;
    c.font = { ...FONT, bold: true, color: { argb: colour } };
    if (fill) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INPUT_FILL } };
    cover.getCell(row, 4).value = v;
    cover.getCell(row, 4).font = FONT;
  });

  band(cover, 21, 'What you can change', OXBLOOD, WHITE, 4);
  [
    'Every schedule is driven by its own assumption row, one cell per year.',
    'Revenue growth, gross margin, research and selling costs, the tax rate.',
    'Receivables, inventory, payables and accruals, each against the line that drives them.',
    'Capital expenditure as a percentage of revenue, depreciation as a percentage of capital expenditure.',
    'Borrowing, the interest rate on debt, the return earned on cash.',
    'Share issuance, buybacks, the dividend payout ratio, stock based compensation.',
    'On the DCF sheet: the risk free rate, the market risk premium, beta, terminal growth and the exit multiple.',
    '',
    'Change any of them and the balance sheet, the cash flow statement and the valuation all move with it.',
    'The balance check on the model sheet reads OK only while the balance sheet still balances.',
  ].forEach((text, i) => {
    cover.getCell(22 + i, 3).value = text;
    cover.getCell(22 + i, 3).font = { ...FONT, size: 10, color: { argb: text ? BLACK : GREY } };
  });

  [
    'Forecast conventions follow the approach set out in the Wall Street Prep financial statement modeling cheat sheet.',
    'Marginalia is not affiliated with or endorsed by Wall Street Prep.',
    '',
    'This is a calculation tool. It is not investment advice and it is not a research report.',
  ].forEach((text, i) => {
    cover.getCell(34 + i, 3).value = text;
    cover.getCell(34 + i, 3).font = { ...FONT, size: 10, italic: true, color: { argb: GREY } };
  });

  // =========================================================================
  // 3-STATEMENT MODEL
  // =========================================================================
  const S = newSheet('3-StatementModel', 'FF7F7F7F');
  title(
    S,
    `${companyName} - 3 statement model`,
    `Figures in ${unitLabel}. Yellow cells are assumptions: change any of them and everything below recalculates.`
  );

  S.getCell(5, FIRST).value = 'Reported';
  S.getCell(5, FIRST).font = { ...FONT, italic: true, color: { argb: GREY } };
  if (nF > 0) {
    S.getCell(5, FIRST + nH).value = 'Forecast';
    S.getCell(5, FIRST + nH).font = { ...FONT, italic: true, color: { argb: GREY } };
  }
  S.getCell(6, 3).value = 'Year';
  S.getCell(6, 3).font = { ...FONT, bold: true };
  years.forEach((y, i) => {
    const cell = S.getCell(6, cOf(i));
    cell.value = `FY${String(y).slice(2)}`;
    cell.font = { ...FONT, bold: true };
    cell.alignment = { horizontal: 'right' };
    cell.border = { bottom: { style: 'thin', color: { argb: BLACK } } };
  });

  // ---- the two-pass machinery --------------------------------------------
  let r = 8;
  const R: Record<string, number> = {};
  const pending: (() => void)[] = [];

  const header = (text: string) => {
    const row = r++;
    pending.push(() => band(S, row, text, OXBLOOD, WHITE, lastCol));
  };
  const sub = (text: string) => {
    const row = r++;
    pending.push(() => band(S, row, text, SUBHEAD, BLACK, lastCol));
  };
  const blank = () => {
    r++;
  };
  const note = (lines: string[], colour = GREY, bold = false) => {
    lines.forEach((text) => {
      const row = r++;
      pending.push(() => {
        const cell = S.getCell(row, 3);
        cell.value = text;
        cell.font = { ...FONT, size: 10, italic: true, bold, color: { argb: colour } };
      });
    });
  };

  /** Reported years hard-coded from the filings, forecast years a formula. */
  const line = (
    key: string,
    name: string,
    hist: any,
    build: (c: string, prev: string, i: number) => string,
    fmt: string,
    o: any = {}
  ) => {
    const row = r++;
    R[key] = row;
    pending.push(() => {
      label(S, row, name, o.unit ?? UNIT, { indent: o.indent ?? 1, bold: o.bold, italic: o.italic });
      for (let i = 0; i < nT; i++) {
        const cell = S.getCell(row, cOf(i));
        if (i < nH) {
          const v = at(hist, i);
          if (v !== null) cell.value = v;
          styleHard(cell, fmt, o);
        } else {
          cell.value = { formula: build(L(cOf(i)), L(cOf(i) - 1), i) } as any;
          styleCalc(cell, fmt, o);
        }
      }
    });
    return row;
  };

  /** Every year a formula. */
  const calc = (
    key: string,
    name: string,
    build: (c: string, prev: string, i: number) => string,
    fmt: string,
    o: any = {}
  ) => {
    const row = r++;
    R[key] = row;
    pending.push(() => {
      label(S, row, name, o.unit ?? UNIT, { indent: o.indent ?? 1, bold: o.bold, italic: o.italic });
      for (let i = o.from ?? 0; i < nT; i++) {
        const cell = S.getCell(row, cOf(i));
        cell.value = { formula: build(L(cOf(i)), L(cOf(i) - 1), i) } as any;
        styleCalc(cell, fmt, o);
      }
    });
    return row;
  };

  /** A reported figure exists for year i and can be divided by. */
  const has = (s: any, i: number) => {
    const v = at(s, i);
    return v !== null && v !== 0;
  };

  /**
   * An assumption. Reported years show what the figure actually was, so the
   * reader can see the history the forecast was drawn from; forecast years are
   * yellow input cells seeded from the model.
   *
   * A history formula returns null for a year it cannot compute, which leaves
   * that cell empty. The first reported year has no prior year — `prev` there
   * is column D, the units label — and a reported line may be blank in a year
   * (Apple's first-year capex, for one), so any history formula that divides by
   * a reported figure or reaches back a year must return null in those years
   * rather than produce #VALUE! or #DIV/0!.
   */
  const driver = (
    key: string,
    name: string,
    histFormula: ((c: string, prev: string, i: number) => string | null) | null,
    seed: (i: number) => number | null,
    fmt: string,
    o: any = {}
  ) => {
    const row = r++;
    R[key] = row;
    pending.push(() => {
      label(S, row, name, o.unit ?? '%', { indent: o.indent ?? 2, italic: true });
      for (let i = 0; i < nT; i++) {
        const cell = S.getCell(row, cOf(i));
        if (i < nH) {
          if (histFormula) {
            const f = histFormula(L(cOf(i)), L(cOf(i) - 1), i);
            if (f !== null) cell.value = { formula: f } as any;
            styleCalc(cell, fmt, { italic: true });
          } else {
            const v = seed(i);
            if (v !== null) cell.value = v;
            styleHard(cell, fmt, { italic: true });
          }
        } else {
          const v = seed(i);
          cell.value = v === null ? 0 : v;
          styleInput(cell, fmt);
        }
      }
    });
    return row;
  };

  /** Beginning of period, linked to the prior closing balance. */
  const bopRow = (key: string, name: string, openingValue: number | null, endKey: string) => {
    const row = r++;
    R[key] = row;
    pending.push(() => {
      label(S, row, name, UNIT, { indent: 1 });
      for (let i = 0; i < nT; i++) {
        const cell = S.getCell(row, cOf(i));
        if (i === 0) {
          if (isNum(openingValue)) cell.value = openingValue;
          styleHard(cell, money());
        } else {
          cell.value = { formula: `${L(cOf(i) - 1)}${R[endKey]}` } as any;
          styleCalc(cell, money());
        }
      }
    });
    return row;
  };

  /**
   * End of period: reported years hard-coded from the filings, forecast years a
   * formula.
   *
   * The reported years MUST be the reported figures. An earlier version rolled
   * every schedule forward from a single opening balance, including across the
   * reported years, which cannot reproduce what a company actually reported and
   * left the historical balance sheet out by the difference. Reported history is
   * a fact; only the forecast is derived.
   */
  const eopRow = (
    key: string,
    name: string,
    hist: any,
    build: (c: string, i: number) => string,
    o: { alwaysFormula?: boolean } = {}
  ) => {
    const row = r++;
    R[key] = row;
    pending.push(() => {
      label(S, row, name, UNIT, { indent: 1, bold: true });
      for (let i = 0; i < nT; i++) {
        const cell = S.getCell(row, cOf(i));
        if (i < nH && !o.alwaysFormula) {
          const v = at(hist, i);
          if (v !== null) cell.value = v;
          styleHard(cell, money(), { bold: true });
        } else {
          cell.value = { formula: build(L(cOf(i)), i) } as any;
          styleCalc(cell, money(), { bold: true });
        }
      }
    });
    return row;
  };

  // ---- MODEL SETTINGS -------------------------------------------------------
  header('Model settings');
  const circRow = r++;
  R.circBreaker = circRow;
  const breakerRef = `$${L(FIRST)}$${circRow}`;
  pending.push(() => {
    label(S, circRow, 'Circularity switch — see note below', '0 / 1', { indent: 1, bold: true });
    const cell = S.getCell(circRow, FIRST);
    cell.value = 0;
    styleInput(cell, '0');
  });
  note(['CIRCULARITY SWITCH — 1 = ON, 0 = OFF (DEFAULT)'], OXBLOOD, true);
  note([
    'Off (0): interest is charged on the OPENING balance of cash, term debt (cash and PIK interest alike) and the',
    'revolver. Nothing in the workbook then depends on a figure it helps produce.',
    '',
    'On (1): interest is charged on the AVERAGE of the opening and closing balance of cash, term debt (cash and PIK) and',
    'the revolver. Closing balances depend on those charges, so the workbook becomes genuinely circular.',
    '',
    'The revolver draws and repays in BOTH states; see the note under the revolver schedule below.',
    '',
    'This file has iterative calculation turned on already, and needs it regardless of which way the switch is set:',
    'Excel treats a cell as circular if a formula NAMES it anywhere, even inside the untaken half of an IF(), so the',
    'two states share the same dependency chain even though only one of them is actually circular in what it',
    'computes. A copy of these formulas pasted into a workbook without iterative calculation switched on would show',
    'a circular reference warning instead of a number, whichever way this switch is set.',
  ]);
  blank();

  // ---- INCOME STATEMENT ---------------------------------------------------
  header('Income statement');

  // Rows are referenced by key, never by an offset from a neighbouring row:
  // an offset silently points at the wrong line the moment a row is inserted
  // between them (see the gross margin fix in the git history).
  line('rev', 'Revenue', M.revenue, (c, p) => `${p}${R.rev}*(1+${c}${R.revGrowth})`, money(currencySymbol), {
    bold: true,
    indent: 0,
  });
  driver(
    'revGrowth',
    'Revenue growth',
    (c, p, i) => (i > 0 && has(M.revenue, i - 1) ? `${c}${R.rev}/${p}${R.rev}-1` : null),
    (i) => {
      const now = at(M.revenue, i);
      const prev = at(M.revenue, i - 1);
      return isNum(now) && isNum(prev) && prev !== 0 ? now / prev - 1 : 0;
    },
    PCT1
  );
  driver(
    'gm',
    'Gross margin before D&A and SBC',
    (c, _p, i) => (has(M.revenue, i) ? `(${c}${R.rev}+${c}${R.cogs})/${c}${R.rev}` : null),
    (i) => {
      const rev = at(M.revenue, i);
      const gp = at(M.grossProfit, i);
      return isNum(rev) && isNum(gp) && rev !== 0 ? gp / rev : 0.4;
    },
    PCT1
  );
  // Cost of sales, R&D and SG&A exclude D&A and SBC, which are charged as
  // their own lines just above operating profit, as in the engine. Reported
  // years carry the engine's split of the filed lines; the filed lines
  // themselves sit in the "As filed" memo below and the Checks sheet
  // reconciles the two.
  line('cogs', 'Cost of sales, excluding D&A and SBC', M.cogs, (c) => `-${c}${R.rev}*(1-${c}${R.gm})`, money());
  calc('gp', 'Gross profit before D&A and SBC', (c) => `${c}${R.rev}+${c}${R.cogs}`, money(), { bold: true, indent: 0 });

  // A reported year whose filing does not report R&D or SG&A leaves the line
  // blank, and its ratio blank with it, rather than showing 0%: not reported
  // is not nil. Its cost is inside other operating costs below.
  driver(
    'rndPct',
    'Research & development, % of revenue',
    (c, _p, i) => (has(M.revenue, i) && has(M.rnd, i) ? `-${c}${R.rnd}/${c}${R.rev}` : null),
    (i) => {
      const rev = at(M.revenue, i);
      const rnd = at(M.rnd, i);
      return isNum(rev) && isNum(rnd) && rev !== 0 ? Math.abs(rnd) / rev : 0;
    },
    PCT1
  );
  line('rnd', 'Research & development, excluding D&A and SBC', M.rnd, (c) => `-${c}${R.rev}*${c}${R.rndPct}`, money());
  driver(
    'sgaPct',
    'Selling, general & administrative, % of revenue',
    (c, _p, i) => (has(M.revenue, i) && has(M.sga, i) ? `-${c}${R.sga}/${c}${R.rev}` : null),
    (i) => {
      const rev = at(M.revenue, i);
      const sga = at(M.sga, i);
      return isNum(rev) && isNum(sga) && rev !== 0 ? Math.abs(sga) / rev : 0.1;
    },
    PCT1
  );
  line(
    'sga',
    'Selling, general & administrative, excluding D&A and SBC',
    M.sga,
    (c) => `-${c}${R.rev}*${c}${R.sgaPct}`,
    money()
  );
  // Reported years: the filing's operating income less the lines it names
  // (cost of sales, R&D, SG&A), so operating profit ties to the filing without
  // any named line carrying costs that are not its own. Forecast years: a share
  // of revenue (see the note under the as-filed memo).
  driver(
    'otherPct',
    'Other operating costs, % of revenue',
    (c, _p, i) => (has(M.revenue, i) && has(M.otherOperatingCosts, i) ? `-${c}${R.otherOpex}/${c}${R.rev}` : null),
    (i) => {
      const rev = at(M.revenue, i);
      const other = at(M.otherOperatingCosts, i);
      return isNum(rev) && isNum(other) && rev !== 0 ? -other / rev : 0;
    },
    PCT1
  );
  line(
    'otherOpex',
    'Other operating costs, excluding D&A and SBC: operating income as filed less the lines above',
    M.otherOperatingCosts,
    (c) => `-${c}${R.rev}*${c}${R.otherPct}`,
    money()
  );
  // The two non-cash charges, negative like every other cost here. They link
  // to the positive D&A and SBC rows below, which the cash flow adds back, so
  // the add-back always reverses exactly the charge made.
  calc('daCost', 'Less: depreciation & amortization', (c) => `-${c}${R.da}`, money());
  calc('sbcCost', 'Less: stock based compensation', (c) => `-${c}${R.sbc}`, money());
  calc(
    'ebit',
    'Operating profit (EBIT)',
    (c) => `${c}${R.gp}+${c}${R.rnd}+${c}${R.sga}+${c}${R.otherOpex}+${c}${R.daCost}+${c}${R.sbcCost}`,
    money(),
    { bold: true, indent: 0 }
  );

  // The balance interest is charged on: opening with the switch off, the
  // average of opening and closing with it on. Every interest line uses this,
  // so cash, term debt and the revolver can never follow different rules.
  const interestBasis = (key: string, c: string, p: string) =>
    `IF(${breakerRef}=1,(${p}${R[key]}+${c}${R[key]})/2,${p}${R[key]})`;

  driver('cashRate', 'Return earned on cash', null, () => 0, PCT2);
  line(
    'intInc',
    'Interest income',
    M.interestIncome,
    (c, p) => `${interestBasis('cashEnd', c, p)}*${c}${R.cashRate}`,
    money()
  );
  // Term debt interest is split into the part paid in cash and the part paid
  // in kind (PIK), which accrues to the debt balance instead. The engine
  // forecasts one all-in figure and treats a fixed share of it as PIK, so the
  // two rates are seeded to add back up to its all-in rate: total interest
  // opens unchanged, and with the switch off the PIK rate reproduces the
  // engine's own PIK accrual year by year.
  const pikRateSeed = (i: number) => {
    const pik = at(M.debt?.pikAccrual, i);
    const opening = at(M.debt?.ending, i - 1);
    return isNum(pik) && isNum(opening) && opening !== 0 ? pik / opening : 0;
  };
  driver(
    'debtRate',
    'Cash interest rate on debt',
    null,
    (i) => Math.max(0, (at(M.debt?.weightedAverageRate, i) ?? 0.045) - pikRateSeed(i)),
    PCT2
  );
  driver(
    'pikRate',
    'PIK interest rate on debt',
    (c, p, i) =>
      i > 0 && has(M.debt?.ending, i - 1) && has(M.debt?.pikAccrual, i) ? `${c}${R.debtPik}/${p}${R.debtEnd}` : null,
    pikRateSeed,
    PCT2
  );
  // Seeded at the all-in term debt rate: the engine carries no separate revolver rate.
  driver('revRate', 'Interest rate on revolver', null, (i) => at(M.debt?.weightedAverageRate, i) ?? 0.045, PCT2);
  // Cash interest on term debt, plus the PIK interest computed in the debt
  // schedule, plus revolver interest. PIK is charged here so that the add-back
  // in operating cash flow reverses a charge that was actually made.
  line(
    'intExp',
    'Interest expense',
    M.interestExpense,
    (c, p) =>
      `-(${interestBasis('debtEnd', c, p)}*${c}${R.debtRate}+${c}${R.debtPik}+${interestBasis('revEnd', c, p)}*${c}${R.revRate})`,
    money()
  );
  driver('other', 'Other income / (expense), net', null, (i) => at(M.otherIncomeExpense, i) ?? 0, money(), {
    unit: UNIT,
  });
  calc('pbt', 'Pretax profit', (c) => `${c}${R.ebit}+${c}${R.intInc}+${c}${R.intExp}+${c}${R.other}`, money(), {
    bold: true,
    indent: 0,
  });
  driver(
    'taxRate',
    'Tax rate',
    (c, _p, i) => (has(M.pretaxProfit, i) ? `-${c}${R.tax}/${c}${R.pbt}` : null),
    (i) => at(M.taxRate, i) ?? 0.21,
    PCT1
  );
  line('tax', 'Taxes', M.taxes, (c) => `-${c}${R.pbt}*${c}${R.taxRate}`, money());
  // Reported years: filed net income less pretax income after tax, so reported
  // net income is the filed figure. Forecast years: an input, nil by default.
  driver(
    'afterTax',
    'Items after tax: non-controlling interests, discontinued operations',
    null,
    (i) => (i < nH ? at(M.otherItemsAfterTax, i) : 0),
    money(),
    { unit: UNIT }
  );
  calc('ni', 'Net income', (c) => `${c}${R.pbt}+${c}${R.tax}+${c}${R.afterTax}`, money(currencySymbol), {
    bold: true,
    indent: 0,
  });

  blank();
  driver(
    'sbcPct',
    'Stock based compensation, % of revenue',
    null,
    (i) => {
      const rev = at(M.revenue, i);
      const sbc = at(M.stockBasedCompensation, i);
      // Blank in a reported year that does not report it, not 0%.
      if (i < nH && !isNum(sbc)) return null;
      return isNum(rev) && isNum(sbc) && rev !== 0 ? Math.abs(sbc) / rev : 0;
    },
    PCT1
  );
  line('sbc', 'Stock based compensation', M.stockBasedCompensation, (c) => `${c}${R.rev}*${c}${R.sbcPct}`, money());
  // Reported years: the filed D&A, as the engine uses (it includes
  // amortisation, which the PP&E schedule's depreciation does not). Forecast
  // years: the PP&E schedule's depreciation plus the amortisation and other
  // D&A outside it (see that schedule).
  line('da', 'Depreciation & amortization', M.depreciationAmortisation, (c) => `-${c}${R.ppeDep}+${c}${R.amort}`, money());
  // Before D&A, not before stock compensation: the same definition the peer
  // multiples are on (see the engine's EBITDA).
  calc('ebitda', 'EBITDA', (c) => `${c}${R.ebit}+${c}${R.da}`, money(currencySymbol), {
    bold: true,
    indent: 0,
  });
  blank();

  // The cost lines as the filings report them, D&A and SBC inside, for the
  // reported years only. Nothing reads these but the reconciliation on the
  // Checks sheet, which confirms operating profit is still revenue less them.
  const asFiled = (key: string, name: string, hist: any) => {
    const row = r++;
    R[key] = row;
    pending.push(() => {
      label(S, row, name, UNIT, { indent: 1 });
      for (let i = 0; i < nH; i++) {
        const cell = S.getCell(row, cOf(i));
        const v = at(hist, i);
        if (v !== null) cell.value = v;
        styleHard(cell, money());
      }
    });
  };
  // The lines the filing does not report, by year, as the derivation records them.
  const notReportedLines: string[] = (Array.isArray(source?.meta?.notReported) ? source.meta.notReported : []).map(
    (g: any) => `Not reported: ${g.label}, ${g.years.map((y: number) => `FY${String(y).slice(2)}`).join(', ')}.`
  );
  sub('As filed: reported cost lines, D&A and SBC included');
  asFiled('cogsFiled', 'Cost of sales, as filed', M.cogsReportedBasis);
  asFiled('rndFiled', 'Research & development, as filed', M.rndReportedBasis);
  asFiled('sgaFiled', 'Selling, general & administrative, as filed', M.sgaReportedBasis);
  asFiled('otherFiled', 'Other operating costs: operating income as filed less the lines above', M.otherOperatingCostsReportedBasis);
  asFiled('pretaxFiled', 'Pretax income, as filed', M.pretaxProfitAsFiled);
  asFiled('niFiled', 'Net income, as filed', M.netIncomeAsFiled);
  // Cost of sales on the filed basis in every year, as the engine carries it,
  // for ratios compared with the filings (inventory days). Forecast years add
  // back to cost of sales the share of revenue that D&A and SBC took of it in
  // the last reported year, measured from that year's cells.
  const lastRep = L(cOf(nH - 1));
  const abs = (key: string) => `$${lastRep}$${R[key]}`;
  const filedTotal = () => `(${abs('cogsFiled')}+${abs('rndFiled')}+${abs('sgaFiled')}+${abs('otherFiled')})`;
  calc(
    'cogsEmbedded',
    'D&A and SBC in cost of sales, % of revenue (last reported year)',
    () =>
      `IF(OR(${filedTotal()}=0,${abs('rev')}=0),0,-${abs('cogsFiled')}*((${abs('da')}+${abs('sbc')})/-${filedTotal()})/${abs('rev')})`,
    PCT2,
    { unit: '%', italic: true, indent: 2 }
  );
  calc(
    'cogsFiledBasis',
    'Cost of sales on the filed basis, D&A and SBC included',
    (c, _p, i) => (i < nH ? `${c}${R.cogsFiled}` : `${c}${R.cogs}-${c}${R.rev}*${c}${R.cogsEmbedded}`),
    money()
  );
  note([
    'The cost lines in the income statement above exclude depreciation & amortization and stock based compensation,',
    'which are charged as their own lines so that the add-backs in the cash flow reverse charges actually made. In the',
    'reported years each filed line gives up its pro-rata share of the filed D&A and SBC, so operating profit is still',
    'revenue less the filed lines here; the Checks sheet confirms it. Forecast margins give up the share D&A and SBC',
    'took of each line in the last reported year, and the forecast D&A and SBC are then charged in full.',
    '',
    'OTHER OPERATING COSTS are the filing\'s operating income less the lines it names, so operating profit ties to the',
    'filing and SG&A is the filed SG&A. They hold costs the filing charges above operating income without tagging them as',
    'one of those lines, and any named line it does not report. Forecast: their share of revenue in the last reported',
    'year where they are a cost; where they are income (the named lines overlap), the smaller of that year\'s income and',
    'the median across the reported years, so a one-off gain is not carried forward.',
    '',
    'A BLANK reported figure is one the filing does not report. It is not nil, but formulas that add it count it as nil:',
    'an unreported R&D or SG&A cost is inside other operating costs, and unreported stock compensation is neither charged',
    'nor added back. The Income Statement and Cash Flow sheets show these cells as "not reported".',
    ...notReportedLines,
  ]);
  blank();

  // ---- WORKING CAPITAL AND OTHER SCHEDULES --------------------------------
  header('Working capital & other balance sheet schedules');

  const schedule = (
    keyBase: string,
    name: string,
    hist: any,
    driverName: string,
    base: 'rev' | 'cogs' | 'flat'
  ) => {
    sub(name);
    if (base === 'flat') {
      // Held flat, as in the engine, apart from amortisation of intangibles:
      // end = beginning + additions / (disposals) - amortisation. The input is
      // the movement EXCLUDING amortisation, which is what operating cash flow
      // deducts, so amortisation is never added back twice.
      driver(
        `${keyBase}Move`,
        driverName,
        (c) => `${c}${R[`${keyBase}End`]}-${c}${R[`${keyBase}Bop`]}+${c}${R.amort}`,
        (i) => (i < nH ? null : 0),
        money(),
        { unit: UNIT }
      );
    } else {
      driver(
        `${keyBase}Pct`,
        driverName,
        base === 'rev'
          ? (c, _p, i) => (has(M.revenue, i) ? `${c}${R[`${keyBase}End`]}/${c}${R.rev}` : null)
          : (c, _p, i) => (has(M.cogs, i) ? `${c}${R[`${keyBase}End`]}/-${c}${R.cogs}` : null),
        (i) => {
          const end = at(hist?.ending, i);
          const b = base === 'rev' ? at(M.revenue, i) : at(M.cogs, i);
          if (!isNum(end) || !isNum(b) || b === 0) return 0;
          return base === 'rev' ? end / b : end / Math.abs(b);
        },
        PCT1
      );
    }
    bopRow(`${keyBase}Bop`, 'Beginning of period', at(hist?.beginning, 0) ?? at(hist?.ending, 0), `${keyBase}End`);
    calc(
      `${keyBase}Chg`,
      'Increase / (decrease)',
      (c) => `${c}${R[`${keyBase}End`]}-${c}${R[`${keyBase}Bop`]}`,
      money()
    );
    eopRow(`${keyBase}End`, 'End of period', hist?.ending, (c) =>
      base === 'flat'
        ? `${c}${R[`${keyBase}Bop`]}+${c}${R[`${keyBase}Move`]}-${c}${R.amort}`
        : base === 'rev'
          ? `${c}${R.rev}*${c}${R[`${keyBase}Pct`]}`
          : `-${c}${R.cogs}*${c}${R[`${keyBase}Pct`]}`
    );
    blank();
  };

  const wc = M.wc || {};
  schedule('ar', 'Accounts receivable', wc.accountsReceivable, 'Receivables as % of revenue', 'rev');
  schedule('inv', 'Inventory', wc.inventory, 'Inventory as % of cost of sales', 'cogs');
  schedule('ap', 'Accounts payable', wc.accountsPayable, 'Payables as % of revenue', 'rev');
  schedule('acc', 'Accrued expenses & deferred revenue', wc.accruedExpenses, 'Accrued expenses as % of revenue', 'rev');
  schedule('oca', 'Other current assets', wc.otherCurrentAssets, 'Other current assets as % of revenue', 'rev');
  schedule('dta', 'Deferred tax assets', wc.deferredTaxAssets, 'Deferred tax assets as % of revenue', 'rev');
  schedule('oa', 'Other assets', wc.otherAssets, 'Additions / (disposals), excluding amortisation of intangibles', 'flat');
  schedule('oncl', 'Other non-current liabilities', wc.otherNonCurrentLiabilities, 'Other non-current liabilities as % of revenue', 'rev');

  // ---- PP&E ---------------------------------------------------------------
  header('Property, plant & equipment');
  driver(
    'capexPct',
    'Capital expenditure as % of revenue',
    (c, _p, i) => (has(M.revenue, i) ? `${c}${R.ppeCapex}/${c}${R.rev}` : null),
    (i) => {
      const rev = at(M.revenue, i);
      const cap = at(M.ppe?.capex, i);
      return isNum(rev) && isNum(cap) && rev !== 0 ? Math.abs(cap) / rev : 0.04;
    },
    PCT1
  );
  driver(
    'depPct',
    'Depreciation as % of capital expenditure',
    (c, _p, i) => (has(M.ppe?.capex, i) && has(M.ppe?.depreciation, i) ? `-${c}${R.ppeDep}/${c}${R.ppeCapex}` : null),
    (i) => {
      const cap = at(M.ppe?.capex, i);
      const dep = at(M.ppe?.depreciation, i);
      return isNum(cap) && isNum(dep) && cap !== 0 ? Math.abs(dep) / Math.abs(cap) : 0.8;
    },
    PCT1
  );
  bopRow('ppeBop', 'Beginning of period', at(M.ppe?.beginning, 0), 'ppeEnd');
  line('ppeCapex', 'Plus: capital expenditures', M.ppe?.capex, (c) => `${c}${R.rev}*${c}${R.capexPct}`, money());
  line('ppeDep', 'Less: depreciation', M.ppe?.depreciation, (c) => `-${c}${R.ppeCapex}*${c}${R.depPct}`, money());
  // Reported years: whatever else moved the balance — disposals, impairments,
  // finance-lease additions, acquisitions, currency. Depreciation above is the
  // filed figure, so these are shown for what they are instead of being counted
  // as depreciation and fed into the forecast rate. Nil in the forecast, which
  // buys and sells nothing but capital expenditure.
  line(
    'ppeOther',
    'Plus: other movements in the balance (disposals, acquisitions, leases, currency)',
    M.ppe?.otherMovements,
    () => '0',
    money()
  );
  eopRow('ppeEnd', 'End of period', M.ppe?.ending, (c) => `${c}${R.ppeBop}+${c}${R.ppeCapex}+${c}${R.ppeDep}+${c}${R.ppeOther}`);
  blank();

  // As in the engine: the part of filed D&A the depreciation above does not
  // produce, charged each year until the intangibles reported in the last year
  // are used up. Nothing replaces them; other assets fall by the charge.
  sub('Amortisation of intangibles');
  driver(
    'amortAnnual',
    'Annual amortisation of intangibles, anchored to the last reported year',
    null,
    (i) => (i < nH ? null : M.amortisationAnchor?.annual ?? 0),
    money(),
    { unit: UNIT }
  );
  line(
    'intangEnd',
    'Intangible assets excluding goodwill, end of period',
    M.intangibleAssets,
    (c, p) => `${p}${R.intangEnd}-${c}${R.amort}`,
    money()
  );
  calc('amort', 'Amortisation of intangibles', (c, p) => `MAX(0,MIN(${c}${R.amortAnnual},${p}${R.intangEnd}))`, money(), {
    from: nH,
  });
  note([
    'The PP&E schedule above depreciates capex at the historical rate. The annual amortisation here is the filed D&A of',
    'the last reported year less that year\'s capex at the same rate: the part of the filed figure depreciation does not',
    'produce. It is charged each year until the intangible assets reported that year are used up, and nothing replaces',
    'them, because the forecast buys no intangibles. It is nil when that year reports no intangibles, or when the',
    'historical depreciation rate is not positive. Other assets fall by the charge, and the terminal value is taken on',
    'the business after the run-off.',
  ]);
  blank();

  // ---- DEBT AND REVOLVER --------------------------------------------------
  header('Debt & revolver');
  sub('Long term debt');
  driver('debtBorrow', 'Additional borrowing / (pay down)', null, (i) => at(M.debt?.borrowing, i) ?? 0, money(), {
    unit: UNIT,
  });
  // PIK interest: charged in interest expense, added to the debt balance here
  // rather than paid, and added back in operating cash flow as the non-cash
  // charge it is. An earlier version took it as a separate input amount that
  // grew debt and cash flow but was never tied to the interest charge, so
  // changing it moved operating cash flow with no effect on profit. It is now
  // the PIK rate on the same basis as cash interest: opening balance with the
  // switch off, average balance with it on.
  line(
    'debtPik',
    'PIK interest accrued to the balance',
    M.debt?.pikAccrual,
    (c, p) => `${interestBasis('debtEnd', c, p)}*${c}${R.pikRate}`,
    money(),
    { unit: UNIT }
  );
  bopRow('debtBop', 'Beginning of period', at(M.debt?.beginning, 0), 'debtEnd');
  eopRow('debtEnd', 'End of period', M.debt?.ending, (c) => `${c}${R.debtBop}+${c}${R.debtBorrow}+${c}${R.debtPik}`);
  blank();

  // The revolver is a BALANCE with its own roll-forward, like term debt and
  // PP&E. An earlier version held only the year's draw in a single row and
  // fed that row to both cash from financing and the balance sheet, so each
  // draw fell off the balance sheet the following year without ever being
  // repaid, and the balance check failed from the second year of borrowing.
  sub('Revolver');
  // The engine sizes its revolver against a minimum cash balance; recover it
  // from the engine's own excess-cash line (opening cash less excess cash).
  driver(
    'minCash',
    'Minimum cash balance',
    null,
    (i) => {
      if (i < nH) return null;
      const bop = at(M.cash?.beginning, i);
      const excess = at(M.revolverAnalysis?.excessCash, i);
      return isNum(bop) && isNum(excess) ? bop - excess : 0;
    },
    money(),
    { unit: UNIT }
  );
  bopRow('revBop', 'Revolver, beginning of period', at(M.revolver?.beginning, 0) ?? at(M.balanceSheet?.revolver, 0) ?? 0, 'revEnd');

  // Every financing flow except the revolver, in one place: the revolver sizes
  // itself against these and cash from financing adds the draw to them, so the
  // two can never disagree about what financing contains.
  const financingExRevolver = (c: string) =>
    ['debtBorrow', 'csIssue', 'reDiv', 'buyback', 'ociChg'].map((k) => `${c}${R[k]}`).join('+');

  // Reported years: the movement between the filed balances. Forecast years,
  // as in the engine: cash available before the revolver is opening cash less
  // the minimum, plus operating, investing and all other financing flows. A
  // shortfall is drawn in full; a surplus repays at most the opening balance.
  calc(
    'revDraw',
    'Revolver draw / (repayment)',
    (c, _p, i) =>
      i < nH
        ? `${c}${R.revEnd}-${c}${R.revBop}`
        : `-MIN(${c}${R.revBop},${c}${R.cashBop}-${c}${R.minCash}+${c}${R.cfo}+${c}${R.cfi}+${financingExRevolver(c)})`,
    money()
  );
  eopRow('revEnd', 'Revolver, end of period', M.balanceSheet?.revolver, (c) => `${c}${R.revBop}+${c}${R.revDraw}`);

  note(['REVOLVER: DRAWS WHEN SHORT OF CASH AND REPAYS FROM SURPLUS, WHICHEVER WAY THE SWITCH IS SET'], OXBLOOD, true);
  note([
    'Each forecast year the revolver measures the cash available before it: opening cash less the minimum cash balance,',
    'plus cash from operations, investing and every other financing line. If that is negative it draws the shortfall,',
    'which holds cash at the minimum. If it is positive it repays as much of the opening balance as the surplus covers.',
    'The closing balance carries into next year, sits on the balance sheet, and bears interest at the rate above.',
    '',
    'With the circularity switch off that interest is charged on the opening balance, so this year\'s draw never affects',
    'this year\'s profit and nothing is circular. With it on, interest is charged on the average balance, which is',
    'circular by construction; see the note beside the switch in Model settings.',
  ]);
  blank();

  // ---- EQUITY -------------------------------------------------------------
  header('Shareholders equity');
  sub('Common stock & additional paid in capital');
  driver('csIssue', 'New share issuances', null, (i) => at(M.commonStock?.issuances, i) ?? 0, money(), { unit: UNIT });
  bopRow('csBop', 'Beginning of period', at(M.commonStock?.beginning, 0), 'csEnd');
  eopRow('csEnd', 'End of period', M.commonStock?.ending, (c) => `${c}${R.csBop}+${c}${R.csIssue}+${c}${R.sbc}`);
  blank();

  sub('Retained earnings');
  driver(
    'payout',
    'Dividend payout ratio',
    null,
    (i) => {
      // Reported years: the filed dividends over net income, blank where the
      // filing does not report dividends. They used to read 0% every reported
      // year, for every company, because only forecast dividends were read.
      const ni = at(M.netIncome, i);
      const div = i < nH ? at(M.dividends, i) : at(M.retainedEarnings?.dividends, i);
      if (i < nH && !isNum(div)) return null;
      return isNum(ni) && isNum(div) && ni > 0 ? Math.abs(div) / ni : 0;
    },
    PCT1
  );
  bopRow('reBop', 'Beginning of period', at(M.retainedEarnings?.beginning, 0), 'reEnd');
  // Reported years: the filed dividends, blank where not reported. Forecast: payout x net income.
  line('reDiv', 'Less: common dividends', M.dividends, (c) => `-${c}${R.ni}*${c}${R.payout}`, money());
  eopRow('reEnd', 'End of period', M.retainedEarnings?.ending, (c) => `${c}${R.reBop}+${c}${R.ni}+${c}${R.reDiv}`);
  blank();

  sub('Treasury stock');
  // Reported years: the filed repurchases, blank where the filing does not
  // report them (they used to read 0 in every reported year, for every company).
  driver(
    'buyback',
    'Share repurchases',
    null,
    (i) => (i < nH ? at(M.shareRepurchases, i) : at(M.treasury?.repurchases, i) ?? 0),
    money(),
    { unit: UNIT }
  );
  bopRow('tsBop', 'Beginning of period', at(M.treasury?.beginning, 0), 'tsEnd');
  eopRow('tsEnd', 'End of period', M.treasury?.ending, (c) => `${c}${R.tsBop}+${c}${R.buyback}`);
  blank();

  sub('Other comprehensive income');
  driver('ociChg', 'Income / (loss) in the period', null, (i) => at(M.oci?.change, i) ?? 0, money(), { unit: UNIT });
  bopRow('ociBop', 'Beginning of period', at(M.oci?.beginning, 0), 'ociEnd');
  eopRow('ociEnd', 'End of period', M.oci?.ending, (c) => `${c}${R.ociBop}+${c}${R.ociChg}`);
  blank();

  // ---- CASH FLOW ----------------------------------------------------------
  header('Cash flow statement');
  calc('cfNi', 'Net income', (c) => `${c}${R.ni}`, money(currencySymbol));
  calc('cfDa', 'Depreciation & amortization', (c) => `${c}${R.da}`, money());
  calc('cfSbc', 'Stock based compensation', (c) => `${c}${R.sbc}`, money());
  calc(
    'cfWc',
    'Movements in working capital and other items',
    (c) =>
      // Other assets: the movement excluding amortisation, which D&A adds back.
      `-${c}${R.arChg}-${c}${R.invChg}+${c}${R.apChg}+${c}${R.accChg}-${c}${R.ocaChg}-${c}${R.dtaChg}-(${c}${R.oaChg}+${c}${R.amort})+${c}${R.onclChg}`,
    money()
  );
  calc('cfPik', 'Non-cash PIK interest added back', (c) => `${c}${R.debtPik}`, money());
  calc(
    'cfo',
    'Cash from operating activities',
    (c) => `${c}${R.cfNi}+${c}${R.cfDa}+${c}${R.cfSbc}+${c}${R.cfWc}+${c}${R.cfPik}`,
    money(currencySymbol),
    { bold: true, indent: 0 }
  );
  calc('cfi', 'Cash from investing activities', (c) => `-${c}${R.ppeCapex}`, money(), { bold: true, indent: 0 });
  calc(
    'cff',
    'Cash from financing activities',
    (c) => `${financingExRevolver(c)}+${c}${R.revDraw}`,
    money(),
    { bold: true, indent: 0 }
  );
  calc('netChange', 'Net change in cash', (c) => `${c}${R.cfo}+${c}${R.cfi}+${c}${R.cff}`, money(), {
    bold: true,
    indent: 0,
  });
  bopRow('cashBop', 'Cash, beginning of period', at(M.cash?.beginning, 0), 'cashEnd');
  eopRow('cashEnd', 'Cash, end of period', M.cash?.ending, (c) => `${c}${R.cashBop}+${c}${R.netChange}`);
  blank();

  // ---- BALANCE SHEET ------------------------------------------------------
  header('Balance sheet');
  calc('bsCash', 'Cash & equivalents', (c) => `${c}${R.cashEnd}`, money(currencySymbol));
  calc('bsAr', 'Accounts receivable', (c) => `${c}${R.arEnd}`, money());
  calc('bsInv', 'Inventory', (c) => `${c}${R.invEnd}`, money());
  calc('bsDta', 'Deferred tax assets', (c) => `${c}${R.dtaEnd}`, money());
  calc('bsOca', 'Other current assets', (c) => `${c}${R.ocaEnd}`, money());
  calc('bsPpe', 'Property, plant & equipment', (c) => `${c}${R.ppeEnd}`, money());
  calc('bsOa', 'Other assets', (c) => `${c}${R.oaEnd}`, money());
  calc('bsTa', 'Total assets', (c) => `SUM(${c}${R.bsCash}:${c}${R.bsOa})`, money(currencySymbol), {
    bold: true,
    indent: 0,
  });
  blank();
  calc('bsAp', 'Accounts payable', (c) => `${c}${R.apEnd}`, money(currencySymbol));
  calc('bsAcc', 'Accrued expenses & deferred revenue', (c) => `${c}${R.accEnd}`, money());
  calc('bsRevolver', 'Revolver', (c) => `${c}${R.revEnd}`, money());
  calc('bsDebt', 'Long term debt', (c) => `${c}${R.debtEnd}`, money());
  calc('bsOncl', 'Other non-current liabilities', (c) => `${c}${R.onclEnd}`, money());
  calc('bsTl', 'Total liabilities', (c) => `SUM(${c}${R.bsAp}:${c}${R.bsOncl})`, money(), { bold: true, indent: 0 });
  blank();
  calc('bsCs', 'Common stock & additional paid in capital', (c) => `${c}${R.csEnd}`, money());
  calc('bsTs', 'Treasury stock', (c) => `${c}${R.tsEnd}`, money());
  calc('bsRe', 'Retained earnings', (c) => `${c}${R.reEnd}`, money());
  calc('bsOci', 'Other comprehensive income', (c) => `${c}${R.ociEnd}`, money());
  calc('bsTe', 'Total equity', (c) => `SUM(${c}${R.bsCs}:${c}${R.bsOci})`, money(currencySymbol), {
    bold: true,
    indent: 0,
  });
  calc('bsCheck', 'Balance check', (c) => `${c}${R.bsTa}-${c}${R.bsTl}-${c}${R.bsTe}`, CHECK, {
    bold: true,
    indent: 0,
    unit: '',
  });
  note([
    'The balance check is a formula, not a claim. It reads OK only while assets equal liabilities plus equity in that year.',
  ]);

  // Run every queued write now that every row number is known.
  pending.forEach((write) => write());

  // =========================================================================
  // DCF MODEL
  // =========================================================================
  const V = newSheet('DCFModel', OXBLOOD, false);
  title(V, `${companyName} - discounted cash flow`, `Figures in ${unitLabel}. Everything links to the model sheet.`);

  const fCol = (i: number) => FIRST + i;
  const fLast = FIRST + nF - 1;
  const mCol = (i: number) => L(cOf(nH + i));
  const F = L(FIRST);

  V.getCell(6, 3).value = 'Fiscal year';
  V.getCell(6, 3).font = { ...FONT, bold: true };
  years.slice(nH).forEach((y, i) => {
    const cell = V.getCell(6, fCol(i));
    cell.value = `FY${String(y).slice(2)}`;
    cell.font = { ...FONT, bold: true };
    cell.alignment = { horizontal: 'right' };
    cell.border = { bottom: { style: 'thin', color: { argb: BLACK } } };
  });

  const vRow = (row: number, name: string, build: (c: string, i: number) => string, fmt: string, o: any = {}) => {
    label(V, row, name, o.unit ?? UNIT, { indent: o.indent ?? 1, bold: o.bold, italic: o.italic });
    years.slice(nH).forEach((_, i) => {
      const cell = V.getCell(row, fCol(i));
      cell.value = { formula: build(L(fCol(i)), i) } as any;
      styleCalc(cell, fmt, o);
    });
  };
  const vData = (row: number, name: string, vals: any[], fmt: string, o: any = {}) => {
    label(V, row, name, o.unit ?? UNIT, { indent: o.indent ?? 2, italic: true });
    years.slice(nH).forEach((_, i) => {
      const cell = V.getCell(row, fCol(i));
      if (isNum(vals[i])) cell.value = vals[i];
      styleInput(cell, fmt);
    });
  };
  const vOne = (row: number, name: string, f: string, fmt: string, o: any = {}) => {
    label(V, row, name, o.unit ?? UNIT, { indent: o.indent ?? 1, bold: o.bold });
    const cell = V.getCell(row, FIRST);
    cell.value = { formula: f } as any;
    styleCalc(cell, fmt, o);
  };
  const vInput = (row: number, name: string, v: number, fmt: string, o: any = {}) => {
    label(V, row, name, o.unit ?? UNIT, { indent: o.indent ?? 1 });
    const cell = V.getCell(row, FIRST);
    cell.value = v;
    styleInput(cell, fmt);
  };

  band(V, 8, 'Unlevered free cash flow', OXBLOOD, WHITE, fLast);
  vRow(9, 'EBIT', (c, i) => `'3-StatementModel'!${mCol(i)}${R.ebit}`, money(currencySymbol), { cross: true, bold: true });
  vRow(10, 'Tax rate', (c, i) => `'3-StatementModel'!${mCol(i)}${R.taxRate}`, PCT1, {
    cross: true,
    italic: true,
    indent: 2,
    unit: '%',
  });
  vRow(11, 'EBIAT', (c) => `${c}9*(1-${c}10)`, money(), { bold: true, indent: 0 });
  vRow(12, 'Plus: depreciation & amortization', (c, i) => `'3-StatementModel'!${mCol(i)}${R.da}`, money(), { cross: true });
  vRow(13, 'Plus: stock based compensation', (c, i) => `'3-StatementModel'!${mCol(i)}${R.sbc}`, money(), { cross: true });
  vRow(14, 'Movements in working capital', (c, i) => `'3-StatementModel'!${mCol(i)}${R.cfWc}`, money(), { cross: true });
  vRow(15, 'Less: capital expenditure', (c, i) => `-'3-StatementModel'!${mCol(i)}${R.ppeCapex}`, money(), { cross: true });
  vRow(16, 'Unlevered free cash flow', (c) => `${c}11+${c}12+${c}13+${c}14+${c}15`, money(currencySymbol), {
    bold: true,
    indent: 0,
  });

  band(V, 18, 'Discounting', OXBLOOD, WHITE, fLast);
  vInput(19, 'Risk free rate', D.waccDetail?.riskFreeRate ?? 0.045, PCT2, { unit: '%' });
  vInput(20, 'Market risk premium', D.waccDetail?.marketRiskPremium ?? 0.05, PCT2, { unit: '%' });
  vInput(21, 'Beta', D.waccDetail?.beta ?? 1, PLAIN2, { unit: 'x' });
  vOne(22, 'Cost of equity', `${F}19+${F}21*${F}20`, PCT2, { unit: '%' });
  vInput(23, 'After tax cost of debt', D.waccDetail?.afterTaxCostOfDebt ?? 0.03, PCT2, { unit: '%' });
  vInput(24, 'Weight of equity', D.waccDetail?.weightEquity ?? 1, PCT1, { unit: '%' });
  vInput(25, 'Weight of debt', D.waccDetail?.weightDebt ?? 0, PCT1, { unit: '%' });
  vOne(26, 'Weighted average cost of capital', `${F}24*${F}22+${F}25*${F}23`, PCT2, {
    bold: true,
    unit: '%',
    indent: 0,
  });
  vData(27, 'Discount period, years from the valuation date', Array.isArray(D.discountFactor) ? D.discountFactor : [], FACTOR, {
    unit: 'yrs',
  });
  vRow(28, 'Discount factor', (c) => `(1+$${F}$26)^-${c}27`, FACTOR, { italic: true, indent: 2, unit: 'x' });
  vRow(29, 'Present value of unlevered free cash flow', (c) => `${c}16*${c}28`, money(currencySymbol), {
    bold: true,
    indent: 0,
  });
  vOne(30, 'Sum of the present values', `SUM(${F}29:${L(fLast)}29)`, money(), { bold: true, indent: 0 });

  band(V, 32, 'Perpetuity growth approach', OXBLOOD, WHITE, fLast);
  vInput(33, 'Long term growth rate (g)', D.longTermGrowthRate ?? 0.025, PCT1, { unit: '%' });
  // After the run-off, as in the engine: terminal capex equals PP&E depreciation,
  // and the final year's amortisation (and its tax shield) is taken out, which
  // leaves EBIAT plus SBC plus that amortisation after tax.
  vOne(
    34,
    'Normalised final year cash flow: amortisation run off, terminal capex equal to PP&E depreciation',
    `${L(fLast)}11+${L(fLast)}13+'3-StatementModel'!${mCol(nF - 1)}${R.amort}*(1-${L(fLast)}10)`,
    money()
  );
  vOne(35, 'Terminal value', `${F}34*(1+${F}33)/(${F}26-${F}33)`, money());
  vOne(36, 'Present value of the terminal value', `${F}35*${L(fLast)}28`, money());
  vOne(37, 'Enterprise value', `${F}30+${F}36`, money(currencySymbol), { bold: true, indent: 0 });

  band(V, 39, 'EBITDA exit multiple approach', OXBLOOD, WHITE, fLast);
  vInput(40, 'Exit EBITDA multiple', D.exitMultiple ?? 12, MULT, { unit: 'x' });
  vOne(41, 'Final year EBITDA', `'3-StatementModel'!${mCol(nF - 1)}${R.ebitda}`, money(), { cross: true });
  vOne(42, 'Terminal value', `${F}40*${F}41`, money());
  vOne(43, 'Present value of the terminal value', `${F}42*${L(fLast)}28`, money());
  vOne(44, 'Enterprise value', `${F}30+${F}43`, money(currencySymbol), { bold: true, indent: 0 });

  band(V, 46, 'From enterprise value to one share', OXBLOOD, WHITE, fLast);
  vOne(
    47,
    'Debt and revolver at the last reported date',
    `'3-StatementModel'!${L(cOf(nH - 1))}${R.debtEnd}+'3-StatementModel'!${L(cOf(nH - 1))}${R.revEnd}`,
    money(),
    { cross: true }
  );
  vOne(48, 'Cash at the last reported date', `'3-StatementModel'!${L(cOf(nH - 1))}${R.cashEnd}`, money(), { cross: true });
  vOne(49, 'Net debt', `${F}47-${F}48`, money(), { bold: true, indent: 0 });
  // Claims on the group that are not the common shareholders', from the filing
  // at the last reported date (see the Sources sheet for where each was read).
  vInput(50, 'Less: minority interests at the last reported date', D.minorityInterest ?? 0, money());
  vInput(51, 'Less: preferred stock at the last reported date', D.preferredStock ?? 0, money());
  vInput(52, 'Net diluted shares outstanding', D.perpetuity?.dilutedShares ?? D.dilutedShares ?? 1, money(), {
    unit: '# M',
  });
  vOne(53, 'Value per share, perpetuity growth', `(${F}37-${F}49-${F}50-${F}51)/${F}52`, money2(currencySymbol), {
    bold: true,
    indent: 0,
    unit: `${currencySymbol}/sh`,
  });
  vOne(54, 'Value per share, exit multiple', `(${F}44-${F}49-${F}50-${F}51)/${F}52`, money2(currencySymbol), {
    bold: true,
    indent: 0,
    unit: `${currencySymbol}/sh`,
  });
  vOne(55, 'The two methods, weighted equally', `(${F}53+${F}54)/2`, money2(currencySymbol), {
    bold: true,
    indent: 0,
    unit: `${currencySymbol}/sh`,
  });
  vOne(56, 'Spread between the two methods', `ABS(${F}54-${F}53)/${F}55`, PCT1, { unit: '%' });
  vInput(57, 'Share price as of last close', D.marketPrice ?? 0, money2(currencySymbol), {
    unit: `${currencySymbol}/sh`,
  });
  vOne(58, 'Premium / (discount) to the model', `${F}57/${F}55-1`, PCT1, { bold: true, indent: 0, unit: '%' });

  [
    'With the circularity switch off, interest is charged on opening balances rather than average balances, so nothing',
    'computes circularly. The difference to the answer is small. See Model settings on the 3-statement model sheet.',
  ].forEach((text, i) => {
    V.getCell(60 + i, 3).value = text;
    V.getCell(60 + i, 3).font = { ...FONT, size: 10, italic: true, color: { argb: GREY } };
  });

  // =========================================================================
  // STATEMENTS, ANNEXURES, RATIOS, CHECKS & SOURCES
  // =========================================================================
  // Built in their own file, reading this sheet's row registry rather than
  // rebuilding the model. See src/data/excelSheets.ts.
  addSupportingSheets({
    R,
    modelSheetName: '3-StatementModel',
    years,
    nH,
    nT,
    FIRST,
    cOf,
    L,
    lastCol,
    companyName,
    source,
    currencySymbol,
    UNIT,
    newSheet,
    title,
    band,
    label,
    styleHard,
    styleCalc,
    fmt: { PCT1, MULT, money, money2 },
    colors: { OXBLOOD, SUBHEAD, WHITE, BLACK, BLUE, GREY },
    FONT,
  });

  // Tab order. ExcelJS ignores a sort of the worksheets array, so each sheet is
  // given an explicit position instead.
  const order = [
    'Cover',
    '3-StatementModel',
    'Income Statement',
    'Balance Sheet',
    'Cash Flow',
    'Annexures',
    'DCFModel',
    'Ratios',
    'Checks',
    'Sources',
  ];
  wb.eachSheet((sheet) => {
    const position = order.indexOf(sheet.name);
    if (position >= 0) (sheet as any).orderNo = position;
  });

  return wb;
}

/** Build the workbook and hand it to the browser as a download. */
export async function downloadWorkbook(input: ExportInput): Promise<void> {
  const wb = await buildWorkbook(input);
  const rawBuffer = await wb.xlsx.writeBuffer();
  const buffer = await enableIterativeCalculation(rawBuffer, { iterateCount: 100, iterateDelta: 0.001 });
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