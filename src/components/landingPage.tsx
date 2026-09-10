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

import React, { useEffect, useRef, useState } from 'react';
import { ParticleField } from './particleField';

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

const RED = '#8B1E1E';
const RED_TEXT = '#C0453E';
const INK = '#F2F0EA';
const READ = '#C6C1B7';
const MUTED = '#A8A29A';
const LINE = '#262521';

const DISPLAY: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 800,
  letterSpacing: '-0.045em',
  lineHeight: 0.96,
};

/* ------------------------------------------------------------------ */
/* Furniture                                                           */
/* ------------------------------------------------------------------ */

const Eyebrow: React.FC<{ children: React.ReactNode; centred?: boolean }> = ({
  children,
  centred,
}) => (
  <p
    className={`font-mono text-[12px] tracking-[0.22em] uppercase mb-6 flex items-center gap-3 ${
      centred ? 'justify-center' : ''
    }`}
    style={{ color: RED_TEXT }}
  >
    <span className="h-px w-8 shrink-0" style={{ background: RED }} />
    {children}
  </p>
);

const Square: React.FC = () => (
  <>
    {'⁠'}
    <span
      className="inline-block align-baseline ml-[0.08em]"
      style={{ width: '0.13em', height: '0.13em', background: RED }}
    />
  </>
);

