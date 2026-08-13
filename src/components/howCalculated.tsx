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
}) => {
  const [openStep, setOpenStep] = useState<number | null>(1);

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
            A valuation is only as honest as the numbers underneath it, so the
            first step is not a calculation at all. It is collecting the
            company's own reported accounts: the income statement, which says
            what it sold and what that cost; the balance sheet, which says what
            it owns and owes on one day of the year; and the cash flow
            statement, which says what actually moved in and out of the bank.
          </p>
          <p className="mt-2">
            Nothing is adjusted, smoothed or restated here. Everything that
            follows is built on these figures, and any of them can be checked
            against the filing itself.
          </p>
        </>
      ),
      figures: (
        <>
          <Figure
            label="Years of reported history used"
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
          <Figure label="Source" value={meta.source || '—'} />
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
            The income statement is forecast first, because everything else
            depends on it. Revenue is grown at one rate. Each cost is then set
            as a percentage of that revenue, so if the company has historically
            spent 46 pence of every pound on making its product, it is assumed
            to keep doing so.
          </p>
          <p className="mt-2">
            Subtract the costs from revenue and you have operating profit: what
            the business earns from trading, before the cost of its borrowings
            and before tax. Tax is applied at the rate the company last actually
            paid, not the headline rate, because reliefs and foreign earnings
            mean the two are rarely the same.
          </p>
        </>
      ),
      figures: (
        <>
          <Figure
            label="Revenue growth, each year"
            value={pct(drivers.revenueGrowthPct)}
            defaultValue={
              changed('revenueGrowthPct') ? pct(defaults.revenueGrowthPct) : null
            }
          />
          <Figure
            label="Operating margin"
            value={pct(drivers.operatingMarginPct)}
            defaultValue={
              changed('operatingMarginPct')
                ? pct(defaults.operatingMarginPct)
                : null
            }
          />
          <Figure
            label="Tax rate"
            value={pct(drivers.taxRatePct)}
            defaultValue={changed('taxRatePct') ? pct(defaults.taxRatePct) : null}
          />
          <Figure
            label={`Revenue, FY${String(first.year).slice(2)}`}
            value={money(first.revenue)}
          />
          <Figure
            label={`Revenue, FY${String(last.year).slice(2)}`}
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
            Selling more means being owed more. A company that doubles its sales
            will usually find its customers owe it roughly twice as much, it is
            holding roughly twice the stock, and it owes its own suppliers
            roughly twice as much too. So the balance sheet is forecast by tying
            each of those items to the line that drives it: money owed by
            customers moves with revenue, stock and money owed to suppliers move
            with the cost of sales.
          </p>
          <p className="mt-2">
            Fixed assets are handled with a roll-forward: start with last year's
            closing balance, add what is spent on new equipment, subtract
            depreciation for wear and ageing, and the result is this year's
            closing balance.
          </p>
        </>
      ),
      figures: (
        <>
          <Figure
            label="Capital spending, as a share of revenue"
            value={pct(drivers.capexPctOfRev)}
            defaultValue={
              changed('capexPctOfRev') ? pct(defaults.capexPctOfRev) : null
            }
          />
          <Figure
            label={`Capital spending, FY${String(first.year).slice(2)}`}
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
            Profit is not cash. A sale counts as profit the moment it is made,
            even if the customer has not paid yet. Depreciation is deducted as a
            cost even though no money leaves the building. So the cash flow
            statement takes the profit and undoes every entry that was not
            actually cash.
          </p>
          <p className="mt-2">
            Depreciation is added back because it never left. Increases in what
            customers owe are subtracted, because that money has been earned but
            not received. Increases in what is owed to suppliers are added,
            because the goods are held but not yet paid for.
          </p>
        </>
      ),
      figures: (
        <>
          <Figure
            label={`Operating profit after tax, FY${String(first.year).slice(2)}`}
            value={money(first.ebiat)}
          />
          <Figure label="Add back depreciation" value={money(first.da)} />
          <Figure
            label="Cash tied up in working capital"
            value={money(-Math.abs(first.wcChange))}
          />
        </>
      ),
    },
    {
      n: 5,
      title: 'Work out the cash the business generates',
      theory: (
        <p>
          Putting those adjustments together gives the cash the trading business
          produced in the year, before anything is spent on new equipment and
          before a penny goes to lenders or shareholders. This is the raw
          material of the valuation: money the business made, as opposed to
          profit it reported.
        </p>
      ),
      figures: (
        <>
          {rows.map((r) => (
            <Figure
              key={r.year}
              label={`FY${String(r.year).slice(2)} — operating profit after tax plus depreciation, less working capital`}
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
            A business cannot keep all the cash it generates. Machines wear out,
            shops need refitting, servers need replacing. Whatever must be spent
            simply to keep going is not available to owners, so it is
            subtracted.
          </p>
          <p className="mt-2">
            What remains is <strong>free cash flow</strong>: the cash genuinely
            left over once the business has paid its costs, its taxes and its
            upkeep. It is called <em>unlevered</em> because it is measured
            before any interest, which keeps the question about the business
            itself rather than about how it happens to be financed.
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
            A pound arriving in five years is worth less than a pound today,
            because today's pound could be invested in the meantime, and because
            the future one might not arrive at all. So each year's cash is
            discounted: divided by a rate that reflects both the waiting and the
            risk. That rate is the <strong>discount rate</strong>, and it is
            built from what lenders charge the company and what shareholders
            expect to earn.
          </p>
          <p className="mt-2">
            Five years of forecasts do not cover the whole life of a business,
            so the years beyond are handled in two different ways. The first
            assumes the company keeps growing slowly forever. The second assumes
            it is sold at the end, at a multiple of its earnings, the way
            comparable companies change hands. Neither is more correct than the
            other, which is why both are shown.
          </p>
        </>
      ),
      figures: (
        <>
          <Figure
            label="Discount rate"
            value={pct(drivers.waccPct)}
            defaultValue={changed('waccPct') ? pct(defaults.waccPct) : null}
          />
          <Figure
            label="Growth assumed after the forecast, forever"
            value={pct(drivers.terminalGrowthPct)}
            defaultValue={
              changed('terminalGrowthPct')
                ? pct(defaults.terminalGrowthPct)
                : null
            }
          />
          <Figure
            label="Value today of the five forecast years"
            value={money(totalPvExplicit)}
          />
          <Figure
            label="Value today of everything after them"
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
            Adding those two pieces together values the whole enterprise: the
            business as a going concern, regardless of who financed it. But a
            shareholder does not own the debt. So borrowings are subtracted and
            cash in the bank is added back, which leaves the part that belongs
            to the owners.
          </p>
          <p className="mt-2">
            Divide that by the number of shares in issue and the result is a
            value per share, which can finally be set against what the shares
            cost today.
          </p>
        </>
      ),
      figures: (
        <>
          <Figure
            label="Value of the whole business"
            value={`${currencySymbol}${(
              dcfResult.enterpriseValueBillion * 1000
            ).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          />
          <Figure
            label="Value belonging to shareholders"
            value={`${currencySymbol}${(
              dcfResult.impliedEquityValueBillion * 1000
            ).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          />
          <Figure
            label="Value per share"
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
        Eight steps from {companyName}'s filed accounts to the value at the top
        of this page. Each one explains the idea first, then shows the figures
        it produced. No prior knowledge assumed.
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
          const open = openStep === step.n;
          return (
            <div key={step.n} className="border-b border-[#222228]">
              <button
                type="button"
                onClick={() => setOpenStep(open ? null : step.n)}
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