// FILE: src/data/heads.ts
//
// Marginalia — filed lines, and the model head each one sits under
//
// ---------------------------------------------------------------------------
// WHAT THIS REPLACES, AND WHY
// ---------------------------------------------------------------------------
//
// It replaces expense classification (`classification.ts`, shipped 10 October
// 2026). That feature asked the reader to say whether each of four cost lines
// was direct, indirect, selling or administrative. The judgement was real but
// it was the wrong one: three of its five categories changed nothing a model
// forecasts, because operating profit is the sum of the same lines whatever
// they are called, and because NOTHING DOWNSTREAM READ THEM — no forecast
// driver, no workbook row, no model line corresponded to "indirect".
//
// An analyst reading a set of accounts does not ask "is this indirect". They
// ask **which head of the model does this filed line belong under** — and a
// head is a line of the model and of the 138-row chart of accounts, so the
// answer changes what the forecast does with the money. `ROADMAP.md` §19b.
//
// ---------------------------------------------------------------------------
// WHAT "AS FILED" MEANS TODAY, HONESTLY
// ---------------------------------------------------------------------------
//
// The intent is the company's own line captions, exactly as the company filed
// them. **We do not have those yet.** Both sources return a normalised schema —
// the same field names for every company — so what we can show is every field
// the source actually returned FOR THIS COMPANY, which genuinely differs
// company by company: Reliance reports no research and development and no
// share-based pay, and does report lease obligations; another company is the
// other way round. That is a per-company list of real filed figures, and it is
// not the company's own captions. The screen says so in those words and
// `DATA_CONSTRAINTS.md` records it; the captions arrive with the
// primary-filings data layer (`ROADMAP.md` §1).
//
// ---------------------------------------------------------------------------
// HOW A MOVE CHANGES A NUMBER — THE PART THAT IS EASY TO GET WRONG
// ---------------------------------------------------------------------------
//
// THE RE-AGGREGATION IS A TRANSFER, NOT A RE-SUM. Each line's money sits in
// its own payload field. A move SUBTRACTS the line's amount from its own field
// and ADDS it to the field the destination head drives. Nothing else is
// touched.
//
// The first version of this file re-summed instead: each engine field became
// the sum of every line assigned to its head. That reads better and is wrong,
// because THE PAYLOAD FIELDS ARE NOT A PARTITION. Share-based pay is already
// inside the filed SG&A, and short-term investments are read on their own field
// and added to cash by the engine. Re-summing double counted both, measured on
// the payloads on disk the moment any one line was moved:
//
//     AAPL  FY2025 sga   filed 27,601     re-summed 40,464   (+ stockComp)
//     MSFT  FY2026 sga   filed 7,956      re-summed 20,361   (+ stockComp)
//     AAPL  FY2025 cash  filed 35,934     re-summed 54,697   (+ shortTermInvestments)
//     REL   FY2026 cash  filed 1,373,270  re-summed 2,772,120
//
// None of it showed up in the obvious check, because `applyHeads(payload, {})`
// short-circuits on an empty assignment and returns the identical object. That
// check cannot fail (`CLAUDE.md`, "a check that cannot fail"). The check that
// can is in `verify/heads.mts`: force the re-aggregation with a real move and
// assert every field the move CANNOT touch is still the filed figure.
//
// A transfer is identity per line by construction — a line moved to its own
// default head subtracts and adds the same amount to the same field — so the
// drift sweep has nothing to find, and a component line that is not a transfer
// source cannot be counted twice.
//
// ---------------------------------------------------------------------------
// WHICH HEADS THE ENGINE CAN HONOUR, MEASURED
// ---------------------------------------------------------------------------
//
// A head is a drop target only where a move changes a number, and which heads
// those are is a measurement, not a preference. A control that moves a line and
// changes nothing is worse than no control.
//
// The thing that decides it is THE RECONCILING LINE. The engine ties its built
// operating profit to the filed figure by carrying the difference on its own
// line (`deriveModel`, `unexplainedOperatingCosts`). So money taken out of a
// named operating cost reappears in that residual, pound for pound, and the
// forecast margin is unchanged — in the reported years by design, because the
// filing is not restated, and in the forecast years too, because the residual
// is forecast at its own share of revenue.
//
// Two consequences, and they are the whole shape of this file:
//
//   · **Below the operating line is not a drop target yet.** Moving an
//     operating cost to other income or to finance cost cannot change the
//     forecast, because the residual absorbs it. Honouring it needs the engine
//     to take the money out of the forecast operating base AND put it below the
//     line. That hook is a roadmap item, and until it exists those two heads
//     are SHOWN with their lines and are not drop targets.
//
//   · **One-offs needs a hook, and gets one in this commit.** One-offs is the
//     head that takes money out of the forecast base, and it is the head the
//     adjusted EBITDA bridge reads. The residual would hand the money straight
//     back, so `deriveModel` reads `heads.oneOffs` and removes it from the
//     residual's FORECAST base while the reported years keep it exactly as
//     filed. That reproduces what classification's "excluded as non-recurring"
//     did, line for line and figure for figure, which `verify/heads.mts`
//     asserts against the old path so the replacement can be shown to lose
//     nothing.
//
// The balance sheet needs no hook. The engine reads a handful of named lines
// and PLUGS the rest from the filed totals, so taking money out of cash,
// receivables, inventory, payables or net plant moves it into a plug that the
// filed total closes — the sheet still ties, net debt or the roll-forward
// changes, and the value moves.
//
// ---------------------------------------------------------------------------
// WHAT STAYS TRUE WHATEVER IS MOVED
// ---------------------------------------------------------------------------
//
// Reported operating profit ties to the filing. The filed anchors — operating
// profit, pretax profit, net income, total assets, total liabilities — are
// never written by a move, so the reported column is the filing and the four
// visible states stay four.

import { MODEL_SHEET_ROWS } from './excelExport';

export type Statement = 'income' | 'balance';

export type HeadKey =
  // ---- income statement ----
  | 'revenue'
  | 'cogs'
  | 'rnd'
  | 'sga'
  | 'da'
  | 'otherOperating'
  | 'otherIncome'
  | 'financeCost'
  | 'oneOffs'
  | 'tax'
  // ---- balance sheet ----
  | 'cash'
  | 'receivables'
  | 'inventory'
  | 'payables'
  | 'fixedAssets'
  | 'debt'
  | 'equity'
  | 'other';

