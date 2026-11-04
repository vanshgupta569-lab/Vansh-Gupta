// FILE: src/data/chartScale.ts
//
// THE PRICE CHART'S ARITHMETIC (`docs/COMPANY_OVERVIEW_SPEC.md` §3; build
// step 9, job 9.11), kept out of the component so the suite can check it
// without a browser: where the line breaks, which ticks the axes carry, and
// when a log scale is offered.
//
// GAPS ARE NEVER BRIDGED (§3.7). A missing expected trading day breaks the
// line and its fill. The expected days should come from the listing
// exchange's calendar; no calendar is in the data, so a weekday stands in for
// a trading day and one or two missing weekdays are read as holidays (Good
// Friday and Easter Monday, Christmas and Boxing Day): a gap is three or more
// consecutive missing weekdays, and four or more also gets the hatched band
// (PROPOSED — needs Nihar: exchange calendars are LOCAL work). For monthly
// closes a gap is a missing calendar month.

export interface DatedValue {
  date: string;
  value: number;
}

export interface Gap {
  /** The last close before the gap and the first after it. */
  from: string;
  to: string;
  /** Expected days (weekdays, or months) with no close. */
  missing: number;
  /** Four or more: drawn as a hatched band. */
  band: boolean;
}

export const GAP_MIN_WEEKDAYS = 3;
export const BAND_MIN_DAYS = 4;

const DAY = 86400000;
const toT = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

/** Weekdays strictly between two dates. */
export function weekdaysBetween(a: string, b: string): number {
  let n = 0;
  for (let t = toT(a) + DAY; t < toT(b); t += DAY) {
    const d = new Date(t).getUTCDay();
    if (d !== 0 && d !== 6) n++;
  }
  return n;
}

const monthsBetween = (a: string, b: string) => {
  const A = new Date(toT(a)), B = new Date(toT(b));
  return (B.getUTCFullYear() - A.getUTCFullYear()) * 12 + (B.getUTCMonth() - A.getUTCMonth()) - 1;
};

/** The runs of the line between gaps, and the gaps themselves. */
export function segmentsOf<T extends DatedValue>(points: T[], grain: 'daily' | 'monthly'): { segments: T[][]; gaps: Gap[] } {
  const segments: T[][] = [];
  const gaps: Gap[] = [];
  let run: T[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (!isFinite(p.value)) continue;
    const prev = run[run.length - 1];
    if (prev) {
      const missing = grain === 'monthly' ? monthsBetween(prev.date, p.date) : weekdaysBetween(prev.date, p.date);
      const isGap = grain === 'monthly' ? missing >= 1 : missing >= GAP_MIN_WEEKDAYS;
      if (isGap) {
        segments.push(run);
        gaps.push({ from: prev.date, to: p.date, missing, band: missing >= BAND_MIN_DAYS || grain === 'monthly' });
        run = [];
      }
    }
    run.push(p);
  }
  if (run.length) segments.push(run);
  return { segments, gaps };
}

/** Ticks on 1-2-5 steps, at most `max` of them, covering [lo, hi]. */
export function ticks125(lo: number, hi: number, max = 5): { ticks: number[]; step: number } {
  if (!isFinite(lo) || !isFinite(hi) || hi <= lo) return { ticks: [lo], step: 1 };
  const span = hi - lo;
  for (let e = Math.floor(Math.log10(span / max)) - 1; e < 20; e++) {
    for (const m of [1, 2, 5]) {
      const step = m * Math.pow(10, e);
      const first = Math.ceil(lo / step - 1e-9) * step;
      const count = Math.floor((hi - first) / step + 1e-9) + 1;
      if (count <= max) {
        const ticks = Array.from({ length: count }, (_, i) => +(first + i * step).toPrecision(12));
        return { ticks, step };
      }
    }
  }
  return { ticks: [lo, hi], step: span };
}

/**
 * The y domain (§3.2): the visible min and max, padded by 8% of the span,
 * extended to the nearest tick.
 */
export function yDomain(values: number[], max = 5): { lo: number; hi: number; ticks: number[]; step: number } {
  let lo = Math.min(...values), hi = Math.max(...values);
  const pad = (hi - lo) * 0.08 || Math.abs(hi) * 0.08 || 1;
  lo -= pad;
  hi += pad;
  let { ticks, step } = ticks125(lo, hi, max);
  lo = Math.min(lo, Math.floor(lo / step) * step);
  hi = Math.max(hi, Math.ceil(hi / step) * step);
  ({ ticks, step } = ticks125(lo, hi, max));
  return { lo, hi, ticks, step };
}

