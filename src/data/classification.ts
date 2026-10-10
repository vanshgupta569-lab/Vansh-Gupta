// FILE: src/data/classification.ts
//
// Marginalia — expense classification, the first piece of the judgement layer
//
// WHAT THIS IS FOR
//
// A filing gives a carpentry expense. Whether it is a direct cost or an
// overhead is a judgement, not arithmetic — and until now the model made it
// silently, by the accident of which tag the source returned the figure under.
// A model whose gross margin depends on an untold decision is not defensible
// line by line, which is the whole claim (`ROADMAP.md`, the design rule).
//
// So the decision is surfaced: every reported expense line gets a category,
// the engine's current treatment is the default, the default says where it
// came from, and the reader can change it with a reason recorded beside it.
//
// WHAT CLASSIFICATION DOES AND DOES NOT DO — MEASURED, NOT ASSERTED
//
// Operating profit in the engine is a sum:
//
//     EBIT = revenue + cost of sales + R&D + SG&A + other operating costs
//            (costs are negative) less D&A and SBC
//
// Addition does not care what the terms are called. So moving a line between
// DIRECT, INDIRECT, SELLING AND DISTRIBUTION and ADMINISTRATIVE cannot change
// operating profit, in any reported year or any forecast year, by any amount.
// What it changes is gross profit and the subtotals below it — which is the
// point: a reader comparing two companies needs the same costs above the gross
// margin line in both, and no filing guarantees that.
//
// EXCLUDED is the one category that moves money. A line excluded as
// non-recurring is nil in every forecast year, so the forecast operating
// margin rises and the valuation with it. That is the judgement with
// consequences, and it is why it carries its own category rather than being a
// flavour of the others.
//
// THE RULE THAT HOLDS WHATEVER IS CHOSEN
//
// **Reported operating profit always ties to the filing.** An exclusion never
// touches a reported year: the filed figure stays the filed figure, the
// classification view shows the excluded line separately, and the underlying
// operating profit a reader may prefer is shown as its own subtotal beside the
// reported one rather than replacing it. This is the standing decision that
// reported, corrected, reclassified and modelled are four visibly separate
// states, applied to the one place where a judgement could quietly restate a
// filing.
//
// WHERE THE AMOUNTS COME FROM
//
// Three of the four lines are filed fields. The fourth, other operating costs,
// is the engine's reconciling line: filed operating income less the named cost
// lines (`METHODOLOGY.md`, and `deriveModel.js` `unexplainedOperatingCosts`).
// It is computed here the same way `yearChecks` computes it, from the same
// patched statements, so this screen and that check cannot disagree.
//
// Nothing here is uploaded or stored. A classification lives in the browser
// tab beside the corrections and dies with it.

/** The five categories, in the order a profit and loss account runs. */
export type Category = 'direct' | 'indirect' | 'selling' | 'admin' | 'excluded';

export interface CategorySpec {
  key: Category;
  /** What it is called on screen. */
  label: string;
  /** Shorter, for a button. */
  short: string;
  /** What belongs in it. A definition, never a recommendation. */
  definition: string;
  /** True where the category sits above the gross profit line. */
  aboveGrossProfit?: boolean;
  /** True where the category leaves the forecast operating base. */
  leavesOperating?: boolean;
}

export const CATEGORIES: readonly CategorySpec[] = Object.freeze([
  {
    key: 'direct',
    label: 'Direct cost',
    short: 'Direct',
    definition:
      'A cost of producing what was sold: materials, the labour that worked on it, the subcontract that delivered it. Above the gross profit line.',
    aboveGrossProfit: true,
  },
  {
    key: 'indirect',
    label: 'Indirect cost',
    short: 'Indirect',
    definition:
      'An operating cost that is not a cost of the thing sold and is not selling or administration: factory overhead, research, the unattributed remainder.',
  },
  {
    key: 'selling',
    label: 'Selling and distribution',
    short: 'Selling',
    definition: 'The cost of winning and delivering the sale: sales pay, commission, advertising, freight out.',
  },
  {
    key: 'admin',
    label: 'Administrative',
    short: 'Admin',
    definition: 'The cost of running the company rather than of trading: head office, finance, legal, audit.',
  },
  {
    key: 'excluded',
    label: 'Excluded as non-recurring',
    short: 'Excluded',
    definition:
      'A cost the reader judges will not repeat. Reported years keep it exactly as filed; it is nil in every forecast year, so this is the one choice here that moves the valuation.',
    leavesOperating: true,
  },
]);

export const CATEGORY_BY_KEY: Record<Category, CategorySpec> = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c])
) as Record<Category, CategorySpec>;

export interface ClassifiableLine {
  /** The engine's own key for the line. */
  key: string;
  /** Its filed name. A classification never renames a line. */
  label: string;
  /** The engine's current treatment, which is the default. */
  defaultCategory: Category;
  /**
   * WHERE THE DEFAULT CAME FROM. Required: a default that cannot say why it is
   * the default is the silent judgement this feature exists to remove.
   */
  defaultBasis: string;
  /**
   * False where the forecast has no way to drop the line. Cost of sales is the
   * balancing line — the engine derives it from the gross margin rather than
   * forecasting it — so there is no margin to set to nil.
   */
  excludable: boolean;
  /** Said on screen where `excludable` is false. */
  notExcludableBecause?: string;
}

