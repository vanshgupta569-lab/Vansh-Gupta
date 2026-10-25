// FILE: src/data/financials.ts
//
// THE FINANCIALS TAB'S DATA LAYER (docs/FINANCIALS_SPEC.md, stage A).
//
// The spec's own finding is the reason this file is careful rather than quick:
// of the five sites studied, **none links a number to the filing behind it**,
// and that is what this tab is for. So every cell that reaches the screen
// carries where it came from, what period it covers, what state it is in and
// what it is measured in — and a cell with nothing behind it says so instead
// of printing a number.
//
// THE FIVE STATES, NEVER CONFUSED (rule 3). A figure is one of:
//
//   reported        the filing says this number
//   reportedZero    the filing says nil, which is a claim and not an absence
//   notReported     the filing is silent: an em dash, never a zero
//   notApplicable   the line does not exist for this kind of company
//   derived         we worked it out, and the formula is recorded
//
// Collapsing the middle three into "0" is the single most common way a
// financial table lies, and `CLAUDE.md`'s third standing decision forbids it:
// missing data is never treated as zero.
//
// WHAT WE ACTUALLY HOLD TODAY, measured rather than assumed, because every
// honest thing below follows from it:
//
//   - ANNUAL PERIODS ONLY. The payload carries up to five years, each with a
//     `periodEnd` and a `fiscalYear`. There are no quarters and no half-years.
//     So the Quarterly and Half-year controls have nothing to show, and say
//     that rather than rendering an empty grid.
//   - TTM IS THEREFORE THE FULL YEAR, which is rule 5's own third case: "right
//     after an annual report: TTM = FY". `ttmMethod` below implements all of
//     rule 5, not only the branch today's data reaches, because the rule is the
//     thing being built and the data will catch up with it.
//   - SCALE COMES FROM THE LAYER THAT SET IT (rule 2), never from counting
//     digits: `api/company.js` divides every monetary XBRL fact by 1e6 with a
//     comment saying so, and share counts are left whole. That is why `kind`
//     below is part of the row definition rather than something inferred.
//   - 83 of 175 payloads come from SEC EDGAR and 92 from a vendor feed. The
//     vendor ones cannot be traced to a filing at all, and the evidence sheet
//     says exactly that rather than implying a provenance we do not have.
//
// WHAT IS DELIBERATELY NOT HERE (stage B): % of revenue, year-on-year and
// per-share views, "as first filed", sparklines and export. Rule 11's
// restatement history needs the archive (`docs/ARCHIVE_PLAN.md`), which was
// built on 2026-10-25 and has one capture per company so far.
import { isFinancialCompany } from './residualIncome.js';

export type ValueState = 'reported' | 'reportedZero' | 'notReported' | 'notApplicable' | 'derived';

export type RowKind = 'money' | 'shares' | 'percent';

export type Statement = 'income' | 'balance' | 'cash';

export type Frequency = 'annual' | 'quarterly' | 'half' | 'ttm';

export interface Cell {
  state: ValueState;
  /** Null whenever the state is not `reported`, `reportedZero` or `derived`. */
  value: number | null;
  /** One sentence, for any state that is not a plain reported figure. */
  reason?: string;
  /** How a derived figure was worked out, in the reader's words. */
  formula?: string;
}

export interface Period {
  key: string;
  /** The date the period ends. Rule 10 labels a column by this, not by the FY name. */
  endDate: string;
  fiscalYear: number;
  /** `FY25` — the secondary tag, per rule 10. */
  label: string;
  /** `27 Sep 2025`. */
  dateLabel: string;
  durationMonths: number | null;
  kind: 'annual' | 'ttm';
  /** Rule 7's header chips: `12M`, `TTM (FY basis)`, `derived`, `transition`. */
  chips: string[];
  basis: string;
}

export interface Row {
  key: string;
  label: string;
  statement: Statement;
  /** Detail rows sit behind the `+`, per screen design 5. */
  detail: boolean;
  kind: RowKind;
  /** Rule 6: a balance is a moment, never a total of moments. */
  pointInTime: boolean;
  cells: Cell[];
  /** Shown under the label when the row needs a word of explanation. */
  note?: string;
  /** For a derived row, the formula in general terms. */
  formula?: string;
}