export interface Head {
  key: HeadKey;
  label: string;
  statement: Statement;
  /** What belongs under it. A definition, never a recommendation. */
  definition: string;
  /** How the forecast treats it — the reason a move changes a number. */
  forecast: string;
  /** The contracted row this head drives (METHODOLOGY §22a). */
  row: string | null;
  /**
   * The payload field a line moved HERE is added to. Null where the head has
   * no field of its own: one-offs is read from `heads.oneOffs`, and other
   * operating costs and other assets are the engine's own residuals, so the
   * money simply leaves its named field and falls into them.
   */
  field: string | null;
  /** True where the head sits inside operating profit. */
  operating?: boolean;
  /**
   * False where the engine cannot yet honour a line being assigned to this
   * head. Such a head is SHOWN with its lines and is not a drop target.
   */
  dropTarget: boolean;
  /** Said on screen wherever `dropTarget` is false. */
  notYetBecause?: string;
}

/**
 * THE HEADS, AND THE CONTRACTED ROW EACH ONE DRIVES.
 *
 * Every head names a row of the 138-row chart of accounts, so a head is not a
 * label on a screen: it is the line of the model and of the workbook the figure
 * ends up on. The rows are checked against `MODEL_SHEET_ROWS` at module load,
 * so a head naming a row the contract does not publish fails immediately rather
 * than in somebody's workbook.
 */
export const HEADS: readonly Head[] = Object.freeze([
  {
    key: 'revenue',
    label: 'Revenue',
    statement: 'income',
    definition: 'What the company sold. The top line the forecast grows.',
    forecast: 'Grown at the revenue growth rate, fading to the terminal rate.',
    row: 'rev',
    field: 'revenue',
    operating: true,
    dropTarget: false,
    notYetBecause:
      'The forecast GROWS this line rather than reading a margin off it, so a cost moved here would be ' +
      'modelled as a sale and compounded for every forecast year. Revenue stays where the filing puts it; ' +
      'setting a one-off sale aside is a judgement about revenue growth and needs the engine hook recorded ' +
      'in ROADMAP.md §19b.',
  },
  {
    key: 'cogs',
    label: 'Cost of sales',
    statement: 'income',
    definition: 'The cost of producing what was sold: materials, direct labour, subcontract.',
    forecast:
      'The gross margin is read off this head and held flat, so a line moved here changes the gross margin in ' +
      'every forecast year.',
    row: 'cogs',
    field: 'cogs',
    operating: true,
    dropTarget: true,
  },
  {
    key: 'rnd',
    label: 'Research and development',
    statement: 'income',
    definition: 'Spending on developing products, where the filing reports it separately.',
    forecast: 'Its own share of revenue, last reported year held flat.',
    row: 'rnd',
    field: 'rnd',
    operating: true,
    dropTarget: true,
  },
  {
    key: 'sga',
    label: 'Selling, general and administrative',
    statement: 'income',
    definition: 'The cost of selling and of running the company: sales pay, head office, finance, legal.',
    forecast: 'Its own share of revenue, last reported year held flat.',
    row: 'sga',
    field: 'sga',
    operating: true,
    dropTarget: true,
  },
  {
    key: 'da',
    label: 'Depreciation and amortisation',
    statement: 'income',
    definition: 'The non-cash charge for using up plant and intangibles.',
    forecast:
      'From the plant roll-forward rather than a share of revenue, and added back in EBITDA and in cash flow — ' +
      'so a line moved here raises EBITDA and is depreciated.',
    row: 'daCost',
    field: 'depreciation',
    operating: true,
    dropTarget: true,
  },
  {
    key: 'otherOperating',
    label: 'Other operating costs',
    statement: 'income',
    definition:
      'Operating costs the filing does not name separately. This is the engine’s reconciling line: the ' +
      'difference between filed operating profit and the named cost lines, which is what makes reported ' +
      'operating profit tie to the filing.',
    forecast: 'Its share of revenue, last reported year held flat.',
    row: 'otherOpex',
    // No field of its own: it IS the residual, so money that leaves a named
    // line falls into it without anything being written.
    field: null,
    operating: true,
    dropTarget: true,
  },
  {
    key: 'otherIncome',
    label: 'Other income and expense',
    statement: 'income',
    definition:
      'Everything between operating profit and pretax profit except interest: investment income, ' +
      'equity-method results, currency.',
    forecast: 'Its share of revenue. Below operating profit, so what sits here is outside EBIT and EBITDA.',
    row: 'other',
    field: null,
    dropTarget: false,
    notYetBecause:
      'MEASURED: an operating cost moved below the operating line cannot change the forecast today. The engine ' +
      'ties built operating profit to the filed figure by carrying the difference on its reconciling line, so ' +
      'the money leaves SG&A and reappears in that residual, and the forecast operating margin is exactly what ' +
      'it was. Honouring this head needs the engine to take the amount out of the forecast operating base and ' +
      'add it below the line — the hook is recorded in ROADMAP.md §19b, beside the debt hook.',
  },
  {
    key: 'financeCost',
    label: 'Finance cost',
    statement: 'income',
    definition: 'Interest and other costs of borrowing.',
    forecast: 'Charged on the forecast debt balance. Below operating profit, so what sits here is outside EBIT.',
    row: 'intExp',
    field: 'interestExpense',
    dropTarget: false,
    notYetBecause:
      'MEASURED, and for two reasons. The reconciling line absorbs an operating cost moved below the line, as ' +
      'with other income; and the forecast charge comes off the debt schedule rather than the filed figure, so ' +
      'inflating the filed interest would move the implied cost of debt instead of the cost it was meant to ' +
      'move. The hook is recorded in ROADMAP.md §19b.',
  },
  {
    key: 'oneOffs',
    label: 'One-offs',
    statement: 'income',
    definition: 'A cost the reader judges will not repeat. It stays in the reported years exactly as filed.',
    forecast:
      'NIL IN EVERY FORECAST YEAR. The only head that takes money out of the forecast base, which is why it is ' +
      'the one that moves the valuation most — and the head the adjusted EBITDA bridge reads.',
    row: null,
    field: null,
    dropTarget: true,
  },
  {
    key: 'tax',
    label: 'Tax',
    statement: 'income',
    definition: 'The charge for tax on the year’s profits, as the filing states it.',
    forecast: 'The effective rate measured on the reported years.',
    row: 'tax',
    field: 'taxExpense',
    dropTarget: false,
    notYetBecause:
      'The effective rate is measured on the filed tax charge against filed pretax profit, so a cost moved here ' +
      'would be read as tax the company paid and would change the rate every forecast year is taxed at. A cost ' +
      'is not tax; the filed charge is the filed charge.',
  },

  // ---- balance sheet ----
  //
  // SHORTER THAN THE INCOME STATEMENT, AND FOR A MEASURED REASON. The engine
  // does not read the filed balance sheet line by line: it reads a handful of
  // named lines and PLUGS the rest from the filed totals, which is what makes
  // every company's balance sheet tie. So the heads below are the named lines,
  // one honest "other", and two heads that are shown and cannot be assigned
  // to. Each says why.
  {
    key: 'cash',
    label: 'Cash and investments',
    statement: 'balance',
    definition: 'Cash, bank balances and investments held as cash.',
    forecast:
      'The closing balance of the cash roll-forward, and net debt reads it — so a move here changes the ' +
      'equity value directly.',
    row: 'bsCash',
    field: 'cash',
    dropTarget: true,
  },
  {
    key: 'receivables',
    label: 'Receivables',
    statement: 'balance',
    definition: 'Amounts owed by customers.',
    forecast: 'Grows at the revenue growth rate — constant days outstanding.',
    row: 'bsAr',
    field: 'receivables',
    dropTarget: true,
  },
  {
    key: 'inventory',
    label: 'Inventory',
    statement: 'balance',
    definition: 'Stock held for sale or in production.',
    forecast: 'Grows at the cost-of-sales growth rate — constant turnover.',
    row: 'bsInv',
    field: 'inventory',
    dropTarget: true,
  },
  {
    key: 'payables',
    label: 'Payables',
    statement: 'balance',
    definition: 'Amounts owed to suppliers.',
    forecast: 'Grows at the cost-of-sales growth rate.',
    row: 'bsAp',
    field: 'payables',
    dropTarget: true,
  },
  {
    key: 'fixedAssets',
    label: 'Fixed assets',
    statement: 'balance',
    definition: 'Plant, property and equipment the depreciation roll-forward runs on.',
    forecast: 'Opening balance plus capital spending less depreciation. A move here is depreciated.',
    row: 'bsPpe',
    field: 'ppeNet',
    dropTarget: true,
  },
  {
    key: 'other',
    label: 'Other, on no driver of its own',
    statement: 'balance',
    definition:
      'Anything the engine does not forecast on a driver of its own: other current assets, other assets, ' +
      'accruals, other liabilities.',
    forecast:
      'Held flat, or grown with the driver the engine declares for that residual. WHICH residual a line lands ' +
      'in is decided by the filed total it sits inside — a current asset lands in other current assets, a ' +
      'non-current one in other assets — not by choosing, which is why this is one head and not three.',
    row: 'bsOa',
    // The residuals are plugged from the filed totals, so a line moved here
    // simply leaves its own field and the plug closes over it.
    field: null,
    dropTarget: true,
  },
  {
    key: 'debt',
    label: 'Debt, including leases',
    statement: 'balance',
    definition: 'Borrowings of every maturity, and lease obligations.',
    forecast: 'The debt schedule, and net debt reads it.',
    row: 'bsDebt',
    field: null,
    dropTarget: false,
    notYetBecause:
      'The engine builds the debt total from thirteen filed fields with separate US GAAP and IFRS paths — ' +
      'combined debt-and-lease figures where a filing publishes them, debt-only where it does not, finance ' +
      'leases netted and operating leases never netted. A move cannot be honoured by rewriting one field, and ' +
      'a control that moved a line without changing a number would be worse than none. The engine hook this ' +
      'needs is the next job in ROADMAP.md §19b.',
  },
  {
    key: 'equity',
    label: 'Equity',
    statement: 'balance',
    definition: 'Share capital, reserves and retained earnings.',
    forecast: 'Opening equity plus retained profit, less dividends and buybacks.',
    row: 'bsTe',
    field: null,
    dropTarget: false,
    notYetBecause:
      'The engine DERIVES equity as total assets less total liabilities rather than reading the filed figure, ' +
      'which is what makes the balance sheet tie in every year. Nothing assigned to this head would reach the ' +
      'model, so nothing may be assigned to it.',
  },
]);

