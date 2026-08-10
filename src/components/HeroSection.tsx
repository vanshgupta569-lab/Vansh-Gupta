import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowDown, Search, ArrowUpRight } from 'lucide-react';

interface HeroSectionProps {
  onSearchCompany: () => void;
}

const HERO_SLIDES = [
  {
    tag: 'INSTITUTIONAL STANDARD',
    title: 'Institutional Research. Rebuilt.',
    subtitle: 'Eliminating the distance between raw data and actionable signal.',
    detail: 'Automated 10-K and 10-Q forensic audit engines parsing non-GAAP adjustments, off-balance sheet lease obligations, and deferred tax asset divergences.',
  },
  {
    tag: 'FORENSIC PRECISION',
    title: 'Footnotes Uncovered. Edge Quantified.',
    subtitle: 'Where conventional consensus fails, forensic accrual models deliver alpha.',
    detail: 'Continuous tracking of inventory build vs sales velocity, working capital distortions, and revenue recognition velocity.',
  },
  {
    tag: 'DETERMINISTIC VALUATION',
    title: 'Dynamic DCF Engine. Live Assumptions.',
    subtitle: '3-statement integrated financial modeling driven by scenario parameters.',
    detail: 'Adjust WACC, tax rates, terminal growth, and operating margins with immediate recalculation of fair enterprise values.',
  },
];

export const HeroSection: React.FC<HeroSectionProps> = ({ onSearchCompany }) => {
  const [activeSlide, setActiveSlide] = useState(0);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      setRotation(scrollY * 0.15);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const slide = HERO_SLIDES[activeSlide];

  return (
    <section id="hero" className="pt-28 lg:pt-36 pb-20 max-w-[1440px] mx-auto px-6 lg:px-12 hairline-border-b min-h-[680px] flex flex-col justify-between">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        
        {/* Left Column - Scroll-driven Slide content */}
        <div className="lg:col-span-6 flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 bg-[#8B1E1E]" />
            <span className="font-mono text-[11px] text-[#dfbfbc] tracking-[0.2em] uppercase">
              {slide.tag}
            </span>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeSlide}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col gap-5"
            >
              <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-semibold leading-[1.1] tracking-tight text-[#F2F0EA]">
                {slide.title}
              </h1>

              <p className="font-sans text-lg lg:text-xl text-[#dfbfbc] max-w-xl border-l-2 border-[#8B1E1E] pl-6 py-1 leading-relaxed">
                {slide.subtitle}
              </p>

              <p className="font-mono text-xs text-[#8A8A8F] max-w-lg leading-relaxed mt-1">
                {slide.detail}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Slide Indicator Dots & Navigation */}
          <div className="flex items-center gap-6 mt-4 pt-4 hairline-border-t">
            <div className="flex gap-2">
              {HERO_SLIDES.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveSlide(idx)}
                  className={`h-1 transition-all cursor-pointer ${
                    activeSlide === idx ? 'w-10 bg-[#8B1E1E]' : 'w-3 bg-[#222228] hover:bg-[#8A8A8F]'
                  }`}
                  aria-label={`Slide ${idx + 1}`}
                />
              ))}
            </div>

            <button
              onClick={onSearchCompany}
              className="bg-[#8B1E1E] text-[#F2F0EA] font-mono text-xs px-5 py-2.5 uppercase tracking-wider hover:bg-[#6a1515] transition-colors flex items-center gap-2 cursor-pointer ml-auto font-semibold shadow-lg"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Search Company</span>
              <ArrowUpRight className="w-3 h-3 text-[#F2F0EA]/80" />
            </button>
          </div>
        </div>

        {/* Center Graphic Column - Smooth Geometric SVG Animation */}
        <div className="lg:col-span-4 relative h-80 sm:h-96 w-full flex items-center justify-center">
          <div className="relative w-72 h-80 flex items-center justify-center">
            
            {/* Outer Box with Hairline Border */}
            <div className="absolute inset-0 hairline-border p-4 bg-[#111114]/40 flex items-center justify-center">
              
              {/* Concentric Rotating Rings */}
              <motion.div
                style={{ rotate: rotation }}
                className="w-64 h-64 border hairline-border rounded-full flex items-center justify-center relative"
              >
                {/* Secondary Pulsing Ring */}
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                  className="w-48 h-48 border border-[#8B1E1E]/40 rounded-full flex items-center justify-center"
                >
                  <div className="w-32 h-32 border border-[#8B1E1E]/70 rounded-full flex items-center justify-center">
                    
                    {/* Inner Solid Red Center */}
                    <motion.div
                      animate={{ opacity: [0.7, 1, 0.7] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="w-16 h-16 bg-[#8B1E1E] shadow-[0_0_30px_rgba(139,30,30,0.5)] flex items-center justify-center cursor-pointer"
                      onClick={onSearchCompany}
                    >
                      <div className="w-4 h-4 bg-[#F2F0EA]" />
                    </motion.div>
                  </div>
                </motion.div>

                {/* Radar Line Sweep */}
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                  className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-gradient-to-b from-[#8B1E1E] via-transparent to-transparent origin-center"
                />
              </motion.div>

              {/* Corner Grid Crosshairs */}
              <span className="absolute top-2 left-2 font-mono text-[9px] text-[#8A8A8F]">+0.00</span>
              <span className="absolute top-2 right-2 font-mono text-[9px] text-[#8A8A8F]">SEC 10-K</span>
              <span className="absolute bottom-2 left-2 font-mono text-[9px] text-[#8A8A8F]">VAL: DCF</span>
              <span className="absolute bottom-2 right-2 font-mono text-[9px] text-[#8B1E1E] animate-pulse">● LIVE</span>
            </div>
          </div>
        </div>

        {/* Right Column - Key Quant Stats Bar */}
        <div className="lg:col-span-2 flex lg:flex-col gap-8 justify-center border-l hairline-border-l pl-8 py-2">
          <div>
            <div className="font-mono text-3xl font-semibold text-[#8B1E1E] mb-1">09</div>
            <div className="font-mono text-[10px] text-[#8A8A8F] uppercase tracking-wider">SECTIONS PARSED</div>
          </div>
          <div className="hairline-border-t pt-4">
            <div className="font-mono text-3xl font-semibold text-[#8B1E1E] mb-1">20</div>
            <div className="font-mono text-[10px] text-[#8A8A8F] uppercase tracking-wider">KEY RATIOS</div>
          </div>
          <div className="hairline-border-t pt-4">
            <div className="font-mono text-3xl font-semibold text-[#8B1E1E] mb-1">130+</div>
            <div className="font-mono text-[10px] text-[#8A8A8F] uppercase tracking-wider">CITATIONS</div>
          </div>
        </div>

      </div>

      {/* Down indicator */}
      <div className="flex justify-between items-center mt-12 pt-6 hairline-border-t text-xs font-mono text-[#8A8A8F]">
        <div className="flex items-center gap-2">
          <ArrowDown className="w-3.5 h-3.5 text-[#8B1E1E] animate-bounce" />
          <span>SCROLL TO EXPLORE METHODOLOGY & PLATFORM</span>
        </div>
        <div className="hidden sm:block text-[11px] text-[#8A8A8F]">
          FINANCIAL INTELLIGENCE TERMINAL — NO MOCK STUBS
        </div>
      </div>
    </section>
  );
};
