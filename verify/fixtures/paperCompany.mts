// FILE: verify/fixtures/paperCompany.mts
//
// A PAPER COMPANY, invented here, for the dashboard check.
//
// The dashboard check drives the real site in a real browser, which means the
// site will try to fetch a company. It must not: a check that depends on a
// live source fails when the source is slow, and the figures a third party
// sends us are not ours to commit (see verify/README.md, "Payloads"). So the
// browser's request to /api/company is answered with this instead — five years
// of statements for a company that does not exist, made up of round numbers
// that balance exactly.
//
// Two variants, because a check that only ever sees a working model never
// tests the path a reader is most likely to hit on an awkward filer:
//
//   valued   every line reported; the engine values it.
//   refused  the same company with no operating income filed, which is the
//            commonest real refusal in the sweep set — 34 of the 45 companies
//            whose reason changed in dbd6caa refuse for exactly this.
//
// Nothing here is a real company's data. The numbers are chosen to be legible
// in a screenshot — revenue 900 rising to 1,260, plant of 600, a hundred
// million shares — and to satisfy the balance sheet identity in every year.

// @ts-ignore — the version this fixture's shape matches.
import { PAYLOAD_VERSION } from '../../src/data/payloadVersion';

const YEARS = [2021, 2022, 2023, 2024, 2025];

/**
 * A PRICE SERIES THAT IS A FORMULA, not a recording.
 *
 * The chart and its overlays need a daily history, and a check wants to know
 * the answer before it looks. So this is generated: one close per weekday for
 * three years, ending on the fixture’s own price of 22.50 and rising at a
 * fixed rate before it, with no randomness anywhere. A check can therefore
 * assert the last point, the first point and the count exactly.
 */
const HISTORY_END = '2026-09-22';
const HISTORY_WEEKDAYS = 783; // three years of five-day weeks

function paperHistory() {
  const dates: string[] = [];
  const closes: number[] = [];
  const day = new Date(`${HISTORY_END}T00:00:00Z`);
  for (let i = 0; i < HISTORY_WEEKDAYS; ) {
    const weekday = day.getUTCDay();
    if (weekday !== 0 && weekday !== 6) {
      dates.push(day.toISOString().slice(0, 10));
      // 22.50 on the last day, a tenth of a per cent lower each day before.
      closes.push(Number((22.5 * Math.pow(0.999, i)).toPrecision(6)));
      i++;
    }
    day.setUTCDate(day.getUTCDate() - 1);
  }
  dates.reverse();
  closes.reverse();
  // A monthly series for the "Max" range, taken from the same formula so the
  // two cannot disagree: the last close of each month in the daily series.
  const monthlyDates: string[] = [];
  const monthlyCloses: number[] = [];
  for (let i = 0; i < dates.length; i++) {
    const next = dates[i + 1];
    if (!next || next.slice(0, 7) !== dates[i].slice(0, 7)) {
      monthlyDates.push(dates[i]);
      monthlyCloses.push(closes[i]);
    }
  }
  return {
    currency: 'USD',
    source: 'Yahoo Finance (chart)',
    daily: { from: dates[0], to: dates[dates.length - 1], dates, closes },
    monthly: {
      from: monthlyDates[0],
      to: monthlyDates[monthlyDates.length - 1],
      dates: monthlyDates,
      closes: monthlyCloses,
    },
  };
}

/** Revenue in millions, growing 10% a year off a round 900. */
const revenueFor = (i: number) => 900 + i * 90;

