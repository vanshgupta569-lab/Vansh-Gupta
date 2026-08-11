import React, { useState } from 'react';
import { motion, useScroll } from 'motion/react';
import { Analytics } from '@vercel/analytics/react';
import { Header } from './components/Header';
import { HeroSection } from './components/HeroSection';
import { EtymologySection } from './components/EtymologySection';
import { MethodologyGrid } from './components/MethodologyGrid';
import { CoverageStatsSection } from './components/CoverageStatsSection';
import { FeedbackFormSection } from './components/FeedbackFormSection';
import { DirectoryScreen } from './components/DirectoryScreen';
import { TerminalDashboard } from './components/TerminalDashboard';
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
    try {
      const company = await loadCompany(ticker);
      setLoadedCompanies((prev) => ({ ...prev, [ticker]: company }));
      setLookupState({ loading: false, error: null });
      setSelectedTicker(ticker);
      setCurrentScreen('ANALYSIS');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error: any) {
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

  const handleSelectCompanyFromDirectory = (ticker: string) => {
    setSelectedTicker(ticker);
    setCurrentScreen('ANALYSIS');
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
            {/* Hero Section */}
            <HeroSection onSearchCompany={() => handleNavigateToScreen('DIRECTORY')} />

            {/* Etymology Section */}
            <EtymologySection />

            {/* Process Flowchart / Methodology */}
            <MethodologyGrid onSelectStep={() => handleNavigateToScreen('DIRECTORY')} />

            {/* Coverage Stats */}
            <CoverageStatsSection />

            {/* Access Request Form & Analyst Profile */}
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

        {/* SCREEN 3: FINANCIAL ANALYSIS & DYNAMIC DCF TERMINAL */}
        {currentScreen === 'ANALYSIS' && (
          <TerminalDashboard
            companies={allCompanies}
            selectedTicker={selectedTicker}
            onSelectTicker={(ticker) => setSelectedTicker(ticker)}
            onOpenDirectory={() => handleNavigateToScreen('DIRECTORY')}
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