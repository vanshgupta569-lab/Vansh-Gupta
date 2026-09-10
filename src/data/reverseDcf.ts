// FILE: src/data/reverseDcf.ts
//
// Marginalia — reverse DCF
//
// A discounted cash flow asks "what is this worth?". A reverse DCF asks the
// question the other way round: "what would have to be true for today's price
// to be right?" It is the sharper question, because it never asks the reader
// to accept our assumptions. It only tells them what assumptions the market is
// already making.
//
// Nothing here is a new model. Every figure below is produced by running the
// SAME engine, through the SAME driver overrides the sliders use, and searching
// for the input value at which the model's answer equals the traded price. So
// the reverse DCF can never disagree with the DCF: it is the DCF, solved for a
// different unknown.
//
// Four questions, each solved against the method it belongs to:
//
//   revenue growth   -> against the blended value, because growth moves both
//                       terminal methods
//   terminal growth  -> against the perpetuity value only, because the exit
//                       multiple method does not use a terminal growth rate
//   exit multiple    -> against the exit multiple value only, for the mirror
//                       of that reason
//   cost of capital  -> against the blended value; the discount rate moves both
//
// A note on precision. The engine treats a driver as "moved" only when it
// differs from the model's own default at one decimal place, so figures are
// reported to one decimal. That is the precision the sliders work in, and
// claiming more would be false.

import { buildFullModel } from './companies';
import type { ValuationDrivers } from '../types';

export interface ImpliedFigure {
  key: string;
  label: string;
  /** What the model assumes today. */
  base: number | null;
  /** What today's price implies instead. Null when no value in a sane range works. */
  implied: number | null;
  unit: 'pct' | 'x';
  /** Which valuation method this figure was solved against. */
  method: string;
  question: string;
  /** Set when the search found no answer inside a defensible range. */
  outOfRange?: boolean;
}

export interface ReverseDcfResult {
  applicable: boolean;
  message?: string;
  marketPrice: number;
  modelValue: number | null;
  figures: ImpliedFigure[];
}

type Method = 'perpetuity' | 'exit' | 'blend';

const isNum = (v: any): v is number => typeof v === 'number' && isFinite(v);

/** One engine run with a single driver replaced, read through one method. */
function valueUnder(
  source: any,
  drivers: ValuationDrivers,
  patch: Partial<ValuationDrivers>,
  method: Method
): number | null {
  try {
    const built = buildFullModel(source, { ...drivers, ...patch } as ValuationDrivers);
    const D = built?.dcf;
    if (!D || D.applicable === false) return null;
    const perp = D.perpetuity?.valuePerShare;
    const exit = D.exitMultipleValuation?.valuePerShare;
    if (method === 'perpetuity') return isNum(perp) ? perp : null;
    if (method === 'exit') return isNum(exit) ? exit : null;
    if (isNum(perp) && isNum(exit)) return (perp + exit) / 2;
    return isNum(perp) ? perp : isNum(exit) ? exit : null;
  } catch {
    return null;
  }
}

// Straight bisection. The value per share moves in one direction as any one of
// these drivers moves, so if the target is bracketed at the two ends there is
// exactly one crossing, and halving the interval walks onto it. Thirty-six
// halvings take a range of 70 down to about a billionth, which is far finer
// than anything reported.
function bisect(
  lo: number,
  hi: number,
  f: (x: number) => number | null,
  steps = 36
): number | null {
  const fLo = f(lo);
  const fHi = f(hi);
  if (fLo === null || fHi === null) return null;
  if (fLo === 0) return lo;
  if (fHi === 0) return hi;
  // Both ends on the same side of the target: the price implies something
  // outside any range worth printing.
  if (fLo > 0 === fHi > 0) return null;

  let a = lo;
  let b = hi;
  const aPositive = fLo > 0;
  for (let i = 0; i < steps; i++) {
    const mid = (a + b) / 2;
    const fMid = f(mid);
    if (fMid === null) return null;
    if (fMid > 0 === aPositive) a = mid;
    else b = mid;
  }
  return (a + b) / 2;
}

// The engine treats a driver as moved only when it differs from the model's own
// default at one decimal place. That means it cannot tell 4.02 from 4.00, and a
// search will happily stop anywhere inside that blind spot — which shows up as
// an implied figure sitting one rounding tick away from the base and reads as a
// difference that is not there. Anything inside the engine's own resolution IS
// the base, so say so.
function snapToBase(value: number | null, base: number | null): number | null {
  if (value === null || base === null) return value;
  return Math.abs(value - base) <= 0.0501 ? base : value;
}