export interface FinancialsView {
  periods: Period[];
  rows: Row[];
  template: 'industrial' | 'bank';
  /** `$ in millions`, or whatever this company files in. */
  unitLabel: string;
  currency: string;
  basisNote: string;
  sourceNote: string;
  /** Set when the chosen frequency holds no periods at all. */
  empty: string | null;
  ttm: TtmMethod | null;
}

// ---------------------------------------------------------------------------
// RULE 5: THE TTM METHOD IS CHOSEN FROM THE PERIODS THE COMPANY FILED
// ---------------------------------------------------------------------------
//
// Not from its country. An Indian company files income quarterly and cash flow
// half-yearly, so the right method differs **between two statements of the same
// company** — which is why this takes the periods for one statement rather than
// a company, and why the caller asks once per statement.
//
// Implemented in full, including the branches today's annual-only data never
// reaches, because the rule is what is being built here. `verify/scenarios.mts`
// drives all four branches with constructed period sets; the screen uses
// whichever one the real periods land on, and prints the label it returns.

export interface FiledPeriod {
  /** `YYYY-MM-DD`. */
  end: string;
  /** How long the period covers. 12 for a year, 3 for a quarter, 6 for a half. */
  months: number;
}

export interface TtmMethod {
  method: 'four-quarters' | 'half-year-bridge' | 'annual' | 'none';
  /** What the column header says, per rule 5's last line. */
  label: string;
  /** The period ends it combines, newest first. */
  uses: string[];
  /** Why this method and not another, for the ⓘ. */
  reason: string;
}

export function ttmMethod(filed: FiledPeriod[]): TtmMethod {
  const periods = [...filed].sort((a, b) => (a.end < b.end ? 1 : a.end > b.end ? -1 : 0));
  if (!periods.length) {
    return {
      method: 'none',
      label: 'TTM',
      uses: [],
      reason: 'No periods are held for this statement, so no trailing twelve months can be formed.',
    };
  }

  const latest = periods[0];

  // 1. THE LATEST FILED PERIOD IS ITSELF A YEAR. Rule 5: "right after an annual
  //    report: TTM = FY". Nothing is added and nothing is derived — the trailing
  //    twelve months and the financial year are the same twelve months.
  if (latest.months === 12) {
    return {
      method: 'annual',
      label: 'TTM (FY basis)',
      uses: [latest.end],
      reason:
        `The most recent period filed is the full year to ${latest.end}, so the trailing twelve months ` +
        'are that year. Nothing is added to it and nothing is derived.',
    };
  }

  // 2. A QUARTERLY FILER: the latest four discrete quarters, summed.
  const quarters = periods.filter((p) => p.months === 3);
  if (latest.months === 3 && quarters.length >= 4) {
    const four = quarters.slice(0, 4);
    return {
      method: 'four-quarters',
      label: 'TTM (4 quarters)',
      uses: four.map((p) => p.end),
      reason:
        `The four discrete quarters to ${four[0].end} are summed. Where a quarter was filed cumulatively ` +
        'it is the difference between two filings, and both are linked.',
    };
  }

  // 3. A HALF-YEARLY FILER: the full year, plus this half, less the same half a
  //    year ago. The only way to reach twelve months when six is the shortest
  //    period the company publishes.
  const halves = periods.filter((p) => p.months === 6);
  const year = periods.find((p) => p.months === 12);
  if (latest.months === 6 && year && halves.length >= 2) {
    const [thisHalf, priorHalf] = halves;
    return {
      method: 'half-year-bridge',
      label: 'TTM (H1 basis)',
      uses: [year.end, thisHalf.end, priorHalf.end],
      reason:
        `The year to ${year.end}, plus the half to ${thisHalf.end}, less the half to ${priorHalf.end}. ` +
        'Six months is the shortest period this statement is filed for, so the bridge is the only route ' +
        'to twelve.',
    };
  }

  return {
    method: 'none',
    label: 'TTM',
    uses: [],
    reason:
      `The periods held — ${periods
        .slice(0, 4)
        .map((p) => `${p.months}M to ${p.end}`)
        .join(', ')} — do not make up twelve months without inventing one, so no TTM is shown.`,
  };
}

