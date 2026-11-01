// FILE: src/data/figuresAge.ts
//
// HOW OLD THE FIGURES ON THE SCREEN ARE, in one place.
//
// Every screen on this site presents figures out of a filing and labels each
// one with the year it belongs to. That is honest about each figure and silent
// about the set: a reader looking at a correctly labelled FY2014 column has no
// way to tell whether 2014 is the latest year that exists or the latest year
// this site managed to read.
//
// `KI-32` is what that silence cost. Morgan Stanley and Wells Fargo stopped
// tagging `Revenues` and moved to `RevenuesNetOfInterestExpense`, which the
// year anchor did not read, so their models were built from the years that
// still carried the old tag — FY2014 and FY2019. Every figure on Morgan
// Stanley's page was correct about itself and eleven years out of date, and
// nothing on the screen said so. The tag is fixed; this is the guard that means
// the next one does not go unseen for as long.
//
// THE THRESHOLD IS EIGHTEEN MONTHS, and it is chosen rather than picked.
//
// An annual report is published months after the year it covers: a 10-K is due
// 60 to 90 days after the fiscal year end, and a 20-F up to four months after.
// So a company's latest annual figures are legitimately up to about a year old
// for most of the year, and a little over a year old in the weeks before its
// next report lands. Twelve months would therefore warn about companies that
// are entirely up to date. Eighteen months is past the point where the NEXT
// annual report should also have arrived, so a gap that wide means a year is
// missing rather than merely pending.
//
// It is measured from the END OF THE PERIOD, not from the filing date, because
// the question is how old the FIGURES are. A filing published yesterday about
// 2014 does not make 2014 recent.
//
// This is deliberately not a data constraint and not a refusal. The figures are
// real and worth showing; what the reader is owed is the date on them.

export const STALE_MONTHS = 18;

/**
 * Months are counted as CALENDAR months, not as 30.44-day averages.
 *
 * An average month makes the threshold fuzzy at exactly the point it has to be
 * sharp: eighteen average months is 547.92 days, so a set 548 days old is
 * "more than eighteen months" by four hundredths of a day, and no reader could
 * predict which side of the line any given date falls on. Eighteen calendar
 * months after 2 May 2025 is 2 November 2026, which is a date a person can
 * check.
 */
function addMonths(from: Date, n: number): Date {
  const out = new Date(from.getTime());
  const day = out.getUTCDate();
  out.setUTCMonth(out.getUTCMonth() + n);
  // 31 January plus one month is 28 or 29 February, not 2 or 3 March.
  if (out.getUTCDate() < day) out.setUTCDate(0);
  return out;
}

/** Whole calendar months from `a` to `b`, never counting a part month. */
function wholeMonthsBetween(a: Date, b: Date): number {
  let n = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (addMonths(a, n).getTime() > b.getTime()) n -= 1;
  return n;
}

export interface FiguresAge {
  /** The latest fiscal year the statements carry, e.g. 2014. */
  latestFiscalYear: number | null;
  /** The day that year ended, where the filing says. */
  latestPeriodEnd: string | null;
  /** Whole months between that day and today. */
  monthsBehind: number | null;
  /** True where the figures are more than `STALE_MONTHS` behind. */
  stale: boolean;
  /** The words a screen puts on it: `Latest figures: FY2014`. */
  label: string | null;
  /** One plain sentence saying what is wrong, for a title or a panel. */
  detail: string | null;
}

const NOTHING: FiguresAge = {
  latestFiscalYear: null,
  latestPeriodEnd: null,
  monthsBehind: null,
  stale: false,
  label: null,
  detail: null,
};

/**
 * How far behind a payload's statements are.
 *
 * `today` is a parameter so a check can ask the question on a fixed day rather
 * than on the day the check happens to run — a threshold tested against
 * `Date.now()` is a test that changes its own answer over time.
 */
export function figuresAge(payload: any, today: Date = new Date()): FiguresAge {
  const rows = Array.isArray(payload?.statements) ? payload.statements : [];
  if (!rows.length) return NOTHING;

  // The last row with a fiscal year, which is the newest: the data layer
  // returns them oldest first.
  const last = [...rows].reverse().find((r: any) => Number.isFinite(Number(r?.fiscalYear)));
  if (!last) return NOTHING;

  const latestFiscalYear = Number(last.fiscalYear);
  // A period end where the filing gave one. Where it did not, the year end is
  // not assumed to be 31 December — that assumption is its own defect, already
  // written up in METHODOLOGY — so the age is taken from the last day of the
  // fiscal year instead, which is the latest it could be and so the kindest
  // reading available.
  const latestPeriodEnd = typeof last.periodEnd === 'string' ? last.periodEnd : null;
  const asAt = latestPeriodEnd ? Date.parse(latestPeriodEnd) : Date.parse(`${latestFiscalYear}-12-31`);
  if (!Number.isFinite(asAt)) return { ...NOTHING, latestFiscalYear, latestPeriodEnd };

  const monthsBehind = wholeMonthsBetween(new Date(asAt), today);
  const stale = monthsBehind > STALE_MONTHS;
  const label = `Latest figures: FY${latestFiscalYear}`;
  if (!stale) {
    return { latestFiscalYear, latestPeriodEnd, monthsBehind, stale: false, label, detail: null };
  }

  const years = Math.floor(monthsBehind / 12);
  const howLong =
    years >= 2 ? `${years} years` : monthsBehind >= 12 ? 'over a year' : `${monthsBehind} months`;
  return {
    latestFiscalYear,
    latestPeriodEnd,
    monthsBehind,
    stale: true,
    label,
    detail:
      `The newest figures this site can read for this company are for FY${latestFiscalYear}` +
      `${latestPeriodEnd ? `, ended ${latestPeriodEnd}` : ''} — ${howLong} old. Every figure below is ` +
      'labelled with the year it belongs to and is correct for that year, but a more recent year almost ' +
      'certainly exists and is not here. Treat the figures as history rather than as current.',
  };
}
