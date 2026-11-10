// FILE: src/data/notesRoute.ts
//
// THE MARGIN NOTES' ADDRESSES (`docs/LEARN_STATES_SPEC.md` §2.2, decision L1;
// build step 9, job 9.8).
//
//   /learn/notes/          the screen, first note open
//   /learn/notes/<key>/    one note open, `key` from `marginNotes.ts`
//
// Before this the notes were a value in `App.tsx`'s screen state at `/`: they
// could not be linked to, bookmarked or reached with Back, and the /learn/
// pages linked "the margin notes" to the landing page. The explainers stay
// static pages at /learn/<slug>/; `notes` is not one of their slugs.

import { MARGIN_NOTES } from './marginNotes';
import type { MarginNote } from './marginNotes';

/** The index's groups, in the order a set of accounts is read. */
export const GROUP_ORDER: { key: MarginNote['group']; label: string }[] = [
  { key: 'income', label: 'The income statement' },
  { key: 'balance', label: 'The balance sheet' },
  { key: 'meaning', label: 'Reading them together' },
];

export const NOTES_PATH = '/learn/notes/';

export const notePath = (key: string): string => `${NOTES_PATH}${key}/`;

export interface NotesRoute {
  /** The note the address names, or null for the screen's own address. */
  key: string | null;
  /** True when the address names a key no note has. */
  unknown: boolean;
}

/** What a path says about the notes, or null when it is not a notes address. */
export function parseNotesPath(pathname: string): NotesRoute | null {
  const m = /^\/learn\/notes(?:\/([^/]*))?\/?$/.exec(pathname);
  if (!m) return null;
  const key = m[1] ? decodeURIComponent(m[1]) : null;
  if (!key) return { key: null, unknown: false };
  return MARGIN_NOTES.some((n) => n.key === key) ? { key, unknown: false } : { key, unknown: true };
}

/**
 * The notes in the order the index prints them: by group (income statement,
 * balance sheet, reading them together), then as listed. Previous and next
 * walk this order, so a reader who follows "next" reads the statements in
 * the order the index sets out.
 */
export const NOTES_IN_INDEX_ORDER = GROUP_ORDER.flatMap((g) => MARGIN_NOTES.filter((n) => n.group === g.key));

export function neighbours(key: string): { previous: string | null; next: string | null } {
  const i = NOTES_IN_INDEX_ORDER.findIndex((n) => n.key === key);
  if (i < 0) return { previous: null, next: null };
  return {
    previous: i > 0 ? NOTES_IN_INDEX_ORDER[i - 1].key : null,
    next: i < NOTES_IN_INDEX_ORDER.length - 1 ? NOTES_IN_INDEX_ORDER[i + 1].key : null,
  };
}

export default { NOTES_PATH, notePath, parseNotesPath, NOTES_IN_INDEX_ORDER, neighbours };
