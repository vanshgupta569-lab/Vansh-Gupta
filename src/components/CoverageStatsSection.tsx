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
      {/* The four-figure coverage table that used to sit here has been
          removed. It advertised a count of listed companies, which is a
          claim about scale rather than about the product, and it was the
          last thing on the page before the form — so the page ended on a
          boast instead of on an invitation. The feedback form below is the
          part worth keeping, and it genuinely submits. */}

      {/* Institutional Feedback Dispatch Box */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="bg-panel border hairline-border p-8 sm:p-10 relative overflow-hidden"
      >
        {/* A QUARTER-CIRCLE OF OXBLOOD WASH IN THE CORNER, REMOVED. It is a
            rounded decorative shape on a page whose form language is "a ruled
            sheet, not a card deck", and it exists only to look busy -- the
            last item on the VISUAL_SYSTEM Avoid list. */}

        <div className="max-w-3xl mb-8">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="w-4 h-4 text-[#8B1E1E]" />
            <span className="font-figure text-[11px] text-[#8B1E1E] tracking-[0.2em] font-semibold uppercase">
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
                className="w-full bg-[#0B0B0D] border hairline-border focus:border-[#8B1E1E] text-[#F2F0EA] font-figure text-xs pl-12 pr-4 py-3.5 outline-none placeholder:text-[#52525B] transition-colors"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full md:w-auto border border-accent bg-accent/15 text-ink font-figure text-[13px] px-8 py-3.5 hover:bg-accent/35 transition-colors flex items-center justify-center gap-2 cursor-pointer font-semibold disabled:opacity-50"
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
              className="w-full bg-[#0B0B0D] border hairline-border focus:border-[#8B1E1E] text-[#F2F0EA] font-figure text-xs p-4 outline-none placeholder:text-[#52525B] transition-colors resize-none"
            />
          </div>

          {result && (
            <div
              role="status"
              aria-live="polite"
              className={`p-4 font-figure text-[13px] border ${
                result.includes('Success')
                  ? 'bg-positive-fill border-positive-line text-positive'
                  : 'bg-page border-line text-accent-text'
              }`}
            >
              {result}
            </div>
          )}
          
          <div className="font-figure text-[9px] text-[#8A8A8F] uppercase tracking-widest">
            {/* The vendor's name, an unproven security claim and "your
                inbox" addressed to a reader who does not own it, all in
                tracked capitals. What a reader is owed here is what happens
                to their address. */}
            We use your email address only to reply to this message.
          </div>
        </form>
      </motion.div>
    </section>
  );
};