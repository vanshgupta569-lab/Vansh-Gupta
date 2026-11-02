// FILE: src/components/screenerScreen.tsx
//
// Marginalia — the global screener
//
// `docs/SCREENER_SPEC.md` section D. This file DRAWS the screener and decides
// nothing: which metrics exist, what each formula is, how a missing figure is
// treated, what a bank is not asked and how a screen becomes a web address are
// all in `src/data/screener.ts`, where 178 companies' worth of them can be
// checked without a browser.
//
// THE THREE THINGS THIS SCREEN IS RESPONSIBLE FOR
//
//   1. The match count on the screen is the number of rows on the screen.
//      Spec rule 16 asks for "N companies match your criteria"; the number and
//      the list come from one call to `runScreen` so they cannot drift.
//   2. Every column header publishes its formula, its source and the period
//      the figure covers (rule 2). Not in a tooltip somewhere — on the header,
//      behind the ⓘ the rest of this site uses.
//   3. Nobody is dropped quietly (rule 4). A company with no operating margin
//      is not a company with a bad one, and the sentence under the count says
//      how many were set aside and why.
//
// WHAT IT DELIBERATELY DOES NOT DO
//
//   No composite score, so none can be the default sort (rule 13). The default
//   is market capitalisation, which is a size.
//   No preset named for an outcome (rule 14). The presets offered are written
//   as their rules, because that is what they are.
//   No export yet (rule 11): 93 of the 178 rows carry vendor-sourced figures
//   this site is not licensed to redistribute, and a download that quietly
//   dropped half the table would be worse than no download. The screen says
//   so where the button would be.
//   No saved screens across devices (rule 22): accounts arrive in build step
//   7, so saving is in this browser only and the screen says that too.
import React, { useEffect, useMemo, useState } from 'react';
import {
  COLUMN_SETS,
  DEFAULT_SORT,
  EMPTY_SCREEN,
  METRICS_BY_KEY,
  OP_SYMBOLS,
  OP_WORDS,
  SCREENER_METRICS,
  type CustomRatio,
  type Filter,
  type FilterOp,
  type MetricUnit,
  type ScreenState,
  type ScreenerRow,
  evaluateFormula,
  exclusionSentence,
  parseQuery,
  ratioAsMetric,
  runScreen,
  screenFromSearch,
  screenToSearch,
  universeChoices,
  universeOf,
  withCustomRatios,
  writeQuery,
} from '../data/screener';
import { inMillions, asPerShare, asPercent, NOT_REPORTED } from '../data/figureFormat';
import { EYEBROW, UI, BODY } from './instrument';
import { Hint, HINT_STYLES } from './figuresHint';
import { Mark } from '../design/Mark';

/** Where a screen is kept between visits, until accounts arrive (rule 22). */
const SAVED_KEY = 'marginalia.screens.v1';

interface SavedScreen {
  name: string;
  search: string;
}

/** A figure, printed by its unit. One rule per column, as DESIGN.md requires. */
function printed(value: number | null, unit: MetricUnit, symbol: string | null): string {
  if (value === null) return NOT_REPORTED;
  if (unit === 'percent') return asPercent(value / 100);
  if (unit === 'multiple') return `${asPerShare(value)}×`;
  if (unit === 'ratio') return asPerShare(value);
  if (unit === 'currency') {
    // A market capitalisation is in units of currency and a price is too, so
    // both are shown whole: a screener compares across companies, and a column
    // of mixed scales is unreadable. The currency is on the row, never
    // converted (rule 6).
    const abs = Math.abs(value);
    if (abs >= 1e9) return `${symbol ?? ''}${asPerShare(value / 1e9)}bn`;
    if (abs >= 1e6) return `${symbol ?? ''}${inMillions(value / 1e6)}m`;
    return `${symbol ?? ''}${inMillions(value)}`;
  }
  return inMillions(value);
}

interface Props {
  onOpenCompany: (ticker: string) => void;
  onBack: () => void;
  /** The query string the address bar currently carries. */
  search: string;
  /** Replace the address when the screen changes, so a link is always current. */
  onScreenChange: (search: string) => void;
}

