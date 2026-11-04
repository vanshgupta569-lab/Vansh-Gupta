// FILE: src/App.tsx
import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useScroll, MotionConfig } from 'motion/react';
import { Analytics } from '@vercel/analytics/react';
import { Header } from './components/Header';
import { LandingPage } from './components/landingPage';
import { CoverageStatsSection } from './components/CoverageStatsSection';
import { FeedbackFormSection } from './components/FeedbackFormSection';
/* THE SCREENS BEYOND THE LANDING PAGE LOAD WHEN THEY ARE OPENED (build step
   8, job 8.7). Imported here statically, they made the landing page's first
   script 2.2MB — the workbook writer, the dashboard, the figures editor and
   the screener among it — and evaluating it held the main thread for about
   400ms before anyone could scroll. Each is now its own chunk. */
const DirectoryScreen = lazy(() => import('./components/DirectoryScreen').then((m) => ({ default: m.DirectoryScreen })));
const FiguresEditor = lazy(() => import('./components/figuresEditor').then((m) => ({ default: m.FiguresEditor })));
const TerminalDashboard = lazy(() => import('./components/TerminalDashboard').then((m) => ({ default: m.TerminalDashboard })));
const QualitativeIntro = lazy(() => import('./components/qualitativeIntro').then((m) => ({ default: m.QualitativeIntro })));
// THE SEARCH PALETTE (job 9.2) is its own chunk, fetched before it is asked
// for: on the trigger's focus or the pointer's approach, and after two idle
// seconds (NAV_SEARCH §4.6), so ⌘K paints at once.
const loadPalette = () => import('./components/searchPalette');
const SearchPalette = lazy(() => loadPalette().then((m) => ({ default: m.SearchPalette })));
const NotFound = lazy(() => import('./components/notFound').then((m) => ({ default: m.NotFound })));
const MarginNotesScreen = lazy(() => import('./components/marginNotes').then((m) => ({ default: m.MarginNotesScreen })));
const CompanyPage = lazy(() => import('./components/companyPage').then((m) => ({ default: m.CompanyPage })));
import { useNavigation } from './data/router';
import { parseCompanyPath, companyPath, DEFAULT_TAB } from './data/companyRoute';
import { parseNotesPath, notePath, NOTES_PATH } from './data/notesRoute';
import { LOADING, holdFor } from './data/loadingTimeline';
import type { Verdict } from './data/qualitativeFactors';
import { Footer } from './components/Footer';
import { COMPANIES_DATA } from './data/companies';
import { fetchCompanyPayload, buildCompanyFrom } from './data/autoCompany';
import type { Corrections } from './data/corrections';
import type { HeadAssignment } from './data/heads';
import type { CorrectionReasons } from './data/corrections';
import { CompanyData } from './types';
import { ScreenType } from './types';
const ScreenerScreen = lazy(() => import('./components/screenerScreen').then((m) => ({ default: m.ScreenerScreen })));
import { installMotionAttribute, useReducedMotion } from './design/motion';

// `<html data-motion>` follows the operating system and the stored setting
// from before the first render, so nothing animates for one frame first.
installMotionAttribute();

