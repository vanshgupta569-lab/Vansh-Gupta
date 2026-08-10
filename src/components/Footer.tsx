import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-[#111114] border-t hairline-border-t py-8 px-6 lg:px-12 max-w-[1440px] mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="font-mono text-xs text-[#8A8A8F] uppercase">
          © 2026 MARGINALIA RESEARCH. ALL RIGHTS RESERVED. MEMBER FINRA/SIPC.
        </div>

        <div className="flex gap-6 flex-wrap font-mono text-xs text-[#8A8A8F] uppercase">
          <a href="#legal" className="hover:text-[#F2F0EA] transition-colors">
            Legal
          </a>
          <a href="#privacy" className="hover:text-[#F2F0EA] transition-colors">
            Privacy
          </a>
          <a href="#terms" className="hover:text-[#F2F0EA] transition-colors">
            Terms
          </a>
          <a href="#compliance" className="hover:text-[#F2F0EA] transition-colors">
            Compliance Disclosures
          </a>
        </div>
      </div>
    </footer>
  );
};
