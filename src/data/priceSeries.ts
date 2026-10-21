// FILE: src/data/priceSeries.ts
//
// THE PRICE HISTORY, AND THE RATIOS DRAWN OVER IT.
//
// The payload now carries the daily closes the quote fetch was already
// downloading and throwing away (`payloadVersion.ts` v5): ten years daily, then
// monthly back to the start, AS THE EXCHANGE QUOTED THEM. Two things follow.
//
// 1. CONVERSION HAPPENS HERE, AT THE ONE DISCLOSED RATE. A company can file in
//    one currency and trade in another; the price on the page is converted at
//    the single rate fetched with it (`METHODOLOGY.md` S3), and the series has
//    to be converted the same way or the chart would be in one currency and the
//    figure above it in another. One rate across ten years is a real
//    limitation, bounded and recorded in `DATA_CONSTRAINTS.md`; it scales the
//    whole series by a constant, so the SHAPE of the line is untouched.
//
// 2. EVERY OVERLAY IS COMPUTED FROM OUR OWN FIGURES, NEVER FETCHED. A price
//    divided by the earnings in the filing that was the latest one on that day.
//    So each point knows which filing it used and says so, and a date before
//    the earliest filing we hold has NO point rather than a point carried back
//    from a filing that did not exist yet. That is the difference between a
//    ratio history and a line that merely looks like one.
//
// THE FILING IN EFFECT IS DATED FROM ITS PERIOD END, not from the day it was
// published, because the payload does not carry a filing date. That is a
// disclosed simplification and the page says so: for the weeks between a
// company's year end and its annual report, this shows a ratio on figures the
// market did not have yet.

import type { FilingRef } from './companyOverview';

const isNum = (v: unknown): v is number => typeof v === 'number' && isFinite(v);

export type RangeKey = '1M' | '6M' | '1Y' | '3Y' | '5Y' | '10Y' | 'MAX';

export const RANGES: { key: RangeKey; label: string; days: number | null }[] = [
  { key: '1M', label: '1M', days: 31 },
  { key: '6M', label: '6M', days: 183 },
  { key: '1Y', label: '1Y', days: 366 },
  { key: '3Y', label: '3Y', days: 3 * 366 },
  { key: '5Y', label: '5Y', days: 5 * 366 },
  { key: '10Y', label: '10Y', days: 10 * 366 },
  { key: 'MAX', label: 'Max', days: null },
];

export interface PricePoint {
  date: string;
  /** The close, in the reporting currency the rest of the page is in. */
  value: number;
}

export interface PriceSeries {
  points: PricePoint[];
  /** 'daily' or 'monthly' — which of the two stored series this came from. */
  grain: 'daily' | 'monthly';
  currency: string | null;
  /** The currency the exchange quoted, when it is not the one above. */
  quotedCurrency: string | null;
  /** The rate applied to every point, or 1 where none was needed. */
  convertedAt: number;
  source: string;
  /** Set when there is nothing to draw, and then `points` is empty. */
  missing: string | null;
}

const EMPTY = (missing: string): PriceSeries => ({
  points: [],
  grain: 'daily',
  currency: null,
  quotedCurrency: null,
  convertedAt: 1,
  source: 'none',
  missing,
});

/**
 * The stored series for a range, converted and ready to draw.
 *
 * "Max" reads the monthly series because that is what the source gives for a
 * full history — measured on 2026-10-22, asking Yahoo for `max` at a daily
 * interval returns monthly points anyway (169 for Apple's 42 years), so storing
 * it as monthly says what it is instead of calling monthly data daily. Every
 * other range reads the daily series, and falls back to monthly when the daily
 * one does not reach that far back.
 */
