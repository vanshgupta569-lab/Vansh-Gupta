// FILE: verify/peerSpreading.mts
//
// THE PEER SPREADING WORKBOOK, RECALCULATED.
//
// The comparison tab is nothing but cross-tab formulas, and a formula that
// points at the wrong row is the one failure mode that looks fine: the cell
// holds a number, the number is plausible, and it belongs to a different line.
// So this does not read the formulas and agree they look right. It loads the
// written file into HyperFormula, recalculates every cell from scratch, and
// checks the answers against what the engine says for each company.
//
// Run by `npm run verify:workbook`, which owns workbook correctness.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readPayload } from './payloadSet.mts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..').split(path.sep).join('/');
const PAYLOADS = path.join(HERE, 'payloads');

const require_ = createRequire(`${REPO}/package.json`);
const ExcelJS = require_('exceljs');
const { HyperFormula } = require_('hyperformula');

const { buildPeerWorkbook, MAX_PEERS, tabNameFor } = await import(
  `file:///${REPO}/src/data/peerSpreading.ts`
);
const { MODEL_SHEET_ROWS } = await import(`file:///${REPO}/src/data/excelExport.ts`);
const { buildCompanyFrom } = await import(`file:///${REPO}/src/data/autoCompany.ts`);
const { calculateDCFFor, defaultDriversFor, buildFullModel } = await import(
  `file:///${REPO}/src/data/companies.ts`
);

const isNum = (v: any): v is number => typeof v === 'number' && isFinite(v);

export interface PeerSpreadReport {
  problems: string[];
  tabs: number;
  peers: number;
  refusedKept: number;
  formulas: number;
  bytes: number;
  buildMs: number;
  checked: number;
}

/** Everything the spreader needs for one company, from a stored payload. */
async function companyFrom(ticker: string) {
  let payload: any;
  try {
    payload = readPayload(`${ticker}.json`);
  } catch {
    return null;
  }
  if (!payload || payload.error || !payload.statements) return null;
  let rec: any;
  try {
    rec = buildCompanyFrom(payload);
  } catch {
    return null;
  }
  const source = rec.modelData;
  if (!source) return null;
  const drivers = { ...rec.defaultDrivers, ...defaultDriversFor(source) };
  const decision = calculateDCFFor(source, drivers, rec.price || null);
  let built: any;
  try {
    built = buildFullModel(source, drivers);
  } catch {
    return null;
  }
  const symbol = payload.currencySymbol || '$';
  return {
    ticker,
    name: payload.name || ticker,
    model: built.model,
    dcf: built.dcf,
    source,
    currencySymbol: symbol,
    unitLabel: `${symbol} millions`,
    price: isNum(rec.price) ? rec.price : null,
    priceDate: payload?.quote?.date ?? null,
    dilutedShares: isNum(built.dcf?.dilutedShares) ? built.dcf.dilutedShares : null,
    refusal: decision.applicable === false ? String(decision.message) : null,
  };
}

/** A whole workbook as HyperFormula sees it, formulas and all. */
function gridsOf(loaded: any): Record<string, any[][]> {
  const sheets: Record<string, any[][]> = {};
  loaded.eachSheet((ws: any) => {
    const grid: any[][] = [];
    ws.eachRow({ includeEmpty: false }, (row: any, rn: number) =>
      row.eachCell({ includeEmpty: true }, (cell: any, cn: number) => {
        const v = cell.value;
        (grid[rn - 1] ||= [])[cn - 1] =
          v && typeof v === 'object' && 'formula' in v ? `=${v.formula}` : v ?? null;
      })
    );
    for (let i = 0; i < grid.length; i++) grid[i] ||= [];
    sheets[ws.name] = grid;
  });
  return sheets;
}

