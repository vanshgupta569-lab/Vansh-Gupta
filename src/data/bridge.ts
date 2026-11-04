// FILE: src/data/bridge.ts
//
// THE VALUATION BRIDGE BETWEEN TWO VERSIONS OF ONE MODEL (build step 5, part C;
// `docs/VALUATION_SIDE_BY_SIDE_SPEC.md` part 2; `docs/STEP5_BUILD_PLAN.md`
// jobs C1–C4). Logic only: no screen reads this yet (that is job C5).
//
// The question it answers: version A of a model gave one value per share and
// version B gave another; how much of the change is associated with each thing
// that differs between them?
//
// WHAT IS IN HERE
//   driversBetween(A, B)  every input that differs, grouped into drivers the
//                         way rule 15 asks (C1)
//   mixVersion(A, B, S)   version A with the drivers in S taken from B (C1)
//   bridgeBetween(A, B)   the Shapley attribution of B − A to the drivers:
//                         exact up to 10 drivers (C2), sampled orders with a
//                         fixed seed above that (C3)
//   shapley(keys, value)  the attribution itself, for any value function, so
//                         the spec's worked example can be checked on its own
//
// THE ENGINE IS NOT TOUCHED. Every version — A, B and every mix of the two —
// is valued by `restoreFromJudgements`, the same path a saved model reopens
// through, so the bridge cannot explain a value the site would not show.
//
// THREE RULES THIS FILE KEEPS (VALUATION_SIDE_BY_SIDE rules 16, 17, 19)
//   - Every mixed version must be runnable. A mix the engine refuses is
//     reported with the engine's own sentence, and then there is no bridge:
//     leaving the mix out would make the parts stop adding up.
//   - The parts add up to the total exactly, after rounding too: rounding is by
//     largest remainder to the cent, so the displayed parts sum to the
//     displayed total.
//   - A driver whose change moves nothing gets exactly zero.

import { restoreFromJudgements } from './restoreModel';
import type { SavedJudgements } from './savedModels';

// ---------------------------------------------------------------------------
// C1 — THE DRIVERS
// ---------------------------------------------------------------------------

export type DriverGroup =
  | 'newFilings'
  | 'sharePrice'
  | 'costOfCapital'
  | 'forecast'
  | 'correction'
  | 'head'
  | 'qualitative'
  | 'viewMode';

export interface BridgeDriver {
  /** Unique within one bridge: the group, then the input it stands for. */
  key: string;
  group: DriverGroup;
  label: string;
  /** What it was in A and what it is in B, in words, for the table. */
  from: string;
  to: string;
}

export interface BridgeVersion {
  /** The untouched payload the version was built from (`record.rawFetched`). */
  fetched: any;
  judgements: SavedJudgements;
  label?: string;
}

/** The value a bridge explains (rule 20: never converted afterwards). */
export type BridgeMetric = 'perpetuity' | 'exitMultiple';

/**
 * The cost-of-capital inputs, which move together as ONE driver (rule 15):
 * the discount rate and what it is built from are not separable judgements,
 * and splitting them would credit the same change twice.
 */
export const COST_OF_CAPITAL_KEYS: readonly string[] = Object.freeze([
  'waccPct',
  'betaValue',
  'riskFreeRatePct',
  'marketRiskPremiumPct',
]);

/** Readable names for the slider keys a reader moves. */
const DRIVER_NAMES: Record<string, string> = {
  revenueGrowthPct: 'Revenue growth',
  operatingMarginPct: 'Operating margin',
  taxRatePct: 'Tax rate',
  capexPctOfRev: 'Capital spending',
  terminalGrowthPct: 'Terminal growth',
  sharesOutstandingBillion: 'Shares outstanding',
  netDebtBillion: 'Net debt',
  exitMultipleX: 'Exit multiple',
  rndMarginPct: 'R&D',
  sgaMarginPct: 'SG&A',
  depreciationPctOfAssets: 'Depreciation',
  dividendPayoutPct: 'Dividend payout',
};

