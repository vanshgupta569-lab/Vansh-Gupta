// FILE: src/components/valuationSections.tsx
// Marginalia — valuation range and ratio sections
//
// Two blocks that sit under the header on the company screen:
//
//   FootballField — every value the model produces, side by side, against the
//                   price the shares actually trade at
//   RatioBand     — the ratios, reported years and forecast years, each with
//                   the formula that produced it
//
// Neither invents anything. The football field draws only bars the engine
// computed; the ratio band prints only ratios that could be worked out from
// what the filing gave us, and leaves the rest off the screen rather than
// filling them with zeroes.

import React, { useMemo, useState } from 'react';
import { ValuationBand } from '../data/companies';
import { RATIO_DEFINITIONS } from '../data/ratios.js';

// ---------------------------------------------------------------------------
// FOOTBALL FIELD
// ---------------------------------------------------------------------------

// A bar can come from any of the three approaches to value, plus one bar that
// is not a valuation at all. The variant decides how it is drawn, so a reader
// can tell at a glance which bars are this model's own work and which are the
// market's. Oxblood is reserved for the income approach; the market approach
// gets the paper colour; anything that is only there for reference stays grey.
export interface FieldBand extends ValuationBand {
  variant?: 'income' | 'market' | 'asset' | 'reference';
}

interface FootballFieldProps {
  bands: FieldBand[];
  marketPrice: number;
  fiftyTwoWeekHigh?: number | null;
  fiftyTwoWeekLow?: number | null;
  currencySymbol: string;
}

