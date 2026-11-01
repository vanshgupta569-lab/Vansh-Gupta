// FILE: src/components/staleFigures.tsx
//
// THE ONE WARNING THAT SAYS HOW OLD THE FIGURES ARE (`KI-32`).
//
// One component, used by every screen that presents a company's filed figures,
// because a second copy of a warning is a warning that stops matching the rule
// behind it. The rule itself is in `src/data/figuresAge.ts`; this is only how
// it looks.
//
// It is a band rather than a toast or a tooltip: it has to be on the screen
// whether or not the reader hovers anything, and it has to be impossible to
// mistake for one of the figures. Amber rather than oxblood — the figures are
// real and the company is not being refused, so this is a caution about their
// date and not an error (DESIGN.md rations oxblood to the one action or the one
// thing that changed).
import React from 'react';
import { figuresAge } from '../data/figuresAge';
import { EYEBROW, UI } from './instrument';

interface Props {
  payload: any;
  /** Fixed for a check; the real screens leave it to the clock. */
  today?: Date;
  className?: string;
}

export const StaleFigures: React.FC<Props> = ({ payload, today, className }) => {
  const age = figuresAge(payload, today);
  if (!age.stale) return null;
  return (
    <div
      data-stale-figures={String(age.latestFiscalYear)}
      data-months-behind={String(age.monthsBehind)}
      role="note"
      className={`border border-amber/50 bg-panel px-5 py-3 lg:px-6 ${className ?? ''}`}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className={`${EYEBROW} whitespace-nowrap text-amber`}>{age.label}</span>
        <span className={`${UI} text-read`}>{age.detail}</span>
      </div>
    </div>
  );
};
