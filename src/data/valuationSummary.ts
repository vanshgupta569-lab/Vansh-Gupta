// FILE: src/data/valuationSummary.ts
//
// EVERY FIGURE THE VALUATION SCREEN PRINTS ABOUT THE VALUE, IN ONE PURE
// FUNCTION, STRUCK AT ONE PRICE.
//
// Build step 5 job B1 (`docs/STEP5_BUILD_PLAN.md`), which is also job 1 of
// `docs/TEARSHEET_SPEC.md` — one job, not two, because a tearsheet that
// recomputed these would be a second answer nobody compares with the first.
//
// ---------------------------------------------------------------------------
// WHY IT TAKES THE PRICE AS AN ARGUMENT
// ---------------------------------------------------------------------------
//
// **The share price is a valuation input.** The cost of capital weights equity
// at market capitalisation, so the price moves the WACC, which moves every
// value per share on the screen (`CLAUDE.md`: "anything that reproduces a
// valuation has to carry the price it was struck against").
//
// So there was one defect behind five figures (`docs/STUDIO_SPEC.md` conflict
// 4, severity H — *hurts data trust*). The screen held TWO prices: the stored
// one the record carries, and a live quote fetched a moment after the page
// loaded. The bands, the premiums, the reverse DCF and the football field were
// struck at the live quote; the sensitivity shading and the upside figure were
// measured against the stored one. **A premium could be measured against a
// price the value was not computed at**, and nothing on the screen said which
// price anything used.
//
// Decision S3, approved by Nihar on 4 November 2026: **one price per
// valuation — the price the model was struck at.** A newer quote is shown
// beside it as a fact, with a `Rebuild at the latest price` action, and is
// never silently swapped in. This function takes that one price and every
// figure it returns is struck at it.
import type { ValuationDrivers } from '../types';
import { valuationBandsWithRefusal } from './companies';
import { terminalSpread } from './terminalSpread';
import { MEASURE_SHORT_NAMES } from './assetApproach';

const isNum = (v: any): v is number => typeof v === 'number' && isFinite(v);

export interface ValuationBandOut {
  label: string;
  low: number;
  high: number;
  point: number | null;
  detail?: string;
}

export interface FieldBandOut extends ValuationBandOut {
  variant: 'income' | 'market' | 'asset';
}

/**
 * AN APPROACH THAT WAS TRIED AND REFUSED (job B4).
 *
 * Rule 6: a refused approach is a ROW carrying the engine's plain-English
 * sentence, not a blank and not a missing row. A missing row is the worse of
 * the two, because the page then shows two approaches agreeing and says
 * nothing about the third that could not be built at all.
 */
export interface RefusedApproach {
  variant: 'income' | 'market' | 'asset';
  label: string;
  /** The engine's own words. Never written here. */
  reason: string;
}

export interface ApproachesOut {
  /** Always three: income, market, asset. Every one of them is attempted. */
  attempted: number;
  shown: number;
  refused: RefusedApproach[];
  /** Rule 8, fixed wording. */
  caption: string;
  /**
   * Rule 7: the neutral sentence, present only where no two of the shown
   * approaches' ranges intersect, and null otherwise — including where fewer
   * than two approaches are shown, since one range cannot fail to overlap.
   */
  overlapNote: string | null;
}

/** Rule 8. One string, so the page and the export cannot word it differently. */
export const SIDE_BY_SIDE_CAPTION = 'Shown side by side; not combined.';

/** Rule 7. */
export const NO_OVERLAP_NOTE = 'The ranges do not overlap.';

export interface ValuationSummary {
  /** The one price every figure below was struck at. */
  struckPrice: number | null;
  /** The DCF's own bands, as the sensitivity grid already widens them. */
  bands: ValuationBandOut[];
  /** The two terminal answers, never averaged, and the gap between them. */
  terminalMethods: {
    perpetuity: number | null;
    exit: number | null;
    split: ReturnType<typeof terminalSpread>;
  };
  /**
   * Price against each method, in per cent of the method's own value. Positive
   * where the market is ABOVE the model.
   */
  premiumAgainst: { perpetuity: number | null; exit: number | null };
  /** Every approach as a bar for the football field, income first. */
  fieldBands: FieldBandOut[];
  /** Rules 6 to 8: what was attempted, what was refused, and the two captions. */
  approaches: ApproachesOut;
}

/**
 * The premium of a price over a value, as a percentage of the value.
 *
 * One definition, used by every premium on the screen. It was written out four
 * times in the component — twice as `(price − value) / value` and twice as
 * `price / value − 1`, which are the same arithmetic written two ways, and a
 * fifth copy would eventually have been written the other way round.
 */
