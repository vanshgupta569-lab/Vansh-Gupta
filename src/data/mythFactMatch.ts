// FILE: src/data/mythFactMatch.ts
//
// WHICH MYTH-VERSUS-FACT CARD THIS COMPANY'S OWN FIGURES EARN.
//
// Each of the sixty cards in `mythFactCards.ts` carries a "Show when" sentence
// written in English. This file carries the predicate behind each one, over the
// company's FILED statements and nothing else — not the model, not the
// forecast, not a judgement the reader has made. A card is shown because the
// filing says so.
//
// THREE ANSWERS, NOT TWO. A condition returns true, false, or **null meaning it
// cannot be established from what the source gives us**. Null is not false and
// is never treated as it: a company that does not report its lease liabilities
// has not reported lease liabilities of zero (`CLAUDE.md`, standing decision
// 3). A null condition makes the card ineligible, so a reader is never shown a
// card whose claim about their company we cannot support.
//
// ELEVEN OF THE SIXTY CANNOT BE EVALUATED AT ALL from either source, because
// they rest on lines neither the SEC's XBRL nor the vendor feed returns: cash
// interest paid, cash taxes paid, cash paid for acquisitions, deferred revenue,
// impairment charges, and the five bank lines (deposits, gross loans, interest
// income, non-interest income, provisions for credit losses). Each says so by
// name below rather than silently never firing, and `DATA_CONSTRAINTS.md`
// carries the list. They are kept in the data because the CSV is the copy of
// record and because the primary-filings layer will reach most of them
// (`docs/DATA_LAYER_PLAN.md`).
//
// WHERE THE CSV'S ENGLISH LEAVES A DEFINITION OPEN, this file closes it in one
// place and says so in a comment — "other operating current liabilities",
// return on invested capital, net debt, days payable. The reader is shown the
// CSV's sentence, so the two must mean the same thing; a definition invented at
// the point of use in three predicates would not.

import { MYTH_FACT_CARDS, type MythFactCard } from './mythFactCards';
import { isFinancialCompany } from './residualIncome.js';

const isNum = (v: unknown): v is number => typeof v === 'number' && isFinite(v);

/** null in, null out — the rule the whole file runs on. */
const div = (a: number | null, b: number | null): number | null =>
  isNum(a) && isNum(b) && b !== 0 ? a / b : null;
const sub = (a: number | null, b: number | null): number | null => (isNum(a) && isNum(b) ? a - b : null);
const add = (a: number | null, b: number | null): number | null => (isNum(a) && isNum(b) ? a + b : null);

export type Verdict = boolean | null;

/** true only when both are known and both hold. */
const both = (a: Verdict, b: Verdict): Verdict => (a === null || b === null ? null : a && b);
/** Comparison that refuses rather than guessing. */
const gt = (a: number | null, b: number | null): Verdict => (isNum(a) && isNum(b) ? a > b : null);
const lt = (a: number | null, b: number | null): Verdict => (isNum(a) && isNum(b) ? a < b : null);

/**
 * The filed rows, oldest first, with the derived quantities the conditions
 * share. Everything is per year and everything may be null.
 */
export class Figures {
  readonly rows: any[];

  constructor(statements: any[]) {
    this.rows = Array.isArray(statements) ? statements : [];
  }

  get years(): number {
    return this.rows.length;
  }

  /** A filed field, `back` years from the latest. */
  f(field: string, back = 0): number | null {
    const row = this.rows[this.rows.length - 1 - back];
    const v = row?.[field];
    return isNum(v) ? v : null;
  }

  /** A derived quantity, `back` years from the latest. */
  d(what: (back: number) => number | null, back = 0): number | null {
    return what(back);
  }

  // ---- the definitions the CSV's English leaves open ---------------------

  /**
   * OTHER OPERATING CURRENT LIABILITIES = current liabilities, less payables,
   * less the current portion of debt. Debt is financing rather than operating,
   * which is the whole point of the distinction card 1 is about; leaving it in
   * would make operating working capital negative for any company with a
   * revolver drawn at the year end.
   */
  otherOperatingCurrentLiabilities(back = 0): number | null {
    const current = this.f('currentLiabilities', back);
    const payables = this.f('payables', back);
    const debt = this.f('currentDebtAndLease', back) ?? this.f('currentDebt', back) ?? 0;
    return isNum(current) && isNum(payables) ? current - payables - debt : null;
  }

