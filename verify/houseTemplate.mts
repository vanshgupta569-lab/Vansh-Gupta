// FILE: verify/houseTemplate.mts
//
// THE HOUSE TEMPLATE, END TO END.
//
// Checked against a template written the way an analyst writes one — "Sales",
// "COGS", "SG&A", its own tabs, its own year header, a units column, and a
// section of lines we do not carry. A fixture built from our own labels would
// match everything and prove nothing.
//
// What this asserts, in the order the rules were given:
//   - a line of ours their template has no place for is REPORTED, not dropped;
//   - a cell of theirs we cannot fill SAYS SO, and never reads as a nil;
//   - their formatting survives, and only mapped cells are written;
//   - a revised template reconciles rather than needing to be redone.
//
// Run by `npm run verify:workbook`.
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..').split(path.sep).join('/');
const require_ = createRequire(`${REPO}/package.json`);
const ExcelJS = require_('exceljs');

const { houseTemplateBytes } = await import(`file:///${REPO}/verify/fixtures/houseTemplate.mts`);
const H: any = await import(`file:///${REPO}/src/data/houseTemplate.ts`);
const { buildWorkbook, MODEL_SHEET_ROWS } = await import(`file:///${REPO}/src/data/excelExport.ts`);
const { buildCompanyFrom } = await import(`file:///${REPO}/src/data/autoCompany.ts`);
const { defaultDriversFor, buildFullModel } = await import(`file:///${REPO}/src/data/companies.ts`);
const { readPayload } = await import(`file:///${REPO}/verify/payloadSet.mts`);

const isNum = (v: any): v is number => typeof v === 'number' && isFinite(v);

export interface TemplateReport {
  problems: string[];
  contracted: number;
  mapped: number;
  unmapped: number;
  review: number;
  conflicts: number;
  filled: number;
  unfilled: number;
  periods: number;
  kept: number;
  moved: number;
  lost: number;
}

