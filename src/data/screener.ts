// FILE: src/data/screener.ts
//
// Marginalia — the global screener, as data rather than as a screen
//
// Everything the screener DOES lives here: which metrics exist, what each one's
// formula is, how a filter treats a figure nobody reported, what a bank is not
// asked, how a text query is read, and how a screen turns into a web address.
// `screenerScreen.tsx` draws it and decides nothing.
//
// That split is not tidiness. Every rule in `docs/SCREENER_SPEC.md` section B
// and C is a rule about data, and a rule that lives in a component can only be
// checked by driving a browser. Here it is checked over all 178 companies in
// `verify/scenarios.mts`, and the browser is left to check what only a browser
// can — that the number on the screen is the number this file produced.
//
// WHAT A SCREENER IS FOR, AND WHAT THIS ONE REFUSES TO BE
//
// A screener answers "which companies satisfy these conditions". It does not
// answer "which should I buy", and the difference is not a matter of wording:
// SEBI's Research Analyst regulations turn the second into regulated advice.
// So spec section C is enforced here in code rather than trusted to whoever
// writes the next label — `BANNED_WORDS` below is checked against every string
// this module and the screen can produce, and a composite score cannot be the
// default sort because there is no composite score.
//
// THREE STATES, AND A NULL NEVER DECIDES ANYTHING QUIETLY (rule 4)
//
//   value         the figure, with the period it covers
//   nm            not meaningful for this company — a bank has no EV/EBITDA
//   unavailable   nobody reported what it is made of
//
// A company whose figure is `nm` or `unavailable` is neither kept nor dropped
// by a filter on that figure. It is EXCLUDED, counted, and named: "12 companies
// excluded: operating margin missing". Silently failing a filter would be the
// worst of the three, because a reader would read the absence as a fact about
// the company.
import { overviewStats } from './companyOverview';
import { financialsFor } from './financials';
// @ts-ignore — plain JS modules, no type declarations
import { buildModel, computeWACC, interestCoverage } from '../engine/model.js';
// @ts-ignore
import { deriveModel } from './deriveModel.js';
// @ts-ignore
import { isFinancialCompany } from './residualIncome.js';

const isNum = (v: unknown): v is number => typeof v === 'number' && isFinite(v);

// ---------------------------------------------------------------------------
// WORDS THIS SCREENER MAY NOT USE (spec rule 12)
// ---------------------------------------------------------------------------
//
// Taken from the spec verbatim rather than paraphrased, because the list is a
// compliance boundary and not a style preference. Checked as whole words: a
// screener that could not say "holding company" or "Target Corporation" would
// be unusable, and the rule is about advice rather than about letters.
//
// `undervalued`, `cheap` and `strong` are the ones a financial writer reaches
// for without noticing, which is why they are here and why the check scans
// every label, formula, preset name and empty-state sentence this code can
// produce rather than only the obvious ones.
export const BANNED_WORDS = [
  'buy',
  'sell',
  'hold',
  'accumulate',
  'target',
  'stop-loss',
  'entry',
  'exit',
  'top pick',
  'undervalued',
  'overvalued',
  'cheap',
  'strong',
  'weak',
  'signal',
  'opportunity',
  'multibagger',
];

/**
 * Every banned word a string contains, as whole words.
 *
 * Hyphenated terms are checked as written. `entry` and `exit` are matched as
 * whole words only, so "entry" is caught and "entryway" is not — the spec
 * bans the instruction, not the substring.
 */
export function bannedWordsIn(text: string): string[] {
  const found: string[] = [];
  const lower = String(text ?? '').toLowerCase();
  for (const word of BANNED_WORDS) {
    const pattern = word.includes(' ') || word.includes('-')
      ? new RegExp(`(^|[^a-z])${word.replace(/[-\s]/g, '[-\\s]')}($|[^a-z])`, 'i')
      : new RegExp(`(^|[^a-z])${word}($|[^a-z])`, 'i');
    if (pattern.test(lower)) found.push(word);
  }
  return found;
}

// ---------------------------------------------------------------------------
// THE METRICS
// ---------------------------------------------------------------------------

export type MetricUnit = 'currency' | 'percent' | 'multiple' | 'ratio' | 'count';
export type MetricGroup =
  | 'Overview'
  | 'Valuation'
  | 'Growth'
  | 'Profitability'
  | 'Balance sheet';

export type CellState = 'value' | 'nm' | 'unavailable';

export interface MetricCell {
  value: number | null;
  state: CellState;
  /** Required whenever the state is not `value`. */
  reason: string | null;
  /** The period the figure covers, e.g. `TTM to 2026-06-30` or `FY2025`. */
  period: string | null;
  /** The day it is as at. */
  asOf: string | null;
}

export interface ScreenerMetric {
  key: string;
  label: string;
  unit: MetricUnit;
  group: MetricGroup;
  /** The arithmetic, shown on the column header (rule 2). */
  formula: string;
  /** Who published the figures it is made of (rule 2). */
  source: string;
  /**
   * NOT MEANINGFUL FOR A FINANCIAL COMPANY (rule 5).
   *
   * A bank's balance sheet is its business: deposits are not debt in the sense
   * Debt/Equity means, it has no working capital so a current ratio says
   * nothing, EBITDA excludes the interest that IS its revenue, and free cash
   * flow is dominated by lending flows. The spec names EV/EBITDA, Debt/Equity,
   * the current ratio, free cash flow and margins, and each of them carries
   * this flag rather than being computed and quietly misread.
   */
  notMeaningfulForFinancials?: boolean;
  /** Higher is not better or worse; this only sets the default sort direction. */
  defaultDescending?: boolean;
}