// THE SCROLL-PROGRESS RULE (`docs/VISUAL_BUILD_PLAN.md` C26, job 8.4).
//
// It sat at a fixed 80px from the top whatever the header measured, so it
// floated below a 64px header or ran under a taller one, and it carried an
// oxblood glow (`box-shadow`), the one shadow on a site that has none. It now
// sits on the header's bottom edge, measured rather than assumed, so it stays
// there when the header changes height (it will be 64 / 48px after job 9.1).
// It moves by `transform: scaleX` only, 1:1 with the scroll, which is a
// position indicator rather than an animation, so it is not stopped by
// reduced motion. Oxblood, as the mark is; VISUAL_SYSTEM §3.1 does not count
// it against the accent budget.
const ScrollProgressBar: React.FC = () => {
  const { scrollYProgress } = useScroll();
  const [top, setTop] = useState(0);

  useEffect(() => {
    const header = document.querySelector('header');
    if (!header) return;
    const measure = () => setTop(Math.round(header.getBoundingClientRect().bottom));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  return (
    <div
      data-progress-rule
      aria-hidden="true"
      className="fixed left-0 right-0 h-[2px] z-50 pointer-events-none"
      style={{ top }}
    >
      <motion.div style={{ scaleX: scrollYProgress }} className="h-full bg-accent origin-left" />
    </div>
  );
};

export default function App() {
  // One answer to "may things move", handed to the animation library below so
  // every motion.* element follows the operating system and the stored setting.
  const reducedMotion = useReducedMotion();
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('HOME');

  // THE COMPANY PAGE IS THE ONE PART OF THIS SITE WITH REAL ADDRESSES
  // (ROADMAP.md §13). `/company/RELIANCE.NS/overview` is a place a reader can
  // link to; everything else is still one screen value at `/`, which is a
  // smaller change than giving every screen a route and is what was asked for.
  // When the path names a company, that is what renders, whatever `currentScreen`
  // happens to hold — so Back out of the model flow lands where it should.
  const nav = useNavigation();
  const route = useMemo(() => parseCompanyPath(nav.path), [nav.path]);
  // THE MARGIN NOTES HAVE ADDRESSES (LEARN_STATES §2.2, L1; job 9.8):
  // /learn/notes/ and /learn/notes/<key>/. A key no note has goes to the
  // screen's own address rather than opening some other note under it.
  const notesRoute = useMemo(() => parseNotesPath(nav.path), [nav.path]);
  // PAGE NOT FOUND (LEARN_STATES §3.6; job 9.5). Every other screen lives at
  // `/`; a path the app does not know used to render the landing page at the
  // wrong address. `/index.html` is the same page as `/`.
  const unknownPath = !route && !notesRoute && nav.path !== '/' && nav.path !== '/index.html' && nav.path !== '/screener';
  useEffect(() => {
    if (notesRoute?.unknown) nav.replace(NOTES_PATH);
  }, [notesRoute?.unknown]);
  const [hubState, setHubState] = useState<{ loading: boolean; error: string | null }>({
    loading: false,
    error: null,
  });
  const [hubAttempt, setHubAttempt] = useState(0);
  // Which ticker a fetch is in flight for, so the effect below cannot start a
  // second one for the same company while the first is still running.
  const hubFetching = useRef<string | null>(null);
  // THE COMPANY THE ADDRESS NAMES RIGHT NOW, read when a fetch comes back.
  //
  // This is a ref and not the closure's own variable because React runs every
  // effect twice in development (StrictMode: mount, clean up, mount again).
  // The first version of this used a `left` flag set by the cleanup, and the
  // second mount saw a fetch already in flight and did nothing — so the only
  // live request belonged to a closure that had been told to discard its
  // answer, and the page sat on "reading the filings" for ever. A ref is read
  // at the moment the answer arrives rather than captured when it was asked
  // for, which is the question that actually matters: is this still the
  // company on screen?
  const wantedTicker = useRef<string | null>(null);
  wantedTicker.current = route?.ticker ?? null;
  const [selectedTicker, setSelectedTicker] = useState<string>('AAPL');
  const [activeSection, setActiveSection] = useState<string>('hero');
  // Which margin note the reader clicked into. Null simply opens the first.

  // Companies fetched and modelled on demand this session. They sit alongside
  // the curated ones and are discarded on refresh — nothing is stored.
  const [loadedCompanies, setLoadedCompanies] = useState<Record<string, CompanyData>>({});
  // `payload` on this state is the FIGURES ARRIVING WHILE THE READER WAITS.
  // The loading screen shows one myth-versus-fact card drawn from the
  // company's own filings, so it needs them as soon as they land rather than
  // when the screen after it opens — which on a fast fetch is nearly five
  // seconds later, because the build stages are held on screen deliberately.
  const lookupToken = useRef(0);
  const [lookupState, setLookupState] = useState<{
    loading: boolean;
    error: string | null;
    payload?: any;
    /** When the build started and when its filings arrived (job 9.3). */
    startedAt?: number;
    doneAt?: number;
  }>({
    loading: false,
    error: null,
  });

  // What the reader answered before the model was built. Null means they
  // skipped, and skipping must produce exactly the model the site would have
  // built on its own.
  const [initialVerdicts, setInitialVerdicts] = useState<Record<string, Verdict> | null>(null);

  // THE FIGURES STEP (backlog 11a).
  //
  // The filings are fetched, shown to the reader, and only then modelled. The
  // payload and the reader's corrections live here because both outlive the
  // screen: the badge on the analysis view reads the corrections, and reopening
  // the figures must not cost another fetch.
  const [payload, setPayload] = useState<any | null>(null);
  const [corrections, setCorrections] = useState<Corrections>({});
  // THE JUDGEMENT LAYER (ROADMAP.md §19b). The head the reader has put each
  // filed line under lives beside the corrections and for the same reason: the
  // badge in the header reads it, and reopening the figures must not cost
  // another fetch or lose a judgement already made.
  const [heads, setHeads] = useState<HeadAssignment>({});
  // One line per corrected field, which the adjusted EBITDA bridge carries.
  const [correctionReasons, setCorrectionReasons] = useState<CorrectionReasons>({});
  const [building, setBuilding] = useState(false);
  // True when the figures were opened from a finished model rather than on the
  // way to one. It decides where "back" goes, and it is why re-answering the
  // qualitative questions is not demanded a second time: those questions are
  // about the company, and correcting a figure does not change the company.
  const [figuresFromModel, setFiguresFromModel] = useState(false);

  // Every route into a company goes through the questions first: the search
  // box, the directory grid, and the hand-built model cards. The judgements are
  // about the company, not about which model was used to value it, so making
  // one route skip them would be arbitrary.
  const openQuestionsFor = (ticker: string) => {
    setSelectedTicker(ticker);
    setInitialVerdicts(null);
    setCurrentScreen('QUESTIONS');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goToAnalysis = (verdicts: Record<string, Verdict> | null) => {
    setInitialVerdicts(verdicts);
    setCurrentScreen('ANALYSIS');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const allCompanies = { ...COMPANIES_DATA, ...loadedCompanies };

  /**
   * READING A COMPANY FROM ITS ADDRESS.
   *
   * The payload the figures screen works from is the same one the company page
   * reads, so arriving at /company/X and then opening the Model tab costs ONE
   * fetch, not two — and the figures the reader was just shown are the figures
   * the model is built from, rather than a second copy fetched a minute later.
   */
  useEffect(() => {
    if (!route) return;
    const held = String(payload?.ticker || '').toUpperCase();
    if (held === route.ticker) return;
    if (hubFetching.current === route.ticker) return;
    const want = route.ticker;
    hubFetching.current = want;
    setHubState({ loading: true, error: null });
    fetchCompanyPayload(want)
      .then((fetched) => {
        if (wantedTicker.current !== want) return;
        setPayload(fetched);
        setCorrections({});
        setHeads({});
        setCorrectionReasons({});
        setFiguresFromModel(false);
        setSelectedTicker(want);
        setHubState({ loading: false, error: null });
      })
      .catch((error: any) => {
        if (wantedTicker.current !== want) return;
        setHubState({
          loading: false,
          error:
            error?.message ||
            `No company could be read for ${want}. Check the ticker, including its market suffix.`,
        });
      })
      .finally(() => {
        if (hubFetching.current === want) hubFetching.current = null;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.ticker, hubAttempt]);

  /** Open a company page, from anywhere. */
  const openCompanyPage = (ticker: string, tab: string = DEFAULT_TAB) => {
    nav.go(companyPath(ticker, tab));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /**
   * THE MODEL TAB OPENS THE FLOW THAT ALREADY EXISTS, UNCHANGED: the figures
   * as filed, then the questions, then the valuation. The address goes back to
   * `/` with it, because that flow has no address of its own and leaving the
   * company path in the bar would make Back land on a page the reader is no
   * longer looking at.
   */
  const openModelFromHub = () => {
    if (!payload) return;
    setFiguresFromModel(false);
    setCurrentScreen('FIGURES');
    nav.go('/');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLookupTicker = async (rawTicker: string) => {
    const ticker = rawTicker.toUpperCase();

    // Reuse what we have ONLY if it is real: either a curated model (Apple) or
    // one already fetched this session. The four placeholder records shipped in
    // companies.ts carry invented figures and no model of their own, so they
    // must be replaced by a live fetch rather than opened.
    const existing = allCompanies[ticker];
    if (existing && (existing.engineBacked || existing.modelData)) {
      handleSelectCompanyFromDirectory(ticker);
      return;
    }

    const token = ++lookupToken.current;
    const startedAt = Date.now();
    setLookupState({ loading: true, error: null, startedAt });

    // THE HOLD COMES FROM THE LOADING TIMELINE (NAV_SEARCH §5.2; job 9.3),
    // not a fixed 4.8 seconds. A build done inside a second is not held at
    // all and never opens the modal; one that opened it holds until the
    // correction has been read for 1.2 seconds — at most 1.2 seconds more.
    const settle = async () => {
      const wait = holdFor(Date.now() - startedAt);
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    };
    const cancelled = () => lookupToken.current !== token;

    try {
      // Fetch the filings and stop. Nothing is modelled until the reader has
      // had the chance to look at what it would be modelled from. Given up
      // after 90 seconds (§5.3).
      let giveUp = 0;
      const fetched = await Promise.race([
        fetchCompanyPayload(ticker),
        new Promise<never>((_, reject) => {
          giveUp = window.setTimeout(
            () => reject(new Error(`The model could not be built for ${ticker}. The filings did not arrive within ${LOADING.giveUpAfterMs / 1000} seconds.`)),
            LOADING.giveUpAfterMs,
          );
        }),
      ]).finally(() => window.clearTimeout(giveUp));
      if (cancelled()) return;
      // Handed to the loading screen BEFORE the hold below, so the card it is
      // showing becomes this company's card while the reader is still
      // watching rather than a moment after they have left.
      setLookupState({ loading: true, error: null, payload: fetched, startedAt, doneAt: Date.now() });
      await settle();
      if (cancelled()) return;
      setPayload(fetched);
      // A new company gets the engine's own defaults back. A judgement made
      // about one company's cost lines is not a judgement about another's.
      setCorrections({});
      setHeads({});
      setCorrectionReasons({});
      setFiguresFromModel(false);
      setSelectedTicker(ticker);
      setLookupState({ loading: false, error: null });
      // A SEARCH LANDS ON THE COMPANY, NOT INSIDE ONE OF ITS SCREENS.
      //
      // Typing a ticker used to drop the reader straight into the figures
      // editor, which is one tab of a company and not the company: no price,
      // no chart, no profile, no address to send anybody, and no way to see
      // what the company IS before being asked to check its numbers. It now
      // goes to /company/<ticker>/overview, and the Model tab there opens the
      // same figures screen unchanged.
      //
      // The payload fetched above travels with it, so the hub finds the
      // company already in hand and does not fetch a second time — and the
      // figures the Model tab opens are the ones this fetch returned rather
      // than a second copy fetched a minute later.
      nav.go(companyPath(ticker));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error: any) {
      if (cancelled()) return;
      await settle();
      if (cancelled()) return;
      setLookupState({ loading: false, error: error.message || 'Could not build a model for that ticker.' });
    }
  };

  // CANCEL, AND ESC, FROM THE FIRST MILLISECOND (§5.4). The fetch cannot be
  // recalled, so its answer is ignored instead: the token moves on and the
  // lookup above returns without touching the screen.
  const cancelLookup = () => {
    lookupToken.current++;
    setLookupState({ loading: false, error: null });
  };

  // Leaving the figures screen is the moment the model is built. A failure
  // here is a modelling refusal — a demerger year, too little comparable
  // history — so it belongs back on the search screen where it can be read.
  const buildFromFigures = () => {
    if (!payload) return;
    setBuilding(true);
    // Yield a frame so the button can say what it is doing before the engine
    // takes the thread.
    window.setTimeout(() => {
      try {
        const company = buildCompanyFrom(payload, corrections, heads, correctionReasons);
        setLoadedCompanies((prev) => ({ ...prev, [company.ticker]: company }));
        setBuilding(false);
        if (figuresFromModel) {
          // Straight back to the model that was already open, with the answers
          // given earlier left alone. Sending a reader back through ten
          // questions because they fixed one number is a punishment for
          // checking, which is the opposite of what this screen is for.
          setSelectedTicker(company.ticker);
          setCurrentScreen('ANALYSIS');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          openQuestionsFor(company.ticker);
        }
      } catch (error: any) {
        setBuilding(false);
        setLookupState({
          loading: false,
          error: error.message || 'Could not build a model from those figures.',
        });
        setCurrentScreen('DIRECTORY');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 30);
  };

  /**
   * REOPENING A SAVED MODEL IS A REBUILD (`KI-27`).
   *
   * The sliders live on the dashboard, but the corrections and the head
   * assignment are baked into the company RECORD when it is derived, and a
   * record can only be rebuilt from the untouched payload. That payload travels
   * with every derived record as `rawFetched`, which is exactly why it is kept.
   *
   * So the dashboard hands the restored judgements up here, and here the record
   * is built again from them and put back in the company list. Everything
   * downstream — the forecast, the health score, the asset approach, the EBITDA
   * bridge, the workbook — follows from that one object, which is the same
   * reason a correction never needed its own path through the engine.
   *
   * The figures screen's own state is moved with it, so reopening the figures
   * after restoring a saved model shows the corrections that model was built on
   * rather than the ones that happened to be in hand.
   */
  const restoreJudgements = (
    ticker: string,
    restored: { corrections: Corrections; correctionReasons: CorrectionReasons; heads: HeadAssignment }
  ) => {
    setCorrections(restored.corrections);
    setCorrectionReasons(restored.correctionReasons);
    setHeads(restored.heads);

    const base = loadedCompanies[ticker] ?? (COMPANIES_DATA as any)[ticker];
    const fetched = base?.rawFetched;
    // A curated company has no payload to correct, so there is nothing to
    // rebuild and nothing was ever saved for it beyond the sliders. Said here
    // rather than silently skipped.
    if (!fetched?.statements) return;
    setPayload(fetched);
    try {
      const rebuilt = buildCompanyFrom(
        fetched,
        restored.corrections,
        restored.heads,
        restored.correctionReasons
      );
      setLoadedCompanies((prev) => ({ ...prev, [rebuilt.ticker]: rebuilt }));
    } catch (error: any) {
      // A payload that no longer models is a refusal, not a crash: the company
      // list keeps the record it has and the screen says what it says.
      setLookupState({
        loading: false,
        error: error?.message || 'That saved model could not be reopened from these filings.',
      });
    }
  };

  // The payload in hand belongs to ONE company. Searching a second company
  // replaces it, so the figures may only be reopened for the company the
  // payload is actually about — otherwise the button would offer to edit
  // Reliance's figures while Apple is on screen.
  const figuresAvailable =
    !!payload &&
    String(payload.ticker || '').toUpperCase() === String(selectedTicker || '').toUpperCase();

  // Reopening the figures from the header control.
  const reopenFigures = () => {
    if (!figuresAvailable) return;
    setFiguresFromModel(currentScreen === 'ANALYSIS' || currentScreen === 'QUESTIONS');
    setCurrentScreen('FIGURES');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Leaving the figures without rebuilding. The model on screen is unchanged,
  // so this goes back to it rather than throwing the reader out to the search.
  const leaveFigures = () => {
    if (figuresFromModel) {
      setCurrentScreen('ANALYSIS');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    handleNavigateToScreen('DIRECTORY');
  };

  // Opening the notes. A key sends the reader to the note they clicked; no
  // key opens the screen at the top of the list.
  const openNotes = (key?: string) => {
    nav.go(key ? notePath(key) : NOTES_PATH);
    window.scrollTo({ top: 0 });
  };

  const handleNavigateToScreen = (screen: ScreenType) => {
    // The notes are an address now, not a screen value.
    if (screen === 'NOTES') { openNotes(); return; }
    // From a notes address or a not-found one, every other screen lives at `/`.
    if (notesRoute || unknownPath) nav.go('/');
    setCurrentScreen(screen);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ---- the search palette (NAV_SEARCH §4; job 9.2) ----------------------
  const [paletteOpen, setPaletteOpen] = useState(false);
  // "Choose a company for …" (NAV_SEARCH §3): the tab a chosen company opens.
  const [paletteTarget, setPaletteTarget] = useState<{ tab: string; title: string } | null>(null);
  const paletteOpener = useRef<HTMLElement | null>(null);
  const prefetchPalette = () => { loadPalette().catch(() => {}); };
  useEffect(() => {
    const t = window.setTimeout(prefetchPalette, 2000);
    return () => window.clearTimeout(t);
  }, []);
  const openPalette = (target?: { tab: string; title: string }) => {
    paletteOpener.current = document.activeElement as HTMLElement | null;
    setPaletteTarget(target ?? null);
    setPaletteOpen(true);
  };
  const closePalette = (returnFocus = true) => {
    setPaletteOpen(false);
    if (returnFocus) window.setTimeout(() => paletteOpener.current?.focus?.(), 0);
  };
  // A company chosen in the palette is opened the way the search screen
  // opens one: its build starts, on the search screen's loading screen.
  const openFromPalette = (ticker: string) => {
    closePalette(false);
    if (paletteTarget) {
      nav.go(companyPath(ticker, paletteTarget.tab));
      window.scrollTo({ top: 0 });
      return;
    }
    if (route || notesRoute || unknownPath || nav.path === '/screener') nav.go('/');
    setCurrentScreen('DIRECTORY');
    handleLookupTicker(ticker);
  };
  const goFromPalette = (d: import('./data/menu').Destination) => {
    closePalette(false);
    if (d.kind === 'screen' || d.kind === 'company') return;
    if (d.kind === 'section') { scrollToSection(d.section); return; }
    if (d.href === '/learn/') window.location.assign(d.href);
    else { nav.go(d.href); window.scrollTo({ top: 0 }); }
  };
  // "Ask us to add it": the feedback form on the landing page, the query in it.
  const askToAdd = (query: string) => {
    closePalette(false);
    if (nav.path !== '/') nav.go('/');
    setCurrentScreen('HOME');
    window.setTimeout(() => {
      const box = document.querySelector<HTMLTextAreaElement>('#coverage textarea[name="message"]');
      if (!box) return;
      box.value = `Please add ${query}. I searched for it and it was not found.`;
      box.scrollIntoView({ block: 'center' });
      box.focus();
    }, 300);
  };

  const scrollToSection = (id: string) => {
    if (id === 'platform' || id === 'methodology' || id === 'model') id = 'filings';
    setActiveSection(id);
    // The header's section links name landing sections; from the notes they
    // go to the landing page first and scroll once it has rendered.
    if (notesRoute) {
      nav.go('/');
      setCurrentScreen('HOME');
      window.setTimeout(() => document.getElementById(id)?.scrollIntoView(), 120);
      return;
    }
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSelectCompanyFromDirectory = (ticker: string) => {
    openQuestionsFor(ticker);
  };

  return (
    <MotionConfig reducedMotion={reducedMotion ? 'always' : 'never'}>
    <div className="min-h-screen bg-[#0B0B0D] text-[#F2F0EA] font-sans antialiased flex flex-col selection:bg-[#8B1E1E] selection:text-white">
      {/* Universal Top Navigation Header */}
      <Header
        currentScreen={route ? 'COMPANY' : notesRoute ? 'NOTES' : currentScreen}
        onNavigateToScreen={handleNavigateToScreen}
        onScrollToSection={scrollToSection}
        activeSection={activeSection}
        corrected={allCompanies[selectedTicker]?.correctedInputs}
        reclassified={allCompanies[selectedTicker]?.reclassified}
        onReviewFigures={figuresAvailable ? reopenFigures : undefined}
        path={nav.path}
        onGo={(next) => nav.go(next)}
        onOpenSearch={openPalette}
        onPrefetchSearch={prefetchPalette}
      />

      {/* Scroll Progress Indicator Line */}
      <ScrollProgressBar />

      {paletteOpen && (
        <Suspense fallback={null}>
          <SearchPalette
            onClose={() => closePalette(true)}
            onSelect={(l) => openFromPalette(l.ticker)}
            onGo={goFromPalette}
            onAskToAdd={askToAdd}
            title={paletteTarget?.title}
          />
        </Suspense>
      )}

      {/* Screen Views */}
      <main id="main-content" tabIndex={-1} className="flex-grow focus:outline-none">
        <Suspense fallback={null}>
        {/* THE COMPANY PAGE WINS WHEN THE PATH NAMES ONE. Checked before the
            screen values so that a deep link renders the company rather than
            the landing page that `currentScreen` still says is open. */}
        {/* THE SCREENER IS THE SECOND REAL ADDRESS ON THIS SITE. It needs one
            for the same reason the company page does and one more besides: its
            filters live in the query string, so the link in the bar IS the
            screen and can be sent to somebody (`docs/SCREENER_SPEC.md` rule
            22). Checked before the company page only because the two paths
            cannot both match. */}
        {!route && nav.path === '/screener' && (
          <ScreenerScreen
            search={nav.search}
            onScreenChange={(next) => nav.replace(next ? `/screener?${next}` : '/screener')}
            onOpenCompany={(ticker) => nav.go(companyPath(ticker))}
            onBack={() => nav.go('/')}
          />
        )}
        {route && (
          <CompanyPage
            ticker={route.ticker}
            tab={route.tab}
            payload={
              String(payload?.ticker || '').toUpperCase() === route.ticker ? payload : null
            }
            loading={hubState.loading}
            error={hubState.error}
            onTab={(slug) => nav.go(companyPath(route.ticker, slug))}
            onOpenModel={openModelFromHub}
            onRetry={() => {
              setHubState({ loading: false, error: null });
              setHubAttempt((n) => n + 1);
            }}
          />
        )}
        {/* SCREEN 1: BASIC INTRO & PHILOSOPHY */}
        {!route && !notesRoute && !unknownPath && nav.path !== '/screener' && currentScreen === 'HOME' && (
          <LandingPage
            onOpenCompany={() => handleNavigateToScreen('DIRECTORY')}
            onScrollTo={scrollToSection}
            onOpenNotes={openNotes}
          >
            <CoverageStatsSection />
            <FeedbackFormSection />
          </LandingPage>
        )}

        {/* THE MARGIN NOTES.
            A reading screen rather than an instrument one, which is why it is
            paper rather than the dark ground the model screens use. */}
        {unknownPath && (
          <NotFound
            path={nav.path}
            onSearch={() => {
              nav.go('/');
              handleNavigateToScreen('DIRECTORY');
            }}
            onHome={() => {
              nav.go('/');
              handleNavigateToScreen('HOME');
            }}
          />
        )}
        {notesRoute && (
          <MarginNotesScreen
            activeKey={notesRoute.unknown ? null : notesRoute.key}
            onOpen={(key) => {
              nav.go(notePath(key));
              window.scrollTo({ top: 0 });
            }}
          />
        )}

        {/* SCREEN 2: COMPANY SEARCH DIRECTORY */}
        {!route && !notesRoute && !unknownPath && nav.path !== '/screener' && currentScreen === 'DIRECTORY' && (
          <DirectoryScreen
            companies={allCompanies}
            selectedTicker={selectedTicker}
            onSelectCompany={handleSelectCompanyFromDirectory}
            onBackToHome={() => handleNavigateToScreen('HOME')}
            onLookupTicker={handleLookupTicker}
            lookupState={lookupState}
            onCancelLookup={cancelLookup}
          />
        )}

        {/* SCREEN 2a: THE FIGURES, BEFORE ANYTHING IS MODELLED.
            Put here rather than inside the dashboard on purpose: once a value
            is on screen it becomes an anchor, and a reader who has seen a
            number is far less likely to go back and question the figures it
            came from. */}
        {!route && !notesRoute && !unknownPath && nav.path !== '/screener' && currentScreen === 'FIGURES' && payload && (
          <FiguresEditor
            ticker={payload.ticker || selectedTicker}
            name={payload.name || selectedTicker}
            source={payload.source || 'the filings'}
            sourceUrl={payload.sourceUrl}
            currencySymbol={payload.currencySymbol || '$'}
            currency={payload.currency}
            statements={payload.statements || []}
            corrections={corrections}
            onChange={setCorrections}
            heads={heads}
            onHeads={setHeads}
            correctionReasons={correctionReasons}
            onReason={setCorrectionReasons}
            payload={payload}
            onContinue={buildFromFigures}
            onBack={leaveFigures}
            returning={figuresFromModel}
            building={building}
          />
        )}

        {/* SCREEN 2b: WHAT THE FILINGS CANNOT SAY — asked before the value
            appears, because a number on screen becomes an anchor and every
            judgement made afterwards bends towards it. */}
        {!route && !notesRoute && !unknownPath && nav.path !== '/screener' && currentScreen === 'QUESTIONS' && allCompanies[selectedTicker] && (
          <QualitativeIntro
            company={allCompanies[selectedTicker]}
            onContinue={(verdicts) => goToAnalysis(verdicts)}
            onSkip={() => goToAnalysis(null)}
            onBack={() => handleNavigateToScreen('DIRECTORY')}
          />
        )}

        {/* SCREEN 3: FINANCIAL ANALYSIS & DYNAMIC DCF TERMINAL */}
        {!route && !notesRoute && !unknownPath && nav.path !== '/screener' && currentScreen === 'ANALYSIS' && (
          <TerminalDashboard
            companies={allCompanies}
            selectedTicker={selectedTicker}
            onSelectTicker={(ticker) => setSelectedTicker(ticker)}
            onOpenDirectory={() => handleNavigateToScreen('DIRECTORY')}
            initialVerdicts={initialVerdicts}
            judgements={{ corrections, correctionReasons, heads }}
            onRestoreJudgements={restoreJudgements}
            onOpenCompanyPage={openCompanyPage}
          />
        )}
        </Suspense>
      </main>

      {/* Institutional Footer */}
      <Footer />

      {/* Vercel Analytics Tracker */}
      <Analytics />
    </div>
    </MotionConfig>
  );
}