// FILE: src/data/corrections.ts
//
// Marginalia — corrected inputs
//
// THE PROBLEM THIS EXISTS FOR
//
// The weakest part of the site is not the engine, it is the data going into
// it. Three failures are known and none of them is rare:
//
//   · Yahoo's SG&A for Reliance is a narrow selling-and-admin figure that
//     leaves out depreciation and a large block of other operating costs.
//     Built from the cost lines alone the model gave Reliance an operating
//     profit 91% above what it actually reported.
//   · Segment revenue is missing from every free structured source, so a
//     derived model runs on one combined revenue line.
//   · Some listings return no share count at all, and without a share count
//     there is no value per share.
//
// Every one of those is a number a person could fix from the annual report in
// half a minute. So they are made editable.
//
// THE RULE THIS MUST NEVER BREAK
//
// A corrected figure can never be presented as filed. The site already keeps
// reported and modelled visibly separate; corrected has to be a visible third
// state or the central promise goes. So a correction carries its filed value
// with it for as long as it exists, every screen that shows a corrected model
// says so, and the original is one click away at all times.
//
// WHY IT NEEDS NO NEW CODE PATH
//
// The whole engine is downstream of one array: the statements the fetcher
// returns. Patch that array and re-run exactly the same derivation, and the
// forecast, the discounted cash flow, the health score, the asset approach and
// the residual income model are all corrected together. If this had needed a
// second path through the engine, the design would have been wrong.
//
// Nothing here is uploaded, stored or transmitted. A correction lives in the
// browser tab and dies with it.

/** fiscal year -> field -> the figure the reader supplied. */
export type Corrections = Record<string, Record<string, number>>;

export interface FieldSpec {
  key: string;
  label: string;
  group: 'income' | 'balance' | 'cash' | 'shares';
  /** Share counts are whole counts, not millions. */
  count?: boolean;
  /** Why this line is worth a second look. Shown beside it. */
  note?: string;
}

export const GROUPS: { key: FieldSpec['group']; title: string; standfirst: string }[] = [
  {
    key: 'income',
    title: 'What it earned',
    standfirst: 'The profit and loss account, as the source reported it.',
  },
  {
    key: 'balance',
    title: 'What it owns and owes',
    standfirst: 'The balance sheet at each year end.',
  },
  {
    key: 'cash',
    title: 'What moved in cash',
    standfirst: 'The cash flow lines the forecast depends on.',
  },
  {
    key: 'shares',
    title: 'How many shares',
    standfirst: 'The divisor for every per-share figure on the site.',
  },
];

/* The field names here are the fetcher's own, identical on the SEC path and
   the Yahoo path, so this table does not care where a company came from. */
export const FIELDS: FieldSpec[] = [
  { key: 'revenue', label: 'Revenue', group: 'income' },
  { key: 'cogs', label: 'Cost of sales', group: 'income' },
  { key: 'rnd', label: 'Research and development', group: 'income' },
  {
    key: 'sga',
    label: 'Selling, general and administrative',
    group: 'income',
    note: 'The line most often wrong: some sources report a narrow figure that leaves out depreciation and other operating costs. Where operating profit is also reported, the engine already anchors to that and carries the difference here — so correcting this line changes what the costs are called, not what the company earned.',
  },
  {
    key: 'operatingIncome',
    label: 'Operating profit',
    group: 'income',
    note: 'Where this and the cost lines disagree, the model trusts this figure and carries the difference in SG&A.',
  },
  { key: 'pretaxIncome', label: 'Profit before tax', group: 'income' },
  { key: 'taxExpense', label: 'Tax', group: 'income' },
  { key: 'netIncome', label: 'Profit after tax', group: 'income' },

  { key: 'cash', label: 'Cash and equivalents', group: 'balance' },
  { key: 'receivables', label: 'Receivables', group: 'balance' },
  { key: 'inventory', label: 'Inventory', group: 'balance' },
  { key: 'currentAssets', label: 'Total current assets', group: 'balance' },
  { key: 'ppeNet', label: 'Property, plant and equipment', group: 'balance' },
  {
    key: 'goodwill',
    label: 'Goodwill',
    group: 'balance',
    note: 'Often untagged. Left blank it stays blank — the site will not claim a company has none.',
  },
  { key: 'intangibles', label: 'Other intangibles', group: 'balance' },
  { key: 'totalAssets', label: 'Total assets', group: 'balance' },
  { key: 'payables', label: 'Payables', group: 'balance' },
  { key: 'currentLiabilities', label: 'Total current liabilities', group: 'balance' },
  { key: 'longTermDebt', label: 'Long-term debt', group: 'balance' },
  { key: 'totalLiabilities', label: 'Total liabilities', group: 'balance' },
  { key: 'equity', label: 'Shareholders’ equity', group: 'balance' },

  { key: 'depreciation', label: 'Depreciation and amortisation', group: 'cash' },
  { key: 'capex', label: 'Capital expenditure', group: 'cash' },
  { key: 'operatingCashFlow', label: 'Cash from operations', group: 'cash' },
  { key: 'stockComp', label: 'Share-based pay', group: 'cash' },
  { key: 'dividendsPaid', label: 'Dividends paid', group: 'cash' },
  { key: 'buybacks', label: 'Buybacks', group: 'cash' },

  {
    key: 'dilutedShares',
    label: 'Diluted shares',
    group: 'shares',
    count: true,
    note: 'A whole count, not millions. Some listings return none at all, and without it there is no value per share.',
  },
];