  /** Receivables + inventory − payables − other operating current liabilities. */
  operatingWorkingCapital(back = 0): number | null {
    const r = this.f('receivables', back);
    const i = this.f('inventory', back);
    const p = this.f('payables', back);
    const o = this.otherOperatingCurrentLiabilities(back);
    return isNum(r) && isNum(i) && isNum(p) && isNum(o) ? r + i - p - o : null;
  }

  /** Operating profit plus the depreciation and amortisation in it. */
  ebitda(back = 0): number | null {
    return add(this.f('operatingIncome', back), this.f('depreciation', back));
  }

  /** Operating cash flow less capital expenditure, both as filed. */
  freeCashFlow(back = 0): number | null {
    return sub(this.f('operatingCashFlow', back), this.f('capex', back));
  }

  /**
   * TOTAL DEBT, including leases where the filing separates them. The same
   * order the engine's own equity bridge uses: the filed total if there is one,
   * otherwise long-term plus current, each including its lease portion.
   */
  totalDebt(back = 0): number | null {
    const filed = this.f('totalDebtReported', back);
    if (isNum(filed)) return filed;
    const long = this.f('longTermDebtAndLease', back) ?? this.f('longTermDebt', back);
    const short = this.f('currentDebtAndLease', back) ?? this.f('currentDebt', back);
    if (!isNum(long) && !isNum(short)) return null;
    return (isNum(long) ? long : 0) + (isNum(short) ? short : 0);
  }

  /** Cash and the short-term securities held with it. */
  cashAndSecurities(back = 0): number | null {
    return this.f('cashAndShortTermInvestments', back) ?? this.f('cash', back);
  }

  netDebt(back = 0): number | null {
    return sub(this.totalDebt(back), this.cashAndSecurities(back));
  }

  /** Operating profit over interest expense. */
  interestCover(back = 0): number | null {
    return div(this.f('operatingIncome', back), this.f('interestExpense', back));
  }

  margin(line: string, back = 0): number | null {
    return div(this.f(line, back), this.f('revenue', back));
  }

  grossMargin(back = 0): number | null {
    const rev = this.f('revenue', back);
    const cogs = this.f('cogs', back);
    return isNum(rev) && isNum(cogs) && rev !== 0 ? (rev - cogs) / rev : null;
  }

  /** Days a company takes to pay, on the cost of sales it is paying for. */
  daysPayable(back = 0): number | null {
    const ratio = div(this.f('payables', back), this.f('cogs', back));
    return ratio === null ? null : ratio * 365;
  }

  /**
   * RETURN ON INVESTED CAPITAL = operating profit after the company's own tax
   * rate, over equity plus debt less cash. The after-tax step matters: card 36
   * is about returns falling while revenue grows, and a pre-tax figure would
   * move with the tax rate instead.
   */
  roic(back = 0): number | null {
    const ebit = this.f('operatingIncome', back);
    const taxRate = div(this.f('taxExpense', back), this.f('pretaxIncome', back));
    const invested = sub(add(this.f('equity', back), this.totalDebt(back)), this.cashAndSecurities(back));
    if (!isNum(ebit) || !isNum(taxRate) || !isNum(invested) || invested <= 0) return null;
    return (ebit * (1 - taxRate)) / invested;
  }

  /** The year-on-year change in a filed line, as a fraction. */
  growth(field: string, back = 0): number | null {
    const now = this.f(field, back);
    const then = this.f(field, back + 1);
    return isNum(now) && isNum(then) && then !== 0 ? now / then - 1 : null;
  }

  /** The change in a derived quantity, as a fraction. */
  growthOf(what: (back: number) => number | null, back = 0): number | null {
    const now = what(back);
    const then = what(back + 1);
    return isNum(now) && isNum(then) && then !== 0 ? now / then - 1 : null;
  }

