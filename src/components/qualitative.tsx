// FILE: src/components/qualitative.tsx
// Marginalia — qualitative adjustments
//
// The original idea was to let a reader rate each qualitative factor as a
// percentage, average those percentages, and multiply the intrinsic value by
// the result. That was dropped deliberately, and it is worth saying why in the
// code as well as on the screen: multiplying $154 by 1.08 because someone felt
// the moat was strong produces a number with two decimal places and no chain of
// reasoning behind it. On a site whose whole claim is that the numbers can be
// checked, that is the one thing a sharp reader would catch.
//
// So judgement is routed through the drivers the model already accepts. A wider
// moat means margins hold up for longer, so it moves the operating margin and
// the growth assumed after year five. Weak governance means a buyer demands a
// higher return for the risk, so it moves the discount rate. That is how an
// analyst actually reflects a view, and every rupee of the resulting change can
// be traced back through the eight steps above.
//
// Every nudge here is small and stated in full. Nothing is hidden, and nothing
// happens until the reader presses the button.

import React, { useMemo } from 'react';
import { ValuationDrivers } from '../types';

// The factors, the arithmetic and the caps all live in one module now, shared
// with the questions screen that runs before the model is built. Two copies of
// a list like this drift apart within a month, and the two screens would then
// be asking different questions and moving different assumptions.
import {
  FACTORS,
  FACTOR_GROUPS,
  applyVerdicts,
  DRIVER_LABELS,
} from '../data/qualitativeFactors';
import type { Verdict } from '../data/qualitativeFactors';

interface QualitativeProps {
  drivers: ValuationDrivers;
  defaults: ValuationDrivers;
  // The answers live one level up, in the dashboard. They have to: the reader
  // gives them on the questions screen before the model is built, and this
  // panel is opened afterwards. Owning them here would mean opening the panel
  // to a blank sheet and no way to see, let alone revise, a view already in
  // the numbers.
  verdicts: Record<string, Verdict>;
  onVerdictsChange: (next: Record<string, Verdict>) => void;
  appliedVerdicts?: Record<string, Verdict> | null;
  onApply: (next: ValuationDrivers, chosen: Record<string, Verdict>) => void;
  onReset: () => void;
  onClose: () => void;
  currencySymbol: string;
  currentValue: number;
  companyName: string;
  profile?: {
    summary?: string | null;
    industry?: string | null;
    sector?: string | null;
    website?: string | null;
    country?: string | null;
    employees?: number | null;
    officers?: { name: string; title: string }[];
  } | null;
}

