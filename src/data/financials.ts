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

/**
 * How many interim columns a reader gets: Screener shows thirteen, which is
 * three years of seasonality plus the quarter they are actually looking at.
 * The data layer fetches the same number, so this is the ceiling rather than
 * a second opinion about it.
 */
const QUARTERS_SHOWN = 13;

export type Statement = 'income' | 'balance' | 'cash';

export type Frequency = 'annual' | 'quarterly' | 'half' | 'ttm';

export interface Filing {
  accn: string;
  form: string | null;
  filed: string | null;
  url: string;
}

export interface Cell {
  state: ValueState;
  /** Null whenever the state is not `reported`, `reportedZero` or `derived`. */
  value: number | null;
  /** One sentence, for any state that is not a plain reported figure. */
  reason?: string;
  /** How a derived figure was worked out, in the reader's words. */
  formula?: string;
  /** The filing this figure was read from, where there is one. */
  filing?: Filing | null;
  /**
   * THE TWO FILINGS A DERIVED QUARTER IS THE DIFFERENCE OF.
   *
   * A quarter worked out as this year-to-date less the last one is a claim
   * about two documents, so one link would be half the provenance. Rule 4
   * asks for both and `npm run verify` fails if a derived figure carries
   * fewer than two.
   */
  derivedFrom?: Filing[];
}

