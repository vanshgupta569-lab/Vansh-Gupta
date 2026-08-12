// Marginalia — ratio calculations
//
// Every ratio on the dashboard is computed here, from reported figures only,
// with the formula written down next to it. Nothing in this file uses the share
// price, so nothing here moves when the market does.
//
// WHY THESE RATIOS
//
// The working capital ratios come from the set Vansh chose. They are the right
// ratios for a business that holds inventory and owes suppliers, and they are
// blank for one that does not. A software company carries no inventory, so its
// inventory days and cash conversion cycle are not zero, they are meaningless,
// and this file returns null so the dashboard can leave them out rather than
// print a confident nought.
//
// The returns, balance sheet and earnings quality ratios are added because they
// compute for every company, so the block is never empty whatever gets typed
// into the search box.
//
// CONVENTIONS
//
// Balances are YEAR END, not averages. That matches both the hand-built Excel
// workbook and Screener, which is what a reader is most likely to compare
// against. Days ratios use a 365-day year.
//
// Days payable is measured against REVENUE, not COGS. The textbook and Screener
// both use COGS. The Excel workbook (row 127) uses revenue, and the site should
// never print a different number from the workbook it is built on. The formula
// is shown on screen so nobody has to guess which convention is in use.

const DAYS = 365;

const isNum = (v) => typeof v === 'number' && isFinite(v);

// Divide, but return null rather than Infinity or NaN when the denominator is
// missing or zero. A ratio that cannot be computed is an absence, not a value.
function ratio(numerator, denominator) {
  if (!isNum(numerator) || !isNum(denominator) || denominator === 0) return null;
  const result = numerator / denominator;
  return isFinite(result) ? result : null;
}

function round(value, dp = 1) {
  if (!isNum(value)) return null;
  const f = Math.pow(10, dp);
  return Math.round(value * f) / f;
}

// ---------------------------------------------------------------------------
// THE RATIOS
// ---------------------------------------------------------------------------
// Each entry carries its own formula text. The dashboard prints that text, so a
// reader can check the arithmetic rather than trust the label. `optional: true`
// marks a ratio that legitimately does not apply to some businesses.
//
// `reportedOnly: true` marks a ratio that is only shown for years the company
// actually reported. The forecast balance sheet accumulates cash: with the
// circuit breaker on there is no revolver interest, and buybacks and dividends
// are held at historical rates while profits keep arriving, so cash climbs year
// after year. That is a known consequence of how the model is built, not a
// forecast that the company will hoard cash. Carrying net debt / EBITDA, the
// current ratio or cash realisation into those years would dress the artifact
// up as a finding.

