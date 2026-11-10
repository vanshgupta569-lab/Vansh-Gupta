// FILE: verify/priceChartLocal.mts
//
//   npm run verify:chart
//
// THE PRICE CHART OVER THE REAL PRICE SERIES (`docs/COMPANY_OVERVIEW_SPEC.md`
// §3; build step 9 job 9.11's LOCAL half, listed in `docs/CLOUD_RUN_LOG.md`).
//
// The cloud run checked the chart's arithmetic on fixtures, where every gap and
// every scale was written by hand. Three things only the real series can
// answer, and the run log asks for each of them:
//
//   1. GAPS against real exchange calendars. The chart has no calendar, so a
//      weekday stands in for a trading day and one or two missing weekdays are
//      read as holidays. This measures what that rule actually produces across
//      every series in the set: how many gaps it finds, how long they are, and
//      whether any of them is a real suspension rather than a holiday it
//      mis-reads.
//   2. WHEN THE LOG SCALE IS OFFERED on real 10Y and Max ranges, rather than on
//      a made-up twentyfold series.
//   3. WHETHER THE SOURCE LINE COVERS SPLITS — the one question that decides
//      whether the chart is honest at all, because an unadjusted series shows a
//      split as a crash. Measured by looking for a one-day fall that matches a
//      common split ratio: a real series that is adjusted has none.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..').split(path.sep).join('/');
const PAYLOADS = path.join(REPO, 'verify', 'payloads');

const { segmentsOf, logOffered, yDomain, LOG_RATIO, GAP_MIN_WEEKDAYS, weekdaysBetween } =
  await import(`file:///${REPO}/src/data/chartScale.ts`);

let problems = 0;
const fault = (s: string) => {
  problems++;
  console.log(`  PROBLEM: ${s}`);
};

console.log('\n=== the price chart over the real price series ===');

type Split = { date: string; ratio: number; label?: string };
type Series = { ticker: string; points: { date: string; value: number }[]; splits: Split[] };
const all: Series[] = [];
for (const f of fs.readdirSync(PAYLOADS).filter((x) => x.endsWith('.json'))) {
  let p: any;
  try {
    p = JSON.parse(fs.readFileSync(path.join(PAYLOADS, f), 'utf8'));
  } catch {
    continue;
  }
  // THE SERIES IS TWO PARALLEL ARRAYS, dates and closes, as the fetcher keeps
  // it (`quote.history.daily`): one list of dates beside one list of closes
  // rather than a list of objects. Zipped here, and a length mismatch is a
  // fault in itself — it would shift every close onto the wrong day, which is
  // exactly the kind of error a chart hides perfectly.
  const daily = p?.quote?.history?.daily;
  const dates: any[] = Array.isArray(daily?.dates) ? daily.dates : [];
  const closes: any[] = Array.isArray(daily?.closes) ? daily.closes : [];
  if (dates.length && closes.length && dates.length !== closes.length) {
    fault(`${p.ticker}: ${dates.length} dates against ${closes.length} closes`);
  }
  const points = dates
    .map((d: any, i: number) => ({ date: String(d), value: Number(closes[i]) }))
    .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date) && isFinite(r.value) && r.value > 0);
  const splits: Split[] = (p?.quote?.splits || p?.splitAdjustment?.events || [])
    .map((e: any) => ({ date: String(e.date || ''), ratio: Number(e.ratio), label: e.label }))
    .filter((e: Split) => /^\d{4}-\d{2}-\d{2}$/.test(e.date) && isFinite(e.ratio) && e.ratio > 1);
  if (points.length > 50) all.push({ ticker: p.ticker, points, splits });
}

if (!all.length) {
  fault('no payload carries a price series, so nothing below was measured');
} else {
  console.log(`  ${all.length} companies carry a daily series; longest ${Math.max(...all.map((s) => s.points.length))} closes`);
}

// ---- 1. GAPS -------------------------------------------------------------
let totalGaps = 0;
let banded = 0;
let worst = 0;
let worstWhere = '';
const lengths: Record<number, number> = {};
for (const s of all) {
  const { segments, gaps } = segmentsOf(s.points, 'daily');
  totalGaps += gaps.length;
  for (const g of gaps) {
    lengths[g.missing] = (lengths[g.missing] ?? 0) + 1;
    if (g.band) banded++;
    if (g.missing > worst) {
      worst = g.missing;
      worstWhere = `${s.ticker} ${g.from} to ${g.to}`;
    }
    // THE RULE'S OWN BOUND: nothing under three missing weekdays may be
    // reported as a gap, because that is the holiday allowance.
    if (g.missing < GAP_MIN_WEEKDAYS) {
      fault(`${s.ticker}: a gap of ${g.missing} missing weekdays, under the ${GAP_MIN_WEEKDAYS} the rule allows for holidays`);
    }
    // And the band threshold must agree with the figure it is drawn from.
    if (g.band !== g.missing >= 4) {
      fault(`${s.ticker}: a ${g.missing}-day gap is ${g.band ? '' : 'not '}banded`);
    }
  }
  // EVERY CLOSE IS IN EXACTLY ONE SEGMENT. A point lost between segments is
  // a close the chart does not draw, which no amount of gap logic excuses.
  const drawn = segments.reduce((t: number, seg: any[]) => t + seg.length, 0);
  if (drawn !== s.points.length) {
    fault(`${s.ticker}: ${s.points.length} closes and ${drawn} drawn across ${segments.length} segments`);
  }
  // AND THE SEGMENTS ARE IN ORDER, with no segment bridging a gap.
  for (const seg of segments) {
    for (let i = 1; i < seg.length; i++) {
      if (weekdaysBetween(seg[i - 1].date, seg[i].date) >= GAP_MIN_WEEKDAYS) {
        fault(`${s.ticker}: one segment bridges ${seg[i - 1].date} to ${seg[i].date}`);
      }
    }
  }
}
const spread = Object.entries(lengths)
  .sort((a, b) => Number(a[0]) - Number(b[0]))
  .slice(0, 6)
  .map(([n, c]) => `${n}d x${c}`)
  .join(', ');
