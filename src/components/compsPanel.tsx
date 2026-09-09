// FILE: src/components/compsPanel.tsx
//
// Marginalia — the market approach, in full
//
// The peer set is the entire argument. Every figure this screen produces rests
// on one judgement: which companies are genuinely comparable to this one? That
// judgement used to be made for the reader and shown as a finished answer. It
// is now made as a starting point, and handed over.
//
// So the screen has three parts:
//
//   1. THE PEER SET, which the reader can change. The site proposes up to five
//      from the companies the data source suggests, chosen by industry then
//      sector and ranked by closeness in size. Everything else it considered is
//      listed underneath, unticked, with the reason it was not chosen.
//   2. THE MULTIPLES, recomputed from whatever is ticked. The median moves as
//      the reader ticks, so the number on screen can never disagree with the
//      list above it.
//   3. THE WORKING, printed step by step, so the implied value can be followed
//      rather than taken on trust.
//
// The rule that a misleading peer set is worse than none survives all of this.
// When nothing clears the industry or sector test, nothing is ticked and the
// screen says so. What has changed is that the reader may now disagree, which
// is different from the site pretending it had an answer.

import React from 'react';
import type { MarketApproachResult } from '../data/marketApproach';

interface Props {
  companyName: string;
  currencySymbol: string;
  unitLabel: string;
  result: MarketApproachResult | null;
  loading: boolean;
  /** The symbols currently ticked. */
  selected: string[];
  onSelected: (next: string[]) => void;
  onReset: () => void;
  /** For comparison only: what the income approach says. */
  dcfValuePerShare: number | null;
  fiscalYear?: number | null;
}

const isNum = (v: any): v is number => typeof v === 'number' && isFinite(v);

