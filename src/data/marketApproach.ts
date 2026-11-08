// FILE: src/data/marketApproach.ts
//
// Marginalia — the market approach
//
// There are three ways to value a company, and until now this site used one.
//
//   INCOME  what the business is worth on the cash it produces      (the DCF)
//   MARKET  what buyers are paying today for businesses like it     (this file)
//   ASSET   what the things it owns would fetch                     (not yet)
//
// The peer set was already being fetched and its median EV/EBITDA already
// shown, but only as a cross-check sitting beside the discounted cash flow.
// This file turns it into a valuation in its own right: three multiples, each
// applied to this company's own figure, each producing a value per share, with
// every step printed so it can be followed.
//
// TWO RULES THIS FILE ENFORCES
//
// 1. Trailing multiples go on trailing figures. The peer multiples come from
//    the data source as TRAILING numbers — what each peer trades at on the
//    profit it has already reported. Applying a trailing multiple to a forecast
//    EBITDA silently prices in every year of growth twice, once in the forecast
//    and once in the multiple. So every figure used here is the LAST REPORTED
//    YEAR, never the forecast.
//
// 2. A method that cannot be computed is left out, not shown as zero. A
//    loss-making company has no meaningful price-to-earnings figure, and a
//    company with negative EBITDA has no EV/EBITDA value. Those rows simply do
//    not appear, and the reason is stated on screen.

export interface SubjectFigures {
  /** Last reported year, not the forecast. */
  ebitda: number | null;
  revenue: number | null;
  netIncome: number | null;
  netDebt: number | null;
  /** Minority interests plus preferred stock, taken off enterprise value with net debt. */
  otherClaims: number;
  dilutedShares: number | null;
  fiscalYear?: number | null;
}

export interface MarketMultiple {
  key: 'evToEbitda' | 'evToSales' | 'priceToEarnings';
  label: string;
  median: number | null;
  metricLabel: string;
  metric: number | null;
  perShare: number | null;
  workings: string;
  /** Why this one is absent, when it is. */
  absentBecause?: string;
  /**
   * THE PEERS' OWN SPREAD ON THIS MULTIPLE (job B2): the 25th percentile, the
   * median and the 75th — or the min and max where fewer than four peers carry
   * it, which the row says. The values are the MULTIPLES; `lowPerShare` and
   * `highPerShare` are what they imply for this company.
   */
  spreadLow: number | null;
  spreadHigh: number | null;
  spreadPeers: number;
  spreadBasis: 'percentiles' | 'min-max' | 'none';
  lowPerShare: number | null;
  highPerShare: number | null;
}

export interface MarketApproachResult {
  available: boolean;
  message?: string;
  peerCount: number;
  basis?: string;
  fiscalYear?: number | null;
  multiples: MarketMultiple[];
  usable: MarketMultiple[];
  low: number | null;
  high: number | null;
  mid: number | null;
  /**
   * WHICH MULTIPLES THE RANGE WAS FLEXED ON, at what, and on how many peers
   * (job B2): `EV / EBITDA 9.8–14.1×, Price / Earnings 18–26×, 7 peers`.
   */
  detail?: string;
  /** Every company the data source suggested, whether selected or not. */
  candidates: any[];
  /** The symbols currently in the peer set. */
  selected: string[];
  /** True when the reader has changed the peer set from the default. */
  edited: boolean;
}

const isNum = (v: any): v is number => typeof v === 'number' && isFinite(v);

/**
 * The middle of a set of multiples, not the average.
 *
 * One peer on an extreme number would drag an average somewhere no company in
 * the set actually trades. Computed here rather than on the server because the
 * reader can change which companies are in the set, and a median that came from
 * the server would quietly stop matching the list on screen.
 */
export function medianOf(values: any[]): number | null {
  const clean = values
    .filter((v): v is number => isNum(v) && v > 0)
    .sort((a, b) => a - b);
  if (!clean.length) return null;
  const mid = Math.floor(clean.length / 2);
  const value =
    clean.length % 2 ? clean[mid] : (clean[mid - 1] + clean[mid]) / 2;
  return Number(value.toFixed(2));
}

/**
 * A PERCENTILE OF THE PEERS' OWN MULTIPLES (build step 5, job B2).
 *
 * The market range was the spread of the three implied values — one per
 * multiple, each struck at the peers' MEDIAN — so it said how far the three
 * methods disagreed, not how far the peers do. VALUATION_SIDE_BY_SIDE rule 2
 * asks for a range from flexing a stated assumption, and the assumption here is
 * what the market pays: the 25th to the 75th percentile of the peers'
 * multiples, with the median as the point.
 *
 * Linear interpolation between the two neighbouring peers, which is the
 * ordinary inclusive definition: with seven peers the 25th percentile sits
 * between the second and third, and reporting the second alone would quietly
 * widen every range by one peer's distance.
 */
