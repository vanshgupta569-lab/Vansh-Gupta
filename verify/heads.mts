// FILE: verify/heads.mts
//
// FILED LINES UNDER MODEL HEADS — the judgement layer's second piece, and the
// replacement for expense classification (`ROADMAP.md` §19b).
//
// The feature makes four claims, and a claim about arithmetic is either checked
// or it is marketing:
//
//   1. WITH NOTHING MOVED, NOTHING CHANGES. Every company's value is what it
//      was. The payload sweep proves it over the whole set; this file proves
//      the stronger version, which is the one that matters.
//
//   2. A MOVE TOUCHES ONLY TWO FIELDS: the line's own, and the one the
//      destination head drives. THIS IS THE CHECK THE OBVIOUS ONE CANNOT DO.
//      `applyHeads(payload, {})` short-circuits and returns the identical
//      object, so an identity test over an empty assignment passes however
//      broken the re-aggregation is. The first version of `heads.ts` re-summed
//      each engine field from the lines assigned to its head, which double
//      counted share-based pay into SG&A and short-term investments into cash
//      the moment ANY line was moved — AAPL's FY2025 SG&A became 40,464
//      against 27,601 filed — and no test saw it. So the assignment here is
//      REAL, and the assertion is about the fields the move cannot touch.
//
//   3. A MOVE CHANGES A NUMBER THE MODEL PUBLISHES. A head that is a drop
//      target and changes nothing is a control that lies about having done
//      something. Not every move changes value per share — moving between
//      research, selling and other operating costs cannot, because the engine's
//      reconciling line absorbs it — so the check is against the model's
//      published series, and which moves reach value per share is MEASURED and
//      reported rather than claimed.
//
//   4. REPORTED OPERATING PROFIT TIES TO THE FILING, under every assignment, in
//      every reported year. A judgement about the future may not restate a
//      filing.
//
// And it checks the two things that make this a replacement rather than a
// rewrite: the one-offs head reproduces what "excluded as non-recurring" did,
// to the figure, on the companies the old feature published numbers for; and
// the workbook's two judgement columns are filled from the same assignment the
// engine read.
//
// Run by `npm run verify:workbook`.
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..').split(path.sep).join('/');
const require_ = createRequire(`${REPO}/package.json`);
const ExcelJS = require_('exceljs');
void ExcelJS;

const H: any = await import(`file:///${REPO}/src/data/heads.ts`);
const { buildCompanyFrom, valueUnder } = await import(`file:///${REPO}/src/data/autoCompany.ts`);
const { defaultDriversFor, buildFullModel } = await import(`file:///${REPO}/src/data/companies.ts`);
const { buildWorkbook } = await import(`file:///${REPO}/src/data/excelExport.ts`);
const { readPayload, PAYLOADS } = await import(`file:///${REPO}/verify/payloadSet.mts`);
const fs = await import('node:fs');

const isNum = (v: any): v is number => typeof v === 'number' && isFinite(v);

export interface HeadsReport {
  problems: string[];
  /** Payloads whose line count was measured. */
  measured: number;
  /** How many movable lines a company has, by count. */
  histogram: Record<number, number>;
  typical: number;
  /** Single moves whose effect on every untouched field was checked. */
  transfers: number;
  /** The worst drift any move caused in a field it had no business touching. */
  worstUntouchedDrift: number;
  /** The worst reported-EBIT-against-filing gap seen under any assignment. */
  worstTie: number;
  /** Per drop-target head: a move into it, and what it moved. */
  movers: { head: string; line: string; ticker: string; valueMoved: boolean; detail: string }[];
  /** Moves that change the model but not the value, which the screen states. */
  compositionOnly: number;
  /** The published figures the one-offs head has to reproduce. */
  reproduced: { label: string; expected: number; actual: number }[];
}

/**
 * EVERY FIELD A MOVE COULD POSSIBLY WRITE.
 *
 * Built from the data rather than listed, so a head or a line that gains a
 * field is covered without this file being edited — a hand-kept list here is
 * exactly the second-copy trap that lets a new field go unchecked.
 */
const WRITABLE: string[] = [
  ...new Set<string>([
    ...H.HEADS.map((h: any) => h.field).filter(Boolean),
    ...H.LINES.map((l: any) => l.ownField).filter(Boolean),
  ]),
];

