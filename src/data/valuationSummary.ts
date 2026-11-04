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
import { valuationBandsFor } from './companies';
import { terminalSpread } from './terminalSpread';

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

  const bands: ValuationBandOut[] = source ? (valuationBandsFor(source, drivers, price) as any[]) : [];

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
      detail: `${used} peer multiple${used === 1 ? '' : 's'} on reported figures`,
      variant: 'market',
    });
  }

  // The asset approach is drawn as a floor rather than an estimate, which is
  // what it is. Where only one measure survives the bar has no width, and that
  // is honest: there is one figure, not a range.
  if (asset?.available && isNum(asset.low) && isNum(asset.high) && isNum(asset.mid)) {
    const count = (asset.usable || []).length;
    fieldBands.push({
      label: 'Asset — what it owns',
      low: asset.low,
      high: asset.high,
      point: asset.mid,
      detail: `${count} balance sheet measure${count === 1 ? '' : 's'}${
        asset.informative ? '' : ', shown as a floor rather than a valuation'
      }`,
      variant: 'asset',
    });
  }

  return { struckPrice: price, bands, terminalMethods, premiumAgainst, fieldBands };
}

export default { valuationSummary, premiumOf };
