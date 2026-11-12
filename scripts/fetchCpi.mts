// FILE: scripts/fetchCpi.mts
//
//   npm run cpi:fetch
//
// THE DEFLATOR THE REAL BASE RATES USE (build step 5, job D2).
//
// `docs/BASE_RATE_SPEC.md` rule 7: real and nominal both labelled, deflated
// with official CPI, BLS for the US. So this takes it from the Bureau of Labor
// Statistics itself — series CUUR0000SA0, "All items in U.S. city average, all
// urban consumers, not seasonally adjusted", which is the headline CPI-U.
//
// THE ANNUAL FIGURE IS THE AVERAGE OF THE TWELVE MONTHS, which is what BLS's
// own annual series is; the public v1 API returns monthly values and no annual
// row, so the average is computed here and a year with fewer than twelve
// months is REFUSED rather than averaged over what arrived. A part-year
// average silently understates or overstates a whole-year deflator, and the
// base rates would carry that error with no way to see it.
//
// SEVERAL SMALL REQUESTS, NOT TWO BIG ONES. The free tier documents a
// ten-year span but CAPS the number of points it returns, so a ten-year window
// came back with a subset — and the subset was missing a month of 2025, which
// is complete when that year is asked for on its own. The twelve-month guard
// above caught it and refused the year rather than averaging eleven months
// into a deflator; four-year windows return everything they are asked for.
//
// The result is committed — it is a short table of public figures from a US
// government source, it has to be identical for everyone rebuilding the base
// rates, and re-fetching it on every build would make the output depend on the
// day it ran.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const OUT = path.join(REPO, 'src', 'data', 'cpiUS.json');

const SERIES = 'CUUR0000SA0';
const CONTACT = 'Marginalia Research vanshgupta569@gmail.com';
const WINDOWS: [string, string][] = [
  ['2007', '2010'],
  ['2011', '2014'],
  ['2015', '2018'],
  ['2019', '2022'],
  ['2023', '2026'],
];

const monthly = new Map<string, number[]>();

for (const [from, to] of WINDOWS) {
  const res = await fetch('https://api.bls.gov/publicAPI/v1/timeseries/data/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': CONTACT },
    body: JSON.stringify({ seriesid: [SERIES], startyear: from, endyear: to }),
  });
  const body: any = await res.json();
  console.log(`${from}-${to}: ${body.status}${body.message?.length ? ` — ${body.message.join('; ')}` : ''}`);
  if (body.status !== 'REQUEST_SUCCEEDED') {
    // A refusal is the answer. Nothing here retries another way.
    console.log('REFUSED by BLS; nothing written.');
    process.exit(1);
  }
  for (const point of body.Results?.series?.[0]?.data ?? []) {
    // M01..M12 are the months; M13 is the annual average where BLS sends one.
    if (!/^M(0[1-9]|1[0-2])$/.test(point.period)) continue;
    const v = Number(point.value);
    if (!isFinite(v)) continue;
    const list = monthly.get(point.year) ?? [];
    list.push(v);
    monthly.set(point.year, list);
  }
}

// A YEAR THAT CAME BACK SHORT IS ASKED FOR AGAIN, ON ITS OWN.
//
// The free tier is rate-limited per day, and a windowed request can come back
// with fewer points than the window holds: 2025 arrived with eleven months
// once and with twelve on every later ask. Averaging eleven months into a
// whole-year deflator would be wrong in a way nothing downstream could see, so
// a short year is re-asked rather than accepted or quietly dropped. The
// current year is left short on purpose, because it IS short.
const thisYear = new Date().getUTCFullYear();
for (const [year, months] of [...monthly.entries()]) {
  if (months.length === 12 || Number(year) >= thisYear) continue;
  console.log(`  ${year} came back with ${months.length} months; asking for it on its own`);
  const res = await fetch('https://api.bls.gov/publicAPI/v1/timeseries/data/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': CONTACT },
    body: JSON.stringify({ seriesid: [SERIES], startyear: year, endyear: year }),
  });
  const body: any = await res.json();
  if (body.status !== 'REQUEST_SUCCEEDED') continue;
  const again: number[] = [];
  for (const point of body.Results?.series?.[0]?.data ?? []) {
    if (!/^M(0[1-9]|1[0-2])$/.test(point.period)) continue;
    const v = Number(point.value);
    if (isFinite(v)) again.push(v);
  }
  if (again.length > months.length) {
    console.log(`    it has ${again.length}`);
    monthly.set(year, again);
  }
}

const annual: Record<string, number> = {};
const partial: string[] = [];
for (const [year, months] of [...monthly.entries()].sort()) {
  if (months.length !== 12) {
    partial.push(`${year} (${months.length} months)`);
    continue;
  }
  annual[year] = Number((months.reduce((t, v) => t + v, 0) / 12).toFixed(3));
}

const years = Object.keys(annual).sort();
fs.writeFileSync(
  OUT,
  JSON.stringify(
    {
      source: 'US Bureau of Labor Statistics, public API v1',
      series: SERIES,
      seriesName: 'CPI-U, all items, U.S. city average, not seasonally adjusted',
      note: 'The annual figure is the average of the twelve monthly values, which is what the BLS annual series is. A year without twelve months is left out rather than averaged over what arrived.',
      fetchedAt: new Date().toISOString(),
      annual,
    },
    null,
    2
  ) + '\n'
);
console.log(`\n${years.length} whole years: ${years[0]} to ${years[years.length - 1]}`);
console.log(`  ${years[0]} = ${annual[years[0]]}, ${years[years.length - 1]} = ${annual[years[years.length - 1]]}`);
if (partial.length) console.log(`  left out, not twelve months: ${partial.join(', ')}`);
console.log(`  written to ${OUT}`);

// EVERY YEAR BETWEEN THE FIRST AND THE LAST, OR THE TABLE IS NOT A SERIES.
// A gap in the middle would deflate one end of a ten-year window with a
// different year's index and nothing would say so.
const first = Number(years[0]);
const last = Number(years[years.length - 1]);
const missing: number[] = [];
for (let y = first; y <= last; y++) if (!(String(y) in annual)) missing.push(y);
if (missing.length) {
  console.log(`  PROBLEM: no figure for ${missing.join(', ')} — the series has a hole in it`);
  process.exit(1);
}
console.log(`  unbroken from ${first} to ${last}`);
