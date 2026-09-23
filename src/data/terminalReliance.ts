// FILE: src/data/terminalReliance.ts
//
// Marginalia — how much of this valuation is the part nobody modelled
//
// A discounted cash flow of a going concern puts most of its value after the
// forecast ends, and that is arithmetic rather than a fault. Five years at an
// 8% discount rate and 2.5% perpetual growth leaves about three quarters of the
// value beyond the window for ANY company, however carefully the five years are
// built: the annuity of five discounted years is simply small next to a
// perpetuity. Measured across the valued companies on 2026-09-23, the median
// terminal share is 76.5% against a benchmark of 73.8%, and 52 of 64 sit within
// five points of it.
//
// So this file does not try to reduce the number. It shows it, with the
// benchmark beside it so a reader can tell the ordinary shape of a DCF from a
// company where something else is going on, and with the sensitivity stated as
// a RANGE rather than a point.
//
// ON FALSE PRECISION. The figures here are deliberately coarse: whole
// percentages for the share, values rounded the way the headline is, and no
// decimals on the benchmark comparison. A terminal value is the least precise
// thing in a valuation and printing it to two decimals would say otherwise. The
// sensitivity is given as the value at each end of a stated range, never as a
// single "plus or minus", because the perpetuity formula is not symmetric: a
// point off the growth rate and a point on it move the answer by different
// amounts, and showing one number would hide that.

const isNum = (v: any): v is number => typeof v === 'number' && isFinite(v);

export interface TerminalReliance {
  /** Share of enterprise value that is the terminal value, 0 to 1. */
  share: number;
  /** What a flat cash flow would put beyond the window at this rate. */
  benchmark: number;
  /** Points above the benchmark. Negative means less than the ordinary shape. */
  excess: number;
  /** True when this company is far from the ordinary shape of a DCF. */
  unusual: boolean;
  /** True when the explicit years are worth less than nothing. */
  explicitNegative: boolean;
  forecastYears: number;
  lastForecastYear: number | null;
  /** Value per share at the ends of a stated terminal-growth range. */
  growth: { low: number; high: number; lowValue: number | null; highValue: number | null } | null;
  /** Value per share at the ends of a stated discount-rate range. */
  wacc: { low: number; high: number; lowValue: number | null; highValue: number | null } | null;
  /** One sentence, plain, for the reader who reads nothing else. */
  sentence: string;
}

/**
 * More than ten points above the arithmetic benchmark is where a company stops
 * looking like an ordinary five-year DCF. Three of the 64 valued companies are
 * past it, and the median gap is two points, so the cut is well clear of the
 * ordinary spread rather than a line drawn through the middle of it.
 */
export const UNUSUAL_EXCESS = 0.10;

export function terminalReliance(dcf: any, data: any): TerminalReliance | null {
  if (!dcf?.applicable) return null;
  const pvT = dcf.pvTerminalPerpetuity;
  const pvs: number[] = Array.isArray(dcf.presentValue) ? dcf.presentValue.filter(isNum) : [];
  if (!isNum(pvT) || !pvs.length) return null;
  const pvE = pvs.reduce((a, b) => a + b, 0);
  const ev = pvE + pvT;
  if (!isNum(ev) || ev === 0) return null;

  const share = pvT / ev;
  const w = dcf.wacc;
  const g = dcf.longTermGrowthRate ?? data?.dcf?.longTermGrowthRate ?? 0.025;
  const nF = pvs.length;

  // The benchmark: the same two rates and the same window, applied to a company
  // whose cash flow never changes. Everything company-specific cancels.
  let benchmark = share;
  if (isNum(w) && isNum(g) && w > g && w > 0) {
    const annuity = (1 - (1 + w) ** -nF) / w;
    const tv = ((1 + g) / (w - g)) * (1 + w) ** -nF;
    benchmark = tv / (annuity + tv);
  }
  const excess = share - benchmark;

  // The sensitivity comes from the grid the engine already builds, so the
  // figures shown are the ones the grid shows and cannot drift from them.
  const axes = dcf.sensitivityAxes;
  const grid = dcf.sensitivity?.perpetuity;
  const mid = (arr: any[]) => Math.floor((arr.length - 1) / 2);
  let growth: TerminalReliance['growth'] = null;
  let wacc: TerminalReliance['wacc'] = null;
  if (Array.isArray(grid) && Array.isArray(axes?.growth) && Array.isArray(axes?.wacc)) {
    const wi = mid(axes.wacc), gi = mid(axes.growth);
    const row = grid[wi];
    if (Array.isArray(row)) {
      growth = {
        low: axes.growth[0],
        high: axes.growth[axes.growth.length - 1],
        lowValue: isNum(row[0]) && row[0] > 0 ? row[0] : null,
        highValue: isNum(row[row.length - 1]) && row[row.length - 1] > 0 ? row[row.length - 1] : null,
      };
    }
    const lowW = grid[0]?.[gi];
    const highW = grid[grid.length - 1]?.[gi];
    wacc = {
      low: axes.wacc[0],
      high: axes.wacc[axes.wacc.length - 1],
      // A LOWER discount rate gives a HIGHER value, so the ends are crossed
      // deliberately: lowValue is the value at the low rate.
      lowValue: isNum(lowW) && lowW > 0 ? lowW : null,
      highValue: isNum(highW) && highW > 0 ? highW : null,
    };
  }

  const years: number[] = Array.isArray(data?.meta?.forecastYears) ? data.meta.forecastYears : [];
  const lastForecastYear = years.length ? years[years.length - 1] : null;
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const explicitNegative = pvE < 0;

  const sentence = explicitNegative
    ? `The ${nF} forecast years are worth less than nothing on their own: the whole of this value, and more, is ` +
      `what the model assumes happens after ${lastForecastYear ?? 'the forecast ends'}.`
    : excess > UNUSUAL_EXCESS
      ? `${pct(share)} of this value is what happens after ${lastForecastYear ?? 'the forecast'}, against about ` +
        `${pct(benchmark)} for an ordinary five-year forecast at this discount rate. More rests on the part nobody ` +
        `modelled than usual.`
      : `${pct(share)} of this value is what happens after ${lastForecastYear ?? 'the forecast'}. That is about what ` +
        `any ${nF}-year forecast at this discount rate would give (${pct(benchmark)}): the five modelled years are a ` +
        `small annuity beside a perpetuity, so the shape is arithmetic rather than a judgement about this company.`;

  return {
    share, benchmark, excess,
    unusual: excess > UNUSUAL_EXCESS || explicitNegative,
    explicitNegative,
    forecastYears: nF,
    lastForecastYear,
    growth, wacc,
    sentence,
  };
}

export default { terminalReliance, UNUSUAL_EXCESS };
