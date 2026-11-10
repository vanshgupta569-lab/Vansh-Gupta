// FILE: src/components/searchPalette.tsx
//
// THE SEARCH PALETTE (`docs/NAV_SEARCH_SPEC.md` §4; build step 9, job 9.2).
// ⌘K or Ctrl+K, and /, from any screen but the search screen (which has its
// own field); the header's Search trigger; the phone's search button.
//
// One request per input event, coalesced to at most one per 50ms, at most one
// in flight: a newer query aborts the older one, and an answer that arrives
// for a query that is no longer the query is dropped, so an old response can
// never overwrite a new one. Answers are cached by query. Previous results
// stay on screen until new ones arrive; rows never animate. The order is
// `rankListings` (§4.3).
//
// Not built (PROPOSED — needs Nihar): the 200 largest listings shipped with
// the dialog for instant answers (§4.6) — the list has to be built from the
// real company set, which is LOCAL — and the Country and Exchange filters,
// which the spec marks P2.

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { rankListings, RESULTS_SHOWN, type Listing, type Ranked } from '../data/searchRank';
import { readRecent, recordRecent, removeRecent, clearRecent, RECENT_SHOWN } from '../data/recentSearches';
import { MENU, type Destination } from '../data/menu';

export const COALESCE_MS = 50;
export const SLOW_AFTER_MS = 1000;
export const SLOW_HOLD_MS = 500;

/** §4.5: the four names the placeholder has always offered. */
const TRY = ['Apple', 'Reliance', 'Nvidia', 'Tata Motors'];

type Row =
  | { kind: 'company'; listing: Ranked; recent?: boolean }
  | { kind: 'try'; name: string }
  | { kind: 'go'; label: string; dest: Destination };

interface Props {
  onClose: () => void;
  /** Open this listing and start its build. */
  onSelect: (listing: Listing) => void;
  onGo: (dest: Destination) => void;
  /** "Ask us to add it": the feedback form, with the query in it. */
  onAskToAdd: (query: string) => void;
  /** A purpose line for a company-level destination ("Choose a company for Financials"). */
  title?: string;
}

/** "Go to" (§4.5): a section or a destination named exactly, or by a prefix of 3 or more. */
function goTo(query: string): { label: string; dest: Destination }[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const out: { label: string; dest: Destination }[] = [];
  for (const section of MENU) {
    for (const d of section.links) {
      // A company's tab needs a company first; the palette is how one is chosen.
      if (d.kind === 'screen' || d.kind === 'company') continue;
      const names = [d.label.toLowerCase(), section.name.toLowerCase()];
      if (names.some((n) => n === q || (q.length >= 3 && n.startsWith(q)))) {
        if (!out.some((o) => o.label === d.label)) out.push({ label: d.label, dest: d });
      }
    }
  }
  return out.slice(0, 2);
}

const Name: React.FC<{ row: Ranked; strong: boolean }> = ({ row, strong }) => {
  const parts: React.ReactNode[] = [];
  let at = 0;
  for (const [a, b] of row.matched) {
    if (a > at) parts.push(<span key={`r${at}`} className="text-read">{row.name.slice(at, a)}</span>);
    parts.push(<span key={`m${a}`} className="text-ink font-semibold">{row.name.slice(a, b)}</span>);
    at = b;
  }
  if (at < row.name.length) parts.push(<span key={`r${at}`} className={row.matched.length ? 'text-read' : ''}>{row.name.slice(at)}</span>);
  return (
    <span dir="auto" className={`truncate text-[15px] text-ink ${strong ? 'font-semibold' : 'font-medium'}`}>
      {parts}
    </span>
  );
};