/** Inputs that differ but cannot move the income-approach value (C-1). */
export interface NotBridged {
  input: 'peers' | 'recovery';
  why: string;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const show = (v: unknown): string => {
  if (v === undefined || v === null) return 'default';
  if (typeof v === 'number') return String(Math.round(v * 10000) / 10000);
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
};

function correctionFields(j: SavedJudgements): Set<string> {
  const out = new Set<string>();
  for (const year of Object.values(j.corrections || {})) for (const field of Object.keys(year || {})) out.add(field);
  for (const field of Object.keys(j.correctionReasons || {})) out.add(field);
  return out;
}

function correctionOf(j: SavedJudgements, field: string) {
  const years: Record<string, number> = {};
  for (const [year, fields] of Object.entries(j.corrections || {}))
    if (fields && field in fields) years[year] = (fields as any)[field];
  return { years, reason: (j.correctionReasons || {})[field] ?? null };
}

/**
 * Every input that differs between A and B, grouped into drivers (rule 13:
 * every changed input listed; rule 15: dependent inputs grouped; rule 18: new
 * filings are their own driver). Returned with the inputs that differ but are
 * not bridged in version 1, so nothing is dropped without saying so.
 */
export function driversBetween(A: BridgeVersion, B: BridgeVersion): { drivers: BridgeDriver[]; notBridged: NotBridged[] } {
  const a = A.judgements;
  const b = B.judgements;
  const drivers: BridgeDriver[] = [];

  if (!same(A.fetched, B.fetched))
    drivers.push({ key: 'newFilings', group: 'newFilings', label: 'New filings', from: 'the filings A was built on', to: 'the filings B was built on' });

  if (!same(a.sharePrice, b.sharePrice))
    drivers.push({ key: 'sharePrice', group: 'sharePrice', label: 'Share price', from: show(a.sharePrice), to: show(b.sharePrice) });

  const ad = a.drivers || {};
  const bd = b.drivers || {};
  const cocChanged = COST_OF_CAPITAL_KEYS.filter((k) => !same(ad[k], bd[k]));
  if (cocChanged.length)
    drivers.push({
      key: 'costOfCapital',
      group: 'costOfCapital',
      label: 'Cost of capital',
      from: cocChanged.map((k) => `${k} ${show(ad[k])}`).join(', '),
      to: cocChanged.map((k) => `${k} ${show(bd[k])}`).join(', '),
    });

  const sliderKeys = [...new Set([...Object.keys(ad), ...Object.keys(bd)])]
    .filter((k) => !COST_OF_CAPITAL_KEYS.includes(k))
    .sort();
  for (const k of sliderKeys)
    if (!same(ad[k], bd[k]))
      drivers.push({ key: `forecast:${k}`, group: 'forecast', label: DRIVER_NAMES[k] || k, from: show(ad[k]), to: show(bd[k]) });

  const fields = [...new Set([...correctionFields(a), ...correctionFields(b)])].sort();
  for (const field of fields) {
    const ca = correctionOf(a, field);
    const cb = correctionOf(b, field);
    if (!same(ca, cb))
      drivers.push({
        key: `correction:${field}`,
        group: 'correction',
        label: `Corrected ${field}`,
        from: Object.keys(ca.years).length ? show(ca.years) : 'as filed',
        to: Object.keys(cb.years).length ? show(cb.years) : 'as filed',
      });
  }

  const lines = [...new Set([...Object.keys(a.heads || {}), ...Object.keys(b.heads || {})])].sort();
  for (const line of lines) {
    const ha = (a.heads || {})[line];
    const hb = (b.heads || {})[line];
    if (!same(ha, hb))
      drivers.push({ key: `head:${line}`, group: 'head', label: `${line} moved`, from: ha ? ha.head : 'default head', to: hb ? hb.head : 'default head' });
  }

  // The qualitative answers are ONE driver: their effects share caps
  // (`qualitativeFactors.ts`), so one answer's effect depends on the others.
  if (!same(a.appliedVerdicts, b.appliedVerdicts) || !same(a.verdicts, b.verdicts))
    drivers.push({
      key: 'qualitative',
      group: 'qualitative',
      label: 'Qualitative answers',
      from: `${Object.keys(a.appliedVerdicts || {}).length} applied`,
      to: `${Object.keys(b.appliedVerdicts || {}).length} applied`,
    });

  if (!same(a.viewMode, b.viewMode))
    drivers.push({ key: 'viewMode', group: 'viewMode', label: 'Model view', from: show(a.viewMode), to: show(b.viewMode) });

  const notBridged: NotBridged[] = [];
  if (!same(a.peers, b.peers))
    notBridged.push({ input: 'peers', why: 'The peer set moves only the market approach, which version 1 of the bridge does not explain.' });
  if (!same(a.recovery, b.recovery))
    notBridged.push({ input: 'recovery', why: 'Recovery rates move only the asset approach, which version 1 of the bridge does not explain.' });

  return { drivers, notBridged };
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v ?? null));

