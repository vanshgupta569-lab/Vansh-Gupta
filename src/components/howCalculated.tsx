// Marginalia — "How this was calculated"
//
// The section that exists because a layman currently understands nothing on
// this screen. Eight steps, each written the same way:
//
//   1. the THEORY first, in plain English, with no jargon left undefined
//   2. then THIS COMPANY'S figures underneath, so the reader can watch the
//      general rule turn into a specific number
//
// Rules this section follows:
//
//   Nothing here recalculates anything. Every figure is read from the model
//   that produced the value at the top of the screen, so the walkthrough can
//   never drift away from the answer it claims to explain.
//
//   Where the reader has moved a slider, the figure shown is THEIRS and the
//   model's own default is shown beside it in grey. A reader should always be
//   able to see what they changed.
//
//   No step claims more than it can support. Where an assumption is a generic
//   default rather than something read from the filings, it says so.

import React, { useState } from 'react';
import { ValuationDrivers, DCFResult } from '../types';

interface HowCalculatedProps {
  source: any;
  dcfResult: DCFResult;
  drivers: ValuationDrivers;
  defaults: ValuationDrivers;
  currencySymbol: string;
  unitLabel: string;
  companyName: string;
  isDerived: boolean;
  sourceLabel: string;
}

// A figure with its default shown beside it when the reader has changed it.
const Figure: React.FC<{
  label: string;
  value: string;
  defaultValue?: string | null;
}> = ({ label, value, defaultValue }) => (
  <div className="flex items-baseline justify-between gap-4 py-1.5 border-b border-[#222228]/60 last:border-0">
    <span className="text-[13px] text-[#8A8A8F]">{label}</span>
    <span className="font-mono text-[13px] text-[#F2F0EA] text-right">
      {value}
      {defaultValue ? (
        <span className="ml-2 text-[#8A8A8F]">was {defaultValue}</span>
      ) : null}
    </span>
  </div>
);

