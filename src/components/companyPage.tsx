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

import React, { useMemo, useRef } from 'react';
import { ArrowRight, ExternalLink } from 'lucide-react';
import { COMPANY_TABS, type CompanyTab } from '../data/companyRoute';
import { overviewStats, formatStat, filingLabel } from '../data/companyOverview';
import { PriceChart } from './priceChart';
import { FinancialsTab } from './financialsTab';
import { CostOfCapitalCard } from './costOfCapitalCard';
import { Hint, HINT_STYLES } from './figuresHint';
import { EYEBROW, UI, BODY, MetricTile, RefStrip, Pill, Disclose } from './instrument';
import { StaleFigures } from './staleFigures';

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

/** 30 Oct 2026, the one date format on the tab (COMPANY_OVERVIEW L8). */
// Three letters for every month: en-GB writes "Sept", which is not the format.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDate = (d: Date) => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;

/**
 * THE STAMP (COMPANY_OVERVIEW §1.4): when the price closed, in UTC, and which
 * statements are shown. The only freshness text in the header — no clock,
 * no seconds, no live dot.
 */
export function headerStamp(payload: any, filing: { fiscalYear: number | null; periodEnd: string | null } | null): { prices: string; statements: string } {
  const asOf = typeof payload?.quote?.asOf === 'string' ? payload.quote.asOf : null;
  let prices = 'not recorded';
  if (asOf) {
    const d = new Date(asOf.length <= 10 ? `${asOf}T00:00:00Z` : asOf);
    if (!isNaN(d.getTime())) {
      const time = asOf.length > 10 ? `, ${d.toISOString().slice(11, 16)} UTC` : '';
      prices = `close ${shortDate(d)}${time}`;
    }
  }
  let statements = 'not recorded';
  if (filing && (filing.fiscalYear || filing.periodEnd)) {
    const year = filing.fiscalYear ? `FY${filing.fiscalYear}` : 'the last filed year';
    const end = filing.periodEnd ? new Date(`${filing.periodEnd}T00:00:00Z`) : null;
    statements = end && !isNaN(end.getTime()) ? `${year}, ended ${shortDate(end)}` : year;
  }
  return { prices, statements };
}

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
  const exchange = payload?.listing?.exchangeName || payload?.listing?.exchange || payload?.quote?.exchange || '';
  const sector = payload?.profile?.sector || payload?.sector || payload?.sicDescription || '';
  const stamp = headerStamp(payload, overview?.filing ?? null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  return (
    <div className="min-h-screen bg-page pt-20 sm:pt-[88px] pb-16" data-company-page>
      <style>{HINT_STYLES}</style>
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
        {/* ---- who this is, and the tabs (COMPANY_OVERVIEW §1.4–1.5; job 9.9)
            One panel: the ticker and its exchange in muted (never oxblood),
            the name on the Title step, sector and currency, and the stamp;
            then, inside the same panel under a 1px divider, the tab row. */}
        <header data-company-header className="border border-line bg-panel">
          <div className="px-4 py-4 sm:px-6 sm:py-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-6">
            <div className="min-w-0">
              <div data-company-ticker className="text-[13px] leading-[18px] font-semibold text-muted">
                {ticker}
                {exchange ? ` · ${exchange}` : ''}
              </div>
              <h1
                className="mt-1 font-display font-semibold text-ink leading-[1.2]"
                style={{ fontSize: 'var(--m-size-title)', letterSpacing: '-0.015em', wordSpacing: '0.04em' }}
              >
                {name}
              </h1>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] leading-[18px]">
                <span>
                  <span className="text-quiet">Sector</span> <span className="text-read">{sector || 'not reported'}</span>
                </span>
                <span>
                  <span className="text-quiet">Currency</span> <span className="text-read">{payload?.currency || 'not reported'}</span>
                </span>
              </div>
            </div>
            {payload && (
              <div data-company-stamp className="text-[13px] leading-[18px] sm:text-right shrink-0">
                <div>
                  <span className="text-quiet">Prices:</span> <span className="text-read">{stamp.prices}</span>
                </div>
                <div>
                  <span className="text-quiet">Statements:</span> <span className="text-read">{stamp.statements}</span>
                </div>
              </div>
            )}
          </div>

          {/* ---- the tabs, each one an address ----------------------------
              role=tablist with manual activation: the arrows, Home and End
              move focus, Enter or Space selects. 48px high; the current tab
              ink 600 with a 2px accent rule flush with the panel's foot (the
              only accent here, uncounted); each label reserves its 600-weight
              width so the row never shifts. On a phone the row scrolls inside
              itself and the next tab shows clipped. */}
          <nav aria-label="Company sections" className="border-t border-line">
            <div
              role="tablist"
              aria-label="Company sections"
              className="flex overflow-x-auto snap-x snap-proximity [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {COMPANY_TABS.map((t, i) => {
                const current = t.slug === tab;
                return (
                  <button
                    key={t.slug}
                    type="button"
                    role="tab"
                    ref={(el) => { tabRefs.current[i] = el; }}
                    data-tab={t.slug}
                    aria-selected={current}
                    aria-current={current ? 'page' : undefined}
                    tabIndex={current ? 0 : -1}
                    onClick={() => onTab(t.slug)}
                    onKeyDown={(e) => {
                      const n = COMPANY_TABS.length;
                      const to =
                        e.key === 'ArrowRight' ? (i + 1) % n :
                        e.key === 'ArrowLeft' ? (i - 1 + n) % n :
                        e.key === 'Home' ? 0 :
                        e.key === 'End' ? n - 1 : null;
                      if (to !== null) {
                        e.preventDefault();
                        tabRefs.current[to]?.focus();
                      }
                    }}
                    className={`relative shrink-0 snap-start h-12 min-w-11 px-4 text-[15px] whitespace-nowrap cursor-pointer transition-colors duration-[110ms] ${
                      current ? 'text-ink font-semibold' : 'text-muted hover:text-ink font-normal'
                    }`}
                  >
                    {/* The 600-weight width, reserved. */}
                    <span aria-hidden="true" data-label={t.label} className="invisible block h-0 overflow-hidden font-semibold after:content-[attr(data-label)]" />
                    {t.label}
                    {current && <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[2px] bg-accent" />}
                  </button>
                );
              })}
            </div>
          </nav>
        </header>

        {/* ---- how old these figures are, if that needs saying ------------
            Under the header on purpose: every tab below presents the same
            statements, so the warning belongs to the company and not to one
            screen of it (`KI-32`). */}
        <StaleFigures payload={payload} className="border-t-0" />

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

              {/* ---- risk and cost of capital, step 3 of the build order -- */}
              <CostOfCapitalCard payload={payload} ticker={ticker} />

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

          {/* ---- the statements, as filed, with the evidence behind them -- */}
          {!loading && !error && payload && active.slug === 'financials' && (
            <FinancialsTab payload={payload} ticker={ticker} />
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
