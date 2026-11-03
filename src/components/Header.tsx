// FILE: src/components/Header.tsx
//
// The header.
//
// Two rules, both learned from earlier versions.
//
//  1. The bar is full width; the CONTENT inside it is what is capped and
//     centred. Putting the cap on the fixed bar itself and asking it to
//     centre with auto margins is what let the last link run off the right
//     edge on a wide screen.
//  2. One header on every screen (NAV_SEARCH_SPEC 2.1). There used to be
//     three — four oxblood links and a red Search on the landing page, Home
//     alone on the search screen, four buttons on a company — so the bar
//     changed under the reader each time they moved. The section links are
//     now on every screen, and the ones that are sections of the home page
//     go home first.

import React, { useEffect, useState } from 'react';
import { Search, PencilLine, Table2 } from 'lucide-react';
import { ScreenType } from '../types';
import { Mark } from '../design/Mark';

/* Four links, not six. A header with six choices is a header nobody reads,
   and the page below is built to be found by scrolling. These are the four
   places somebody actually arrives looking for.

   NAV_SEARCH_SPEC 2.1 asks for seven section triggers (Companies, Research,
   Markets, Invest, Tools, Learn, Deals), each opening a panel. Those panels
   are build step 9 and their contents still carry [CONFIRM] marks, so the
   four links that have a real destination today stay until then. */
const SECTIONS = [
  { id: 'routes', label: 'What you can do' },
  { id: 'filings', label: 'How it works' },
  { id: 'numbers', label: 'Coverage' },
  { id: 'margin-notes', label: 'Margin notes' },
];

/* The key hint names the shortcut the reader's own keyboard has. */
const isApple = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent || '');
};

