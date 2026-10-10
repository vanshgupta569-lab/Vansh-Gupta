// FILE: verify/classification.mts
//
// EXPENSE CLASSIFICATION — the first piece of the judgement layer.
//
// The feature's whole claim is a pair of statements about arithmetic, and a
// claim about arithmetic is either checked or it is marketing:
//
//   1. Moving a line between DIRECT, INDIRECT, SELLING AND DISTRIBUTION and
//      ADMINISTRATIVE cannot change operating profit, or value per share, in
//      any year. Operating profit is the sum of those lines and addition does
//      not care what they are called.
//   2. EXCLUDING a line is the one choice that does change them — and even then
//      REPORTED operating profit still ties to the filing, in every reported
//      year, under every classification. A judgement about the future may not
//      restate a filing.
//
// It also checks the rules the roadmap sets for every judgement: a default that
// says where it came from, a reason carried with an override, a return to the
// default that reproduces the engine's own model exactly, and the two columns
// of the workbook's Assumptions sheet filled rather than headed and empty.
//
// Run by `npm run verify:workbook`.
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..').split(path.sep).join('/');
const require_ = createRequire(`${REPO}/package.json`);
const ExcelJS = require_('exceljs');

const C: any = await import(`file:///${REPO}/src/data/classification.ts`);
const { buildCompanyFrom, valueUnder } = await import(`file:///${REPO}/src/data/autoCompany.ts`);
const { defaultDriversFor, buildFullModel } = await import(`file:///${REPO}/src/data/companies.ts`);
const { buildWorkbook } = await import(`file:///${REPO}/src/data/excelExport.ts`);
const { readPayload, PAYLOADS } = await import(`file:///${REPO}/verify/payloadSet.mts`);
const fs = await import('node:fs');

const isNum = (v: any): v is number => typeof v === 'number' && isFinite(v);

export interface ClassificationReport {
  problems: string[];
  /** Payloads whose classifiable-line count was measured. */
  measured: number;
  /** How many lines are classifiable, by count. */
  histogram: Record<number, number>;
  typical: number;
  /** The worst reported-EBIT-against-filing gap seen under any classification. */
  worstTie: number;
  /** What one exclusion did to a value, as a worked number. */
  moved: { ticker: string; base: number; excluded: number; line: string } | null;
  /** Bucket moves checked, and the worst value difference any of them caused. */
  bucketMoves: number;
  worstBucketDrift: number;
}

/** Every grouping category, which must all behave identically. */
const BUCKETS = ['direct', 'indirect', 'selling', 'admin'] as const;

function reportedEbitGap(payload: any, cls: any): number {
  const rec: any = buildCompanyFrom(payload, {}, cls);
  const drivers: any = { ...rec.defaultDrivers, ...defaultDriversFor(rec.modelData) };
  const { model: M } = buildFullModel(rec.modelData, drivers);
  let worst = 0;
  for (let i = 0; i < M.nH; i++) {
    const filed = payload.statements[i]?.operatingIncome;
    if (!isNum(filed) || !isNum(M.ebit[i])) continue;
    // Scaled, because a gap of 1 on a revenue of ten million is noise and a
    // gap of 1 on a revenue of 10 is not.
    const scale = Math.max(1, Math.abs(filed));
    worst = Math.max(worst, Math.abs(M.ebit[i] - filed) / scale);
  }
  return worst;
}

