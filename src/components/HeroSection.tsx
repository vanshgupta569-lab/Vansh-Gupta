import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'motion/react';
import { ArrowDown, Search, ArrowUpRight } from 'lucide-react';

interface HeroSectionProps {
  onSearchCompany: () => void;
}

const HERO_SLIDES = [
  {
    tag: 'FILED DATA, NOT ESTIMATES',
    title: 'Real Financials. Live Models.',
    subtitle: 'Three years of audited income statements, balance sheets and cash flows — exactly as reported.',
    detail: 'Historical figures come from official filings. Nothing is estimated or adjusted. Forecast figures are clearly labelled and driven by named, adjustable assumptions.',
  },
  {
    tag: 'FULL 3-STATEMENT MODEL',
    title: 'Every Schedule. Every Line.',
    subtitle: 'Segment revenue, working capital, PP&E, debt and equity schedules — integrated and balance-checked.',
    detail: 'One shared calculation engine runs identically for every company. Each company is just a data file in the same schema. The balance sheet balances in every forecast year.',
  },
  {
    tag: 'LIVE DCF WITH SLIDERS',
    title: 'Adjust Assumptions. Watch It Move.',
    subtitle: 'WACC, terminal growth, margins and capex are sliders — the implied value recalculates instantly.',
    detail: 'Two terminal value methods: Gordon Growth perpetuity and EV/EBITDA exit multiple. A 5×5 sensitivity grid shows the range across WACC and growth assumptions.',
  },
];