// ---------------------------------------------------------------------------
// THE TEMPLATES (rule 13)
// ---------------------------------------------------------------------------
//
// A bank's income statement is not an industrial's with different words. It has
// no cost of sales, no gross profit and no operating margin, and **computing one
// anyway is the error this rule exists to prevent**: a bank's "revenue" is
// interest and fee income, and a margin struck against it means nothing a reader
// could act on. So the bank template carries its own lines, and the industrial
// template's derived rows are absent from it by construction rather than
// filtered out afterwards — a filter is something that can be forgotten.
//
// Five regulatory lines a bank statement needs are not in either feed. They are
// listed, under the detail rows, saying so: a reader who knows what a bank's
// accounts contain should be able to see what we are missing, and rule 3 says a
// line we do not hold is "not reported", not absent and not nil.

interface RowDef {
  key: string;
  label: string;
  statement: Statement;
  detail?: boolean;
  kind?: RowKind;
  pointInTime?: boolean;
  note?: string;
  /** The payload field, when the row is read straight from one. */
  field?: string;
  /** For a line the feed does not carry at all. */
  missing?: string;
  /** For a derived row: the inputs and how they combine. */
  derive?: { inputs: string[]; formula: string; of: (r: any) => number | null };
}

const num = (v: any): v is number => typeof v === 'number' && isFinite(v);

/** Every input present, or nothing: a derived figure with a hole in it is a lie. */
const all = (row: any, fields: string[]): number[] | null => {
  const out: number[] = [];
  for (const f of fields) {
    if (!num(row?.[f])) return null;
    out.push(row[f]);
  }
  return out;
};

const INCOME_INDUSTRIAL: RowDef[] = [
  { key: 'revenue', label: 'Revenue', statement: 'income', field: 'revenue' },
  { key: 'cogs', label: 'Cost of sales', statement: 'income', field: 'cogs' },
  {
    key: 'grossProfit',
    label: 'Gross profit',
    statement: 'income',
    derive: {
      inputs: ['revenue', 'cogs'],
      formula: 'Revenue − cost of sales',
      of: (r) => {
        const v = all(r, ['revenue', 'cogs']);
        return v ? v[0] - v[1] : null;
      },
    },
  },
  { key: 'rnd', label: 'Research and development', statement: 'income', detail: true, field: 'rnd' },
  { key: 'sga', label: 'Selling, general and administrative', statement: 'income', detail: true, field: 'sga' },
  { key: 'operatingIncome', label: 'Operating income', statement: 'income', field: 'operatingIncome' },
  {
    key: 'operatingMargin',
    label: 'Operating margin',
    statement: 'income',
    kind: 'percent',
    note: 'Recomputed from the two figures on this column, never averaged across columns (rule 7).',
    derive: {
      inputs: ['operatingIncome', 'revenue'],
      formula: 'Operating income ÷ revenue',
      of: (r) => {
        const v = all(r, ['operatingIncome', 'revenue']);
        return v && v[1] !== 0 ? v[0] / v[1] : null;
      },
    },
  },
  {
    key: 'ebitda',
    label: 'EBITDA',
    statement: 'income',
    detail: true,
    derive: {
      inputs: ['operatingIncome', 'depreciation'],
      formula: 'Operating income + depreciation and amortisation',
      of: (r) => {
        const v = all(r, ['operatingIncome', 'depreciation']);
        return v ? v[0] + v[1] : null;
      },
    },
  },
  { key: 'interestExpense', label: 'Interest expense', statement: 'income', detail: true, field: 'interestExpense' },
  { key: 'pretaxIncome', label: 'Pre-tax income', statement: 'income', field: 'pretaxIncome' },
  { key: 'taxExpense', label: 'Tax expense', statement: 'income', detail: true, field: 'taxExpense' },
  { key: 'netIncome', label: 'Net income', statement: 'income', field: 'netIncome' },
  {
    key: 'dilutedShares',
    label: 'Diluted shares',
    statement: 'income',
    detail: true,
    kind: 'shares',
    field: 'dilutedShares',
    note: 'Whole shares, not millions: the data layer leaves share counts unscaled.',
  },
];

