// FILE: src/App.tsx
import React, { useState } from 'react';
import { motion, useScroll } from 'motion/react';
import { Analytics } from '@vercel/analytics/react';
import { Header } from './components/Header';
import {
  LandingHero,
  WhereToStart,
  SeeItWork,
  ByTheNumbers,
  ThreeWays,
  InTheMargin,
  MarginNotes,
  FinalCta,
  StackPair,
  useEasedScroll,
} from './components/landingPage';
import { MethodologyGrid } from './components/MethodologyGrid';
import { CoverageStatsSection } from './components/CoverageStatsSection';
import { FeedbackFormSection } from './components/FeedbackFormSection';
import { DirectoryScreen } from './components/DirectoryScreen';
import { TerminalDashboard } from './components/TerminalDashboard';
import { QualitativeIntro } from './components/qualitativeIntro';
import type { Verdict } from './data/qualitativeFactors';
import { Footer } from './components/Footer';
import { COMPANIES_DATA } from './data/companies';
import { loadCompany } from './data/autoCompany';
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
      const company = await loadCompany(ticker);
      await settle();
      setLoadedCompanies((prev) => ({ ...prev, [ticker]: company }));
      setLookupState({ loading: false, error: null });
      openQuestionsFor(ticker);
    } catch (error: any) {
      await settle();
      setLookupState({ loading: false, error: error.message || 'Could not build a model for that ticker.' });
    }
  };

  const handleNavigateToScreen = (screen: ScreenType) => {
    setCurrentScreen(screen);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToSection = (id: string) => {
    if (id === 'platform') id = 'methodology';
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Eased wheel scrolling, landing page only. The model screens have their
  // own scrolling panels and are left entirely alone.
  useEasedScroll(currentScreen === 'HOME');

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
      />

      {/* Scroll Progress Indicator Line */}
      <ScrollProgressBar />

      {/* Screen Views */}
      <main className="flex-grow">
        {/* SCREEN 1: BASIC INTRO & PHILOSOPHY */}
        {currentScreen === 'HOME' && (
          <div>
            <LandingHero
              onOpenListed={() => handleNavigateToScreen('DIRECTORY')}
              onOpenPrivate={() => handleNavigateToScreen('DIRECTORY')}
            />

            <WhereToStart onRoute={() => handleNavigateToScreen('DIRECTORY')} />

            <SeeItWork onOpenListed={() => handleNavigateToScreen('DIRECTORY')} />

            <ByTheNumbers />

            {/* The overlap he could not see. A negative margin alone is
                nearly invisible: the section below simply starts a little
                higher and nothing appears to move. What reads is the section
                ABOVE holding still while the next one climbs over it, which
                needs the one underneath to be sticky. Three ways to value
                pins; the methodology panel slides up across it with rounded
                corners and a shadow at its top edge. */}
            <StackPair
              under={<ThreeWays />}
              over={
                <MethodologyGrid onSelectStep={() => handleNavigateToScreen('DIRECTORY')} />
              }
            />

            <InTheMargin onOpenNotes={() => scrollToSection('margin-notes')} />

            <MarginNotes onOpenNotes={() => scrollToSection('margin-notes')} />

            <CoverageStatsSection />

            <FinalCta
              onOpenListed={() => handleNavigateToScreen('DIRECTORY')}
              onOpenPrivate={() => handleNavigateToScreen('DIRECTORY')}
            />

            <FeedbackFormSection />
          </div>
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