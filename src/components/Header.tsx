import React, { useState, useEffect } from 'react';
import { Search, ArrowUpRight, Home, Building2, LineChart } from 'lucide-react';
import { ScreenType } from '../types';

interface HeaderProps {
  currentScreen: ScreenType;
  onNavigateToScreen: (screen: ScreenType) => void;
  onScrollToSection: (id: string) => void;
  activeSection: string;
}

export const Header: React.FC<HeaderProps> = ({
  currentScreen,
  onNavigateToScreen,
  onScrollToSection,
  activeSection,
}) => {
  const [timeStr, setTimeStr] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getUTCHours()).padStart(2, '0');
      const mins = String(now.getUTCMinutes()).padStart(2, '0');
      const secs = String(now.getUTCSeconds()).padStart(2, '0');
      setTimeStr(`${hours}:${mins}:${secs} UTC`);
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleNavClick = (id: string) => {
    if (id === 'search-company') {
      onNavigateToScreen('DIRECTORY');
      return;
    }
    if (currentScreen !== 'HOME') {
      onNavigateToScreen('HOME');
      setTimeout(() => onScrollToSection(id), 100);
    } else {
      onScrollToSection(id);
    }
  };

  return (
    <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 lg:px-12 py-4 bg-[#111114]/95 backdrop-blur-md hairline-border-b max-w-[1440px] mx-auto left-0 right-0">
      <div className="flex items-center gap-6">
        <button
          onClick={() => {
            onNavigateToScreen('HOME');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="font-display text-2xl lg:text-3xl font-bold tracking-tighter text-[#F2F0EA] hover:text-[#ffb3ad] transition-colors flex items-center gap-2.5 group cursor-pointer"
        >
          <span className="inline-block w-3 h-3 bg-[#8B1E1E] group-hover:scale-110 transition-transform" />
          <span>MARGINALIA</span>
        </button>

        {/* Live Market Clock */}
        <div className="hidden xl:flex items-center gap-2 font-mono text-[11px] text-[#8A8A8F] border-l hairline-border-l pl-6">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[#F2F0EA] font-medium">{timeStr}</span>
          <span className="text-[#8A8A8F] ml-2">UTC CLOCK</span>
        </div>
      </div>

      {/* Screen / Section Navigation - Hidden on ANALYSIS screen */}
      {currentScreen !== 'ANALYSIS' && (
        <nav className="hidden md:flex gap-6 lg:gap-8 items-center">
          {[
            { id: 'etymology', label: 'Etymology' },
            { id: 'methodology', label: 'Methodology' },
            { id: 'coverage', label: 'Coverage Stats' },
            { id: 'about', label: 'About' },
            { id: 'search-company', label: 'Search Company' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`font-mono text-[11px] tracking-wider uppercase transition-colors relative py-1 cursor-pointer ${
                (currentScreen === 'HOME' && activeSection === item.id) ||
                (item.id === 'search-company' && currentScreen === 'DIRECTORY')
                  ? 'text-[#8B1E1E] font-semibold border-b-2 border-[#8B1E1E]'
                  : 'text-[#dfbfbc] hover:text-[#F2F0EA]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      )}

      <div className="flex items-center gap-3">
        {currentScreen !== 'HOME' && (
          <button
            onClick={() => onNavigateToScreen('HOME')}
            className="bg-transparent border hairline-border text-[#F2F0EA] font-mono text-[11px] px-3.5 py-2.5 uppercase tracking-wider hover:bg-[#222228] transition-colors flex items-center gap-2 cursor-pointer"
          >
            <Home className="w-3.5 h-3.5 text-[#8A8A8F]" />
            <span className="hidden sm:inline">Home</span>
          </button>
        )}

        {currentScreen === 'ANALYSIS' && (
          <button
            onClick={() => onNavigateToScreen('DIRECTORY')}
            className="bg-transparent border hairline-border text-[#F2F0EA] font-mono text-[11px] px-3.5 py-2.5 uppercase tracking-wider hover:bg-[#222228] transition-colors flex items-center gap-2 cursor-pointer"
          >
            <Building2 className="w-3.5 h-3.5 text-[#8A8A8F]" />
            <span className="hidden sm:inline">All Companies</span>
          </button>
        )}
      </div>
    </header>
  );
};