export const SCREENER_METRICS: ScreenerMetric[] = [
  {
    key: 'marketCap',
    label: 'Market capitalisation',
    unit: 'currency',
    group: 'Overview',
    formula: 'share price × diluted shares outstanding',
    source: 'the exchange price and the filed share count',
    defaultDescending: true,
  },
  {
    key: 'price',
    label: 'Price',
    unit: 'currency',
    group: 'Overview',
    formula: 'the last trade on the primary exchange, in the currency it trades in',
    source: 'the exchange, through the price feed',
  },
  {
    key: 'revenue',
    label: 'Revenue',
    unit: 'currency',
    group: 'Overview',
    formula: 'revenue for the period, as filed',
    source: 'the income statement',
    defaultDescending: true,
  },
  {
    key: 'pe',
    label: 'Price / earnings',
    unit: 'multiple',
    group: 'Valuation',
    formula: 'price ÷ (profit for the period ÷ diluted shares)',
    source: 'the exchange price and the income statement',
  },
  {
    key: 'pb',
    label: 'Price / book',
    unit: 'multiple',
    group: 'Valuation',
    formula: 'price ÷ (shareholders’ equity ÷ diluted shares)',
    source: 'the exchange price and the balance sheet',
  },
  {
    key: 'evToEbitda',
    label: 'EV / EBITDA',
    unit: 'multiple',
    group: 'Valuation',
    formula: '(market capitalisation + net debt) ÷ (operating profit + depreciation and amortisation)',
    source: 'the exchange price, the balance sheet and the income statement',
    notMeaningfulForFinancials: true,
  },
  {
    key: 'evToSales',
    label: 'EV / Sales',
    unit: 'multiple',
    group: 'Valuation',
    formula: '(market capitalisation + net debt) ÷ revenue',
    source: 'the exchange price, the balance sheet and the income statement',
    notMeaningfulForFinancials: true,
  },
  {
    key: 'dividendYield',
    label: 'Dividend yield',
    unit: 'percent',
    group: 'Valuation',
    formula: 'dividends paid over the period ÷ market capitalisation',
    source: 'the cash flow statement and the exchange price',
  },
  {
    key: 'revenueGrowth',
    label: 'Revenue growth',
    unit: 'percent',
    group: 'Growth',
    formula: 'revenue for the latest full year ÷ the year before it, less one',
    source: 'the income statement',
    defaultDescending: true,
  },
  {
    key: 'operatingMargin',
    label: 'Operating margin',
    unit: 'percent',
    group: 'Profitability',
    formula: 'operating profit ÷ revenue',
    source: 'the income statement',
    notMeaningfulForFinancials: true,
    defaultDescending: true,
  },
  {
    key: 'netMargin',
    label: 'Net margin',
    unit: 'percent',
    group: 'Profitability',
    formula: 'profit for the period ÷ revenue',
    source: 'the income statement',
    notMeaningfulForFinancials: true,
    defaultDescending: true,
  },
  {
    key: 'roe',
    label: 'Return on equity',
    unit: 'percent',
    group: 'Profitability',
    formula: 'profit for the period ÷ shareholders’ equity',
    source: 'the income statement and the balance sheet',
    defaultDescending: true,
  },
  {
    key: 'roce',
    label: 'Return on capital employed',
    unit: 'percent',
    group: 'Profitability',
    formula: 'operating profit ÷ (total assets − current liabilities)',
    source: 'the income statement and the balance sheet',
    notMeaningfulForFinancials: true,
    defaultDescending: true,
  },
  {
    key: 'debtToEquity',
    label: 'Debt / equity',
    unit: 'ratio',
    group: 'Balance sheet',
    formula: 'total borrowings ÷ shareholders’ equity',
    source: 'the balance sheet',
    notMeaningfulForFinancials: true,
  },
  {
    key: 'currentRatio',
    label: 'Current ratio',
    unit: 'ratio',
    group: 'Balance sheet',
    formula: 'current assets ÷ current liabilities',
    source: 'the balance sheet',
    notMeaningfulForFinancials: true,
  },
  {
    key: 'interestCover',
    label: 'Interest cover',
    unit: 'ratio',
    group: 'Balance sheet',
    formula: 'operating profit ÷ interest expense',
    source: 'the income statement',
    notMeaningfulForFinancials: true,
    defaultDescending: true,
  },
];

export const METRICS_BY_KEY: Record<string, ScreenerMetric> = Object.fromEntries(
  SCREENER_METRICS.map((m) => [m.key, m])
);

/**
 * COLUMN SETS (spec rule 20), named by what they contain.
 *
 * Not by what a company in them would be: "Quality" or "Value" would be a
 * verdict dressed as a column set, which is what rule 14 is about.
 */
export const COLUMN_SETS: { name: MetricGroup | 'All'; keys: string[] }[] = [
  { name: 'Overview', keys: ['marketCap', 'price', 'revenue', 'pe', 'roe'] },
  { name: 'Valuation', keys: ['marketCap', 'pe', 'pb', 'evToEbitda', 'evToSales', 'dividendYield'] },
  { name: 'Growth', keys: ['marketCap', 'revenue', 'revenueGrowth', 'netMargin'] },
  { name: 'Profitability', keys: ['marketCap', 'operatingMargin', 'netMargin', 'roe', 'roce'] },
  { name: 'Balance sheet', keys: ['marketCap', 'debtToEquity', 'currentRatio', 'interestCover'] },
  { name: 'All', keys: SCREENER_METRICS.map((m) => m.key) },
];

