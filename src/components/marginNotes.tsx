// FILE: src/components/marginNotes.tsx
//
// The Margin Notes screen.
//
// A reading screen, not an instrument screen, so it is paper: #F2F0EA ground,
// #16150F ink, the same band the landing page hands off from. The dark palette
// belongs to the figures and the dashboard, where the subject is numbers.
//
// Layout is an index on the left and one article on the right. The index is
// grouped the way a set of accounts is read — income statement, then balance
// sheet, then what the statements mean together — because that ordering is the
// point: a reader who works down the list has walked the statements in order.
//
// THE BUFFETT LENS.
// Each note may carry a `buffettLens`. It describes, in our own words, the
// QUESTION Mary Buffett and David Clark direct a reader to ask. It does NOT
// reproduce their numeric thresholds, and it must not start doing so: those
// figures are the distinctive part of their book and reproducing eighteen of
// them on a public site is both a copyright exposure and an opinion on a
// security, which this site does not give. The credit at the foot of the
// screen is what sends a reader to the book for the levels themselves. Treat
// that pairing as load-bearing — the callouts are defensible BECAUSE the
// credit is there and the thresholds are not.

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { MARGIN_NOTES } from '../data/marginNotes';
import type { MarginNote } from '../data/marginNotes';

const RED = '#8B1E1E';
const RED_TEXT = '#C0453E';

const PAPER = '#F2F0EA';
const PAPER_INK = '#16150F';
const PAPER_READ = '#3A382F';
const PAPER_DIM = '#6B6759';
const PAPER_LINE = '#DAD6CC';

const DISPLAY: React.CSSProperties = {
  fontFamily: "'Playfair Display', serif",
  fontWeight: 500,
  letterSpacing: '-0.01em',
  lineHeight: 1.04,
};

/* The full stop that is a square. Zero advance width — see the note on the
   landing page's copy of this. Never write a literal full stop before it. */
const Square: React.FC = () => (
  <>
    {'\u2060'}
    <span
      className="inline-block align-baseline"
      style={{
        width: '0.13em',
        height: '0.13em',
        background: RED,
        marginLeft: '0.08em',
        marginRight: '-0.21em',
      }}
    />
  </>
);

const GROUPS: { key: MarginNote['group']; label: string }[] = [
  { key: 'income', label: 'The income statement' },
  { key: 'balance', label: 'The balance sheet' },
  { key: 'meaning', label: 'Reading them together' },
];

interface Props {
  /* Which note to open on. Comes from the card the reader clicked on the
     landing page; undefined simply opens the first note. */
  initialKey?: string | null;
  onBack: () => void;
}