console.log(`  ${totalGaps} gaps found, ${banded} long enough to hatch; lengths ${spread}`);
console.log(`  longest ${worst} missing weekdays — ${worstWhere || 'none'}`);

// ---- 2. THE LOG SCALE ----------------------------------------------------
let offered10 = 0;
let offeredMax = 0;
let refused = 0;
for (const s of all) {
  const values = s.points.map((p) => p.value);
  // THE RANGE KEYS ARE THE MODULE'S OWN, and `MAX` is upper case. Asking for
  // 'Max' returned false for every company in the set, and the check read that
  // as 22 faults — the check's own error, not the chart's.
  const ten = logOffered('10Y', values);
  const max = logOffered('MAX', values);
  if (ten) offered10++;
  if (max) offeredMax++;
  if (!ten && !max) refused++;
  // THE RULE: offered only where the price has moved more than twentyfold.
  // Recomputed here from the series rather than read back from the function.
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const ratio = lo > 0 ? hi / lo : Infinity;
  const should = ratio > LOG_RATIO;
  if (max !== should) {
    fault(
      `${s.ticker}: the series moves ${ratio.toFixed(1)}x and the log scale is ${max ? 'offered' : 'withheld'} on Max`
    );
  }
  // And a short range must never offer it, whatever the ratio.
  for (const r of ['1M', '6M', '1Y', '5Y']) {
    if (logOffered(r, values)) fault(`${s.ticker}: the log scale is offered on ${r}`);
  }
}
console.log(
  `  the log scale is offered on 10Y for ${offered10} companies and on Max for ${offeredMax}; ${refused} never qualify`
);

// ---- 3. SPLITS, ASKED OF THE SOURCE'S OWN SPLIT LIST --------------------
//
// The payload carries the split events the source published
// (`quote.splits`), so this does not have to infer a split from the shape of
// the line: it goes to the dates where one HAPPENED and checks the series
// across each of them. An unadjusted series falls by the split ratio on that
// day; an adjusted one does not move unusually at all.
//
// This matters more than any other arm here, because an unadjusted line draws
// a 4-for-1 split as a 75% crash, and every drawdown a reader measures from it
// would be wrong.
let withSplits = 0;
let eventsChecked = 0;
let unadjusted = 0;
let untestable = 0;
for (const s of all) {
  if (!s.splits.length) continue;
  withSplits++;
  const byDate = new Map(s.points.map((p, i) => [p.date, i]));
  for (const ev of s.splits) {
    // The first close on or after the split date, and the one before it.
    let i = byDate.get(ev.date);
    if (i === undefined) {
      const at = s.points.findIndex((p) => p.date >= ev.date);
      if (at <= 0) continue;
      i = at;
    }
    if (i <= 0) continue;
    const before = s.points[i - 1].value;
    const after = s.points[i].value;
    eventsChecked++;
    const fall = before / after;
    // THE TEST ONLY MEANS SOMETHING WHERE THE RATIO IS FAR ENOUGH FROM 1.
    //
    // An unadjusted series falls BY the ratio on the split day, so "the fall
    // is within 3% of the ratio" is the signature. But for a 1.02-for-1 stock
    // dividend that band reaches below 1.00 and so contains NO MOVE AT ALL:
    // it fired on Canadian Natural and Itaú, whose closes had not fallen
    // (27.2674 to 27.33 is a RISE), and called a correctly adjusted series
    // unadjusted. Such an event cannot answer the question, so it is counted
    // as untestable and reported rather than failed.
    const TOL = 0.03;
    if (ev.ratio * (1 - TOL) <= 1 + TOL) {
      untestable++;
      continue;
    }
    if (Math.abs(fall - ev.ratio) <= ev.ratio * TOL) {
      unadjusted++;
      fault(
        `${s.ticker}: the ${ev.label || ev.ratio + '-for-1'} split on ${ev.date} shows as a fall from ${before} to ${after}, so the series is NOT split-adjusted`
      );
    }
  }
}
console.log(
  `  ${withSplits} companies carry a split in the source's own list, ${eventsChecked} events checked across the series`
);
const testable = eventsChecked - untestable;
console.log(
  `  ${testable} of those events are large enough to test; ${untestable} have a ratio so near 1 that a full split and no move at all look the same`
);
if (testable && !unadjusted) {
  console.log('  not one of the testable splits moves the line by its ratio: the source line is split-adjusted');
}
if (!eventsChecked) {
  fault('no split event fell inside any series, so the split question is unanswered');
}

// ---- 4. THE Y AXIS ON REAL VALUES ---------------------------------------
for (const s of all.slice(0, 40)) {
  const values = s.points.map((p) => p.value);
  const d = yDomain(values);
  if (!(d.lo <= Math.min(...values) && d.hi >= Math.max(...values))) {
    fault(`${s.ticker}: the axis ${d.lo}-${d.hi} does not contain the series`);
  }
  if (!d.ticks.length) fault(`${s.ticker}: the axis carries no ticks`);
  for (const t of d.ticks) {
    if (t < d.lo - 1e-9 || t > d.hi + 1e-9) fault(`${s.ticker}: a tick at ${t} is outside ${d.lo}-${d.hi}`);
  }
}

console.log(`\nTOTAL PROBLEMS IN THE PRICE CHART: ${problems}`);