export async function checkHouseTemplate(ticker = 'AAPL'): Promise<TemplateReport> {
  const problems: string[] = [];

  // ---- the firm's template, and the mapping the upload proposes -----------
  const bytes = await houseTemplateBytes();
  const tpl = new ExcelJS.Workbook();
  await tpl.xlsx.load(bytes);
  const detection: any = H.detectMapping(tpl);

  const contracted = Object.keys(MODEL_SHEET_ROWS).length;
  if (!detection.mapping.length) problems.push('nothing was matched in the template at all');

  // EVERY PROPOSAL POINTS AT A LINE WE ACTUALLY PUBLISH.
  for (const line of detection.mapping) {
    if ((MODEL_SHEET_ROWS as any)[line.key] === undefined) {
      problems.push(`the mapping proposes "${line.key}", which is not in the chart of accounts`);
    }
  }

  // AND NO TWO PROPOSALS CLAIM THE SAME CELL, which would mean one line of
  // ours silently overwriting another in their file.
  const seen = new Map<string, string>();
  for (const line of detection.mapping) {
    const at = H.cellAddress(line);
    const held = seen.get(at);
    if (held) problems.push(`${held} and ${line.key} both write ${at}`);
    seen.set(at, line.key);
  }

  // A LINE WITH NOWHERE TO GO IS REPORTED. The arithmetic has to hold: every
  // contracted line is either mapped or named as unmapped, with none lost
  // between the two.
  const mappedKeys = new Set<string>(detection.mapping.map((m: any) => m.key));
  const unmappedKeys = new Set<string>(detection.unmapped.map((u: any) => u.key));
  for (const key of mappedKeys) {
    if (unmappedKeys.has(key)) problems.push(`${key} is reported as both mapped and unmapped`);
  }
  // Rows with no label of their own cannot be matched by name, and are not
  // offered as unmapped either; every NAMED line must be in exactly one list.
  for (const key of LABEL_KEYS) {
    if (!mappedKeys.has(key) && !unmappedKeys.has(key)) {
      problems.push(`${key} is named in the contract but appears in neither list — it was lost`);
    }
  }

  // ---- fill it with a real company ---------------------------------------
  const payload: any = readPayload(`${ticker}.json`);
  const rec: any = buildCompanyFrom(payload);
  const source = rec.modelData;
  const drivers = { ...rec.defaultDrivers, ...defaultDriversFor(source) };
  const built: any = buildFullModel(source, drivers);
  const ours: any = await buildWorkbook({
    model: built.model, dcf: built.dcf, source,
    companyName: payload.name || ticker, ticker,
    currencySymbol: payload.currencySymbol || '$',
    unitLabel: `${payload.currencySymbol || '$'} millions`,
    modelLabel: 'Verification run',
  });
  const valueAt = await H.computeModelValues(ours);

  const mapping = {
    id: 'verify', name: 'Acme operating model',
    fingerprint: await H.fingerprintOf(bytes),
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    lines: detection.mapping,
    periodColumnsBySheet: detection.periodColumnsBySheet,
    periodColumns: detection.periodColumns,
  };
  const result: any = await H.fillTemplate(bytes, mapping, valueAt, { periods: 5 });

  const filled = new ExcelJS.Workbook();
  await filled.xlsx.load(result.bytes);

  // THEIR FORMATTING IS THEIRS: the tabs they had are still there, under the
  // names they gave them, and their headings are untouched.
  for (const name of ['P&L', 'Balance sheet', 'Cash flow']) {
    if (!filled.getWorksheet(name)) problems.push(`the filled file has lost their "${name}" tab`);
  }
  const pl = filled.getWorksheet('P&L');
  if (pl && pl.getCell('B1').value !== 'ACME CAPITAL PARTNERS') {
    problems.push(`their header was overwritten: ${JSON.stringify(pl?.getCell('B1').value)}`);
  }
  if (pl && String(pl.getCell('B6').value) !== 'Sales') {
    problems.push(`their line name was overwritten: ${JSON.stringify(pl?.getCell('B6').value)}`);
  }

  // A LINE THEY CARRY AND WE DO NOT IS LEFT ALONE: their "Diluted EPS" and
  // "Dividend per share" rows match nothing of ours, and must come back
  // untouched rather than blanked or filled with something adjacent.
  if (pl) {
    for (const [at, want] of [['B22', 'Diluted EPS'], ['B23', 'Dividend per share']] as const) {
      const got = String(pl.getCell(at).value ?? '');
      if (got !== want) problems.push(`their own line at ${at} reads "${got}", expected "${want}"`);
      const figure = pl.getCell(`D${at.slice(1)}`).value;
      if (figure !== null && figure !== undefined && figure !== '') {
        problems.push(`a line we do not carry was written into at D${at.slice(1)}: ${JSON.stringify(figure)}`);
      }
    }
  }

  // OUR FIGURES ARE OURS: the mapped cells hold what the model holds.
  let checkedFigures = 0;
  for (const line of detection.mapping.slice(0, 40)) {
    const ws = filled.getWorksheet(line.sheet);
    if (!ws) continue;
    const want = valueAt(line.key, 0);
    const got = ws.getRow(line.row).getCell(line.col).value;
    checkedFigures++;
    if (isNum(want)) {
      if (!isNum(got) || Math.abs((got as number) - want) > Math.max(1e-6, Math.abs(want) * 1e-9)) {
        problems.push(`${line.key} at ${H.cellAddress(line)}: template holds ${JSON.stringify(got)}, model holds ${want}`);
      }
    } else if (got !== H.CANNOT_FILL) {
      // A CELL WE COULD NOT FILL MUST SAY SO.
      problems.push(
        `${line.key} at ${H.cellAddress(line)} had no figure and reads ${JSON.stringify(got)} rather than "${H.CANNOT_FILL}"`
      );
    }
  }
  if (!checkedFigures) problems.push('no filled figures were checked');

  // NOTHING MAPPED IS LEFT BLANK. A blank in a filled model reads as nil.
  for (const line of detection.mapping) {
    const ws = filled.getWorksheet(line.sheet);
    if (!ws) continue;
    const v = ws.getRow(line.row).getCell(line.col).value;
    if (v === null || v === undefined || v === '') {
      problems.push(`${line.key} at ${H.cellAddress(line)} is blank, which reads as a nil`);
    }
  }

  // THE REPORT TRAVELS WITH THE FILE, so a partner reading it next week knows
  // what was not carried across.
  const reportSheet = filled.worksheets.find((w: any) => /what was mapped/i.test(w.name));
  if (!reportSheet) problems.push('the filled file carries no report of what was mapped');
  else {
    const text: string[] = [];
    reportSheet.eachRow({ includeEmpty: false }, (row: any) =>
      row.eachCell({ includeEmpty: false }, (cell: any) => text.push(String(cell.value ?? '')))
    );
    const joined = text.join(' | ');
    if (result.unmapped.length && !/has no cell for/i.test(joined)) {
      problems.push('the report does not name the lines their template has no cell for');
    }
    if (result.unfilled.length && !/could not fill/i.test(joined)) {
      problems.push('the report does not name the cells that could not be filled');
    }
    for (const u of result.unmapped.slice(0, 5)) {
      if (!joined.includes(u.key)) problems.push(`the report omits the unmapped line ${u.key}`);
    }
  }

  // ---- a revised template reconciles rather than being redone ------------
  const revised = new ExcelJS.Workbook();
  await revised.xlsx.load(bytes);
  revised.getWorksheet('P&L').spliceRows(5, 0, [], []);   // two rows inserted
  revised.getWorksheet('Cash flow').name = 'Cashflow';    // a tab renamed
  const revisedBytes = await revised.xlsx.writeBuffer();
  const reloaded = new ExcelJS.Workbook();
  await reloaded.xlsx.load(revisedBytes);
  const detection2: any = H.detectMapping(reloaded);
  const sameBytes = (await H.fingerprintOf(bytes)) === (await H.fingerprintOf(revisedBytes));
  const r: any = H.reconcile(mapping, detection2, sameBytes);

  if (sameBytes) problems.push('a changed file was reported as byte-identical');
  if (r.lost.length) problems.push(`${r.lost.length} lines were lost by a revision that only moved rows: ${r.lost.map((l: any) => l.key).join(', ')}`);
  if (!r.moved.length) problems.push('a revision that inserted rows and renamed a tab reported nothing moved');
  const plMoved = r.moved.find((m: any) => m.line.key === 'rev');
  if (!plMoved) problems.push('revenue did not move when two rows were inserted above it');
  else if (plMoved.to.row !== plMoved.line.row + 2) {
    problems.push(`revenue moved to row ${plMoved.to.row}, expected ${plMoved.line.row + 2}`);
  }
  const cfMoved = r.moved.find((m: any) => m.line.key === 'cfo');
  if (!cfMoved || cfMoved.to.sheet !== 'Cashflow') {
    problems.push('the renamed tab was not followed');
  }
  const applied: any = H.applyReconciliation(mapping, r, detection2);
  if (applied.lines.length !== r.kept.length + r.moved.length + r.gained.length) {
    problems.push('the applied mapping does not account for every reconciled line');
  }
  for (const line of applied.lines) {
    if (line.sheet === 'Cash flow') problems.push(`${line.key} still points at the old tab name`);
  }

  return {
    problems,
    contracted,
    mapped: detection.mapping.length,
    unmapped: detection.unmapped.length,
    review: detection.review.length,
    conflicts: detection.conflicts.length,
    filled: result.filled,
    unfilled: result.unfilled.length,
    periods: result.periodsWritten,
    kept: r.kept.length,
    moved: r.moved.length,
    lost: r.lost.length,
  };
}

const { MODEL_SHEET_ROW_LABELS } = await import(`file:///${REPO}/src/data/excelExport.ts`);
/** The contracted rows that carry a name, and so can be matched by one. */
const LABEL_KEYS = new Set<string>(Object.keys(MODEL_SHEET_ROW_LABELS));

if (import.meta.url === `file:///${process.argv[1].split(path.sep).join('/')}`) {
  const r = await checkHouseTemplate();
  console.log(
    `house template: ${r.mapped} of ${r.contracted} contracted rows mapped by a representative firm template ` +
      `(${r.unmapped} reported as unmapped, ${r.review} to review, ${r.conflicts} conflicts); ` +
      `${r.filled} figures written over ${r.periods} periods, ${r.unfilled} cells said "not reported"; ` +
      `a revision kept ${r.kept}, moved ${r.moved}, lost ${r.lost}`
  );
  for (const p of r.problems) console.log(`  PROBLEM: ${p}`);
  process.exit(r.problems.length ? 1 : 0);
}
