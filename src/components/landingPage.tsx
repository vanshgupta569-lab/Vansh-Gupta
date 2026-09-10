// FILE: src/components/landingPage.tsx
//
// The landing page, whole.
//
// Everything lives in one file on purpose: the page is pasted into GitHub by
// hand, and one paste is one chance to get it wrong instead of ten. Sections
// appear in the order they appear on screen.
//
// THREE RULES THIS PAGE IS BUILT ON
//
// 1. No data. Not one company figure anywhere. A landing page showing a real
//    company's numbers is cluttered, goes stale the moment it is written, and
//    invites a reader to check a figure that was only ever illustrative. The
//    product is shown by what it DOES, never by pasting its output here.
//
// 2. Nothing is explained in prose that could be shown instead. Every section
//    is under forty words of body text.
//
// 3. One visual idea, carried the whole way down: a ruled page with a margin.
//    The site is called Marginalia — notes written in the margin — and that is
//    the hero, the shape of the "how it works" section, and the centrepiece.
//    A page feels designed rather than assembled when one idea runs through it.
//
// TYPE
// Headlines are Inter, set very tight and heavy. Playfair was carrying the
// whole page and at display sizes an editorial serif reads as a magazine
// rather than an institution. Playfair is kept for the three places it earns:
// the wordmark, the Keynes quote, and the margin notes.

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useInView, useScroll, useMotionValueEvent, animate } from 'motion/react';
import { Play } from 'lucide-react';

/* ================================================================== */
/* Shared furniture                                                    */
/* ================================================================== */

export type Ground = 'dark' | 'cream';

export const GROUND = {
  dark: {
    bg: '#0B0B0D',
    panel: '#111114',
    text: '#F2F0EA',
    body: '#C6C1B7',
    label: '#A8A29A',
    hairline: '#262521',
  },
  cream: {
    bg: '#F2F0EA',
    panel: '#FFFFFF',
    text: '#16150F',
    body: '#3A382F',
    label: '#6B6759',
    hairline: '#DAD6CC',
  },
} as const;

export const RED = '#8B1E1E';
export const RED_TEXT = '#C0453E';

/* The display face. Inter, tightened hard. The tracking is what does the
   work: at -0.04em a grotesque stops looking like body text set large and
   starts looking like a masthead. */
const DISPLAY: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 700,
  letterSpacing: '-0.04em',
  lineHeight: 0.98,
};

export const useReduced = () => {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const q = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(q.matches);
    const on = (e: MediaQueryListEvent) => setReduced(e.matches);
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);
  return reduced;
};

/* ------------------------------------------------------------------ */
/* Eased scrolling                                                     */
/*                                                                     */
/* This is the single largest part of what reads as "premium" on the   */
/* sites he compared this one to. Their page loads a scroll library;    */
/* this does the same job in thirty lines and adds no dependency, so    */
/* there is no package to install and nothing that can fail a deploy.   */
/*                                                                     */
/* Three deliberate limits. It only touches the WHEEL, so keyboard,     */
/* scrollbar dragging and anchor jumps behave exactly as before. It     */
/* stands aside whenever the pointer is over something that scrolls on  */
/* its own, which is what keeps the full-screen model panels working.   */
/* And it never runs on touch, because a phone's own momentum scrolling */
/* is better than anything reimplemented here.                          */
/* ------------------------------------------------------------------ */

export const useEasedScroll = (enabled: boolean) => {
  const reduced = useReduced();

  useEffect(() => {
    if (!enabled || reduced) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;

    let target = window.scrollY;
    let frame = 0;
    let running = false;

    const scrollableAncestor = (node: EventTarget | null) => {
      let el = node as HTMLElement | null;
      while (el && el !== document.body && el !== document.documentElement) {
        const style = getComputedStyle(el);
        const scrolls = /(auto|scroll)/.test(style.overflowY);
        if (scrolls && el.scrollHeight > el.clientHeight + 2) return true;
        el = el.parentElement;
      }
      return false;
    };

    const step = () => {
      const current = window.scrollY;
      const distance = target - current;
      if (Math.abs(distance) < 0.4) {
        window.scrollTo(0, target);
        running = false;
        return;
      }
      // A single lerp. 0.12 is slow enough to read as weight and fast
      // enough that the page never feels like it is lagging behind.
      window.scrollTo(0, current + distance * 0.12);
      frame = requestAnimationFrame(step);
    };

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return;
      if (scrollableAncestor(event.target)) return;

      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (!running) target = window.scrollY;
      target = Math.max(0, Math.min(max, target + event.deltaY));
      event.preventDefault();

      if (!running) {
        running = true;
        frame = requestAnimationFrame(step);
      }
    };

    // Anything that moves the page by other means resets the target, so the
    // next wheel tick continues from where the reader actually is.
    const resync = () => {
      if (!running) target = window.scrollY;
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', resync);
    window.addEventListener('resize', resync);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', resync);
      window.removeEventListener('resize', resync);
    };
  }, [enabled, reduced]);
};

