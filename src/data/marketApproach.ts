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
  const shares = subject.dilutedShares;
  const netDebt = subject.netDebt;

  const fromEnterpriseValue = (median: number | null, metric: number | null) => {
    if (!isNum(median) || !isNum(metric) || metric <= 0) return null;
    if (!isNum(shares) || shares <= 0 || !isNum(netDebt)) return null;
    const value = (median * metric - netDebt) / shares;
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
        'peer median EV/EBITDA × this company’s reported EBITDA, less net debt, divided by diluted shares',
      absentBecause:
        !isNum(medians.evToEbitda)
          ? 'the peer set did not produce a median'
          : !isNum(subject.ebitda) || subject.ebitda <= 0
          ? 'EBITDA is not positive, so a multiple of it has no meaning'
          : undefined,
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
      perShare: (() => {
        if (!isNum(medians.priceToEarnings) || medians.priceToEarnings <= 0) return null;
        if (!isNum(subject.netIncome) || !isNum(shares) || shares <= 0) return null;
        if (subject.netIncome <= 0) return null;
        const value = medians.priceToEarnings * (subject.netIncome / shares);
        return isNum(value) && value > 0 ? value : null;
      })(),
      workings:
        'peer median P/E × this company’s reported earnings per share. No net debt step: a P/E is already an equity figure.',
      absentBecause:
        !isNum(medians.priceToEarnings)
          ? 'the peer set did not produce a median'
          : !isNum(subject.netIncome) || subject.netIncome <= 0
          ? 'the company did not report a profit, so a multiple of earnings has no meaning'
          : undefined,
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

  const values = usable.map((m) => m.perShare as number).sort((a, b) => a - b);
  const middle = Math.floor(values.length / 2);
  const mid =
    values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;

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
    low: values[0],
    high: values[values.length - 1],
    mid,
  };
}

export default { buildMarketApproach, trailingFiguresFrom, mediansOf, medianOf, defaultSelection };
