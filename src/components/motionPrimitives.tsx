import React, { useEffect, useRef, useState } from 'react';
import { motion, animate, AnimatePresence, useInView } from 'motion/react';
import { pickMythFactCard, type MythFactChoice } from '../data/mythFactMatch';
import { Hint, HINT_STYLES } from './figuresHint';
import { EYEBROW, LABEL, BODY, UI } from './instrument';
import { LOADING } from '../data/loadingTimeline';

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

// THE REAL STAGES OF THIS WAIT (NAV_SEARCH decision 5: the engine's real
// stages, reported by the developer). The loading screen covers the fetch of
// the filings and nothing else — the model itself is built later, from the
// Model tab — so it has two stages, not five, and its fill moves only when one
// of them has really finished: nothing creeps on a timer (§5.3). PROPOSED —
// needs Nihar: the spec's five names describe a build this screen does not
// run.
const STAGES = ['Reading the filings', 'Checking the filed statements'];

/**
 * THE SCREEN A READER WAITS ON, AND THE ONE CARD IT CARRIES
 * (`docs/NAV_SEARCH_SPEC.md` §5; job 9.3). The timeline is
 * `src/data/loadingTimeline.ts`:
 *
 *   - for the first second, only a 2px rule under the header; a build done
 *     inside it never opens the modal, so a cached answer is not a flash;
 *   - at one second the modal opens, with the belief of one myth-versus-fact
 *     card; its correction follows 2.2 seconds later, or at once if the
 *     filings arrive first, and the screen holds until it has been up 1.2
 *     seconds — scheduled once, never restarted;
 *   - "Taking longer than usual." at 15 seconds;
 *   - Cancel and Esc from the first millisecond.
 *
 * `payload` is this company's filed statements, null until the fetch comes
 * back. Before it lands the card is one whose own condition is only that
 * there is a company; when it lands, the card this company's figures earn
 * (`pickMythFactCard`), but only while the belief is still alone — the
 * correction a reader is reading is never pulled out from under them.
 */