/**
 * Version A with the drivers named in `take` taken from B, and everything else
 * left as A had it. `take` holds driver keys from `driversBetween(A, B)`.
 */
export function mixVersion(A: BridgeVersion, B: BridgeVersion, take: Iterable<string>): BridgeVersion {
  const keys = new Set(take);
  const j: SavedJudgements = clone(A.judgements);
  const b = B.judgements;
  j.drivers = j.drivers || {};
  const setOrDelete = (target: Record<string, any>, k: string, v: any) => {
    if (v === undefined || v === null) delete target[k];
    else target[k] = v;
  };

  for (const key of keys) {
    if (key === 'newFilings') continue;
    if (key === 'sharePrice') j.sharePrice = b.sharePrice ?? null;
    else if (key === 'costOfCapital') for (const k of COST_OF_CAPITAL_KEYS) setOrDelete(j.drivers, k, (b.drivers || {})[k]);
    else if (key.startsWith('forecast:')) setOrDelete(j.drivers, key.slice(9), (b.drivers || {})[key.slice(9)]);
    else if (key.startsWith('correction:')) {
      const field = key.slice(11);
      j.corrections = j.corrections || {};
      for (const year of Object.keys(j.corrections)) {
        delete (j.corrections[year] as any)[field];
        if (!Object.keys(j.corrections[year]).length) delete j.corrections[year];
      }
      for (const [year, v] of Object.entries(correctionOf(b, field).years)) {
        j.corrections[year] = j.corrections[year] || {};
        (j.corrections[year] as any)[field] = v;
      }
      j.correctionReasons = j.correctionReasons || {};
      setOrDelete(j.correctionReasons, field, (b.correctionReasons || {})[field]);
    } else if (key.startsWith('head:')) {
      j.heads = j.heads || {};
      setOrDelete(j.heads as any, key.slice(5), clone((b.heads || {})[key.slice(5)]));
    } else if (key === 'qualitative') {
      j.verdicts = clone(b.verdicts || {});
      j.appliedVerdicts = clone(b.appliedVerdicts ?? null);
    } else if (key === 'viewMode') j.viewMode = b.viewMode;
    else throw new Error(`mixVersion: no such driver "${key}"`);
  }
  return { fetched: keys.has('newFilings') ? B.fetched : A.fetched, judgements: j };
}

/** One version's value, or the engine's refusal. */
export function valueOfVersion(v: BridgeVersion, metric: BridgeMetric = 'perpetuity'): { value: number | null; refusal: string | null } {
  try {
    const r: any = restoreFromJudgements(v.fetched, v.judgements);
    const value = r?.[metric];
    if (typeof value === 'number' && isFinite(value)) return { value, refusal: null };
    return { value: null, refusal: r?.refusal || `The engine produced no ${metric === 'perpetuity' ? 'perpetuity' : 'exit-multiple'} value for this mix.` };
  } catch (error: any) {
    return { value: null, refusal: error?.message || 'The model could not be built from this mix.' };
  }
}

