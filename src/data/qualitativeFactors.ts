// FILE: src/data/qualitativeFactors.ts
//
// Marginalia — the qualitative factors
//
// A model reads accounts. It cannot read a management team, a regulator or a
// competitor. These ten questions are where the reader supplies what the
// filings cannot, and each one moves the single assumption it genuinely
// belongs in rather than multiplying the finished answer by a confidence
// number. That rule is the whole design: a view about demand belongs in the
// sales growth rate, a view about governance belongs in the discount rate, and
// nowhere else.
//
// WHY TEN RATHER THAN FIVE, AND WHY THESE TEN
//
// The five the site started with asked mostly about next year. But for most
// companies the terminal value is the larger half of the answer, and only one
// of the five touched the terminal growth rate at all, by a tenth of a point.
// The screen was asking hardest about the part that matters least.
//
// So the additions are weighted the other way. "Could a new technology make
// this unnecessary in ten years" moves terminal growth four times as far as
// anything did before, because that is the question the terminal value is
// actually asking. The rest fill genuine gaps: cost pass-through is a
// different question from pricing power, cyclical position is a different
// question from structural demand, and concentration and refinancing are risks
// that no line of a profit and loss account reveals.
//
// ON "INDUSTRY RISK" AS A SINGLE QUESTION
//
// Deliberately absent. It has no honest driver to attach to, and the site's own
// rule is that an adjuster sits on the row whose figures it sets. Industry risk
// is really four separate things — regulation, cyclicality, technological
// substitution and input costs — and each belongs in a different assumption. A
// reader can then say the industry is cyclical but the technology is safe,
// which one blunt slider cannot express.

import type { ValuationDrivers } from '../types';

export type Verdict = 'helps' | 'neutral' | 'hurts';

export interface Factor {
  key: string;
  group: 'business' | 'longRun' | 'risk';
  title: string;
  question: string;
  /** What a "helps" verdict does to each driver, in percentage points. */
  effect: Partial<Record<keyof ValuationDrivers, number>>;
  reasoning: string;
}

export const FACTOR_GROUPS: { key: Factor['group']; title: string; standfirst: string }[] = [
  {
    key: 'business',
    title: 'The business',
    standfirst: 'What it earns, and whether it can keep earning it.',
  },
  {
    key: 'longRun',
    title: 'The long run',
    standfirst:
      'What happens after year five. For most companies this is the larger half of the answer.',
  },
  {
    key: 'risk',
    title: 'The risks',
    standfirst: 'Not what the company earns, but how confident you can be of receiving it.',
  },
];

// The sizes are deliberately modest. A qualitative view is a nudge to an
// assumption, not a replacement for it: half a point of margin is a real
// difference to a valuation without pretending anyone can judge it finer.
export const FACTORS: Factor[] = [
  // ---- the business -------------------------------------------------------
  {
    key: 'moat',
    group: 'business',
    title: 'Competitive position',
    question:
      'Can this company keep charging what it charges, or will rivals compete the profit away?',
    effect: { operatingMarginPct: 0.5, terminalGrowthPct: 0.1 },
    reasoning:
      'A company customers cannot easily leave keeps its profit margin for longer, and keeps growing for longer once the forecast runs out.',
  },
  {
    key: 'demand',
    group: 'business',
    title: 'Demand for what it sells',
    question:
      'Is the market this company sells into growing, shrinking, or holding steady?',
    effect: { revenueGrowthPct: 1.0 },
    reasoning:
      'This moves the sales growth rate directly. It is the assumption a view about demand actually belongs in.',
  },
  {
    key: 'inputCosts',
    group: 'business',
    title: 'Cost pass-through',
    question:
      'When the things this company buys get more expensive, can it raise its own prices to match?',
    effect: { operatingMarginPct: 0.4 },
    reasoning:
      'This is a different question from pricing power over customers. A company can be hard to leave and still be squeezed by its suppliers, and it is the margin that absorbs the difference.',
  },
  {
    key: 'capital',
    group: 'business',
    title: 'How hard the money works',
    question:
      'Does this business have to keep spending heavily just to stand still?',
    effect: { capexPctOfRev: -0.5 },
    reasoning:
      'A business that needs less equipment spending keeps more of the cash it makes.',
  },

  // ---- the long run -------------------------------------------------------
  {
    key: 'substitution',
    group: 'longRun',
    title: 'Technology and substitution',
    question:
      'Could a new technology or a different way of doing this make the product unnecessary in ten years?',
    effect: { terminalGrowthPct: 0.4 },
    reasoning:
      'The terminal value assumes the business still exists and still grows, for ever. That is the assumption this question moves, and it is the one carrying most of the weight in the answer.',
  },
  {
    key: 'cycle',
    group: 'longRun',
    title: 'Where in the cycle',
    question:
      'Is this industry near the top of a cycle right now, or near the bottom?',
    effect: { revenueGrowthPct: 0.8 },
    reasoning:
      'A forecast built from the last few years inherits whatever part of the cycle those years were in. A company at a peak is being extrapolated from its best year, and the growth rate is where that correction belongs.',
  },

  // ---- the risks ----------------------------------------------------------
  {
    key: 'management',
    group: 'risk',
    title: 'Management and governance',
    question:
      'Do you trust the people running it, and the way the company is controlled?',
    effect: { waccPct: -0.3 },
    reasoning:
      'Poor governance does not change the cash the business produces. It changes how confident you can be of receiving it, which is what the discount rate measures.',
  },
  {
    key: 'regulation',
    group: 'risk',
    title: 'Regulation and policy',
    question:
      'Could a change in law, tax or policy meaningfully change what this business earns?',
    effect: { waccPct: -0.3, operatingMarginPct: 0.25 },
    reasoning:
      'Regulatory risk raises the return an investor needs, and often squeezes the margin as well.',
  },
  {
    key: 'concentration',
    group: 'risk',
    title: 'Customer concentration',
    question:
      'Does this company depend on a handful of customers for most of what it sells?',
    effect: { waccPct: -0.35 },
    reasoning:
      'Losing one customer out of thousands is a bad quarter. Losing one out of four is a different company. Nothing in a profit and loss account shows which of the two this is.',
  },
  {
    key: 'refinancing',
    group: 'risk',
    title: 'Debt and refinancing',
    question:
      'Does it have borrowings to repay or refinance in the next couple of years?',
    effect: { waccPct: -0.35 },
    reasoning:
      'A company that must refinance is exposed to what lenders think of it on one particular day, which is a risk to the shareholder even when trading is unchanged.',
  },
];