const INCOME_BANK: RowDef[] = [
  {
    key: 'revenue',
    label: 'Total income',
    statement: 'income',
    field: 'revenue',
    note: 'Interest earned plus other income, as the feed reports it in one line.',
  },
  {
    key: 'interestEarned',
    label: 'Interest earned',
    statement: 'income',
    detail: true,
    missing: 'Neither feed splits a bank’s interest income from its other income.',
  },
  { key: 'interestExpense', label: 'Interest expended', statement: 'income', field: 'interestExpense' },
  {
    key: 'operatingProfitBeforeProvisions',
    label: 'Operating profit before provisions',
    statement: 'income',
    detail: true,
    missing: 'Not carried by either feed. It is the line a bank is actually read on.',
  },
  {
    key: 'provisions',
    label: 'Provisions and contingencies',
    statement: 'income',
    detail: true,
    missing: 'Not carried by either feed.',
  },
  { key: 'operatingIncome', label: 'Operating income', statement: 'income', field: 'operatingIncome' },
  { key: 'pretaxIncome', label: 'Pre-tax income', statement: 'income', field: 'pretaxIncome' },
  { key: 'taxExpense', label: 'Tax expense', statement: 'income', detail: true, field: 'taxExpense' },
  { key: 'netIncome', label: 'Net income', statement: 'income', field: 'netIncome' },
  {
    key: 'dilutedShares',
    label: 'Diluted shares',
    statement: 'income',
    detail: true,
    kind: 'shares',
    field: 'dilutedShares',
  },
];

const BALANCE: RowDef[] = [
  { key: 'cash', label: 'Cash and equivalents', statement: 'balance', pointInTime: true, field: 'cash' },
  {
    key: 'shortTermInvestments',
    label: 'Short-term investments',
    statement: 'balance',
    detail: true,
    pointInTime: true,
    field: 'shortTermInvestments',
  },
  { key: 'receivables', label: 'Receivables', statement: 'balance', detail: true, pointInTime: true, field: 'receivables' },
  { key: 'inventory', label: 'Inventory', statement: 'balance', detail: true, pointInTime: true, field: 'inventory' },
  { key: 'currentAssets', label: 'Total current assets', statement: 'balance', pointInTime: true, field: 'currentAssets' },
  { key: 'ppeNet', label: 'Property, plant and equipment, net', statement: 'balance', detail: true, pointInTime: true, field: 'ppeNet' },
  { key: 'goodwill', label: 'Goodwill', statement: 'balance', detail: true, pointInTime: true, field: 'goodwill' },
  { key: 'intangibles', label: 'Other intangible assets', statement: 'balance', detail: true, pointInTime: true, field: 'intangibles' },
  { key: 'totalAssets', label: 'Total assets', statement: 'balance', pointInTime: true, field: 'totalAssets' },
  { key: 'payables', label: 'Payables', statement: 'balance', detail: true, pointInTime: true, field: 'payables' },
  { key: 'currentLiabilities', label: 'Total current liabilities', statement: 'balance', pointInTime: true, field: 'currentLiabilities' },
  { key: 'longTermDebt', label: 'Long-term debt', statement: 'balance', pointInTime: true, field: 'longTermDebt' },
  { key: 'totalLiabilities', label: 'Total liabilities', statement: 'balance', pointInTime: true, field: 'totalLiabilities' },
  { key: 'equity', label: 'Shareholders’ equity', statement: 'balance', pointInTime: true, field: 'equity' },
  {
    key: 'minorityInterest',
    label: 'Minority interest',
    statement: 'balance',
    detail: true,
    pointInTime: true,
    field: 'minorityInterest',
  },
];

const BALANCE_BANK: RowDef[] = [
  ...BALANCE.slice(0, 1),
  {
    key: 'deposits',
    label: 'Deposits',
    statement: 'balance',
    pointInTime: true,
    missing: 'Not carried by either feed. For a bank it is the largest liability there is.',
  },
  {
    key: 'advances',
    label: 'Advances',
    statement: 'balance',
    detail: true,
    pointInTime: true,
    missing: 'Not carried by either feed.',
  },
  ...BALANCE.slice(1),
];

