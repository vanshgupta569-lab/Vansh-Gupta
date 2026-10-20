// FILE: src/data/tradingCurrency.ts
//
// SHOWING A VALUE IN THE CURRENCY THE SHARE ACTUALLY TRADES IN.
//
// The engine models a company in the currency its statements are in, and
// discounts at that currency's own government bond yield (`METHODOLOGY.md` §3
// and §14). That is the only way a cash flow and the rate it is discounted at
// describe the same economy — but it means Infosys, whose statements are in US
// dollars and whose shares trade in Bombay, gets a value per share in dollars
// beside a price in dollars, while the reader's broker shows rupees.
//
// So the value is ALSO shown in the trading currency, converted at the one rate
// the price was converted at and disclosed with. Nothing in the model moves:
// this is the last step, applied to an answer, exactly as `METHODOLOGY.md` §3
// describes. A premium or discount is unchanged by it, because both sides of
// that comparison are divided by the same number.
//
// THE RATE TO USE IS `tradingCurrencyRate`, NEVER `rate`. `rate` is the
// composite the quote was multiplied by — reporting currency per QUOTED unit —
// and London quotes pence, Johannesburg cents and Tel Aviv agorot, so on ten of
// the forty-nine converted companies `rate` is a hundredth of the pair it is
// named with. `tradingCurrencyRate` is the pair's own rate, per major unit, and
// is defined once in `listingComparability`.

/** The part of `meta.currencyBasis` this needs. Kept loose so a payload from an
 *  older fetcher, which carries no `tradingCurrencyRate`, simply shows nothing
 *  rather than showing a figure converted at a rate that is not there. */
export interface TradingCurrencyBasis {
  reportingCurrency?: string | null;
  quotedCurrency?: string | null;
  tradingCurrency?: string | null;
  minorUnitFactor?: number | null;
  priceConverted?: boolean;
  tradingCurrencyRate?: number | null;
  rate?: number | null;
  pair?: string | null;
  rateAsOf?: string | null;
}

export interface InTradingCurrency {
  /** The figure, in the major unit of the trading currency. */
  amount: number;
  /** The trading currency's ISO code, e.g. 'INR'. */
  currency: string;
  /** The figure formatted with that currency's symbol and grouping. */
  text: string;
  /** The rate it was converted at: reporting currency per unit of `currency`. */
  rate: number;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && isFinite(v);

/**
 * A figure in the reporting currency, expressed in the trading currency.
 *
 * Returns null — and the screen then shows nothing — whenever the two
 * currencies are the same, the rate is absent, or the figure is not a number.
 * Showing nothing is correct for the great majority of companies: their
 * statements and their price are already in one currency.
 */
export function inTradingCurrency(
  value: number | null | undefined,
  basis: TradingCurrencyBasis | null | undefined
): InTradingCurrency | null {
  if (!basis || !isNum(value)) return null;
  const { reportingCurrency, tradingCurrency, tradingCurrencyRate } = basis;
  if (!reportingCurrency || !tradingCurrency) return null;
  if (tradingCurrency === reportingCurrency) return null;
  if (!isNum(tradingCurrencyRate) || tradingCurrencyRate <= 0) return null;

  const amount = value / tradingCurrencyRate;
  return {
    amount,
    currency: tradingCurrency,
    text: formatIn(amount, tradingCurrency),
    rate: tradingCurrencyRate,
  };
}

/**
 * The amount with its own currency's symbol and grouping.
 *
 * `en-IN` for the rupee, so a lakh groups as a reader in Bombay writes it; the
 * same rule the figures editor follows. `Intl` throws on a code it does not
 * know, so an unrecognised currency falls back to the code itself rather than
 * taking the screen down.
 */
export function formatIn(amount: number, currency: string): string {
  const locale = currency === 'INR' ? 'en-IN' : 'en-US';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

export default { inTradingCurrency, formatIn };