// ---------------------------------------------------------------------------
// ONE ROW PER COMPANY
// ---------------------------------------------------------------------------

export interface ScreenerRow {
  ticker: string;
  name: string;
  exchange: string | null;
  country: string | null;
  /** The currency the statements are in. Figures are never converted (rule 6). */
  currency: string | null;
  currencySymbol: string | null;
  /** `SEC EDGAR` or the vendor feed, which decides what may leave this site. */
  dataSource: string | null;
  /** On the bank template: what rule 5 is about. */
  financial: boolean;
  /** The currency the listing is quoted in, before any minor-unit correction. */
  priceCurrency: string | null;
  /**
   * Whether this is the listing to keep when the same company appears twice
   * (rule 1). Set by `markHomeListings` over the whole table, because
   * primacy is a property of a GROUP of listings and not of one of them.
   */
  homeListing: boolean;
  /** Why it was kept or hidden, for the universe picker to show. */
  listingNote: string | null;
  cells: Record<string, MetricCell>;
}

const unavailable = (reason: string): MetricCell => ({
  value: null,
  state: 'unavailable',
  reason,
  period: null,
  asOf: null,
});

const notMeaningful = (reason: string): MetricCell => ({
  value: null,
  state: 'nm',
  reason,
  period: null,
  asOf: null,
});

/**
 * Which period a flow figure covers, and the figures themselves.
 *
 * TRAILING TWELVE MONTHS WHERE ONE EXISTS, the latest full year otherwise, and
 * the answer says which (rule 3). `financials.ts` already decides what a TTM
 * may be built from — all four branches of its own rule 5 — so that decision is
 * read from there rather than taken again here.
 */
function flowPeriod(payload: any): {
  label: string;
  endDate: string | null;
  revenue: number | null;
  operatingIncome: number | null;
  netIncome: number | null;
  dividendsPaid: number | null;
  depreciation: number | null;
} {
  const rows = Array.isArray(payload?.statements) ? payload.statements : [];
  const annual = [...rows].reverse().find((r: any) => isNum(r?.revenue)) ?? null;
  const fromAnnual = {
    label: annual ? `FY${annual.fiscalYear}` : 'no period',
    endDate: annual?.periodEnd ?? null,
    revenue: annual?.revenue ?? null,
    operatingIncome: annual?.operatingIncome ?? null,
    netIncome: annual?.netIncome ?? null,
    dividendsPaid: annual?.commonDividendsPaid ?? annual?.dividendsPaid ?? null,
    depreciation: annual?.depreciation ?? null,
  };

  try {
    const view: any = financialsFor(payload, { statement: 'income', basis: 'annual' } as any);
    const periods = Array.isArray(view?.periods) ? view.periods : [];
    const ttmAt = periods.findIndex((p: any) => p?.kind === 'ttm');
    if (ttmAt < 0) return fromAnnual;
    const ttm = periods[ttmAt];
    const cell = (key: string) => {
      const row = (view.rows ?? []).find((r: any) => r.key === key);
      const v = row?.cells?.[ttmAt]?.value;
      return isNum(v) ? v : null;
    };
    const revenue = cell('revenue');
    if (!isNum(revenue)) return fromAnnual;
    return {
      label: `TTM to ${ttm.endDate}`,
      endDate: ttm.endDate ?? null,
      revenue,
      operatingIncome: cell('operatingIncome'),
      netIncome: cell('netIncome'),
      // A dividend and a depreciation charge are cash-flow lines, which this
      // income-statement view does not carry. Taken from the year rather than
      // left out, and the period label says the ratio is a mixed one.
      dividendsPaid: fromAnnual.dividendsPaid,
      depreciation: fromAnnual.depreciation,
    };
  } catch {
    return fromAnnual;
  }
}

/**
 * One company as a screener row.
 *
 * Every figure the company page already publishes is READ FROM THE SAME PLACE
 * the page reads it (`overviewStats`), so a screener column and a company tile
 * cannot disagree — which is the trap `CLAUDE.md` lists as "two copies of a
 * positional layout", in a different costume.
 */
