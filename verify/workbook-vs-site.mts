// FILE: verify/workbook-vs-site.mts
//
// The site's promise is that the workbook reproduces what is on screen. This
// builds each company's workbook exactly as the dashboard does, recalculates
// every formula in it, and compares its value per share with the engine's, on
// both terminal methods.
//
//   npm run verify:workbook              every fetched payload
//   npm run verify:workbook -- AAPL MSFT just those
//
// The target is exact agreement, not closeness. Anything above 1e-6% is a
// difference in method and should be found and settled, deciding which side is
// right rather than making one copy the other (see KNOWN_ISSUES L27).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { HyperFormula } from 'hyperformula';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..').split(path.sep).join('/');
const PAYLOADS = path.join(HERE, 'payloads');

const ExcelJS = createRequire(`${REPO}/package.json`)('exceljs');
const { buildWorkbook } = await import(`file:///${REPO}/src/data/excelExport.ts`);
const { buildCompanyFrom } = await import(`file:///${REPO}/src/data/autoCompany.ts`);
const { calculateDCFFor, defaultDriversFor, buildFullModel } = await import(
  `file:///${REPO}/src/data/companies.ts`
);
const { buildModel, buildDCF } = await import(`file:///${REPO}/src/engine/model.js`);
const AAPL = (await import(`file:///${REPO}/src/data/AAPL.js`)).default;

const isNum = (v: any) => typeof v === 'number' && isFinite(v);
const colIdx = (s: string) => [...s].reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0) - 1;

// The DCF sheet's single-value column, and the rows the bridge ends on. These
// are placed by number in the generator, so they are named here once.
const VALUE_COL = 'E';
const ROW_PERPETUITY = 53;
const ROW_EXIT = 54;
const ROW_NET_DEBT = 49;
const ROW_NORMALISED = 34;

async function readBack(wb: any) {
  const buf = await wb.xlsx.writeBuffer();
  const loaded = new ExcelJS.Workbook();
  await loaded.xlsx.load(buf);
  const sheets: Record<string, any[][]> = {};
  loaded.eachSheet((ws: any) => {
    const grid: any[][] = [];
    ws.eachRow({ includeEmpty: false }, (row: any, rn: number) =>
      row.eachCell({ includeEmpty: true }, (cell: any, cn: number) => {
        const v = cell.value;
        (grid[rn - 1] ||= [])[cn - 1] = v && typeof v === 'object' && 'formula' in v ? `=${v.formula}` : v ?? null;
      })
    );
    for (let i = 0; i < grid.length; i++) grid[i] ||= [];
    sheets[ws.name] = grid;
  });
  const hf = HyperFormula.buildFromSheets(sheets, { licenseKey: 'gpl-v3' });
  const id = hf.getSheetId('DCFModel')!;
  return (row: number) => hf.getCellValue({ sheet: id, row: row - 1, col: colIdx(VALUE_COL) }) as number;
}

interface Case { ticker: string; name: string; model: any; dcf: any; source: any; symbol: string }

const cases: Case[] = [];
const asked = process.argv.slice(2).filter((a) => !a.startsWith('--'));

// The curated Apple file first: it is the reference the engine was built
// against, and the only model with hand-authored inputs.
if (!asked.length || asked.includes('AAPL-curated')) {
  const M = buildModel(AAPL);
  cases.push({
    ticker: 'AAPL-curated', name: 'Apple Inc. (curated)', model: M, dcf: buildDCF(M, AAPL),
    source: { meta: { source: 'curated' }, rawStatements: [] }, symbol: '$',
  });
}

if (fs.existsSync(PAYLOADS)) {
  const files = fs.readdirSync(PAYLOADS).filter((f) => f.endsWith('.json')).sort();
  for (const file of files) {
    const t = file.replace('.json', '');
    if (asked.length && !asked.includes(t)) continue;
    const payload = JSON.parse(fs.readFileSync(path.join(PAYLOADS, file), 'utf8'));
    if (payload.error || !payload.statements) continue;
    let rec: any;
    try { rec = buildCompanyFrom(payload); } catch { continue; }
    const src = rec.modelData;
    if (!src) continue;
    const drivers = { ...rec.defaultDrivers, ...defaultDriversFor(src) };
    if (calculateDCFFor(src, drivers, rec.price || null).applicable === false) continue;
    const { model, dcf } = buildFullModel(src, drivers);
    cases.push({ ticker: t, name: payload.name || t, model, dcf, source: src, symbol: payload.currencySymbol || '$' });
  }
}

if (!cases.length) {
  console.error('Nothing to compare. Fetch payloads first:  npm run verify:payloads');
  process.exit(2);
}

const worst = { perpetuity: 0, exit: 0, ticker: '' };
let checked = 0;
const problems: string[] = [];

for (const c of cases) {
  let at: (row: number) => number;
  try {
    const wb = await buildWorkbook({
      model: c.model, dcf: c.dcf, source: c.source,
      companyName: c.name, ticker: c.ticker, currencySymbol: c.symbol,
      unitLabel: `${c.symbol} millions`, modelLabel: 'Verification run',
    });
    at = await readBack(wb);
  } catch (e: any) {
    problems.push(`${c.ticker}: workbook build or recalculation failed - ${e.message.slice(0, 70)}`);
    continue;
  }

  const sitePerp = c.dcf.perpetuity?.valuePerShare;
  const siteExit = c.dcf.exitMultipleValuation?.valuePerShare;
  const gap = (wbv: number, site: number) => (isNum(wbv) && isNum(site) && site !== 0 ? Math.abs(wbv / site - 1) * 100 : NaN);
  const gp = gap(at(ROW_PERPETUITY), sitePerp);
  const ge = gap(at(ROW_EXIT), siteExit);
  checked++;

  if (!isFinite(gp) || !isFinite(ge)) {
    problems.push(`${c.ticker}: no comparable value (workbook ${at(ROW_PERPETUITY)}, site ${sitePerp})`);
    continue;
  }
  if (Math.max(gp, ge) > worst.perpetuity + worst.exit) {
    worst.perpetuity = gp; worst.exit = ge; worst.ticker = c.ticker;
  }
  // 1e-6% is far above floating point (the sweep runs at ~5e-9%) and far below
  // any difference in method.
  if (gp > 1e-6 || ge > 1e-6) {
    problems.push(
      `${c.ticker}: perpetuity workbook ${at(ROW_PERPETUITY).toFixed(4)} vs site ${sitePerp.toFixed(4)} (${gp.toFixed(4)}%), ` +
        `exit ${at(ROW_EXIT).toFixed(4)} vs ${siteExit.toFixed(4)} (${ge.toFixed(4)}%); ` +
        `net debt ${at(ROW_NET_DEBT).toFixed(0)} vs ${c.dcf.netDebt.toFixed(0)}, ` +
        `normalised terminal ${at(ROW_NORMALISED).toFixed(0)} vs ${c.dcf.normalisedFCF.toFixed(0)}`
    );
  }
}

console.log(`compared ${checked} models (curated Apple plus every fetched company with a DCF value)`);
console.log(
  `worst difference: ${worst.ticker || 'none'} ` +
    `perpetuity ${worst.perpetuity.toExponential(2)}%, exit multiple ${worst.exit.toExponential(2)}%`
);
if (problems.length) {
  console.log(`\nPROBLEMS: ${problems.length}`);
  for (const p of problems.slice(0, 20)) console.log(`  ${p}`);
  process.exit(1);
}
console.log('the workbook reproduces the site for every model checked');