export const HEAD_BY_KEY: Record<HeadKey, Head> = Object.fromEntries(
  HEADS.map((h) => [h.key, h])
) as Record<HeadKey, Head>;

/** The heads a line of this statement may be dropped on. */
export const dropTargets = (statement: Statement): Head[] =>
  HEADS.filter((h) => h.statement === statement && h.dropTarget);

/**
 * EVERY HEAD NAMES A ROW THE CONTRACT PUBLISHES.
 *
 * Checked rather than trusted: a head pointing at a row that is not in the
 * chart of accounts would write a figure to a line no firm's macro expects, and
 * nothing downstream would notice.
 *
 * A FUNCTION AND NOT A LOAD-TIME LOOP, for a reason worth writing down. The
 * workbook's Assumptions sheet reads the head labels from this file, so
 * `excelSheets` imports `heads`, and `heads` imports `MODEL_SHEET_ROWS` from
 * `excelExport`, which imports `excelSheets`. That is a cycle, and ES modules
 * resolve a cycle by handing back the half-initialised module: whichever of the
 * three a screen happened to import first decided whether `MODEL_SHEET_ROWS`
 * was initialised yet, so a load-time read would have thrown
 * "cannot access before initialization" on some entry points and not others.
 * Inside a function body the reference is evaluated after every module has
 * finished loading, so there is no order to get wrong.
 *
 * `verify/heads.mts` calls it, which is where a broken row contract has to be
 * caught — before a workbook is built, not inside one.
 */
export function checkHeadRows(): string[] {
  const problems: string[] = [];
  for (const head of HEADS) {
    if (head.row === null) continue;
    if ((MODEL_SHEET_ROWS as Record<string, number>)[head.row] === undefined) {
      problems.push(
        `the head "${head.key}" drives the row "${head.row}", which is not in the published chart of ` +
          'accounts (METHODOLOGY.md §22a). Either the row name is wrong or the contract needs the row.'
      );
    }
  }
  return problems;
}

// ---------------------------------------------------------------------------
// THE LINES A SOURCE RETURNS, AND THE HEAD EACH ONE DEFAULTS TO
// ---------------------------------------------------------------------------

/**
 * The engine's reconciling line, which is a line on the screen and not a field
 * in the payload. It is real money the company charged above operating profit
 * that the filing never named, so a reader must be able to see it and to set it
 * aside — on Reliance it is the largest single judgement on the screen.
 */
