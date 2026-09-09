// FILE: src/components/assetPanel.tsx
//
// Marginalia — the asset approach, in full
//
// Four readings of one balance sheet, from the most generous to the harshest,
// each with its arithmetic printed rather than asserted.
//
// The division of labour is the point of this screen. Every figure on the left
// of each line is REPORTED: it was filed by the company and can be checked
// against the filing. Every recovery rate on the right is the READER'S: it is a
// judgement about what a thing would fetch, and nobody can look that up.
//
// Two presets exist because the honest answer depends entirely on which
// question is being asked. A company closed in a panic and the same company
// wound down over eighteen months are not worth the same, and no single default
// can express that. Changing any individual rate moves the preset to "your own
// rates", so the screen never claims a convention it is no longer following.

import React from 'react';
import type { AssetApproachResult, RecoveryRates } from '../data/assetApproach';
import { RECOVERY_PRESETS, RECOVERY_LABELS } from '../data/assetApproach';

interface Props {
  companyName: string;
  currencySymbol: string;
  unitLabel: string;
  result: AssetApproachResult | null;
  rates: RecoveryRates;
  presetKey: 'forcedSale' | 'orderly' | 'custom';
  onPreset: (key: 'forcedSale' | 'orderly') => void;
  onRate: (key: keyof RecoveryRates, value: number) => void;
  /** For comparison only: what the income approach says. */
  dcfValuePerShare: number | null;
}

const isNum = (v: any): v is number => typeof v === 'number' && isFinite(v);

