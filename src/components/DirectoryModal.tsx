import React, { useState } from 'react';
import { CompanyData } from '../types';
import { Search, X, Check, ArrowRight } from 'lucide-react';

interface DirectoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  companies: Record<string, CompanyData>;
  selectedTicker: string;
  onSelectTicker: (ticker: string) => void;
}

export const DirectoryModal: React.FC<DirectoryModalProps> = ({
  isOpen,
  onClose,
  companies,
  selectedTicker,
  onSelectTicker,
}) => {
  if (!isOpen) return null;

  const [searchQuery, setSearchQuery] = useState('');

  const filteredCompanies = (Object.values(companies) as CompanyData[]).filter(
    (c) =>
      c.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.isin.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.sector.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-[#0B0B0D]/95 backdrop-blur-md flex flex-col overflow-y-auto">
      {/* Directory Modal Header Bar */}
      <header className="fixed top-0 w-full z-10 bg-[#111114] hairline-border-b px-6 lg:px-12 h-20 flex items-center justify-between max-w-[1440px] mx-auto left-0 right-0">
        <div className="font-display text-2xl font-bold tracking-tight text-[#F2F0EA] italic">
          Marginalia Directory
        </div>

        <nav className="hidden md:flex gap-8 font-mono text-xs text-[#8A8A8F] uppercase">
          <span className="text-[#8B1E1E] font-semibold border-b border-[#8B1E1E] pb-0.5">
            Coverage Directory
          </span>
          <span>5 Institutional Equities</span>
        </nav>

        <button
          onClick={onClose}
          className="bg-[#8B1E1E] text-[#F2F0EA] font-mono text-xs px-4 py-2 hover:bg-[#6a1515] transition-colors flex items-center gap-2 uppercase tracking-wider cursor-pointer font-semibold"
        >
          <span>Close Directory</span>
          <X className="w-4 h-4" />
        </button>
      </header>

      {/* Main Content Area */}
      <div className="pt-32 pb-20 max-w-[1140px] mx-auto w-full px-6 flex-grow flex flex-col">
        {/* Search Bar */}
        <div className="max-w-3xl mx-auto w-full mb-12">
          <div className="relative flex items-center w-full">
            <Search className="w-5 h-5 absolute left-4 text-[#8A8A8F]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ticker, company name, or ISIN..."
              className="w-full bg-transparent border-b hairline-border focus:border-[#8B1E1E] text-[#F2F0EA] font-mono text-sm pl-12 pr-4 py-4 outline-none placeholder:text-[#8A8A8F] transition-colors rounded-none"
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
        </div>

        {/* Company Grid (Matching Screenshot 2 layout) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 border hairline-border bg-[#0B0B0D]">
          {filteredCompanies.map((comp) => {
            const isSelected = comp.ticker === selectedTicker;

            return (
              <div
                key={comp.ticker}
                onClick={() => {
                  onSelectTicker(comp.ticker);
                  onClose();
                }}
                className={`p-6 border hairline-border hover:bg-[#111114] group cursor-pointer transition-colors relative flex flex-col justify-between min-h-[220px] ${
                  isSelected ? 'border-l-4 border-l-[#8B1E1E] bg-[#111114]' : ''
                }`}
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="font-mono text-xl font-bold text-[#F2F0EA] flex items-center gap-2">
                        <span>{comp.ticker}</span>
                        {isSelected && (
                          <span className="font-mono text-[9px] bg-[#8B1E1E] text-white px-1.5 py-0.2">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <div className="font-sans text-xs text-[#8A8A8F] mt-0.5">{comp.name}</div>
                    </div>
                    <span
                      className={`w-2.5 h-2.5 block ${
                        isSelected ? 'bg-[#8B1E1E]' : 'bg-[#222228] group-hover:bg-[#8B1E1E]'
                      } transition-colors`}
                    />
                  </div>

                  <p className="font-sans text-[11px] text-[#8A8A8F] line-clamp-2 mt-2">
                    {comp.description}
                  </p>
                </div>

                <div className="flex justify-between items-end border-t hairline-border-t pt-4 mt-6">
                  <div className="font-mono text-[11px] text-[#8A8A8F]">
                    {comp.exchange} ({comp.currency})
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm font-semibold text-[#F2F0EA]">
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
              </div>
            );
          })}

          {/* Fill grid block for visual symmetry */}
          {filteredCompanies.length % 3 !== 0 && (
            <div className="p-6 border hairline-border bg-[#0B0B0D] hidden lg:flex items-center justify-center font-mono text-xs text-[#222228]">
              [END OF COVERAGE DIRECTORY]
            </div>
          )}
        </div>

        {filteredCompanies.length === 0 && (
          <div className="text-center py-16 font-mono text-sm text-[#8A8A8F]">
            No companies matching query "{searchQuery}". Try searching "AAPL", "Meta", or "Nvidia".
          </div>
        )}
      </div>
    </div>
  );
};
