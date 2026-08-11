import React, { useState } from 'react';
import { ArrowRight, Calculator, FileSpreadsheet, Search, BarChart2 } from 'lucide-react';

interface MethodologyGridProps {
  onSelectStep: (stepNumber: number) => void;
}

const METHODOLOGY_STEPS = [
  {
    step: 'STEP 1',
    title: 'Open a Ticker',
    description: 'Search covered companies and open their dashboard. Each company shows a live price, key metrics, and three years of audited reported financials pulled from official filings.',
    icon: Search,
    detail: 'Coverage currently spans five companies: AAPL, META, NVDA, RELIANCE, SPCX. More added as models are built and verified.',
  },
  {
    step: 'STEP 2',
    title: 'Read the Reported History',
    description: 'Three years of income statement, balance sheet and cash flow side by side. Figures are as reported — no adjustments, no estimates, no rounding. Revenue growth, margins, free cash flow and net debt are computed directly from those numbers.',
    icon: BarChart2,
    detail: 'Historical data is sourced from SEC filings (US companies) and exchange disclosures (Indian companies). Units are clearly labelled per company.',
  },
  {
    step: 'STEP 3',
    title: 'Inspect the Integrated Model',
    description: 'A full 3-statement model built on the reported history: income statement, balance sheet, cash flow, working capital schedule, PP&E schedule, debt schedule, and capital stock. Every forecast line is driven by a named assumption, not a black box.',
    icon: FileSpreadsheet,
    detail: 'The balance sheet is checked for balance in every year. Forecasts are clearly labelled — reported figures carry an "R" tag, modelled figures carry an "M" tag.',
  },
  {
    step: 'STEP 4',
    title: 'Run the DCF',
    description: 'Adjust WACC, terminal growth, revenue growth, operating margin, capex and tax rate with live sliders. Implied enterprise value, equity value and per-share intrinsic value recalculate instantly. A 5×5 sensitivity grid shows how the output moves across the full range of assumptions.',
    icon: Calculator,
    detail: 'Two terminal value methods: Gordon Growth perpetuity and EV/EBITDA exit multiple. The market price vs. model implied value gap is shown — no buy/sell verdict is made.',
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
              02 - HOW IT WORKS
            </span>
          </div>
          <h2 className="font-display text-3xl sm:text-4xl text-[#F2F0EA] font-medium">
            From Filing to Fair Value
          </h2>
        </div>
        <p className="font-mono text-xs text-[#8A8A8F] max-w-md">
          Four steps from raw reported data to a live, adjustable discounted cash flow model.
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