/* ------------------------------------------------------------------ */
/* Section                                                             */
/*                                                                     */
/* `stack` is the overlap he could not see happening. A negative margin */
/* alone is almost invisible: the section below simply starts a little  */
/* higher. What makes it read on the reference site is that the section */
/* ABOVE stops moving while the next one climbs over it. That needs the */
/* previous section to be sticky. That was the first attempt and it was  */
/* WRONG: a sticky section taller than the viewport pins the moment its  */
/* top reaches zero, and everything below the fold inside it can then    */
/* never be scrolled to. Three ways to value is 960px in a 900px         */
/* viewport, so its last bar and its closing line were permanently       */
/* hidden under the panel arriving over them.                            */
/*                                                                       */
/* The replacement keeps the effect and loses the trap: the section       */
/* underneath scrolls normally but its contents drift upward slightly     */
/* slower than the page, while the panel above carries rounded corners    */
/* and a shadow. Relative motion is what the eye reads as one thing       */
/* sliding over another; pinning was never the necessary part.            */
/* ------------------------------------------------------------------ */

interface SectionProps {
  ground: Ground;
  rounded?: boolean;
  id?: string;
  className?: string;
  children: React.ReactNode;
}

export const Section: React.FC<SectionProps> = ({
  ground,
  rounded = false,
  id,
  className = '',
  children,
}) => {
  const g = GROUND[ground];
  return (
    <section
      id={id}
      className="relative w-full"
      style={{
        background: g.bg,
        color: g.body,
        borderTopLeftRadius: rounded ? 20 : undefined,
        borderTopRightRadius: rounded ? 20 : undefined,
        boxShadow: rounded ? '0 -40px 80px rgba(0,0,0,0.45)' : undefined,
      }}
    >
      <div
        className={`mx-auto w-full max-w-[1440px] px-6 sm:px-10 lg:px-16 py-20 lg:py-28 ${className}`}
      >
        {children}
      </div>
    </section>
  );
};

/* The section that stays put while the next one climbs over it. */
export const StackPair: React.FC<{ under: React.ReactNode; over: React.ReactNode }> = ({
  under,
  over,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReduced();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });
  const [drift, setDrift] = useState(0);

  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    if (reduced) return;
    setDrift(Math.max(0, Math.min(1, v)) * -70);
  });

  return (
    <div className="relative">
      <div ref={ref} style={{ transform: `translateY(${drift}px)`, willChange: 'transform' }}>
        {under}
      </div>
      <div className="relative z-10 -mt-8 lg:-mt-14">{over}</div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Chapter mark and headline                                           */
/* ------------------------------------------------------------------ */

export const ChapterMark: React.FC<{ number: string; title: string; ground: Ground }> = ({
  number,
  title,
  ground,
}) => {
  const g = GROUND[ground];
  return (
    <div className="mb-10 lg:mb-14 flex items-center gap-4">
      <span className="h-px w-10" style={{ background: RED }} />
      <span className="font-mono text-[13px] tracking-[0.22em] uppercase" style={{ color: RED_TEXT }}>
        {number}
      </span>
      <span className="font-mono text-[13px] tracking-[0.22em] uppercase" style={{ color: g.label }}>
        {title}
      </span>
    </div>
  );
};

/* Headlines arrive by sliding up from behind a clipped edge rather than
   fading in. A fade is the animation every template uses; a line lifting
   into place reads as something being typeset. */
export const Headline: React.FC<{
  children: React.ReactNode;
  ground: Ground;
  square?: boolean;
  size?: 'xl' | 'lg';
  /** Line length, applied to the heading itself — never to the wrapper. */
  measure?: string;
  className?: string;
}> = ({ children, ground, square = false, size = 'lg', measure = '', className = '' }) => {
  const g = GROUND[ground];
  const reduced = useReduced();
  const scale =
    size === 'xl'
      ? 'text-[44px] sm:text-[64px] lg:text-[86px]'
      : 'text-[34px] sm:text-[46px] lg:text-[60px]';

  // The trigger sits on the WRAPPER, not on the heading itself. The heading
  // starts translated fully below its own clipping box, which puts its
  // bounding box outside the viewport — so a whileInView on the heading can
  // never fire, and the headline stays invisible forever. This is the bug
  // that hid "Three answers, not one" completely. The wrapper stays in
  // normal flow, sees the viewport, and drives the child through variants.
  return (
    <motion.div
      className={`overflow-hidden ${className}`}
      initial={reduced ? false : 'hidden'}
      whileInView="shown"
      viewport={{ once: true, amount: 0.2 }}
    >
      <motion.h2
        className={`${scale} ${measure}`}
        style={{ ...DISPLAY, color: g.text }}
        variants={{ hidden: { y: '110%' }, shown: { y: '0%' } }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
        {square && (
          <>
            {'⁠'}
            <span
              className="inline-block align-baseline ml-[0.1em]"
              style={{ width: '0.14em', height: '0.14em', background: RED }}
            />
          </>
        )}
      </motion.h2>
    </motion.div>
  );
};

export const Reveal: React.FC<{
  children: React.ReactNode;
  delay?: number;
  className?: string;
}> = ({ children, delay = 0, className = '' }) => {
  const reduced = useReduced();
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.75, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
};

export const CountUp: React.FC<{
  to: number;
  suffix?: string;
  className?: string;
}> = ({ to, suffix = '', className = '' }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduced = useReduced();
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduced) { setShown(to); return; }
    const controls = animate(0, to, {
      duration: 1.5,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setShown(v),
    });
    return () => controls.stop();
  }, [inView, to, reduced]);

  return (
    <span ref={ref} className={className}>
      {Math.round(shown).toLocaleString('en-IN')}
      {suffix}
    </span>
  );
};