export const BuildPipeline: React.FC<{
  active: boolean;
  payload?: any;
  startedAt?: number;
  doneAt?: number;
  onCancel?: () => void;
}> = ({ active, payload, startedAt, doneAt, onCancel }) => {
  const [seed, setSeed] = useState(0);
  const [modal, setModal] = useState(false);
  const [beliefOnly, setBeliefOnly] = useState(true);
  const [slow, setSlow] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // ONE SCHEDULE PER BUILD, from when it started.
  useEffect(() => {
    if (!active) {
      setSeed(0);
      setModal(false);
      setBeliefOnly(true);
      setSlow(false);
      return;
    }
    const t0 = startedAt ?? Date.now();
    const at = (ms: number) => Math.max(0, t0 + ms - Date.now());
    setSeed(t0);
    const open = window.setTimeout(() => setModal(true), at(LOADING.modalAfterMs));
    const fact = window.setTimeout(() => setBeliefOnly(false), at(LOADING.modalAfterMs + LOADING.beliefAloneMs));
    const late = window.setTimeout(() => setSlow(true), at(LOADING.slowAfterMs));
    return () => {
      window.clearTimeout(open);
      window.clearTimeout(fact);
      window.clearTimeout(late);
    };
  }, [active, startedAt]);

  // The filings arrived before the correction was due: show it now.
  useEffect(() => {
    if (active && doneAt) setBeliefOnly(false);
  }, [active, doneAt]);

  // Esc cancels, from the first millisecond.
  useEffect(() => {
    if (!active || !onCancel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, onCancel]);

  const hasFigures = Boolean(payload?.statements?.length);
  const [choice, setChoice] = useState<MythFactChoice | null>(null);
  useEffect(() => {
    if (!active || !seed) {
      setChoice(null);
      return;
    }
    if (!beliefOnly && choice) return;
    try {
      setChoice(pickMythFactCard(hasFigures ? payload : { statements: [] }, seed));
    } catch {
      setChoice(null);
    }
  }, [active, seed, beliefOnly, hasFigures, payload]);

  if (!active) return null;

  const completed = doneAt ? 1 : 0;
  const step = Math.min(completed + 1, STAGES.length);
  const fill = completed / STAGES.length;
  const card = modal ? choice?.card ?? null : null;
  const Rule: React.FC<{ track: string; fillClass: string; height: string }> = ({ track, fillClass, height }) => (
    <div className={`${height} w-full ${track} overflow-hidden`} aria-hidden="true">
      <div
        data-build-fill={fill}
        className={`${height} w-full ${fillClass} origin-left`}
        style={{ transform: `scaleX(${fill})`, transition: 'transform var(--m-dur-base) var(--m-ease-standard)' }}
      />
    </div>
  );

  // BEFORE THE FIRST SECOND: the page rule, and nothing else.
  if (!modal)
    return (
      <div
        data-build-rule
        role="progressbar"
        aria-label="Building the model"
        aria-valuemin={0}
        aria-valuemax={STAGES.length}
        aria-valuenow={completed}
        className="fixed inset-x-0 top-16 z-50"
      >
        <Rule track="bg-line" fillClass="bg-read" height="h-[2px]" />
      </div>
    );

  return (
    <div
      data-build-modal
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim px-6"
      style={{ animation: 'm-fade-in var(--m-dur-base) var(--m-ease-enter)' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Building the model"
        className="w-full max-w-[640px] max-h-[90vh] overflow-y-auto border border-line bg-panel px-6 pt-10 pb-6 sm:px-8"
      >
        <style>{HINT_STYLES}</style>
        {/* One polite announcement per stage; the card is not announced. */}
        <div role="status" aria-live="polite">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-[13px] font-medium text-muted">Building the model</span>
            <span className="text-[13px] text-muted tabular-nums" data-build-step>
              Step {step} of {STAGES.length}
            </span>
          </div>
          <div className="mt-3">
            <Rule track="bg-line" fillClass="bg-ink" height="h-[2px]" />
          </div>
          <div className="mt-3 text-[13px] text-muted" data-build-stage>
            {STAGES[step - 1]}
          </div>
        </div>

        {/* THE CARD AREA IS A FIXED HEIGHT, so nothing moves when the
            correction arrives (§5.1: 232px, 264px on a phone). */}
        <div data-build-card-area className="mt-5 h-[264px] sm:h-[232px] overflow-hidden" aria-live="off">
          {card && (
            <div data-myth-card={card.id}>
              {/* "Common myth", never "this company": a card is general
                  education, not a finding about whoever is being looked at
                  (standing decision 6). */}
              <div className="text-[13px] text-quiet mb-2">Common myth</div>
              <p data-myth className="font-display text-[20px] font-semibold leading-[1.2]" style={{ color: 'var(--m-muted)' }}>
                &ldquo;{card.myth}&rdquo;
              </p>
              {!beliefOnly && (
                <p
                  data-fact
                  className="mt-4 font-display font-semibold leading-[1.08] text-ink"
                  style={{ fontSize: 'var(--m-size-title)', animation: 'm-fade-in var(--m-dur-base) var(--m-ease-enter)' }}
                >
                  {card.fact}
                  <Hint label="Why that is so">
                    <p>{card.why}</p>
                    <p className="mt-2 text-quiet">
                      {choice?.matched
                        ? `General education, not a verdict on anyone. This card is shown where the filings being read meet — ${card.showWhen}.`
                        : 'General education, not a verdict on anyone. This card is written for any company, so no condition was tested.'}
                    </p>
                  </Hint>
                </p>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 border-t border-line pt-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <div className="text-[13px] text-quiet leading-relaxed">
            {slow ? 'Taking longer than usual.' : 'Reading the filings, running the same engine used for every company'}
          </div>
          {onCancel && (
            <button
              ref={cancelRef}
              type="button"
              data-build-cancel
              onClick={onCancel}
              className="h-11 sm:h-9 w-full sm:w-auto px-4 border border-line-control text-[13px] text-ink hover:border-ink cursor-pointer shrink-0"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

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