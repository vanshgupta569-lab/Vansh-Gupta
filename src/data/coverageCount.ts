// FILE: src/data/coverageCount.ts
//
// HOW MANY COMPANIES THIS SITE CAN ACTUALLY VALUE (Nihar, 16 November 2026).
//
// The landing page used to print the count of listings THIS BUILD SHIPS — 178
// — which is the size of the search index, not the size of the universe. A
// reader asking "is my company here?" was being answered with "here are the
// ones we pre-indexed for the search box".
//
// Every figure below is read from something already measured and committed.
// Nothing is estimated, and no number is written by hand.
//
//   1. SEC FILERS THE ENGINE CAN MODEL. `baseRates.json` was built by
//      streaming the SEC's bulk company-facts archive (`scripts/buildBaseRates.mts`):
//      20,571 filers read, of which **6,914** report annual revenue in USD on
//      a 10-K. That last figure is not "filers who exist" — it is filers whose
//      filings carry the line the engine needs, which is the same test as
//      "can we value it".
//
//   2. THE LISTINGS THAT THE SEC SET CANNOT CONTAIN. The search index also
//      carries companies filing outside the United States — Reliance, Toyota,
//      and the rest — which no SEC archive holds. Counting all 178 listings on
//      top would double-count every US name among them, so only the non-US
//      ones are added, decided by their exchange.
//
// THE US EXCHANGES ARE NAMED HERE rather than inferred, because "is this a US
// exchange" is a judgement and a judgement belongs somewhere a reader can
// check it. Getting one wrong moves the total by one company, and the total is
// printed rounded down to the hundred, so the published figure is unaffected
// by a single misclassification — but the list is still written out.
import BASE_RATES from './baseRates.json';
import INSTANT_LISTINGS from './instantListings';

/** The exchanges whose companies file with the SEC, so are already counted. */
export const US_EXCHANGES = ['NYSE', 'NasdaqGS', 'NasdaqGM', 'NasdaqCM', 'OTC Markets OTCPK', 'OTCPK', 'NYSEArca', 'NYSEAmerican'];

export interface CoverageCount {
  /** The whole number this site can value, before any rounding. */
  total: number;
  /** SEC filers whose filings carry the line the engine needs. */
  secFilers: number;
  /** Listings held here that no SEC archive contains. */
  nonUsListings: number;
  /** When the SEC archive behind `secFilers` was read. */
  builtAt: string | null;
}

export function coverageCount(): CoverageCount {
  const secFilers = Number((BASE_RATES as any)?.filersUsed) || 0;
  const us = new Set(US_EXCHANGES.map((e) => e.toLowerCase()));
  const nonUsListings = (INSTANT_LISTINGS as any[]).filter(
    (l) => l?.exchange && !us.has(String(l.exchange).toLowerCase())
  ).length;
  return {
    total: secFilers + nonUsListings,
    secFilers,
    nonUsListings,
    builtAt: (BASE_RATES as any)?.builtAt ?? null,
  };
}

/**
 * THE FIGURE AS THE PAGE PRINTS IT (Nihar, 16 November 2026).
 *
 * Rounded DOWN to the hundred, so the page never claims one company more than
 * it can show, and capped at "9,999+" — a five-figure count on a page nobody
 * can audit reads as a boast rather than a measurement.
 *
 * Returns null for a count of nothing, because "0+" is not a sentence and a
 * tile saying nought is a claim that this site covers nothing.
 */
export function coverageCountLabel(total: number): string | null {
  if (!isFinite(total) || total <= 0) return null;
  if (total >= 9999) return '9,999+';
  if (total < 100) return String(total);
  return `${(Math.floor(total / 100) * 100).toLocaleString('en-GB')}+`;
}

/**
 * THE SAME FIGURE, IN PARTS, so it can be counted up to.
 *
 * `coverageCountLabel` is the one place the rounding lives; this returns what
 * that label is MADE OF -- the number to count to and the mark after it -- so
 * the band can animate to the figure it prints without a second rounding rule
 * drifting away from the first.
 */
export function coverageCountParts(total: number): { value: number; suffix: string } | null {
  const label = coverageCountLabel(total);
  if (!label) return null;
  const plus = label.endsWith('+');
  const value = Number(label.replace(/[^0-9]/g, ''));
  return { value, suffix: plus ? '+' : '' };
}

export default { coverageCount, coverageCountLabel, coverageCountParts, US_EXCHANGES };
