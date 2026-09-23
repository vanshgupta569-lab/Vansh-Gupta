// FILE: src/components/terminalReliancePanel.tsx
//
// How much of the value is the part nobody modelled, shown rather than buried.
//
// Three things, in the order a reader needs them: how much sits beyond the
// forecast, what that figure would be for any forecast of the same length at
// the same discount rate, and what the value becomes at each end of a stated
// range for the two assumptions that carry it.
//
// Everything is coarse on purpose. Whole percentages, values rounded as the
// headline is, and the two sensitivities given as the value AT each end of a
// named range rather than as "plus or minus", because the perpetuity formula is
// not symmetric and a single figure would hide that.
import type { TerminalReliance } from '../data/terminalReliance';

const pct = (v: number) => `${Math.round(v * 100)}%`;

export function TerminalReliancePanel({
  reliance,
  currencySymbol,
  value,
}: {
  reliance: TerminalReliance | null;
  currencySymbol: string;
  value: number | null;
}) {
  if (!reliance) return null;
  const money = (v: number | null) =>
    v === null ? '—' : `${currencySymbol}${v.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;

  const bar = Math.max(0, Math.min(100, reliance.share * 100));

  return (
    <section id="terminal-reliance" className="scroll-mt-24 bg-[#111114] border hairline-border p-6 lg:p-8 mb-6">
      <h2 className="font-display text-2xl text-[#F2F0EA] tracking-tight mb-1">
        How much of this rests on the terminal value
      </h2>
      <p className="text-[13px] leading-relaxed text-[#A1A1AA] max-w-3xl mb-6">{reliance.sentence}</p>

      {/* The split, as one bar. A picture of a ratio, not a number to read off. */}
      <div className="mb-2 flex h-7 w-full overflow-hidden border hairline-border">
        <div
          className="bg-[#2A2A30] flex items-center justify-center"
          style={{ width: `${100 - bar}%` }}
          title="the modelled years"
        >
          {100 - bar > 12 && (
            <span className="font-mono text-[10px] text-[#A1A1AA] uppercase tracking-widest">
              {pct(1 - reliance.share)} modelled
            </span>
          )}
        </div>
        <div
          className={`flex items-center justify-center ${reliance.unusual ? 'bg-[#8B1E1E]' : 'bg-[#5C4415]'}`}
          style={{ width: `${bar}%` }}
          title="beyond the forecast"
        >
          <span className="font-mono text-[10px] text-[#F2F0EA] uppercase tracking-widest">
            {pct(reliance.share)} beyond the forecast
          </span>
        </div>
      </div>
      <div className="font-mono text-[10px] text-[#8A8A8F] mb-6">
        an ordinary {reliance.forecastYears}-year forecast at this discount rate would put about{' '}
        {pct(reliance.benchmark)} beyond the window
        {reliance.unusual ? ' — this one is further' : ''}
      </div>

      {/* The two assumptions that carry it, each as a range. */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reliance.growth && (
          <div className="bg-[#0B0B0D] border hairline-border p-4">
            <div className="font-mono text-[10px] text-[#8A8A8F] uppercase tracking-widest mb-2">
              Growth after the forecast
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-mono text-[11px] text-[#A1A1AA]">{(reliance.growth.low * 100).toFixed(1)}%</span>
              <span className="font-mono text-[11px] text-[#A1A1AA]">{(reliance.growth.high * 100).toFixed(1)}%</span>
            </div>
            <div className="flex items-baseline justify-between gap-3 mt-1">
              <span className="font-display text-xl text-[#F2F0EA]">{money(reliance.growth.lowValue)}</span>
              <span className="font-mono text-[10px] text-[#8A8A8F]">a share</span>
              <span className="font-display text-xl text-[#F2F0EA]">{money(reliance.growth.highValue)}</span>
            </div>
          </div>
        )}
        {reliance.wacc && (
          <div className="bg-[#0B0B0D] border hairline-border p-4">
            <div className="font-mono text-[10px] text-[#8A8A8F] uppercase tracking-widest mb-2">
              Discount rate
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-mono text-[11px] text-[#A1A1AA]">{(reliance.wacc.low * 100).toFixed(2)}%</span>
              <span className="font-mono text-[11px] text-[#A1A1AA]">{(reliance.wacc.high * 100).toFixed(2)}%</span>
            </div>
            <div className="flex items-baseline justify-between gap-3 mt-1">
              <span className="font-display text-xl text-[#F2F0EA]">{money(reliance.wacc.lowValue)}</span>
              <span className="font-mono text-[10px] text-[#8A8A8F]">a share</span>
              <span className="font-display text-xl text-[#F2F0EA]">{money(reliance.wacc.highValue)}</span>
            </div>
          </div>
        )}
      </div>

      <p className="font-mono text-[10px] text-[#8A8A8F] mt-5 leading-relaxed max-w-3xl">
        {value !== null && (
          <>
            The headline is {money(value)}. {' '}
          </>
        )}
        Neither range is a forecast of how wrong the number is, and the ends are not equally likely: they are what the
        same model returns when one assumption is moved and everything else is held. The two are not additive, and the
        perpetuity formula is not symmetric, which is why the value at each end is shown rather than a single margin.
      </p>
    </section>
  );
}

export default { TerminalReliancePanel };
