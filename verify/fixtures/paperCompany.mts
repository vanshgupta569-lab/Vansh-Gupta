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

const YEARS = [2021, 2022, 2023, 2024, 2025];

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
export const PAPER_NAME = 'Fenwick Paper Mills Inc.';

/** The payload /api/company would return, if this company existed. */
export function paperPayload(variant: 'valued' | 'refused' = 'valued') {
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
    priceConversion: {
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
      exchange: 'NYSE',
      fiftyTwoWeekHigh: 26,
      fiftyTwoWeekLow: 18,
      rangeObservations: 251,
      asOf: '2026-09-22T20:00:00.000Z',
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
      name: '10-year US Treasury',
      tenorYears: 10,
      observations: 250,
      windowFrom: '2024-12-31',
      windowTo: '2025-12-31',
      latest: 0.0418,
      reason: null,
    },
    profile: { sector: 'Materials', industry: 'Paper Products' },
    fetchedAt: '2026-09-25T00:00:00.000Z',
  };
}

export default { paperPayload, PAPER_TICKER, PAPER_NAME };
