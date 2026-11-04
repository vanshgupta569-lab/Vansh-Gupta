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
import { inMillions, asCount, asPercent, MINUS, NOT_REPORTED } from './figureFormat';

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
   * THE XBRL CONCEPT THIS FIGURE WAS READ FROM, for an SEC filer.
   *
   * The concept belongs to the FIGURE and not to the line: one company's
   * revenue is `Revenues` and the next company's is
   * `RevenueFromContractWithCustomerExcludingAssessedTax`, and the same
   * company can change concept between two years. Until 2026-11-03 the
   * evidence sheet printed the candidate LIST and said which one the company
   * used was not recorded, which was true of the payload and is what payload
   * version 11 records.
   */
  concept?: string | null;
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
  /**
   * FOR A DERIVED ROW, THE ROWS IT IS DERIVED FROM, by key.
   *
   * Named rather than left inside the closure so that `npm run verify` can
   * recompute every margin from the figures printed in its own column without
   * keeping a second copy of which figures those are. A check with its own
   * list of inputs stops checking the row the day the row changes.
   */
  inputs?: string[];
  /**
   * The inputs whose ABSENCE from a column is not a hole but part of what the
   * row carries. A row with any of these is DEFINED AGAINST THE FIGURES ITS OWN
   * COLUMN SHOWS, so it is not additive across columns: where three quarters
   * report a selling cost and the fourth does not, the trailing twelve months
   * names no selling cost at all and carries that amount in the bridge instead.
   * Anything re-adding a trailing figure to its quarters needs to know that, so
   * the list travels with the row rather than being kept a second time.
   */
  optional?: string[];
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
  /**
   * For a derived row: the inputs and how they combine.
   *
   * `optional` names the inputs whose ABSENCE is not a hole. Every derived row
   * but one needs all of its inputs — a gross profit without a cost of sales
   * would be a guess — and this is the exception: the bridge from gross profit
   * to operating income is defined as what is left after THE NAMED LINES THIS
   * COLUMN SHOWS, so a research line the source does not report for a period is
   * inside the bridge rather than missing from it. Treating it as a hole would
   * leave the column not adding up; treating it as a nil would be a claim the
   * company reported nothing, which it is not. It is neither: it is unnamed,
   * and the row it falls into is the row that says so.
   */
  derive?: {
    inputs: string[];
    optional?: string[];
    formula: string;
    of: (r: any) => number | null;
  };
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
  /**
   * PER FIGURE: the concept it was read from and the one document it is in,
   * resolved here against the payload's `filings` dictionary so that nothing
   * below has to know the payload's shape. Empty for a vendor payload, which
   * records neither.
   */
  evidence: Record<string, { concept: string | null; filing: Filing | null }>;
}

/**
 * The payload's documents, keyed by accession number, as the fetcher wrote
 * them (payload version 11). A payload built before that has none, and every
 * figure in it says so rather than naming a document it cannot open.
 */
const filingsOf = (payload: any): Record<string, Filing> =>
  payload && typeof payload.filings === 'object' && payload.filings ? payload.filings : {};

const resolveEvidence = (
  raw: any,
  filings: Record<string, Filing>
): Record<string, { concept: string | null; filing: Filing | null }> => {
  const out: Record<string, { concept: string | null; filing: Filing | null }> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [field, prov] of Object.entries(raw as Record<string, any>)) {
    if (!prov || typeof prov !== 'object') continue;
    out[field] = {
      concept: typeof prov.concept === 'string' && prov.concept ? prov.concept : null,
      filing: prov.accn && filings[prov.accn] ? filings[prov.accn] : null,
    };
  }
  return out;
};

const annualRow = (r: any, months: number, filings: Record<string, Filing>): SourceRow => ({
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
  evidence: resolveEvidence(r?.evidence, filings),
});

