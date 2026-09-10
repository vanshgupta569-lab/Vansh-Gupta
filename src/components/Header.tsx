// FILE: src/components/Header.tsx
//
// The header.
//
// Two rules, both learned from the version this replaces.
//
//  1. The bar is full width; the CONTENT inside it is what is capped and
//     centred. Putting the cap on the fixed bar itself and asking it to
//     centre with auto margins is what let the last link run off the right
//     edge on a wide screen.
//  2. The section links only exist on the home page, so they are only shown
//     on the home page. On the search screen and inside a company they were
//     pointing at anchors that were not on the screen — six buttons that
//     either did nothing or threw the reader back to a page they had
//     deliberately left.

import React, { useState, useEffect } from 'react';
import { Home, Building2, Search } from 'lucide-react';
import { ScreenType } from '../types';

/* Four links, not six. A header with six choices is a header nobody reads,
   and the page below is built to be found by scrolling. These are the four
   places somebody actually arrives looking for. */
const SECTIONS = [
  { id: 'routes', label: 'What you can do' },
  { id: 'filings', label: 'How it works' },
  { id: 'numbers', label: 'Coverage' },
  { id: 'margin-notes', label: 'Margin notes' },
];

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
  const [utcTimeStr, setUtcTimeStr] = useState<string>('');
  const [istTimeStr, setIstTimeStr] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();

      const utcHours = String(now.getUTCHours()).padStart(2, '0');
      const utcsMins = String(now.getUTCMinutes()).padStart(2, '0');
      const utcSecs = String(now.getUTCSeconds()).padStart(2, '0');
      setUtcTimeStr(`${utcHours}:${utcsMins}:${utcSecs} UTC`);

      const istFormatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
      setIstTimeStr(`${istFormatter.format(now)} IST`);
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const goHomeAnd = (id: string) => {
    if (currentScreen !== 'HOME') {
      onNavigateToScreen('HOME');
      setTimeout(() => onScrollToSection(id), 100);
    } else {
      onScrollToSection(id);
    }
  };

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-[#111114]/95 backdrop-blur-md hairline-border-b">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-4 flex items-center justify-between gap-5 lg:gap-8">
        {/* Left: the wordmark, and the clocks when there is room for them */}
        <div className="flex items-center gap-6 min-w-0">
          <button
            onClick={() => {
              onNavigateToScreen('HOME');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="font-display text-2xl lg:text-3xl font-bold tracking-tighter text-[#F2F0EA] hover:text-[#ffb3ad] transition-colors flex items-center gap-2.5 group cursor-pointer shrink-0 whitespace-nowrap"
          >
            <span className="inline-block w-3 h-3 bg-[#8B1E1E] group-hover:scale-110 transition-transform" />
            <span>MARGINALIA</span>
          </button>

          {/* The clocks are the first thing to go when the bar gets tight.
              They are pleasant, not load-bearing. */}
          <div className="hidden 2xl:flex items-center gap-3 font-mono text-[11px] text-[#8A8A8F] border-l hairline-border-l pl-6 whitespace-nowrap">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[#F2F0EA] font-medium">{istTimeStr}</span>
            <span className="text-[#52525B]">|</span>
            <span className="text-[#8A8A8F] font-medium">{utcTimeStr}</span>
          </div>
        </div>

        {/* Middle: the section links, and only where those sections exist */}
        {currentScreen === 'HOME' && (
          <nav className="hidden lg:flex gap-6 xl:gap-8 items-center shrink-0">
            {SECTIONS.map((item) => (
              <button
                key={item.id}
                onClick={() => goHomeAnd(item.id)}
                className={`font-mono text-[11px] tracking-wider uppercase transition-colors relative py-1 cursor-pointer whitespace-nowrap ${
                  activeSection === item.id
                    ? 'text-[#8B1E1E] font-semibold border-b-2 border-[#8B1E1E]'
                    : 'text-[#dfbfbc] hover:text-[#F2F0EA]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        )}

        {/* Right: where you can go from here */}
        <div className="flex items-center gap-3 shrink-0">
          {currentScreen !== 'DIRECTORY' && (
            <button
              onClick={() => onNavigateToScreen('DIRECTORY')}
              className="border text-[#F2F0EA] font-mono text-[11px] px-4 py-2.5 uppercase tracking-wider transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap"
              style={{ borderColor: '#8B1E1E', background: 'rgba(139,30,30,0.22)' }}
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Search a company</span>
            </button>
          )}

          {currentScreen !== 'HOME' && (
            <button
              onClick={() => onNavigateToScreen('HOME')}
              className="bg-transparent border hairline-border text-[#F2F0EA] font-mono text-[11px] px-3.5 py-2.5 uppercase tracking-wider hover:bg-[#222228] transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <Home className="w-3.5 h-3.5 text-[#8A8A8F]" />
              <span className="hidden sm:inline">Home</span>
            </button>
          )}

          {currentScreen === 'ANALYSIS' && (
            <button
              onClick={() => onNavigateToScreen('DIRECTORY')}
              className="bg-transparent border hairline-border text-[#F2F0EA] font-mono text-[11px] px-3.5 py-2.5 uppercase tracking-wider hover:bg-[#222228] transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <Building2 className="w-3.5 h-3.5 text-[#8A8A8F]" />
              <span className="hidden sm:inline">All companies</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