export const RECONCILING_LINE = 'otherOperatingCosts';

export interface LineSpec {
  /** The payload field, or `RECONCILING_LINE` for the engine's residual. */
  field: string;
  label: string;
  statement: Statement;
  defaultHead: HeadKey;
  /** Where the default came from. Required: a default that cannot say why is the silent judgement. */
  basis: string;
  /**
   * The payload field this line's money sits in, which a move subtracts from.
   * Null for the reconciling line, whose amount is a residual: money added to a
   * named line shrinks it without anything being written.
   */
  ownField: string | null;
  /** False for an anchor, a total, or a line the engine cannot honour a move of. */
  movable: boolean;
  /** Said on screen where `movable` is false. */
  fixedBecause?: string;
  /**
   * Set where this line's money is ALREADY INSIDE another filed line. A
   * component is shown under its parent's head and is never a transfer source,
   * because moving it would move money the parent still reports.
   */
  componentOf?: string;
  /**
   * A FILED ANCHOR OR SUBTOTAL, not a line of the statement.
   *
   * Operating profit, pretax profit, net income and the balance-sheet totals
   * are what the model ties ITSELF to. They have to be visible — a reader who
   * cannot see total assets on a screen headed "as filed" will wonder what else
   * is missing — but they are not part of any head's sum, and putting them
   * under one is a double count: these three sat under the revenue head and
   * made it read as revenue plus operating profit plus pretax profit plus net
   * income, which broke the screen's own tie row by 2,627,630 on Reliance. They
   * get a band of their own and are excluded from every total.
   */
  anchor?: boolean;
  /**
   * Heads this line may NOT be moved to, even though the head is a drop target.
   * Each one is a measured refusal; the screen says it under the line.
   */
  notTo?: HeadKey[];
  /** A liability or a cost, so the screen can show it as a deduction. */
  negative?: boolean;
  /** True for the reconciling line: computed, not filed, and the screen says so. */
  derived?: boolean;
}

/**
 * THE LINES, IN THE ORDER A SET OF ACCOUNTS READS.
 *
 * Totals and anchors are present and NOT movable, each saying why: a reader who
 * cannot see total assets on a screen headed "as filed" will wonder what else
 * is missing, and a reader who could drag it would silently double count.
 */
