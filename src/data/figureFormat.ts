// FILE: src/data/figureFormat.ts
//
// HOW A FIGURE IS PRINTED, in one place, because two screens print the same
// figures and a second copy of a rule goes stale (`CLAUDE.md`, "two copies of
// a positional layout"). The Financials tab (`src/data/financials.ts`) and the
// figures screen (`src/components/figuresEditor.tsx`) both read from here, and
// `verify/scenarios.mts` checks the rules against it rather than against a
// screenshot.
//
// THE RULES, from `docs/VISUAL_SYSTEM.md` finding 1 (severity H, "breaks a
// stated rule or hurts data trust"), as Nihar settled them on 2026-10-30:
//
//   1. ONE DECIMAL RULE PER ROW, and a figure in millions has none. The
//      figures screen used to choose the decimals from the magnitude — two
//      below a hundred, one below ten thousand, none above — so one row of
//      cost of sales printed 9,439.0, then 11,618, then 16,621. Two things go
//      wrong. In a right-aligned tabular column a trailing ".0" pushes the
//      integer part left by its own width, so the digits a reader compares
//      down a column stop lining up with each other and with the column head.
//      And the decimal claims a precision the filing has not got: a figure
//      reported in millions is not reported to the nearest hundred thousand.
//   2. ONE RIGHT EDGE, shared with the column header. That is the table's to
//      keep, not this file's — but it only holds once rule 1 does, because the
//      ".0" was what broke it.
//   3. ZERO IS 0. A company that reported nil reported something.
//   4. NOT REPORTED IS AN EM DASH. The filing not saying something and the
//      filing saying nothing are different facts (standing decision 3: missing
//      data is never treated as zero).
//   5. A NEGATIVE CARRIES A MINUS SIGN, U+2212, and never the hyphen-minus
//      `toLocaleString` would give it. A hyphen is a narrower glyph than a
//      digit even in a tabular font, so a column of negatives drifts; and it
//      is not a minus sign.
//
// A VALUE PER SHARE IS NOT A FIGURE IN MILLIONS. It is a price, and two
// decimals are its precision, so it has its own function. Rule 1 is per row,
// and this is a different row.

/** U+2212. Not a hyphen. */
export const MINUS = '−';

/** The em dash every absent figure prints as. */
export const NOT_REPORTED = '—';

const isNum = (v: unknown): v is number => typeof v === 'number' && isFinite(v);

const body = (abs: number, dp: number, locale: string): string =>
  abs.toLocaleString(locale, { minimumFractionDigits: dp, maximumFractionDigits: dp });

/**
 * Rounds first and reads the sign afterwards, so a figure that rounds to
 * nought prints as `0` and never as `−0`.
 */
function signed(v: number, dp: number, locale: string): string {
  const factor = 10 ** dp;
  const r = Math.round(v * factor) / factor;
  return `${r < 0 ? MINUS : ''}${body(Math.abs(r), dp, locale)}`;
}

/** A figure in millions: no decimals, rules 1, 3 and 5. */
export function inMillions(v: unknown, locale = 'en-US'): string {
  return isNum(v) ? signed(v, 0, locale) : NOT_REPORTED;
}

/** A share count: a whole count, same rules. */
export function asCount(v: unknown, locale = 'en-US'): string {
  return isNum(v) ? signed(v, 0, locale) : NOT_REPORTED;
}

/** A value per share: a price, so two decimals. */
export function asPerShare(v: unknown, locale = 'en-US'): string {
  return isNum(v) ? signed(v, 2, locale) : NOT_REPORTED;
}

/** A rate or a margin: one decimal and a per-cent sign. */
export function asPercent(v: unknown, locale = 'en-US'): string {
  return isNum(v) ? `${signed(v * 100, 1, locale)}%` : NOT_REPORTED;
}

/**
 * A MULTIPLE, SIGNED, WITH ONE DECIMAL RULE FOR THE WHOLE ROW.
 *
 * `docs/STUDIO_SPEC_ADDENDUM.md` G10: the ratios table read `0.8x`, `1.09x`,
 * `0.03x`, `0x net cash`, `0.02x net cash` — mixed decimals inside one row, and
 * some cells saying "net cash" in words while others printed a bare ratio, so
 * THE SIGN WAS UNCLEAR. A reader could not tell `0.02x net cash` from `0.02x`
 * without reading the words, and the words were only on some of them.
 *
 * One rule instead: two decimals on every cell of the row, a real minus sign
 * (U+2212) where net debt is negative, and the multiplication sign (U+00D7)
 * rather than a lower-case `x`. Net cash is then simply a negative multiple,
 * which is what it is.
 */
export function asMultiple(value: number | null | undefined, dp = 2): string {
  if (typeof value !== 'number' || !isFinite(value)) return NOT_REPORTED;
  const rounded = Math.abs(value).toFixed(dp);
  // −0.00× is not a sign, it is rounding. A value that rounds to nothing takes
  // no sign at all.
  const signed = Number(rounded) === 0 ? '' : value < 0 ? MINUS : '';
  return `${signed}${rounded}×`;
}
