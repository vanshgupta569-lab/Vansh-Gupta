import React from 'react';
import { ShieldCheck } from 'lucide-react';

export const FeedbackFormSection: React.FC = () => {
  return (
    <section id="about" className="bg-[#111114] border-t hairline-border-t py-20">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
        <div className="flex items-center gap-2 mb-8">
          <span className="w-2 h-2 bg-[#8B1E1E]" />
          <span className="font-mono text-[11px] text-[#dfbfbc] tracking-[0.2em] uppercase">
            04 — ABOUT THE ANALYST
          </span>
        </div>

        {/* Analyst Profile Card */}
        <div className="max-w-3xl mx-auto border hairline-border p-8 sm:p-12 bg-[#0B0B0D] shadow-2xl relative">
          <div className="font-mono text-[11px] text-[#8A8A8F] uppercase tracking-widest mb-6 border-b hairline-border-b pb-4 flex justify-between items-center">
            <span>ANALYST PROFILE</span>
            <span className="text-[#8B1E1E] flex items-center gap-1.5 font-semibold">
              <ShieldCheck className="w-4 h-4" /> VERIFIED LEAD
            </span>
          </div>

          <h3 className="font-display text-3xl sm:text-4xl text-[#F2F0EA] mb-8 font-semibold">
            Vansh Deepak Gupta
          </h3>

          <div className="border-t hairline-border-t pt-8">
            <p className="font-display text-2xl sm:text-3xl text-[#F2F0EA] font-bold italic leading-relaxed text-left border-l-4 border-[#8B1E1E] pl-6 py-2">
              "Everything else about me, the numbers will tell you."
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};