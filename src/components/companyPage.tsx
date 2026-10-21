// FILE: src/components/companyPage.tsx
//
// THE COMPANY PAGE: THE HUB (ROADMAP.md §13, docs/VISION.md §5b).
//
// One web address per company and per tab. Everything this site knows about a
// company reachable from one place, rather than a flow a reader walks once and
// cannot link anybody to.
//
// WHAT AN UNBUILT TAB SAYS, AND WHAT IT MUST NOT DO. Six of the nine tabs are
// not built. Each shows one line naming what it will carry, taken from
// `docs/VISION.md`, and nothing else — no greyed-out table, no sample figures,
// no empty state dressed as a company with no data. Standing decision 7:
// anything not built is labelled as being built. A mocked-up Ownership tab
// would be the most convincing lie on the site.
//
// WHY THE OVERVIEW DOES NOT WAIT FOR THE MODEL. Every figure on it is read
// straight from the filings and the quote (`src/data/companyOverview.ts`), so a
// company the engine refuses to value still gets a price, a market
// capitalisation, its multiples and its chart. The refusal belongs on the Model
// tab, where the valuation it refuses would have been.

import React, { useMemo } from 'react';
import { ArrowRight, ExternalLink } from 'lucide-react';
import { COMPANY_TABS, type CompanyTab } from '../data/companyRoute';
import { overviewStats, formatStat, filingLabel } from '../data/companyOverview';
import { PriceChart } from './priceChart';
import { Hint, HINT_STYLES } from './figuresHint';
import { EYEBROW, UI, BODY, MetricTile, RefStrip, Pill, Disclose } from './instrument';

interface Props {
  ticker: string;
  tab: string;
  payload: any | null;
  loading: boolean;
  error: string | null;
  onTab: (slug: string) => void;
  /** Into the existing figures → questions → valuation flow, unchanged. */
  onOpenModel: () => void;
  onRetry: () => void;
}

