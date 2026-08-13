// FILE: src/components/nerdViews.tsx
// Marginalia — the full-screen model views
//
// The three "for the nerds" buttons open a whole screen each, not a panel on
// the page. That is deliberate: a three-statement model is thirty schedules
// wide and reading it squeezed under a dashboard is not reading it at all.
//
// What is on screen here is the engine's own output, laid out the way the Excel
// workbook lays it out. Nothing is recomputed for display. If a figure appears
// here it came out of the same model run that produced the value on the front
// page, so the two can never disagree.
//
// Every assumption carries its own adjuster, sitting on the row it belongs to.
// Beta sits in the CAPM block, next to the cost of equity it feeds. Capex sits
// on the PP&E roll-forward. That is the point of the section: not a panel of
// sliders somewhere else, but a number you can change in the place where you
// can see what it does.

import React from 'react';
import { X, Download } from 'lucide-react';
import { ValuationDrivers } from '../types';

// ---------------------------------------------------------------------------
// SHARED PIECES
// ---------------------------------------------------------------------------

const num = (v: any): v is number => typeof v === 'number' && isFinite(v);

const fmt = (v: any, dp = 0) =>
  num(v)
    ? v.toLocaleString(undefined, {
        minimumFractionDigits: dp,
        maximumFractionDigits: dp,
      })
    : '—';

const fmtPct = (v: any, dp = 1) => (num(v) ? `${(v * 100).toFixed(dp)}%` : '—');
const fmtX = (v: any, dp = 1) => (num(v) ? `${v.toFixed(dp)}x` : '—');

/** An assumption you can change, sitting on the row it drives. */
export const Adjust: React.FC<{
  driverKey: keyof ValuationDrivers;
  drivers: ValuationDrivers;
  defaults: ValuationDrivers;
  onChange: (next: ValuationDrivers) => void;
  step?: number;
  suffix?: string;
  width?: string;
}> = ({ driverKey, drivers, defaults, onChange, step = 0.1, suffix = '%', width = 'w-20' }) => {
  const value = drivers[driverKey];
  const fallback = defaults[driverKey];
  const changed =
    value !== undefined && fallback !== undefined && Number(value) !== Number(fallback);

  if (value === undefined) return null;

  return (
    <span className="inline-flex items-baseline gap-1.5">
      <input
        type="number"
        step={step}
        value={Number(value)}
        onChange={(e) => {
          const next = e.target.value === '' ? 0 : Number(e.target.value);
          if (!isFinite(next)) return;
          onChange({ ...drivers, [driverKey]: next });
        }}
        className={`${width} bg-[#0B0B0D] border ${
          changed ? 'border-[#8B1E1E]' : 'border-[#222228]'
        } px-2 py-1 font-mono text-[14px] text-[#F2F0EA] text-right focus:outline-none focus:border-[#8B1E1E]`}
      />
      <span className="font-mono text-[13px] text-[#8A8A8F]">{suffix}</span>
      {changed && (
        <span className="font-mono text-[12px] text-[#8A8A8F]">
          was {String(fallback)}
          {suffix}
        </span>
      )}
    </span>
  );
};

interface Row {
  label: string;
  values?: any[];
  format?: (v: any) => string;
  bold?: boolean;
  indent?: boolean;
  muted?: boolean;
  accent?: boolean;
  adjuster?: React.ReactNode;
  note?: string;
  spacer?: boolean;
}