  /**
   * A test that must hold in each of the last `n` years.
   *
   * NULL IF ANY YEAR CANNOT BE JUDGED, which is what makes this different from
   * "it held in the years we could see". A run of three that rests on two
   * measurements and a gap is not a run of three.
   */
  forYears(n: number, test: (back: number) => Verdict): Verdict {
    let known = true;
    for (let back = 0; back < n; back++) {
      const v = test(back);
      if (v === null) known = false;
      else if (v === false) return false;
    }
    return known ? true : null;
  }
}

/** A condition that rests on a line neither source returns. */
const notFiled = (what: string) => {
  const f = (): Verdict => null;
  (f as any).missing = what;
  return f;
};

/**
 * The sixty predicates, by card ID, each against the CSV's own sentence.
 *
 * Read them beside `mythFactCards.ts`: the sentence the reader is shown and the
 * test that decides it have to say the same thing, and the check in
 * `npm run verify` is what holds them together where it can.
 */
export const CONDITIONS: Record<number, (g: Figures) => Verdict> = {
  // ---- working capital ---------------------------------------------------
  1: (g) => lt(g.operatingWorkingCapital(), 0),
  2: (g) => gt(g.cashAndSecurities(), div(g.f('currentAssets'), 4)),
  3: (g) =>
    both(
      gt(div(g.f('currentAssets'), g.f('currentLiabilities')), 1),
      lt(div(sub(g.f('currentAssets'), g.f('inventory')), g.f('currentLiabilities')), 0.7)
    ),
  4: (g) => g.forYears(2, (b) => gt(g.growth('inventory', b), g.growth('cogs', b))),
  5: (g) => g.forYears(2, (b) => gt(g.growth('receivables', b), g.growth('revenue', b))),
  6: (g) => g.forYears(3, (b) => gt(g.daysPayable(b), g.daysPayable(b + 1))),
  7: (g) =>
    both(
      gt(g.growth('revenue'), 0.15),
      gt(sub(g.operatingWorkingCapital(0), g.operatingWorkingCapital(1)), 0)
    ),
  8: () => true, // "Any company"

  // ---- cash flow ---------------------------------------------------------
  9: (g) => both(gt(g.f('netIncome'), 0), lt(g.f('operatingCashFlow'), 0)),
  10: (g) => lt(g.f('operatingCashFlow'), div(g.ebitda(), 2)),
  11: (g) => gt(g.f('depreciation'), div(g.f('revenue'), 12.5)), // > 8% of revenue
  12: (g) =>
    both(
      both(gt(g.f('operatingCashFlow'), 0), lt(g.freeCashFlow(), 0)),
      gt(g.f('capex'), g.f('depreciation'))
    ),
  13: (g) => g.forYears(3, (b) => gt(g.f('capex', b), g.f('depreciation', b))),
  14: (g) =>
    both(
      g.forYears(3, (b) => gt(g.freeCashFlow(b), g.f('netIncome', b))),
      lt(g.f('capex'), g.f('depreciation'))
    ),

  // ---- debt --------------------------------------------------------------
  15: (g) => both(gt(g.totalDebt(), 0), gt(g.interestCover(), 5)),
  16: (g) => both(gt(g.totalDebt(), 0), gt(g.cashAndSecurities(), div(g.totalDebt(), 2))),
  17: (g) => both(lt(div(g.totalDebt(), g.f('equity')), 0.5), lt(g.interestCover(), 3)),
  18: (g) => lt(g.freeCashFlow(), g.f('currentDebtAndLease') ?? g.f('currentDebt')),
  19: (g) => gt(g.f('leaseObligations'), div(g.totalDebt(), 5)),
  20: (g) => both(gt(g.interestCover(), 1), lt(g.interestCover(), 2)),
  21: notFiled('cash interest paid, which neither source returns as its own line'),

  // ---- profitability -----------------------------------------------------
  22: (g) => both(gt(g.growth('revenue'), 0), lt(g.margin('operatingIncome', 0), g.margin('operatingIncome', 1))),
  23: (g) => {
    const gap = sub(g.margin('pretaxIncome'), g.margin('operatingIncome'));
    return gap === null ? null : Math.abs(gap) > 0.05;
  },
  24: (g) =>
    both(
      lt(g.margin('netIncome'), 0.05),
      gt(div(g.f('revenue'), div(add(g.f('totalAssets', 0), g.f('totalAssets', 1)), 2)), 2)
    ),
  25: (g) =>
    both(gt(div(g.f('netIncome'), g.f('equity')), 0.2), gt(div(g.f('totalAssets'), g.f('equity')), 3)),
  26: (g) => {
    // NON-OPERATING AND ONE-OFF ITEMS, as the filing leaves them: what stands
    // between operating profit after interest and the pre-tax figure.
    const operatingAfterInterest = sub(g.f('operatingIncome'), g.f('interestExpense'));
    const other = sub(g.f('pretaxIncome'), operatingAfterInterest);
    const pretax = g.f('pretaxIncome');
    return isNum(other) && isNum(pretax) && pretax !== 0 ? Math.abs(other) > Math.abs(pretax) * 0.1 : null;
  },
  27: (g) => both(gt(g.grossMargin(), 0.5), lt(g.margin('operatingIncome'), 0.1)),
  28: (g) => gt(g.netDebt(), div(g.f('totalAssets'), 5)),
  // CASH AND THE SECURITIES HELD WITH IT, not plus long-term investments.
  // Written the other way it read `longTermInvestments ?? 0`, so a company
  // that files no such line was treated as holding none of them — and the
  // engine does not count them either: a holding placed out of reach for a
  // year is not money a lender can be paid with tomorrow (METHODOLOGY S15).
  29: (g) => gt(g.cashAndSecurities(), g.totalDebt()),
  30: () => true, // "Any company"
  31: (g) => gt(g.f('ppeNet'), div(g.f('totalAssets'), 2)),
  32: (g) => gt(g.f('capex'), div(g.f('revenue'), 6.667)), // > 15% of revenue
  33: (g) => {
    const net = g.f('netIncome');
    const rev = g.f('revenue');
    if (!isNum(net)) return null;
    if (net <= 0) return true;
    return isNum(rev) && rev !== 0 ? net < rev * 0.02 : null;
  },
  34: (g) => gt(div(g.totalDebt(), g.f('equity')), 1),
  35: (g) => g.forYears(3, (b) => lt(g.freeCashFlow(b), 0)),

  // ---- growth ------------------------------------------------------------
  36: (g) =>
    both(
      gt(g.growth('revenue'), 0.15),
      g.forYears(2, (b) => lt(g.roic(b), g.roic(b + 1)))
    ),
  37: (g) => both(gt(g.growth('revenue'), 0.2), lt(g.freeCashFlow(), 0)),
  38: notFiled('cash paid for acquisitions, which neither source returns as its own line'),
  39: (g) => g.forYears(3, (b) => lt(g.growth('revenue', b), g.growth('revenue', b + 1))),
  40: (g) => both(lt(g.growth('revenue'), 0), gt(g.margin('operatingIncome', 0), g.margin('operatingIncome', 1))),

  // ---- dividends ---------------------------------------------------------
  41: (g) => gt(g.f('commonDividendsPaid') ?? g.f('dividendsPaid'), div(g.f('netIncome'), 1.25)), // > 80%
  42: (g) => gt(g.f('commonDividendsPaid') ?? g.f('dividendsPaid'), g.freeCashFlow()),
  43: (g) => {
    const divs = (b: number) => g.f('commonDividendsPaid', b) ?? g.f('dividendsPaid', b);
    const fell = lt(divs(0), divs(1));
    // "capex or debt repayment up": more spent on plant, or less debt owed.
    const capexUp = gt(g.f('capex', 0), g.f('capex', 1));
    const debtDown = lt(g.totalDebt(0), g.totalDebt(1));
    if (fell === null) return null;
    if (fell === false) return false;
    if (capexUp === true || debtDown === true) return true;
    return capexUp === null || debtDown === null ? null : false;
  },
  44: (g) => {
    const divs = g.f('commonDividendsPaid') ?? g.f('dividendsPaid');
    // A REPORTED NIL, not an absent line. `f` already returns null for absent.
    return isNum(divs) ? both(divs === 0, gt(g.f('netIncome'), 0)) : null;
  },
  45: (g) => both(gt(g.f('commonDividendsPaid') ?? g.f('dividendsPaid'), 0), gt(g.f('buybacks'), 0)),
  46: (g) => {
    const change = g.growth('dilutedShares');
    return both(gt(g.f('buybacks'), 0), change === null ? null : Math.abs(change) <= 0.01);
  },

  // ---- accounting --------------------------------------------------------
  47: () => true, // "Any company"
  48: (g) => gt(g.f('goodwill'), div(g.f('totalAssets'), 5)),
  49: (g) => gt(g.f('stockComp'), div(g.f('revenue'), 20)),
  50: notFiled('deferred revenue, which neither source returns as its own line'),
  51: notFiled('impairment charges, which neither source returns as their own line'),
  52: (g) => gt(g.f('inventory'), div(g.f('totalAssets'), 5)),
  53: (g) => gt(g.f('rnd'), div(g.f('revenue'), 12.5)), // > 8% of revenue
  54: notFiled('cash taxes paid, which neither source returns as its own line'),

  // ---- banks -------------------------------------------------------------
  // The bank lines are not in either source's schema. The primary-filings
  // layer reads them for India (`docs/DATA_LAYER_PLAN.md` §2), which is what
  // turns these six on.
  55: notFiled('customer deposits, which neither source returns as their own line'),
  56: notFiled('interest and non-interest income, which neither source separates'),
  57: notFiled('gross loans, which neither source returns as their own line'),
  58: notFiled('loans and deposits, which neither source returns as their own lines'),
  59: notFiled('provisions for credit losses, which neither source returns as their own line'),
  60: notFiled('interest income, which neither source returns as its own line'),
};

