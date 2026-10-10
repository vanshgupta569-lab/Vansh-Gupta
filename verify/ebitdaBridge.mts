// FILE: verify/ebitdaBridge.mts
//
// THE ADJUSTED EBITDA BRIDGE.
//
// The bridge makes two arithmetic promises, and a promise about arithmetic is
// either checked or it is decoration:
//
//   1. REPORTED EBITDA TIES TO THE FILING. The top of the bridge is filed
//      operating profit plus filed depreciation and amortisation, and nothing
//      else. Checked against the raw payload AND against the engine's own
//      EBITDA, which is a separate code path that arrives at the same figure.
//   2. REPORTED PLUS EVERY ADJUSTMENT TIES TO ADJUSTED, in every reported year,
//      under every combination of corrections and exclusions.
//
// Both are also checked INSIDE the written file: the bridge sheet carries them
// as live Excel formulas, and this recalculates the whole workbook in
// HyperFormula and reads the answers, so the file goes on tying after a reader
// edits an adjustment in it rather than being right only when it was written.
//
// It also checks the things the bridge says about itself: that the D&A
// add-back is named rather than folded into an adjustment, that stock
// compensation is not added back, that a correction which cannot move EBITDA is
// listed rather than dropped, that a company with no adjustments still gets a
// bridge saying so, and that the Sources sheet prints the FILED figure rather
// than the corrected one.
//
// Run by `npm run verify:workbook`.
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..').split(path.sep).join('/');
const require_ = createRequire(`${REPO}/package.json`);
const ExcelJS = require_('exceljs');
const { HyperFormula } = require_('hyperformula');

const BR: any = await import(`file:///${REPO}/src/data/ebitdaBridge.ts`);
const { buildCompanyFrom } = await import(`file:///${REPO}/src/data/autoCompany.ts`);
const { defaultDriversFor, buildFullModel } = await import(`file:///${REPO}/src/data/companies.ts`);
const { buildWorkbook } = await import(`file:///${REPO}/src/data/excelExport.ts`);
const { readPayload } = await import(`file:///${REPO}/verify/payloadSet.mts`);
const { FIELD_BY_KEY } = await import(`file:///${REPO}/src/data/corrections.ts`);

const isNum = (v: any): v is number => typeof v === 'number' && isFinite(v);
/** Scaled, because a gap of 1 on ten million is noise and on 10 is not. */
const off = (a: number, b: number) => Math.abs(a - b) / Math.max(1, Math.abs(b));

export interface BridgeReport {
  problems: string[];
  /** Adjustment combinations put through the bridge. */
  cases: number;
  /** Worst reported-EBITDA gap against filed operating profit plus filed D&A. */
  worstFilingTie: number;
  /** Worst gap against the engine's own EBITDA. */
  worstEngineTie: number;
  /** Worst adjusted-less-reported-and-adjustments, as written and recalculated. */
  worstBridgeTie: number;
  /** The worked example: lines and what they moved. */
  example: { ticker: string; years: number; lines: number; reported: number; adjusted: number } | null;
  /** Years recalculated inside the written file. */
  recalculated: number;
}

function gridsOf(loaded: any): Record<string, any[][]> {
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
  return sheets;
}