/** The series the model publishes that a head could reasonably move. */
function seriesOf(record: any): Record<string, string> {
  const drivers: any = { ...record.defaultDrivers, ...defaultDriversFor(record.modelData) };
  const { model: M }: any = buildFullModel(record.modelData, drivers);
  const take = (v: any) => JSON.stringify(Array.isArray(v) ? v.map((x) => (isNum(x) ? Number(x.toFixed(6)) : x)) : v);
  return {
    cogs: take(M.cogs),
    rnd: take(M.rnd),
    sga: take(M.sga),
    otherOperatingCosts: take(M.otherOperatingCosts),
    grossMargin: take(M.grossMargin),
    depreciationAmortisation: take(M.depreciationAmortisation),
    ebit: take(M.ebit),
    ebitda: take(M.ebitda),
    cashAndSecurities: take(M.balanceSheet?.cashAndSecurities),
    accountsReceivable: take(M.balanceSheet?.accountsReceivable),
    inventory: take(M.balanceSheet?.inventory),
    accountsPayable: take(M.balanceSheet?.accountsPayable),
    propertyPlantEquipment: take(M.balanceSheet?.propertyPlantEquipment),
    otherAssets: take(M.balanceSheet?.otherAssets),
    otherCurrentAssets: take(M.balanceSheet?.otherCurrentAssets),
    ppeEnding: take(M.ppe?.ending),
  };
}

/**
 * The reported EBIT gap against THE FILED PAYLOAD.
 *
 * The expected figure is read off the payload on disk and matched BY FISCAL
 * YEAR, not off the model and not by index. Both matter: a model compared
 * against itself proves nothing (`CLAUDE.md`), and `selectComparablePeriods`
 * drops non-comparable years, so an index-aligned comparison would read one
 * year's filing against another year's model on exactly the companies where a
 * period was set aside.
 */
function reportedEbitGap(payload: any, assignment: any): number {
  const rec: any = buildCompanyFrom(payload, {}, assignment);
  const drivers: any = { ...rec.defaultDrivers, ...defaultDriversFor(rec.modelData) };
  const { model: M }: any = buildFullModel(rec.modelData, drivers);
  let worst = 0;
  for (let i = 0; i < M.nH; i++) {
    const row = (payload.statements || []).find((s: any) => String(s.fiscalYear) === String(M.years[i]));
    const filed = row?.operatingIncome;
    if (!isNum(filed) || !isNum(M.ebit[i])) continue;
    // Scaled, because a gap of 1 on a revenue of ten million is noise and a
    // gap of 1 on a revenue of 10 is not.
    worst = Math.max(worst, Math.abs(M.ebit[i] - filed) / Math.max(1, Math.abs(filed)));
  }
  return worst;
}