const CASH: RowDef[] = [
  { key: 'operatingCashFlow', label: 'Cash from operations', statement: 'cash', field: 'operatingCashFlow' },
  { key: 'capex', label: 'Capital expenditure', statement: 'cash', field: 'capex' },
  {
    key: 'freeCashFlow',
    label: 'Free cash flow',
    statement: 'cash',
    derive: {
      inputs: ['operatingCashFlow', 'capex'],
      formula: 'Cash from operations − capital expenditure',
      of: (r) => {
        const v = all(r, ['operatingCashFlow', 'capex']);
        return v ? v[0] - v[1] : null;
      },
    },
  },
  { key: 'investingCashFlow', label: 'Cash from investing', statement: 'cash', detail: true, field: 'investingCashFlow' },
  { key: 'financingCashFlow', label: 'Cash from financing', statement: 'cash', detail: true, field: 'financingCashFlow' },
  { key: 'depreciation', label: 'Depreciation and amortisation', statement: 'cash', detail: true, field: 'depreciation' },
  { key: 'stockComp', label: 'Stock compensation', statement: 'cash', detail: true, field: 'stockComp' },
  { key: 'dividendsPaid', label: 'Dividends paid', statement: 'cash', detail: true, field: 'dividendsPaid' },
  { key: 'buybacks', label: 'Share buybacks', statement: 'cash', detail: true, field: 'buybacks' },
];

export const TEMPLATES = {
  industrial: { income: INCOME_INDUSTRIAL, balance: BALANCE, cash: CASH },
  bank: { income: INCOME_BANK, balance: BALANCE_BANK, cash: CASH },
};

/** Rule 13's own test, in one place so the screen and the checks agree. */
export function templateFor(payload: any): 'industrial' | 'bank' {
  return isFinancialCompany(payload) ? 'bank' : 'industrial';
}

/**
 * The rows a bank must never be given, named here rather than left implicit.
 *
 * `verify/scenarios.mts` asserts no bank's view carries any of them, and it
 * reads this list rather than keeping its own copy — so a margin added to the
 * industrial template later is checked on banks without anybody remembering to
 * update the check.
 */
export const FORBIDDEN_FOR_BANKS = ['operatingMargin', 'ebitda', 'grossProfit', 'cogs'];

// ---------------------------------------------------------------------------
// BUILDING THE VIEW
// ---------------------------------------------------------------------------

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const dateLabel = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return String(iso || '—');
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
};

/** Whole months between two period ends, which is how long the later one ran. */
const monthsBetween = (from: string, to: string): number | null => {
  const a = new Date(`${from}T00:00:00Z`);
  const b = new Date(`${to}T00:00:00Z`);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return null;
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24 * 30.4375));
};

/**
 * Where the figures came from, in the words the reader is owed.
 *
 * The honesty the brief asked for: a vendor feed cannot be traced to a filing,
 * and saying "source: Yahoo Finance" next to a number implies a provenance that
 * does not exist. It says development only, because that is what
 * `DATA_CONSTRAINTS.md` records about it.
 */
export function sourceEvidence(payload: any): { traceable: boolean; line: string; url: string | null } {
  const source = String(payload?.source || '');
  if (/sec/i.test(source)) {
    return {
      traceable: true,
      line: 'SEC EDGAR, XBRL company facts — each figure is a tagged fact in the filing.',
      url: payload?.sourceUrl || null,
    };
  }
  return {
    traceable: false,
    line: `Vendor feed, development only — ${source || 'an unnamed vendor'} does not say which filing each figure came from, and this site is not licensed to redistribute it.`,
    url: payload?.sourceUrl || null,
  };
}

const cellFor = (def: RowDef, row: any): Cell => {
  if (def.missing) return { state: 'notReported', value: null, reason: def.missing };
  if (def.derive) {
    const v = def.derive.of(row);
    if (v === null) {
      const absent = def.derive.inputs.filter((f) => !num(row?.[f]));
      return {
        state: 'notReported',
        value: null,
        reason: `${def.derive.formula}, and ${absent.join(' and ')} ${
          absent.length > 1 ? 'are' : 'is'
        } not reported for this period. A derived figure with a hole in it would be a guess.`,
        formula: def.derive.formula,
      };
    }
    return { state: 'derived', value: v, formula: def.derive.formula };
  }
  const raw = def.field ? row?.[def.field] : undefined;
  if (!num(raw)) {
    return {
      state: 'notReported',
      value: null,
      reason: 'The source does not report this line for this period. It is not a nil.',
    };
  }
  if (raw === 0) {
    return {
      state: 'reportedZero',
      value: 0,
      reason: 'Reported as nil, which is a figure the company filed rather than a gap.',
    };
  }
  return { state: 'reported', value: raw };
};