export interface Period {
  key: string;
  /** 3 for a quarter, 6 for a half year, 12 for a year. */
  months: number;
  /** `Q3`, `H1`, or null where the source does not say which period it is. */
  fiscalPeriod?: string | null;
  /** For a TTM column: the period ends it was built from. */
  uses?: string[];
  /** The date the period ends. Rule 10 labels a column by this, not by the FY name. */
  endDate: string;
  fiscalYear: number;
  /** `FY25` — the secondary tag, per rule 10. */
  label: string;
  /** `27 Sep 2025`. */
  dateLabel: string;
  durationMonths: number | null;
  kind: 'annual' | 'quarter' | 'half' | 'ttm';
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

/**
 * ONE PERIOD AS THE PAYLOAD HOLDS IT, whichever shape it came in.
 *
 * An annual row is flat — `{ revenue: 416161, ... }` — because that is what
 * the engine has always read. A quarter is `{ values, states, filing,
 * derivedFrom }`, because a quarter has provenance an annual row does not:
 * which filing, and whether the figure was filed or worked out. Everything
 * below reads periods through this so the two never need separate code paths.
 */
interface SourceRow {
  kind: 'annual' | 'quarter' | 'half';
  end: string;
  start: string | null;
  months: number;
  fiscalYear: number;
  fiscalPeriod: string | null;
  values: any;
  /** How long the period actually ran, where the source dates it. */
  days: number | null;
  states: Record<string, string>;
  filing: Filing | null;
  derivedFrom: Record<string, Filing[]>;
}

const annualRow = (r: any, months: number): SourceRow => ({
  kind: 'annual',
  end: r.periodEnd,
  start: null,
  months,
  fiscalYear: r.fiscalYear,
  fiscalPeriod: null,
  values: r,
  days: null,
  states: {},
  filing: null,
  derivedFrom: {},
});

const quarterRow = (q: any): SourceRow => ({
  kind: q.months === 6 ? 'half' : 'quarter',
  end: q.periodEnd,
  start: q.periodStart ?? null,
  months: q.months,
  fiscalYear: q.fiscalYear,
  fiscalPeriod: q.fiscalPeriod ?? null,
  values: q.values || {},
  days: typeof q.days === 'number' ? q.days : null,
  states: q.states || {},
  filing: q.filing ?? null,
  derivedFrom: q.derivedFrom || {},
});

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

const cellFor = (def: RowDef, source: SourceRow): Cell => {
  const row = source.values;
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
    return { state: 'derived', value: v, formula: def.derive.formula, filing: source.filing };
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
      filing: source.filing,
    };
  }
  // A QUARTER THE COMPANY DID NOT FILE, WORKED OUT FROM TWO THAT IT DID.
  // The payload says so, and carries both documents; this is where that
  // reaches the screen rather than being flattened into a plain figure.
  if (def.field && source.states[def.field] === 'derived') {
    return {
      state: 'derived',
      value: raw,
      formula:
        source.months === 3
          ? 'This year to date, less the year to date at the end of the previous quarter'
          : 'Worked out from two filed periods',
      filing: source.filing,
      derivedFrom: source.derivedFrom[def.field] || [],
    };
  }
  return { state: 'reported', value: raw, filing: source.filing };
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
const ttmCell = (def: RowDef, annual: SourceRow[], all: SourceRow[], method: TtmMethod): Cell => {

  // RULE 6 LIVES HERE, and it comes before every other branch. A balance
  // sheet line is a moment, so its trailing-twelve-month value is the LATEST
  // BALANCE and never a sum: adding four quarter-end cash balances produces a
  // number with no meaning that nonetheless looks like money.
  // A BALANCE NEEDS NO TRAILING-TWELVE-MONTH METHOD AT ALL, so this comes
  // before the question of whether there is one. A company whose quarters do
  // not make up a year has no TTM for its income statement and still has a
  // most recent balance sheet; asking the method first emptied the balance
  // sheet column for 119 lines across the set, every one of which was held.
  if (def.pointInTime) {
    // THE LATEST BALANCE OF THIS LINE, which is not the same as this line in
    // the latest period. A quarterly balance sheet is thinner than an annual
    // one — a 10-Q reports total assets and often not goodwill — so taking
    // the newest period and reading whatever it holds turns every line the
    // quarter leaves out into a dash, while the figure sits in the year end
    // three months earlier. "Show the latest balance" means the latest balance
    // OF THAT LINE, and the date it is as of travels with it.
    const newestFirst = [...all].sort((a, b) => (a.end < b.end ? 1 : -1));
    for (const at of newestFirst) {
      const cell = cellFor(def, at);
      if (cell.value === null) continue;
      return {
        ...cell,
        reason: `A balance at ${dateLabel(at.end)}, carried across unchanged. A balance sheet line is never summed (rule 6).`,
      };
    }
    return {
      state: 'notReported',
      value: null,
      reason: 'No period held for this company reports this line, so there is no balance to carry across.',
    };
  }

  if (method.method === 'none') {
    return { state: 'notReported', value: null, reason: method.reason };
  }

  const by = new Map(all.map((r) => [`${r.end}|${r.months}`, r]));
  const find = (end: string, months: number) => by.get(`${end}|${months}`);

  // THE FOUR QUARTERS THE COMPANY ACTUALLY FILED, added up.
  if (method.method === 'four-quarters') {
    const parts = method.uses.map((end) => find(end, 3)).filter(Boolean) as SourceRow[];
    if (parts.length !== 4) {
      return {
        state: 'notReported',
        value: null,
        reason: `Four quarters are needed and ${parts.length} are held, so no trailing twelve months is shown.`,
      };
    }
    const cells = parts.map((p) => cellFor(def, p));
    if (cells.some((c) => c.value === null)) {
      const missing = parts.filter((p, i) => cells[i].value === null).map((p) => dateLabel(p.end));
      return {
        state: 'notReported',
        value: null,
        reason: `This line is not reported for ${missing.join(' and ')}, and three quarters of a year is not a year.`,
      };
    }
    return {
      state: 'derived',
      value: cells.reduce((t, c) => t + (c.value || 0), 0),
      formula: `The four quarters to ${dateLabel(method.uses[0])}, added`,
      derivedFrom: cells.flatMap((c) => (c.filing ? [c.filing] : [])),
    };
  }

  // THE YEAR, PLUS THIS HALF, LESS THE SAME HALF A YEAR AGO.
  if (method.method === 'half-year-bridge') {
    const [yearEnd, thisHalf, priorHalf] = method.uses;
    const parts = [find(yearEnd, 12), find(thisHalf, 6), find(priorHalf, 6)];
    if (parts.some((p) => !p)) {
      return { state: 'notReported', value: null, reason: method.reason };
    }
    const cells = (parts as SourceRow[]).map((p) => cellFor(def, p));
    if (cells.some((c) => c.value === null)) {
      return {
        state: 'notReported',
        value: null,
        reason: 'One of the three periods the bridge needs does not report this line, and a bridge with a hole in it is a guess.',
      };
    }
    return {
      state: 'derived',
      value: (cells[0].value || 0) + (cells[1].value || 0) - (cells[2].value || 0),
      formula: `The year to ${dateLabel(yearEnd)}, plus the half to ${dateLabel(thisHalf)}, less the half to ${dateLabel(priorHalf)}`,
      derivedFrom: cells.flatMap((c) => (c.filing ? [c.filing] : [])),
    };
  }

  // THE LATEST FILED PERIOD IS ITSELF THE YEAR.
  const latest = annual[annual.length - 1];
  if (!latest) return { state: 'notReported', value: null, reason: method.reason };
  return cellFor(def, latest);
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

  // THE PERIODS WE ACTUALLY HOLD, of both kinds, oldest first — which is the
  // order a statement is read in and the order the payload already uses.
  const annualRaw = [...statements]
    .filter((r) => r && typeof r.periodEnd === 'string')
    .sort((a, b) => (a.periodEnd < b.periodEnd ? -1 : 1));
  const annual: SourceRow[] = annualRaw.map((r, i) =>
    annualRow(r, i === 0 ? 12 : monthsBetween(annualRaw[i - 1].periodEnd, r.periodEnd) ?? 12)
  );

  const quarterly: SourceRow[] = (Array.isArray(payload?.quarters) ? payload.quarters : [])
    .filter((q: any) => q && typeof q.periodEnd === 'string' && q.values)
    .map(quarterRow)
    .sort((a: SourceRow, b: SourceRow) => (a.end < b.end ? -1 : a.end > b.end ? 1 : a.months - b.months));

  const everything = [...annual, ...quarterly];

  // WHICH PERIODS THIS STATEMENT WAS ACTUALLY FILED FOR, which is rule 5’s
  // real point: an Indian company files its income quarterly and its balance
  // sheet and cash flow only at the half year and the year end, so the right
  // TTM method differs BETWEEN TWO STATEMENTS OF THE SAME COMPANY. Asking per
  // statement is what makes that fall out rather than needing a country rule.
  const fields = defs.map((d) => d.field).filter(Boolean) as string[];
  const carries = (r: SourceRow) => fields.some((f) => num(r.values?.[f]));
  const filed: FiledPeriod[] = everything
    .filter(carries)
    .map((r) => ({ end: r.end, months: r.months }));
  const method = ttmMethod(filed);

  const unitLabel =
    opts.statement === 'income' || opts.statement === 'cash'
      ? `${symbol} in millions`
      : `${symbol} in millions, at each period end`;

  // SCREEN DESIGN 1: ONLY THE PERIODS THAT EXIST. A company that files no
  // half years has no Half-year view, and is told so — an empty grid would
  // read as a company that filed nothing, which is a lie about the company
  // rather than about us.
  const wantMonths = opts.frequency === 'quarterly' ? 3 : opts.frequency === 'half' ? 6 : 12;
  if (opts.frequency === 'quarterly' || opts.frequency === 'half') {
    const interim = quarterly.filter((q) => q.months === wantMonths && carries(q));
    if (!interim.length) {
      const otherKind = quarterly.filter((q) => q.months !== wantMonths).length;
      // THE INDIA CASE, WHICH RULE 5 NAMES: a company can file its income
      // quarterly and its balance sheet and cash flow only at the half year
      // and the year end. So "no quarters" and "quarters, but not of this
      // statement" are different answers, and a reader looking for a quarterly
      // cash flow is owed the second one rather than being told the company
      // does not report quarters at all.
      const periodsOfThisLength = quarterly.filter((q) => q.months === wantMonths).length;
      const word = opts.statement === 'income' ? 'income statement' : opts.statement === 'balance' ? 'balance sheet' : 'cash flow';
      if (periodsOfThisLength) {
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
            `This company files ${opts.frequency === 'quarterly' ? 'quarters' : 'half years'} — ` +
            `${periodsOfThisLength} of them are held — but none carries a ${word}. ` +
            'A balance sheet and a cash flow are often filed only at the half year and the year end ' +
            'even where the income statement is quarterly, which is the ordinary pattern in India.',
        };
      }
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
          `No ${opts.frequency === 'quarterly' ? 'quarterly' : 'half-year'} periods are held for this ` +
          `statement.` +
          (otherKind
            ? ` This company files ${opts.frequency === 'quarterly' ? 'half years' : 'quarters'}, and they are ` +
              'under the other control.'
            : ' Either the company does not file them or the source does not carry them, and an empty grid ' +
              'would suggest a company that files nothing.'),
      };
    }
    return buildView(
      payload,
      defs,
      interim.slice(-QUARTERS_SHOWN),
      everything,
      annual,
      method,
      { ...opts, withTtm: false },
      { template, unitLabel, currency, source }
    );
  }

  const windowed = (() => {
    if (opts.window === 5) return annual.slice(-5);
    if (opts.window === 10) return annual.slice(-10);
    return annual;
  })();

  return buildView(payload, defs, windowed, everything, annual, method, { ...opts, withTtm: true }, {
    template,
    unitLabel,
    currency,
    source,
  });
}

