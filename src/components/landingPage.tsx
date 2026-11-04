// FILE: src/components/landingPage.tsx
//
// The landing page.
//
// The first ten sections are bound to the particle object: the wordmark, then
// the site explained one step at a time, then it lets go. What used to sit in
// those sections was a list of features — "every line driven by an assumption"
// — which tells a reader who already understands the product something they
// already know, and tells everybody else nothing. They now walk through what
// actually happens: the filings are read, a forecast is built, profit is
// turned into cash, the cash is discounted, three approaches are run, the
// model is yours to edit and to download, and here is what is still being
// built.
//
// The sections after the object are ordinary bands — coverage, the sourced
// figures, the margin notes, the form — because by then the reader is reading
// rather than being shown. The first of them slides up OVER the object, which
// is what marks the change of register.
//
// Two rules govern the layout. The object and the words never share space:
// the object takes a side and the words take the other, and a soft scrim sits
// under the text wherever the object passes behind it. And every heading is
// Inter set very tight — an editorial serif at display size reads as a
// magazine, and this is meant to read as an institution. Playfair is kept for
// the three places it earns: the wordmark, the margin notes, and the quote.

import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '../design/motion';
import { useConstrained } from '../design/constrained';
/* THE 3D CHUNK LOADS AFTER THE FIRST PAINT (VISUAL_SYSTEM §6, job 8.7):
   three.js is its own chunk, fetched once the page has drawn, and the poster
   is what is painted first. */
const ParticleField = lazy(() => import('./particleField'));
/* The still the page paints first, and the largest thing it paints: the
   wordmark as the particle field draws it, captured once (≤ 60KB). */
const HERO_POSTER = '/hero-poster.webp';
import { MarginNotesSection } from './marginNotesSection';
import { DARK, PAPER, TYPE } from '../design/tokens';
import { Mark } from '../design/Mark';
import { featureById, statusLabel, claimFor, isShipped, CLAIMS, companyCountLabel } from '../data/featureRegister';
import type { Feature } from '../data/featureRegister';

/* The sections the object is bound to, in page order. Every id here must be
   rendered below, and the object holds one formation per entry. */
const OBJECT_SECTIONS = [
  'hero',
  'routes',
  'filings',
  'forecast',
  'cash',
  'discount',
  'answers',
  'workbench',
  'beyond',
  'letgo',
];

// Colours come from the one palette. They used to be six local constants at
// the top of this file, and six more at the top of four of its neighbours.
const { accent: RED, ink: INK, read: READ, muted: MUTED, quiet: QUIET, line: LINE } = DARK;

const DISPLAY: React.CSSProperties = {
  fontFamily: TYPE.display,
  fontWeight: 800,
  letterSpacing: '-0.045em',
  lineHeight: 0.96,
};

/* ------------------------------------------------------------------ */
/* Furniture                                                           */
/* ------------------------------------------------------------------ */

const Eyebrow: React.FC<{ children: React.ReactNode; centred?: boolean; n?: string }> = ({
  children,
  centred,
  n,
}) => (
  <p
    /* NO RED LABEL TEXT. The red stays on the rule beside the words rather
       than in them: one oxblood hairline is the accent, and the label itself
       is read. A label set in the accent colour on every section is the same
       mistake spaced capitals were — a device used everywhere, which stops
       being emphasis and becomes the voice of the page. */
    className={`font-figure text-[13px] mb-6 flex items-center gap-3 ${
      centred ? 'justify-center' : ''
    }`}
    style={{ color: MUTED }}
  >
    <span className="h-px w-8 shrink-0" style={{ background: RED }} />
    {/* LANDING §3.1: the number in an eyebrow is in quiet, never in the
        accent, and the words are muted. */}
    {n && (
      <span data-eyebrow-number style={{ color: QUIET }}>
        {n}&nbsp;&middot;
      </span>
    )}
    <span>{children}</span>
  </p>
);


/* The vertical mask every scrim wears, so no scrim ever ends on a hard edge.
   Transparent at both extremes, solid across the middle three fifths. */
const FADE_ENDS =
  'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 20%, rgba(0,0,0,1) 80%, rgba(0,0,0,0) 100%)';

