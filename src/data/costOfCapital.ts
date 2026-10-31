// FILE: src/data/costOfCapital.ts
//
// THE RISK AND COST-OF-CAPITAL CARD (docs/COST_OF_CAPITAL_SPEC.md).
//
// The spec's principle is the whole design: **beta and WACC are estimates, not
// facts.** Every input shows its source, method, as-of date and currency, is
// editable, and has a reset — and the card shows the SAME NUMBERS THE ENGINE
// USES. It never shows one rate while the model discounts at another, which is
// the failure every "assumptions" panel on every other site invites: a panel
// that reads its own copy of a figure drifts away from the model behind it and
// nobody finds out until a number is defended in a meeting.
//
// So this file does not compute a cost of capital. It asks the engine for one —
// `computeWACC`, the same function the discounted cash flow calls — and puts
// what came back on the screen with its provenance attached. The only
// arithmetic of its own is the beta regression (rule 1: we calculate beta
// ourselves and never paste a vendor's) and the country risk premium, and both
// are set out below.
//
// THE FIVE THINGS THAT GO WRONG, and where each is stopped:
//
//   1. COUNTRY RISK ADDED TWICE (rule 13). The error is easy and invisible: a
//      reader sees "equity risk premium 4.23%" and "country risk premium
//      2.85%" and a cost of equity struck at a 7.08% premium, and cannot tell
//      whether the 7.08% is the two added or the total premium with the
//      country's added a second time. There is ONE expression for the premium
//      in use — `erpUsedPct` below — and the row that shows it says which of
//      the two it is. `npm run verify` adds the premium a second time on
//      purpose and watches the check report it.
//
//   2. A WACC FOR A BANK (rule 24). Deposits are not borrowings a bank chose
//      for cheapness, they are its raw material, so a weighted average of
//      "debt" and equity describes nothing. The engine already values banks by
//      residual income, which needs a cost of equity and no WACC at all, and
//      the card shows exactly that: a cost of equity, and "not applicable"
//      where the WACC would be.
//
//   3. A PRICE IN PENCE TREATED AS A PRICE IN POUNDS (rule 25). London quotes
//      pence, Johannesburg cents and Tel Aviv agorot. A market capitalisation
//      struck on the quoted figure is a hundred times too big, which makes the
//      equity weight 100% and the cost of capital the cost of equity. The card
//      shows the price the engine weights on, says what it was quoted in, and
//      the check asserts price x shares equals the market capitalisation the
//      weights were struck from.
//
//   4. AN INPUT WITH NO SOURCE. Every row carries a publisher and a date, or it
//      carries a reason there is no figure. A row with neither is a number the
//      reader is being asked to take on trust, which is the thing this site
//      exists not to do.
//
//   5. AN EDIT THAT CHANGES NOTHING. A panel of inputs that look editable and
//      do not reach the model is worse than no panel: it invites a reader to
//      test an assumption and lies to them about the answer. Every edit here
//      goes back through `deriveModel` -> `buildModel` -> `buildDCF`, so the
//      value per share beside it is the engine's answer under the reader's
//      inputs and not a scaled version of the old one.
//
// WHAT THE CARD DOES NOT DO, said plainly because the spec asks for it and it
// is not here:
//
//   RULE 9 IS A DECISION FOR NIHAR, NOT A CODE CHANGE. The model's beta today
//   is an ASSET beta of 1.0, relevered onto the company's own capital
//   structure. The regression below produces a measured beta for every listing
//   whose market index could be read, and the card shows both — but it does not
//   switch the model over to the measured one. Rule 9 says that choice is
//   presented rather than taken, and `CLAUDE.md` says a published default is
//   never changed as a side effect of another job.
//
//   THE COUNTRY RISK PREMIUM IS OFF BY DEFAULT, for the same reason. Rule 14
//   would default it to the country of incorporation; switching it on would
//   move the cost of equity of every non-US company on the site. It is shown,
//   it is one click away, and the default is Nihar's to change.
//
//   THE COST OF DEBT IS NOT RULE 17'S. Rule 17 wants a currency-matched
//   risk-free rate plus a default spread from a rating, synthetic from interest
//   coverage where there is no rating; the engine uses interest paid over
//   average borrowings, which rule 18 says may only ever be shown as a
//   cross-check. The card therefore LABELS it as the cross-check it is, shows
//   the interest coverage the synthetic rating would be read off, and says the
//   rating step is not built. Showing it under rule 17's name would be the
//   lie; quietly replacing the engine's rate would be changing a default.
//
//   THERE IS NO BOTTOM-UP BETA, because there is no comparable set: a derived
//   company carries `comparables: []`, and an average of nothing is not an
//   estimate. The row says so rather than being absent.

// @ts-ignore — plain JS modules, no type declarations
import { deriveModel } from './deriveModel.js';
// @ts-ignore
import { buildModel, buildDCF, computeWACC, listingRefusal } from '../engine/model.js';
// @ts-ignore
import { isFinancialCompany } from './residualIncome.js';
import {
  DEFAULT_SPREAD_PUBLISHER,
  DEFAULT_SPREAD_SOURCE,
  DEFAULT_SPREAD_VINTAGE,
} from './defaultSpread';
import {
  countryRiskFor,
  MATURE_ERP_PCT,
  COUNTRY_RISK_VINTAGE,
  COUNTRY_RISK_PUBLISHER,
  COUNTRY_RISK_SOURCE,
} from './countryRisk';
import {
  indexForListing,
  monthEnds,
  weekEnds,
  since,
  startOfWindow,
  type MarketIndex,
  type Series,
} from './marketIndex';

const isNum = (v: unknown): v is number => typeof v === 'number' && isFinite(v);

// ---------------------------------------------------------------------------
// THE REGRESSION (rules 1 to 4)
// ---------------------------------------------------------------------------

export interface Regression {
  /** The slope: beta. */
  slope: number;
  /** The intercept, per period, which is alpha and is reported but not used. */
  intercept: number;
  /** How much of the share's movement the index explains. */
  r2: number;
  /** The standard error of the slope: how precisely beta is known. */
  standardError: number;
  /** Pairs of returns the slope was struck from. */
  observations: number;
}

/**
 * Ordinary least squares of one return series on another.
 *
 * Returns null where there is nothing to regress — fewer than three pairs, or
 * an index that did not move — rather than a slope of nought over nought. An
 * index with no variance is not a market with a beta of zero; it is a series
 * that cannot answer the question.
 */
