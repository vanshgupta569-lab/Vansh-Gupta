// FILE: src/components/qualitativeIntro.tsx
//
// Marginalia — the questions, before the model
//
// A model is built from filings. Filings record what a company did; they say
// nothing about whether the technology will still exist in ten years, or
// whether four customers account for most of the revenue. That part is the
// reader's, and asking for it BEFORE the value appears is deliberate: once a
// number is on screen it becomes an anchor, and every later judgement bends
// towards it.
//
// Two rules make that defensible rather than obstructive.
//
// FIRST, NOBODY JUDGES A COMPANY THEY CANNOT SEE. Asking someone to rate
// pricing power on a blank screen is asking them to guess, and a guess routed
// into the discount rate is worse than no adjustment at all. So the reported
// facts sit beside the questions: what the company does, how fast it has grown,
// what it earns on what it sells, and what it owes. All history, no model.
//
// SECOND, SKIPPING COSTS NOTHING. Every factor defaults to neutral, so skipping
// and answering everything neutral produce the identical model. If Skip carried
// a penalty people would click it anyway and get a worse answer for it.

import React, { useMemo, useState } from 'react';
import { ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
import { CompanyData } from '../types';
import {
  FACTORS,
  FACTOR_GROUPS,
  adjustmentsFor,
  DRIVER_LABELS,
} from '../data/qualitativeFactors';
import type { Verdict } from '../data/qualitativeFactors';

interface Props {
  company: CompanyData;
  onContinue: (verdicts: Record<string, Verdict>) => void;
  onSkip: () => void;
  onBack: () => void;
}

const isNum = (v: any): v is number => typeof v === 'number' && isFinite(v);

const VERDICTS: { key: Verdict; label: string }[] = [
  { key: 'helps', label: 'A strength' },
  { key: 'neutral', label: 'Neither' },
  { key: 'hurts', label: 'A weakness' },
];

export const QualitativeIntro: React.FC<Props> = ({ company, onContinue, onSkip, onBack }) => {
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({});
  const [newsOpen, setNewsOpen] = useState(false);
  const [news, setNews] = useState<{ headline: string; source: string; url: string }[] | null>(null);
  const [newsLoading, setNewsLoading] = useState(false);

  const set = (key: string, verdict: Verdict) =>
    setVerdicts((prev) => ({ ...prev, [key]: verdict }));

  const answered = Object.values(verdicts).filter((v) => v && v !== 'neutral').length;
  const adjustments = useMemo(() => adjustmentsFor(verdicts), [verdicts]);
  const moves = Object.entries(adjustments).filter(([, v]) => Number(v) !== 0);

  // The reported facts. Nothing here is modelled and nothing here is an
  // opinion; it is the minimum a person needs in order to answer the questions
  // honestly rather than at random.
  const facts = useMemo(() => {
    const f = company.financials;
    const out: { label: string; value: string; note?: string }[] = [];
    const revenue = (f?.revenue || []).filter(isNum) as number[];
    const years = f?.years || [];

    if (revenue.length >= 2) {
      const first = revenue[0];
      const last = revenue[revenue.length - 1];
      const n = revenue.length - 1;
      if (first > 0 && last > 0) {
        const cagr = (Math.pow(last / first, 1 / n) - 1) * 100;
        out.push({
          label: `Sales growth, ${years[0] || 'earliest'} to ${years[years.length - 1] || 'latest'}`,
          value: `${cagr >= 0 ? '+' : ''}${cagr.toFixed(1)}% a year`,
          note: 'compound, across the reported years',
        });
      }
    }

    const growth = (f?.revenueGrowth || []).filter(isNum) as number[];
    if (growth.length) {
      const lastGrowth = growth[growth.length - 1];
      out.push({
        label: 'Sales growth, most recent year',
        value: `${lastGrowth >= 0 ? '+' : ''}${lastGrowth.toFixed(1)}%`,
        note: 'compare it with the line above: is growth speeding up or slowing down?',
      });
    }

    if (isNum(company.opMarginPct)) {
      out.push({
        label: 'Operating margin',
        value: `${company.opMarginPct}%`,
        note: 'what it keeps from every hundred rupees of sales, before interest and tax',
      });
    }

    if (company.netDebtEbitda) {
      out.push({
        label: 'Net debt to EBITDA',
        value: String(company.netDebtEbitda),
        note: 'roughly how many years of trading profit it would take to clear the borrowings',
      });
    }

    return out;
  }, [company]);

  const openNews = () => {
    setNewsOpen((was) => !was);
    if (news || newsLoading) return;
    setNewsLoading(true);
    fetch(
      `/api/news?ticker=${encodeURIComponent(company.ticker)}&name=${encodeURIComponent(
        company.name || ''
      )}`
    )
      .then((r) => r.json())
      .then((body) => setNews(Array.isArray(body.items) ? body.items : []))
      .catch(() => setNews([]))
      .finally(() => setNewsLoading(false));
  };

  return (
    <div className="pt-28 pb-20 max-w-[1440px] mx-auto px-6 lg:px-12 min-h-screen">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-2 h-2 bg-[#8B1E1E]" />
        <span className="font-mono text-[11px] text-[#8A8A8F] tracking-[0.2em] uppercase">
          Before the model — {company.ticker}
        </span>
      </div>

      <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-medium text-[#F2F0EA] mb-5">
        What the filings cannot tell us about {company.name}
      </h1>

      <div className="text-[15px] leading-relaxed text-[#A1A1AA] max-w-2xl space-y-3 mb-8">
        <p>
          The model on the next screen is built entirely from what this company
          has filed. That makes it checkable, and it makes it blind to
          everything a filing does not record: whether the technology still
          matters in ten years, whether four customers account for most of the
          revenue, whether the people running it deserve the benefit of the
          doubt.
        </p>
        <p>
          Those are judgements, and they are yours rather than ours. Answer what
          you have a view on and leave the rest alone. Each answer moves one
          assumption inside the model, and you will see exactly which.
        </p>
      </div>

      {/* The skip, said loudly and early, because a reader who does not yet
          know this company should not be made to guess. */}
      <div className="border border-[#222228] bg-[#111114] p-5 sm:p-6 mb-10 max-w-3xl">
        <div className="text-[16px] text-[#F2F0EA] mb-2">
          Don’t know this company yet? Skip.
        </div>
        <p className="text-[14px] leading-relaxed text-[#8A8A8F] mb-4">
          The model is built from the filings either way, and skipping changes
          nothing about it. You can come back and make these judgements at any
          time from “For the nerds” at the foot of the company page.
        </p>
        <button
          type="button"
          onClick={onSkip}
          className="inline-flex items-center gap-2 font-mono text-[12px] uppercase tracking-widest px-5 py-3 border border-[#8B1E1E] text-[#F2F0EA] bg-[#8B1E1E]/25 hover:bg-[#8B1E1E]/45 transition-colors font-semibold"
        >
          Skip and build the model
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-8 lg:gap-12">
        {/* ---------------- the reported facts ---------------- */}
        <aside className="lg:sticky lg:top-24 self-start">
          <div className="border border-[#222228] bg-[#111114] p-5">
            <div className="font-mono text-[11px] tracking-[0.2em] text-[#8A8A8F] uppercase mb-3">
              What the filings do say
            </div>

            {company.description && (
              <p className="text-[14px] leading-relaxed text-[#A1A1AA] mb-5">
                {company.description}
              </p>
            )}

            {facts.map((fact) => (
              <div key={fact.label} className="py-3 border-t border-[#222228]">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[13px] text-[#8A8A8F]">{fact.label}</span>
                  <span className="font-mono text-[15px] text-[#F2F0EA] tabular-nums shrink-0">
                    {fact.value}
                  </span>
                </div>
                {fact.note && (
                  <div className="text-[12px] leading-snug text-[#8A8A8F] mt-1">
                    {fact.note}
                  </div>
                )}
              </div>
            ))}

            {/* Coverage, offered rather than pushed. Headlines are somebody
                else's opinion and this screen is for forming your own, so they
                sit behind a click and below the facts. */}
            <div className="border-t border-[#222228] pt-4 mt-1">
              <button
                type="button"
                onClick={openNews}
                className="w-full flex items-baseline justify-between gap-3 text-left group"
              >
                <span className="text-[14px] text-[#F2F0EA] group-hover:text-[#8B1E1E] transition-colors">
                  Want to know more about this company?
                  <span className="block text-[12px] text-[#8A8A8F] mt-0.5">
                    Read the latest coverage here
                  </span>
                </span>
                <span className="text-[#8A8A8F] shrink-0">
                  {newsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </span>
              </button>

              {newsOpen && (
                <div className="mt-3 space-y-2">
                  {newsLoading && (
                    <p className="font-mono text-[12px] text-[#8A8A8F]">Fetching…</p>
                  )}
                  {!newsLoading && news && news.length === 0 && (
                    <p className="text-[13px] text-[#8A8A8F]">
                      No recent coverage was found for this company.
                    </p>
                  )}
                  {!newsLoading &&
                    (news || []).slice(0, 6).map((item, i) => (
                      <a
                        key={i}
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-[13px] leading-snug text-[#A1A1AA] hover:text-[#F2F0EA] transition-colors"
                      >
                        {item.headline}
                        <span className="block font-mono text-[11px] text-[#8A8A8F] mt-0.5">
                          {item.source}
                        </span>
                      </a>
                    ))}
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* ---------------- the questions ---------------- */}
        <div>
          {FACTOR_GROUPS.map((group) => (
            <section key={group.key} className="mb-10">
              <h2 className="font-serif text-xl text-[#F2F0EA]">{group.title}</h2>
              <p className="text-[14px] text-[#8A8A8F] mb-5 mt-1">{group.standfirst}</p>

              <div className="border border-[#222228] bg-[#111114]">
                {FACTORS.filter((f) => f.group === group.key).map((factor) => {
                  const chosen = verdicts[factor.key];
                  return (
                    <div
                      key={factor.key}
                      className="border-b border-[#222228] last:border-0 p-5 flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-8"
                    >
                      <div className="flex-1">
                        <div className="text-[15px] text-[#F2F0EA]">{factor.title}</div>
                        <div className="text-[14px] leading-snug text-[#8A8A8F] mt-1">
                          {factor.question}
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {VERDICTS.map((v) => (
                          <button
                            key={v.key}
                            type="button"
                            onClick={() => set(factor.key, v.key)}
                            className={`font-mono text-[11px] uppercase tracking-wider px-3 py-2 border transition-colors whitespace-nowrap ${
                              chosen === v.key
                                ? 'border-[#8B1E1E] bg-[#8B1E1E]/20 text-[#F2F0EA]'
                                : 'border-[#222228] text-[#8A8A8F] hover:text-[#F2F0EA] hover:border-[#8A8A8F]'
                            }`}
                          >
                            {v.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}

          {/* ---------------- what this will change ---------------- */}
          <div className="border border-[#222228] bg-[#0B0B0D] p-5 mb-6">
            <div className="font-mono text-[11px] tracking-[0.2em] text-[#8A8A8F] uppercase mb-3">
              What this will change in the model
            </div>

            {moves.length === 0 ? (
              <p className="text-[14px] text-[#8A8A8F]">
                Nothing yet. The model will use its own assumptions, exactly as
                if you had skipped.
              </p>
            ) : (
              <>
                {moves.map(([driver, amount]) => (
                  <div
                    key={driver}
                    className="flex items-baseline justify-between gap-4 py-2 border-b border-[#222228]/60 last:border-0"
                  >
                    <span className="text-[14px] text-[#8A8A8F]">
                      {DRIVER_LABELS[driver] || driver}
                    </span>
                    <span className="font-mono text-[14px] text-[#F2F0EA] tabular-nums">
                      {Number(amount) > 0 ? '+' : ''}
                      {Number(amount).toFixed(2)} points
                    </span>
                  </div>
                ))}
                <p className="text-[12px] leading-relaxed text-[#8A8A8F] mt-3">
                  Each answer moves the assumption it belongs in, never the
                  finished answer. The total any one assumption can move is
                  capped, so a run of pessimistic answers cannot quietly collapse
                  the valuation on its own.
                </p>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onContinue(verdicts)}
              className="inline-flex items-center gap-2 font-mono text-[12px] uppercase tracking-widest px-5 py-3 border border-[#8B1E1E] text-[#F2F0EA] bg-[#8B1E1E]/25 hover:bg-[#8B1E1E]/45 transition-colors font-semibold"
            >
              Build the model{answered > 0 ? ` with ${answered} judgement${answered === 1 ? '' : 's'}` : ''}
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onSkip}
              className="font-mono text-[12px] uppercase tracking-widest px-4 py-3 text-[#8A8A8F] hover:text-[#F2F0EA] transition-colors"
            >
              Skip instead
            </button>
            <button
              type="button"
              onClick={onBack}
              className="font-mono text-[12px] uppercase tracking-widest px-4 py-3 text-[#8A8A8F] hover:text-[#F2F0EA] transition-colors"
            >
              ← Choose a different company
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QualitativeIntro;