/**
 * THE FOUR LINES THE ENGINE ACTUALLY CARRIES.
 *
 * Not a wish list. These are the operating cost lines a derived model has, and
 * every one of them is in the reported income statement the dashboard draws.
 * Depreciation is deliberately absent: the sources report it in the cash flow
 * statement and it is already inside these filed cost lines, so offering it
 * here would classify the same money twice and break the tie to filed
 * operating profit.
 */
export const CLASSIFIABLE_LINES: readonly ClassifiableLine[] = Object.freeze([
  {
    key: 'cogs',
    label: 'Cost of sales',
    defaultCategory: 'direct',
    defaultBasis:
      'The filing reports this line as cost of sales or cost of revenue, which is a direct cost by its own description. The engine takes it above the gross profit line and derives the gross margin from it.',
    excludable: false,
    notExcludableBecause:
      'Cost of sales is the balancing line in the forecast: the engine derives it from the gross margin rather than forecasting it, so there is no margin to set to nil. A one-off inside it is a correction to the figure, which the table above makes.',
  },
  {
    key: 'rnd',
    label: 'Research and development',
    defaultCategory: 'indirect',
    defaultBasis:
      'The filing reports research and development separately from selling and administrative costs, and it is not a cost of the units sold. The engine forecasts it at its own share of revenue.',
    excludable: true,
  },
  {
    key: 'sga',
    label: 'Selling, general and administrative',
    defaultCategory: 'admin',
    // THIS DEFAULT IS A CONVENTION AND SAYS SO. The filing combines two of our
    // categories in one line and nothing in it settles the split, so the
    // default cannot be a reading of the filing. Claiming otherwise would be
    // the silent judgement with a sentence attached.
    defaultBasis:
      'The filing reports selling and administrative costs as one line, and nothing in it says how much is which. The default is a stated convention, not a reading: the whole line is treated as administrative. Split it by correcting the figures, or move it to selling and distribution if that is the larger part.',
    excludable: true,
  },
  {
    key: 'otherOperatingCosts',
    label: 'Other operating costs',
    defaultCategory: 'indirect',
    defaultBasis:
      'This line is the engine’s own: filed operating income less the named cost lines, carried so that reported operating profit ties to the filing. It is unattributed by construction — the filing never named it — so it defaults to indirect rather than to a category it cannot be shown to belong in.',
    excludable: true,
  },
]);

export const LINE_BY_KEY: Record<string, ClassifiableLine> = Object.fromEntries(
  CLASSIFIABLE_LINES.map((l) => [l.key, l])
);

export interface Choice {
  category: Category;
  /** The reader's one line. Optional by design: a forced reason is a reason nobody reads. */
  reason?: string;
}

/** line key -> the reader's choice. A line absent from this is on its default. */
export type Classification = Record<string, Choice>;

export const categoryOf = (key: string, c: Classification | undefined): Category =>
  c?.[key]?.category ?? LINE_BY_KEY[key]?.defaultCategory ?? 'indirect';

export const reasonOf = (key: string, c: Classification | undefined): string =>
  c?.[key]?.reason ?? '';

/** True where the reader has moved the line off its default. */
export const isOverridden = (key: string, c: Classification | undefined): boolean => {
  const choice = c?.[key];
  if (!choice) return false;
  return choice.category !== LINE_BY_KEY[key]?.defaultCategory;
};

export const overriddenLines = (c: Classification | undefined): string[] =>
  CLASSIFIABLE_LINES.filter((l) => isOverridden(l.key, c)).map((l) => l.key);

export const overrideCount = (c: Classification | undefined): number => overriddenLines(c).length;

export const isEmpty = (c: Classification | undefined): boolean => overrideCount(c) === 0;

/** The lines a reader has moved, by their filed names, for a badge or a sentence. */
export const reclassifiedLabels = (c: Classification | undefined): string[] =>
  CLASSIFIABLE_LINES.filter((l) => isOverridden(l.key, c)).map((l) => l.label);

/** The excluded lines, which are the only ones that change a number. */
export const excludedLines = (c: Classification | undefined): string[] =>
  CLASSIFIABLE_LINES.filter((l) => l.excludable && categoryOf(l.key, c) === 'excluded').map((l) => l.key);

const num = (v: any): number | null => (typeof v === 'number' && isFinite(v) ? v : null);

/**
 * The cost on each classifiable line, by year, as a POSITIVE amount.
 *
 * Other operating costs is computed here exactly as the engine computes it and
 * exactly as `yearChecks` reports it: revenue less the named cost lines, less
 * filed operating income. Where the filing does not report operating income
 * the line cannot be computed and comes back null rather than nil.
 */
export interface LineAmounts {
  year: string;
  revenue: number | null;
  operatingIncomeFiled: number | null;
  /** line key -> cost in that year, positive, or null where not reported. */
  amounts: Record<string, number | null>;
}