export const MarginNotesScreen: React.FC<Props> = ({ initialKey, onBack }) => {
  const first = MARGIN_NOTES[0]?.key ?? '';
  const [activeKey, setActiveKey] = useState<string>(
    initialKey && MARGIN_NOTES.some((n) => n.key === initialKey) ? initialKey : first,
  );

  /* Arriving from a different card while the screen is already mounted. */
  useEffect(() => {
    if (initialKey && MARGIN_NOTES.some((n) => n.key === initialKey)) {
      setActiveKey(initialKey);
    }
  }, [initialKey]);

  const active = useMemo(
    () => MARGIN_NOTES.find((n) => n.key === activeKey) ?? MARGIN_NOTES[0],
    [activeKey],
  );

  const open = (key: string) => {
    setActiveKey(key);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!active) return null;

  return (
    <div className="w-full min-h-screen" style={{ background: PAPER }}>
      <div className="max-w-[1380px] mx-auto px-6 sm:px-10 lg:px-16 py-16 lg:py-24">
        <button
          type="button"
          onClick={onBack}
          className="font-mono text-[12px] tracking-[0.16em] uppercase flex items-center gap-2 mb-12 hover:text-[#8B1E1E] transition-colors"
          style={{ color: PAPER_DIM }}
        >
          <ArrowLeft size={14} />
          Back
        </button>

        <p
          className="font-mono text-[12px] tracking-[0.22em] uppercase mb-6 flex items-center gap-3"
          style={{ color: RED_TEXT }}
        >
          <span className="h-px w-8 shrink-0" style={{ background: RED }} />
          The margin notes
        </p>
        <h1
          className="text-[34px] sm:text-[46px] lg:text-[60px] mb-4"
          style={{ ...DISPLAY, color: PAPER_INK }}
        >
          Read any company&rsquo;s accounts
          <Square />
        </h1>
        <p className="text-[17px] lg:text-[19px] mb-16 max-w-[52ch]" style={{ color: PAPER_READ }}>
          {MARGIN_NOTES.length} short notes on what each line of a set of accounts
          actually measures. No prior finance required, and nothing here tells you
          what to buy.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-12 lg:gap-20 items-start">
          {/* The index */}
          <nav className="lg:sticky lg:top-28">
            {GROUPS.map((group) => {
              const notes = MARGIN_NOTES.filter((n) => n.group === group.key);
              if (!notes.length) return null;
              return (
                <div key={group.key} className="mb-10">
                  <div
                    className="font-mono text-[11px] tracking-[0.2em] uppercase mb-4 pb-3 border-b"
                    style={{ color: PAPER_DIM, borderColor: PAPER_LINE }}
                  >
                    {group.label}
                  </div>
                  {notes.map((note) => {
                    const on = note.key === active.key;
                    return (
                      <button
                        key={note.key}
                        type="button"
                        onClick={() => open(note.key)}
                        className="block w-full text-left text-[15px] leading-[1.4] py-2 transition-colors"
                        style={{ color: on ? PAPER_INK : PAPER_DIM }}
                      >
                        <span
                          className="inline-block w-[3px] h-[3px] align-middle mr-3"
                          style={{ background: on ? RED : 'transparent' }}
                        />
                        {note.title}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </nav>

          {/* The article */}
          <article className="max-w-[68ch]">
            <h2
              className="text-[28px] sm:text-[34px] lg:text-[40px] mb-6"
              style={{ ...DISPLAY, color: PAPER_INK }}
            >
              {active.title}
              <Square />
            </h2>

            <p
              className="text-[19px] lg:text-[21px] leading-[1.5] pb-8 mb-8 border-b"
              style={{ color: PAPER_INK, borderColor: PAPER_LINE }}
            >
              {active.answer}
            </p>

            {active.article.map((para, i) => (
              <p
                key={i}
                className="text-[16px] lg:text-[17px] leading-[1.7] mb-6"
                style={{ color: PAPER_READ }}
              >
                {para}
              </p>
            ))}

            {active.buffettLens && (
              <div
                className="mt-12 pl-6 border-l-2"
                style={{ borderColor: RED }}
              >
                <div
                  className="font-mono text-[11px] tracking-[0.2em] uppercase mb-3"
                  style={{ color: RED_TEXT }}
                >
                  The Buffett lens
                </div>
                <p className="text-[16px] leading-[1.65]" style={{ color: PAPER_READ }}>
                  {active.buffettLens}
                </p>
              </div>
            )}

            {active.onSite && (
              <div
                className="mt-12 pt-6 border-t font-mono text-[12px] leading-[1.6]"
                style={{ color: PAPER_DIM, borderColor: PAPER_LINE }}
              >
                On Marginalia &mdash; {active.onSite}
              </div>
            )}
          </article>
        </div>

        {/* The credit. It belongs to the whole screen, not to one note, and it
            is the half of the Buffett lens that makes the other half fair. */}
        <div
          className="mt-24 pt-8 border-t max-w-[68ch]"
          style={{ borderColor: PAPER_LINE }}
        >
          <div
            className="font-mono text-[11px] tracking-[0.2em] uppercase mb-3"
            style={{ color: PAPER_DIM }}
          >
            Further reading
          </div>
          <p className="text-[15px] leading-[1.65]" style={{ color: PAPER_READ }}>
            The callouts above summarise, in our own words, the questions Mary
            Buffett and David Clark put to a set of accounts in{' '}
            <em>Warren Buffett and the Interpretation of Financial Statements</em>{' '}
            (Scribner, 2008). They are our summary of their approach, not their
            words, and the particular levels and thresholds they use are theirs
            and are set out in the book rather than reproduced here. Anyone who
            wants those should read it.
          </p>
        </div>
      </div>
    </div>
  );
};

export default MarginNotesScreen;