const quarterRow = (q: any, filings: Record<string, Filing>): SourceRow => ({
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
  evidence: resolveEvidence(q?.evidence, filings),
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
  // ---- THE BRIDGE FROM GROSS PROFIT TO OPERATING INCOME -------------------
  //
  // Without this row the statement did not add up, and said nothing about it. A
  // reader who took the printed revenue, subtracted the printed cost of sales,
  // the printed research and the printed selling costs, and compared the answer
  // with the printed operating income, got a different number — on 1,323 of the
  // 1,574 columns that print all four — and the difference had no name on the
  // screen. It is an impairment, a restructuring charge, a gain on a disposal,
  // other operating income: real lines of the company's own statement that this
  // template has no row for, because neither free source tags them in a shape
  // that maps to one row across 180 companies (`DATA_CONSTRAINTS.md`).
  //
  // So the difference is named and shown rather than left as a silence. It is
  // DERIVED, which is one of the four visible states (rule 5): nothing here is
  // the company's own figure except the figures it is struck from.
  //
  // THE SIGN IS THE STATEMENT'S OWN: a charge is negative, income positive, so
  // the column reads gross profit, less what is named, plus this, equals
  // operating income — and operating income is the FILED figure, so the bridge
  // closing on it is a tie against the filing rather than against itself.
  {
    key: 'otherOperatingItems',
    label: 'Other operating items',
    statement: 'income',
    detail: true,
    note:
      'The bridge from gross profit to operating income: what the company charged or credited inside its ' +
      'own operating income that has no row of its own in this template — an impairment, a restructuring ' +
      'charge, a gain on a disposal, other operating income. A charge is negative. Where a line above is ' +
      'not reported for a period, its amount is inside this figure too, because there is no row there to ' +
      'hold it; it is not a nil.',
    derive: {
      inputs: ['operatingIncome', 'revenue', 'cogs', 'rnd', 'sga'],
      // Research and selling costs are named where the source reports them and
      // inside this figure where it does not. See `RowDef.derive`.
      optional: ['rnd', 'sga'],
      formula:
        'Operating income − (gross profit − research and development − selling, general and administrative)',
      of: (r) => {
        const v = all(r, ['operatingIncome', 'revenue', 'cogs']);
        if (!v) return null;
        const named = (f: string) => (num(r?.[f]) ? (r[f] as number) : 0);
        return v[0] - (v[1] - v[2] - named('rnd') - named('sga'));
      },
    },
  },
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
export const FORBIDDEN_FOR_BANKS = [
  'operatingMargin',
  'ebitda',
  'grossProfit',
  'cogs',
  // The bridge from gross profit to operating income, which a statement
  // with no gross profit has no bridge from.
  'otherOperatingItems',
];

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
      const optional = def.derive.optional || [];
      const absent = def.derive.inputs.filter((f) => !num(row?.[f]) && !optional.includes(f));
      return {
        state: 'notReported',
        value: null,
        reason: `${def.derive.formula}, and ${absent.join(' and ')} ${
          absent.length > 1 ? 'are' : 'is'
        } not reported for this period. A derived figure with a hole in it would be a guess.`,
        formula: def.derive.formula,
      };
    }
    // A DERIVED ROW IS OUR ARITHMETIC OVER THE FILING'S FIGURES, so it has no
    // concept of its own — the sheet shows the formula instead. It does have a
    // DOCUMENT, where every input it was struck from came from the same one:
    // gross profit is revenue less cost of sales and both of those are in the
    // year's 10-K, so "Not recorded" would be a worse answer than the 10-K.
    // Where the inputs disagree there is no single document and it says so.
    const docs = def.derive.inputs.map((f) => source.evidence[f]?.filing ?? null);
    const oneDoc =
      docs.length && docs.every((d) => d && d.accn === docs[0]?.accn) ? docs[0] : source.filing;
    return { state: 'derived', value: v, formula: def.derive.formula, filing: oneDoc };
  }
  const raw = def.field ? row?.[def.field] : undefined;
  if (!num(raw)) {
    return {
      state: 'notReported',
      value: null,
      reason: 'The source does not report this line for this period. It is not a nil.',
    };
  }
  // THE FIGURE'S OWN DOCUMENT, not the period's. One 10-K is behind most of a
  // year's lines and one 10-Q behind most of a quarter's, but a line restated
  // in a later filing is read from that later filing. The period's filing is
  // the fallback for a payload built before version 11 recorded either.
  const prov = def.field ? source.evidence[def.field] : undefined;
  const concept = prov?.concept ?? null;
  const filing = prov?.filing ?? source.filing;
  if (raw === 0) {
    return {
      state: 'reportedZero',
      value: 0,
      reason: 'Reported as nil, which is a figure the company filed rather than a gap.',
      filing,
      concept,
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
      filing,
      concept,
      derivedFrom: source.derivedFrom[def.field] || [],
    };
  }
  return { state: 'reported', value: raw, filing, concept };
};

