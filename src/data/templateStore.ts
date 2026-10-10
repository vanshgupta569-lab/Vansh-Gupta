// FILE: src/data/templateStore.ts
//
// WHERE A FIRM'S TEMPLATE LIVES.
//
// In this browser, in IndexedDB, and nowhere else. There is no upload in the
// network sense: the file is read by the page, mapped by the page and filled by
// the page. Marginalia runs no server that receives it.
//
// That is a design decision with a cost and a reason, and both are stated on
// screen rather than implied:
//
//   - The cost: a template does not follow you to another device or another
//     browser, and clearing browsing data removes it. The same trade
//     `savedModels.ts` makes, and the same remedy — it can be exported to a
//     file and imported again.
//   - The reason: a firm's own model layout is the firm's. Holding it on a
//     server would mean holding something of theirs that we have no need of
//     and could lose, and would make "we delete it on request" a promise about
//     our operations rather than a fact about where the bytes are.
//
// WHAT IS KEPT: the template file as uploaded, its mapping, a name and two
// timestamps. WHAT IS NOT: any copy of a filled output, any figure from a
// model, and any record anywhere else that a template exists at all.
//
// HOW LONG: until it is removed. `forget` deletes bytes and mapping together.
import type { TemplateMapping } from './houseTemplate';

const DB = 'marginalia.houseTemplates';
const STORE = 'templates';
const VERSION = 1;

export interface StoredTemplate {
  id: string;
  name: string;
  /** The file exactly as it was read. Never sent anywhere. */
  bytes: ArrayBuffer;
  fileName: string;
  mapping: TemplateMapping;
  savedAt: string;
}

/** What the page may say about storage, written where the code can be checked against it. */
export const STORAGE_STATEMENT = {
  where: 'this browser, in IndexedDB on this device',
  sentAnywhere: false,
  whatIsKept: 'the template file you chose, the mapping you confirmed, and a name',
  whatIsNotKept: 'no filled output, no figures, and no record of it anywhere else',
  howLong: 'until you remove it, or until you clear this browser’s data',
} as const;

function available(): boolean {
  return typeof indexedDB !== 'undefined';
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!available()) {
      reject(new Error('This browser has no IndexedDB, so a template cannot be kept on this device.'));
      return;
    }
    const request = indexedDB.open(DB, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB could not be opened'));
  });
}

function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const request = work(tx.objectStore(STORE));
        request.onsuccess = () => resolve(request.result as T);
        request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
        tx.oncomplete = () => db.close();
      })
  );
}

export async function saveTemplate(template: StoredTemplate): Promise<void> {
  await run('readwrite', (store) => store.put(template));
}

export async function loadTemplate(id: string): Promise<StoredTemplate | null> {
  const found = await run<StoredTemplate | undefined>('readonly', (store) => store.get(id));
  return found ?? null;
}

export async function listTemplates(): Promise<Omit<StoredTemplate, 'bytes'>[]> {
  const all = await run<StoredTemplate[]>('readonly', (store) => store.getAll());
  return (all ?? [])
    .map(({ bytes, ...rest }) => {
      void bytes;
      return rest;
    })
    .sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
}

/** Bytes and mapping together. Nothing is kept back. */
export async function forgetTemplate(id: string): Promise<void> {
  await run('readwrite', (store) => store.delete(id));
}

export async function forgetEverything(): Promise<void> {
  await run('readwrite', (store) => store.clear());
}

export default {
  saveTemplate,
  loadTemplate,
  listTemplates,
  forgetTemplate,
  forgetEverything,
  STORAGE_STATEMENT,
};
