// FILE: src/components/landingPage.tsx
//
// The landing page.
//
// The first six sections are bound to the particle object: the wordmark, then
// a solid for each step of what the site actually does, then it lets go. The
// sections after that are ordinary dark bands — methodology, the margin
// notes, coverage, the analyst, the feedback form — because by then the
// reader is reading rather than being shown.
//
// Two rules govern the layout. The object and the words never share space:
// the object takes a side and the words take the other, and a soft scrim sits
// under the text wherever the object passes behind it. And every heading is
// Inter set very tight — an editorial serif at display size reads as a
// magazine, and this is meant to read as an institution. Playfair is kept for
// the three places it earns: the wordmark, the margin notes, and the quote.

import React, { useState } from 'react';
import { ParticleField } from './particleField';

/* The sections the object is bound to, in page order. */
const OBJECT_SECTIONS = ['hero', 'routes', 'model', 'discount', 'answers', 'letgo'];

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
  { title: 'Workbook reformatting', status: 'Planned' },
];

const STATS = [
  { figure: '10,000+', label: 'Listed companies', detail: 'NYSE · NASDAQ · NSE · BSE · LSE · TSX' },
  { figure: '5Y', label: 'Of filed history', detail: 'IS · BS · CF · WC · PP&E · Debt · Equity' },
  { figure: '0', label: 'Cost to use', detail: 'No subscription, no paywall' },
  { figure: '3', label: 'Valuation approaches', detail: 'Income · Market · Asset' },
];

/* ------------------------------------------------------------------ */

interface LandingProps {
  onOpenCompany: () => void;
  onScrollTo: (id: string) => void;
  /* Methodology, the feedback form and the analyst card are existing
     components and are dropped in here, between the margin notes and the
     closing call to action, so the page still ends on an invitation. */
  children?: React.ReactNode;
}

export const LandingPage: React.FC<LandingProps> = ({ onOpenCompany, onScrollTo, children }) => {
  const [launching, setLaunching] = useState(false);
  const [activeMargin, setActiveMargin] = useState(0);
  const [heldMargin, setHeldMargin] = useState(false);
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

  React.useEffect(() => {
    if (heldMargin) return;
    const timer = window.setInterval(
      () => setActiveMargin((i) => (i + 1) % MARGIN_LINES.length),
      4400
    );
    return () => window.clearInterval(timer);
  }, [heldMargin]);

  const chooseMargin = (i: number) => {
    setActiveMargin(i);
    setHeldMargin(true);
  };

  const line = MARGIN_LINES[activeMargin];
  const ROW_H = 78;

  return (
    <div className="relative">
      <ParticleField sectionIds={OBJECT_SECTIONS} launching={launching} />

      <div className="relative z-10 pointer-events-none">
        {/* ---------------------------------------------------------- */}
        {/* 1 — the wordmark, drawn in particles above the words         */}
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
            Drag to turn it &middot; scroll to build the model
          </p>
        </Block>

        {/* 2 — what you can do */}
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

        {/* 3 — the model */}
        <Block id="model" side="left">
          <Eyebrow>02 &middot; The model</Eyebrow>
          <h2 className="text-[28px] sm:text-[34px] lg:text-[44px]" style={{ ...DISPLAY, color: INK }}>
            Every line driven by an assumption you can move
            <Square />
          </h2>
          <p className="text-[17px] leading-[1.6] mt-6" style={{ color: READ }}>
            Growth, margin, tax rate, capital spending. Each one named, each one
            yours to change, and every figure below it recalculating as you do.
          </p>
          <Readout
            rows={[
              ['What you can move', 'growth, margin, tax, capital spending'],
              ['What moves with it', 'every figure below it'],
              ['What stays hidden', 'nothing'],
            ]}
          />
        </Block>

        {/* 4 — the discount */}
        <Block id="discount" side="right">
          <Eyebrow>03 &middot; The discount</Eyebrow>
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

        {/* 5 — three answers */}
        <Block id="answers" side="left">
          <Eyebrow>04 &middot; Three answers</Eyebrow>
          <h2 className="text-[28px] sm:text-[34px] lg:text-[44px]" style={{ ...DISPLAY, color: INK }}>
            They do not agree, and they are not supposed to
            <Square />
          </h2>
          <p className="text-[17px] leading-[1.6] mt-6" style={{ color: READ }}>
            Three rings, three bearings on the same object. What a business
            earns, what buyers pay for businesses like it, and what it owns
            outright are three different questions.
          </p>
          <Readout
            rows={[
              ['The widest ring', 'what its future cash is worth today'],
              ['The middle one', 'what buyers pay for companies like it'],
              ['The smallest', 'what it owns, less what it owes'],
            ]}
          />
        </Block>

        {/* 6 — and then it lets go */}
        <Block id="letgo" side="mid">
          <Eyebrow centred>05 &middot; And then it lets go</Eyebrow>
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
        </Block>
      </div>

      {/* ============================================================ */}
      {/* Below here the object has gone and the page is read normally. */}
      {/* ============================================================ */}
      <div className="relative z-10" style={{ background: '#0B0B0D' }}>
        {/* Coverage figures */}
        <section id="numbers" className="w-full" style={{ background: '#F2F0EA' }}>
          <div className="max-w-[1380px] mx-auto px-6 sm:px-10 lg:px-16 py-20 lg:py-24">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-14 gap-x-8">
              {STATS.map((s) => (
                <div key={s.label}>
                  <div className="text-[44px] lg:text-[62px]" style={{ ...DISPLAY, color: '#16150F' }}>
                    {s.figure}
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

        {/* In the margin — the centrepiece for a reader who knows nothing */}
        <section id="in-the-margin" className="w-full" style={{ background: '#F2F0EA' }}>
          <div className="max-w-[1380px] mx-auto px-6 sm:px-10 lg:px-16 py-20 lg:py-24">
            <p
              className="font-mono text-[12px] tracking-[0.22em] uppercase mb-6 flex items-center gap-3"
              style={{ color: RED_TEXT }}
            >
              <span className="h-px w-8" style={{ background: RED }} />
              06 &middot; In the margin
            </p>
            <h2
              className="text-[30px] sm:text-[40px] lg:text-[54px] mb-14 max-w-[18ch]"
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
                  className="font-serif text-[25px] lg:text-[32px] leading-[1.32] max-w-[22ch]"
                  style={{ color: '#16150F', letterSpacing: '-0.015em' }}
                >
                  {line.note}
                </p>
                <div
                  className="font-mono text-[12px] mt-7 pt-4 border-t inline-block"
                  style={{ color: '#6B6759', borderColor: '#DAD6CC' }}
                >
                  {line.source}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* The Margin Notes and the one place status is stated */}
        <section id="margin-notes" className="w-full" style={{ background: '#F2F0EA' }}>
          <div className="max-w-[1380px] mx-auto px-6 sm:px-10 lg:px-16 py-20 lg:py-24">
            <p
              className="font-mono text-[12px] tracking-[0.22em] uppercase mb-6 flex items-center gap-3"
              style={{ color: RED_TEXT }}
            >
              <span className="h-px w-8" style={{ background: RED }} />
              07 &middot; The margin notes
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