/* An arrow drawn at the weight the rest of the page is set in. The icon
   font's version came out spindly and slightly crooked at label size,
   which is the sort of thing that makes a page look assembled. */
export const Arrow: React.FC<{ color: string; size?: number }> = ({ color, size = 22 }) => (
  <svg width={size} height={size / 2} viewBox="0 0 22 11" fill="none" aria-hidden="true">
    <path d="M0 5.5H20M20 5.5L15.5 1M20 5.5L15.5 10" stroke={color} strokeWidth="1.25" />
  </svg>
);

/* ================================================================== */
/* Hero                                                                */
/*                                                                     */
/* The panel that used to sit here showed a real company's figures.     */
/* Three things were wrong with it: it cluttered the first screen with  */
/* numbers nobody asked for, any figure printed into a static page is   */
/* wrong within the hour, and it invited a reader to check a number     */
/* that was only ever illustrative.                                     */
/*                                                                     */
/* What replaces it is a ruled page with a margin, and marks appearing  */
/* in that margin. It carries no data, it cannot go stale, and it says  */
/* what the site is called without a sentence of explanation. The       */
/* earlier radar was considered and rejected: a rotating sweep has      */
/* nothing to do with valuing a company, and it looped forever, which   */
/* on a page someone is trying to read is a screensaver.                */
/* ================================================================== */

const RuledPage: React.FC = () => {
  const reduced = useReduced();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const play = inView || reduced;

  // Lines of a page, ragged at the right the way set text is.
  const lines = [
    212, 268, 240, 196, 258, 174, 250, 232, 208, 264, 186, 244, 220, 160,
  ];
  const top = 74;
  const gap = 34;
  const marginX = 96;
  const textX = 126;

  return (
    <div ref={ref} className="w-full">
      <svg
        viewBox="0 0 420 560"
        className="w-full h-auto"
        style={{ maxHeight: 620 }}
        aria-label="A ruled page with notes in the margin"
      >
        {/* The page */}
        <rect x="34" y="34" width="352" height="492" fill="#111114" stroke="#262521" />

        {/* The margin rule. Every ledger and every exercise book has one. */}
        <motion.line
          x1={marginX}
          y1={46}
          x2={marginX}
          y2={514}
          stroke={RED}
          strokeWidth="1"
          strokeOpacity="0.7"
          initial={reduced ? false : { pathLength: 0 }}
          animate={play ? { pathLength: 1 } : {}}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        />

        {/* The text of the page, drawn as rules rather than words. There is
            nothing to read, which is the point: it is a document, not a
            document about anything. */}
        {lines.map((width, i) => (
          <motion.line
            key={i}
            x1={textX}
            y1={top + i * gap}
            x2={textX + width}
            y2={top + i * gap}
            stroke="#2E2C27"
            strokeWidth="4"
            strokeLinecap="round"
            initial={reduced ? false : { pathLength: 0, opacity: 0 }}
            animate={play ? { pathLength: 1, opacity: 1 } : {}}
            transition={{
              duration: 0.5,
              delay: 0.35 + i * 0.045,
              ease: [0.16, 1, 0.3, 1],
            }}
          />
        ))}

        {/* One line is picked out, and a note appears beside it in the
            margin. This is the whole product in one gesture. */}
        <motion.line
          x1={textX}
          y1={top + 6 * gap}
          x2={textX + lines[6]}
          y2={top + 6 * gap}
          stroke={RED}
          strokeWidth="4"
          strokeLinecap="round"
          initial={reduced ? false : { pathLength: 0 }}
          animate={play ? { pathLength: 1 } : {}}
          transition={{ duration: 0.7, delay: 1.25, ease: [0.16, 1, 0.3, 1] }}
        />

        {/* A bracket in the margin, of the kind anyone makes beside a line
            they intend to come back to. */}
        <motion.path
          d={`M${marginX - 34},${top + 6 * gap - 20} L${marginX - 44},${top + 6 * gap - 20} L${marginX - 44},${top + 6 * gap + 20} L${marginX - 34},${top + 6 * gap + 20}`}
          fill="none"
          stroke={RED}
          strokeWidth="1.5"
          initial={reduced ? false : { pathLength: 0 }}
          animate={play ? { pathLength: 1 } : {}}
          transition={{ duration: 0.5, delay: 1.5, ease: [0.16, 1, 0.3, 1] }}
        />

        {/* A tick further up, and a small square lower down: the marks a
            reader leaves behind on a page they have actually worked through. */}
        <motion.path
          d={`M${marginX - 46},${top + 2 * gap} l7,7 l13,-15`}
          fill="none"
          stroke={RED}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={reduced ? false : { pathLength: 0 }}
          animate={play ? { pathLength: 1 } : {}}
          transition={{ duration: 0.4, delay: 1.75, ease: [0.16, 1, 0.3, 1] }}
        />
        <motion.rect
          x={marginX - 44}
          y={top + 10 * gap - 4}
          width="8"
          height="8"
          fill={RED}
          initial={reduced ? false : { opacity: 0 }}
          animate={play ? { opacity: 1 } : {}}
          transition={{ duration: 0.4, delay: 1.95 }}
        />
      </svg>
    </div>
  );
};