const when = (iso: string | null): string => {
  if (!iso) return 'not recorded';
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00Z` : iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
};

export const CompanyPage: React.FC<Props> = ({
  ticker,
  tab,
  payload,
  loading,
  error,
  onTab,
  onOpenModel,
  onRetry,
}) => {
  const active: CompanyTab = COMPANY_TABS.find((t) => t.slug === tab) ?? COMPANY_TABS[0];
  const overview = useMemo(() => (payload ? overviewStats(payload) : null), [payload]);
  const name = payload?.name || ticker;

  return (
    <div className="min-h-screen bg-page pt-28 sm:pt-24 lg:pt-28 pb-20">
      <style>{HINT_STYLES}</style>
      <div className="max-w-[1440px] mx-auto px-5 sm:px-6 lg:px-12">
        {/* ---- who this is ------------------------------------------------ */}
        <header className="border border-line bg-panel px-5 py-5 lg:px-6">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className={`${EYEBROW} text-accent-text`}>{ticker}</span>
            <h1 className="font-display text-[var(--m-size-title)] font-semibold leading-tight tracking-[-0.02em] text-ink">
              {name}
            </h1>
          </div>
          <div className="mt-2.5">
            <RefStrip
              items={[
                ['exch', payload?.listing?.exchangeName || payload?.listing?.exchange || payload?.quote?.exchange || '—'],
                ['sector', payload?.profile?.sector || payload?.sector || payload?.sicDescription || '—'],
                ['currency', payload?.currency || '—'],
              ]}
            />
          </div>
        </header>

        {/* ---- the tabs, each one an address ------------------------------ */}
        <nav
          aria-label="Company sections"
          className="flex overflow-x-auto border-x border-b border-line bg-panel"
        >
          {COMPANY_TABS.map((t) => (
            <button
              key={t.slug}
              type="button"
              onClick={() => onTab(t.slug)}
              aria-current={t.slug === tab ? 'page' : undefined}
              className={`${EYEBROW} shrink-0 border-r border-line px-4 py-3 transition-colors cursor-pointer whitespace-nowrap ${
                t.slug === tab
                  ? 'bg-page text-ink shadow-[inset_0_-2px_0_var(--m-accent)]'
                  : 'text-muted hover:text-ink hover:bg-page/40'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <main className="mt-6">
          {loading && (
            <div className="border border-line bg-panel px-5 py-10 text-center">
              <div className={`${EYEBROW} text-quiet mb-2`}>READING THE FILINGS</div>
              <p className={`${UI} text-read`}>Fetching {ticker} from its source.</p>
            </div>
          )}

          {!loading && error && (
            <div className="border border-line bg-panel px-5 py-8">
              <div className={`${EYEBROW} text-accent-text mb-2`}>NOTHING TO SHOW</div>
              <p className={`${BODY} text-read max-w-prose`}>{error}</p>
              <button
                type="button"
                onClick={onRetry}
                className={`${EYEBROW} mt-4 border border-line px-3.5 py-2 text-ink hover:border-quiet/60 transition-colors cursor-pointer`}
              >
                Try again
              </button>
            </div>
          )}

          {!loading && !error && payload && active.slug === 'overview' && overview && (
            <div className="space-y-8">
              {/* ---- the figures ---------------------------------------- */}
              <section aria-label="Summary figures">
                <div className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-4 border border-line">
                  {overview.stats.map((stat) => (
                    <MetricTile
                      key={stat.key}
                      label={stat.label}
                      value={formatStat(stat, overview.currencySymbol)}
                      note={stat.missing ? undefined : stat.note}
                      hint={
                        <Hint
                          label={stat.missing ? `Why ${stat.label} is not shown` : `How ${stat.label} is worked out`}
                          tone="quiet"
                        >
                          {stat.missing ? (
                            <p>{stat.missing}</p>
                          ) : (
                            <>
                              {stat.formula && (
                                <p>
                                  <span className="text-quiet">{stat.label} = </span>
                                  {stat.formula}
                                </p>
                              )}
                              {stat.note && <p className="mt-1.5">{stat.note}</p>}
                          {stat.caveat && <p className="mt-1.5">{stat.caveat}</p>}
                            </>
                          )}
                          <p className="mt-2 text-quiet">
                            {stat.source}
                            {stat.asOf ? `, as at ${when(stat.asOf)}` : ''}.
                          </p>
                        </Hint>
                      }
                    />
                  ))}
                </div>
              </section>

              {/* ---- the chart ------------------------------------------ */}
              <section aria-label="Price chart" className="border border-line bg-panel px-5 py-5 lg:px-6">
                <h2 className="font-display text-[var(--m-size-section)] font-semibold tracking-[-0.012em] text-ink mb-4">
                  Price
                </h2>
                <PriceChart payload={payload} currencySymbol={overview.currencySymbol} />
              </section>

              {/* ---- about ---------------------------------------------- */}
              {(payload.profile?.summary || payload.profile?.officers?.length) && (
                <section aria-label="About the company" className="border border-line bg-panel px-5 py-5 lg:px-6">
                  <h2 className="font-display text-[var(--m-size-section)] font-semibold tracking-[-0.012em] text-ink mb-3">
                    About {name}
                  </h2>
                  {payload.profile?.summary && (
                    <p className={`${BODY} text-read max-w-prose`}>{payload.profile.summary}</p>
                  )}
                  <div className="mt-4">
                    <RefStrip
                      items={[
                        ['industry', payload.profile?.industry || '—'],
                        ['country', payload.profile?.country || payload.listing?.country || '—'],
                        [
                          'employees',
                          typeof payload.profile?.employees === 'number'
                            ? payload.profile.employees.toLocaleString('en-US')
                            : '—',
                        ],
                      ]}
                    />
                  </div>
                  {payload.profile?.website && (
                    <a
                      href={payload.profile.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${UI} text-accent-text hover:text-ink transition-colors inline-flex items-center gap-1.5 mt-3`}
                    >
                      {payload.profile.website.replace(/^https?:\/\//, '')}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {payload.profile?.officers?.length > 0 && (
                    <div className="mt-4">
                      <Disclose summary={`Named officers (${payload.profile.officers.length})`}>
                        <ul className="space-y-1">
                          {payload.profile.officers.map((o: any) => (
                            <li key={`${o.name}${o.title}`}>
                              <span className="text-ink">{String(o.name || '').replace(/\s+/g, ' ').trim()}</span>
                              {o.title ? <span className="text-quiet"> &mdash; {o.title}</span> : null}
                            </li>
                          ))}
                        </ul>
                      </Disclose>
                    </div>
                  )}
                </section>
              )}

              {/* ---- where every block came from, and when --------------- */}
              <section aria-label="Data freshness" className="border border-line bg-panel px-5 py-5 lg:px-6">
                <h2 className="font-display text-[var(--m-size-section)] font-semibold tracking-[-0.012em] text-ink mb-3">
                  Where this came from
                </h2>
                <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
                  {overview.freshness.map((f) => (
                    <div key={f.block}>
                      <dt className={`${EYEBROW} text-quiet`}>{f.block}</dt>
                      <dd className={`${UI} text-read`}>
                        {f.source}
                        <span className="text-quiet"> &middot; {when(f.asOf)}</span>
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className={`${UI} text-quiet mt-4 max-w-prose`}>
                  The statements above are {filingLabel(overview.filing)} and the four years before it.
                  {payload.sourceUrl ? ' ' : ''}
                  {payload.sourceUrl && (
                    <a
                      href={payload.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent-text hover:text-ink transition-colors inline-flex items-center gap-1"
                    >
                      The filings themselves
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </p>
              </section>
            </div>
          )}

          {/* ---- the model tab opens the flow that already exists -------- */}
          {!loading && !error && payload && active.slug === 'model' && (
            <section className="border border-line bg-panel px-5 py-8 lg:px-6">
              <h2 className="font-display text-[var(--m-size-section)] font-semibold tracking-[-0.012em] text-ink">
                Build the model
              </h2>
              <p className={`${BODY} text-read max-w-prose mt-2`}>
                The figures as filed first, so they can be checked and corrected before anything is valued; then
                the questions the filings cannot answer; then the valuation, three approaches side by side.
              </p>
              <button
                type="button"
                onClick={onOpenModel}
                className={`${EYEBROW} mt-5 border px-4 py-2.5 text-ink transition-colors inline-flex items-center gap-2 cursor-pointer`}
                style={{ borderColor: '#8B1E1E', background: 'rgba(139,30,30,0.22)' }}
              >
                Open the figures for {ticker}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </section>
          )}

          {/* ---- a tab that is not built says exactly that --------------- */}
          {!loading && !error && !active.built && (
            <section className="border border-line bg-panel px-5 py-8 lg:px-6">
              <div className="flex items-center gap-2.5 mb-2">
                <h2 className="font-display text-[var(--m-size-section)] font-semibold tracking-[-0.012em] text-ink">
                  {active.label}
                </h2>
                <Pill tone="neutral">being built</Pill>
              </div>
              <p className={`${BODY} text-read max-w-prose`}>{active.coming}</p>
            </section>
          )}
        </main>
      </div>
    </div>
  );
};

export default CompanyPage;