export const SearchPalette: React.FC<Props> = ({ onClose, onSelect, onGo, onAskToAdd, title }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Ranked[] | null>(null);
  const [answeredFor, setAnsweredFor] = useState('');
  const [failed, setFailed] = useState(false);
  const [slow, setSlow] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [recent, setRecent] = useState<Listing[]>(() => readRecent());
  const [attempt, setAttempt] = useState(0);
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(max-width: 639px)').matches);
  const input = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const cache = useRef(new Map<string, Listing[]>());
  const inFlight = useRef<AbortController | null>(null);
  const slowSince = useRef(0);
  const ids = useId();

  useEffect(() => {
    input.current?.focus();
    const mq = window.matchMedia?.('(max-width: 639px)');
    const on = () => setNarrow(!!mq?.matches);
    mq?.addEventListener?.('change', on);
    return () => mq?.removeEventListener?.('change', on);
  }, []);

  // THE REQUEST, coalesced, aborted when superseded, cached by query.
  useEffect(() => {
    const q = query.trim();
    setFailed(false);
    if (!q) {
      inFlight.current?.abort();
      setSlow(false);
      setResults(null);
      setAnsweredFor('');
      return;
    }
    const recentTickers = recent.map((r) => r.ticker);
    const cached = cache.current.get(q.toLowerCase());
    if (cached) {
      setResults(rankListings(q, cached, recentTickers));
      setAnsweredFor(q);
      setSlow(false);
      return;
    }
    let slowTimer = 0;
    const wait = window.setTimeout(() => {
      inFlight.current?.abort();
      const ctrl = new AbortController();
      inFlight.current = ctrl;
      slowTimer = window.setTimeout(() => {
        slowSince.current = performance.now();
        setSlow(true);
      }, SLOW_AFTER_MS);
      fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => {
          if (!r.ok) throw new Error(`search answered ${r.status}`);
          return r.json();
        })
        .then((data) => {
          if (ctrl.signal.aborted) return;
          const raw: Listing[] = Array.isArray(data?.results) ? data.results : [];
          cache.current.set(q.toLowerCase(), raw);
          const ranked = rankListings(q, raw, recentTickers);
          // "Still searching…" stays at least 500ms once it has shown.
          const hold = slowSince.current ? Math.max(0, slowSince.current + SLOW_HOLD_MS - performance.now()) : 0;
          window.clearTimeout(slowTimer);
          window.setTimeout(() => {
            if (ctrl.signal.aborted) return;
            setResults(ranked);
            setAnsweredFor(q);
            setHighlight(-1);
            setSlow(false);
            slowSince.current = 0;
          }, hold);
        })
        .catch(() => {
          if (ctrl.signal.aborted) return;
          window.clearTimeout(slowTimer);
          setSlow(false);
          slowSince.current = 0;
          setFailed(true);
        });
    }, COALESCE_MS);
    return () => {
      window.clearTimeout(wait);
      window.clearTimeout(slowTimer);
    };
  }, [query, attempt]);

  useEffect(() => () => inFlight.current?.abort(), []);

  const q = query.trim();
  const groups: { label: string; rows: Row[]; action?: React.ReactNode }[] = useMemo(() => {
    if (!q) {
      if (recent.length)
        return [{ label: 'Recent', rows: recent.slice(0, RECENT_SHOWN).map((l) => ({ kind: 'company', recent: true, listing: rankListings('', [l])[0] }) as Row) }];
      return [{ label: 'Try', rows: TRY.map((name) => ({ kind: 'try', name }) as Row) }];
    }
    const out: { label: string; rows: Row[] }[] = [];
    if (results && results.length) out.push({ label: 'Companies', rows: results.map((listing) => ({ kind: 'company', listing }) as Row) });
    const go = goTo(q);
    if (go.length) out.push({ label: 'Go to', rows: go.map((g) => ({ kind: 'go', ...g }) as Row) });
    return out;
  }, [q, recent, results]);
  const rows = groups.flatMap((g) => g.rows);
  const noMatch = !!q && !failed && results !== null && answeredFor === q && results.length === 0;

  const optionId = (i: number) => `${ids}-opt-${i}`;
  useEffect(() => {
    if (highlight >= 0) document.getElementById(optionId(highlight))?.scrollIntoView({ block: 'nearest' });
  }, [highlight]);

  const choose = useCallback(
    (row: Row, newTab = false) => {
      if (row.kind === 'try') {
        setQuery(row.name);
        input.current?.focus();
        return;
      }
      if (row.kind === 'go') {
        onGo(row.dest);
        return;
      }
      const l = row.listing;
      if (newTab) {
        window.open(`/company/${encodeURIComponent(l.ticker)}/overview`, '_blank', 'noopener');
        return;
      }
      recordRecent(l);
      onSelect(l);
    },
    [onGo, onSelect]
  );

  const onKey = (e: React.KeyboardEvent) => {
    const n = rows.length;
    const mod = e.metaKey || e.ctrlKey;
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (n) setHighlight((h) => Math.min(n - 1, h + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => {
        if (h <= 0) {
          const el = input.current;
          if (el) window.setTimeout(() => el.setSelectionRange(el.value.length, el.value.length), 0);
          return -1;
        }
        return h - 1;
      });
    } else if ((e.key === 'Home' || e.key === 'End') && highlight >= 0 && n) {
      e.preventDefault();
      setHighlight(e.key === 'Home' ? 0 : n - 1);
    } else if ((e.key === 'PageDown' || e.key === 'PageUp') && n) {
      e.preventDefault();
      setHighlight((h) => (e.key === 'PageDown' ? Math.min(n - 1, Math.max(0, h) + 5) : Math.max(0, h - 5)));
    } else if (e.key === 'Enter') {
      const row = rows[highlight >= 0 ? highlight : 0];
      if (row) {
        e.preventDefault();
        choose(row, mod);
      }
    } else if (e.key === 'Backspace' && mod) {
      e.preventDefault();
      setQuery('');
      setHighlight(-1);
    } else if (e.key === 'Delete' && !q && highlight >= 0) {
      const row = rows[highlight];
      if (row?.kind === 'company' && row.recent) {
        e.preventDefault();
        removeRecent(row.listing.ticker);
        setRecent(readRecent());
        setHighlight((h) => Math.min(h, recent.length - 2));
      }
    } else if (e.key === 'Tab') {
      // FOCUS STAYS IN THE DIALOG (§4.4).
      const items = Array.from(dialog.current?.querySelectorAll<HTMLElement>('input, button, a[href]') ?? []).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null);
      if (!items.length) return;
      const i = items.indexOf(document.activeElement as HTMLElement);
      e.preventDefault();
      items[e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : i === items.length - 1 ? 0 : i + 1]?.focus();
    }
  };

  let index = -1;
  const rowHeight = narrow ? 'min-h-[56px]' : 'h-11';
  return (
    <div
      data-search-scrim
      className={`fixed inset-0 z-[60] bg-scrim ${narrow ? '' : 'backdrop-blur-[6px]'}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label="Search companies"
        data-search-palette
        onKeyDown={onKey}
        className={
          narrow
            ? 'fixed inset-0 flex flex-col bg-overlay pt-[env(safe-area-inset-top)]'
            : 'fixed left-1/2 -translate-x-1/2 w-[640px] max-w-[calc(100vw-32px)] flex flex-col bg-overlay border border-line'
        }
        style={narrow ? undefined : { top: 'max(64px, 12vh)', maxHeight: 'min(560px, calc(100svh - 2 * max(64px, 12vh)))' }}
      >
        {title && <p className="px-4 pt-3 text-[13px] text-quiet">{title}</p>}
        <div className="flex items-center gap-3 h-14 px-4 border-b border-line shrink-0" data-search-input-row>
          <Search className="w-4 h-4 text-muted shrink-0" strokeWidth={1.5} aria-hidden="true" />
          <input
            ref={input}
            type="text"
            role="combobox"
            aria-expanded={rows.length > 0}
            aria-controls={`${ids}-list`}
            aria-activedescendant={highlight >= 0 ? optionId(highlight) : undefined}
            aria-autocomplete="list"
            aria-label="Search companies by name or ticker"
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlight(-1);
            }}
            placeholder="Search companies by name or ticker…"
            className="flex-1 min-w-0 bg-transparent text-[16px] text-ink placeholder:text-quiet outline-none"
          />
          {narrow ? (
            <button type="button" onClick={onClose} className="h-11 min-w-11 px-2 text-[15px] text-muted cursor-pointer">
              Cancel
            </button>
          ) : (
            <kbd className="text-[13px] text-quiet font-sans">Esc</kbd>
          )}
        </div>

        <div aria-live="polite" className="sr-only" data-search-count>
          {q && results && answeredFor === q ? `${results.length} result${results.length === 1 ? '' : 's'}` : ''}
        </div>

        <div ref={list} className="flex-1 min-h-0 overflow-y-auto" style={narrow ? undefined : { maxHeight: `${RESULTS_SHOWN * 44 + 32 * 2}px` }}>
          {failed ? (
            <div role="alert" data-search-error className="px-4 py-6">
              <p className="text-[15px] text-ink">Search is unavailable.</p>
              <button
                type="button"
                onClick={() => setAttempt((n) => n + 1)}
                className="mt-3 h-9 px-3 border border-line-control text-[13px] text-ink cursor-pointer hover:border-ink"
              >
                Try again
              </button>
            </div>
          ) : (
            <div role="listbox" id={`${ids}-list`} aria-label="Companies">
              {groups.map((g) => (
                <div key={g.label} role="group" aria-label={g.label}>
                  <div className="flex items-center justify-between h-8 px-4 text-[13px] text-quiet" data-search-group={g.label}>
                    <span>{g.label}</span>
                    {g.label === 'Recent' && (
                      <button
                        type="button"
                        onClick={() => {
                          clearRecent();
                          setRecent([]);
                          input.current?.focus();
                        }}
                        className="h-6 px-2 border border-line text-[13px] text-muted hover:text-ink cursor-pointer"
                      >
                        Clear recent
                      </button>
                    )}
                  </div>
                  {g.rows.map((row) => {
                    index++;
                    const i = index;
                    const on = i === highlight;
                    const common = {
                      id: optionId(i),
                      role: 'option',
                      'aria-selected': on,
                      'data-search-row': row.kind,
                      onMouseMove: () => setHighlight(i),
                      onMouseDown: (e: React.MouseEvent) => e.preventDefault(),
                      onClick: (e: React.MouseEvent) => choose(row, e.metaKey || e.ctrlKey),
                    } as const;
                    const bg = on ? 'bg-page shadow-[inset_2px_0_0_var(--m-ink)]' : '';
                    if (row.kind === 'company') {
                      const l = row.listing;
                      return (
                        <div
                          key={`c${l.ticker}`}
                          {...common}
                          aria-label={`${l.name}, ${l.ticker}, ${l.exchange}${l.country ? `, ${l.country}` : ''}`}
                          data-ticker={l.ticker}
                          className={`relative flex items-center ${rowHeight} px-4 cursor-pointer ${bg}`}
                        >
                          {narrow ? (
                            <div className="flex-1 min-w-0 py-2">
                              <Name row={l} strong={on} />
                              <div className="text-[13px] text-quiet tabular-nums truncate">
                                {l.ticker} · {l.exchange || 'exchange not given'}{l.country ? ` · ${l.country}` : ''}
                              </div>
                            </div>
                          ) : (
                            <div className="flex-1 min-w-0 grid grid-cols-[minmax(0,1fr)_112px_96px_48px] gap-3 items-center">
                              <Name row={l} strong={on} />
                              <span className="text-[13px] text-muted tabular-nums whitespace-nowrap">{l.ticker}</span>
                              <span className="text-[13px] text-quiet truncate">{l.exchange}</span>
                              <span className="text-[13px] text-quiet">{l.country}</span>
                            </div>
                          )}
                          {row.recent && (
                            <button
                              type="button"
                              aria-label={`Remove ${l.name} from recent`}
                              data-search-remove
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={(e) => {
                                e.stopPropagation();
                                removeRecent(l.ticker);
                                setRecent(readRecent());
                              }}
                              className="ml-3 w-6 h-6 pointer-coarse:w-11 pointer-coarse:h-11 flex items-center justify-center text-muted hover:text-ink cursor-pointer shrink-0"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      );
                    }
                    if (row.kind === 'try')
                      return (
                        <div key={`t${row.name}`} {...common} className={`flex items-center ${rowHeight} px-4 text-[15px] text-read cursor-pointer ${bg}`}>
                          {row.name}
                        </div>
                      );
                    return (
                      <div key={`g${row.label}`} {...common} className={`flex items-center ${rowHeight} px-4 text-[15px] text-read cursor-pointer ${bg}`}>
                        {row.label}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          {noMatch && (
            <div data-search-empty className="px-4 py-6">
              <p className="text-[15px] text-ink">No company matches &ldquo;{q}&rdquo;.</p>
              <p className="mt-1 text-[13px] text-quiet">
                Try the ticker, a shorter name, or the exchange form such as RELIANCE.NS. All countries and exchanges were searched.
              </p>
              <button
                type="button"
                onClick={() => onAskToAdd(q)}
                className="mt-3 h-9 px-3 border border-line-control text-[13px] text-ink cursor-pointer hover:border-ink"
              >
                Ask us to add it
              </button>
            </div>
          )}

          {/* Reserved, so nothing shifts when it appears (§4.5). */}
          <div className="h-6 px-4 flex items-center text-[13px] text-quiet" data-search-slow aria-hidden={!slow}>
            {slow ? 'Still searching…' : ''}
          </div>
        </div>

        {!narrow && (
          <div className="pointer-coarse:hidden h-10 px-4 flex items-center border-t border-line text-[13px] text-quiet shrink-0" data-search-hints>
            ↑↓ Navigate · ↵ Open · {navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl '}↵ New tab · Esc Close
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchPalette;
