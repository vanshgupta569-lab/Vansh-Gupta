import React, { useState } from 'react';
import { CompanyData } from '../types';
import { Search, ArrowRight, Building2, TrendingUp, Sparkles, X, Filter } from 'lucide-react';

interface DirectoryScreenProps {
  companies: Record<string, CompanyData>;
  selectedTicker: string;
  onSelectCompany: (ticker: string) => void;
  onBackToHome: () => void;
  onLookupTicker: (ticker: string) => void;
  lookupState: { loading: boolean; error: string | null };
}

export const DirectoryScreen: React.FC<DirectoryScreenProps> = ({
  companies,
  selectedTicker,
  onSelectCompany,
  onBackToHome,
  onLookupTicker,
  lookupState,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [lookupQuery, setLookupQuery] = useState('');
  const [selectedSector, setSelectedSector] = useState<string>('ALL');

  const companyList = Object.values(companies) as CompanyData[];

  const sectors = ['ALL', ...Array.from(new Set(companyList.map((c) => c.sector)))];

  const filteredCompanies = companyList.filter((c) => {
    const matchesQuery =
      c.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.isin.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.sector.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesSector = selectedSector === 'ALL' || c.sector === selectedSector;

    return matchesQuery && matchesSector;
  });

  return (
    <div className="pt-28 pb-20 max-w-[1440px] mx-auto px-6 lg:px-12 min-h-screen flex flex-col justify-between">
      <div>
        {/* Title Banner */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10 border-b hairline-border-b pb-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 bg-[#8B1E1E]" />
              <span className="font-mono text-[11px] text-[#8A8A8F] tracking-[0.2em] font-semibold uppercase">
                SCREEN 02 — INSTITUTIONAL COVERAGE DIRECTORY
              </span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-medium text-[#F2F0EA]">
              Search Covered Companies
            </h1>
            <p className="font-sans text-sm font-light text-[#A1A1AA] leading-loose tracking-wide mt-4 max-w-2xl border-l-2 border-[#8B1E1E] pl-4">
              Select any benchmark equity below to launch its 3-statement financial model, dynamic DCF valuation, footnote forensic breakdown, and live target price recalculations.
            </p>
          </div>

          <div className="font-mono text-[11px] text-[#8A8A8F] border border-[#222228] bg-[#111114] px-4 py-3 flex items-center gap-3 uppercase tracking-widest shadow-md">
            <Building2 className="w-4 h-4 text-[#8B1E1E]" />
            <span>COVERAGE: <strong className="text-[#F2F0EA]">ANY LISTED COMPANY</strong></span>
          </div>
        </div>

        {/* Any-company lookup — the directory below is only what has been
            opened before; anything listed anywhere can be modelled on demand. */}
        <div className="bg-[#111114] border hairline-border p-6 sm:p-8 mb-6 shadow-lg">
          <div className="font-mono text-[11px] text-[#8A8A8F] uppercase tracking-[0.2em] mb-3">
            Model any listed company
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={lookupQuery}
              onChange={(e) => setLookupQuery(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && lookupQuery.trim()) onLookupTicker(lookupQuery.trim());
              }}
              placeholder="Enter a ticker — AAPL, NVDA, RELIANCE.NS, BP.L"
              className="flex-grow bg-transparent border hairline-border focus:border-[#8B1E1E] text-[#F2F0EA] font-mono text-sm px-4 py-3 outline-none placeholder:text-[#8A8A8F] transition-colors"
            />
            <button
              onClick={() => lookupQuery.trim() && onLookupTicker(lookupQuery.trim())}
              disabled={lookupState.loading}
              className="bg-[#8B1E1E] text-[#F2F0EA] font-mono text-xs px-6 py-3 uppercase tracking-wider hover:bg-[#6a1515] transition-colors cursor-pointer font-semibold disabled:opacity-50 whitespace-nowrap"
            >
              {lookupState.loading ? 'Building model…' : 'Build model'}
            </button>
          </div>

          <div className="font-mono text-[10px] text-[#8A8A8F] mt-3 leading-relaxed uppercase tracking-wider">
            US filings come from SEC EDGAR. Companies listed elsewhere need their
            exchange suffix — .NS for India, .L for London, .TO for Toronto.
          </div>

          {lookupState.error && (
            <div className="mt-4 border border-[#8B1E1E]/50 bg-[#8B1E1E]/10 px-4 py-3 font-mono text-[11px] text-[#F2F0EA] leading-relaxed">
              {lookupState.error}
            </div>
          )}
        </div>

        {/* Search Bar & Sector Filter Controls */}
        <div className="bg-[#111114] border hairline-border p-6 sm:p-8 mb-10 space-y-6 shadow-lg">
          <div className="relative flex items-center w-full">
            <Search className="w-5 h-5 absolute left-5 text-[#8A8A8F]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ticker (e.g. AAPL, NVDA, META), company name, or ISIN..."
              className="w-full bg-[#0B0B0D] border hairline-border focus:border-[#8B1E1E] text-[#F2F0EA] font-mono text-sm pl-14 pr-10 py-5 outline-none placeholder:text-[#52525B] transition-colors rounded-none shadow-inner"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-5 text-[#8A8A8F] hover:text-[#F2F0EA] cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Sector Filter Chips */}
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t hairline-border-t">
            <span className="font-mono text-[10px] text-[#8A8A8F] mr-2 flex items-center gap-2 uppercase tracking-widest">
              <Filter className="w-3.5 h-3.5 text-[#8B1E1E]" /> SECTOR FILTER:
            </span>
            {sectors.map((sec) => (
              <button
                key={sec}
                onClick={() => setSelectedSector(sec)}
                className={`font-mono text-[11px] uppercase tracking-wider px-4 py-1.5 transition-all cursor-pointer ${
                  selectedSector === sec
                    ? 'bg-[#8B1E1E] text-[#F2F0EA] font-semibold shadow-[0_0_10px_rgba(139,30,30,0.4)]'
                    : 'bg-[#0B0B0D] text-[#A1A1AA] border hairline-border hover:bg-[#222228] hover:text-[#F2F0EA]'
                }`}
              >
                {sec}
              </button>
            ))}
          </div>
        </div>

        {/* Company Grid Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {filteredCompanies.map((comp) => {
            const isSelected = comp.ticker === selectedTicker;

            return (
              <div
                key={comp.ticker}
                onClick={() => onSelectCompany(comp.ticker)}
                className={`p-8 border hairline-border bg-[#111114] hover:bg-[#18181c] group cursor-pointer transition-all duration-300 relative flex flex-col justify-between min-h-[280px] shadow-lg ${
                  isSelected ? 'ring-1 ring-[#8B1E1E] border-l-4 border-l-[#8B1E1E]' : 'border-l-4 border-l-transparent hover:border-l-[#222228]'
                }`}
              >
                {/* Crosshair accents */}
                <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#222228] opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#222228] opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#222228] opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#222228] opacity-0 group-hover:opacity-100 transition-opacity" />

                <div>
                  <div className="flex justify-between items-start mb-5">
                    <div>
                      <div className="font-mono text-3xl font-bold text-[#F2F0EA] flex items-center gap-3 tracking-tight">
                        <span>{comp.ticker}</span>
                        <span className="font-mono text-[9px] text-[#A1A1AA] tracking-widest font-normal border border-[#222228] px-2 py-0.5 uppercase bg-[#0B0B0D]">
                          {comp.exchange}
                        </span>
                      </div>
                      <div className="font-sans text-sm font-light text-[#A1A1AA] tracking-wide mt-1">{comp.name}</div>
                    </div>

                    <div className="text-right">
                      <div className="font-mono text-xl font-bold text-[#F2F0EA] tracking-tight">
                        {comp.currencySymbol}{comp.price.toFixed(2)}
                      </div>
                      <div
                        className={`font-mono text-[11px] tracking-wider font-semibold mt-1 ${
                          comp.priceChangePct >= 0 ? 'text-emerald-500' : 'text-[#8B1E1E]'
                        }`}
                      >
                        {comp.priceChangePct >= 0 ? '+' : ''}{comp.priceChangePct}%
                      </div>
                    </div>
                  </div>

                  <p className="font-sans text-xs font-light text-[#A1A1AA] leading-loose tracking-wide line-clamp-2 mb-6">
                    {comp.description}
                  </p>

                  <div className="grid grid-cols-2 gap-3 font-mono text-[9px] uppercase tracking-widest text-[#8A8A8F] bg-[#0B0B0D] p-4 border hairline-border">
                    <div>Cap: <strong className="text-[#F2F0EA] font-semibold">{comp.marketCapStr}</strong></div>
                    <div>Sector: <strong className="text-[#F2F0EA] font-semibold">{comp.sector}</strong></div>
                    <div>ROE: <strong className="text-[#F2F0EA] font-semibold">{comp.roePct}%</strong></div>
                    <div>Op Margin: <strong className="text-[#F2F0EA] font-semibold">{comp.opMarginPct}%</strong></div>
                  </div>
                </div>

                <div className="flex justify-between items-center border-t hairline-border-t pt-5 mt-6">
                  <span className="font-mono text-[9px] tracking-widest uppercase text-[#8A8A8F]">ISIN: {comp.isin}</span>
                  <button className="font-mono text-[10px] text-[#8B1E1E] group-hover:text-[#F2F0EA] tracking-widest font-semibold uppercase flex items-center gap-2 transition-colors duration-300">
                    <span>Open Financial Model</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {filteredCompanies.length === 0 && (
          <div className="text-center py-24 bg-[#111114] border hairline-border p-8 shadow-inner">
            <div className="font-mono text-sm text-[#A1A1AA] tracking-wide mb-2">
              No companies matching query <span className="text-[#F2F0EA]">"{searchQuery}"</span>.
            </div>
            <div className="font-sans text-xs font-light text-[#8A8A8F] tracking-wide">
              Try searching for established coverage tickers like AAPL, META, or NVDA.
            </div>
          </div>
        )}
      </div>

      <div className="pt-8 border-t hairline-border-t flex justify-between items-center font-mono text-[10px] text-[#8A8A8F] uppercase tracking-widest mt-12">
        <button
          onClick={onBackToHome}
          className="text-[#8A8A8F] hover:text-[#F2F0EA] flex items-center gap-2 transition-colors cursor-pointer"
        >
          <span>←</span> Return to Intro & Philosophy
        </button>
        <span>MARGINALIA SEARCH ENGINE V4.2</span>
      </div>
    </div>
  );
};