/* One block of words, on one side, over a scrim. */
const Block: React.FC<{
  id: string;
  side: 'left' | 'right' | 'mid';
  children: React.ReactNode;
}> = ({ id, side, children }) => {
  /* THE WORDS COME FIRST.
     The object is behind the reading, never over it. Now that there are
     bright stars and a sky back there, a gentle wash is not enough: the
     scrim is effectively solid across the column the text sits in, holds
     most of its weight a good way past it, and only lets go once it is
     clear of the last line. */
  const scrim =
    side === 'left'
      ? 'linear-gradient(to right, rgba(9,9,11,.985) 0%, rgba(9,9,11,.965) 30%, rgba(9,9,11,.80) 46%, rgba(9,9,11,.34) 62%, rgba(9,9,11,0) 76%)'
      : side === 'right'
      ? 'linear-gradient(to left, rgba(9,9,11,.985) 0%, rgba(9,9,11,.965) 30%, rgba(9,9,11,.80) 46%, rgba(9,9,11,.34) 62%, rgba(9,9,11,0) 76%)'
      : 'linear-gradient(to top, rgba(9,9,11,.985) 8%, rgba(9,9,11,.90) 30%, rgba(9,9,11,.52) 50%, rgba(9,9,11,0) 74%)';

  const justify =
    side === 'left' ? 'justify-start' : side === 'right' ? 'justify-end' : 'justify-center';

  return (
    <section
      id={id}
      className={`relative min-h-screen flex items-center py-32 ${
        id === 'hero' ? 'items-end pb-16' : ''
      }`}
    >
      {/* THE SEAM.
          Each section used to paint its scrim across exactly its own box, so
          where two sections met one gradient stopped dead and the next
          started — and because they take opposite sides, the left half of
          the screen went from covered to clear in a single pixel. That is
          the line. Each scrim now runs well past its own section at both
          ends and is masked so it fades away there, which means neighbours
          overlap and cross-fade instead of butting. Full strength is held
          across the middle, where the words are. */}
      <div
        className="absolute inset-x-0 -z-10 pointer-events-none hidden lg:block"
        style={{
          top: '-16%',
          bottom: '-16%',
          background: scrim,
          maskImage: FADE_ENDS,
          WebkitMaskImage: FADE_ENDS,
        }}
      />
      <div
        className="absolute inset-x-0 -z-10 pointer-events-none lg:hidden"
        style={{
          top: '-16%',
          bottom: '-16%',
          background:
            'linear-gradient(to top, rgba(9,9,11,.985) 16%, rgba(9,9,11,.90) 44%, rgba(9,9,11,.50) 62%, rgba(9,9,11,0) 84%)',
          maskImage: FADE_ENDS,
          WebkitMaskImage: FADE_ENDS,
        }}
      />
      <div
        className={`w-full max-w-[1380px] mx-auto px-6 sm:px-10 lg:px-16 flex ${justify}`}
      >
        <div
          className={`w-full pointer-events-auto ${
            side === 'mid' ? 'max-w-[42rem] text-center' : 'max-w-[33rem]'
          }`}
        >
          {children}
        </div>
      </div>
    </section>
  );
};

const Readout: React.FC<{ rows: [string, string][]; centred?: boolean }> = ({ rows, centred }) => (
  <div
    className={`font-figure text-[13px] border-t pt-4 mt-7 grid gap-2 ${
      centred ? 'justify-items-center' : ''
    }`}
    style={{ borderColor: LINE, color: MUTED }}
  >
    {rows.map(([k, v]) => (
      <div key={k}>
        <span style={{ color: MUTED }}>{k}</span>
        &nbsp;&nbsp;
        <span style={{ color: INK, fontWeight: 500 }}>{v}</span>
      </div>
    ))}
  </div>
);

/* A figure that counts up to itself the first time it is seen. It runs once
   and then stops: a number that re-animates every time it scrolls past reads
   as a widget rather than as a fact. */
const CountUp: React.FC<{ to: number; suffix?: string }> = ({ to, suffix = '' }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(0);
  // VISUAL_SYSTEM §8: on a phone-width or low-end device, and under reduced
  // motion, the figure is shown at its value at once.
  const still = useConstrained() !== null || useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (still || typeof IntersectionObserver === 'undefined') { setN(to); return; }

    let raf = 0;
    let fired = false;
    const io = new IntersectionObserver(
      (entries) => {
        if (fired || !entries[0].isIntersecting) return;
        fired = true;
        io.disconnect();
        const t0 = performance.now();
        const DURATION = 1900;
        const step = (now: number) => {
          /* clamp both ends: the timestamp rAF hands back is the frame's
             start time and can predate the performance.now() taken a moment
             earlier, which briefly counted through negative numbers. */
          const p = Math.min(1, Math.max(0, (now - t0) / DURATION));
          setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
          if (p < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
      },
      { threshold: 0.35 }
    );
    io.observe(el);
    return () => { io.disconnect(); if (raf) cancelAnimationFrame(raf); };
  }, [to, still]);

  return (
    <span ref={ref} className="tabular-nums">
      {n.toLocaleString('en-IN')}
      {suffix}
    </span>
  );
};

