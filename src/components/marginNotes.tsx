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
// Previous and next walk the same order (`NOTES_IN_INDEX_ORDER`).
//
// ADDRESSES (`docs/LEARN_STATES_SPEC.md` §2.2, L1; job 9.8). The screen lives
// at /learn/notes/ and each note at /learn/notes/<key>/, so a note can be
// linked to, bookmarked and reached with Back. The screen is told which note
// the address names and asks for a new address to open another; it holds no
// note of its own. The Back button went with that (§2.5): the browser's Back
// and the header do its job now.
//
// LAYOUT (§2.5): the 1440 frame with 48px gutters; Label eyebrow in quiet;
// h1 on the Title step; an index column of 280px sticky under the header with
// its own scroll, its current note in the system's one selected state; the
// note's title on the Section step. Under 640px the index is one closed
// disclosure, "All {n} notes", so the note the reader tapped is not a long
// scroll away under twenty-eight rows of index.
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
import { ArrowRight, ChevronRight } from 'lucide-react';
import { MARGIN_NOTES } from '../data/marginNotes';
import { EXPLAINERS, explainerPath } from '../data/explainers';
import { GROUP_ORDER, NOTES_IN_INDEX_ORDER, neighbours, notePath } from '../data/notesRoute';
import { PAPER as P, SIZE, TYPE } from '../design/tokens';
import { Mark } from '../design/Mark';

const TITLE: React.CSSProperties = {
  fontFamily: TYPE.display,
  fontWeight: 600,
  fontSize: SIZE.title,
  lineHeight: 1.08,
  letterSpacing: '-0.015em',
  wordSpacing: '0.04em',
};
const SECTION: React.CSSProperties = { fontFamily: TYPE.display, fontWeight: 600, fontSize: SIZE.section, lineHeight: 1.3 };

interface Props {
  /** The note the address names; null opens the first in index order. */
  activeKey: string | null;
  /** Open a note: the caller moves the address. */
  onOpen: (key: string) => void;
}

/** A link that is a real address and moves within the app when clicked. */
const NoteLink: React.FC<{
  to: string;
  onOpen: (key: string) => void;
  className?: string;
  style?: React.CSSProperties;
  current?: boolean;
  children: React.ReactNode;
  rel?: string;
}> = ({ to, onOpen, className, style, current, children, rel }) => (
  <a
    href={notePath(to)}
    data-note-link={to}
    rel={rel}
    aria-current={current ? 'page' : undefined}
    onClick={(e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      onOpen(to);
    }}
    className={className}
    style={style}
  >
    {children}
  </a>
);

const narrowNow = () => typeof window !== 'undefined' && window.matchMedia?.('(max-width: 639px)').matches;

