import React, { useState, useEffect } from 'react';
import { CompanyData } from '../types';
import { Search, ArrowRight, Building2, TrendingUp, Sparkles } from 'lucide-react';

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
  const [suggestions, setSuggestions] = useState<
    { ticker: string; name: string; exchange: string }[]
  >([]);

  // Look up matching companies as the user types. Debounced so a fast typist
  // doesn't fire a request per keystroke.
  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then((res) => res.json())
        .then((data) => {
          if (!cancelled) setSuggestions(data.results || []);
        })
        .catch(() => {
          if (!cancelled) setSuggestions([]);
        });
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  const companyList = Object.values(companies) as CompanyData[];


  // The grid below is the analyst-model shelf: only companies with a real,
  // hand-built data file. Everything else is reached through the search box.
  const filteredCompanies = companyList.filter((c) => c.engineBacked);

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
              Enter any listed ticker to build a 3-statement model and DCF from its own filings, then move the assumptions and watch the implied value recalculate.
            </p>
          </div>

          <div className="font-mono text-[11px] text-[#8A8A8F] border border-[#222228] bg-[#111114] px-4 py-3 flex items-center gap-3 uppercase tracking-widest shadow-md">
            <Building2 className="w-4 h-4 text-[#8B1E1E]" />
            <span>COVERAGE: <strong className="text-[#F2F0EA]">ANY LISTED COMPANY</strong></span>
          </div>
        </div>

        {/* One search box. Type a name or ticker, pick a match, and a model is
            built from that company's own filings. */}
        <div className="bg-[#111114] border hairline-border p-6 sm:p-8 mb-10 shadow-lg">
          <div className="relative flex items-center w-full">
            <Search className="w-5 h-5 absolute left-5 text-[#8A8A8F]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const first = suggestions[0];
                  if (first) onLookupTicker(first.ticker);
                  else if (searchQuery.trim()) onLookupTicker(searchQuery.trim().toUpperCase());
                }
                if (e.key === 'Escape') setSearchQuery('');
              }}
              placeholder="Search any listed company — Apple, Reliance, Nvidia, Tata Motors..."
              className="w-full bg-[#0B0B0D] border hairline-border focus:border-[#8B1E1E] text-[#F2F0EA] font-mono text-sm pl-14 pr-32 py-5 outline-none placeholder:text-[#52525B] transition-colors rounded-none shadow-inner"
              autoFocus
            />
            <button
              onClick={() => {
                const first = suggestions[0];
                if (first) onLookupTicker(first.ticker);
                else if (searchQuery.trim()) onLookupTicker(searchQuery.trim().toUpperCase());
              }}
              disabled={lookupState.loading || !searchQuery.trim()}
              className="absolute right-2 bg-[#8B1E1E] text-[#F2F0EA] font-mono text-[11px] px-5 py-3 uppercase tracking-wider hover:bg-[#6a1515] transition-colors cursor-pointer font-semibold disabled:opacity-40 whitespace-nowrap"
            >
              {lookupState.loading ? 'Building…' : 'Build model'}
            </button>
          </div>

          {/* Live suggestions as the user types */}
          {suggestions.length > 0 && (
            <div className="mt-3 border hairline-border bg-[#0B0B0D] divide-y divide-[#222228]">
              {suggestions.map((sug) => (
                <button
                  key={sug.ticker}
                  onClick={() => onLookupTicker(sug.ticker)}
                  className="w-full text-left px-5 py-3 hover:bg-[#18181c] transition-colors cursor-pointer flex items-center justify-between gap-4 group"
                >
                  <span className="flex items-center gap-4 min-w-0">
                    <span className="font-mono text-sm text-[#F2F0EA] font-semibold shrink-0">
                      {sug.ticker}
                    </span>
                    <span className="font-sans text-sm font-light text-[#A1A1AA] truncate">
                      {sug.name}
                    </span>
                  </span>
                  <span className="font-mono text-[9px] text-[#8A8A8F] uppercase tracking-widest shrink-0 flex items-center gap-3">
                    {sug.exchange}
                    <ArrowRight className="w-3.5 h-3.5 text-[#8B1E1E] opacity-0 group-hover:opacity-100 transition-opacity" />
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="font-mono text-[10px] text-[#8A8A8F] mt-3 leading-relaxed uppercase tracking-wider">
            US filings come from SEC EDGAR; everywhere else from exchange
            disclosures. Banks, insurers and lenders are shown without a DCF —
            discounted cash flow does not apply to them.
          </div>

          {lookupState.error && (
            <div className="mt-4 border border-[#8B1E1E]/50 bg-[#8B1E1E]/10 px-4 py-3 font-mono text-[11px] text-[#F2F0EA] leading-relaxed">
              {lookupState.error}
            </div>
          )}
        </div>

        {/* Analyst models — companies with a hand-built, verified data file */}
        <div className="mb-4 flex items-baseline justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 bg-[#8B1E1E]" />
              <span className="font-mono text-[11px] text-[#8A8A8F] tracking-[0.2em] uppercase">
                Analyst models
              </span>
            </div>
            <p className="font-sans text-sm font-light text-[#A1A1AA] max-w-2xl leading-relaxed">
              These companies have a model built by hand and reconciled to the
              filings line by line. Every other company is modelled automatically
              from its reported history — search for it above.
            </p>
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