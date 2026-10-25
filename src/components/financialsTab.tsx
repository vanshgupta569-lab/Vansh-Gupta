// FILE: src/components/financialsTab.tsx
//
// THE FINANCIALS TAB (docs/FINANCIALS_SPEC.md screen design 1–5, 7, 8, 11).
//
// The three statements as filed, with every number opening the evidence behind
// it. The spec's own survey is the brief: of the five sites studied, not one
// links a figure to its filing, so that is the thing this screen is built
// around rather than a feature bolted to the side of it.
//
// WHAT EACH PART IS FOR, so the next person does not have to guess:
//
//   THE CONTROLS SAY WHAT EXISTS. Annual, Quarterly, Half-year and TTM are all
//   offered, and the two with no periods behind them say so when chosen rather
//   than drawing an empty grid — an empty table reads as a company that filed
//   nothing, which is a lie about the company rather than about us.
//
//   EIGHT ROWS, THEN A PLUS. A statement has forty lines and a reader wants
//   eight; the rest are one click away and the click is labelled with how many.
//
//   THE PHONE IS THE HARD CASE, not the afterthought. The label column sticks,
//   the header sticks, the columns snap, and the sideways scroll is CONTAINED
//   IN THE TABLE so the page itself never moves — which `verify:dashboard`
//   checks at 390px on every run.
//
//   EVERY CELL IS A BUTTON. That is what makes the evidence reachable by
//   keyboard as well as by tap, and the arrow keys walk the grid.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, X } from 'lucide-react';
import {
  financialsFor,
  evidenceFor,
  formatValue,
  type Evidence,
  type Frequency,
  type Row,
  type Statement,
} from '../data/financials';
import { Hint } from './figuresHint';
import { EYEBROW, UI, BODY, Pill } from './instrument';

const STATEMENTS: { key: Statement; label: string }[] = [
  { key: 'income', label: 'Income statement' },
  { key: 'balance', label: 'Balance sheet' },
  { key: 'cash', label: 'Cash flow' },
];

const FREQUENCIES: { key: Frequency; label: string }[] = [
  { key: 'annual', label: 'Annual' },
  { key: 'quarterly', label: 'Quarterly' },
  { key: 'half', label: 'Half-year' },
  { key: 'ttm', label: 'TTM' },
];

/** The chip, used by every control on this screen so they cannot drift apart. */
const Chip: React.FC<{
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}> = ({ on, onClick, children, title }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    aria-pressed={on}
    className={`${EYEBROW} shrink-0 border px-2.5 py-1 transition-colors cursor-pointer ${
      on ? 'border-accent text-ink bg-accent/15' : 'border-line text-muted hover:text-ink hover:border-quiet/60'
    }`}
  >
    {children}
  </button>
);

