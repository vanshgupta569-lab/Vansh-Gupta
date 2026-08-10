import React, { useState } from 'react';
import { ArrowRight, Calculator, FileSpreadsheet, Search, Sparkles } from 'lucide-react';

interface MethodologyGridProps {
  onSelectStep: (stepNumber: number) => void;
}

const METHODOLOGY_STEPS = [
  {
    step: 'STEP 1',
    title: 'Open a Ticker',
    description: 'Initiate deep-dive analysis on specific equities with instantaneous data retrieval, ISIN resolution, and live market pricing.',
    icon: Search,
    detail: 'Retrieves multi-year GAAP 10-K & 10-Q filings, consensus estimates, and share count changes in <200ms.',
  },
  {
    step: 'STEP 2',
    title: 'Read the Market First',
    description: 'Synthesize prevailing sentiment, analyst consensus estimates, and live pricing context before diving into fundamentals.',
    icon: Sparkles,
    detail: 'Parses institutional buy/hold/sell spreads, macro rate implications, and pricing momentum badges.',
  },
  {
    step: 'STEP 3',
    title: 'Filings Become Numbers',
    description: 'Transform dense SEC 10-Ks and 10-Qs into structured, comparable 3-statement financial models and cash flow statement bridges.',
    icon: FileSpreadsheet,
    detail: 'Automated normalization of non-recurring items, stock-based compensation capitalization, and lease amortization.',
  },
  {
    step: 'STEP 4',
    title: 'Run Forensics & DCF',
    description: 'Apply proprietary screens to uncover anomalies, red flags, and calculate dynamic Enterprise Value and Target Prices.',
    icon: Calculator,
    detail: 'Real-time WACC, CapEx, Tax Rate, and Terminal Growth parameter adjustments with instant DCF sensitivity output.',
  },
];

export const MethodologyGrid: React.FC<MethodologyGridProps> = ({ onSelectStep }) => {
  const [activeStepHover, setActiveStepHover] = useState<number | null>(null);

  return (
    <section id="methodology" className="max-w-[1440px] mx-auto px-6 lg:px-12 py-20 hairline-border-b">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 bg-[#8B1E1E]" />
            <span className="font-mono text-[11px] text-[#dfbfbc] tracking-[0.2em] uppercase">
              02 - PROCESS FLOWCHART
            </span>
          </div>
          <h2 className="font-display text-3xl sm:text-4xl text-[#F2F0EA] font-medium">
            3-Statement Valuation Process
          </h2>
        </div>
        <p className="font-mono text-xs text-[#8A8A8F] max-w-md">
          A systematic, four-stage quantitative funnel designed for institutional analysts and forensic investors.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 border hairline-border bg-[#0B0B0D]">
        {METHODOLOGY_STEPS.map((item, index) => {
          const IconComponent = item.icon;
          const isRightCol = index % 2 === 1;
          const isBottomRow = index >= 2;

          return (
            <div
              key={item.step}
              onMouseEnter={() => setActiveStepHover(index)}
              onMouseLeave={() => setActiveStepHover(null)}
              onClick={() => onSelectStep(index + 1)}
              className={`p-8 sm:p-12 hover:bg-[#111114] transition-all min-h-[260px] flex flex-col justify-between group cursor-pointer relative ${
                !isRightCol ? 'md:hairline-border-r' : ''
              } ${!isBottomRow ? 'hairline-border-b' : ''}`}
            >
              <div>
                <div className="flex justify-between items-center mb-6">
                  <span className="font-mono text-[11px] text-[#8B1E1E] tracking-widest font-semibold">
                    {item.step}
                  </span>
                  <div className="w-8 h-8 bg-[#222228]/50 border hairline-border flex items-center justify-center group-hover:border-[#8B1E1E] transition-colors">
                    <IconComponent className="w-4 h-4 text-[#8A8A8F] group-hover:text-[#F2F0EA]" />
                  </div>
                </div>

                <h3 className="font-display text-2xl text-[#F2F0EA] mb-3 group-hover:text-[#ffb3ad] transition-colors flex items-center justify-between">
                  <span>{item.title}</span>
                  <ArrowRight className="w-4 h-4 text-[#8B1E1E] opacity-0 group-hover:opacity-100 transition-opacity translate-x-[-8px] group-hover:translate-x-0 transition-transform" />
                </h3>

                <p className="font-sans text-sm text-[#dfbfbc] leading-relaxed mb-4">
                  {item.description}
                </p>
              </div>

              <div className="font-mono text-[11px] text-[#8A8A8F] pt-4 hairline-border-t border-dashed flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-[#8B1E1E]" />
                <span>{item.detail}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
