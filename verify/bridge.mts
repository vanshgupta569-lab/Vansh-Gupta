// FILE: verify/bridge.mts
//
// The valuation bridge (`src/data/bridge.ts`, build step 5 part C), checked on
// the paper company in `verify/fixtures/paperCompany.mts`, so it needs no
// payloads and runs in `npm run verify` wherever that runs.
//
// Each block is one job of `docs/STEP5_BUILD_PLAN.md` and was proved to fail
// by breaking the thing it guards (see the commit that added it).

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..').split(path.sep).join('/');

const BR: any = await import(`file:///${REPO}/src/data/bridge.ts`);
const SM: any = await import(`file:///${REPO}/src/data/savedModels.ts`);
const R: any = await import(`file:///${REPO}/src/data/restoreModel.ts`);
const FX: any = await import(`file:///${REPO}/verify/fixtures/paperCompany.mts`);

export interface BridgeReport {
  problems: string[];
  lines: string[];
}

const clone = (v: any) => JSON.parse(JSON.stringify(v));

/**
 * Two versions of the paper company's model that differ in a known set of
 * inputs, listed by hand here — not read from `driversBetween`, so the check
 * compares the bridge's grouping against an independent account of what was
 * changed (CLAUDE.md: never compare a figure against itself).
 */
export function fixtureVersions() {
  const fetched = FX.paperPayload('valued');
  const A = { fetched, judgements: { ...SM.emptyJudgements(), sharePrice: 22.5 } };
  const base: any = R.restoreFromJudgements(fetched, A.judgements).drivers;
  const lastYear = String(fetched.statements[fetched.statements.length - 1].fiscalYear);
  const lastRevenue = fetched.statements[fetched.statements.length - 1].revenue;
  const bj: any = clone(A.judgements);
  bj.sharePrice = 25;
  bj.drivers = {
    revenueGrowthPct: base.revenueGrowthPct + 2,
    operatingMarginPct: base.operatingMarginPct + 1,
    waccPct: base.waccPct - 0.5,
    terminalGrowthPct: base.terminalGrowthPct + 0.25,
  };
  bj.corrections = { [lastYear]: { revenue: lastRevenue * 1.05 } };
  bj.correctionReasons = { revenue: 'fixture: restated revenue' };
  const B = { fetched, judgements: bj };
  // What was changed, by hand: one driver per input, the cost of capital as
  // one, the correction as one per field.
  const expected = [
    'sharePrice',
    'costOfCapital',
    'forecast:operatingMarginPct',
    'forecast:revenueGrowthPct',
    'forecast:terminalGrowthPct',
    'correction:revenue',
  ].sort();
  return { A, B, expected, lastYear };
}

