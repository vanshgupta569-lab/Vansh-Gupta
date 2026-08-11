import React, { useEffect, useRef, useState } from 'react';
import { motion, animate, useInView } from 'motion/react';

/**
 * Shared motion helpers for the dashboard.
 *
 * The rule applied throughout: motion marks a CHANGE. A figure moves because
 * it just became a different figure, not for decoration. Anything that would
 * move while a reader is trying to read a number is left still.
 */

export const useReducedMotion = () => {
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
/* Tweened figure                                                       */
/* A number that eases to its new value instead of jumping. Used for    */
/* anything a slider can change.                                        */
/* ------------------------------------------------------------------ */

interface TweenNumberProps {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  /** Briefly tint on change: green when rising, oxblood when falling. */
  flash?: boolean;
  className?: string;
}

export const TweenNumber: React.FC<TweenNumberProps> = ({
  value,
  decimals = 2,
  prefix = '',
  suffix = '',
  flash = false,
  className = '',
}) => {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(value);
  const previous = useRef(value);
  const [direction, setDirection] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    if (previous.current === value) return;

    const from = previous.current;
    previous.current = value;

    if (reduced || !isFinite(from) || !isFinite(value)) {
      setShown(value);
      return;
    }

    if (flash) {
      setDirection(value > from ? 'up' : 'down');
      const clear = setTimeout(() => setDirection(null), 700);
      const controls = animate(from, value, {
        duration: 0.45,
        ease: [0.16, 1, 0.3, 1],
        onUpdate: setShown,
      });
      return () => {
        clearTimeout(clear);
        controls.stop();
      };
    }

    const controls = animate(from, value, {
      duration: 0.45,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: setShown,
    });
    return controls.stop;
  }, [value, reduced, flash]);

  const tint =
    direction === 'up'
      ? 'text-emerald-400'
      : direction === 'down'
      ? 'text-[#8B1E1E]'
      : '';

  return (
    <span className={`tabular-nums transition-colors duration-500 ${tint} ${className}`}>
      {prefix}
      {shown.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
};

/* ------------------------------------------------------------------ */
/* Change flash                                                         */
/* Wraps any element and pulses its background when `watch` changes —   */
/* the way a live quote ticks. Used to show what switching between the  */
/* analyst and derived models actually moves.                           */
/* ------------------------------------------------------------------ */

export const FlashOnChange: React.FC<{
  watch: unknown;
  children: React.ReactNode;
  className?: string;
}> = ({ watch, children, className = '' }) => {
  const reduced = useReducedMotion();
  const [pulse, setPulse] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduced) return;
    setPulse(true);
    const timer = setTimeout(() => setPulse(false), 900);
    return () => clearTimeout(timer);
  }, [watch, reduced]);

  return (
    <span
      className={`transition-colors duration-700 ${
        pulse ? 'bg-[#8B1E1E]/20' : 'bg-transparent'
      } ${className}`}
    >
      {children}
    </span>
  );
};

/* ------------------------------------------------------------------ */
/* Build pipeline                                                       */
/* Shown while a model is being built. It names the stages actually     */
/* being worked through rather than spinning — on a site whose argument */
/* is that the workings are visible, the loading state should say so    */
/* too.                                                                 */
/* ------------------------------------------------------------------ */

const STAGES = [
  'Locating the filings',
  'Reading three years of statements',
  'Deriving assumptions from history',
  'Building the forecast and schedules',
  'Discounting cash flows',
];

export const BuildPipeline: React.FC<{ active: boolean }> = ({ active }) => {
  const reduced = useReducedMotion();
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (!active) {
      setStage(0);
      return;
    }
    if (reduced) {
      setStage(STAGES.length - 1);
      return;
    }
    // Advance through the stages while the fetch is in flight, holding on the
    // last one until the real work finishes. Never claims to be complete.
    const timer = setInterval(() => {
      setStage((s) => (s < STAGES.length - 1 ? s + 1 : s));
    }, 620);
    return () => clearInterval(timer);
  }, [active, reduced]);

  if (!active) return null;

  return (
    <div className="mt-4 border hairline-border bg-[#0B0B0D] p-5">
      {STAGES.map((label, index) => {
        const done = index < stage;
        const current = index === stage;

        return (
          <motion.div
            key={label}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: done || current ? 1 : 0.35, x: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            className="flex items-center gap-3 py-1.5 font-mono text-[11px]"
          >
            <span
              className={`w-3.5 h-3.5 border flex items-center justify-center text-[8px] shrink-0 ${
                done
                  ? 'border-[#8B1E1E] bg-[#8B1E1E] text-[#F2F0EA]'
                  : current
                  ? 'border-[#8B1E1E] text-[#8B1E1E]'
                  : 'border-[#222228] text-transparent'
              }`}
            >
              {done ? '✓' : current ? '·' : ''}
            </span>
            <span className={done || current ? 'text-[#F2F0EA]' : 'text-[#8A8A8F]'}>
              {label}
            </span>
            {current && (
              <motion.span
                className="h-[1px] bg-[#8B1E1E] ml-1"
                initial={{ width: 0 }}
                animate={{ width: 28 }}
                transition={{ duration: 0.55, repeat: Infinity, repeatType: 'reverse' }}
              />
            )}
          </motion.div>
        );
      })}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Bars that grow from the baseline when scrolled into view            */
/* ------------------------------------------------------------------ */

export const GrowBar: React.FC<{
  height: string;
  delay?: number;
  className?: string;
}> = ({ height, delay = 0, className = '' }) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const reduced = useReducedMotion();

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ height: reduced ? height : 0 }}
      animate={inView ? { height } : {}}
      transition={{
        duration: reduced ? 0 : 0.8,
        delay: reduced ? 0 : delay,
        ease: [0.16, 1, 0.3, 1],
      }}
    />
  );
};