export function priceSeries(payload: any, range: RangeKey = '1Y'): PriceSeries {
  const history = payload?.quote?.history;
  if (!history) {
    return EMPTY(
      'This company’s price history was fetched before the site started keeping it. Reload to fetch it again.'
    );
  }
  const spec = RANGES.find((r) => r.key === range) ?? RANGES[2];
  const daily = history.daily;
  const monthly = history.monthly;

  // Which stored series answers this range.
  let chosen = spec.days === null ? monthly ?? daily : daily ?? monthly;
  let grain: 'daily' | 'monthly' = chosen === monthly ? 'monthly' : 'daily';
  if (!chosen?.dates?.length) {
    chosen = daily ?? monthly;
    grain = chosen === monthly ? 'monthly' : 'daily';
  }
  if (!chosen?.dates?.length) return EMPTY('No price history came back for this listing.');

  // A RANGE LONGER THAN THE DAILY SERIES FALLS BACK rather than drawing ten
  // years of a three-year line and letting the axis imply the rest.
  const endOf = (s: any) => Date.parse(`${s?.dates?.[s.dates.length - 1]}T00:00:00Z`);
  if (spec.days !== null && grain === 'daily' && monthly?.dates?.length) {
    const firstDaily = Date.parse(`${chosen.dates[0]}T00:00:00Z`);
    const want = endOf(chosen) - spec.days * 86400000;
    if (isFinite(firstDaily) && firstDaily > want + 30 * 86400000) {
      chosen = monthly;
      grain = 'monthly';
    }
  }

  // A RANGE IS MEASURED BACK FROM THE LAST CLOSE, NOT FROM THE CLOCK.
  //
  // "1Y" means the last year of trading this company has, which is what a
  // reader of a price chart means by it. Measuring back from today instead
  // makes the window shrink as the payload ages — a set fetched a month ago
  // would answer "1Y" with eleven months and label it a year — and it makes
  // every measurement over the set depend on the day it was run.
  const last = endOf(chosen);
  const cutoff = spec.days === null || !isFinite(last) ? -Infinity : last - spec.days * 86400000;
  const conversion = payload?.priceConversion ?? null;
  const rate = conversion?.converted && isNum(conversion.rate) ? conversion.rate : 1;

  const points: PricePoint[] = [];
  for (let i = 0; i < chosen.dates.length; i++) {
    const date = chosen.dates[i];
    const close = chosen.closes?.[i];
    if (!isNum(close)) continue;
    const at = Date.parse(`${date}T00:00:00Z`);
    if (!isFinite(at) || at < cutoff) continue;
    points.push({ date, value: close * rate });
  }

  if (!points.length) {
    return EMPTY(`No prices were recorded in the last ${spec.label === 'Max' ? 'period' : spec.label}.`);
  }

  return {
    points,
    grain,
    currency: payload?.currency ?? null,
    quotedCurrency: history.currency ?? null,
    convertedAt: rate,
    source: history.source || 'Yahoo Finance (chart)',
    missing: null,
  };
}

// ---------------------------------------------------------------------------
// THE OVERLAYS
// ---------------------------------------------------------------------------

export type OverlayKey = 'pe' | 'pb' | 'evEbitda' | 'mcapSales' | 'salesMargin';

export interface OverlayPoint {
  date: string;
  value: number;
  /** The filing this point divided by. Every point carries one. */
  filing: FilingRef;
}

export interface OverlayLine {
  label: string;
  unit: 'multiple' | 'percent' | 'currency';
  points: OverlayPoint[];
}

export interface Overlay {
  key: OverlayKey;
  label: string;
  formula: string;
  note: string;
  lines: OverlayLine[];
  /** Set when nothing could be drawn, and then `lines` is empty. */
  missing: string | null;
}

export const OVERLAYS: { key: OverlayKey; label: string }[] = [
  { key: 'pe', label: 'P / E' },
  { key: 'pb', label: 'P / B' },
  { key: 'evEbitda', label: 'EV / EBITDA' },
  { key: 'mcapSales', label: 'Market cap / sales' },
  { key: 'salesMargin', label: 'Sales and margin' },
];