export function regress(y: number[], x: number[]): Regression | null {
  const n = Math.min(y.length, x.length);
  if (n < 3) return null;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i++) {
    sx += x[i];
    sy += y[i];
  }
  const mx = sx / n;
  const my = sy / n;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  // The residual sum of squares, from which both R squared and the standard
  // error of the slope follow.
  const rss = Math.max(0, syy - slope * sxy);
  const r2 = syy === 0 ? 0 : 1 - rss / syy;
  const standardError = n > 2 ? Math.sqrt(rss / (n - 2) / sxx) : NaN;
  return { slope, intercept, r2, standardError, observations: n };
}

/** Blume's adjustment, rule 3: two thirds of the measured beta and one third
 *  of the market's own beta of one. Bloomberg's default; shown beside the raw
 *  figure rather than instead of it, because research finds a flat 1.0
 *  sometimes predicts as well as either. */
export const blume = (raw: number): number => (2 / 3) * raw + (1 / 3) * 1;

/** Rule 5's thresholds, set here and documented in `METHODOLOGY.md`. */
export const BETA_MINIMUM = { monthly: 24, weekly: 52 };
export const BETA_COMFORTABLE = { monthly: 36, weekly: 78 };

// WHEN A MEASURED BETA IS A WARNING RATHER THAN A MEASUREMENT.
//
// A reader may put either measured figure into the model (Nihar, 2026-10-30),
// so the card has to say out loud when the figure it is offering is barely
// evidence. Two thresholds, both published:
//
//   R squared under a tenth — the index explains less than a tenth of this
//   share's movement, so the slope is a line through a cloud. Eleven of the 59
//   valued companies with a measured beta are under it, and they hold the
//   largest moves: Sony's slope of 0.31 on an R squared of 5% would raise its
//   value per share by 595%.
//
//   A standard error above a quarter — a 95% interval of roughly half a point
//   of beta either side, which on a premium of 4.23% is two points of cost of
//   equity either side. A number known that loosely cannot carry a valuation.
export const BETA_WEAK_R2 = 0.1;
export const BETA_WEAK_STANDARD_ERROR = 0.25;
/** True where either threshold is breached: the fit is too loose to lean on. */
export const betaIsWeak = (r2: number | null, standardError: number | null): boolean =>
  (isNum(r2) && r2 < BETA_WEAK_R2) || (isNum(standardError) && standardError > BETA_WEAK_STANDARD_ERROR);
/** Above this share of periods with no price change at all, the listing is
 *  treated as thinly traded and the estimate is flagged. */
export const THIN_TRADING_SHARE = 0.2;

export interface BetaEstimate {
  /** '5 years, monthly' — the recipe, which is the thing a vendor will not say. */
  label: string;
  years: number;
  frequency: 'monthly' | 'weekly';
  raw: number | null;
  adjusted: number | null;
  observations: number;
  r2: number | null;
  standardError: number | null;
  from: string | null;
  to: string | null;
  /** Periods dropped because the two series did not cover the same interval. */
  unpaired: number;
  /** Share of periods in which the share did not move at all. */
  flatShare: number | null;
  /** Why this estimate should not be leaned on, or null. */
  caution: string | null;
  /** True where the fit is too loose to carry a valuation: see
   *  `BETA_WEAK_R2` and `BETA_WEAK_STANDARD_ERROR`. The card prints a warning
   *  beside the button that would put this figure into the model. */
  weak: boolean;
  /** Why there is no estimate at all, or null. */
  missing: string | null;
}

/** The two series paired on the periods they share, as returns. */
function pairedReturns(
  stock: Series,
  index: Series,
  frequency: 'monthly' | 'weekly'
): { y: number[]; x: number[]; from: string | null; to: string | null; unpaired: number; flatShare: number | null } {
  const key = frequency === 'monthly' ? (d: string) => d.slice(0, 7) : isoWeekOf;
  const span = frequency === 'monthly' ? { min: 20, max: 45 } : { min: 4, max: 12 };

  const byKeyStock = new Map<string, { date: string; close: number }>();
  stock.dates.forEach((d, i) => byKeyStock.set(key(d), { date: d, close: stock.closes[i] }));
  const byKeyIndex = new Map<string, { date: string; close: number }>();
  index.dates.forEach((d, i) => byKeyIndex.set(key(d), { date: d, close: index.closes[i] }));

  const shared = [...byKeyStock.keys()].filter((k) => byKeyIndex.has(k)).sort();
  const y: number[] = [];
  const x: number[] = [];
  let unpaired = 0;
  let flat = 0;
  let from: string | null = null;
  let to: string | null = null;

  for (let i = 1; i < shared.length; i++) {
    const s0 = byKeyStock.get(shared[i - 1])!;
    const s1 = byKeyStock.get(shared[i])!;
    const i0 = byKeyIndex.get(shared[i - 1])!;
    const i1 = byKeyIndex.get(shared[i])!;
    // A RETURN IS ONE PERIOD LONG OR IT IS NOT A PERIOD'S RETURN. A month
    // missing on one side would otherwise produce a two-month return sitting
    // in a column of one-month ones, which is the same error the quarterly
    // work found in the filings: a cumulative figure wearing a period's label.
    const days = daysBetween(s0.date, s1.date);
    const indexDays = daysBetween(i0.date, i1.date);
    if (days < span.min || days > span.max || indexDays < span.min || indexDays > span.max) {
      unpaired++;
      continue;
    }
    // AND BOTH SIDES MUST COVER THE SAME INTERVAL, not merely intervals of the
    // same length. The share price series is as at the day the payload was
    // fetched and the index series as at the day it was; measured on BP's
    // London listing, that put a 26-day October against the index's 29-day
    // October, so three days of market movement sat on one side of the pair
    // and not the other. Five days is a public holiday either way; more than
    // that is two different months wearing one label.
    if (
      Math.abs(days - indexDays) > 5 ||
      Math.abs(daysBetween(s1.date, i1.date)) > 5 ||
      Math.abs(daysBetween(s0.date, i0.date)) > 5
    ) {
      unpaired++;
      continue;
    }
    if (!(s0.close > 0) || !(i0.close > 0)) {
      unpaired++;
      continue;
    }
    const rs = s1.close / s0.close - 1;
    const ri = i1.close / i0.close - 1;
    if (rs === 0) flat++;
    y.push(rs);
    x.push(ri);
    if (!from) from = s0.date;
    to = s1.date;
  }
  return { y, x, from, to, unpaired, flatShare: y.length ? flat / y.length : null };
}

