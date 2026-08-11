import React from 'react';
import { BookOpen, BookmarkCheck, Shield } from 'lucide-react';

export const EtymologySection: React.FC = () => {
  return (
    <section id="etymology" className="bg-[#111114] hairline-border-b py-20">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
        <div className="mb-16">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 bg-[#8B1E1E]" />
            <span className="font-mono text-[11px] text-[#dfbfbc] tracking-[0.2em] uppercase">
              01 — PHILOSOPHY & ETYMOLOGY
            </span>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-6">
            <div>
              <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl text-[#F2F0EA] font-medium">
                The Meaning of Marginalia
              </h2>
              <div className="font-mono text-sm text-[#8B1E1E] font-semibold tracking-wider uppercase mt-2 flex items-center gap-2">
                <span>OUR PURPOSE:</span>
                <span className="bg-[#8B1E1E]/10 border border-[#8B1E1E]/40 text-[#F2F0EA] px-3 py-1 font-serif italic text-base capitalize">
                  "A ledger that never lies."
                </span>
              </div>
            </div>

            <div className="font-mono text-xs text-[#8A8A8F] border-l-2 border-[#8B1E1E] pl-4 max-w-sm">
              <strong className="text-[#F2F0EA] block">mar·gi·na·li·a</strong>
              <span className="italic">noun</span> /ˌmɑːrdʒɪˈneɪliə/ — Notes, commentary, and critical disclosures written in the margins of a text.
            </div>
          </div>

          <p className="font-sans text-base sm:text-lg text-[#dfbfbc] max-w-4xl leading-relaxed bg-[#0B0B0D] p-6 border hairline-border">
            In corporate financial reporting, headline metrics and glossed pitch decks rarely tell the full story. The true economic condition of an enterprise is recorded deep within the footnote disclosures, audit commentaries, and balance sheet adjustments — the financial <strong>marginalia</strong>. Our singular purpose is to parse these critical disclosures and present <strong>a ledger that never lies</strong>.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-8 border hairline-border bg-[#0B0B0D] hover:bg-[#111114] transition-colors group">
            <div className="w-12 h-12 bg-[#8B1E1E]/10 border border-[#8B1E1E]/30 flex items-center justify-center mb-6 group-hover:border-[#8B1E1E] transition-colors">
              <BookOpen className="w-6 h-6 text-[#8B1E1E]" />
            </div>
            <h3 className="font-display text-xl sm:text-2xl mb-3 text-[#F2F0EA]">
              Notes in the Margins
            </h3>
            <p className="font-sans text-sm text-[#8A8A8F] leading-relaxed">
              Every model starts from what companies actually reported: filed income statements, balance sheets and cash flow statements. No numbers are invented; if a figure isn't in the filing, it isn't in the model.
            </p>
          </div>

          <div className="p-8 border hairline-border bg-[#0B0B0D] hover:bg-[#111114] transition-colors group">
            <div className="w-12 h-12 bg-[#8B1E1E]/10 border border-[#8B1E1E]/30 flex items-center justify-center mb-6 group-hover:border-[#8B1E1E] transition-colors">
              <BookmarkCheck className="w-6 h-6 text-[#8B1E1E]" />
            </div>
            <h3 className="font-display text-xl sm:text-2xl mb-3 text-[#F2F0EA]">
              Assumptions in Plain Sight
            </h3>
            <p className="font-sans text-sm text-[#8A8A8F] leading-relaxed">
              Every forecast number is driven by a named, visible assumption — revenue growth, gross margin, WACC, terminal growth rate. Nothing is hidden inside a black box. Change an assumption and watch every downstream figure recalculate instantly.
            </p>
          </div>

          <div className="p-8 border hairline-border bg-[#0B0B0D] hover:bg-[#111114] transition-colors group">
            <div className="w-12 h-12 bg-[#8B1E1E]/10 border border-[#8B1E1E]/30 flex items-center justify-center mb-6 group-hover:border-[#8B1E1E] transition-colors">
              <Shield className="w-6 h-6 text-[#8B1E1E]" />
            </div>
            <h3 className="font-display text-xl sm:text-2xl mb-3 text-[#F2F0EA]">
              Reported vs. Modelled
            </h3>
            <p className="font-sans text-sm text-[#8A8A8F] leading-relaxed">
              Historical figures are clearly separated from forecast figures. The model tells you what a set of assumptions implies — not what will happen. The distance between the model's implied value and the market price is shown without a verdict attached.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
