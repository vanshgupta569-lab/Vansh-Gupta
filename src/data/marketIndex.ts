// FILE: src/data/marketIndex.ts
//
// THE INDEX A BETA IS MEASURED AGAINST, AND HOW THE TWO SERIES ARE LINED UP.
//
// `docs/COST_OF_CAPITAL_SPEC.md` rule 1 is the whole reason this file exists:
// **we calculate beta ourselves from one stated recipe and never paste a
// vendor's beta.** A vendor's beta is a number with no method attached — Yahoo
// says "5Y Monthly" and will not say which index or whether it adjusts,
// Bloomberg defaults to two years weekly and Blume-adjusts, Morningstar uses
// thirty-six months, Screener does not document its method at all — so four
// sites can show four different betas for one company and none of them can be
// checked. Ours states the window, the frequency, the index and the number of
// observations, and the regression is in `costOfCapital.ts` where it can be
// read.
//
// WHICH INDEX, AND HOW EACH ONE GOT HERE. Rule 6 names eight defaults. Every
// symbol below was fetched once on 2026-10-29 before it was written in, and the
// three that failed that test are recorded as failures rather than left to
// fail on a reader's screen:
//
//   TOPIX — rule 6's Japanese default — IS NOT ON THIS ENDPOINT. `^TOPX`,
//   `^TPX` and `998405.T` all answered 404. An ETF that tracks it does answer,
//   and using one would be presenting a fund's returns (fees, tracking error
//   and all) as the market's, so Japan uses the Nikkei 225 and the card says
//   which index it used. JPX publishes TOPIX itself; its terms are unread
//   (`docs/ARCHIVE_PLAN.md` §2.7).
//
//   CDAX — rule 6's German default — answered with a single close and no
//   history (`^CDAXX`), and `^CDAX` answered 404. Rule 6 names the DAX as the
//   alternative, so Germany uses the DAX.
//
//   NORWAY AND SAUDI ARABIA HAVE NO INDEX HERE: `^OSEAX` answered 404 and
//   `^TASI.SR` answered with one close. Both markets hold one company each in
//   the development set, and both get no calculated beta at all rather than a
//   beta against somebody else's market.
//
// THIRTEEN MARKETS BEYOND THE EIGHT. The spec's eight cover 101 of the 176
// companies this site holds; the other 75 are listed in Hong Kong, Paris,
// Amsterdam, Milan, Madrid, Zurich, Stockholm, Copenhagen, São Paulo, Taipei,
// Tel Aviv, Johannesburg and Singapore. Each of those indices was fetched the
// same way and is marked as an addition rather than one of the spec's
// defaults, because a reader should be able to tell what was specified from
// what was extended.
//
// AN INDEX IS VENDOR DATA, on the same footing as the share price it is
// regressed against: free for development, licensed before launch (rule 6,
// and `docs/VISION.md`'s **Paid · last**). Nothing here is redistributed.
//
// THE SAMPLING IS IN ONE PLACE ON PURPOSE. A month-end close means the last
// close of the calendar month, and both the company's series and the index's
// are sampled by `monthEnds` below. Two copies of that rule is the trap
// `CLAUDE.md` names as "two copies of a positional layout": a month-end on one
// side and a month-start on the other would pair the wrong returns and produce
// a beta that looks perfectly plausible.

export interface MarketIndex {
  /** The vendor's symbol for the series. */
  symbol: string;
  /** What it is called on the card. */
  name: string;
  /** The market it stands for. */
  market: string;
  /** The currency the index is quoted in: rule 2 wants the listing currency. */
  currency: string;
  /** True where rule 6 names this index as the default for its country. */
  specDefault: boolean;
  /** Why this one rather than rule 6's, where they differ. */
  instead?: string;
}

/**
 * The indices, keyed by market. Every one of these was read at the source on
 * 2026-10-29; the count of closes each returned is in the commit message.
 */
