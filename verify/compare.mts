// FILE: verify/compare.mts
//
// Measures two sweep snapshots against each other: what moved, by how much,
// and what gained or lost a value. This is the before/after every commit
// message quotes.
//
//   npm run verify:compare -- before after
//   npm run verify:compare -- before after --field wacc
//   npm run verify:compare -- before after --all
//
// The value it compares is what the site shows: the perpetuity value for a
// company with a DCF, the residual income value for a bank. Both terminal
// methods are reported, because a change can move one and not the other.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SNAPSHOTS = path.join(HERE, 'snapshots');

const args = process.argv.slice(2);
const [beforeTag, afterTag] = args.filter((a) => !a.startsWith('--'));
const showAll = args.includes('--all');
const fieldAt = args.indexOf('--field');
const field = fieldAt >= 0 ? args[fieldAt + 1] : null;

if (!beforeTag || !afterTag) {
  console.error('Usage: npm run verify:compare -- <beforeTag> <afterTag> [--all] [--field wacc]');
  process.exit(2);
}
const read = (tag: string) => {
  const p = path.join(SNAPSHOTS, `${tag}.json`);
  if (!fs.existsSync(p)) {
    console.error(`No snapshot "${tag}". Take one with:  npm run verify:sweep -- ${tag}`);
    process.exit(2);
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
};
const before = read(beforeTag);
const after = read(afterTag);

const isNum = (v: any) => typeof v === 'number' && isFinite(v);
const shown = (r: any) => (isNum(r?.residualIncome) ? r.residualIncome : isNum(r?.perpetuity) ? r.perpetuity : null);
const f2 = (v: any) => (isNum(v) ? v.toFixed(2) : String(v ?? '—'));

// Companies that gained or lost a value at all: the first thing to look at.
for (const t of Object.keys({ ...before, ...after }).sort()) {
  const x = before[t] ?? {};
  const y = after[t] ?? {};
  const had = shown(x) !== null;
  const has = shown(y) !== null;
  if (had === has) continue;
  const why = has ? '' : `  (${y.refusal ?? y.residualIncomeRefusal ?? y.buildError ?? y.fetchError ?? 'no value'})`;
  console.log(`${has ? 'NOW VALUED ' : 'NOW REFUSED'}  ${t.padEnd(13)}${f2(shown(x))} -> ${f2(shown(y))}${why}`);
}

type Row = { t: string; name: string; before: number; after: number; pct: number; x: any; y: any };
const rows: Row[] = [];
for (const t of Object.keys(after)) {
  const x = before[t];
  const y = after[t];
  const b = shown(x);
  const a = shown(y);
  if (b === null || a === null || b === 0) continue;
  rows.push({ t, name: String(y.name ?? t).slice(0, 26), before: b, after: a, pct: (a / b - 1) * 100, x, y });
}

const moved = rows.filter((r) => Math.abs(r.pct) > 0.05);
moved.sort((p, q) => Math.abs(q.pct) - Math.abs(p.pct));

console.log(`\n${'ticker'.padEnd(13)}${'company'.padEnd(28)}${beforeTag.padStart(12)}${afterTag.padStart(12)}${'change'.padStart(10)}`);
for (const r of (showAll ? rows : moved).slice(0, showAll ? rows.length : 25)) {
  console.log(
    `${r.t.padEnd(13)}${r.name.padEnd(28)}${r.before.toFixed(2).padStart(12)}${r.after.toFixed(2).padStart(12)}` +
      `${((r.pct >= 0 ? '+' : '') + r.pct.toFixed(1) + '%').padStart(10)}`
  );
}

const over5 = moved.filter((r) => Math.abs(r.pct) > 5);
const pcts = rows.map((r) => r.pct).sort((a, b) => a - b);
console.log(
  `\ncompared ${rows.length} valued on both sides; moved at all ${moved.length}; more than 5% ${over5.length}; ` +
    `up ${moved.filter((r) => r.pct > 0).length}, down ${moved.filter((r) => r.pct < 0).length}; ` +
    `median ${pcts.length ? pcts[Math.floor(pcts.length / 2)].toFixed(1) : '0.0'}%`
);

// The balance check must be zero on both sides, whatever else moved.
const bad = Object.entries(after).filter(([, r]: any) => (r.worstBalanceCheck ?? 0) > 0);
console.log(
  bad.length
    ? `BALANCE CHECK NOT ZERO for ${bad.length}: ${bad.slice(0, 8).map(([t, r]: any) => `${t} ${r.worstBalanceCheck.toFixed(2)}`).join(', ')}`
    : 'balance check zero for every reported year, every company'
);

// Any other recorded field, for the question a particular job is asking.
if (field) {
  console.log(`\n${field}, largest moves:`);
  const fRows = rows
    .filter((r) => isNum(r.x?.[field]) && isNum(r.y?.[field]) && Math.abs(r.y[field] - r.x[field]) > 1e-12)
    .sort((p, q) => Math.abs(q.y[field] - q.x[field]) - Math.abs(p.y[field] - p.x[field]));
  for (const r of fRows.slice(0, 15)) {
    console.log(`  ${r.t.padEnd(13)}${String(r.x[field]).slice(0, 14).padStart(16)} -> ${String(r.y[field]).slice(0, 14).padStart(16)}`);
  }
  if (!fRows.length) console.log('  no company moved on that field');
}