export function percentileOf(values: any[], p: number): number | null {
  const clean = values.filter((v): v is number => isNum(v) && v > 0).sort((a, b) => a - b);
  if (!clean.length) return null;
  if (clean.length === 1) return Number(clean[0].toFixed(2));
  const at = (clean.length - 1) * p;
  const below = Math.floor(at);
  const above = Math.ceil(at);
  const value =
    below === above ? clean[below] : clean[below] + (clean[above] - clean[below]) * (at - below);
  return Number(value.toFixed(2));
}

/**
 * THE SPREAD OF ONE MULTIPLE ACROSS THE PEER SET, and how many peers it rests
 * on.
 *
 * FEWER THAN FOUR PEERS AND A PERCENTILE IS A PRETENCE: with three figures the
 * 25th and 75th percentiles are interpolations between two of them, and the
 * range they give is narrower than the peers themselves. So the spread becomes
 * the MIN AND MAX of the peers, and the row says which it used (B-1, approved
 * 4 November 2026).
 */
export function spreadOf(values: any[]): {
  low: number | null;
  median: number | null;
  high: number | null;
  peers: number;
  basis: 'percentiles' | 'min-max' | 'none';
} {
  const clean = values.filter((v): v is number => isNum(v) && v > 0).sort((a, b) => a - b);
  if (!clean.length) return { low: null, median: null, high: null, peers: 0, basis: 'none' };
  const median = medianOf(clean);
  if (clean.length < 4) {
    return {
      low: Number(clean[0].toFixed(2)),
      median,
      high: Number(clean[clean.length - 1].toFixed(2)),
      peers: clean.length,
      basis: 'min-max',
    };
  }
  return {
    low: percentileOf(clean, 0.25),
    median,
    high: percentileOf(clean, 0.75),
    peers: clean.length,
    basis: 'percentiles',
  };
}

export function spreadsOf(peers: any[]) {
  return {
    evToEbitda: spreadOf(peers.map((p) => p?.evToEbitda)),
    evToSales: spreadOf(peers.map((p) => p?.evToSales)),
    priceToEarnings: spreadOf(peers.map((p) => p?.priceToEarnings)),
  };
}

export function mediansOf(peers: any[]) {
  return {
    evToEbitda: medianOf(peers.map((p) => p?.evToEbitda)),
    evToSales: medianOf(peers.map((p) => p?.evToSales)),
    priceToEarnings: medianOf(peers.map((p) => p?.priceToEarnings)),
  };
}

/** The peer set the server chose, used when the reader has not chosen one. */
export function defaultSelection(comps: any): string[] {
  const candidates = Array.isArray(comps?.candidates) ? comps.candidates : [];
  if (candidates.length) {
    return candidates
      .filter((c: any) => c?.selectedByDefault)
      .map((c: any) => c.symbol);
  }
  return (Array.isArray(comps?.peers) ? comps.peers : []).map((p: any) => p.symbol);
}

/** Pull the trailing figures the market approach needs out of an engine run. */
export function trailingFiguresFrom(model: any, dcf: any, source?: any): SubjectFigures {
  const nH: number = model?.nH ?? 0;
  const last = nH - 1;
  const at = (series: any) =>
    Array.isArray(series) && isNum(series[last]) ? series[last] : null;

  const years = source?.meta?.historicalYears;
  return {
    ebitda: at(model?.ebitda),
    revenue: at(model?.revenue),
    netIncome: at(model?.netIncome),
    netDebt: isNum(dcf?.netDebt) ? dcf.netDebt : null,
    otherClaims: isNum(dcf?.otherClaims) ? dcf.otherClaims : 0,
    dilutedShares: isNum(dcf?.dilutedShares)
      ? dcf.dilutedShares
      : isNum(dcf?.perpetuity?.dilutedShares)
      ? dcf.perpetuity.dilutedShares
      : null,
    fiscalYear: Array.isArray(years) && years.length ? years[years.length - 1] : null,
  };
}