export const ScreenerScreen: React.FC<Props> = ({ onOpenCompany, onBack, search, onScreenChange }) => {
  const [table, setTable] = useState<{ rows: ScreenerRow[]; built: string | null; unavailable: string | null } | null>(
    null
  );
  const [failed, setFailed] = useState<string | null>(null);
  const [screen, setScreen] = useState<ScreenState>(() => screenFromSearch(search));
  const [textView, setTextView] = useState(false);
  const [queryText, setQueryText] = useState('');
  const [queryProblems, setQueryProblems] = useState<{ text: string; reason: string }[]>([]);
  const [draft, setDraft] = useState<{ metric: string; op: FilterOp; value: string; value2: string }>({
    metric: 'roe',
    op: 'gt',
    value: '',
    value2: '',
  });
  const [ratioDraft, setRatioDraft] = useState({ label: '', formula: '' });
  const [saved, setSaved] = useState<SavedScreen[]>([]);
  const [universeOpen, setUniverseOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(true);

  // ---- the table -------------------------------------------------------
  useEffect(() => {
    let alive = true;
    fetch('/api/screener')
      .then((r) => r.json())
      .then((body) => {
        if (!alive) return;
        if (body?.error) {
          setFailed(String(body.error));
          return;
        }
        setTable({ rows: body.rows ?? [], built: body.built ?? null, unavailable: body.unavailable ?? null });
      })
      .catch(() => alive && setFailed('The screener table could not be read.'));
    return () => {
      alive = false;
    };
  }, []);

  // ---- saved screens, in this browser only -----------------------------
  useEffect(() => {
    try {
      const held = window.localStorage.getItem(SAVED_KEY);
      if (held) setSaved(JSON.parse(held));
    } catch {
      /* a browser with storage switched off still screens */
    }
  }, []);

  // ---- the address bar follows the screen (rule 22) --------------------
  const asSearch = useMemo(() => screenToSearch(screen), [screen]);
  useEffect(() => {
    onScreenChange(asSearch);
  }, [asSearch, onScreenChange]);

  const rows = table?.rows ?? [];
  const choices = useMemo(() => universeChoices(rows), [rows]);
  const metricsAvailable = useMemo(
    () => [...SCREENER_METRICS, ...screen.ratios.map(ratioAsMetric)],
    [screen.ratios]
  );
  const result = useMemo(() => runScreen(rows, screen), [rows, screen]);
  const columns = useMemo(() => {
    const set = COLUMN_SETS.find((c) => c.name === screen.columns) ?? COLUMN_SETS[0];
    return [...set.keys, ...screen.ratios.map((r) => r.key)];
  }, [screen.columns, screen.ratios]);
  const exclusion = exclusionSentence(result);

  // A preview of the ratio being written, on the first company that can answer
  // it — rule 8 asks for a preview before saving, and a formula with no worked
  // example is a formula nobody can check.
  const ratioPreview = useMemo(() => {
    if (!ratioDraft.formula.trim()) return null;
    const universe = universeOf(rows, screen);
    for (const row of universe.slice(0, 40)) {
      const { value, problem } = evaluateFormula(ratioDraft.formula, (key) => {
        const cell = row.cells[key];
        return cell && cell.state === 'value' ? cell.value : null;
      });
      if (value !== null) return { on: row, value, problem: null as string | null };
      if (problem && /not arithmetic|no metric called|left over|divides by/.test(problem)) {
        return { on: null, value: null, problem };
      }
    }
    return { on: null, value: null, problem: 'No company in the universe can answer that formula' };
  }, [ratioDraft.formula, rows, screen]);

  const set = (next: Partial<ScreenState>) => setScreen((s) => ({ ...s, ...next }));

  const addFilter = () => {
    const value = Number(draft.value);
    if (!isFinite(value)) return;
    const filter: Filter =
      draft.op === 'between'
        ? { metric: draft.metric, op: 'between', value, value2: Number(draft.value2) }
        : { metric: draft.metric, op: draft.op, value };
    if (draft.op === 'between' && !isFinite(Number(draft.value2))) return;
    set({ filters: [...screen.filters, filter] });
    setDraft({ ...draft, value: '', value2: '' });
  };

  const applyText = () => {
    const { filters, problems } = parseQuery(queryText);
    setQueryProblems(problems);
    if (filters.length) set({ filters });
  };

  const saveHere = () => {
    const name = writeQuery(screen.filters) || 'every company in the universe';
    const next = [...saved.filter((s) => s.name !== name), { name, search: asSearch }].slice(-12);
    setSaved(next);
    try {
      window.localStorage.setItem(SAVED_KEY, JSON.stringify(next));
    } catch {
      /* storage off: the screen still works, the screen just is not kept */
    }
  };

  // ---- what the screen shows before it has a table ---------------------
  if (failed) {
    return (
      <Shell onBack={onBack}>
        <div className="border border-line bg-panel px-5 py-8">
          <div className={`${EYEBROW} text-accent-text mb-2`}>NOTHING TO SCREEN</div>
          <p className={`${BODY} text-read max-w-prose`}>{failed}</p>
        </div>
      </Shell>
    );
  }
  if (!table) {
    return (
      <Shell onBack={onBack}>
        <div className="border border-line bg-panel px-5 py-10 text-center">
          <div className={`${EYEBROW} text-quiet mb-2`}>READING THE TABLE</div>
          <p className={`${UI} text-read`}>Every company's figures, precomputed.</p>
        </div>
      </Shell>
    );
  }
  if (table.unavailable) {
    return (
      <Shell onBack={onBack}>
        <div className="border border-line bg-panel px-5 py-8">
          <div className={`${EYEBROW} text-amber mb-2`}>NO TABLE ON THIS DEPLOYMENT</div>
          <p className={`${BODY} text-read max-w-prose`}>{table.unavailable}</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell onBack={onBack}>
      <style>{HINT_STYLES}</style>

      {/* ---- the universe (rule 1, rule 19) ---------------------------- */}
      <section className="border border-line bg-panel">
        <button
          type="button"
          onClick={() => setUniverseOpen((v) => !v)}
          aria-expanded={universeOpen}
          data-screener-universe-toggle
          className="flex w-full items-baseline justify-between gap-4 px-5 py-4 text-left cursor-pointer hover:bg-page/40 transition-colors"
        >
          <span className={`${EYEBROW} text-ink`}>THE UNIVERSE</span>
          <span className={`${UI} text-quiet`} data-screener-universe>
            {result.universe} of {rows.length} companies
            {screen.oneListingPerCompany ? ', one listing each' : ', every listing'}
            {screen.financials === 'exclude'
              ? ', banks and insurers left out'
              : screen.financials === 'only'
                ? ', banks and insurers only'
                : ''}
          </span>
        </button>
        {universeOpen && (
          <div className="border-t border-line px-5 py-4 space-y-4">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={screen.oneListingPerCompany}
                onChange={(e) => set({ oneListingPerCompany: e.target.checked })}
                className="mt-0.5 accent-[var(--m-accent)]"
                data-screener-one-listing
              />
              <span className={`${UI} text-read`}>
                One listing per company
                <Hint label="How one listing is chosen">
                  <p>
                    Nothing in the data says which listing is a company's primary one. What it does say is the
                    currency each listing is quoted in and the currency the company reports in, and the listing
                    quoted in its own reporting currency is kept.
                  </p>
                  <p className="mt-2 text-quiet">
                    That is right for Reliance on the NSE and Royal Bank of Canada in Toronto, and wrong for a
                    company that reports in US dollars and is listed elsewhere — HSBC reports in dollars, so its
                    New York line is kept over London. Where the rule cannot choose, every listing is shown
                    rather than one guessed at.
                  </p>
                </Hint>
              </span>
            </label>
            <div>
              <div className={`${EYEBROW} text-quiet mb-2`}>BANKS AND INSURERS</div>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ['include', 'Included'],
                    ['exclude', 'Left out'],
                    ['only', 'Only these'],
                  ] as [ScreenState['financials'], string][]
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => set({ financials: value })}
                    aria-pressed={screen.financials === value}
                    className={`${EYEBROW} border px-3 py-1.5 cursor-pointer transition-colors ${
                      screen.financials === value
                        ? 'border-accent bg-page text-ink font-semibold'
                        : 'border-line text-muted hover:text-ink'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className={`${UI} text-quiet mt-2 max-w-prose`}>
                A bank's balance sheet is its business, so EV/EBITDA, margins, debt to equity, the current ratio
                and interest cover are shown as <strong className="text-read">n.m.</strong> rather than computed
                and misread. They can be screened on their own instead.
              </p>
            </div>
            {choices.countries.length > 1 && (
              <Picker
                label="COUNTRY OF INCORPORATION"
                options={choices.countries}
                chosen={screen.countries}
                onChange={(countries) => set({ countries })}
              />
            )}
            {choices.exchanges.length > 1 && (
              <Picker
                label="EXCHANGE"
                options={choices.exchanges}
                chosen={screen.exchanges}
                onChange={(exchanges) => set({ exchanges })}
              />
            )}
          </div>
        )}
      </section>

      {/* ---- filters (rules 19, 21) ------------------------------------ */}
      <section className="mt-4 border border-line bg-panel">
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3">
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
            className={`${EYEBROW} text-ink cursor-pointer`}
          >
            FILTERS
          </button>
          <button
            type="button"
            onClick={() => setTextView((v) => !v)}
            data-screener-text-toggle
            className={`${EYEBROW} border border-line px-3 py-1.5 text-muted hover:text-ink cursor-pointer transition-colors`}
          >
            {textView ? 'Use chips' : 'Write it as text'}
          </button>
        </div>

        {filtersOpen && (
          <div className="px-5 py-4">
            {textView ? (
              <div>
                <label className={`${EYEBROW} text-quiet block mb-2`} htmlFor="screener-query">
                  ONE COMPARISON PER CLAUSE, JOINED BY “AND”
                </label>
                <textarea
                  id="screener-query"
                  data-screener-query
                  value={queryText}
                  onChange={(e) => setQueryText(e.target.value)}
                  rows={3}
                  placeholder={'Return on equity > 15 and Debt / equity < 0.5'}
                  className={`${UI} font-figure w-full border border-line-control bg-page px-3 py-2 text-ink`}
                />
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={applyText}
                    data-screener-query-apply
                    className={`${EYEBROW} border border-accent bg-accent/10 px-3.5 py-2 text-ink cursor-pointer`}
                  >
                    Read it into chips
                  </button>
                  <button
                    type="button"
                    onClick={() => setQueryText(writeQuery(screen.filters))}
                    className={`${EYEBROW} border border-line px-3.5 py-2 text-muted hover:text-ink cursor-pointer`}
                  >
                    Write the chips out
                  </button>
                </div>
                {queryProblems.length > 0 && (
                  <ul className="mt-3 space-y-1" data-screener-query-problems>
                    {queryProblems.map((p, i) => (
                      <li key={i} className={`${UI} text-accent-text`}>
                        “{p.text}” — {p.reason}
                      </li>
                    ))}
                  </ul>
                )}
                <p className={`${UI} text-quiet mt-3 max-w-prose`}>
                  The text and the chips are two views of one set of filters, so neither is the real one. There is
                  no plain-English box: rule 9 allows one only where it turns words into chips a reader can see,
                  and until it can show its working it is not here.
                </p>
              </div>
            ) : (
              <div className="flex flex-wrap items-end gap-2">
                <label className="sr-only" htmlFor="screener-metric">
                  Metric
                </label>
                <select
                  id="screener-metric"
                  data-screener-metric
                  value={draft.metric}
                  onChange={(e) => setDraft({ ...draft, metric: e.target.value })}
                  className={`${UI} border border-line-control bg-page px-2.5 py-2 text-ink`}
                >
                  {metricsAvailable.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <label className="sr-only" htmlFor="screener-op">
                  Comparison
                </label>
                <select
                  id="screener-op"
                  data-screener-op
                  value={draft.op}
                  onChange={(e) => setDraft({ ...draft, op: e.target.value as FilterOp })}
                  className={`${UI} border border-line-control bg-page px-2.5 py-2 text-ink`}
                >
                  {(Object.keys(OP_WORDS) as FilterOp[]).map((op) => (
                    <option key={op} value={op}>
                      {OP_WORDS[op]}
                    </option>
                  ))}
                </select>
                <input
                  data-screener-value
                  value={draft.value}
                  onChange={(e) => setDraft({ ...draft, value: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && addFilter()}
                  inputMode="decimal"
                  placeholder="15"
                  aria-label="Value"
                  className={`${UI} font-figure w-24 border border-line-control bg-page px-2.5 py-2 text-right text-ink tabular-nums`}
                />
                {draft.op === 'between' && (
                  <input
                    data-screener-value2
                    value={draft.value2}
                    onChange={(e) => setDraft({ ...draft, value2: e.target.value })}
                    inputMode="decimal"
                    placeholder="25"
                    aria-label="Upper bound"
                    className={`${UI} font-figure w-24 border border-line-control bg-page px-2.5 py-2 text-right text-ink tabular-nums`}
                  />
                )}
                <button
                  type="button"
                  onClick={addFilter}
                  data-screener-add
                  className={`${EYEBROW} border border-accent bg-accent/10 px-3.5 py-2 text-ink cursor-pointer min-h-[40px]`}
                >
                  Add filter
                </button>
              </div>
            )}

            {/* active filters as removable chips (rule 21) */}
            {screen.filters.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2" data-screener-chips>
                {screen.filters.map((f, i) => {
                  const metric = METRICS_BY_KEY[f.metric] ?? ratioAsMetric({
                    key: f.metric,
                    label: f.metric,
                    formula: '',
                    unit: 'ratio',
                  });
                  return (
                    <span
                      key={`${f.metric}-${i}`}
                      data-screener-chip={f.metric}
                      className={`${EYEBROW} inline-flex items-center gap-2 border border-accent bg-page px-2.5 py-1.5 text-ink`}
                    >
                      {metric.label} {f.op === 'between' ? `${f.value}–${f.value2}` : `${OP_SYMBOLS[f.op]} ${f.value}`}
                      <button
                        type="button"
                        aria-label={`Remove the filter on ${metric.label}`}
                        onClick={() => set({ filters: screen.filters.filter((_, j) => j !== i) })}
                        className="text-quiet hover:text-accent-text cursor-pointer"
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
                <button
                  type="button"
                  onClick={() => set({ filters: [] })}
                  className={`${EYEBROW} border border-line px-2.5 py-1.5 text-muted hover:text-ink cursor-pointer`}
                >
                  Clear all
                </button>
              </div>
            )}

            {/* presets, named by their rules (rule 14) */}
            <div className="mt-4">
              <div className={`${EYEBROW} text-quiet mb-2`}>WRITTEN AS THEIR RULES, NOT THEIR OUTCOME</div>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    data-screener-preset={preset.name}
                    onClick={() => set({ filters: preset.filters })}
                    className={`${EYEBROW} border border-line px-2.5 py-1.5 text-muted hover:text-ink cursor-pointer transition-colors`}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            {/* user-defined ratios (rule 8) */}
            <div className="mt-5 border-t border-line pt-4">
              <div className={`${EYEBROW} text-quiet mb-2`}>A RATIO OF YOUR OWN</div>
              <div className="flex flex-wrap items-end gap-2">
                <input
                  data-screener-ratio-label
                  value={ratioDraft.label}
                  onChange={(e) => setRatioDraft({ ...ratioDraft, label: e.target.value })}
                  placeholder="Earnings yield"
                  aria-label="What to call it"
                  className={`${UI} w-44 border border-line-control bg-page px-2.5 py-2 text-ink`}
                />
                <input
                  data-screener-ratio-formula
                  value={ratioDraft.formula}
                  onChange={(e) => setRatioDraft({ ...ratioDraft, formula: e.target.value })}
                  placeholder="100 / pe"
                  aria-label="The formula"
                  className={`${UI} font-figure w-64 border border-line-control bg-page px-2.5 py-2 text-ink`}
                />
                <button
                  type="button"
                  data-screener-ratio-add
                  disabled={!ratioPreview || ratioPreview.value === null || !ratioDraft.label.trim()}
                  onClick={() => {
                    const key = `own_${ratioDraft.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '') || 'ratio'}`;
                    const ratio: CustomRatio = {
                      key,
                      label: ratioDraft.label.trim(),
                      formula: ratioDraft.formula.trim(),
                      unit: 'ratio',
                    };
                    set({ ratios: [...screen.ratios.filter((r) => r.key !== key), ratio] });
                    setRatioDraft({ label: '', formula: '' });
                  }}
                  className={`${EYEBROW} border px-3.5 py-2 cursor-pointer min-h-[40px] ${
                    ratioPreview && ratioPreview.value !== null && ratioDraft.label.trim()
                      ? 'border-accent bg-accent/10 text-ink'
                      : 'border-line text-quiet cursor-not-allowed'
                  }`}
                >
                  Add as a column
                </button>
              </div>
              {ratioPreview && (
                <p className={`${UI} mt-2 ${ratioPreview.value === null ? 'text-accent-text' : 'text-read'}`} data-screener-ratio-preview>
                  {ratioPreview.value === null
                    ? ratioPreview.problem
                    : `On ${ratioPreview.on?.name}: ${asPerShare(ratioPreview.value)}`}
                </p>
              )}
              <p className={`${UI} text-quiet mt-2 max-w-prose`}>
                Arithmetic over the columns above, by their short names:{' '}
                <span className="font-figure text-read">{SCREENER_METRICS.slice(0, 6).map((m) => m.key).join(', ')}</span>{' '}
                and the rest. A company that cannot answer the formula is set aside and counted, never scored
                zero.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* ---- the result ------------------------------------------------- */}
      <section className="mt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border border-line border-b-0 bg-panel px-5 py-3">
          <div>
            {/* rule 16, in the words the spec asks for */}
            <p className={`${UI} text-ink`} data-screener-count>
              <strong className="font-figure tabular-nums text-[1.125rem]">{result.matched}</strong>{' '}
              {result.matched === 1 ? 'company matches' : 'companies match'} your criteria, sorted by{' '}
              {screen.sort === 'name' ? 'company name' : (METRICS_BY_KEY[screen.sort]?.label ?? screen.sort)}
            </p>
            {exclusion && (
              <p className={`${UI} text-amber mt-1`} data-screener-excluded>
                {exclusion}
              </p>
            )}
            {result.rejected > 0 && (
              <p className={`${UI} text-quiet mt-1`} data-screener-rejected>
                {result.rejected} were tested and did not match.
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {COLUMN_SETS.map((cset) => (
              <button
                key={cset.name}
                type="button"
                data-screener-columnset={cset.name}
                onClick={() => set({ columns: cset.name })}
                aria-pressed={screen.columns === cset.name}
                className={`${EYEBROW} border px-2.5 py-1.5 cursor-pointer transition-colors ${
                  screen.columns === cset.name
                    ? 'border-accent bg-page text-ink font-semibold'
                    : 'border-line text-muted hover:text-ink'
                }`}
              >
                {cset.name}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto border border-line bg-panel [scrollbar-width:thin]">
          <table className="w-full border-collapse" data-screener-table>
            <caption className="sr-only">
              {result.matched} companies matching the filters, sorted by{' '}
              {METRICS_BY_KEY[screen.sort]?.label ?? screen.sort}
            </caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className={`${EYEBROW} sticky left-0 z-20 w-[30%] min-w-0 max-w-[30%] border-b border-r border-line bg-panel px-3 py-2.5 text-left align-bottom text-quiet sm:w-auto sm:max-w-none sm:min-w-[14rem]`}
                >
                  <button
                    type="button"
                    onClick={() => set({ sort: 'name', descending: screen.sort === 'name' ? !screen.descending : false })}
                    className={`${EYEBROW} cursor-pointer hover:text-ink`}
                  >
                    COMPANY {screen.sort === 'name' ? (screen.descending ? '↓' : '↑') : ''}
                  </button>
                </th>
                {columns.map((key) => {
                  const metric = METRICS_BY_KEY[key] ?? ratioAsMetric(
                    screen.ratios.find((r) => r.key === key) ?? { key, label: key, formula: '', unit: 'ratio' }
                  );
                  return (
                    <th
                      key={key}
                      scope="col"
                      data-screener-column={key}
                      className="border-b border-line px-3 py-2.5 text-right align-bottom"
                    >
                      <div className="flex items-baseline justify-end gap-1">
                        <button
                          type="button"
                          data-screener-sort={key}
                          onClick={() =>
                            set({
                              sort: key,
                              descending: screen.sort === key ? !screen.descending : metric.defaultDescending ?? true,
                            })
                          }
                          className={`${EYEBROW} whitespace-nowrap cursor-pointer ${
                            screen.sort === key ? 'text-ink' : 'text-quiet hover:text-ink'
                          }`}
                        >
                          {metric.label} {screen.sort === key ? (screen.descending ? '↓' : '↑') : ''}
                        </button>
                        {/* RULE 2: the formula, the source and the date, on the header. */}
                        <Hint label={`How ${metric.label} is worked out`}>
                          <p style={{ marginBottom: 6 }}>
                            <strong>{metric.formula}</strong>
                          </p>
                          <p className="text-quiet">From {metric.source}.</p>
                          <p className="mt-2 text-quiet">
                            The period each figure covers is under it in the table, because companies do not share
                            a financial year.
                          </p>
                          {metric.notMeaningfulForFinancials && (
                            <p className="mt-2 text-quiet">
                              Shown as n.m. for a bank or insurer: its balance sheet is its business, so this
                              ratio does not mean for it what it means elsewhere.
                            </p>
                          )}
                        </Hint>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {result.sorted.map((row) => (
                <tr key={row.ticker} className="border-b border-line/60 last:border-b-0" data-screener-row={row.ticker}>
                  <th
                    scope="row"
                    className="sticky left-0 z-10 w-[30%] min-w-0 max-w-[30%] border-r border-line bg-panel px-3 py-2 text-left align-top font-normal sm:w-auto sm:max-w-none sm:min-w-[14rem]"
                  >
                    <button
                      type="button"
                      onClick={() => onOpenCompany(row.ticker)}
                      className={`${UI} text-left text-ink hover:text-accent-text cursor-pointer`}
                    >
                      {row.name}
                    </button>
                    <div className={`${EYEBROW} text-quiet mt-0.5`}>
                      {row.ticker} · {row.currency}
                      {row.financial ? ' · bank template' : ''}
                      {row.dataSource !== 'SEC EDGAR' ? ' · vendor feed, development only' : ''}
                    </div>
                  </th>
                  {columns.map((key) => {
                    const metric = METRICS_BY_KEY[key] ?? { unit: 'ratio' as MetricUnit };
                    const cell = row.cells[key];
                    return (
                      <td key={key} className="px-3 py-2 text-right align-top">
                        <div
                          className={`${UI} font-figure tabular-nums ${
                            !cell || cell.state !== 'value' ? 'text-quiet' : 'text-ink'
                          }`}
                          data-screener-cell={`${row.ticker}:${key}`}
                          data-state={cell?.state ?? 'unavailable'}
                          title={cell && cell.state !== 'value' ? String(cell.reason ?? '') : undefined}
                        >
                          {!cell
                            ? NOT_REPORTED
                            : cell.state === 'nm'
                              ? 'n.m.'
                              : printed(cell.value, metric.unit, row.currencySymbol)}
                        </div>
                        {cell?.period && cell.state === 'value' && (
                          <div className={`${EYEBROW} text-quiet mt-0.5 whitespace-nowrap`}>{cell.period}</div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {result.sorted.length === 0 && (
                <tr>
                  <td colSpan={columns.length + 1} className="px-5 py-8 text-center">
                    <p className={`${UI} text-read`}>No company in the universe satisfies every filter.</p>
                    {exclusion && <p className={`${UI} text-amber mt-1`}>{exclusion}</p>}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ---- the link, saving, and what is not here ------------------- */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border border-line bg-panel px-5 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-screener-save
              onClick={saveHere}
              className={`${EYEBROW} border border-line px-3 py-2 text-muted hover:text-ink cursor-pointer`}
            >
              Keep this screen
            </button>
            {saved.map((s) => (
              <button
                key={s.name}
                type="button"
                onClick={() => setScreen(screenFromSearch(s.search))}
                className={`${EYEBROW} border border-line px-2.5 py-1.5 text-muted hover:text-ink cursor-pointer`}
                title={s.name}
              >
                {s.name.length > 34 ? `${s.name.slice(0, 33)}…` : s.name}
              </button>
            ))}
          </div>
          <p className={`${UI} text-quiet max-w-prose`} data-screener-limits>
            This screen is in its web address, so the link in the bar is the screen — send it to anybody. Kept
            screens are in this browser only until accounts arrive in build step 7. There is no download: 93 of
            the {rows.length} companies here carry vendor figures this site is not licensed to redistribute, and a
            file that quietly left them out would be worse than none.
          </p>
        </div>
      </section>
    </Shell>
  );
};

/** The page frame, so the three states above share one. */
const Shell: React.FC<{ children: React.ReactNode; onBack: () => void }> = ({ children, onBack }) => (
  // `data-screener` marks everything this screen puts on the page, so the
  // banned-word check can be held to the screener's own words. The site's
  // footer carries the disclaimer that nothing here is a recommendation to buy
  // or sell a security, which is the OPPOSITE of what rule 12 forbids and must
  // not be scanned as though it were the same thing.
  <div data-screener className="min-h-screen bg-page pt-28 sm:pt-24 lg:pt-28 pb-20">
    <div className="max-w-[1440px] mx-auto px-5 sm:px-6 lg:px-12">
      <header className="border border-line bg-panel px-5 py-5 lg:px-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <h1 className="font-display text-[var(--m-size-title)] font-semibold leading-tight tracking-[-0.02em] text-ink">
            Screener
            <Mark />
          </h1>
          <button
            type="button"
            onClick={onBack}
            className={`${EYEBROW} border border-line px-3 py-2 text-muted hover:text-ink cursor-pointer`}
          >
            Back
          </button>
        </div>
        <p className={`${BODY} text-read mt-2 max-w-prose`}>
          Which companies satisfy a set of conditions, and which were set aside because a figure they needed is
          not reported. Every column says how it is worked out and from what.
        </p>
      </header>
      <main className="mt-4">{children}</main>
    </div>
  </div>
);

/** A multi-select as chips, for the universe picker. */
const Picker: React.FC<{
  label: string;
  options: string[];
  chosen: string[];
  onChange: (next: string[]) => void;
}> = ({ label, options, chosen, onChange }) => (
  <div>
    <div className={`${EYEBROW} text-quiet mb-2`}>
      {label}
      {chosen.length ? ` · ${chosen.length} chosen` : ' · all'}
    </div>
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const on = chosen.includes(option);
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(on ? chosen.filter((c) => c !== option) : [...chosen, option])}
            aria-pressed={on}
            className={`${EYEBROW} border px-2.5 py-1.5 cursor-pointer transition-colors ${
              on ? 'border-accent bg-page text-ink font-semibold' : 'border-line text-muted hover:text-ink'
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  </div>
);

/**
 * PRESETS NAMED BY THEIR RULES (rule 14).
 *
 * "ROE > 15% and Debt/Equity < 0.5" is a description of a filter. "Quality
 * stocks" is a verdict on the companies that pass it, and the difference is
 * the whole of rule 14. Every name here is the arithmetic.
 */
const PRESETS: { name: string; filters: Filter[] }[] = [
  {
    name: 'Return on equity > 15% and Debt / equity < 0.5',
    filters: [
      { metric: 'roe', op: 'gt', value: 15 },
      { metric: 'debtToEquity', op: 'lt', value: 0.5 },
    ],
  },
  {
    name: 'Operating margin > 20% and Revenue growth > 10%',
    filters: [
      { metric: 'operatingMargin', op: 'gt', value: 20 },
      { metric: 'revenueGrowth', op: 'gt', value: 10 },
    ],
  },
  {
    name: 'Price / earnings < 15 and Interest cover > 5',
    filters: [
      { metric: 'pe', op: 'lt', value: 15 },
      { metric: 'interestCover', op: 'gt', value: 5 },
    ],
  },
  {
    name: 'Dividend yield > 3%',
    filters: [{ metric: 'dividendYield', op: 'gt', value: 3 }],
  },
];

export default ScreenerScreen;
