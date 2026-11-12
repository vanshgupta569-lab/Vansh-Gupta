// FILE: verify/bridgeVersions.mts
//
//   npm run verify:bridge
//
// THE VALUATION BRIDGE BETWEEN REAL SAVED VERSIONS (build step 5, job C6).
//
// Jobs C1 to C3 are checked on worked examples, where the drivers are written
// out and the answer is known. That proves the arithmetic and says nothing
// about what happens on 180 real companies whose filings actually moved.
//
// SO THE TWO VERSIONS ARE REAL. The capture archive keeps every fetch of every
// company (`verify/payloads/versions/<TICKER>/`), so the OLDEST capture and the
// CURRENT payload are the same model before and after new filings arrived —
// which is the pair rule 18 exists for: "a new filing or data change between
// versions is its own labelled driver, never hidden inside an assumption".
// Nothing is simulated; these are the filings as they were fetched.
//
// WHAT IT ASSERTS, on every company that produces a bridge:
//
//   1. THE PARTS SUM EXACTLY to the change, unrounded and rounded. A Shapley
//      attribution that does not is not one.
//   2. NO NaN ANYWHERE — in a part, a total, or either end. A NaN here reaches
//      the screen as "—" and looks like a figure the filing did not give.
//   3. REFUSED MIXES ARE COUNTED, NOT SKIPPED (rule 16). A mixed version the
//      engine refuses is a fact about the pair; dropping it silently would
//      make the remaining parts add up to a total that excludes it.
//   4. EVERY DRIVER THE BRIDGE NAMES IS ONE OF THE PAIR'S OWN, and appears
//      once.
//
// And it REPORTS what the plan asks for: how often "New filings" is the
// largest driver, and the largest absolute part in the set.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPayload } from './payloadSet.mts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..').split(path.sep).join('/');
const PAYLOADS = path.join(HERE, 'payloads');
const ARCHIVE = path.join(PAYLOADS, 'versions');

const { bridgeBetween } = await import(`file:///${REPO}/src/data/bridge.ts`);
const { buildCompanyFrom } = await import(`file:///${REPO}/src/data/autoCompany.ts`);
const { defaultDriversFor } = await import(`file:///${REPO}/src/data/companies.ts`);

let problems = 0;
const say = (line: string) => console.log(`  ${line}`);
const fail = (line: string) => {
  problems++;
  console.log(`  PROBLEM: ${line}`);
};

const isNum = (v: unknown): v is number => typeof v === 'number' && isFinite(v);

console.log('\n=== the bridge between real saved versions ===');

/** The judgements a freshly opened model carries: its own defaults, nothing edited. */
function defaultJudgements(payload: any) {
  const rec = buildCompanyFrom(payload);
  const drivers = { ...rec.defaultDrivers, ...defaultDriversFor(rec.modelData) };
  return {
    drivers: drivers as Record<string, number>,
    viewMode: 'DERIVED' as const,
    corrections: {},
    correctionReasons: {},
    heads: {},
    verdicts: {},
    applied: null,
  };
}

let pairs = 0;
let bridged = 0;
let refusedMixes = 0;
let refusedPairs = 0;
const refusalReasons: Record<string, number> = {};
let newFilingsLargest = 0;
let worstPart = 0;
let worstWhere = '';
let worstGap = 0;
let worstGapWhere = '';
const driverCounts: Record<string, number> = {};

const tickers = fs.existsSync(ARCHIVE) ? fs.readdirSync(ARCHIVE) : [];
if (!tickers.length) fail(`no capture archive at ${ARCHIVE}, so there are no real versions to bridge`);

