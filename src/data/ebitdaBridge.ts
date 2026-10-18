// FILE: src/data/ebitdaBridge.ts
//
// Marginalia — the adjusted EBITDA bridge
//
// WHY THIS EXISTS
//
// The figures screen already does the work. Correcting a filed figure
// (`corrections.ts`) and putting a line under the one-offs head (`heads.ts`)
// are, between them, exactly how an adjusted EBITDA is arrived at — and the
// screen never named what the reader had built.
//
// The bridge is the artefact. A valuer, a lender or a buyer does not receive a
// model; they receive a page that starts at the EBITDA in the accounts, lists
// every adjustment with the reason for it, and arrives at the number the deal
// is priced on. It is the one page that gets argued over line by line, so every
// line has to say what moved, by how much, and on what authority.
//
// WHAT IS IN IT, AND WHAT IS NOT
//
// **Reported EBITDA is filed operating profit plus filed depreciation and
// amortisation.** Both are figures the filing states, so the top of the bridge
// is a subtraction a reader can do on the accounts themselves. It is the same
// definition the engine uses (`src/engine/model.js`, `S.ebitda`), and the same
// one the peer multiples are computed on.
//
// **The D&A added back is named rather than assumed.** Depreciation is shown on
// the screen but cannot be moved, because the sources report it in the cash
// flow statement and the money already sits inside the filed cost lines; moving
// it would move money cost of sales still reports. So it is never an
// *adjustment* here. It is the add-back that makes this EBITDA rather than EBIT,
// it is shown on its own line, and where the filing reports none the line says
// so instead of printing a nil that reads as "there was no depreciation".
//
// **Stock compensation is not added back.** This is EBITDA, not EBITDA before
// share-based pay. The engine leaves it in costs because the peers' multiples
// are computed that way and because pay settled in shares is still pay
// (`METHODOLOGY.md` §4b). A bridge that quietly added it back would produce a
// number no multiple on the site could be applied to.
//
// **A correction inside the cost lines moves nothing, and is still named.**
// Reported operating profit is anchored to the filed figure, with the
// difference carried in other operating costs, so correcting cost of sales or
// SG&A changes what the costs are called and not what the company earned. Those
// corrections are listed as having moved nothing rather than left out, because a
// reader who made one and cannot find it in the bridge has no way to tell
// whether it was ignored or had no effect.
//
// **Every reported year, not only the last.** The question asked of an
// adjustment is almost always whether it recurs, and one column cannot answer
// it. Each line carries the count of years it moved.
//
// WHAT TIES, AND WHERE IT IS CHECKED
//
// Reported EBITDA ties to the filing, and reported plus every adjustment ties
// to adjusted, in every year. Both are checked rather than asserted:
// `verify/ebitdaBridge.mts` compares this bridge against the engine's own
// EBITDA, and the workbook's bridge sheet carries both ties as live Excel
// formulas so the file cannot drift from itself after a reader edits it.
import { applyCorrections, FIELD_BY_KEY, type Corrections, type CorrectionReasons } from './corrections';
import {
  LINES,
  LINE_BY_FIELD,
  RECONCILING_LINE,
  headOf,
  reasonOf,
  reconcilingLine,
  type HeadAssignment,
} from './heads';

const num = (v: any): number | null => (typeof v === 'number' && isFinite(v) ? v : null);

export type AdjustmentKind = 'correction' | 'oneOff';

export interface Adjustment {
  kind: AdjustmentKind;
  /** `correction:<field>` or `oneOff:<field>`. Stable, for a reason input. */
  key: string;
  label: string;
  /** The reader's one line. Empty where they gave none. */
  reason: string;
  /** Signed effect on EBITDA, per reported year. Positive raises it. */
  byYear: (number | null)[];
  /** How many years it moves. The answer to "does it recur". */
  yearsMoved: number;
  /** What changed, in words, for the line itself to carry. */
  detail: string;
}

