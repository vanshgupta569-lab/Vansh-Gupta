// FILE: src/data/savedModels.ts
//
// Marginalia — saved models
//
// A model you cannot come back to is a calculator, not a workspace. This lets a
// reader name a set of judgements, save it, and reopen it at the figure it was
// saved at.
//
// ---------------------------------------------------------------------------
// WHAT A SAVED MODEL IS, AND WHY THAT CHANGED (`KI-27`)
// ---------------------------------------------------------------------------
//
// It used to store the sliders, the view mode, and the value per share at the
// time. Nothing else. So a model built on a corrected figure or a reclassified
// cost line reopened on the filed figures and the engine's own treatments —
// while the saved list went on printing the value the model had WITH those
// judgements. Measured on Reliance: saved at 1,044.32, reopened at 706.52, the
// list and the screen 32.3% apart with nothing on either saying why.
//
// A saved model now carries EVERY INPUT THAT DECIDES THE VALUATION:
//
//   · the sliders, and the view mode they belong to
//   · the reader's corrections to filed figures, and their reasons
//   · their expense classification, and its reasons
//   · the qualitative answers, both ticked and applied
//   · the peer set, where they took it over
//   · the asset approach's recovery rates
//   · THE SHARE PRICE THE VALUATION WAS STRUCK AGAINST
//
// That last one is the surprise, and it is not a judgement — it is a market
// fact, and it belongs here because it moves the answer. The cost of capital
// weights equity at market capitalisation, so the price feeds the WACC and the
// WACC feeds the value: measured on Reliance, the same model and the same
// sliders give 706.52 a share at one price and 932.38 at another. A valuation is
// struck at a moment, and a saved model that did not record the price it was
// struck against could not reopen at its own figure however many judgements it
// carried. So the price is saved, the screen says which price and when, and
// re-striking against today's price is a visible act with a new figure rather
// than a silent drift.
//
// ---------------------------------------------------------------------------
// THE SHAPE IS INDEPENDENT OF WHERE IT IS KEPT
// ---------------------------------------------------------------------------
//
// This file holds the SHAPE and the pure functions over it. Reading and writing
// go through `SavedModelStore`, and `localStore` is one implementation of it.
// When accounts arrive, a server store is a second implementation and nothing
// here changes: no field names the browser, every value is JSON, and `serialise`
// / `parse` is already the wire format the export file uses.
//
// `SAVED_MODEL_VERSION` is on every record. A record written by an older
// version is migrated on read and KEPT HONEST ABOUT WHAT IT LACKS: a version 1
// entry never has its missing judgements guessed at or filled with zeros. It
// comes back with `missing` naming what was not stored, and every screen that
// shows it says so.

import type { Corrections, CorrectionReasons } from './corrections';
import type { Classification } from './classification';

const KEY = 'marginalia.savedModels.v1';

/**
 * The shape of a saved record.
 *
 *   1 — sliders, view mode and the value per share. Judgements were not stored.
 *   2 — every input that decides the valuation, including the share price it
 *       was struck against, and what the model produced under them.
 */
export const SAVED_MODEL_VERSION = 2;

/** What was ticked on the qualitative screen. Kept loose: the engine owns the values. */
export type SavedVerdicts = Record<string, any>;

export interface SavedJudgements {
  /** Slider positions, as they stood. */
  drivers: Record<string, number>;
  viewMode: 'DERIVED' | 'ANALYST';
  /** Corrections to filed figures: fiscal year -> field -> the reader's figure. */
  corrections: Corrections;
  /** One line per corrected field. */
  correctionReasons: CorrectionReasons;
  /** The treatment of each reported expense line, with its reason. */
  classification: Classification;
  /** What the reader ticked on the qualitative screen. */
  verdicts: SavedVerdicts;
  /** What was actually applied to the model. Null where nothing was. */
  appliedVerdicts: SavedVerdicts | null;
  /** The peer set where the reader took it over. Null means the site's own. */
  peers: string[] | null;
  /** The asset approach's recovery rates, and which preset they came from. */
  recovery: { key: string; rates: Record<string, number> } | null;
  /**
   * The share price the valuation was struck against. Not a judgement: an input
   * that moves the answer through the cost of capital. Null where none was
   * available, which the restore must then say rather than invent one.
   */
  sharePrice: number | null;
}

/** What the model produced under those judgements, so a reopen can be checked. */
export interface SavedProduced {
  perpetuity: number | null;
  exitMultiple: number | null;
  /** Adjusted EBITDA in the last reported year: the bridge, in one figure. */
  adjustedEbitda: number | null;
}

