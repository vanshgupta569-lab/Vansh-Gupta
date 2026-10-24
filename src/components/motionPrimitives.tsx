import React, { useEffect, useRef, useState } from 'react';
import { motion, animate, AnimatePresence, useInView } from 'motion/react';
import { pickMythFactCard, type MythFactChoice } from '../data/mythFactMatch';
import { Hint, HINT_STYLES } from './figuresHint';
import { EYEBROW, LABEL, BODY, UI } from './instrument';

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
  'Reading the filed statements',
  'Deriving assumptions from history',
  'Building the forecast and schedules',
  'Discounting cash flows',
];

// HOW LONG THE MYTH HOLDS THE SCREEN ON ITS OWN.
//
// The card is read in two beats: the belief, then what is actually the
// case. Printing both at once makes the fact a caption on the myth; a
// reader who has seen the myth alone for a moment has had the chance to
// agree with it, which is the only thing that makes the correction land.
// Long enough to read nine words, short enough that the second beat is
// still inside a quick build.
const MYTH_ALONE_MS = 2200;

// HOW LONG ONE NOTE HOLDS THE SCREEN.
//
// Long enough to read a belief, a correction and the mechanism behind it
// without hurrying, and short enough that a slow build does not become one
// sentence stared at for half a minute. The five stages above take 4.5 seconds
// to walk through, so a build that finishes normally shows one note and a build
// that drags shows a new one roughly every stage-and-a-half after that.
const NOTE_MS = 6500;

/**
 * THE SCREEN A READER WAITS ON, AND THE ONE CARD IT CARRIES.
 *
 * `payload` is this company's filed statements, and it is null until the
 * fetch comes back — which is most of the wait. So the card arrives in two
 * parts, and both are honest at the moment they are shown:
 *
 *   BEFORE THE FIGURES LAND, a card whose own condition is that there is a
 *   company. Three of the sixty say exactly that, so showing one is not a
 *   claim about this company that we cannot yet support.
 *
 *   WHEN THEY LAND, the card this company's own figures earn — chosen by
 *   `pickMythFactCard`, which tests every condition against the filing and
 *   treats a line it cannot read as unknown rather than as nil.
 *
 * That is also what keeps the screen from holding one thing for a whole
 * slow build, which `verify:dashboard` has asserted since the notes: the
 * myth gives way to the fact, and the general card gives way to this
 * company's.
 */