/** D9: a log scale is offered on 10Y and Max when max ÷ min exceeds 20. */
export const LOG_RATIO = 20;
export function logOffered(range: string, values: number[]): boolean {
  if (range !== '10Y' && range !== 'MAX') return false;
  const pos = values.filter((v) => v > 0);
  if (pos.length !== values.length || !pos.length) return false;
  return Math.max(...pos) / Math.min(...pos) > LOG_RATIO;
}

/** Log-axis ticks on 1-2-5 × 10ⁿ inside [lo, hi], thinned to at most `max`. */
export function logTicks(lo: number, hi: number, max = 5): number[] {
  const all: number[] = [];
  for (let e = Math.floor(Math.log10(lo)) - 1; e <= Math.ceil(Math.log10(hi)); e++)
    for (const m of [1, 2, 5]) {
      const v = m * Math.pow(10, e);
      if (v >= lo && v <= hi) all.push(+v.toPrecision(12));
    }
  if (all.length <= max) return all;
  const decades = all.filter((v) => Math.abs(Math.log10(v) - Math.round(Math.log10(v))) < 1e-9);
  if (decades.length >= 2 && decades.length <= max) return decades;
  const every = Math.ceil(all.length / max);
  return all.filter((_, i) => i % every === 0);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface XTick {
  t: number;
  label: string;
  /** A year boundary or the first label: weight 600 (§3.2). */
  landmark: boolean;
}

/**
 * X ticks on calendar boundaries that never move to suit the data (§3.2).
 * Weekly Mondays when the range is a month (doubled if under 64px apart);
 * otherwise the smallest of 1, 2, 3, 6, 12, 24, 60 months leaving at least
 * 64px between label centres.
 */
export const MIN_LABEL_GAP = 64;
export function xTicks(t0: number, t1: number, plotW: number, weekly: boolean): XTick[] {
  const span = Math.max(DAY, t1 - t0);
  const px = (ms: number) => (ms / span) * plotW;
  const out: XTick[] = [];
  if (weekly) {
    let step = 7;
    while (px(step * DAY) < MIN_LABEL_GAP && step < 365) step *= 2;
    const d = new Date(t0);
    let t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    while (new Date(t).getUTCDay() !== 1) t += DAY;
    for (; t <= t1; t += step * DAY) {
      const x = new Date(t);
      out.push({ t, label: `${x.getUTCDate()} ${MONTHS[x.getUTCMonth()]}`, landmark: false });
    }
    return out;
  }
  const steps = [1, 2, 3, 6, 12, 24, 60];
  const step = steps.find((m) => px(m * 30.44 * DAY) >= MIN_LABEL_GAP) ?? 60;
  const d0 = new Date(t0);
  let y = d0.getUTCFullYear(), m = d0.getUTCMonth() + 1;
  if (m > 11) { m = 0; y++; }
  // Align to the step: months divisible by it (Jan, Apr, Jul… for 3).
  while ((y * 12 + m) % step !== 0) { m++; if (m > 11) { m = 0; y++; } }
  for (;;) {
    const t = Date.UTC(y, m, 1);
    if (t > t1) break;
    const first = out.length === 0;
    const jan = m === 0;
    // On a yearly axis every label is a year, so none is a landmark: weight
    // 600 marks a year among months (PROPOSED — needs Nihar).
    out.push({ t, label: jan || step >= 12 ? String(y) : first ? `${MONTHS[m]} ${y}` : MONTHS[m], landmark: step < 12 && (jan || first) });
    m += step;
    while (m > 11) { m -= 12; y++; }
  }
  return out;
}

/** A tick label for a price: whole numbers print without decimals (C23). */
export function priceTick(v: number, step: number, symbol: string): string {
  const decimals = step >= 1 ? 0 : Math.min(4, Math.ceil(-Math.log10(step)));
  const n = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return `${v < 0 ? '−' : ''}${symbol}${n}`;
}

export default { segmentsOf, weekdaysBetween, ticks125, yDomain, logOffered, logTicks, xTicks, priceTick };