// ---------------------------------------------------------------------------
// C2 / C3 — THE ATTRIBUTION
// ---------------------------------------------------------------------------

/** Exact attribution up to this many drivers: 2^10 = 1,024 runs. */
export const EXACT_LIMIT = 10;
/** Orders sampled above the limit, and the seed they are drawn with. */
export const SAMPLED_ORDERS = 2000;
export const SAMPLE_SEED = 20261104;

export interface BridgePart {
  key: string;
  /** Unrounded share of the total. */
  raw: number;
  /** Rounded to the cent by largest remainder, so the parts add up. */
  rounded: number;
}

export interface ShapleyResult {
  ok: boolean;
  method: 'exact' | 'sampled';
  /** Distinct subsets valued (every engine run). */
  runs: number;
  /** v(A) and v(B): the empty set and the full set. */
  start: number | null;
  end: number | null;
  /** end − start, and the same rounded to the cent. */
  total: number | null;
  totalRounded: number | null;
  parts: BridgePart[];
  /** Every subset the value function refused, with its reason (rule 16). */
  refused: { take: string[]; refusal: string }[];
  /** Orders sampled (sampled method only) and the seed. */
  orders?: number;
  seed?: number;
}

/** A small seeded generator, so a sampled bridge is the same every time. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Round each part to the cent so that the rounded parts sum exactly to the
 * rounded total (rule 17): floor every part, then hand the cents left over to
 * the parts with the largest remainders, ties to the earlier driver.
 */
export function largestRemainder(raw: number[], totalRounded: number): number[] {
  const cents = raw.map((r) => r * 100);
  const floors = cents.map((c) => Math.floor(c + 1e-9));
  let left = Math.round(totalRounded * 100) - floors.reduce((s, f) => s + f, 0);
  const order = cents
    .map((c, i) => ({ i, rem: c - floors[i] }))
    .sort((x, y) => y.rem - x.rem || x.i - y.i);
  const out = [...floors];
  for (let n = 0; left > 0 && n < order.length; n++, left--) out[order[n].i] += 1;
  for (let n = order.length - 1; left < 0 && n >= 0; n--, left++) out[order[n].i] -= 1;
  return out.map((c) => c / 100);
}

const factorial = (n: number) => {
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
};

/**
 * The Shapley attribution of v(all) − v(none) to `keys`, for any value
 * function of a subset. Exact (every subset, every weight) up to EXACT_LIMIT
 * drivers; above it, the average over SAMPLED_ORDERS orders drawn with a fixed
 * seed — each order's contributions sum to the total exactly, so their average
 * does too (rule 14).
 *
 * A value function that returns null for any subset it needs is a refusal, and
 * the result is `ok: false` with every refusal listed: a bridge with a hole in
 * it would not add up.
 */
