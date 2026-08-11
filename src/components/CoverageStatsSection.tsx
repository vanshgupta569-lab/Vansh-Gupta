import React from 'react';

export const CoverageStatsSection: React.FC = () => {
  return (
    <section id="coverage" className="max-w-[1440px] mx-auto px-6 lg:px-12 py-20 hairline-border-b">
      <div className="flex items-center gap-2 mb-10">
        <span className="w-2 h-2 bg-[#8B1E1E]" />
        <span className="font-mono text-[11px] text-[#dfbfbc] tracking-[0.2em] uppercase">
          03 - CURRENT COVERAGE
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-8 border hairline-border bg-[#111114] p-8 sm:p-12">
        <div className="text-center p-4 border-r hairline-border-r last:border-r-0">
          <div className="font-display text-4xl sm:text-5xl lg:text-6xl text-[#8B1E1E] mb-2 font-semibold">
            5
          </div>
          <div className="font-mono text-[11px] text-[#dfbfbc] uppercase tracking-wider">
            Companies Covered
          </div>
          <div className="font-mono text-[10px] text-[#8A8A8F] mt-1">AAPL · META · NVDA · RELIANCE · SPCX</div>
        </div>

        <div className="text-center p-4 border-r hairline-border-r last:border-r-0">
          <div className="font-display text-4xl sm:text-5xl lg:text-6xl text-[#8B1E1E] mb-2 font-semibold">
            3 YRS
          </div>
          <div className="font-mono text-[11px] text-[#dfbfbc] uppercase tracking-wider">
            Historical Data
          </div>
          <div className="font-mono text-[10px] text-[#8A8A8F] mt-1">3 years of audited filed statements</div>
        </div>

        <div className="text-center p-4 border-r hairline-border-r last:border-r-0">
          <div className="font-display text-4xl sm:text-5xl lg:text-6xl text-[#8B1E1E] mb-2 font-semibold">
            8
          </div>
          <div className="font-mono text-[11px] text-[#dfbfbc] uppercase tracking-wider">
            Integrated Schedules
          </div>
          <div className="font-mono text-[10px] text-[#8A8A8F] mt-1">IS · BS · CF · WC · PP&E · Debt · Equity · DCF</div>
        </div>

        <div className="text-center p-4">
          <div className="font-display text-4xl sm:text-5xl lg:text-6xl text-[#8B1E1E] mb-2 font-semibold">
            ₹0 / $0
          </div>
          <div className="font-mono text-[11px] text-[#dfbfbc] uppercase tracking-wider">
            Zero Platform Cost
          </div>
          <div className="font-mono text-[10px] text-[#8A8A8F] mt-1">No subscription, no paywall</div>
        </div>
      </div>
    </section>
  );
};