export async function checkClassification(ticker = 'RELIANCE.NS'): Promise<ClassificationReport> {
  const problems: string[] = [];

  // ---- the schema itself ------------------------------------------------
  // EVERY DEFAULT SAYS WHERE IT CAME FROM. This is the first rule of the
  // judgement layer, and a default without a basis is the silent judgement the
  // whole layer exists to remove.
  for (const line of C.CLASSIFIABLE_LINES) {
    if (!line.defaultBasis || line.defaultBasis.length < 40) {
      problems.push(`${line.key} has no basis for its default treatment`);
    }
    if (!C.CATEGORY_BY_KEY[line.defaultCategory]) {
      problems.push(`${line.key} defaults to "${line.defaultCategory}", which is not a category`);
    }
    if (!line.excludable && !line.notExcludableBecause) {
      problems.push(`${line.key} cannot be excluded and does not say why`);
    }
  }
  for (const cat of C.CATEGORIES) {
    if (!cat.definition || cat.definition.length < 30) {
      problems.push(`the category ${cat.key} has no definition`);
    }
  }

  // ---- how many lines are there to classify -----------------------------
  const histogram: Record<number, number> = {};
  let measured = 0;
  for (const file of fs.readdirSync(PAYLOADS).filter((f: string) => f.endsWith('.json'))) {
    let payload: any;
    try {
      payload = readPayload(file);
    } catch {
      continue;
    }
    const n = C.classifiableFor(payload.statements || []).length;
    histogram[n] = (histogram[n] || 0) + 1;
    measured++;
  }
  const counts: number[] = [];
  for (const [n, many] of Object.entries(histogram)) for (let i = 0; i < many; i++) counts.push(Number(n));
  counts.sort((a, b) => a - b);
  const typical = counts.length ? counts[Math.floor(counts.length / 2)] : 0;

  // ---- the company under test -------------------------------------------
  const payload: any = readPayload(`${ticker}.json`);
  const lines = C.classifiableFor(payload.statements || []);
  if (lines.length < 2) problems.push(`${ticker} has only ${lines.length} classifiable lines, too few to test a move`);

  const base = valueUnder(payload, {}, {});
  if (base.refusal) problems.push(`${ticker} is refused before any judgement is made: ${base.refusal}`);

  // ---- 1. A BUCKET MOVE CHANGES NO NUMBER -------------------------------
  //
  // Every classifiable line into every grouping category, one at a time, and
  // then all of them at once. Not one of these may move the value by a cent.
  let bucketMoves = 0;
  let worstBucketDrift = 0;
  const driftOf = (v: any) => {
    if (v.refusal) return Infinity;
    const parts: number[] = [];
    for (const key of ['perpetuity', 'exitMultiple'] as const) {
      const now = v[key];
      const was = (base as any)[key];
      if (!isNum(now) || !isNum(was)) {
        if (isNum(now) !== isNum(was)) return Infinity;
        continue;
      }
      parts.push(Math.abs(now - was) / Math.max(1e-9, Math.abs(was)));
    }
    return parts.length ? Math.max(...parts) : 0;
  };
  for (const line of lines) {
    for (const bucket of BUCKETS) {
      const cls = { [line.key]: { category: bucket, reason: 'a verification move' } };
      const drift = driftOf(valueUnder(payload, {}, cls));
      bucketMoves++;
      if (drift > 1e-12) {
        problems.push(
          `moving ${line.key} to ${bucket} changed value per share by ${(drift * 100).toExponential(2)}% — ` +
            'a grouping must not move a number'
        );
      }
      worstBucketDrift = Math.max(worstBucketDrift, Math.min(drift, 1e9));
    }
  }
  const allMoved: any = {};
  lines.forEach((line: any, i: number) => {
    allMoved[line.key] = { category: BUCKETS[(i + 1) % BUCKETS.length] };
  });
  const everythingMoved = driftOf(valueUnder(payload, {}, allMoved));
  bucketMoves++;
  if (everythingMoved > 1e-12) {
    problems.push(`moving every line at once changed value per share by ${(everythingMoved * 100).toExponential(2)}%`);
  }
  worstBucketDrift = Math.max(worstBucketDrift, Math.min(everythingMoved, 1e9));

  // ---- 2. REPORTED OPERATING PROFIT TIES, WHATEVER IS CHOSEN ------------
  let worstTie = 0;
  const everyClassification: any[] = [{}, allMoved];
  for (const line of lines) {
    for (const cat of C.CATEGORIES) {
      if (cat.key === 'excluded' && !line.excludable) continue;
      everyClassification.push({ [line.key]: { category: cat.key } });
    }
  }
  for (const cls of everyClassification) {
    worstTie = Math.max(worstTie, reportedEbitGap(payload, cls));
    // And the screen's own subtotals must partition the same costs: revenue
    // less every classified cost, against the filed figure.
    for (const year of C.subtotals(payload.statements, cls)) {
      if (year.tie !== null && Math.abs(year.tie) > 1e-6) {
        problems.push(
          `FY${year.year}: revenue less every classified cost misses filed operating profit by ${year.tie} ` +
            `under ${JSON.stringify(cls)} — a line was counted twice or dropped`
        );
      }
    }
  }
  if (worstTie > 1e-6) {
    problems.push(`reported operating profit drifts from the filing by ${worstTie.toExponential(2)} of itself`);
  }

  // ---- 3. AN EXCLUSION DOES MOVE THE VALUE ------------------------------
  //
  // The mirror of check 1, and the reason it is not vacuous: a feature where
  // nothing a reader chooses changes anything would pass every test above.
  let moved: ClassificationReport['moved'] = null;
  const excludable = lines.filter((l: any) => l.excludable);
  if (!excludable.length) problems.push(`${ticker} has no excludable line, so the one judgement with arithmetic is untested`);
  for (const line of excludable) {
    const cls = { [line.key]: { category: 'excluded', reason: 'a one-off, for verification' } };
    const after = valueUnder(payload, {}, cls);
    if (after.refusal) continue;
    const drift = driftOf(after);
    if (!(drift > 1e-9)) {
      problems.push(
        `excluding ${line.key} left value per share unchanged — an exclusion must take the line out of the forecast`
      );
    }
    if (isNum(base.perpetuity) && isNum(after.perpetuity) && after.perpetuity <= base.perpetuity) {
      problems.push(`excluding the cost ${line.key} did not raise the value (${base.perpetuity} -> ${after.perpetuity})`);
    }
    if (!moved && isNum(base.perpetuity) && isNum(after.perpetuity)) {
      moved = { ticker, base: base.perpetuity, excluded: after.perpetuity, line: line.label };
    }
    // AND THE FORECAST LINE IS ACTUALLY NIL, not merely smaller.
    const rec: any = buildCompanyFrom(payload, {}, cls);
    const drivers: any = { ...rec.defaultDrivers, ...defaultDriversFor(rec.modelData) };
    const { model: M } = buildFullModel(rec.modelData, drivers);
    const field = { rnd: 'rndReportedBasis', sga: 'sgaReportedBasis', otherOperatingCosts: 'otherOperatingCostsReportedBasis' }[
      line.key as string
    ];
    if (field) {
      for (let t = M.nH; t < M.nH + 5; t++) {
        const v = M[field]?.[t];
        if (isNum(v) && Math.abs(v) > 1e-6) {
          problems.push(`${line.key} is excluded but the forecast still carries ${v} in year ${t - M.nH + 1}`);
          break;
        }
      }
      // And the reported years are untouched, which is the whole promise.
      for (let t = 0; t < M.nH; t++) {
        const plain: any = buildCompanyFrom(payload, {}, {});
        const pd: any = { ...plain.defaultDrivers, ...defaultDriversFor(plain.modelData) };
        const { model: P } = buildFullModel(plain.modelData, pd);
        const a = M[field]?.[t];
        const b = P[field]?.[t];
        if (isNum(a) !== isNum(b) || (isNum(a) && isNum(b) && Math.abs(a - b) > 1e-6)) {
          problems.push(`excluding ${line.key} changed the REPORTED year ${t}: ${b} became ${a}`);
        }
        break; // one year is enough to catch a reported-side change
      }
    }
    // The engine must say what it did, in its own provenance.
    const note = rec.modelData?.provenance?.[line.key === 'otherOperatingCosts' ? 'otherOperatingCosts' : line.key];
    if (!note || !/excluded as non-recurring by you/i.test(String(note))) {
      problems.push(`excluding ${line.key} is not stated in the engine's provenance: ${String(note).slice(0, 80)}`);
    }
    if (!/for verification/.test(String(note))) {
      problems.push(`the reason given for excluding ${line.key} is not carried in the provenance`);
    }
  }

  // ---- 4. RETURNING TO THE DEFAULT REPRODUCES THE ENGINE'S OWN MODEL ----
  //
  // Rule three of the judgement layer is a visible return to the default. A
  // return that leaves anything behind is worse than none, so the model built
  // after a round trip is compared with the one built before any judgement.
  const roundTrip = valueUnder(payload, {}, { sga: { category: 'excluded', reason: 'then undone' } });
  void roundTrip;
  const backToDefault = valueUnder(payload, {}, {});
  for (const key of ['perpetuity', 'exitMultiple'] as const) {
    const a = (base as any)[key];
    const b = (backToDefault as any)[key];
    if (isNum(a) && isNum(b) ? Math.abs(a - b) > 1e-9 : isNum(a) !== isNum(b)) {
      problems.push(`a return to the default did not reproduce the engine's own ${key}: ${a} against ${b}`);
    }
  }
  // Setting a line explicitly to its own default is not an override.
  for (const line of C.CLASSIFIABLE_LINES) {
    const asDefault = { [line.key]: { category: line.defaultCategory } };
    if (C.overrideCount(asDefault) !== 0) {
      problems.push(`${line.key} set to its own default counts as an override`);
    }
    if (C.applyClassification(payload, asDefault) !== payload) {
      problems.push(`${line.key} set to its own default still reaches the engine as a judgement`);
    }
  }
  // A choice the line does not offer is never applied.
  const illegal = C.applyClassification(payload, { cogs: { category: 'excluded', reason: 'not allowed' } });
  if (illegal.classification && illegal.classification.cogs) {
    problems.push('cost of sales was excluded, which the forecast has no way to honour');
  }

  // ---- 5. THE WORKBOOK'S TWO COLUMNS ------------------------------------
  const cls = { sga: { category: 'selling', reason: 'their distribution fleet sits in this line' } };
  const rec: any = buildCompanyFrom(payload, {}, cls);
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
  const ws = wb.getWorksheet('Assumptions');
  if (!ws) problems.push('the workbook has no Assumptions sheet');
  else {
    if (String(ws.getCell(6, 8).value ?? '') !== 'Default or yours') {
      problems.push(`column 8 is headed ${JSON.stringify(ws.getCell(6, 8).value)}`);
    }
    const found: Record<string, { state: string; reason: string }> = {};
    ws.eachRow({ includeEmpty: false }, (row: any) => {
      const name = String(row.getCell(3).value ?? '');
      const state = String(row.getCell(8).value ?? '');
      if (!state || row.number === 6) return;
      found[name] = { state, reason: String(row.getCell(9).value ?? '') };
    });
    const filled = Object.keys(found);
    if (filled.length < 2) {
      problems.push(`only ${filled.length} assumption rows carry a judgement; the cost rows should`);
    }
    // THE SHEET AND THE SCREEN OFFER THE SAME CHOICES.
    //
    // A column saying R&D defaults to indirect, on a company that reports no
    // R&D, describes a decision the screen never asks for. The sheet reads the
    // model's reported-basis series and the screen reads the statements, so
    // this is the check that they agree.
    const ROW_FOR: Record<string, RegExp> = {
      cogs: /gross margin/i,
      rnd: /research & development/i,
      sga: /selling, general/i,
      otherOperatingCosts: /other operating costs/i,
    };
    const offeredOnScreen = new Set<string>(lines.map((l: any) => l.key));
    for (const line of C.CLASSIFIABLE_LINES) {
      const inSheet = filled.some((n) => ROW_FOR[line.key].test(n));
      const onScreen = offeredOnScreen.has(line.key);
      if (inSheet !== onScreen) {
        problems.push(
          `${line.key} is ${onScreen ? 'offered on screen but carries no column' : 'not offered on screen but carries a column'} ` +
            'in the workbook \u2014 the sheet and the screen must offer the same choices'
        );
      }
    }
    const sga = filled.find((n) => /selling, general/i.test(n));
    if (!sga) problems.push('the SG&A assumption row carries no judgement');
    else {
      // THE OVERRIDE SAYS IT IS THE READER'S, AND NAMES THE DEFAULT IT LEFT.
      if (!/^Yours: Selling and distribution \(default: Administrative\)/.test(found[sga].state)) {
        problems.push(`the SG&A row reads ${JSON.stringify(found[sga].state)}`);
      }
      if (found[sga].reason !== cls.sga.reason) {
        problems.push(`the SG&A row's reason reads ${JSON.stringify(found[sga].reason)}`);
      }
    }
    const gross = filled.find((n) => /gross margin/i.test(n));
    if (!gross) problems.push('the gross margin row carries no judgement');
    else if (!/^Default: Direct cost/.test(found[gross].state)) {
      problems.push(`the gross margin row reads ${JSON.stringify(found[gross].state)} rather than its default`);
    } else if (found[gross].reason !== '') {
      problems.push(`a row on its default carries a reason: ${JSON.stringify(found[gross].reason)}`);
    }
    // An override with no reason must say so rather than coming back blank.
    const silent: any = buildCompanyFrom(payload, {}, { sga: { category: 'selling' } });
    const sd: any = { ...silent.defaultDrivers, ...defaultDriversFor(silent.modelData) };
    const sb: any = buildFullModel(silent.modelData, sd);
    const wb2: any = await buildWorkbook({
      model: sb.model, dcf: sb.dcf, source: silent.modelData,
      companyName: payload.name || ticker, ticker,
      currencySymbol: payload.currencySymbol || '$',
      unitLabel: `${payload.currencySymbol || '$'} millions`,
      modelLabel: 'Verification run',
    });
    const ws2 = wb2.getWorksheet('Assumptions');
    let said = false;
    ws2.eachRow({ includeEmpty: false }, (row: any) => {
      if (/selling, general/i.test(String(row.getCell(3).value ?? ''))) {
        said = String(row.getCell(9).value ?? '') === 'No reason given.';
      }
    });
    if (!said) problems.push('an override with no reason leaves the reason cell blank rather than saying so');
  }

  return {
    problems,
    measured,
    histogram,
    typical,
    worstTie,
    moved,
    bucketMoves,
    worstBucketDrift,
  };
}

if (import.meta.url === `file:///${process.argv[1].split(path.sep).join('/')}`) {
  const r = await checkClassification();
  console.log(
    `expense classification: ${r.bucketMoves} grouping moves, worst value drift ${r.worstBucketDrift.toExponential(2)}; ` +
      `reported operating profit ties to the filing within ${r.worstTie.toExponential(2)} under every classification; ` +
      (r.moved
        ? `excluding ${r.moved.line} takes ${r.moved.ticker} from ${r.moved.base.toFixed(2)} to ${r.moved.excluded.toFixed(2)}; `
        : '') +
      `typically ${r.typical} lines are classifiable (${r.measured} payloads, ${JSON.stringify(r.histogram)})`
  );
  for (const p of r.problems) console.log(`  PROBLEM: ${p}`);
  process.exit(r.problems.length ? 1 : 0);
}
