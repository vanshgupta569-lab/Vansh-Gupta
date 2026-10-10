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
import { requireCurrentPayloads, readPayload } from './payloadSet.mts';
import { checkPeerSpreading, samplePeers } from './peerSpreading.mts';
import { checkHouseTemplate } from './houseTemplate.mts';
import { checkClassification } from './classification.mts';
import { createRequire } from 'node:module';
import { HyperFormula } from 'hyperformula';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..').split(path.sep).join('/');
const PAYLOADS = path.join(HERE, 'payloads');

const ExcelJS = createRequire(`${REPO}/package.json`)('exceljs');
const { buildWorkbook, MODEL_SHEET_ROWS, MODEL_SHEET_ROW_LABELS, MODEL_SHEET_ROWS_VERSION } = await import(
  `file:///${REPO}/src/data/excelExport.ts`
);
const { buildCompanyFrom } = await import(`file:///${REPO}/src/data/autoCompany.ts`);
const { calculateDCFFor, defaultDriversFor, buildFullModel } = await import(
  `file:///${REPO}/src/data/companies.ts`
);
const { buildModel, buildDCF } = await import(`file:///${REPO}/src/engine/model.js`);
const AAPL = (await import(`file:///${REPO}/src/data/AAPL.js`)).default;

const isNum = (v: any) => typeof v === 'number' && isFinite(v);
const colIdx = (s: string) => [...s].reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0) - 1;

// The DCF sheet's single-value column, and the rows this check reads. They are
// FOUND BY THEIR LABEL, not by number: the generator places that sheet by
// position, and these were four hard-coded numbers until the cost of capital
// needed two more rows and every one of them pointed at the wrong line. A label
// moves with its row; a number does not (`KI-20`).
const VALUE_COL = 'E';
const LABELS = {
  perpetuity: /^Value per share, perpetuity growth$/,
  exit: /^Value per share, exit multiple$/,
  netDebt: /^Net debt$/,
  normalised: /^Normalised final year cash flow/,
};

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
  const rows: Record<string, number> = {};
  for (const [key, re] of Object.entries(LABELS)) {
    const at = sheets.DCFModel.findIndex((r) => re.test(String(r?.[2] ?? '')));
    if (at < 0) throw new Error(`the DCF sheet has no row labelled ${re}`);
    rows[key] = at;
  }
  return (key: keyof typeof LABELS) =>
    hf.getCellValue({ sheet: id, row: rows[key], col: colIdx(VALUE_COL) }) as number;
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
    const payload = readPayload(file);
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
let contractChecked = 0;
const contractProblems: string[] = [];
const problems: string[] = [];

for (const c of cases) {
  let at: (key: 'perpetuity' | 'exit' | 'netDebt' | 'normalised') => number;
  let wbForContract: any;
  try {
    const wb = await buildWorkbook({
      model: c.model, dcf: c.dcf, source: c.source,
      companyName: c.name, ticker: c.ticker, currencySymbol: c.symbol,
      unitLabel: `${c.symbol} millions`, modelLabel: 'Verification run',
    });
    at = await readBack(wb);
    wbForContract = wb;
  } catch (e: any) {
    problems.push(`${c.ticker}: workbook build or recalculation failed - ${e.message.slice(0, 70)}`);
    continue;
  }

  // ---- THE PUBLISHED CHART OF ACCOUNTS ----------------------------------
  //
  // Every contracted line must sit on the row METHODOLOGY.md section 22a says
  // it does, carrying the name it says it carries. The generator throws if a
  // row moves, so reaching here means the rows agreed; what this adds is that
  // the NAMES agree too -- a line could hold its row and quietly become a
  // different line, and a macro reading B$26 would never know.
  //
  // Labels are compared with digits normalised, because a few carry a figure
  // of the company's own ("Minimum cash balance - 6.0% of revenue").
  {
    const Sm = wbForContract.getWorksheet('3-StatementModel');
    const norm = (t: string) => t.replace(/[0-9][0-9.,]*/g, '#').trim();
    for (const [key, row] of Object.entries(MODEL_SHEET_ROWS)) {
      const want = (MODEL_SHEET_ROW_LABELS as any)[key];
      if (want === undefined) continue;        // rows with no label of their own
      const allowed: string[] = Array.isArray(want) ? want : [want];
      const v: any = Sm.getRow(row as number).getCell(3).value;
      const got = typeof v === 'string' ? v
        : v && typeof v === 'object' && 'richText' in v ? v.richText.map((x: any) => x.text).join('')
        : v == null ? '' : String(v);
      if (!allowed.some((w) => norm(got) === norm(w))) {
        contractProblems.push(
          `${c.ticker}: row ${row} (${key}) should be "${String(allowed[0]).slice(0, 36)}" ` +
            `but holds "${got.slice(0, 36)}"`
        );
      }
    }
    contractChecked++;
  }

  const sitePerp = c.dcf.perpetuity?.valuePerShare;
  const siteExit = c.dcf.exitMultipleValuation?.valuePerShare;
  const gap = (wbv: number, site: number) => (isNum(wbv) && isNum(site) && site !== 0 ? Math.abs(wbv / site - 1) * 100 : NaN);
  const gp = gap(at('perpetuity'), sitePerp);
  const ge = gap(at('exit'), siteExit);
  checked++;

  if (!isFinite(gp) || !isFinite(ge)) {
    problems.push(`${c.ticker}: no comparable value (workbook ${at('perpetuity')}, site ${sitePerp})`);
    continue;
  }
  if (Math.max(gp, ge) > worst.perpetuity + worst.exit) {
    worst.perpetuity = gp; worst.exit = ge; worst.ticker = c.ticker;
  }
  // 1e-6% is far above floating point (the sweep runs at ~5e-9%) and far below
  // any difference in method.
  if (gp > 1e-6 || ge > 1e-6) {
    problems.push(
      `${c.ticker}: perpetuity workbook ${at('perpetuity').toFixed(4)} vs site ${sitePerp.toFixed(4)} (${gp.toFixed(4)}%), ` +
        `exit ${at('exit').toFixed(4)} vs ${siteExit.toFixed(4)} (${ge.toFixed(4)}%); ` +
        `net debt ${at('netDebt').toFixed(0)} vs ${c.dcf.netDebt.toFixed(0)}, ` +
        `normalised terminal ${at('normalised').toFixed(0)} vs ${c.dcf.normalisedFCF.toFixed(0)}`
    );
  }
}

