// FILE: src/App.tsx
import React, { useState } from 'react';
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
import type { Verdict } from './data/qualitativeFactors';
import { Footer } from './components/Footer';
import { COMPANIES_DATA } from './data/companies';
import { fetchCompanyPayload, buildCompanyFrom } from './data/autoCompany';
import type { Corrections } from './data/corrections';
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
  const [selectedTicker, setSelectedTicker] = useState<string>('AAPL');
  const [activeSection, setActiveSection] = useState<string>('hero');

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
  const [building, setBuilding] = useState(false);

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
      setCorrections({});
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
        const company = buildCompanyFrom(payload, corrections);
        setLoadedCompanies((prev) => ({ ...prev, [company.ticker]: company }));
        setBuilding(false);
        openQuestionsFor(company.ticker);
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

  // Reopening the figures from the badge. Only possible where the payload is
  // still in hand, which is every company reached through the search.
  const reopenFigures = () => {
    if (!payload) return;
    setCurrentScreen('FIGURES');
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
        currentScreen={currentScreen}
        onNavigateToScreen={handleNavigateToScreen}
        onScrollToSection={scrollToSection}
        activeSection={activeSection}
        corrected={allCompanies[selectedTicker]?.correctedInputs}
        onReviewFigures={payload ? reopenFigures : undefined}
      />

      {/* Scroll Progress Indicator Line */}
      <ScrollProgressBar />

      {/* Screen Views */}
      <main className="flex-grow">
        {/* SCREEN 1: BASIC INTRO & PHILOSOPHY */}
        {currentScreen === 'HOME' && (
          <LandingPage
            onOpenCompany={() => handleNavigateToScreen('DIRECTORY')}
            onScrollTo={scrollToSection}
          >
            <CoverageStatsSection />
            <FeedbackFormSection />
          </LandingPage>
        )}

        {/* SCREEN 2: COMPANY SEARCH DIRECTORY */}
        {currentScreen === 'DIRECTORY' && (
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
        {currentScreen === 'FIGURES' && payload && (
          <FiguresEditor
            ticker={payload.ticker || selectedTicker}
            name={payload.name || selectedTicker}
            source={payload.source || 'the filings'}
            sourceUrl={payload.sourceUrl}
            currencySymbol={payload.currencySymbol || '$'}
            statements={payload.statements || []}
            corrections={corrections}
            onChange={setCorrections}
            onContinue={buildFromFigures}
            onBack={() => handleNavigateToScreen('DIRECTORY')}
            building={building}
          />
        )}

        {/* SCREEN 2b: WHAT THE FILINGS CANNOT SAY — asked before the value
            appears, because a number on screen becomes an anchor and every
            judgement made afterwards bends towards it. */}
        {currentScreen === 'QUESTIONS' && allCompanies[selectedTicker] && (
          <QualitativeIntro
            company={allCompanies[selectedTicker]}
            onContinue={(verdicts) => goToAnalysis(verdicts)}
            onSkip={() => goToAnalysis(null)}
            onBack={() => handleNavigateToScreen('DIRECTORY')}
          />
        )}

        {/* SCREEN 3: FINANCIAL ANALYSIS & DYNAMIC DCF TERMINAL */}
        {currentScreen === 'ANALYSIS' && (
          <TerminalDashboard
            companies={allCompanies}
            selectedTicker={selectedTicker}
            onSelectTicker={(ticker) => setSelectedTicker(ticker)}
            onOpenDirectory={() => handleNavigateToScreen('DIRECTORY')}
            initialVerdicts={initialVerdicts}
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