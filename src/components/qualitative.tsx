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

import React, { useMemo, useState } from 'react';
import { ValuationDrivers } from '../types';

type Verdict = 'helps' | 'neutral' | 'hurts';

interface Factor {
  key: string;
  title: string;
  question: string;
  // What a "helps" verdict does to each driver, in percentage points. A
  // "hurts" verdict applies the same amounts in the opposite direction.
  effect: Partial<Record<keyof ValuationDrivers, number>>;
  reasoning: string;
}

// The sizes below are deliberately modest. A qualitative view is a nudge to an
// assumption, not a replacement for it: half a point of margin is a real
// difference to a valuation without pretending anyone can judge it finer.
const FACTORS: Factor[] = [
  {
    key: 'moat',
    title: 'Competitive position',
    question:
      'Can this company keep charging what it charges, or will rivals compete the profit away?',
    effect: { operatingMarginPct: 0.5, terminalGrowthPct: 0.1 },
    reasoning:
      'A company customers cannot easily leave keeps its profit margin for longer, and keeps growing for longer once the forecast runs out.',
  },
  {
    key: 'demand',
    title: 'Demand for what it sells',
    question:
      'Is the market this company sells into growing, shrinking, or holding steady?',
    effect: { revenueGrowthPct: 1.0 },
    reasoning:
      'This moves the sales growth rate directly. It is the assumption a view about demand actually belongs in.',
  },
  {
    key: 'management',
    title: 'Management and governance',
    question:
      'Do you trust the people running it, and the way the company is controlled?',
    effect: { waccPct: -0.3 },
    reasoning:
      'Poor governance does not change the cash the business produces. It changes how confident you can be of receiving it, which is what the discount rate measures.',
  },
  {
    key: 'regulation',
    title: 'Regulation and policy',
    question:
      'Could a change in law, tax or policy meaningfully change what this business earns?',
    effect: { waccPct: -0.3, operatingMarginPct: 0.25 },
    reasoning:
      'Regulatory risk raises the return an investor needs, and often squeezes the margin as well.',
  },
  {
    key: 'capital',
    title: 'How hard the money works',
    question:
      'Does this business have to keep spending heavily just to stand still?',
    effect: { capexPctOfRev: -0.5 },
    reasoning:
      'A business that needs less equipment spending keeps more of the cash it makes.',
  },
];

interface QualitativeProps {
  drivers: ValuationDrivers;
  defaults: ValuationDrivers;
  onApply: (next: ValuationDrivers) => void;
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
  onApply,
  onReset,
  onClose,
  currencySymbol,
  currentValue,
  companyName,
  profile,
}) => {
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({});

  const setVerdict = (key: string, verdict: Verdict) =>
    setVerdicts((prev) => ({ ...prev, [key]: verdict }));

  // What the chosen verdicts would do to each driver, starting from the model's
  // own defaults rather than from wherever the sliders happen to be. Otherwise
  // pressing the button twice would apply the same view twice.
  const proposed = useMemo(() => {
    const next: any = { ...defaults };
    for (const factor of FACTORS) {
      const verdict = verdicts[factor.key];
      if (!verdict || verdict === 'neutral') continue;
      const sign = verdict === 'helps' ? 1 : -1;
      for (const [driver, amount] of Object.entries(factor.effect)) {
        const key = driver as keyof ValuationDrivers;
        next[key] = Number((Number(next[key]) + sign * (amount as number)).toFixed(2));
      }
    }
    return next as ValuationDrivers;
  }, [verdicts, defaults]);

  const changes = useMemo(
    () =>
      (Object.keys(defaults) as (keyof ValuationDrivers)[])
        .filter((key) => Number(proposed[key]) !== Number(defaults[key]))
        .map((key) => ({
          key,
          from: Number(defaults[key]),
          to: Number(proposed[key]),
        })),
    [proposed, defaults]
  );

  const anyVerdict = Object.values(verdicts).some((v) => v && v !== 'neutral');

  const driverLabels: Record<string, string> = {
    revenueGrowthPct: 'Sales growth',
    operatingMarginPct: 'Operating margin',
    taxRatePct: 'Tax rate',
    capexPctOfRev: 'Equipment spending',
    waccPct: 'Discount rate',
    terminalGrowthPct: 'Growth after year five',
  };

  return (
    <div className="max-w-4xl">
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

      <div className="space-y-6">
        {FACTORS.map((factor) => {
          const verdict = verdicts[factor.key];
          return (
            <div
              key={factor.key}
              className="border border-[#222228] bg-[#0B0B0D] p-4"
            >
              <div className="text-[14px] text-[#F2F0EA] mb-1">
                {factor.title}
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

      <div className="mt-8 border-t border-[#222228] pt-6">
        <div className="font-mono text-[12px] tracking-[0.2em] text-[#8A8A8F] uppercase mb-3">
          What this would change
        </div>

        {changes.length === 0 ? (
          <p className="text-[15px] text-[#8A8A8F]">
            Nothing yet. Mark a factor as a strength or a weakness and the
            assumptions it moves will be listed here before anything is applied.
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
              onApply(proposed);
              onClose();
            }}
            className="font-mono text-[13px] uppercase tracking-widest px-4 py-2 border border-[#8B1E1E] text-[#F2F0EA] bg-[#8B1E1E]/20 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#8B1E1E]/35 transition-colors"
          >
            Apply to the model
          </button>
          <button
            type="button"
            onClick={() => {
              setVerdicts({});
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