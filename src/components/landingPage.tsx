// FILE: src/components/landingPage.tsx
//
// The landing page, whole.
//
// Every section lives in this one file on purpose: the page is pasted into
// GitHub by hand, and one paste is one chance to get it wrong instead of ten.
// The sections are in the order they appear on screen, each with its own
// heading comment, so this reads top to bottom the way the page scrolls.
//
// The page is built on a single rule: almost nothing is explained in prose.
// A figure moves, a line draws itself, a table fills in. Every animation
// plays ONCE when it arrives and then rests, because something looping in
// the corner of the eye while a reader is trying to read a number is worse
// than no animation at all.

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useInView, useScroll, useMotionValueEvent, animate } from 'motion/react';
import { ArrowUpRight, ArrowRight, Play } from 'lucide-react';



/* ================================================================== */
/* Shared furniture
/* ================================================================== */

//
// Shared furniture for the landing page.
//
// The page is built on one idea: almost nothing is explained in prose. A
// figure moves, a line draws itself, a table fills in. So these primitives are
// deliberately plain — a chapter mark, a status chip, a reveal, a counter —
// and every piece of motion here plays ONCE when it arrives and then rests.
// Nothing loops in the corner of the eye while somebody is trying to read.


/* ------------------------------------------------------------------ */
/* Ground                                                              */
/* The page alternates a near-black ground with a warm cream one. That  */
/* alternation is doing most of the work visually, so it is a type      */
/* rather than a class someone has to remember.                         */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* Reduced motion                                                       */
/* ------------------------------------------------------------------ */

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
/* Section                                                              */
/*                                                                      */
/* The overlap is the single most effective thing on the reference site  */
/* and it is not a scroll trick: a dark section simply carries rounded   */
/* top corners and is pulled up over the section above it. Three lines   */
/* of CSS, and the page stops reading as one long strip.                 */
/* ------------------------------------------------------------------ */

interface SectionProps {
  ground: Ground;
  /** Pull this section up over the one above it, with rounded top corners. */
  overlap?: boolean;
  id?: string;
  className?: string;
  children: React.ReactNode;
}

export const Section: React.FC<SectionProps> = ({
  ground,
  overlap = false,
  id,
  className = '',
  children,
}) => {
  const g = GROUND[ground];
  return (
    <section
      id={id}
      className={`relative w-full ${overlap ? '-mt-8 lg:-mt-12' : ''}`}
      style={{
        background: g.bg,
        color: g.body,
        borderTopLeftRadius: overlap ? 18 : undefined,
        borderTopRightRadius: overlap ? 18 : undefined,
      }}
    >
      {/* className lands on the INNER box, because that is where the padding
          is. Put on the <section> it silently does nothing, which is how a
          200px hole opened up under the hero. */}
      <div
        className={`mx-auto w-full max-w-[1440px] px-6 sm:px-10 lg:px-16 py-20 lg:py-24 ${className}`}
      >
        {children}
      </div>
    </section>
  );
};

/* ------------------------------------------------------------------ */
/* Chapter mark                                                         */
/* A small mono label with a short red rule above it, borrowed from the  */
/* way a printed report numbers its sections.                            */
/* ------------------------------------------------------------------ */