/** The filings, oldest first, with the fields an overlay divides by. */
interface Filed {
  filing: FilingRef;
  at: number;
  shares: number | null;
  netIncome: number | null;
  equity: number | null;
  revenue: number | null;
  ebitda: number | null;
  operatingMargin: number | null;
  netDebt: number | null;
}

function filedFigures(statements: any[]): Filed[] {
  const rows = Array.isArray(statements) ? statements : [];
  const out: Filed[] = [];
  for (const row of rows) {
    const at = Date.parse(`${row?.periodEnd}T00:00:00Z`);
    if (!isFinite(at)) continue;

    // NET DEBT AS THE ENGINE DEFINES IT (`METHODOLOGY.md` S15): the debt on the
    // balance sheet including leases, less cash and the short-term securities
    // held with it. Long-term securities are not netted off here either.
    const debt = isNum(row.totalDebtReported)
      ? row.totalDebtReported
      : [row.longTermDebtAndLease ?? row.longTermDebt, row.currentDebtAndLease ?? row.currentDebt].some(isNum)
        ? (isNum(row.longTermDebtAndLease ?? row.longTermDebt) ? (row.longTermDebtAndLease ?? row.longTermDebt) : 0) +
          (isNum(row.currentDebtAndLease ?? row.currentDebt) ? (row.currentDebtAndLease ?? row.currentDebt) : 0)
        : null;
    const cash = isNum(row.cashAndShortTermInvestments) ? row.cashAndShortTermInvestments : isNum(row.cash) ? row.cash : null;

    const ebitda =
      isNum(row.operatingIncome) && isNum(row.depreciation)
        ? row.operatingIncome + row.depreciation
        : null;

    out.push({
      filing: {
        fiscalYear: isNum(row.fiscalYear) ? row.fiscalYear : null,
        periodEnd: typeof row.periodEnd === 'string' ? row.periodEnd : null,
      },
      at,
      shares: isNum(row.dilutedShares) && row.dilutedShares > 0 ? row.dilutedShares : null,
      netIncome: isNum(row.netIncome) ? row.netIncome : null,
      equity: isNum(row.equity) ? row.equity : null,
      revenue: isNum(row.revenue) && row.revenue !== 0 ? row.revenue : null,
      ebitda,
      operatingMargin:
        isNum(row.operatingIncome) && isNum(row.revenue) && row.revenue !== 0
          ? (row.operatingIncome / row.revenue) * 100
          : null,
      netDebt: debt === null || cash === null ? null : debt - cash,
    });
  }
  return out.sort((a, b) => a.at - b.at);
}

/**
 * The filing that was the latest one as at `at`, or null before the first.
 *
 * NULL IS THE POINT. A chart that carried today's earnings back across ten
 * years would show a price-to-earnings line for 2017 built on a 2026 filing,
 * which is not a historical ratio, it is one number drawn as a curve.
 */
function filedAsAt(filed: Filed[], at: number): Filed | null {
  let found: Filed | null = null;
  for (const f of filed) {
    if (f.at <= at) found = f;
    else break;
  }
  return found;
}

/**
 * One overlay, computed from this company's own filings against its own prices.
 *
 * `prices` is the sliced series, so an overlay is only ever computed for the
 * window on screen.
 */