export const QualitativeAdjustments: React.FC<QualitativeProps> = ({
  drivers,
  defaults,
  verdicts,
  onVerdictsChange,
  appliedVerdicts,
  onApply,
  onReset,
  onClose,
  currencySymbol,
  currentValue,
  companyName,
  profile,
}) => {
  const setVerdict = (key: string, verdict: Verdict) =>
    onVerdictsChange({ ...verdicts, [key]: verdict });

  // Whether what is ticked on screen is already the view the model is running
  // on. If it is not, the reader has changed something and has not applied it
  // yet, and the panel says so rather than leaving them to guess.
  const appliedCount = Object.values(appliedVerdicts ?? {}).filter(
    (v) => v && v !== 'neutral'
  ).length;
  const pending = useMemo(() => {
    const keys = new Set([
      ...Object.keys(verdicts),
      ...Object.keys(appliedVerdicts ?? {}),
    ]);
    return Array.from(keys).some(
      (k) => (verdicts[k] ?? 'neutral') !== ((appliedVerdicts ?? {})[k] ?? 'neutral')
    );
  }, [verdicts, appliedVerdicts]);

  // What the chosen verdicts would do to each driver, starting from the model's
  // own defaults rather than from wherever the sliders happen to be. Otherwise
  // pressing the button twice would apply the same view twice.
  const proposed = useMemo(
    () => applyVerdicts(defaults, verdicts),
    [verdicts, defaults]
  );

  // What the model is running on right now, as far as judgement goes. The list
  // below is measured against this rather than against the raw defaults: if a
  // view was already applied before the model was built, it is not a pending
  // change and should not be listed as one.
  const appliedBaseline = useMemo(
    () => applyVerdicts(defaults, appliedVerdicts ?? {}),
    [defaults, appliedVerdicts]
  );

  const changes = useMemo(
    () =>
      (Object.keys(defaults) as (keyof ValuationDrivers)[])
        .filter((key) => Number(proposed[key]) !== Number(appliedBaseline[key]))
        .map((key) => ({
          key,
          from: Number(appliedBaseline[key]),
          to: Number(proposed[key]),
        })),
    [proposed, appliedBaseline, defaults]
  );

  const anyVerdict = Object.values(verdicts).some((v) => v && v !== 'neutral');

  const driverLabels = DRIVER_LABELS;

  return (
    <div className="max-w-4xl mx-auto">
      <h3 className="font-serif text-xl text-[#F2F0EA] mb-2">
        Your judgement, put through the model
      </h3>

      <div className="text-[15px] leading-relaxed text-[#A1A1AA] space-y-3 mb-8">
        <p>
          A model reads accounts. It cannot read a management team, a regulator
          or a competitor. That part is yours.
        </p>
        <p>
          What it will not do is multiply the answer by a number you picked
          because a company felt strong. There would be no reasoning connecting
          the two, and the result would look far more precise than it was.
        </p>
        <p>
          Instead, each view below moves the assumption it genuinely belongs in.
          A stronger competitive position holds margins up for longer. Weaker
          governance raises the return an investor should demand. Every change is
          listed before you apply it, and you can trace it through the eight
          steps above.
        </p>
      </div>

      {appliedCount > 0 && (
        <div className="border border-[#222228] bg-[#0B0B0D] p-4 mb-8">
          <div className="font-mono text-[12px] tracking-[0.2em] text-[#8A8A8F] uppercase mb-2">
            Carried over from your answers
          </div>
          <p className="text-[14px] leading-relaxed text-[#8A8A8F]">
            {appliedCount === 1
              ? 'One view you gave before the model was built is already in these numbers. It is ticked below and marked "in the model".'
              : `${appliedCount} of the views you gave before the model was built are already in these numbers. They are ticked below and marked "in the model".`}{' '}
            Change any of them and press apply again to rebuild on the new view.
          </p>
        </div>
      )}

      {pending && (
        <div className="border border-[#8B1E1E] bg-[#8B1E1E]/10 p-4 mb-8">
          <p className="text-[14px] leading-relaxed text-[#F2F0EA]">
            You have changed a view since the model was last built. Nothing has
            moved yet — press <span className="font-mono">apply to the model</span>{' '}
            below to put it through.
          </p>
        </div>
      )}

      {/* What the company says about itself. Descriptive context only: none of
          it is a reported figure and none of it feeds the model. It is here
          because judging a moat or a management team from a balance sheet
          alone is not really judging it at all. */}
      {profile && (profile.summary || profile.officers?.length) ? (
        <div className="border border-[#222228] bg-[#0B0B0D] p-5 mb-8">
          <div className="font-mono text-[12px] tracking-[0.2em] text-[#8A8A8F] uppercase mb-3">
            About {companyName}
          </div>

          {(profile.industry || profile.sector || profile.employees || profile.country) && (
            <div className="flex flex-wrap gap-x-6 gap-y-2 font-mono text-[13px] text-[#8A8A8F] mb-4">
              {profile.sector && <span>Sector: {profile.sector}</span>}
              {profile.industry && <span>Industry: {profile.industry}</span>}
              {profile.employees ? (
                <span>Employees: {profile.employees.toLocaleString()}</span>
              ) : null}
              {profile.country && <span>{profile.country}</span>}
            </div>
          )}

          {profile.summary && (
            <p className="text-[14px] leading-relaxed text-[#A1A1AA] mb-5">
              {profile.summary}
            </p>
          )}

          {profile.officers && profile.officers.length > 0 && (
            <div>
              <div className="font-mono text-[12px] tracking-[0.2em] text-[#8A8A8F] uppercase mb-2">
                Who runs it
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5">
                {profile.officers.map((officer) => (
                  <div
                    key={officer.name + officer.title}
                    className="flex items-baseline justify-between gap-4 border-b border-[#222228]/60 py-1.5"
                  >
                    <span className="text-[14px] text-[#F2F0EA]">{officer.name}</span>
                    <span className="font-mono text-[13px] text-[#8A8A8F] text-right">
                      {officer.title}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {profile.website && (
            <a
              href={profile.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-4 font-mono text-[13px] text-[#8B1E1E] hover:text-[#F2F0EA] transition-colors"
            >
              {profile.website}
            </a>
          )}

          <p className="text-[13px] leading-relaxed text-[#8A8A8F] mt-4">
            Description and officers as published by the company. None of it is
            a reported figure and none of it feeds the model. Read the news on
            the company page alongside it.
          </p>
        </div>
      ) : null}

      {FACTOR_GROUPS.map((group) => (
      <div key={group.key} className="mb-8">
        <h4 className="font-serif text-lg text-[#F2F0EA]">{group.title}</h4>
        <p className="text-[13px] text-[#8A8A8F] mb-4 mt-1">{group.standfirst}</p>
        <div className="space-y-6">
        {FACTORS.filter((f) => f.group === group.key).map((factor) => {
          const verdict = verdicts[factor.key];
          const inModel =
            verdict &&
            verdict !== 'neutral' &&
            (appliedVerdicts ?? {})[factor.key] === verdict;
          return (
            <div
              key={factor.key}
              className="border border-[#222228] bg-[#0B0B0D] p-4"
            >
              <div className="flex items-baseline justify-between gap-4 mb-1">
                <div className="text-[14px] text-[#F2F0EA]">{factor.title}</div>
                {inModel ? (
                  <span className="font-mono text-[12px] uppercase tracking-widest text-[#8B1E1E] shrink-0">
                    in the model
                  </span>
                ) : null}
              </div>
              <div className="text-[15px] text-[#8A8A8F] mb-3 max-w-2xl">
                {factor.question}
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                {(['helps', 'neutral', 'hurts'] as Verdict[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setVerdict(factor.key, option)}
                    className={`font-mono text-[13px] uppercase tracking-widest px-3 py-1.5 border transition-colors ${
                      verdict === option
                        ? 'border-[#8B1E1E] bg-[#8B1E1E]/20 text-[#F2F0EA]'
                        : 'border-[#222228] text-[#8A8A8F] hover:text-[#F2F0EA]'
                    }`}
                  >
                    {option === 'helps'
                      ? 'a strength'
                      : option === 'hurts'
                      ? 'a weakness'
                      : 'neither'}
                  </button>
                ))}
              </div>

              <div className="font-mono text-[12px] text-[#8A8A8F] leading-relaxed">
                {factor.reasoning}
              </div>
            </div>
          );
        })}
        </div>
      </div>
      ))}

      <div className="mt-8 border-t border-[#222228] pt-6">
        <div className="font-mono text-[12px] tracking-[0.2em] text-[#8A8A8F] uppercase mb-3">
          What this would change
        </div>

        {changes.length === 0 ? (
          <p className="text-[15px] text-[#8A8A8F]">
            {appliedCount > 0
              ? 'Nothing further. The views ticked above are already in the model. Change one and what it would move will be listed here.'
              : 'Nothing yet. Mark a factor as a strength or a weakness and the assumptions it moves will be listed here before anything is applied.'}
          </p>
        ) : (
          <div className="space-y-1.5 mb-5">
            {changes.map((change) => (
              <div
                key={String(change.key)}
                className="flex items-baseline justify-between gap-4 font-mono text-[14px]"
              >
                <span className="text-[#8A8A8F]">
                  {driverLabels[String(change.key)] || String(change.key)}
                </span>
                <span className="text-[#F2F0EA]">
                  {change.from}% → {change.to}%
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-3 items-center">
          <button
            type="button"
            disabled={!anyVerdict || changes.length === 0}
            onClick={() => {
              onApply(proposed, verdicts);
              onClose();
            }}
            className="font-mono text-[13px] uppercase tracking-widest px-4 py-2 border border-[#8B1E1E] text-[#F2F0EA] bg-[#8B1E1E]/20 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#8B1E1E]/35 transition-colors"
          >
            Apply to the model
          </button>
          <button
            type="button"
            onClick={() => {
              onReset();
              // "Back to the model" has to actually go back to it. This closes
              // the full screen as well as clearing the views.
              onClose();
            }}
            className="font-mono text-[13px] uppercase tracking-widest px-4 py-2 border border-[#222228] text-[#8A8A8F] hover:text-[#F2F0EA] transition-colors"
          >
            Clear and go back to the model
          </button>
          <span className="font-mono text-[13px] text-[#8A8A8F]">
            currently {currencySymbol}
            {currentValue.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>

        <p className="text-[14px] leading-relaxed text-[#8A8A8F] mt-5 max-w-2xl">
          These are your views, not the model's, and not a recommendation. The
          site does not know whether you are right. It only makes sure that if
          you are, the number changes for a reason you can follow.
        </p>
      </div>
    </div>
  );
};

export default QualitativeAdjustments;