export interface EbitdaBridge {
  years: string[];
  /** Filed operating profit, which the top of the bridge is built from. */
  operatingProfitFiled: (number | null)[];
  /** Filed D&A, added back. Null where the filing reports none. */
  depreciationAddedBack: (number | null)[];
  /** True in a year where the filing reports no D&A at all. */
  depreciationNotReported: boolean[];
  reportedEbitda: (number | null)[];
  corrections: Adjustment[];
  /** Reported EBITDA with the corrections applied. */
  afterCorrections: (number | null)[];
  /** The lines put under the one-offs head, which is what an adjustment is. */
  oneOffs: Adjustment[];
  adjustedEbitda: (number | null)[];
  /** adjusted − (reported + every adjustment). Nil in every year, or it is broken. */
  tie: (number | null)[];
  /** Corrections that cannot move EBITDA, named rather than dropped. */
  neutral: { label: string; years: string[]; reason: string }[];
  /** True where the reader has made any adjustment at all. */
  adjusted: boolean;
}

/**
 * EBITDA on one set of statements: filed operating profit plus filed D&A.
 *
 * A year with no filed operating profit has no EBITDA and comes back null —
 * the engine refuses such a company outright, and guessing one here would put a
 * figure on a bridge the model will not value. A year with operating profit and
 * no D&A adds back nothing, which is what the engine does, and the bridge says
 * so on its own line rather than leaving the nil to be read as a measurement.
 */
export function ebitdaOf(rows: any[]): (number | null)[] {
  return (rows || []).map((r) => {
    const op = num(r?.operatingIncome);
    if (op === null) return null;
    return op + (num(r?.depreciation) ?? 0);
  });
}

const addInto = (into: (number | null)[], from: (number | null)[]) =>
  into.map((v, i) => (v === null || from[i] === null ? null : (v as number) + (from[i] as number)));

/** Only the corrections for one field, so its own effect can be measured. */
function onlyField(corrections: Corrections, field: string): Corrections {
  const out: Corrections = {};
  for (const [year, patch] of Object.entries(corrections || {})) {
    if (Object.prototype.hasOwnProperty.call(patch, field)) out[year] = { [field]: patch[field] };
  }
  return out;
}

const fmtNum = (v: number | null): string =>
  v === null ? 'not reported' : Math.round(v).toLocaleString('en-US');