export const LINES: readonly LineSpec[] = Object.freeze([
  // ---- income statement ----
  {
    field: 'revenue',
    label: 'Revenue',
    statement: 'income',
    defaultHead: 'revenue',
    ownField: 'revenue',
    movable: false,
    fixedBecause:
      'The forecast grows the top line rather than reading a margin off it, so revenue stays where the filing ' +
      'puts it. Setting a one-off sale aside is a judgement about revenue growth and needs its own engine hook ' +
      '(ROADMAP.md §19b).',
    basis: 'The source returns this as revenue or turnover, which is the top line by its own description.',
  },
  {
    field: 'cogs',
    label: 'Cost of sales',
    statement: 'income',
    defaultHead: 'cogs',
    ownField: 'cogs',
    movable: true,
    negative: true,
    // MEASURED: setting cost of sales aside does not produce a nil cost of
    // sales. It is the balancing line — the engine derives the forecast from
    // the gross margin rather than forecasting the line — so zeroing the filed
    // figure takes the gross margin to 100% and the forecast still carried
    // 565,937 of cost on Reliance in the first forecast year. The old feature
    // refused to let cost of sales be excluded for the same reason, and the
    // reason has not changed.
    notTo: ['oneOffs'],
    basis:
      'The source returns this as cost of sales or cost of revenue, which is a cost of the units sold by its ' +
      'own description. It cannot be set aside as a one-off: it is the balancing line the gross margin is ' +
      'derived from, so there is no margin to take to nil, and a one-off inside it is a correction to the ' +
      'figure in this row.'
  },
  {
    field: 'rnd',
    label: 'Research and development',
    statement: 'income',
    defaultHead: 'rnd',
    ownField: 'rnd',
    movable: true,
    negative: true,
    basis: 'The source returns this separately from selling and administrative costs, so it keeps its own head.',
  },
  {
    field: 'sga',
    label: 'Selling, general and administrative',
    statement: 'income',
    defaultHead: 'sga',
    ownField: 'sga',
    movable: true,
    negative: true,
    basis:
      'The source returns selling and administrative costs as one line and nothing in it splits them, so the ' +
      'whole line defaults to that head.',
  },
  {
    field: RECONCILING_LINE,
    label: 'Other operating costs',
    statement: 'income',
    defaultHead: 'otherOperating',
    ownField: null,
    movable: true,
    negative: true,
    derived: true,
    basis:
      'COMPUTED, NOT FILED: filed operating profit less the named cost lines. The filing charged this money ' +
      'above operating profit without naming it as one of those lines, and carrying it is what makes reported ' +
      'operating profit tie to the filing. Set it aside as a one-off and the forecast loses it while the ' +
      'reported years keep it.',
  },
  {
    field: 'depreciation',
    label: 'Depreciation and amortisation',
    statement: 'income',
    defaultHead: 'da',
    ownField: 'depreciation',
    movable: false,
    negative: true,
    componentOf: 'the filed cost lines',
    fixedBecause:
      'Reported in the cash flow statement, and the money is ALREADY INSIDE the filed cost lines. The engine ' +
      'takes it out of them at the share it took there and charges it as its own line, so it is both already ' +
      '— and moving it would move money cost of sales still reports.',
    basis:
      'Filed depreciation and amortisation, charged as its own line and added back in EBITDA and in cash flow.',
  },
  {
    field: 'stockComp',
    label: 'Share-based pay',
    statement: 'income',
    defaultHead: 'sga',
    ownField: 'stockComp',
    movable: false,
    negative: true,
    componentOf: 'the filed SG&A',
    fixedBecause:
      'Pay settled in shares is still pay, and the money is ALREADY INSIDE the filed SG&A. The engine takes it ' +
      'out at the share it took in the last reported year and charges it as its own line, so moving it would ' +
      'move money SG&A still reports. Treating it as a one-off needs its own engine hook (ROADMAP.md §19b).',
    basis: 'Filed share-based pay. It stays a cost, because the peer multiples on this site are computed that way.',
  },
  {
    field: 'interestExpense',
    label: 'Finance cost',
    statement: 'income',
    defaultHead: 'financeCost',
    ownField: 'interestExpense',
    movable: false,
    negative: true,
    fixedBecause:
      'The forecast charge comes off the debt schedule rather than this figure, so a move would change the ' +
      'implied cost of debt rather than the cost it was meant to move. See the finance cost head.',
    basis: 'The source returns this as interest expense, which is a cost of borrowing rather than of trading.',
  },
  {
    field: 'taxExpense',
    label: 'Tax',
    statement: 'income',
    defaultHead: 'tax',
    ownField: 'taxExpense',
    movable: false,
    negative: true,
    fixedBecause:
      'The effective rate every forecast year is taxed at is measured on this charge against filed pretax ' +
      'profit, so reassigning it would change the rate rather than the line. See the tax head.',
    basis: 'The source returns this as the tax charge for the year.',
  },
  {
    field: 'operatingIncome',
    label: 'Operating profit (as filed)',
    statement: 'income',
    defaultHead: 'revenue',
    ownField: 'operatingIncome',
    movable: false,
    anchor: true,
    fixedBecause:
      'An anchor, not a line. The engine reconciles its own operating profit to this figure in every reported ' +
      'year, which is what makes the reported column the filing whatever you move.',
    basis: 'Filed operating profit.',
  },
  {
    field: 'pretaxIncome',
    label: 'Profit before tax (as filed)',
    statement: 'income',
    defaultHead: 'revenue',
    ownField: 'pretaxIncome',
    movable: false,
    anchor: true,
    fixedBecause:
      'An anchor. Other income is derived as the difference between this and operating profit less interest, so ' +
      'reported pretax profit ties to the filing.',
    basis: 'Filed profit before tax.',
  },
  {
    field: 'netIncome',
    label: 'Profit after tax (as filed)',
    statement: 'income',
    defaultHead: 'revenue',
    ownField: 'netIncome',
    movable: false,
    anchor: true,
    fixedBecause: 'An anchor. Items after tax are derived from it, so reported net profit ties to the filing.',
    basis: 'Filed profit after tax.',
  },

  // ---- balance sheet ----
  {
    field: 'cash',
    label: 'Cash and bank',
    statement: 'balance',
    defaultHead: 'cash',
    ownField: 'cash',
    movable: true,
    basis: 'The source returns this as cash and equivalents.',
  },
  {
    field: 'shortTermInvestments',
    label: 'Short-term investments',
    statement: 'balance',
    defaultHead: 'cash',
    ownField: 'shortTermInvestments',
    movable: true,
    basis:
      'Marketable securities held as cash, so the engine reads them on their own field and nets them against ' +
      'debt with cash. Move them to other assets if they are not available to repay debt.',
  },
  {
    field: 'longTermInvestments',
    label: 'Long-term investments',
    statement: 'balance',
    defaultHead: 'other',
    ownField: 'longTermInvestments',
    movable: true,
    basis:
      'Held beyond a year, so not netted against debt. The engine carries it in other assets, on no driver of ' +
      'its own.',
  },
  {
    field: 'receivables',
    label: 'Receivables',
    statement: 'balance',
    defaultHead: 'receivables',
    ownField: 'receivables',
    movable: true,
    basis: 'The source returns this as trade receivables, which the engine grows at the revenue growth rate.',
  },
  {
    field: 'inventory',
    label: 'Inventory',
    statement: 'balance',
    defaultHead: 'inventory',
    ownField: 'inventory',
    movable: true,
    basis: 'The source returns this as inventory, which the engine grows at the cost-of-sales growth rate.',
  },
  {
    field: 'ppeNet',
    label: 'Property, plant and equipment',
    statement: 'balance',
    defaultHead: 'fixedAssets',
    ownField: 'ppeNet',
    movable: true,
    basis: 'Net book value of plant, which the engine rolls forward with capital spending and depreciation.',
  },
  {
    field: 'goodwill',
    label: 'Goodwill',
    statement: 'balance',
    defaultHead: 'other',
    ownField: 'goodwill',
    movable: true,
    basis:
      'The engine does NOT treat goodwill as fixed assets — only net plant feeds the depreciation ' +
      'roll-forward — so it falls into other assets and is held flat. Move it to fixed assets to have it ' +
      'depreciated.',
  },
  {
    field: 'intangibles',
    label: 'Other intangibles',
    statement: 'balance',
    defaultHead: 'other',
    ownField: 'intangibles',
    movable: true,
    basis:
      'Carried as a disclosure rather than a balance-sheet input: the engine plugs it into other assets. Move ' +
      'it to fixed assets to have it amortised by the roll-forward.',
  },
  {
    field: 'payables',
    label: 'Payables',
    statement: 'balance',
    defaultHead: 'payables',
    ownField: 'payables',
    movable: true,
    negative: true,
    basis: 'The source returns this as trade payables, which the engine grows at the cost-of-sales growth rate.',
  },
  // THE DEBT LINES ARE THE FIELDS THE SOURCE ACTUALLY RETURNS, which is not the
  // same as the fields the engine's debt total is built from. The sources
  // publish up to fourteen overlapping debt and lease tags — a combined
  // debt-and-lease figure, a debt-only figure, a total that is the sum of its
  // own current and non-current parts — and the engine resolves which to read
  // per filing and per standard. The lines below are the ones that do NOT
  // overlap each other, so the screen states the filing without counting the
  // same borrowing twice; `longTermDebtTotal` is deliberately absent because it
  // is the sum of two lines already here. Which of the overlapping tags the
  // engine used is what the debt hook will expose (ROADMAP.md §19b).
  {
    field: 'longTermDebt',
    label: 'Borrowings due beyond a year',
    statement: 'balance',
    defaultHead: 'debt',
    ownField: 'longTermDebt',
    movable: false,
    negative: true,
    fixedBecause:
      'The debt total is built from up to fourteen filed fields with separate GAAP and IFRS paths, so a move ' +
      'cannot yet be honoured. See the debt head.',
    basis: 'Borrowings due beyond a year. Net debt reads it.',
  },
  {
    field: 'longTermDebtCurrent',
    label: 'Borrowings due within a year',
    statement: 'balance',
    defaultHead: 'debt',
    ownField: 'longTermDebtCurrent',
    movable: false,
    negative: true,
    fixedBecause:
      'The debt total is built from up to fourteen filed fields with separate GAAP and IFRS paths, so a move ' +
      'cannot yet be honoured. See the debt head.',
    basis: 'The part of long-term borrowings repayable within the year. Net debt reads it.',
  },
  {
    field: 'shortTermBorrowings',
    label: 'Short-term borrowings',
    statement: 'balance',
    defaultHead: 'debt',
    ownField: 'shortTermBorrowings',
    movable: false,
    negative: true,
    fixedBecause:
      'The debt total is built from up to fourteen filed fields with separate GAAP and IFRS paths, so a move ' +
      'cannot yet be honoured. See the debt head.',
    basis: 'Commercial paper and other borrowing that was never long-term. Net debt reads it.',
  },
  {
    field: 'financeLeaseTotal',
    label: 'Finance lease obligations',
    statement: 'balance',
    defaultHead: 'debt',
    ownField: 'financeLeaseTotal',
    movable: false,
    negative: true,
    fixedBecause:
      'Whether a lease is debt is its own judgement in the plan (ROADMAP.md §2) and cannot be made here ' +
      'yet: the engine reads a combined debt-and-lease figure wherever a filing publishes one, so zeroing this ' +
      'line would change nothing.',
    basis: 'A finance lease is a financing of an asset the company controls, so the engine counts it as debt.',
  },
  {
    field: 'operatingLeaseTotal',
    label: 'Operating lease obligations',
    statement: 'balance',
    defaultHead: 'debt',
    ownField: 'operatingLeaseTotal',
    movable: false,
    negative: true,
    fixedBecause:
      'Whether an operating lease is debt is its own judgement in the plan (ROADMAP.md §2) and cannot be ' +
      'made here yet. The engine never nets an operating lease against cash, which a move could not express.',
    basis:
      'The lease liability the filing reports. The engine counts it as debt and never nets it against cash, ' +
      'because the rent is already outside the cash flow the enterprise value is built from.',
  },
  {
    field: 'minorityInterest',
    label: 'Non-controlling interests',
    statement: 'balance',
    defaultHead: 'other',
    ownField: 'minorityInterest',
    movable: false,
    negative: true,
    fixedBecause:
      'The equity bridge reads this figure directly to deduct it from enterprise value, so it is not a ' +
      'balance-sheet line to be reassigned.',
    basis: 'A claim of others on the group, deducted in the equity bridge rather than counted as our equity.',
  },
  {
    field: 'preferredStock',
    label: 'Preferred stock',
    statement: 'balance',
    defaultHead: 'other',
    ownField: 'preferredStock',
    movable: false,
    negative: true,
    fixedBecause: 'The equity bridge reads this figure directly, so it is not a balance-sheet line to be reassigned.',
    basis: 'A prior claim on the group, deducted in the equity bridge.',
  },
  {
    field: 'equity',
    label: 'Shareholders’ equity',
    statement: 'balance',
    defaultHead: 'equity',
    ownField: 'equity',
    movable: false,
    anchor: true,
    fixedBecause:
      'The engine derives equity as total assets less total liabilities rather than reading this figure, which ' +
      'is what makes the balance sheet tie in every year. Reassigning it would change nothing.',
    basis: 'Filed equity attributable to shareholders. Shown for comparison; the model derives its own.',
  },
  // THE TWO FILED SUBTOTALS, SHOWN AND NOT MOVABLE. They are not decoration:
  // the engine plugs other current assets from total current assets and other
  // non-current liabilities from total liabilities, which is what makes every
  // company's balance sheet tie. A reader correcting one of them changes where
  // every unnamed balance lands, so they have to be here and editable; moving
  // one would count its contents twice.
  {
    field: 'currentAssets',
    label: 'Total current assets (as filed)',
    statement: 'balance',
    defaultHead: 'other',
    ownField: 'currentAssets',
    movable: false,
    anchor: true,
    fixedBecause:
      'A filed subtotal, not a line. The engine plugs other current assets from it — total current assets ' +
      'less cash, investments, receivables and inventory — so the sheet ties to it, and moving it would ' +
      'count every current asset twice.',
    basis: 'Filed total current assets.',
  },
  {
    field: 'currentLiabilities',
    label: 'Total current liabilities (as filed)',
    statement: 'balance',
    defaultHead: 'other',
    ownField: 'currentLiabilities',
    movable: false,
    negative: true,
    anchor: true,
    fixedBecause:
      'A filed subtotal, not a line. The engine plugs accrued and other current liabilities from it, so the ' +
      'sheet ties to it, and moving it would count every current liability twice.',
    basis: 'Filed total current liabilities.',
  },
  {
    field: 'totalAssets',
    label: 'Total assets (as filed)',
    statement: 'balance',
    defaultHead: 'other',
    ownField: 'totalAssets',
    movable: false,
    anchor: true,
    fixedBecause:
      'A total, not a line. Moving it would count every asset twice — and it is the figure the engine ' +
      'plugs every unnamed asset from, so the sheet ties to it.',
    basis: 'Filed total assets.',
  },
  {
    field: 'totalLiabilities',
    label: 'Total liabilities (as filed)',
    statement: 'balance',
    defaultHead: 'other',
    ownField: 'totalLiabilities',
    movable: false,
    anchor: true,
    fixedBecause:
      'A total, not a line. Moving it would count every liability twice — and it is the figure the engine ' +
      'plugs every unnamed liability from.',
    basis: 'Filed total liabilities.',
  },
]);