/** One concept, or none, across the periods a trailing figure is built from. */
const oneConcept = (cells: Cell[]): string | null => {
  const named = cells.map((c) => c.concept || null);
  return named.length && named.every((c) => c && c === named[0]) ? (named[0] as string) : null;
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
const ttmCell = (
  def: RowDef,
  annual: SourceRow[],
  all: SourceRow[],
  method: TtmMethod,
  defs: RowDef[]
): Cell => {

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

  // A DERIVED ROW'S TRAILING TWELVE MONTHS IS ITS FORMULA APPLIED TO THE
  // TRAILING TWELVE MONTHS OF ITS INPUTS, never the row's own four quarters
  // added up.
  //
  // KI-35 was exactly that addition. Operating margin is a ratio, and four
  // quarterly ratios summed gave NVIDIA 260.0% where the two figures printed
  // directly above it — operating income 197,579 and revenue 302,969 — divide
  // to 65.2%. There is no denominator in a sum of ratios at all, which is why
  // the figure was four times too big rather than merely wrong.
  //
  // It is also the right rule for the rows that were already correct, not just
  // a special case for the ratio: a difference of sums is the sum of the
  // differences, so gross profit, EBITDA and free cash flow come out
  // unchanged, and the row's own note — "recomputed from the two figures on
  // this column" — becomes true of the TTM column too instead of only of the
  // annual ones.
  if (def.derive) {
    const inputs = def.derive.inputs.map((field) => {
      // The input's OWN row definition where the template has one, so a
      // balance-sheet input keeps rule 6 (carry the latest balance) rather
      // than being summed because the row that uses it is a flow.
      const own = defs.find((d) => d.field === field) || defs.find((d) => d.key === field);
      const asRow: RowDef =
        own && own.field === field
          ? own
          : { key: field, label: field, statement: def.statement, field };
      return { field, cell: ttmCell(asRow, annual, all, method, defs) };
    });
    const optional = def.derive.optional || [];
    const absent = inputs
      .filter((i) => !num(i.cell.value) && !optional.includes(i.field))
      .map((i) => i.field);
    if (absent.length) {
      return {
        state: 'notReported',
        value: null,
        reason:
          `${def.derive.formula}, and the trailing twelve months of ` +
          `${absent.join(' and ')} ${absent.length > 1 ? 'are' : 'is'} not available, ` +
          'so there is nothing honest to divide or add.',
        formula: def.derive.formula,
      };
    }
    const row: Record<string, number> = {};
    for (const i of inputs) if (num(i.cell.value)) row[i.field] = i.cell.value;
    const v = def.derive.of(row);
    if (!num(v)) {
      return {
        state: 'notReported',
        value: null,
        reason: `${def.derive.formula} cannot be worked out from the trailing twelve months of its inputs.`,
        formula: def.derive.formula,
      };
    }
    return {
      state: 'derived',
      value: v,
      formula: def.derive.formula,
      derivedFrom: inputs.flatMap((i) => i.cell.derivedFrom || (i.cell.filing ? [i.cell.filing] : [])),
    };
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
      // ONE CONCEPT ONLY WHERE ALL FOUR AGREE. A company that tags three
      // quarters one way and the fourth another has a sum of two concepts,
      // and naming either of them would be a claim about the whole year that
      // is true of nine months of it.
      concept: oneConcept(cells),
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
      concept: oneConcept(cells),
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
  const filings = filingsOf(payload);
  const annual: SourceRow[] = annualRaw.map((r, i) =>
    annualRow(r, i === 0 ? 12 : monthsBetween(annualRaw[i - 1].periodEnd, r.periodEnd) ?? 12, filings)
  );

  const quarterly: SourceRow[] = (Array.isArray(payload?.quarters) ? payload.quarters : [])
    .filter((q: any) => q && typeof q.periodEnd === 'string' && q.values)
    .map((q: any) => quarterRow(q, filings))
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
      cells.push(ttmCell(def, annual, everything, method, defs));
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
      inputs: def.derive?.inputs,
      optional: def.derive?.optional,
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
  /**
   * THE ONE LINK THE SHEET OFFERS, and what it is honest enough to call itself.
   *
   * `exact` where the figure carries an accession number, in which case the
   * address is that document and the link says "Open the filing". Where it does
   * not, the link says **"Find this filing on EDGAR"** and goes to this
   * company's own list of that form — because a link labelled "open the filing"
   * that lands on a search page is a small lie told on every figure that has
   * no accession number, and until 2026-11-03 that was what it did.
   */
  openLink: { label: string; url: string; exact: boolean } | null;
  /** The XBRL concept THIS figure was read from, where the payload records it. */
  concept: string | null;
  /**
   * The candidate list, and only where the figure's own concept is not
   * recorded — a payload built before version 11, or a vendor feed. It is the
   * weaker answer and it says so on the screen.
   */
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
 * taken the route down before (its own comment says so). **`npm run verify`
 * holds the two lists against each other**, because this copy had already gone
 * stale: it named one concept for stock compensation where `US_TAGS` has two
 * and one for depreciation where it has three, so a figure read from the
 * second tag was reported as read from a list that did not contain it. It is
 * generated from `US_TAGS` rather than typed.
 *
 * SINCE PAYLOAD VERSION 11 THIS IS THE FALLBACK, NOT THE ANSWER. The figure's
 * own concept is recorded beside it and the sheet prints that; this list is
 * shown only where no concept is held — a payload built before version 11, or
 * a vendor feed — and the sentence beside it says which of the candidates was
 * used is not known for that figure.
 */
const NOT_RECORDED = 'Not recorded';

/**
 * WHAT TO PUT ON THE CONCEPT LINE, which is three different answers and not
 * one answer with two failures.
 *
 * A FIGURE READ FROM A FILING has a concept, and it is named. A FIGURE WORKED
 * OUT HERE — gross profit, EBITDA, free cash flow, the operating margin — has
 * none, because it is this site's arithmetic over figures that each have their
 * own, and the formula is already on the sheet. A FIGURE BUILT FROM SEVERAL
 * PERIODS can have several: a company that tags its stock compensation
 * `ShareBasedCompensation` in three quarters and
 * `AllocatedShareBasedCompensationExpense` in the fourth has a trailing twelve
 * months with two concepts in it, and naming either would be a claim about the
 * year that is true of nine months of it. 23 trailing figures across the set
 * are that case.
 *
 * None of the three is "Not recorded", which is reserved for what it says: a
 * vendor feed that does not record which filing a figure came from. A VENDOR
 * PAYLOAD HAS NO CONCEPTS AT ALL, so "more than one across its periods" is not
 * available to it — only the arithmetic sentence is, because that one is about
 * what this site did and not about what the source recorded.
 */
const conceptLine = (cell: Cell, row: Row, traceable: boolean): string => {
  if (cell.concept) return cell.concept;
  if (row.inputs) return 'Not one concept — worked out here, from the formula above';
  if (traceable && cell.formula) return 'More than one, across the periods this figure is built from';
  return NOT_RECORDED;
};

export const CANDIDATE_CONCEPTS: Record<string, string[]> = {
  revenue: [
    'RevenueFromContractWithCustomerExcludingAssessedTax',
    'RevenueFromContractWithCustomerIncludingAssessedTax',
    'Revenues',
    'SalesRevenueNet',
  ],
  cogs: ['CostOfGoodsAndServicesSold', 'CostOfRevenue', 'CostOfServices'],
  rnd: ['ResearchAndDevelopmentExpense'],
  sga: ['SellingGeneralAndAdministrativeExpense', 'GeneralAndAdministrativeExpense'],
  operatingIncome: ['OperatingIncomeLoss'],
  pretaxIncome: [
    'IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest',
    'IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments',
  ],
  taxExpense: ['IncomeTaxExpenseBenefit'],
  netIncome: ['NetIncomeLoss', 'ProfitLoss'],
  interestExpense: [
    'InterestExpense',
    'InterestExpenseNonoperating',
    'InterestExpenseDebt',
    'InterestAndDebtExpense',
  ],
  cash: [
    'CashAndCashEquivalentsAtCarryingValue',
    'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents',
  ],
  shortTermInvestments: [
    'ShortTermInvestments',
    'MarketableSecuritiesCurrent',
    'AvailableForSaleSecuritiesDebtSecuritiesCurrent',
    'AvailableForSaleSecuritiesCurrent',
    'OtherShortTermInvestments',
    'HeldToMaturitySecuritiesCurrent',
  ],
  longTermInvestments: [
    'LongTermInvestments',
    'MarketableSecuritiesNoncurrent',
    'AvailableForSaleSecuritiesDebtSecuritiesNoncurrent',
    'AvailableForSaleSecuritiesNoncurrent',
    'HeldToMaturitySecuritiesNoncurrent',
    'OtherLongTermInvestments',
  ],
  securitiesNotSplit: [
    'MarketableSecurities',
    'AvailableForSaleSecuritiesDebtSecurities',
    'AvailableForSaleSecurities',
    'Investments',
  ],
  receivables: ['AccountsReceivableNetCurrent', 'ReceivablesNetCurrent'],
  inventory: ['InventoryNet'],
  currentAssets: ['AssetsCurrent'],
  ppeNet: [
    'PropertyPlantAndEquipmentNet',
    'PropertyPlantAndEquipmentAndFinanceLeaseRightOfUseAssetAfterAccumulatedDepreciationAndAmortization',
  ],
  totalAssets: ['Assets'],
  payables: ['AccountsPayableCurrent'],
  currentLiabilities: ['LiabilitiesCurrent'],
  longTermDebt: ['LongTermDebtNoncurrent', 'LongTermDebt', 'LongTermNotesPayable'],
  longTermDebtTotal: ['LongTermDebt'],
  longTermDebtNoncurrent: ['LongTermDebtNoncurrent'],
  longTermDebtAndLeaseNoncurrent: ['LongTermDebtAndCapitalLeaseObligations'],
  debtCurrent: ['DebtCurrent'],
  longTermDebtCurrent: ['LongTermDebtCurrent'],
  debtAndLeaseCurrent: ['LongTermDebtAndCapitalLeaseObligationsCurrent'],
  shortTermBorrowings: [
    'ShortTermBorrowings',
    'CommercialPaper',
    'OtherShortTermBorrowings',
    'LinesOfCreditCurrent',
    'ShortTermBankLoansAndNotesPayable',
    'NotesPayableCurrent',
  ],
  financeLeaseCurrent: ['FinanceLeaseLiabilityCurrent', 'CapitalLeaseObligationsCurrent'],
  financeLeaseNoncurrent: ['FinanceLeaseLiabilityNoncurrent', 'CapitalLeaseObligationsNoncurrent'],
  financeLeaseTotal: ['FinanceLeaseLiability'],
  operatingLeaseCurrent: ['OperatingLeaseLiabilityCurrent'],
  operatingLeaseNoncurrent: ['OperatingLeaseLiabilityNoncurrent'],
  operatingLeaseTotal: ['OperatingLeaseLiability'],
  financeLeaseRightOfUseAsset: ['FinanceLeaseRightOfUseAsset', 'CapitalLeasedAssetsGross'],
  operatingLeaseRightOfUseAsset: ['OperatingLeaseRightOfUseAsset'],
  totalLiabilities: ['Liabilities'],
  goodwill: ['Goodwill'],
  intangibles: ['IntangibleAssetsNetExcludingGoodwill', 'FiniteLivedIntangibleAssetsNet'],
  equity: [
    'StockholdersEquity',
    'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest',
  ],
  depreciation: [
    'DepreciationDepletionAndAmortization',
    'DepreciationAmortizationAndAccretionNet',
    'Depreciation',
  ],
  depreciationOfPpe: ['Depreciation'],
  minorityInterest: ['MinorityInterest'],
  redeemableMinorityInterest: [
    'RedeemableNoncontrollingInterestEquityCarryingAmount',
    'RedeemableNoncontrollingInterestEquityFairValue',
  ],
  preferredStock: [
    'PreferredStockValue',
    'PreferredStockIncludingAdditionalPaidInCapital',
    'PreferredStockIncludingAdditionalPaidInCapitalNetOfDiscount',
    'PreferredStockValueOutstanding',
    'PreferredStockLiquidationPreferenceValue',
  ],
  preferredConversionShares: ['IncrementalCommonSharesAttributableToConversionOfPreferredStock'],
  preferredDividends: [
    'DividendsPreferredStock',
    'PreferredStockDividendsIncomeStatementImpact',
    'DividendsPreferredStockCash',
  ],
  netIncomeToMinority: [
    'NetIncomeLossAttributableToNoncontrollingInterest',
    'MinorityInterestInNetIncomeLossOfConsolidatedEntities',
  ],
  equityIncludingMinority: [
    'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest',
  ],
  amortisationOfIntangibles: [
    'AmortizationOfIntangibleAssets',
    'AmortizationOfIntangibleAssetsExcludingGoodwill',
    'FiniteLivedIntangibleAssetsAmortizationExpense',
  ],
  capex: ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets'],
  operatingCashFlow: [
    'NetCashProvidedByUsedInOperatingActivities',
    'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations',
  ],
  investingCashFlow: [
    'NetCashProvidedByUsedInInvestingActivities',
    'NetCashProvidedByUsedInInvestingActivitiesContinuingOperations',
  ],
  financingCashFlow: [
    'NetCashProvidedByUsedInFinancingActivities',
    'NetCashProvidedByUsedInFinancingActivitiesContinuingOperations',
  ],
  stockComp: ['ShareBasedCompensation', 'AllocatedShareBasedCompensationExpense'],
  dividendsPaid: [
    'PaymentsOfDividendsCommonStock',
    'PaymentsOfDividends',
    'PaymentsOfDistributionsToAffiliates',
    'PaymentsOfOrdinaryDividends',
  ],
  commonDividendsPaid: ['PaymentsOfDividendsCommonStock'],
  buybacks: ['PaymentsForRepurchaseOfCommonStock'],
  dilutedShares: [
    'WeightedAverageNumberOfDilutedSharesOutstanding',
    'WeightedAverageNumberOfSharesOutstandingBasic',
  ],
};

const STATE_LABELS: Record<ValueState, string> = {
  reported: 'Reported',
  reportedZero: 'Reported as nil',
  notReported: 'Not reported',
  notApplicable: 'Not applicable',
  derived: 'Derived',
};

/**
 * ONE DECIMAL RULE PER ROW (`docs/VISUAL_SYSTEM.md` finding 1). The rules
 * themselves — no decimals on a figure in millions, zero as 0, an em dash for
 * a figure nobody reported, and a real minus sign — are defined once in
 * `figureFormat.ts`, because the figures screen prints the same figures and a
 * second copy of the rule would go stale. The only thing decided here is which
 * rule each kind of row takes, and where the currency symbol sits.
 */
export function formatValue(cell: Cell, kind: RowKind, symbol: string): string {
  if (cell.value === null) return NOT_REPORTED;
  if (kind === 'percent') return asPercent(cell.value);
  if (kind === 'shares') return asCount(cell.value);
  // The symbol sits inside the sign: −$1,234, never $−1,234.
  const printed = inMillions(cell.value);
  return printed.startsWith(MINUS) ? `${MINUS}${symbol}${printed.slice(MINUS.length)}` : `${symbol}${printed}`;
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
    // THE CONCEPT, THE FORM, THE DATE AND THE ACCESSION NUMBER OF THIS FIGURE.
    //
    // Four lines that used to be two guesses and two blanks. The form is the
    // one the document was filed under — `10-K`, `10-Q`, `10-K/A` — and never
    // "10-K / 20-F", which was a statement about which forms this site reads
    // dressed up as a statement about where the figure came from. Anything
    // genuinely not held reads **Not recorded**, in those words, and
    // `npm run verify` counts them.
    ['Concept', conceptLine(cell, row, source.traceable)],
    ['Form', filings[0]?.form || NOT_RECORDED],
    ['Filing date', filings[0]?.filed || NOT_RECORDED],
    ['Filing ID', filings[0]?.accn || NOT_RECORDED],
    ['Restated', 'not known — one capture held, so no earlier version to compare'],
  ].map(([label, value]) => ({ label, value }));

  // WHERE NO ACCESSION NUMBER EXISTS, THE LINK SAYS SO. An SEC filer whose
  // figure carries no document — a derived row, or a payload built before
  // version 11 — gets this company's own list of that form on EDGAR, labelled
  // as the search it is. A vendor payload gets no link at all, because there
  // is no filing behind the figure to find; the source line above says that in
  // full.
  const searchUrl = payload?.cik
    ? `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${encodeURIComponent(
        String(payload.cik)
      )}&type=${encodeURIComponent(period.kind === 'annual' || period.kind === 'ttm' ? '10-K' : '10-Q')}&dateb=&owner=include&count=40`
    : source.url;
  const openLink = filings[0]?.url
    ? { label: 'Open the filing', url: filings[0].url, exact: true }
    : source.traceable && searchUrl
      ? { label: 'Find this filing on EDGAR', url: searchUrl, exact: false }
      : null;

  return {
    title: `${row.label} · ${period.label}`,
    value: formatValue(cell, row.kind, symbol),
    state: cell.state,
    stateLabel: STATE_LABELS[cell.state],
    lines,
    source: source.line,
    traceable: source.traceable,
    url: filings[0]?.url || source.url,
    openLink,
    concept: cell.concept || null,
    // ONLY WHERE THE FIGURE'S OWN CONCEPT IS NOT HELD. Showing both would
    // leave a reader to work out which of the two answers the figure's.
    concepts:
      !cell.concept && source.traceable && !row.formula ? CANDIDATE_CONCEPTS[row.key] ?? null : null,
    note: cell.formula ? `${cell.formula}.` : cell.reason,
    filings,
  };
}

export default { financialsFor, evidenceFor, ttmMethod, templateFor, TEMPLATES, FORBIDDEN_FOR_BANKS };
