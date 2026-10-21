// FILE: src/data/companyOverview.ts
//
// THE SUMMARY FIGURES ON THE COMPANY PAGE, AND WHY EACH ONE IS OR IS NOT THERE.
//
// This is the whole arithmetic of the Overview tab, kept out of the component
// on purpose: the verification suite runs it over the payload set, and a figure
// computed inside JSX can only be checked by reading a rendered page.
//
// ONE RULE ABOVE THE REST, and the check enforces it on every company:
//
//     A FIGURE IS EITHER A NUMBER OR AN EM DASH WITH A REASON. Never zero.
//
// Zero is a claim the company reported zero (`CLAUDE.md`, standing decision 3).
// Every stat below therefore carries `missing`, a sentence naming what is not
// there, and the invariant `value === null` exactly when `missing` is set is
// asserted by `npm run verify` rather than trusted.
//
// UNITS, once, because every line here depends on them: the statements are in
// MILLIONS of the reporting currency, and `dilutedShares` is an ABSOLUTE count
// of shares. So a per-share figure is `line * 1e6 / dilutedShares`, and a
// market capitalisation is `price * dilutedShares`. Getting this backwards
// gives a plausible-looking figure a million times out, which is exactly the
// kind of mistake a reader cannot catch.

// THE RATIOS COME FROM THE ENGINE'S OWN DEFINITIONS, not from a second copy
// written here. `RATIO_DEFINITIONS` is where ROCE is defined, with the note
// saying Screener's denominator is not disclosed so the two will not always
// agree; a summary panel that recomputed it would be a place for that
// definition to drift.
import { reportedRatios } from './ratios.js';

const isNum = (v: unknown): v is number => typeof v === 'number' && isFinite(v);

export type StatUnit = 'currency' | 'percent' | 'multiple' | 'count';

export interface OverviewStat {
  key: string;
  label: string;
  /** The number, or null when it cannot be established. Never a stand-in. */
  value: number | null;
  unit: StatUnit;
  /** Required whenever `value` is null, and empty whenever it is not. */
  missing: string | null;
  /** Where the figure comes from, named the way the source names itself. */
  source: string;
  /** What the figure is as at: a quote time or a period end. */
  asOf: string | null;
  /** The arithmetic, for the reader who wants to check it. */
  formula?: string;
  /** Anything worth saying that the formula does not. ONE LINE: it is
   *  printed under the figure, and a paragraph here makes one tile twice the
   *  height of the eleven beside it. Longer than that goes in `caveat`. */
  note?: string;
  /** The longer qualification, shown only when the ⓘ is opened. */
  caveat?: string;
}

/** The statement a figure was taken from, so the page can name it. */
export interface FilingRef {
  fiscalYear: number | null;
  periodEnd: string | null;
}

export interface OverviewResult {
  stats: OverviewStat[];
  /** The latest filing anything here was read from. */
  filing: FilingRef | null;
  /** The currency every `currency` figure below is in. */
  currency: string | null;
  currencySymbol: string;
  /** Per block: what it came from and when, for the freshness line. */
  freshness: { block: string; source: string; asOf: string | null }[];
}

const dash = (
  key: string,
  label: string,
  unit: StatUnit,
  missing: string,
  source: string,
  extra: Partial<OverviewStat> = {}
): OverviewStat => ({ key, label, value: null, unit, missing, source, asOf: null, ...extra });

const got = (
  key: string,
  label: string,
  unit: StatUnit,
  value: number,
  source: string,
  asOf: string | null,
  extra: Partial<OverviewStat> = {}
): OverviewStat => ({ key, label, value, unit, missing: null, source, asOf, ...extra });

/**
 * The newest statement row that actually carries a figure for `field`.
 *
 * NOT SIMPLY THE LAST ROW. A filer can report a line in four years out of five,
 * and reading the last row alone turns a reported figure into a missing one —
 * or worse, reaches past a reported nil. The row is returned with it so the
 * page can say which year the figure is from rather than implying the latest.
 */
export function latestWith(statements: any[], field: string): { row: any; value: number } | null {
  const rows = Array.isArray(statements) ? statements : [];
  for (let i = rows.length - 1; i >= 0; i--) {
    const value = rows[i]?.[field];
    if (isNum(value)) return { row: rows[i], value };
  }
  return null;
}

/**
 * The newest statement row that carries ALL of these fields at once.
 *
 * The plural of `latestWith`, and the reason it exists is in the comment on
 * the ratios below: two figures taken from two different years and divided
 * produce a number that is wrong and looks right.
 */
export function latestWithAll(statements: any[], ...fields: string[]): any | null {
  const rows = Array.isArray(statements) ? statements : [];
  for (let i = rows.length - 1; i >= 0; i--) {
    if (fields.every((f) => isNum(rows[i]?.[f]))) return rows[i];
  }
  return null;
}

