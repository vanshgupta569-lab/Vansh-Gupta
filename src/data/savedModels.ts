// FILE: src/data/savedModels.ts
//
// Marginalia — saved models
//
// A model you cannot come back to is a calculator, not a workspace. This lets a
// reader name a set of assumptions, save it, and reopen it later.
//
// WHY THE BROWSER AND NOT AN ACCOUNT
//
// Real accounts need a database, a sign-in flow and somewhere to run it, and
// that is the same piece of work as moving off free data feeds. Rather than
// hold this feature until then, saved models live in the browser now. The
// trade-off is stated plainly on screen: saved sets live on this device and in
// this browser, and clearing browsing data removes them.
//
// So that nobody loses work to that, every saved set can be exported to a file
// and imported again, which also carries them between devices. When accounts
// arrive, the same export becomes the migration path: the shape below is the
// shape the database will store.

const KEY = 'marginalia.savedModels.v1';

export interface SavedModel {
  id: string;
  ticker: string;
  companyName: string;
  name: string;
  note?: string;
  viewMode: 'DERIVED' | 'ANALYST';
  drivers: Record<string, number>;
  /** The value per share when it was saved, so a list can show what changed. */
  valuePerShare: number | null;
  currencySymbol: string;
  savedAt: string;
}

function read(): SavedModel[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // A corrupted or unavailable store must not take the page down with it.
    return [];
  }
}

function write(models: SavedModel[]): boolean {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(models));
    return true;
  } catch {
    return false;
  }
}

export function listSaved(ticker?: string): SavedModel[] {
  const all = read().sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
  return ticker ? all.filter((m) => m.ticker === ticker) : all;
}

export function saveModel(model: Omit<SavedModel, 'id' | 'savedAt'>): SavedModel | null {
  const entry: SavedModel = {
    ...model,
    id: `${model.ticker}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    savedAt: new Date().toISOString(),
  };
  const all = read();
  all.push(entry);
  return write(all) ? entry : null;
}

export function deleteSaved(id: string): boolean {
  return write(read().filter((m) => m.id !== id));
}

export function renameSaved(id: string, name: string): boolean {
  return write(read().map((m) => (m.id === id ? { ...m, name } : m)));
}

/** Everything, as a file. Also the migration path to real accounts later. */
export function exportSaved(): void {
  const blob = new Blob([JSON.stringify({ version: 1, models: read() }, null, 2)], {
    type: 'application/json',
  });
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
export async function importSaved(file: File): Promise<{ added: number; error?: string }> {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const incoming: SavedModel[] = Array.isArray(parsed?.models) ? parsed.models : [];
    if (!incoming.length) return { added: 0, error: 'That file has no saved models in it.' };

    const existing = read();
    const known = new Set(existing.map((m) => m.id));
    const added = incoming.filter((m) => m && m.id && !known.has(m.id));
    write([...existing, ...added]);
    return { added: added.length };
  } catch {
    return { added: 0, error: 'That file could not be read as a Marginalia export.' };
  }
}

export default { listSaved, saveModel, deleteSaved, renameSaved, exportSaved, importSaved };