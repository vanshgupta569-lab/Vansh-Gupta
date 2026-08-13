// FILE: src/components/CoverageStatsSection.tsx
import React, { useEffect, useState, useRef } from 'react';
import { motion, useInView, animate } from 'motion/react';
import { Send, MessageSquare, Mail } from 'lucide-react';

// Custom Animated Counter Component for 10000+
const AnimatedCounter = ({ target }: { target: number }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (inView) {
      const controls = animate(0, target, {
        duration: 2,
        ease: "easeOut",
        onUpdate(val) {
          setDisplayValue(Math.round(val));
        },
      });
      return controls.stop;
    }
  }, [target, inView]);

  return <span ref={ref}>{displayValue.toLocaleString()}</span>;
};

export const CoverageStatsSection: React.FC = () => {
  const [result, setResult] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setResult("Sending...");

    const formData = new FormData(event.currentTarget);
    formData.append("access_key", "bdcdb6fb-5a3c-4fb9-a4a1-df428be487d4");

    try {
      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        body: formData
      });

      const data = await response.json();
      if (data.success) {
        setResult("Success! Your feedback has been sent.");
        event.currentTarget.reset();
      } else {
        setResult(data.message || "Error submitting form. Please try again.");
      }
    } catch (error) {
      setResult("Network error. Please check your connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="coverage" className="max-w-[1440px] mx-auto px-6 lg:px-12 py-20 hairline-border-b overflow-hidden space-y-12">
      <div>
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="flex items-center gap-2 mb-10"
        >
          <span className="w-2 h-2 bg-[#8B1E1E]" />
          <span className="font-mono text-[11px] text-[#dfbfbc] tracking-[0.2em] uppercase">
            03 - GLOBAL COVERAGE & SCALE
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
            <div className="font-display text-4xl sm:text-5xl lg:text-6xl text-[#8B1E1E] mb-2 font-semibold group-hover:scale-105 transition-transform duration-500">
              <AnimatedCounter target={10000} />+
            </div>
            <div className="font-mono text-[11px] text-[#F2F0EA] uppercase tracking-wider">
              Equities Covered
            </div>
            <div className="font-mono text-[10px] text-[#8A8A8F] mt-2">NYSE · NASDAQ · NSE · BSE · LSE · TSX</div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-center p-8 sm:p-12 border-b md:border-b-0 md:border-r hairline-border hover:bg-[#1a1a1f] transition-colors group cursor-default"
          >
            <div className="font-display text-4xl sm:text-5xl lg:text-6xl text-[#8B1E1E] mb-2 font-semibold group-hover:scale-105 transition-transform duration-500">
              5 <span className="text-3xl sm:text-4xl">YRS</span>
            </div>
            <div className="font-mono text-[11px] text-[#F2F0EA] uppercase tracking-wider">
              Historical Data
            </div>
            {/* "Up to" matters: SEC filers give five, some international sources
                carry four, and the engine uses whatever exists rather than
                failing. A flat "5 YRS" would be a claim the site cannot always
                honour. */}
            <div className="font-mono text-[10px] text-[#8A8A8F] mt-2">
              Up to five years, as filed
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="text-center p-8 sm:p-12 border-r hairline-border hover:bg-[#1a1a1f] transition-colors group cursor-default"
          >
            <div className="font-display text-4xl sm:text-5xl lg:text-6xl text-[#8B1E1E] mb-2 font-semibold group-hover:scale-105 transition-transform duration-500">
              8
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
            <div className="font-display text-4xl sm:text-5xl lg:text-6xl text-[#8B1E1E] mb-2 font-semibold group-hover:scale-105 transition-transform duration-500">
              ₹0 / $0
            </div>
            <div className="font-mono text-[11px] text-[#F2F0EA] uppercase tracking-wider">
              Zero Platform Cost
            </div>
            <div className="font-mono text-[10px] text-[#8A8A8F] mt-2">No subscription, no paywall</div>
          </motion.div>

        </div>
      </div>

      {/* Institutional Feedback Dispatch Box */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="bg-[#111114] border hairline-border p-8 sm:p-10 relative overflow-hidden shadow-xl"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#8B1E1E]/5 rounded-bl-full pointer-events-none" />

        <div className="max-w-3xl mb-8">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="w-4 h-4 text-[#8B1E1E]" />
            <span className="font-mono text-[11px] text-[#8B1E1E] tracking-[0.2em] font-semibold uppercase">
              DIRECT RESEARCH DISPATCH
            </span>
          </div>
          <h3 className="font-display text-2xl sm:text-3xl text-[#F2F0EA] tracking-tight">
            Send Feedback or Model Inquiries
          </h3>
          <p className="font-sans text-xs sm:text-sm font-light text-[#A1A1AA] mt-2 tracking-wide leading-relaxed">
            Have suggestions regarding valuation adjustments or model mechanics? Transmit your feedback directly to our research inbox.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-4 top-4 text-[#8A8A8F]" />
              <input
                type="email"
                name="email"
                required
                placeholder="Your email address (e.g. analyst@domain.com)"
                className="w-full bg-[#0B0B0D] border hairline-border focus:border-[#8B1E1E] text-[#F2F0EA] font-mono text-xs pl-12 pr-4 py-3.5 outline-none placeholder:text-[#52525B] transition-colors"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full md:w-auto bg-[#8B1E1E] text-[#F2F0EA] font-mono text-xs px-8 py-3.5 uppercase tracking-widest hover:bg-[#6a1515] transition-colors flex items-center justify-center gap-2 cursor-pointer font-semibold disabled:opacity-50 shadow-[0_0_15px_rgba(139,30,30,0.3)]"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Transmitting...' : 'Dispatch Feedback'}</span>
              </button>
            </div>
          </div>

          <div>
            <textarea
              name="message"
              required
              rows={3}
              placeholder="Enter your detailed feedback, bug reports, or ticker suggestions here..."
              className="w-full bg-[#0B0B0D] border hairline-border focus:border-[#8B1E1E] text-[#F2F0EA] font-mono text-xs p-4 outline-none placeholder:text-[#52525B] transition-colors resize-none"
            />
          </div>

          {result && (
            <div className={`p-4 font-mono text-xs border ${result.includes("Success") ? "bg-emerald-950/40 border-emerald-800 text-emerald-300" : "bg-[#0B0B0D] border-[#222228] text-[#dfbfbc]"}`}>
              {result}
            </div>
          )}
          
          <div className="font-mono text-[9px] text-[#8A8A8F] uppercase tracking-widest">
            * SECURE WEB3FORMS ENDPOINT · RESPONSES ROUTED DIRECTLY TO YOUR INBOX
          </div>
        </form>
      </motion.div>
    </section>
  );
};