/** One schedule, rendered as a table with a year per column. */
const Schedule: React.FC<{
  title: string;
  subtitle?: string;
  years: (number | string)[];
  firstForecast: number;
  rows: Row[];
}> = ({ title, subtitle, years, firstForecast, rows }) => (
  <section className="mb-12">
    <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
      <h3 className="font-mono text-[13px] tracking-[0.2em] text-[#F2F0EA] uppercase">
        {title}
      </h3>
      {subtitle && (
        <span className="font-mono text-[12px] text-[#8A8A8F]">{subtitle}</span>
      )}
    </div>

    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] border-collapse">
        <thead>
          <tr className="border-b border-[#222228]">
            <th className="text-left font-mono text-[12px] tracking-[0.15em] text-[#8A8A8F] uppercase pb-2 pr-4 w-[34%]">
              &nbsp;
            </th>
            {years.map((year, i) => (
              <th
                key={String(year) + i}
                className={`text-right font-mono text-[12px] tracking-[0.15em] uppercase pb-2 px-2 ${
                  i >= firstForecast ? 'text-[#8B1E1E]' : 'text-[#8A8A8F]'
                }`}
              >
                {typeof year === 'number' ? `FY${String(year).slice(2)}` : year}
                {i === firstForecast && (
                  <span className="block text-[12px] tracking-normal normal-case text-[#8A8A8F]">
                    forecast
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => {
            if (row.spacer) {
              return (
                <tr key={`spacer-${ri}`}>
                  <td colSpan={years.length + 1} className="h-3" />
                </tr>
              );
            }
            const format = row.format || ((v: any) => fmt(v));
            return (
              <React.Fragment key={row.label + ri}>
                <tr
                  className={`border-b border-[#222228]/50 ${
                    row.bold ? 'bg-[#111114]' : ''
                  }`}
                >
                  <td
                    className={`py-2 pr-4 text-[14px] ${row.indent ? 'pl-4' : ''} ${
                      row.bold
                        ? 'text-[#F2F0EA] font-semibold'
                        : row.accent
                        ? 'text-[#8B1E1E]'
                        : row.muted
                        ? 'text-[#8A8A8F]'
                        : 'text-[#A1A1AA]'
                    }`}
                  >
                    <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span>{row.label}</span>
                      {row.adjuster}
                    </span>
                  </td>
                  {years.map((_, i) => (
                    <td
                      key={i}
                      className={`py-2 px-2 text-right font-mono text-[14px] ${
                        row.bold
                          ? 'text-[#F2F0EA] font-semibold'
                          : i >= firstForecast
                          ? 'text-[#A1A1AA]'
                          : 'text-[#F2F0EA]'
                      }`}
                    >
                      {row.values ? format(row.values[i]) : ''}
                    </td>
                  ))}
                </tr>
                {row.note && (
                  <tr>
                    <td
                      colSpan={years.length + 1}
                      className="pb-2 text-[13px] leading-relaxed text-[#8A8A8F]"
                    >
                      {row.note}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  </section>
);

// ---------------------------------------------------------------------------
// FULL SCREEN WRAPPER
// ---------------------------------------------------------------------------

export const FullScreenPanel: React.FC<{
  title: string;
  subtitle?: string;
  onClose: () => void;
  onExport?: () => void;
  children: React.ReactNode;
}> = ({ title, subtitle, onClose, onExport, children }) => (
  <div className="fixed inset-0 z-50 bg-[#0B0B0D] overflow-y-auto">
    <div className="sticky top-0 z-10 bg-[#0B0B0D]/95 backdrop-blur border-b border-[#222228]">
      <div className="max-w-[1440px] mx-auto px-5 sm:px-10 py-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-lg sm:text-2xl text-[#F2F0EA]">{title}</h2>
          {subtitle && (
            <p className="font-mono text-[12px] tracking-[0.15em] text-[#8A8A8F] uppercase mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {onExport && (
            <button
              type="button"
              onClick={onExport}
              className="inline-flex items-center gap-2 font-mono text-[13px] uppercase tracking-widest px-3 py-2 border border-[#8B1E1E] text-[#F2F0EA] bg-[#8B1E1E]/20 hover:bg-[#8B1E1E]/35 transition-colors"
              title="Download a working Excel model with live formulas"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Excel</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 font-mono text-[13px] uppercase tracking-widest px-3 py-2 border border-[#222228] text-[#8A8A8F] hover:text-[#F2F0EA] hover:border-[#8B1E1E] transition-colors"
          >
            <X className="w-4 h-4" />
            <span className="hidden sm:inline">Close</span>
          </button>
        </div>
      </div>
    </div>
    <div className="max-w-[1440px] mx-auto px-5 sm:px-10 py-8">{children}</div>
  </div>
);

// ---------------------------------------------------------------------------
// THREE STATEMENT MODEL
// ---------------------------------------------------------------------------

interface ViewProps {
  historicals?: any;
  model: any;
  dcf: any;
  source: any;
  drivers: ValuationDrivers;
  defaults: ValuationDrivers;
  onChange: (next: ValuationDrivers) => void;
  currencySymbol: string;
  unitLabel: string;
}

export const ThreeStatementView: React.FC<ViewProps> = ({
  historicals,
  model: M,
  source,
  drivers,
  defaults,
  onChange,
  unitLabel,
}) => {
  if (!M) return null;
  const years: number[] = M.years || [];
  const nH: number = M.nH;
  const A = (key: keyof ValuationDrivers, props: any = {}) => (
    <Adjust
      driverKey={key}
      drivers={drivers}
      defaults={defaults}
      onChange={onChange}
      {...props}
    />
  );
  const pct = (v: any) => fmtPct(v);

  const bs = M.balanceSheet || {};
  const wc = M.wc || {};
  const segments = M.segments || {};

  return (
    <>
      <p className="text-[15px] leading-relaxed text-[#8A8A8F] max-w-3xl mb-8">
        Every schedule the model builds, in the order the workbook builds them.
        Figures in {unitLabel}. Reported years are shown in white, forecast years
        in grey, and each assumption can be changed on the row it belongs to.
      </p>

      {historicals?.years?.length ? (
        <Schedule
          title="As reported, from the filings"
          subtitle="the published figures, before any modelling"
          years={historicals.years}
          firstForecast={historicals.years.length}
          rows={[
            { label: 'Revenue', values: historicals.revenue, bold: true },
            { label: 'Growth', values: historicals.revenueGrowth, format: (v: any) => (num(v) ? `${v}%` : '—'), indent: true, muted: true },
            { label: 'Gross margin', values: historicals.grossMargin, format: (v: any) => (num(v) ? `${v}%` : '—'), indent: true, muted: true },
            { label: 'EBITDA margin', values: historicals.ebitdaMargin, format: (v: any) => (num(v) ? `${v}%` : '—'), indent: true, muted: true },
            { label: 'Net income', values: historicals.netIncome },
            { label: 'Operating cash flow', values: historicals.operatingCashFlow },
            { label: 'Free cash flow', values: historicals.freeCashFlow, accent: true },
            { label: 'Total debt', values: historicals.totalDebt, indent: true },
            { label: 'Cash and equivalents', values: historicals.cashAndEquivalents, indent: true },
          ]}
        />
      ) : null}

      <Schedule
        title="Income statement"
        years={years}
        firstForecast={nH}
        rows={[
          { label: 'Revenue', values: M.revenue, bold: true },
          {
            label: 'Growth',
            values: M.revenueGrowth,
            format: pct,
            indent: true,
            muted: true,
            adjuster: A('revenueGrowthPct'),
          },
          { label: 'Cost of goods sold', values: M.cogs, indent: true },
          { label: 'Gross profit', values: M.grossProfit, bold: true },
          {
            label: 'Gross margin',
            values: M.grossMargin,
            format: pct,
            indent: true,
            muted: true,
            adjuster: A('operatingMarginPct'),
            note:
              'The operating margin adjuster works through gross margin: research and selling costs are held at their own percentages, so the gross margin is what moves to reach the operating margin you set.',
          },
          { spacer: true, label: '' },
          {
            label: 'Research and development',
            values: M.rnd,
            indent: true,
            adjuster: A('rndMarginPct'),
          },
          {
            label: 'Selling, general and administrative',
            values: M.sga,
            indent: true,
            adjuster: A('sgaMarginPct'),
          },
          { label: 'Operating profit (EBIT)', values: M.ebit, bold: true },
          { spacer: true, label: '' },
          { label: 'Interest income', values: M.interestIncome, indent: true },
          { label: 'Interest expense', values: M.interestExpense, indent: true },
          { label: 'Other income and expense', values: M.otherIncomeExpense, indent: true },
          { label: 'Profit before tax', values: M.pretaxProfit, bold: true },
          {
            label: 'Tax',
            values: M.taxes,
            indent: true,
            adjuster: A('taxRatePct'),
          },
          { label: 'Net income', values: M.netIncome, bold: true },
          { spacer: true, label: '' },
          { label: 'Depreciation and amortisation', values: M.depreciationAmortisation, indent: true, muted: true },
          { label: 'Stock based compensation', values: M.stockBasedCompensation, indent: true, muted: true },
          { label: 'EBITDA', values: M.ebitda, bold: true },
          { spacer: true, label: '' },
          { label: 'Basic shares', values: M.basicShares, indent: true, muted: true },
          { label: 'Diluted shares', values: M.dilutedShares, indent: true, muted: true },
          { label: 'Basic EPS', values: M.basicEPS, format: (v) => fmt(v, 2), indent: true },
          { label: 'Diluted EPS', values: M.dilutedEPS, format: (v) => fmt(v, 2), bold: true },
        ]}
      />

      {Object.keys(segments).length > 1 && (
        <Schedule
          title="Revenue by segment"
          years={years}
          firstForecast={nH}
          rows={Object.keys(segments).flatMap((name) => [
            { label: name, values: segments[name] },
            {
              label: `${name} growth`,
              values: (M.segmentGrowth || {})[name],
              format: pct,
              indent: true,
              muted: true,
            },
          ])}
        />
      )}

      <Schedule
        title="Balance sheet"
        subtitle="assets, then liabilities and equity, with the balance check"
        years={years}
        firstForecast={nH}
        rows={[
          { label: 'Cash and securities', values: bs.cashAndSecurities, indent: true },
          { label: 'Accounts receivable', values: bs.accountsReceivable, indent: true },
          { label: 'Inventory', values: bs.inventory, indent: true },
          { label: 'Deferred tax assets', values: bs.deferredTaxAssets, indent: true },
          { label: 'Other current assets', values: bs.otherCurrentAssets, indent: true },
          { label: 'Property, plant and equipment', values: bs.propertyPlantEquipment, indent: true },
          { label: 'Other assets', values: bs.otherAssets, indent: true },
          { label: 'Total assets', values: bs.totalAssets, bold: true },
          { spacer: true, label: '' },
          { label: 'Accounts payable', values: bs.accountsPayable, indent: true },
          { label: 'Accrued expenses', values: bs.accruedExpenses, indent: true },
          { label: 'Revolver', values: bs.revolver, indent: true },
          { label: 'Long term debt', values: bs.longTermDebt, indent: true },
          { label: 'Other non-current liabilities', values: bs.otherNonCurrentLiabilities, indent: true },
          { label: 'Total liabilities', values: bs.totalLiabilities, bold: true },
          { spacer: true, label: '' },
          { label: 'Common stock and paid-in capital', values: bs.commonStockAPIC, indent: true },
          { label: 'Treasury stock', values: bs.treasuryStock, indent: true },
          { label: 'Retained earnings', values: bs.retainedEarnings, indent: true },
          { label: 'Other comprehensive income', values: bs.otherComprehensiveIncome, indent: true },
          { label: 'Total equity', values: bs.totalEquity, bold: true },
          {
            label: 'Balance check (assets less liabilities and equity)',
            values: bs.balanceCheck,
            accent: true,
            note:
              'This row must be zero in every column. It is the model checking itself: if the balance sheet does not balance, something above it is wrong.',
          },
        ]}
      />

      <Schedule
        title="Working capital"
        subtitle="closing balances, with the ratios that drive the forecast"
        years={years}
        firstForecast={nH}
        rows={[
          { label: 'Accounts receivable', values: wc.accountsReceivable?.ending, indent: true },
          { label: 'Days sales outstanding', values: M.dso, format: (v) => fmt(v, 1), indent: true, muted: true },
          { label: 'Inventory', values: wc.inventory?.ending, indent: true },
          { label: 'Inventory turnover', values: M.inventoryTurnover, format: (v) => fmtX(v, 2), indent: true, muted: true },
          { label: 'Accounts payable', values: wc.accountsPayable?.ending, indent: true },
          { label: 'Days payable outstanding', values: M.dpo, format: (v) => fmt(v, 1), indent: true, muted: true },
          { label: 'Accrued expenses', values: wc.accruedExpenses?.ending, indent: true },
          { label: 'Other current assets', values: wc.otherCurrentAssets?.ending, indent: true },
          { label: 'Deferred tax assets', values: wc.deferredTaxAssets?.ending, indent: true },
          { label: 'Other assets', values: wc.otherAssets?.ending, indent: true },
          { label: 'Other non-current liabilities', values: wc.otherNonCurrentLiabilities?.ending, indent: true },
        ]}
      />

      <Schedule
        title="Property, plant and equipment"
        subtitle="opening balance, plus capex, less depreciation, equals closing"
        years={years}
        firstForecast={nH}
        rows={[
          { label: 'Opening balance', values: M.ppe?.beginning, indent: true },
          {
            label: 'Capital expenditure',
            values: M.ppe?.capex,
            indent: true,
            adjuster: A('capexPctOfRev'),
          },
          {
            label: 'Depreciation',
            values: M.ppe?.depreciation,
            indent: true,
            adjuster: A('depreciationPctOfCapex'),
          },
          { label: 'Closing balance', values: M.ppe?.ending, bold: true },
          {
            label: 'Depreciation as a share of capex',
            values: M.depreciationPercentOfCapex,
            format: pct,
            indent: true,
            muted: true,
          },
        ]}
      />

      <Schedule
        title="Debt"
        subtitle="including any interest rolled up rather than paid in cash"
        years={years}
        firstForecast={nH}
        rows={[
          { label: 'Opening balance', values: M.debt?.beginning, indent: true },
          { label: 'Borrowing and repayment', values: M.debt?.borrowing, indent: true },
          { label: 'Interest added to the balance', values: M.debt?.pikAccrual, indent: true },
          { label: 'Closing balance', values: M.debt?.ending, bold: true },
          { label: 'Interest expense', values: M.debt?.interestExpense, indent: true, muted: true },
          { label: 'Average rate', values: M.debt?.weightedAverageRate, format: pct, indent: true, muted: true },
          { spacer: true, label: '' },
          { label: 'Revolver opening', values: M.revolver?.beginning, indent: true },
          { label: 'Drawn or repaid', values: M.revolver?.change, indent: true },
          { label: 'Revolver closing', values: M.revolver?.ending, bold: true },
        ]}
      />

      <Schedule
        title="Equity"
        subtitle="common stock, retained earnings, treasury stock and other comprehensive income"
        years={years}
        firstForecast={nH}
        rows={[
          { label: 'Common stock opening', values: M.commonStock?.beginning, indent: true },
          { label: 'Shares issued', values: M.commonStock?.issuances, indent: true },
          { label: 'Stock based compensation', values: M.commonStock?.sbc, indent: true },
          { label: 'Common stock closing', values: M.commonStock?.ending, bold: true },
          { spacer: true, label: '' },
          { label: 'Retained earnings opening', values: M.retainedEarnings?.beginning, indent: true },
          { label: 'Net income', values: M.retainedEarnings?.netIncome, indent: true },
          {
            label: 'Dividends',
            values: M.retainedEarnings?.dividends,
            indent: true,
            adjuster: A('dividendPayoutPct'),
          },
          { label: 'Retained earnings closing', values: M.retainedEarnings?.ending, bold: true },
          { spacer: true, label: '' },
          { label: 'Treasury stock opening', values: M.treasury?.beginning, indent: true },
          { label: 'Share repurchases', values: M.treasury?.repurchases, indent: true },
          { label: 'Treasury stock closing', values: M.treasury?.ending, bold: true },
          { spacer: true, label: '' },
          { label: 'Other comprehensive income opening', values: M.oci?.beginning, indent: true },
          { label: 'Change in the year', values: M.oci?.change, indent: true },
          { label: 'Other comprehensive income closing', values: M.oci?.ending, bold: true },
        ]}
      />

      <Schedule
        title="Cash flow statement"
        years={years}
        firstForecast={nH}
        rows={[
          { label: 'Cash from operating activities', values: M.cashFlow?.operating, bold: true },
          { label: 'Cash from investing activities', values: M.cashFlow?.investing, bold: true },
          { label: 'Cash from financing activities', values: M.cashFlow?.financing, bold: true },
          { label: 'Net change in cash', values: M.cashFlow?.netChangeInCash, accent: true },
          { spacer: true, label: '' },
          { label: 'Cash opening', values: M.cash?.beginning, indent: true },
          { label: 'Cash closing', values: M.cash?.ending, bold: true },
        ]}
      />

      <Schedule
        title="Ratios"
        years={years}
        firstForecast={nH}
        rows={[
          { label: 'Net debt', values: M.ratios?.netDebt, indent: true },
          { label: 'Asset turnover', values: M.ratios?.assetTurnover, format: (v) => fmtX(v, 2), indent: true },
          { label: 'Net margin', values: M.ratios?.netMargin, format: pct, indent: true },
          { label: 'Return on assets', values: M.ratios?.roa, format: pct, indent: true },
          { label: 'Return on equity', values: M.ratios?.roe, format: pct, indent: true },
        ]}
      />

      {source?.meta?.circuitBreaker === 'ON' && (
        <p className="text-[14px] leading-relaxed text-[#8A8A8F] max-w-3xl border-t border-[#222228] pt-5">
          Circular references are switched off in this model. Interest is
          calculated on the debt balance rather than solved simultaneously with
          it, which avoids a loop that can oscillate instead of settling. The
          difference to the answer is small; the difference to whether the model
          can be trusted to converge is not.
        </p>
      )}
    </>
  );
};

// ---------------------------------------------------------------------------
// DCF MODEL
// ---------------------------------------------------------------------------

export const DCFView: React.FC<ViewProps> = ({
  model: M,
  dcf: D,
  source,
  drivers,
  defaults,
  onChange,
  currencySymbol,
  unitLabel,
}) => {
  if (!D || !D.applicable) {
    return (
      <p className="text-[14px] leading-relaxed text-[#A1A1AA] max-w-2xl">
        {D?.message ||
          'No discounted cash flow is shown for this company. The reported figures are unaffected.'}
      </p>
    );
  }

  const years: number[] = D.years || [];
  const A = (key: keyof ValuationDrivers, props: any = {}) => (
    <Adjust
      driverKey={key}
      drivers={drivers}
      defaults={defaults}
      onChange={onChange}
      {...props}
    />
  );
  const w = D.waccDetail || {};
  const money = (v: any, dp = 0) => (num(v) ? `${currencySymbol}${fmt(v, dp)}` : '—');

  return (
    <>
      <p className="text-[15px] leading-relaxed text-[#8A8A8F] max-w-3xl mb-8">
        The full discounted cash flow, in the order the workbook runs it.
        Figures in {unitLabel}. Every assumption can be changed on the row it
        belongs to, and the whole model recalculates as you do.
      </p>

      <Schedule
        title="Unlevered free cash flow"
        subtitle="what the business produces, before any interest"
        years={years}
        firstForecast={0}
        rows={[
          { label: 'EBITDA', values: D.ebitda, indent: true },
          { label: 'Operating profit (EBIT)', values: D.ebit, bold: true },
          {
            label: 'Tax at the effective rate',
            values: D.taxRate,
            format: (v) => fmtPct(v),
            indent: true,
            muted: true,
            adjuster: A('taxRatePct'),
          },
          { label: 'Operating profit after tax (EBIAT)', values: D.ebiat, bold: true },
          { spacer: true, label: '' },
          { label: 'Unlevered cash from operations', values: D.unleveredCFO, bold: true },
          {
            label: 'Capital expenditure',
            values: D.capex,
            indent: true,
            adjuster: A('capexPctOfRev'),
          },
          { label: 'Unlevered free cash flow', values: D.unleveredFCF, bold: true, accent: true },
          { spacer: true, label: '' },
          {
            label: 'Discount factor',
            values: D.discountFactor,
            format: (v) => fmt(v, 4),
            indent: true,
            muted: true,
          },
          { label: 'Present value', values: D.presentValue, bold: true },
        ]}
      />

      <section className="mb-12">
        <h3 className="font-mono text-[13px] tracking-[0.2em] text-[#F2F0EA] uppercase mb-1">
          The discount rate
        </h3>
        <p className="text-[14px] text-[#8A8A8F] mb-4 max-w-3xl">
          Built from the ground up rather than picked. Change beta, the
          risk-free rate or the market risk premium and the cost of equity, the
          weighted rate and every value on this page move with it.
        </p>

        <div className="border border-[#222228] divide-y divide-[#222228]">
          {[
            {
              label: 'Risk-free rate',
              value: fmtPct(w.riskFreeRate, 2),
              adjuster: A('riskFreeRatePct', { step: 0.05 }),
            },
            {
              label: 'Market risk premium',
              value: fmtPct(w.marketRiskPremium, 2),
              adjuster: A('marketRiskPremiumPct', { step: 0.05 }),
            },
            {
              label: 'Beta',
              value: num(w.beta) ? w.beta.toFixed(2) : '—',
              adjuster: A('betaValue', { step: 0.05, suffix: '' }),
              note:
                'How much the share moves relative to the market. Above one means it swings harder than the market does, so an investor demands a higher return for holding it.',
            },
            { label: 'Cost of equity', value: fmtPct(w.costOfEquity, 2) },
            { label: 'Cost of debt, after tax', value: fmtPct(w.afterTaxCostOfDebt, 2) },
            { label: 'Weight of equity', value: fmtPct(w.weightEquity, 1) },
            { label: 'Weight of debt', value: fmtPct(w.weightDebt, 1) },
            {
              label: 'Weighted average cost of capital',
              value: fmtPct(D.wacc, 3),
              bold: true,
            },
          ].map((line: any) => (
            <div key={line.label} className="px-4 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <span
                  className={`text-[15px] ${
                    line.bold ? 'text-[#F2F0EA] font-semibold' : 'text-[#A1A1AA]'
                  }`}
                >
                  {line.label}
                </span>
                <span className="flex items-baseline gap-4">
                  {line.adjuster}
                  <span
                    className={`font-mono text-[15px] ${
                      line.bold ? 'text-[#8B1E1E] font-semibold' : 'text-[#F2F0EA]'
                    }`}
                  >
                    {line.value}
                  </span>
                </span>
              </div>
              {line.note && (
                <p className="text-[13px] leading-relaxed text-[#8A8A8F] mt-1.5 max-w-2xl">
                  {line.note}
                </p>
              )}
            </div>
          ))}
        </div>

        {Array.isArray(w.comps) && w.comps.length > 0 && (
          <div className="mt-5">
            <div className="font-mono text-[12px] tracking-[0.2em] text-[#8A8A8F] uppercase mb-2">
              Comparable companies used to unlever beta
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse">
                <thead>
                  <tr className="border-b border-[#222228]">
                    {['Company', 'Equity beta', 'Debt / equity', 'Unlevered beta'].map((h) => (
                      <th
                        key={h}
                        className="text-right first:text-left font-mono text-[12px] tracking-[0.15em] text-[#8A8A8F] uppercase pb-2 px-2"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {w.comps.map((c: any, i: number) => (
                    <tr key={i} className="border-b border-[#222228]/50">
                      <td className="py-2 px-2 text-[14px] text-[#A1A1AA]">{c.name}</td>
                      <td className="py-2 px-2 text-right font-mono text-[14px] text-[#F2F0EA]">
                        {num(c.equityBeta) ? c.equityBeta.toFixed(2) : '—'}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-[14px] text-[#A1A1AA]">
                        {num(c.debtToEquity) ? c.debtToEquity.toFixed(2) : '—'}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-[14px] text-[#F2F0EA]">
                        {num(c.unleveredBeta) ? c.unleveredBeta.toFixed(2) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section className="mb-12 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border border-[#222228] p-5">
          <h3 className="font-mono text-[13px] tracking-[0.2em] text-[#F2F0EA] uppercase mb-4">
            Method one — growing forever
          </h3>
          {[
            {
              label: 'Growth after the forecast',
              value: fmtPct(D.longTermGrowthRate, 2),
              adjuster: A('terminalGrowthPct', { step: 0.1 }),
            },
            { label: 'Normalised free cash flow', value: money(D.normalisedFCF) },
            { label: 'Terminal value', value: money(D.terminalValuePerpetuity) },
            { label: 'Value of that today', value: money(D.pvTerminalPerpetuity) },
            { label: 'Value of the forecast years', value: money(D.pvStageOne) },
            { label: 'Enterprise value', value: money(D.enterpriseValuePerpetuity), bold: true },
            { label: 'Implied exit multiple', value: fmtX(D.impliedExitMultiple) },
            { label: 'Value per share', value: money(D.perpetuity?.valuePerShare, 2), bold: true },
          ].map((line: any) => (
            <div
              key={line.label}
              className="flex flex-wrap items-baseline justify-between gap-3 py-2 border-b border-[#222228]/50 last:border-0"
            >
              <span className={`text-[14px] ${line.bold ? 'text-[#F2F0EA]' : 'text-[#8A8A8F]'}`}>
                {line.label}
              </span>
              <span className="flex items-baseline gap-3">
                {line.adjuster}
                <span
                  className={`font-mono text-[14px] ${
                    line.bold ? 'text-[#8B1E1E] font-semibold' : 'text-[#F2F0EA]'
                  }`}
                >
                  {line.value}
                </span>
              </span>
            </div>
          ))}
        </div>

        <div className="border border-[#222228] p-5">
          <h3 className="font-mono text-[13px] tracking-[0.2em] text-[#F2F0EA] uppercase mb-4">
            Method two — sold at the end
          </h3>
          {[
            {
              label: 'Exit multiple of EBITDA',
              value: fmtX(D.exitMultiple),
              adjuster: A('exitMultipleX', { step: 0.5, suffix: 'x' }),
            },
            { label: 'Terminal year EBITDA', value: money(D.terminalEBITDA) },
            { label: 'Terminal value', value: money(D.terminalValueMultiple) },
            { label: 'Value of that today', value: money(D.pvTerminalMultiple) },
            { label: 'Value of the forecast years', value: money(D.pvStageOne) },
            { label: 'Enterprise value', value: money(D.enterpriseValueMultiple), bold: true },
            { label: 'Implied perpetual growth', value: fmtPct(D.impliedPerpetualGrowth, 2) },
            {
              label: 'Value per share',
              value: money(D.exitMultipleValuation?.valuePerShare, 2),
              bold: true,
            },
          ].map((line: any) => (
            <div
              key={line.label}
              className="flex flex-wrap items-baseline justify-between gap-3 py-2 border-b border-[#222228]/50 last:border-0"
            >
              <span className={`text-[14px] ${line.bold ? 'text-[#F2F0EA]' : 'text-[#8A8A8F]'}`}>
                {line.label}
              </span>
              <span className="flex items-baseline gap-3">
                {line.adjuster}
                <span
                  className={`font-mono text-[14px] ${
                    line.bold ? 'text-[#8B1E1E] font-semibold' : 'text-[#F2F0EA]'
                  }`}
                >
                  {line.value}
                </span>
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* The two methods do not agree, and the published figure is the average
          of them. Showing that arithmetic here, rather than only the two halves
          above, means the headline number can be checked in one place. */}
      <section className="mb-12">
        <h3 className="font-mono text-[13px] tracking-[0.2em] text-[#F2F0EA] uppercase mb-1">
          The two methods, weighted equally
        </h3>
        <p className="text-[14px] text-[#8A8A8F] mb-4 max-w-3xl">
          Neither method is more correct than the other, so each carries half
          the weight. This is the figure published at the top of the company
          page.
        </p>
        <div className="border border-[#222228] divide-y divide-[#222228]">
          {[
            {
              label: 'Growing forever, at 50%',
              value: money(D.perpetuity?.valuePerShare, 2),
              weight: '50%',
            },
            {
              label: 'Sold at the end, at 50%',
              value: money(D.exitMultipleValuation?.valuePerShare, 2),
              weight: '50%',
            },
            {
              label: 'Weighted average — the published value',
              value:
                num(D.perpetuity?.valuePerShare) &&
                num(D.exitMultipleValuation?.valuePerShare)
                  ? money(
                      (D.perpetuity.valuePerShare +
                        D.exitMultipleValuation.valuePerShare) /
                        2,
                      2
                    )
                  : '—',
              bold: true,
            },
            {
              label: 'Spread between the two methods',
              value:
                num(D.perpetuity?.valuePerShare) &&
                num(D.exitMultipleValuation?.valuePerShare) &&
                D.perpetuity.valuePerShare > 0
                  ? `${(
                      (Math.abs(
                        D.exitMultipleValuation.valuePerShare -
                          D.perpetuity.valuePerShare
                      ) /
                        ((D.exitMultipleValuation.valuePerShare +
                          D.perpetuity.valuePerShare) /
                          2)) *
                      100
                    ).toFixed(1)}%`
                  : '—',
              note:
                'How far apart the two methods land. A wide spread means the answer depends heavily on which view of the future you take, and the average should be treated with more caution.',
            },
          ].map((line: any) => (
            <div key={line.label} className="px-4 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <span
                  className={`text-[15px] ${
                    line.bold ? 'text-[#F2F0EA] font-semibold' : 'text-[#A1A1AA]'
                  }`}
                >
                  {line.label}
                </span>
                <span
                  className={`font-mono text-[15px] ${
                    line.bold ? 'text-[#8B1E1E] font-semibold' : 'text-[#F2F0EA]'
                  }`}
                >
                  {line.value}
                </span>
              </div>
              {line.note && (
                <p className="text-[13px] leading-relaxed text-[#8A8A8F] mt-1.5 max-w-2xl">
                  {line.note}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="mb-12">
        <h3 className="font-mono text-[13px] tracking-[0.2em] text-[#F2F0EA] uppercase mb-1">
          From the whole company to one share
        </h3>
        <p className="text-[14px] text-[#8A8A8F] mb-4 max-w-3xl">
          A shareholder does not own the debt, so it comes off, and the cash in
          the bank goes on.
        </p>
        <div className="border border-[#222228] divide-y divide-[#222228]">
          {[
            { label: 'Enterprise value', value: money(D.perpetuity?.enterpriseValue) },
            {
              label: D.netDebt < 0 ? 'Plus net cash' : 'Less net debt',
              value: money(Math.abs(D.netDebt)),
            },
            { label: 'Equity value', value: money(D.perpetuity?.equityValue), bold: true },
            { label: 'Diluted shares', value: fmt(D.dilutedShares, 1) },
            {
              label: 'Value per share',
              value: money(D.perpetuity?.valuePerShare, 2),
              bold: true,
            },
            { label: 'Market price', value: money(D.marketPrice, 2) },
          ].map((line: any) => (
            <div
              key={line.label}
              className="px-4 py-3 flex flex-wrap items-baseline justify-between gap-3"
            >
              <span className={`text-[15px] ${line.bold ? 'text-[#F2F0EA]' : 'text-[#A1A1AA]'}`}>
                {line.label}
              </span>
              <span
                className={`font-mono text-[15px] ${
                  line.bold ? 'text-[#8B1E1E] font-semibold' : 'text-[#F2F0EA]'
                }`}
              >
                {line.value}
              </span>
            </div>
          ))}
        </div>
      </section>

      {D.sensitivity?.perpetuity && D.sensitivityAxes && (
        <section className="mb-4">
          <h3 className="font-mono text-[13px] tracking-[0.2em] text-[#F2F0EA] uppercase mb-1">
            Sensitivity
          </h3>
          <p className="text-[14px] text-[#8A8A8F] mb-4 max-w-3xl">
            Value per share as the discount rate and the terminal assumption
            move. The centre cell is the base case.
          </p>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {[
              {
                title: 'Growing forever',
                grid: D.sensitivity.perpetuity,
                axis: D.sensitivityAxes.growth,
                label: (v: number) => fmtPct(v, 1),
              },
              {
                title: 'Sold at the end',
                grid: D.sensitivity.exitMultiple,
                axis: D.sensitivityAxes.multiple,
                label: (v: number) => fmtX(v, 1),
              },
            ].map((block) => (
              <div key={block.title} className="overflow-x-auto">
                <div className="font-mono text-[12px] text-[#8A8A8F] uppercase tracking-widest mb-2">
                  {block.title}
                </div>
                <table className="w-full min-w-[420px] border-collapse">
                  <thead>
                    <tr>
                      <th className="font-mono text-[12px] text-[#8A8A8F] p-1.5 text-left">
                        WACC
                      </th>
                      {(block.axis || []).map((a: number, i: number) => (
                        <th
                          key={i}
                          className="font-mono text-[12px] text-[#8A8A8F] p-1.5 text-right"
                        >
                          {block.label(a)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(block.grid || []).map((row: number[], ri: number) => (
                      <tr key={ri}>
                        <td className="font-mono text-[12px] text-[#8A8A8F] p-1.5">
                          {fmtPct(D.sensitivityAxes.wacc?.[ri], 2)}
                        </td>
                        {row.map((cell, ci) => {
                          const centre =
                            ri === Math.floor((block.grid.length - 1) / 2) &&
                            ci === Math.floor((row.length - 1) / 2);
                          return (
                            <td
                              key={ci}
                              className={`font-mono text-[13px] p-1.5 text-right border ${
                                centre
                                  ? 'border-[#F2F0EA] text-[#F2F0EA]'
                                  : 'border-[#222228] text-[#A1A1AA]'
                              }`}
                            >
                              {num(cell) && cell > 0 ? money(cell, 0) : '—'}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
};

export default { FullScreenPanel, ThreeStatementView, DCFView, Adjust };