interface HeroProps {
  onOpenListed: () => void;
  onOpenPrivate: () => void;
}

export const LandingHero: React.FC<HeroProps> = ({ onOpenListed, onOpenPrivate }) => {
  const g = GROUND.dark;
  const reduced = useReduced();

  return (
    <section className="relative w-full" style={{ background: g.bg, color: g.body }} id="hero">
      <div className="mx-auto w-full max-w-[1440px] px-6 sm:px-10 lg:px-16 pt-16 pb-20 lg:pt-24 lg:pb-28">
        <div className="grid grid-cols-1 lg:grid-cols-[1.38fr_1fr] gap-14 lg:gap-20 items-center">
          <div>
            <motion.div
              initial={reduced ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="font-mono text-[13px] tracking-[0.24em] uppercase mb-9"
              style={{ color: RED_TEXT }}
            >
              Filed data, not estimates
            </motion.div>

            <div className="overflow-hidden">
              <motion.h1
                className="text-[44px] sm:text-[62px] lg:text-[76px] xl:text-[88px]"
                style={{ ...DISPLAY, color: g.text }}
                initial={reduced ? false : { y: '110%' }}
                animate={{ y: '0%' }}
                transition={{ duration: 1, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              >
                Real Financials.
              </motion.h1>
            </div>
            <div className="overflow-hidden">
              <motion.h1
                className="text-[44px] sm:text-[62px] lg:text-[76px] xl:text-[88px]"
                style={{ ...DISPLAY, color: g.text }}
                initial={reduced ? false : { y: '110%' }}
                animate={{ y: '0%' }}
                transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              >
                Live Models.{'⁠'}
                <span
                  className="inline-block align-baseline ml-[0.08em]"
                  style={{ width: '0.13em', height: '0.13em', background: RED }}
                />
              </motion.h1>
            </div>

            <motion.p
              initial={reduced ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="mt-9 text-[17px] lg:text-[19px] leading-[1.6] max-w-[44ch]"
              style={{ color: g.body }}
            >
              Five years of income statements, balance sheets and cash flows,
              read from a company&rsquo;s own filings exactly as reported.
            </motion.p>

            <motion.div
              initial={reduced ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="mt-11 flex flex-col sm:flex-row gap-3"
            >
              <button
                type="button"
                onClick={onOpenListed}
                className="group flex items-center justify-between gap-6 font-mono text-[13px] tracking-[0.18em] uppercase px-7 py-4 border transition-colors"
                style={{ borderColor: RED, background: 'rgba(139,30,30,0.22)', color: g.text }}
              >
                Value a listed company
                <Arrow color={RED_TEXT} size={20} />
              </button>
              <button
                type="button"
                onClick={onOpenPrivate}
                className="font-mono text-[13px] tracking-[0.18em] uppercase px-7 py-4 border transition-colors hover:border-[#8B1E1E]"
                style={{ borderColor: g.hairline, color: g.label }}
              >
                Value a private company
              </button>
            </motion.div>
          </div>

          <RuledPage />
        </div>
      </div>
    </section>
  );
};

/* ================================================================== */
/* What you can do — a spotlight, not a row of boxes                   */
/*                                                                     */
/* Four bordered cards side by side gave every route the same weight    */
/* and none of them any presence. This pins the section and moves       */
/* through the four one at a time: the live one is at full strength and */
/* the rest sit back at low opacity until their turn.                   */
/*                                                                     */
/* The status chips are gone from here entirely. He counted them        */
/* appearing on four cards AND again on the roadmap lower down, which   */
/* is the same information stated twice on one page. The roadmap is now */
/* the single place that says when something arrives.                   */
/* ================================================================== */

const ROUTES = [
  {
    n: '01',
    title: 'Value a listed company',
    line: 'Type a ticker. Five years of filings become a full model, and every assumption stays visible.',
    live: true,
  },
  {
    n: '02',
    title: 'Value a private company',
    line: 'No filings to read. Enter the figures you have and the same engine runs on them.',
    live: false,
  },
  {
    n: '03',
    title: 'Make a one or two-pager',
    line: 'A company reduced to a single page, in the shape a desk expects to receive it.',
    live: false,
  },
  {
    n: '04',
    title: 'Reformat your Excel model',
    line: 'Your own workbook set to convention. Not one number, assumption or growth rate is touched.',
    live: false,
  },
];

export const WhereToStart: React.FC<{ onRoute: (i: number) => void }> = ({ onRoute }) => {
  const g = GROUND.dark;
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReduced();
  const [active, setActive] = useState(0);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end end'],
  });

  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    const index = Math.min(ROUTES.length - 1, Math.max(0, Math.floor(v * ROUTES.length)));
    setActive(index);
  });

  const route = ROUTES[active];

  return (
    <section id="where-to-start" style={{ background: g.bg }}>
      {/* Below the large breakpoint the pinning is dropped and the four are
          simply listed. A pinned section on a phone means four screens of
          scrolling that go nowhere. */}
      <div className="lg:hidden mx-auto w-full max-w-[1440px] px-6 sm:px-10 py-20">
        <ChapterMark number="01" title="What you can do" ground="dark" />
        <div className="space-y-10">
          {ROUTES.map((r) => (
            <Reveal key={r.n}>
              <button type="button" onClick={() => onRoute(ROUTES.indexOf(r))} className="text-left w-full">
                <div className="font-mono text-[13px] tracking-[0.2em] mb-2" style={{ color: RED_TEXT }}>
                  {r.n}
                </div>
                <div className="text-[26px] mb-2" style={{ ...DISPLAY, color: g.text }}>
                  {r.title}
                </div>
                <p className="text-[16px] leading-[1.55]" style={{ color: g.label }}>
                  {r.line}
                </p>
              </button>
            </Reveal>
          ))}
        </div>
      </div>

      <div ref={ref} className="hidden lg:block relative" style={{ height: `${ROUTES.length * 90}vh` }}>
        <div className="sticky top-0 h-screen flex items-center">
          <div className="mx-auto w-full max-w-[1440px] px-16">
            <ChapterMark number="01" title="What you can do" ground="dark" />

            <div className="grid grid-cols-[1.1fr_1fr] gap-20 items-center">
              {/* The four, stacked. Only one is lit. */}
              <div className="space-y-7">
                {ROUTES.map((r, i) => {
                  const on = i === active;
                  return (
                    <button
                      key={r.n}
                      type="button"
                      onClick={() => onRoute(i)}
                      className="flex items-baseline gap-6 text-left w-full"
                      style={{
                        opacity: on ? 1 : 0.1,
                        transition: reduced ? undefined : 'opacity 500ms cubic-bezier(0.16,1,0.3,1)',
                      }}
                    >
                      <span
                        className="font-mono text-[13px] tracking-[0.2em] shrink-0"
                        style={{ color: on ? RED_TEXT : g.label }}
                      >
                        {r.n}
                      </span>
                      <span
                        className="text-[38px] xl:text-[46px]"
                        style={{ ...DISPLAY, color: g.text }}
                      >
                        {r.title}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* What the lit one is. */}
              <div className="border-l pl-12" style={{ borderColor: g.hairline }}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={route.n}
                    initial={reduced ? false : { opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduced ? undefined : { opacity: 0, y: -10 }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <p
                      className="text-[19px] xl:text-[21px] leading-[1.55] max-w-[34ch] mb-9"
                      style={{ color: g.body }}
                    >
                      {route.line}
                    </p>

                    {route.live ? (
                      <button
                        type="button"
                        onClick={() => onRoute(active)}
                        className="group inline-flex items-center gap-4 font-mono text-[13px] tracking-[0.2em] uppercase border-b pb-2"
                        style={{ color: g.text, borderColor: RED }}
                      >
                        Open it now
                        <Arrow color={RED_TEXT} />
                      </button>
                    ) : (
                      <span
                        className="inline-block font-mono text-[13px] tracking-[0.2em] uppercase"
                        style={{ color: g.label }}
                      >
                        On the way
                      </span>
                    )}
                  </motion.div>
                </AnimatePresence>

                {/* Where you are in the four. */}
                <div className="flex gap-2 mt-14">
                  {ROUTES.map((r, i) => (
                    <span
                      key={r.n}
                      className="h-px flex-1"
                      style={{
                        background: i === active ? RED : g.hairline,
                        transition: 'background 400ms',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

/* ================================================================== */
/* The film slot                                                       */
/* Built now, filled later, so dropping the video in does not mean     */
/* redesigning the page around it.                                     */
/* ================================================================== */

export const SeeItWork: React.FC<{ onOpenListed: () => void }> = ({ onOpenListed }) => {
  const g = GROUND.dark;
  return (
    <Section ground="dark" id="see-it-work" className="!pt-0">
      <Reveal>
        <button
          type="button"
          onClick={onOpenListed}
          className="group block w-full border relative overflow-hidden"
          style={{ borderColor: g.hairline, background: g.panel, aspectRatio: '16 / 9' }}
        >
          <span
            className="absolute inset-0"
            style={{
              background:
                'repeating-linear-gradient(135deg, rgba(38,37,33,0.55) 0 1px, transparent 1px 16px)',
            }}
          />
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-7">
            <span
              className="flex items-center justify-center transition-colors"
              style={{
                width: 78,
                height: 78,
                border: `1px solid ${RED}`,
                background: 'rgba(139,30,30,0.18)',
              }}
            >
              <Play size={24} strokeWidth={1.3} style={{ color: '#F2F0EA' }} />
            </span>
            <span
              className="font-mono text-[13px] tracking-[0.24em] uppercase"
              style={{ color: g.label }}
            >
              Ninety seconds, one company, start to finish
            </span>
          </span>
        </button>
      </Reveal>
    </Section>
  );
};

/* ================================================================== */
/* By the numbers                                                      */
/* Four facts about the product, none of them a popularity claim. The  */
/* last is a real decision stated as a figure and is the fastest way to */
/* say what this site is for.                                          */
/* ================================================================== */

/* Coverage and cost, which is what a reader actually wants to know before
   they type anything. The four-figure version he had originally is back,
   in the page's own type rather than the old one.

   One caution worth keeping in view: "10,000+" is the ONLY number on this
   page that is a claim rather than a fact about the product. It is
   defensible — EDGAR alone carries several thousand filers and the
   international source many times that — but it should stay conservative,
   because it is the one figure a sceptical reader could go and test. */
const STATS = [
  { to: 10000, suffix: '+', label: 'Listed companies', detail: 'NYSE · NASDAQ · NSE · BSE · LSE · TSX' },
  { to: 5, suffix: 'Y', label: 'Of filed history', detail: 'IS · BS · CF · WC · PP&E · Debt · Equity' },
  { to: 0, suffix: '', label: 'Cost to use', detail: 'No subscription, no paywall' },
  { to: 3, suffix: '', label: 'Valuation approaches', detail: 'Income · Market · Asset' },
];

export const ByTheNumbers: React.FC = () => {
  const g = GROUND.cream;
  return (
    <Section ground="cream" id="by-the-numbers">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-14 gap-x-8">
        {STATS.map((stat, i) => (
          <Reveal key={stat.label} delay={i * 0.08}>
            <div>
              <div
                className="text-[46px] lg:text-[64px]"
                style={{ ...DISPLAY, color: g.text }}
              >
                <CountUp to={stat.to} suffix={stat.suffix} />
              </div>
              <div
                className="font-mono text-[12px] tracking-[0.2em] uppercase mt-4"
                style={{ color: g.text }}
              >
                {stat.label}
              </div>
              <div
                className="font-mono text-[12px] mt-2 leading-[1.5]"
                style={{ color: g.label }}
              >
                {stat.detail}
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
};

/* ================================================================== */
/* Three ways to value                                                 */
/* No amounts on the bars. Three lengths say the thing that matters —  */
/* the approaches disagree — and the space is spent on what each one   */
/* asks rather than on a figure nobody could check.                    */
/* ================================================================== */

const APPROACHES = [
  { name: 'Income', width: 100, question: 'What its future cash is worth today.' },
  { name: 'Market', width: 76, question: 'What buyers pay for companies like it.' },
  { name: 'Asset', width: 44, question: 'What it owns, less what it owes.' },
];

export const ThreeWays: React.FC = () => {
  const g = GROUND.cream;
  const reduced = useReduced();

  return (
    <Section ground="cream" id="three-ways">
      <ChapterMark number="03" title="Three ways to value" ground="cream" />
      <Headline ground="cream" square measure="max-w-[15ch]" className="mb-16 lg:mb-24">
        Three answers, not one
      </Headline>

      <div className="space-y-12 lg:space-y-16">
        {APPROACHES.map((approach, i) => (
          <Reveal key={approach.name} delay={i * 0.1}>
            <div className="grid grid-cols-1 lg:grid-cols-[130px_1fr] gap-3 lg:gap-12">
              <div
                className="font-mono text-[13px] tracking-[0.2em] uppercase lg:pt-1"
                style={{ color: g.text }}
              >
                {approach.name}
              </div>
              <div>
                <div className="h-[3px] mb-5" style={{ background: g.hairline }}>
                  <motion.div
                    className="h-full"
                    style={{ background: RED, transformOrigin: 'left' }}
                    initial={reduced ? false : { scaleX: 0 }}
                    whileInView={{ scaleX: approach.width / 100 }}
                    viewport={{ once: true, amount: 0.6 }}
                    transition={{ duration: 1.2, delay: 0.15 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
                <div className="text-[18px] lg:text-[20px]" style={{ color: g.body }}>
                  {approach.question}
                </div>
              </div>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal delay={0.2}>
        <p
          className="mt-20 font-serif text-[26px] lg:text-[34px] max-w-[26ch] leading-[1.3]"
          style={{ color: g.text, letterSpacing: '-0.018em' }}
        >
          They do not agree, and they are not supposed to.
        </p>
      </Reveal>
    </Section>
  );
};

/* ================================================================== */
/* In the margin — the centrepiece                                     */
/*                                                                     */
/* One gesture doing two jobs. A reader who has never seen a financial  */
/* model gets the first plain explanation anyone has offered them; a    */
/* professional reads the same animation as the site's actual promise,  */
/* which is that every figure resolves to a filing.                     */
/*                                                                     */
/* The figures carry no company name. They are a sample, and pinning    */
/* them to a real company would be a claim nobody could check. No note  */
/* cites a line number either — an earlier draft said "line 7", which   */
/* is precision this site does not have.                                */
/* ================================================================== */

const ROW_H = 78;

const LINES = [
  {
    label: 'Revenue',
    figure: '10,52,851',
    note: 'What the company billed its customers, before a single cost is taken off.',
    source: 'Income statement, as filed',
  },
  {
    label: 'Operating margin',
    figure: '13.8%',
    note: 'What is left of every rupee of revenue after the costs of running the business.',
    source: 'Computed from the income statement',
  },
  {
    label: 'Free cash flow',
    figure: '48,933',
    note: 'The cash left after paying to run the business and replace what it wears out.',
    source: 'Cash flow statement, as filed',
  },
  {
    label: 'Value per share',
    figure: '1,636.71',
    note: 'What those future cash flows are worth today, split across the shares in issue.',
    source: 'Computed. Every input is on the page',
  },
];

export const InTheMargin: React.FC<{ onOpenNotes: () => void }> = ({ onOpenNotes }) => {
  const g = GROUND.cream;
  const reduced = useReduced();
  const [active, setActive] = useState(0);

  // The rotation is there so the section explains itself to somebody who
  // never touches it. The moment a reader picks a line themselves it stops
  // for good: nothing is more irritating than choosing something and having
  // the page move on four seconds later while you are still reading it.
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (reduced || held) return;
    const timer = setInterval(() => setActive((i) => (i + 1) % LINES.length), 4400);
    return () => clearInterval(timer);
  }, [reduced, held]);

  const choose = (i: number) => {
    setActive(i);
    setHeld(true);
  };

  const line = LINES[active];

  return (
    <Section ground="cream" id="in-the-margin">
      <ChapterMark number="05" title="In the margin" ground="cream" />
      <Headline ground="cream" square measure="max-w-[18ch]" className="mb-16 lg:mb-20">
        Every figure has a source
      </Headline>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-0">
        <div>
          <div
            className="font-mono text-[12px] tracking-[0.2em] uppercase mb-5"
            style={{ color: g.label }}
          >
            Sample output
          </div>

          <div className="relative border-t" style={{ borderColor: g.hairline }}>
            {LINES.map((item, i) => {
              const on = i === active;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => choose(i)}
                  className="w-full text-left flex items-baseline justify-between border-b px-1 transition-colors"
                  style={{
                    borderColor: g.hairline,
                    height: ROW_H,
                    background: on ? 'rgba(139,30,30,0.05)' : 'transparent',
                  }}
                >
                  <span
                    className="font-mono text-[14px] transition-colors"
                    style={{ color: on ? g.text : g.label }}
                  >
                    {item.label}
                  </span>
                  <span
                    className="font-mono text-[19px] lg:text-[22px] tabular-nums transition-colors"
                    style={{ color: on ? RED_TEXT : g.text }}
                  >
                    {item.figure}
                  </span>
                </button>
              );
            })}

            <motion.div
              className="hidden lg:block absolute h-px pointer-events-none"
              style={{ background: RED, left: '100%', width: 72 }}
              animate={{ top: active * ROW_H + ROW_H / 2 }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        </div>

        <div className="lg:pl-28 lg:pt-16">
          <AnimatePresence mode="wait">
            <motion.div
              key={line.label}
              initial={reduced ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <div
                className="font-mono text-[12px] tracking-[0.2em] uppercase mb-4"
                style={{ color: RED_TEXT }}
              >
                {line.label}
              </div>
              {/* Playfair earns its place here: this is a note written in a
                  margin, and it should look handwritten-adjacent rather than
                  like more interface. */}
              <p
                className="font-serif text-[25px] lg:text-[32px] leading-[1.32] max-w-[22ch]"
                style={{ color: g.text, letterSpacing: '-0.015em' }}
              >
                {line.note}
              </p>
              <div
                className="font-mono text-[12px] mt-7 pt-4 border-t inline-block"
                style={{ color: g.label, borderColor: g.hairline }}
              >
                {line.source}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div
        className="mt-20 pt-10 border-t flex flex-col sm:flex-row gap-6 sm:gap-12"
        style={{ borderColor: g.hairline }}
      >
        {['What is a DCF?', 'Why no buy or sell rating?', 'How do I read this?'].map((q) => (
          <button
            key={q}
            type="button"
            onClick={onOpenNotes}
            className="text-left text-[16px] lg:text-[17px] border-b pb-1 transition-colors hover:border-[#8B1E1E]"
            style={{ color: g.text, borderColor: g.hairline }}
          >
            {q}
          </button>
        ))}
      </div>
    </Section>
  );
};

/* ================================================================== */
/* The Margin Notes, and the one place status is stated                */
/* ================================================================== */

const NOTES = [
  { title: 'What is a DCF', line: 'Future cash, brought back to what it is worth today.' },
  { title: 'What operating margin tells you', line: 'How much of each rupee of sales survives the cost of trading.' },
  { title: 'Why profit and cash are not the same', line: 'Profit follows the accounting rules. Cash follows the bank account.' },
];

const upcomingQuarters = (count: number) => {
  const now = new Date();
  let q = Math.floor(now.getMonth() / 3) + 1;
  let y = now.getFullYear();
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    q += 1;
    if (q > 4) { q = 1; y += 1; }
    out.push(`Q${q} ${y}`);
  }
  return out;
};

const ROADMAP = [
  { title: 'Private company inputs', status: 'In build' },
  { title: 'Things to check in a filing', status: 'In build' },
  { title: 'One-page desk summary', status: 'In build' },
  { title: 'Workbook reformatting', status: 'Planned' },
];

export const MarginNotes: React.FC<{ onOpenNotes: () => void }> = ({ onOpenNotes }) => {
  const g = GROUND.cream;
  const quarters = upcomingQuarters(ROADMAP.length);

  return (
    <Section ground="cream" id="margin-notes">
      <ChapterMark number="06" title="The margin notes" ground="cream" />
      <Headline ground="cream" className="mb-5">
        The Margin Notes
      </Headline>
      <Reveal>
        <p className="text-[17px] lg:text-[19px] mb-16 max-w-[44ch]" style={{ color: g.body }}>
          Read any company&rsquo;s accounts without a finance degree.
        </p>
      </Reveal>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-px mb-12" style={{ background: g.hairline }}>
        {NOTES.map((note, i) => (
          <Reveal key={note.title} delay={i * 0.08}>
            <button
              type="button"
              onClick={onOpenNotes}
              className="group h-full w-full text-left p-8 relative"
              style={{ background: g.bg }}
            >
              <span
                className="absolute inset-0 border opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                style={{ borderColor: RED }}
              />
              <div className="text-[21px] leading-[1.2] mb-3" style={{ ...DISPLAY, color: g.text }}>
                {note.title}
              </div>
              <div className="text-[15px] leading-[1.55]" style={{ color: g.label }}>
                {note.line}
              </div>
            </button>
          </Reveal>
        ))}
      </div>

      <button
        type="button"
        onClick={onOpenNotes}
        className="inline-flex items-center gap-4 font-mono text-[13px] tracking-[0.2em] uppercase border-b pb-2 mb-24"
        style={{ color: g.text, borderColor: RED }}
      >
        Read the notes
        <Arrow color={RED_TEXT} />
      </button>

      {/* The ONLY place on the page that says what is finished and what is
          not. It was previously stated on four cards up top and again down
          here, which is the same fact told twice in one scroll. */}
      <div
        className="font-mono text-[12px] tracking-[0.2em] uppercase mb-7 pt-10 border-t"
        style={{ color: g.label, borderColor: g.hairline }}
      >
        What is being built next
      </div>

      <div>
        {ROADMAP.map((item, i) => (
          <div
            key={item.title}
            className="flex items-center justify-between gap-6 py-5 border-b"
            style={{ borderColor: g.hairline }}
          >
            <div className="flex items-baseline gap-6 lg:gap-12 min-w-0">
              <span
                className="font-mono text-[12px] tracking-[0.16em] shrink-0"
                style={{ color: g.label }}
              >
                {quarters[i]}
              </span>
              <span className="text-[17px] lg:text-[19px] truncate" style={{ color: g.text }}>
                {item.title}
              </span>
            </div>
            <span
              className="font-mono text-[12px] tracking-[0.16em] uppercase shrink-0"
              style={{ color: item.status === 'In build' ? RED_TEXT : g.label }}
            >
              {item.status}
            </span>
          </div>
        ))}
      </div>
    </Section>
  );
};

/* ================================================================== */
/* Final call to action                                                */
/* ================================================================== */

export const FinalCta: React.FC<{
  onOpenListed: () => void;
  onOpenPrivate: () => void;
}> = ({ onOpenListed, onOpenPrivate }) => {
  const g = GROUND.dark;
  return (
    <Section ground="dark" rounded id="final-cta">
      <div className="py-10 lg:py-20 flex flex-col items-center text-center">
        <Headline ground="dark" square size="xl">
          Open a company
        </Headline>

        <div className="mt-14 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={onOpenListed}
            className="flex items-center justify-between gap-6 font-mono text-[13px] tracking-[0.18em] uppercase px-7 py-4 border"
            style={{ borderColor: RED, background: 'rgba(139,30,30,0.22)', color: g.text }}
          >
            Value a listed company
            <Arrow color={RED_TEXT} size={20} />
          </button>
          <button
            type="button"
            onClick={onOpenPrivate}
            className="font-mono text-[13px] tracking-[0.18em] uppercase px-7 py-4 border transition-colors hover:border-[#8B1E1E]"
            style={{ borderColor: g.hairline, color: g.label }}
          >
            Value a private company
          </button>
        </div>
      </div>
    </Section>
  );
};
