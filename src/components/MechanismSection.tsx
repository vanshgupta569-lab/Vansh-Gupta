import React, { useEffect, useRef, useState } from 'react';
import { motion, useInView, animate } from 'motion/react';

/**
 * MechanismSection
 *
 * Two animations that demonstrate how the engine works, using no company's
 * figures at all. The bars are proportions, not amounts: no ticker, no
 * currency, no axis. What is being shown is the mechanism, which is identical
 * for every company on the site — so nothing here privileges one over another,
 * and nothing here is a number that could be wrong.
 *
 * Motion is disabled entirely for anyone who has asked their system to reduce
 * it; they see the finished state immediately.
 */

const useReducedMotion = () => {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.matches);
    const listen = (e: MediaQueryListEvent) => setReduced(e.matches);
    query.addEventListener('change', listen);
    return () => query.removeEventListener('change', listen);
  }, []);
  return reduced;
};

/* ------------------------------------------------------------------ */
/* 1. DISCOUNTING                                                       */
/* Five equal bars, one per forecast year, each shrinking to what it is */
/* worth today. The discount factor is a pure ratio — true of every     */
/* company, belonging to none.                                          */
/* ------------------------------------------------------------------ */

const DISCOUNT_RATE = 0.09;
const YEARS = [1, 2, 3, 4, 5];

const DiscountingFigure: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const reduced = useReducedMotion();
  const [progress, setProgress] = useState(0); // 0 = undiscounted, 1 = present value

  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      setProgress(1);
      return;
    }
    const controls = animate(0, 1, {
      duration: 2.6,
      delay: 0.35,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: setProgress,
    });
    return controls.stop;
  }, [inView, reduced]);

  return (
    <div ref={ref}>
      <div className="flex items-end justify-between gap-3 sm:gap-5 h-64">
        {YEARS.map((year, index) => {
          const factor = 1 / Math.pow(1 + DISCOUNT_RATE, year);
          // Interpolate from full height to the discounted height.
          const height = 100 - (100 - factor * 100) * progress;
          const shown = 1 - (1 - factor) * progress;

          return (
            <div key={year} className="flex-1 flex flex-col items-center justify-end h-full min-w-0">
              {/* One dashed frame per year, always full height, standing for the
                  undiscounted cash flow. The solid bar fills it from the bottom.
                  Drawing it this way means every frame is identical by
                  construction — stacking a separate box on top of each bar left
                  their top edges a fraction of a pixel apart. */}
              <div className="w-full flex-1 min-h-0 border border-dashed border-[#8B1E1E]/30 flex flex-col justify-end">
                <div
                  className="w-full bg-[#8B1E1E]"
                  style={{ height: `${height}%`, transition: 'none' }}
                />
              </div>

              <div className="font-mono text-[10px] text-[#8A8A8F] mt-3 tracking-widest">
                Y{year}
              </div>
              <div className="font-mono text-[10px] text-[#F2F0EA] mt-1 tabular-nums">
                {shown.toFixed(2)}
              </div>
            </div>
          );
        })}
      </div>

      <div className="font-mono text-[10px] text-[#8A8A8F] uppercase tracking-widest mt-5 pt-4 hairline-border-t">
        Discount factor at {(DISCOUNT_RATE * 100).toFixed(0)}% · illustrative rate
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* 2. THE BALANCE IDENTITY                                              */
/* Two columns rising to exactly the same height. The engine checks     */
/* this in every forecast year of every company it builds.              */
/* ------------------------------------------------------------------ */

const BalanceFigure: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const reduced = useReducedMotion();

  const rise = {
    hidden: { height: '0%' },
    shown: { height: '100%' },
  };

  // Both branches carry the same keys, so `delay` can be read safely below.
  // A union where one branch lacks `delay` fails the production build even
  // though the dev server tolerates it.
  const baseDelay = reduced ? 0 : 0.3;
  const transition = {
    duration: reduced ? 0 : 1.5,
    ease: [0.16, 1, 0.3, 1] as const,
    delay: baseDelay,
  };

  // Both columns are the same height; only the split inside them differs.
  // The segments must all be clearly visible, or the eye reads just the solid
  // portions — which ARE different sizes — and concludes the sides are unequal.
  const columns = [
    {
      label: 'Assets',
      segments: [
        { share: 58, name: 'Current', tone: 'bg-[#8B1E1E]' },
        { share: 42, name: 'Non-current', tone: 'bg-[#8B1E1E]/55' },
      ],
    },
    {
      label: 'Liabilities + Equity',
      segments: [
        { share: 37, name: 'Liabilities', tone: 'bg-[#8B1E1E]' },
        { share: 63, name: 'Equity', tone: 'bg-[#8B1E1E]/55' },
      ],
    },
  ];

  return (
    <div ref={ref}>
      {/* The bars and the labels are kept in separate rows on purpose. With the
          label inside the column, a label that wraps to two lines lifts its own
          bar off the floor — which is exactly the wrong thing to happen in a
          panel about two sides being equal. */}
      <div className="flex items-end justify-center gap-8 sm:gap-14 h-56 relative">
        {/* The line both sides must reach */}
        <motion.div
          className="absolute left-0 right-0 top-0 border-t border-dashed border-[#8B1E1E]/40"
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: reduced ? 0 : 1.7, duration: 0.5 }}
        />

        {columns.map((column, columnIndex) => (
          <div key={column.label} className="flex-1 max-w-[130px] h-full flex flex-col justify-end">
            <motion.div
              className="w-full flex flex-col-reverse border border-[#8B1E1E]/70"
              variants={rise}
              initial="hidden"
              animate={inView ? 'shown' : 'hidden'}
              transition={{ ...transition, delay: baseDelay + columnIndex * 0.15 }}
            >
              {column.segments.map((segment, segmentIndex) => (
                <div
                  key={segment.name}
                  style={{ height: `${segment.share}%` }}
                  className={`${segment.tone} w-full flex items-center justify-center overflow-hidden ${
                    segmentIndex === 1 ? 'border-b border-[#0B0B0D]/60' : ''
                  }`}
                >
                  <span className="font-mono text-[8px] text-[#F2F0EA]/80 uppercase tracking-widest px-1 truncate">
                    {segment.name}
                  </span>
                </div>
              ))}
            </motion.div>
          </div>
        ))}

        {/* The equals sign, once both sides have settled */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ delay: reduced ? 0 : 1.9, duration: 0.5, ease: 'easeOut' }}
        >
          <span className="font-display text-3xl text-[#F2F0EA] bg-[#111114] px-3 leading-none">
            =
          </span>
        </motion.div>
      </div>

      {/* Labels in their own row, so wrapping cannot move the bars */}
      <div className="flex items-start justify-center gap-8 sm:gap-14 mt-3">
        {columns.map((column) => (
          <div
            key={column.label}
            className="flex-1 max-w-[130px] font-mono text-[10px] text-[#8A8A8F] tracking-widest uppercase text-center leading-snug"
          >
            {column.label}
          </div>
        ))}
      </div>

      <div className="font-mono text-[10px] text-[#8A8A8F] uppercase tracking-widest mt-5 pt-4 hairline-border-t">
        Checked in every forecast year, for every company
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */

export const MechanismSection: React.FC = () => {
  const headingRef = useRef<HTMLDivElement>(null);
  const headingInView = useInView(headingRef, { once: true, margin: '-100px' });

  return (
    <section
      id="mechanism"
      className="max-w-[1440px] mx-auto px-6 lg:px-12 py-20 hairline-border-b overflow-hidden"
    >
      <div ref={headingRef}>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={headingInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="flex items-center gap-3 mb-3"
        >
          <span className="w-2 h-2 bg-[#8B1E1E]" />
          <span className="font-mono text-[11px] text-[#8A8A8F] tracking-[0.2em] uppercase">
            03 — HOW A VALUATION IS BUILT
          </span>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={headingInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.1, ease: 'easeOut' }}
          className="font-display text-3xl sm:text-4xl lg:text-5xl text-[#F2F0EA] font-medium leading-tight max-w-3xl"
        >
          Two rules the engine never breaks.
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          animate={headingInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.7, delay: 0.25 }}
          className="font-sans text-base font-light text-[#A1A1AA] leading-relaxed max-w-2xl mt-5"
        >
          Every model on this site is built the same way, whichever company you
          search for. No figures are shown here: these are the mechanics, and
          they hold for all of them.
        </motion.p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 mt-14">
        <div className="border hairline-border bg-[#111114] p-7 sm:p-9 shadow-lg">
          <div className="font-mono text-[11px] text-[#8B1E1E] tracking-widest uppercase mb-2">
            A rupee later is worth less now
          </div>
          <p className="font-sans text-sm font-light text-[#A1A1AA] leading-relaxed mb-8 max-w-md">
            Forecast cash flows are pulled back to what they are worth today.
            The further out a year sits, the less of it survives the journey.
          </p>
          <DiscountingFigure />
        </div>

        <div className="border hairline-border bg-[#111114] p-7 sm:p-9 shadow-lg">
          <div className="font-mono text-[11px] text-[#8B1E1E] tracking-widest uppercase mb-2">
            The two sides must agree
          </div>
          <p className="font-sans text-sm font-light text-[#A1A1AA] leading-relaxed mb-8 max-w-md">
            What a business owns has to equal what it owes plus what its owners
            hold. If a forecast year fails this test, the model is wrong.
          </p>
          <BalanceFigure />
        </div>
      </div>
    </section>
  );
};

export default MechanismSection;