export function buildEbitdaBridge(
  filedStatements: any[],
  corrections?: Corrections,
  heads?: HeadAssignment,
  reasons?: CorrectionReasons
): EbitdaBridge {
  const filed = Array.isArray(filedStatements) ? filedStatements : [];
  const years = filed.map((r) => String(r.fiscalYear));
  const reportedEbitda = ebitdaOf(filed);

  const corrected = corrections ? applyCorrections({ statements: filed }, corrections).statements : filed;
  const afterCorrections = ebitdaOf(corrected);

  // ---- the corrections, one line per field ------------------------------
  //
  // MEASURED, NOT REASONED ABOUT. Each field's effect is the difference its own
  // correction makes to the EBITDA calculation above, run again. Deciding in
  // advance which fields can matter would be a second definition of EBITDA
  // sitting beside the first, and the two could disagree without anything
  // noticing. EBITDA is linear in both of its inputs, so these effects sum
  // exactly to the total, which `tie` proves rather than trusts.
  const fields = new Set<string>();
  for (const patch of Object.values(corrections || {})) for (const key of Object.keys(patch)) fields.add(key);

  const corrs: Adjustment[] = [];
  const neutral: EbitdaBridge['neutral'] = [];
  for (const field of fields) {
    const mine = onlyField(corrections as Corrections, field);
    const withIt = ebitdaOf(applyCorrections({ statements: filed }, mine).statements);
    const byYear = withIt.map((v, i) =>
      v === null || reportedEbitda[i] === null ? null : (v as number) - (reportedEbitda[i] as number)
    );
    const label = FIELD_BY_KEY[field]?.label || field;
    const touched = Object.keys(mine).sort();
    const moves = byYear.filter((v) => v !== null && Math.abs(v) > 1e-6).length;
    const reason = reasons?.[field]?.trim() || '';
    if (!moves) {
      // NAMED, NOT DROPPED. Operating profit is anchored to the filed figure,
      // so a correction inside the cost lines changes what the costs are
      // called and not what the company earned.
      neutral.push({ label, years: touched, reason });
      continue;
    }
    const lastTouched = touched[touched.length - 1];
    const at = years.indexOf(lastTouched);
    const was = at >= 0 ? num(filed[at]?.[field]) : null;
    const now = at >= 0 ? num((corrected as any[])[at]?.[field]) : null;
    corrs.push({
      kind: 'correction',
      key: `correction:${field}`,
      label,
      reason,
      byYear,
      yearsMoved: moves,
      detail:
        `a correction to a filed figure: ${label.toLowerCase()} ${fmtNum(was)} filed, ${fmtNum(now)} yours` +
        (touched.length === 1 ? ` in FY${lastTouched}` : ` in FY${lastTouched} and ${touched.length - 1} other year${touched.length === 2 ? '' : 's'}`),
    });
  }
  corrs.sort((a, b) => a.label.localeCompare(b.label));

  // ---- the one-offs, one line per line under that head ------------------
  //
  // A one-off adds the cost back: the reader is saying the business does not
  // carry it. The amount is read off the CORRECTED statements, because by this
  // point in the bridge the corrections have already been made — a reader who
  // corrected SG&A and then set it aside set their figure aside, not the
  // source's.
  //
  // THE RECONCILING LINE IS COMPUTED, NOT READ. It is filed operating profit
  // less the named cost lines, from `heads.ts`, which is the same function the
  // screen groups by and the same arithmetic `deriveModel` ties with. A second
  // derivation of it here could disagree with those and nothing would catch it.
  const residual = reconcilingLine(corrected as any[]);
  const oneOffs: Adjustment[] = [];
  for (const line of LINES) {
    if (!line.movable) continue;
    if (headOf(line.field, heads) !== 'oneOffs') continue;
    const byYear =
      line.field === RECONCILING_LINE
        ? residual.slice()
        : (corrected as any[]).map((r) => num(r?.[line.field]));
    const moves = byYear.filter((v) => v !== null && Math.abs(v) > 1e-6).length;
    oneOffs.push({
      kind: 'oneOff',
      key: `oneOff:${line.field}`,
      label: LINE_BY_FIELD[line.field]?.label || line.field,
      reason: reasonOf(line.field, heads).trim(),
      byYear,
      yearsMoved: moves,
      detail:
        'under the one-offs head: the cost is added back in every reported year, and is nil in every ' +
        'forecast year of the model',
    });
  }

  let adjustedEbitda = afterCorrections.slice();
  for (const e of oneOffs) adjustedEbitda = addInto(adjustedEbitda, e.byYear);

  // ---- the tie ----------------------------------------------------------
  const every = [...corrs, ...oneOffs];
  const tie = adjustedEbitda.map((adj, i) => {
    if (adj === null || reportedEbitda[i] === null) return null;
    let sum = reportedEbitda[i] as number;
    for (const a of every) {
      if (a.byYear[i] === null) return null;
      sum += a.byYear[i] as number;
    }
    return (adj as number) - sum;
  });

  return {
    years,
    operatingProfitFiled: filed.map((r) => num(r?.operatingIncome)),
    depreciationAddedBack: filed.map((r) => num(r?.depreciation)),
    depreciationNotReported: filed.map((r) => num(r?.depreciation) === null),
    reportedEbitda,
    corrections: corrs,
    afterCorrections,
    oneOffs,
    adjustedEbitda,
    tie,
    neutral,
    adjusted: every.length > 0,
  };
}

/** The lines a reason can be attached to, for a screen to render inputs for. */
export const adjustmentKeys = (b: EbitdaBridge): string[] =>
  [...b.corrections, ...b.oneOffs].map((a) => a.key);

export default { buildEbitdaBridge, ebitdaOf, adjustmentKeys };
