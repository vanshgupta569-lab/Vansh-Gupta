// FILE: src/data/recentSearches.ts
//
// THE PALETTE'S "RECENT" GROUP (`docs/NAV_SEARCH_SPEC.md` §4.5; job 9.2).
// The companies this reader opened from search, newest first: up to ten kept,
// five shown. Stored on this device only, and every read and write is in a
// try/catch with a memory copy behind it, because storage can be switched off
// or full and the palette must work either way.

import type { Listing } from './searchRank';

export const RECENT_KEY = 'marginalia.recentSearches';
export const RECENT_KEPT = 10;
export const RECENT_SHOWN = 5;

let memory: Listing[] = [];

const clean = (v: unknown): Listing[] =>
  Array.isArray(v)
    ? v
        .filter((x: any) => x && typeof x.ticker === 'string' && typeof x.name === 'string')
        .map((x: any) => ({ ticker: x.ticker, name: x.name, exchange: String(x.exchange || '') }))
        .slice(0, RECENT_KEPT)
    : [];

export function readRecent(): Listing[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (raw !== null) memory = clean(JSON.parse(raw));
  } catch {
    /* storage unavailable: the memory copy stands */
  }
  return memory.slice();
}

function write(list: Listing[]) {
  memory = list.slice(0, RECENT_KEPT);
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(memory));
  } catch {
    /* kept in memory for this visit */
  }
}

export function recordRecent(l: Listing) {
  write([{ ticker: l.ticker, name: l.name, exchange: l.exchange }, ...readRecent().filter((r) => r.ticker !== l.ticker)]);
}

export function removeRecent(ticker: string) {
  write(readRecent().filter((r) => r.ticker !== ticker));
}

export function clearRecent() {
  write([]);
}

export default { readRecent, recordRecent, removeRecent, clearRecent, RECENT_SHOWN };