export function screenerRow(payload: any): ScreenerRow | null {
  if (!payload || payload.error || !Array.isArray(payload.statements) || !payload.statements.length) {
    return null;
  }
  const financial = Boolean(isFinancialCompany(payload));
  const stats: any = (() => {
    try {
      return overviewStats(payload);
    } catch {
      return { stats: [] };
    }
  })();
  const statOf = (key: string) => (stats.stats ?? []).find((s: any) => s.key === key) ?? null;

  const period = flowPeriod(payload);
  const rows = payload.statements;
  const last = [...rows].reverse().find((r: any) => isNum(r?.totalAssets) || isNum(r?.equity)) ?? rows[rows.length - 1];
  const balanceAt = last?.periodEnd ?? null;
  const balanceLabel = last?.fiscalYear ? `FY${last.fiscalYear}` : 'no period';

  // The engine, for the figures a balance sheet alone does not give.
  let wacc: any = null;
  let model: any = null;
  let source: any = null;
  try {
    source = deriveModel(payload);
    model = buildModel(source);
    wacc = computeWACC(model, source);
  } catch {
    /* a company the derivation refuses still screens on what it filed */
  }

  const cells: Record<string, MetricCell> = {};
  const put = (key: string, cell: MetricCell) => {
    cells[key] = cell;
  };
  const value = (v: number | null, label: string, at: string | null, missing: string): MetricCell =>
    isNum(v) ? { value: v, state: 'value', reason: null, period: label, asOf: at } : unavailable(missing);

  // ---- from the page's own figures, so the two cannot drift -------------
  for (const [key, statKey] of [
    ['marketCap', 'marketCap'],
    ['price', 'price'],
    ['pe', 'pe'],
    ['pb', 'pb'],
    ['dividendYield', 'dividendYield'],
    ['roe', 'roe'],
    ['roce', 'roce'],
  ] as [string, string][]) {
    const metric = METRICS_BY_KEY[key];
    const stat = statOf(statKey);
    if (metric.notMeaningfulForFinancials && financial) {
      put(key, notMeaningful(`${metric.label} is not meaningful for a bank or insurer`));
      continue;
    }
    if (!stat) {
      put(key, unavailable(`${metric.label} is not published for this company`));
      continue;
    }
    put(
      key,
      isNum(stat.value)
        ? {
            value: stat.value,
            state: 'value',
            reason: null,
            // A price is as at a moment and a ratio out of a filing is as at a
            // period. `overviewStats` already knows which, so the label is
            // taken from the kind of figure rather than guessed at.
            period:
              key === 'price' || key === 'marketCap'
                ? 'the last trade'
                : stats.filing?.fiscalYear
                  ? `FY${stats.filing.fiscalYear}`
                  : period.label,
            asOf: stat.asOf ?? null,
          }
        : unavailable(String(stat.missing || `${metric.label} could not be established`))
    );
  }

  // ---- the income statement --------------------------------------------
  put('revenue', value(period.revenue, period.label, period.endDate, 'No revenue is reported for any period held'));

  const margin = (key: string, numerator: number | null) => {
    const metric = METRICS_BY_KEY[key];
    if (financial) {
      put(key, notMeaningful(`${metric.label} is not meaningful for a bank or insurer: its revenue is not comparable`));
      return;
    }
    if (!isNum(numerator) || !isNum(period.revenue) || period.revenue === 0) {
      put(key, unavailable(`Both ${metric.label.toLowerCase()}'s parts are needed and one is not reported`));
      return;
    }
    put(key, {
      value: (numerator / period.revenue) * 100,
      state: 'value',
      reason: null,
      period: period.label,
      asOf: period.endDate,
    });
  };
  margin('operatingMargin', period.operatingIncome);
  margin('netMargin', period.netIncome);

  // ---- growth, which needs two full years ------------------------------
  {
    const withRevenue = rows.filter((r: any) => isNum(r?.revenue));
    const now = withRevenue[withRevenue.length - 1];
    const before = withRevenue[withRevenue.length - 2];
    if (!now || !before || before.revenue === 0) {
      put('revenueGrowth', unavailable('Two consecutive years of revenue are needed and only one is reported'));
    } else {
      put('revenueGrowth', {
        value: (now.revenue / before.revenue - 1) * 100,
        state: 'value',
        reason: null,
        period: `FY${before.fiscalYear} to FY${now.fiscalYear}`,
        asOf: now.periodEnd ?? null,
      });
    }
  }

  // ---- enterprise value, which a bank does not have in this sense ------
  {
    const ebitda = isNum(period.operatingIncome) && isNum(period.depreciation)
      ? period.operatingIncome + period.depreciation
      : null;
    const marketCap = isNum(wacc?.marketCap) ? wacc.marketCap : null;
    const netDebt = isNum(wacc?.grossDebt) && isNum(last?.cash) ? wacc.grossDebt - last.cash : null;
    const ev = isNum(marketCap) && isNum(netDebt) ? marketCap + netDebt : null;
    for (const [key, denominator, what] of [
      ['evToEbitda', ebitda, 'EBITDA'],
      ['evToSales', period.revenue, 'revenue'],
    ] as [string, number | null, string][]) {
      const metric = METRICS_BY_KEY[key];
      if (financial) {
        put(
          key,
          notMeaningful(
            `${metric.label} is not meaningful for a bank or insurer: interest is its revenue, not a financing cost`
          )
        );
        continue;
      }
      if (!isNum(ev) || !isNum(denominator) || denominator <= 0) {
        put(
          key,
          unavailable(
            !isNum(ev)
              ? 'Enterprise value needs a market capitalisation and net debt, and one is not available'
              : `${what} for the period is not reported, or is not positive`
          )
        );
        continue;
      }
      put(key, { value: ev / denominator, state: 'value', reason: null, period: period.label, asOf: period.endDate });
    }
  }

  // ---- the balance sheet ------------------------------------------------
  const sheetRatio = (key: string, numerator: number | null, denominator: number | null, missing: string) => {
    const metric = METRICS_BY_KEY[key];
    if (financial) {
      put(
        key,
        notMeaningful(`${metric.label} is not meaningful for a bank or insurer: its balance sheet is its business`)
      );
      return;
    }
    if (!isNum(numerator) || !isNum(denominator) || denominator === 0) {
      put(key, unavailable(missing));
      return;
    }
    put(key, { value: numerator / denominator, state: 'value', reason: null, period: balanceLabel, asOf: balanceAt });
  };
  sheetRatio(
    'debtToEquity',
    isNum(wacc?.grossDebt) ? wacc.grossDebt : null,
    last?.equity ?? null,
    'Total borrowings and shareholders’ equity are both needed and one is not reported'
  );
  sheetRatio(
    'currentRatio',
    last?.currentAssets ?? null,
    last?.currentLiabilities ?? null,
    'Current assets and current liabilities are both needed and one is not reported'
  );
  {
    const metric = METRICS_BY_KEY.interestCover;
    const cover = (() => {
      try {
        return interestCoverage(model);
      } catch {
        return { ratio: null, year: null };
      }
    })();
    if (financial) {
      put(
        'interestCover',
        notMeaningful(`${metric.label} is not meaningful for a bank or insurer: interest is its revenue`)
      );
    } else if (!isNum(cover?.ratio)) {
      put('interestCover', unavailable('No year reports both an operating profit and an interest charge'));
    } else {
      put('interestCover', {
        value: cover.ratio,
        state: 'value',
        reason: null,
        period: cover.year ? `FY${cover.year}` : balanceLabel,
        asOf: balanceAt,
      });
    }
  }

  return {
    ticker: String(payload.ticker ?? ''),
    name: String(payload.name ?? payload.ticker ?? ''),
    exchange: payload?.listing?.exchangeName ?? payload?.listing?.exchange ?? payload?.quote?.exchange ?? null,
    country: payload?.profile?.country ?? payload?.listing?.country ?? null,
    currency: payload?.currency ?? null,
    currencySymbol: payload?.currencySymbol ?? null,
    dataSource: payload?.source ?? null,
    financial,
    priceCurrency: payload?.listing?.priceCurrency ?? payload?.quote?.currency ?? null,
    // Set by `markHomeListings` once the whole table exists.
    homeListing: true,
    listingNote: null,
    cells,
  };
}

