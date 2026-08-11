import React, { useEffect, useState, useRef } from 'react';
import { motion, useInView, animate } from 'motion/react';

// Custom Animated Counter Component
const AnimatedNumber = ({ value }: { value: number }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (inView) {
      const controls = animate(0, value, {
        duration: 1.5,
        ease: "easeOut",
        onUpdate(val) {
          setDisplayValue(Math.round(val));
        },
      });
      return controls.stop;
    }
  }, [value, inView]);

  return <span ref={ref}>{displayValue}</span>;
};

export const CoverageStatsSection: React.FC = () => {
  return (
    <section id="coverage" className="max-w-[1440px] mx-auto px-6 lg:px-12 py-20 hairline-border-b overflow-hidden">
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        className="flex items-center gap-2 mb-10"
      >
        <span className="w-2 h-2 bg-[#8B1E1E]" />
        <span className="font-mono text-[11px] text-[#dfbfbc] tracking-[0.2em] uppercase">
          03 - CURRENT COVERAGE
        </span>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border hairline-border bg-[#111114]">
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-center p-8 sm:p-12 border-b md:border-b-0 border-r hairline-border hover:bg-[#1a1a1f] transition-colors group cursor-default"
        >
          <div className="font-display text-5xl sm:text-6xl lg:text-7xl text-[#8B1E1E] mb-2 font-semibold group-hover:scale-105 transition-transform duration-500">
            <AnimatedNumber value={5} />
          </div>
          <div className="font-mono text-[11px] text-[#F2F0EA] uppercase tracking-wider">
            Companies Covered
          </div>
          <div className="font-mono text-[10px] text-[#8A8A8F] mt-2">Any listed company, modelled on demand</div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-center p-8 sm:p-12 border-b md:border-b-0 md:border-r hairline-border hover:bg-[#1a1a1f] transition-colors group cursor-default"
        >
          <div className="font-display text-5xl sm:text-6xl lg:text-7xl text-[#8B1E1E] mb-2 font-semibold group-hover:scale-105 transition-transform duration-500">
            <AnimatedNumber value={3} /> <span className="text-3xl sm:text-4xl">YRS</span>
          </div>
          <div className="font-mono text-[11px] text-[#F2F0EA] uppercase tracking-wider">
            Historical Data
          </div>
          <div className="font-mono text-[10px] text-[#8A8A8F] mt-2">3 years of reported figures per company</div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-center p-8 sm:p-12 border-r hairline-border hover:bg-[#1a1a1f] transition-colors group cursor-default"
        >
          <div className="font-display text-5xl sm:text-6xl lg:text-7xl text-[#8B1E1E] mb-2 font-semibold group-hover:scale-105 transition-transform duration-500">
            <AnimatedNumber value={8} />
          </div>
          <div className="font-mono text-[11px] text-[#F2F0EA] uppercase tracking-wider">
            Integrated Schedules
          </div>
          <div className="font-mono text-[10px] text-[#8A8A8F] mt-2">IS · BS · CF · WC · PP&E · Debt · Equity · DCF</div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="text-center p-8 sm:p-12 hover:bg-[#1a1a1f] transition-colors group cursor-default"
        >
          <div className="font-display text-5xl sm:text-6xl lg:text-7xl text-[#8B1E1E] mb-2 font-semibold group-hover:scale-105 transition-transform duration-500">
            ₹0 / $0
          </div>
          <div className="font-mono text-[11px] text-[#F2F0EA] uppercase tracking-wider">
            Zero Platform Cost
          </div>
          <div className="font-mono text-[10px] text-[#8A8A8F] mt-2">No subscription, no paywall</div>
        </motion.div>

      </div>
    </section>
  );
};