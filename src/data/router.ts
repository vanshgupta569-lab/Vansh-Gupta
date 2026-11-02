// FILE: src/data/router.ts
//
// THE ADDRESS BAR, AND NOTHING ELSE.
//
// The site had no routing at all: every screen was a value in one `useState`,
// so nothing could be linked to, bookmarked or sent to anybody. The company
// page needs real addresses (`/company/RELIANCE.NS/overview`), and this is the
// smallest thing that gives them.
//
// NO ROUTER LIBRARY, deliberately. What is needed here is three things — read
// the path, change the path, hear when the reader goes back — and every one of
// them is a line of the platform's own History API. A dependency would bring a
// matcher, a nested-route model and an outlet component to replace nine lines,
// and this repository already carries the cost of its dependencies in the
// workbook and the browser checks.
//
// WHAT THIS DOES NOT DO: it does not own the rest of the site. The landing
// page, the directory and the model flow are still one `useState` in `App.tsx`
// and still live at `/`. Giving all of them addresses is a bigger change than
// the company page needs and would move every screen at once; this adds the
// addresses that were asked for and leaves the rest where it is.

import { useCallback, useEffect, useState } from 'react';

/** The path, with its leading slash, as the browser currently has it. */
export function currentPath(): string {
  if (typeof window === 'undefined') return '/';
  return window.location.pathname || '/';
}

/**
 * The query string, with its leading `?`, or an empty string.
 *
 * THE SCREENER'S FILTERS LIVE HERE (`docs/SCREENER_SPEC.md` rule 22: screens
 * shareable by web address). That makes the query part of where the reader IS
 * rather than a detail of how a screen was reached, so it has to be tracked
 * and restored on Back the same way the path is — a screen that forgot its
 * filters on Back would be a link that only works once.
 */
export function currentSearch(): string {
  if (typeof window === 'undefined') return '';
  return window.location.search || '';
}

export interface Navigation {
  path: string;
  /** The query string, with its leading `?`, or empty. */
  search: string;
  /** Push a new entry, so Back returns to where the reader was. */
  go: (path: string) => void;
  /** Replace the current entry — for correcting a path, not for moving. */
  replace: (path: string) => void;
}

/**
 * The current path, and the two ways to change it.
 *
 * `popstate` fires on Back and Forward but NOT on `pushState`, so both helpers
 * set the state themselves. Without that the address bar would move and the
 * screen would not, which is the failure mode that makes hand-rolled routing
 * look broken.
 */
export function useNavigation(): Navigation {
  const [path, setPath] = useState<string>(() => currentPath());
  const [search, setSearch] = useState<string>(() => currentSearch());

  useEffect(() => {
    const onPop = () => {
      setPath(currentPath());
      setSearch(currentSearch());
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // `next` may carry a query. The comparison has to include it, or a change of
  // filters at the same path would be seen as no change at all and the address
  // bar would stop matching the screen.
  const here = () => `${currentPath()}${currentSearch()}`;
  const split = (next: string) => {
    const at = next.indexOf('?');
    return at < 0 ? { path: next, search: '' } : { path: next.slice(0, at), search: next.slice(at) };
  };

  const go = useCallback((next: string) => {
    if (next === here()) return;
    const parts = split(next);
    window.history.pushState({}, '', next);
    setPath(parts.path);
    setSearch(parts.search);
  }, []);

  const replace = useCallback((next: string) => {
    const parts = split(next);
    if (next !== here()) window.history.replaceState({}, '', next);
    setPath(parts.path);
    setSearch(parts.search);
  }, []);

  return { path, search, go, replace };
}

export default { useNavigation, currentPath, currentSearch };
