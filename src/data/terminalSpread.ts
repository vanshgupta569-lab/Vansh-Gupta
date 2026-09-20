// FILE: src/data/terminalSpread.ts
//
// Marginalia — the two terminal values, and what their disagreement means
//
// A discounted cash flow has to say what the business is worth after the
// forecast ends, and there are two ways to say it:
//
//   perpetuity growth   the last forecast cash flow, growing slowly forever,
//                       discounted at the cost of capital. Built from this
//                       company's own cash flows.
//   exit multiple       the last forecast EBITDA, valued at a multiple, as if
//                       the business were sold. Built from what the market
//                       pays for businesses like it.
//
// THEY ARE NOT AVERAGED.
//
// Averaging them produces a number that is neither method's answer and hides
// the one thing the disagreement is telling you. The site already refuses to
// blend the income, market and asset approaches for the same reason: they
// answer different questions and a reader is entitled to see both answers.
//
// What a wide gap means, in the two directions it can run:
//
//   exit multiple far ABOVE the perpetuity value
//       the multiple is pricing in growth, or a durability, that this
//       company's own forecast cash flows do not produce. Either the market
//       knows something the forecast does not, or the multiple is too generous
//       for this business.
//
//   exit multiple far BELOW the perpetuity value
//       the forecast cash flows are worth more than the market pays for
//       businesses like this one. Either the forecast is too generous, or the
//       peer multiple is pricing in a risk the cash flows do not show.
//
// The spread is measured against the SMALLER of the two, so it reads as "how
// much bigger is one than the other" and does not depend on which is chosen
// as the base.

const isNum = (v: any): v is number => typeof v === 'number' && isFinite(v);

/**
 * Materially apart. On the sweep of 2026-09-20 the median spread between the
 * two methods was 14.5%, so a quarter is comfortably beyond the ordinary
 * disagreement between them: 18 of 63 valued companies are past it, 8 are more
 * than half apart and 3 more than double.
 */
export const WIDE_SPREAD = 0.25;

export interface TerminalSpread {
  perpetuity: number;
  exitMultiple: number;
  /** The gap as a share of the smaller value. */
  spread: number;
  wide: boolean;
  /** Which method is the higher one, for the sentence. */
  higher: 'exit multiple' | 'perpetuity growth';
  /** Plain language, only worth showing when `wide`. */
  sentence: string;
}

export function terminalSpread(perpetuity: any, exitMultiple: any): TerminalSpread | null {
  if (!isNum(perpetuity) || !isNum(exitMultiple)) return null;
  if (perpetuity <= 0 || exitMultiple <= 0) return null;

  const spread = Math.abs(exitMultiple - perpetuity) / Math.min(exitMultiple, perpetuity);
  const exitIsHigher = exitMultiple > perpetuity;
  const pct = `${(spread * 100).toFixed(0)}%`;

  const sentence = exitIsHigher
    ? `The exit multiple is ${pct} above the perpetuity value. A multiple taken from what the market pays for ` +
      `similar businesses is worth more than this company's own forecast cash flows: either the multiple is ` +
      `pricing in growth the forecast does not produce, or the forecast is too conservative for what this ` +
      `business actually earns.`
    : `The perpetuity value is ${pct} above the exit multiple. This company's own forecast cash flows are worth ` +
      `more than the market pays for similar businesses: either the forecast is too generous, or the multiple ` +
      `is pricing in a risk the cash flows do not show.`;

  return {
    perpetuity,
    exitMultiple,
    spread,
    wide: spread > WIDE_SPREAD,
    higher: exitIsHigher ? 'exit multiple' : 'perpetuity growth',
    sentence,
  };
}

/**
 * Where one figure is genuinely needed — a screen across many companies, a
 * reverse DCF that solves for one input, a premium against the share price —
 * it is the PERPETUITY value, never an average.
 *
 * Not because it is more correct, but because it is the one built from this
 * company. The exit multiple is a flat 12x for every derived company, so a
 * figure resting on it would move with an assumption that is the same for a
 * software company and a steelmaker. Wherever this is used, the screen says
 * which method it is.
 */
export const SINGLE_FIGURE_METHOD = 'perpetuity growth';
