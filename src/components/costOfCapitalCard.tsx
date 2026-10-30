// FILE: src/components/costOfCapitalCard.tsx
//
// THE RISK AND COST-OF-CAPITAL CARD (docs/COST_OF_CAPITAL_SPEC.md, "Card
// layout").
//
// Two figures at the top — the cost of equity and the WACC — and under them
// the inputs they are made of, each with its source, its date and an ⓘ. Every
// input is editable and every edit goes back through the engine, so the value
// per share at the foot is the engine's answer under the reader's own numbers
// and not a scaled version of the old one.
//
// WHAT THIS SCREEN IS FOR. A cost of capital is the single most consequential
// assumption in a valuation and the one most often shown as a fact. Every site
// studied for the spec prints a beta with no method attached; none of them says
// which index, which window, how many observations or how wide the error is. So
// the shape of this card is: the number, then immediately what it is made of,
// then what it would be on a different recipe. A reader who disagrees can
// change it in place and watch the valuation move.
//
// THE LOOK, which `CLAUDE.md`'s first design principle governs: two figures
// large, the inputs as a quiet two-column list, nothing boxed inside anything
// else, and no colour carrying meaning on its own. The editable rows look
// editable only on hover or focus, because a card showing nine inputs in nine
// input boxes reads as a form, and this is a statement with corrections
// available. At 390px the two columns become one and the figures stay at the
// top where a thumb can reach the ⓘ.
import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, RotateCcw } from 'lucide-react';
import {
  costOfCapitalFor,
  formatRow,
  type CardRow,
  type CostOfCapitalCard as Card,
  type EditKey,
  type Edits,
} from '../data/costOfCapital';
import { indexForListing, fetchIndexSeries, type IndexSeries } from '../data/marketIndex';
import { Hint } from './figuresHint';
import { EYEBROW, UI, BODY, Pill } from './instrument';

/** One index series per market, kept for the life of the page. */
const seriesCache = new Map<string, IndexSeries>();

interface Props {
  payload: any;
  ticker: string;
}