export const AssetPanel: React.FC<Props> = ({
  companyName,
  currencySymbol,
  unitLabel,
  result,
  rates,
  presetKey,
  onPreset,
  onRate,
  dcfValuePerShare,
}) => {
  const money = (v: any, dp = 2) =>
    isNum(v)
      ? `${currencySymbol}${v.toLocaleString(undefined, {
          minimumFractionDigits: dp,
          maximumFractionDigits: dp,
        })}`
      : '—';
  const bulk = (v: any) =>
    isNum(v)
      ? v.toLocaleString(undefined, { maximumFractionDigits: 0 })
      : '—';

  if (!result) {
    return (
      <div className="max-w-4xl">
        <p className="text-[14px] text-[#8A8A8F]">
          No reported balance sheet is available for this company, so the asset
          approach cannot be built.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <h3 className="font-serif text-xl text-[#F2F0EA] mb-2">
        What {companyName} owns, once everything it owes is paid
      </h3>
      <p className="text-[14px] leading-relaxed text-[#A1A1AA] mb-6 max-w-2xl">
        The oldest of the three approaches and the least flattering. It ignores
        what the business earns and asks a blunter question: if it stopped
        trading, sold everything and settled its debts, what would be left? That
        gives a floor, and a floor matters most exactly when the other two
        methods are struggling.
      </p>

      <div className="border border-[#222228] bg-[#0B0B0D] p-4 mb-8">
        <p className="text-[13px] leading-relaxed text-[#8A8A8F]">
          {result.suitability}
        </p>
        {result.intangiblesIncomplete && (
          <p className="text-[13px] leading-relaxed text-[#8A8A8F] mt-2">
            This filer does not disclose goodwill and other intangibles
            separately. Anything not disclosed has been left out rather than
            assumed to be zero, and the tangible measure says so.
          </p>
        )}
      </div>

      {/* ---------------- THE FOUR MEASURES ---------------- */}
      {result.measures.map((m) => (
        <div key={m.key} className="border border-[#222228] bg-[#0B0B0D] mb-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[#222228] p-5">
            <div>
              <div className="text-[16px] text-[#F2F0EA]">{m.label}</div>
              <div className="text-[13px] text-[#8A8A8F] mt-0.5">{m.question}</div>
            </div>
            <div className="font-mono text-[20px] text-[#F2F0EA] tabular-nums">
              {isNum(m.perShare) ? money(m.perShare) : 'not shown'}
            </div>
          </div>

          {m.workings.length > 0 ? (
            <div className="p-5">
              {m.workings.map((line, i) => (
                <div
                  key={`${m.key}-${i}`}
                  className={`flex items-baseline justify-between gap-4 py-2 ${
                    i < m.workings.length - 1 ? 'border-b border-[#222228]/60' : ''
                  }`}
                >
                  <span
                    className={`text-[14px] leading-snug ${
                      line.emphasis ? 'text-[#F2F0EA]' : 'text-[#8A8A8F]'
                    }`}
                  >
                    {line.label}
                    {line.note ? (
                      <span className="block font-mono text-[12px] text-[#8A8A8F]/80 mt-0.5">
                        {line.note}
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={`font-mono text-[14px] tabular-nums shrink-0 ${
                      line.emphasis ? 'text-[#F2F0EA] font-semibold' : 'text-[#A1A1AA]'
                    }`}
                  >
                    {bulk(line.value)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-5 text-[13px] leading-relaxed text-[#8A8A8F]">
              {m.absentBecause}
            </div>
          )}

          {!isNum(m.perShare) && m.workings.length > 0 && (
            <div className="px-5 pb-5 text-[13px] leading-relaxed text-[#8A8A8F]">
              Not shown, because {m.absentBecause}.
            </div>
          )}
        </div>
      ))}

      {/* ---------------- THE RECOVERY RATES ---------------- */}
      <div className="border border-[#8B1E1E]/40 bg-[#8B1E1E]/[0.06] p-5 mb-8">
        <h4 className="font-mono text-[12px] tracking-[0.2em] text-[#8A8A8F] uppercase mb-2">
          Your recovery rates
        </h4>
        <p className="text-[13px] leading-relaxed text-[#8A8A8F] mb-4 max-w-2xl">
          The balance sheet figures above are reported facts. These percentages
          are not: they are a judgement about what each kind of asset would
          actually fetch, and they are yours to set. Only the liquidation
          measure uses them.
        </p>

        <div className="flex flex-wrap gap-2 mb-5">
          {RECOVERY_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => onPreset(preset.key)}
              className={`font-mono text-[11px] uppercase tracking-wider px-3 py-2 border transition-colors ${
                presetKey === preset.key
                  ? 'border-[#8B1E1E] bg-[#8B1E1E]/20 text-[#F2F0EA]'
                  : 'border-[#222228] text-[#8A8A8F] hover:text-[#F2F0EA] hover:border-[#8A8A8F]'
              }`}
            >
              {preset.label}
            </button>
          ))}
          <span className="font-mono text-[11px] uppercase tracking-wider px-3 py-2 text-[#8A8A8F]">
            {presetKey === 'custom'
              ? 'your own rates'
              : RECOVERY_PRESETS.find((p) => p.key === presetKey)?.description}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
          {RECOVERY_LABELS.map(({ key, label }) => (
            <label key={key} className="flex items-center justify-between gap-4">
              <span className="text-[14px] text-[#A1A1AA]">{label}</span>
              <span className="flex items-center gap-2 shrink-0">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={Math.round((rates[key] ?? 0) * 100)}
                  onChange={(e) => onRate(key, Number(e.target.value) / 100)}
                  className="w-28 accent-[#8B1E1E]"
                  aria-label={label}
                />
                <span className="font-mono text-[14px] text-[#F2F0EA] tabular-nums w-12 text-right">
                  {Math.round((rates[key] ?? 0) * 100)}%
                </span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* ---------------- THE SUMMARY ---------------- */}
      <div className="flex flex-wrap items-baseline gap-x-10 gap-y-3 border-t border-[#222228] pt-5">
        <div>
          <div className="font-mono text-[11px] tracking-[0.15em] text-[#8A8A8F] uppercase">
            Asset approach range
          </div>
          <div className="font-mono text-[18px] text-[#F2F0EA] tabular-nums mt-0.5">
            {result.available
              ? `${money(result.low)} – ${money(result.high)}`
              : 'nothing shown'}
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

      <p className="text-[13px] leading-relaxed text-[#8A8A8F] max-w-2xl mt-5 border-t border-[#222228] pt-5">
        Every figure here comes from the last reported balance sheet
        {isNum(result.fiscalYear) ? ` (FY${result.fiscalYear})` : ''}, never
        from the forecast. An asset approach is a statement about what exists
        today; the moment it borrows a projected balance sheet it stops
        answering its own question. Money figures in {unitLabel}.
      </p>
    </div>
  );
};

export default AssetPanel;
