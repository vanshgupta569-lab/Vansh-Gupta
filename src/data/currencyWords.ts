// FILE: src/data/currencyWords.ts
//
// THE WORD FOR A CURRENCY'S UNIT, SO NO SCREEN WRITES ITS OWN.
//
// `docs/STUDIO_SPEC_ADDENDUM.md` G7: the valuation screen told a reader of
// NVIDIA — a company that reports in US dollars — what it keeps from "every
// hundred RUPEES of sales". The sentence was written when every company on the
// site was Indian and the word was hard-coded into the copy. The product is
// global: a figure can be right and the sentence around it still wrong.
//
// So the word comes from the company's own reporting currency, and anything
// that needs it reads it here. A currency this file does not know is named by
// its CODE rather than guessed at — "every hundred XYZ of sales" is clumsy and
// honest, and inventing a plural for an unknown code is neither.
//
// Only the currencies the payload set actually reports in are listed. The list
// is checked against the set by `npm run verify`, so a currency that arrives
// without a word here is reported rather than discovered in a screenshot.

export interface CurrencyWords {
  /** One unit: "a dollar". */
  one: string;
  /** More than one: "a hundred dollars". */
  many: string;
}

const WORDS: Record<string, CurrencyWords> = {
  USD: { one: 'dollar', many: 'dollars' },
  EUR: { one: 'euro', many: 'euros' },
  GBP: { one: 'pound', many: 'pounds' },
  GBp: { one: 'penny', many: 'pence' },
  INR: { one: 'rupee', many: 'rupees' },
  JPY: { one: 'yen', many: 'yen' },
  CNY: { one: 'yuan', many: 'yuan' },
  HKD: { one: 'Hong Kong dollar', many: 'Hong Kong dollars' },
  CAD: { one: 'Canadian dollar', many: 'Canadian dollars' },
  AUD: { one: 'Australian dollar', many: 'Australian dollars' },
  SGD: { one: 'Singapore dollar', many: 'Singapore dollars' },
  CHF: { one: 'franc', many: 'francs' },
  SEK: { one: 'krona', many: 'kronor' },
  NOK: { one: 'krone', many: 'kroner' },
  DKK: { one: 'krone', many: 'kroner' },
  KRW: { one: 'won', many: 'won' },
  TWD: { one: 'new Taiwan dollar', many: 'new Taiwan dollars' },
  BRL: { one: 'real', many: 'reais' },
  MXN: { one: 'Mexican peso', many: 'Mexican pesos' },
  ZAR: { one: 'rand', many: 'rand' },
  ILS: { one: 'shekel', many: 'shekels' },
  SAR: { one: 'riyal', many: 'riyals' },
  AED: { one: 'dirham', many: 'dirhams' },
  TRY: { one: 'lira', many: 'lira' },
  PLN: { one: 'zloty', many: 'zlotys' },
  THB: { one: 'baht', many: 'baht' },
  IDR: { one: 'rupiah', many: 'rupiah' },
  MYR: { one: 'ringgit', many: 'ringgit' },
  PHP: { one: 'Philippine peso', many: 'Philippine pesos' },
  NZD: { one: 'New Zealand dollar', many: 'New Zealand dollars' },
};

/** Every code this file knows, for the check that compares it with the set. */
export const CURRENCIES_WITH_WORDS = Object.keys(WORDS);

/**
 * The words for a currency code, or the code itself where it is not known.
 *
 * Never a default of dollars or rupees: a sentence that names the wrong
 * currency is worse than one that names a code, because a reader cannot tell
 * the first from a fact.
 */
export function currencyWords(code: string | null | undefined): CurrencyWords {
  const key = String(code || '').trim();
  if (WORDS[key]) return WORDS[key];
  const upper = key.toUpperCase();
  if (WORDS[upper]) return WORDS[upper];
  return { one: upper || 'unit', many: upper || 'units' };
}

/** "every hundred dollars of sales", from the company's own currency. */
export function perHundred(code: string | null | undefined): string {
  return `every hundred ${currencyWords(code).many}`;
}

export default { currencyWords, perHundred, CURRENCIES_WITH_WORDS };