export const FIELD_BY_KEY: Record<string, FieldSpec> = Object.fromEntries(
  FIELDS.map((f) => [f.key, f])
);

/** How many individual figures the reader has changed. */
export const correctionCount = (c: Corrections): number =>
  Object.values(c).reduce((n, row) => n + Object.keys(row).length, 0);

/** The line items touched, in statement order, for a badge or a sentence. */
export const correctedFields = (c: Corrections): string[] => {
  const keys = new Set<string>();
  Object.values(c).forEach((row) => Object.keys(row).forEach((k) => keys.add(k)));
  return FIELDS.filter((f) => keys.has(f.key)).map((f) => f.label);
};

export const isEmpty = (c: Corrections): boolean => correctionCount(c) === 0;

/**
 * Patch the fetched payload with the reader's figures.
 *
 * A copy is returned and the original is left alone, so the filed figures
 * survive for as long as the tab is open and "reset to as filed" is always a
 * real option rather than another fetch.
 */
export function applyCorrections(fetched: any, corrections: Corrections): any {
  if (!fetched || isEmpty(corrections)) return fetched;

  const statements = (fetched.statements || []).map((row: any) => {
    const patch = corrections[String(row.fiscalYear)];
    if (!patch) return row;
    return { ...row, ...patch };
  });

  return { ...fetched, statements };
}

/**
 * Two arithmetic checks on the reported figures, per year. Neither is an
 * opinion and neither is modelled: each is a subtraction the reader could do
 * on the filing itself. The first is the check that would have caught
 * Reliance; the second is the one that catches a balance sheet the source has
 * only partly returned.
 */
export interface YearCheck {
  year: string;
  /** Operating profit implied by the cost lines, less the reported figure. */
  operatingGap: number | null;
  /** Reported operating profit, for scale. */
  operatingIncome: number | null;
  /** Total assets less (total liabilities + equity). */
  balanceGap: number | null;
  totalAssets: number | null;
}

const num = (v: any): number | null => (typeof v === 'number' && isFinite(v) ? v : null);

export function yearChecks(statements: any[]): YearCheck[] {
  return (statements || []).map((row) => {
    const rev = num(row.revenue);
    const cogs = num(row.cogs);
    const rnd = num(row.rnd);
    const sga = num(row.sga);
    const op = num(row.operatingIncome);

    let operatingGap: number | null = null;
    if (rev !== null && cogs !== null && op !== null) {
      operatingGap = rev - cogs - (rnd ?? 0) - (sga ?? 0) - op;
    }

    const assets = num(row.totalAssets);
    const liabs = num(row.totalLiabilities);
    const eq = num(row.equity);
    const balanceGap = assets !== null && liabs !== null && eq !== null ? assets - liabs - eq : null;

    return {
      year: String(row.fiscalYear),
      operatingGap,
      operatingIncome: op,
      balanceGap,
      totalAssets: assets,
    };
  });
}
