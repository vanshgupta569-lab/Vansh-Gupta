// FILE: src/App.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useScroll } from 'motion/react';
import { Analytics } from '@vercel/analytics/react';
import { Header } from './components/Header';
import { LandingPage } from './components/landingPage';
import { CoverageStatsSection } from './components/CoverageStatsSection';
import { FeedbackFormSection } from './components/FeedbackFormSection';
import { DirectoryScreen } from './components/DirectoryScreen';
import { FiguresEditor } from './components/figuresEditor';
import { TerminalDashboard } from './components/TerminalDashboard';
import { QualitativeIntro } from './components/qualitativeIntro';
import { MarginNotesScreen } from './components/marginNotes';
import { CompanyPage } from './components/companyPage';
import { useNavigation } from './data/router';
import { parseCompanyPath, companyPath, DEFAULT_TAB } from './data/companyRoute';
import type { Verdict } from './data/qualitativeFactors';
import { Footer } from './components/Footer';
import { COMPANIES_DATA } from './data/companies';
import { fetchCompanyPayload, buildCompanyFrom } from './data/autoCompany';
import type { Corrections } from './data/corrections';
import type { HeadAssignment } from './data/heads';
import type { CorrectionReasons } from './data/corrections';
import { CompanyData } from './types';
import { ScreenType } from './types';

// Scroll Progress Bar Component
const ScrollProgressBar: React.FC = () => {
  const { scrollYProgress } = useScroll();

  return (
    <div className="fixed top-20 left-0 right-0 h-[2px] bg-transparent z-50 pointer-events-none">
      <motion.div
        style={{ scaleX: scrollYProgress }}
        className="h-full bg-[#8B1E1E] origin-left shadow-[0_0_10px_rgba(139,30,30,0.8)]"
      />
    </div>
  );
};

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('HOME');

  // THE COMPANY PAGE IS THE ONE PART OF THIS SITE WITH REAL ADDRESSES
  // (ROADMAP.md §13). `/company/RELIANCE.NS/overview` is a place a reader can
  // link to; everything else is still one screen value at `/`, which is a
  // smaller change than giving every screen a route and is what was asked for.
  // When the path names a company, that is what renders, whatever `currentScreen`
  // happens to hold — so Back out of the model flow lands where it should.
  const nav = useNavigation();
  const route = useMemo(() => parseCompanyPath(nav.path), [nav.path]);
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
  const [noteKey, setNoteKey] = useState<string | null>(null);

  // Companies fetched and modelled on demand this session. They sit alongside
  // the curated ones and are discarded on refresh — nothing is stored.
  const [loadedCompanies, setLoadedCompanies] = useState<Record<string, CompanyData>>({});
  const [lookupState, setLookupState] = useState<{ loading: boolean; error: string | null }>({
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

    setLookupState({ loading: true, error: null });

    // Responses are cached at the edge, so a repeat lookup can return in a few
    // hundred milliseconds. Hold the build stages on screen briefly so the work
    // is legible rather than flashing past; a slow fetch simply takes longer.
    const MIN_VISIBLE_MS = 4800;
    const startedAt = Date.now();
    const settle = async () => {
      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_VISIBLE_MS) {
        await new Promise((resolve) => setTimeout(resolve, MIN_VISIBLE_MS - elapsed));
      }
    };

    try {
      // Fetch the filings and stop. Nothing is modelled until the reader has
      // had the chance to look at what it would be modelled from.
      const fetched = await fetchCompanyPayload(ticker);
      await settle();
      setPayload(fetched);
      // A new company gets the engine's own defaults back. A judgement made
      // about one company's cost lines is not a judgement about another's.
      setCorrections({});
      setHeads({});
      setCorrectionReasons({});
      setFiguresFromModel(false);
      setSelectedTicker(ticker);
      setLookupState({ loading: false, error: null });
      setCurrentScreen('FIGURES');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error: any) {
      await settle();
      setLookupState({ loading: false, error: error.message || 'Could not build a model for that ticker.' });
    }
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
    setNoteKey(key ?? null);
    setCurrentScreen('NOTES');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateToScreen = (screen: ScreenType) => {
    setCurrentScreen(screen);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToSection = (id: string) => {
    if (id === 'platform' || id === 'methodology' || id === 'model') id = 'filings';
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSelectCompanyFromDirectory = (ticker: string) => {
    openQuestionsFor(ticker);
  };

  return (
    <div className="min-h-screen bg-[#0B0B0D] text-[#F2F0EA] font-sans antialiased flex flex-col selection:bg-[#8B1E1E] selection:text-white">
      {/* Universal Top Navigation Header */}
      <Header
        currentScreen={route ? 'COMPANY' : currentScreen}
        onNavigateToScreen={handleNavigateToScreen}
        onScrollToSection={scrollToSection}
        activeSection={activeSection}
        corrected={allCompanies[selectedTicker]?.correctedInputs}
        reclassified={allCompanies[selectedTicker]?.reclassified}
        onReviewFigures={figuresAvailable ? reopenFigures : undefined}
      />

      {/* Scroll Progress Indicator Line */}
      <ScrollProgressBar />

      {/* Screen Views */}
      <main className="flex-grow">
        {/* THE COMPANY PAGE WINS WHEN THE PATH NAMES ONE. Checked before the
            screen values so that a deep link renders the company rather than
            the landing page that `currentScreen` still says is open. */}
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
        {!route && currentScreen === 'HOME' && (
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
        {!route && currentScreen === 'NOTES' && (
          <MarginNotesScreen
            initialKey={noteKey}
            onBack={() => handleNavigateToScreen('HOME')}
          />
        )}

        {/* SCREEN 2: COMPANY SEARCH DIRECTORY */}
        {!route && currentScreen === 'DIRECTORY' && (
          <DirectoryScreen
            companies={allCompanies}
            selectedTicker={selectedTicker}
            onSelectCompany={handleSelectCompanyFromDirectory}
            onBackToHome={() => handleNavigateToScreen('HOME')}
            onLookupTicker={handleLookupTicker}
            lookupState={lookupState}
          />
        )}

        {/* SCREEN 2a: THE FIGURES, BEFORE ANYTHING IS MODELLED.
            Put here rather than inside the dashboard on purpose: once a value
            is on screen it becomes an anchor, and a reader who has seen a
            number is far less likely to go back and question the figures it
            came from. */}
        {!route && currentScreen === 'FIGURES' && payload && (
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
        {!route && currentScreen === 'QUESTIONS' && allCompanies[selectedTicker] && (
          <QualitativeIntro
            company={allCompanies[selectedTicker]}
            onContinue={(verdicts) => goToAnalysis(verdicts)}
            onSkip={() => goToAnalysis(null)}
            onBack={() => handleNavigateToScreen('DIRECTORY')}
          />
        )}

        {/* SCREEN 3: FINANCIAL ANALYSIS & DYNAMIC DCF TERMINAL */}
        {!route && currentScreen === 'ANALYSIS' && (
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
      </main>

      {/* Institutional Footer */}
      <Footer />

      {/* Vercel Analytics Tracker */}
      <Analytics />
    </div>
  );
}