export const INDICES: Record<string, MarketIndex> = {
  'United States': { symbol: '^GSPC', name: 'S&P 500', market: 'United States', currency: 'USD', specDefault: true },
  India: { symbol: '^CRSLDX', name: 'Nifty 500', market: 'India', currency: 'INR', specDefault: true },
  'United Kingdom': { symbol: '^FTAS', name: 'FTSE All-Share', market: 'United Kingdom', currency: 'GBP', specDefault: true },
  Japan: {
    symbol: '^N225',
    name: 'Nikkei 225',
    market: 'Japan',
    currency: 'JPY',
    specDefault: false,
    instead:
      'Rule 6 names TOPIX. It is not published on the endpoint this site reads — three symbols for it ' +
      'answered 404 on 2026-10-29 — and an ETF that tracks it is a fund, not the market.',
  },
  Korea: { symbol: '^KS11', name: 'KOSPI', market: 'Korea', currency: 'KRW', specDefault: true },
  Germany: {
    symbol: '^GDAXI',
    name: 'DAX',
    market: 'Germany',
    currency: 'EUR',
    specDefault: true,
    instead:
      'Rule 6 names the CDAX first and the DAX as the alternative. The CDAX answered with one close and ' +
      'no history on 2026-10-29, so this is the alternative the rule allows for.',
  },
  Canada: { symbol: '^GSPTSE', name: 'S&P/TSX Composite', market: 'Canada', currency: 'CAD', specDefault: true },
  Australia: { symbol: '^AXJO', name: 'S&P/ASX 200', market: 'Australia', currency: 'AUD', specDefault: true },

  // Beyond rule 6's eight, each read at the source the same day.
  'Hong Kong': { symbol: '^HSI', name: 'Hang Seng', market: 'Hong Kong', currency: 'HKD', specDefault: false },
  France: { symbol: '^FCHI', name: 'CAC 40', market: 'France', currency: 'EUR', specDefault: false },
  Netherlands: { symbol: '^AEX', name: 'AEX', market: 'Netherlands', currency: 'EUR', specDefault: false },
  Italy: { symbol: 'FTSEMIB.MI', name: 'FTSE MIB', market: 'Italy', currency: 'EUR', specDefault: false },
  Spain: { symbol: '^IBEX', name: 'IBEX 35', market: 'Spain', currency: 'EUR', specDefault: false },
  Switzerland: { symbol: '^SSMI', name: 'SMI', market: 'Switzerland', currency: 'CHF', specDefault: false },
  Sweden: { symbol: '^OMX', name: 'OMX Stockholm 30', market: 'Sweden', currency: 'SEK', specDefault: false },
  Denmark: { symbol: '^OMXC25', name: 'OMX Copenhagen 25', market: 'Denmark', currency: 'DKK', specDefault: false },
  Brazil: { symbol: '^BVSP', name: 'Ibovespa', market: 'Brazil', currency: 'BRL', specDefault: false },
  Taiwan: { symbol: '^TWII', name: 'TAIEX', market: 'Taiwan', currency: 'TWD', specDefault: false },
  Israel: { symbol: '^TA125.TA', name: 'TA-125', market: 'Israel', currency: 'ILS', specDefault: false },
  'South Africa': { symbol: '^J203.JO', name: 'FTSE/JSE All Share', market: 'South Africa', currency: 'ZAR', specDefault: false },
  Singapore: { symbol: '^STI', name: 'Straits Times', market: 'Singapore', currency: 'SGD', specDefault: false },
};

/**
 * The allow-list the route validates against, so `?symbol=` can fetch an index
 * and nothing else. `api/marketIndex.js` carries its own copy — each file in
 * that directory is packaged alone by the host, and a shared import that fails
 * to bundle takes the route down — and `npm run verify` asserts the two lists
 * are identical, which is the only thing that keeps a second copy honest.
 */
export const INDEX_SYMBOLS: string[] = Object.values(INDICES).map((i) => i.symbol);