export async function checkBridge(): Promise<BridgeReport> {
  const problems: string[] = [];
  const lines: string[] = [];
  const { A, B, expected } = fixtureVersions();
  const near = (x: number | null, y: number | null) =>
    x !== null && y !== null && Math.abs(x - y) <= 1e-9 * Math.max(1, Math.abs(y));

  // ---- C1. THE DRIVERS, AND EVERY MIX RUNNABLE ---------------------------
  {
    const { drivers, notBridged } = BR.driversBetween(A, B);
    const keys = drivers.map((d: any) => d.key).sort();
    const missing = expected.filter((k) => !keys.includes(k));
    const extra = keys.filter((k: string) => !expected.includes(k));
    if (missing.length || extra.length)
      problems.push(
        `C1: the drivers between the two fixture versions are [${keys.join(', ')}]; ` +
          `expected exactly [${expected.join(', ')}]` +
          (missing.length ? `, missing ${missing.join(', ')}` : '') +
          (extra.length ? `, not expected ${extra.join(', ')}` : '')
      );
    if (new Set(keys).size !== keys.length) problems.push(`C1: a driver key appears twice: [${keys.join(', ')}]`);
    if (notBridged.length) problems.push(`C1: ${notBridged.length} inputs reported as not bridged where none differ`);

    const before = JSON.stringify(A.judgements);
    const vA = BR.valueOfVersion(A).value;
    const vB = BR.valueOfVersion(B).value;
    const none = BR.valueOfVersion(BR.mixVersion(A, B, [])).value;
    const all = BR.valueOfVersion(BR.mixVersion(A, B, keys)).value;
    if (vA === null || vB === null) problems.push('C1: a fixture version has no perpetuity value');
    if (!near(none, vA)) problems.push(`C1: A with nothing taken from B is ${none}, not A's ${vA}`);
    if (!near(all, vB)) problems.push(`C1: A with every driver taken from B is ${all}, not B's ${vB}`);
    if (JSON.stringify(A.judgements) !== before) problems.push('C1: mixing changed version A itself');

    // Each driver on its own moves the value (every one of these was chosen to
    // move it), so a driver whose mix does nothing has lost its input.
    const inert = keys.filter((k: string) => {
      const v = BR.valueOfVersion(BR.mixVersion(A, B, [k])).value;
      return near(v, vA);
    });
    if (inert.length) problems.push(`C1: taking only ${inert.join(', ')} from B leaves A's value unchanged`);

    // A mix the engine refuses is reported with the engine's sentence, not
    // skipped and not thrown.
    const refusedFetched = FX.paperPayload('refused');
    const R2 = { fetched: refusedFetched, judgements: clone(B.judgements) };
    const d2 = BR.driversBetween(A, R2).drivers.map((d: any) => d.key);
    const refused = BR.valueOfVersion(BR.mixVersion(A, R2, ['newFilings']));
    if (!d2.includes('newFilings')) problems.push('C1: different filings are not listed as the "New filings" driver');
    if (refused.value !== null || !refused.refusal) problems.push('C1: a mix on filings the engine refuses was not reported as a refusal with a reason');

    // Peers and recovery rates differ without moving the income value: listed
    // as not bridged, never silently dropped.
    const P = { fetched: A.fetched, judgements: { ...clone(A.judgements), peers: ['AAA', 'BBB'] } };
    const p = BR.driversBetween(A, P);
    if (p.drivers.length || p.notBridged.length !== 1 || p.notBridged[0].input !== 'peers')
      problems.push('C1: a changed peer set is not reported as not bridged');

    lines.push(
      `C1: ${keys.length} drivers between the fixture versions, exactly the ${expected.length} changed by hand; ` +
        `A with none of B is A (${vA?.toFixed(4)}), with all of B is B (${vB?.toFixed(4)}); each driver moves the value alone; ` +
        `a refused mix reports "${String(refused.refusal).slice(0, 60)}…"; a changed peer set is listed as not bridged`
    );
  }

  // ---- C2. EXACT SHAPLEY, THE SPEC'S WORKED EXAMPLE, AND EXACT SUMS ------
  {
    // VALUATION_SIDE_BY_SIDE part 2: V = FCF / (WACC - g). A: 100, 10%, 3%;
    // B: 110, 9%, 3.5%. The expected figures are the spec's, written here,
    // not computed by the code under test.
    const A0: any = { FCF: 100, WACC: 0.1, g: 0.03 };
    const B0: any = { FCF: 110, WACC: 0.09, g: 0.035 };
    const value = (take: string[]) => {
      const x: any = { ...A0 };
      for (const k of take) x[k] = B0[k];
      return { value: x.FCF / (x.WACC - x.g), refusal: null };
    };
    const r = BR.shapley(['FCF', 'WACC', 'g'], value);
    const got = Object.fromEntries(r.parts.map((p: any) => [p.key, p.rounded]));
    const want: Record<string, number> = { FCF: 161.64, WACC: 272.2, g: 137.59 };
    const centsOff = (x: number, y: number) => Math.round(x * 100) !== Math.round(y * 100);
    if (!r.ok || r.method !== 'exact') problems.push(`C2: the worked example did not run as an exact attribution (${r.method}, ok ${r.ok})`);
    if (centsOff(r.start, 1428.57) || centsOff(r.end, 2000)) problems.push(`C2: the worked example's versions are ${r.start} and ${r.end}, not 1,428.57 and 2,000.00`);
    if (centsOff(r.totalRounded, 571.43)) problems.push(`C2: the worked example's change is ${r.totalRounded}, not +571.43`);
    for (const [k, v] of Object.entries(want))
      if (centsOff(got[k], v)) problems.push(`C2: the worked example gives ${k} ${got[k]}, not the spec's ${v}`);
    const gRaw = r.parts.find((p: any) => p.key === 'g')?.raw;
    if (Math.floor(gRaw * 100) !== 13758) problems.push(`C2: growth's unrounded share is ${gRaw}, not the spec's 137.58 before rounding`);
    if (r.runs !== 8) problems.push(`C2: three drivers took ${r.runs} runs, not 2^3 = 8`);
    // The methods the spec rejects give other answers, which is why it rejects
    // them: one-at-a-time from A sums to 490.84 and leaves 80.59 unexplained.
    const solo = ['FCF', 'WACC', 'g'].reduce((sum, k) => sum + (value([k]).value - value([]).value), 0);
    if (centsOff(solo, 490.84)) problems.push(`C2: one-at-a-time from A sums to ${solo.toFixed(2)}, not the spec's 490.84`);
    lines.push(
      `C2: the worked example gives FCF ${got.FCF.toFixed(2)}, WACC ${got.WACC.toFixed(2)}, growth ${got.g.toFixed(2)} ` +
        `(raw ${gRaw.toFixed(4)}), summing to ${r.totalRounded.toFixed(2)} in ${r.runs} runs; one-at-a-time would give ${solo.toFixed(2)}`
    );

    // On the model itself: the six-driver fixture pair, plus a seventh driver
    // that changes no value (a correction's reason alone), must add up to the
    // cent and give the inert driver exactly zero.
    const { A, B } = fixtureVersions();
    const B7: any = { fetched: B.fetched, judgements: clone(B.judgements) };
    B7.judgements.correctionReasons = { ...B7.judgements.correctionReasons, sga: 'fixture: a reason with no correction' };
    const bridge = BR.bridgeBetween(A, B7);
    const sum = bridge.parts.reduce((t: number, p: any) => t + Math.round(p.rounded * 100), 0);
    if (!bridge.ok) problems.push(`C2: the fixture bridge did not run (${bridge.refused.map((x: any) => x.refusal).join('; ')})`);
    else {
      if (sum !== Math.round(bridge.totalRounded * 100))
        problems.push(`C2: the fixture bridge's parts sum to ${sum / 100}, not its total ${bridge.totalRounded}`);
      const rawSum = bridge.parts.reduce((t: number, p: any) => t + p.raw, 0);
      if (Math.abs(rawSum - bridge.total) > 1e-9) problems.push(`C2: unrounded parts sum to ${rawSum}, not ${bridge.total}`);
      const inert = bridge.parts.find((p: any) => p.key === 'correction:sga');
      if (!inert) problems.push('C2: the reason-only change is not listed as a driver (rule 13: every changed input)');
      else if (inert.raw !== 0 || inert.rounded !== 0) problems.push(`C2: a driver that changes nothing got ${inert.raw}, not exactly 0 (rule 19)`);
      if (bridge.runs !== 2 ** bridge.drivers.length) problems.push(`C2: ${bridge.drivers.length} drivers took ${bridge.runs} runs, not ${2 ** bridge.drivers.length}`);
      lines.push(
        `C2: the fixture bridge, ${bridge.drivers.length} drivers in ${bridge.runs} runs (${bridge.ms}ms): ` +
          bridge.parts.map((p: any) => `${p.key} ${p.rounded >= 0 ? '+' : ''}${p.rounded.toFixed(2)}`).join(', ') +
          ` = ${bridge.totalRounded.toFixed(2)}, parts = total to the cent; the reason-only change is exactly 0`
      );
    }

    // A refused mix leaves no bridge, and says which mix and why.
    const Rf = { fetched: FX.paperPayload('refused'), judgements: clone(B.judgements) };
    const refusedBridge = BR.bridgeBetween(A, Rf);
    if (refusedBridge.ok || !refusedBridge.refused.length || !refusedBridge.refused[0].refusal)
      problems.push('C2: a bridge with a refused mix was not reported as refused, with the mix and the reason');
  }

  // ---- C3. ABOVE TEN DRIVERS: SAMPLED ORDERS, A FIXED SEED -------------
  {
    // Fourteen drivers with interactions, cheap enough that the exact answer
    // can be computed too (2^14 runs) to measure the sampled one against.
    const n = 14;
    const keys = Array.from({ length: n }, (_, i) => `d${i + 1}`);
    const a = keys.map((_, i) => 1 + ((i * 7) % 5));
    const b = keys.map((_, i) => 0.05 + ((i * 3) % 4) / 40);
    const value = (take: string[]) => {
      const on = new Set(take);
      let lin = 10;
      let prod = 1;
      keys.forEach((k, i) => {
        if (on.has(k)) {
          lin += a[i];
          prod *= 1 + b[i];
        }
      });
      return { value: lin * lin * 0.01 + 40 * prod, refusal: null };
    };
    const sampled = BR.shapley(keys, value);
    const again = BR.shapley(keys, value);
    const otherSeed = BR.shapley(keys, value, { seed: BR.SAMPLE_SEED + 1 });
    const exact = BR.shapley(keys, value, { exactLimit: n });
    if (sampled.method !== 'sampled') problems.push(`C3: ${n} drivers ran as ${sampled.method}, not sampled`);
    if (sampled.seed !== BR.SAMPLE_SEED || sampled.orders !== BR.SAMPLED_ORDERS)
      problems.push(`C3: the sampled run did not record the fixed seed and order count (${sampled.seed}, ${sampled.orders})`);
    const rawSum = sampled.parts.reduce((t: number, p: any) => t + p.raw, 0);
    const cents = sampled.parts.reduce((t: number, p: any) => t + Math.round(p.rounded * 100), 0);
    if (Math.abs(rawSum - sampled.total) > 1e-9 * Math.max(1, Math.abs(sampled.total)))
      problems.push(`C3: sampled parts sum to ${rawSum}, not the total ${sampled.total}`);
    if (cents !== Math.round(sampled.totalRounded * 100)) problems.push(`C3: sampled parts round to ${cents / 100}, not ${sampled.totalRounded}`);
    if (JSON.stringify(sampled.parts) !== JSON.stringify(again.parts)) problems.push('C3: the same seed gave different parts');
    if (JSON.stringify(sampled.parts) === JSON.stringify(otherSeed.parts)) problems.push('C3: a different seed gave identical parts, so the seed is not used');
    // How close sampling comes, measured and bounded: the largest gap between
    // a sampled part and the exact part, as a share of the total change.
    const worst = Math.max(...sampled.parts.map((p: any, i: number) => Math.abs(p.raw - exact.parts[i].raw)));
    const share = worst / Math.abs(exact.total);
    const TOLERANCE = 0.01;
    if (share > TOLERANCE)
      problems.push(`C3: a sampled part is ${worst.toFixed(4)} from the exact one, ${(share * 100).toFixed(2)}% of the total, over the ${TOLERANCE * 100}% recorded`);
    lines.push(
      `C3: ${n} drivers, ${BR.SAMPLED_ORDERS} orders from seed ${BR.SAMPLE_SEED}, ${sampled.runs} runs: parts sum to the total exactly, ` +
        `repeatable on the seed, different on another; worst part ${worst.toFixed(4)} from the exact (${exact.runs} runs), ` +
        `${(share * 100).toFixed(3)}% of the ${exact.total.toFixed(2)} total, inside the ${TOLERANCE * 100}% tolerance`
    );
  }

  return { problems, lines };
}