export const CompsPanel: React.FC<Props> = ({
  companyName,
  currencySymbol,
  unitLabel,
  result,
  loading,
  selected,
  onSelected,
  onReset,
  dcfValuePerShare,
  fiscalYear,
}) => {
  const money = (v: any, dp = 2) =>
    isNum(v)
      ? `${currencySymbol}${v.toLocaleString(undefined, {
          minimumFractionDigits: dp,
          maximumFractionDigits: dp,
        })}`
      : '—';
  const bulk = (v: any) =>
    isNum(v) ? v.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—';
  const mult = (v: any) => (isNum(v) ? `${v.toFixed(1)}x` : '—');

  const candidates = result?.candidates ?? [];
  const toggle = (symbol: string) =>
    onSelected(
      selected.includes(symbol)
        ? selected.filter((s) => s !== symbol)
        : [...selected, symbol]
    );

  return (
    <div className="max-w-5xl">
      <h3 className="font-serif text-xl text-[#F2F0EA] mb-2">
        What the market pays for similar companies
      </h3>
      <p className="text-[14px] leading-relaxed text-[#A1A1AA] mb-6 max-w-2xl">
        A discounted cash flow asks what this business is worth on the cash it
        produces. A peer set asks something different: what buyers are paying
        today for businesses like it. Neither answers the other, and where they
        disagree the gap is worth understanding rather than splitting.
      </p>

      {loading && (
        <p className="font-mono text-[13px] text-[#8A8A8F]">Loading the peer set…</p>
      )}

      {!loading && !candidates.length && (
        <p className="text-[14px] leading-relaxed text-[#8A8A8F] max-w-2xl">
          {result?.message ||
            'No comparable companies could be identified for this ticker from the free sources available.'}
        </p>
      )}

      {!loading && candidates.length > 0 && (
        <>
          {/* ---------------- 1. THE PEER SET ---------------- */}
          <div className="flex flex-wrap items-baseline justify-between gap-3 mb-3">
            <h4 className="font-mono text-[12px] tracking-[0.2em] text-[#8A8A8F] uppercase">
              The peer set — tick the companies you consider comparable
            </h4>
            {result?.edited && (
              <button
                type="button"
                onClick={onReset}
                className="font-mono text-[11px] uppercase tracking-wider text-[#8A8A8F] hover:text-[#F2F0EA] border border-[#222228] hover:border-[#8A8A8F] px-3 py-1.5 transition-colors"
              >
                Reset to the site’s choice
              </button>
            )}
          </div>

          <div className="overflow-x-auto mb-2">
            <table className="w-full min-w-[720px] border-collapse tabular-nums">
              <thead>
                <tr className="border-b border-[#222228]">
                  <th className="text-left font-mono text-[11px] tracking-[0.15em] text-[#8A8A8F] uppercase pb-3 pr-3 w-10" />
                  <th className="text-left font-mono text-[11px] tracking-[0.15em] text-[#8A8A8F] uppercase pb-3 px-3">
                    Company
                  </th>
                  <th className="text-right font-mono text-[11px] tracking-[0.15em] text-[#8A8A8F] uppercase pb-3 px-3">
                    EV / EBITDA
                  </th>
                  <th className="text-right font-mono text-[11px] tracking-[0.15em] text-[#8A8A8F] uppercase pb-3 px-3">
                    EV / Sales
                  </th>
                  <th className="text-right font-mono text-[11px] tracking-[0.15em] text-[#8A8A8F] uppercase pb-3 px-3">
                    P / E
                  </th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((peer: any) => {
                  const on = selected.includes(peer.symbol);
                  return (
                    <tr
                      key={peer.symbol}
                      className={`border-b border-[#222228]/60 cursor-pointer transition-colors ${
                        on ? 'bg-[#8B1E1E]/10' : 'hover:bg-[#18181c]'
                      }`}
                      onClick={() => toggle(peer.symbol)}
                    >
                      <td className="py-2.5 pr-3 align-top">
                        <span
                          className={`inline-block w-3.5 h-3.5 border ${
                            on
                              ? 'bg-[#8B1E1E] border-[#8B1E1E]'
                              : 'border-[#8A8A8F]'
                          }`}
                          aria-hidden="true"
                        />
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => toggle(peer.symbol)}
                          onClick={(e) => e.stopPropagation()}
                          className="sr-only"
                          aria-label={`Include ${peer.name || peer.symbol} in the peer set`}
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`text-[14px] ${on ? 'text-[#F2F0EA]' : 'text-[#A1A1AA]'}`}>
                          {peer.name || peer.symbol}
                        </span>
                        <span className="ml-2 font-mono text-[12px] text-[#8A8A8F]">
                          {peer.symbol}
                        </span>
                        <span className="block font-mono text-[11px] text-[#8A8A8F] mt-0.5">
                          {peer.matchesIndustry
                            ? `same industry · ${peer.industry}`
                            : peer.matchesSector
                            ? `same sector only · ${peer.industry || peer.sector}`
                            : `different business · ${peer.industry || peer.sector || 'not classified'}`}
                        </span>
                      </td>
                      <td className={`py-2.5 px-3 text-right font-mono text-[14px] ${on ? 'text-[#F2F0EA]' : 'text-[#8A8A8F]'}`}>
                        {mult(peer.evToEbitda)}
                      </td>
                      <td className={`py-2.5 px-3 text-right font-mono text-[14px] ${on ? 'text-[#F2F0EA]' : 'text-[#8A8A8F]'}`}>
                        {mult(peer.evToSales)}
                      </td>
                      <td className={`py-2.5 px-3 text-right font-mono text-[14px] ${on ? 'text-[#F2F0EA]' : 'text-[#8A8A8F]'}`}>
                        {mult(peer.priceToEarnings)}
                      </td>
                    </tr>
                  );
                })}

                <tr className="border-t border-[#222228]">
                  <td />
                  <td className="py-3 px-3 text-[14px] text-[#F2F0EA] font-semibold">
                    Median of the {selected.length} selected
                  </td>
                  {(['evToEbitda', 'evToSales', 'priceToEarnings'] as const).map((k) => {
                    const m = result?.multiples.find((x) => x.key === k);
                    return (
                      <td
                        key={k}
                        className="py-3 px-3 text-right font-mono text-[14px] text-[#8B1E1E] font-semibold"
                      >
                        {mult(m?.median)}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>

          <p className="text-[13px] leading-relaxed text-[#8A8A8F] max-w-2xl mb-8">
            The site ticks the companies in the same industry, or the same
            sector where an industry match is not available, ranked by closeness
            in size. A lender is never offered as a peer for a manufacturer.
            Everything else the data source suggested is listed so you can
            disagree. The median moves as you tick.
          </p>

          {/* ---------------- 2. THE WORKING ---------------- */}
          {result?.available ? (
            <>
              <h4 className="font-mono text-[12px] tracking-[0.2em] text-[#8A8A8F] uppercase mb-3">
                What that implies for {companyName}
              </h4>

              <div className="border border-[#222228] bg-[#0B0B0D] mb-6">
                {result.multiples.map((m) => (
                  <div key={m.key} className="border-b border-[#222228] last:border-0 p-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-3 mb-2">
                      <span className="text-[15px] text-[#F2F0EA]">{m.label}</span>
                      <span className="font-mono text-[17px] text-[#F2F0EA] tabular-nums">
                        {isNum(m.perShare) ? money(m.perShare) : '—'}
                      </span>
                    </div>
                    {isNum(m.perShare) ? (
                      <div className="font-mono text-[13px] text-[#8A8A8F] leading-relaxed">
                        {mult(m.median)} ×{' '}
                        {m.key === 'priceToEarnings' ? money(m.metric) : bulk(m.metric)}{' '}
                        {m.metricLabel}
                        {m.key === 'priceToEarnings' ? '' : ', less net debt, ÷ diluted shares'}
                      </div>
                    ) : (
                      <div className="text-[13px] text-[#8A8A8F] leading-relaxed">
                        not used: {m.absentBecause}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-baseline gap-x-10 gap-y-3 border-t border-[#222228] pt-5 mb-6">
                <div>
                  <div className="font-mono text-[11px] tracking-[0.15em] text-[#8A8A8F] uppercase">
                    Market approach range
                  </div>
                  <div className="font-mono text-[18px] text-[#F2F0EA] tabular-nums mt-0.5">
                    {money(result.low)} – {money(result.high)}
                  </div>
                </div>
                <div>
                  <div className="font-mono text-[11px] tracking-[0.15em] text-[#8A8A8F] uppercase">
                    Midpoint
                  </div>
                  <div className="font-mono text-[18px] text-[#8B1E1E] tabular-nums mt-0.5">
                    {money(result.mid)}
                  </div>
                </div>
                <div>
                  <div className="font-mono text-[11px] tracking-[0.15em] text-[#8A8A8F] uppercase">
                    For comparison, the income approach
                  </div>
                  <div className="font-mono text-[18px] text-[#F2F0EA] tabular-nums mt-0.5">
                    {money(dcfValuePerShare)}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <p className="text-[14px] leading-relaxed text-[#8A8A8F] max-w-2xl mb-6">
              {result?.message}
            </p>
          )}

          {/* ---------------- 3. THE LIMITS ---------------- */}
          <div className="text-[13px] leading-relaxed text-[#8A8A8F] space-y-2 max-w-2xl border-t border-[#222228] pt-5">
            <p>
              <span className="text-[#F2F0EA]">Read this carefully.</span> These
              companies were suggested by the data source and filtered by
              industry and size. That is a reasonable starting point, not a peer
              set an analyst has argued for company by company. You are better
              placed than the filter to judge which of them really competes
              with {companyName}
            </p>
            <p>
              The multiples are trailing, not forward, so they are applied to
              the last reported year
              {isNum(fiscalYear) ? ` (FY${fiscalYear})` : ''} rather than to the
              forecast. Applying a trailing multiple to a forecast figure counts
              the same growth twice. Analysts usually compare on forward
              estimates; those are not available from a free source, and a
              trailing multiple flatters a company whose earnings are about to
              fall.
            </p>
            <p>
              Median rather than average, because one peer on an extreme
              multiple would drag an average somewhere no company in the set
              actually trades. Money figures in {unitLabel}.
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default CompsPanel;
