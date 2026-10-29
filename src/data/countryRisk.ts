// FILE: src/data/countryRisk.ts
//
// COUNTRY RISK PREMIUMS, AND THE STATUTORY TAX RATE BESIDE THEM.
//
// There is no official global equity risk premium (`docs/COST_OF_CAPITAL_SPEC.md`
// rule 16: the OECD's country risk classification is not a premium and must not
// be used as one). What there is, and what practice uses, is Damodaran's annual
// table, and this is that table, captured whole rather than typed in.
//
//   Source:   https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datafile/ctryprem.html
//   Vintage:  the page's own "Last updated: January 5, 2026"
//   Captured: 2026-10-29
//   Rows:     178 countries
//
// WITH ACKNOWLEDGEMENT TO ASWATH DAMODARAN (rule 15). He states that his data
// carries no strings attached and that permission need not be asked, and asks
// for acknowledgement; there is no licence text to quote. The card names him
// wherever one of these figures appears, and `DATA_CONSTRAINTS.md` records that
// his written agreement is a launch-time task rather than a development one.
//
// HOW HE BUILDS IT, in his own words on that page, because rule 11's trap lives
// here: "Riskfree rate in US dollars = US treasury bond rate minus Default
// spread for the US", "ERP for US = Implied Expected return on the S&P 500 minus
// Riskfree rate in US dollars", "Mature market ERP = ERP for US minus Default
// spread for the US". So the mature-market premium is NOT the US premium in this
// vintage — the United States carries a 0.23% country premium of its own
// after the Moody's downgrade, and its total is 4.46% against a mature-market
// 4.23%. A pairing that mixes one convention's premium with another
// convention's risk-free rate is the error; `METHODOLOGY.md` §3 records ours.
//
// THE MATURE-MARKET PREMIUM IS READ OFF THE TABLE, not stored beside it: every
// country he rates Aaa carries a country premium of nought and a total equity
// risk premium of exactly the mature-market figure, so the table states it
// 12 times over. `MATURE_ERP` below is that figure, and the generator
// refuses to write this file if the 12 disagree, or if any row's total is not
// its own premium plus the mature one.
//
// WHAT IS NOT HERE. The adjusted default spread and the CDS-based premium are
// two further columns on the same page; neither is used, so neither is stored.
// A country's premium is not a forecast and not a verdict on it: it is the
// price the bond market puts on that government's credit, scaled to equities.

/** One row of the table: the country, its Moody's rating, its country risk
 *  premium in percentage points, and its statutory corporate tax rate. */
export interface CountryRisk {
  country: string;
  rating: string;
  /** Country risk premium, in per cent. Added to MATURE_ERP, never twice. */
  crpPct: number;
  /** The country's statutory corporate tax rate, in per cent, or null. */
  statutoryTaxPct: number | null;
}

/** The vintage of every figure in this file, which rule 12 requires be stored. */
export const COUNTRY_RISK_VINTAGE = 'January 5, 2026';
export const COUNTRY_RISK_CAPTURED = '2026-10-29';
export const COUNTRY_RISK_SOURCE =
  'https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datafile/ctryprem.html';
export const COUNTRY_RISK_PUBLISHER = 'Aswath Damodaran, NYU Stern';

/** The mature-market equity risk premium, in per cent: see the note above. */
export const MATURE_ERP_PCT = 4.23;