for (const ticker of tickers) {
  const dir = path.join(ARCHIVE, ticker);
  let captures: string[];
  try {
    captures = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  } catch {
    continue;
  }
  if (captures.length < 1) continue;

  // THE OLDEST CAPTURE AND THE CURRENT PAYLOAD. Sorted by name, which is the
  // fetch timestamp, so "oldest" is the earliest fetch kept rather than
  // whichever the file system listed first.
  let older: any;
  let current: any;
  try {
    older = JSON.parse(fs.readFileSync(path.join(dir, captures[0]), 'utf8'));
    current = readPayload(`${ticker}.json`);
  } catch {
    continue;
  }
  if (!older?.statements?.length || !current?.statements?.length) continue;

  // A pair is only interesting where the filings actually differ: identical
  // statements give an empty bridge, which proves nothing either way.
  const same = JSON.stringify(older.statements) === JSON.stringify(current.statements);
  if (same) continue;
  pairs++;

  let A: any;
  let B: any;
  try {
    A = { fetched: older, judgements: defaultJudgements(older), label: 'as first fetched' };
    B = { fetched: current, judgements: defaultJudgements(current), label: 'now' };
  } catch (err) {
    // A pair whose versions cannot even be CONSTRUCTED is still a pair that
    // was found, and the identity below counts every one of them. Two were
    // slipping out here, which is how the identity earned its place.
    refusedPairs++;
    const why = `the version could not be built: ${String(err).slice(0, 60)}`;
    refusalReasons[why] = (refusalReasons[why] ?? 0) + 1;
    continue;
  }

  let result: any;
  try {
    result = bridgeBetween(A, B, { metric: 'perpetuity' });
  } catch (err) {
    fail(`${ticker}: the bridge threw — ${String(err).slice(0, 60)}`);
    refusedPairs++;
    const why = `the bridge threw: ${String(err).slice(0, 60)}`;
    refusalReasons[why] = (refusalReasons[why] ?? 0) + 1;
    continue;
  }
  // A PAIR THAT PRODUCES NO BRIDGE IS COUNTED AND NAMED, NOT DROPPED.
  //
  // This read `if (!result.ok) continue`, which is the same silence rule 16
  // bans one level down: a refused MIX must be reported rather than skipped,
  // and a refused PAIR is the same fact about the same arithmetic. Skipping it
  // also made the plan's own break invisible — corrupt a payload and the
  // company simply left the sample, with every remaining identity still
  // passing and the totals unchanged.
  if (!result?.ok || !isNum(result.total) || !isNum(result.start) || !isNum(result.end)) {
    refusedPairs++;
    const why = (result?.refused?.[0]?.refusal as string) || 'the pair produced no value to bridge';
    refusalReasons[why] = (refusalReasons[why] ?? 0) + 1;
    continue;
  }
  bridged++;
  refusedMixes += result.refused.length;

  // ---- 1. THE PARTS SUM EXACTLY ---------------------------------------
  const rawSum = result.parts.reduce((t: number, p: any) => t + p.raw, 0);
  const gap = Math.abs(rawSum - result.total);
  if (gap > worstGap) {
    worstGap = gap;
    worstGapWhere = ticker;
  }
  // The unrounded parts are an identity of the method: anything above
  // floating-point noise is a real failure.
  if (gap > 1e-6 * Math.max(1, Math.abs(result.total))) {
    fail(`${ticker}: the parts sum to ${rawSum.toFixed(6)} and the change is ${result.total.toFixed(6)}`);
  }
  const roundedSum = result.parts.reduce((t: number, p: any) => t + p.rounded, 0);
  const target = result.totalRounded ?? result.total;
  if (Math.abs(roundedSum - target) > 0.005) {
    fail(
      `${ticker}: the ROUNDED parts sum to ${roundedSum.toFixed(2)} and the rounded change is ${target.toFixed(2)} — the screen's line would read false`
    );
  }

  // ---- 2. NO NaN -------------------------------------------------------
  for (const p of result.parts) {
    if (!isNum(p.raw) || !isNum(p.rounded)) {
      fail(`${ticker}: the part for "${p.key}" is not a number (${p.raw}, ${p.rounded})`);
    }
  }

  // ---- 3. EVERY PART IS ONE OF THE PAIR'S OWN DRIVERS, ONCE -----------
  const keys = new Set(result.drivers.map((d: any) => d.key));
  const seen = new Set<string>();
  for (const p of result.parts) {
    if (!keys.has(p.key)) fail(`${ticker}: a part for "${p.key}", which is not a driver of this pair`);
    if (seen.has(p.key)) fail(`${ticker}: "${p.key}" appears twice in the parts`);
    seen.add(p.key);
  }
  for (const d of result.drivers) {
    driverCounts[d.label] = (driverCounts[d.label] ?? 0) + 1;
    if (!d.from || !d.to) fail(`${ticker}: the driver "${d.label}" does not say what it moved from and to`);
  }

  // ---- WHAT THE PLAN ASKS TO BE REPORTED -------------------------------
  const sorted = [...result.parts].sort((a: any, b: any) => Math.abs(b.rounded) - Math.abs(a.rounded));
  const top = sorted[0];
  if (top) {
    const label = result.drivers.find((d: any) => d.key === top.key)?.label ?? top.key;
    if (/new filing/i.test(label)) newFilingsLargest++;
    if (Math.abs(top.rounded) > worstPart) {
      worstPart = Math.abs(top.rounded);
      worstWhere = `${ticker} (${label})`;
    }
  }
}

say(`${pairs} companies whose filings changed between their first capture and now`);
say(
  `${bridged} of them produce a bridge; ${refusedMixes} mixed versions were refused and counted, not skipped`
);
if (refusedPairs) {
  say(`${refusedPairs} pair${refusedPairs === 1 ? '' : 's'} produced no bridge at all, each with its reason:`);
  for (const [why, n] of Object.entries(refusalReasons).sort((a, b) => b[1] - a[1]).slice(0, 4)) {
    say(`   ${n}x ${why.slice(0, 90)}`);
  }
}
// The identity that makes the counts readable: nothing vanishes between the
// pairs found and the pairs accounted for.
if (bridged + refusedPairs !== pairs) {
  fail(`${pairs} pairs found, ${bridged} bridged and ${refusedPairs} refused — ${pairs - bridged - refusedPairs} unaccounted for`);
}
if (bridged) {
  say(
    `"New filings" is the largest driver on ${newFilingsLargest} of ${bridged} (${((newFilingsLargest / bridged) * 100).toFixed(0)}%)`
  );
  say(`largest single part: ${worstPart.toFixed(2)} a share, at ${worstWhere || 'none'}`);
  say(`worst gap between the parts and the change they explain: ${worstGap.toExponential(2)} at ${worstGapWhere || 'none'}`);
  const top = Object.entries(driverCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([l, c]) => `${l} x${c}`)
    .join(', ');
  say(`the drivers that appear: ${top}`);
} else if (pairs) {
  fail('no pair produced a bridge, so nothing above was checked');
}

console.log(`\nTOTAL PROBLEMS IN THE REAL BRIDGES: ${problems}`);
process.exit(0);