interface HeaderProps {
  currentScreen: ScreenType;
  onNavigateToScreen: (screen: ScreenType) => void;
  onScrollToSection: (id: string) => void;
  activeSection: string;
  /* Set when the model on screen was built on figures the reader replaced.
     It rides in the header rather than in one panel of the dashboard because
     the claim it qualifies — that these are the filed numbers — is made by
     every screen at once, so the correction has to be visible from all of
     them. Without this a corrected model could pass as a filed one, and that
     is the one promise the site cannot break. */
  corrected?: { count: number; fields: string[] };
  /* Same reason, for the other judgement the figures screen now carries: a
     model built with a cost line moved off the engine's default category is
     not the engine's own model, and the screen that says so is every screen. */
  /** Lines put under another head, each read as "line → head". */
  reclassified?: { count: number; lines: string[]; excluded: string[] };
  onReviewFigures?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentScreen,
  onNavigateToScreen,
  onScrollToSection,
  activeSection,
  corrected,
  reclassified,
  onReviewFigures,
}) => {
  const [apple] = useState(isApple);

  /* ⌘K or Ctrl K, and / as the fallback where the browser or the OS has
     taken Ctrl K (NAV_SEARCH_SPEC 4.1). Never while the reader is typing in a
     field the page owns. The palette is not built yet, so the shortcut goes to
     the search screen; on the search screen it puts the caret in the field,
     because there is never a second search on screen. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing =
        !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      const cmdK =
        (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k';
      const slash = e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey;
      if (typing || !(cmdK || slash)) return;
      e.preventDefault();
      if (currentScreen === 'DIRECTORY') {
        document.querySelector<HTMLInputElement>('main input[type="text"]')?.focus();
      } else {
        onNavigateToScreen('DIRECTORY');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentScreen, onNavigateToScreen]);

  const goHomeAnd = (id: string) => {
    if (currentScreen !== 'HOME') {
      onNavigateToScreen('HOME');
      setTimeout(() => onScrollToSection(id), 100);
    } else {
      onScrollToSection(id);
    }
  };

  const figuresTitle = [
    corrected
      ? `Built on ${corrected.count} figure${corrected.count === 1 ? '' : 's'} you supplied: ${corrected.fields.join(', ')}.`
      : '',
    reclassified
      ? `${reclassified.count} line${reclassified.count === 1 ? '' : 's'} put under another head by you: ` +
        `${reclassified.lines.join(', ')}` +
        (reclassified.excluded.length
          ? `, of which ${reclassified.excluded.join(' and ')} set aside as one-offs and so nil in every forecast year.`
          : '.')
      : '',
    corrected || reclassified
      ? 'Click to change them or put them back.'
      : 'See the reported figures this model was built from, correct any of them, and move a line to another head',
  ]
    .filter(Boolean)
    .join(' ');

  /* The one control a header carries that is not navigation, so it shares
     the ghost shape of the search trigger beside it. */
  const GHOST =
    'h-9 border px-3 text-[13px] flex items-center gap-2 whitespace-nowrap cursor-pointer transition-colors duration-[110ms]';

  return (
    /* ONE HEADER, EVERY SCREEN (NAV_SEARCH_SPEC 2.1). 64px, the page colour
       at 95% under an 8px blur, a hairline at the foot. Wordmark, the section
       links, flexible space, search. No clock and no live dot: a ticking
       seconds display is motion with nothing to explain (VISUAL_SYSTEM 5), and
       no Home or All companies, because the wordmark and search already go
       there. */
    <header
      className="fixed top-0 inset-x-0 z-50 h-16 border-b border-line"
      style={{
        background: 'color-mix(in srgb, var(--m-page) 95%, transparent)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 lg:focus:left-12 focus:top-[14px] focus:z-10 focus:h-9 focus:px-3 focus:flex focus:items-center focus:bg-page focus:border focus:border-line focus:text-ink text-[13px]"
      >
        Skip to content
      </a>

      {/* THE BAR CANNOT OVERLAP ITSELF. The wordmark steps down on a phone
          and the controls opposite are icon-only there, so the two never need
          more width than the bar has. Measured at 320px. */}
      <div className="max-w-[1440px] h-full mx-auto px-4 sm:px-6 lg:px-12 flex items-center gap-3 sm:gap-5 lg:gap-10">
        <button
          onClick={() => {
            onNavigateToScreen('HOME');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          aria-label="Marginalia home"
          className="text-[20px] sm:text-[26px] lg:text-[28px] leading-none text-ink hover:text-accent-text transition-colors flex items-baseline group cursor-pointer shrink-0 whitespace-nowrap"
        >
          {/* The mark, not a label: lowercase Newsreader with the red square
              standing in for the full stop, as the hero draws it. */}
          <span className="font-serif" style={{ fontWeight: 500, letterSpacing: '-0.005em' }}>
            marginalia
          </span>
          <Mark />
        </button>

        {/* Nav links at rest are muted, never oxblood (VISUAL_SYSTEM 3.1); ink
            on hover; the current one takes the system's one selected state. */}
        <nav aria-label="Main" className="hidden lg:flex items-center gap-1 shrink-0">
          {SECTIONS.map((item) => {
            const current =
              item.id === 'margin-notes'
                ? currentScreen === 'NOTES'
                : currentScreen === 'HOME' && activeSection === item.id;
            return (
              <button
                key={item.id}
                aria-current={current ? 'true' : undefined}
                onClick={() =>
                  /* The margin notes are a screen now, not an anchor. The
                     other three links are sections of the home page, so from
                     any other screen they go home first. */
                  item.id === 'margin-notes'
                    ? onNavigateToScreen('NOTES')
                    : goHomeAnd(item.id)
                }
                className={`h-10 px-3 border text-[13px] whitespace-nowrap cursor-pointer transition-colors duration-[110ms] ${
                  current
                    ? 'bg-panel border-accent text-ink font-semibold'
                    : 'border-transparent text-muted hover:text-ink font-medium'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="flex-1 min-w-0" />

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* ONE CONTROL, TWO STATES, ALWAYS THERE.
              Quiet when every figure is as filed, oxblood when some are not,
              and in both cases the way back to the figures. Shown even with
              nothing corrected on purpose: the reader who most needs this
              screen is the one looking at a valuation that seems wrong and
              wondering where the numbers came from. It stays in the header
              because a corrected figure must never pass as a filed one on any
              screen (standing decision 5). */}
          {onReviewFigures && (currentScreen === 'ANALYSIS' || currentScreen === 'QUESTIONS') && (
            <button
              onClick={onReviewFigures}
              title={figuresTitle}
              className={`${GHOST} ${
                corrected || reclassified
                  ? 'border-accent bg-accent/20 text-ink'
                  : 'border-line text-muted hover:text-ink hover:border-accent'
              }`}
            >
              {corrected || reclassified ? (
                <PencilLine className="w-4 h-4 text-accent-text" strokeWidth={1.5} />
              ) : (
                <Table2 className="w-4 h-4" strokeWidth={1.5} />
              )}
              <span className="hidden md:inline">
                {/* BOTH JUDGEMENTS, NAMED SEPARATELY. A combined count would read
                    as corrected figures and hide the reclassification entirely. */}
                {[
                  corrected ? `${corrected.count} corrected figure${corrected.count === 1 ? '' : 's'}` : '',
                  reclassified ? `${reclassified.count} moved line${reclassified.count === 1 ? '' : 's'}` : '',
                ]
                  .filter(Boolean)
                  .join(' · ') || 'Check the figures'}
              </span>
              {(corrected || reclassified) && (
                <span className="md:hidden">
                  {(corrected?.count ?? 0) + (reclassified?.count ?? 0)}
                </span>
              )}
            </button>
          )}

          {/* SEARCH IS A GHOST (NAV_SEARCH_SPEC 2.1). The oxblood wash is kept
              for the one action a screen exists for; search is in every
              header, so it cannot be that. Hidden on the search screen, which
              has its own field: never two searches on screen. */}
          {currentScreen !== 'DIRECTORY' && (
            <button
              onClick={() => onNavigateToScreen('DIRECTORY')}
              aria-label="Search companies"
              aria-keyshortcuts={apple ? 'Meta+K' : 'Control+K'}
              className="group h-9 w-9 sm:w-[240px] xl:w-[320px] border border-line hover:border-accent flex items-center justify-center sm:justify-start gap-2 sm:pl-3 sm:pr-2 cursor-pointer transition-colors duration-[110ms] pointer-coarse:h-11 pointer-coarse:w-11 sm:pointer-coarse:w-[240px]"
            >
              <Search className="w-4 h-4 text-muted shrink-0" strokeWidth={1.5} />
              <span className="hidden sm:inline flex-1 text-left text-[13px] text-muted group-hover:text-ink transition-colors duration-[110ms] whitespace-nowrap">
                Search companies…
              </span>
              <kbd className="hidden sm:flex pointer-coarse:hidden h-5 min-w-7 px-1 items-center justify-center border border-line text-[13px] leading-none text-quiet font-sans whitespace-nowrap">
                {apple ? '⌘K' : 'Ctrl K'}
              </kbd>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
