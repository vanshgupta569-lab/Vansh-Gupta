import React from 'react';

export const FeedbackFormSection: React.FC = () => {
  return (
    <section id="about" className="bg-[#111114] border-t hairline-border-t py-20">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
        <div className="flex items-center gap-2 mb-8">
          <span className="w-2 h-2 bg-[#8B1E1E]" />
          <span className="font-figure text-[11px] text-[#dfbfbc] tracking-[0.2em] uppercase">
            04 — ABOUT THE ANALYST
          </span>
        </div>

        {/* Analyst Profile Card */}
        <div className="max-w-3xl mx-auto border hairline-border p-8 sm:p-12 bg-page relative">
          <div className="font-figure text-[11px] text-[#8A8A8F] uppercase tracking-widest mb-6 border-b hairline-border-b pb-4 flex justify-between items-center">
            {/* "VERIFIED LEAD", under a shield, is GONE (standing decision 7:
                no false or unverifiable claims). It was a credibility badge
                attached to nothing -- no document, no verifier, no claim
                stated. On a product whose whole proposition is that it never
                overstates, an unverifiable verification badge costs more than
                every other defect on this page put together. Nothing replaces
                it: the honest version of that corner is empty. */}
            <span>Analyst profile</span>
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