export const FootballField: React.FC<FootballFieldProps> = ({
  bands,
  marketPrice,
  fiftyTwoWeekHigh,
  fiftyTwoWeekLow,
  currencySymbol,
}) => {
  // The 52-week range is a fact about the market, not an output of the model,
  // so it is drawn in a different colour and labelled as such. It is included
  // because a valuation that sits far outside the range the shares have
  // actually traded in is worth noticing.
  const rows: FieldBand[] = useMemo(() => {
    const out: FieldBand[] = [...bands];
    if (
      typeof fiftyTwoWeekLow === 'number' &&
      typeof fiftyTwoWeekHigh === 'number' &&
      fiftyTwoWeekHigh > fiftyTwoWeekLow
    ) {
      out.push({
        label: '52-week trading range',
        low: fiftyTwoWeekLow,
        high: fiftyTwoWeekHigh,
        point: marketPrice,
        detail: 'where the shares have actually traded',
        variant: 'reference',
      });
    }
    return out;
  }, [bands, fiftyTwoWeekHigh, fiftyTwoWeekLow, marketPrice]);

  const scale = useMemo(() => {
    const values: number[] = [marketPrice];
    for (const row of rows) values.push(row.low, row.high);
    const usable = values.filter((v) => typeof v === 'number' && isFinite(v) && v > 0);
    if (usable.length < 2) return null;

    const rawMin = Math.min(...usable);
    const rawMax = Math.max(...usable);
    const pad = Math.max((rawMax - rawMin) * 0.12, rawMax * 0.02);
    const min = Math.max(0, rawMin - pad);
    const max = rawMax + pad;
    return { min, max, span: max - min };
  }, [rows, marketPrice]);

  if (!rows.length || !scale) return null;

  const pos = (value: number) =>
    Math.min(100, Math.max(0, ((value - scale.min) / scale.span) * 100));

  const fmt = (value: number) =>
    `${currencySymbol}${value.toLocaleString(undefined, {
      maximumFractionDigits: value >= 1000 ? 0 : 2,
    })}`;

  return (
    <section className="border border-[#222228] bg-[#111114] p-5 sm:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <h2 className="font-serif text-xl sm:text-2xl text-[#F2F0EA]">
          Football field
        </h2>
        <span className="font-mono text-[12px] tracking-[0.2em] text-[#8A8A8F] uppercase">
          02 — valuation range
        </span>
      </div>

      <p className="text-[15px] leading-relaxed text-[#8A8A8F] max-w-2xl mb-7">
        The standard way an analyst lays out every value a company could be
        worth, side by side, against what it actually trades at. The oxblood
        bars are the income approach, this model's own discounted cash flow.
        The pale solid bar is the market approach, taken from what buyers pay
        for comparable companies. The dashed bar is the asset approach, a floor
        rather than an estimate. The grey bar is not a valuation at all, only
        the range the shares have traded in. There is no confidence interval here
        and no forecast of the share price: the width of a bar is the range its
        own method gives when its main assumption is moved, nothing more.
      </p>

      {/* One vertical line for the market price, drawn across every bar. It has
          to span the whole chart: a reader needs to see, at a glance, which
          bars the traded price falls inside and which it does not. Drawn as an
          overlay on the same 0-100% scale the bars use, so it lines up. */}
      <div className="relative">
        <div
          className="pointer-events-none absolute top-0 bottom-0 w-px bg-[#F2F0EA]/70 z-10"
          style={{ left: `${pos(marketPrice)}%` }}
        />

        <div className="space-y-6">
          {rows.map((row) => {
            const left = pos(row.low);
            const right = pos(row.high);
            const width = Math.max(right - left, 0.6);
            const pointPos = pos(row.point);
            const containsPrice = marketPrice >= row.low && marketPrice <= row.high;
            const isReference = row.variant === 'reference';
            // A method can produce one figure rather than a range: the asset
            // approach often has a single surviving measure. Drawing that as a
            // rectangle 0.6% wide looks like a rendering fault, so a single
            // value is drawn as a tick. The shape carries the meaning: a bar is
            // a range, a tick is one number.
            const isPoint = right - left < 0.9;
            const barTone =
              row.variant === 'reference'
                ? 'bg-[#8A8A8F]/8 border-[#8A8A8F]/30'
                : row.variant === 'market'
                ? 'bg-[#F2F0EA]/14 border-[#F2F0EA]/75'
                : row.variant === 'asset'
                // Dashed, because this bar is a floor rather than an estimate.
                // The broken edge says "boundary" where a solid one would say
                // "answer", and that is exactly the difference.
                ? 'bg-[#F2F0EA]/5 border-[#F2F0EA]/45 border-dashed'
                : 'bg-[#8B1E1E]/25 border-[#8B1E1E]/60';

            return (
              <div key={row.label}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 mb-2">
                  <span className="font-mono text-[13px] tracking-wider text-[#F2F0EA] uppercase">
                    {row.label}
                  </span>
                  <span className="font-mono text-[13px] text-[#8A8A8F]">
                    {isPoint ? fmt(row.point) : `${fmt(row.low)} – ${fmt(row.high)}`}
                  </span>
                </div>

                <div className="relative h-7">
                  <div className="absolute inset-y-0 left-0 right-0 flex items-center">
                    <div className="h-px w-full bg-[#222228]" />
                  </div>

                  {isPoint ? (
                    <div
                      className={`absolute inset-y-0 w-[3px] ${
                        row.variant === 'asset'
                          ? 'bg-[#F2F0EA]/70'
                          : row.variant === 'market'
                          ? 'bg-[#F2F0EA]/85'
                          : 'bg-[#8B1E1E]'
                      }`}
                      style={{ left: `${left}%` }}
                    />
                  ) : (
                    <div
                      className={`absolute inset-y-1 border ${barTone}`}
                      style={{ left: `${left}%`, width: `${width}%` }}
                    />
                  )}

                  {!isReference && !isPoint && (
                    <div
                      className="absolute inset-y-0 w-px bg-[#F2F0EA]/40"
                      style={{ left: `${pointPos}%` }}
                      title={`base case ${fmt(row.point)}`}
                    />
                  )}
                </div>

                <div className="font-mono text-[12px] text-[#8A8A8F] mt-1.5 tracking-wide">
                  {row.detail}
                  {!isReference && !isPoint && ` · base case ${fmt(row.point)}`}
                  <span className="ml-2 text-[#8A8A8F]">
                    · market price sits {containsPrice ? 'inside' : marketPrice > row.high ? 'above' : 'below'} this range
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* The scale, with the market price labelled directly under its line. */}
      <div className="relative mt-6 pt-4 border-t border-[#222228]">
        <div className="flex justify-between font-mono text-[12px] text-[#8A8A8F]">
          <span>{fmt(scale.min)}</span>
          <span>{fmt(scale.max)}</span>
        </div>
        <div
          className="absolute top-4 font-mono text-[12px] text-[#F2F0EA] whitespace-nowrap"
          style={{
            left: `${Math.min(88, Math.max(12, pos(marketPrice)))}%`,
            transform: 'translateX(-50%)',
          }}
        >
          market price {fmt(marketPrice)}
        </div>
      </div>

    </section>
  );
};

// ---------------------------------------------------------------------------
// RATIO BAND
// ---------------------------------------------------------------------------

interface RatioPeriod {
  label: string;
  fiscalYear: number;
  forecast?: boolean;
  ratios: Record<string, { value: number | null; display: string | null }>;
}

interface RatioBandProps {
  reported: { periods: RatioPeriod[]; applicable: Record<string, boolean> };
  forecast: { periods: RatioPeriod[]; applicable: Record<string, boolean> };
}

export const RatioBand: React.FC<RatioBandProps> = ({ reported, forecast }) => {
  const [openFormula, setOpenFormula] = useState<string | null>(null);

  const periods = useMemo(
    () => [...reported.periods, ...forecast.periods],
    [reported.periods, forecast.periods]
  );

  // A ratio that never computed for this company is left off the screen
  // entirely. A software company has no inventory days; showing a row of
  // dashes would imply the figure exists and we failed to find it.
  const definitions = useMemo(
    () =>
      RATIO_DEFINITIONS.filter(
        (d: any) => reported.applicable[d.key] || forecast.applicable[d.key]
      ),
    [reported.applicable, forecast.applicable]
  );

  if (!periods.length || !definitions.length) return null;

  const groups: string[] = [];
  for (const d of definitions as any[]) {
    if (!groups.includes(d.group)) groups.push(d.group);
  }

  const firstForecast = reported.periods.length;

  return (
    <section className="border border-[#222228] bg-[#111114] p-5 sm:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <h2 className="font-serif text-xl sm:text-2xl text-[#F2F0EA]">
          How the business actually runs
        </h2>
        <span className="font-mono text-[12px] tracking-[0.2em] text-[#8A8A8F] uppercase">
          01 — ratios
        </span>
      </div>

      <p className="text-[15px] leading-relaxed text-[#8A8A8F] max-w-2xl mb-6">
        Reported years come from the filings. Forecast years are read off the
        model's own schedules, so you can see whether the forecast quietly
        assumes the business gets better at collecting cash than it has ever
        been. Balances are year end. Tap any ratio name for its formula.
      </p>

      <div className="overflow-x-auto -mx-5 sm:-mx-7 px-5 sm:px-7">
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr className="border-b border-[#222228]">
              <th className="text-left font-mono text-[12px] tracking-[0.15em] text-[#8A8A8F] uppercase pb-3 pr-4">
                Ratio
              </th>
              {periods.map((period, i) => (
                <th
                  key={period.label + i}
                  className={`text-right font-mono text-[12px] tracking-[0.15em] uppercase pb-3 px-3 ${
                    period.forecast ? 'text-[#8B1E1E]' : 'text-[#8A8A8F]'
                  }`}
                >
                  {period.label}
                  {i === firstForecast && (
                    <span className="block text-[12px] tracking-normal normal-case text-[#8A8A8F]">
                      forecast
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {groups.map((group) => (
              <React.Fragment key={group}>
                <tr>
                  <td
                    colSpan={periods.length + 1}
                    className="font-mono text-[12px] tracking-[0.2em] text-[#8A8A8F] uppercase pt-5 pb-2"
                  >
                    {group}
                  </td>
                </tr>

                {(definitions as any[])
                  .filter((d) => d.group === group)
                  .map((d) => (
                    <React.Fragment key={d.key}>
                      <tr className="border-b border-[#222228]/60">
                        <td className="py-2.5 pr-4">
                          <button
                            type="button"
                            onClick={() =>
                              setOpenFormula(openFormula === d.key ? null : d.key)
                            }
                            className="text-left text-[15px] text-[#F2F0EA] hover:text-[#8B1E1E] transition-colors"
                          >
                            {d.label}
                            <span className="ml-2 font-mono text-[12px] text-[#8A8A8F]">
                              {openFormula === d.key ? '−' : '?'}
                            </span>
                          </button>
                        </td>

                        {periods.map((period, i) => {
                          const cell = period.ratios[d.key];
                          return (
                            <td
                              key={period.label + i}
                              className={`py-2.5 px-3 text-right font-mono text-[15px] ${
                                cell?.display === null || cell?.display === undefined
                                  ? 'text-[#8A8A8F]'
                                  : period.forecast
                                  ? 'text-[#A1A1AA]'
                                  : 'text-[#F2F0EA]'
                              }`}
                            >
                              {cell?.display ?? '—'}
                            </td>
                          );
                        })}
                      </tr>

                      {openFormula === d.key && (
                        <tr>
                          <td
                            colSpan={periods.length + 1}
                            className="pb-4 pt-1 text-[14px] leading-relaxed text-[#8A8A8F]"
                          >
                            <span className="font-mono text-[#F2F0EA]">
                              {d.formula}
                            </span>
                            {d.note && <span className="block mt-1.5">{d.note}</span>}
                            {d.reportedOnly && (
                              <span className="block mt-1.5">
                                Shown for reported years only. The forecast
                                balance sheet accumulates cash by construction,
                                which would distort this ratio rather than
                                inform it.
                              </span>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default { FootballField, RatioBand };