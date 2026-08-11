import React, { useRef } from 'react';
import { BookOpen, BookmarkCheck, Shield } from 'lucide-react';
import { motion, useInView } from 'motion/react';

export const EtymologySection: React.FC = () => {
  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { once: true, margin: "-100px" });

  const sentence = "In corporate financial reporting, headline metrics and glossed pitch decks rarely tell the full story. The true economic condition of an enterprise is recorded deep within the footnote disclosures, audit commentaries, and balance sheet adjustments — the financial marginalia. Our singular purpose is to parse these critical disclosures and present ";

  return (
    <section id="etymology" className="bg-[#111114] hairline-border-b py-20 overflow-hidden">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
        <div className="mb-16" ref={containerRef}>
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center gap-2 mb-3"
          >
            <span className="w-2 h-2 bg-[#8B1E1E]" />
            <span className="font-mono text-[11px] text-[#dfbfbc] tracking-[0.2em] uppercase">
              01 — PHILOSOPHY & ETYMOLOGY
            </span>
          </motion.div>

          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-6">
            <div>
              <div className="overflow-hidden py-1">
                <motion.h2 
                  initial={{ y: "100%", opacity: 0 }}
                  animate={isInView ? { y: 0, opacity: 1 } : {}}
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
                  className="font-display text-3xl sm:text-4xl lg:text-5xl text-[#F2F0EA] font-medium"
                >
                  The Meaning of Marginalia
                </motion.h2>
              </div>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={isInView ? { opacity: 1 } : {}}
                transition={{ duration: 0.8, delay: 0.3 }}
                className="font-mono text-sm text-[#8B1E1E] font-semibold tracking-wider uppercase mt-2 flex items-center gap-2"
              >
                <span>OUR PURPOSE:</span>
                <span className="bg-[#8B1E1E]/10 border border-[#8B1E1E]/40 text-[#F2F0EA] px-3 py-1 font-serif italic text-base capitalize">
                  "A ledger that never lies."
                </span>
              </motion.div>
            </div>

            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="font-mono text-xs text-[#8A8A8F] border-l-2 border-[#8B1E1E] pl-4 max-w-sm"
            >
              <strong className="text-[#F2F0EA] block">mar·gi·na·li·a</strong>
              <span className="italic">noun</span> /ˌmɑːrdʒɪˈneɪliə/ — Notes, commentary, and critical disclosures written in the margins of a text.
            </motion.div>
          </div>

          <motion.p 
            className="font-sans text-base sm:text-lg text-[#dfbfbc] max-w-4xl leading-relaxed bg-[#0B0B0D] p-6 border hairline-border"
          >
            {sentence.split(" ").map((word, index) => (
              <motion.span
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.4, delay: 0.4 + index * 0.02 }}
                className="inline-block mr-1"
              >
                {word === "marginalia." ? <strong>{word}</strong> : word}
              </motion.span>
            ))}
            <motion.strong 
              initial={{ color: "#dfbfbc", opacity: 0 }}
              animate={isInView ? { color: "#8B1E1E", opacity: 1 } : {}}
              transition={{ duration: 1, delay: 1.5 }}
              className="inline-block"
            >
              a ledger that never lies.
            </motion.strong>
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { icon: BookOpen, title: "Notes in the Margins", desc: "Every model starts from what companies actually reported: filed income statements, balance sheets and cash flow statements. No numbers are invented; if a figure isn't in the filing, it isn't in the model." },
            { icon: BookmarkCheck, title: "Assumptions in Plain Sight", desc: "Every forecast number is driven by a named, visible assumption — revenue growth, gross margin, WACC, terminal growth rate. Nothing is hidden inside a black box. Change an assumption and watch every downstream figure recalculate instantly." },
            { icon: Shield, title: "Reported vs. Modelled", desc: "Historical figures are clearly separated from forecast figures. The model tells you what a set of assumptions implies — not what will happen. The distance between the model's implied value and the market price is shown without a verdict attached." }
          ].map((item, index) => (
            <motion.div 
              key={index}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.6 + (index * 0.2), ease: "easeOut" }}
              className="p-8 border hairline-border bg-[#0B0B0D] hover:bg-[#111114] transition-colors group"
            >
              <div className="w-12 h-12 bg-[#8B1E1E]/10 border border-[#8B1E1E]/30 flex items-center justify-center mb-6 group-hover:border-[#8B1E1E] transition-colors">
                <item.icon className="w-6 h-6 text-[#8B1E1E]" />
              </div>
              <h3 className="font-display text-xl sm:text-2xl mb-3 text-[#F2F0EA]">
                {item.title}
              </h3>
              <p className="font-sans text-sm text-[#8A8A8F] leading-relaxed">
                {item.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};