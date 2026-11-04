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

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, PencilLine, Table2, Menu as MenuIcon, X, ChevronRight } from 'lucide-react';
import { ScreenType } from '../types';
import { Mark } from '../design/Mark';
import { MENU, comingFor, type Destination, type MenuSection } from '../data/menu';
import { setMotionSetting, useReducedMotion } from '../design/motion';

/* THE MENU IS DATA (`src/data/menu.ts`): seven sections in a fixed order, of
   which only those with a shipped destination are shown (NAV_SEARCH §3; job
   9.1). From 1100px up each is a trigger that opens a panel on click, Enter,
   Space or ↓ — never on hover; below 1100px they live in the Menu sheet. */
const DESKTOP_FROM = 1100;

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
  /** The address, so the header can tell which section the reader is in. */
  path?: string;
  /** Move to an address inside the app. */
  onGo?: (path: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentScreen,
  onNavigateToScreen,
  onScrollToSection,
  activeSection,
  corrected,
  reclassified,
  onReviewFigures,
  path = '/',
  onGo,
}) => {
  const [apple] = useState(isApple);
  const [openPanel, setOpenPanel] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetSection, setSheetSection] = useState<string | null>(null);
  const reduced = useReducedMotion();
  const triggers = useRef<Record<string, HTMLButtonElement | null>>({});
  const menuButton = useRef<HTMLButtonElement | null>(null);
  const sheet = useRef<HTMLDivElement | null>(null);

  /* THE CURRENT SECTION: the one the route is inside. At most one. */
  const currentSection: MenuSection['name'] | null =
    currentScreen === 'NOTES' || path.startsWith('/learn')
      ? 'Learn'
      : currentScreen === 'DIRECTORY' || currentScreen === 'COMPANY' || path === '/screener'
        ? 'Companies'
        : null;

  const closePanel = (focusTrigger: boolean) => {
    const was = openPanel;
    setOpenPanel(null);
    if (focusTrigger && was) triggers.current[was]?.focus();
  };
  const closeSheet = () => {
    setSheetOpen(false);
    menuButton.current?.focus();
  };

  /* Esc closes whichever is open and gives focus back to what opened it; a
     click outside an open panel closes it. */
  useEffect(() => {
    if (!openPanel && !sheetOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      if (sheetOpen) closeSheet();
      else closePanel(true);
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (openPanel && !t?.closest('[data-menu-panel], [data-menu-trigger]')) setOpenPanel(null);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown);
    };
  }, [openPanel, sheetOpen]);

  /* Focus stays inside the sheet while it is open (NAV_SEARCH §2.4). */
  useEffect(() => {
    if (!sheetOpen) return;
    sheet.current?.querySelector<HTMLElement>('button, a')?.focus();
    const onTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !sheet.current) return;
      const items = [menuButton.current, ...Array.from(sheet.current.querySelectorAll<HTMLElement>('button, a'))].filter(Boolean) as HTMLElement[];
      const i = items.indexOf(document.activeElement as HTMLElement);
      const next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : i === items.length - 1 ? 0 : i + 1;
      e.preventDefault();
      items[next]?.focus();
    };
    window.addEventListener('keydown', onTab);
    return () => window.removeEventListener('keydown', onTab);
  }, [sheetOpen]);

  /* A desktop-width window has no sheet. */
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= DESKTOP_FROM) setSheetOpen(false);
      else setOpenPanel(null);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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

  const follow = (d: Destination) => {
    setOpenPanel(null);
    setSheetOpen(false);
    if (d.kind === 'screen') onNavigateToScreen(d.screen);
    else if (d.kind === 'section') goHomeAnd(d.section);
    else if (d.href === '/learn/' || !onGo) window.location.assign(d.href);
    else {
      onGo(d.href);
      window.scrollTo({ top: 0 });
    }
  };

  /* One destination as a row: a real link where it has an address. */
  const Row: React.FC<{ d: Destination; tall?: boolean }> = ({ d, tall }) => {
    const cls = `flex w-full items-center ${tall ? 'min-h-[48px] pl-12 pr-6' : 'h-9 px-2'} text-[15px] text-read hover:text-ink text-left cursor-pointer transition-colors duration-[110ms]`;
    if (d.kind === 'href')
      return (
        <a
          href={d.href}
          data-menu-link
          className={cls}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
            e.preventDefault();
            follow(d);
          }}
        >
          {d.label}
        </a>
      );
    return (
      <button type="button" data-menu-link className={cls} onClick={() => follow(d)}>
        <span className="flex-1">{d.label}</span>
        {d.kind === 'screen' && d.hint && (
          <kbd className="pointer-coarse:hidden text-[13px] text-quiet font-sans">{apple ? '⌘K' : 'Ctrl K'}</kbd>
        )}
      </button>
    );
  };

  /* "Coming": text with its status, no link; then the way to the roadmap. */
  const Coming: React.FC<{ section: MenuSection; tall?: boolean }> = ({ section, tall }) => {
    const items = comingFor(section);
    if (!items.length) return null;
    return (
      <div className={tall ? 'px-6 pb-2' : 'mt-3 pt-3 border-t border-line'} data-menu-coming>
        <p className="text-[13px] text-quiet mb-1 px-2">Coming</p>
        {items.map((c) => (
          <p key={c.id} data-feature={c.id} className={`flex items-center justify-between gap-3 ${tall ? 'min-h-[48px]' : 'h-9'} px-2 text-[15px] text-muted`}>
            <span>{c.label}</span>
            <span className="text-[13px] text-quiet">{c.status}</span>
          </p>
        ))}
        <Row d={{ kind: 'section', label: 'See the roadmap →', section: 'beyond' }} tall={tall} />
      </div>
    );
  };

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

        {/* SECTION TRIGGERS, from 1100px up. Muted at rest, never oxblood
            (VISUAL_SYSTEM 3.1); ink on hover; ink 600 while open; the current
            section takes the system's one selected state. */}
        <nav aria-label="Main" className="hidden min-[1100px]:flex items-center gap-1 shrink-0">
          {MENU.map((section) => {
            const current = currentSection === section.name;
            const open = openPanel === section.name;
            return (
              <div key={section.name} className="relative">
                <button
                  type="button"
                  data-menu-trigger={section.name}
                  ref={(el) => { triggers.current[section.name] = el; }}
                  aria-expanded={open}
                  aria-haspopup="true"
                  aria-current={current ? 'true' : undefined}
                  onClick={() => setOpenPanel(open ? null : section.name)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setOpenPanel(section.name);
                      window.setTimeout(() => document.querySelector<HTMLElement>(`[data-menu-panel="${section.name}"] [data-menu-link]`)?.focus(), 0);
                    }
                  }}
                  className={`h-10 px-3 border text-[13px] whitespace-nowrap cursor-pointer transition-colors duration-[110ms] ${
                    current
                      ? 'bg-panel border-accent text-ink font-semibold'
                      : open
                        ? 'border-transparent text-ink font-semibold'
                        : 'border-transparent text-muted hover:text-ink font-medium'
                  }`}
                >
                  {section.name}
                </button>
                {open && (
                  <div
                    data-menu-panel={section.name}
                    className="absolute left-0 top-[52px] w-[480px] bg-overlay border border-line p-4"
                  >
                    <p className="text-[13px] text-quiet mb-1 px-2">{section.name}</p>
                    {section.links.map((d) => (
                      <Row key={d.label} d={d} />
                    ))}
                    <Coming section={section} />
                  </div>
                )}
              </div>
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

          {/* MENU, under 1100px: 44×44, opening the sheet under the bar. */}
          <button
            type="button"
            ref={menuButton}
            data-menu-button
            aria-expanded={sheetOpen}
            aria-label={sheetOpen ? 'Close the menu' : 'Menu'}
            onClick={() => (sheetOpen ? closeSheet() : setSheetOpen(true))}
            className="min-[1100px]:hidden h-11 w-11 border border-line hover:border-accent flex items-center justify-center cursor-pointer transition-colors duration-[110ms]"
          >
            {sheetOpen ? <X className="w-4 h-4 text-ink" strokeWidth={1.5} /> : <MenuIcon className="w-4 h-4 text-muted" strokeWidth={1.5} />}
          </button>
        </div>
      </div>

      {/* THE SHEET (NAV_SEARCH §2.4, LEARN_STATES §4): its top edge at the
          bar's foot, the bar still visible; a 0.72 scrim with no blur; one
          accordion row of 56px per section, its links 48px; the Reduce motion
          switch at the foot. */}
      {/* A PORTAL, because the bar's backdrop blur makes it the containing
          block of anything fixed inside it: a sheet rendered here measured
          from the bar, not the window, and had no height at all. */}
      {sheetOpen && typeof document !== 'undefined' && createPortal(
        <div data-menu-root className="dark">
          <div className="fixed inset-x-0 top-16 bottom-0 z-40 bg-scrim min-[1100px]:hidden" onClick={closeSheet} aria-hidden="true" />
          <div
            ref={sheet}
            data-menu-sheet
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="fixed inset-x-0 top-16 bottom-0 z-50 overflow-y-auto bg-overlay border-t border-line min-[1100px]:hidden min-[640px]:left-auto min-[640px]:w-[480px] min-[640px]:border-l"
          >
            {MENU.map((section) => {
              const open = sheetSection === section.name;
              return (
                <div key={section.name} className="border-b border-line">
                  <button
                    type="button"
                    data-sheet-section={section.name}
                    aria-expanded={open}
                    onClick={() => setSheetSection(open ? null : section.name)}
                    className={`flex w-full items-center gap-3 h-14 px-6 text-[15px] cursor-pointer ${currentSection === section.name ? 'text-ink font-semibold' : 'text-ink font-medium'}`}
                  >
                    <ChevronRight
                      className="w-3 h-3 text-muted"
                      strokeWidth={1.5}
                      style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform var(--m-dur-base) var(--m-ease-standard)' }}
                    />
                    {section.name}
                  </button>
                  {open && (
                    <div className="pb-2">
                      {section.links.map((d) => (
                        <Row key={d.label} d={d} tall />
                      ))}
                      <Coming section={section} tall />
                    </div>
                  )}
                </div>
              );
            })}
            <div className="flex items-center justify-between h-14 px-6">
              <span className="text-[15px] text-read">Reduce motion</span>
              <button
                type="button"
                role="switch"
                aria-checked={reduced}
                data-sheet-motion
                onClick={() => setMotionSetting(reduced ? 'full' : 'reduced')}
                className="h-11 min-w-11 px-3 border border-line-control text-[13px] text-ink cursor-pointer"
              >
                {reduced ? 'On' : 'Off'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </header>
  );
};
