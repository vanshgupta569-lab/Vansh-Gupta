// FILE: src/components/MethodologyGrid.tsx
import React, { useRef } from 'react';
import { Database, Sliders, Cpu, Calculator, ArrowRight } from 'lucide-react';
import { motion, useScroll, useTransform } from 'motion/react';

interface MethodologyGridProps {
  onSelectStep: (stepNumber: number) => void;
}

const PIPELINE_STEPS = [
  {
    phase: 'PHASE 01',
    title: 'Ticker Lookup & Data Ingestion',
    subtitle: 'User Selection & SEC/Exchange Record Retrieval',
    description: 'When a user selects an equity ticker from the directory, the platform instantly queries structured financial databases to pull up to five years of the exact filed financial statements. SEC filers normally provide five; some international sources carry four, and whatever exists is used rather than failing. US companies come from SEC EDGAR, while international listings use exchange suffixes (.NS for India, .L for London, .TO for Toronto). No estimates or approximations are introduced at this ingestion stage.',
    icon: Database,
    detail: 'Pulls raw Balance Sheets, Income Statements, and Cash Flow schedules directly from primary regulatory filings as reported.',
  },
  {
    phase: 'PHASE 02',
    title: 'Uniform Assumption Architecture',
    subtitle: 'Normalized Modeling Framework',
    description: 'The fetched history feeds into a standardized 3-statement projection engine. Every forecast line item is driven by transparent, named assumptions, including revenue growth, operating margins, effective tax rates, and CapEx intensity.',
    icon: Sliders,
    detail: 'Users retain full interactive control to override default parameters via live terminal sliders in real time.',
  },
  {
    phase: 'PHASE 03',
    title: 'Free Cash Flow & Working Capital Mechanics',
    subtitle: 'Unlevered Free Cash Flow (UFCF) Derivation',
    description: 'The engine computes Net Operating Profit After Tax (NOPAT/EBIAT), adds back Depreciation & Amortization, and subtracts capital expenditures and net working capital changes to arrive at pristine Unlevered Free Cash Flows across a 5-year explicit horizon.',
    icon: Cpu,
    detail: 'Balance sheet schedules balance programmatically in every single projected forecast year without exceptions.',
  },
  {
    phase: 'PHASE 04',
    title: 'Dual-Method Intrinsic Valuation',
    subtitle: 'Perpetuity Growth & EV/EBITDA Exit Multiples',
    description: 'To calculate terminal value and final intrinsic equity value, the engine employs two institutional standards: (1) The Gordon Growth Perpetuity Method based on long-term macroeconomic benchmarks, and (2) The EV/EBITDA Exit Multiple Method. Both discount future cash flows back using the Weighted Average Cost of Capital (WACC).',
    icon: Calculator,
    detail: 'Outputs a dynamic 5×5 sensitivity matrix demonstrating valuation variations across WACC and growth bands with zero buy/sell verdicts attached.',
  },
];

export const MethodologyGrid: React.FC<MethodologyGridProps> = ({ onSelectStep }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start center", "end center"]
  });
  
  const lineHeight = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <section id="methodology" className="max-w-[1440px] mx-auto px-6 lg:px-12 py-24 hairline-border-b">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-16 gap-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 bg-[#8B1E1E]" />
            <span className="font-mono text-[11px] text-[#A1A1AA] tracking-[0.2em] uppercase">
              02 — ENGINE MECHANICS & METHODOLOGY
            </span>
          </div>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl text-[#F2F0EA] font-medium tracking-tight">
            From Raw Filing to Intrinsic Value
          </h2>
        </div>
        <p className="font-mono text-xs text-[#8A8A8F] max-w-md uppercase tracking-wider leading-relaxed">
          An end-to-end breakdown of how Marginalia transforms public disclosures into a live, institutional-grade discounted cash flow model.
        </p>
      </div>

      <div ref={containerRef} className="relative space-y-8 mb-16">
        
        {/* Animated Connecting Vertical Line */}
        <div className="hidden lg:block absolute top-8 bottom-8 left-[39px] w-[1px] bg-[#222228] z-0">
          <motion.div 
            style={{ height: lineHeight }} 
            className="w-full bg-[#8B1E1E] shadow-[0_0_15px_rgba(139,30,30,0.8)]" 
          />
        </div>

        {PIPELINE_STEPS.map((step, index) => {
          const IconComponent = step.icon;

          return (
            <motion.div
              key={step.phase}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, ease: "easeOut", delay: index * 0.1 }}
              onClick={() => onSelectStep(index + 1)}
              className="relative z-15 bg-[#111114] border hairline-border p-8 sm:p-12 hover:bg-[#16161a] transition-all group shadow-lg cursor-pointer"
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* Phase Number & Icon Column */}
                <div className="lg:col-span-3 flex items-center lg:items-start gap-4">
                  <div className="w-14 h-14 bg-[#0B0B0D] border hairline-border flex items-center justify-center shrink-0 group-hover:border-[#8B1E1E] transition-colors shadow-inner">
                    <IconComponent className="w-6 h-6 text-[#8B1E1E]" />
                  </div>
                  <div>
                    <span className="font-mono text-[11px] text-[#8B1E1E] tracking-[0.2em] font-semibold uppercase block mb-1">
                      {step.phase}
                    </span>
                    <span className="font-mono text-[10px] text-[#8A8A8F] uppercase tracking-wider block">
                      {step.subtitle}
                    </span>
                  </div>
                </div>

                {/* Content Column */}
                <div className="lg:col-span-9 flex flex-col justify-between space-y-4">
                  <h3 className="font-display text-2xl sm:text-3xl text-[#F2F0EA] tracking-tight group-hover:text-[#ffb3ad] transition-colors flex items-center justify-between">
                    <span>{step.title}</span>
                    <ArrowRight className="w-4 h-4 text-[#8B1E1E] opacity-0 group-hover:opacity-100 transition-all -translate-x-4 group-hover:translate-x-0" />
                  </h3>

                  <p className="font-sans text-sm sm:text-base font-light text-[#A1A1AA] leading-loose tracking-wide">
                    {step.description}
                  </p>

                  <div className="font-mono text-[10px] text-[#8A8A8F] pt-4 hairline-border-t border-dashed flex items-start gap-3 uppercase tracking-wider leading-relaxed">
                    <span className="w-1.5 h-1.5 bg-[#8B1E1E] shrink-0 mt-1.5" />
                    <span>{step.detail}</span>
                  </div>
                </div>

              </div>
            </motion.div>
          );
        })}

      </div>

      {/* Famous Quote Banner (Text-Only Editorial Style) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="bg-[#111114] border hairline-border p-8 sm:p-12 relative overflow-hidden shadow-xl"
      >
        <div className="absolute top-0 right-0 w-48 h-48 bg-[#8B1E1E]/5 rounded-bl-full pointer-events-none" />

        <div className="max-w-3xl space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-[#8B1E1E]" />
            <span className="font-mono text-[11px] text-[#8B1E1E] tracking-[0.25em] uppercase font-semibold">
              PHILOSOPHICAL BENCHMARK
            </span>
          </div>
          <blockquote className="font-display text-2xl sm:text-3xl italic text-[#F2F0EA] leading-snug">
            “I would rather be vaguely right than precisely wrong.”
          </blockquote>
          <p className="font-mono text-xs text-[#8A8A8F] uppercase tracking-wider">
            — John Maynard Keynes <span className="text-[#6E6E73]">(Foundational Economist)</span>
          </p>
        </div>
      </motion.div>
    </section>
  );
};