export const HeroSection: React.FC<HeroSectionProps> = ({ onSearchCompany }) => {
  const [activeSlide, setActiveSlide] = useState(0);
  const containerRef = useRef<HTMLElement>(null);

  // Hook into the scroll position of the hero section for scroll-driven animations
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"]
  });

  // Map the mouse scroll progress to specific visual transformations
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const heroY = useTransform(scrollYProgress, [0, 0.8], [0, -80]);
  
  // Tie the rotation and scale of the geometric graphic strictly to the scroll wheel
  const radarRotation = useTransform(scrollYProgress, [0, 1], [0, 270]);
  const innerRadarRotation = useTransform(scrollYProgress, [0, 1], [0, -180]);
  const radarScale = useTransform(scrollYProgress, [0, 0.8], [1, 1.15]);

  // Keep the timer for the text slides ONLY
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const slide = HERO_SLIDES[activeSlide];

  return (
    <section 
      id="hero" 
      ref={containerRef}
      className="pt-32 lg:pt-40 pb-24 max-w-[1440px] mx-auto px-6 lg:px-12 hairline-border-b min-h-[720px] flex flex-col justify-between"
    >
      <motion.div 
        style={{ opacity: heroOpacity, y: heroY }}
        className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-12 items-center"
      >
        
        {/* Left Column (Text & Controls) */}
        <div className="lg:col-span-6 flex flex-col gap-8">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 bg-[#8B1E1E]" />
            <span className="font-mono text-[11px] text-[#8A8A8F] tracking-[0.2em] uppercase">
              {slide.tag}
            </span>
          </div>

          <div className="min-h-[220px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSlide}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="flex flex-col gap-6"
              >
                <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-semibold leading-[1.05] tracking-tight text-[#F2F0EA]">
                  {slide.title}
                </h1>

                <p className="font-sans text-lg lg:text-xl text-[#F2F0EA]/80 max-w-xl border-l-2 border-[#8B1E1E] pl-6 py-2 leading-relaxed">
                  {slide.subtitle}
                </p>

                <p className="font-mono text-sm text-[#8A8A8F] max-w-lg leading-relaxed mt-2">
                  {slide.detail}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-8 mt-6 pt-6 hairline-border-t">
            <div className="flex gap-3">
              {HERO_SLIDES.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveSlide(idx)}
                  className={`h-1 transition-all duration-300 cursor-pointer ${
                    activeSlide === idx ? 'w-12 bg-[#8B1E1E]' : 'w-4 bg-[#222228] hover:bg-[#8A8A8F]'
                  }`}
                  aria-label={`Slide ${idx + 1}`}
                />
              ))}
            </div>

            <button
              onClick={onSearchCompany}
              className="bg-[#8B1E1E] text-[#F2F0EA] font-mono text-xs px-6 py-3 uppercase tracking-wider hover:bg-[#6a1515] transition-colors flex items-center gap-3 cursor-pointer ml-auto font-semibold shadow-[0_0_15px_rgba(139,30,30,0.2)]"
            >
              <Search className="w-4 h-4" />
              <span>Search Company</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-[#F2F0EA]/80" />
            </button>
          </div>
        </div>

        {/* Centre Graphic (Scroll Driven) */}
        <div className="lg:col-span-4 relative h-[380px] w-full flex items-center justify-center">
          <div className="relative w-80 h-80 flex items-center justify-center">
            <div className="absolute inset-0 hairline-border p-6 bg-[#111114]/40 flex items-center justify-center">
              
              <motion.div
                style={{ rotate: radarRotation, scale: radarScale }}
                className="w-72 h-72 border hairline-border rounded-full flex items-center justify-center relative"
              >
                <motion.div
                  style={{ rotate: innerRadarRotation }}
                  className="w-52 h-52 border border-[#8B1E1E]/30 rounded-full flex items-center justify-center relative"
                >
                  <div className="w-32 h-32 border border-[#8B1E1E]/60 rounded-full flex items-center justify-center relative">
                    <div
                      className="w-16 h-16 bg-[#8B1E1E] shadow-[0_0_30px_rgba(139,30,30,0.5)] flex items-center justify-center cursor-pointer transition-transform hover:scale-110"
                      onClick={onSearchCompany}
                    >
                      <div className="w-4 h-4 bg-[#F2F0EA]" />
                    </div>
                  </div>
                  <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-gradient-to-b from-[#8B1E1E] via-transparent to-transparent origin-center" />
                </motion.div>
                
                <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-[#222228]/50" />
                <div className="absolute left-0 right-0 top-1/2 h-[1px] bg-[#222228]/50" />
              </motion.div>

              <span className="absolute top-3 left-3 font-mono text-[9px] text-[#8A8A8F]">HISTORICAL</span>
              <span className="absolute top-3 right-3 font-mono text-[9px] text-[#8A8A8F]">FORECAST</span>
              <span className="absolute bottom-3 left-3 font-mono text-[9px] text-[#8A8A8F]">3-STATEMENT</span>
              <span className="absolute bottom-3 right-3 font-mono text-[9px] text-[#8B1E1E] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#8B1E1E] animate-pulse"></span> DCF
              </span>
            </div>
          </div>
        </div>

        {/* Right Stats Column */}
        <div className="lg:col-span-2 flex lg:flex-col gap-10 justify-center border-l hairline-border-l pl-10 py-4">
          <div>
            <div className="font-mono text-4xl font-semibold text-[#8B1E1E] mb-2 tracking-tighter">5</div>
            <div className="font-mono text-[10px] text-[#8A8A8F] uppercase tracking-widest">COMPANIES</div>
          </div>
          <div className="hairline-border-t pt-6">
            <div className="font-mono text-4xl font-semibold text-[#8B1E1E] mb-2 tracking-tighter">8</div>
            <div className="font-mono text-[10px] text-[#8A8A8F] uppercase tracking-widest">SCHEDULES</div>
          </div>
          <div className="hairline-border-t pt-6">
            <div className="font-mono text-4xl font-semibold text-[#8B1E1E] mb-2 tracking-tighter">5 YR</div>
            <div className="font-mono text-[10px] text-[#8A8A8F] uppercase tracking-widest">FORECAST</div>
          </div>
        </div>
      </motion.div>

      {/* Scroll Indicator */}
      <motion.div 
        style={{ opacity: heroOpacity }}
        className="flex justify-between items-center mt-16 pt-8 hairline-border-t text-xs font-mono text-[#8A8A8F]"
      >
        <div className="flex items-center gap-3">
          <motion.div 
            animate={{ y: [0, 5, 0] }} 
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <ArrowDown className="w-4 h-4 text-[#8B1E1E]" />
          </motion.div>
          <span className="tracking-widest">SCROLL TO EXPLORE THE METHODOLOGY AND COVERAGE</span>
        </div>
        <div className="hidden sm:block text-[11px] tracking-widest text-[#8A8A8F]/70">
          INDEPENDENT RESEARCH — ASSUMPTIONS VISIBLE
        </div>
      </motion.div>
    </section>
  );
};