function statementFor(i: number) {
  const fiscalYear = YEARS[i];
  const revenue = revenueFor(i);
  // Costs as fixed shares of revenue, so every margin is flat and the forecast
  // has nothing to fade. D&A sits inside them, as it does in a filing.
  const cogs = revenue * 0.6;
  const sga = revenue * 0.2;
  const rnd = revenue * 0.05;
  const operatingIncome = revenue - cogs - sga - rnd;
  const interestExpense = 12;
  const pretaxIncome = operatingIncome - interestExpense;
  const taxExpense = pretaxIncome * 0.25;
  const netIncome = pretaxIncome - taxExpense;

  // The balance sheet, scaled off revenue so it grows with the business, and
  // then forced to add up: equity is assets less liabilities, to the cent.
  const scale = revenue / 1260;
  const cash = 150 * scale;
  const receivables = 120 * scale;
  const inventory = 95 * scale;
  const currentAssets = cash + receivables + inventory;
  const ppeNet = 600 * scale;
  const otherAssets = 35 * scale;
  const totalAssets = currentAssets + ppeNet + otherAssets;

  const payables = 90 * scale;
  const accrued = 60 * scale;
  const currentLiabilities = payables + accrued;
  const longTermDebt = 300 * scale;
  const otherNonCurrent = 50 * scale;
  const totalLiabilities = currentLiabilities + longTermDebt + otherNonCurrent;
  const equity = totalAssets - totalLiabilities;

  return {
    fiscalYear,
    periodEnd: `${fiscalYear}-12-31`,
    revenue,
    cogs,
    rnd,
    sga,
    operatingIncome,
    pretaxIncome,
    taxExpense,
    netIncome,
    interestExpense,
    cash,
    shortTermInvestments: 0,
    longTermInvestments: null,
    securitiesNotSplit: null,
    receivables,
    inventory,
    currentAssets,
    ppeNet,
    totalAssets,
    payables,
    currentLiabilities,
    longTermDebt,
    longTermDebtTotal: longTermDebt,
    longTermDebtNoncurrent: longTermDebt,
    longTermDebtAndLeaseNoncurrent: longTermDebt,
    debtCurrent: 0,
    longTermDebtCurrent: 0,
    debtAndLeaseCurrent: 0,
    shortTermBorrowings: 0,
    financeLeaseCurrent: 0,
    financeLeaseNoncurrent: 0,
    financeLeaseTotal: 0,
    operatingLeaseCurrent: 0,
    operatingLeaseNoncurrent: 0,
    operatingLeaseTotal: 0,
    financeLeaseRightOfUseAsset: 0,
    operatingLeaseRightOfUseAsset: 0,
    totalLiabilities,
    goodwill: null,
    intangibles: null,
    equity,
    depreciation: 60 * scale,
    depreciationOfPpe: 60 * scale,
    minorityInterest: null,
    redeemableMinorityInterest: null,
    preferredStock: null,
    preferredConversionShares: null,
    preferredDividends: null,
    netIncomeToMinority: null,
    equityIncludingMinority: null,
    amortisationOfIntangibles: null,
    capex: 80 * scale,
    // The three totals of the filed cash flow statement. A reported year shows
    // the filing's own figures, so a fixture without them would leave the
    // dashboard check looking at blanks where the site shows the filing (KI-7).
    operatingCashFlow: netIncome + 60 * scale,
    investingCashFlow: -80 * scale,
    financingCashFlow: -(40 + 20) * scale,
    stockComp: 10 * scale,
    dividendsPaid: 40 * scale,
    commonDividendsPaid: 40 * scale,
    buybacks: 20 * scale,
    dilutedShares: 100_000_000,
  };
}

export const PAPER_TICKER = 'PAPER';
/** The same filer, quoted in another currency: see `paperPayload`. */
export const CONVERTED_TICKER = 'PAPERC';
/** The rate that fixture is converted at, as the pair itself publishes it. */
export const CONVERTED_RATE = 1.3246;
/** What one quoted unit is worth in the trading currency: pence to pounds. */
export const CONVERTED_MINOR_UNIT = 0.01;
export const PAPER_NAME = 'Fenwick Paper Mills Inc.';

/**
 * The payload /api/company would return, if this company existed.
 *
 * `'converted'` IS THE SAME COMPANY WITH ITS QUOTE IN ANOTHER CURRENCY, and
 * differs from `valued` in nothing else: the same statements, the same
 * risk-free rate, the same price once converted. That is deliberate. It means
 * the two screens must show the same value per share, so a difference between
 * them is the conversion and can be nothing else. The quote is in pence --
 * the case that was wrong, where the rate applied to the quote is a hundredth
 * of the rate of the pair it comes from.
 */
