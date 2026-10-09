import React, { useEffect, useRef, useState } from 'react';
import { motion, animate, AnimatePresence, useInView } from 'motion/react';
import { noteOrder } from '../data/didYouKnow';
import type { DidYouKnow } from '../data/didYouKnow';
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

// HOW LONG ONE NOTE HOLDS THE SCREEN.
//
// Long enough to read a belief, a correction and the mechanism behind it
// without hurrying, and short enough that a slow build does not become one
// sentence stared at for half a minute. The five stages above take 4.5 seconds
// to walk through, so a build that finishes normally shows one note and a build
// that drags shows a new one roughly every stage-and-a-half after that.
const NOTE_MS = 6500;

export const BuildPipeline: React.FC<{ active: boolean }> = ({ active }) => {
  const reduced = useReducedMotion();
  const [stage, setStage] = useState(0);
  // A fresh order per build, drawn when the overlay opens rather than when the
  // module loads, so the notes are not the same every time in one session.
  const [notes, setNotes] = useState<DidYouKnow[]>([]);
  const [noteIndex, setNoteIndex] = useState(0);

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
      setNoteIndex(0);
      return;
    }
    setNotes(noteOrder());
    setNoteIndex(0);
    // Reduced motion suppresses movement, not information: the note still
    // changes, it simply does not fade while it does. A reader who waits
    // twenty seconds gets three notes either way.
    const timer = setInterval(
      () => setNoteIndex((i) => i + 1),
      NOTE_MS
    );
    return () => clearInterval(timer);
  }, [active]);

  if (!active) return null;

  // Wraps rather than stopping, so a build slow enough to exhaust the order
  // starts again rather than holding the last note for the rest of the wait.
  const note = notes.length ? notes[noteIndex % notes.length] : null;

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

        {/* ---- THE NOTE, WHICH IS WHY THIS SCREEN IS WORTH LOOKING AT ------
            It was below the checklist, in 12px grey, under an eyebrow reading
            "While you wait" — which is an apology for the wait rather than a
            reason to read. A reader who has just asked for a valuation is
            exactly the reader for whom one correction about how accounts behave
            is worth having, so it is the content of the card now and the
            progress is the furniture.

            `aria-live` is off deliberately: the card announces its progress, and
            a note changing every six seconds would talk over it. */}
        {note && (
          <div aria-live="off">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={note.key}
                initial={reduced ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? undefined : { opacity: 0, y: -6 }}
                transition={{ duration: reduced ? 0 : 0.35, ease: 'easeOut' }}
              >
                <p className={`${BODY} text-muted italic`}>{note.belief}</p>
                {/* The fact is the headline of this screen, so it is set like
                    one: the display face, at a size that carries the card. */}
                <p className="mt-3 font-display text-[clamp(1.25rem,2.4vw,1.75rem)] font-medium leading-[1.2] tracking-tight text-ink">
                  {note.fact}
                </p>
                <p className={`${BODY} mt-3.5 text-read`}>{note.why}</p>
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