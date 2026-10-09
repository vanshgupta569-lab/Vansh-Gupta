// FILE: src/components/instrument.tsx
//
// THE NUMBER FIRST, THE EXPLANATION ON DEMAND.
//
// The fault these pieces exist to fix: every screen set its prose and its
// figures at the same weight, so a reader looking for a value read three
// sentences to find it. The prose was not the problem — it is good, and it is
// the reason to trust the number — but a reader who already trusts it should
// not have to walk past it every time.
//
// So: a figure is large, monospaced and alone. Everything that accounts for it
// sits behind a `Disclose` and opens where it is needed, next to the figure it
// explains rather than in a footnote at the bottom of the panel.
//
// WHY THESE ARE HERE AND NOT IN THE SCREEN. The company screen is the first to
// use them and not the last: the directory, the figures editor, the questions
// and the batch screen all have the same fault. A component used once is a
// component written twice later.
//
// NO COLOURS ARE DECLARED IN THIS FILE. They come from the ramp as utility
// names — `text-ink`, `text-muted`, `border-line` — declared in `index.css`
// from `src/design/tokens.ts`. `npm run verify` fails a component that
// declares a palette hex of its own, which is how the last one drifted.
import React, { useId, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// ---------------------------------------------------------------------------
// THE TYPE SCALE, in one place — AND IT SAYS WHAT SHIPS
//
// Thirteen sizes between 8px and 24px had accumulated across the screens, which
// is not a hierarchy, it is a reader with no idea where to look.
//
// These constants were first written as `text-[10px]` and `text-[11px]`, which
// is what a designer would want and is not what the browser draws. `index.css`
// sets a FLOOR in `@layer base`:
//
//     .text-[9px], .text-[10px], .text-[11px] { font-size: 13px !important }
//
// — a deliberate accessibility decision (nothing anyone has to read is smaller
// than 13px on a near-black ground), and an unlayered `.uppercase.font-mono`
// rule then supplies 0.16em tracking and weight 500. So the two label steps
// rendered at 13px however they were declared, and a constant that names a size
// the screen never draws is the same defect as a workbook row that names a rule
// the engine does not use. Measured in the browser rather than reasoned about:
//
//     declared text-[10px]/0.18em  ->  shipped 13px / 2.08px (0.16em) / w500
//     declared text-[11px]         ->  shipped 13px / 0.325px (0.025em) / w400
//
// They are written at their real size now. The honest consequence is that this
// is a THREE-step scale, not five: the two label steps are one size separated by
// case, tracking and weight, which on a terminal screen is enough.
//
//   label, emphatic  13px mono, uppercase, 0.16em, w500   what a thing is
//   label, plain     13px mono, 0.025em, w400             a row's name, a unit
//   body             13px sans                            a sentence
//   figure           clamp 26-38px mono                   a number being read
//   hero             clamp 40-60px mono                   the number of the screen
//
// Mono for every figure, on purpose: digits in Inter are proportional, so a
// column of them does not line up, and a number that changes as you drag a
// slider jitters sideways. JetBrains Mono is tabular.
//
// EYEBROW takes its tracking and weight from the shared `.uppercase.font-mono`
// rule rather than restating them, so every small-caps label on the site stays
// set identically — which is why that rule exists.
// MONO IS FOR FIGURES, NOT FOR SENTENCES.
//
// Measured across the five screens on 2026-10-08: 103 passages of four words or
// more were set in JetBrains Mono, 94 of them ordinary lowercase prose —
// disclosure summaries, instructional lines, trailing hints, the units note.
// Monospace carrying running text reads as a terminal costume rather than as a
// finance product, and it is genuinely harder to read: the even advance width
// that makes a column of digits line up is the same property that removes the
// word-shape a reader scans by.
//
// So the two were separated. `LABEL` is mono and stays mono because what it
// carries earns it — a ticker, a code, a unit, a figure, a short label of one
// or two words. `UI` is the same size in Inter and is what every secondary
// SENTENCE uses. The test is not the length and not the weight: it is whether
// the thing reads as a sentence. If it does, it is Inter.
export const EYEBROW = 'font-mono text-[13px] uppercase';
export const LABEL = 'font-mono text-[13px] tracking-wide';
/** Secondary sentences in the chrome: hints, summaries, foots, captions. */
export const UI = 'font-sans text-[13px] leading-snug';
export const BODY = 'font-sans text-[13px] leading-relaxed';

/** A dotted rule, for a row that continues a thought rather than ending one. */
export const RULE = 'border-line';

// ---------------------------------------------------------------------------

export interface DiscloseProps {
  /** What the reader is being offered. Written as the question they have. */
  summary: string;
  /** A figure or phrase shown on the closed row, right-aligned. */
  trailing?: React.ReactNode;
  /** Open on first render — for the one disclosure a screen wants open. */
  defaultOpen?: boolean;
  /** Visually quieter, for a disclosure nested inside another. */
  dense?: boolean;
  children: React.ReactNode;
}

/**
 * A row that opens. This is where the prose went.
 *
 * It is a real `<button>` with `aria-expanded` and a controlled region, not a
 * `<div>` with a click handler: the keyboard has to reach it, and a screen
 * reader has to be told the state. The chevron rotates rather than swapping
 * glyph, so the control does not reflow when it opens.
 */
export const Disclose: React.FC<DiscloseProps> = ({
  summary,
  trailing,
  defaultOpen = false,
  dense = false,
  children,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();

  return (
    <div className={dense ? '' : 'border-t border-line'}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={id}
        className={`group -mx-2 flex w-full flex-wrap items-center gap-x-3 rounded-none px-2 text-left transition-colors cursor-pointer hover:bg-ink/[0.03] ${
          dense ? 'py-2' : 'py-3'
        }`}
      >
        <ChevronRight
          className={`h-3 w-3 shrink-0 text-quiet transition-transform duration-200 group-hover:text-accent-text ${
            open ? 'rotate-90 text-accent-text' : ''
          }`}
          aria-hidden="true"
        />
        <span className={`${UI} transition-colors ${open ? 'text-ink' : 'text-muted'} group-hover:text-ink`}>
          {summary}
        </span>
        {/* The stat goes to the far end on a wide row and onto its own line on
            a narrow one. Left as one flex line it became two cramped columns
            of wrapped text at 414px, each about four words wide. */}
        {trailing !== undefined && (
          <span className={`${UI} w-full pl-6 text-quiet tabular-nums sm:ml-auto sm:w-auto sm:pl-0 sm:text-right`}>
            {trailing}
          </span>
        )}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={id}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            {/* The indent lines the prose up with the summary, past the
                chevron, so an open disclosure reads as one block.

                THE MEASURE IS CAPPED HERE AND NOT ON THE PARAGRAPH. The
                obvious class is `max-w-prose`, and on this site that class
                does the opposite of what its name says: `index.css` sets
                `.max-w-prose { max-width: none; text-align: justify }` as a
                deliberate house rule, so writing it widens the column and
                justifies it. A disclosure opens inside a full-width panel, so
                without a cap its prose ran past 140 characters a line. 68ch is
                inside the 65-75 a line should hold; `max-w-prose` may still be
                written on a paragraph inside, where it now means only
                "justify this", which is all it has ever meant here. */}
            <div className={`max-w-[68ch] pl-6 ${dense ? 'pb-2' : 'pb-4'} ${BODY} text-read`}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ---------------------------------------------------------------------------

export interface FigureProps {
  /** What the number is. Sits above it, small. */
  eyebrow: string;
  /** The number, already formatted. A string, so the caller owns the rounding. */
  value: React.ReactNode;
  /** A short qualifier under the number: a basis, a unit, a method. */
  foot?: React.ReactNode;
  /** A pill beside the number — a premium, a change, a state. */
  pill?: React.ReactNode;
  /** 'hero' for the one figure the screen exists to show. */
  scale?: 'hero' | 'figure';
  className?: string;
}

/**
 * A figure, set to be read before anything around it.
 *
 * `clamp` rather than breakpoints: the hero is the one element that should fill
 * the width it is given, and three `sm:text-` steps is a worse description of
 * that than one clamp. `tabular-nums` so the digits do not shift as they tween.
 *
 * A FIGURE IS ALWAYS INK, and there is no option to make it otherwise. The
 * intrinsic value was set in oxblood at first, which reads as a warning rather
 * than as the headline it is: on a dark instrument screen a red number is the
 * one that has gone wrong. The red belongs to the mark and to a signal that is
 * meant — the premium badge beside the figure, where being red is the point.
 */
export const Figure: React.FC<FigureProps> = ({
  eyebrow,
  value,
  foot,
  pill,
  scale = 'figure',
  className = '',
}) => (
  <div className={className}>
    <div className={`${EYEBROW} text-quiet mb-1.5`}>{eyebrow}</div>
    <div className="flex items-baseline gap-2.5 flex-wrap">
      <span
        className={`font-mono tabular-nums leading-none ${
          scale === 'hero'
            ? 'text-[clamp(2.5rem,5vw,3.75rem)] font-semibold tracking-[-0.03em]'
            : 'text-[clamp(1.625rem,3vw,2.375rem)] font-medium tracking-[-0.02em]'
        } text-ink`}
      >
        {value}
      </span>
      {pill}
    </div>
    {foot && <div className={`${UI} text-quiet mt-2`}>{foot}</div>}
  </div>
);

// ---------------------------------------------------------------------------

export interface PillProps {
  tone: 'positive' | 'negative' | 'neutral' | 'warn';
  children: React.ReactNode;
}

/**
 * A small state beside a figure. Four tones and no more: a premium, a discount,
 * a neutral fact, a warning that is a measurement rather than an opinion.
 *
 * The negative tone is the oxblood, not a red borrowed from elsewhere. The site
 * has one red and this is it.
 */
export const Pill: React.FC<PillProps> = ({ tone, children }) => {
  const tones: Record<PillProps['tone'], string> = {
    positive: 'text-positive border-positive-line bg-positive-fill',
    negative: 'text-accent-text border-accent/50 bg-accent/10',
    neutral: 'text-muted border-line bg-page',
    warn: 'text-amber border-amber/40 bg-amber/10',
  };
  return (
    <span
      className={`${EYEBROW} shrink-0 whitespace-nowrap border px-2 py-[3px] font-semibold tabular-nums ${tones[tone]}`}
    >
      {children}
    </span>
  );
};

// ---------------------------------------------------------------------------

export interface MetricTileProps {
  label: string;
  value: React.ReactNode;
  /** The basis, where one is worth stating. Shown quiet, under the value. */
  note?: string;
  /** Opens beside the tile rather than sending the reader to a section. */
  detail?: React.ReactNode;
}

/**
 * One tile. There were five near-identical copies of this markup on the company
 * screen, differing only in label and value, and a sixth and seventh were about
 * to be written for the bank case.
 *
 * Dense on purpose: 11px label, a figure at 17px, a hairline, no shadow. A
 * professional reads a row of these at a glance and wants them to sit close
 * together; the airy version of this card says "dashboard" rather than
 * "terminal".
 */
export const MetricTile: React.FC<MetricTileProps> = ({ label, value, note, detail }) => (
  <div className="border border-line bg-panel px-4 py-3.5 transition-colors hover:border-quiet/50 hover:bg-panel/70">
    <div className={`${EYEBROW} text-quiet mb-1.5 truncate`} title={label}>
      {label}
    </div>
    <div className="font-mono text-[19px] font-medium tabular-nums text-ink leading-none tracking-[-0.01em]">
      {value}
    </div>
    {note && <div className={`${UI} text-quiet mt-1.5`}>{note}</div>}
    {detail && (
      <div className="mt-2 -mb-1">
        <Disclose summary="basis" dense>
          {detail}
        </Disclose>
      </div>
    )}
  </div>
);

// ---------------------------------------------------------------------------

/**
 * A labelled strip of reference facts — exchange, sector, ISIN. Identity, not
 * headline: a reader who typed the ticker knows which company this is, so this
 * is set at label size and got the space the company name used to take.
 */
export const RefStrip: React.FC<{ items: [string, React.ReactNode][] }> = ({ items }) => (
  <dl className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
    {items.map(([k, v]) => (
      <div key={k} className="flex items-baseline gap-1.5">
        <dt className={`${EYEBROW} text-quiet`}>{k}</dt>
        <dd className={`${LABEL} text-muted tabular-nums`}>{v}</dd>
      </div>
    ))}
  </dl>
);