export const RATIO_DEFINITIONS = [
  {
    key: 'operatingMargin',
    label: 'Operating margin',
    group: 'Returns',
    unit: '%',
    formula: 'operating profit / revenue',
    compute: (p) => {
      const value = ratio(p.operatingIncome, p.revenue);
      return value === null ? null : value * 100;
    },
  },
  {
    key: 'roce',
    label: 'ROCE',
    group: 'Returns',
    unit: '%',
    formula: 'operating profit / (total assets - current liabilities)',
    note:
      'Return on capital employed. Measured on the capital the business uses, ' +
      'regardless of how that capital was financed, which is the same unlevered ' +
      'basis the valuation runs on. Screener publishes a ROCE figure too; its ' +
      'denominator is not disclosed precisely, so the two will not always agree.',
    compute: (p) => {
      const capitalEmployed =
        isNum(p.totalAssets) && isNum(p.currentLiabilities)
          ? p.totalAssets - p.currentLiabilities
          : null;
      const value = ratio(p.operatingIncome, capitalEmployed);
      return value === null ? null : value * 100;
    },
  },
  {
    key: 'netDebtToEbitda',
    reportedOnly: true,
    label: 'Net debt / EBITDA',
    group: 'Balance sheet',
    unit: 'x',
    formula: '(debt - cash) / (operating profit + depreciation)',
    compute: (p) => {
      const netDebt =
        isNum(p.debt) && isNum(p.cash) ? p.debt - p.cash : null;
      const ebitda =
        isNum(p.operatingIncome) && isNum(p.depreciation)
          ? p.operatingIncome + p.depreciation
          : p.operatingIncome;
      return ratio(netDebt, ebitda);
    },
    format: (v) => (v === null ? null : v < 0 ? `${round(Math.abs(v), 2)}x net cash` : `${round(v, 2)}x`),
  },
  {
    key: 'currentRatio',
    reportedOnly: true,
    label: 'Current ratio',
    group: 'Balance sheet',
    unit: 'x',
    formula: 'current assets / current liabilities',
    compute: (p) => ratio(p.currentAssets, p.currentLiabilities),
    dp: 2,
  },
  {
    key: 'cashRealisation',
    reportedOnly: true,
    label: 'Cash realisation',
    group: 'Earnings quality',
    unit: 'x',
    formula: 'operating cash flow / net income',
    note:
      'How much of the reported profit arrived as cash. Persistently below 1 ' +
      'means earnings are being recognised ahead of collection.',
    compute: (p) => ratio(p.operatingCashFlow, p.netIncome),
    dp: 2,
  },
  {
    key: 'debtorDays',
    label: 'Debtor days',
    group: 'Working capital',
    unit: 'days',
    formula: 'receivables / revenue x 365',
    optional: true,
    compute: (p) => {
      const value = ratio(p.receivables, p.revenue);
      return value === null ? null : value * DAYS;
    },
    dp: 0,
  },
  {
    key: 'inventoryDays',
    label: 'Inventory days',
    group: 'Working capital',
    unit: 'days',
    formula: 'inventory / cost of goods sold x 365',
    optional: true,
    compute: (p) => {
      // A business with no inventory has no inventory days. Returning null
      // keeps it off the screen instead of printing a confident zero.
      if (!isNum(p.inventory) || p.inventory === 0) return null;
      const value = ratio(p.inventory, p.cogs);
      return value === null ? null : value * DAYS;
    },
    dp: 0,
  },
  {
    key: 'daysPayable',
    label: 'Days payable',
    group: 'Working capital',
    unit: 'days',
    formula: 'payables / revenue x 365',
    note:
      'Measured against revenue, matching the hand-built Excel workbook. ' +
      'Screener and most textbooks divide by cost of goods sold instead, which ' +
      'gives a higher number for the same company.',
    optional: true,
    compute: (p) => {
      const value = ratio(p.payables, p.revenue);
      return value === null ? null : value * DAYS;
    },
    dp: 0,
  },
  {
    key: 'cashConversionCycle',
    label: 'Cash conversion cycle',
    group: 'Working capital',
    unit: 'days',
    formula: 'debtor days + inventory days - days payable',
    note:
      'How long cash is tied up between paying for goods and being paid for ' +
      'them. A negative figure means the company collects from its customers ' +
      'before it settles with its suppliers, which is a strength, not an error.',
    optional: true,
    compute: (p, computed) => {
      const { debtorDays, inventoryDays, daysPayable } = computed;
      if (!isNum(debtorDays) || !isNum(inventoryDays) || !isNum(daysPayable)) {
        return null;
      }
      return debtorDays + inventoryDays - daysPayable;
    },
    dp: 0,
  },
];

// ---------------------------------------------------------------------------
// COMPUTING A PERIOD
// ---------------------------------------------------------------------------

/**
 * Ratios for one period. `period` is the normalised shape produced by the
 * adapters below. Returns { key: { value, display } } with null for anything
 * that cannot be computed from what the filing provided.
 */
export function ratiosForPeriod(period) {
  const values = {};
  const output = {};

  for (const definition of RATIO_DEFINITIONS) {
    const raw = definition.compute(period, values);
    const dp = definition.dp === undefined ? 1 : definition.dp;
    const value = round(raw, dp);
    values[definition.key] = value;

    output[definition.key] = {
      value,
      display:
        value === null
          ? null
          : definition.format
          ? definition.format(raw)
          : definition.unit === '%'
          ? `${value}%`
          : definition.unit === 'x'
          ? `${value}x`
          : `${value}`,
    };
  }

  return output;
}

/**
 * Ratios across every reported year, straight from the filings.
 * Returns { periods: [{ label, ratios }], applicable: { key: bool } }.
 *
 * `applicable` says whether a ratio computed in ANY year. The dashboard uses it
 * to drop the working capital rows entirely for a company that has no
 * inventory, rather than showing a row of dashes.
 */