/**
 * WHICH MARKET A LISTING IS IN, read off the exchange the quote came from.
 *
 * The exchange rather than the company's country, because beta is a property
 * of a quoted share: the series being regressed is the one that trades on that
 * exchange, in that exchange's currency, against that market's index. A
 * company incorporated in one country and listed in another is common and is
 * not an error.
 */
const EXCHANGE_MARKET: Record<string, string> = {
  NYSE: 'United States',
  NasdaqGS: 'United States',
  NasdaqGM: 'United States',
  NasdaqCM: 'United States',
  'NYSE American': 'United States',
  'NYSE Arca': 'United States',
  BATS: 'United States',
  NSE: 'India',
  BSE: 'India',
  LSE: 'United Kingdom',
  Tokyo: 'Japan',
  KSE: 'Korea',
  KOSDAQ: 'Korea',
  XETRA: 'Germany',
  'Frankfurt Stock Exchange': 'Germany',
  Toronto: 'Canada',
  ASX: 'Australia',
  HKSE: 'Hong Kong',
  Paris: 'France',
  Amsterdam: 'Netherlands',
  Milan: 'Italy',
  MCE: 'Spain',
  Swiss: 'Switzerland',
  Stockholm: 'Sweden',
  Copenhagen: 'Denmark',
  'São Paulo': 'Brazil',
  'Sao Paulo': 'Brazil',
  Taiwan: 'Taiwan',
  'Tel Aviv': 'Israel',
  Johannesburg: 'South Africa',
  SES: 'Singapore',
};

/** The ticker suffix, for a payload whose exchange name is not recognised. */
const SUFFIX_MARKET: Record<string, string> = {
  NS: 'India',
  BO: 'India',
  L: 'United Kingdom',
  T: 'Japan',
  KS: 'Korea',
  DE: 'Germany',
  TO: 'Canada',
  AX: 'Australia',
  HK: 'Hong Kong',
  PA: 'France',
  AS: 'Netherlands',
  MI: 'Italy',
  MC: 'Spain',
  SW: 'Switzerland',
  ST: 'Sweden',
  CO: 'Denmark',
  SA: 'Brazil',
  TW: 'Taiwan',
  TA: 'Israel',
  JO: 'South Africa',
  SI: 'Singapore',
};

export interface IndexChoice {
  /** The index to regress against, or null with a reason. */
  index: MarketIndex | null;
  /** The market the listing was placed in, where it could be placed. */
  market: string | null;
  /** Why there is no index, in the words the card shows. */
  reason: string | null;
}

/**
 * The index for a payload's own listing.
 *
 * A market with no verified index is NOT given a neighbour's. Rule 2 wants a
 * broad local index in the listing currency, and the S&P 500 is neither local
 * nor in the currency for a company quoted in Oslo: the beta it produced would
 * be a measurement of that company against the United States, which is a
 * different quantity wearing the same name. So the card shows no beta and says
 * which index it would need, which `CLAUDE.md` standing decision 3 calls
 * refusing rather than approximating.
 */
export function indexForListing(payload: any): IndexChoice {
  const exchange = String(payload?.quote?.exchange || '').trim();
  const ticker = String(payload?.ticker || '');
  const dot = ticker.lastIndexOf('.');
  const suffix = dot > 0 ? ticker.slice(dot + 1).toUpperCase() : '';

  const market = EXCHANGE_MARKET[exchange] ?? SUFFIX_MARKET[suffix] ?? null;
  if (!market) {
    return {
      index: null,
      market: null,
      reason: exchange
        ? `No index is configured for ${exchange}. A beta needs a broad index for the market the share ` +
          'actually trades on, in that market’s currency, and borrowing another market’s index would ' +
          'measure this company against the wrong economy.'
        : 'The data does not say which exchange this listing trades on, so there is no market to measure ' +
          'it against.',
    };
  }
  const index = INDICES[market] ?? null;
  if (!index) {
    return {
      index: null,
      market,
      reason:
        `No broad index for ${market} could be read at the source, so no beta is calculated for a ` +
        `${market} listing. Borrowing another market’s index would measure this company against the ` +
        'wrong economy.',
    };
  }
  return { index, market, reason: null };
}