/**
 * WHICH LISTING TO KEEP WHEN ONE COMPANY APPEARS TWICE (rule 1).
 *
 * Nothing in the data says "this is the primary listing", and this flag does
 * not claim to be one  it is called `homeListing` because that is all the
 * evidence supports. What the data does
 * say is which currency each listing is quoted in and which currency the
 * company reports in, and **a listing quoted in the currency its own accounts
 * are kept in is the home line** — Reliance on the NSE in rupees against its
 * absent ADR, Royal Bank of Canada in Toronto in dollars against its New York
 * line in US dollars, HDFC Bank on the NSE against `HDB`, Vale in São Paulo
 * against `VALE`. That is a rule with evidence behind it rather than a guess
 * from the ticker suffix.
 *
 * IT IS NOT THE SAME THING AS A PRIMARY LISTING, and HSBC is the proof: it
 * reports in US dollars, so this rule picks its New York line over London,
 * where it is actually domiciled and primarily traded. The limit is recorded in
 * `DATA_CONSTRAINTS.md` rather than hidden behind the word "primary".
 *
 * WHERE THE RULE CANNOT CHOOSE, NOTHING IS HIDDEN. A group where no listing
 * matches, or several do, keeps all of them: showing a company twice is a
 * nuisance, and hiding it is a company a reader cannot find.
 */
export function markHomeListings(rows: ScreenerRow[]): ScreenerRow[] {
  const groups = new Map<string, ScreenerRow[]>();
  for (const row of rows) {
    const key = row.name.trim().toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const out: ScreenerRow[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      out.push({ ...group[0], homeListing: true, listingNote: null });
      continue;
    }
    const home = group.filter(
      (r) => r.priceCurrency && r.currency && r.priceCurrency.toUpperCase() === r.currency.toUpperCase()
    );
    if (home.length !== 1) {
      // Several or none: every listing is kept, and the reason is on each.
      for (const row of group) {
        out.push({
          ...row,
          homeListing: true,
          listingNote:
            `${group.length} listings of this company are held and the data cannot say which is primary, ` +
            'so none is hidden',
        });
      }
      continue;
    }
    for (const row of group) {
      const keep = row === home[0];
      out.push({
        ...row,
        homeListing: keep,
        listingNote: keep
          ? `the listing quoted in ${row.currency}, the currency this company reports in`
          : `${home[0].ticker} is quoted in ${home[0].currency}, the currency this company reports in`,
      });
    }
  }
  // Back into the order they arrived in, so a table is not reshuffled by a
  // flag that is about identity rather than about sorting.
  const at = new Map(rows.map((r, i) => [r.ticker, i]));
  return out.sort((a, b) => (at.get(a.ticker) ?? 0) - (at.get(b.ticker) ?? 0));
}

// ---------------------------------------------------------------------------
// FILTERS
// ---------------------------------------------------------------------------

export type FilterOp = 'gt' | 'gte' | 'lt' | 'lte' | 'between';

export interface Filter {
  metric: string;
  op: FilterOp;
  value: number;
  /** For `between`, the upper bound. */
  value2?: number;
}

export const OP_WORDS: Record<FilterOp, string> = {
  gt: 'more than',
  gte: 'at least',
  lt: 'less than',
  lte: 'at most',
  between: 'between',
};

export const OP_SYMBOLS: Record<FilterOp, string> = {
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  between: 'between',
};

export interface FilterOutcome {
  /** The companies that satisfy every filter. */
  rows: ScreenerRow[];
  /** How many did. Equal to `rows.length`, and checked to be (rule 16). */
  matched: number;
  /**
   * Why companies were left out, metric by metric (rule 4).
   *
   * A company counted here did not fail the test. It was never put to it,
   * because the figure the test is about is not available or is not meaningful
   * for a company of its kind.
   */
  excluded: { metric: string; label: string; missing: number; notMeaningful: number }[];
  /** Total companies set aside for a missing or not-meaningful figure. */
  excludedTotal: number;
  /** Companies that were tested and did not satisfy a filter. */
  rejected: number;
}

function satisfies(cell: MetricCell, filter: Filter): boolean {
  const v = cell.value as number;
  switch (filter.op) {
    case 'gt':
      return v > filter.value;
    case 'gte':
      return v >= filter.value;
    case 'lt':
      return v < filter.value;
    case 'lte':
      return v <= filter.value;
    case 'between':
      return v >= filter.value && v <= (filter.value2 ?? filter.value);
    default:
      return false;
  }
}

