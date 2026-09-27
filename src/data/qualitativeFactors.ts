// FILE: src/data/qualitativeFactors.ts
//
// Marginalia — the qualitative factors
//
// A model reads accounts. It cannot read a management team, a regulator or a
// competitor. These questions are where the reader supplies what the
// filings cannot, and each one moves the single assumption it genuinely
// belongs in rather than multiplying the finished answer by a confidence
// number. That rule is the whole design: a view about demand belongs in the
// sales growth rate, a view about governance belongs in the discount rate, and
// nowhere else.
//
// WHY THESE QUESTIONS
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

  {
    key: 'operatingLeverage',
    group: 'business',
    title: 'How fixed the costs are',
    question:
      'If sales fell by a tenth, would the costs fall with them, or mostly carry on?',
    effect: { operatingMarginPct: 0.3 },
    reasoning:
      'A business whose costs move with its sales keeps its margin in a bad year. One paying rent, salaries and depreciation whatever happens sees the whole of the lost gross profit come out of the bottom line.',
  },
  {
    key: 'supplierDependence',
    group: 'business',
    title: 'Dependence on suppliers',
    question:
      'Could one supplier, or one country, interrupt what this company makes?',
    effect: { operatingMarginPct: 0.3 },
    reasoning:
      'This is the mirror of customer concentration and belongs in the margin rather than the discount rate: a single source of supply is usually paid for in price, and the alternative is paid for in disruption.',
  },
  {
    key: 'talent',
    group: 'business',
    title: 'Dependence on particular people',
    question:
      'Does this business rest on people who could leave, or on systems that would stay?',
    effect: { operatingMarginPct: 0.25 },
    reasoning:
      'Where the work walks out of the door each evening, keeping it costs money, and competition for the same people shows up as pay. That is a margin question rather than a risk one.',
  },
  {
    key: 'rndDependence',
    group: 'business',
    title: 'Dependence on continuous invention',
    question:
      'Does staying competitive require inventing the product again every few years?',
    effect: { rndMarginPct: -0.4 },
    reasoning:
      'A product that must be replaced to stay ahead carries a permanent research bill; one that changes little does not. This moves the research assumption directly rather than the profit it produces.',
  },
  {
    key: 'sellingIntensity',
    group: 'business',
    title: 'What it costs to win a customer',
    question:
      'Do customers come to this company, or does every sale have to be bought?',
    effect: { sgaMarginPct: -0.3 },
    reasoning:
      'Two businesses with the same gross margin can keep very different amounts of it, depending on what they spend to sell. That belongs in the selling and administrative assumption.',
  },
  {
    key: 'taxIncentives',
    group: 'business',
    title: 'The tax position',
    question:
      'Does the rate this company pays depend on incentives, reliefs or losses that will not last?',
    effect: { taxRatePct: -0.5 },
    reasoning:
      'A forecast inherits the tax rate the company last reported. Where that rate rests on something temporary, the tax assumption is the honest place to say so — no other line in the model can express it.',
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

  {
    key: 'runway',
    group: 'longRun',
    title: 'Room left to grow',
    question:
      'Is there somewhere left for this company to expand, or has it largely filled its market?',
    effect: { terminalGrowthPct: 0.3 },
    reasoning:
      'The terminal value assumes growth continues for ever. A company with new territories or adjacent products ahead of it is a different proposition from one that already sells to everyone it can reach.',
  },
  {
    key: 'structuralDemand',
    group: 'longRun',
    title: 'The long tide',
    question:
      'Is something slow and structural \u2014 demographics, urbanisation, a change in how people live \u2014 pushing this market one way?',
    effect: { terminalGrowthPct: 0.25 },
    reasoning:
      'This is a different question from where the cycle is. A cycle turns; a structural shift does not, and it is the one that reaches the years beyond the forecast.',
  },
  {
    key: 'exitAppetite',
    group: 'longRun',
    title: 'What a buyer would pay',
    question:
      'Would an acquirer pay more or less for this business than for a typical company in its industry?',
    effect: { exitMultipleX: 1.0 },
    reasoning:
      'The exit multiple in this model is a flat assumption applied to every company, which is stated rather than hidden. This is where a reader who knows the industry can say it is wrong, by a whole turn.',
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
  {
    key: 'accountingQuality',
    group: 'risk',
    title: 'Confidence in the figures',
    question:
      'Do the accounts look straightforward, or are there policy changes, restatements or auditor changes behind them?',
    effect: { waccPct: -0.3 },
    reasoning:
      'Every number in this model comes from the filings. Where the filings themselves invite questions, the uncertainty belongs in the discount rate, because it is the confidence in receiving the cash that has changed, not the cash.',
  },
  {
    key: 'litigation',
    group: 'risk',
    title: 'Claims and contingencies',
    question:
      'Is there litigation, a contingent liability or a dispute that could cost real money?',
    effect: { waccPct: -0.25 },
    reasoning:
      'A contingent liability is disclosed in the notes precisely because it is not yet a number on the balance sheet. It is a risk to the shareholder that no line of the accounts carries.',
  },
  {
    key: 'countryCurrency',
    group: 'risk',
    title: 'Where the earnings come from',
    question:
      'Are a large part of these earnings made in a currency or a country that could move against the shareholder?',
    effect: { waccPct: -0.25 },
    reasoning:
      'Earnings translated from a weakening currency, or held where capital moves less freely, reach the shareholder less reliably. The business may be unchanged; what is received is not.',
  },
  {
    key: 'capitalAllocation',
    group: 'risk',
    title: 'What management does with the cash',
    question:
      'Has spare cash been put to work well, or spent on acquisitions and projects that did not earn their keep?',
    effect: { capexPctOfRev: -0.3 },
    reasoning:
      'Governance is about whether the cash reaches the shareholder; this is about what is done with it first. A record of spending badly shows up as capital consumed for no return, which is the spending assumption.',
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
// So each driver has a ceiling on the TOTAL a set of verdicts may move it.
//
// With the factors now in the file the ceilings do bind, which they did not
// when there were ten. Somebody marking every single question a weakness would
// move the discount rate 2.10 points and the terminal growth rate 1.05; the
// caps hold those at 2.0 and 1.0. That is the safety net doing its job rather
// than a fault: a reader who marks twenty-three questions against a company is
// expressing a general gloom, and a discount rate swung by an accumulation of
// impressions is an accident rather than a judgement. Margin reaches exactly
// its cap of 2.0, and growth and capital spending stay inside theirs.
//
// Before adding a factor, recompute the worst case for every driver it touches
// and state it here. The caps are what stop the arithmetic drifting quietly.
// ---------------------------------------------------------------------------
export const ADJUSTMENT_CAPS: Partial<Record<keyof ValuationDrivers, number>> = {
  waccPct: 2.0,
  terminalGrowthPct: 1.0,
  revenueGrowthPct: 2.0,
  operatingMarginPct: 2.0,
  capexPctOfRev: 1.0,
  taxRatePct: 1.0,
  rndMarginPct: 1.0,
  sgaMarginPct: 1.0,
  exitMultipleX: 2.0,
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

// Every driver a factor can move needs a name here: the screen falls back to
// the raw key, so a driver added to a factor and forgotten here reaches the
// reader as `rndMarginPct`.
export const DRIVER_LABELS: Record<string, string> = {
  revenueGrowthPct: 'Sales growth',
  operatingMarginPct: 'Operating margin',
  taxRatePct: 'Tax rate',
  capexPctOfRev: 'Equipment spending',
  waccPct: 'Discount rate',
  terminalGrowthPct: 'Growth after year five',
  rndMarginPct: 'Research spending',
  sgaMarginPct: 'Selling and admin costs',
  exitMultipleX: 'Exit multiple',
};

// AND ITS UNIT. Every driver a factor moves is a percentage except the exit
// multiple, which is a multiple of EBITDA. Both screens hard-coded a per cent
// sign and the word "points", which was true of all ten original factors; the
// first factor to reach the exit multiple would have told the reader it went
// from 20.4% to 19.4% and moved by "1.00 points".
const DRIVER_UNITS: Record<string, { suffix: string; step: string }> = {
  exitMultipleX: { suffix: '×', step: 'turns of EBITDA' },
};

/** What to print after a driver's level, e.g. `15.7%` or `19.4×`. */
export const driverSuffix = (driver: string): string =>
  DRIVER_UNITS[driver]?.suffix ?? '%';

/** What one unit of movement in a driver is called, e.g. `points`. */
export const driverStepLabel = (driver: string): string =>
  DRIVER_UNITS[driver]?.step ?? 'points';

export default { FACTORS, FACTOR_GROUPS, applyVerdicts, adjustmentsFor, ADJUSTMENT_CAPS };