export const FinancialsTab: React.FC<{ payload: any; ticker: string }> = ({ payload, ticker }) => {
  const [statement, setStatement] = useState<Statement>('income');
  const [frequency, setFrequency] = useState<Frequency>('annual');
  const [window_, setWindow] = useState<5 | 10 | 'all'>('all');
  const [order, setOrder] = useState<'oldest' | 'newest'>('oldest');
  const [detail, setDetail] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [overflows, setOverflows] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  const view = useMemo(
    () => financialsFor(payload, { statement, frequency, window: window_, order }),
    [payload, statement, frequency, window_, order]
  );

  const shown: Row[] = view.rows.filter((r) => detail || !r.detail);
  const hidden = view.rows.length - shown.length;
  const symbol = String(payload?.currencySymbol || payload?.currency || '');

  // SCREEN DESIGN 3: a visible cue that there are more columns, shown only when
  // there really are — measured rather than assumed, because a permanent "swipe
  // for more" on a table that fits is furniture that teaches the reader to
  // ignore it.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const measure = () => setOverflows(el.scrollWidth > el.clientWidth + 2);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [view]);

  useEffect(() => {
    if (!evidence) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEvidence(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [evidence]);

  /** The arrow keys walk the grid, which is what "keyboard navigation" means. */
  const onGridKey = (e: React.KeyboardEvent<HTMLTableSectionElement>) => {
    const dirs: Record<string, [number, number]> = {
      ArrowRight: [0, 1],
      ArrowLeft: [0, -1],
      ArrowDown: [1, 0],
      ArrowUp: [-1, 0],
    };
    const move = dirs[e.key];
    if (!move) return;
    const current = document.activeElement as HTMLElement | null;
    const r = Number(current?.dataset?.r);
    const c = Number(current?.dataset?.c);
    if (!isFinite(r) || !isFinite(c)) return;
    const next = e.currentTarget.querySelector<HTMLElement>(
      `[data-r="${r + move[0]}"][data-c="${c + move[1]}"]`
    );
    if (next) {
      e.preventDefault();
      next.focus();
    }
  };

  return (
    <div className="space-y-5">
      {/* ---- the controls ------------------------------------------------ */}
      <section aria-label="Statement controls" className="border border-line bg-panel px-5 py-4 lg:px-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3">
          <div className="flex flex-wrap gap-1.5">
            {STATEMENTS.map((s) => (
              <Chip key={s.key} on={s.key === statement} onClick={() => setStatement(s.key)}>
                {s.label}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FREQUENCIES.map((f) => (
              <Chip key={f.key} on={f.key === frequency} onClick={() => setFrequency(f.key)}>
                {f.label}
              </Chip>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {([5, 10, 'all'] as const).map((w) => (
              <Chip key={String(w)} on={w === window_} onClick={() => setWindow(w)}>
                {w === 'all' ? `All (${view.periods.filter((p) => p.kind === 'annual').length})` : `${w}Y`}
              </Chip>
            ))}
            <Chip
              on={false}
              onClick={() => setOrder(order === 'oldest' ? 'newest' : 'oldest')}
              title="Change the order of the columns"
            >
              {order === 'oldest' ? 'Oldest first' : 'Newest first'}
            </Chip>
          </div>
          <div className={`${UI} text-quiet flex items-center gap-1.5`}>
            {view.unitLabel}
            <Hint label="What these figures are in">
              <p>
                {view.unitLabel}. The scale comes from the data layer that set it, which divides every monetary
                fact by a million and leaves share counts whole — not from counting digits.
              </p>
              <p className="mt-2 text-quiet">{view.basisNote}</p>
            </Hint>
          </div>
        </div>
      </section>

      {/* ---- a frequency with nothing behind it says so ------------------- */}
      {view.empty && (
        <section className="border border-line bg-panel px-5 py-8 lg:px-6">
          <div className="flex items-center gap-2.5 mb-2">
            <h2 className="font-display text-[var(--m-size-section)] font-semibold tracking-[-0.012em] text-ink">
              {FREQUENCIES.find((f) => f.key === frequency)?.label}
            </h2>
            <Pill tone="neutral">none held</Pill>
          </div>
          <p className={`${BODY} text-read max-w-prose`}>{view.empty}</p>
        </section>
      )}

      {/* ---- the statement ----------------------------------------------- */}
      {!view.empty && (
        <section
          aria-label={STATEMENTS.find((s) => s.key === statement)?.label}
          className="border border-line bg-panel"
        >
          <div
            ref={scroller}
            className="overflow-x-auto [scroll-snap-type:x_mandatory] [scroll-padding-left:30%] sm:[scroll-padding-left:16rem] [scrollbar-width:thin]"
          >
            <table className="w-full border-collapse" data-financials={statement}>
              <caption className="sr-only">
                {STATEMENTS.find((s) => s.key === statement)?.label} for {ticker}, {view.unitLabel}
              </caption>
              <thead>
                <tr>
                  <th
                    scope="col"
                    className={`${EYEBROW} sticky left-0 z-20 w-[30%] min-w-0 max-w-[30%] border-b border-r border-line bg-panel px-3 py-2.5 text-left align-bottom text-quiet sm:w-auto sm:max-w-none sm:min-w-[16rem]`}
                  >
                    <span className="sr-only sm:not-sr-only">
                      {STATEMENTS.find((s) => s.key === statement)?.label}
                    </span>
                  </th>
                  {view.periods.map((p, c) => (
                    <th
                      key={p.key}
                      scope="col"
                      onMouseEnter={() => setHover(c)}
                      onMouseLeave={() => setHover(null)}
                      className={`border-b border-line px-3 py-2.5 text-right align-bottom [scroll-snap-align:start] transition-colors ${
                        hover === c ? 'bg-page/60' : ''
                      } ${p.kind === 'ttm' ? 'border-l border-l-line' : ''}`}
                    >
                      <div className={`${EYEBROW} text-ink whitespace-nowrap`}>{p.label}</div>
                      <div className={`${UI} text-quiet whitespace-nowrap`}>{p.dateLabel}</div>
                      <div className="mt-1 flex justify-end gap-1">
                        {p.chips.map((chip) => (
                          <span
                            key={chip}
                            className={`${EYEBROW} whitespace-nowrap border border-line px-1.5 py-[1px] text-quiet`}
                          >
                            {chip}
                          </span>
                        ))}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody onKeyDown={onGridKey}>
                {shown.map((row, r) => (
                  <tr key={row.key} className="border-b border-line/60 last:border-b-0">
                    <th
                      scope="row"
                      className={`sticky left-0 z-10 w-[30%] min-w-0 max-w-[30%] border-r border-line bg-panel px-3 py-2 text-left align-top font-normal sm:w-auto sm:max-w-none sm:min-w-[16rem]`}
                    >
                      <span className={`${UI} ${row.detail ? 'text-muted' : 'text-ink'}`}>{row.label}</span>
                      {row.note && (
                        <Hint label={`About ${row.label}`}>
                          <p>{row.note}</p>
                          {row.formula && <p className="mt-2 text-quiet">{row.formula}.</p>}
                        </Hint>
                      )}
                    </th>
                    {row.cells.map((cell, c) => (
                      <td
                        key={c}
                        onMouseEnter={() => setHover(c)}
                        onMouseLeave={() => setHover(null)}
                        className={`px-0 py-0 text-right [scroll-snap-align:start] transition-colors ${
                          hover === c ? 'bg-page/60' : ''
                        } ${view.periods[c]?.kind === 'ttm' ? 'border-l border-l-line' : ''}`}
                      >
                        <button
                          type="button"
                          data-r={r}
                          data-c={c}
                          data-cell={`${row.key}:${view.periods[c]?.key}`}
                          data-state={cell.state}
                          onClick={() => setEvidence(evidenceFor(payload, view, row, c))}
                          className={`${UI} font-figure w-full px-3 py-2 text-right tabular-nums transition-colors cursor-pointer hover:bg-accent/10 focus:outline-none focus-visible:bg-accent/15 ${
                            cell.value === null ? 'text-quiet' : row.detail ? 'text-read' : 'text-ink'
                          }`}
                          title={cell.value === null ? cell.reason : 'What this number is, and where it came from'}
                        >
                          {formatValue(cell, row.kind, symbol)}
                        </button>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-3 py-2.5">
            {hidden > 0 || detail ? (
              <button
                type="button"
                onClick={() => setDetail(!detail)}
                className={`${EYEBROW} border border-line px-2.5 py-1 text-muted hover:text-ink hover:border-quiet/60 transition-colors cursor-pointer`}
              >
                {detail ? '− Fewer lines' : `+ ${hidden} more ${hidden === 1 ? 'line' : 'lines'}`}
              </button>
            ) : (
              <span />
            )}
            <span className={`${UI} text-quiet`}>
              {overflows ? 'Swipe the table for earlier periods · ' : ''}
              Tap any number for the evidence behind it
            </span>
          </div>
        </section>
      )}

      {/* ---- where it all came from -------------------------------------- */}
      <section aria-label="Source of these figures" className="border border-line bg-panel px-5 py-4 lg:px-6">
        <div className={`${EYEBROW} text-quiet mb-1.5`}>Source</div>
        <p className={`${BODY} text-read max-w-prose`}>{view.sourceNote}</p>
        <p className={`${UI} text-quiet max-w-prose mt-2`}>{view.basisNote}</p>
      </section>

      {evidence && <EvidenceSheet evidence={evidence} onClose={() => setEvidence(null)} />}
    </div>
  );
};

/**
 * SCREEN DESIGN 8: a side panel on a desktop, a bottom sheet on a phone.
 *
 * One component for both, because they say the same thing in the same order and
 * two components would say two slightly different things within a month.
 */
const EvidenceSheet: React.FC<{ evidence: Evidence; onClose: () => void }> = ({ evidence, onClose }) => (
  <>
    <div
      className="fixed inset-0 z-40 bg-page/70 backdrop-blur-[2px]"
      onClick={onClose}
      aria-hidden="true"
    />
    <aside
      role="dialog"
      aria-label="Evidence for this figure"
      data-evidence-sheet
      className="fixed inset-x-0 bottom-0 z-50 max-h-[72vh] overflow-y-auto border-t border-line bg-panel px-5 py-5 sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[26rem] sm:border-l sm:border-t-0 sm:px-6 sm:py-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className={`${EYEBROW} text-quiet`}>Evidence</div>
          <h2 className="font-display text-[var(--m-size-section)] font-semibold tracking-[-0.012em] text-ink mt-0.5">
            {evidence.title}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close the evidence"
          className="shrink-0 border border-line p-1.5 text-muted hover:text-ink hover:border-quiet/60 transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="mt-4 flex items-baseline gap-3">
        <span className="font-figure text-[1.5rem] leading-none tabular-nums text-ink">{evidence.value}</span>
        <Pill tone={evidence.state === 'notReported' ? 'warn' : 'neutral'}>{evidence.stateLabel}</Pill>
      </div>

      {evidence.note && <p className={`${BODY} text-read mt-3`}>{evidence.note}</p>}

      <dl className="mt-4 border-t border-line pt-3">
        {evidence.lines.map((line) => (
          <div key={line.label} className="flex items-baseline justify-between gap-4 py-1">
            <dt className={`${EYEBROW} text-quiet shrink-0`}>{line.label}</dt>
            <dd className={`${UI} text-read text-right`}>{line.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 border-t border-line pt-3">
        <div className={`${EYEBROW} text-quiet mb-1.5`}>Where it came from</div>
        <p className={`${UI} ${evidence.traceable ? 'text-read' : 'text-accent-text'}`}>{evidence.source}</p>
        {evidence.concepts && (
          <p className={`${UI} text-quiet mt-2`}>
            Read from the first of these XBRL concepts the filing carries:{' '}
            <span className="font-figure text-read">{evidence.concepts.join(', ')}</span>. Which one this
            company used is not recorded in the data we hold.
          </p>
        )}
        {evidence.url && (
          <a
            href={evidence.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`${UI} text-accent-text hover:text-ink transition-colors inline-flex items-center gap-1.5 mt-3`}
          >
            Open the filing
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </aside>
  </>
);

export default FinancialsTab;