/* One block of words, on one side, over a scrim. */
const Block: React.FC<{
  id: string;
  side: 'left' | 'right' | 'mid';
  children: React.ReactNode;
}> = ({ id, side, children }) => {
  const scrim =
    side === 'left'
      ? 'linear-gradient(to right, rgba(11,11,13,.94) 0%, rgba(11,11,13,.80) 34%, rgba(11,11,13,0) 62%)'
      : side === 'right'
      ? 'linear-gradient(to left, rgba(11,11,13,.94) 0%, rgba(11,11,13,.80) 34%, rgba(11,11,13,0) 62%)'
      : 'linear-gradient(to top, rgba(11,11,13,.95) 6%, rgba(11,11,13,.62) 34%, rgba(11,11,13,0) 66%)';

  const justify =
    side === 'left' ? 'justify-start' : side === 'right' ? 'justify-end' : 'justify-center';

  return (
    <section
      id={id}
      className={`relative min-h-screen flex items-center py-32 ${
        id === 'hero' ? 'items-end pb-16' : ''
      }`}
    >
      <div
        className="absolute inset-0 -z-10 pointer-events-none hidden lg:block"
        style={{ background: scrim }}
      />
      <div
        className="absolute inset-0 -z-10 pointer-events-none lg:hidden"
        style={{
          background:
            'linear-gradient(to top, rgba(11,11,13,.95) 12%, rgba(11,11,13,.7) 46%, rgba(11,11,13,0) 78%)',
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
    className={`font-mono text-[13px] border-t pt-4 mt-7 grid gap-2 ${
      centred ? 'justify-items-center' : ''
    }`}
    style={{ borderColor: LINE, color: MUTED }}
  >
    {rows.map(([k, v]) => (
      <div key={k}>
        <span style={{ color: RED_TEXT }}>{k}</span>
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

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') { setN(to); return; }

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
  }, [to]);

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
const ROUTES = [
  {
    n: '01',
    title: 'Value a listed company',
    line: 'Type a ticker. Its filings become a three-statement model and a DCF you can argue with.',
  },
  {
    n: '02',
    title: 'Value a private company',
    line: 'A private company files nothing public. Type in the accounts you already have and get the same model a listed company gets.',
  },
  {
    n: '03',
    title: 'Make a one or two-pager',
    line: 'A whole company on one page — the summary you would be asked for before a meeting.',
  },
  {
    n: '04',
    title: 'Reformat your Excel model',
    line: 'Your own workbook set to house convention: blue for inputs, black for formulas. Not one number changes.',
  },
];

/* What is not built yet. Every line here is stated as a plan, because a plan
   described in the present tense is a false claim about a website. */
const NEXT = [
  {
    title: 'A one or two-pager',
    status: 'In build',
    line: 'The whole company on a single page: what it does, what it earns, what it is worth, and the figures you would be asked about first.',
  },
  {
    title: 'A leveraged buyout model',
    status: 'Planned',
    line: 'The same forecast run for a buyer using debt — the structure it is bought with, the years of repayment, the exit, and the return that falls out of it.',
  },
  {
    title: 'A private company',
    status: 'In build',
    line: 'A private company files nothing public, so you supply the accounts. Type in the income statement and balance sheet you already have and the same engine runs on them.',
  },
];

const NOTES = [
  { title: 'What is a DCF', line: 'Future cash, brought back to what it is worth today.' },
  { title: 'What operating margin tells you', line: 'How much of each rupee of sales survives the cost of trading.' },
  { title: 'Why profit and cash are not the same', line: 'Profit follows the accounting rules. Cash follows the bank account.' },
];

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
  { title: 'Leveraged buyout model', status: 'Planned' },
  { title: 'Workbook reformatting', status: 'Planned' },
];

const STATS = [
  { to: 10000, suffix: '+', label: 'Listed companies', detail: 'NYSE · NASDAQ · NSE · BSE · LSE · TSX' },
  { to: 5, suffix: 'Y', label: 'Of filed history', detail: 'IS · BS · CF · WC · PP&E · Debt · Equity' },
  { to: 0, suffix: '', label: 'Cost to use', detail: 'No subscription, no paywall' },
  { to: 3, suffix: '', label: 'Valuation approaches', detail: 'Income · Market · Asset' },
];

/* ------------------------------------------------------------------ */

interface LandingProps {
  onOpenCompany: () => void;
  onScrollTo: (id: string) => void;
  /* The feedback form and the analyst card are existing components and are
     dropped in here, before the closing call to action, so the page still
     ends on an invitation. */
  children?: React.ReactNode;
}

export const LandingPage: React.FC<LandingProps> = ({ onOpenCompany, onScrollTo, children }) => {
  const [launching, setLaunching] = useState(false);
  const [activeMargin, setActiveMargin] = useState(0);
  const marginRef = useRef<HTMLDivElement>(null);
  const quarters = upcomingQuarters(ROADMAP.length);

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
      <ParticleField sectionIds={OBJECT_SECTIONS} launching={launching} />

      <div className="relative z-10 pointer-events-none">
        {/* ---------------------------------------------------------- */}
        {/* the wordmark, drawn in particles above the words            */}
        {/* ---------------------------------------------------------- */}
        <Block id="hero" side="mid">
          <Eyebrow centred>Filed data, not estimates</Eyebrow>
          <h1
            className="text-[34px] sm:text-[46px] lg:text-[58px] mb-6"
            style={{ ...DISPLAY, color: INK }}
          >
            Real financials. Live models.
            <Square />
          </h1>
          <p className="text-[18px] leading-[1.6] mx-auto max-w-[38rem]" style={{ color: READ }}>
            Five years of income statements, balance sheets and cash flows, read
            from a company&rsquo;s own filings exactly as reported.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 justify-center">
            <button
              type="button"
              onClick={launch}
              className="font-mono text-[12px] tracking-[0.16em] uppercase px-6 py-3.5 border transition-colors"
              style={{ borderColor: RED, background: 'rgba(139,30,30,0.22)', color: INK }}
            >
              Value a listed company
            </button>
            <button
              type="button"
              onClick={launch}
              className="font-mono text-[12px] tracking-[0.16em] uppercase px-6 py-3.5 border bg-transparent transition-colors hover:border-[#8B1E1E]"
              style={{ borderColor: LINE, color: MUTED }}
            >
              Value a private company
            </button>
          </div>
          <p
            className="font-mono text-[12px] tracking-[0.16em] uppercase mt-8"
            style={{ color: MUTED }}
          >
            Drag to turn it &middot; scroll to see how it works
          </p>
        </Block>

        {/* 01 — what you can do */}
        <Block id="routes" side="right">
          <Eyebrow>01 &middot; What you can do</Eyebrow>
          <h2 className="text-[28px] sm:text-[34px] lg:text-[42px] mb-8" style={{ ...DISPLAY, color: INK }}>
            Four ways in
            <Square />
          </h2>
          <div className="grid gap-6">
            {ROUTES.map((r) => (
              <button
                key={r.n}
                type="button"
                onClick={r.n === '01' ? launch : undefined}
                className={`text-left ${r.n === '01' ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <div className="flex items-baseline gap-4">
                  <span className="font-mono text-[13px] tracking-[0.2em] shrink-0" style={{ color: RED_TEXT }}>
                    {r.n}
                  </span>
                  <span className="text-[19px] lg:text-[21px]" style={{ ...DISPLAY, color: INK }}>
                    {r.title}
                  </span>
                </div>
                <p className="text-[15px] leading-[1.55] mt-1.5 pl-10" style={{ color: MUTED }}>
                  {r.line}
                </p>
              </button>
            ))}
          </div>
        </Block>

        {/* 02 — the filings arrive */}
        <Block id="filings" side="left">
          <Eyebrow>02 &middot; Where the numbers come from</Eyebrow>
          <h2 className="text-[28px] sm:text-[34px] lg:text-[44px]" style={{ ...DISPLAY, color: INK }}>
            Five years of accounts, exactly as filed
            <Square />
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
          <Eyebrow>03 &middot; The forecast</Eyebrow>
          <h2 className="text-[28px] sm:text-[34px] lg:text-[44px]" style={{ ...DISPLAY, color: INK }}>
            Every forecast line is one assumption you can move
            <Square />
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
          <Eyebrow>04 &middot; Profit becomes cash</Eyebrow>
          <h2 className="text-[28px] sm:text-[34px] lg:text-[44px]" style={{ ...DISPLAY, color: INK }}>
            Profit and cash are not the same number
            <Square />
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
          <Eyebrow>05 &middot; What it is worth today</Eyebrow>
          <h2 className="text-[28px] sm:text-[34px] lg:text-[44px]" style={{ ...DISPLAY, color: INK }}>
            Every future year, collapsed into one number
            <Square />
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
          <Eyebrow>06 &middot; Three approaches</Eyebrow>
          <h2 className="text-[28px] sm:text-[34px] lg:text-[44px]" style={{ ...DISPLAY, color: INK }}>
            They do not agree, and they are not supposed to
            <Square />
          </h2>
          <p className="text-[17px] leading-[1.6] mt-6" style={{ color: READ }}>
            What a business earns, what buyers pay for businesses like it, and
            what it owns outright are three different questions. All three are
            run and all three are shown. They are never averaged into one tidy
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
          <Eyebrow>07 &middot; The model is yours</Eyebrow>
          <h2 className="text-[28px] sm:text-[34px] lg:text-[44px]" style={{ ...DISPLAY, color: INK }}>
            Change anything on the page, then take the model with you
            <Square />
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
          <Eyebrow>08 &middot; Being built next</Eyebrow>
          <h2 className="text-[28px] sm:text-[34px] lg:text-[42px] mb-8" style={{ ...DISPLAY, color: INK }}>
            Three more things, and where each one has got to
            <Square />
          </h2>
          <div className="grid gap-7">
            {NEXT.map((item) => (
              <div key={item.title}>
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="text-[19px] lg:text-[21px]" style={{ ...DISPLAY, color: INK }}>
                    {item.title}
                  </span>
                  <span
                    className="font-mono text-[10px] tracking-[0.18em] uppercase px-2 py-1 border"
                    style={{
                      color: item.status === 'In build' ? RED_TEXT : MUTED,
                      borderColor: item.status === 'In build' ? 'rgba(139,30,30,0.55)' : LINE,
                    }}
                  >
                    {item.status}
                  </span>
                </div>
                <p className="text-[15px] leading-[1.55] mt-2" style={{ color: MUTED }}>
                  {item.line}
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
            className="absolute inset-x-0 bottom-0 h-[46vh] -z-10 pointer-events-none"
            style={{
              background:
                'linear-gradient(to top, rgba(11,11,13,.96) 0%, rgba(11,11,13,.55) 34%, rgba(11,11,13,0) 100%)',
            }}
          />
          <div className="sticky top-0 h-screen flex items-center justify-center">
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  'radial-gradient(ellipse 44rem 15rem at 50% 50%, rgba(11,11,13,.88) 0%, rgba(11,11,13,.62) 42%, rgba(11,11,13,0) 78%)',
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
                className="font-mono text-[12px] tracking-[0.18em] uppercase mt-5"
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
          className="w-full"
          style={{
            background: '#F2F0EA',
            borderTopLeftRadius: 26,
            borderTopRightRadius: 26,
            overflow: 'hidden',
            boxShadow: '0 -50px 110px rgba(0,0,0,0.78)',
          }}
        >
          <div className="max-w-[1380px] mx-auto px-6 sm:px-10 lg:px-16 pt-20 lg:pt-28 pb-20 lg:pb-24">
            <p
              className="font-mono text-[12px] tracking-[0.22em] uppercase mb-12 flex items-center gap-3"
              style={{ color: RED_TEXT }}
            >
              <span className="h-px w-8" style={{ background: RED }} />
              09 &middot; Coverage
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-14 gap-x-8">
              {STATS.map((s) => (
                <div key={s.label}>
                  <div className="text-[44px] lg:text-[62px]" style={{ ...DISPLAY, color: '#16150F' }}>
                    <CountUp to={s.to} suffix={s.suffix} />
                  </div>
                  <div
                    className="font-mono text-[12px] tracking-[0.2em] uppercase mt-4"
                    style={{ color: '#16150F' }}
                  >
                    {s.label}
                  </div>
                  <div className="font-mono text-[12px] mt-2 leading-[1.5]" style={{ color: '#6B6759' }}>
                    {s.detail}
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
          ref={marginRef}
          className="relative w-full"
          style={{ background: '#F2F0EA', height: `calc(100vh + ${MARGIN_LINES.length * 62}vh)` }}
        >
          <div className="sticky top-0 h-screen flex items-center overflow-hidden">
            <div className="w-full max-w-[1380px] mx-auto px-6 sm:px-10 lg:px-16 pt-16">
              <p
                className="font-mono text-[12px] tracking-[0.22em] uppercase mb-5 flex items-center gap-3"
                style={{ color: RED_TEXT }}
              >
                <span className="h-px w-8" style={{ background: RED }} />
                10 &middot; In the margin
              </p>
              <h2
                className="text-[26px] sm:text-[34px] lg:text-[46px] mb-10 lg:mb-14 max-w-[18ch]"
                style={{ ...DISPLAY, color: '#16150F' }}
              >
                Every figure has a source
                <Square />
              </h2>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-0">
                <div>
                  <div className="font-mono text-[12px] tracking-[0.2em] uppercase mb-5" style={{ color: '#6B6759' }}>
                    Sample output
                  </div>
                  <div className="relative border-t" style={{ borderColor: '#DAD6CC' }}>
                    {MARGIN_LINES.map((item, i) => {
                      const on = i === activeMargin;
                      return (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => chooseMargin(i)}
                          className="w-full text-left flex items-baseline justify-between border-b px-1 transition-colors"
                          style={{
                            borderColor: '#DAD6CC',
                            height: ROW_H,
                            background: on ? 'rgba(139,30,30,0.05)' : 'transparent',
                          }}
                        >
                          <span className="font-mono text-[14px]" style={{ color: on ? '#16150F' : '#6B6759' }}>
                            {item.label}
                          </span>
                          <span
                            className="font-mono text-[19px] lg:text-[22px] tabular-nums"
                            style={{ color: on ? RED_TEXT : '#16150F' }}
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
                  <div className="font-mono text-[12px] tracking-[0.2em] uppercase mb-4" style={{ color: RED_TEXT }}>
                    {line.label}
                  </div>
                  <p
                    className="font-serif text-[22px] lg:text-[30px] leading-[1.32] max-w-[22ch]"
                    style={{ color: '#16150F', letterSpacing: '-0.015em' }}
                  >
                    {line.note}
                  </p>
                  <div
                    className="font-mono text-[12px] mt-6 pt-4 border-t inline-block"
                    style={{ color: '#6B6759', borderColor: '#DAD6CC' }}
                  >
                    {line.source}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 11 — the margin notes, and the one place status is stated */}
        <section id="margin-notes" className="w-full" style={{ background: '#F2F0EA' }}>
          <div className="max-w-[1380px] mx-auto px-6 sm:px-10 lg:px-16 py-20 lg:py-24">
            <p
              className="font-mono text-[12px] tracking-[0.22em] uppercase mb-6 flex items-center gap-3"
              style={{ color: RED_TEXT }}
            >
              <span className="h-px w-8" style={{ background: RED }} />
              11 &middot; The margin notes
            </p>
            <h2 className="text-[30px] sm:text-[40px] lg:text-[54px] mb-4" style={{ ...DISPLAY, color: '#16150F' }}>
              The Margin Notes
            </h2>
            <p className="text-[17px] lg:text-[19px] mb-14 max-w-[44ch]" style={{ color: '#3A382F' }}>
              Read any company&rsquo;s accounts without a finance degree.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-px mb-16" style={{ background: '#DAD6CC' }}>
              {NOTES.map((note) => (
                <div key={note.title} className="p-8" style={{ background: '#F2F0EA' }}>
                  <div className="text-[20px] leading-[1.2] mb-3" style={{ ...DISPLAY, color: '#16150F' }}>
                    {note.title}
                  </div>
                  <div className="text-[15px] leading-[1.55]" style={{ color: '#6B6759' }}>
                    {note.line}
                  </div>
                </div>
              ))}
            </div>

            <div
              className="font-mono text-[12px] tracking-[0.2em] uppercase mb-6 pt-8 border-t"
              style={{ color: '#6B6759', borderColor: '#DAD6CC' }}
            >
              What is being built next
            </div>
            <div>
              {ROADMAP.map((item, i) => (
                <div
                  key={item.title}
                  className="flex items-center justify-between gap-6 py-4 border-b"
                  style={{ borderColor: '#DAD6CC' }}
                >
                  <div className="flex items-baseline gap-6 lg:gap-12 min-w-0">
                    <span className="font-mono text-[12px] tracking-[0.16em] shrink-0" style={{ color: '#6B6759' }}>
                      {quarters[i]}
                    </span>
                    <span className="text-[16px] lg:text-[18px] truncate" style={{ color: '#16150F' }}>
                      {item.title}
                    </span>
                  </div>
                  <span
                    className="font-mono text-[12px] tracking-[0.16em] uppercase shrink-0"
                    style={{ color: item.status === 'In build' ? RED_TEXT : '#6B6759' }}
                  >
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

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
              <Square />
            </h2>
            <div className="mt-12 flex flex-wrap gap-3 justify-center">
              <button
                type="button"
                onClick={onOpenCompany}
                className="font-mono text-[12px] tracking-[0.16em] uppercase px-6 py-3.5 border"
                style={{ borderColor: RED, background: 'rgba(139,30,30,0.22)', color: INK }}
              >
                Value a listed company
              </button>
              <button
                type="button"
                onClick={() => onScrollTo('margin-notes')}
                className="font-mono text-[12px] tracking-[0.16em] uppercase px-6 py-3.5 border bg-transparent hover:border-[#8B1E1E] transition-colors"
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