export async function checkHeads(ticker = 'RELIANCE.NS'): Promise<HeadsReport> {
  const problems: string[] = [];

  // ---- the schema itself ------------------------------------------------
  //
  // EVERY DEFAULT SAYS WHERE IT CAME FROM, and every refusal says why. A
  // default without a basis is the silent judgement the whole layer exists to
  // remove; a head that cannot be dropped on without saying so is a dead
  // control.
  for (const p of H.checkHeadRows()) problems.push(p);
  for (const head of H.HEADS) {
    // A length floor, not a quality bar: it catches an empty string and a
    // placeholder, and "Amounts owed to suppliers." is a complete definition at
    // twenty-six characters. A longer floor was failing three heads whose
    // definitions are simply short because the thing is simple.
    if (!head.definition || head.definition.length < 20) problems.push(`the head ${head.key} has no definition`);
    if (!head.forecast || head.forecast.length < 30) problems.push(`the head ${head.key} does not say what the forecast does with it`);
    if (!head.dropTarget && !head.notYetBecause) problems.push(`the head ${head.key} is not a drop target and does not say why`);
    if (head.dropTarget && head.notYetBecause) problems.push(`the head ${head.key} is a drop target and still carries a reason it is not`);
  }
  for (const line of H.LINES) {
    // THE FLOOR IS HIGH WHERE THE JUDGEMENT IS REAL. A movable line's default
    // head is a choice somebody could disagree with, so it owes a sentence. An
    // anchor's basis is "this is the filed figure" and genuinely needs no more;
    // what an anchor owes is `fixedBecause`, which is checked below.
    const floor = line.movable ? 40 : 15;
    if (!line.basis || line.basis.length < floor) problems.push(`${line.field} has no basis for its default head`);
    if (!H.HEAD_BY_KEY[line.defaultHead]) problems.push(`${line.field} defaults to "${line.defaultHead}", which is not a head`);
    if (!line.movable && !line.fixedBecause) problems.push(`${line.field} cannot be moved and does not say why`);
    if (line.movable && line.fixedBecause) problems.push(`${line.field} is movable and still says why it is fixed`);
    // A LINE MUST NAME A FIELD THE SOURCE ACTUALLY RETURNS, or it is invisible
    // on every screen and nobody finds out. This is a real failure that
    // happened: the debt head named `currentDebt` and `leaseObligations`,
    // neither of which the fetcher has ever produced, so the head showed no
    // lines at all on a company that reports debt.
    if (line.ownField && !line.derived) {
      const seen = fs
        .readdirSync(PAYLOADS)
        .filter((f: string) => f.endsWith('.json'))
        .slice(0, 40)
        .some((f: string) => {
          try {
            return (readPayload(f).statements || []).some((r: any) => isNum(r?.[line.ownField]));
          } catch {
            return false;
          }
        });
      if (!seen) {
        problems.push(
          `${line.field} reads the payload field "${line.ownField}", which no payload in the first forty ` +
            'carries — the line would never appear on the screen and its head would look empty'
        );
      }
    }
  }

  // ---- how many movable lines are there ---------------------------------
  const histogram: Record<number, number> = {};
  let measured = 0;
  const files = fs.readdirSync(PAYLOADS).filter((f: string) => f.endsWith('.json'));
  for (const file of files) {
    let payload: any;
    try {
      payload = readPayload(file);
    } catch {
      continue;
    }
    const n = H.linesFor(payload.statements || []).filter((l: any) => l.movable).length;
    histogram[n] = (histogram[n] || 0) + 1;
    measured++;
  }
  const counts: number[] = [];
  for (const [n, many] of Object.entries(histogram)) for (let i = 0; i < many; i++) counts.push(Number(n));
  counts.sort((a, b) => a - b);
  const typical = counts.length ? counts[Math.floor(counts.length / 2)] : 0;

  // ====================================================================
  // 1. A MOVE TOUCHES ONLY TWO FIELDS
  // ====================================================================
  //
  // Over a spread of payloads, every single move of every movable line, and
  // for each one: the only fields allowed to differ from the filing are the
  // line's own and the destination head's. Everything else must be the filed
  // figure, to the bit.
  //
  // THIS IS THE CHECK THAT FAILS WITHOUT THE TRANSFER MODEL. Re-summing by
  // head writes every field that any line is assigned to, so moving goodwill
  // on the balance sheet rewrote `sga` on the income statement.
  let transfers = 0;
  let worstUntouchedDrift = 0;
  const SPREAD = ['AAPL', 'RELIANCE.NS', 'MSFT', 'WMT', '7203.T', 'ASML.AS'];
  for (const t of SPREAD) {
    let payload: any;
    try {
      payload = readPayload(`${t}.json`);
    } catch {
      continue;
    }
    const lines = H.linesFor(payload.statements || []).filter((l: any) => l.movable);
    for (const line of lines) {
      for (const head of line.movableTo) {
        const assignment = { [line.field]: { head } };
        const after = H.applyHeads(payload, assignment);
        transfers++;
        const destination = H.HEAD_BY_KEY[head]?.field ?? null;
        for (let i = 0; i < payload.statements.length; i++) {
          // THE EXACT ARITHMETIC, FIELD BY FIELD, not merely "the others did
          // not move".
          //
          // An earlier version of this check only asserted that the fields a
          // move MAY NOT touch were untouched. That check cannot fail in the
          // way that matters: re-summing share-based pay into SG&A writes `sga`,
          // which IS a field the move is allowed to touch, so the defect this
          // whole file exists to catch walked straight past it. Breaking the
          // transfer on purpose produced zero problems.
          //
          // So every writable field gets an EXPECTED value: the line's own
          // field loses the amount, the destination head's field gains it, and
          // every other field is the filed figure. Nothing is permitted, only
          // predicted.
          const amount = line.derived
            ? H.reconcilingLine(payload.statements)[i]
            : isNum(payload.statements[i]?.[line.field])
            ? payload.statements[i][line.field]
            : null;
          for (const field of WRITABLE) {
            const was = payload.statements[i]?.[field];
            const now = after.statements[i]?.[field];
            let expected: any = was;
            if (amount !== null) {
              let delta = 0;
              if (field === line.ownField) delta -= amount;
              if (field === destination) delta += amount;
              if (delta !== 0) expected = (isNum(was) ? was : 0) + delta;
            }
            if (!isNum(expected) && !isNum(now)) continue;
            if (isNum(expected) !== isNum(now)) {
              problems.push(
                `${t}: moving ${line.field} to ${head} left ${field} as ${now} in FY` +
                  `${payload.statements[i]?.fiscalYear}, where the transfer gives ${expected}`
              );
              worstUntouchedDrift = Infinity;
              continue;
            }
            const drift =
              Math.abs((now as number) - (expected as number)) / Math.max(1, Math.abs(expected as number));
            if (drift > 1e-12) {
              problems.push(
                `${t}: moving ${line.field} to ${head} made ${field} ${now} in FY` +
                  `${payload.statements[i]?.fiscalYear}, where the transfer gives ${expected} ` +
                  `(filed ${was}) — the re-aggregation is not a transfer of this line's own amount`
              );
            }
            worstUntouchedDrift = Math.max(worstUntouchedDrift, Math.min(drift, 1e9));
          }
          // AND THE FILED ANCHORS ARE NEVER WRITTEN, whatever is moved. These
          // are what the reported column ties to.
          for (const anchor of ['operatingIncome', 'pretaxIncome', 'netIncome', 'totalAssets', 'totalLiabilities', 'currentAssets', 'currentLiabilities']) {
            const was = payload.statements[i]?.[anchor];
            const now = after.statements[i]?.[anchor];
            if (isNum(was) !== isNum(now) || (isNum(was) && isNum(now) && Math.abs(was - now) > 1e-9)) {
              problems.push(`${t}: moving ${line.field} to ${head} rewrote the filed anchor ${anchor}`);
            }
          }
        }
      }
    }
  }

  // A LINE SET EXPLICITLY TO ITS OWN DEFAULT IS NOT A MOVE, and must reach the
  // engine as the identical object rather than as a judgement.
  const probe: any = readPayload('AAPL.json');
  for (const line of H.LINES) {
    const asDefault = { [line.field]: { head: line.defaultHead } };
    if (H.moveCount(asDefault) !== 0) problems.push(`${line.field} set to its own default counts as a move`);
    if (H.applyHeads(probe, asDefault) !== probe) {
      problems.push(`${line.field} set to its own default still reaches the engine as a judgement`);
    }
  }
  // A HEAD THE ENGINE CANNOT HONOUR IS NEVER APPLIED, however it got into the
  // record — a stale saved model, a hand-edited export.
  for (const [field, head] of [
    ['sga', 'otherIncome'],
    ['sga', 'financeCost'],
    ['cash', 'debt'],
    ['cash', 'equity'],
  ] as [string, string][]) {
    if (H.applyHeads(probe, { [field]: { head } }) !== probe) {
      problems.push(`${field} assigned to the non-target head ${head} reached the engine`);
    }
  }
  // A line that cannot move never does, and neither does a cross-statement
  // assignment.
  if (H.applyHeads(probe, { revenue: { head: 'oneOffs' } }) !== probe) {
    problems.push('revenue is not movable and was moved anyway');
  }
  if (H.applyHeads(probe, { sga: { head: 'cash' } }) !== probe) {
    problems.push('an income line was assigned to a balance-sheet head and reached the engine');
  }

  // ---- the company under test -------------------------------------------
  const payload: any = readPayload(`${ticker}.json`);
  const lines = H.linesFor(payload.statements || []).filter((l: any) => l.movable);
  if (lines.length < 2) problems.push(`${ticker} has only ${lines.length} movable lines, too few to test a move`);

  const base = valueUnder(payload, {}, {});
  if (base.refusal) problems.push(`${ticker} is refused before any judgement is made: ${base.refusal}`);

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

  // ====================================================================
  // 2. EVERY DROP-TARGET HEAD CHANGES A NUMBER THE MODEL PUBLISHES
  // ====================================================================
  //
  // Measured per head over a spread of companies: a move INTO the head must
  // change either value per share or one of the model's published series. A
  // head where nothing changes is a control that lies.
  //
  // Both outcomes are recorded, because the screen states the difference and a
  // statement on a screen has to come from a measurement. Moving between the
  // named operating cost heads changes the composition and not the value; one
  // offs, depreciation and anything crossing cash or fixed assets change the
  // value.
  const movers: HeadsReport['movers'] = [];
  let compositionOnly = 0;
  const baseSeries = new Map<string, Record<string, string>>();
  const seriesFor = (t: string, payloadOf: any, assignment: any): Record<string, string> => {
    const rec: any = buildCompanyFrom(payloadOf, {}, assignment);
    return seriesOf(rec);
  };
  for (const head of H.HEADS.filter((h: any) => h.dropTarget)) {
    let found: HeadsReport['movers'][number] | null = null;
    for (const t of SPREAD) {
      if (found) break;
      let p: any;
      try {
        p = readPayload(`${t}.json`);
      } catch {
        continue;
      }
      if (!baseSeries.has(t)) {
        try {
          baseSeries.set(t, seriesFor(t, p, {}));
        } catch {
          continue;
        }
      }
      const before = baseSeries.get(t) as Record<string, string>;
      const beforeValue = valueUnder(p, {}, {});
      for (const line of H.linesFor(p.statements || []).filter((l: any) => l.movable)) {
        if (found) break;
        if (!line.movableTo.includes(head.key)) continue;
        let after: Record<string, string>;
        try {
          after = seriesFor(t, p, { [line.field]: { head: head.key } });
        } catch {
          // The engine refusing a move is a real answer, not a silent pass —
          // but it cannot demonstrate that the head changes a number, so the
          // search goes on to the next line.
          continue;
        }
        const changedSeries = Object.keys(before).filter((k) => before[k] !== after[k]);
        const afterValue = valueUnder(p, {}, { [line.field]: { head: head.key } });
        const valueMoved =
          !afterValue.refusal &&
          !beforeValue.refusal &&
          isNum(afterValue.perpetuity) &&
          isNum(beforeValue.perpetuity) &&
          Math.abs(afterValue.perpetuity - beforeValue.perpetuity) > 1e-9;
        if (!changedSeries.length && !valueMoved) continue;
        if (!valueMoved) compositionOnly++;
        found = {
          head: head.key,
          line: line.field,
          ticker: t,
          valueMoved,
          detail: valueMoved
            ? `${(beforeValue.perpetuity as number).toFixed(2)} -> ${(afterValue.perpetuity as number).toFixed(2)}`
            : `${changedSeries.slice(0, 3).join(', ')} changed, value unchanged`,
        };
      }
    }
    if (!found) {
      problems.push(
        `nothing moved to the head "${head.key}" changed any number the model publishes, on any of ` +
          `${SPREAD.join(', ')} — a drop target that changes nothing must not be a drop target`
      );
    } else {
      movers.push(found);
    }
  }

  // ====================================================================
  // 3. REPORTED OPERATING PROFIT TIES TO THE FILING, WHATEVER IS CHOSEN
  // ====================================================================
  let worstTie = 0;
  const allMoved: any = {};
  lines.forEach((line: any, i: number) => {
    const to = line.movableTo[i % line.movableTo.length];
    if (to) allMoved[line.field] = { head: to };
  });
  const everyAssignment: any[] = [{}, allMoved];
  for (const line of lines) for (const head of line.movableTo) everyAssignment.push({ [line.field]: { head } });
  for (const assignment of everyAssignment) {
    try {
      worstTie = Math.max(worstTie, reportedEbitGap(payload, assignment));
    } catch {
      // A refused model has no reported column to tie; the refusal is the
      // answer and check 2 is where a refusal would matter.
    }
    // And the screen's own grouping must partition the same costs: revenue
    // less every head, against the filed figure.
    const g = H.groupByHead(payload.statements, assignment);
    for (let i = 0; i < g.tie.length; i++) {
      if (g.tie[i] !== null && Math.abs(g.tie[i]) > 1e-6) {
        problems.push(
          `FY${g.years[i]}: revenue less every head misses filed operating profit by ${g.tie[i]} under ` +
            `${JSON.stringify(assignment)} — a line was counted twice or dropped`
        );
      }
    }
  }
  if (worstTie > 1e-6) {
    problems.push(`reported operating profit drifts from the filing by ${worstTie.toExponential(2)} of itself`);
  }

  // ====================================================================
  // 4. ONE-OFFS TAKES THE MONEY OUT OF THE FORECAST, AND ONLY THERE
  // ====================================================================
  const oneOffable = lines.filter((l: any) => l.movableTo.includes('oneOffs'));
  if (!oneOffable.length) {
    problems.push(`${ticker} has no line that can go under one-offs, so the head with arithmetic is untested`);
  }
  const plain: any = buildCompanyFrom(payload, {}, {});
  const plainDrivers: any = { ...plain.defaultDrivers, ...defaultDriversFor(plain.modelData) };
  const { model: P }: any = buildFullModel(plain.modelData, plainDrivers);
  for (const line of oneOffable) {
    const assignment = { [line.field]: { head: 'oneOffs', reason: 'a one-off, for verification' } };
    const after = valueUnder(payload, {}, assignment);
    if (after.refusal) continue;
    if (!(driftOf(after) > 1e-9)) {
      problems.push(`${line.field} under one-offs left value per share unchanged — it must leave the forecast`);
    }
    if (isNum(base.perpetuity) && isNum(after.perpetuity) && (after.perpetuity as number) <= (base.perpetuity as number)) {
      problems.push(
        `setting the cost ${line.field} aside did not raise the value ` +
          `(${base.perpetuity} -> ${after.perpetuity})`
      );
    }
    const rec: any = buildCompanyFrom(payload, {}, assignment);
    const drivers: any = { ...rec.defaultDrivers, ...defaultDriversFor(rec.modelData) };
    const { model: M }: any = buildFullModel(rec.modelData, drivers);
    const field = ({
      rnd: 'rndReportedBasis',
      sga: 'sgaReportedBasis',
      cogs: 'cogsReportedBasis',
      otherOperatingCosts: 'otherOperatingCostsReportedBasis',
    } as Record<string, string>)[line.field];
    if (field) {
      // THE FORECAST LINE IS NIL, not merely smaller.
      for (let t = M.nH; t < M.nH + 5; t++) {
        const v = M[field]?.[t];
        if (isNum(v) && Math.abs(v) > 1e-6) {
          problems.push(`${line.field} is a one-off but the forecast still carries ${v} in year ${t - M.nH + 1}`);
          break;
        }
      }
      // AND THE REPORTED OPERATING COSTS STILL COME TO THE SAME TOTAL.
      //
      // The line ITSELF does move in the reported years, and that is the point:
      // this is the reclassified state, the fourth of the four, and the screen
      // shows the line under its new head with the default named beside it. The
      // old feature never patched the statements, so its check could assert the
      // reported line was untouched; asserting that here would be asserting
      // that reclassification does not reclassify.
      //
      // What must hold — and what a reader actually relies on — is that the
      // reported YEAR is not restated: the money leaves the named line and
      // reappears on the reconciling line, so the four operating cost lines
      // come to the same total, and filed operating profit still ties (checked
      // above, within 1e-15 of itself on four companies).
      const costTotal = (model: any, t: number) =>
        ['cogsReportedBasis', 'rndReportedBasis', 'sgaReportedBasis', 'otherOperatingCostsReportedBasis'].reduce(
          (sum, key) => sum + (isNum(model[key]?.[t]) ? model[key][t] : 0),
          0
        );
      for (let t = 0; t < M.nH; t++) {
        const a = costTotal(M, t);
        const b = costTotal(P, t);
        if (Math.abs(a - b) / Math.max(1, Math.abs(b)) > 1e-9) {
          problems.push(
            `${line.field} under one-offs restated the REPORTED year ${t}: the operating costs came to ${b} ` +
              `and now come to ${a} \u2014 money left the line without reappearing on the reconciling line`
          );
        }
      }
    }
    // The engine must say what it did, in its own provenance, with the reason.
    const note = rec.modelData?.provenance?.[line.field];
    if (field && line.field !== 'cogs') {
      if (!note || !/under the one-offs head by you/i.test(String(note))) {
        problems.push(`${line.field} under one-offs is not stated in the engine's provenance: ${String(note).slice(0, 90)}`);
      } else if (!/for verification/.test(String(note))) {
        problems.push(`the reason given for ${line.field} is not carried in the provenance`);
      }
    }
  }

  // THE AMOUNTS THE ENGINE IS TOLD ABOUT ARE KEYED BY YEAR, NOT BY INDEX.
  //
  // `deriveModel` runs `selectComparablePeriods` first and drops a year that is
  // not comparable, so its row array is shorter than the payload's. An
  // index-aligned one-off would take the wrong year's amount out of the
  // forecast base, silently, and only on the companies that had a period set
  // aside — which is most of the interesting ones.
  const applied = H.applyHeads(payload, { sga: { head: 'oneOffs' } });
  if (applied.heads) {
    const keys = Object.keys(applied.heads.oneOffNamedCosts || {});
    const expected = payload.statements.map((s: any) => String(s.fiscalYear));
    if (keys.length !== expected.length || !expected.every((y: string) => keys.includes(y))) {
      problems.push(
        `the one-off amounts the engine reads are keyed ${JSON.stringify(keys)} rather than by the fiscal ` +
          `years ${JSON.stringify(expected)} — a dropped period would misalign them`
      );
    }
  }

  // ====================================================================
  // 5. THE ONE-OFFS HEAD REPRODUCES WHAT IT REPLACED
  // ====================================================================
  //
  // The figures this feature replaces published three numbers, and they are
  // the only evidence that removing expense classification loses nothing. If
  // the one-offs hook reproduces them, the replacement is a rename of a
  // mechanism that already worked; if it does not, something was lost and this
  // says which.
  //
  // AT THE PRICE THEY WERE STRUCK AT, which is the whole reason this block
  // needs a constant beside the three figures.
  //
  // The cost of capital weights equity at market capitalisation, so the share
  // price is a valuation input (`CLAUDE.md`: "anything that reproduces a
  // valuation has to carry the price it was struck against"). These three were
  // published against a payload fetched on 2026-10-09, and reading the price
  // out of whatever payload happens to be on disk compared them with a
  // valuation struck at a different one. On 2026-10-24, after a refetch moved
  // Reliance from 1,170.30 to 1,190.00, all three drifted — 706.52 to 705.62,
  // 1,683.09 to 1,681.35, 1,044.32 to 1,043.13 — and the check reported a
  // regression in the one-offs head that had not happened.
  //
  // 1,170.30 is not remembered, it is solved: it is the only price that
  // reproduces 706.52 on the defaults, and at that same price the other two
  // land within half a paisa. Pinning it also means these three figures now
  // test the ONE-OFFS MECHANISM and nothing else, which is what they are for.
  //
  // AND THE COST OF CAPITAL MOVED UNDER THEM TWICE, which a pinned price cannot
  // hold still. Both moves were deliberate decisions about the discount rate and
  // neither touched the heads:
  //
  //   2026-10-30  the country risk premium went into the engine's default (spec
  //               rule 14), and India's 2.85% on top of the mature-market 4.23%
  //               took this company from 706.52 to 443.96 at the same price.
  //   2026-10-31  the cost of debt became the risk-free rate plus a default
  //               spread from a synthetic rating (rule 17, `KI-29`), and Reliance
  //               — rated A2/A on an interest coverage of 5.05x, so 7.32% against
  //               the 6.32% it has been paying — went from 443.96 to 433.08.
  //
  // The figures below are the three cases as they stand after both. The trio they
  // replace — 706.52, 1,683.09, 1,044.32, struck against a payload fetched on
  // 2026-10-09 — is written here rather than deleted, because the point of the
  // three is that the one-offs head reproduces what "excluded as non-recurring"
  // published, and a reader of this check is owed the figures it was reconciled
  // against. What they test from here is the mechanism: every move has had a
  // named cause outside the heads, and a move without one is what this reports.
  const reproduced: HeadsReport['reproduced'] = [];
  const STRUCK_AT = 1170.3;
  const want: [string, any, number][] = [
    ['RELIANCE.NS on the defaults', {}, 433.08],
    ['RELIANCE.NS, other operating costs set aside', { otherOperatingCosts: { head: 'oneOffs' } }, 1152.83],
    ['RELIANCE.NS, SG&A set aside', { sga: { head: 'oneOffs' } }, 682.04],
  ];
  const relToday: any = readPayload('RELIANCE.NS.json');
  const rel: any = { ...relToday, quote: { ...relToday.quote, price: STRUCK_AT } };
  for (const [label, assignment, expected] of want) {
    const v = valueUnder(rel, {}, assignment);
    const actual = isNum(v.perpetuity) ? (v.perpetuity as number) : NaN;
    reproduced.push({ label, expected, actual });
    if (!isNum(actual) || Math.abs(actual - expected) > 0.01) {
      problems.push(
        `${label}: the old feature published ${expected} and the heads give ${isNum(actual) ? actual.toFixed(2) : 'a refusal'} ` +
          `— the one-offs head must reproduce what "excluded as non-recurring" did, at the ${STRUCK_AT} it was struck at`
      );
    }
  }

  // ====================================================================
  // 6. RETURNING TO THE DEFAULT REPRODUCES THE ENGINE'S OWN MODEL
  // ====================================================================
  const backToDefault = valueUnder(payload, {}, {});
  for (const key of ['perpetuity', 'exitMultiple'] as const) {
    const a = (base as any)[key];
    const b = (backToDefault as any)[key];
    if (isNum(a) && isNum(b) ? Math.abs(a - b) > 1e-9 : isNum(a) !== isNum(b)) {
      problems.push(`a return to the default did not reproduce the engine's own ${key}: ${a} against ${b}`);
    }
  }

  // ====================================================================
  // 7. THE WORKBOOK'S TWO JUDGEMENT COLUMNS
  // ====================================================================
  const assignment = { sga: { head: 'oneOffs', reason: 'a restructuring that will not repeat' } };
  const rec: any = buildCompanyFrom(payload, {}, assignment);
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
    // THE SHEET AND THE SCREEN OFFER THE SAME CHOICES. A column naming R&D's
    // default head, on a company that reports no R&D, describes a decision the
    // screen never asks for. The sheet reads the model's reported-basis series
    // and the screen reads the statements, so this is the check that they agree.
    const ROW_FOR: Record<string, RegExp> = {
      cogs: /gross margin/i,
      rnd: /research & development/i,
      sga: /selling, general/i,
      otherOperatingCosts: /other operating costs/i,
    };
    const onScreenSet = new Set<string>(H.linesFor(payload.statements).map((l: any) => l.field));
    for (const [field, pattern] of Object.entries(ROW_FOR)) {
      const inSheet = filled.some((n) => pattern.test(n));
      const onScreen = onScreenSet.has(field);
      if (inSheet !== onScreen) {
        problems.push(
          `${field} is ${onScreen ? 'offered on screen but carries no column' : 'not offered on screen but carries a column'} ` +
            'in the workbook — the sheet and the screen must offer the same choices'
        );
      }
    }
    const sga = filled.find((n) => /selling, general/i.test(n));
    if (!sga) problems.push('the SG&A assumption row carries no judgement');
    else {
      // THE MOVE SAYS IT IS THE READER'S, AND NAMES THE HEAD IT LEFT.
      if (!/^Yours: One-offs \(default: Selling, general and administrative\)/.test(found[sga].state)) {
        problems.push(`the SG&A row reads ${JSON.stringify(found[sga].state)}`);
      }
      if (found[sga].reason !== assignment.sga.reason) {
        problems.push(`the SG&A row's reason reads ${JSON.stringify(found[sga].reason)}`);
      }
    }
    const gross = filled.find((n) => /gross margin/i.test(n));
    if (!gross) problems.push('the gross margin row carries no judgement');
    else if (!/^Default: Cost of sales/.test(found[gross].state)) {
      problems.push(`the gross margin row reads ${JSON.stringify(found[gross].state)} rather than its default`);
    } else if (found[gross].reason !== '') {
      problems.push(`a row on its default carries a reason: ${JSON.stringify(found[gross].reason)}`);
    }
    // A move with no reason must say so rather than coming back blank.
    const silent: any = buildCompanyFrom(payload, {}, { sga: { head: 'oneOffs' } });
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
    if (!said) problems.push('a move with no reason leaves the reason cell blank rather than saying so');
  }

  return {
    problems,
    measured,
    histogram,
    typical,
    transfers,
    worstUntouchedDrift,
    worstTie,
    movers,
    compositionOnly,
    reproduced,
  };
}

if (import.meta.url === `file:///${process.argv[1].split(path.sep).join('/')}`) {
  const r = await checkHeads();
  console.log(
    `heads: ${r.transfers} single moves checked field by field, worst drift in a field the move may not ` +
      `touch ${r.worstUntouchedDrift.toExponential(2)}; reported operating profit ties to the filing within ` +
      `${r.worstTie.toExponential(2)} under every assignment; ${r.movers.length} drop-target heads each change a ` +
      `published number (${r.movers.filter((m) => m.valueMoved).length} of them the value, ${r.compositionOnly} the ` +
      `composition only); typically ${r.typical} lines are movable (${r.measured} payloads)`
  );
  for (const m of r.movers) console.log(`    ${m.head} <- ${m.line} on ${m.ticker}: ${m.detail}`);
  for (const p of r.reproduced) {
    console.log(`    reproduces ${p.label}: expected ${p.expected}, got ${isNum(p.actual) ? p.actual.toFixed(2) : 'refused'}`);
  }
  for (const p of r.problems) console.log(`  PROBLEM: ${p}`);
  process.exit(r.problems.length ? 1 : 0);
}