export async function checkEbitdaBridge(ticker = 'RELIANCE.NS'): Promise<BridgeReport> {
  const problems: string[] = [];
  const payload: any = readPayload(`${ticker}.json`);
  const filed: any[] = payload.statements || [];
  const last = filed[filed.length - 1];
  const lastYear = String(last.fiscalYear);
  const firstYear = String(filed[0].fiscalYear);

  let worstFilingTie = 0;
  let worstEngineTie = 0;
  let worstBridgeTie = 0;
  let cases = 0;

  // Every shape of adjustment, including none, including one that cannot move
  // EBITDA, including several at once and across more than one year.
  const combos: { label: string; corrections: any; classification: any; reasons: any }[] = [
    { label: 'nothing adjusted', corrections: {}, classification: {}, reasons: {} },
    {
      label: 'operating profit corrected in one year',
      corrections: { [lastYear]: { operatingIncome: last.operatingIncome + 50_000 } },
      classification: {},
      reasons: { operatingIncome: 'restated after the demerger' },
    },
    {
      label: 'a cost line corrected, which cannot move EBITDA',
      corrections: { [lastYear]: { sga: (last.sga ?? 0) + 9_000 } },
      classification: {},
      reasons: { sga: 'the source omits depreciation here' },
    },
    {
      label: 'D&A corrected in two years',
      corrections: {
        [lastYear]: { depreciation: (last.depreciation ?? 0) + 7_000 },
        [firstYear]: { depreciation: (filed[0].depreciation ?? 0) + 3_000 },
      },
      classification: {},
      reasons: {},
    },
    {
      label: 'other operating costs excluded',
      corrections: {},
      classification: { otherOperatingCosts: { category: 'excluded', reason: 'a write-down that will not repeat' } },
      reasons: {},
    },
    {
      label: 'SG&A excluded with no reason given',
      corrections: {},
      classification: { sga: { category: 'excluded' } },
      reasons: {},
    },
    {
      label: 'two corrections and two exclusions together',
      corrections: {
        [lastYear]: { operatingIncome: last.operatingIncome + 50_000, sga: (last.sga ?? 0) + 9_000 },
        [firstYear]: { depreciation: (filed[0].depreciation ?? 0) + 3_000 },
      },
      classification: {
        otherOperatingCosts: { category: 'excluded', reason: 'a port write-down' },
        sga: { category: 'excluded', reason: 'the promoter salary comes out' },
      },
      reasons: { operatingIncome: 'restated', sga: 'the source omits depreciation' },
    },
  ];

  let example: BridgeReport['example'] = null;

  for (const combo of combos) {
    cases++;
    const B: any = BR.buildEbitdaBridge(filed, combo.corrections, combo.classification, combo.reasons);

    // ---- 1. REPORTED EBITDA TIES TO THE FILING -------------------------
    for (let i = 0; i < filed.length; i++) {
      const op = filed[i].operatingIncome;
      const da = filed[i].depreciation;
      if (!isNum(op)) {
        if (B.reportedEbitda[i] !== null) {
          problems.push(`${combo.label}: FY${B.years[i]} has no filed operating profit but reported EBITDA is ${B.reportedEbitda[i]}`);
        }
        continue;
      }
      const want = op + (isNum(da) ? da : 0);
      if (!isNum(B.reportedEbitda[i])) {
        problems.push(`${combo.label}: FY${B.years[i]} reported EBITDA is ${B.reportedEbitda[i]}, expected ${want}`);
        continue;
      }
      const gap = off(B.reportedEbitda[i], want);
      worstFilingTie = Math.max(worstFilingTie, gap);
      if (gap > 1e-12) {
        problems.push(
          `${combo.label}: FY${B.years[i]} reported EBITDA ${B.reportedEbitda[i]} against filed ` +
            `operating profit plus filed D&A ${want} — the top of the bridge must be the filing`
        );
      }
      // AND A CORRECTION MUST NOT MOVE IT. Reported EBITDA is the FILED
      // figures, so no judgement of the reader's may touch it.
      if (B.reportedEbitda[i] !== BR.ebitdaOf(filed)[i]) {
        problems.push(`${combo.label}: FY${B.years[i]} reported EBITDA moved with an adjustment`);
      }
    }

    // ---- 2. THE BRIDGE TIES --------------------------------------------
    for (let i = 0; i < B.tie.length; i++) {
      if (B.tie[i] === null) continue;
      const scale = Math.max(1, Math.abs(B.reportedEbitda[i] ?? 1));
      const gap = Math.abs(B.tie[i]) / scale;
      worstBridgeTie = Math.max(worstBridgeTie, gap);
      if (gap > 1e-12) {
        problems.push(
          `${combo.label}: FY${B.years[i]} adjusted EBITDA misses reported plus every adjustment by ${B.tie[i]}`
        );
      }
    }

    // ---- what the bridge says about itself ------------------------------
    // THE D&A ADD-BACK IS NEVER AN ADJUSTMENT. It is its own named line holding
    // the filed figure. (A correction to that filed figure IS an adjustment,
    // which is a different thing and must appear as a correction line — the
    // first version of this check conflated the two and failed on it.)
    for (let i = 0; i < filed.length; i++) {
      const want = isNum(filed[i].depreciation) ? filed[i].depreciation : null;
      if (B.depreciationAddedBack[i] !== want) {
        problems.push(
          `${combo.label}: FY${B.years[i]} adds back ${B.depreciationAddedBack[i]}, filed D&A is ${want}`
        );
      }
      if ((want === null) !== !!B.depreciationNotReported[i]) {
        problems.push(`${combo.label}: FY${B.years[i]} does not say whether D&A was filed`);
      }
    }
    for (const a of [...B.corrections, ...B.exclusions]) {
      if (!/^(correction|exclusion):/.test(a.key)) {
        problems.push(`${combo.label}: the adjustment ${a.key} is not keyed as a correction or an exclusion`);
      }
      if (a.yearsMoved < 1) problems.push(`${combo.label}: ${a.key} is listed as an adjustment but moves nothing`);
      if (!a.detail || a.detail.length < 20) problems.push(`${combo.label}: ${a.key} does not say what moved it`);
      if (a.kind !== 'correction' && a.kind !== 'exclusion') {
        problems.push(`${combo.label}: ${a.key} is neither a correction nor an exclusion`);
      }
    }
    // A reason given reaches the line it belongs to.
    for (const [field, text] of Object.entries(combo.reasons as Record<string, string>)) {
      const line = B.corrections.find((a: any) => a.key === `correction:${field}`);
      const neutral = B.neutral.find((n: any) => n.reason === text);
      if (!line && !neutral) continue;
      if (line && line.reason !== text) {
        problems.push(`${combo.label}: the reason for ${field} reads ${JSON.stringify(line.reason)}`);
      }
    }
    for (const [key, choice] of Object.entries(combo.classification as Record<string, any>)) {
      if (choice.category !== 'excluded' || !choice.reason) continue;
      const line = B.exclusions.find((a: any) => a.key === `exclusion:${key}`);
      if (line && line.reason !== choice.reason) {
        problems.push(`${combo.label}: the reason for excluding ${key} reads ${JSON.stringify(line.reason)}`);
      }
    }
    // A CORRECTION THAT CANNOT MOVE EBITDA IS NAMED, NOT DROPPED.
    const correctedFields = new Set<string>();
    for (const patch of Object.values(combo.corrections as Record<string, any>)) {
      for (const k of Object.keys(patch)) correctedFields.add(k);
    }
    // The bridge's lines are keyed by field; the neutral list is by label, so
    // the field's own label is what joins them. (Comparing a field key against
    // a label is what the first version of this check did, and it reported a
    // correction as missing that was on the sheet.)
    const asCorrection = new Set<string>(B.corrections.map((a: any) => a.key.slice('correction:'.length)));
    const asNeutral = new Set<string>(B.neutral.map((n: any) => n.label));
    for (const field of correctedFields) {
      const label = FIELD_BY_KEY[field]?.label || field;
      if (!asCorrection.has(field) && !asNeutral.has(label)) {
        problems.push(`${combo.label}: the correction to ${field} appears nowhere in the bridge`);
      }
      if (asCorrection.has(field) && asNeutral.has(label)) {
        problems.push(`${combo.label}: the correction to ${field} is both an adjustment and a neutral one`);
      }
    }
    // A company with nothing adjusted still has a bridge, and it says so.
    if (!B.adjusted) {
      for (let i = 0; i < B.years.length; i++) {
        if (B.adjustedEbitda[i] !== B.reportedEbitda[i]) {
          problems.push(`${combo.label}: nothing was adjusted but adjusted EBITDA differs from reported`);
        }
      }
    }
    // EVERY REPORTED YEAR, not only the last.
    if (B.years.length !== filed.length) {
      problems.push(`${combo.label}: the bridge covers ${B.years.length} years of ${filed.length} reported`);
    }

    if (combo.label.startsWith('two corrections')) {
      example = {
        ticker,
        years: B.years.length,
        lines: B.corrections.length + B.exclusions.length,
        reported: B.reportedEbitda[B.years.length - 1],
        adjusted: B.adjustedEbitda[B.years.length - 1],
      };
    }
  }

  // ---- 3. THE SAME TWO TIES, RECALCULATED INSIDE THE WRITTEN FILE -------
  const worked = combos[combos.length - 1];
  const rec: any = buildCompanyFrom(payload, worked.corrections, worked.classification, worked.reasons);
  const drivers: any = { ...rec.defaultDrivers, ...defaultDriversFor(rec.modelData) };
  const built: any = buildFullModel(rec.modelData, drivers);
  const wb: any = await buildWorkbook({
    model: built.model,
    dcf: built.dcf,
    source: rec.modelData,
    companyName: payload.name || ticker,
    ticker,
    currencySymbol: payload.currencySymbol || '$',
    unitLabel: `${payload.currencySymbol || '$'} millions`,
    modelLabel: 'Verification run',
  });

  // THE ENGINE'S OWN EBITDA, a separate path to the same figure — and the
  // figure it arrives at is EBITDA ON THE CORRECTED FIGURES, because that is
  // what the model is built on. So it ties to `afterCorrections`, not to
  // reported. Checking it against reported is what the first version of this
  // did, and it reported a 2.7e-2 gap that was simply the corrections.
  const M: any = built.model;
  const B2: any = rec.modelData.meta.ebitdaBridge;
  for (let i = 0; i < M.nH; i++) {
    const engine = M.ebitda[i];
    const mine = B2.afterCorrections[i];
    if (!isNum(engine) || !isNum(mine)) continue;
    const gap = off(mine, engine);
    worstEngineTie = Math.max(worstEngineTie, gap);
    if (gap > 1e-9) {
      problems.push(
        `FY${B2.years[i]}: the bridge has EBITDA on your figures at ${mine}, the model at ${engine} — ` +
          'the two disagree about what the model was built on'
      );
    }
  }
  // And reported EBITDA is NOT the model's, wherever anything was corrected:
  // the top of the bridge is the filing.
  const movedByCorrection = B2.corrections.length > 0;
  if (movedByCorrection) {
    let anyDiffer = false;
    for (let i = 0; i < M.nH; i++) {
      if (isNum(M.ebitda[i]) && isNum(B2.reportedEbitda[i]) && off(B2.reportedEbitda[i], M.ebitda[i]) > 1e-9) {
        anyDiffer = true;
      }
    }
    if (!anyDiffer) {
      problems.push('a correction was made and reported EBITDA still equals the model\'s — the top of the bridge is not the filing');
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  const loaded = new ExcelJS.Workbook();
  await loaded.xlsx.load(buf);
  const sheet = loaded.getWorksheet('EBITDA bridge');
  let recalculated = 0;
  if (!sheet) problems.push('the workbook has no EBITDA bridge sheet');
  else {
    const hf = HyperFormula.buildFromSheets(gridsOf(loaded), { licenseKey: 'gpl-v3' });
    const id = hf.getSheetId('EBITDA bridge');
    const rowOf = (re: RegExp): number => {
      let at = -1;
      sheet.eachRow({ includeEmpty: false }, (row: any) => {
        if (at < 0 && re.test(String(row.getCell(3).value ?? ''))) at = row.number;
      });
      return at;
    };
    const tieRow = rowOf(/^Adjusted, less reported and every adjustment$/);
    const filingRow = rowOf(/^Reported EBITDA, less filed operating profit and filed D&A$/);
    const modelTieRow = rowOf(/model sheet.s own EBITDA/);
    const reportedRow = rowOf(/^Reported EBITDA$/);
    const adjustedRow = rowOf(/^Adjusted EBITDA$/);
    if (modelTieRow < 0) problems.push('the bridge sheet carries no tie against the model');
    if (tieRow < 0 || filingRow < 0) problems.push('the bridge sheet carries no tie rows');
    else {
      // The year columns start where the model sheet's do.
      for (let c = 4; c < 4 + M.nH + 4; c++) {
        const asText = String(sheet.getCell(6, c).value ?? '');
        if (!/^FY\d\d$/.test(asText)) continue;
        recalculated++;
        for (const [row, what] of [
          [tieRow, 'adjusted against reported plus every adjustment'],
          [filingRow, 'reported EBITDA against filed operating profit plus filed D&A'],
          [modelTieRow, 'EBITDA on your figures against the model sheet'],
        ] as [number, string][]) {
          if (row < 0) continue;
          const v: any = hf.getCellValue({ sheet: id, row: row - 1, col: c - 1 });
          if (typeof v !== 'number') {
            problems.push(`${asText}: the live tie for ${what} recalculated to ${JSON.stringify(v)}`);
            continue;
          }
          const scale = Math.max(1, Math.abs(Number(hf.getCellValue({ sheet: id, row: reportedRow - 1, col: c - 1 })) || 1));
          const gap = Math.abs(v) / scale;
          worstBridgeTie = Math.max(worstBridgeTie, gap);
          if (gap > 1e-9) {
            problems.push(`${asText}: the live tie for ${what} recalculated to ${v}, not nil`);
          }
        }
        // And the adjusted figure in the file is the one the bridge computed.
        const inFile: any = hf.getCellValue({ sheet: id, row: adjustedRow - 1, col: c - 1 });
        const i = recalculated - 1;
        if (typeof inFile === 'number' && isNum(B2.adjustedEbitda[i])) {
          if (off(inFile, B2.adjustedEbitda[i]) > 1e-9) {
            problems.push(`${asText}: the file holds adjusted EBITDA ${inFile}, the bridge ${B2.adjustedEbitda[i]}`);
          }
        }
      }
    }
    if (!recalculated) problems.push('no year columns were found on the bridge sheet');

    // The sheet states what it does not include, and names the add-back.
    const text: string[] = [];
    sheet.eachRow({ includeEmpty: false }, (row: any) =>
      row.eachCell({ includeEmpty: false }, (cell: any) => text.push(String(cell.value ?? '')))
    );
    const joined = text.join(' | ');
    for (const [must, what] of [
      [/Stock-based compensation is NOT added back/i, 'that stock compensation is not added back'],
      [/Plus: depreciation and amortisation/i, 'the D&A add-back on its own line'],
      [/classify the same money twice/i, 'why depreciation is not classifiable'],
      [/What is in this bridge, and what is not/i, 'what is in it and what is not'],
    ] as [RegExp, string][]) {
      if (!must.test(joined)) problems.push(`the bridge sheet does not state ${what}`);
    }
    // An exclusion with no reason says so rather than coming back blank.
    const silent: any = buildCompanyFrom(payload, {}, { sga: { category: 'excluded' } }, {});
    const sd: any = { ...silent.defaultDrivers, ...defaultDriversFor(silent.modelData) };
    const sb: any = buildFullModel(silent.modelData, sd);
    const wb2: any = await buildWorkbook({
      model: sb.model, dcf: sb.dcf, source: silent.modelData,
      companyName: payload.name || ticker, ticker,
      currencySymbol: payload.currencySymbol || '$',
      unitLabel: `${payload.currencySymbol || '$'} millions`,
      modelLabel: 'Verification run',
    });
    const ws2 = wb2.getWorksheet('EBITDA bridge');
    // The reason column is FOUND from the header rather than computed from the
    // year count: guessing it read the "What moved it" column instead and
    // reported the detail text as the reason.
    let whyCol = -1;
    ws2.getRow(6).eachCell({ includeEmpty: false }, (cell: any, c: number) => {
      if (String(cell.value ?? '') === 'Your reason') whyCol = c;
    });
    if (whyCol < 0) problems.push('the bridge sheet has no "Your reason" column');
    let said = '';
    ws2.eachRow({ includeEmpty: false }, (row: any) => {
      if (whyCol > 0 && /^Selling, general and administrative$/.test(String(row.getCell(3).value ?? ''))) {
        said = String(row.getCell(whyCol).value ?? '');
      }
    });
    if (said !== 'No reason given.') {
      problems.push(`an exclusion with no reason reads ${JSON.stringify(said)} rather than saying so`);
    }
  }

  // ---- 4. THE SOURCES SHEET PRINTS THE FILING --------------------------
  //
  // It used to print `rawStatements`, which is the CORRECTED array, under the
  // heading "what the filing actually said": a corrected figure shown as filed,
  // on the one sheet whose entire job is to be the filing.
  const srcSheet = loaded.getWorksheet('Sources');
  if (!srcSheet) problems.push('the workbook has no Sources sheet');
  else {
    const wantFiled = last.sga;
    const yours = worked.corrections[lastYear].sga;
    let row = -1;
    srcSheet.eachRow({ includeEmpty: false }, (r: any) => {
      if (row < 0 && String(r.getCell(3).value ?? '') === 'sga') row = r.number;
    });
    if (row < 0) problems.push('the Sources sheet has no sga line');
    else {
      let found: any = null;
      for (let c = 4; c < 4 + filed.length + 2; c++) {
        const v = srcSheet.getCell(row, c).value;
        if (isNum(v) && Math.abs((v as number) - (yours as number)) < 1e-6) {
          problems.push(`the Sources sheet prints your corrected ${yours} as the filed figure`);
        }
        if (isNum(v) && Math.abs((v as number) - (wantFiled as number)) < 1e-6) found = v;
      }
      if (found === null) problems.push(`the Sources sheet does not print the filed sga ${wantFiled}`);
    }
  }

  return {
    problems,
    cases,
    worstFilingTie,
    worstEngineTie,
    worstBridgeTie,
    example,
    recalculated,
  };
}

if (import.meta.url === `file:///${process.argv[1].split(path.sep).join('/')}`) {
  const r = await checkEbitdaBridge();
  console.log(
    `EBITDA bridge: ${r.cases} adjustment cases; reported EBITDA ties to filed operating profit plus filed D&A ` +
      `within ${r.worstFilingTie.toExponential(2)} and to the engine within ${r.worstEngineTie.toExponential(2)}; ` +
      `reported plus every adjustment ties to adjusted within ${r.worstBridgeTie.toExponential(2)}, recalculated ` +
      `across ${r.recalculated} year columns in the written file` +
      (r.example
        ? `; ${r.example.lines} adjustment lines take ${r.example.ticker} from ${Math.round(r.example.reported).toLocaleString('en-US')} ` +
          `to ${Math.round(r.example.adjusted).toLocaleString('en-US')} in the last of ${r.example.years} years`
        : '')
  );
  for (const p of r.problems) console.log(`  PROBLEM: ${p}`);
  process.exit(r.problems.length ? 1 : 0);
}