export function lineAmounts(statements: any[]): LineAmounts[] {
  return (statements || []).map((row) => {
    const revenue = num(row.revenue);
    const cogs = num(row.cogs);
    const rnd = num(row.rnd);
    const sga = num(row.sga);
    const op = num(row.operatingIncome);
    const other =
      revenue !== null && cogs !== null && op !== null
        ? revenue - cogs - (rnd ?? 0) - (sga ?? 0) - op
        : null;
    return {
      year: String(row.fiscalYear),
      revenue,
      operatingIncomeFiled: op,
      amounts: { cogs, rnd, sga, otherOperatingCosts: other },
    };
  });
}

/**
 * Which lines there is anything to classify for. A line the filing never
 * reports, or reports as nil in every year, is not a judgement waiting to be
 * made — it is an absence, and putting five buttons against it would be
 * inventing work.
 */
export function classifiableFor(statements: any[]): ClassifiableLine[] {
  const rows = lineAmounts(statements);
  return CLASSIFIABLE_LINES.filter((line) =>
    rows.some((r) => {
      const v = r.amounts[line.key];
      return v !== null && Math.abs(v) > 1e-6;
    })
  );
}

export interface YearSubtotals {
  year: string;
  revenue: number | null;
  /** Each category's total cost in that year, positive. */
  byCategory: Record<Category, number>;
  /** Revenue less the direct total. */
  grossProfit: number | null;
  grossMargin: number | null;
  /** The filed figure. Never moves, whatever is classified. */
  operatingProfitReported: number | null;
  /**
   * Reported operating profit with the excluded lines added back: what the
   * reader is saying the business earns when the one-offs are set aside. Shown
   * BESIDE the reported figure, never instead of it.
   */
  operatingProfitUnderlying: number | null;
  /** Reported less (revenue - every classified cost). Must be nil. */
  tie: number | null;
}

/**
 * The classification view of each reported year.
 *
 * `tie` is the check that makes the promise testable: revenue less every
 * classified cost, against the filed operating profit. It is nil for every
 * classification, because the categories partition the same four lines, and a
 * non-nil value means a line has been double counted or dropped.
 */
export function subtotals(statements: any[], c: Classification | undefined): YearSubtotals[] {
  return lineAmounts(statements).map((r) => {
    const byCategory: Record<Category, number> = {
      direct: 0,
      indirect: 0,
      selling: 0,
      admin: 0,
      excluded: 0,
    };
    let anyCost = false;
    for (const line of CLASSIFIABLE_LINES) {
      const v = r.amounts[line.key];
      if (v === null) continue;
      anyCost = true;
      // A line that cannot be excluded stays where the reader put it among the
      // four operating categories, whatever a stale choice says.
      const chosen = categoryOf(line.key, c);
      const category = !line.excludable && chosen === 'excluded' ? line.defaultCategory : chosen;
      byCategory[category] += v;
    }
    const grossProfit = r.revenue !== null && anyCost ? r.revenue - byCategory.direct : null;
    const operating =
      r.revenue !== null && anyCost
        ? r.revenue -
          byCategory.direct -
          byCategory.indirect -
          byCategory.selling -
          byCategory.admin -
          byCategory.excluded
        : null;
    return {
      year: r.year,
      revenue: r.revenue,
      byCategory,
      grossProfit,
      grossMargin:
        grossProfit !== null && r.revenue !== null && r.revenue !== 0 ? grossProfit / r.revenue : null,
      operatingProfitReported: r.operatingIncomeFiled,
      operatingProfitUnderlying:
        r.operatingIncomeFiled !== null ? r.operatingIncomeFiled + byCategory.excluded : null,
      tie:
        operating !== null && r.operatingIncomeFiled !== null
          ? r.operatingIncomeFiled - operating
          : null,
    };
  });
}

/**
 * Attach the classification to a copy of the payload, the way
 * `applyCorrections` patches the statements.
 *
 * The engine reads it from here, so there is one path in and no screen can
 * apply a classification the engine does not see. The payload itself is left
 * alone, so the filed treatment survives for as long as the tab is open and
 * "return to the default" never needs another fetch.
 */
export function applyClassification(fetched: any, c: Classification | undefined): any {
  if (!fetched || isEmpty(c)) return fetched;
  const kept: Classification = {};
  for (const line of CLASSIFIABLE_LINES) {
    const choice = c?.[line.key];
    if (!choice) continue;
    if (choice.category === line.defaultCategory) continue;
    if (!line.excludable && choice.category === 'excluded') continue;
    kept[line.key] = choice;
  }
  return { ...fetched, classification: kept };
}

export default {
  CATEGORIES,
  CATEGORY_BY_KEY,
  CLASSIFIABLE_LINES,
  LINE_BY_KEY,
  categoryOf,
  reasonOf,
  isOverridden,
  overriddenLines,
  overrideCount,
  isEmpty,
  reclassifiedLabels,
  excludedLines,
  lineAmounts,
  classifiableFor,
  subtotals,
  applyClassification,
};
