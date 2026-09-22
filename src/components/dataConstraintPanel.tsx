// FILE: src/components/dataConstraintPanel.tsx
//
// What the source does not give us, told to the reader twice: once above the
// model, before any number has been read, and once beside the working, where
// someone checking the figures will look.
//
// The banner is deliberately not dismissible. A reader who has scrolled past it
// and is looking at a number needs the same warning next to that number, which
// is what the panel below the valuation is for.
import { AlertTriangle, Info } from 'lucide-react';
import type { DataConstraint } from '../types';

const pct = (v: number) => `${(Math.abs(v) * 100).toFixed(1)}%`;

/** The size of the error, as a short tag beside the heading. */
function sizeTag(c: DataConstraint): string {
  if (c.bound === null) return 'size not knowable';
  if (Math.abs(c.bound) < 0.0005) return 'no effect on the value';
  return `up to ${pct(c.bound)} of the value`;
}

/**
 * Above the model. Only the constraints that could move the value materially,
 * so the banner never cries wolf about a line that changes nothing.
 */
export function DataConstraintBanner({
  constraints,
  onSeeDetail,
}: {
  constraints: DataConstraint[];
  onSeeDetail?: () => void;
}) {
  const shown = constraints.filter((c) => c.severity === 'warning' || c.severity === 'refusal');
  if (!shown.length) return null;

  return (
    <div className="bg-[#1A1207] border border-[#5C4415] p-4 px-5 mb-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-[#C79A2E] mt-0.5 shrink-0" />
        <div className="min-w-0">
          <div className="font-mono text-[10px] text-[#C79A2E] uppercase tracking-widest mb-2">
            {shown.length === 1
              ? 'One figure this model needs is not published'
              : `${shown.length} figures this model needs are not published`}
          </div>
          <ul className="space-y-2">
            {shown.map((c) => (
              <li key={c.code} className="text-[12px] leading-relaxed text-[#E6E1D6]">
                <span className="font-semibold">{c.label}.</span>{' '}
                <span className="text-[#A1A1AA]">{c.effect}.</span>
              </li>
            ))}
          </ul>
          <div className="font-mono text-[10px] text-[#8A8A8F] mt-3 leading-relaxed">
            These are gaps in what the source publishes, not faults in the company and not
            assumptions the model chose. Where one could move the value per share further than the
            two terminal methods ordinarily disagree, no value is shown at all.
            {onSeeDetail && (
              <button
                type="button"
                onClick={onSeeDetail}
                className="ml-2 underline underline-offset-2 text-[#C79A2E] hover:text-[#F2F0EA] cursor-pointer"
              >
                See what each one does
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Beside the working. Everything, including the constraints that cannot move a
 * value, because a reader checking the model is entitled to the whole list.
 */
export function DataConstraintPanel({ constraints }: { constraints: DataConstraint[] }) {
  if (!constraints.length) return null;
  const order = { refusal: 0, warning: 1, note: 2 } as const;
  const sorted = [...constraints].sort((a, b) => order[a.severity] - order[b.severity]);

  return (
    <section id="data-constraints" className="scroll-mt-24 bg-[#111114] border hairline-border p-6 lg:p-8 mb-6">
      <h2 className="font-display text-2xl text-[#F2F0EA] tracking-tight mb-1">
        What the source does not give us
      </h2>
      <p className="text-[13px] leading-relaxed text-[#A1A1AA] max-w-3xl mb-6">
        Figures the filing or the data source never publishes. No amount of modelling can conjure
        them, so each is named here with the largest effect it could have on the value per share,
        measured against what the filing does report. Where that is more than a quarter of the
        value, no valuation is shown at all.
      </p>

      <div className="space-y-4">
        {sorted.map((c) => (
          <div
            key={c.code}
            className={`border p-4 ${
              c.severity === 'refusal'
                ? 'border-[#8B1E1E] bg-[#1A0B0B]'
                : c.severity === 'warning'
                ? 'border-[#5C4415] bg-[#14100A]'
                : 'hairline-border bg-[#0B0B0D]'
            }`}
          >
            <div className="flex items-start gap-3">
              {c.severity === 'note' ? (
                <Info className="w-4 h-4 text-[#8A8A8F] mt-0.5 shrink-0" />
              ) : (
                <AlertTriangle
                  className={`w-4 h-4 mt-0.5 shrink-0 ${
                    c.severity === 'refusal' ? 'text-[#C0392B]' : 'text-[#C79A2E]'
                  }`}
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-1.5">
                  <span className="text-[14px] text-[#F2F0EA] font-semibold">{c.label}</span>
                  <span className="font-mono text-[10px] text-[#8A8A8F] uppercase tracking-widest">
                    {sizeTag(c)}
                  </span>
                  <span className="font-mono text-[10px] text-[#8A8A8F] uppercase tracking-widest">
                    {c.severity === 'refusal'
                      ? 'no value shown'
                      : c.severity === 'warning'
                      ? 'warned'
                      : 'noted'}
                  </span>
                </div>
                <p className="text-[12px] leading-relaxed text-[#A1A1AA]">{c.detail}</p>
                <p className="text-[12px] leading-relaxed text-[#A1A1AA] mt-1.5">
                  <span className="text-[#8A8A8F]">Effect: </span>
                  {c.effect}.
                </p>
                <p className="font-mono text-[10px] text-[#8A8A8F] mt-2 uppercase tracking-wider">
                  Source: {c.source}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="font-mono text-[10px] text-[#8A8A8F] mt-6 leading-relaxed max-w-3xl">
        The thresholds: more than 25% of the value per share and no value is shown, because that is
        further than the site's two terminal methods ordinarily disagree; more than 5% and the
        reader is warned above the model and here; below that it is listed but nothing is flagged.
        DATA_CONSTRAINTS.md records every constraint and which source it comes from.
      </p>
    </section>
  );
}

export default { DataConstraintBanner, DataConstraintPanel };
