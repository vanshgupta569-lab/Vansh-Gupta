// FILE: src/components/residualIncomePanel.tsx
//
// Marginalia — residual income, on screen
//
// Shown only for banks and other financial companies, where the discounted cash
// flow refuses. It is deliberately laid out like the rest of the site: the idea
// in plain words first, then this company's own figures under it.

import React from 'react';

interface Props {
  model: any;
  companyName: string;
  currencySymbol: string;
  marketPrice: number | null;
}

export const ResidualIncomePanel: React.FC<Props> = ({
  model,
  companyName,
  currencySymbol,
  marketPrice,
}) => {
  if (!model) return null;

  const isNum = (v: any): v is number => typeof v === 'number' && isFinite(v);
  const money = (v: any, dp = 0) =>
    isNum(v)
      ? `${currencySymbol}${v.toLocaleString(undefined, {
          minimumFractionDigits: dp,
          maximumFractionDigits: dp,
        })}`
      : '—';
  const pct = (v: any, dp = 1) => (isNum(v) ? `${(v * 100).toFixed(dp)}%` : '—');

  if (!model.applicable) {
    return (
      <section className="border border-[#222228] bg-[#111114] p-5 sm:p-7">
        <h2 className="font-serif text-xl sm:text-2xl text-[#F2F0EA] mb-2">
          Valuing a bank
        </h2>
        <p className="text-[14px] leading-relaxed text-[#A1A1AA] max-w-2xl">
          {model.message}
        </p>
      </section>
    );
  }

  const premium =
    isNum(marketPrice) && isNum(model.valuePerShare) && model.valuePerShare > 0
      ? (marketPrice / model.valuePerShare - 1) * 100
      : null;

  return (
    <section className="border border-[#222228] bg-[#111114] p-5 sm:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <h2 className="font-serif text-xl sm:text-2xl text-[#F2F0EA]">
          Valued as a bank, not as a business selling goods
        </h2>
        <span className="font-mono text-[10px] tracking-[0.2em] text-[#8A8A8F] uppercase">
          residual income
        </span>
      </div>

      <div className="text-[14px] leading-relaxed text-[#A1A1AA] space-y-3 max-w-2xl mb-7">
        <p>
          The usual method here values a company on the cash it produces after
          paying its costs and its upkeep, measured before interest. That does
          not work for a bank, because borrowing is not how a bank finances
          itself, it is the raw material it sells.
        </p>
        <p>
          So a different question is asked. A bank starts with a book value of
          equity: what shareholders have put in and left in. Shareholders expect
          a return on that. If the bank earns exactly what is expected of it, the
          shares are worth the book value and nothing more. Everything it earns{' '}
          <strong>above</strong> that expected return is what makes the shares
          worth more than book.
        </p>
      </div>

      <div className="border border-[#222228] bg-[#0B0B0D] p-5 mb-7">
        <div className="font-mono text-[12px] tracking-[0.2em] text-[#8A8A8F] uppercase mb-3">
          {companyName}
        </div>
        {[
          ['Book value of equity today', money(model.openingBook)],
          ['Book value per share', money(model.bookPerShare, 2)],
          ['Return on equity, from the last reported year', pct(model.roe)],
          ['Return shareholders require (cost of equity)', pct(model.costOfEquity, 2)],
          ['Earnings retained rather than paid out', pct(1 - model.payout)],
          [
            'Value of the extra earned above the required return, over five years',
            money(model.pvResidual),
          ],
          ['Value of everything after that', money(model.pvTerminal)],
          ['Equity value', money(model.equityValue)],
          ['Value per share', money(model.valuePerShare, 2)],
          ['Implied price to book', isNum(model.impliedPriceToBook) ? `${model.impliedPriceToBook.toFixed(2)}x` : '—'],
          ...(isNum(marketPrice) ? [['Market price', money(marketPrice, 2)] as [string, string]] : []),
          ...(premium !== null
            ? [[
                premium > 0 ? 'Market premium to this model' : 'Market discount to this model',
                `${Math.abs(premium).toFixed(1)}%`,
              ] as [string, string]]
            : []),
        ].map(([k, v], i, arr) => (
          <div
            key={String(k)}
            className={`flex flex-wrap items-baseline justify-between gap-4 py-2 ${
              i < arr.length - 1 ? 'border-b border-[#222228]/60' : ''
            }`}
          >
            <span
              className={`text-[14px] ${
                String(k).startsWith('Value per share') || String(k) === 'Equity value'
                  ? 'text-[#F2F0EA]'
                  : 'text-[#8A8A8F]'
              }`}
            >
              {k}
            </span>
            <span
              className={`font-mono text-[14px] ${
                String(k) === 'Value per share' ? 'text-[#8B1E1E] font-semibold' : 'text-[#F2F0EA]'
              }`}
            >
              {v}
            </span>
          </div>
        ))}
      </div>

      {Array.isArray(model.years) && model.years.length > 0 && (
        <div className="overflow-x-auto mb-7">
          <table className="w-full min-w-[620px] border-collapse">
            <thead>
              <tr className="border-b border-[#222228]">
                {['', 'Opening book', 'Earnings', 'Required return', 'Residual income', 'Value today'].map(
                  (h, i) => (
                    <th
                      key={h + i}
                      className={`font-mono text-[12px] tracking-[0.15em] text-[#8A8A8F] uppercase pb-3 px-3 ${
                        i === 0 ? 'text-left' : 'text-right'
                      }`}
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {model.years.map((row: any) => (
                <tr key={row.year} className="border-b border-[#222228]/60">
                  <td className="py-2.5 px-3 font-mono text-[13px] text-[#8A8A8F]">
                    FY{String(row.year).slice(2)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-[13px] text-[#A1A1AA]">{money(row.openingBook)}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-[13px] text-[#A1A1AA]">{money(row.netIncome)}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-[13px] text-[#A1A1AA]">{money(row.requiredReturn)}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-[13px] text-[#F2F0EA]">{money(row.residualIncome)}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-[13px] text-[#F2F0EA]">{money(row.presentValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-[13px] leading-relaxed text-[#8A8A8F] space-y-2 max-w-2xl border-t border-[#222228] pt-5">
        <p>
          <span className="text-[#F2F0EA]">Where this can be wrong.</span> It
          assumes the reported book equity is roughly right, which for a bank
          means trusting its provisioning against bad loans. Provisioning is
          exactly where a bank in trouble flatters itself, and no model built on
          the filed numbers can see through that.
        </p>
        <p>
          It also says nothing about capital adequacy, which is often what
          actually limits whether a bank can grow, and it does not model
          regulatory limits on dividends.
        </p>
        <p className="font-mono text-[12px]">
          {model.provenance?.roe}. {model.provenance?.costOfEquity}.
        </p>
      </div>
    </section>
  );
};

export default ResidualIncomePanel;