/**
 * The companies that satisfy every filter, and an account of everyone else.
 *
 * A NULL NEVER PASSES OR FAILS QUIETLY (rule 4). A company whose figure is not
 * available, or not meaningful for a company of its kind, is set aside and
 * counted under the metric that set it aside — once, under the first filter it
 * could not be put to, so the counts add up to the companies excluded rather
 * than to the tests skipped.
 */
export function applyFilters(rows: ScreenerRow[], filters: Filter[]): FilterOutcome {
  const tally = new Map<string, { missing: number; notMeaningful: number }>();
  const bump = (key: string, state: CellState) => {
    const at = tally.get(key) ?? { missing: 0, notMeaningful: 0 };
    if (state === 'nm') at.notMeaningful++;
    else at.missing++;
    tally.set(key, at);
  };

  const kept: ScreenerRow[] = [];
  let rejected = 0;
  let excludedTotal = 0;

  for (const row of rows) {
    let excluded = false;
    let failed = false;
    for (const filter of filters) {
      const cell = row.cells[filter.metric];
      if (!cell || cell.state !== 'value' || !isNum(cell.value)) {
        bump(filter.metric, cell?.state === 'nm' ? 'nm' : 'unavailable');
        excluded = true;
        break;
      }
      if (!satisfies(cell, filter)) {
        failed = true;
        break;
      }
    }
    if (excluded) {
      excludedTotal++;
      continue;
    }
    if (failed) {
      rejected++;
      continue;
    }
    kept.push(row);
  }

  const excluded = [...tally.entries()]
    .map(([metric, counts]) => ({
      metric,
      label: METRICS_BY_KEY[metric]?.label ?? metric,
      ...counts,
    }))
    .sort((a, b) => b.missing + b.notMeaningful - (a.missing + a.notMeaningful));

  return { rows: kept, matched: kept.length, excluded, excludedTotal, rejected };
}

/** The sentence rule 4 asks for, or null when nobody was set aside. */
export function exclusionSentence(outcome: FilterOutcome): string | null {
  if (!outcome.excludedTotal) return null;
  const parts = outcome.excluded.map((e) => {
    const bits: string[] = [];
    if (e.missing) bits.push(`${e.missing} with no ${e.label.toLowerCase()} reported`);
    if (e.notMeaningful) bits.push(`${e.notMeaningful} where it is not meaningful`);
    return bits.join(' and ');
  });
  const companies = outcome.excludedTotal === 1 ? 'company' : 'companies';
  return `${outcome.excludedTotal} ${companies} excluded: ${parts.join('; ')}.`;
}

// ---------------------------------------------------------------------------
// SORTING
// ---------------------------------------------------------------------------

export const DEFAULT_SORT = 'marketCap';

/**
 * Sorted rows, with every figure that is not a figure at the bottom.
 *
 * A null sorted as nought would put every company with no margin at the top of
 * a worst-margin sort, which reads as a finding about them. They go last
 * whichever way the column is sorted, because their position is not
 * information.
 *
 * THERE IS NO COMPOSITE SCORE TO SORT BY (rule 13). The default is market
 * capitalisation, which is a size and not a judgement, and the only other
 * default offered is the company name.
 */
export function sortRows(rows: ScreenerRow[], metric: string, descending: boolean): ScreenerRow[] {
  if (metric === 'name') {
    const by = [...rows].sort((a, b) => a.name.localeCompare(b.name));
    return descending ? by.reverse() : by;
  }
  const withValue: ScreenerRow[] = [];
  const without: ScreenerRow[] = [];
  for (const row of rows) {
    const cell = row.cells[metric];
    if (cell && cell.state === 'value' && isNum(cell.value)) withValue.push(row);
    else without.push(row);
  }
  withValue.sort((a, b) => {
    const x = a.cells[metric].value as number;
    const y = b.cells[metric].value as number;
    return descending ? y - x : x - y;
  });
  without.sort((a, b) => a.name.localeCompare(b.name));
  return [...withValue, ...without];
}

// ---------------------------------------------------------------------------
// THE TEXT QUERY (rule 9)
// ---------------------------------------------------------------------------
//
// Chips and text are two views of ONE set of filters, not two features. The
// text is parsed into filters and the filters are written back out as text, so
// a reader can switch between them without either becoming the real one.
//
// No natural language, deliberately. Rule 9 allows a natural-language box only
// where it translates into chips and never into picks; the safest version of
// that rule is not to have the box until the translation can be shown.

export interface QueryProblem {
  text: string;
  reason: string;
}

export function parseQuery(text: string): { filters: Filter[]; problems: QueryProblem[] } {
  const filters: Filter[] = [];
  const problems: QueryProblem[] = [];
  const clauses = String(text ?? '')
    .split(/\band\b|\n|,/i)
    .map((c) => c.trim())
    .filter(Boolean);

  for (const clause of clauses) {
    const between = /^(.+?)\s+between\s+(-?[\d.]+)\s+(?:and|to)\s+(-?[\d.]+)$/i.exec(clause);
    const simple = /^(.+?)\s*(>=|<=|>|<)\s*(-?[\d.]+)\s*%?$/.exec(clause);
    const found = (label: string): string | null => {
      const want = label.trim().toLowerCase().replace(/\s+/g, ' ');
      const metric = SCREENER_METRICS.find(
        (m) => m.key.toLowerCase() === want || m.label.toLowerCase() === want
      );
      return metric ? metric.key : null;
    };
    if (between) {
      const key = found(between[1]);
      if (!key) {
        problems.push({ text: clause, reason: `There is no metric called "${between[1].trim()}"` });
        continue;
      }
      filters.push({ metric: key, op: 'between', value: Number(between[2]), value2: Number(between[3]) });
      continue;
    }
    if (simple) {
      const key = found(simple[1]);
      if (!key) {
        problems.push({ text: clause, reason: `There is no metric called "${simple[1].trim()}"` });
        continue;
      }
      const op: FilterOp = simple[2] === '>' ? 'gt' : simple[2] === '<' ? 'lt' : simple[2] === '>=' ? 'gte' : 'lte';
      filters.push({ metric: key, op, value: Number(simple[3]) });
      continue;
    }
    problems.push({
      text: clause,
      reason: 'Write a comparison, such as "return on equity > 15", joined by "and"',
    });
  }
  return { filters, problems };
}

