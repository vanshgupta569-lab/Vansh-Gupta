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
//   (the attribution — jobs C2 and C3 — is added below as they land)
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

export default {
  driversBetween,
  mixVersion,
  valueOfVersion,
  COST_OF_CAPITAL_KEYS,
};