/**
 * The columns and the rows, once it is known which periods they are.
 *
 * Shared by the annual and the interim views because the only difference
 * between them is which periods go in and whether a TTM column is pinned to
 * the end — and two copies of this would be two sets of rules about zeroes.
 */
function buildView(
  payload: any,
  defs: RowDef[],
  shownPeriods: SourceRow[],
  everything: SourceRow[],
  annual: SourceRow[],
  method: TtmMethod,
  opts: ViewOptions & { withTtm: boolean },
  about: { template: 'industrial' | 'bank'; unitLabel: string; currency: string; source: any }
): FinancialsView {

  const periods: Period[] = shownPeriods.map((r, i) => {
    const prev = i > 0 ? shownPeriods[i - 1] : null;
    const months =
      r.kind === 'annual' ? (prev ? monthsBetween(prev.end, r.end) : r.months) : r.months;
    // Rule 9: a year that is not twelve months long gets its own label and is
    // never compared with one that is.
    const transition = r.kind === 'annual' && months !== null && months !== 12;
    const quarterLabel = r.fiscalPeriod || `${r.months}M`;
    return {
      key: r.kind === 'annual' ? `FY${r.fiscalYear}` : `${r.end}:${r.months}`,
      endDate: r.end,
      fiscalYear: r.fiscalYear,
      label:
        r.kind === 'annual'
          ? `FY${String(r.fiscalYear).slice(-2)}`
          : `${quarterLabel} FY${String(r.fiscalYear).slice(-2)}`,
      dateLabel: dateLabel(r.end),
      durationMonths: months,
      months: r.months,
      fiscalPeriod: r.fiscalPeriod,
      kind: r.kind === 'annual' ? ('annual' as const) : r.months === 6 ? ('half' as const) : ('quarter' as const),
      // RULE 9: A PERIOD THAT IS NOT ITS USUAL LENGTH SAYS SO. A 52/53-week
      // filer divides its year 12, 12, 12 and 16 weeks, and a sixteen-week
      // quarter compared with a twelve-week one is the kind of comparison
      // this rule exists to stop being made silently.
      chips: transition
        ? [`${months}M transition`]
        : r.days && Math.abs(r.days - r.months * 30.4) > 12
          ? [`${Math.round(r.days / 7)}w`]
          : [`${r.months}M`],
      basis: basisFor(payload),
    };
  });

  // TTM IS PINNED BESIDE THE LATEST YEAR (screen design 4) rather than being a
  // view of its own that hides the years it was built from. Its end date is
  // the end of the last period it is built FROM, not the last year's end:
  // where four real quarters exist the trailing twelve months run to the
  // latest quarter, which is the whole reason a reader wants the column.
  const ttmEnd = method.uses.length ? method.uses[0] : shownPeriods[shownPeriods.length - 1]?.end;
  if (opts.withTtm && shownPeriods.length && ttmEnd) {
    periods.push({
      key: 'TTM',
      endDate: ttmEnd,
      fiscalYear: shownPeriods[shownPeriods.length - 1].fiscalYear,
      label: 'TTM',
      dateLabel: dateLabel(ttmEnd),
      durationMonths: 12,
      months: 12,
      kind: 'ttm',
      chips: [method.label],
      uses: method.uses,
      basis: basisFor(payload),
    });
  }

  const rows: Row[] = defs.map((def) => {
    const cells = shownPeriods.map((r) => cellFor(def, r));
    if (opts.withTtm && shownPeriods.length && ttmEnd) {
      cells.push(ttmCell(def, annual, everything, method));
    }
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
    template: about.template,
    unitLabel: about.unitLabel,
    currency: about.currency,
    basisNote: basisNote(payload, about.source),
    sourceNote: about.source.line,
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
  /**
   * The documents behind this figure. One where it was filed as it stands;
   * TWO where it is the difference between two filings, which is what rule 4
   * asks for and what a reader needs to check the subtraction themselves.
   */
  filings: Filing[];
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

  // ONE FILING, OR THE TWO A SUBTRACTION NEEDS. `derivedFrom` is what the
  // data layer recorded when it worked a quarter out; `filing` is the single
  // document a reported figure came from. A vendor payload has neither, and
  // the sentence under them says so rather than leaving a reader to wonder.
  const filings: Filing[] = (cell.derivedFrom?.length ? cell.derivedFrom : cell.filing ? [cell.filing] : [])
    .filter(Boolean)
    .filter((f, i, all) => all.findIndex((o) => o.accn === f.accn) === i);

  const lines: { label: string; value: string }[] = [
    ['Line', row.label],
    ['Period', `${period.label} · ${period.dateLabel}`],
    [
      'Duration',
      period.kind === 'ttm'
        ? `${period.chips[0]}, to ${period.dateLabel}`
        : `${period.months ?? period.durationMonths ?? 12} months to ${period.dateLabel}`,
    ],
    ['Basis', period.basis],
    ['Unit', row.kind === 'money' ? `${symbol}, millions` : row.kind === 'shares' ? 'whole shares' : 'per cent'],
    ['Currency', view.currency || 'not stated'],
    ['State', STATE_LABELS[cell.state]],
    [
      'Form',
      filings[0]?.form
        ? filings[0].form
        : source.traceable
          ? 'Annual report (10-K / 20-F), as tagged in XBRL'
          : 'not recorded by the feed',
    ],
    ['Filing date', filings[0]?.filed || 'not recorded by the feed'],
    ['Filing ID', filings[0]?.accn || 'not recorded by the feed'],
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
    url: filings[0]?.url || source.url,
    concepts: source.traceable && !row.formula ? CONCEPTS[row.key] ?? null : null,
    note: cell.formula ? `${cell.formula}.` : cell.reason,
    filings,
  };
}

export default { financialsFor, evidenceFor, ttmMethod, templateFor, TEMPLATES, FORBIDDEN_FOR_BANKS };
