// FILE: src/components/valuationSection.tsx
//
// ONE SECTION OF THE VALUATION SCREEN (STUDIO_SPEC §4.1, 2026-11-13).
//
// The screen had grown into a column of panels that all looked alike: the same
// border, the same ground, no heading of their own, and nothing to say where
// one ended and the next began. A reader scrolling it could not tell the
// valuation range from the walkthrough from the ratios without reading the
// contents of each. That is the first design principle failing — not messy
// exactly, but undifferentiated, which is the same problem wearing a tidier
// coat.
//
// So every section is one of these: its own panel, its own heading, a fixed
// 24px between it and the next, and an anchor the contents list can reach.
//
// THE LONG ONES COLLAPSE TO ONE LINE. "How it was calculated", the market and
// asset approaches, the full working and what the source does not give us are
// each long enough to bury everything under them. Closed, each shows its
// heading and a single line saying what is inside, so the shape of the whole
// screen is readable in one go; open, nothing is hidden.
//
// COLLAPSED IS NOT HIDDEN, and the distinction matters here more than in most
// products: this site's claim is that every figure can be traced. So the
// headline of a closed section always says what it holds, the control says
// "Show" rather than being a bare chevron, and NOTHING is collapsed that
// carries a refusal or a figure a reader could mistake for absent. A section
// that says the model could not value something stays open.
import React, { useId, useState } from 'react';

/** The gap between panels, in one place because the spec names it. */
export const SECTION_GAP_PX = 24;

export interface ValuationSectionProps {
  /** The anchor the contents list links to. Unique on the screen. */
  id: string;
  /** Sentence case, a name rather than a label. */
  title: string;
  /**
   * The one line a closed section shows. Required when `collapsible`, because
   * a section that collapses to nothing but its title tells a reader only that
   * something is missing.
   */
  headline?: string;
  /** Long sections collapse; short ones never do. */
  collapsible?: boolean;
  /** Open on arrival. A collapsible section defaults to closed. */
  defaultOpen?: boolean;
  /** A note set beside the heading, e.g. which approach this is. */
  aside?: React.ReactNode;
  children: React.ReactNode;
}

export function ValuationSection({
  id,
  title,
  headline,
  collapsible = false,
  defaultOpen = false,
  aside,
  children,
}: ValuationSectionProps) {
  const [open, setOpen] = useState(!collapsible || defaultOpen);
  const bodyId = `${useId()}-body`;

  return (
    <section
      id={id}
      data-valuation-section={id}
      data-section-open={open ? 'true' : 'false'}
      className="scroll-mt-32 bg-panel border border-line"
    >
      {/* THE HEADING ROW. A heading on every panel is the whole point: it is
          what makes the column of panels a document with parts rather than a
          stack of cards. */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-4 sm:px-6">
        <h3 className="font-serif text-[19px] sm:text-[21px] text-ink" data-section-title>
          {title}
        </h3>
        {aside ? <span className="text-[13px] text-quiet">{aside}</span> : null}
      </div>

      {/* CLOSED: the one line that says what is inside, and the control.
          A bare chevron would make a reader open a section to find out
          whether it was worth opening. */}
      {collapsible && !open && headline ? (
        <div className="px-5 pb-4 sm:px-6">
          <p className="text-[15px] leading-relaxed text-muted max-w-2xl" data-section-headline>
            {headline}
          </p>
        </div>
      ) : null}

      {collapsible ? (
        <div className="px-5 pb-4 sm:px-6">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls={bodyId}
            data-section-toggle={id}
            className="font-figure text-[13px] text-muted hover:text-ink border border-line px-3 py-2 min-h-11 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F2F0EA]"
          >
            {open ? `Hide ${title.toLowerCase()}` : `Show ${title.toLowerCase()}`}
          </button>
        </div>
      ) : null}

      {/* THE BODY IS UNMOUNTED WHEN CLOSED, not hidden with CSS. A panel that
          is merely invisible still runs, still measures, and on this screen
          still rebuilds a model: five of those behind a collapsed heading is
          the landing page's blocking-time problem moved somewhere quieter. */}
      {open ? (
        <div id={bodyId} className="px-5 pb-5 sm:px-6 sm:pb-6" data-section-body>
          {children}
        </div>
      ) : null}
    </section>
  );
}

/**
 * THE CONTENTS LIST, sticky on desktop.
 *
 * It is built from the sections that are actually on the screen rather than
 * from a list written out by hand, because a hand-written list goes stale the
 * first time a section is added for a company that has one and not for a
 * company that does not — and a contents entry that scrolls nowhere is worse
 * than no contents at all.
 */
export interface ContentsEntry {
  id: string;
  label: string;
}

export function ValuationContents({ entries }: { entries: ContentsEntry[] }) {
  if (!entries.length) return null;
  return (
    // IT LIVES INSIDE THE SCREEN'S EXISTING STICKY BAR rather than being a
    // second sticky row of its own. Two bars that both follow the page down
    // is the clutter the first design principle rules out, and the bar was
    // already there carrying a hand-written list of five of the sections.
    <nav aria-label="The sections of this valuation" data-valuation-contents className="min-w-0 flex-1">
      <ul className="flex flex-wrap items-center gap-x-1 gap-y-1">
        {entries.map((entry) => (
          <li key={entry.id}>
            <a
              href={`#${entry.id}`}
              data-contents-link={entry.id}
              onClick={(event) => {
                // A plain anchor would work, but it also writes a hash into
                // the address and jumps without easing.
                event.preventDefault();
                document.getElementById(entry.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className="inline-block font-figure text-[13px] text-quiet hover:text-ink px-2.5 py-1.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F2F0EA]"
            >
              {entry.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
