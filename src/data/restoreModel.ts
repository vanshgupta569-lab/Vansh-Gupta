// FILE: src/data/restoreModel.ts
//
// Marginalia — reopening a saved model
//
// ONE PATH, USED BY BOTH THE SCREEN AND THE HARNESS.
//
// `KI-27` was not a missing field, it was a missing path. Restoring used to set
// the sliders and stop, because the sliders were the only thing the dashboard
// owned: the corrections and the classification are baked into the company
// RECORD at build time, and nothing on the dashboard could rebuild a record.
//
// So reopening a saved model is a rebuild, and it happens here rather than in a
// component. The screen calls this; `verify/savedModel.mts` calls the same
// function with the same arguments and compares the answer against what was
// stored. A restore that lived in a component could not be checked, and a check
// that re-implemented the restore would be checking itself.
//
// WHAT IT REPRODUCES, AND IN WHAT ORDER
//
//   1. The company record, built from the UNTOUCHED payload plus the reader's
//      corrections, their reasons and their classification. This is where the
//      derivation, the forecast, the health score, the asset approach and the
//      EBITDA bridge all come from, so all of them are restored by rebuilding
//      the one array the engine is downstream of.
//   2. The defaults that record implies, the way the dashboard computes them:
//      the record's own, overlaid with the model's.
//   3. The saved sliders on top. They are the final positions, so applying them
//      wholesale reproduces the screen exactly, whatever the verdicts did to
//      get there.
//   4. The valuation, struck against THE SAVED SHARE PRICE. Not today's: the
//      cost of capital weights equity at market capitalisation, so the price
//      moves the answer, and a saved model values at the moment it was saved.
import { buildCompanyFrom } from './autoCompany';
import { defaultDriversFor, buildFullModel, valuationBandsFor } from './companies';
import type { CompanyData, ValuationDrivers } from '../types';
import type { SavedJudgements } from './savedModels';

const num = (v: any): number | null => (typeof v === 'number' && isFinite(v) ? v : null);

export interface Restored {
  /** The rebuilt record, for the dashboard to render and for everything downstream. */
  record: CompanyData;
  /** The slider positions to put back on screen. */
  drivers: ValuationDrivers;
  /** What the model produces under them, at the saved price. */
  perpetuity: number | null;
  exitMultiple: number | null;
  /** Adjusted EBITDA in the last reported year: the bridge, in one figure. */
  adjustedEbitda: number | null;
  /** The engine's own words where it refuses, otherwise null. */
  refusal: string | null;
}

/**
 * The defaults a record implies, computed the way the dashboard computes them.
 *
 * Kept here rather than read off the dashboard so the harness and the screen
 * cannot drift: this is the one definition of "the model's own starting
 * assumptions" that a restore layers the saved sliders over.
 */
export function defaultsFor(record: CompanyData, source: any): ValuationDrivers {
  if (!source) return record.defaultDrivers as ValuationDrivers;
  const derived = defaultDriversFor(source);
  const merged: any = { ...record.defaultDrivers };
  for (const [key, value] of Object.entries(derived)) {
    if (value !== undefined && value !== null) merged[key] = value;
  }
  return merged as ValuationDrivers;
}

/** The last reported year's adjusted EBITDA, off the record's own bridge. */
export function adjustedEbitdaOf(record: CompanyData): number | null {
  const bridge: any = (record as any)?.modelData?.meta?.ebitdaBridge;
  const series: any[] = Array.isArray(bridge?.adjustedEbitda) ? bridge.adjustedEbitda : [];
  for (let i = series.length - 1; i >= 0; i--) {
    const v = num(series[i]);
    if (v !== null) return v;
  }
  return null;
}

/**
 * Rebuild a company and its valuation from a saved set of judgements.
 *
 * `fetched` is the untouched payload — `record.rawFetched` on a derived company.
 * Where there is none (a curated company, which has no payload to correct) the
 * judgements that act on the filings cannot apply, and `fallbackRecord` is used
 * as it stands. That is not a silent nil: the sliders and the view mode still
 * restore, and a saved record for such a company never carried the rest.
 */
export function restoreFromJudgements(
  fetched: any,
  judgements: SavedJudgements,
  fallbackRecord?: CompanyData | null
): Restored {
  const j = judgements;
  let record: CompanyData;
  if (fetched?.statements) {
    record = buildCompanyFrom(fetched, j.corrections, j.classification as any, j.correctionReasons);
  } else if (fallbackRecord) {
    record = fallbackRecord;
  } else {
    throw new Error('A saved model cannot be reopened without the filings it was built from.');
  }

  const source: any = (record as any).modelData ?? null;
  const drivers: ValuationDrivers = { ...defaultsFor(record, source), ...(j.drivers as any) };

  if (!source) {
    return {
      record,
      drivers,
      perpetuity: null,
      exitMultiple: null,
      adjustedEbitda: adjustedEbitdaOf(record),
      refusal: 'This company carries no model to value.',
    };
  }

  // STRUCK AGAINST THE SAVED PRICE. `valuationBandsFor` is the same function
  // the dashboard reads its headline from, so this is the headline, not a
  // second route to something like it.
  const price = num(j.sharePrice);
  const bands: any[] = valuationBandsFor(source, drivers, price);
  const pointOf = (needle: string): number | null => {
    const band = bands.find(
      (b) => num(b?.point) !== null && (b.point as number) > 0 && String(b.label).toLowerCase().includes(needle)
    );
    return band ? num(band.point) : null;
  };

  let refusal: string | null = null;
  if (!bands.length) {
    const { dcf } = buildFullModel(source, drivers);
    refusal = dcf?.applicable === false ? dcf.message || 'The engine refuses this model.' : null;
  }

  return {
    record,
    drivers,
    perpetuity: pointOf('perpetuity'),
    exitMultiple: pointOf('exit'),
    adjustedEbitda: adjustedEbitdaOf(record),
    refusal,
  };
}

/**
 * What a saved entry reopens at, for a list to print beside what it was saved
 * at. Never throws: a list must render whatever is in the store.
 */
export function reopensAt(
  fetched: any,
  judgements: SavedJudgements,
  fallbackRecord?: CompanyData | null
): { perpetuity: number | null; exitMultiple: number | null; adjustedEbitda: number | null; error: string | null } {
  try {
    const r = restoreFromJudgements(fetched, judgements, fallbackRecord);
    return {
      perpetuity: r.perpetuity,
      exitMultiple: r.exitMultiple,
      adjustedEbitda: r.adjustedEbitda,
      error: r.refusal,
    };
  } catch (error: any) {
    return {
      perpetuity: null,
      exitMultiple: null,
      adjustedEbitda: null,
      error: error?.message || 'This saved model could not be reopened.',
    };
  }
}

export default { restoreFromJudgements, reopensAt, defaultsFor, adjustedEbitdaOf };
