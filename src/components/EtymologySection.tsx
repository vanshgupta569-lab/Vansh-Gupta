import React from 'react';
import { Eye, BarChart3, Scale, BookOpen, BookmarkCheck, Shield } from 'lucide-react';

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
              Extracting buried commitments, off-balance sheet lease obligations, capital capitalization velocity, and deferred tax shifts from SEC filing footnotes.
            </p>
          </div>

          <div className="p-8 border hairline-border bg-[#0B0B0D] hover:bg-[#111114] transition-colors group">
            <div className="w-12 h-12 bg-[#8B1E1E]/10 border border-[#8B1E1E]/30 flex items-center justify-center mb-6 group-hover:border-[#8B1E1E] transition-colors">
              <BookmarkCheck className="w-6 h-6 text-[#8B1E1E]" />
            </div>
            <h3 className="font-display text-xl sm:text-2xl mb-3 text-[#F2F0EA]">
              Unvarnished Ledger Truth
            </h3>
            <p className="font-sans text-sm text-[#8A8A8F] leading-relaxed">
              A commitment to mathematical integrity. Reconciling GAAP to non-GAAP distortions to build a pristine, unmanipulated representation of true earnings power.
            </p>
          </div>

          <div className="p-8 border hairline-border bg-[#0B0B0D] hover:bg-[#111114] transition-colors group">
            <div className="w-12 h-12 bg-[#8B1E1E]/10 border border-[#8B1E1E]/30 flex items-center justify-center mb-6 group-hover:border-[#8B1E1E] transition-colors">
              <Shield className="w-6 h-6 text-[#8B1E1E]" />
            </div>
            <h3 className="font-display text-xl sm:text-2xl mb-3 text-[#F2F0EA]">
              Auditability & Proof
            </h3>
            <p className="font-sans text-sm text-[#8A8A8F] leading-relaxed">
              Every data point, driver assumption, and DCF fair value line item links directly back to verified primary SEC disclosures with zero guesswork.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