export function overlayFor(payload: any, key: OverlayKey, prices: PriceSeries): Overlay {
  const filed = filedFigures(payload?.statements);
  const meta = OVERLAYS.find((o) => o.key === key)!;
  const empty = (missing: string): Overlay => ({
    key,
    label: meta.label,
    formula: '',
    note: '',
    lines: [],
    missing,
  });

  if (!filed.length) return empty('The filings carry no period end dates, so nothing can be placed against a date.');

  // SALES AND MARGIN IS NOT A PRICE RATIO. It is the two figures themselves,
  // one point per filing, so it is built from the filings rather than from the
  // price series — and it is drawn as steps, because a company does not earn
  // its way smoothly from one year end to the next.
  if (key === 'salesMargin') {
    const sales = filed
      .filter((f) => f.revenue !== null && f.filing.periodEnd)
      .map((f) => ({ date: f.filing.periodEnd as string, value: f.revenue as number, filing: f.filing }));
    const margin = filed
      .filter((f) => f.operatingMargin !== null && f.filing.periodEnd)
      .map((f) => ({ date: f.filing.periodEnd as string, value: f.operatingMargin as number, filing: f.filing }));
    if (!sales.length && !margin.length) {
      return empty('The filings report neither revenue nor an operating profit for any year held.');
    }
    return {
      key,
      label: meta.label,
      formula: 'revenue, and operating profit ÷ revenue',
      note: 'One point per filed year, at that year’s end. Not interpolated between them.',
      lines: [
        { label: 'Sales', unit: 'currency', points: sales },
        { label: 'Operating margin', unit: 'percent', points: margin },
      ].filter((l) => l.points.length) as OverlayLine[],
      missing: null,
    };
  }

  const spec: Record<Exclude<OverlayKey, 'salesMargin'>, { formula: string; note: string; of: (f: Filed, price: number) => number | null }> = {
    pe: {
      formula: 'price ÷ (profit for the year ÷ diluted shares)',
      note: 'No point where the year was a loss: a price over a loss is a negative number that reads like a multiple.',
      of: (f, price) =>
        f.netIncome !== null && f.netIncome > 0 && f.shares !== null ? price / ((f.netIncome * 1e6) / f.shares) : null,
    },
    pb: {
      formula: 'price ÷ (shareholders’ equity ÷ diluted shares)',
      note: 'No point where equity was negative, for the same reason.',
      of: (f, price) => (f.equity !== null && f.equity > 0 && f.shares !== null ? price / ((f.equity * 1e6) / f.shares) : null),
    },
    evEbitda: {
      formula: '(market capitalisation + net debt) ÷ (operating profit + depreciation)',
      note:
        'Net debt is the balance-sheet debt including leases less cash and the short-term securities held with it, ' +
        'which is the definition the valuation’s own equity bridge uses.',
      of: (f, price) =>
        f.ebitda !== null && f.ebitda > 0 && f.shares !== null && f.netDebt !== null
          ? ((price * f.shares) / 1e6 + f.netDebt) / f.ebitda
          : null,
    },
    mcapSales: {
      formula: 'market capitalisation ÷ revenue',
      note: 'Revenue as filed for that year, not annualised or restated.',
      of: (f, price) => (f.revenue !== null && f.shares !== null ? (price * f.shares) / 1e6 / f.revenue : null),
    },
  };

  const how = spec[key as Exclude<OverlayKey, 'salesMargin'>];
  const points: OverlayPoint[] = [];
  let beforeFirstFiling = 0;
  let noFigure = 0;

  for (const p of prices.points) {
    const at = Date.parse(`${p.date}T00:00:00Z`);
    const f = filedAsAt(filed, at);
    if (!f) {
      beforeFirstFiling++;
      continue;
    }
    const value = how.of(f, p.value);
    if (value === null || !isFinite(value)) {
      noFigure++;
      continue;
    }
    points.push({ date: p.date, value, filing: f.filing });
  }

  if (!points.length) {
    return empty(
      beforeFirstFiling && !noFigure
        ? 'Every day on screen is before the earliest filing this page holds, so there is nothing to divide by.'
        : 'The filings do not report what this ratio divides by, for any year on screen.'
    );
  }

  return {
    key,
    label: meta.label,
    formula: how.formula,
    note:
      how.note +
      (beforeFirstFiling
        ? ` The line starts at the earliest filing held; ${beforeFirstFiling} earlier trading ${
            beforeFirstFiling === 1 ? 'day has' : 'days have'
          } no filing to divide by.`
        : ''),
    lines: [{ label: meta.label, unit: 'multiple', points }],
    missing: null,
  };
}

export default { RANGES, OVERLAYS, priceSeries, overlayFor };