const filingOf = (row: any): FilingRef => ({
  fiscalYear: isNum(row?.fiscalYear) ? row.fiscalYear : null,
  periodEnd: typeof row?.periodEnd === 'string' ? row.periodEnd : null,
});

/** "FY2025, ended 27 September 2025" — how every figure names its filing. */
export function filingLabel(filing: FilingRef | null): string {
  if (!filing) return 'no filing';
  const year = filing.fiscalYear ? `FY${filing.fiscalYear}` : 'the last filed year';
  if (!filing.periodEnd) return year;
  const date = new Date(`${filing.periodEnd}T00:00:00Z`);
  const when = isNaN(date.getTime())
    ? filing.periodEnd
    : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  return `${year}, ended ${when}`;
}

/**
 * Every summary figure the Overview tab shows, from the payload and the model.
 *
 * EVERYTHING HERE COMES FROM THE PAYLOAD, not from a built model. A company
 * the engine refuses to value still has a price, a market capitalisation and
 * a set of multiples, all of them read straight from the filings; a summary
 * that went blank because the valuation was refused would be hiding figures
 * the site is holding. The refusal belongs on the Model tab, which is where
 * it is.
 */
export function overviewStats(payload: any): OverviewResult {
  const statements: any[] = Array.isArray(payload?.statements) ? payload.statements : [];
  const quote = payload?.quote ?? null;
  const currency = payload?.currency ?? null;
  const currencySymbol = payload?.currencySymbol || '$';
  const vendor = payload?.source === 'SEC EDGAR' ? 'SEC EDGAR' : 'Yahoo Finance';
  const priceSource = 'Yahoo Finance (quote)';
  const quoteAsOf = typeof quote?.asOf === 'string' ? quote.asOf : null;

  const stats: OverviewStat[] = [];

  // ---- the price, and what the market pays for the company ----------------
  const price = isNum(quote?.price) ? quote.price : null;
  stats.push(
    price === null
      ? dash('price', 'Price', 'currency', 'No quote came back for this listing, so there is no price to show.', priceSource)
      : got('price', 'Price', 'currency', price, priceSource, quoteAsOf)
  );

  stats.push(
    isNum(quote?.changePct)
      ? got('change', 'Change on the day', 'percent', quote.changePct, priceSource, quoteAsOf, {
          formula: 'price / previous close - 1',
        })
      : dash(
          'change',
          'Change on the day',
          'percent',
          'The previous session’s close is not in the series, so the move on the day cannot be worked out.',
          priceSource
        )
  );

  // The share count is the one input almost everything below shares, so it is
  // established once and its absence explained once.
  const sharesRow = latestWith(statements, 'dilutedShares');
  const shares = sharesRow && sharesRow.value > 0 ? sharesRow.value : null;
  const noShares =
    'The filings do not report a diluted share count, so nothing per share can be worked out from them.';

  stats.push(
    price !== null && shares !== null
      ? got('marketCap', 'Market capitalisation', 'currency', price * shares, `${priceSource} × ${vendor}`, quoteAsOf, {
          formula: 'price × diluted shares',
          note: `on the ${filingLabel(filingOf(sharesRow!.row))} share count`,
        })
      : dash(
          'marketCap',
          'Market capitalisation',
          'currency',
          price === null ? 'There is no price, so there is no market capitalisation.' : noShares,
          priceSource
        )
  );

  for (const [key, label, field] of [
    ['high52', '52-week high', 'fiftyTwoWeekHigh'],
    ['low52', '52-week low', 'fiftyTwoWeekLow'],
  ] as const) {
    const value = quote?.[field];
    stats.push(
      isNum(value)
        ? got(key, label, 'currency', value, priceSource, quoteAsOf, {
            note: isNum(quote?.rangeObservations)
              ? `the ${field === 'fiftyTwoWeekHigh' ? 'highest' : 'lowest'} of ${quote.rangeObservations} trading days`
              : undefined,
          })
        : dash(key, label, 'currency', 'The year of daily prices this is measured over did not come back.', priceSource)
    );
  }

  // EVERY RATIO COMES FROM ONE FILING, which is what `latestWithAll` is for.
  //
  // Taking "the latest profit" and "the latest share count" separately looks
  // equivalent and is not. HDB reports shareholders' equity for FY2026 and no
  // diluted share count that year, so the two taken separately divided FY2026
  // equity by a count that is null — Infinity, printed as a book value per
  // share. The near miss is worse than the error: had FY2026 carried a count,
  // the FY2025 one would have been used silently, and HDB's count went from
  // 1.86bn to 5.11bn across the years held, so the figure could have been out
  // by a factor of three and still looked entirely ordinary.
  const earnings = latestWithAll(statements, 'netIncome', 'dilutedShares');
  const bookRow = latestWithAll(statements, 'equity', 'dilutedShares');
  const returns = latestWithAll(statements, 'netIncome', 'equity');
  const perShare = (row: any, value: number) => (value * 1e6) / row.dilutedShares;
  const oneFiling = (what: string, other = 'a diluted share count') =>
    `No filing held reports ${what} and ${other} in the same year, so the two cannot be divided without ` +
    "mixing one year's figure into another year's denominator.";

  if (price === null || shares === null) {
    stats.push(
      dash('pe', 'Price / earnings', 'multiple', price === null ? 'There is no price to divide.' : noShares, vendor)
    );
  } else if (!earnings) {
    stats.push(dash('pe', 'Price / earnings', 'multiple', oneFiling('a profit for the year'), vendor));
  } else if (earnings.netIncome <= 0) {
    stats.push(
      dash(
        'pe',
        'Price / earnings',
        'multiple',
        `The company reported a loss in ${filingLabel(filingOf(earnings))}. A price divided by a loss is a ` +
          'negative number that reads like a multiple and is not one, so none is shown.',
        vendor
      )
    );
  } else {
    const eps = perShare(earnings, earnings.netIncome);
    stats.push(
      got('pe', 'Price / earnings', 'multiple', price / eps, `${priceSource} ÷ ${vendor}`, earnings.periodEnd ?? null, {
        formula: 'price ÷ (profit for the year ÷ diluted shares)',
        note: `on ${filingLabel(filingOf(earnings))}`,
      })
    );
  }

  const bookPerShare = bookRow && bookRow.equity > 0 ? perShare(bookRow, bookRow.equity) : null;

  stats.push(
    bookPerShare === null
      ? dash(
          'bookValue',
          'Book value per share',
          'currency',
          bookRow
            ? 'The company reports negative shareholders’ equity, so there is no book value to divide by the shares.'
            : oneFiling('shareholders’ equity'),
          vendor
        )
      : got('bookValue', 'Book value per share', 'currency', bookPerShare, vendor, bookRow.periodEnd ?? null, {
          formula: 'shareholders’ equity ÷ diluted shares',
          note: `on ${filingLabel(filingOf(bookRow))}`,
        })
  );

  stats.push(
    price === null || bookPerShare === null
      ? dash(
          'pb',
          'Price / book',
          'multiple',
          price === null
            ? 'There is no price to divide.'
            : 'There is no book value per share to divide by; the reason is beside that figure.',
          vendor
        )
      : got('pb', 'Price / book', 'multiple', price / bookPerShare, `${priceSource} ÷ ${vendor}`, bookRow.periodEnd ?? null, {
          formula: 'price ÷ book value per share',
          note: `on ${filingLabel(filingOf(bookRow))}`,
        })
  );

  // DIVIDENDS PAID IS A CASH OUTFLOW and some sources file it negative, some
  // positive. The size is what matters, so the magnitude is taken and said.
  const dividends =
    latestWithAll(statements, 'commonDividendsPaid', 'dilutedShares') ??
    latestWithAll(statements, 'dividendsPaid', 'dilutedShares');
  const dividendPaid = dividends
    ? isNum(dividends.commonDividendsPaid)
      ? dividends.commonDividendsPaid
      : dividends.dividendsPaid
    : null;
  stats.push(
    price === null || dividendPaid === null
      ? dash(
          'dividendYield',
          'Dividend yield',
          'percent',
          price === null
            ? 'There is no price to measure a yield against.'
            : `${oneFiling('dividends paid')} Dividends not being reported is not the same as none being paid.`,
          vendor
        )
      : got(
          'dividendYield',
          'Dividend yield',
          'percent',
          ((Math.abs(dividendPaid) * 1e6) / dividends.dilutedShares / price) * 100,
          `${priceSource} ÷ ${vendor}`,
          dividends.periodEnd ?? null,
          {
            formula: 'dividends paid ÷ diluted shares ÷ price',
            note: `on the dividends of ${filingLabel(filingOf(dividends))}`,
            caveat:
              'That is what the company actually paid out in that year, taken from the cash flow statement. It is ' +
              'not a rate declared for this year, and it is not adjusted for a payment made at an unusual time.',
          }
        )
  );

  // ---- the returns, from the engine's own ratio definitions ---------------
  const roceRow = reportedRatioLatest(statements, 'roce');
  stats.push(
    roceRow
      ? got('roce', 'ROCE', 'percent', roceRow.value, vendor, roceRow.periodEnd, {
          formula: 'operating profit ÷ (total assets − current liabilities)',
          note: `on ${filingLabel({ fiscalYear: roceRow.fiscalYear, periodEnd: roceRow.periodEnd })}`,
        })
      : dash(
          'roce',
          'ROCE',
          'percent',
          'Operating profit, total assets or current liabilities are not all reported, so the capital employed ' +
            'cannot be worked out.',
          vendor
        )
  );

  const roe = returns && returns.equity > 0 ? (returns.netIncome / returns.equity) * 100 : null;
  stats.push(
    roe === null
      ? dash(
          'roe',
          'ROE',
          'percent',
          !returns
            ? oneFiling('a profit for the year', 'shareholders’ equity')
            : 'The company reports negative shareholders’ equity, so a return on it would not mean anything.',
          vendor
        )
      : got('roe', 'ROE', 'percent', roe, vendor, returns.periodEnd ?? null, {
          formula: 'profit for the year ÷ shareholders’ equity',
          note: `on ${filingLabel(filingOf(returns))}`,
        })
  );

  // ---- face value ---------------------------------------------------------
  // NEITHER SOURCE PUBLISHES IT. Screener shows a face value because the Indian
  // exchanges file one; the SEC's XBRL has a par value that is not the same
  // thing and is nil for most filers, and Yahoo's modules carry neither. So it
  // is a dash with the reason rather than a par value relabelled, which would
  // be a different figure under the same name.
  stats.push(
    dash(
      'faceValue',
      'Face value',
      'currency',
      'Neither source this page reads publishes a face value. The SEC files a par value, which is a different ' +
        'figure and is nil for most filers, so it is not shown under this name. It arrives with the Indian ' +
        'primary-filings layer (docs/DATA_LAYER_PLAN.md).',
      vendor
    )
  );

  const latestFiling = statements.length ? filingOf(statements[statements.length - 1]) : null;

  return {
    stats,
    filing: latestFiling,
    currency,
    currencySymbol,
    freshness: [
      { block: 'Price and ranges', source: priceSource, asOf: quoteAsOf },
      {
        block: 'Financial statements',
        source: payload?.source || vendor,
        asOf: latestFiling?.periodEnd ?? null,
      },
      {
        block: 'Company profile',
        source: payload?.profile ? 'Yahoo Finance (profile)' : 'not fetched',
        asOf: typeof payload?.fetchedAt === 'string' ? payload.fetchedAt : null,
      },
      {
        block: 'Price history',
        source: payload?.quote?.history?.source || 'not fetched',
        asOf: payload?.quote?.history?.daily?.to ?? payload?.quote?.history?.monthly?.to ?? null,
      },
    ],
  };
}