/**
 * The TTM cell for one row.
 *
 * RULE 6 LIVES HERE. A balance sheet line is a moment, so its trailing-twelve-
 * month value is the latest balance and never a sum — adding four quarter-end
 * cash balances produces a number with no meaning that nonetheless looks like
 * money. Everything else follows `ttmMethod`, and with annual-only periods that
 * is the full year, unchanged.
 */
const ttmCell = (def: RowDef, rows: any[], method: TtmMethod): Cell => {
  if (!rows.length || method.method === 'none') {
    return { state: 'notReported', value: null, reason: method.reason };
  }
  const latest = rows[rows.length - 1];
  if (def.pointInTime) {
    const cell = cellFor(def, latest);
    if (cell.value === null) return cell;
    return {
      ...cell,
      reason: `A balance at ${dateLabel(latest.periodEnd)}, carried across unchanged. A balance sheet line is never summed (rule 6).`,
    };
  }
  if (method.method === 'annual') return cellFor(def, latest);
  // No other branch is reachable from an annual-only payload; when quarters
  // arrive they arrive with the arithmetic rule 4 describes, and this is where
  // it will go rather than somewhere new.
  return {
    state: 'notReported',
    value: null,
    reason: `${method.label}: ${method.reason}`,
  };
};

export interface ViewOptions {
  statement: Statement;
  frequency: Frequency;
  /** Rule 4 of screen design: 5, 10 or every year held. */
  window?: 5 | 10 | 'all';
  /** Rule 4 of screen design: oldest first by default, the way a statement reads. */
  order?: 'oldest' | 'newest';
}

export function financialsFor(payload: any, opts: ViewOptions): FinancialsView {
  const template = templateFor(payload);
  const defs = TEMPLATES[template][opts.statement];
  const currency = String(payload?.currency || '');
  const symbol = String(payload?.currencySymbol || currency || '');
  const statements: any[] = Array.isArray(payload?.statements) ? payload.statements : [];
  const source = sourceEvidence(payload);

  // THE PERIODS WE ACTUALLY HOLD. Sorted oldest first, which is the order a
  // statement is read in and the order the payload already uses.
  const annual = [...statements]
    .filter((r) => r && typeof r.periodEnd === 'string')
    .sort((a, b) => (a.periodEnd < b.periodEnd ? -1 : 1));

  const filed: FiledPeriod[] = annual.map((r, i) => ({
    end: r.periodEnd,
    months: i === 0 ? 12 : monthsBetween(annual[i - 1].periodEnd, r.periodEnd) ?? 12,
  }));
  const method = ttmMethod(filed);

  const unitLabel =
    opts.statement === 'income' || opts.statement === 'cash'
      ? `${symbol} in millions`
      : `${symbol} in millions, at each period end`;

  // Only Annual and TTM have periods today, and the others say so rather than
  // drawing an empty grid (screen design 1: "showing only periods that exist").
  if (opts.frequency === 'quarterly' || opts.frequency === 'half') {
    return {
      periods: [],
      rows: [],
      template,
      unitLabel,
      currency,
      basisNote: basisNote(payload, source),
      sourceNote: source.line,
      ttm: method,
      empty:
        opts.frequency === 'quarterly'
          ? 'No quarterly periods are held for this company. The data layer fetches annual filings only, so there is nothing to show here yet — and an empty grid would suggest a company that files nothing.'
          : 'No half-year periods are held for this company, for the same reason the quarterly view has none: the data layer fetches annual filings only.',
    };
  }

  const windowed = (() => {
    if (opts.window === 5) return annual.slice(-5);
    if (opts.window === 10) return annual.slice(-10);
    return annual;
  })();

  const periods: Period[] = windowed.map((r, i) => {
    const prev = i > 0 ? windowed[i - 1] : null;
    const months = prev ? monthsBetween(prev.periodEnd, r.periodEnd) : 12;
    // Rule 9: a year that is not twelve months long gets its own label and is
    // never compared with one that is.
    const transition = months !== null && months !== 12;
    return {
      key: `FY${r.fiscalYear}`,
      endDate: r.periodEnd,
      fiscalYear: r.fiscalYear,
      label: `FY${String(r.fiscalYear).slice(-2)}`,
      dateLabel: dateLabel(r.periodEnd),
      durationMonths: months,
      kind: 'annual' as const,
      chips: transition ? [`${months}M transition`] : ['12M'],
      basis: basisFor(payload),
    };
  });

  if (opts.frequency === 'ttm' || periods.length) {
    // TTM IS PINNED BESIDE THE LATEST YEAR (screen design 4) rather than being a
    // view of its own that hides the years it was built from.
    if (windowed.length) {
      periods.push({
        key: 'TTM',
        endDate: windowed[windowed.length - 1].periodEnd,
        fiscalYear: windowed[windowed.length - 1].fiscalYear,
        label: 'TTM',
        dateLabel: dateLabel(windowed[windowed.length - 1].periodEnd),
        durationMonths: 12,
        kind: 'ttm',
        chips: [method.label],
        basis: basisFor(payload),
      });
    }
  }

  const rows: Row[] = defs.map((def) => {
    const cells = windowed.map((r) => cellFor(def, r));
    if (windowed.length) cells.push(ttmCell(def, windowed, method));
    return {
      key: def.key,
      label: def.label,
      statement: def.statement,
      detail: Boolean(def.detail),
      kind: def.kind || 'money',
      pointInTime: Boolean(def.pointInTime),
      cells,
      note: def.note,
      formula: def.derive?.formula,
    };
  });

  const ordered = opts.order === 'newest' ? reverse(periods, rows) : { periods, rows };

  return {
    ...ordered,
    template,
    unitLabel,
    currency,
    basisNote: basisNote(payload, source),
    sourceNote: source.line,
    ttm: method,
    empty: periods.length ? null : 'No periods are held for this company at all.',
  };
}

