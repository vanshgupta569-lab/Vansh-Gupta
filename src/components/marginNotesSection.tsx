// FILE: src/components/marginNotesSection.tsx
//
// Section 11 of the landing page, lifted out of landingPage.tsx.
//
// It moved for two reasons. The landing file had passed 40KB, which is the
// point at which pasting a whole file into the GitHub web editor stops being
// reliable; and these cards now have somewhere to go, which means they carry
// behaviour rather than just three lines of copy.
//
// The three cards are REAL notes, chosen by key out of MARGIN_NOTES, and each
// one opens the Margin Notes screen at the note it shows. The previous version
// carried three hand-written lines that matched nothing in the data, so a
// reader who wanted more had nothing to click and nowhere to go.
//
// The band is paper — #F2F0EA ground, #16150F ink — because it is the first of
// the reading sections rather than one of the dark instrument screens. The
// Margin Notes screen matches it for the same reason.

import React from 'react';
import { MARGIN_NOTES } from '../data/marginNotes';

const RED = '#8B1E1E';
const RED_TEXT = '#C0453E';

/* Paper palette. Kept local rather than imported so this file stands on its
   own; the values are the same ones the landing band has always used. */
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

/* Which three notes face the reader here. Chosen because they are the three
   questions somebody arrives with: what does the top line mean, what does a
   margin mean, and why does profit not equal cash. If a key is ever removed
   from the data file this quietly shows fewer cards rather than breaking. */
const FEATURED = ['revenue', 'gross-margin', 'reading-the-three-statements-together'];

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

interface Props {
  onOpenNotes: (key?: string) => void;
}

export const MarginNotesSection: React.FC<Props> = ({ onOpenNotes }) => {
  const cards = FEATURED
    .map((key) => MARGIN_NOTES.find((n) => n.key === key))
    .filter((n): n is (typeof MARGIN_NOTES)[number] => !!n);

  const quarters = upcomingQuarters(ROADMAP.length);

  return (
    <section id="margin-notes" className="w-full" style={{ background: PAPER }}>
      <div className="max-w-[1380px] mx-auto px-6 sm:px-10 lg:px-16 py-20 lg:py-24">
        <p
          className="font-mono text-[12px] tracking-[0.22em] uppercase mb-6 flex items-center gap-3"
          style={{ color: RED_TEXT }}
        >
          <span className="h-px w-8 shrink-0" style={{ background: RED }} />
          11 &middot; The margin notes
        </p>
        <h2
          className="text-[30px] sm:text-[40px] lg:text-[54px] mb-4"
          style={{ ...DISPLAY, color: PAPER_INK }}
        >
          The Margin Notes
        </h2>
        <p className="text-[17px] lg:text-[19px] mb-14 max-w-[44ch]" style={{ color: PAPER_READ }}>
          Read any company&rsquo;s accounts without a finance degree.
        </p>

        <div
          className="grid grid-cols-1 md:grid-cols-3 gap-px mb-10"
          style={{ background: PAPER_LINE }}
        >
          {cards.map((note) => (
            <button
              key={note.key}
              type="button"
              onClick={() => onOpenNotes(note.key)}
              className="p-8 text-left transition-colors group"
              style={{ background: PAPER }}
            >
              <div
                className="text-[20px] leading-[1.2] mb-3"
                style={{ ...DISPLAY, color: PAPER_INK }}
              >
                {note.title}
              </div>
              <div className="text-[15px] leading-[1.55]" style={{ color: PAPER_DIM }}>
                {note.answer}
              </div>
              <div
                className="font-mono text-[11px] tracking-[0.2em] uppercase mt-6 group-hover:text-[#8B1E1E] transition-colors"
                style={{ color: RED_TEXT }}
              >
                Read the note
              </div>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => onOpenNotes()}
          className="font-mono text-[12px] tracking-[0.16em] uppercase px-6 py-3.5 border mb-16 hover:border-[#8B1E1E] transition-colors"
          style={{ borderColor: PAPER_LINE, color: PAPER_READ }}
        >
          All {MARGIN_NOTES.length} notes
        </button>

        <div
          className="font-mono text-[12px] tracking-[0.2em] uppercase mb-6 pt-8 border-t"
          style={{ color: PAPER_DIM, borderColor: PAPER_LINE }}
        >
          What is being built next
        </div>
        <div>
          {ROADMAP.map((item, i) => (
            <div
              key={item.title}
              className="flex items-center justify-between gap-6 py-4 border-b"
              style={{ borderColor: PAPER_LINE }}
            >
              <div className="flex items-baseline gap-6 lg:gap-12 min-w-0">
                <span
                  className="font-mono text-[12px] tracking-[0.16em] shrink-0"
                  style={{ color: PAPER_DIM }}
                >
                  {quarters[i]}
                </span>
                <span className="text-[16px] lg:text-[18px] truncate" style={{ color: PAPER_INK }}>
                  {item.title}
                </span>
              </div>
              <span
                className="font-mono text-[12px] tracking-[0.16em] uppercase shrink-0"
                style={{ color: item.status === 'In build' ? RED_TEXT : PAPER_DIM }}
              >
                {item.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default MarginNotesSection;