export function reportedRatios(statements) {
  const rows = Array.isArray(statements) ? statements : [];

  const periods = rows.map((row) => ({
    label: 'FY' + String(row.fiscalYear).slice(2),
    fiscalYear: row.fiscalYear,
    ratios: ratiosForPeriod({
      revenue: row.revenue,
      cogs: row.cogs,
      operatingIncome: row.operatingIncome,
      depreciation: row.depreciation,
      netIncome: row.netIncome,
      operatingCashFlow: row.operatingCashFlow,
      receivables: row.receivables,
      inventory: row.inventory,
      payables: row.payables,
      currentAssets: row.currentAssets,
      currentLiabilities: row.currentLiabilities,
      totalAssets: row.totalAssets,
      cash: row.cash,
      debt: row.longTermDebt,
    }),
  }));

  const applicable = {};
  for (const definition of RATIO_DEFINITIONS) {
    applicable[definition.key] = periods.some(
      (period) => period.ratios[definition.key]?.value !== null
    );
  }

  return { periods, applicable };
}

/**
 * The same ratios for the FORECAST years, read off the engine's own schedules.
 *
 * This is the part a free screener cannot do. Screener stops at the last filed
 * year; because the engine builds the working capital, PP&E and debt schedules
 * forward, the same ratios can be carried into the forecast, so a reader can
 * see whether the forecast quietly assumes the business gets better at
 * collecting cash than it has ever been.
 *
 * `M` is the object returned by buildModel.
 */
export function forecastRatios(M, forecastYears) {
  if (!M || !Array.isArray(forecastYears) || forecastYears.length === 0) {
    return { periods: [], applicable: {} };
  }

  const nH = M.nH;
  const at = (series, i) => (Array.isArray(series) && isNum(series[i]) ? series[i] : null);

  const periods = forecastYears.map((year, offset) => {
    const i = nH + offset;
    const b = M.balanceSheet || {};

    const currentAssets =
      (at(b.cashAndSecurities, i) ?? 0) +
      (at(b.accountsReceivable, i) ?? 0) +
      (at(b.inventory, i) ?? 0) +
      (at(b.otherCurrentAssets, i) ?? 0) +
      (at(b.deferredTaxAssets, i) ?? 0);

    const currentLiabilities =
      (at(b.accountsPayable, i) ?? 0) +
      (at(b.accruedExpenses, i) ?? 0) +
      (at(b.revolver, i) ?? 0);

    const totalAssets =
      currentAssets +
      (at(b.propertyPlantEquipment, i) ?? 0) +
      (at(b.otherAssets, i) ?? 0);

    // The engine holds costs as negatives; the ratio formulas expect them
    // positive, matching how the filings arrive.
    const cogs = at(M.cogs, i) === null ? null : Math.abs(at(M.cogs, i));

    return {
      label: 'FY' + String(year).slice(2),
      fiscalYear: year,
      forecast: true,
      ratios: ratiosForPeriod({
        revenue: at(M.revenue, i),
        cogs,
        operatingIncome: at(M.ebit, i),
        depreciation: at(M.depreciationAmortisation, i),
        netIncome: at(M.netIncome, i),
        // The engine does not carry a single operating cash flow line, so cash
        // realisation is left out of the forecast rather than approximated.
        operatingCashFlow: null,
        receivables: at(b.accountsReceivable, i),
        inventory: at(b.inventory, i),
        payables: at(b.accountsPayable, i),
        currentAssets,
        currentLiabilities,
        totalAssets,
        cash: at(b.cashAndSecurities, i),
        debt: (at(b.longTermDebt, i) ?? 0) + (at(b.revolver, i) ?? 0),
      }),
    };
  });

  // Blank out the ratios that only mean something for a reported year.
  for (const period of periods) {
    for (const definition of RATIO_DEFINITIONS) {
      if (definition.reportedOnly) {
        period.ratios[definition.key] = { value: null, display: null };
      }
    }
  }

  const applicable = {};
  for (const definition of RATIO_DEFINITIONS) {
    applicable[definition.key] = periods.some(
      (period) => period.ratios[definition.key]?.value !== null
    );
  }

  return { periods, applicable };
}

export default { RATIO_DEFINITIONS, ratiosForPeriod, reportedRatios, forecastRatios };