export function shapley(
  keys: string[],
  value: (take: string[]) => { value: number | null; refusal: string | null },
  opts: { exactLimit?: number; orders?: number; seed?: number } = {}
): ShapleyResult {
  const k = keys.length;
  const exactLimit = opts.exactLimit ?? EXACT_LIMIT;
  const memo = new Map<number, number | null>();
  const refused: { take: string[]; refusal: string }[] = [];
  const subsetOf = (mask: number) => keys.filter((_, i) => mask & (1 << i));
  const v = (mask: number): number | null => {
    if (memo.has(mask)) return memo.get(mask)!;
    const take = subsetOf(mask);
    const r = value(take);
    memo.set(mask, r.value);
    if (r.value === null) refused.push({ take, refusal: r.refusal || 'refused' });
    return r.value;
  };

  const full = k ? (1 << k) - 1 : 0;
  const start = v(0);
  const end = v(full);
  const fail = (method: 'exact' | 'sampled'): ShapleyResult => ({
    ok: false, method, runs: memo.size, start, end, total: null, totalRounded: null, parts: [], refused,
  });
  if (start === null || end === null) return fail(k <= exactLimit ? 'exact' : 'sampled');

  const raw = new Array(k).fill(0);
  let method: 'exact' | 'sampled' = 'exact';
  let orders: number | undefined;
  let seed: number | undefined;

  if (k <= exactLimit) {
    const weights = Array.from({ length: k }, (_, s) => (factorial(s) * factorial(k - s - 1)) / factorial(k));
    for (let mask = 0; mask <= full; mask++) if (v(mask) === null) return fail('exact');
    for (let i = 0; i < k; i++) {
      const bit = 1 << i;
      for (let mask = 0; mask <= full; mask++) {
        if (mask & bit) continue;
        let size = 0;
        for (let m = mask; m; m &= m - 1) size++;
        raw[i] += weights[size] * ((memo.get(mask | bit) as number) - (memo.get(mask) as number));
      }
    }
  } else {
    method = 'sampled';
    orders = opts.orders ?? SAMPLED_ORDERS;
    seed = opts.seed ?? SAMPLE_SEED;
    const rand = mulberry32(seed);
    const order = keys.map((_, i) => i);
    for (let n = 0; n < orders; n++) {
      for (let i = k - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      let mask = 0;
      let prev = start;
      for (const i of order) {
        mask |= 1 << i;
        const next = v(mask);
        if (next === null) return fail('sampled');
        raw[i] += next - prev;
        prev = next;
      }
    }
    for (let i = 0; i < k; i++) raw[i] /= orders;
  }

  const total = end - start;
  const totalRounded = Math.round(total * 100) / 100;
  const rounded = largestRemainder(raw, totalRounded);
  return {
    ok: true,
    method,
    runs: memo.size,
    start,
    end,
    total,
    totalRounded,
    parts: keys.map((key, i) => ({ key, raw: raw[i], rounded: rounded[i] })),
    refused,
    orders,
    seed,
  };
}

/**
 * "% of total" is not meaningful when the total is too small to divide by
 * (rule 19). Threshold: a change under half a percent of version A's value.
 * APPROVED, Nihar, 4 November 2026 (`docs/STEP5_BUILD_PLAN.md` §6, C-3).
 */
export const SHARE_NOT_MEANINGFUL_BELOW = 0.005;

export function shareOfTotal(part: number, total: number, start: number): number | null {
  if (!isFinite(total) || !isFinite(start) || Math.abs(total) < SHARE_NOT_MEANINGFUL_BELOW * Math.abs(start)) return null;
  return part / total;
}

export interface BridgeResult extends ShapleyResult {
  metric: BridgeMetric;
  drivers: BridgeDriver[];
  notBridged: NotBridged[];
  /** Wall-clock time for the whole attribution, in milliseconds (C4). */
  ms: number;
}

/** The bridge between two saved versions of the same model. */
export function bridgeBetween(
  A: BridgeVersion,
  B: BridgeVersion,
  opts: { metric?: BridgeMetric; exactLimit?: number; orders?: number; seed?: number } = {}
): BridgeResult {
  const metric = opts.metric ?? 'perpetuity';
  const t0 = Date.now();
  const { drivers, notBridged } = driversBetween(A, B);
  const keys = drivers.map((d) => d.key);
  const result = shapley(keys, (take) => valueOfVersion(mixVersion(A, B, take), metric), opts);
  return { ...result, metric, drivers, notBridged, ms: Date.now() - t0 };
}

export default {
  driversBetween,
  mixVersion,
  valueOfVersion,
  shapley,
  bridgeBetween,
  largestRemainder,
  shareOfTotal,
  mulberry32,
  COST_OF_CAPITAL_KEYS,
  EXACT_LIMIT,
  SAMPLED_ORDERS,
  SAMPLE_SEED,
};