/** Newest-first, keeping TTM against the year it was struck from. */
function reverse(periods: Period[], rows: Row[]): { periods: Period[]; rows: Row[] } {
  const order = periods.map((_, i) => i).reverse();
  return {
    periods: order.map((i) => periods[i]),
    rows: rows.map((r) => ({ ...r, cells: order.map((i) => r.cells[i]) })),
  };
}

/** Rule 15: say which basis every number is on, and never guess at one. */
function basisFor(payload: any): string {
  return /sec/i.test(String(payload?.source || '')) ? 'Consolidated' : 'Basis not stated';
}

function basisNote(payload: any, source: { traceable: boolean }): string {
  if (source.traceable) {
    return 'Consolidated, which is the basis a US filer’s primary statements are on. No standalone statements are filed, so there is nothing to toggle between.';
  }
  return 'The vendor feed does not say whether these are consolidated or standalone figures. Rule 15 asks for the basis to be labelled on every number, and this one cannot be — so it says so rather than assuming consolidated.';
}

// ---------------------------------------------------------------------------
// THE EVIDENCE SHEET (screen design 8)
// ---------------------------------------------------------------------------
//
// The whole point of the tab. Every number opens this, and it answers: what
// figure, for what period, on what basis, in what unit, from where, and in what
// state. Where the honest answer is "we cannot trace this", that is the answer
// it gives.

export interface Evidence {
  title: string;
  value: string;
  state: ValueState;
  stateLabel: string;
  lines: { label: string; value: string }[];
  /** The source sentence, which for a vendor feed is a warning. */
  source: string;
  traceable: boolean;
  url: string | null;
  /** The XBRL concepts the data layer reads for this line, where it reads any. */
  concepts: string[] | null;
  note?: string;
}

/**
 * The XBRL concepts behind each line, for the SEC path.
 *
 * Mirrored from `US_TAGS` in `api/company.js`, which is not importable here —
 * that file is packaged on its own by the host and a shared import there has
 * taken the route down before (its own comment says so). What this CANNOT say
 * is which of the candidates a given company used in a given year, because the
 * payload does not record it: the evidence sheet says that in those words
 * rather than naming one and hoping. Recording the winning tag is a payload
 * change, and so a stage B job.
 */