export const MarginNotesScreen: React.FC<Props> = ({ activeKey, onOpen }) => {
  const active = useMemo(
    () => MARGIN_NOTES.find((n) => n.key === activeKey) ?? NOTES_IN_INDEX_ORDER[0],
    [activeKey],
  );
  const [narrow, setNarrow] = useState<boolean>(() => !!narrowNow());
  const [indexOpen, setIndexOpen] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.('(max-width: 639px)');
    if (!mq) return;
    const on = () => setNarrow(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  // A note opened from the phone index closes the index behind it.
  useEffect(() => setIndexOpen(false), [active?.key]);

  if (!active) return null;
  const { previous, next } = neighbours(active.key);
  const titleOf = (key: string) => MARGIN_NOTES.find((n) => n.key === key)?.title ?? key;
  const showIndex = !narrow || indexOpen;

  return (
    <div data-ground="paper" className="w-full min-h-screen" style={{ background: P.ground }}>
      <div className="max-w-[1440px] mx-auto px-6 sm:px-12 pt-32 pb-24">
        <p className="font-figure text-[13px] leading-[18px] mb-3" style={{ color: P.quiet }}>
          The margin notes
        </p>
        <h1 className="mb-4 max-w-[24ch]" style={{ ...TITLE, color: P.ink }}>
          Read any company&rsquo;s accounts
          <Mark on="paper" />
        </h1>
        <p className="text-[15px] leading-[24px] mb-12 max-w-[600px]" style={{ color: P.read }}>
          {MARGIN_NOTES.length} short notes on what each line of a set of accounts
          actually measures, and {EXPLAINERS.length} longer explainers on how a
          valuation is built out of them. No prior finance required, and nothing
          here tells you what to buy.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-[280px_minmax(0,640px)] gap-12 sm:gap-x-24 items-start">
          {/* The index */}
          <nav
            aria-label="Margin notes"
            data-notes-index
            className="sm:sticky sm:top-[88px] sm:max-h-[calc(100svh-112px)] sm:overflow-y-auto"
          >
            {narrow && (
              <button
                type="button"
                data-notes-disclose
                aria-expanded={indexOpen}
                onClick={() => setIndexOpen((v) => !v)}
                className="flex w-full items-center gap-2 min-h-[48px] text-[15px] font-medium border-b"
                style={{ color: P.ink, borderColor: P.line }}
              >
                <ChevronRight
                  size={12}
                  aria-hidden="true"
                  style={{ transform: indexOpen ? 'rotate(90deg)' : 'none', transition: 'transform var(--m-dur-fast) var(--m-ease-standard)' }}
                />
                All {MARGIN_NOTES.length} notes
              </button>
            )}
            {showIndex && (
              <div className={narrow ? 'pl-6 pt-3' : ''}>
                {GROUP_ORDER.map((group) => {
                  const notes = MARGIN_NOTES.filter((n) => n.group === group.key);
                  if (!notes.length) return null;
                  return (
                    <div key={group.key} className="mb-8">
                      <div
                        className="font-figure text-[13px] leading-[18px] pb-2 mb-3 border-b"
                        style={{ color: P.quiet, borderColor: P.line }}
                      >
                        {group.label}
                      </div>
                      {notes.map((note) => {
                        const on = note.key === active.key;
                        return (
                          <NoteLink
                            key={note.key}
                            to={note.key}
                            onOpen={onOpen}
                            current={on}
                            className={`flex items-center w-full text-left text-[15px] leading-[22px] px-2 border ${narrow ? 'min-h-[48px]' : 'min-h-[40px]'} hover:underline underline-offset-4`}
                            style={{
                              color: on ? P.ink : P.read,
                              fontWeight: on ? 600 : 400,
                              background: on ? P.panel : 'transparent',
                              borderColor: on ? P.accentText : 'transparent',
                            }}
                          >
                            {note.title}
                          </NoteLink>
                        );
                      })}
                    </div>
                  );
                })}

                {/* THE EXPLAINERS. Static pages at /learn/<slug>/ rather than
                    screens in this application (`src/data/explainers.ts` says
                    why), so these are ordinary links that leave the app; the
                    arrow says it opens a page. */}
                <div className="mb-8">
                  <div
                    className="font-figure text-[13px] leading-[18px] pb-2 mb-3 border-b"
                    style={{ color: P.quiet, borderColor: P.line }}
                  >
                    How a company is valued
                  </div>
                  {EXPLAINERS.map((article) => (
                    <a
                      key={article.slug}
                      href={explainerPath(article.slug)}
                      className={`flex items-center justify-between gap-3 w-full text-left text-[15px] leading-[22px] px-2 ${narrow ? 'min-h-[48px]' : 'min-h-[40px]'} hover:underline underline-offset-4`}
                      style={{ color: P.read }}
                    >
                      <span>{article.title}</span>
                      <ArrowRight size={16} aria-hidden="true" className="shrink-0" style={{ color: P.quiet }} />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </nav>

          {/* The article */}
          <article data-note={active.key} className="max-w-[640px]">
            <h2 className="mb-4" style={{ ...SECTION, color: P.ink }}>
              {active.title}
            </h2>

            <p
              className="text-[15px] leading-[24px] pb-6 mb-6 border-b"
              style={{ color: P.ink, borderColor: P.line }}
            >
              {active.answer}
            </p>

            {active.article.map((para, i) => (
              <p key={i} className="text-[15px] leading-[24px] mb-4" style={{ color: P.read }}>
                {para}
              </p>
            ))}

            {active.buffettLens && (
              <div className="mt-12 pl-6 border-l-2" style={{ borderColor: P.accentText }}>
                <div className="font-figure text-[13px] leading-[18px] mb-2" style={{ color: P.quiet }}>
                  The Buffett lens
                </div>
                <p className="text-[15px] leading-[24px]" style={{ color: P.read }}>
                  {active.buffettLens}
                </p>
              </div>
            )}

            {active.onSite && (
              <div
                className="mt-12 pt-6 border-t font-figure text-[13px] leading-[1.6]"
                style={{ color: P.quiet, borderColor: P.line }}
              >
                On Marginalia &mdash; {active.onSite}
              </div>
            )}

            {/* PREVIOUS AND NEXT, in the index's order (§2.5), so a reader
                walks the statements without going back to the index. */}
            <nav aria-label="Previous and next note" className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
              {previous ? (
                <NoteLink
                  to={previous}
                  onOpen={onOpen}
                  rel="prev"
                  className="flex items-center min-h-[48px] text-[15px] underline-offset-4 hover:underline"
                  style={{ color: P.ink }}
                >
                  &larr; {titleOf(previous)}
                </NoteLink>
              ) : (
                <span />
              )}
              {next && (
                <NoteLink
                  to={next}
                  onOpen={onOpen}
                  rel="next"
                  className="flex items-center sm:justify-end sm:text-right min-h-[48px] text-[15px] underline-offset-4 hover:underline"
                  style={{ color: P.ink }}
                >
                  {titleOf(next)} &rarr;
                </NoteLink>
              )}
            </nav>
          </article>
        </div>

        {/* The credit. It belongs to the whole screen, not to one note, and it
            is the half of the Buffett lens that makes the other half fair. */}
        <div className="mt-24 pt-8 border-t max-w-[640px]" style={{ borderColor: P.line }}>
          <div className="font-figure text-[13px] leading-[18px] mb-3" style={{ color: P.quiet }}>
            Further reading
          </div>
          <p className="text-[15px] leading-[24px]" style={{ color: P.read }}>
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
