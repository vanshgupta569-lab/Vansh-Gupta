import React, { useState } from 'react';
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
import { ScreenType } from './types';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('HOME');
  const [selectedTicker, setSelectedTicker] = useState<string>('AAPL');
  const [activeSection, setActiveSection] = useState<string>('hero');

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
            companies={COMPANIES_DATA}
            selectedTicker={selectedTicker}
            onSelectCompany={handleSelectCompanyFromDirectory}
            onBackToHome={() => handleNavigateToScreen('HOME')}
          />
        )}

        {/* SCREEN 3: FINANCIAL ANALYSIS & DYNAMIC DCF TERMINAL */}
        {currentScreen === 'ANALYSIS' && (
          <TerminalDashboard
            companies={COMPANIES_DATA}
            selectedTicker={selectedTicker}
            onSelectTicker={(ticker) => setSelectedTicker(ticker)}
            onOpenDirectory={() => handleNavigateToScreen('DIRECTORY')}
          />
        )}
      </main>

      {/* Institutional Footer */}
      <Footer />
    </div>
  );
}