// ---------------------------------------------------------------------------
// THE CAP
//
// Four of the ten push the discount rate. Somebody who marks everything a
// weakness would move it by more than a point, and with more factors added
// later that could run further. A discount rate swung three points by a series
// of impressions is not judgement, it is an accident, and it would collapse the
// valuation for reasons the reader never intended.
//
// So each driver has a ceiling on the TOTAL a set of verdicts may move it. It
// is a safety net rather than a constraint: with the ten factors above nothing
// reaches its cap, and the numbers are here so that adding factors later cannot
// quietly break the arithmetic.
// ---------------------------------------------------------------------------
export const ADJUSTMENT_CAPS: Partial<Record<keyof ValuationDrivers, number>> = {
  waccPct: 1.5,
  terminalGrowthPct: 0.6,
  revenueGrowthPct: 2.0,
  operatingMarginPct: 1.5,
  capexPctOfRev: 1.0,
};

const clamp = (v: number, limit: number) => Math.max(-limit, Math.min(limit, v));

/** The total each driver would move, before it is added to the defaults. */
export function adjustmentsFor(
  verdicts: Record<string, Verdict>
): Partial<Record<keyof ValuationDrivers, number>> {
  const totals: Record<string, number> = {};
  for (const factor of FACTORS) {
    const verdict = verdicts[factor.key];
    if (!verdict || verdict === 'neutral') continue;
    const sign = verdict === 'helps' ? 1 : -1;
    for (const [driver, amount] of Object.entries(factor.effect)) {
      totals[driver] = (totals[driver] ?? 0) + sign * (amount as number);
    }
  }
  for (const driver of Object.keys(totals)) {
    const cap = ADJUSTMENT_CAPS[driver as keyof ValuationDrivers];
    if (typeof cap === 'number') totals[driver] = clamp(totals[driver], cap);
    totals[driver] = Number(totals[driver].toFixed(2));
  }
  return totals as Partial<Record<keyof ValuationDrivers, number>>;
}

/**
 * The drivers these verdicts imply.
 *
 * Always computed from the model's own defaults rather than from wherever the
 * sliders happen to sit, so applying the same view twice cannot apply it twice.
 */
export function applyVerdicts(
  defaults: ValuationDrivers,
  verdicts: Record<string, Verdict>
): ValuationDrivers {
  const next: any = { ...defaults };
  for (const [driver, amount] of Object.entries(adjustmentsFor(verdicts))) {
    const key = driver as keyof ValuationDrivers;
    next[key] = Number((Number(next[key]) + (amount as number)).toFixed(2));
  }
  return next as ValuationDrivers;
}

export const DRIVER_LABELS: Record<string, string> = {
  revenueGrowthPct: 'Sales growth',
  operatingMarginPct: 'Operating margin',
  taxRatePct: 'Tax rate',
  capexPctOfRev: 'Equipment spending',
  waccPct: 'Discount rate',
  terminalGrowthPct: 'Growth after year five',
};

export default { FACTORS, FACTOR_GROUPS, applyVerdicts, adjustmentsFor, ADJUSTMENT_CAPS };