const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

function isoWeekOf(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const year = d.getUTCFullYear();
  const week = Math.ceil(((d.getTime() - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/**
 * One beta estimate: a window, a frequency, and everything a reader needs to
 * decide whether to believe it (rule 4 — observations, R squared, standard
 * error, window, frequency and date on every regression).
 */
export function betaEstimate(
  stockDaily: Series | null,
  indexDaily: Series | null,
  years: number,
  frequency: 'monthly' | 'weekly'
): BetaEstimate {
  const label = `${years} year${years === 1 ? '' : 's'}, ${frequency}`;
  const empty: BetaEstimate = {
    label,
    years,
    frequency,
    raw: null,
    adjusted: null,
    observations: 0,
    r2: null,
    standardError: null,
    from: null,
    to: null,
    unpaired: 0,
    flatShare: null,
    caution: null,
    weak: false,
    missing: null,
  };
  if (!stockDaily?.dates?.length) {
    return { ...empty, missing: 'No price history is held for this listing.' };
  }
  if (!indexDaily?.dates?.length) {
    return { ...empty, missing: 'The index series has not been loaded.' };
  }

  const windowStart = startOfWindow(stockDaily, years);
  const sample = frequency === 'monthly' ? monthEnds : weekEnds;
  const stock = sample(since(stockDaily, windowStart));
  const index = sample(since(indexDaily, windowStart));
  const { y, x, from, to, unpaired, flatShare } = pairedReturns(stock, index, frequency);

  const minimum = BETA_MINIMUM[frequency];
  if (y.length < minimum) {
    return {
      ...empty,
      observations: y.length,
      from,
      to,
      unpaired,
      flatShare,
      missing:
        `Only ${y.length} ${frequency} return${y.length === 1 ? '' : 's'} could be paired with the index ` +
        `over ${years} years, and ${minimum} is the fewest this site will regress on.`,
    };
  }

  const fit = regress(y, x);
  if (!fit) {
    return {
      ...empty,
      observations: y.length,
      from,
      to,
      unpaired,
      flatShare,
      missing: 'The index did not move over this window, so there is no slope to measure.',
    };
  }

  const cautions: string[] = [];
  if (y.length < BETA_COMFORTABLE[frequency]) {
    cautions.push(
      `${y.length} ${frequency} returns, not the ${BETA_COMFORTABLE[frequency]} a full window would give`
    );
  }
  if (isNum(flatShare) && flatShare > THIN_TRADING_SHARE) {
    cautions.push(
      `the share did not move at all in ${Math.round(flatShare * 100)}% of those periods, which is thin trading`
    );
  }
  if (fit.r2 < BETA_WEAK_R2) {
    cautions.push(
      `the index explains ${(fit.r2 * 100).toFixed(1)}% of this share's movement, so the slope is barely a relationship`
    );
  }
  if (isNum(fit.standardError) && Math.abs(fit.standardError) > BETA_WEAK_STANDARD_ERROR) {
    cautions.push(`the standard error is ${fit.standardError.toFixed(2)}, which is wide`);
  }

  return {
    label,
    years,
    frequency,
    raw: fit.slope,
    adjusted: blume(fit.slope),
    observations: fit.observations,
    r2: fit.r2,
    standardError: isNum(fit.standardError) ? fit.standardError : null,
    from,
    to,
    unpaired,
    flatShare,
    caution: cautions.length ? cautions.join('; ') : null,
    weak: betaIsWeak(fit.r2, isNum(fit.standardError) ? fit.standardError : null),
    missing: null,
  };
}

// ---------------------------------------------------------------------------
// THE CARD
// ---------------------------------------------------------------------------

/** Where a figure came from, which every row must answer. */
export interface RowSource {
  publisher: string;
  /** The date the figure is as at. */
  asOf: string;
  /** How it was arrived at, in one clause. */
  method?: string;
  url?: string;
}

export type EditKey = 'riskFreePct' | 'beta' | 'maturePct' | 'crpPct' | 'countryRisk';

// COUNTRY RISK IS IN THE PREMIUM UNLESS THE READER TAKES IT OUT (spec rule 14,
// decided by Nihar on 2026-10-30). `deriveModel` adds it to the premium the
// engine carries, so a card that defaulted the other way would be showing one
// premium while the model discounted at another — the one thing this card is
// for. The switch is the reader's, and switching it off runs the engine again
// on the mature-market premium alone.
export const COUNTRY_RISK_ON_BY_DEFAULT = true;
/** Rule 14's label, in one place because three screens print it. */
export const COUNTRY_RISK_BASIS = 'by country of incorporation until revenue-by-country data exists';

export interface CardRow {
  key: string;
  label: string;
  /** The figure the engine uses, or null. */
  value: number | null;
  format: 'percent' | 'multiple' | 'money' | 'count';
  /** Why there is no figure. Required whenever `value` is null. */
  missing?: string;
  /** Publisher and date, or null only where `missing` says why. */
  source: RowSource | null;
  /** The ⓘ: what the figure is, how it was made, and what it is not. */
  about: string;
  /** The input this row edits, where it is editable. */
  edits?: EditKey;
  /** The figure before any edit, so a changed row can show what it was. */
  base?: number | null;
  /** Diagnostics and alternatives, shown under the row. */
  notes?: string[];
  /** True for the two headline rows. */
  headline?: boolean;
}

export interface Edits {
  riskFreePct?: number;
  beta?: number;
  maturePct?: number;
  crpPct?: number;
  /** Whether the country risk premium is added to the premium in use. */
  countryRisk?: boolean;
}

export interface CostOfCapitalCard {
  ticker: string;
  name: string;
  /** The currency the model is in, which is the currency of every rate here. */
  currency: string;
  currencySymbol: string;
  template: 'industrial' | 'bank';
  /** The engine's own refusal, where there is one, in the engine's words. */
  refusal: string | null;
  costOfEquity: number | null;
  wacc: number | null;
  /** Why there is no WACC, where there is none. */
  waccMissing: string | null;
  rows: CardRow[];
  /** The premium actually used, and how it was made up. Rule 13's answer. */
  premium: {
    maturePct: number;
    crpPct: number | null;
    countryRisk: boolean;
    usedPct: number;
    /** 'mature-market' or 'total country' — which of the two this is. */
    kind: 'mature-market' | 'total country';
    country: string | null;
    rating: string | null;
    vintage: string;
  };
  beta: {
    /** The beta the model uses, after relevering where it relevers. */
    used: number | null;
    /** The asset beta it was relevered from, where it was. */
    asset: number | null;
    relevered: boolean;
    /** Where the beta in use came from: the engine's default, one of the two
     *  measured figures chosen on this card, or a figure typed in. */
    choice: 'default' | 'measured-raw' | 'measured-adjusted' | 'typed';
    /** The warning for a chosen measured beta whose fit is too loose, or null. */
    warning: string | null;
    estimates: BetaEstimate[];
    index: MarketIndex | null;
    indexReason: string | null;
    indexAsOf: string | null;
    bottomUp: string;
  };
  price: {
    /** The price the weights are struck on, in the reporting currency. */
    value: number | null;
    currency: string;
    asOf: string | null;
    /** What the exchange quoted, where that is a minor unit. */
    quotedIn: string | null;
    minorUnitFactor: number | null;
    shares: number | null;
    marketCap: number | null;
  };
  /** Value per share under these inputs, so an edit can be seen to land. */
  valuePerShare: number | null;
  /** How that value was arrived at: the engine refuses most companies. */
  valueNote: string;
  edits: Edits;
}

const pct = (v: number) => `${(v * 100).toFixed(2)}%`;

/**
 * The card for one payload, under one set of edits.
 *
 * Everything numeric comes back from the engine. The edits are applied to the
 * engine's own inputs and the engine is run again, which is why an edit moves
 * the value per share rather than only the rate on the screen.
 */
export function costOfCapitalFor(
  payload: any,
  opts?: { index?: { series: Series; asOf?: string; name?: string } | null; edits?: Edits }
): CostOfCapitalCard | null {
  const edits = opts?.edits ?? {};
  const country = payload?.profile?.country ?? payload?.listing?.country ?? null;
  const risk = countryRiskFor(country);

  // THE PREMIUM IN USE, IN ONE EXPRESSION AND ONE PLACE (rule 13). Everything
  // downstream reads `usedPct`; nothing adds a premium to it again.
  const maturePct = isNum(edits.maturePct) ? edits.maturePct : MATURE_ERP_PCT;
  const crpPct = isNum(edits.crpPct) ? edits.crpPct : risk ? risk.crpPct : null;
  const countryRisk = (edits.countryRisk ?? COUNTRY_RISK_ON_BY_DEFAULT) && isNum(crpPct);
  const usedPct = maturePct + (countryRisk ? (crpPct as number) : 0);

  // A COMPANY THE ENGINE REFUSES STILL HAS A CARD. Four of the 177 payloads on
  // disk cannot be derived at all — Berkshire, HDFC Bank's receipt, Visa and
  // Tata Motors, which report no diluted share count or no two comparable
  // years — and returning nothing for them would leave a blank where the card
  // goes. The risk-free rate, the premium and the country's premium are facts
  // about a currency and a country rather than about the model, so they are
  // shown, and the refusal is shown with them in the engine's own words.
  let source: any = null;
  let deriveRefusal: string | null = null;
  try {
    source = deriveModel(payload);
  } catch (e: any) {
    deriveRefusal = String(e?.message || e);
  }

  // THE INPUTS, EDITS APPLIED, IN ONE PLACE. Read from here and nowhere else:
  // the engine's own copy is written through so the engine runs on exactly
  // these three, and the screen reads the same three, so the card cannot show
  // one rate while the model discounts at another.
  const cc = source?.dcf?.costOfCapital ?? null;
  const baseRiskFree = cc
    ? cc.riskFreeRate
    : isNum(payload?.riskFree?.rate)
      ? payload.riskFree.rate
      : null;
  const baseBeta = cc ? cc.equityBeta : 1.0;
  const riskFreeUsed = isNum(edits.riskFreePct) ? edits.riskFreePct / 100 : baseRiskFree;
  const betaInput = isNum(edits.beta) ? edits.beta : baseBeta;
  if (cc) {
    cc.riskFreeRate = riskFreeUsed;
    cc.equityBeta = betaInput;
    cc.marketRiskPremium = usedPct / 100;
    // A BETA GIVEN ON THIS CARD IS THE BETA THE MODEL USES, NOT ONE TO BE
    // LEVERED AGAIN.
    //
    // The engine's own default is an ASSET beta of 1.0 and it relevers it onto
    // this company's borrowings, which is right for a figure that describes the
    // business rather than the share. A figure from this card is the other kind:
    // a regression on the share price is already levered — the borrowings are in
    // the price history — and relevering it would count this company's gearing
    // twice. On BP that turned a measured 0.598 into 0.635 in the model while
    // the button offering it said 0.598, so the row showed one number and the
    // valuation used another, which is the single thing this card exists to
    // prevent. A typed figure is treated the same way, because the reader types
    // it into a row that shows the beta in use.
    if (isNum(edits.beta)) cc.betaIsUnlevered = false;
  }

  let M: any = null;
  let W: any = null;
  let D: any = null;
  let modelRefusal: string | null = null;
  try {
    M = buildModel(source);
  } catch (e: any) {
    modelRefusal = String(e?.message || e);
  }
  if (M) {
    try {
      W = computeWACC(M, source);
    } catch (e: any) {
      modelRefusal = modelRefusal ?? String(e?.message || e);
    }
    try {
      D = buildDCF(M, source);
    } catch {
      D = null;
    }
  }

  const bank = isFinancialCompany(payload);
  const rfRefusal: string | null = source?.meta?.riskFreeRefusal?.message ?? null;
  const listing = M ? listingRefusal(source) : null;
  const basis = source?.meta?.currencyBasis ?? {};
  const currency = payload?.currency || basis.reportingCurrency || 'USD';
  const rf = payload?.riskFree ?? null;

  // THE BETA THE MODEL USES. For an operating company the engine carries an
  // asset beta and relevers it onto this company's own capital structure; for
  // a bank the residual income model uses the beta as it stands, because rule 8
  // says deposits are operating liabilities and a bank is not unlevered and
  // relevered at all.
  const betaUsed = bank ? (isNum(betaInput) ? betaInput : null) : isNum(W?.beta) ? W.beta : null;

  // THE COST OF EQUITY, AND IT IS THE ENGINE'S. For a bank that is the rate
  // `buildResidualIncome` discounts at — the risk-free rate plus the beta times
  // the premium, with no relevering — and for everybody else it is
  // `computeWACC`'s own line. A missing risk-free rate gives no cost of equity
  // at all: see the guard in `computeWACC`, which is what stops `null` being
  // read as a rate of nought.
  const costOfEquity = !isNum(riskFreeUsed)
    ? null
    : bank
      ? isNum(betaUsed)
        ? riskFreeUsed + betaUsed * (usedPct / 100)
        : null
      : isNum(W?.costOfEquity)
        ? W.costOfEquity
        : null;

  const wacc = bank ? null : isNum(W?.wacc) ? W.wacc : null;
  const waccMissing = bank
    ? 'Not applicable to a bank or insurer. Deposits and policy liabilities are what the business runs ' +
      'on, not borrowings chosen for being cheaper than equity, so a weighted average of the two ' +
      'describes nothing. The engine values this company by residual income, which discounts at the cost ' +
      'of equity above.'
    : wacc === null
      ? deriveRefusal ??
        rfRefusal ??
        modelRefusal ??
        'The engine could not strike a cost of capital for this company from the figures available.'
      : null;

  // ---- the index and the regression --------------------------------------
  const choice = indexForListing(payload);
  const stockDaily: Series | null = payload?.quote?.history?.daily
    ? { dates: payload.quote.history.daily.dates, closes: payload.quote.history.daily.closes }
    : null;
  const indexSeries = opts?.index?.series ?? null;
  const estimates = choice.index
    ? [
        betaEstimate(stockDaily, indexSeries, 5, 'monthly'),
        betaEstimate(stockDaily, indexSeries, 2, 'weekly'),
      ]
    : [];

  // ---- the rows ----------------------------------------------------------
  const rows: CardRow[] = [];
  const quoteAsOf = (payload?.quote?.asOf || payload?.fetchedAt || '').slice(0, 10) || null;

  rows.push({
    key: 'costOfEquity',
    label: 'Cost of equity',
    value: costOfEquity,
    format: 'percent',
    missing: costOfEquity === null ? rfRefusal ?? 'No risk-free rate for this currency.' : undefined,
    source: costOfEquity === null ? null : { publisher: 'Marginalia', asOf: quoteAsOf ?? '', method: 'CAPM' },
    headline: true,
    about:
      'The return a shareholder is taken to require: the risk-free rate plus beta times the equity risk ' +
      'premium. It is the rate the engine discounts a bank at, and one half of the cost of capital for ' +
      'everybody else. An estimate of a required return, not a forecast of what the share will do.',
    notes: isNum(costOfEquity)
      ? [
          `${pct(riskFreeUsed as number)} risk-free + ${isNum(betaUsed) ? betaUsed.toFixed(3) : '—'} x ` +
            `${usedPct.toFixed(2)}% premium`,
        ]
      : undefined,
  });

  rows.push({
    key: 'wacc',
    label: 'Weighted average cost of capital',
    value: wacc,
    format: 'percent',
    missing: waccMissing ?? undefined,
    source: wacc === null ? null : { publisher: 'Marginalia', asOf: quoteAsOf ?? '', method: 'ke x E/V + kd x (1 - t) x D/V' },
    headline: true,
    about:
      'The rate the discounted cash flow discounts at: the cost of equity and the after-tax cost of debt, ' +
      'each weighted by what share of the money in the business it funds. Equity at market value, debt at ' +
      'book, both at one date and in one currency.',
    notes:
      isNum(wacc) && isNum(W?.weightEquity)
        ? [
            `${(W.weightEquity * 100).toFixed(1)}% equity at ${pct(costOfEquity ?? 0)}` +
              (isNum(W?.afterTaxCostOfDebt) && W.weightDebt > 0
                ? `, ${(W.weightDebt * 100).toFixed(1)}% debt at ${pct(W.afterTaxCostOfDebt)} after tax`
                : ', and no borrowings to weight'),
          ]
        : undefined,
  });

  rows.push({
    key: 'riskFree',
    label: 'Risk-free rate',
    value: isNum(riskFreeUsed) ? riskFreeUsed : null,
    format: 'percent',
    missing: isNum(riskFreeUsed) ? undefined : rfRefusal ?? 'No publisher of a government bond yield for this currency could be read.',
    source:
      isNum(riskFreeUsed) && rf
        ? {
            publisher: String(rf.publisher || 'not recorded'),
            asOf: String(rf.windowTo || '').slice(0, 10),
            method:
              `${rf.name}, the mean of ${rf.observations} ${rf.frequency} readings from ` +
              `${rf.windowFrom} to ${rf.windowTo}`,
            url: rf.sourceUrl || undefined,
          }
        : null,
    edits: 'riskFreePct',
    base: isNum(baseRiskFree) ? baseRiskFree : null,
    about:
      'A government bond yield in the currency the accounts are in, because a cash flow and the rate it ' +
      'is discounted at have to describe one economy. Ten years, to match the forecast, and averaged over ' +
      'the year ending at the company’s own balance sheet date rather than taken on one day, so a single ' +
      'day’s market does not set the whole valuation. Where no publisher for the currency can be read the ' +
      'valuation is refused rather than discounted at somebody else’s risk-free rate.',
    notes: rf?.terms ? [`Terms: ${rf.terms}`] : undefined,
  });

  // WHICH BETA THE MODEL IS USING, AND WHERE IT CAME FROM. The default is the
  // engine's asset beta of 1.0 (rule 9: that default was not changed, and the
  // measurements behind the decision are in METHODOLOGY.md section 3). A reader
  // may put either measured figure in instead, and then the row has to say so
  // rather than going on calling it the default.
  const sameFigure = (a: number | null | undefined, b: number) => isNum(a) && Math.abs(a - b) < 5e-7;
  const chosenFrom = isNum(edits.beta)
    ? estimates.find((e) => sameFigure(edits.beta, e.raw ?? NaN) || sameFigure(edits.beta, e.adjusted ?? NaN)) ?? null
    : null;
  const betaChoice: 'default' | 'measured-raw' | 'measured-adjusted' | 'typed' = !isNum(edits.beta)
    ? 'default'
    : chosenFrom && sameFigure(edits.beta, chosenFrom.raw ?? NaN)
      ? 'measured-raw'
      : chosenFrom
        ? 'measured-adjusted'
        : 'typed';
  const betaMethod =
    betaChoice === 'default'
      ? bank
        ? 'the engine’s default beta of 1.0, neither unlevered nor relevered (rule 8)'
        : 'the engine’s default asset beta of 1.0, relevered onto this company’s own borrowings'
      : betaChoice === 'typed'
        ? 'a figure typed in on this card'
        : `the ${chosenFrom!.label} regression measured here, ` +
          `${betaChoice === 'measured-raw' ? 'raw' : 'Blume-adjusted'}, chosen on this card`;
  // The warning the card prints beside a chosen measured beta, in one place so
  // the screen and the checks say the same thing.
  const betaWarning =
    chosenFrom && chosenFrom.weak
      ? `This beta is measured to ${
          isNum(chosenFrom.r2) ? `an R² of ${(chosenFrom.r2 * 100).toFixed(1)}%` : 'no fit at all'
        } and a standard error of ${
          isNum(chosenFrom.standardError) ? chosenFrom.standardError.toFixed(2) : '—'
        }. A fit that loose will move the value a long way on very little evidence.`
      : null;

  const betaNotes: string[] = [];
  if (!bank && isNum(W?.assetBeta) && isNum(W?.debtToEquity)) {
    betaNotes.push(
      `asset beta ${W.assetBeta.toFixed(2)}, relevered on debt/equity of ${(W.debtToEquity * 100).toFixed(1)}%`
    );
  }
  if (bank) betaNotes.push('not unlevered or relevered: a bank’s deposits are operating liabilities (rule 8)');
  // THE MEASURED ESTIMATES ARE NOT REPEATED HERE. They have a block of their own
  // under the inputs, with their diagnostics; printing them twice is the clutter
  // the first design principle forbids, and the reader would have to compare two
  // copies of the same numbers to be sure they were the same numbers.
  const measured = estimates.find((e) => e.frequency === 'monthly');
  if (measured && measured.raw !== null) {
    betaNotes.push(
      `we measure ${measured.raw.toFixed(3)} over five years of monthly returns, which the model is not ` +
        'using — see below'
    );
  }
  if (choice.reason) betaNotes.push(choice.reason);
  if (listing?.message) betaNotes.push(`This listing: ${listing.message}`);

  rows.push({
    key: 'beta',
    label: 'Beta',
    value: betaUsed,
    format: 'multiple',
    missing: betaUsed === null ? (deriveRefusal ?? 'The engine carries no beta for this company.') : undefined,
    source: betaUsed === null ? null : { publisher: 'Marginalia', asOf: quoteAsOf ?? '', method: betaMethod },
    edits: 'beta',
    base: isNum(baseBeta) ? baseBeta : null,
    about:
      'How much this share has moved with its market. **The model starts from the engine’s default — an ' +
      'asset beta of 1.0, relevered onto this company’s own borrowings — and not from the measured ' +
      'figure below**, because across the companies that have one, switching to the measured slope moves ' +
      'the value per share by a median 2% and by as much as 515% on a fit that explains 5% of the share’s ' +
      'movement. The measured figures are offered under the estimates below and can be put into the model ' +
      'one company at a time, with a warning where the fit is too loose to carry it (rule 9, and ' +
      'METHODOLOGY.md section 3). The measured estimates are ours, regressed here from one stated recipe: five years ' +
      'of monthly price returns against a broad local index, with two years weekly beside it. Price ' +
      'returns, not total returns — dividends are not in the series this site holds — and split-adjusted. ' +
      'Raw and Blume-adjusted are shown together because research finds a flat 1.0 sometimes predicts as ' +
      'well as either, so none of them deserves a decimal place of confidence.',
    notes: betaNotes.length ? betaNotes : undefined,
  });

  rows.push({
    key: 'erp',
    label: countryRisk ? 'Equity risk premium (total, country included)' : 'Equity risk premium (mature market)',
    value: usedPct / 100,
    format: 'percent',
    source: {
      publisher: COUNTRY_RISK_PUBLISHER,
      asOf: COUNTRY_RISK_VINTAGE,
      method: countryRisk
        ? `the mature-market premium of ${maturePct.toFixed(2)}% plus ${country}’s country risk premium of ` +
          `${(crpPct as number).toFixed(2)}%, ${COUNTRY_RISK_BASIS}`
        : `the mature-market premium, with this country’s own risk premium switched off on this card`,
      url: COUNTRY_RISK_SOURCE,
    },
    edits: 'maturePct',
    base: MATURE_ERP_PCT / 100,
    about:
      'What equities are taken to return above a government bond. There is no official figure and ' +
      'reputable people differ by two points, so this is an assumption with a published source and a ' +
      'date rather than a fact. The label says which of the two premiums it is: the mature-market premium, ' +
      'or that plus this country’s own risk premium. It is never both.',
    notes: [
      countryRisk
        ? `${maturePct.toFixed(2)}% mature + ${(crpPct as number).toFixed(2)}% country = ${usedPct.toFixed(2)}%`
        : `${maturePct.toFixed(2)}% mature market, as at ${COUNTRY_RISK_VINTAGE}`,
    ],
  });

  rows.push({
    key: 'crp',
    label: 'Country risk premium',
    value: isNum(crpPct) ? (crpPct as number) / 100 : null,
    format: 'percent',
    missing: isNum(crpPct)
      ? undefined
      : country
        ? `The country table does not carry ${country}.`
        : 'The data does not say which country this company is based in.',
    source: isNum(crpPct)
      ? {
          publisher: COUNTRY_RISK_PUBLISHER,
          asOf: COUNTRY_RISK_VINTAGE,
          method: `${risk?.country} rated ${risk?.rating}, scaled from its sovereign default spread`,
          url: COUNTRY_RISK_SOURCE,
        }
      : null,
    edits: 'crpPct',
    base: risk ? risk.crpPct / 100 : null,
    about:
      'The extra return asked for holding equity in one country rather than a mature market, read from a ' +
      'sovereign rating and scaled to equities. **It is in the premium above, and in the premium the engine ' +
      'itself discounts at, unless this row says it has been switched off.** It is added once: the premium ' +
      'row renames itself to say which of the two premiums it is, which is the only way a reader can tell ' +
      'them apart. It follows the country the company is incorporated in — Damodaran’s own rule is that it ' +
      'should follow where the revenue and the operations are, and no free source publishes revenue by ' +
      'country for these companies, so it is the register’s country until one does.',
    notes: [
      countryRisk
        ? `Included in the premium above, ${COUNTRY_RISK_BASIS}.`
        : 'Switched off on this card: the cost of equity above is struck on the mature-market premium alone, ' +
          'which is not the premium the engine carries by default.',
      ...(risk ? [`${risk.country}, Moody’s ${risk.rating}, as at ${COUNTRY_RISK_VINTAGE}`] : []),
    ],
  } as CardRow);

  // ---- cost of debt, tax and the weights ---------------------------------
  //
  // THE RATE A VALUATION NEEDS, NOT THE RATE THE COMPANY HAS BEEN PAYING
  // (rule 17, and `KI-29`, which this closed on 2026-10-31). Read off the
  // engine, which adds the spread `deriveModel` looked up to the risk-free rate
  // above — so editing that rate moves this one by the same point.
  const coverage = isNum(W?.interestCoverage) ? W.interestCoverage : null;
  const spreadPct = isNum(W?.defaultSpreadPct) ? W.defaultSpreadPct : null;
  const effective = isNum(W?.effectiveCostOfDebt) ? W.effectiveCostOfDebt : null;
  rows.push({
    key: 'costOfDebt',
    label: 'Cost of debt',
    value: isNum(W?.costOfDebt) ? W.costOfDebt : null,
    format: 'percent',
    missing: isNum(W?.costOfDebt)
      ? undefined
      : !M
        ? (deriveRefusal ?? 'No model could be built for this company.')
        : !isNum(riskFreeUsed)
          ? (rfRefusal ?? 'No risk-free rate for this currency, so there is no rate to add a spread to.')
          : 'No interest-coverage ratio can be read from this filing, so no rating and no spread — which ' +
            'is not a cost of nought.',
    source: isNum(W?.costOfDebt)
      ? {
          publisher: DEFAULT_SPREAD_PUBLISHER,
          asOf: W.defaultSpreadVintage ?? DEFAULT_SPREAD_VINTAGE,
          method:
            `the risk-free rate above plus a default spread of ${(spreadPct as number).toFixed(2)}% for a ` +
            `synthetic ${W.rating} rating, read off interest coverage of ${(coverage as number).toFixed(1)}x` +
            (W.financialTemplate ? ', on his table for financial service firms' : ''),
          url: DEFAULT_SPREAD_SOURCE,
        }
      : null,
    about:
      'What this company would pay to borrow now: the risk-free rate in the currency of the accounts plus ' +
      'a **default spread** for its credit. It has no published rating this site can read, so the rating ' +
      'is **synthetic** — read off its interest coverage, EBIT over interest expense, against Damodaran’s ' +
      'table of coverage ratios, ratings and traded-bond spreads. **What it has been paying is a ' +
      'different question**: interest over average borrowings looks backwards, divides interest ' +
      'contracted years ago by a balance that moved, and had 59 of 137 companies borrowing below their ' +
      'own government’s ten-year yield. That figure is shown under this row as a cross-check, which is ' +
      'all rule 18 allows it to be. The forecast interest charge still uses it, because borrowings ' +
      'already taken out really do cost what they were contracted at; a discount rate asks what the ' +
      'next pound of debt costs, and that is this.',
    notes: [
      ...(isNum(coverage) && isNum(spreadPct)
        ? [
            `interest coverage ${coverage.toFixed(1)}x in FY${W.interestCoverageYear} → ${W.rating} → a ` +
              `${spreadPct.toFixed(2)}% spread (${DEFAULT_SPREAD_PUBLISHER}, ${W.defaultSpreadVintage})` +
              // REPORTED OR MODELLED, SAID OUT LOUD (standing decision 5). Six
              // companies on disk file no interest expense in any year, so the
              // ratio is struck on the charge this model works out instead.
              (W.interestCoverageFiled === false
                ? ', on the interest this model charges, because the filing reports none in any year'
                : ''),
          ]
        : []),
      ...(isNum(effective)
        ? [
            `cross-check — the historical effective rate, interest over average borrowings, is ` +
              `${pct(effective)}: what it has been paying, not what it would pay (rule 18)`,
          ]
        : []),
    ],
  });

  rows.push({
    key: 'tax',
    label: 'Tax rate',
    value: isNum(W?.taxRate) ? W.taxRate : null,
    format: 'percent',
    missing: isNum(W?.taxRate) ? undefined : (deriveRefusal ?? 'No model could be built for this company.'),
    source: isNum(W?.taxRate)
      ? { publisher: 'the filings', asOf: lastYear(payload), method: 'the rate the forecast carries, from reported tax over reported pre-tax profit' }
      : null,
    about:
      'The rate the tax shield on debt is worth. The engine uses the effective rate the forecast carries, ' +
      'which comes from what the company actually paid. A statutory rate is shown beside it: where the two ' +
      'are far apart the difference is usually a one-off, and a one-off low rate is not a reason to value ' +
      'the shield higher for ever.',
    notes: risk?.statutoryTaxPct != null
      ? [
          `statutory rate in ${risk.country}: ${risk.statutoryTaxPct.toFixed(2)}% ` +
            `(${COUNTRY_RISK_PUBLISHER}, ${COUNTRY_RISK_VINTAGE})`,
        ]
      : undefined,
  });

  const marketCap = isNum(W?.marketCap) ? W.marketCap : null;
  const shares = isNum(source?.dcf?.dilutedSharesCount) ? source.dcf.dilutedSharesCount : null;
  rows.push({
    key: 'weights',
    label: 'Weights',
    value: isNum(W?.weightEquity) ? W.weightEquity : null,
    format: 'percent',
    missing: isNum(W?.weightEquity) ? undefined : (deriveRefusal ?? 'No model could be built for this company.'),
    source: isNum(W?.weightEquity)
      ? {
          publisher: 'the filings and the quoted price',
          asOf: quoteAsOf ?? '',
          method: 'equity at market capitalisation, debt at book value, both at one date',
        }
      : null,
    about:
      'What share of the money in this business was put in by shareholders and what share was borrowed. ' +
      'Equity at market capitalisation — price times diluted shares, both dated — and debt at book, ' +
      'because no free source publishes what a company’s own bonds trade at. **Gross debt, not net**: a ' +
      'company that borrows 100 and holds 150 in the bank still has 100 of borrowed money in it, and the ' +
      'cash is already in the equity bridge. Target capital structure is not used.',
    notes:
      isNum(W?.weightEquity) && isNum(W?.grossDebt)
        ? [
            `equity ${(W.weightEquity * 100).toFixed(1)}%, debt ${(W.weightDebt * 100).toFixed(1)}%`,
            `market capitalisation ${fmtMoney(marketCap)} against borrowings of ${fmtMoney(W.grossDebt)}, in ${currency} millions`,
          ]
        : undefined,
  });

  // ---- what the price was, and what it was quoted in (rule 25) ------------
  const conversion = payload?.priceConversion ?? null;
  const minorUnitFactor = isNum(conversion?.minorUnitFactor) ? conversion.minorUnitFactor : null;
  rows.push({
    key: 'price',
    label: 'Share price',
    value: isNum(payload?.quote?.price) ? payload.quote.price : null,
    format: 'money',
    missing: isNum(payload?.quote?.price) ? undefined : 'No price is held for this listing.',
    source: isNum(payload?.quote?.price)
      ? {
          publisher: payload?.quote?.exchange ? `quoted on ${payload.quote.exchange}` : 'the vendor feed',
          asOf: quoteAsOf ?? '',
          method:
            conversion?.converted && minorUnitFactor !== null && minorUnitFactor !== 1
              ? `quoted in ${conversion.quotedCurrency} and converted to ${currency}: ` +
                `${conversion.quotedCurrency} are ${Math.round(1 / minorUnitFactor)} to the ` +
                `${conversion.tradingCurrency}, then ${conversion.pair} at ${conversion.rate}`
              : conversion?.converted
                ? `quoted in ${conversion.quotedCurrency} and converted at ${conversion.pair} ${conversion.rate}`
                : `as quoted, in ${currency}`,
        }
      : null,
    about:
      'The price the weights are struck on, in the currency of the accounts. **The share price is a ' +
      'valuation input**: the cost of capital weights equity at market capitalisation, so where the WACC ' +
      'is left at its default the price moves the value. Where a market quotes a minor unit — pence in ' +
      'London, cents in Johannesburg, agorot in Tel Aviv — it is brought to the main unit before anything ' +
      'is multiplied by it, because a market capitalisation a hundred times too big makes the equity ' +
      'weight 100% and the cost of capital the cost of equity.',
    notes:
      minorUnitFactor !== null && minorUnitFactor !== 1
        ? [
            `quoted in ${conversion.quotedCurrency}, ${Math.round(1 / minorUnitFactor)} to the ` +
              `${conversion.tradingCurrency}: brought to the main unit before use`,
          ]
        : undefined,
  });

  // ---- the value the inputs produce --------------------------------------
  const valuePerShare = isNum(D?.perpetuity?.valuePerShare) ? D.perpetuity.valuePerShare : null;
  const valueNote = valuePerShare
    ? 'Value per share on the perpetuity method, recomputed from these inputs by the engine.'
    : deriveRefusal
      ? deriveRefusal
      : D && !D.applicable && D.message
      ? String(D.message)
      : bank
        ? 'The engine values this company by residual income rather than a discounted cash flow, so there ' +
          'is no value per share on this card; the cost of equity above is the rate it discounts at.'
        : (deriveRefusal ?? modelRefusal ?? 'The engine does not produce a value per share for this company.');

  return {
    ticker: String(payload?.ticker || ''),
    name: String(payload?.name || payload?.ticker || ''),
    currency,
    currencySymbol: payload?.currencySymbol || '',
    template: bank ? 'bank' : 'industrial',
    refusal: deriveRefusal ?? rfRefusal ?? listing?.message ?? modelRefusal ?? null,
    costOfEquity,
    wacc,
    waccMissing,
    rows,
    premium: {
      maturePct,
      crpPct: isNum(crpPct) ? (crpPct as number) : null,
      countryRisk,
      usedPct,
      kind: countryRisk ? 'total country' : 'mature-market',
      country: risk?.country ?? country ?? null,
      rating: risk?.rating ?? null,
      vintage: COUNTRY_RISK_VINTAGE,
    },
    beta: {
      used: betaUsed,
      asset: isNum(W?.assetBeta) ? W.assetBeta : null,
      relevered: !bank && isNum(W?.assetBeta),
      choice: betaChoice,
      warning: betaWarning,
      estimates,
      index: choice.index,
      indexReason: choice.reason,
      indexAsOf: opts?.index?.asOf ?? null,
      bottomUp:
        'No bottom-up beta: a derived company carries no comparable set, and an average of no companies ' +
        'is not an estimate. Where a peer set exists it would be the average unlevered beta of the peers, ' +
        'relevered on this company’s own debt and equity.',
    },
    price: {
      value: isNum(payload?.quote?.price) ? payload.quote.price : null,
      currency,
      asOf: quoteAsOf,
      quotedIn: conversion?.quotedCurrency ?? null,
      minorUnitFactor,
      shares,
      marketCap,
    },
    valuePerShare,
    valueNote,
    edits,
  };
}


const lastYear = (payload: any): string => {
  const rows = Array.isArray(payload?.statements) ? payload.statements : [];
  const last = rows[rows.length - 1];
  return last?.periodEnd ? String(last.periodEnd).slice(0, 10) : last?.fiscalYear ? `FY${last.fiscalYear}` : '';
};

const fmtMoney = (v: number | null): string =>
  isNum(v) ? v.toLocaleString('en-US', { maximumFractionDigits: 0 }) : 'not reported';

/** How a row's figure is printed, so the card and the checks agree. */
export function formatRow(row: CardRow, currencySymbol = ''): string {
  if (row.value === null) return '—';
  if (row.format === 'percent') return `${(row.value * 100).toFixed(2)}%`;
  if (row.format === 'multiple') return row.value.toFixed(3);
  if (row.format === 'money') return `${currencySymbol}${row.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return row.value.toLocaleString('en-US');
}

export default { costOfCapitalFor, betaEstimate, regress, blume, formatRow };