export function premiumOf(price: number | null | undefined, value: number | null | undefined): number | null {
  if (!isNum(price) || !isNum(value) || value <= 0) return null;
  return Number((((price - value) / value) * 100).toFixed(1));
}

/**
 * WHETHER A PAIR OF SENSITIVITY INPUTS HAS AN ANSWER AT ALL.
 *
 * A perpetuity needs the discount rate ABOVE the growth rate: at or below it
 * `(1 + g) / (wacc − g)` diverges, and what comes back is not a large value but
 * no value. A negative discount rate is not a discount rate.
 *
 * Lives here, with one caller on the screen and one in `verify/`, because the
 * grid's own cells and the words the screen prints over them have to agree
 * about which pairs those are (`docs/STUDIO_SPEC.md` §4.5). Both percentages,
 * as the axes print them.
 */
export function admissibleInputs(waccPct: number, growthPct: number): boolean {
  return (
    isNum(waccPct) && isNum(growthPct) && waccPct > 0 && growthPct < waccPct
  );
}

/**
 * THE WHOLE SUMMARY, from the source, the reader's drivers, the other two
 * approaches and the struck price.
 *
 * Pure: no React, no fetch, no clock. The dashboard reads it, the tearsheet
 * reads it, and `verify/` can call it over the payload set.
 */