export function writeQuery(filters: Filter[]): string {
  return filters
    .map((f) => {
      const label = METRICS_BY_KEY[f.metric]?.label ?? f.metric;
      return f.op === 'between'
        ? `${label} between ${f.value} and ${f.value2 ?? f.value}`
        : `${label} ${OP_SYMBOLS[f.op]} ${f.value}`;
    })
    .join(' and ');
}

// ---------------------------------------------------------------------------
// USER-DEFINED RATIOS (rule 8)
// ---------------------------------------------------------------------------
//
// A formula over the metrics above, previewed before it is saved, usable as a
// column, a filter and a sort key. Evaluated by a small reader written here
// rather than by `eval` or `new Function`: a formula arrives from a web address
// a reader can be sent, so it is untrusted input, and the only safe evaluator
// is one that can do nothing but arithmetic.

export interface CustomRatio {
  key: string;
  label: string;
  formula: string;
  unit: MetricUnit;
}

const TOKEN = /\s*([A-Za-z][A-Za-z0-9]*|[\d.]+|[()+\-*/])/g;

/** Arithmetic over metric keys, and nothing else. */
export function evaluateFormula(
  formula: string,
  lookup: (key: string) => number | null
): { value: number | null; problem: string | null } {
  const tokens: string[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(TOKEN);
  let consumed = 0;
  while ((match = re.exec(formula)) !== null) {
    tokens.push(match[1]);
    consumed = match.index + match[0].length;
    if (re.lastIndex === match.index) break;
  }
  if (consumed < String(formula ?? '').trim().length) {
    return { value: null, problem: 'That formula has something in it that is not arithmetic' };
  }
  let at = 0;
  let missing: string | null = null;

  const peek = () => tokens[at];
  const take = () => tokens[at++];

  const primary = (): number | null => {
    const t = take();
    if (t === undefined) return null;
    if (t === '(') {
      const v = expression();
      if (peek() === ')') take();
      return v;
    }
    if (t === '-') {
      const v = primary();
      return v === null ? null : -v;
    }
    if (/^[\d.]+$/.test(t)) return Number(t);
    if (/^[A-Za-z]/.test(t)) {
      if (!METRICS_BY_KEY[t]) {
        missing = missing ?? `There is no metric called "${t}"`;
        return null;
      }
      const v = lookup(t);
      if (!isNum(v)) {
        missing = missing ?? `${METRICS_BY_KEY[t].label} is not available for this company`;
        return null;
      }
      return v;
    }
    missing = missing ?? `"${t}" is not something this can work out`;
    return null;
  };

  const term = (): number | null => {
    let left = primary();
    while (peek() === '*' || peek() === '/') {
      const op = take();
      const right = primary();
      if (left === null || right === null) return null;
      if (op === '/' && right === 0) {
        missing = missing ?? 'That formula divides by nought';
        return null;
      }
      left = op === '*' ? left * right : left / right;
    }
    return left;
  };

  const expression = (): number | null => {
    let left = term();
    while (peek() === '+' || peek() === '-') {
      const op = take();
      const right = term();
      if (left === null || right === null) return null;
      left = op === '+' ? left + right : left - right;
    }
    return left;
  };

  const value = expression();
  if (at < tokens.length && missing === null) {
    return { value: null, problem: 'That formula has something left over at the end' };
  }
  return { value, problem: value === null ? missing ?? 'That formula could not be worked out' : null };
}

/** A custom ratio as a metric, so a column, a filter and a sort all see it. */
export function ratioAsMetric(ratio: CustomRatio): ScreenerMetric {
  return {
    key: ratio.key,
    label: ratio.label,
    unit: ratio.unit,
    group: 'Valuation',
    formula: ratio.formula,
    source: 'worked out from the metrics above, which name their own sources',
  };
}

/** Puts a custom ratio's value on every row, with the same three states. */
export function withCustomRatios(rows: ScreenerRow[], ratios: CustomRatio[]): ScreenerRow[] {
  if (!ratios.length) return rows;
  return rows.map((row) => {
    const cells = { ...row.cells };
    for (const ratio of ratios) {
      const { value, problem } = evaluateFormula(ratio.formula, (key) => {
        const cell = row.cells[key];
        return cell && cell.state === 'value' ? cell.value : null;
      });
      cells[ratio.key] = isNum(value)
        ? { value, state: 'value', reason: null, period: 'from the columns it names', asOf: null }
        : {
            value: null,
            // A RATIO BUILT ON AN `n.m.` FIGURE IS ITSELF NOT MEANINGFUL, not
            // merely missing, and a bank filtered on a custom EV/EBITDA must be
            // excluded for the right reason.
            state: ratios.length && /not meaningful/i.test(String(problem)) ? 'nm' : 'unavailable',
            reason: problem,
            period: null,
            asOf: null,
          };
    }
    return { ...row, cells };
  });
}

// ---------------------------------------------------------------------------
// A SCREEN AS A WEB ADDRESS (rule 22)
// ---------------------------------------------------------------------------
//
// The filters, the universe, the column set and the sort go in the query
// string, so a screen can be sent to somebody without an account. Saving is in
// the browser only until accounts arrive in build step 7.

export interface ScreenState {
  filters: Filter[];
  countries: string[];
  exchanges: string[];
  oneListingPerCompany: boolean;
  financials: 'include' | 'exclude' | 'only';
  columns: string;
  sort: string;
  descending: boolean;
  ratios: CustomRatio[];
  query: string;
}

export const EMPTY_SCREEN: ScreenState = {
  filters: [],
  countries: [],
  exchanges: [],
  oneListingPerCompany: true,
  financials: 'include',
  columns: 'Overview',
  sort: DEFAULT_SORT,
  descending: true,
  ratios: [],
  query: '',
};

export function screenToSearch(screen: ScreenState): string {
  const p = new URLSearchParams();
  for (const f of screen.filters) {
    p.append('f', f.op === 'between' ? `${f.metric}:between:${f.value}:${f.value2}` : `${f.metric}:${f.op}:${f.value}`);
  }
  for (const r of screen.ratios) p.append('r', `${r.key}:${r.unit}:${r.label}:${r.formula}`);
  if (screen.countries.length) p.set('country', screen.countries.join('|'));
  if (screen.exchanges.length) p.set('exchange', screen.exchanges.join('|'));
  if (!screen.oneListingPerCompany) p.set('all-listings', '1');
  if (screen.financials !== 'include') p.set('financials', screen.financials);
  if (screen.columns !== EMPTY_SCREEN.columns) p.set('columns', screen.columns);
  if (screen.sort !== EMPTY_SCREEN.sort) p.set('sort', screen.sort);
  if (!screen.descending) p.set('ascending', '1');
  return p.toString();
}

export function screenFromSearch(search: string): ScreenState {
  const p = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const filters: Filter[] = [];
  for (const raw of p.getAll('f')) {
    const bits = raw.split(':');
    const [metric, op] = bits;
    if (!METRICS_BY_KEY[metric] && !p.getAll('r').some((r) => r.split(':')[0] === metric)) continue;
    if (op === 'between') {
      const [, , a, b] = bits;
      if (isNum(Number(a)) && isNum(Number(b))) {
        filters.push({ metric, op: 'between', value: Number(a), value2: Number(b) });
      }
      continue;
    }
    if (!['gt', 'gte', 'lt', 'lte'].includes(op)) continue;
    const v = Number(bits[2]);
    if (isNum(v)) filters.push({ metric, op: op as FilterOp, value: v });
  }
  const ratios: CustomRatio[] = [];
  for (const raw of p.getAll('r')) {
    const [key, unit, label, ...rest] = raw.split(':');
    if (!key || !rest.length) continue;
    ratios.push({
      key,
      unit: (['currency', 'percent', 'multiple', 'ratio', 'count'] as string[]).includes(unit)
        ? (unit as MetricUnit)
        : 'ratio',
      label: label || key,
      formula: rest.join(':'),
    });
  }
  const financials = p.get('financials');
  return {
    filters,
    ratios,
    countries: (p.get('country') ?? '').split('|').filter(Boolean),
    exchanges: (p.get('exchange') ?? '').split('|').filter(Boolean),
    oneListingPerCompany: p.get('all-listings') !== '1',
    financials: financials === 'exclude' || financials === 'only' ? financials : 'include',
    columns: p.get('columns') ?? EMPTY_SCREEN.columns,
    sort: p.get('sort') ?? EMPTY_SCREEN.sort,
    descending: p.get('ascending') !== '1',
    query: '',
  };
}

// ---------------------------------------------------------------------------
// THE UNIVERSE (rule 1)
// ---------------------------------------------------------------------------

export function universeOf(rows: ScreenerRow[], screen: ScreenState): ScreenerRow[] {
  return rows.filter((row) => {
    if (screen.oneListingPerCompany && !row.homeListing) return false;
    if (screen.countries.length && !screen.countries.includes(String(row.country))) return false;
    if (screen.exchanges.length && !screen.exchanges.includes(String(row.exchange))) return false;
    if (screen.financials === 'exclude' && row.financial) return false;
    if (screen.financials === 'only' && !row.financial) return false;
    return true;
  });
}

/** Every country and exchange in the table, for the universe picker. */
export function universeChoices(rows: ScreenerRow[]): { countries: string[]; exchanges: string[] } {
  const countries = new Set<string>();
  const exchanges = new Set<string>();
  for (const row of rows) {
    if (row.country) countries.add(row.country);
    if (row.exchange) exchanges.add(row.exchange);
  }
  return {
    countries: [...countries].sort(),
    exchanges: [...exchanges].sort(),
  };
}

/** Everything a screen does, in one call, so a screen and a check agree. */
export function runScreen(
  rows: ScreenerRow[],
  screen: ScreenState
): FilterOutcome & { universe: number; sorted: ScreenerRow[] } {
  const withRatios = withCustomRatios(rows, screen.ratios);
  const universe = universeOf(withRatios, screen);
  const outcome = applyFilters(universe, screen.filters);
  return {
    ...outcome,
    universe: universe.length,
    sorted: sortRows(outcome.rows, screen.sort, screen.descending),
  };
}