// ---- EXPENSE CLASSIFICATION ---------------------------------------------
// The judgement layer's first piece, checked here because its claim is about
// the workbook as well as the screen: the Assumptions sheet's two judgement
// columns are filled from the same classification the engine read.
{
  const r = await checkClassification();
  console.log(
    `expense classification: ${r.bucketMoves} grouping moves, worst value drift ` +
      `${r.worstBucketDrift.toExponential(2)}; reported operating profit ties to the filing within ` +
      `${r.worstTie.toExponential(2)} of itself under every classification` +
      (r.moved
        ? `; excluding ${r.moved.line} takes ${r.moved.ticker} from ${r.moved.base.toFixed(2)} to ` +
          `${r.moved.excluded.toFixed(2)}`
        : '') +
      `; typically ${r.typical} lines are classifiable across ${r.measured} payloads` +
      (r.problems.length ? '' : ' \u2014 every rule held')
  );
  if (r.problems.length) {
    console.log(`\nPROBLEMS WITH EXPENSE CLASSIFICATION: ${r.problems.length}`);
    for (const p of r.problems.slice(0, 20)) console.log(`  ${p}`);
    process.exit(1);
  }
}

// ---- THE HOUSE TEMPLATE -------------------------------------------------
// Also downstream of the chart of accounts: a template maps onto the
// contracted rows or onto nothing.
{
  const r = await checkHouseTemplate();
  console.log(
    `house template: ${r.mapped} of ${r.contracted} contracted rows mapped by a representative firm ` +
      `template, ${r.unmapped} reported as unmapped, ${r.conflicts} conflicts; ${r.filled} figures over ` +
      `${r.periods} periods and ${r.unfilled} cells saying "not reported"; the report sheet carries ` +
      `${r.unmappedFigures} figures across ${r.unmappedRows} unmapped rows; a revision kept ${r.kept}, ` +
      `moved ${r.moved}, lost ${r.lost}` + (r.problems.length ? '' : ' — every rule held')
  );
  if (r.problems.length) {
    console.log(`
PROBLEMS WITH THE HOUSE TEMPLATE: ${r.problems.length}`);
    for (const p of r.problems.slice(0, 20)) console.log(`  ${p}`);
    process.exit(1);
  }
}

// ---- THE PEER SPREADING WORKBOOK ----------------------------------------
// It is only sound because the chart of accounts above holds, so it is checked
// immediately after it and in the same run.
{
  const { target, peers } = samplePeers();
  if (peers.length) {
    const r = await checkPeerSpreading(target, peers);
    console.log(
      `peer spreading: ${r.tabs} tabs (${target} and ${r.peers} peers, ${r.refusedKept} refused and kept), ` +
        `${r.formulas} live formulas, ${(r.bytes / 1024).toFixed(0)} KB, built in ${r.buildMs} ms; ` +
        `${r.checked} figures recalculated against the engine` +
        (r.problems.length ? '' : ' — all agreeing')
    );
    if (r.problems.length) {
      console.log(`
PROBLEMS WITH PEER SPREADING: ${r.problems.length}`);
      for (const p of r.problems.slice(0, 20)) console.log(`  ${p}`);
      process.exit(1);
    }
  } else {
    console.log('peer spreading: skipped, no peer payloads on disk');
  }
}

console.log(
  `the chart of accounts (v${MODEL_SHEET_ROWS_VERSION}): ` +
    `${Object.keys(MODEL_SHEET_ROWS).length} contracted rows, ` +
    `${Object.keys(MODEL_SHEET_ROW_LABELS).length} of them named, ` +
    `checked line by line in ${contractChecked} workbooks` +
    (contractProblems.length ? '' : ' — every line on the row the contract publishes')
);
if (contractProblems.length) {
  console.log(`
PROBLEMS WITH THE CHART OF ACCOUNTS: ${contractProblems.length}`);
  for (const p of contractProblems.slice(0, 20)) console.log(`  ${p}`);
  process.exit(1);
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