export const BuildPipeline: React.FC<{ active: boolean; payload?: any }> = ({ active, payload }) => {
  const reduced = useReducedMotion();
  const [stage, setStage] = useState(0);
  // Drawn when the overlay opens rather than when the module loads, so two
  // builds in one session are not the same card.
  const [seed, setSeed] = useState(0);
  const [showFact, setShowFact] = useState(false);

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
    }, 900);
    return () => clearInterval(timer);
  }, [active, reduced]);

  useEffect(() => {
    if (!active) {
      setSeed(0);
      setShowFact(false);
      return;
    }
    setSeed(Date.now());
    setShowFact(false);
    // Reduced motion suppresses movement, not information: the fact still
    // arrives, it simply does not fade in while it does.
    const timer = setTimeout(() => setShowFact(true), reduced ? 0 : MYTH_ALONE_MS);
    return () => clearTimeout(timer);
  }, [active, reduced]);

  // THE FIGURES ARRIVING RESTART THE READING, because the card has changed:
  // the general one gives way to this company's, and a fact already on
  // screen under a myth that is no longer there would be a non sequitur.
  const hasFigures = Boolean(payload?.statements?.length);
  useEffect(() => {
    if (!active || !hasFigures) return;
    setShowFact(false);
    const timer = setTimeout(() => setShowFact(true), reduced ? 0 : MYTH_ALONE_MS);
    return () => clearTimeout(timer);
  }, [active, hasFigures, reduced]);

  const choice: MythFactChoice | null = React.useMemo(() => {
    if (!active || !seed) return null;
    try {
      return pickMythFactCard(payload?.statements?.length ? payload : { statements: [] }, seed);
    } catch {
      return null;
    }
  }, [active, seed, hasFigures, payload]);

  if (!active) return null;

  const card = choice?.card ?? null;

  // Rendered as a centred overlay rather than inline. Inline, it sits below the
  // suggestion list and lands off-screen exactly when the user has just picked
  // a company — so the one moment it matters is the one moment it is unseen.
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0B0D]/85 backdrop-blur-sm px-6"
      role="status"
      aria-live="polite"
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        /* A note adds four lines to a card that was already five stages tall,
           so a short phone viewport gets something to scroll rather than
           losing the bottom of it. */
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto border border-line bg-panel p-7 shadow-2xl sm:p-9"
      >
        <style>{HINT_STYLES}</style>
        {/* ---- THE PROGRESS, REDUCED TO ONE LINE --------------------------
            Five labelled rows with ticks and a pulsing underline took the
            middle of the card, and they are the dull part: a reader cannot act
            on "Discounting cash flows" and does not need the stage named at all
            — only to know the thing is alive and roughly how far along. So the
            five rows are one rule that fills, with the current stage named
            beside it in the quietest type on the card.

            The stage names are kept because the argument of this site is that
            the workings are visible, and a progress bar that says nothing about
            what it is doing is the opposite of that. They are just no longer
            the loudest thing here. */}
        <div className="mb-7">
          <div className="mb-2.5 flex items-baseline justify-between gap-4">
            <span className={`${EYEBROW} text-quiet`}>Building the model</span>
            <span className={`${EYEBROW} text-quiet tabular-nums`}>
              {Math.min(stage + 1, STAGES.length)}/{STAGES.length}
            </span>
          </div>
          {/* CAPPED SHORT OF FULL, because the work is not finished when the
              last stage is reached — the stage walk takes 4.5 seconds and then
              holds while the fetch is still outstanding, which on a slow build
              is most of the wait. A bar sitting at 100% for ten seconds says
              the thing is done and broken. The old checklist was careful about
              this (it held on the last stage rather than ticking it off) and
              the bar keeps that promise: it never claims to be complete. */}
          <div className="h-px w-full bg-line" aria-hidden="true">
            <motion.div
              className="h-px bg-accent"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(((stage + 1) / STAGES.length) * 100, 92)}%` }}
              transition={{ duration: reduced ? 0 : 0.5, ease: 'easeOut' }}
            />
          </div>
          <div className={`${UI} mt-2.5 text-quiet`}>{STAGES[stage]}</div>
        </div>

        {/* ---- THE CARD, WHICH IS WHY THIS SCREEN IS WORTH LOOKING AT ------
            A reader who has just asked for a valuation is exactly the reader
            for whom one correction about how accounts behave is worth having,
            so it is the content of the card and the progress is the furniture.

            THE WHY IS BEHIND THE ⓘ, not printed under the fact. Three
            paragraphs on a screen somebody is waiting to leave is three
            paragraphs nobody reads; the mechanism is there for the reader who
            wants it, on hover, on keyboard focus and on a tap.

            `aria-live` is off deliberately: the card announces its progress,
            and a card changing underneath would talk over it. */}
        {card && (
          <div aria-live="off" data-myth-card={card.id}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={card.id}
                initial={reduced ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? undefined : { opacity: 0, y: -6 }}
                transition={{ duration: reduced ? 0 : 0.35, ease: 'easeOut' }}
              >
                <p className={`${BODY} text-muted italic`} data-myth>
                  {card.myth}
                </p>
                {/* The fact is the headline of this screen, so it is set like
                    one: the display face, at a size that carries the card.
                    Its row is held open before it arrives so the card does not
                    jump when it does. */}
                <div className="mt-3 min-h-[2.4em]">
                  <AnimatePresence initial={false}>
                    {showFact && (
                      <motion.p
                        data-fact
                        initial={reduced ? false : { opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: reduced ? 0 : 0.35, ease: 'easeOut' }}
                        className="font-display text-[clamp(1.25rem,2.4vw,1.75rem)] font-medium leading-[1.2] tracking-tight text-ink"
                      >
                        {card.fact}
                        <Hint label="Why that is so">
                          <p>{card.why}</p>
                          <p className="mt-2 text-quiet">
                            {choice?.matched
                              ? `Shown because this company's filed figures meet: ${card.showWhen}.`
                              : 'Shown for any company: this one\u2019s figures earned no card of their own.'}
                          </p>
                        </Hint>
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        )}

        {/* Sentence case, not the tracked uppercase the eyebrows use. At 13px
            with 0.16em tracking this ran to three shouting lines on a phone,
            for the least important sentence on the card. */}
        <div className={`${UI} mt-7 border-t border-line pt-4 leading-relaxed text-quiet`}>
          Reading the filings, running the same engine used for every company
        </div>
      </motion.div>
    </motion.div>
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