export function paperPayload(variant: 'valued' | 'refused' | 'converted' = 'valued') {
  const statements = YEARS.map((_, i) => {
    const row: any = statementFor(i);
    // The refusal: a filer that reports no operating income. The engine cannot
    // read a margin it was never given, and says so rather than estimating one.
    if (variant === 'refused') row.operatingIncome = null;
    return row;
  });

  return {
    ticker: PAPER_TICKER,
    // 'SEC EDGAR' exactly: the derivation reads the share basis from it, and a
    // filer it cannot place on an exchange is refused before anything is valued.
    source: 'SEC EDGAR',
    sourceUrl: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany',
    name: PAPER_NAME,
    currency: 'USD',
    currencySymbol: '$',
    currencyEvidence: {
      reportingCurrency: 'USD',
      reportingCurrencySource: 'the units the SEC XBRL facts are filed in',
      statementCurrencies: ['USD'],
    },
    listing: { shareBasis: 'registeredShares' },
    sicCode: '2621',
    sicDescription: 'Paper Mills',
    statements,
    priceConversion: variant === 'converted'
      ? {
          quotedCurrency: 'GBp',
          tradingCurrency: 'GBP',
          minorUnitFactor: CONVERTED_MINOR_UNIT,
          reportingCurrency: 'USD',
          converted: true,
          // The composite the QUOTED figure is multiplied by, which is what
          // the fetcher records: the pair times the minor unit.
          rate: CONVERTED_RATE * CONVERTED_MINOR_UNIT,
          pair: 'GBPUSD=X',
          asOf: '2026-09-22T20:00:00.000Z',
          reason: null,
        }
      : {
          quotedCurrency: 'USD',
          tradingCurrency: 'USD',
          minorUnitFactor: 1,
          reportingCurrency: 'USD',
          converted: false,
          rate: 1,
          pair: null,
          asOf: null,
          reason: null,
        },
    quote: {
      price: 22.5,
      previousClose: 22.25,
      changePct: 1.12,
      currency: 'USD',
      exchange: variant === 'converted' ? 'LSE' : 'NYSE',
      fiftyTwoWeekHigh: 26,
      fiftyTwoWeekLow: 18,
      rangeObservations: 251,
      asOf: '2026-09-22T20:00:00.000Z',
      // The daily closes the quote fetch keeps from v5 on, so the company
      // page has a chart to draw and the overlays have prices to divide.
      history: paperHistory(),
      // WHAT THE EXCHANGE PUBLISHED, before anything was converted. The
      // checks compare the figure the screen puts back into pence against
      // this one, so the two sides of the comparison come from opposite
      // sides of the conversion.
      ...(variant === 'converted'
        ? {
            asQuoted: {
              currency: 'GBp',
              price: 22.5 / (CONVERTED_RATE * CONVERTED_MINOR_UNIT),
              previousClose: 22.25 / (CONVERTED_RATE * CONVERTED_MINOR_UNIT),
              fiftyTwoWeekHigh: 26 / (CONVERTED_RATE * CONVERTED_MINOR_UNIT),
              fiftyTwoWeekLow: 18 / (CONVERTED_RATE * CONVERTED_MINOR_UNIT),
            },
          }
        : {}),
    },
    // The risk-free rate the model discounts at, as the fetcher returns it: a
    // mean of daily closes over the year ending at this company's own balance
    // sheet date. Without it the engine refuses the valuation (KI-19), so a
    // fixture without one would leave the dashboard check with nothing to
    // compare.
    riskFree: {
      rate: 0.0425,
      currency: 'USD',
      symbol: '^TNX',
      name: '10-year US Treasury par yield',
      // WHO PUBLISHED IT AND HOW OFTEN. Both are on the screen under the
      // risk-free rate, so a fixture without them would leave the one thing
      // "Source: OECD" is about unchecked.
      publisher: 'US Treasury',
      frequency: 'daily',
      tenorYears: 10,
      observations: 250,
      windowFrom: '2024-12-31',
      windowTo: '2025-12-31',
      latest: 0.0418,
      reason: null,
    },
    profile: { sector: 'Materials', industry: 'Paper Products' },
    // The shape this payload is in. The browser asks for the shape it reads and
    // refuses one it does not recognise, so a fixture without this is treated
    // as a cached answer from before the field existed (KI-15).
    fetcherVersion: PAYLOAD_VERSION,
    fetchedAt: '2026-09-25T00:00:00.000Z',
  };
}

export default { paperPayload, PAPER_TICKER, PAPER_NAME, CONVERTED_TICKER, CONVERTED_RATE, CONVERTED_MINOR_UNIT };