export interface SavedModel {
  id: string;
  version: number;
  ticker: string;
  companyName: string;
  name: string;
  note?: string;
  judgements: SavedJudgements;
  produced: SavedProduced;
  currencySymbol: string;
  savedAt: string;
  /**
   * Inputs this record does not carry, by name, because the version that wrote
   * it did not store them. Empty on anything written at version 2 or later.
   * NEVER filled in with a guess: an absent judgement is an absence.
   */
  missing: string[];
}

export const emptyJudgements = (): SavedJudgements => ({
  drivers: {},
  viewMode: 'DERIVED',
  corrections: {},
  correctionReasons: {},
  classification: {},
  verdicts: {},
  appliedVerdicts: null,
  peers: null,
  recovery: null,
  sharePrice: null,
});

/** What a version 1 record could not have stored. Printed, not guessed at. */
export const V1_MISSING: readonly string[] = Object.freeze([
  'your corrections to the filed figures',
  'the reasons you gave for them',
  'your expense classification',
  'your answers on the qualitative screen',
  'your peer set',
  'the asset approach recovery rates',
  'the share price the valuation was struck against',
]);

const num = (v: any): number | null => (typeof v === 'number' && isFinite(v) ? v : null);
const obj = (v: any): any => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

/**
 * Bring any stored record up to the current shape.
 *
 * A version 1 record is NOT completed. Its sliders and view mode are real and
 * are carried across; everything else is named in `missing` and left empty, so
 * a screen can say what the entry cannot reproduce instead of showing a figure
 * it cannot stand behind.
 */
export function migrate(raw: any): SavedModel | null {
  if (!raw || typeof raw !== 'object' || !raw.id || !raw.ticker) return null;
  const version = num(raw.version) ?? 1;

  if (version >= 2) {
    const j = obj(raw.judgements);
    return {
      id: String(raw.id),
      version: SAVED_MODEL_VERSION,
      ticker: String(raw.ticker),
      companyName: String(raw.companyName ?? raw.ticker),
      name: String(raw.name ?? raw.ticker),
      note: raw.note ? String(raw.note) : undefined,
      judgements: {
        ...emptyJudgements(),
        ...j,
        drivers: obj(j.drivers),
        corrections: obj(j.corrections),
        correctionReasons: obj(j.correctionReasons),
        classification: obj(j.classification),
        verdicts: obj(j.verdicts),
        appliedVerdicts: j.appliedVerdicts ? obj(j.appliedVerdicts) : null,
        peers: Array.isArray(j.peers) ? j.peers.map(String) : null,
        recovery: j.recovery && typeof j.recovery === 'object' ? j.recovery : null,
        sharePrice: num(j.sharePrice),
        viewMode: j.viewMode === 'ANALYST' ? 'ANALYST' : 'DERIVED',
      },
      produced: {
        perpetuity: num(raw.produced?.perpetuity),
        exitMultiple: num(raw.produced?.exitMultiple),
        adjustedEbitda: num(raw.produced?.adjustedEbitda),
      },
      currencySymbol: String(raw.currencySymbol ?? '$'),
      savedAt: String(raw.savedAt ?? new Date(0).toISOString()),
      missing: Array.isArray(raw.missing) ? raw.missing.map(String) : [],
    };
  }

  // ---- version 1 -------------------------------------------------------
  return {
    id: String(raw.id),
    version: SAVED_MODEL_VERSION,
    ticker: String(raw.ticker),
    companyName: String(raw.companyName ?? raw.ticker),
    name: String(raw.name ?? raw.ticker),
    note: raw.note ? String(raw.note) : undefined,
    judgements: {
      ...emptyJudgements(),
      drivers: obj(raw.drivers),
      viewMode: raw.viewMode === 'ANALYST' ? 'ANALYST' : 'DERIVED',
    },
    produced: {
      // The one figure a version 1 record held. Carried so the screen can say
      // what it was saved at and what it reopens at, side by side.
      perpetuity: num(raw.valuePerShare),
      exitMultiple: null,
      adjustedEbitda: null,
    },
    currencySymbol: String(raw.currencySymbol ?? '$'),
    savedAt: String(raw.savedAt ?? new Date(0).toISOString()),
    missing: [...V1_MISSING],
  };
}

/** True where every input that decides the valuation is on the record. */
export const isComplete = (m: SavedModel): boolean => m.missing.length === 0;

export interface NewSavedModel {
  ticker: string;
  companyName: string;
  name: string;
  note?: string;
  currencySymbol: string;
  judgements: SavedJudgements;
  produced: SavedProduced;
}