export const LINE_BY_FIELD: Record<string, LineSpec> = Object.fromEntries(
  LINES.map((l) => [l.field, l])
);

/**
 * EVERY MOVABLE LINE'S DEFAULT HEAD MUST BE ONE THE ENGINE HONOURS.
 *
 * A movable line whose default head is not a drop target could be dragged away
 * and never dragged back, and the visible return to the default would put it
 * somewhere the engine cannot read. Checked at load rather than reasoned about.
 */
for (const line of LINES) {
  if (!line.movable) continue;
  const head = HEAD_BY_KEY[line.defaultHead];
  if (!head || !head.dropTarget) {
    throw new Error(
      `heads.ts: "${line.field}" is movable but its default head "${line.defaultHead}" is not a drop target, ` +
        'so it could not be put back. Either the line is not movable or the head is.'
    );
  }
  if (head.statement !== line.statement) {
    throw new Error(`heads.ts: "${line.field}" is a ${line.statement} line under a ${head.statement} head.`);
  }
}

/** field -> the reader's head and their reason for it. */
export type HeadAssignment = Record<string, { head: HeadKey; reason?: string }>;

const num = (v: any): number | null => (typeof v === 'number' && isFinite(v) ? v : null);

export interface FiledLine extends LineSpec {
  /** As filed, per reported year. Never a nil standing in for an absence. */
  amounts: (number | null)[];
  /** The heads this line may be moved to: its own statement's drop targets, less its own. */
  movableTo: HeadKey[];
}