export const ChapterMark: React.FC<{ number: string; title: string; ground: Ground }> = ({
  number,
  title,
  ground,
}) => {
  const g = GROUND[ground];
  return (
    <div className="mb-10 lg:mb-14">
      <div className="h-px w-14 mb-4" style={{ background: RED }} />
      <div className="flex items-baseline gap-4 font-mono text-[13px] tracking-[0.22em] uppercase">
        <span style={{ color: RED_TEXT }}>{number}</span>
        <span style={{ color: g.label }}>{title}</span>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Headline                                                             */
/* Playfair, set tight. The red square in place of a full stop is the    */
/* one piece of brand decoration on the page.                            */
/* ------------------------------------------------------------------ */

export const Headline: React.FC<{
  children: React.ReactNode;
  ground: Ground;
  square?: boolean;
  className?: string;
}> = ({ children, ground, square = false, className = '' }) => {
  const g = GROUND[ground];
  return (
    <h2
      className={`font-serif leading-[1.05] text-[38px] sm:text-[48px] lg:text-[58px] ${className}`}
      style={{ color: g.text, letterSpacing: '-0.02em' }}
    >
      {children}
      {square && (
        <>
          {'\u2060'}
          <span
            className="inline-block align-baseline ml-[0.12em]"
            style={{ width: '0.16em', height: '0.16em', background: RED }}
          />
        </>
      )}
    </h2>
  );
};

/* ------------------------------------------------------------------ */
/* Reveal                                                               */
/* Rise 24px and fade, once, easing out slowly. Never on a loop.        */
/* ------------------------------------------------------------------ */

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
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
};

/* ------------------------------------------------------------------ */
/* Count up                                                             */
/* Runs once when the figure arrives on screen, then stops.             */
/* ------------------------------------------------------------------ */

export const CountUp: React.FC<{
  to: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  className?: string;
}> = ({ to, suffix = '', prefix = '', decimals = 0, className = '' }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduced = useReduced();
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      setShown(to);
      return;
    }
    const controls = animate(0, to, {
      duration: 1.4,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setShown(v),
    });
    return () => controls.stop();
  }, [inView, to, reduced]);

  return (
    <span ref={ref} className={className}>
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
/* Status chip                                                          */
/*                                                                      */
/* The site's own rule is that nothing unverifiable gets stated. A       */
/* landing page advertising a tool that does not exist yet breaks that   */
/* on the first screen, so every route card carries its real state.      */
/* Labelled honestly the same list becomes a strength: it shows a        */
/* reader where this is going.                                           */
/* ------------------------------------------------------------------ */

export type Status = 'LIVE' | 'IN BUILD' | 'PLANNED';

export const StatusChip: React.FC<{ status: Status; ground: Ground }> = ({ status, ground }) => {
  const g = GROUND[ground];
  const style =
    status === 'LIVE'
      ? { color: '#F2F0EA', background: RED, borderColor: RED }
      : status === 'IN BUILD'
      ? { color: RED_TEXT, background: 'transparent', borderColor: RED_TEXT }
      : { color: g.label, background: 'transparent', borderColor: g.hairline };

  return (
    <span
      className="inline-block font-mono text-[11px] tracking-[0.18em] uppercase px-2 py-[3px] border"
      style={style}
    >
      {status}
    </span>
  );
};


/* ================================================================== */
/* Hero
/* ================================================================== */

//
// The first screen.
//
// Two decisions worth writing down.
//
// FIRST, the sample panel cycles between markets instead of standing on one
// company. A landing page that shows only a US name, with a 10-K badge beside
// it, quietly tells an Indian reader the site is not for them — and this site
// covers NSE, BSE, LSE and TSX. Rotating the panel demonstrates the coverage
// claim instead of asserting it, and it removes the single-company anchor.
//
// SECOND, no market price appears here. A price printed into a static page is
// wrong within the hour, and a stale price on a site whose whole claim is that
// its figures can be checked is the most expensive kind of small error. The
// panel shows what the MODEL produced, which does not go stale, and says so.


/* Every figure below came out of this site's own engine. Nothing here is
   invented, and nothing here is a live quote. */
const SAMPLES = [
  {
    ticker: 'RELIANCE.NS',
    name: 'Reliance Industries',
    market: 'NSE',
    filing: 'FY2025 · Annual Report',
    currency: '₹',
    value: '1,636.71',
    method: 'Income approach · DCF, perpetuity',
    tiles: [
      { label: 'Op margin', value: '13.8%' },
      { label: 'Net debt/EBITDA', value: '1.4x' },
      { label: 'Current ratio', value: '1.1x' },
    ],
  },
  {
    ticker: 'NVDA',
    name: 'NVIDIA Corporation',
    market: 'NASDAQ',
    filing: 'FY2025 · Annual report, as filed',
    currency: '$',
    value: '162.90',
    method: 'Income approach · DCF, perpetuity',
    tiles: [
      { label: 'Op margin', value: '62.4%' },
      { label: 'Net debt/EBITDA', value: 'net cash' },
      { label: 'Current ratio', value: '4.4x' },
    ],
  },
];

interface HeroProps {
  onOpenListed: () => void;
  onOpenPrivate: () => void;
}

export const LandingHero: React.FC<HeroProps> = ({ onOpenListed, onOpenPrivate }) => {
  const g = GROUND.dark;
  const reduced = useReduced();
  const [index, setIndex] = useState(0);

  // Slow enough to be read, not a carousel demanding attention.
  useEffect(() => {
    if (reduced) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % SAMPLES.length), 5200);
    return () => clearInterval(timer);
  }, [reduced]);

  const sample = SAMPLES[index];

  return (
    <section
      className="relative w-full"
      style={{ background: g.bg, color: g.body }}
      id="hero"
    >
      <div className="mx-auto w-full max-w-[1440px] px-6 sm:px-10 lg:px-16 pt-16 pb-16 lg:pt-24 lg:pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-12 lg:gap-20 items-center">
          {/* ---------------------------------------------------------- */}
          {/* Left: the claim                                             */}
          {/* ---------------------------------------------------------- */}
          <div>
            <motion.div
              initial={reduced ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="font-mono text-[13px] tracking-[0.24em] uppercase mb-8"
              style={{ color: RED_TEXT }}
            >
              Filed data, not estimates
            </motion.div>

            <motion.h1
              initial={reduced ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="font-serif leading-[0.98] text-[46px] sm:text-[64px] lg:text-[80px] xl:text-[92px]"
              style={{ color: g.text, letterSpacing: '-0.025em' }}
            >
              Real Financials.
              <br />
              Live Models.{'\u2060'}
              <span
                className="inline-block align-baseline ml-[0.1em]"
                style={{ width: '0.15em', height: '0.15em', background: RED }}
              />
            </motion.h1>

            <motion.p
              initial={reduced ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="mt-8 text-[17px] lg:text-[19px] leading-[1.6] max-w-[46ch]"
              style={{ color: g.body }}
            >
              Five years of income statements, balance sheets and cash flows,
              read from a company's own filings exactly as reported.
            </motion.p>

            <motion.div
              initial={reduced ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.24, ease: [0.16, 1, 0.3, 1] }}
              className="mt-10 flex flex-col sm:flex-row gap-3"
            >
              <button
                type="button"
                onClick={onOpenListed}
                className="font-mono text-[13px] tracking-[0.18em] uppercase px-7 py-4 border transition-colors"
                style={{ borderColor: RED, background: 'rgba(139,30,30,0.22)', color: g.text }}
              >
                Value a listed company
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

          {/* ---------------------------------------------------------- */}
          {/* Right: what the model produced                              */}
          {/* ---------------------------------------------------------- */}
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="border"
            style={{ borderColor: g.hairline, background: g.panel }}
          >
            <div
              className="flex items-center justify-between px-5 py-3 border-b"
              style={{ borderColor: g.hairline }}
            >
              <span
                className="font-mono text-[12px] tracking-[0.2em] uppercase"
                style={{ color: g.label }}
              >
                Sample output
              </span>
              <span
                className="font-mono text-[12px] tracking-[0.16em] uppercase"
                style={{ color: RED_TEXT }}
              >
                {sample.market}
              </span>
            </div>

            <motion.div
              key={sample.ticker}
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="p-6 lg:p-8"
            >
              <div className="font-mono text-[15px] tracking-[0.1em]" style={{ color: g.text }}>
                {sample.ticker}
              </div>
              <div className="text-[14px] mt-1" style={{ color: g.label }}>
                {sample.name}
              </div>
              <div className="font-mono text-[12px] mt-1" style={{ color: g.label }}>
                {sample.filing}
              </div>

              <div className="mt-7 pt-6 border-t" style={{ borderColor: g.hairline }}>
                <div
                  className="font-mono text-[12px] tracking-[0.2em] uppercase mb-2"
                  style={{ color: g.label }}
                >
                  Value per share
                </div>
                <div
                  className="font-mono text-[38px] lg:text-[46px] leading-none"
                  style={{ color: g.text }}
                >
                  {sample.currency}
                  {sample.value}
                </div>
                <div className="font-mono text-[12px] mt-3" style={{ color: RED_TEXT }}>
                  {sample.method}
                </div>
              </div>

              <div
                className="mt-7 pt-6 border-t grid grid-cols-3 gap-4 items-start"
                style={{ borderColor: g.hairline }}
              >
                {sample.tiles.map((tile) => (
                  <div key={tile.label}>
                    <div
                      className="font-mono text-[12px] tracking-[0.1em] uppercase mb-1.5 min-h-[32px]"
                      style={{ color: g.label }}
                    >
                      {tile.label}
                    </div>
                    <div className="font-mono text-[16px]" style={{ color: g.text }}>
                      {tile.value}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Which market is on screen. Two dots, not a carousel widget. */}
            <div
              className="flex items-center gap-2 px-6 lg:px-8 pb-6"
            >
              {SAMPLES.map((s, i) => (
                <button
                  key={s.ticker}
                  type="button"
                  aria-label={s.name}
                  onClick={() => setIndex(i)}
                  className="h-[3px] w-8 transition-colors"
                  style={{ background: i === index ? RED : g.hairline }}
                />
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};


/* ================================================================== */
/* Where to start — the four front doors
/* ================================================================== */

//
// The four front doors.
//
// The rule that produced this list, and that should govern anything added to
// it later: a button belongs on the landing page ONLY if the reader arrives
// holding something the ticker search cannot accept. A private company has no
// ticker. An Excel workbook has no ticker. Everything else — correcting a
// reported figure, running a scenario, reading the notes to accounts — happens
// to a model that is already on screen, so it belongs on that screen, beside
// the thing it acts on. Eight buttons here would be a menu; four is a door.
//
// Every card carries its real state. The site's own rule is that nothing
// unverifiable gets stated, and a landing page advertising a tool that does
// not exist yet would break that rule on the first screen.


interface Route {
  number: string;
  title: string;
  line: string;
  status: Status;
  key: 'listed' | 'private' | 'pager' | 'reformat';
}

const ROUTES: Route[] = [
  {
    number: '01',
    title: 'Value a listed company',
    line: 'Type a ticker. The model builds itself from the filings.',
    status: 'LIVE',
    key: 'listed',
  },
  {
    number: '02',
    title: 'Value a private company',
    line: 'No filings needed. Enter the figures, get the same model.',
    status: 'IN BUILD',
    key: 'private',
  },
  {
    number: '03',
    title: 'Make a one or two-pager',
    line: 'A company on one page, in the format a desk expects.',
    status: 'IN BUILD',
    key: 'pager',
  },
  {
    number: '04',
    title: 'Reformat your Excel model',
    line: 'Your own workbook, set to convention. No number changed.',
    status: 'PLANNED',
    key: 'reformat',
  },
];

export const WhereToStart: React.FC<{ onRoute: (key: Route['key']) => void }> = ({ onRoute }) => {
  const g = GROUND.dark;

  return (
    <Section ground="dark" id="where-to-start" className="!pt-4 lg:!pt-8">
      <ChapterMark number="01" title="What you can do" ground="dark" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px items-stretch" style={{ background: g.hairline }}>
        {ROUTES.map((route, i) => {
          const live = route.status === 'LIVE';
          return (
            <Reveal key={route.key} delay={i * 0.07} className="h-full">
              <button
                type="button"
                onClick={() => onRoute(route.key)}
                className="group h-full w-full text-left p-7 lg:p-8 transition-colors relative"
                style={{ background: g.bg }}
              >
                {/* The hover state is a border turning red. Nothing lifts,
                    nothing scales — the page should feel like paper, not a
                    dashboard of toys. */}
                <span
                  className="absolute inset-0 border transition-colors pointer-events-none"
                  style={{ borderColor: 'transparent' }}
                />
                <span
                  className="absolute inset-0 border opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                  style={{ borderColor: RED }}
                />

                <div className="flex items-start justify-between mb-8">
                  <span
                    className="font-mono text-[13px] tracking-[0.2em]"
                    style={{ color: g.label }}
                  >
                    {route.number}
                  </span>
                  <StatusChip status={route.status} ground="dark" />
                </div>

                <div
                  className="font-serif text-[21px] lg:text-[23px] leading-[1.2] mb-3"
                  style={{ color: live ? g.text : g.body, letterSpacing: '-0.015em' }}
                >
                  {route.title}
                </div>

                <div className="text-[15px] leading-[1.55]" style={{ color: g.label }}>
                  {route.line}
                </div>

                {live && (
                  <div
                    className="mt-7 inline-flex items-center gap-1.5 font-mono text-[12px] tracking-[0.18em] uppercase"
                    style={{ color: '#C0453E' }}
                  >
                    Open
                    <ArrowUpRight size={13} strokeWidth={1.6} />
                  </div>
                )}
              </button>
            </Reveal>
          );
        })}
      </div>
    </Section>
  );
};


/* ================================================================== */
/* The film slot
/* ================================================================== */

//
// The slot for the explainer film.
//
// Built now, filled later. The panel holds a still today and takes a video
// later without the layout moving, which is the whole point of reserving the
// space before the film exists rather than redesigning the page around it
// afterwards.


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
          {/* Placeholder ground. When the film is ready this becomes a poster
              frame and the button becomes the player. */}
          <span
            className="absolute inset-0"
            style={{
              background:
                'repeating-linear-gradient(135deg, rgba(38,37,33,0.5) 0 1px, transparent 1px 14px)',
            }}
          />

          <span className="absolute inset-0 flex flex-col items-center justify-center gap-6">
            <span
              className="flex items-center justify-center transition-colors"
              style={{
                width: 74,
                height: 74,
                border: `1px solid ${RED}`,
                background: 'rgba(139,30,30,0.18)',
              }}
            >
              <Play size={24} strokeWidth={1.4} style={{ color: '#F2F0EA' }} fill="none" />
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
/* By the numbers
/* ================================================================== */

//
// Four statistics, all of them structural facts about the product rather than
// claims about its popularity. Nobody has to take a user count on trust, and
// this site has no user count worth printing.
//
// The last one is the important one. "Zero buy or sell ratings" is a real
// product decision stated as a figure, and it is the fastest way to say what
// this site is for.


const STATS = [
  { to: 3, suffix: '', label: 'Linked statements' },
  { to: 5, suffix: 'Y', label: 'Of filed history' },
  { to: 3, suffix: '', label: 'Valuation approaches' },
  { to: 0, suffix: '', label: 'Buy or sell ratings' },
];

export const ByTheNumbers: React.FC = () => {
  const g = GROUND.cream;

  return (
    <Section ground="cream" id="by-the-numbers">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-12 gap-x-8">
        {STATS.map((stat, i) => (
          <Reveal key={stat.label} delay={i * 0.08}>
            <div>
              <div
                className="font-mono text-[52px] lg:text-[68px] leading-none"
                style={{ color: g.text, letterSpacing: '-0.03em' }}
              >
                <CountUp to={stat.to} suffix={stat.suffix} />
              </div>
              <div
                className="font-mono text-[12px] tracking-[0.2em] uppercase mt-4"
                style={{ color: g.label }}
              >
                {stat.label}
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
};


/* ================================================================== */
/* Three ways to value
/* ================================================================== */

//
// Three approaches, drawn rather than described.
//
// The Framer draft put a rupee figure at the end of each bar. Those figures
// were invented — the asset value quoted for a real company was nowhere near
// its actual book value — and inventing a number is the one thing this site
// cannot do, least of all on the screen where it claims every figure can be
// checked.
//
// So the bars carry no amounts. Three bars of visibly different lengths say
// the thing that matters, which is that the approaches DISAGREE, and the space
// at the end of each bar is spent explaining what the approach actually asks
// instead. A reader learns more from that than from three numbers they cannot
// verify, and nothing on screen has to be true of any particular company.


const APPROACHES = [
  { name: 'Income', width: 100, question: 'What its future cash is worth today.' },
  { name: 'Market', width: 78, question: 'What buyers pay for companies like it.' },
  { name: 'Asset', width: 46, question: 'What it owns, less what it owes.' },
];

export const ThreeWays: React.FC = () => {
  const g = GROUND.cream;
  const reduced = useReduced();

  return (
    <Section ground="cream" id="three-ways">
      <ChapterMark number="02" title="Three ways to value" ground="cream" />

      <Reveal>
        <Headline ground="cream" square className="max-w-[16ch] mb-16 lg:mb-20">
          Three answers, not one
        </Headline>
      </Reveal>

      <div className="space-y-12 lg:space-y-14">
        {APPROACHES.map((approach, i) => (
          <Reveal key={approach.name} delay={i * 0.12}>
            <div className="grid grid-cols-1 lg:grid-cols-[120px_1fr] gap-3 lg:gap-10">
              <div
                className="font-mono text-[13px] tracking-[0.2em] uppercase lg:pt-[2px]"
                style={{ color: g.text }}
              >
                {approach.name}
              </div>

              <div>
                {/* The bar carries no amount. Three lengths say the thing that
                    matters — the approaches disagree — and the space is spent
                    on what each one asks instead of on a figure nobody could
                    check. */}
                <div className="h-[3px] mb-4" style={{ background: g.hairline }}>
                  <motion.div
                    className="h-full"
                    style={{ background: RED, transformOrigin: 'left' }}
                    initial={reduced ? false : { scaleX: 0 }}
                    whileInView={{ scaleX: approach.width / 100 }}
                    viewport={{ once: true, amount: 0.6 }}
                    transition={{ duration: 1.1, delay: 0.15 + i * 0.12, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
                <div className="text-[17px] lg:text-[18px]" style={{ color: g.body }}>
                  {approach.question}
                </div>
              </div>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal delay={0.2}>
        <p
          className="mt-20 font-serif text-[24px] lg:text-[30px] max-w-[26ch] leading-[1.32]"
          style={{ color: g.text, letterSpacing: '-0.015em' }}
        >
          They do not agree, and they are not supposed to.
        </p>
      </Reveal>
    </Section>
  );
};


/* ================================================================== */
/* The workflow
/* ================================================================== */

//
// Ticker to model, in six steps and about twenty-five words.
//
// This section used to be the worst offender on the page: six headings, each
// with a paragraph under it. Nobody reads six paragraphs on a landing page.
// Every paragraph has been deleted and replaced with a small animation that
// shows the step happening — a field typing a ticker, statement rows filling
// in, a slider moving a value. The dotted line joining them is drawn by the
// reader's own scrolling, with a marker travelling along it.
//
// The filings shown in step two are named the way a filing is named in every
// market: an annual report, quarterly results, the notes to the accounts. The
// draft named 10-K, 10-Q and 8-K, which are US forms, on a site that covers
// NSE, BSE, LSE and TSX as well as EDGAR.


const dark = GROUND.dark;

/* ------------------------------------------------------------------ */
/* Step visuals                                                        */
/* Each plays ONCE when it arrives, then rests. Nothing loops.         */
/* ------------------------------------------------------------------ */

const Frame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    className="border p-4 font-mono text-[13px]"
    style={{ borderColor: dark.hairline, background: dark.panel, minHeight: 96 }}
  >
    {children}
  </div>
);

/** 1. A search field that types a ticker by itself. */
const TypeATicker: React.FC<{ play: boolean }> = ({ play }) => {
  const full = 'RELIANCE.NS';
  const reduced = useReduced();
  const [shown, setShown] = useState('');

  useEffect(() => {
    if (!play) return;
    if (reduced) {
      setShown(full);
      return;
    }
    let i = 0;
    const timer = setInterval(() => {
      i += 1;
      setShown(full.slice(0, i));
      if (i >= full.length) clearInterval(timer);
    }, 85);
    return () => clearInterval(timer);
  }, [play, reduced]);

  return (
    <Frame>
      <div
        className="flex items-center gap-2 border-b pb-2 mb-3"
        style={{ borderColor: dark.hairline }}
      >
        <span style={{ color: RED_TEXT }}>&gt;</span>
        <span style={{ color: dark.text }}>{shown}</span>
        <span
          className="inline-block w-[7px] h-[15px] ml-[1px]"
          style={{ background: shown.length < full.length ? RED : 'transparent' }}
        />
      </div>
      <div
        className="text-[12px]"
        style={{ color: shown === full ? dark.body : dark.hairline, transition: 'color 300ms' }}
      >
        Reliance Industries Ltd · NSE
      </div>
    </Frame>
  );
};

/** 2. Three filings stacking into place, named neutrally. */
const FilingsArrive: React.FC<{ play: boolean }> = ({ play }) => {
  const reduced = useReduced();
  const docs = ['Annual report', 'Quarterly results', 'Notes to the accounts'];
  return (
    <Frame>
      <div className="space-y-2">
        {docs.map((doc, i) => (
          <motion.div
            key={doc}
            initial={reduced ? false : { opacity: 0, y: -8 }}
            animate={play ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.15 * i, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center justify-between border px-3 py-1.5 text-[12px]"
            style={{ borderColor: dark.hairline, color: dark.body }}
          >
            <span>{doc}</span>
            <span style={{ color: RED_TEXT }}>as filed</span>
          </motion.div>
        ))}
      </div>
    </Frame>
  );
};

/** 3. Statement rows filling in from the top down. */
const ModelBuilds: React.FC<{ play: boolean }> = ({ play }) => {
  const reduced = useReduced();
  const rows = [
    ['Revenue', '9,74,864', '10,52,851', '11,36,203'],
    ['EBITDA', '1,62,145', '1,75,308', '1,89,420'],
    ['Free cash flow', '41,206', '48,933', '56,187'],
  ];
  return (
    <Frame>
      <div className="space-y-2">
        {rows.map((row, i) => (
          <motion.div
            key={row[0]}
            initial={reduced ? false : { opacity: 0 }}
            animate={play ? { opacity: 1 } : {}}
            transition={{ duration: 0.45, delay: 0.2 * i }}
            className="grid grid-cols-[1fr_auto_auto_auto] gap-3 text-[12px]"
          >
            <span style={{ color: dark.label }}>{row[0]}</span>
            {row.slice(1).map((cell, j) => (
              <span key={j} className="text-right tabular-nums" style={{ color: dark.text }}>
                {cell}
              </span>
            ))}
          </motion.div>
        ))}
      </div>
      <div className="text-[11px] mt-3" style={{ color: dark.label }}>
        sample output
      </div>
    </Frame>
  );
};

/** 4. Three bars growing to different heights. */
const ThreeAnswers: React.FC<{ play: boolean }> = ({ play }) => {
  const reduced = useReduced();
  const bars = [
    { name: 'Income', w: 100 },
    { name: 'Market', w: 74 },
    { name: 'Asset', w: 44 },
  ];
  return (
    <Frame>
      <div className="space-y-3 pt-1">
        {bars.map((bar, i) => (
          <div key={bar.name} className="flex items-center gap-3">
            <span className="text-[11px] w-14" style={{ color: dark.label }}>
              {bar.name}
            </span>
            <div className="flex-1 h-[3px]" style={{ background: dark.hairline }}>
              <motion.div
                className="h-full"
                style={{ background: RED, transformOrigin: 'left' }}
                initial={reduced ? false : { scaleX: 0 }}
                animate={play ? { scaleX: bar.w / 100 } : {}}
                transition={{ duration: 0.9, delay: 0.12 * i, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          </div>
        ))}
      </div>
    </Frame>
  );
};

/** 5. A slider nudging, and the value beside it changing. */
const MoveAssumption: React.FC<{ play: boolean }> = ({ play }) => {
  const reduced = useReduced();
  const [pct, setPct] = useState(38);

  useEffect(() => {
    if (!play || reduced) return;
    const timer = setTimeout(() => setPct(72), 500);
    return () => clearTimeout(timer);
  }, [play, reduced]);

  const wacc = (8.2 + (pct - 38) * 0.021).toFixed(1);

  return (
    <Frame>
      <div className="flex items-baseline justify-between mb-4">
        <span className="text-[11px] tracking-[0.16em] uppercase" style={{ color: dark.label }}>
          Cost of capital
        </span>
        <span className="text-[19px] tabular-nums" style={{ color: dark.text }}>
          {wacc}%
        </span>
      </div>
      <div className="relative h-[3px]" style={{ background: dark.hairline }}>
        <motion.div
          className="absolute top-0 left-0 h-full"
          style={{ background: RED }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        />
        <motion.div
          className="absolute top-1/2 -translate-y-1/2"
          style={{ width: 9, height: 9, background: '#F2F0EA' }}
          animate={{ left: `calc(${pct}% - 4px)` }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
      <div className="text-[11px] mt-4" style={{ color: RED_TEXT }}>
        every figure downstream recalculates
      </div>
    </Frame>
  );
};

/** 6. A workbook grid filling with live formulas. */
const TakeTheWorkbook: React.FC<{ play: boolean }> = ({ play }) => {
  const reduced = useReduced();
  const cells = ['=B12*(1+B4)', '=C12-C18', '=C24/(B31-B32)', '=SUM(C40:G40)'];
  return (
    <Frame>
      <div className="grid grid-cols-2 gap-2">
        {cells.map((cell, i) => (
          <motion.div
            key={cell}
            initial={reduced ? false : { opacity: 0 }}
            animate={play ? { opacity: 1 } : {}}
            transition={{ duration: 0.4, delay: 0.13 * i }}
            className="border px-2 py-1.5 text-[11px] truncate"
            style={{ borderColor: dark.hairline, color: '#5B8DEF' }}
          >
            {cell}
          </motion.div>
        ))}
      </div>
      <div className="text-[11px] mt-3" style={{ color: dark.label }}>
        formulas, not pasted values
      </div>
    </Frame>
  );
};

/* ------------------------------------------------------------------ */
/* The steps                                                           */
/* ------------------------------------------------------------------ */

const STEPS = [
  { n: '01', title: 'Type a ticker', Visual: TypeATicker },
  { n: '02', title: 'The filings arrive', Visual: FilingsArrive },
  { n: '03', title: 'The model builds', Visual: ModelBuilds },
  { n: '04', title: 'Three answers appear', Visual: ThreeAnswers },
  { n: '05', title: 'Move any assumption', Visual: MoveAssumption },
  { n: '06', title: 'Take the workbook', Visual: TakeTheWorkbook },
];

/* The route the marker travels. Drawn in the SVG's own coordinates so it
   scales with the section instead of needing pixel maths. */
const ROUTE =
  'M240,120 C420,160 480,310 660,350 C480,390 420,540 240,580 ' +
  'C420,620 480,770 660,810 C480,850 420,1000 240,1040 C420,1080 480,1230 660,1270';

const Step: React.FC<{ step: (typeof STEPS)[number]; align: 'left' | 'right' }> = ({
  step,
  align,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const { Visual } = step;

  return (
    <div
      ref={ref}
      className={`w-full lg:w-[42%] ${align === 'right' ? 'lg:ml-auto' : ''}`}
    >
      <div className="flex items-baseline gap-4 mb-4">
        <span className="font-mono text-[13px] tracking-[0.2em]" style={{ color: RED_TEXT }}>
          {step.n}
        </span>
        <span
          className="font-serif text-[24px] lg:text-[28px]"
          style={{ color: dark.text, letterSpacing: '-0.02em' }}
        >
          {step.title}
        </span>
      </div>
      <Visual play={inView} />
    </div>
  );
};

export const WorkflowPath: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const reduced = useReduced();

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start 0.85', 'end 0.4'],
  });

  const [progress, setProgress] = useState(0);
  const [marker, setMarker] = useState<{ x: number; y: number } | null>(null);

  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    const clamped = Math.max(0, Math.min(1, v));
    setProgress(clamped);
    const path = pathRef.current;
    if (!path) return;
    // getTotalLength works in the SVG's own user units, so this stays correct
    // at every screen width without measuring anything in pixels.
    const point = path.getPointAtLength(clamped * path.getTotalLength());
    setMarker({ x: point.x, y: point.y });
  });

  return (
    <Section ground="dark" overlap id="workflow">
      <ChapterMark number="03" title="The workflow" ground="dark" />
      <Headline ground="dark" square className="mb-20 lg:mb-24">
        Ticker to model
      </Headline>

      <div ref={containerRef} className="relative">
        {/* The route. Hidden below the large breakpoint, where the steps
            stack in one column and a snaking line would only be noise. */}
        <svg
          className="hidden lg:block absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 900 1390"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d={ROUTE}
            fill="none"
            stroke={dark.hairline}
            strokeWidth={2}
            strokeDasharray="2 10"
            strokeLinecap="round"
          />
          <path
            ref={pathRef}
            d={ROUTE}
            fill="none"
            stroke={RED}
            strokeWidth={2}
            strokeDasharray="2 10"
            strokeLinecap="round"
            pathLength={1}
            style={{
              strokeDasharray: `${progress} 1`,
              opacity: reduced ? 0 : 1,
            }}
          />
          {marker && !reduced && (
            <g transform={`translate(${marker.x}, ${marker.y})`}>
              <rect x={-5} y={-5} width={10} height={10} fill={RED} />
            </g>
          )}
        </svg>

        <div className="relative space-y-16 lg:space-y-0">
          {STEPS.map((step, i) => (
            <div key={step.n} className="lg:h-[230px] flex items-start">
              <Step step={step} align={i % 2 === 0 ? 'left' : 'right'} />
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
};


/* ================================================================== */
/* In the margin
/* ================================================================== */

//
// The centrepiece, and the section that does two jobs at once.
//
// A reader who has never seen a financial model gets the first plain
// explanation anyone has offered them. A professional reads the same animation
// as the site's actual promise: every figure resolves to a filing. They are the
// same gesture, so they are one section rather than two.
//
// It is also, literally, marginalia — a note drawn out into the margin beside
// the line it explains. The brand does the explaining.
//
// Two things deliberately absent. No company is named, because the figures
// here are a sample and attributing them to a real company would be a claim
// nobody could check. And no source cites a line number: the draft said
// "filed income statement, line 7", which is precision the site does not have.


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

  useEffect(() => {
    if (reduced) return;
    const timer = setInterval(() => setActive((i) => (i + 1) % LINES.length), 4200);
    return () => clearInterval(timer);
  }, [reduced]);

  const line = LINES[active];

  return (
    <Section ground="cream" id="in-the-margin">
      <ChapterMark number="05" title="In the margin" ground="cream" />

      <Reveal>
        <Headline ground="cream" square className="max-w-[18ch] mb-16 lg:mb-20">
          Every figure has a source
        </Headline>
      </Reveal>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-10 lg:gap-0">
        {/* -------------------------------------------------------- */}
        {/* The model excerpt                                          */}
        {/* -------------------------------------------------------- */}
        <div className="relative">
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
                  onClick={() => setActive(i)}
                  className="w-full text-left flex items-baseline justify-between border-b px-1 transition-colors"
                  style={{
                    borderColor: g.hairline,
                    height: ROW_H,
                    background: on ? 'rgba(139,30,30,0.05)' : 'transparent',
                  }}
                >
                  <span
                    className="font-mono text-[14px] tracking-[0.04em] transition-colors"
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
            {/* The rule drawn out into the margin. Measured from the first
                row, so it lands on the active row's centre exactly. */}
            <motion.div
              className="hidden lg:block absolute h-px pointer-events-none"
              style={{ background: RED, left: '100%', width: 64 }}
              animate={{ top: active * ROW_H + ROW_H / 2 }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        </div>

        {/* -------------------------------------------------------- */}
        {/* The note                                                   */}
        {/* -------------------------------------------------------- */}
        <div className="lg:pl-24 lg:pt-16">
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
              <p
                className="font-serif text-[24px] lg:text-[30px] leading-[1.32] max-w-[22ch]"
                style={{ color: g.text, letterSpacing: '-0.015em' }}
              >
                {line.note}
              </p>
              <div
                className="font-mono text-[12px] mt-6 pt-4 border-t inline-block"
                style={{ color: g.label, borderColor: g.hairline }}
              >
                {line.source}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Three plain questions. The section never uses the word beginner. */}
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
/* The Margin Notes and the roadmap
/* ================================================================== */

//
// The education band, and the roadmap.
//
// Two naming decisions. The section is called the Margin Notes rather than
// anything describing the reader — nobody clicks a button that calls them a
// beginner — while the articles underneath keep plain descriptive titles,
// because "What is a DCF" is what somebody actually types into a search box.
//
// The roadmap quarters are counted forward from today rather than copied from
// a draft. The Framer version opened with Q2 2026, which had already passed.


const NOTES = [
  {
    title: 'What is a DCF',
    line: 'Future cash, brought back to what it is worth today.',
  },
  {
    title: 'What operating margin tells you',
    line: 'How much of each rupee of sales survives the cost of trading.',
  },
  {
    title: 'Why profit and cash are not the same',
    line: 'Profit follows the accounting rules. Cash follows the bank account.',
  },
];

/* Counted from the current quarter so the roadmap cannot silently go stale. */
const upcomingQuarters = (count: number) => {
  const now = new Date();
  let q = Math.floor(now.getMonth() / 3) + 1;
  let y = now.getFullYear();
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    q += 1;
    if (q > 4) {
      q = 1;
      y += 1;
    }
    out.push(`Q${q} ${y}`);
  }
  return out;
};

const ROADMAP: { title: string; status: Status }[] = [
  { title: 'Private company inputs', status: 'IN BUILD' },
  { title: 'Things to check in a filing', status: 'IN BUILD' },
  { title: 'One-page desk summary', status: 'IN BUILD' },
  { title: 'Workbook reformatting', status: 'PLANNED' },
];

export const MarginNotes: React.FC<{ onOpenNotes: () => void }> = ({ onOpenNotes }) => {
  const g = GROUND.cream;
  const quarters = upcomingQuarters(ROADMAP.length);

  return (
    <Section ground="cream" id="margin-notes">
      <ChapterMark number="06" title="The margin notes" ground="cream" />

      <Reveal>
        <Headline ground="cream" className="mb-4">
          The Margin Notes
        </Headline>
        <p className="text-[17px] lg:text-[19px] mb-14 max-w-[44ch]" style={{ color: g.body }}>
          Read any company's accounts without a finance degree.
        </p>
      </Reveal>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-px mb-10" style={{ background: g.hairline }}>
        {NOTES.map((note, i) => (
          <Reveal key={note.title} delay={i * 0.08}>
            <button
              type="button"
              onClick={onOpenNotes}
              className="group h-full w-full text-left p-7 lg:p-8 relative"
              style={{ background: g.bg }}
            >
              <span
                className="absolute inset-0 border opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                style={{ borderColor: '#8B1E1E' }}
              />
              <div
                className="font-serif text-[20px] lg:text-[22px] leading-[1.25] mb-3"
                style={{ color: g.text, letterSpacing: '-0.015em' }}
              >
                {note.title}
              </div>
              <div className="text-[15px] leading-[1.55]" style={{ color: g.label }}>
                {note.line}
              </div>
            </button>
          </Reveal>
        ))}
      </div>

      <Reveal>
        <button
          type="button"
          onClick={onOpenNotes}
          className="inline-flex items-center gap-2 font-mono text-[13px] tracking-[0.18em] uppercase border-b pb-1 mb-20"
          style={{ color: g.text, borderColor: '#8B1E1E' }}
        >
          Read the notes
          <ArrowRight size={14} strokeWidth={1.6} />
        </button>
      </Reveal>

      {/* ----------------------------------------------------------- */}
      {/* What is coming. A roadmap, never a feature list.              */}
      {/* ----------------------------------------------------------- */}
      <div
        className="font-mono text-[12px] tracking-[0.2em] uppercase mb-6 pt-10 border-t"
        style={{ color: g.label, borderColor: g.hairline }}
      >
        What is being built next
      </div>

      <div>
        {ROADMAP.map((item, i) => (
          <div
            key={item.title}
            className="flex items-center justify-between gap-6 py-4 border-b"
            style={{ borderColor: g.hairline }}
          >
            <div className="flex items-baseline gap-6 lg:gap-10 min-w-0">
              <span
                className="font-mono text-[12px] tracking-[0.16em] shrink-0"
                style={{ color: g.label }}
              >
                {quarters[i]}
              </span>
              <span className="text-[16px] lg:text-[17px] truncate" style={{ color: g.text }}>
                {item.title}
              </span>
            </div>
            <StatusChip status={item.status} ground="cream" />
          </div>
        ))}
      </div>
    </Section>
  );
};


/* ================================================================== */
/* Final call to action
/* ================================================================== */

export const FinalCta: React.FC<{
  onOpenListed: () => void;
  onOpenPrivate: () => void;
}> = ({ onOpenListed, onOpenPrivate }) => {
  const g = GROUND.dark;

  return (
    <Section ground="dark" overlap id="final-cta">
      <Reveal>
        <div className="py-10 lg:py-20 flex flex-col items-center text-center">
          <Headline ground="dark" square className="!text-[42px] sm:!text-[60px] lg:!text-[76px]">
            Open a company
          </Headline>

          <div className="mt-12 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={onOpenListed}
              className="font-mono text-[13px] tracking-[0.18em] uppercase px-7 py-4 border"
              style={{ borderColor: RED, background: 'rgba(139,30,30,0.22)', color: g.text }}
            >
              Value a listed company
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
      </Reveal>
    </Section>
  );
};