export const CostOfCapitalCard: React.FC<Props> = ({ payload, ticker }) => {
  const [edits, setEdits] = useState<Edits>({});
  const [index, setIndex] = useState<IndexSeries | null>(null);
  const [indexError, setIndexError] = useState<string | null>(null);
  // Only the numeric inputs are typed into; country risk is a switch, so it
  // never becomes a draft and the draft's key cannot be it.
  type NumericEdit = Exclude<EditKey, 'countryRisk'>;
  const [draft, setDraft] = useState<{ key: NumericEdit; text: string } | null>(null);

  const choice = useMemo(() => indexForListing(payload), [payload]);

  // THE INDEX ARRIVES AFTER THE CARD, AND THE CARD DOES NOT WAIT FOR IT. Every
  // figure the engine uses is already here; the index only adds the measured
  // betas, which are an alternative to the number in use rather than the number
  // in use. So the card renders at once and the regression appears when the
  // series lands, and a failure costs the estimates and nothing else.
  useEffect(() => {
    const symbol = choice.index?.symbol;
    if (!symbol) {
      setIndex(null);
      return;
    }
    const held = seriesCache.get(symbol);
    if (held) {
      setIndex(held);
      return;
    }
    let live = true;
    setIndexError(null);
    fetchIndexSeries(symbol)
      .then((series) => {
        seriesCache.set(symbol, series);
        if (live) setIndex(series);
      })
      .catch((e) => {
        if (live) setIndexError(String(e?.message || e));
      });
    return () => {
      live = false;
    };
  }, [choice.index?.symbol]);

  const card: Card | null = useMemo(
    () =>
      costOfCapitalFor(payload, {
        index: index ? { series: { dates: index.dates, closes: index.closes }, asOf: index.asOf } : null,
        edits,
      }),
    [payload, index, edits]
  );

  // The same card on the defaults, so an edited row can print what it was and
  // the foot can print what the value was before the reader touched anything.
  const onDefaults: Card | null = useMemo(
    () =>
      Object.keys(edits).length
        ? costOfCapitalFor(payload, {
            index: index ? { series: { dates: index.dates, closes: index.closes }, asOf: index.asOf } : null,
          })
        : null,
    [payload, index, edits]
  );

  if (!card) {
    return (
      <section aria-label="Risk and cost of capital" className="border border-line bg-panel px-5 py-5 lg:px-6">
        <h2 className="font-display text-[var(--m-size-section)] font-semibold tracking-[-0.012em] text-ink">
          Risk and cost of capital
        </h2>
        <p className={`${BODY} text-read max-w-prose mt-2`}>
          No cost of capital can be shown for {ticker}: the figures this company publishes are not enough to
          build a model from.
        </p>
      </section>
    );
  }

  const symbol = card.currencySymbol;
  const edited = (key: EditKey) => edits[key] !== undefined;
  const anyEdits = Object.keys(edits).length > 0;

  const commit = (key: NumericEdit, text: string) => {
    const n = Number(String(text).replace(/[^\d.\-]/g, ''));
    setDraft(null);
    if (!isFinite(n)) return;
    setEdits((e) => ({ ...e, [key]: n }));
  };

  const reset = (key: EditKey) =>
    setEdits((e) => {
      const next = { ...e };
      delete next[key];
      return next;
    });

  const headline = card.rows.filter((r) => r.headline);
  const inputs = card.rows.filter((r) => !r.headline);
  const betaRow = card.rows.find((r) => r.key === 'beta');

  return (
    <section aria-label="Risk and cost of capital" className="border border-line bg-panel px-5 py-5 lg:px-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h2 className="font-display text-[var(--m-size-section)] font-semibold tracking-[-0.012em] text-ink">
          Risk and cost of capital
        </h2>
        <div className="flex items-center gap-2">
          <Pill tone="neutral">{card.template === 'bank' ? 'bank template' : 'estimates, not facts'}</Pill>
          {anyEdits && (
            <button
              type="button"
              onClick={() => setEdits({})}
              className={`${EYEBROW} inline-flex items-center gap-1.5 border border-line px-2.5 py-1 text-ink hover:border-quiet/60 transition-colors cursor-pointer`}
            >
              <RotateCcw className="w-3 h-3" />
              Reset all
            </button>
          )}
        </div>
      </div>

      {/* ---- the two figures ------------------------------------------- */}
      <div className="mt-4 grid gap-px bg-line sm:grid-cols-2 border border-line" data-coc-headline>
        {headline.map((row) => (
          <div key={row.key} className="bg-panel px-4 py-4" data-coc-row={row.key}>
            <div className="flex items-center gap-1.5">
              <span className={`${EYEBROW} text-quiet`}>{row.label}</span>
              <Hint label={`How ${row.label.toLowerCase()} is worked out`} tone="quiet">
                <p>{row.about}</p>
                {row.notes?.map((n) => (
                  <p key={n} className="mt-1.5 text-quiet">
                    {n}
                  </p>
                ))}
              </Hint>
            </div>
            <div
              className="font-display text-[28px] leading-none font-semibold tracking-[-0.02em] text-ink mt-2"
              data-coc-value={row.key}
            >
              {row.value === null ? 'not applicable' : formatRow(row, symbol)}
            </div>
            {row.value === null && row.missing && (
              <p className={`${UI} text-read mt-2 max-w-prose`}>{row.missing}</p>
            )}
            {row.value !== null && row.notes?.[0] && (
              <p className={`${UI} text-quiet mt-1.5`}>{row.notes[0]}</p>
            )}
          </div>
        ))}
      </div>

      {/* ---- the inputs ------------------------------------------------- */}
      <dl className="mt-5 divide-y divide-line border-t border-line">
        {inputs.map((row) => {
          const isEditable = Boolean(row.edits);
          const key = row.edits as NumericEdit | undefined;
          const editing = draft && key && draft.key === key;
          return (
            <div
              key={row.key}
              className="py-3 grid gap-x-6 gap-y-1 sm:grid-cols-[13rem_minmax(0,1fr)]"
              data-coc-row={row.key}
            >
              <dt className="flex items-start gap-1.5">
                <span className={`${UI} text-quiet`}>{row.label}</span>
                <Hint label={`What ${row.label.toLowerCase()} is`} tone="quiet">
                  <p>{row.about}</p>
                </Hint>
              </dt>
              {/* THREE COLUMNS ON A WIDE SCREEN, two on a narrow one: the
                  figures line up in a column of their own rather than each
                  sitting at the head of its own paragraph, which is what makes
                  a list of nine inputs read as a ruled sheet. */}
              <dd className="min-w-0 lg:grid lg:grid-cols-[8.5rem_minmax(0,1fr)] lg:gap-x-6">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  {editing ? (
                    <input
                      autoFocus
                      type="text"
                      inputMode="decimal"
                      value={draft!.text}
                      onChange={(e) => setDraft({ key: key!, text: e.target.value })}
                      onBlur={() => commit(key!, draft!.text)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commit(key!, draft!.text);
                        if (e.key === 'Escape') setDraft(null);
                      }}
                      aria-label={`${row.label}, ${row.format === 'percent' ? 'per cent' : 'a multiple'}`}
                      className={`${UI} w-24 border border-accent-text bg-page px-2 py-1 text-ink outline-none`}
                    />
                  ) : isEditable ? (
                    <button
                      type="button"
                      onClick={() =>
                        setDraft({
                          key: key!,
                          text:
                            row.value === null
                              ? ''
                              : row.format === 'percent'
                                ? (row.value * 100).toFixed(2)
                                : row.value.toFixed(3),
                        })
                      }
                      data-coc-edit={key}
                      className={`${UI} text-ink border-b border-dashed border-quiet/50 hover:border-accent-text cursor-pointer text-left`}
                      title="Change this input"
                    >
                      {row.value === null ? '—' : formatRow(row, symbol)}
                    </button>
                  ) : (
                    <span className={`${UI} text-ink`} data-coc-value={row.key}>
                      {row.value === null ? '—' : formatRow(row, symbol)}
                    </span>
                  )}

                  {key && edited(key) && (
                    <>
                      <span className={`${UI} text-quiet`}>
                        default{' '}
                        {row.base === null || row.base === undefined
                          ? '—'
                          : row.format === 'percent'
                            ? `${(row.base * 100).toFixed(2)}%`
                            : row.base.toFixed(3)}
                      </span>
                      <button
                        type="button"
                        onClick={() => reset(key)}
                        className={`${EYEBROW} text-accent-text hover:text-ink transition-colors cursor-pointer`}
                      >
                        reset
                      </button>
                    </>
                  )}

                  {row.key === 'crp' && card.premium.crpPct !== null && (
                    <button
                      type="button"
                      onClick={() => setEdits((e) => ({ ...e, countryRisk: !card.premium.countryRisk }))}
                      data-coc-country-risk={card.premium.countryRisk ? 'on' : 'off'}
                      className={`${EYEBROW} border px-2 py-0.5 transition-colors cursor-pointer ${
                        card.premium.countryRisk
                          ? 'border-accent-text text-ink'
                          : 'border-line text-muted hover:text-ink'
                      }`}
                    >
                      {card.premium.countryRisk ? 'included' : 'not included'}
                    </button>
                  )}
                </div>

                <div className="min-w-0">
                {row.value === null && row.missing && (
                  <p className={`${UI} text-read mt-1 lg:mt-0 max-w-prose`}>{row.missing}</p>
                )}

                {/* source and date, on every row, which is the point */}
                {row.source && (
                  <p className={`${UI} text-quiet mt-1 lg:mt-0 max-w-prose`} data-coc-source={row.key}>
                    {row.source.publisher}
                    {row.source.asOf ? `, as at ${row.source.asOf}` : ''}
                    {row.source.method ? ` — ${row.source.method}` : ''}
                    {row.source.url && (
                      <>
                        {' '}
                        <a
                          href={row.source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent-text hover:text-ink transition-colors inline-flex items-center gap-1"
                        >
                          source
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </>
                    )}
                  </p>
                )}

                {row.notes?.length ? (
                  <ul className={`${UI} text-quiet mt-1 space-y-0.5 max-w-prose`}>
                    {row.notes.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                ) : null}
                </div>
              </dd>
            </div>
          );
        })}
      </dl>

      {/* ---- the beta the model does not use, and the one it does ------- */}
      <div className="mt-5 border-t border-line pt-4">
        <div className={`${EYEBROW} text-quiet mb-2`}>Beta, measured here</div>
        {choice.index ? (
          <p className={`${UI} text-read max-w-prose`}>
            Against the {choice.index.name}
            {index ? `, as at ${index.asOf.slice(0, 10)}` : ', loading'}
            {choice.index.specDefault ? '' : ' — not the index the specification names first'}.
            {choice.index.instead ? ` ${choice.index.instead}` : ''}
          </p>
        ) : (
          <p className={`${UI} text-read max-w-prose`}>{choice.reason ?? card.beta.indexReason}</p>
        )}
        {indexError && (
          <p className={`${UI} text-read max-w-prose mt-1`}>
            The index series could not be read, so no beta is measured here: {indexError}
          </p>
        )}
        <ul className={`${UI} text-quiet mt-2 space-y-2`}>
          {card.beta.estimates.map((e) => (
            <li key={e.label} data-coc-beta={e.frequency}>
              <span className="text-ink">{e.label}</span>
              {': '}
              {e.missing
                ? e.missing
                : `raw ${e.raw!.toFixed(3)}, Blume-adjusted ${e.adjusted!.toFixed(3)} — ${e.observations} returns, ` +
                  `R² ${(e.r2! * 100).toFixed(1)}%, standard error ${
                    e.standardError === null ? '—' : e.standardError.toFixed(3)
                  }, ${e.from} to ${e.to}`}
              {/* THE CAUTION IS A WARNING WHERE THE FIT IS WEAK, not a
                  parenthesis. A reader about to put this figure into the model
                  has to meet the reason not to in the same glance as the
                  button that does it (rule 4's diagnostics, put to use). */}
              {!e.weak && e.caution ? ` (${e.caution})` : ''}
              {e.missing || e.raw === null ? null : (
                <span className="ml-2 inline-flex items-center gap-1.5">
                  {([
                    ['raw', e.raw] as const,
                    ['adjusted', e.adjusted!] as const,
                  ]).map(([which, value]) => (
                    <button
                      key={which}
                      type="button"
                      onClick={() => setEdits((x) => ({ ...x, beta: value }))}
                      data-coc-use-beta={`${e.frequency}-${which}`}
                      title={`Value this company on a beta of ${value.toFixed(3)}`}
                      className={`${EYEBROW} border px-2 py-0.5 transition-colors cursor-pointer ${
                        card.beta.used !== null && Math.abs(card.beta.used - value) < 5e-7
                          ? 'border-accent-text text-ink'
                          : 'border-line text-muted hover:text-ink'
                      }`}
                    >
                      use {value.toFixed(3)}
                    </button>
                  ))}
                </span>
              )}
              {e.weak && e.caution ? (
                <p className={`${UI} text-read mt-1 max-w-prose`} data-coc-beta-weak={e.frequency}>
                  Careful: {e.caution}. On a fit this loose the figure moves the value a long way on very
                  little evidence.
                </p>
              ) : null}
            </li>
          ))}
          <li>{card.beta.bottomUp}</li>
        </ul>
        <p className={`${UI} text-read max-w-prose mt-3`} data-coc-beta-choice={card.beta.choice}>
          The model is using{' '}
          <span className="text-ink">
            {card.beta.used === null ? 'no beta' : card.beta.used.toFixed(3)}
          </span>
          {card.beta.relevered && card.beta.asset !== null
            ? ` — an asset beta of ${card.beta.asset.toFixed(2)} relevered onto this company's own borrowings`
            : ''}
          {card.beta.choice === 'default'
            ? ', not the measured figure above. The default stays the asset beta of 1.0 because across the ' +
              'companies that have a measured beta, switching to the slope moves the value per share by a ' +
              'median 2% and by as much as 515% where the fit explains almost nothing. Put a measured ' +
              'figure into the model for this company with the buttons above.'
            : `, which you chose on this card: ${betaRow?.source?.method ?? 'a figure set here'}. ` +
              'Reset the beta row to put the engine’s default back.'}
        </p>
        {card.beta.warning && (
          <p className={`${UI} text-read max-w-prose mt-1`} data-coc-beta-warning>
            {card.beta.warning}
          </p>
        )}
      </div>

      {/* ---- what the inputs produce ----------------------------------- */}
      <div className="mt-5 border-t border-line pt-4">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <div>
            <div className={`${EYEBROW} text-quiet`}>Value per share at these inputs</div>
            <div className="font-display text-[22px] leading-none font-semibold text-ink mt-1.5" data-coc-value="valuePerShare">
              {card.valuePerShare === null
                ? '—'
                : `${symbol}${card.valuePerShare.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`}
            </div>
          </div>
          {onDefaults && onDefaults.valuePerShare !== null && card.valuePerShare !== null && (
            <div>
              <div className={`${EYEBROW} text-quiet`}>On the defaults</div>
              <div className={`${UI} text-read mt-2`} data-coc-value="valueOnDefaults">
                {`${symbol}${onDefaults.valuePerShare.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`}
                {' · '}
                {`${(((card.valuePerShare - onDefaults.valuePerShare) / Math.abs(onDefaults.valuePerShare)) * 100).toFixed(1)}%`}
              </div>
            </div>
          )}
        </div>
        <p className={`${UI} text-quiet mt-2 max-w-prose`}>{card.valueNote}</p>
      </div>
    </section>
  );
};

export default CostOfCapitalCard;
