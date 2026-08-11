import React, { useState } from 'react';
import { X, ShieldAlert, Lock, FileText } from 'lucide-react';

export const Footer: React.FC = () => {
  const [activeModal, setActiveModal] = useState<'LEGAL' | 'PRIVACY' | 'TERMS' | null>(null);

  return (
    <>
      <footer className="w-full bg-[#111114] border-t hairline-border-t py-8 px-6 lg:px-12 max-w-[1440px] mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="font-mono text-xs text-[#8A8A8F] uppercase tracking-widest">
            © 2026 MARGINALIA RESEARCH. ALL RIGHTS RESERVED.
          </div>

          <div className="flex gap-6 flex-wrap font-mono text-xs text-[#8A8A8F] uppercase tracking-widest">
            <button 
              onClick={() => setActiveModal('LEGAL')}
              className="hover:text-[#F2F0EA] transition-colors cursor-pointer bg-transparent border-none p-0"
            >
              Legal
            </button>
            <button 
              onClick={() => setActiveModal('PRIVACY')}
              className="hover:text-[#F2F0EA] transition-colors cursor-pointer bg-transparent border-none p-0"
            >
              Privacy
            </button>
            <button 
              onClick={() => setActiveModal('TERMS')}
              className="hover:text-[#F2F0EA] transition-colors cursor-pointer bg-transparent border-none p-0"
            >
              Terms
            </button>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t hairline-border-t font-mono text-[11px] leading-relaxed text-[#6E6E73] max-w-3xl">
          Marginalia is an independent research project and is not a registered
          investment adviser, research analyst, or broker-dealer. Nothing on this
          site is investment advice or a recommendation to buy or sell any
          security. Valuation figures are the output of a model built on stated
          assumptions and will differ from other reasonable assumptions.
        </div>
      </footer>

      {/* Institutional Modal Overlay */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#111114] border hairline-border w-full max-w-2xl p-8 relative shadow-2xl space-y-6">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b hairline-border-b pb-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-[#8B1E1E]" />
                <span className="font-mono text-xs text-[#8B1E1E] font-semibold uppercase tracking-widest">
                  {activeModal === 'LEGAL' && 'Legal Disclosures & Attribution'}
                  {activeModal === 'PRIVACY' && 'Privacy Policy & Data Handling'}
                  {activeModal === 'TERMS' && 'Terms of Use & Student Disclaimer'}
                </span>
              </div>
              <button 
                onClick={() => setActiveModal(null)}
                className="text-[#8A8A8F] hover:text-[#F2F0EA] cursor-pointer transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content Body */}
            <div className="font-sans text-sm font-light text-[#A1A1AA] space-y-4 leading-loose tracking-wide max-h-[60vh] overflow-y-auto pr-2">
              {activeModal === 'LEGAL' && (
                <>
                  <p>
                    <strong>Regulatory Attribution & Sources:</strong> Marginalia indexes historical financial statements directly from primary public regulatory filings, including SEC EDGAR (for United States equities) and official stock exchange disclosures (for international listings).
                  </p>
                  <p>
                    Data is parsed strictly as reported. No adjustments, forward estimates, or speculative figures are embedded within historical schedules. All calculations are handled locally or via deterministic server models.
                  </p>
                </>
              )}

              {activeModal === 'PRIVACY' && (
                <>
                  <p>
                    <strong>Zero Commercial Tracking:</strong> Marginalia respects user confidentiality. This platform does not deploy commercial tracking cookies, aggregate personal identifiable information (PII), or share user data with third-party advertisers.
                  </p>
                  <p>
                    Interactive terminal states, custom slider inputs, and scenario configurations remain strictly within your local browser session storage and are never permanently harvested or monetized.
                  </p>
                </>
              )}

              {activeModal === 'TERMS' && (
                <>
                  <div className="bg-[#0B0B0D] border hairline-border p-4 text-[#F2F0EA] font-mono text-xs uppercase tracking-wider mb-2">
                    Notice: Educational Project Disclaimer
                  </div>
                  <p>
                    Marginalia is an independent engineering and financial research project developed solely by a student for educational, academic, and non-commercial demonstration purposes only.
                  </p>
                  <p>
                    The platform does not provide formal financial, legal, or tax advice. Nothing contained herein constitutes an offer, solicitation, or recommendation to buy or sell securities. Users assume full responsibility for their own independent financial analysis and valuation models.
                  </p>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-4 border-t hairline-border-t flex justify-end">
              <button
                onClick={() => setActiveModal(null)}
                className="font-mono text-xs uppercase tracking-widest px-6 py-2.5 bg-[#8B1E1E] text-[#F2F0EA] hover:bg-[#6a1515] transition-colors cursor-pointer font-semibold"
              >
                Close Notice
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
};