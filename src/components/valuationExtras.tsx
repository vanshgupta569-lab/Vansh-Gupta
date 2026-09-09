// FILE: src/components/valuationExtras.tsx
//
// Marginalia — the two panels that sit under the football field
//
//   MarketApproachPanel — the peer multiples, applied to this company's own
//                         reported figures, as a valuation in its own right
//   ImpliedByPrice      — the discounted cash flow run backwards: what the
//                         traded price is already assuming
//
// Both are deliberately compact. The football field above already carries the
// picture; these two carry the arithmetic behind two of its bars, and a reader
// who wants the full peer table has a button to it. Neither panel invents a
// figure: every number here is either read off the engine or printed as absent.

import React from 'react';
import type { MarketApproachResult } from '../data/marketApproach';
import type { ReverseDcfResult } from '../data/reverseDcf';

const isNum = (v: any): v is number => typeof v === 'number' && isFinite(v);

// ---------------------------------------------------------------------------
// MARKET APPROACH
// ---------------------------------------------------------------------------

interface MarketProps {
  result: MarketApproachResult | null;
  loading: boolean;
  currencySymbol: string;
  unitLabel: string;
  /** The "Comparable companies" button, passed in so it keeps its existing home. */
  children?: React.ReactNode;
}

export const MarketApproachPanel: React.FC<MarketProps> = ({
  result,
  loading,
  currencySymbol,
  unitLabel,
  children,
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

  return (
    <div className="border border-t-0 border-[#222228] bg-[#111114] px-5 sm:px-7 py-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <h3 className="font-serif text-lg sm:text-xl text-[#F2F0EA]">
          Market approach
        </h3>
        <span className="font-mono text-[12px] tracking-[0.2em] text-[#8A8A8F] uppercase">
          03 — what buyers pay
        </span>
      </div>

      <p className="text-[14px] leading-relaxed text-[#8A8A8F] max-w-2xl mb-5">
        The second of the three ways to value a company. A discounted cash flow
        asks what this business is worth on the cash it produces. This asks
        something different: what buyers are paying today for businesses like
        it. Neither answers the other, and where they disagree the gap is worth
        understanding rather than splitting.
      </p>

      {loading && (
        <p className="font-mono text-[13px] text-[#8A8A8F]">Finding the peer set…</p>
      )}

      {!loading && (!result || !result.available) && (
        <p className="text-[14px] leading-relaxed text-[#8A8A8F] max-w-2xl">
          {result?.message ||
            'No comparable companies could be identified for this ticker. A misleading peer set is worse than none, so nothing is shown.'}
        </p>
      )}

      {!loading && result && result.available && (
        <>
          <div className="overflow-x-auto -mx-5 sm:-mx-7 px-5 sm:px-7">
            <table className="w-full min-w-[560px] border-collapse tabular-nums">
              <thead>
                <tr className="border-b border-[#222228]">
                  <th className="text-left font-mono text-[11px] tracking-[0.15em] text-[#8A8A8F] uppercase pb-2.5 pr-4">
                    Multiple
                  </th>
                  <th className="text-right font-mono text-[11px] tracking-[0.15em] text-[#8A8A8F] uppercase pb-2.5 px-3">
                    Peer median
                  </th>
                  <th className="text-right font-mono text-[11px] tracking-[0.15em] text-[#8A8A8F] uppercase pb-2.5 px-3">
                    This company
                  </th>
                  <th className="text-right font-mono text-[11px] tracking-[0.15em] text-[#8A8A8F] uppercase pb-2.5 pl-3">
                    Value per share
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.multiples.map((m) => {
                  const absent = !isNum(m.perShare);
                  return (
                    <tr key={m.key} className="border-b border-[#222228]/60">
                      <td className="py-2.5 pr-4">
                        <span
                          className={`text-[15px] ${
                            absent ? 'text-[#8A8A8F]' : 'text-[#F2F0EA]'
                          }`}
                        >
                          {m.label}
                        </span>
                        {absent && m.absentBecause && (
                          <span className="block text-[13px] leading-snug text-[#8A8A8F] mt-0.5 max-w-md">
                            not used: {m.absentBecause}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-[15px] text-[#A1A1AA]">
                        {mult(m.median)}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span className="font-mono text-[15px] text-[#A1A1AA]">
                          {m.key === 'priceToEarnings' ? money(m.metric) : bulk(m.metric)}
                        </span>
                        <span className="block text-[12px] text-[#8A8A8F] mt-0.5">
                          {m.metricLabel}
                        </span>
                      </td>
                      <td
                        className={`py-2.5 pl-3 text-right font-mono text-[15px] ${
                          absent ? 'text-[#8A8A8F]' : 'text-[#F2F0EA]'
                        }`}
                      >
                        {isNum(m.perShare) ? money(m.perShare) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2 mt-5 pt-4 border-t border-[#222228]">
            <div>
              <div className="font-mono text-[11px] tracking-[0.15em] text-[#8A8A8F] uppercase">
                Market approach range
              </div>
              <div className="font-mono text-[17px] text-[#F2F0EA] tabular-nums mt-0.5">
                {money(result.low)} – {money(result.high)}
              </div>
            </div>
            <div>
              <div className="font-mono text-[11px] tracking-[0.15em] text-[#8A8A8F] uppercase">
                Midpoint
              </div>
              <div className="font-mono text-[17px] text-[#F2F0EA] tabular-nums mt-0.5">
                {money(result.mid)}
              </div>
            </div>
            <div>
              <div className="font-mono text-[11px] tracking-[0.15em] text-[#8A8A8F] uppercase">
                Peers used
              </div>
              <div className="font-mono text-[17px] text-[#F2F0EA] tabular-nums mt-0.5">
                {result.peerCount}
              </div>
            </div>
          </div>

          <p className="text-[13px] leading-relaxed text-[#8A8A8F] mt-4 max-w-2xl">
            Peer multiples are trailing, so they are applied to this company's
            last reported year
            {isNum(result.fiscalYear) ? ` (FY${result.fiscalYear})` : ''}, never to
            the forecast. Applying a trailing multiple to a forecast figure would
            count the same growth twice. Figures in {unitLabel}.
            {result.basis ? ` Peers matched on ${result.basis}.` : ''}
          </p>
        </>
      )}

      {children && <div className="mt-6">{children}</div>}
    </div>
  );
};

// ---------------------------------------------------------------------------
// REVERSE DCF
// ---------------------------------------------------------------------------

interface ImpliedProps {
  result: ReverseDcfResult | null;
  currencySymbol: string;
}

export const ImpliedByPrice: React.FC<ImpliedProps> = ({ result, currencySymbol }) => {
  if (!result) return null;

  const money = (v: any) =>
    isNum(v)
      ? `${currencySymbol}${v.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      : '—';
  const show = (v: number | null, unit: 'pct' | 'x') =>
    isNum(v) ? (unit === 'pct' ? `${v.toFixed(1)}%` : `${v.toFixed(1)}x`) : '—';

  return (
    <section id="implied" className="scroll-mt-24 border border-[#222228] bg-[#111114] p-5 sm:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <h2 className="font-serif text-xl sm:text-2xl text-[#F2F0EA]">
          What the price already assumes
        </h2>
        <span className="font-mono text-[12px] tracking-[0.2em] text-[#8A8A8F] uppercase">
          04 — the model, run backwards
        </span>
      </div>

      <p className="text-[15px] leading-relaxed text-[#8A8A8F] max-w-2xl mb-6">
        Everything above asks what this company is worth. This asks the question
        the other way round: what would have to be true for today's price to be
        right? It is the sharper question, because it does not ask you to accept
        any assumption of ours. It only shows the ones the market is already
        making. Nothing new is modelled here. The same engine is run again and
        again, searching for the input at which its answer equals the traded
        price of {money(result.marketPrice)}.
      </p>

      {!result.applicable && (
        <p className="text-[14px] leading-relaxed text-[#8A8A8F] max-w-2xl">
          {result.message}
        </p>
      )}

      {result.applicable && (
        <>
          <div className="overflow-x-auto -mx-5 sm:-mx-7 px-5 sm:px-7">
            <table className="w-full min-w-[560px] border-collapse tabular-nums">
              <thead>
                <tr className="border-b border-[#222228]">
                  <th className="text-left font-mono text-[11px] tracking-[0.15em] text-[#8A8A8F] uppercase pb-2.5 pr-4">
                    Assumption
                  </th>
                  <th className="text-right font-mono text-[11px] tracking-[0.15em] text-[#8A8A8F] uppercase pb-2.5 px-3">
                    This model assumes
                  </th>
                  <th className="text-right font-mono text-[11px] tracking-[0.15em] text-[#8A8A8F] uppercase pb-2.5 pl-3">
                    The price implies
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.figures.map((f) => (
                  <tr key={f.key} className="border-b border-[#222228]/60">
                    <td className="py-3 pr-4">
                      <span className="text-[15px] text-[#F2F0EA]">{f.label}</span>
                      <span className="block text-[13px] leading-snug text-[#8A8A8F] mt-0.5 max-w-md">
                        {f.outOfRange
                          ? `no value inside a defensible range makes the model agree with the price, ${f.method}`
                          : `${f.question} · ${f.method}`}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-[15px] text-[#A1A1AA]">
                      {show(f.base, f.unit)}
                    </td>
                    <td
                      className={`py-3 pl-3 text-right font-mono text-[15px] ${
                        f.outOfRange ? 'text-[#8A8A8F]' : 'text-[#F2F0EA]'
                      }`}
                    >
                      {f.outOfRange ? 'out of range' : show(f.implied, f.unit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-[13px] leading-relaxed text-[#8A8A8F] mt-5 max-w-2xl">
            Each line moves one assumption and leaves every other one where the
            model had it, so these are four separate answers to the same
            question, not a combination. Figures are given to one decimal place
            because that is the precision the model's own inputs work in.
            "Out of range" means no sensible value produced agreement. That is
            usually the sign that the price and the model are further apart than
            a single assumption can explain.
          </p>
        </>
      )}
    </section>
  );
};

export default { MarketApproachPanel, ImpliedByPrice };