export async function checkPeerSpreading(targetTicker: string, peerTickers: string[]): Promise<PeerSpreadReport> {
  const problems: string[] = [];
  const target = await companyFrom(targetTicker);
  if (!target) {
    return { problems: [`the target ${targetTicker} could not be built`], tabs: 0, peers: 0,
      refusedKept: 0, formulas: 0, bytes: 0, buildMs: 0, checked: 0 };
  }
  const peers: any[] = [];
  for (const t of peerTickers) {
    const c = await companyFrom(t);
    if (c) peers.push(c);
  }

  const t0 = Date.now();
  const wb: any = await buildPeerWorkbook({ target, peers, modelLabel: 'Verification run' });
  const buf = await wb.xlsx.writeBuffer();
  const buildMs = Date.now() - t0;

  const loaded = new ExcelJS.Workbook();
  await loaded.xlsx.load(buf);
  const sheets = gridsOf(loaded);
  const hf = HyperFormula.buildFromSheets(sheets, { licenseKey: 'gpl-v3' });

  const companies = [target, ...peers];

  // ---- a tab for every company, named and in order -----------------------
  const names: string[] = loaded.worksheets.map((w: any) => w.name);
  if (names[0] !== 'Comparison') problems.push(`the first tab is "${names[0]}", not Comparison`);
  const expected = new Set<string>(['comparison']);
  for (const c of companies) {
    const want = tabNameFor(c.ticker, expected);
    if (!names.includes(want)) problems.push(`${c.ticker}: no tab named "${want}"`);
  }
  if (names.length !== companies.length + 1) {
    problems.push(`${names.length} tabs for ${companies.length} companies plus Comparison`);
  }

  // ---- A REFUSED PEER KEEPS ITS TAB AND ITS FIGURES ----------------------
  //
  // The whole point of the rule: the comparison is of filings, not valuations.
  // A refused company whose tab was dropped, or whose revenue came back blank,
  // would make the spread quietly narrower than the peer set the reader chose.
  let refusedKept = 0;
  for (const c of companies) {
    if (!c.refusal) continue;
    refusedKept++;
    const tabId = hf.getSheetId(c.ticker);
    if (tabId === undefined) {
      problems.push(`${c.ticker}: refused, and its tab is missing — filings were dropped`);
      continue;
    }
    const lastCol = 5 + Math.max(0, (c.model?.nH ?? 0) - 1) - 1; // 0-based
    const rev = hf.getCellValue({ sheet: tabId, row: MODEL_SHEET_ROWS.rev - 1, col: lastCol });
    if (!isNum(rev)) {
      problems.push(`${c.ticker}: refused, and its tab reports no revenue (${JSON.stringify(rev)})`);
    }
  }

  // ---- EVERY CROSS-TAB FIGURE, AGAINST THE ENGINE ------------------------
  //
  // Recalculated from the written file, not read back from what was written.
  const compId = hf.getSheetId('Comparison');
  if (compId === undefined) {
    problems.push('no Comparison sheet');
    return { problems, tabs: names.length, peers: peers.length, refusedKept, formulas: 0,
      bytes: buf.byteLength, buildMs, checked: 0 };
  }
  const comp = sheets.Comparison;
  const rowOf = (label: string) => comp.findIndex((row) => String(row?.[1] ?? '').trim() === label);

  const lastReported = (c: any) => Math.max(0, (c.model?.nH ?? 0) - 1);
  const atModel = (c: any, key: string) => {
    const series = c.model?.[key];
    return Array.isArray(series) ? series[lastReported(c)] : undefined;
  };

  // label on the comparison tab -> what the engine says it should be
  const CHECKS: [string, (c: any) => number | null][] = [
    ['Revenue', (c) => (isNum(atModel(c, 'revenue')) ? atModel(c, 'revenue') : null)],
    ['EBITDA', (c) => (isNum(atModel(c, 'ebitda')) ? atModel(c, 'ebitda') : null)],
    ['Operating profit (EBIT)', (c) => (isNum(atModel(c, 'ebit')) ? atModel(c, 'ebit') : null)],
    ['Net income', (c) => (isNum(atModel(c, 'netIncome')) ? atModel(c, 'netIncome') : null)],
  ];

  let checked = 0;
  for (const [label, want] of CHECKS) {
    const row = rowOf(label);
    if (row < 0) {
      problems.push(`the comparison tab has no row labelled "${label}"`);
      continue;
    }
    companies.forEach((c, i) => {
      const expectedValue = want(c);
      if (expectedValue === null) return; // the engine has no figure; nothing to assert
      const got = hf.getCellValue({ sheet: compId, row, col: 2 + i });
      checked++;
      if (!isNum(got)) {
        problems.push(`${label} for ${c.ticker}: the formula gave ${JSON.stringify(got)}, engine says ${expectedValue.toFixed(0)}`);
        return;
      }
      const gap = Math.abs(got - expectedValue);
      const scale = Math.max(1, Math.abs(expectedValue));
      if (gap / scale > 1e-9) {
        problems.push(
          `${label} for ${c.ticker}: tab says ${got.toFixed(2)}, engine says ${expectedValue.toFixed(2)}`
        );
      }
    });
  }

  // A MARGIN IS A RATIO OF TWO LINES ON THE SAME TAB, which is where a
  // mis-pointed column shows up even when both lines are real numbers.
  const marginRow = rowOf('Operating margin');
  if (marginRow < 0) problems.push('the comparison tab has no row labelled "Operating margin"');
  else {
    companies.forEach((c, i) => {
      const ebit = atModel(c, 'ebit');
      const rev = atModel(c, 'revenue');
      if (!isNum(ebit) || !isNum(rev) || rev === 0) return;
      const got = hf.getCellValue({ sheet: compId, row: marginRow, col: 2 + i });
      checked++;
      if (!isNum(got) || Math.abs(got - ebit / rev) > 1e-9) {
        problems.push(
          `Operating margin for ${c.ticker}: tab says ${JSON.stringify(got)}, engine says ${(ebit / rev).toFixed(6)}`
        );
      }
    });
  }

  // THE MEDIAN IS COMPUTED IN THE SHEET, so it is checked against a median
  // taken here rather than against itself.
  const revRow = rowOf('Revenue');
  if (revRow >= 0) {
    const vals = companies
      .map((_, i) => hf.getCellValue({ sheet: compId, row: revRow, col: 2 + i }))
      .filter(isNum)
      .sort((a, b) => a - b);
    if (vals.length) {
      const mid = Math.floor(vals.length / 2);
      const wantMedian = vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2;
      const gotMedian = hf.getCellValue({ sheet: compId, row: revRow, col: 2 + companies.length });
      checked++;
      if (!isNum(gotMedian) || Math.abs(gotMedian - wantMedian) > 1e-6) {
        problems.push(`the revenue median reads ${JSON.stringify(gotMedian)}, should be ${wantMedian}`);
      }
      const gotSpread = hf.getCellValue({ sheet: compId, row: revRow, col: 3 + companies.length });
      const wantSpread = vals[vals.length - 1] - vals[0];
      checked++;
      if (!isNum(gotSpread) || Math.abs(gotSpread - wantSpread) > 1e-6) {
        problems.push(`the revenue spread reads ${JSON.stringify(gotSpread)}, should be ${wantSpread}`);
      }
    }
  }

  // ---- NOTHING ON THIS TAB IS A COPY -------------------------------------
  //
  // Every figure in a company column must be a formula. The two rows of market
  // facts are the stated exception and are the only numbers allowed to be
  // typed, which is checked by name rather than by position.
  let formulas = 0;
  // The two rows of market facts, which have no other home in the workbook.
  const INPUT_ROWS = new Set(['Share price', 'Diluted shares']);
  // The identification block, which says WHICH year and which currency each
  // column is. A fiscal year is a label that happens to be written with
  // digits, not a figure anybody computes with, and making it a formula over
  // a tab would say the opposite.
  const HEADER_ROWS = new Set(['Last reported year', 'Period ended', 'Reported in', 'Valuation']);
  comp.forEach((row, rn) => {
    const label = String(row?.[1] ?? '').trim();
    for (let i = 0; i < companies.length; i++) {
      const v = row?.[2 + i];
      if (v === null || v === undefined || v === '') continue;
      const isFormula = typeof v === 'string' && v.startsWith('=');
      if (isFormula) {
        formulas++;
        continue;
      }
      if (INPUT_ROWS.has(label) || HEADER_ROWS.has(label)) continue;
      if (typeof v === 'number') {
        problems.push(`a typed number on the comparison tab, row ${rn + 1} ("${label}"): ${v}`);
      }
    }
  });

  if (peers.length > MAX_PEERS) problems.push(`${peers.length} peers passed the ${MAX_PEERS} limit`);

  return { problems, tabs: names.length, peers: peers.length, refusedKept, formulas,
    bytes: buf.byteLength, buildMs, checked };
}

/** The peer set used when this file is run on its own. */
export function samplePeers(): { target: string; peers: string[] } {
  const have = new Set(
    fs.existsSync(PAYLOADS) ? fs.readdirSync(PAYLOADS).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', '')) : []
  );
  const wanted = ['MSFT', 'ACN', 'ADI', 'AMAT', 'AMD', 'AVGO', 'ARM', 'ASML', 'HDFCBANK.NS', 'RELINFRA.NS'];
  return { target: 'AAPL', peers: wanted.filter((t) => have.has(t)).slice(0, MAX_PEERS) };
}

if (import.meta.url === `file:///${process.argv[1].split(path.sep).join('/')}`) {
  const { target, peers } = samplePeers();
  const r = await checkPeerSpreading(target, peers);
  console.log(
    `peer spreading: ${r.tabs} tabs (${r.peers} peers, ${r.refusedKept} refused and kept), ` +
      `${r.formulas} live formulas, ${(r.bytes / 1024).toFixed(0)} KB, built in ${r.buildMs} ms; ` +
      `${r.checked} figures recalculated against the engine`
  );
  for (const p of r.problems) console.log(`  PROBLEM: ${p}`);
  process.exit(r.problems.length ? 1 : 0);
}