/**
 * The latest period for which the engine's own ratio set carries a figure.
 *
 * `reportedRatios` keeps the fiscal year but not the period end, so the end
 * date is read back off the statement row it belongs to rather than
 * reconstructed from the year — a company whose year ends in March would
 * otherwise be dated to a December it never filed against.
 */
function reportedRatioLatest(
  statements: any[],
  key: string
): { value: number; fiscalYear: number | null; periodEnd: string | null } | null {
  let periods: any[] = [];
  try {
    periods = (reportedRatios(statements) as any)?.periods ?? [];
  } catch {
    return null;
  }
  for (let i = periods.length - 1; i >= 0; i--) {
    const value = periods[i]?.ratios?.[key]?.value;
    if (!isNum(value)) continue;
    const year = isNum(periods[i]?.fiscalYear) ? periods[i].fiscalYear : null;
    const row = statements.find((r) => r?.fiscalYear === year);
    return { value, fiscalYear: year, periodEnd: row?.periodEnd ?? null };
  }
  return null;
}

/**
 * A stat as the screen prints it. An em dash when there is no figure — and the
 * em dash is produced HERE rather than in the component, so the check that no
 * figure ever renders as zero can read the same string the reader sees.
 */
export function formatStat(stat: OverviewStat, currencySymbol: string): string {
  if (stat.value === null) return '—';
  const n = stat.value;
  switch (stat.unit) {
    case 'percent':
      return `${n >= 0 ? '' : '−'}${Math.abs(n).toFixed(n === 0 || Math.abs(n) >= 10 ? 1 : 2)}%`;
    case 'multiple':
      return `${n.toFixed(n >= 100 ? 0 : 1)}×`;
    case 'count':
      return n.toLocaleString('en-US');
    case 'currency':
    default:
      return `${currencySymbol}${compactMoney(n)}`;
  }
}

/** 4.55T, 812B, 1,204 — the scale a reader of a summary panel expects. */
export function compactMoney(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1000) return `${sign}${abs.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  return `${sign}${abs.toFixed(2)}`;
}

export default { overviewStats, formatStat, compactMoney, filingLabel, latestWith };