export function buildMarketApproach(
  comps: any,
  subject: SubjectFigures,
  selectedSymbols?: string[] | null
): MarketApproachResult {
  const candidates = Array.isArray(comps?.candidates) ? comps.candidates : [];
  const serverPeers = Array.isArray(comps?.peers) ? comps.peers : [];
  const pool = candidates.length ? candidates : serverPeers;

  const fallbackSelection = defaultSelection(comps);
  const selected = Array.isArray(selectedSymbols) ? selectedSymbols : fallbackSelection;
  const edited =
    Array.isArray(selectedSymbols) &&
    (selectedSymbols.length !== fallbackSelection.length ||
      selectedSymbols.some((s) => !fallbackSelection.includes(s)));

  const empty: MarketApproachResult = {
    available: false,
    peerCount: 0,
    multiples: [],
    usable: [],
    low: null,
    high: null,
    mid: null,
    candidates: pool,
    selected,
    edited,
  };

  const peers = pool.filter((p: any) => selected.includes(p?.symbol));
  if (!peers.length) {
    return {
      ...empty,
      message: pool.length
        ? 'No companies are selected as comparables, so no value is shown. Choose the ones you consider genuinely alike.'
        : comps?.message ||
          'No comparable companies could be identified for this ticker from the free sources available.',
    };
  }

  // Recomputed from whatever is selected, never taken from the server, so the
  // figure can never disagree with the list on screen.
  const medians = mediansOf(peers);
  // THE PEERS' OWN SPREAD ON EACH MULTIPLE (job B2), from the same selected
  // peers the medians come from, so the range on the screen can never disagree
  // with the list beside it.
  const spreads = spreadsOf(peers);
  const shares = subject.dilutedShares;
  const netDebt = subject.netDebt;

  /**
   * A P/E APPLIED TO THIS COMPANY'S OWN EARNINGS PER SHARE. No net debt step: a
   * price-to-earnings multiple is already an equity figure.
   *
   * Written once because job B2 needs it three times — at the 25th percentile,
   * at the median and at the 75th — and three copies of one formula is how the
   * bounds come to disagree with the point between them.
   */
  const fromEarnings = (multiple: number | null) => {
    if (!isNum(multiple) || multiple <= 0) return null;
    if (!isNum(subject.netIncome) || !isNum(shares) || shares <= 0) return null;
    if (subject.netIncome <= 0) return null;
    const value = multiple * (subject.netIncome / shares);
    return isNum(value) && value > 0 ? value : null;
  };

  const fromEnterpriseValue = (median: number | null, metric: number | null) => {
    if (!isNum(median) || !isNum(metric) || metric <= 0) return null;
    if (!isNum(shares) || shares <= 0 || !isNum(netDebt)) return null;
    // Enterprise value less net debt, minority interests and preferred stock,
    // as in the discounted cash flow's bridge.
    const value = (median * metric - netDebt - (subject.otherClaims ?? 0)) / shares;
    return isNum(value) && value > 0 ? value : null;
  };

  const multiples: MarketMultiple[] = [
    {
      key: 'evToEbitda',
      label: 'EV / EBITDA',
      median: isNum(medians.evToEbitda) ? medians.evToEbitda : null,
      metricLabel: 'reported EBITDA',
      metric: subject.ebitda,
      perShare: fromEnterpriseValue(medians.evToEbitda, subject.ebitda),
      workings:
        'peer median EV/EBITDA × this company’s reported EBITDA, less net debt, divided by diluted shares. ' +
        'Both sides are operating profit before depreciation and amortisation, with stock compensation left ' +
        'in costs, which is how the peers’ multiples are computed',
      absentBecause:
        !isNum(medians.evToEbitda)
          ? 'the peer set did not produce a median'
          : !isNum(subject.ebitda) || subject.ebitda <= 0
          ? 'EBITDA is not positive, so a multiple of it has no meaning'
          : undefined,
      spreadLow: spreads.evToEbitda.low,
      spreadHigh: spreads.evToEbitda.high,
      spreadPeers: spreads.evToEbitda.peers,
      spreadBasis: spreads.evToEbitda.basis,
      lowPerShare: fromEnterpriseValue(spreads.evToEbitda.low, subject.ebitda),
      highPerShare: fromEnterpriseValue(spreads.evToEbitda.high, subject.ebitda),
    },
    {
      key: 'evToSales',
      label: 'EV / Sales',
      median: isNum(medians.evToSales) ? medians.evToSales : null,
      metricLabel: 'reported revenue',
      metric: subject.revenue,
      perShare: fromEnterpriseValue(medians.evToSales, subject.revenue),
      workings:
        'peer median EV/Sales × this company’s reported revenue, less net debt, divided by diluted shares',
      absentBecause: !isNum(medians.evToSales)
        ? 'the peer set did not produce a median'
        : undefined,
      spreadLow: spreads.evToSales.low,
      spreadHigh: spreads.evToSales.high,
      spreadPeers: spreads.evToSales.peers,
      spreadBasis: spreads.evToSales.basis,
      lowPerShare: fromEnterpriseValue(spreads.evToSales.low, subject.revenue),
      highPerShare: fromEnterpriseValue(spreads.evToSales.high, subject.revenue),
    },
    {
      key: 'priceToEarnings',
      label: 'Price / Earnings',
      median: isNum(medians.priceToEarnings) ? medians.priceToEarnings : null,
      metricLabel: 'reported earnings per share',
      metric:
        isNum(subject.netIncome) && isNum(shares) && shares > 0
          ? subject.netIncome / shares
          : null,
      perShare: fromEarnings(medians.priceToEarnings),
      workings:
        'peer median P/E × this company’s reported earnings per share. No net debt step: a P/E is already an equity figure.',
      absentBecause:
        !isNum(medians.priceToEarnings)
          ? 'the peer set did not produce a median'
          : !isNum(subject.netIncome) || subject.netIncome <= 0
          ? 'the company did not report a profit, so a multiple of earnings has no meaning'
          : undefined,
      spreadLow: spreads.priceToEarnings.low,
      spreadHigh: spreads.priceToEarnings.high,
      spreadPeers: spreads.priceToEarnings.peers,
      spreadBasis: spreads.priceToEarnings.basis,
      lowPerShare: fromEarnings(spreads.priceToEarnings.low),
      highPerShare: fromEarnings(spreads.priceToEarnings.high),
    },
  ];

  const usable = multiples.filter((m) => isNum(m.perShare));
  if (!usable.length) {
    return {
      ...empty,
      peerCount: peers.length,
      basis: comps.basis,
      multiples,
      candidates: pool,
      selected,
      edited,
      message:
        'Peers were found, but none of the three multiples could be applied to this company’s own reported figures.',
    };
  }

  // ---- THE RANGE IS A FLEX OF A STATED ASSUMPTION (job B2) --------------
  //
  // It was the spread of the three implied values — one per multiple, each
  // struck at the peers' median — so it said how far the three METHODS
  // disagreed and nothing about how far the peers do. A company whose three
  // methods happened to agree got a bar with almost no width, on a peer set
  // trading between 10x and 24x.
  //
  // VALUATION_SIDE_BY_SIDE rule 2 asks for a range from flexing a stated
  // assumption. The assumption is what the market pays, so each multiple is
  // applied at the peers' 25th and 75th percentile as well as at their median,
  // and the row's range is the UNION of those: the lowest low any usable
  // multiple gives and the highest high. A union rather than an average,
  // because each multiple is a different question and standing decision 4
  // forbids blending the answers.
  const values = usable.map((m) => m.perShare as number).sort((a, b) => a - b);
  const middle = Math.floor(values.length / 2);
  const mid =
    values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;

  const bounds = (pick: (m: MarketMultiple) => number | null) =>
    usable.map(pick).filter((v): v is number => isNum(v) && v > 0);
  // A multiple whose bound could not be struck falls back to its own point, so
  // the union can never be narrower than the points inside it.
  const lows = bounds((m) => m.lowPerShare ?? m.perShare);
  const highs = bounds((m) => m.highPerShare ?? m.perShare);
  const low = lows.length ? Math.min(...lows) : values[0];
  const high = highs.length ? Math.max(...highs) : values[values.length - 1];

  // WHICH MULTIPLES, AT WHAT, AND ON HOW MANY PEERS — the sentence under the
  // row, so the range can be read rather than taken on trust. A multiple on
  // fewer than four peers says that its spread is the peers' own min and max.
  const detail =
    usable
      .map((m) => {
        // The multiplication sign, U+00D7, not a lower-case x (G10).
        const span =
          isNum(m.spreadLow) && isNum(m.spreadHigh) && m.spreadLow !== m.spreadHigh
            ? `${m.spreadLow}\u2013${m.spreadHigh}\u00D7`
            : isNum(m.median)
              ? `${m.median}\u00D7`
              : 'no multiple';
        const how = m.spreadBasis === 'min-max' ? ' (min to max)' : '';
        return `${m.label} ${span}${how}`;
      })
      .join(', ') +
    (usable.length
      ? `, ${Math.max(...usable.map((m) => m.spreadPeers))} peer${
          Math.max(...usable.map((m) => m.spreadPeers)) === 1 ? '' : 's'
        }`
      : '');

  return {
    available: true,
    peerCount: peers.length,
    basis: comps.basis,
    candidates: pool,
    selected,
    edited,
    fiscalYear: subject.fiscalYear ?? null,
    multiples,
    usable,
    low,
    high,
    mid,
    detail,
  };
}

export default { buildMarketApproach, trailingFiguresFrom, mediansOf, medianOf, defaultSelection };