export const HowCalculated: React.FC<HowCalculatedProps> = ({
  source,
  dcfResult,
  drivers,
  defaults,
  currencySymbol,
  unitLabel,
  companyName,
  isDerived,
  sourceLabel,
}) => {
  // Every step starts OPEN. This section exists to be read straight through by
  // someone who does not already know how a valuation works, and a reader like
  // that cannot know which step holds the bit they are missing. Closing one
  // step no longer closes the others: they are independent.
  const [closedSteps, setClosedSteps] = useState<number[]>([]);
  const isOpen = (n: number) => !closedSteps.includes(n);
  const toggleStep = (n: number) =>
    setClosedSteps((prev) =>
      prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]
    );

  if (!dcfResult.applicable || !dcfResult.forecastRows.length) return null;

  const rows = dcfResult.forecastRows;
  const first = rows[0];
  const last = rows[rows.length - 1];
  const meta = source?.meta || {};
  const provenance = source?.provenance || {};
  const historicalYears: number[] = meta.historicalYears || [];

  const money = (v: number | null | undefined) =>
    typeof v === 'number' && isFinite(v)
      ? `${currencySymbol}${Math.round(v).toLocaleString()}`
      : '—';
  const pct = (v: number | null | undefined, dp = 1) =>
    typeof v === 'number' && isFinite(v) ? `${v.toFixed(dp)}%` : '—';

  // Only show a default beside a figure when the reader has actually moved it.
  const changed = (key: keyof ValuationDrivers) =>
    Number(drivers[key]) !== Number(defaults[key]);

  const totalPvExplicit = rows.reduce((sum, r) => sum + (r.pvUfcf || 0), 0);

  const steps: {
    n: number;
    title: string;
    theory: React.ReactNode;
    figures: React.ReactNode;
  }[] = [
    {
      n: 1,
      title: 'Start with what the company actually filed',
      theory: (
        <>
          <p>
            The first step is not a calculation. It is just collecting what the
            company has already published.
          </p>
          <p className="mt-2">
            Every listed company must publish its accounts each year. Those
            accounts come in three parts. One shows what it sold and what that
            cost. One shows what it owns and what it owes. One shows the money
            that actually went in and out of its bank account.
          </p>
          <p className="mt-2">
            Nothing here is adjusted or tidied up. These are the company's own
            numbers, and you can check any of them against the published
            accounts yourself.
          </p>
        </>
      ),
      figures: (
        <>
          <Figure
            label="Years of published accounts used"
            value={
              historicalYears.length
                ? `${historicalYears.length} (FY${String(
                    historicalYears[0]
                  ).slice(2)} to FY${String(
                    historicalYears[historicalYears.length - 1]
                  ).slice(2)})`
                : '—'
            }
          />
          <Figure label="Where the figures come from" value={sourceLabel} />
          <Figure label="Figures stated in" value={unitLabel} />
          {provenance.excludedPeriods ? (
            <div className="pt-2 text-[12px] leading-relaxed text-[#8A8A8F]">
              Some periods were set aside as not comparable:{' '}
              {provenance.excludedPeriods}
            </div>
          ) : null}
        </>
      ),
    },
    {
      n: 2,
      title: 'Forecast the income statement',
      theory: (
        <>
          <p>
            To work out what a company is worth, you first have to guess what it
            will earn in the years ahead. That guess starts with sales.
          </p>
          <p className="mt-2">
            Sales are assumed to grow at one steady rate. Then each cost is set
            as a share of those sales. If the company has been spending 54 out
            of every 100 rupees of sales on making its product, it is assumed to
            keep doing that.
          </p>
          <p className="mt-2">
            Sales minus costs leaves <strong>operating profit</strong>: what the
            business earns from simply trading, before it pays interest on its
            loans and before tax. Tax is then taken off at the rate the company
            actually paid last year, not the official rate, because almost no
            company pays exactly the official rate.
          </p>
        </>
      ),
      figures: (
        <>
          <Figure
            label="Sales growth assumed, each year"
            value={pct(drivers.revenueGrowthPct)}
            defaultValue={
              changed('revenueGrowthPct') ? pct(defaults.revenueGrowthPct) : null
            }
          />
          <Figure
            label="Operating profit as a share of sales"
            value={pct(drivers.operatingMarginPct)}
            defaultValue={
              changed('operatingMarginPct')
                ? pct(defaults.operatingMarginPct)
                : null
            }
          />
          <Figure
            label="Tax rate applied"
            value={pct(drivers.taxRatePct)}
            defaultValue={changed('taxRatePct') ? pct(defaults.taxRatePct) : null}
          />
          <Figure
            label={`Sales, FY${String(first.year).slice(2)}`}
            value={money(first.revenue)}
          />
          <Figure
            label={`Sales, FY${String(last.year).slice(2)}`}
            value={money(last.revenue)}
          />
          <Figure
            label={`Operating profit, FY${String(last.year).slice(2)}`}
            value={money(last.ebit)}
          />
          {isDerived && provenance.revenueGrowth ? (
            <div className="pt-2 text-[12px] leading-relaxed text-[#8A8A8F]">
              Where the growth rate came from: {provenance.revenueGrowth}.
              Margins: {provenance.grossMargin}.
            </div>
          ) : null}
        </>
      ),
    },
    {
      n: 3,
      title: 'Forecast the balance sheet from it',
      theory: (
        <>
          <p>
            Selling more is not free. A shop that sells twice as much has to
            keep twice as much stock on its shelves, is waiting on twice as much
            money from customers who have not paid yet, and owes twice as much
            to its own suppliers.
          </p>
          <p className="mt-2">
            So each of those moves in step with whatever drives it. Money owed
            by customers grows in line with sales. Stock and money owed to
            suppliers grow in line with what it costs to make the goods.
          </p>
          <p className="mt-2">
            Buildings and machinery are tracked year by year in a simple way:
            take last year's total, add whatever is spent on new equipment, take
            off a bit for wear and age, and that gives this year's total. The
            amount taken off for wear is called{' '}
            <strong>depreciation</strong>.
          </p>
        </>
      ),
      figures: (
        <>
          <Figure
            label="Spending on equipment, as a share of sales"
            value={pct(drivers.capexPctOfRev)}
            defaultValue={
              changed('capexPctOfRev') ? pct(defaults.capexPctOfRev) : null
            }
          />
          <Figure
            label={`Spending on equipment, FY${String(first.year).slice(2)}`}
            value={money(first.capex)}
          />
          <Figure
            label={`Depreciation, FY${String(first.year).slice(2)}`}
            value={money(first.da)}
          />
          <div className="pt-2 text-[12px] leading-relaxed text-[#8A8A8F]">
            Money owed by customers grows with revenue. Stock and money owed to
            suppliers grow with the cost of sales.
          </div>
        </>
      ),
    },
    {
      n: 4,
      title: 'Forecast the cash flow statement',
      theory: (
        <>
          <p>
            This is the step most people find surprising:{' '}
            <strong>profit is not the same as cash</strong>.
          </p>
          <p className="mt-2">
            A sale counts as profit the moment it is agreed, even if the
            customer will not pay for another three months. Depreciation is
            taken off as a cost even though no money actually leaves the
            building. So a company can report a healthy profit and still have an
            empty bank account.
          </p>
          <p className="mt-2">
            This step undoes all of that. Depreciation is added back, because it
            never really left. Money the company has earned but not yet
            collected is taken off. Money it owes but has not yet paid is added
            back. What is left is real cash.
          </p>
        </>
      ),
      figures: (
        <>
          <Figure
            label={`Operating profit after tax, FY${String(first.year).slice(2)}`}
            value={money(first.ebiat)}
          />
          <Figure label="Add back depreciation (no money left)" value={money(first.da)} />
          <Figure
            label="Cash tied up in stock and unpaid bills"
            value={money(-Math.abs(first.wcChange))}
          />
        </>
      ),
    },
    {
      n: 5,
      title: 'Work out the cash the business generates',
      theory: (
        <>
          <p>
            Put those adjustments together and you get the cash the business
            genuinely produced in the year, before it spends anything on new
            equipment and before anything goes to banks or shareholders.
          </p>
          <p className="mt-2">
            This is the number the whole valuation is built on. Not the profit
            the company reported, but the money it actually made.
          </p>
        </>
      ),
      figures: (
        <>
          {rows.map((r) => (
            <Figure
              key={r.year}
              label={`FY${String(r.year).slice(2)} — cash generated`}
              value={money(r.ebiat + r.da - Math.abs(r.wcChange))}
            />
          ))}
        </>
      ),
    },
    {
      n: 6,
      title: 'Subtract what must be reinvested',
      theory: (
        <>
          <p>
            A business cannot keep all the cash it makes. Machines wear out,
            shops need repainting, delivery vans need replacing. That spending
            is not optional, so it does not belong to the owners and it has to
            come off.
          </p>
          <p className="mt-2">
            What is left is called <strong>free cash flow</strong>: the money
            genuinely spare after the company has paid its costs, its taxes and
            its upkeep. Think of it as what would be left in your account at the
            end of the year after the rent, the bills and fixing the roof.
          </p>
          <p className="mt-2">
            It is measured before any interest is paid. That is deliberate. It
            keeps the question about how good the business is, separate from the
            question of how much it has borrowed.
          </p>
        </>
      ),
      figures: (
        <>
          {rows.map((r) => (
            <Figure
              key={r.year}
              label={`FY${String(r.year).slice(2)} — free cash flow`}
              value={money(r.ufcf)}
            />
          ))}
        </>
      ),
    },
    {
      n: 7,
      title: 'Convert future cash into what it is worth today',
      theory: (
        <>
          <p>
            Money you will get in five years is worth less to you than the same
            money today. You could have invested today's money in the meantime,
            and the future money might never turn up at all.
          </p>
          <p className="mt-2">
            So every future year's cash is shrunk to what it is worth right now.
            How much it shrinks depends on the <strong>discount rate</strong>: a
            single percentage that stands for both the waiting and the risk. A
            riskier company gets a higher rate, so its future cash is worth less
            today.
          </p>
          <p className="mt-2">
            But a business does not stop after five years. What happens
            afterwards is handled two different ways. One assumes the company
            keeps growing slowly forever. The other assumes it is sold at the
            end, at a price based on what similar companies sell for. Neither is
            more right than the other, which is exactly why this site shows both
            instead of picking one.
          </p>
        </>
      ),
      figures: (
        <>
          <Figure
            label="Discount rate (waiting plus risk)"
            value={pct(drivers.waccPct)}
            defaultValue={changed('waccPct') ? pct(defaults.waccPct) : null}
          />
          <Figure
            label="Growth assumed after year five, forever"
            value={pct(drivers.terminalGrowthPct)}
            defaultValue={
              changed('terminalGrowthPct')
                ? pct(defaults.terminalGrowthPct)
                : null
            }
          />
          <Figure
            label="What the next five years are worth today"
            value={money(totalPvExplicit)}
          />
          <Figure
            label="What everything after that is worth today"
            value={`${currencySymbol}${(dcfResult.pvTerminalValue * 1000).toLocaleString(
              undefined,
              { maximumFractionDigits: 0 }
            )}`}
          />
          {isDerived && provenance.wacc ? (
            <div className="pt-2 text-[12px] leading-relaxed text-[#8A8A8F]">
              {provenance.wacc}. {provenance.terminalGrowth}.
            </div>
          ) : null}
        </>
      ),
    },
    {
      n: 8,
      title: 'Turn the whole business into a value per share',
      theory: (
        <>
          <p>
            Adding it all up gives the value of the whole company. But if you
            buy a share, you do not get the whole company. The banks have to be
            paid first.
          </p>
          <p className="mt-2">
            It is like buying a house with a loan on it. The house may be worth
            one crore, but if eighty lakh is still owed to the bank, what you
            actually own is twenty lakh. So the company's debts are taken off,
            and the cash sitting in its bank account is added on.
          </p>
          <p className="mt-2">
            Divide what is left by the number of shares, and you finally have
            what one share is worth. That is the number at the top of this page,
            and you can now compare it with what one share actually costs.
          </p>
        </>
      ),
      figures: (
        <>
          <Figure
            label="Value of the whole company"
            value={`${currencySymbol}${(
              dcfResult.enterpriseValueBillion * 1000
            ).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          />
          <Figure
            label="Left for shareholders, after debts"
            value={`${currencySymbol}${(
              dcfResult.impliedEquityValueBillion * 1000
            ).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          />
          <Figure
            label="Value of one share"
            value={`${currencySymbol}${dcfResult.targetPrice.toLocaleString(
              undefined,
              { minimumFractionDigits: 2, maximumFractionDigits: 2 }
            )}`}
          />
        </>
      ),
    },
  ];

  const anyChanged = (Object.keys(defaults) as (keyof ValuationDrivers)[]).some(
    (key) => changed(key)
  );

  return (
    <section className="border border-[#222228] bg-[#111114] p-5 sm:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <h2 className="font-serif text-xl sm:text-2xl text-[#F2F0EA]">
          How this was calculated
        </h2>
        <span className="font-mono text-[10px] tracking-[0.2em] text-[#8A8A8F] uppercase">
          03 — the working
        </span>
      </div>

      <p className="text-[13px] leading-relaxed text-[#8A8A8F] max-w-2xl mb-2">
        Eight steps from {companyName}'s published accounts to the value at the
        top of this page. Each step explains the idea in plain words first, then
        shows the figures it produced for this company. You do not need to know
        anything about finance to follow it.
      </p>

      {anyChanged ? (
        <p className="font-mono text-[11px] text-[#8B1E1E] mb-6">
          Showing your adjustments. The model's own figure is in grey beside
          anything you have changed.
        </p>
      ) : (
        <p className="font-mono text-[11px] text-[#8A8A8F] mb-6">
          Showing the model's own assumptions. Nothing has been adjusted.
        </p>
      )}

      <div className="border-t border-[#222228]">
        {steps.map((step) => {
          const open = isOpen(step.n);
          return (
            <div key={step.n} className="border-b border-[#222228]">
              <button
                type="button"
                onClick={() => toggleStep(step.n)}
                className="w-full flex items-baseline gap-4 py-4 text-left group"
              >
                <span className="font-mono text-[11px] text-[#8B1E1E] shrink-0 pt-0.5">
                  {String(step.n).padStart(2, '0')}
                </span>
                <span className="flex-1 text-[15px] text-[#F2F0EA] group-hover:text-[#8B1E1E] transition-colors">
                  {step.title}
                </span>
                <span className="font-mono text-[13px] text-[#8A8A8F] shrink-0">
                  {open ? '−' : '+'}
                </span>
              </button>

              {open && (
                <div className="pb-6 pl-0 sm:pl-10 grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10">
                  <div className="text-[13px] leading-relaxed text-[#A1A1AA] max-w-prose">
                    {step.theory}
                  </div>
                  <div className="border border-[#222228] bg-[#0B0B0D] p-4">
                    <div className="font-mono text-[10px] tracking-[0.2em] text-[#8A8A8F] uppercase mb-3">
                      {companyName}
                    </div>
                    {step.figures}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default HowCalculated;