/** A record, ready to store. Pure: it reads no clock but its own argument. */
export function makeSavedModel(input: NewSavedModel, now = new Date()): SavedModel {
  return {
    id: `${input.ticker}-${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`,
    version: SAVED_MODEL_VERSION,
    ticker: input.ticker,
    companyName: input.companyName,
    name: input.name,
    ...(input.note ? { note: input.note } : {}),
    judgements: { ...emptyJudgements(), ...input.judgements },
    produced: { ...input.produced },
    currencySymbol: input.currencySymbol,
    savedAt: now.toISOString(),
    missing: [],
  };
}

// ---------------------------------------------------------------------------
// THE WIRE FORMAT — the same bytes for a file and for a server
// ---------------------------------------------------------------------------

export interface SavedModelFile {
  format: 'marginalia.savedModels';
  version: number;
  models: SavedModel[];
}

export const serialise = (models: SavedModel[]): string =>
  JSON.stringify(
    { format: 'marginalia.savedModels', version: SAVED_MODEL_VERSION, models } as SavedModelFile,
    null,
    2
  );

/** Every record a file holds, migrated. Anything unreadable is dropped, not guessed. */
export function parse(text: string): SavedModel[] {
  const parsed = JSON.parse(text);
  const incoming = Array.isArray(parsed?.models) ? parsed.models : Array.isArray(parsed) ? parsed : [];
  return incoming.map(migrate).filter((m: SavedModel | null): m is SavedModel => m !== null);
}

// ---------------------------------------------------------------------------
// WHERE THEY ARE KEPT — one interface, one implementation today
// ---------------------------------------------------------------------------

export interface SavedModelStore {
  all(): SavedModel[];
  put(model: SavedModel): boolean;
  remove(id: string): boolean;
  replaceAll(models: SavedModel[]): boolean;
}

/** This browser, in localStorage. The trade-off is stated on screen. */
export const localStore: SavedModelStore = {
  all() {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed) ? parsed : [];
      return list.map(migrate).filter((m): m is SavedModel => m !== null);
    } catch {
      // A corrupted or unavailable store must not take the page down with it.
      return [];
    }
  },
  put(model) {
    return this.replaceAll([...this.all().filter((m) => m.id !== model.id), model]);
  },
  remove(id) {
    return this.replaceAll(this.all().filter((m) => m.id !== id));
  },
  replaceAll(models) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(models));
      return true;
    } catch {
      return false;
    }
  },
};

let store: SavedModelStore = localStore;
/** Swapped for a server store when accounts arrive; swapped for a fake in tests. */
export const useStore = (next: SavedModelStore) => {
  store = next;
};

export function listSaved(ticker?: string): SavedModel[] {
  const all = store.all().sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
  return ticker ? all.filter((m) => m.ticker === ticker) : all;
}

export function saveModel(input: NewSavedModel): SavedModel | null {
  const entry = makeSavedModel(input);
  return store.put(entry) ? entry : null;
}

export const deleteSaved = (id: string): boolean => store.remove(id);

export const renameSaved = (id: string, name: string): boolean =>
  store.replaceAll(store.all().map((m) => (m.id === id ? { ...m, name } : m)));

/** Everything, as a file. Also the migration path to real accounts later. */
export function exportSaved(): void {
  const blob = new Blob([serialise(store.all())], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `marginalia-saved-models-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Merge a previously exported file back in. Existing sets are kept: importing
 * adds, it never silently replaces, because losing saved work to a mis-click is
 * exactly the failure this feature exists to prevent.
 */
export async function importSaved(file: File): Promise<{ added: number; older: number; error?: string }> {
  try {
    const incoming = parse(await file.text());
    if (!incoming.length) return { added: 0, older: 0, error: 'That file has no saved models in it.' };

    const existing = store.all();
    const known = new Set(existing.map((m) => m.id));
    const added = incoming.filter((m) => !known.has(m.id));
    store.replaceAll([...existing, ...added]);
    return { added: added.length, older: added.filter((m) => !isComplete(m)).length };
  } catch {
    return { added: 0, older: 0, error: 'That file could not be read as a Marginalia export.' };
  }
}

export default {
  SAVED_MODEL_VERSION,
  emptyJudgements,
  migrate,
  isComplete,
  makeSavedModel,
  serialise,
  parse,
  localStore,
  useStore,
  listSaved,
  saveModel,
  deleteSaved,
  renameSaved,
  exportSaved,
  importSaved,
};
