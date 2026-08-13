// FILE: src/components/compsPanel.tsx
//
// Marginalia — comparable companies
//
// The cross-check on the discounted cash flow. The DCF says what the business
// is worth on its own cash; the peer set says what the market is paying for
// businesses like it right now. Both are shown, and where they disagree that is
// left visible rather than reconciled away.
//
// The implied value is worked out the same way an analyst would: take the peer
// median EV/EBITDA, apply it to this company's own EBITDA, subtract net debt,
// divide by the share count. Every step is printed so it can be followed.

import React, { useEffect, useState } from 'react';

interface Peer {
  symbol: string;
  name: string;
  marketCap: number | null;
  enterpriseValue: number | null;
  evToEbitda: number | null;
  evToSales: number | null;
  priceToEarnings: number | null;
}

interface CompsResponse {
  peers: Peer[];
  subject?: Peer | null;
  medians: {
    evToEbitda?: number | null;
    evToSales?: number | null;
    priceToEarnings?: number | null;
  };
  message?: string;
  note?: string;
}

interface Props {
  ticker: string;
  companyName: string;
  currencySymbol: string;
  /** This company's own last forecast-year EBITDA, from the model. */
  ebitda: number | null;
  netDebt: number | null;
  dilutedShares: number | null;
  dcfValuePerShare: number | null;
}

export const CompsPanel: React.FC<Props> = ({
  ticker,
  companyName,
  currencySymbol,
  ebitda,
  netDebt,
  dilutedShares,
  dcfValuePerShare,
}) => {
  const [data, setData] = useState<CompsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setData(null);
    fetch(`/api/comps?ticker=${encodeURIComponent(ticker)}`)
      .then((r) => r.json())
      .then((body) => {
        if (!cancelled) setData(body);
      })
      .catch(() => {
        if (!cancelled) setData({ peers: [], medians: {}, message: 'Comparable companies could not be fetched.' });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  const isNum = (v: any): v is number => typeof v === 'number' && isFinite(v);
  const money = (v: any, dp = 0) =>
    isNum(v)
      ? `${currencySymbol}${v.toLocaleString(undefined, {
          minimumFractionDigits: dp,
          maximumFractionDigits: dp,
        })}`
      : '—';
  const mult = (v: any) => (isNum(v) ? `${v.toFixed(1)}x` : '—');

  const medianEbitdaMultiple = data?.medians?.evToEbitda ?? null;
  const impliedPerShare =
    isNum(medianEbitdaMultiple) && isNum(ebitda) && isNum(netDebt) && isNum(dilutedShares) && dilutedShares > 0
      ? (medianEbitdaMultiple * ebitda - netDebt) / dilutedShares
      : null;

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

      {!loading && data && data.peers.length === 0 && (
        <p className="text-[14px] text-[#8A8A8F]">
          {data.message || 'No comparable companies could be identified for this ticker.'}
        </p>
      )}

      {!loading && data && data.peers.length > 0 && (
        <>
          <div className="overflow-x-auto mb-6">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr className="border-b border-[#222228]">
                  {['Company', 'EV / EBITDA', 'EV / Sales', 'P / E'].map((h, i) => (
                    <th
                      key={h}
                      className={`font-mono text-[12px] tracking-[0.15em] text-[#8A8A8F] uppercase pb-3 px-3 ${
                        i === 0 ? 'text-left' : 'text-right'
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.subject && (
                  <tr className="border-b border-[#222228] bg-[#8B1E1E]/10">
                    <td className="py-2.5 px-3 text-[14px] text-[#F2F0EA]">
                      {companyName}
                      <span className="ml-2 font-mono text-[12px] text-[#8A8A8F]">this company</span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-[14px] text-[#F2F0EA]">{mult(data.subject.evToEbitda)}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-[14px] text-[#F2F0EA]">{mult(data.subject.evToSales)}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-[14px] text-[#F2F0EA]">{mult(data.subject.priceToEarnings)}</td>
                  </tr>
                )}
                {data.peers.map((peer) => (
                  <tr key={peer.symbol} className="border-b border-[#222228]/60">
                    <td className="py-2.5 px-3 text-[14px] text-[#A1A1AA]">
                      {peer.name}
                      <span className="ml-2 font-mono text-[12px] text-[#8A8A8F]">{peer.symbol}</span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-[14px] text-[#A1A1AA]">{mult(peer.evToEbitda)}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-[14px] text-[#A1A1AA]">{mult(peer.evToSales)}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-[14px] text-[#A1A1AA]">{mult(peer.priceToEarnings)}</td>
                  </tr>
                ))}
                <tr className="border-t border-[#222228]">
                  <td className="py-3 px-3 text-[14px] text-[#F2F0EA] font-semibold">Peer median</td>
                  <td className="py-3 px-3 text-right font-mono text-[14px] text-[#8B1E1E] font-semibold">{mult(data.medians.evToEbitda)}</td>
                  <td className="py-3 px-3 text-right font-mono text-[14px] text-[#8B1E1E] font-semibold">{mult(data.medians.evToSales)}</td>
                  <td className="py-3 px-3 text-right font-mono text-[14px] text-[#8B1E1E] font-semibold">{mult(data.medians.priceToEarnings)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {impliedPerShare !== null && (
            <div className="border border-[#222228] bg-[#0B0B0D] p-5 mb-6">
              <div className="font-mono text-[12px] tracking-[0.2em] text-[#8A8A8F] uppercase mb-3">
                What the peer multiple implies for {companyName}
              </div>
              {[
                ['Peer median EV / EBITDA', mult(medianEbitdaMultiple)],
                ['This company\u2019s final forecast year EBITDA', money(ebitda)],
                ['Implied enterprise value', money((medianEbitdaMultiple as number) * (ebitda as number))],
                [isNum(netDebt) && netDebt < 0 ? 'Plus net cash' : 'Less net debt', money(Math.abs(netDebt as number))],
                ['Implied value per share', money(impliedPerShare, 2)],
                ['For comparison, the discounted cash flow', money(dcfValuePerShare, 2)],
              ].map(([k, v], i, arr) => (
                <div
                  key={String(k)}
                  className={`flex flex-wrap items-baseline justify-between gap-4 py-2 ${
                    i < arr.length - 1 ? 'border-b border-[#222228]/60' : ''
                  }`}
                >
                  <span className={`text-[14px] ${i >= arr.length - 2 ? 'text-[#F2F0EA]' : 'text-[#8A8A8F]'}`}>{k}</span>
                  <span
                    className={`font-mono text-[14px] ${
                      i === arr.length - 2 ? 'text-[#8B1E1E] font-semibold' : 'text-[#F2F0EA]'
                    }`}
                  >
                    {v}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="text-[13px] leading-relaxed text-[#8A8A8F] space-y-2 max-w-2xl">
            <p>
              <span className="text-[#F2F0EA]">Read this carefully.</span> The
              peer set is the one the data source associates with this company,
              not a comp set an analyst has chosen. A proper comp set is argued
              for company by company, and this is a starting point for that
              argument rather than a substitute for it.
            </p>
            <p>
              The multiples are trailing, not forward. Analysts usually compare
              on forward estimates; those are not available from a free source,
              and a trailing multiple flatters a company whose earnings are about
              to fall.
            </p>
            <p>
              Median rather than average, because one peer on an extreme multiple
              would drag an average somewhere no company in the set actually
              trades.
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default CompsPanel;