/**
 * The engine's reconciling line, per year: filed operating profit less the
 * named cost lines.
 *
 * Computed here the way `deriveModel` computes `unexplainedOperatingCosts` and
 * the way `yearChecks` reports it, from the same statements, so this screen and
 * that check cannot disagree. Positive is a COST the filing did not name.
 */
export function reconcilingLine(statements: any[]): (number | null)[] {
  return (Array.isArray(statements) ? statements : []).map((row) => {
    const rev = num(row?.revenue);
    const cogs = num(row?.cogs);
    const op = num(row?.operatingIncome);
    if (rev === null || cogs === null || op === null) return null;
    return rev - cogs - (num(row?.rnd) ?? 0) - (num(row?.sga) ?? 0) - op;
  });
}

/**
 * The lines this company actually has.
 *
 * A field the source did not return for this company is ABSENT, not nil: a line
 * on a screen headed "as filed" is a claim that the company filed it. The
 * reconciling line is present only where it is not nil in every year — a filing
 * whose named costs come to its operating profit exactly has no residual, and
 * offering a judgement about an absence would be inventing work.
 */
export function linesFor(statements: any[]): FiledLine[] {
  const rows = Array.isArray(statements) ? statements : [];
  const residual = reconcilingLine(rows);
  const out: FiledLine[] = [];
  for (const spec of LINES) {
    const amounts = spec.derived ? residual : rows.map((r) => num(r?.[spec.field]));
    const anything = spec.derived
      ? amounts.some((v) => v !== null && Math.abs(v) > 1e-6)
      : amounts.some((v) => v !== null);
    if (!anything) continue;
    out.push({
      ...spec,
      amounts,
      movableTo: spec.movable
        ? dropTargets(spec.statement)
            .map((h) => h.key)
            .filter((k) => k !== spec.defaultHead && !(spec.notTo || []).includes(k))
        : [],
    });
  }
  return out;
}

export const headOf = (field: string, a: HeadAssignment | undefined): HeadKey =>
  a?.[field]?.head ?? LINE_BY_FIELD[field]?.defaultHead ?? 'otherOperating';

export const reasonOf = (field: string, a: HeadAssignment | undefined): string => a?.[field]?.reason ?? '';

export const isMoved = (field: string, a: HeadAssignment | undefined): boolean => {
  const choice = a?.[field];
  if (!choice) return false;
  const spec = LINE_BY_FIELD[field];
  if (!spec || !spec.movable) return false;
  // A head the engine does not honour is not a move, whatever a stale record
  // says: the line reads as being on its default and the model is the default's.
  const head = HEAD_BY_KEY[choice.head];
  if (!head || !head.dropTarget || head.statement !== spec.statement) return false;
  // Nor is a head this particular line is refused, which is not the same thing:
  // one-offs is a drop target, and cost of sales still may not go there.
  if ((spec.notTo || []).includes(choice.head)) return false;
  return choice.head !== spec.defaultHead;
};

export const movedFields = (a: HeadAssignment | undefined): string[] =>
  LINES.filter((l) => isMoved(l.field, a)).map((l) => l.field);

export const moveCount = (a: HeadAssignment | undefined): number => movedFields(a).length;

export const isEmpty = (a: HeadAssignment | undefined): boolean => moveCount(a) === 0;

export const movedLabels = (a: HeadAssignment | undefined): string[] =>
  LINES.filter((l) => isMoved(l.field, a)).map((l) => l.label);

/** The lines a reader has put under one-offs: the only head that moves money out of the forecast. */
export const oneOffFields = (a: HeadAssignment | undefined): string[] =>
  LINES.filter((l) => isMoved(l.field, a) && a?.[l.field]?.head === 'oneOffs').map((l) => l.field);

/**
 * Only the assignments that mean something, for storing on a model or a saved
 * record. A choice that equals the default, names a head the engine does not
 * honour, or names a line that cannot move, is dropped rather than carried: a
 * record saying a line was moved when the model did not move it is a fifth
 * state nobody asked for.
 */
export function pruneAssignment(a: HeadAssignment | undefined): HeadAssignment {
  const out: HeadAssignment = {};
  for (const line of LINES) {
    const choice = a?.[line.field];
    if (!choice) continue;
    if (!isMoved(line.field, a)) continue;
    out[line.field] = {
      head: choice.head,
      ...(String(choice.reason || '').trim() ? { reason: choice.reason } : {}),
    };
  }
  return out;
}

// ---------------------------------------------------------------------------
// RE-AGGREGATING THE STATEMENTS BY HEAD
// ---------------------------------------------------------------------------

/**
 * A copy of the payload with every move applied as a TRANSFER.
 *
 * For each moved line: its amount is subtracted from its own field and added to
 * the field the destination head drives. A head with no field of its own takes
 * the money out of the named lines and lets the engine's own residual close
 * over it, which is what keeps the reported column tied to the filing.
 *
 * WITH NO MOVES THIS IS THE IDENTITY, and so is a move to a line's own default
 * head, because the subtraction and the addition are the same amount on the
 * same field. The sweep proves the first; `verify/heads.mts` proves the second,
 * which is the one the obvious check cannot see.
 *
 * The filed anchors are never written — operating profit, pretax profit, net
 * income, total assets, total liabilities, and the filed subtotals the balance
 * sheet plugs from — so the reported columns stay the filing.
 */