export function reverseDcf(
  source: any,
  drivers: ValuationDrivers,
  marketPrice: number
): ReverseDcfResult {
  const empty: ReverseDcfResult = {
    applicable: false,
    marketPrice,
    modelValue: null,
    figures: [],
  };

  if (!source || !isNum(marketPrice) || marketPrice <= 0) {
    return { ...empty, message: 'No traded price is available, so there is nothing to solve against.' };
  }

  let base: any;
  try {
    base = buildFullModel(source, drivers);
  } catch {
    return { ...empty, message: 'The model could not be built for this company.' };
  }

  const D = base?.dcf;
  if (!D || D.applicable === false) {
    return {
      ...empty,
      message:
        D?.message ||
        'This company has no discounted cash flow, so there is nothing to reverse.',
    };
  }

  const perp = D.perpetuity?.valuePerShare;
  const exit = D.exitMultipleValuation?.valuePerShare;
  const modelValue = isNum(perp) && isNum(exit) ? (perp + exit) / 2 : isNum(perp) ? perp : null;

  const baseWaccPct = isNum(D.wacc) ? D.wacc * 100 : null;
  const baseTerminalPct = isNum(D.longTermGrowthRate) ? D.longTermGrowthRate * 100 : null;
  const baseExit = isNum(D.exitMultiple) ? D.exitMultiple : null;
  const baseRevenueGrowthPct = isNum(drivers.revenueGrowthPct) ? drivers.revenueGrowthPct : null;

  const gap = (patchKey: keyof ValuationDrivers, method: Method) => (x: number) => {
    const v = valueUnder(source, drivers, { [patchKey]: x } as Partial<ValuationDrivers>, method);
    return v === null ? null : v - marketPrice;
  };

  const figures: ImpliedFigure[] = [];

  // 1. Revenue growth. This is the headline reverse-DCF number: the growth the
  //    buyer at today's price is paying for.
  //
  //    Moving the growth driver shifts the model's whole forecast path up or
  //    down by the same amount rather than flattening it to one rate, so the
  //    figure printed on both sides is the first forecast year and every later
  //    year moves with it. The base is therefore the model's own starting
  //    value, and it is still solved for rather than assumed: if the override
  //    ever stops being an exact shift, this keeps the two columns comparing
  //    like with like instead of silently showing a gap that is not there.
  const growth = bisect(-30, 40, gap('revenueGrowthPct', 'blend'));
  const baseFlatGrowth =
    modelValue === null
      ? baseRevenueGrowthPct
      : bisect(-30, 40, (x: number) => {
          const v = valueUnder(source, drivers, { revenueGrowthPct: x }, 'blend');
          return v === null ? null : v - modelValue;
        }) ?? baseRevenueGrowthPct;
  figures.push({
    key: 'revenueGrowth',
    label: 'Annual revenue growth',
    base: baseFlatGrowth,
    implied: snapToBase(growth, baseFlatGrowth),
    unit: 'pct',
    method: 'solved against the blended value',
    question:
      "the model's own growth path moved up or down as a whole, margins unchanged — the figure shown is the first forecast year",
    outOfRange: growth === null,
  });

  // 2. Terminal growth, against the perpetuity method alone. The upper bound
  //    stops short of the discount rate, where the perpetuity formula breaks.
  const terminalCeiling = baseWaccPct === null ? 8 : Math.min(baseWaccPct - 0.4, 12);
  const terminal = bisect(-3, terminalCeiling, gap('terminalGrowthPct', 'perpetuity'));
  figures.push({
    key: 'terminalGrowth',
    label: 'Growth for ever, after year five',
    base: baseTerminalPct,
    implied: snapToBase(terminal, baseTerminalPct),
    unit: 'pct',
    method: 'solved against the perpetuity method',
    question: 'the exit multiple method has no terminal growth rate to solve for',
    outOfRange: terminal === null,
  });

  // 3. Exit multiple, against the exit multiple method alone.
  const multiple = bisect(0.5, 60, gap('exitMultipleX', 'exit'));
  figures.push({
    key: 'exitMultiple',
    label: 'EV / EBITDA on exit',
    base: baseExit,
    implied: snapToBase(multiple, baseExit),
    unit: 'x',
    method: 'solved against the exit multiple method',
    question: 'what the business would have to be sold for in year five',
    outOfRange: multiple === null,
  });

  // 4. The discount rate that makes the model agree with the price. Read it as
  //    the return the market is implicitly accepting, not as a target.
  // The floor sits just above the terminal growth rate the model is ACTUALLY
  // using during this solve, which is the base rate, not the implied one found
  // above. At or below it the perpetuity formula has no meaning.
  const waccFloor = Math.max((baseTerminalPct ?? 0) + 0.5, 1);
  const wacc = bisect(waccFloor, 40, gap('waccPct', 'blend'));
  figures.push({
    key: 'wacc',
    label: 'Cost of capital',
    base: baseWaccPct,
    implied: snapToBase(wacc, baseWaccPct),
    unit: 'pct',
    method: 'solved against the blended value',
    question: 'the discount rate at which the model agrees with the price',
    outOfRange: wacc === null,
  });

  return {
    applicable: true,
    marketPrice,
    modelValue,
    figures,
  };
}

export default { reverseDcf };