// ---------------------------------------------------------------------------
// THE SERIES, AND HOW IT IS SAMPLED
// ---------------------------------------------------------------------------

/** A price series as both sides of the regression carry it. */
export interface Series {
  dates: string[];
  closes: number[];
}

/** What `/api/marketIndex` answers with. */
export interface IndexSeries extends Series {
  symbol: string;
  name: string;
  currency: string | null;
  source: string;
  terms: string;
  from: string;
  to: string;
  asOf: string;
}

/**
 * The last close of each calendar month.
 *
 * A month-end is the last day the instrument TRADED in that month, not the
 * last day of the month: markets close on the 31st often enough that insisting
 * on the calendar date would drop a twelfth of the observations, and the two
 * series are sampled by the same rule so a holiday on one side pairs with the
 * nearest close on the other rather than with nothing.
 */
export function monthEnds(series: Series | null | undefined): Series {
  return lastOfEach(series, (d) => d.slice(0, 7));
}

/**
 * The last close of each ISO week, for the two-year weekly estimate (rule 2's
 * second window, which is Bloomberg's default and so the one a reader is most
 * likely to be holding a different number from).
 */
export function weekEnds(series: Series | null | undefined): Series {
  return lastOfEach(series, isoWeek);
}

function lastOfEach(series: Series | null | undefined, key: (date: string) => string): Series {
  const dates = series?.dates ?? [];
  const closes = series?.closes ?? [];
  const outDates: string[] = [];
  const outCloses: number[] = [];
  for (let i = 0; i < dates.length; i++) {
    if (typeof closes[i] !== 'number' || !isFinite(closes[i])) continue;
    const here = key(dates[i]);
    // Look forward for the next usable point: the last point of a period is the
    // one whose successor belongs to another period.
    let next = '';
    for (let j = i + 1; j < dates.length; j++) {
      if (typeof closes[j] === 'number' && isFinite(closes[j])) {
        next = key(dates[j]);
        break;
      }
    }
    if (next !== here) {
      outDates.push(dates[i]);
      outCloses.push(closes[i]);
    }
  }
  return { dates: outDates, closes: outCloses };
}

/** The ISO week a date falls in, as `2026-W44`. */
function isoWeek(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const day = d.getUTCDay() || 7; // Monday 1 … Sunday 7
  d.setUTCDate(d.getUTCDate() + 4 - day); // the Thursday of that week
  const year = d.getUTCFullYear();
  const jan1 = Date.UTC(year, 0, 1);
  const week = Math.ceil(((d.getTime() - jan1) / 86400000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/** The part of a series on or after a date. */
export function since(series: Series, from: string): Series {
  const dates: string[] = [];
  const closes: number[] = [];
  for (let i = 0; i < series.dates.length; i++) {
    if (series.dates[i] >= from) {
      dates.push(series.dates[i]);
      closes.push(series.closes[i]);
    }
  }
  return { dates, closes };
}

/** The date `years` before the last observation in a series. */
export function startOfWindow(series: Series, years: number): string {
  const last = series.dates[series.dates.length - 1];
  if (!last) return '0000-00-00';
  const d = new Date(`${last}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d.toISOString().slice(0, 10);
}

/**
 * Fetch one index's series from this site's own route.
 *
 * The route is a thin proxy over the same chart endpoint the share price comes
 * from: it exists so the symbol is checked against the allow-list above and so
 * the browser is not asking a third party directly from the page.
 */
export async function fetchIndexSeries(symbol: string): Promise<IndexSeries> {
  const res = await fetch(`/api/marketIndex?symbol=${encodeURIComponent(symbol)}`);
  const body = await res.json();
  if (!res.ok || body?.error) throw new Error(body?.error || `Could not load ${symbol}`);
  return body as IndexSeries;
}

export default { INDICES, INDEX_SYMBOLS, indexForListing, monthEnds, weekEnds, since, startOfWindow };