export function applyHeads(fetched: any, assignment: HeadAssignment | undefined): any {
  if (!fetched || isEmpty(assignment)) return fetched;

  const rows: any[] = Array.isArray(fetched.statements) ? fetched.statements : [];
  const moved = LINES.filter((l) => isMoved(l.field, assignment));
  const residual = reconcilingLine(rows);

  const statements = rows.map((row, i) => {
    const next: any = { ...row };
    const add = (field: string, amount: number) => {
      next[field] = (num(next[field]) ?? 0) + amount;
    };

    for (const line of moved) {
      // The amount is read off the FILED row, not the running copy, so two
      // moves cannot read each other's half-applied arithmetic.
      const amount = line.derived ? residual[i] : num(row?.[line.field]);
      if (amount === null) continue;
      // Out of its own field. The reconciling line has none: it shrinks on its
      // own as soon as a named line grows.
      if (line.ownField) add(line.ownField, -amount);
      // And into the destination's, where it has one.
      const field = HEAD_BY_KEY[headOf(line.field, assignment)]?.field ?? null;
      if (field) add(field, amount);
    }
    return next;
  });

  // ---- what the engine needs to know about one-offs ----------------------
  //
  // One-offs is a head with no field, and the reconciling line would hand the
  // money straight back: it is defined as filed operating profit less the named
  // cost lines, so money taken out of SG&A reappears in it, pound for pound. So
  // the amounts are carried here and `deriveModel` takes them out of the
  // residual's FORECAST base. The reported years are untouched, which is what
  // keeps reported operating profit tied to the filing.
  const oneOffs = oneOffFields(assignment);
  const named = oneOffs.filter((f) => f !== RECONCILING_LINE);
  const heads = {
    /**
     * Per line, per year, for the bridge and the workbook to name. Aligned to
     * `fetched.statements`, which is the array both of those read.
     */
    oneOffs: Object.fromEntries(
      oneOffs.map((field) => [
        field,
        field === RECONCILING_LINE ? residual.slice() : rows.map((r) => num(r?.[field])),
      ])
    ) as Record<string, (number | null)[]>,
    /**
     * The named operating costs set aside, BY FISCAL YEAR. Subtracted from the
     * residual's forecast base, because the residual absorbed them.
     *
     * KEYED BY YEAR AND NOT BY INDEX, which is not fussiness. `deriveModel`
     * runs `selectComparablePeriods` first and DROPS any year that is not
     * comparable — a demerger, a restatement — so its row array is shorter than
     * this one and the indices do not line up. An index-aligned array would
     * have taken one year's one-off out of another year's base, silently, and
     * only on the companies that had a period set aside.
     */
    oneOffNamedCosts: Object.fromEntries(
      rows.map((row, i) => [
        String(row?.fiscalYear),
        named.reduce((sum, field) => sum + (num(rows[i]?.[field]) ?? 0), 0),
      ])
    ) as Record<string, number>,
    /**
     * True where the reconciling line ITSELF is set aside. Then the whole
     * residual leaves the forecast base and there is nothing left to subtract
     * from, so the base is nil rather than a difference.
     */
    oneOffReconcilingLine: oneOffs.includes(RECONCILING_LINE),
    assignment: pruneAssignment(assignment),
  };

  return { ...fetched, statements, heads };
}

// ---------------------------------------------------------------------------
// WHAT THE SCREEN SHOWS: THE SAME LINES, GROUPED BY HEAD
// ---------------------------------------------------------------------------

export interface HeadTotal {
  head: Head;
  lines: FiledLine[];
  /**
   * Per reported year. Components and anchors are excluded: a component's money
   * is in its parent, and an anchor is what the model ties itself to.
   */
  totals: (number | null)[];
  /** The filed anchors and subtotals shown under this head, never totalled. */
  anchors: FiledLine[];
}

export interface Grouped {
  years: string[];
  income: HeadTotal[];
  balance: HeadTotal[];
  /** Every filed anchor and subtotal, in statement order, for a band of its own. */
  anchors: FiledLine[];
  /** Filed operating profit, which never moves. */
  operatingProfitFiled: (number | null)[];
  /**
   * Filed operating profit with the one-offs set aside: the forecast base.
   * Shown BESIDE the filed figure, never instead of it.
   */
  operatingProfitUnderlying: (number | null)[];
  /** Filed less the sum of every operating head. Nil, or a line is double counted. */
  tie: (number | null)[];
}

export function groupByHead(statements: any[], assignment: HeadAssignment | undefined): Grouped {
  const rows = Array.isArray(statements) ? statements : [];
  const years = rows.map((r) => String(r?.fiscalYear));
  const lines = linesFor(rows);

  const build = (statement: Statement): HeadTotal[] =>
    HEADS.filter((h) => h.statement === statement).map((head) => {
      const under = lines.filter(
        (l) => l.statement === statement && headOf(l.field, assignment) === head.key
      );
      // THE ANCHORS COME OUT OF THE HEAD AND INTO A BAND OF THEIR OWN. They are
      // the figures the model ties itself to, not lines of the cost structure,
      // and summing them with the lines is a double count.
      const mine = under.filter((l) => !l.anchor);
      return {
        head,
        lines: mine,
        anchors: under.filter((l) => l.anchor),
        totals: years.map((_, i) => {
          let sum: number | null = null;
          for (const line of mine) {
            // A COMPONENT IS NOT ADDED EITHER. Share-based pay is inside the
            // filed SG&A, so totalling it with its parent would state a cost
            // the company never charged.
            if (line.componentOf) continue;
            const v = line.amounts[i];
            if (v === null) continue;
            sum = (sum ?? 0) + v;
          }
          return sum;
        }),
      };
    });

  const income = build('income');
  const balance = build('balance');
  const byKey = new Map(income.concat(balance).map((h) => [h.head.key, h]));
  const at = (key: HeadKey, i: number): number => byKey.get(key)?.totals[i] ?? 0;

  const filedOp = rows.map((r) => num(r?.operatingIncome));
  const operatingProfitUnderlying = filedOp.map((v, i) => (v === null ? null : v + at('oneOffs', i)));

  // Revenue less every operating cost head, against the filed figure. The
  // reconciling line is a head here, so this closes exactly for every
  // assignment — and anything other than nil means a line was counted twice or
  // dropped, which is the one thing a screen of sums must not do.
  const tie = filedOp.map((filed, i) => {
    if (filed === null) return null;
    const built =
      at('revenue', i) -
      at('cogs', i) -
      at('rnd', i) -
      at('sga', i) -
      at('da', i) -
      at('otherOperating', i) -
      at('oneOffs', i);
    return filed - built;
  });

  return {
    years,
    income,
    balance,
    anchors: lines.filter((l) => l.anchor),
    operatingProfitFiled: filedOp,
    operatingProfitUnderlying,
    tie,
  };
}

export default {
  HEADS,
  HEAD_BY_KEY,
  LINES,
  LINE_BY_FIELD,
  RECONCILING_LINE,
  dropTargets,
  linesFor,
  reconcilingLine,
  headOf,
  reasonOf,
  isMoved,
  movedFields,
  moveCount,
  isEmpty,
  movedLabels,
  oneOffFields,
  pruneAssignment,
  applyHeads,
  groupByHead,
};