/* ------------------------------------------------------------------ */
/* The four front doors                                                */
/*                                                                     */
/* A button belongs on the landing page only if the reader arrives      */
/* holding something the ticker search cannot accept. A private company */
/* has no ticker; a workbook has no ticker. Everything else acts on a   */
/* model that already exists and belongs on that model's own screen.    */
/* Status is stated once, in the roadmap lower down, and nowhere else.  */
/* ------------------------------------------------------------------ */
/* FROM THE FEATURE REGISTER (`src/data/featureRegister.ts`, LANDING §2.4).
   A route that has not shipped keeps its place, carries its status, is
   written in the future tense and opens nothing. */
const ROUTES: { n: string; feature: Feature }[] = ['listed-company', 'private-company', 'one-pager', 'reformat-workbook'].map(
  (id, i) => ({ n: String(i + 1).padStart(2, '0'), feature: featureById(id) as Feature })
);

/* What is not built yet. Every line here is stated as a plan, because a plan
   described in the present tense is a false claim about a website. */
const NEXT: Feature[] = ['one-pager', 'lbo', 'private-company'].map((id) => featureById(id) as Feature);


const MARGIN_LINES = [
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

/* THE COUNTS (LANDING §2.3, decisions 2–4). Each is read from what it
   claims about, or not shown: the company count and the exchanges from the
   screener table, the years from the register's recorded claim. "Free to
   use" waits for pricing (decision 2); "Three valuation approaches" waits
   for build step 5 to ship (decision 4). */
interface Stat { key: string; to: number; suffix: string; label: string; detail: string; source: string }

function useCoverage(): { count: number | null; exchanges: string[]; built: string | null } {
  const [state, setState] = useState<{ count: number | null; exchanges: string[]; built: string | null }>({
    count: null,
    exchanges: [],
    built: null,
  });
  useEffect(() => {
    let alive = true;
    fetch('/api/screener')
      .then((r) => r.json())
      .then((body) => {
        if (!alive || !Array.isArray(body?.rows)) return;
        // One listing per company, as the screener counts them.
        const home = body.rows.filter((row: any) => row?.homeListing !== false);
        const exchanges = [...new Set(home.map((row: any) => row?.exchange).filter(Boolean))].sort() as string[];
        setState({ count: home.length, exchanges, built: body.built ?? null });
      })
      .catch(() => {
        /* No table, no count: the tile is left out rather than guessed. */
      });
    return () => {
      alive = false;
    };
  }, []);
  return state;
}

/** The years claim in words, for the hero's sentence. */
const YEARS_IN_WORDS: Record<number, string> = { 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten' };

const asAt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : null;

/* ------------------------------------------------------------------ */

interface LandingProps {
  onOpenCompany: () => void;
  onScrollTo: (id: string) => void;
  /* Opens the Margin Notes screen. The three cards on the band below and
     the closing button both use it, so a reader who wants to read a note
     lands on the note rather than on a card that does nothing. */
  onOpenNotes: (key?: string) => void;
  /* The feedback form and the analyst card are existing components and are
     dropped in here, before the closing call to action, so the page still
     ends on an invitation. */
  children?: React.ReactNode;
}

export const LandingPage: React.FC<LandingProps> = ({ onOpenCompany, onScrollTo, onOpenNotes, children }) => {
  const [launching, setLaunching] = useState(false);
  const reducedMotion = useReducedMotion();
  // The field mounts after the first paint, never before it.
  const [fieldWanted, setFieldWanted] = useState(false);
  const [fieldDrawn, setFieldDrawn] = useState(false);
  const [fieldFrozen, setFieldFrozen] = useState(false);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    let a = 0, b = 0;
    a = requestAnimationFrame(() => { b = requestAnimationFrame(() => setFieldWanted(true)); });
    return () => { cancelAnimationFrame(a); cancelAnimationFrame(b); };
  }, []);
  // VISUAL_SYSTEM §8: a phone-width screen or a low-end device gets the
  // poster and no WebGL at all (src/design/constrained.ts says which signals).
  const constrained = useConstrained();
  const fieldOn = fieldWanted && !reducedMotion && !fieldFrozen && !constrained;
  const heroMode = fieldOn
    ? 'field'
    : `poster:${constrained ?? (reducedMotion ? 'reduced-motion' : fieldFrozen ? 'slow-frames' : 'loading')}`;
  const posterOn = !fieldOn || !fieldDrawn;
  const coverage = useCoverage();
  const countLabel = companyCountLabel(coverage.count);
  const builtAt = asAt(coverage.built);
  const STATS: (Stat & { label: string; text: string | null })[] = [
    ...(countLabel
      ? [{
          key: 'companies', to: coverage.count as number, suffix: '', text: countLabel,
          label: 'Listed companies',
          detail: coverage.exchanges.join(' · '),
          source: `Counted from the screener table${builtAt ? `, as at ${builtAt}` : ''}`,
        }]
      : []),
    {
      key: 'years', to: CLAIMS.historyYears, suffix: 'Y', text: null,
      label: 'Up to, of filed history',
      detail: 'IS · BS · CF · WC · PP&E · Debt · Equity',
      source: 'Fiscal years read from each company\u2019s own filings',
    },
    ...(isShipped('three-approaches')
      ? [{ key: 'approaches', to: 3, suffix: '', text: null, label: 'Valuation approaches', detail: 'Income · Market · Asset', source: 'Shown side by side, not averaged' }]
      : []),
  ];
  const [activeMargin, setActiveMargin] = useState(0);
  const marginRef = useRef<HTMLDivElement>(null);

  /* The fly-through: press the button and the object comes at you and past
     you, and the search screen is what is behind it. The navigation waits
     for the object to clear rather than cutting mid-flight. */
  const launch = () => {
    if (launching) return;
    setLaunching(true);
    window.setTimeout(() => {
      setLaunching(false);
      onOpenCompany();
    }, 1150);
  };

  /* THE PINNED FIGURES.
     The section is tall; the panel inside it is exactly one screen and
     sticks to the top. So the page keeps scrolling, the panel does not move,
     and only the note beside the figures changes. The sticky child must
     never be taller than the viewport — a sticky box taller than the screen
     pins the moment its top hits zero and everything below its fold becomes
     unreachable. */
  useEffect(() => {
    const el = marginRef.current;
    if (!el) return;
    let raf = 0;
    const read = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const span = r.height - window.innerHeight;
      if (span <= 0) return;
      const p = Math.min(1, Math.max(0, -r.top / span));
      const i = Math.min(MARGIN_LINES.length - 1, Math.floor(p * MARGIN_LINES.length));
      setActiveMargin(i);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(read); };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    read();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  /* Clicking a row scrolls to the point in the section where that row is the
     live one, so a click and a scroll cannot disagree about what is showing. */
  const chooseMargin = (i: number) => {
    const el = marginRef.current;
    if (!el) { setActiveMargin(i); return; }
    const r = el.getBoundingClientRect();
    const span = r.height - window.innerHeight;
    if (span <= 0) { setActiveMargin(i); return; }
    const top = r.top + window.scrollY;
    window.scrollTo({
      top: top + span * ((i + 0.5) / MARGIN_LINES.length),
      behavior: 'smooth',
    });
  };

  const line = MARGIN_LINES[activeMargin];
  const ROW_H = 78;

  return (
    <div className="relative">
      {/* The night. It sits behind the canvas, so the sky the object stands
          in does not stop at the edge of the object. */}
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 130% 85% at 50% 10%, #14141C 0%, #0E0E13 40%, #08080B 78%, #060608 100%)',
        }}
      />
      <img
        src={HERO_POSTER}
        alt=""
        aria-hidden="true"
        data-hero-poster
        data-hero-mode={heroMode}
        width={1440}
        height={900}
        fetchPriority="high"
        className="absolute inset-x-0 top-0 w-full h-screen object-cover z-[4] pointer-events-none"
        style={{ opacity: posterOn ? 1 : 0, transition: 'opacity var(--m-dur-reveal) var(--m-ease-enter)' }}
      />
      {fieldOn && (
        <Suspense fallback={null}>
          <ParticleField
            sectionIds={OBJECT_SECTIONS}
            launching={launching}
            paused={paused}
            onFirstFrame={() => setFieldDrawn(true)}
            onFreeze={() => setFieldFrozen(true)}
          />
        </Suspense>
      )}

      <div className="relative z-10 pointer-events-none">
        {/* ---------------------------------------------------------- */}
        {/* the wordmark, drawn in particles above the words            */}
        {/* ---------------------------------------------------------- */}
        <Block id="hero" side="mid">
          {/* LANDING §2.1, final text. The display and lead steps are the
              landing page's alone (VISUAL_SYSTEM finding 8). "Live models"
              went because it reads as live market data. */}
          <Eyebrow centred>Source: company filings</Eyebrow>
          <h1
            className="text-display mb-6 mx-auto max-w-[1000px]"
            style={{ ...DISPLAY, color: INK, lineHeight: 1.05, textWrap: 'balance' as any }}
          >
            {/* No full stop here: the red square is the full stop. Written
                out, the line ended on two of them. */}
            Filed numbers. A model you can argue with
            <Mark />
          </h1>
          <p className="text-lead leading-[1.5] mx-auto max-w-[620px]" style={{ color: READ }}>
            Marginalia reads up to {YEARS_IN_WORDS[CLAIMS.historyYears] ?? CLAIMS.historyYears} years of a
            company&rsquo;s own filings, builds the three-statement model and DCF, and shows where every
            figure came from.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 justify-center">
            <button
              type="button"
              onClick={launch}
              data-primary
              className="font-figure text-[15px] font-medium h-12 px-5 border transition-colors"
              style={{ borderColor: RED, background: 'rgba(139,30,30,0.2)', color: INK }}
            >
              Value a listed company
            </button>
            {isShipped('private-company') ? (
              <button
                type="button"
                onClick={launch}
                data-feature="private-company"
                className="font-figure text-[15px] font-medium h-12 px-5 border bg-transparent transition-colors hover:border-ink"
                style={{ borderColor: LINE, color: MUTED }}
              >
                Value a private company
              </button>
            ) : (
              /* LANDING §2.4: while private-company inputs are not shipped,
                 the ghost button is a text link to what is being built. */
              <button
                type="button"
                onClick={() => onScrollTo('beyond')}
                className="font-figure text-[15px] h-12 px-2 bg-transparent underline underline-offset-4 transition-colors hover:text-ink"
                style={{ color: MUTED }}
              >
                What is being built next &darr;
              </button>
            )}
          </div>
          <p className="font-figure text-[13px] mt-8" style={{ color: MUTED }}>
            Scroll to see how it works
          </p>
          {fieldOn && (
            /* WCAG 2.2.2: the motion can be stopped. 24×24 at the hero's
               lower edge, inside the pointer-events-none column, so it opts
               back in. */
            <button
              type="button"
              data-motion-toggle
              onClick={() => setPaused((v) => !v)}
              aria-pressed={paused}
              aria-label={paused ? 'Play the animation' : 'Pause the animation'}
              className="pointer-events-auto mx-auto mt-4 flex h-6 w-6 items-center justify-center border border-line-control text-muted hover:text-ink"
            >
              <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
                {paused ? <path d="M3 2 L10 6 L3 10 Z" fill="currentColor" /> : <path d="M3 2 H5 V10 H3 Z M7 2 H9 V10 H7 Z" fill="currentColor" />}
              </svg>
            </button>
          )}
        </Block>

        {/* 01 — what you can do */}
        <Block id="routes" side="right">
          <Eyebrow n="01">What you can do</Eyebrow>
          <h2 className="text-[28px] sm:text-[34px] lg:text-[42px] mb-8" style={{ ...DISPLAY, color: INK }}>
            Four ways in
            <Mark />
          </h2>
          <div className="grid gap-6">
            {ROUTES.map((r) => {
              const shipped = r.feature.status === 'shipped';
              const opens = shipped && r.feature.id === 'listed-company';
              return (
              <button
                key={r.n}
                type="button"
                onClick={opens ? launch : undefined}
                disabled={!opens}
                data-feature={r.feature.id}
                data-feature-status={r.feature.status}
                className={`text-left ${opens ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <div className="flex items-baseline gap-4">
                  <span className="font-figure text-[13px] shrink-0 w-6" style={{ color: QUIET }}>
                    {r.n}
                  </span>
                  <span className="text-[20px] leading-[1.2]" style={{ fontFamily: TYPE.display, fontWeight: 600, color: INK }}>
                    {r.feature.title}
                  </span>
                  {!shipped && (
                    <span className="font-figure text-[13px]" style={{ color: MUTED }}>
                      {statusLabel(r.feature)}
                    </span>
                  )}
                </div>
                <p className="text-[15px] leading-[1.65] mt-2 pl-10" style={{ color: READ }}>
                  {claimFor(r.feature)}
                </p>
              </button>
              );
            })}
          </div>
        </Block>

        {/* 02 — the filings arrive */}
        <Block id="filings" side="left">
          <Eyebrow n="02">Where the numbers come from</Eyebrow>
          <h2 className="text-[28px] sm:text-[34px] lg:text-[44px]" style={{ ...DISPLAY, color: INK }}>
            Five years of accounts, exactly as filed
            <Mark />
          </h2>
          <p className="text-[17px] leading-[1.6] mt-6" style={{ color: READ }}>
            Type a ticker and the site reads the company&rsquo;s own annual
            filings &mdash; income statement, balance sheet, cash flow. Nothing
            is estimated at this stage and nothing is smoothed. What you see is
            what the company reported.
          </p>
          <Readout
            rows={[
              ['What is read', 'the company’s own filings'],
              ['How far back', 'up to five years'],
              ['What is adjusted', 'nothing'],
            ]}
          />
        </Block>

        {/* 03 — the forecast is built */}
        <Block id="forecast" side="right">
          <Eyebrow n="03">The forecast</Eyebrow>
          <h2 className="text-[28px] sm:text-[34px] lg:text-[44px]" style={{ ...DISPLAY, color: INK }}>
            Every forecast line is one assumption you can move
            <Mark />
          </h2>
          <p className="text-[17px] leading-[1.6] mt-6" style={{ color: READ }}>
            Growth, margin, tax rate, capital spending. Each one named on the
            screen, each one yours to change, and every figure underneath it
            recalculating while you watch.
          </p>
          <Readout
            rows={[
              ['What you set', 'growth, margin, tax, capital spending'],
              ['What follows', 'every projected line'],
              ['What is hidden', 'nothing'],
            ]}
          />
        </Block>

        {/* 04 — profit becomes cash */}
        <Block id="cash" side="left">
          <Eyebrow n="04">Profit becomes cash</Eyebrow>
          <h2 className="text-[28px] sm:text-[34px] lg:text-[44px]" style={{ ...DISPLAY, color: INK }}>
            Profit and cash are not the same number
            <Mark />
          </h2>
          <p className="text-[17px] leading-[1.6] mt-6" style={{ color: READ }}>
            Tax comes off, depreciation goes back on, and capital spending and
            the cash tied up in day-to-day trading come out. It is the step most
            summaries skip, and it is the one where the balance sheet has to
            balance in every forecast year. Here it does, and the check is on
            the page.
          </p>
          <Readout
            rows={[
              ['Taken off', 'tax'],
              ['Added back', 'depreciation'],
              ['Taken out', 'capital spending and working capital'],
            ]}
          />
        </Block>

        {/* 05 — the discount */}
        <Block id="discount" side="right">
          <Eyebrow n="05">What it is worth today</Eyebrow>
          <h2 className="text-[28px] sm:text-[34px] lg:text-[44px]" style={{ ...DISPLAY, color: INK }}>
            Every future year, collapsed into one number
            <Mark />
          </h2>
          <p className="text-[17px] leading-[1.6] mt-6" style={{ color: READ }}>
            Cash a company will earn years from now is worth less than cash in
            hand. Discounting spreads those years wide at the base and winds them
            inward, until they meet at a single figure: what the business is
            worth today.
          </p>
          <Readout
            rows={[
              ['At the base', 'every year the company is expected to earn'],
              ['On the way up', 'each year worth a little less than the last'],
              ['At the point', 'what all of it is worth today'],
            ]}
          />
        </Block>

        {/* 06 — three approaches */}
        <Block id="answers" side="left">
          <Eyebrow n="06">Three approaches</Eyebrow>
          <h2 className="text-[28px] sm:text-[34px] lg:text-[44px]" style={{ ...DISPLAY, color: INK }}>
            They do not agree, and they are not supposed to
            <Mark />
          </h2>
          <p className="text-[17px] leading-[1.6] mt-6" style={{ color: READ }}>
            What a business earns, what buyers pay for businesses like it, and
            what it owns outright are three different questions.{' '}
            <span data-feature="three-approaches" data-feature-status={featureById('three-approaches')?.status}>
              {isShipped('three-approaches')
                ? 'All three are run and all three are shown.'
                : 'All three are run; showing them side by side on one chart is being built.'}
            </span>{' '}
            They are not averaged into one tidy
            number, because an average of three different questions answers none
            of them.
          </p>
          <Readout
            rows={[
              ['What it earns', 'its future cash, discounted to today'],
              ['What it would fetch', 'what buyers pay for companies like it'],
              ['What it owns', 'its assets, less what it owes'],
            ]}
          />
        </Block>

        {/* 07 — edit it, then take it away */}
        <Block id="workbench" side="right">
          <Eyebrow n="07">The model is yours</Eyebrow>
          <h2 className="text-[28px] sm:text-[34px] lg:text-[44px]" style={{ ...DISPLAY, color: INK }}>
            Change anything on the page, then take the model with you
            <Mark />
          </h2>
          <p className="text-[17px] leading-[1.6] mt-6" style={{ color: READ }}>
            Nothing here is a picture of a model. Every assumption is editable
            and the model rebuilds as you type. When you are done, download it as
            an Excel workbook with the formulas still live &mdash; inputs in one
            colour, formulas in another &mdash; so it opens on somebody
            else&rsquo;s desk and still works.
          </p>
          <Readout
            rows={[
              ['What you can edit', 'every assumption on the page'],
              ['What updates', 'the whole model, as you type'],
              ['What you download', 'a working Excel file, formulas intact'],
            ]}
          />
        </Block>

        {/* 08 — what is being built, said as a plan and not as a claim */}
        <Block id="beyond" side="left">
          <Eyebrow n="08">Being built next</Eyebrow>
          <h2 className="text-[28px] sm:text-[34px] lg:text-[42px] mb-8" style={{ ...DISPLAY, color: INK }}>
            Three more things, and where each one has got to
            <Mark />
          </h2>
          <div className="grid gap-7">
            {NEXT.map((item) => (
              <div key={item.id} data-feature={item.id} data-feature-status={item.status}>
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="text-[20px] leading-[1.2]" style={{ fontFamily: TYPE.display, fontWeight: 600, color: INK }}>
                    {item.title}
                  </span>
                  <span
                    className="font-figure text-[13px]"
                    style={{
                      color: item.status === 'in_build' ? INK : MUTED,
                      fontWeight: item.status === 'in_build' ? 600 : 400,
                    }}
                  >
                    {statusLabel(item)}
                  </span>
                </div>
                <p className="text-[15px] leading-[1.55] mt-2" style={{ color: MUTED }}>
                  {claimFor(item)}
                </p>
              </div>
            ))}
          </div>
        </Block>

        {/* and then it lets go.
            This section is deliberately long and the quote is pinned inside
            it, so the object has the whole of it to come apart in. Given a
            single screen the dispersal was over before the reader had
            finished the first line. */}
        <section id="letgo" className="relative min-h-[190vh]">
          {/* A scrim across the whole section would dim the dispersal, which
              is the one thing this section exists to show. The only shading
              is a soft pool behind the quote, and it travels with it. */}
          <div
            className="absolute inset-x-0 bottom-0 h-[58vh] -z-10 pointer-events-none"
            style={{
              background:
                'linear-gradient(to top, rgba(9,9,11,.96) 0%, rgba(9,9,11,.52) 42%, rgba(9,9,11,0) 100%)',
            }}
          />
          <div className="sticky top-0 h-screen flex items-center justify-center">
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  'radial-gradient(ellipse 46rem 17rem at 50% 50%, rgba(9,9,11,.95) 0%, rgba(9,9,11,.86) 34%, rgba(9,9,11,.48) 60%, rgba(9,9,11,0) 82%)',
              }}
            />
            <div className="relative w-full max-w-[42rem] mx-auto px-6 sm:px-10 lg:px-16 text-center pointer-events-auto">
              <Eyebrow centred>And then it lets go</Eyebrow>
              <p
                className="font-serif italic text-[24px] sm:text-[30px] lg:text-[38px] leading-[1.32]"
                style={{ color: INK, letterSpacing: '-0.01em' }}
              >
                &ldquo;I would rather be vaguely right than precisely wrong.&rdquo;
              </p>
              <p
                className="font-figure text-[12px] tracking-[0.18em] uppercase mt-5"
                style={{ color: MUTED }}
              >
                John Maynard Keynes
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* ============================================================ */}
      {/* Below here the object has gone and the page is read normally. */}
      {/* The panel is pulled up over the last section so that it rises  */}
      {/* across the object as you scroll rather than following it — the */}
      {/* moment the page changes register from being shown to reading.  */}
      {/* No overflow:hidden on this wrapper: it would make itself the   */}
      {/* scroll container for everything inside and break the pinned    */}
      {/* section further down.                                          */}
      {/* ============================================================ */}
      <div className="relative z-10" style={{ background: '#0B0B0D', marginTop: '-16vh' }}>
        {/* 09 — coverage, counted up on arrival */}
        <section
          id="numbers"
          data-ground="paper"
          className="w-full"
          style={{
            background: PAPER.ground,
            borderTopLeftRadius: 26,
            borderTopRightRadius: 26,
            overflow: 'hidden',
            boxShadow: '0 -50px 110px rgba(0,0,0,0.78)',
          }}
        >
          <div className="max-w-[1380px] mx-auto px-6 sm:px-10 lg:px-16 pt-20 lg:pt-28 pb-10 lg:pb-12">
            <p
              className="font-figure text-[12px] tracking-[0.22em] uppercase mb-12 flex items-center gap-3"
              style={{ color: PAPER.accentText }}
            >
              <span className="h-px w-8" style={{ background: RED }} />
              09 &middot; Coverage
            </p>
            <div className={`grid grid-cols-2 ${STATS.length >= 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'} gap-y-14 gap-x-8`}>
              {STATS.map((s) => (
                <div key={s.key} data-stat={s.key}>
                  <div className="text-[44px] lg:text-[62px]" style={{ ...DISPLAY, color: PAPER.ink }}>
                    {/* A count that is a label ("200+") is printed, not counted up. */}
                    {s.text ? <span className="font-figure tabular-nums">{s.text}</span> : <CountUp to={s.to} suffix={s.suffix} />}
                  </div>
                  <div
                    className="font-figure text-[12px] tracking-[0.2em] uppercase mt-4"
                    style={{ color: PAPER.ink }}
                  >
                    {s.label}
                  </div>
                  <div className="font-figure text-[12px] mt-2 leading-[1.5]" style={{ color: PAPER.quiet }}>
                    {s.detail}
                  </div>
                  <div className="font-figure text-[12px] mt-1 leading-[1.5]" data-stat-source style={{ color: PAPER.quiet }}>
                    {s.source}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 10 — every figure has a source. Pinned: the screen holds still
                and only the note changes. */}
        <section
          id="in-the-margin"
          data-ground="paper"
          ref={marginRef}
          className="relative w-full"
          style={{ background: PAPER.ground, height: `calc(100vh + ${MARGIN_LINES.length * 62}vh)` }}
        >
          {/* Top-aligned, not centred. Centred in a full screen it left a
              blank run of cream between the coverage figures and this
              heading that read as the page having stopped. The padding is
              only what it takes to clear the fixed header. */}
          <div className="sticky top-0 h-screen flex items-start overflow-hidden">
            <div className="w-full max-w-[1380px] mx-auto px-6 sm:px-10 lg:px-16 pt-24">
              <p
                className="font-figure text-[12px] tracking-[0.22em] uppercase mb-5 flex items-center gap-3"
                style={{ color: PAPER.accentText }}
              >
                <span className="h-px w-8" style={{ background: RED }} />
                10 &middot; In the margin
              </p>
              <h2
                className="text-[26px] sm:text-[34px] lg:text-[46px] mb-10 lg:mb-14 max-w-[18ch]"
                style={{ ...DISPLAY, color: PAPER.ink }}
              >
                Every figure has a source
                <Mark />
              </h2>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-0">
                <div>
                  <div className="font-figure text-[12px] tracking-[0.2em] uppercase mb-5" style={{ color: PAPER.quiet }}>
                    Sample output
                  </div>
                  <div className="relative border-t" style={{ borderColor: PAPER.line }}>
                    {MARGIN_LINES.map((item, i) => {
                      const on = i === activeMargin;
                      return (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => chooseMargin(i)}
                          className="w-full text-left flex items-baseline justify-between border-b px-1 transition-colors"
                          style={{
                            borderColor: PAPER.line,
                            height: ROW_H,
                            background: on ? 'rgba(139,30,30,0.05)' : 'transparent',
                          }}
                        >
                          <span className="font-figure text-[14px]" style={{ color: on ? PAPER.ink : PAPER.quiet }}>
                            {item.label}
                          </span>
                          <span
                            className="font-figure text-[19px] lg:text-[22px] tabular-nums"
                            style={{ color: on ? PAPER.accentText : PAPER.ink }}
                          >
                            {item.figure}
                          </span>
                        </button>
                      );
                    })}
                    <div
                      className="hidden lg:block absolute h-px pointer-events-none transition-all duration-500"
                      style={{
                        background: RED,
                        left: '100%',
                        width: 72,
                        top: activeMargin * ROW_H + ROW_H / 2,
                      }}
                    />
                  </div>
                </div>

                <div className="lg:pl-28 lg:pt-16">
                  <div className="font-figure text-[12px] tracking-[0.2em] uppercase mb-4" style={{ color: PAPER.accentText }}>
                    {line.label}
                  </div>
                  <p
                    className="font-serif text-[22px] lg:text-[30px] leading-[1.32] max-w-[22ch]"
                    style={{ color: PAPER.ink, letterSpacing: '-0.015em' }}
                  >
                    {line.note}
                  </p>
                  <div
                    className="font-figure text-[12px] mt-6 pt-4 border-t inline-block"
                    style={{ color: PAPER.quiet, borderColor: PAPER.line }}
                  >
                    {line.source}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <MarginNotesSection onOpenNotes={onOpenNotes} />

        {children}

        {/* Final call to action */}
        <section
          id="open"
          className="w-full"
          style={{
            background: '#0B0B0D',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            boxShadow: '0 -40px 80px rgba(0,0,0,0.45)',
          }}
        >
          <div className="max-w-[1380px] mx-auto px-6 sm:px-10 lg:px-16 py-24 lg:py-32 flex flex-col items-center text-center">
            <h2 className="text-[38px] sm:text-[54px] lg:text-[70px]" style={{ ...DISPLAY, color: INK }}>
              Open a company
              <Mark />
            </h2>
            <div className="mt-12 flex flex-wrap gap-3 justify-center">
              <button
                type="button"
                onClick={onOpenCompany}
                className="font-figure text-[12px] tracking-[0.16em] uppercase px-6 py-3.5 border"
                style={{ borderColor: RED, background: 'rgba(139,30,30,0.22)', color: INK }}
              >
                Value a listed company
              </button>
              <button
                type="button"
                /* CALLED WITH NOTHING, not with the click. `onOpenNotes` takes
                   an optional note key and React hands an onClick handler its
                   MouseEvent as the first argument, so passing the function
                   directly stored a synthetic event in `noteKey` where a string
                   or null belongs. The notes screen guards its lookup, so it
                   opened the first note either way and nothing showed —
                   a latent bug the typecheck could not see (`KI-28`). */
                onClick={() => onOpenNotes()}
                className="font-figure text-[12px] tracking-[0.16em] uppercase px-6 py-3.5 border bg-transparent hover:border-[#8B1E1E] transition-colors"
                style={{ borderColor: LINE, color: MUTED }}
              >
                Read the margin notes
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default LandingPage;