const CONCEPTS: Record<string, string[]> = {
  revenue: ['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet'],
  cogs: ['CostOfGoodsAndServicesSold', 'CostOfRevenue', 'CostOfServices'],
  rnd: ['ResearchAndDevelopmentExpense'],
  sga: ['SellingGeneralAndAdministrativeExpense', 'GeneralAndAdministrativeExpense'],
  operatingIncome: ['OperatingIncomeLoss'],
  pretaxIncome: ['IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest'],
  taxExpense: ['IncomeTaxExpenseBenefit'],
  netIncome: ['NetIncomeLoss', 'ProfitLoss'],
  interestExpense: ['InterestExpense', 'InterestExpenseNonoperating', 'InterestExpenseDebt'],
  cash: ['CashAndCashEquivalentsAtCarryingValue'],
  shortTermInvestments: ['ShortTermInvestments', 'MarketableSecuritiesCurrent'],
  receivables: ['AccountsReceivableNetCurrent'],
  inventory: ['InventoryNet'],
  currentAssets: ['AssetsCurrent'],
  ppeNet: ['PropertyPlantAndEquipmentNet'],
  goodwill: ['Goodwill'],
  intangibles: ['FiniteLivedIntangibleAssetsNet', 'IntangibleAssetsNetExcludingGoodwill'],
  totalAssets: ['Assets'],
  payables: ['AccountsPayableCurrent'],
  currentLiabilities: ['LiabilitiesCurrent'],
  longTermDebt: ['LongTermDebtNoncurrent', 'LongTermDebt'],
  totalLiabilities: ['Liabilities'],
  equity: ['StockholdersEquity'],
  minorityInterest: ['MinorityInterest'],
  operatingCashFlow: ['NetCashProvidedByUsedInOperatingActivities'],
  capex: ['PaymentsToAcquirePropertyPlantAndEquipment'],
  investingCashFlow: ['NetCashProvidedByUsedInInvestingActivities'],
  financingCashFlow: ['NetCashProvidedByUsedInFinancingActivities'],
  depreciation: ['DepreciationDepletionAndAmortization', 'DepreciationAndAmortization'],
  stockComp: ['ShareBasedCompensation'],
  dividendsPaid: ['PaymentsOfDividends', 'PaymentsOfDividendsCommonStock'],
  buybacks: ['PaymentsForRepurchaseOfCommonStock'],
  dilutedShares: ['WeightedAverageNumberOfDilutedSharesOutstanding'],
};

const STATE_LABELS: Record<ValueState, string> = {
  reported: 'Reported',
  reportedZero: 'Reported as nil',
  notReported: 'Not reported',
  notApplicable: 'Not applicable',
  derived: 'Derived',
};

export function formatValue(cell: Cell, kind: RowKind, symbol: string): string {
  if (cell.value === null) return '—';
  if (kind === 'percent') return `${(cell.value * 100).toFixed(1)}%`;
  if (kind === 'shares') return cell.value.toLocaleString('en-US', { maximumFractionDigits: 0 });
  const n = cell.value;
  const body = Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
  return `${n < 0 ? '−' : ''}${symbol}${body}`;
}

export function evidenceFor(payload: any, view: FinancialsView, row: Row, index: number): Evidence {
  const cell = row.cells[index];
  const period = view.periods[index];
  const source = sourceEvidence(payload);
  const symbol = String(payload?.currencySymbol || payload?.currency || '');

  const lines: { label: string; value: string }[] = [
    ['Line', row.label],
    ['Period', `${period.label} · ${period.dateLabel}`],
    ['Duration', period.kind === 'ttm' ? period.chips[0] : `${period.durationMonths ?? 12} months to ${period.dateLabel}`],
    ['Basis', period.basis],
    ['Unit', row.kind === 'money' ? `${symbol}, millions` : row.kind === 'shares' ? 'whole shares' : 'per cent'],
    ['Currency', view.currency || 'not stated'],
    ['State', STATE_LABELS[cell.state]],
    ['Form', source.traceable ? 'Annual report (10-K / 20-F), as tagged in XBRL' : 'not recorded by the feed'],
    ['Filing date', 'not recorded by the feed'],
    ['Filing ID', 'not recorded by the feed'],
    ['Restated', 'not known — one capture held, so no earlier version to compare'],
  ].map(([label, value]) => ({ label, value }));

  return {
    title: `${row.label} · ${period.label}`,
    value: formatValue(cell, row.kind, symbol),
    state: cell.state,
    stateLabel: STATE_LABELS[cell.state],
    lines,
    source: source.line,
    traceable: source.traceable,
    url: source.url,
    concepts: source.traceable && !row.formula ? CONCEPTS[row.key] ?? null : null,
    note: cell.formula ? `${cell.formula}.` : cell.reason,
  };
}

export default { financialsFor, evidenceFor, ttmMethod, templateFor, TEMPLATES, FORBIDDEN_FOR_BANKS };