/** Why a card can never fire, where that is a fact about the source. */
export function cannotBeEstablished(id: number): string | null {
  return (CONDITIONS[id] as any)?.missing ?? null;
}

/** The CSV's own wording for a condition that is simply that a company exists. */
const FLOOR = 'any company';

export interface MythFactChoice {
  card: MythFactCard;
  /** True when the card was chosen because this company's figures earned it. */
  matched: boolean;
  /** How many cards were eligible, for the suite to measure rather than guess. */
  eligible: number;
}

/** Does this card's audience include this company? */
function audienceFits(card: MythFactCard, bank: boolean): boolean {
  if (card.appliesTo === 'All companies') return true;
  return card.appliesTo === (bank ? 'Banks only' : 'Non-banks only');
}

/**
 * The card this company's filed figures earn, or an "All companies" card.
 *
 * `seed` makes the choice repeatable: the suite passes one so a measurement is
 * a measurement, and the screen passes the clock so two visits to the same
 * company are not the same card for ever.
 *
 * NEVER A CARD THAT DOES NOT FIT. A card is eligible only when its audience
 * includes this company AND its condition is true on the filed figures — not
 * unknown, not false. When nothing is eligible, the fallback is drawn from the
 * cards whose condition is "Any company", which are true for every company by
 * construction, so the floor is still a card that fits.
 */
