// FILE: src/components/MethodologyGrid.tsx
//
// How a filing becomes a value, in four steps.
//
// This section used to carry four dense paragraphs — NOPAT/EBIAT, "pristine
// Unlevered Free Cash Flows across a 5-year explicit horizon", and a footnote
// under each one set in UPPERCASE MONOSPACE, which is the hardest thing to
// read on any screen. The claims were all true and all correct; nobody was
// going to read them.
//
// The substance is kept and every sentence is rewritten in the language a
// reader actually uses. Nothing that was promised has been dropped: the
// filings are still unaltered, the assumptions are still named and movable,
// the balance sheet still balances, and there is still no verdict at the end.
// Those facts are what earns the site its claims, so they stay — they are
// simply said once each, plainly.
//
// The Keynes line closes the section, which is where it belongs: it is the
// argument for the whole method, not a decoration halfway down a page.

import React, { useRef } from 'react';
import { Database, Sliders, Cpu, Calculator, ArrowRight } from 'lucide-react';
import { motion, useScroll, useTransform } from 'motion/react';

interface MethodologyGridProps {
  onSelectStep: (stepNumber: number) => void;
}

const STEPS = [
  {
    phase: '01',
    title: 'The filings arrive',
    line: 'Up to five years of statements, read from the company’s own filings. Nothing is estimated at this stage, and nothing is adjusted.',
    icon: Database,
  },
  {
    phase: '02',
    title: 'The forecast is built',
    line: 'Every projected line is driven by one named assumption — growth, margin, tax rate, capital spending — and you can see and move all of them.',
    icon: Sliders,
  },
  {
    phase: '03',
    title: 'Profit becomes cash',
    line: 'Tax is taken off, depreciation is added back, and capital spending and working capital are subtracted. The balance sheet balances in every forecast year.',
    icon: Cpu,
  },
  {
    phase: '04',
    title: 'The value is worked out',
    line: 'Future cash is discounted back to today, two ways, and both are shown. What you get is a premium or a discount to the model — never a verdict.',
    icon: Calculator,
  },
];

export const MethodologyGrid: React.FC<MethodologyGridProps> = ({ onSelectStep }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start center', 'end center'],
  });

  const lineHeight = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);

  return (
    <section
      id="methodology"
      className="relative w-full"
      style={{
        background: '#0B0B0D',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        boxShadow: '0 -40px 80px rgba(0,0,0,0.45)',
      }}
    >
      <div className="max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16 py-20 lg:py-24">
        {/* Chapter mark, set to match the rebuilt sections above and below. */}
        <div className="mb-10 lg:mb-14">
          <div className="h-px w-14 mb-4" style={{ background: '#8B1E1E' }} />
          <div className="flex items-baseline gap-4 font-mono text-[13px] tracking-[0.22em] uppercase">
            <span style={{ color: '#C0453E' }}>04</span>
            <span style={{ color: '#A8A29A' }}>Methodology</span>
          </div>
        </div>

        <h2
          className="text-[34px] sm:text-[46px] lg:text-[60px] mb-16 lg:mb-20 max-w-[18ch]"
          style={{
            color: '#F2F0EA',
            fontFamily: "'Inter', sans-serif",
            fontWeight: 700,
            letterSpacing: '-0.04em',
            lineHeight: 0.98,
          }}
        >
          From a filing to a value{'\u2060'}
          <span
            className="inline-block align-baseline ml-[0.12em]"
            style={{ width: '0.16em', height: '0.16em', background: '#8B1E1E' }}
          />
        </h2>

        <div ref={containerRef} className="relative space-y-px mb-16">
          {/* The rule that fills as the reader moves down the four steps. */}
          <div
            className="hidden lg:block absolute top-10 bottom-10 left-[47px] w-px z-0"
            style={{ background: '#262521' }}
          >
            <motion.div style={{ height: lineHeight }} className="w-full" >
              <div className="w-full h-full" style={{ background: '#8B1E1E' }} />
            </motion.div>
          </div>

          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <motion.button
                key={step.phase}
                type="button"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: index * 0.08 }}
                onClick={() => onSelectStep(index + 1)}
                className="group relative z-10 w-full text-left p-7 lg:p-9 border transition-colors"
                style={{ background: '#111114', borderColor: '#262521' }}
              >
                <span
                  className="absolute inset-0 border opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                  style={{ borderColor: '#8B1E1E' }}
                />

                <div className="grid grid-cols-1 lg:grid-cols-[64px_1fr] gap-6 lg:gap-10 items-start">
                  <div
                    className="w-14 h-14 flex items-center justify-center shrink-0 border transition-colors group-hover:border-[#8B1E1E]"
                    style={{ background: '#0B0B0D', borderColor: '#262521' }}
                  >
                    <Icon className="w-5 h-5" style={{ color: '#8B1E1E' }} strokeWidth={1.5} />
                  </div>

                  <div>
                    <div className="flex items-baseline gap-4 mb-3">
                      <span
                        className="font-mono text-[13px] tracking-[0.2em]"
                        style={{ color: '#C0453E' }}
                      >
                        {step.phase}
                      </span>
                      <h3
                        className="flex-1 flex items-center justify-between gap-4 text-[22px] lg:text-[26px]"
                        style={{
                          color: '#F2F0EA',
                          fontFamily: "'Inter', sans-serif",
                          fontWeight: 700,
                          letterSpacing: '-0.03em',
                        }}
                      >
                        <span>{step.title}</span>
                        <ArrowRight
                          className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all -translate-x-3 group-hover:translate-x-0 shrink-0"
                          style={{ color: '#8B1E1E' }}
                        />
                      </h3>
                    </div>

                    <p
                      className="text-[16px] lg:text-[17px] leading-[1.6] max-w-[62ch]"
                      style={{ color: '#C6C1B7' }}
                    >
                      {step.line}
                    </p>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* The line that argues for the whole method, given the last word. */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="border p-8 sm:p-12"
          style={{ background: '#111114', borderColor: '#262521' }}
        >
          <blockquote
            className="font-serif text-[26px] sm:text-[34px] lg:text-[40px] italic leading-[1.24] max-w-[24ch]"
            style={{ color: '#F2F0EA', letterSpacing: '-0.018em' }}
          >
            &ldquo;I would rather be vaguely right than precisely wrong.&rdquo;
          </blockquote>
          <p
            className="font-mono text-[13px] uppercase tracking-[0.18em] mt-6"
            style={{ color: '#A8A29A' }}
          >
            John Maynard Keynes
          </p>
        </motion.div>
      </div>
    </section>
  );
};
