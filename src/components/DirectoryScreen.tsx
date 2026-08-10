import React, { useState } from 'react';
import { CompanyData } from '../types';
import { Search, ArrowRight, Building2, TrendingUp, Sparkles, X, Filter } from 'lucide-react';

interface DirectoryScreenProps {
  companies: Record<string, CompanyData>;
  selectedTicker: string;
  onSelectCompany: (ticker: string) => void;
  onBackToHome: () => void;
}

export const DirectoryScreen: React.FC<DirectoryScreenProps> = ({
  companies,
  selectedTicker,
  onSelectCompany,
  onBackToHome,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
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
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2.5 h-2.5 bg-[#8B1E1E]" />
              <span className="font-mono text-[11px] text-[#8B1E1E] tracking-widest font-semibold uppercase">
                SCREEN 02 — INSTITUTIONAL COVERAGE DIRECTORY
              </span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-medium text-[#F2F0EA]">
              Search Covered Companies
            </h1>
            <p className="font-sans text-sm text-[#dfbfbc] mt-2 max-w-2xl">
              Select any benchmark equity below to launch its 3-statement financial model, dynamic DCF valuation, footnote forensic breakdown, and live target price recalculations.
            </p>
          </div>

          <div className="font-mono text-xs text-[#8A8A8F] border border-[#222228] bg-[#111114] px-4 py-2.5 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#8B1E1E]" />
            <span>COVERAGE: <strong>5 INSTITUTIONAL EQUITIES</strong></span>
          </div>
        </div>

        {/* Search Bar & Sector Filter Controls */}
        <div className="bg-[#111114] border hairline-border p-6 mb-10 space-y-6">
          <div className="relative flex items-center w-full">
            <Search className="w-5 h-5 absolute left-4 text-[#8A8A8F]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ticker (e.g. AAPL, NVDA, META), company name, or ISIN..."
              className="w-full bg-[#0B0B0D] border hairline-border focus:border-[#8B1E1E] text-[#F2F0EA] font-mono text-sm pl-12 pr-10 py-4 outline-none placeholder:text-[#8A8A8F] transition-colors rounded-none"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-4 text-[#8A8A8F] hover:text-[#F2F0EA] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Sector Filter Chips */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t hairline-border-t">
            <span className="font-mono text-[11px] text-[#8A8A8F] mr-2 flex items-center gap-1">
              <Filter className="w-3 h-3 text-[#8B1E1E]" /> SECTOR FILTER:
            </span>
            {sectors.map((sec) => (
              <button
                key={sec}
                onClick={() => setSelectedSector(sec)}
                className={`font-mono text-xs px-3 py-1 transition-all cursor-pointer ${
                  selectedSector === sec
                    ? 'bg-[#8B1E1E] text-[#F2F0EA] font-semibold'
                    : 'bg-[#0B0B0D] text-[#dfbfbc] border hairline-border hover:bg-[#222228]'
                }`}
              >
                {sec}
              </button>
            ))}
          </div>
        </div>

        {/* Company Grid Cards (Matching Screenshot 2 layout) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {filteredCompanies.map((comp) => {
            const isSelected = comp.ticker === selectedTicker;

            return (
              <div
                key={comp.ticker}
                onClick={() => onSelectCompany(comp.ticker)}
                className={`p-6 border hairline-border bg-[#111114] hover:bg-[#18181c] group cursor-pointer transition-all relative flex flex-col justify-between min-h-[260px] shadow-lg ${
                  isSelected ? 'ring-1 ring-[#8B1E1E] border-l-4 border-l-[#8B1E1E]' : ''
                }`}
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="font-mono text-2xl font-bold text-[#F2F0EA] flex items-center gap-2">
                        <span>{comp.ticker}</span>
                        <span className="font-mono text-[10px] text-[#8A8A8F] font-normal border border-[#222228] px-1.5 py-0.5">
                          {comp.exchange}
                        </span>
                      </div>
                      <div className="font-sans text-sm text-[#dfbfbc] mt-0.5 font-medium">{comp.name}</div>
                    </div>

                    <div className="text-right">
                      <div className="font-mono text-lg font-bold text-[#F2F0EA]">
                        {comp.currencySymbol}{comp.price.toFixed(2)}
                      </div>
                      <div
                        className={`font-mono text-xs font-semibold ${
                          comp.priceChangePct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {comp.priceChangePct >= 0 ? '+' : ''}{comp.priceChangePct}%
                      </div>
                    </div>
                  </div>

                  <p className="font-sans text-xs text-[#8A8A8F] leading-relaxed line-clamp-2 mb-4">
                    {comp.description}
                  </p>

                  <div className="grid grid-cols-2 gap-2 font-mono text-[10px] text-[#8A8A8F] bg-[#0B0B0D] p-3 border hairline-border">
                    <div>Cap: <strong className="text-[#F2F0EA]">{comp.marketCapStr}</strong></div>
                    <div>Sector: <strong className="text-[#F2F0EA]">{comp.sector}</strong></div>
                    <div>ROE: <strong className="text-[#F2F0EA]">{comp.roePct}%</strong></div>
                    <div>Op Margin: <strong className="text-[#F2F0EA]">{comp.opMarginPct}%</strong></div>
                  </div>
                </div>

                <div className="flex justify-between items-center border-t hairline-border-t pt-4 mt-6">
                  <span className="font-mono text-[10px] text-[#8A8A8F]">ISIN: {comp.isin}</span>
                  <button className="font-mono text-xs text-[#8B1E1E] group-hover:text-[#F2F0EA] font-semibold uppercase flex items-center gap-1 transition-colors">
                    <span>Open Financial Model</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {filteredCompanies.length === 0 && (
          <div className="text-center py-20 bg-[#111114] border hairline-border p-8 font-mono text-sm text-[#8A8A8F]">
            No companies matching query "{searchQuery}". Try searching "AAPL", "META", or "NVDA".
          </div>
        )}
      </div>

      <div className="pt-8 border-t hairline-border-t flex justify-between items-center font-mono text-xs text-[#8A8A8F]">
        <button
          onClick={onBackToHome}
          className="text-[#8A8A8F] hover:text-[#F2F0EA] underline cursor-pointer"
        >
          ← Return to Intro & Philosophy
        </button>
        <span>MARGINALIA SEARCH ENGINE V4.2</span>
      </div>
    </div>
  );
};