export function pickMythFactCard(payload: any, seed = Date.now()): MythFactChoice | null {
  const bank = isFinancialCompany(payload);
  const figures = new Figures(payload?.statements);
  const audience = MYTH_FACT_CARDS.filter((card) => audienceFits(card, bank));

  // THE CARDS WHOSE CONDITION IS THAT THERE IS A COMPANY are the floor, not
  // a match. Three of the sixty say "Any company", and counting them as
  // earned would make every company look like it had earned something — the
  // measurement would read 175 of 175 matched and mean nothing.
  const isFloor = (card: MythFactCard) => card.showWhen.trim().toLowerCase() === FLOOR;
  const holds = (card: MythFactCard) => {
    const condition = CONDITIONS[card.id];
    if (!condition) return false;
    try {
      return condition(figures) === true;
    } catch {
      return false;
    }
  };

  const earned = audience.filter((card) => !isFloor(card) && holds(card));
  const anyCompany = audience.filter(isFloor);
  const pool = earned.length ? earned : anyCompany;
  if (!pool.length) return null;

  const pick = pool[Math.abs(Math.floor(seed / 1000)) % pool.length];
  return { card: pick, matched: earned.length > 0, eligible: earned.length };
}

export default { CONDITIONS, Figures, pickMythFactCard, cannotBeEstablished };
