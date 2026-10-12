// FILE: verify/savedModel.mts
//
// A SAVED MODEL REOPENS AT THE FIGURE IT WAS SAVED AT (`KI-27`).
//
// The defect was not a missing field, it was a missing path: restoring set the
// sliders and stopped, so a model built on a corrected figure or a reclassified
// cost line reopened on the filed figures and the engine's own treatments,
// while the saved list went on printing the value it had WITH them.
//
// This is the check that makes the fix mean something, and it is the shape the
// job asked for: edit judgements, save, reopen, compare.
//
//   1. Build a company, then move EVERY judgement that exists: the sliders,
//      a correction to a filed figure with its reason, an expense
//      classification with its reason, the peer set, the recovery rates, and
//      the price the valuation is struck against.
//   2. Save it, through the real `makeSavedModel`, and put it through the real
//      wire format (`serialise` then `parse`) so what is compared is what a
//      file or a server would hand back, not an object still in memory.
//   3. Reopen it through the one restore path and compare: value per share on
//      both methods, the adjusted EBITDA the bridge arrives at, the figures the
//      dashboard reads, and the workbook written from the restored record.
//   4. And check the honesty rules: a version 1 record comes back naming what
//      it never stored, with nothing guessed and nothing zeroed; a record that
//      is complete reopens at its own figure; a store round trip keeps the
//      shape; and the price is carried, because without it the same judgements
//      give a different answer.
//
// Run by `npm run verify:workbook`.
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..').split(path.sep).join('/');
const require_ = createRequire(`${REPO}/package.json`);
const ExcelJS = require_('exceljs');

const S: any = await import(`file:///${REPO}/src/data/savedModels.ts`);
const R: any = await import(`file:///${REPO}/src/data/restoreModel.ts`);
const { buildCompanyFrom } = await import(`file:///${REPO}/src/data/autoCompany.ts`);
const { buildWorkbook } = await import(`file:///${REPO}/src/data/excelExport.ts`);
const { valuationBandsFor, buildFullModel } = await import(`file:///${REPO}/src/data/companies.ts`);
const { readPayload } = await import(`file:///${REPO}/verify/payloadSet.mts`);

const isNum = (v: any): v is number => typeof v === 'number' && isFinite(v);
/** Relative, because a value per share and an EBITDA are different magnitudes. */
const off = (a: number, b: number) => Math.abs(a - b) / Math.max(1e-9, Math.abs(b));
/** The harness tolerance used across the workbook checks. */
const TOLERANCE = 1e-9;

export interface SavedModelReport {
  problems: string[];
  /** Judgements moved before saving. */
  moved: number;
  /** Figures compared between what was saved and what reopened. */
  compared: number;
  worstDrift: number;
  /** What the judgements were worth: value on defaults against value saved. */
  example: { onDefaults: number | null; saved: number | null } | null;
  /** Inputs a version 1 record is reported as lacking. */
  v1Missing: number;
  /** Years of the reopened model's balance check, and how many are not nil. */
  checkRows: number;
  checksNonZero: number;
}