// country, Moody's rating, country risk premium %, statutory tax %
const TABLE: [string, string, number, number | null][] = [
  ['Abu Dhabi', 'Aa2', 0.64, 9],
  ['Albania', 'Ba3', 4.66, 15],
  ['Algeria', 'NR', 5.83, 10.07],
  ['Andorra (Principality of)', 'Baa1', 2.07, 10],
  ['Angola', 'B3', 8.41, 25],
  ['Argentina', 'Caa1', 9.71, 35],
  ['Armenia', 'Ba3', 4.66, 18],
  ['Aruba', 'Baa3', 2.85, 22],
  ['Australia', 'Aaa', 0, 30],
  ['Austria', 'Aa1', 0.36, 23],
  ['Azerbaijan', 'Baa3', 2.85, 20],
  ['Bahamas', 'B1', 5.83, 0],
  ['Bahrain', 'B2', 7.12, 0],
  ['Bangladesh', 'B2', 7.12, 27.5],
  ['Barbados', 'B2', 7.12, 9],
  ['Belarus', 'C', 26.66, 25],
  ['Belgium', 'Aa3', 0.78, 25],
  ['Belize', 'Caa1', 9.71, 0],
  ['Benin', 'B1', 5.83, 30],
  ['Bermuda', 'A2', 1.1, 0],
  ['Bolivia', 'Ca', 15.54, 25],
  ['Bosnia and Herzegovina', 'B3', 8.41, 10],
  ['Botswana', 'Baa1', 2.07, 22],
  ['Brazil', 'Ba1', 3.24, 34],
  ['Brunei', 'NR', 0.78, 5.02],
  ['Bulgaria', 'Baa1', 2.07, 10],
  ['Burkina Faso', 'Caa1', 9.71, 27.5],
  ['Cambodia', 'B2', 7.12, 20],
  ['Cameroon', 'Caa1', 9.71, 33],
  ['Canada', 'Aaa', 0, 26.14],
  ['Cape Verde', 'B2', 7.12, 26.86],
  ['Cayman Islands', 'Aa3', 0.78, 0],
  ['Chile', 'A2', 1.1, 27],
  ['China', 'A1', 0.91, 25],
  ['Colombia', 'Baa3', 2.85, 35],
  ['Congo (Democratic Republic of)', 'B3', 8.41, 30],
  ['Congo (Republic of)', 'Caa2', 11.66, 26.86],
  ['Cook Islands', 'B1', 5.83, 20],
  ['Costa Rica', 'Ba2', 3.9, 30],
  ['C&ocirc;te d\'Ivoire', 'Ba2', 3.9, 25],
  ['Croatia', 'A3', 1.55, 18],
  ['Cuba', 'Ca', 15.54, 35],
  ['Curacao', 'Baa3', 2.85, 22],
  ['Cyprus', 'A3', 1.55, 12.5],
  ['Czech Republic', 'Aa3', 0.78, 21],
  ['Denmark', 'Aaa', 0, 22],
  ['Dominican Republic', 'Ba2', 3.9, 27],
  ['Ecuador', 'Caa3', 12.95, 25],
  ['Egypt', 'Caa1', 9.71, 22.5],
  ['El Salvador', 'B3', 8.41, 30],
  ['Estonia', 'A1', 0.91, 20],
  ['Ethiopia', 'Caa2', 11.66, 30],
  ['Fiji', 'B1', 5.83, 25],
  ['Finland', 'Aa1', 0.36, 20],
  ['France', 'Aa3', 0.78, 25.83],
  ['Gabon', 'Caa2', 11.66, 30],
  ['Gambia', 'NR', 7.12, 11.36],
  ['Georgia', 'Ba2', 3.9, 15],
  ['Germany', 'Aaa', 0, 29.93],
  ['Ghana', 'Caa1', 9.71, 25],
  ['Greece', 'Baa3', 2.85, 22],
  ['Guatemala', 'Ba1', 3.24, 25],
  ['Guernsey (States of)', 'A1', 0.91, 0],
  ['Guinea', 'NR', 11.66, 15.9],
  ['Guinea-Bissau', 'NR', 9.71, 13.95],
  ['Guyana', 'NR', 2.07, 6.31],
  ['Haiti', 'NR', 12.95, 17.19],
  ['Honduras', 'B1', 5.83, 30],
  ['Hong Kong', 'Aa3', 0.78, 16.5],
  ['Hungary', 'Baa2', 2.46, 9],
  ['Iceland', 'A1', 0.91, 21],
  ['India', 'Baa3', 2.85, 30],
  ['Indonesia', 'Baa2', 2.46, 22],
  ['Iran', 'NR', 9.71, 13.95],
  ['Iraq', 'Caa1', 9.71, 15],
  ['Ireland', 'Aa3', 0.78, 12.5],
  ['Isle of Man', 'Aa3', 0.78, 0],
  ['Israel', 'Baa1', 2.07, 23],
  ['Italy', 'Baa2', 2.46, 27.81],
  ['Jamaica', 'Ba3', 4.66, 25],
  ['Japan', 'A1', 0.91, 29.74],
  ['Jersey (States of)', 'Aa3', 0.78, 0],
  ['Jordan', 'Ba3', 4.66, 20],
  ['Kazakhstan', 'Baa1', 2.07, 20],
  ['Kenya', 'Caa1', 9.71, 30],
  ['Korea', 'Aa2', 0.64, 26.4],
  ['Korea, D.P.R.', 'NR', 15.54, 19.78],
  ['Kuwait', 'A1', 0.91, 15],
  ['Kyrgyzstan', 'B3', 8.41, 10],
  ['Laos', 'Caa2', 11.66, 20],
  ['Latvia', 'A3', 1.55, 20],
  ['Lebanon', 'C', 26.66, 17],
  ['Liberia', 'NR', 11.66, 15.9],
  ['Libya', 'NR', 3.9, 8.14],
  ['Liechtenstein', 'Aaa', 0, 12.5],
  ['Lithuania', 'A2', 1.1, 15],
  ['Luxembourg', 'Aaa', 0, 24.94],
  ['Macao', 'Aa3', 0.78, 25],
  ['Macedonia', 'Ba3', 4.66, 10],
  ['Madagascar', 'NR', 8.41, 12.65],
  ['Malawi', 'NR', 12.95, 17.19],
  ['Malaysia', 'A3', 1.55, 24],
  ['Maldives', 'Caa2', 11.66, 15],
  ['Mali', 'Caa2', 11.66, 30],
  ['Malta', 'A2', 1.1, 35],
  ['Mauritius', 'Baa3', 2.85, 15],
  ['Mexico', 'Baa2', 2.46, 30],
  ['Moldova', 'B3', 8.41, 12],
  ['Mongolia', 'B1', 5.83, 25],
  ['Montenegro', 'B1', 5.83, 15],
  ['Montserrat', 'Baa3', 2.85, 30],
  ['Morocco', 'Ba1', 3.24, 33],
  ['Mozambique', 'Caa3', 12.95, 32],
  ['Myanmar', 'NR', 15.54, 19.78],
  ['Namibia', 'B1', 5.83, 32],
  ['Nepal', 'Ba3', 4.66, 25],
  ['Netherlands', 'Aaa', 0, 25.8],
  ['New Zealand', 'Aaa', 0, 28],
  ['Nicaragua', 'B2', 7.12, 30],
  ['Niger', 'Caa3', 12.95, 30],
  ['Nigeria', 'B3', 8.41, 30],
  ['Norway', 'Aaa', 0, 22],
  ['Oman', 'Baa3', 2.85, 15],
  ['Pakistan', 'Caa1', 9.71, 29],
  ['Panama', 'Baa3', 2.85, 25],
  ['Papua New Guinea', 'B2', 7.12, 30],
  ['Paraguay', 'Baa3', 2.85, 10],
  ['Peru', 'Baa1', 2.07, 29.5],
  ['Philippines', 'Baa2', 2.46, 25],
  ['Poland', 'A2', 1.1, 19],
  ['Portugal', 'A3', 1.55, 31.5],
  ['Qatar', 'Aa2', 0.64, 10],
  ['Ras Al Khaimah (Emirate of)', 'A3', 1.55, 18.94],
  ['Romania', 'Baa3', 2.85, 16],
  ['Russia', 'NR', 3.9, 8.14],
  ['Rwanda', 'B2', 7.12, 28],
  ['Saudi Arabia', 'Aa3', 0.78, 20],
  ['Senegal', 'Caa1', 9.71, 30],
  ['Serbia', 'Ba2', 3.9, 15],
  ['Sharjah', 'Ba1', 3.24, 18.94],
  ['Sierra Leone', 'NR', 8.41, 12.65],
  ['Singapore', 'Aaa', 0, 17],
  ['Slovakia', 'A3', 1.55, 21],
  ['Slovenia', 'A3', 1.55, 22],
  ['Solomon Islands', 'Caa1', 9.71, 30],
  ['Somalia', 'NR', 12.95, 17.19],
  ['South Africa', 'Ba2', 3.9, 27],
  ['Spain', 'A3', 1.55, 25],
  ['Sri Lanka', 'Ca', 15.54, 30],
  ['St. Maarten', 'Ba2', 3.9, 20],
  ['St. Vincent & the Grenadines', 'B3', 8.41, 28],
  ['Sudan', 'NR', 26.66, 30.9],
  ['Suriname', 'Caa1', 9.71, 36],
  ['Swaziland', 'B2', 7.12, 25],
  ['Sweden', 'Aaa', 0, 20.6],
  ['Switzerland', 'Aaa', 0, 19.61],
  ['Syria', 'NR', 15.54, 19.78],
  ['Taiwan', 'Aa3', 0.78, 20],
  ['Tajikistan', 'B3', 8.41, 18],
  ['Tanzania', 'B1', 5.83, 30],
  ['Thailand', 'Baa1', 2.07, 20],
  ['Togo', 'B3', 8.41, 27],
  ['Trinidad and Tobago', 'Ba2', 3.9, 30],
  ['Tunisia', 'Caa1', 9.71, 15],
  ['Turkey (updated February 2026)', 'Ba3', 4.66, 25],
  ['Turks and Caicos Islands', 'Baa1', 2.07, 0],
  ['Uganda', 'B3', 8.41, 30],
  ['Ukraine', 'Ca', 15.54, 18],
  ['United Arab Emirates', 'Aa2', 0.64, 9],
  ['United Kingdom', 'Aa3', 0.78, 25],
  ['United States', 'Aa1', 0.23, 25],
  ['Uruguay', 'Baa1', 2.07, 25],
  ['Uzbekistan', 'Ba3', 4.66, 15],
  ['Venezuela', 'C', 26.66, 34],
  ['Vietnam', 'Ba2', 3.9, 20],
  ['Yemen, Republic', 'NR', 15.54, 19.78],
  ['Zambia', 'Caa2', 11.66, 30],
  ['Zimbabwe', 'NR', 11.66, 15.9],
];