export function valuationSummary(
  source: any,
  drivers: ValuationDrivers,
  struckPrice: number | null,
  market?: any,
  asset?: any
): ValuationSummary {
  const price = isNum(struckPrice) && struckPrice > 0 ? struckPrice : null;

  const built = source
    ? valuationBandsWithRefusal(source, drivers, price)
    : {
        bands: [],
        refusal: {
          code: null,
          message: 'There is no model for this company, so no income approach was attempted.',
        },
      };
  const bands: ValuationBandOut[] = built.bands as any[];

  // THE HEADLINE IS TWO NUMBERS, NOT ONE.
  //
  // A discounted cash flow ends with two answers: the perpetuity value, built
  // from this company's own cash flows, and the exit multiple, built from what
  // the market pays for businesses like it. They used to be averaged into a
  // single headline, which produced a figure that is neither method's answer
  // and buried the disagreement — the most useful thing on the page. A company
  // whose methods land 128% apart (BP) is a different proposition from one
  // where they agree to within 5%.
  const find = (needle: string): number | null => {
    const band = bands.find(
      (b) =>
        isNum(b.point) && (b.point as number) > 0 && String(b.label).toLowerCase().includes(needle)
    );
    return band && isNum(band.point) ? (band.point as number) : null;
  };
  const perpetuity = find('perpetuity');
  const exit = find('exit');
  const terminalMethods = { perpetuity, exit, split: terminalSpread(perpetuity, exit) };

  const premiumAgainst = {
    perpetuity: premiumOf(price, perpetuity),
    exit: premiumOf(price, exit),
  };

  // THE CHART SHOWS MORE THAN THE HEADLINE DOES. The market approach is a bar
  // on the football field and is deliberately NOT folded into the headline: a
  // discounted cash flow and a peer multiple answer different questions, and
  // averaging them would produce a number that means neither (standing
  // decision 4).
  const fieldBands: FieldBandOut[] = bands.map((band) => ({ ...band, variant: 'income' as const }));

  if (market?.available && isNum(market.low) && isNum(market.high) && isNum(market.mid)) {
    const used = (market.usable || []).length;
    fieldBands.push({
      label: 'Market — peer multiples',
      low: market.low,
      high: market.high,
      point: market.mid,
      // WHICH MULTIPLES, FLEXED TO WHAT, ON HOW MANY PEERS (job B2). The band
      // is the peers' own 25th-to-75th percentile spread, so the sentence has
      // to name the multiples it was struck on; the count alone said nothing
      // about where the width came from.
      detail:
        market.detail ||
        `${used} peer multiple${used === 1 ? '' : 's'} on reported figures`,
      variant: 'market',
    });
  }

  // ---- THE ASSET ROW SAYS WHAT IS IN IT (job B3) ------------------------
  //
  // The asset approach is drawn as a floor rather than an estimate, which is
  // what it is. Three things the row owes a reader, and did not:
  //
  // 1. WHICH MEASURES. `Asset — what it owns` named none of them, so a band
  //    spanning book value and a liquidation struck at recovery rates the
  //    READER set looked the same as one spanning book and tangible book. The
  //    label now lists exactly the measures inside the range.
  //
  // 2. NO MEDIAN WHERE THERE IS A RANGE. The point was the median of the
  //    surviving measures — a cross-measure average, which is the one thing
  //    standing decision 4 forbids: book value and a forced-sale liquidation
  //    answer different questions, and the middle of them answers neither.
  //    `VALUATION_SIDE_BY_SIDE` rule 5 allows a point only where there is no
  //    honest range, so the point is drawn where ONE measure survives and
  //    withheld where more than one does.
  //
  // 3. THE SUITABILITY SENTENCE, in the row, where `informative` is false. A
  //    nine-word aside saying "shown as a floor" is not the same claim as the
  //    engine's own sentence about where this company's value actually sits.
  if (asset?.available && isNum(asset.low) && isNum(asset.high)) {
    const inRange = (asset.usable || []).filter((m: any) => isNum(m?.perShare));
    const names = inRange
      .map((m: any) => MEASURE_SHORT_NAMES[m.key as keyof typeof MEASURE_SHORT_NAMES] || m.key)
      .filter(Boolean);
    const single = inRange.length === 1;
    fieldBands.push({
      label: names.length ? `Asset — ${names.join(', ')}` : 'Asset — what it owns',
      low: asset.low,
      high: asset.high,
      // One measure is one figure, and the chart draws it as a tick. More than
      // one is a range with no honest point inside it.
      point: single && isNum(asset.mid) ? asset.mid : null,
      detail: asset.informative
        ? `${inRange.length} balance sheet measure${inRange.length === 1 ? '' : 's'}`
        : asset.suitability ||
          `${inRange.length} balance sheet measure${
            inRange.length === 1 ? '' : 's'
          }, shown as a floor rather than a valuation`,
      variant: 'asset',
    });
  }

  // ---- RULES 6 TO 8: WHAT WAS REFUSED, AND THE TWO CAPTIONS (job B4) ----
  //
  // THREE APPROACHES ARE ALWAYS ATTEMPTED, and every one of them either shows
  // a row or says why it cannot. The identity the check rests on is
  // `shown + refused === attempted`: a refused approach that is simply absent
  // leaves the page showing two approaches in agreement and saying nothing
  // about the third, which is the most misleading shape this screen can take.
  const refused: RefusedApproach[] = [];
  if (!fieldBands.some((b) => b.variant === 'income')) {
    refused.push({
      variant: 'income',
      label: 'Income — discounted cash flow',
      reason: built.refusal?.message || 'The income approach produced no range.',
    });
  }
  if (!fieldBands.some((b) => b.variant === 'market')) {
    refused.push({
      variant: 'market',
      label: 'Market — peer multiples',
      reason:
        market?.message ||
        (market
          ? 'The peer set produced no usable multiple for this company.'
          : 'No peer set was available for this company.'),
    });
  }
  if (!fieldBands.some((b) => b.variant === 'asset')) {
    refused.push({
      variant: 'asset',
      // No measure survived, so there are no measures to name: the refused
      // row keeps the approach's own name and the reason does the work.
      label: 'Asset — what it owns',
      reason:
        asset?.message ||
        (asset
          ? 'Every measure in the asset approach came out negative or could not be computed.'
          : 'The balance sheet needed for an asset approach was not available.'),
    });
  }

  // THE RANGES, ONE PER APPROACH. The income approach contributes several
  // bands (perpetuity and exit multiple), and they are one approach, so its
  // range is their union — otherwise two bands of the SAME approach failing to
  // intersect would print a sentence about approaches disagreeing.
  const spans: { variant: string; low: number; high: number }[] = [];
  for (const variant of ['income', 'market', 'asset'] as const) {
    const mine = fieldBands.filter((b) => b.variant === variant && isNum(b.low) && isNum(b.high));
    if (!mine.length) continue;
    spans.push({
      variant,
      low: Math.min(...mine.map((b) => b.low as number)),
      high: Math.max(...mine.map((b) => b.high as number)),
    });
  }
  // DISJOINT MEANS NO TWO OF THEM INTERSECT. With one approach there is no
  // pair, so there is nothing to say and the sentence is withheld: a lone
  // range that "does not overlap" would be a claim about nothing.
  let anyOverlap = false;
  for (let i = 0; i < spans.length; i++) {
    for (let j = i + 1; j < spans.length; j++) {
      if (spans[i].low <= spans[j].high && spans[j].low <= spans[i].high) anyOverlap = true;
    }
  }
  const approaches: ApproachesOut = {
    attempted: 3,
    shown: spans.length,
    refused,
    caption: SIDE_BY_SIDE_CAPTION,
    overlapNote: spans.length >= 2 && !anyOverlap ? NO_OVERLAP_NOTE : null,
  };

  return {
    struckPrice: price,
    bands,
    terminalMethods,
    premiumAgainst,
    fieldBands,
    approaches,
  };
}

export default { valuationSummary, premiumOf, admissibleInputs };