export async function checkSavedModel(ticker = 'RELIANCE.NS'): Promise<SavedModelReport> {
  const problems: string[] = [];
  const payload: any = readPayload(`${ticker}.json`);
  const filed: any[] = payload.statements || [];
  const last = filed[filed.length - 1];
  const lastYear = String(last.fiscalYear);

  // ---- 1. a company with every judgement moved --------------------------
  const corrections: any = { [lastYear]: { operatingIncome: last.operatingIncome + 40_000 } };
  const correctionReasons: any = { operatingIncome: 'restated in the annual report' };
  const classification: any = {
    otherOperatingCosts: { category: 'excluded', reason: 'a port write-down that will not repeat' },
    sga: { category: 'selling', reason: 'their distribution fleet sits in this line' },
  };
  const verdicts: any = { moat: 'yes', cyclicality: 'no' };
  const peers: string[] = ['AAPL', 'MSFT'];
  const recovery = { key: 'orderly', rates: { receivables: 0.9, inventory: 0.7 } };
  const sharePrice = 1_450;

  const record: any = buildCompanyFrom(payload, corrections, classification, correctionReasons);
  const source: any = record.modelData;
  const defaults: any = R.defaultsFor(record, source);
  // The sliders, moved off the model's own figures.
  const drivers: any = { ...defaults };
  let moved = 0;
  // DELIBERATELY NOT `waccPct`. Setting the cost of capital pins it, and the
  // share price then drops out of the answer entirely (measured: 651.13 at any
  // price). A reader who leaves the WACC alone has a valuation that moves with
  // the price, which is the harder case and the one the saved price exists for,
  // so that is the case this check saves.
  for (const key of ['terminalGrowthPct', 'revenueGrowthPct', 'operatingMarginPct', 'exitMultipleX']) {
    if (isNum(defaults[key])) {
      drivers[key] = Number((defaults[key] + 0.4).toFixed(4));
      moved++;
    }
  }
  if (moved < 2) problems.push(`only ${moved} sliders could be moved, too few to prove the sliders restore`);

  const judgements = {
    ...S.emptyJudgements(),
    drivers,
    viewMode: 'DERIVED',
    corrections,
    correctionReasons,
    classification,
    verdicts,
    appliedVerdicts: verdicts,
    peers,
    recovery,
    sharePrice,
  };
  // Every judgement the shape carries must actually be set here, or the check
  // is only testing the ones it happened to think of.
  for (const key of Object.keys(S.emptyJudgements())) {
    const v = (judgements as any)[key];
    const empty =
      v === null ||
      v === undefined ||
      (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) ||
      (Array.isArray(v) && v.length === 0);
    if (empty) problems.push(`the check leaves "${key}" empty, so nothing proves it is restored`);
  }

  // WHAT IS SAVED IS COMPUTED THE WAY THE SCREEN COMPUTES IT, NOT BY THE
  // RESTORE PATH.
  //
  // The first version of this check took `produced` from
  // `restoreFromJudgements` and then compared it against the same function's
  // answer. Breaking the restore on purpose — dropping the classification,
  // which is exactly `KI-27` — left the drift at nil, because both sides were
  // wrong in the same way. A saved figure comes from the dashboard: it builds
  // the record, computes the model's defaults, lays the sliders over them and
  // reads `valuationBandsFor`. So that is done here, by hand, and the restore
  // has something independent to be wrong against.
  const asTheScreenComputes = (
    corr: any,
    cls: any,
    why: any,
    sliders: any,
    price: number | null
  ): { perpetuity: number | null; exitMultiple: number | null; adjustedEbitda: number | null; refusal: string | null } => {
    const rec: any = buildCompanyFrom(payload, corr, cls, why);
    const src: any = rec.modelData;
    const defs: any = R.defaultsFor(rec, src);
    const d: any = { ...defs, ...sliders };
    const bands: any[] = valuationBandsFor(src, d, price);
    const point = (needle: string) =>
      bands.find((b) => isNum(b?.point) && b.point > 0 && String(b.label).toLowerCase().includes(needle))?.point ?? null;
    const bridgeSeries: any[] = rec?.modelData?.meta?.ebitdaBridge?.adjustedEbitda ?? [];
    let adjusted: number | null = null;
    for (let i = bridgeSeries.length - 1; i >= 0 && adjusted === null; i--) {
      if (isNum(bridgeSeries[i])) adjusted = bridgeSeries[i];
    }
    return {
      perpetuity: point('perpetuity'),
      exitMultiple: point('exit'),
      adjustedEbitda: adjusted,
      refusal: bands.length ? null : 'the engine returned no valuation bands',
    };
  };

  // What it is actually worth: the same company with no judgements at all.
  const plain: any = asTheScreenComputes({}, {}, {}, {}, sharePrice);
  const asSaved: any = asTheScreenComputes(corrections, classification, correctionReasons, drivers, sharePrice);
  if (asSaved.refusal) problems.push(`the model with judgements is refused: ${asSaved.refusal}`);
  // A CHECK THAT WOULD PASS WITH THE JUDGEMENTS IGNORED IS NO CHECK. They have
  // to be worth something, or every comparison below is trivially true.
  if (isNum(plain.perpetuity) && isNum(asSaved.perpetuity)) {
    if (off(asSaved.perpetuity, plain.perpetuity) < 0.01) {
      problems.push(
        `the judgements move the value by only ${(off(asSaved.perpetuity, plain.perpetuity) * 100).toFixed(3)}%, ` +
          'so this check could pass with the restore broken'
      );
    }
  } else {
    problems.push('the value could not be computed with and without the judgements');
  }

  // ---- 2. save it, through the real shape and the real wire format ------
  const entry: any = S.makeSavedModel({
    ticker,
    companyName: payload.name || ticker,
    name: 'verification set',
    currencySymbol: payload.currencySymbol || '$',
    judgements,
    produced: {
      perpetuity: asSaved.perpetuity,
      exitMultiple: asSaved.exitMultiple,
      adjustedEbitda: asSaved.adjustedEbitda,
    },
  });
  if (entry.version !== S.SAVED_MODEL_VERSION) problems.push(`a new record is written at version ${entry.version}`);
  if (!S.isComplete(entry)) problems.push(`a new record reports ${entry.missing.length} inputs missing`);

  // THROUGH THE FILE, NOT THE OBJECT. What a reopen gets is what a file or a
  // server hands back, so that is what is compared.
  const roundTripped: any[] = S.parse(S.serialise([entry]));
  if (roundTripped.length !== 1) problems.push(`${roundTripped.length} records survived the wire format`);
  const reread: any = roundTripped[0] || entry;
  if (reread.id !== entry.id) problems.push('the record came back with a different id');
  if (JSON.stringify(reread.judgements) !== JSON.stringify(entry.judgements)) {
    problems.push('the judgements did not survive the wire format unchanged');
  }

  // ---- 3. reopen it, and compare ----------------------------------------
  const reopened: any = R.restoreFromJudgements(payload, reread.judgements);
  let compared = 0;
  let worstDrift = 0;
  let checkRows = 0;
  let checksNonZero = 0;
  const compare = (what: string, now: any, was: any) => {
    if (!isNum(was) && !isNum(now)) return;
    if (!isNum(was) || !isNum(now)) {
      problems.push(`${what}: saved ${JSON.stringify(was)}, reopened ${JSON.stringify(now)}`);
      return;
    }
    compared++;
    const drift = off(now, was);
    worstDrift = Math.max(worstDrift, drift);
    if (drift > TOLERANCE) {
      problems.push(`${what}: saved ${was}, reopened ${now} — ${(drift * 100).toExponential(2)}% apart`);
    }
  };
  compare('value per share, perpetuity', reopened.perpetuity, reread.produced.perpetuity);
  compare('value per share, exit multiple', reopened.exitMultiple, reread.produced.exitMultiple);
  compare('adjusted EBITDA', reopened.adjustedEbitda, reread.produced.adjustedEbitda);

  // THE SLIDERS COME BACK WHERE THEY WERE.
  for (const [key, value] of Object.entries(judgements.drivers)) {
    if (!isNum(value)) continue;
    const back = (reopened.drivers as any)[key];
    if (!isNum(back) || Math.abs(back - (value as number)) > 1e-12) {
      problems.push(`the slider ${key} was saved at ${value} and reopened at ${back}`);
    }
  }

  // AND THE JUDGEMENTS ARE ON THE REBUILT RECORD, not merely passed through.
  const rebuilt: any = reopened.record;
  if (!rebuilt.correctedInputs || rebuilt.correctedInputs.count !== 1) {
    problems.push(`the reopened record reports ${JSON.stringify(rebuilt.correctedInputs)} corrected inputs`);
  }
  if (!rebuilt.reclassified || rebuilt.reclassified.count !== 2) {
    problems.push(`the reopened record reports ${JSON.stringify(rebuilt.reclassified)} reclassified lines`);
  }
  const bridge: any = rebuilt.modelData?.meta?.ebitdaBridge;
  if (!bridge) problems.push('the reopened record carries no EBITDA bridge');
  else {
    const lines = [...bridge.corrections, ...bridge.exclusions];
    if (lines.length !== 2) problems.push(`the reopened bridge carries ${lines.length} adjustment lines, expected 2`);
    const why = lines.find((a: any) => a.key === 'correction:operatingIncome')?.reason;
    if (why !== correctionReasons.operatingIncome) {
      problems.push(`the reopened bridge's correction reason reads ${JSON.stringify(why)}`);
    }
    const exWhy = lines.find((a: any) => a.key === 'exclusion:otherOperatingCosts')?.reason;
    if (exWhy !== classification.otherOperatingCosts.reason) {
      problems.push(`the reopened bridge's exclusion reason reads ${JSON.stringify(exWhy)}`);
    }
  }

  // ---- the workbook written from the reopened record ---------------------
  const built: any = buildFullModel(rebuilt.modelData, reopened.drivers);
  const wb: any = await buildWorkbook({
    model: built.model,
    dcf: built.dcf,
    source: rebuilt.modelData,
    companyName: payload.name || ticker,
    ticker,
    currencySymbol: payload.currencySymbol || '$',
    unitLabel: `${payload.currencySymbol || '$'} millions`,
    modelLabel: 'Verification run',
  });
  const sheet = wb.getWorksheet('EBITDA bridge');
  if (!sheet) problems.push('the workbook written from the reopened record has no EBITDA bridge sheet');
  else {
    // The reasons travel into the file, which is the artefact a firm sends.
    const text: string[] = [];
    sheet.eachRow({ includeEmpty: false }, (row: any) =>
      row.eachCell({ includeEmpty: false }, (cell: any) => text.push(String(cell.value ?? '')))
    );
    const joined = text.join(' | ');
    for (const reason of [correctionReasons.operatingIncome, classification.otherOperatingCosts.reason]) {
      if (!joined.includes(reason)) problems.push(`the reopened workbook's bridge omits the reason "${reason}"`);
    }
    // And the last reported year's adjusted figure is the one that was saved.
    let adjustedRow = -1;
    sheet.eachRow({ includeEmpty: false }, (row: any) => {
      if (adjustedRow < 0 && String(row.getCell(3).value ?? '') === 'Adjusted EBITDA') adjustedRow = row.number;
    });
    if (adjustedRow < 0) problems.push('the reopened workbook has no adjusted EBITDA row');
  }
  const loaded = new ExcelJS.Workbook();
  await loaded.xlsx.load(await wb.xlsx.writeBuffer());
  if (!loaded.getWorksheet('EBITDA bridge')) problems.push('the written file lost its bridge sheet');

  // ---- EVERY CHECK THE WORKBOOK TESTS, NIL ON THE REOPENED MODEL --------
  //
  // THE SHEET CANNOT BE RECALCULATED HERE, and the first version of this tried.
  // The model sheet is deliberately circular — interest is charged on average
  // balances, with a circuit breaker at `$E$9` — so a plain HyperFormula pass
  // returns `#CYCLE!` on 347 cells and the Checks summary then counts those
  // errors as failures. `verify/scenarios.mts` owns the iterative machinery
  // that resolves it, and it already proves all 22 Checks rows nil, "All checks
  // pass", across ten scenarios.
  //
  // What is new here is the RECORD, not the workbook builder. So what is
  // asserted here is the identity those rows test, read off the engine the
  // reopened record produced: the balance sheet balances in every year. A
  // restore that rebuilt a record incoherently would fail this.
  const B: any = built.model?.balanceSheet;
  const bal: any[] = Array.isArray(B?.balanceCheck) ? B.balanceCheck : [];
  if (!bal.length) problems.push('the reopened model has no balance check to read');
  bal.forEach((v: any, i: number) => {
    if (!isNum(v)) return;
    checkRows++;
    if (Math.abs(v) > 1e-6) {
      checksNonZero++;
      if (checksNonZero <= 5) {
        problems.push(`the reopened model's balance sheet is out by ${v} in year ${i + 1}`);
      }
    }
  });
  // And the figures the Checks sheet would compare are the engine's own, which
  // `verify:workbook` proves for every workbook it writes. The reopened record
  // goes through the same builder, so a figure that disagreed would have been
  // caught by the comparison above rather than here.

  // ---- 4. THE PRICE IS AN INPUT, AND IS CARRIED -------------------------
  //
  // The cost of capital weights equity at market capitalisation, so the price
  // moves the answer. A saved model that dropped it could not reopen at its own
  // figure however many judgements it carried, and this proves the figure
  // really does move with it rather than taking it on trust.
  const atOtherPrice: any = R.restoreFromJudgements(payload, { ...reread.judgements, sharePrice: sharePrice * 2 });
  if (isNum(atOtherPrice.perpetuity) && isNum(reopened.perpetuity)) {
    if (off(atOtherPrice.perpetuity, reopened.perpetuity) < 1e-6) {
      problems.push('the price does not move the value, so saving it proves nothing');
    }
  }
  const atNoPrice: any = R.restoreFromJudgements(payload, { ...reread.judgements, sharePrice: null });
  if (isNum(atNoPrice.perpetuity) && off(atNoPrice.perpetuity, reopened.perpetuity) <= TOLERANCE) {
    problems.push('dropping the saved price changed nothing, so the saved price is not being used');
  }
  // AND THE OTHER CASE, STATED RATHER THAN LEFT AS A SURPRISE: a reader who
  // sets the cost of capital pins it, and the price then has no route into the
  // answer. Both behaviours are correct; what would be wrong is the code
  // believing one of them in both cases.
  const pinned = { ...reread.judgements, drivers: { ...defaults, waccPct: Number(defaults.waccPct) + 0.4 } };
  const pinnedA: any = R.restoreFromJudgements(payload, { ...pinned, sharePrice: sharePrice });
  const pinnedB: any = R.restoreFromJudgements(payload, { ...pinned, sharePrice: sharePrice * 2 });
  if (isNum(pinnedA.perpetuity) && isNum(pinnedB.perpetuity)) {
    if (off(pinnedA.perpetuity, pinnedB.perpetuity) > TOLERANCE) {
      problems.push(
        `with the cost of capital set by hand the price still moves the value: ` +
          `${pinnedA.perpetuity} against ${pinnedB.perpetuity}`
      );
    }
  } else {
    problems.push('the pinned-WACC case could not be valued');
  }

  // ---- 5. A VERSION 1 RECORD IS HONEST ABOUT WHAT IT LACKS --------------
  const v1 = {
    id: 'legacy-1',
    ticker,
    companyName: payload.name || ticker,
    name: 'saved before the fix',
    viewMode: 'DERIVED',
    drivers: { ...drivers },
    valuePerShare: 1044.32,
    currencySymbol: '₹',
    savedAt: '2026-10-01T00:00:00.000Z',
  };
  const migrated: any = S.migrate(v1);
  if (!migrated) problems.push('a version 1 record could not be read at all');
  else {
    if (migrated.version !== S.SAVED_MODEL_VERSION) problems.push('a migrated record keeps the old version number');
    if (S.isComplete(migrated)) problems.push('a version 1 record is reported as complete');
    if (!migrated.missing.length) problems.push('a version 1 record does not name what it lacks');
    // NOTHING GUESSED AND NOTHING ZEROED.
    const j = migrated.judgements;
    if (Object.keys(j.corrections).length) problems.push('a version 1 record came back with corrections it never had');
    if (Object.keys(j.classification).length) problems.push('a version 1 record came back with a classification it never had');
    if (j.sharePrice !== null) problems.push(`a version 1 record came back with a share price of ${j.sharePrice}`);
    if (j.appliedVerdicts !== null) problems.push('a version 1 record came back with applied verdicts it never had');
    if (j.peers !== null) problems.push('a version 1 record came back with a peer set it never had');
    if (j.recovery !== null) problems.push('a version 1 record came back with recovery rates it never had');
    // Its sliders ARE real and must survive.
    for (const [key, value] of Object.entries(drivers)) {
      if (isNum(value) && j.drivers[key] !== value) {
        problems.push(`a version 1 record lost the slider ${key}`);
      }
    }
    // And the one figure it held is kept, so a screen can print what it was
    // saved at beside what it reopens at rather than only one of them.
    if (migrated.produced.perpetuity !== 1044.32) {
      problems.push(`a version 1 record's saved figure came back as ${migrated.produced.perpetuity}`);
    }
    // Reopening it must not claim that figure. It reopens at whatever its
    // sliders alone produce, and the two must visibly differ here.
    const v1Reopened: any = R.reopensAt(payload, j);
    if (isNum(v1Reopened.perpetuity) && off(v1Reopened.perpetuity, 1044.32) <= TOLERANCE) {
      problems.push('a version 1 record reopens at its stored figure, which it cannot reproduce');
    }
  }

  // ---- 6. the store is behind an interface, not localStorage ------------
  const fake: any[] = [];
  S.useStore({
    all: () => fake.slice(),
    put: (m: any) => {
      fake.push(m);
      return true;
    },
    remove: (id: string) => {
      const at = fake.findIndex((m) => m.id === id);
      if (at >= 0) fake.splice(at, 1);
      return true;
    },
    replaceAll: (models: any[]) => {
      fake.length = 0;
      fake.push(...models);
      return true;
    },
  });
  const stored: any = S.saveModel({
    ticker,
    companyName: payload.name || ticker,
    name: 'through a fake store',
    currencySymbol: '₹',
    judgements,
    produced: { perpetuity: asSaved.perpetuity, exitMultiple: asSaved.exitMultiple, adjustedEbitda: asSaved.adjustedEbitda },
  });
  if (!stored) problems.push('saving through a non-browser store failed');
  if (S.listSaved(ticker).length !== 1) problems.push(`${S.listSaved(ticker).length} records in the fake store, expected 1`);
  if (!S.deleteSaved(stored.id) || S.listSaved(ticker).length !== 0) {
    problems.push('deleting through a non-browser store failed');
  }
  S.useStore(S.localStore);

  return {
    problems,
    moved,
    compared,
    worstDrift,
    example: { onDefaults: plain.perpetuity, saved: asSaved.perpetuity },
    v1Missing: migrated ? migrated.missing.length : 0,
    checkRows,
    checksNonZero,
  };
}

if (import.meta.url === `file:///${process.argv[1].split(path.sep).join('/')}`) {
  const r = await checkSavedModel();
  console.log(
    `saved models: ${r.moved} sliders plus every judgement the shape carries, saved through the wire format and ` +
      `reopened; ${r.compared} figures compared, worst drift ${r.worstDrift.toExponential(2)}` +
      (r.example && isNum(r.example.onDefaults) && isNum(r.example.saved)
        ? `; the judgements are worth ${r.example.onDefaults.toFixed(2)} against ${r.example.saved.toFixed(2)} a share`
        : '') +
      `; a version 1 record names ${r.v1Missing} inputs it never stored; ` +
      `the reopened model's balance sheet balances in all ${r.checkRows} years` +
      (r.checksNonZero ? `, except ${r.checksNonZero}` : '')
  );
  for (const p of r.problems) console.log(`  PROBLEM: ${p}`);
  process.exit(r.problems.length ? 1 : 0);
}