export const COUNTRY_RISK: CountryRisk[] = TABLE.map(([country, rating, crpPct, statutoryTaxPct]) => ({
  country,
  rating,
  crpPct,
  statutoryTaxPct,
}));

// WHAT THE VENDOR FEED CALLS A COUNTRY, AND WHAT THE TABLE CALLS IT. Only the
// names that actually differ for the companies this site holds, so an alias is
// a measured need rather than a guess: the payload set carries 25 countries and
// this is the one that does not match on its own name.
const ALIASES: Record<string, string> = {
  'south korea': 'Korea',
  'korea, republic of': 'Korea',
  'republic of korea': 'Korea',
  'united states of america': 'United States',
  usa: 'United States',
  uk: 'United Kingdom',
  'great britain': 'United Kingdom',
  'russian federation': 'Russia',
  'viet nam': 'Vietnam',
  'united arab emirates': 'United Arab Emirates',
  'czech republic': 'Czech Republic',
  turkiye: 'Turkey',
};

const BY_NAME = new Map<string, CountryRisk>(
  COUNTRY_RISK.map((r) => [r.country.toLowerCase(), r])
);

/**
 * The row for a country, or null when the table does not name it.
 *
 * Null is an answer, not a failure: a company whose country is not in the table
 * gets no country risk premium and the card says the table does not carry it,
 * which is the only honest thing to show. It is never defaulted to nought,
 * because nought is the premium of a Aaa sovereign and claiming it for an
 * unknown one is a claim about that country's credit.
 */
export function countryRiskFor(country: string | null | undefined): CountryRisk | null {
  const raw = String(country || '').trim();
  if (!raw) return null;
  const key = raw.toLowerCase();
  const alias = ALIASES[key];
  return BY_NAME.get(key) ?? (alias ? BY_NAME.get(alias.toLowerCase()) ?? null : null);
}

export default { COUNTRY_RISK, countryRiskFor, MATURE_ERP_PCT, COUNTRY_RISK_VINTAGE };
