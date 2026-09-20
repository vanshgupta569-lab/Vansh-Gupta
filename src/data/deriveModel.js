// FILE: src/data/deriveModel.js
// Marginalia — assumption derivation
//
// Turns raw fetched statements (from /api/company) into the exact data shape
// the engine expects — the same shape as AAPL.js.
//
// The honest framing: AAPL.js came from Vansh's Excel, where roughly forty
// judgement calls were made by hand. Nothing can fetch those. What this file
// does instead is derive a defensible STARTING POINT from the company's own
// reported history — trailing growth, average margins, capex as a share of
// revenue — and then let the user move every one of them with the sliders.
//
// Every derived figure is recorded in `provenance` so the dashboard can show
// where each assumption came from rather than presenting it as fact.

const FORECAST_YEARS = 5;

// ---------------------------------------------------------------- helpers

const isNum = (v) => typeof v === 'number' && isFinite(v);

function mean(values) {
  const clean = values.filter(isNum);
  if (clean.length === 0) return null;
  return clean.reduce((a, b) => a + b, 0) / clean.length;
}

// Keep derived assumptions inside sane bounds. A company with one freak year
// can otherwise produce a growth rate that makes the DCF meaningless.
function clamp(value, low, high, fallback) {
  if (!isNum(value)) return fallback;
  return Math.min(high, Math.max(low, value));
}

// Compound annual growth rate across the historical revenue line.
function cagr(series) {
  const clean = series.filter(isNum);
  if (clean.length < 2) return null;
  const first = clean[0];
  const last = clean[clean.length - 1];
  if (first <= 0 || last <= 0) return null;
  return Math.pow(last / first, 1 / (clean.length - 1)) - 1;
}

// A balance line the filing does not give us directly: a total less the parts
// of it the filing does report. A part the filing leaves out is absorbed into
// the remainder and named in `absorbed`, so the total still ties and the gap is
// recorded rather than hidden. It used to return null instead, which turned one
// missing component into a whole missing line and a balance sheet that could
// not balance. A missing TOTAL cannot be split into parts, so the remainder is
// null; deriveBalanceSheet fills a missing total from the accounting identity
// first, wherever the other two totals are present.
function plug(total, parts) {
  if (!isNum(total)) return { value: null, absorbed: [] };
  let remainder = total;
  const absorbed = [];
  for (const [label, value] of parts) {
    if (isNum(value)) remainder -= value;
    else absorbed.push(label);
  }
  return { value: remainder, absorbed };
}

// "FY2022–FY2026", or a list where the years are not consecutive.
function fiscalYears(years) {
  const sorted = [...years].sort((a, b) => a - b);
  const runs = [];
  for (const y of sorted) {
    const run = runs[runs.length - 1];
    if (run && y === run[1] + 1) run[1] = y;
    else runs.push([y, y]);
  }
  return runs.map(([a, b]) => (a === b ? `FY${a}` : `FY${a}–FY${b}`)).join(', ');
}

const BALANCE_SHEET_FIELDS = [
  ['totalAssets', 'total assets'],
  ['currentAssets', 'current assets'],
  ['cash', 'cash'],
  ['receivables', 'receivables'],
  ['inventory', 'inventory'],
  ['ppeNet', 'net property, plant & equipment'],
  ['totalLiabilities', 'total liabilities'],
  ['currentLiabilities', 'current liabilities'],
  ['payables', 'accounts payable'],
  ['longTermDebt', 'long-term debt'],
  ['equity', "shareholders' equity"],
];

// ---------------------------------------------------------------------------
// THE BALANCE SHEET, FROM WHATEVER THE FILING REPORTS
// ---------------------------------------------------------------------------
// Builds the lines the engine needs so that assets equal liabilities plus
// equity by construction, deriving what can genuinely be derived:
//
//  - A missing total from the other two. Coca-Cola and Walmart report assets
//    and shareholders' equity but not the SEC's total liabilities tag, only
//    liabilities-and-equity combined. Total liabilities is assets less equity;
//    any non-controlling interest the filing keeps outside equity is carried
//    in liabilities, which is where a lender would count it.
//  - A missing component of a total that is reported: absorbed into that
//    total's "other" line (other current assets, other assets, accrued and
//    other current liabilities, other non-current liabilities), and named.
//  - Missing current assets or current liabilities: everything beyond the
//    named lines is carried in the non-current "other" line.
//
// What cannot be derived stays null, and the engine then refuses the company:
// its balance check will not be zero. Every missing line is returned in
// `gaps` so the refusal can name them. Two gaps block a valuation even where
// the balance sheet can be made to add up, because absorbing them would
// balance the sheet while corrupting net debt: cash in the last reported year,
// and long-term debt in the last reported year when earlier years report it.
function deriveBalanceSheet(rows) {
  const out = {
    cashAndSecurities: [],
    shortTermSecurities: [],
    securitiesNotSplitYears: [],
    otherCurrentAssets: [],
    otherAssets: [],
    accruedExpenses: [],
    otherNonCurrentLiabilities: [],
    equity: [],
    notes: [],
    gaps: [],
  };
  const noteYears = new Map();
  const note = (text, year) => {
    if (!noteYears.has(text)) noteYears.set(text, []);
    noteYears.get(text).push(year);
  };
  const derivedTotals = {};
  const markDerived = (field, how, year) => {
    derivedTotals[field] ??= { how, years: [] };
    derivedTotals[field].years.push(year);
  };
  const absorbedInto = (line, absorbed, year) => {
    if (absorbed.length) note(`${absorbed.join(' and ')} not reported separately: carried in ${line}`, year);
  };

  for (const r of rows) {
    const fy = r.fiscalYear;
    const equity = isNum(r.equity) ? r.equity : null;
    let totalAssets = isNum(r.totalAssets) ? r.totalAssets : null;
    let totalLiabilities = isNum(r.totalLiabilities) ? r.totalLiabilities : null;
    const currentAssets = isNum(r.currentAssets) ? r.currentAssets : null;
    const currentLiabilities = isNum(r.currentLiabilities) ? r.currentLiabilities : null;

    if (totalLiabilities === null && totalAssets !== null && equity !== null) {
      totalLiabilities = totalAssets - equity;
      markDerived('totalLiabilities', "total assets less shareholders' equity", fy);
      note("total liabilities worked out as total assets less shareholders' equity (any non-controlling interest is carried in liabilities)", fy);
    } else if (totalAssets === null && totalLiabilities !== null && equity !== null) {
      totalAssets = totalLiabilities + equity;
      markDerived('totalAssets', "total liabilities plus shareholders' equity", fy);
      note("total assets worked out as total liabilities plus shareholders' equity", fy);
    }
    if (equity === null && totalAssets !== null && totalLiabilities !== null) {
      markDerived('equity', 'total assets less total liabilities', fy);
    }

    // Cash, and the short-term marketable securities that belong with it.
    //
    // Securities are money parked in instruments rather than in the bank; a
    // company holding them is no more indebted for it, so they come off debt
    // with cash. They are taken out of other current assets at the same time,
    // which is where an untagged balance would otherwise sit: counting them in
    // both would add them to the balance sheet twice.
    //
    // Where the filing shows securities but never says how much is current,
    // the year is recorded and NOTHING is netted off: the securities stay
    // inside other current assets, where they already were, rather than being
    // read as nil or split by guesswork.
    const securities = isNum(r.shortTermInvestments) && r.shortTermInvestments >= 0
      ? r.shortTermInvestments
      : null;
    const securitiesExist = isNum(r.securitiesNotSplit) && r.securitiesNotSplit > 0;
    if (securities === null && securitiesExist) {
      out.securitiesNotSplitYears.push(fy);
      note(
        `the filing reports marketable securities (${r.securitiesNotSplit.toLocaleString('en-US', { maximumFractionDigits: 0 })}) ` +
          'but not how much of them is short-term, so none is counted as cash and they stay in other current assets',
        fy
      );
    }
    out.shortTermSecurities.push(securities);
    out.cashAndSecurities.push(isNum(r.cash) ? r.cash + (securities ?? 0) : null);

    // Assets
    if (currentAssets !== null) {
      const oca = plug(currentAssets, [
        ['cash', r.cash],
        ['short-term investments', securities],
        ['receivables', r.receivables],
        ['inventory', r.inventory],
      ]);
      // A securities balance that is not reported is not "absorbed into other
      // current assets" in the sense the note means; the line above says it.
      oca.absorbed = oca.absorbed.filter((l) => l !== 'short-term investments');
      absorbedInto('other current assets', oca.absorbed, fy);
      const oa = plug(totalAssets, [['current assets', currentAssets], ['net PP&E', r.ppeNet]]);
      absorbedInto('other assets', oa.absorbed, fy);
      out.otherCurrentAssets.push(oca.value);
      out.otherAssets.push(oa.value);
    } else if (totalAssets !== null) {
      const oa = plug(totalAssets, [
        ['cash', r.cash],
        ['short-term investments', securities],
        ['receivables', r.receivables],
        ['inventory', r.inventory],
        ['net PP&E', r.ppeNet],
      ]);
      oa.absorbed = oa.absorbed.filter((l) => l !== 'short-term investments');
      note('current assets not reported: every asset beyond cash, securities, receivables, inventory and PP&E is carried in other assets', fy);
      absorbedInto('other assets', oa.absorbed, fy);
      out.otherCurrentAssets.push(0);
      out.otherAssets.push(oa.value);
    } else {
      out.otherCurrentAssets.push(null);
      out.otherAssets.push(null);
    }

    // Liabilities
    if (currentLiabilities !== null) {
      const acc = plug(currentLiabilities, [['accounts payable', r.payables]]);
      absorbedInto('accrued and other current liabilities', acc.absorbed, fy);
      const oncl = plug(totalLiabilities, [['current liabilities', currentLiabilities], ['long-term debt', r.longTermDebt]]);
      absorbedInto('other non-current liabilities', oncl.absorbed, fy);
      out.accruedExpenses.push(acc.value);
      out.otherNonCurrentLiabilities.push(oncl.value);
    } else if (totalLiabilities !== null) {
      const oncl = plug(totalLiabilities, [['accounts payable', r.payables], ['long-term debt', r.longTermDebt]]);
      note('current liabilities not reported: every liability beyond accounts payable and long-term debt is carried in other non-current liabilities', fy);
      absorbedInto('other non-current liabilities', oncl.absorbed, fy);
      out.accruedExpenses.push(0);
      out.otherNonCurrentLiabilities.push(oncl.value);
    } else {
      out.accruedExpenses.push(null);
      out.otherNonCurrentLiabilities.push(null);
    }

    out.equity.push(totalAssets !== null && totalLiabilities !== null ? totalAssets - totalLiabilities : null);
  }

  out.notes = [...noteYears.entries()].map(([text, years]) => `${text} (${fiscalYears(years)})`);

  const last = rows[rows.length - 1] || {};
  for (const [field, label] of BALANCE_SHEET_FIELDS) {
    const years = rows.filter((r) => !isNum(r[field])).map((r) => r.fiscalYear);
    if (!years.length) continue;
    const gap = { field, label, years, derivedAs: derivedTotals[field]?.how ?? null, blocksValuation: false, reason: null, reportedIn: null };
    if (field === 'cash' && !isNum(last.cash)) {
      gap.blocksValuation = true;
      gap.reason = 'net debt cannot be measured without the cash balance';
    }
    if (field === 'longTermDebt' && !isNum(last.longTermDebt)) {
      const earlier = rows.filter((r) => isNum(r.longTermDebt) && r.longTermDebt > 0).map((r) => r.fiscalYear);
      if (earlier.length) {
        gap.blocksValuation = true;
        gap.reportedIn = earlier;
        gap.reason = 'carrying it as zero would leave that debt out of net debt and overstate what the shares are worth';
      }
    }
    out.gaps.push(gap);
  }
  return out;
}

// ---------------------------------------------------------------- main

// ---------------------------------------------------------------------------
// IS THIS HISTORY ACTUALLY ONE COMPANY?
// ---------------------------------------------------------------------------
// A forecast built on a company's own history assumes the history describes the
// same company throughout. After a demerger or a spin-off it does not, and the
// data source gives no warning: it simply lists the periods side by side.
//
// Tata Motors is the case that exposed this. Its three reported periods were:
//
//   FY2024  revenue 4,312,120  — the old consolidated group, including JLR
//   FY2025  revenue   577,880  — depreciation was 187% of net PP&E
//   FY2026  revenue   833,900  — the demerged commercial vehicle business
//
// Read as one company that is trailing growth of -56%, capped to a permanent
// -10% decline, and average capex of 25.3% of revenue against an operating
// margin of 8.9%. Unlevered free cash flow came out negative in every forecast
// year and the model printed a value of -2.56 a share. The engine's own guards
// did not catch it: operating profit stayed positive, and normalised terminal
// cash flow was positive because the terminal year sets capex equal to
// depreciation, which strips the very distortion causing the problem.
//
// Two tests, both about whether a period can be compared with the ones around
// it. Neither guesses at causes; both refuse rather than repair.
function selectComparablePeriods(statements) {
  const rows = Array.isArray(statements) ? statements.slice() : [];
  const excluded = [];
  if (rows.length < 2) return { rows, excluded };

  // TEST 1 — a collapse in revenue means the reporting entity changed.
  //
  // Only a COLLAPSE counts. A surge is what fast growth looks like: Nvidia's
  // revenue more than doubled in a single year and that history is perfectly
  // usable. A fall of more than 60%, by contrast, is not something an operating
  // business does while remaining the same reporting entity. Everything before
  // the most recent such break is a different company and is dropped.
  let breakAt = -1;
  for (let i = 1; i < rows.length; i++) {
    const before = rows[i - 1]?.revenue;
    const after = rows[i]?.revenue;
    if (
      typeof before === 'number' &&
      typeof after === 'number' &&
      before > 0 &&
      after / before < 0.4
    ) {
      breakAt = i;
    }
  }
  let kept = rows;
  if (breakAt > 0) {
    for (const row of rows.slice(0, breakAt)) {
      excluded.push({
        fiscalYear: row.fiscalYear,
        reason: 'revenue falls by more than 60% after this period, which is a change of reporting entity rather than a trading result',
      });
    }
    kept = rows.slice(breakAt);
  }

  // TEST 2 — depreciation cannot exceed the assets being depreciated.
  //
  // A full year of depreciation larger than the closing net PP&E is not a
  // going concern writing down its assets, it is a period that does not line up
  // with the balance sheet beside it: a stub period, a restated set, or two
  // different entities stitched together. Tata Motors FY2025 charged 232,560
  // against net PP&E of 124,380.
  kept = kept.filter((row) => {
    if (
      typeof row.depreciation === 'number' &&
      typeof row.ppeNet === 'number' &&
      row.ppeNet > 0 &&
      row.depreciation > row.ppeNet
    ) {
      excluded.push({
        fiscalYear: row.fiscalYear,
        reason: 'depreciation for the period exceeds closing net property, plant and equipment, so the period does not line up with its own balance sheet',
      });
      return false;
    }
    return true;
  });

  return { rows: kept, excluded };
}

// ---------------------------------------------------------------------------
// IS THE PRICE COMPARABLE WITH THE STATEMENTS?
// ---------------------------------------------------------------------------
// A value per share is statements divided by a share count, compared with a
// price. That comparison means something only if all three describe the same
// thing: the statements and the price in the same currency, and the share count
// counting the security the price is for. Two things break it for listings
// outside the US:
//
//   CURRENCY. Toyota's statements are in yen; its New York listing trades in
//   dollars. The reporting currency is taken from the filing's own statement of
//   it (the SEC's XBRL units, or Yahoo's financialCurrency, cross-checked
//   against the currency Yahoo stamps on each figure), never inferred. A price
//   in another currency is converted at a rate fetched with it (api/company.js);
//   if no rate could be fetched, there is no value.
//
//   SHARE BASIS. A depositary receipt can stand for a fraction or a multiple of
//   an ordinary share, and nothing free publishes the ratio in a form that can
//   be read reliably. Yahoo's own share counts for these listings are
//   inconsistent: scaled to the receipt for Toyota (a tenth of the Tokyo count),
//   Shell (a half) and Alibaba (an eighth), but the ordinary count for
//   AstraZeneca, whose receipt is half a share. So a listing on a US market by a
//   company based elsewhere, or on London's international order book, is
//   refused: its ratio cannot be established. A 10-K filer's statements count
//   the registered shares its ticker trades, and a home-market listing trades
//   the ordinary shares its statements count; for Yahoo listings that is also
//   checked against the listing's own share count.
//
// Returns { refusal, basis }: refusal is null when the comparison holds.
const US_MARKET_EXCHANGES = new Set(['NYQ', 'NMS', 'NGM', 'NCM', 'NAS', 'NYS', 'ASE', 'PCX', 'BTS', 'PNK', 'OQX', 'OQB', 'OEM', 'OBB', 'CXI']);
const DEPOSITARY_VENUES = new Set(['IOB']);
const SHARE_COUNT_TOLERANCE = 1.5;

export function listingComparability(fetched) {
  const evidence = fetched?.currencyEvidence || null;
  const listing = fetched?.listing || null;
  const conversion = fetched?.priceConversion || null;
  const isSec = fetched?.source === 'SEC EDGAR';
  const name = fetched?.name || fetched?.ticker || 'This company';

  // Payloads from before the currency was recorded. The SEC path only ever read
  // US-dollar filings of registered shares then; the Yahoo path is the one this
  // check exists for, so an old Yahoo payload is refused.
  const reportingCurrency = evidence ? evidence.reportingCurrency : isSec ? 'USD' : null;
  const quotedCurrency = conversion?.quotedCurrency ?? fetched?.quote?.asQuoted?.currency ?? fetched?.quote?.currency ?? null;
  const basis = {
    reportingCurrency,
    reportingCurrencySource: evidence ? evidence.reportingCurrencySource : isSec ? 'SEC filing (payload recorded no units)' : null,
    statementCurrencies: evidence?.statementCurrencies ?? [],
    quotedCurrency,
    tradingCurrency: conversion?.tradingCurrency ?? quotedCurrency,
    priceConverted: Boolean(conversion?.converted),
    rate: conversion?.rate ?? null,
    pair: conversion?.pair ?? null,
    rateAsOf: conversion?.asOf ?? null,
    exchange: listing?.exchangeName || listing?.exchange || fetched?.quote?.exchange || null,
    country: listing?.country ?? null,
    shareBasis: null,
  };
  const refuse = (reason, detail) => ({
    refusal: {
      code: 'listingNotComparable',
      reason,
      message:
        `${detail} A value per share would compare figures that do not describe the same thing, ` +
        'so none is shown. The reported figures below are unaffected.',
    },
    basis,
  });

  // 1. The reporting currency must be stated, and stated consistently.
  if (!reportingCurrency) {
    return refuse(
      'reportingCurrencyUnknown',
      `The data for ${name} does not say which currency its financial statements are in.`
    );
  }
  const others = basis.statementCurrencies.filter((c) => c !== reportingCurrency);
  if (others.length) {
    return refuse(
      'reportingCurrencyConflict',
      `${name}'s statements are said to be in ${reportingCurrency}, but figures in them are stamped ${others.join(', ')}.`
    );
  }

  // 2. The share count must count the security the price is for.
  if (isSec) {
    basis.shareBasis = 'registered shares of the SEC filer';
  } else {
    const exchange = listing?.exchange ?? null;
    const usMarket = listing?.market === 'us_market' || (exchange != null && US_MARKET_EXCHANGES.has(exchange));
    if (!listing || !exchange) {
      return refuse(
        'listingUnknown',
        `The data for ${name} does not say which exchange this listing trades on, so it cannot be told whether the price is for an ordinary share or a depositary receipt.`
      );
    }
    if (DEPOSITARY_VENUES.has(exchange)) {
      return refuse(
        'depositaryReceipt',
        `This listing of ${name} trades on ${basis.exchange}, a market for depositary receipts. A receipt can stand for a fraction or a multiple of an ordinary share, and the ratio cannot be established from the data available.`
      );
    }
    if (usMarket && listing.country !== 'United States') {
      return refuse(
        'depositaryReceipt',
        `${name} is based ${listing.country ? `in ${listing.country}` : 'outside the United States, or its country is not reported,'} and this listing trades on a US market (${basis.exchange}). It is likely a depositary receipt, which can stand for a fraction or a multiple of an ordinary share, and the ratio cannot be established from the data available. The company's home-market listing can be valued instead.`
      );
    }
    const rows = Array.isArray(fetched?.statements) ? fetched.statements : [];
    const filedShares = [...rows].reverse().find((r) => isNum(r?.dilutedShares) && r.dilutedShares > 0)?.dilutedShares ?? null;
    const listedShares = isNum(listing.sharesOutstanding) ? listing.sharesOutstanding : null;
    if (filedShares && listedShares) {
      const ratio = listedShares / filedShares;
      basis.listedToFiledShares = ratio;
      if (ratio > SHARE_COUNT_TOLERANCE || ratio < 1 / SHARE_COUNT_TOLERANCE) {
        return refuse(
          'shareCountMismatch',
          `This listing of ${name} has ${Math.round(listedShares / 1e6).toLocaleString('en-US')} million shares outstanding, but its statements count ${Math.round(filedShares / 1e6).toLocaleString('en-US')} million, so the price and the share count may not be for the same security.`
        );
      }
    }
    basis.shareBasis = usMarket ? 'ordinary shares of a US company' : 'ordinary shares on a home-market listing';
  }

  // 3. The price must be in the reporting currency.
  if (!fetched?.quote || !isNum(fetched.quote.price)) return { refusal: null, basis };
  if (conversion) {
    if (!conversion.tradingCurrency) {
      return refuse('quoteCurrencyUnknown', `The currency ${name}'s price is quoted in (${conversion.quotedCurrency ?? 'not reported'}) could not be read.`);
    }
    if (conversion.rate === null) {
      return refuse(
        'exchangeRateUnavailable',
        `${name}'s statements are in ${reportingCurrency} and this listing trades in ${conversion.tradingCurrency}, and no exchange rate (${conversion.pair}) could be fetched to convert the price: ${conversion.reason}.`
      );
    }
    if (conversion.reportingCurrency !== reportingCurrency || fetched.quote.currency !== reportingCurrency) {
      return refuse('exchangeRateUnavailable', `${name}'s price could not be put in ${reportingCurrency}, the currency its statements are in.`);
    }
  } else if (quotedCurrency !== reportingCurrency) {
    return refuse(
      'exchangeRateUnavailable',
      `${name}'s statements are in ${reportingCurrency} and its price is quoted in ${quotedCurrency ?? 'an unreported currency'}, with no conversion.`
    );
  }
  return { refusal: null, basis };
}

export function deriveModel(fetched) {
  const { rows, excluded } = selectComparablePeriods(fetched.statements || []);

  // Refuse rather than model a history that is not one company. Two comparable
  // periods is the minimum for any growth rate at all.
  if (rows.length < 2) {
    const dropped = excluded
      .map((e) => `FY${e.fiscalYear} (${e.reason})`)
      .join('; ');
    throw new Error(
      `${fetched.ticker || 'This company'} does not have two comparable years of reported history, ` +
        `so no forecast can be built from it. Periods set aside: ${dropped}. ` +
        `This usually follows a demerger, spin-off or restatement, where the ` +
        `figures published side by side describe different businesses. The ` +
        `reported figures themselves are unaffected and can still be read below.`
    );
  }
  if (rows.length === 0) throw new Error('No statements to model from');

  const years = rows.map((r) => r.fiscalYear);
  const lastYear = years[years.length - 1];
  const forecastYears = Array.from(
    { length: FORECAST_YEARS },
    (_, i) => lastYear + i + 1
  );

  const pick = (field) => rows.map((r) => (isNum(r[field]) ? r[field] : null));
  // The Excel stores costs, dividends and buybacks as negative numbers; the
  // fetcher returns them positive. Flip on the way in.
  const pickNeg = (field) =>
    rows.map((r) => (isNum(r[field]) ? -r[field] : null));

  const revenue = pick('revenue');
  const cogs = pick('cogs');
  const provenance = {};

  // ---- Depreciation of PP&E, as filed -------------------------------------
  //
  // The forecast depreciates capital spending at a rate read from history. That
  // rate used to be measured from the balance sheet: opening PP&E plus capex
  // less closing PP&E. Everything else that moves PP&E — disposals,
  // impairments, finance-lease additions, acquisitions, currency — landed in it,
  // so it measured the wrong thing (Amazon came out at -92% of capex, Union
  // Pacific at 419%). The filing states depreciation directly, so that is what
  // is used:
  //
  //   1. filed depreciation of PP&E, where the filing reports it on its own;
  //   2. filed D&A less filed amortisation of intangibles, where it reports
  //      those two;
  //   3. filed D&A, where the filing does not split it at all. Amortisation is
  //      then treated as depreciation of PP&E and none is run off, which is
  //      said in `provenance` and recorded in `meta.depreciationBasis`.
  //
  // Where the filing reports no D&A in any year, there is nothing filed to read
  // and the engine falls back to the balance-sheet movement for the years it
  // can measure (never the first reported year, which has no opening balance).
  const filedDepreciation = rows.map((r) =>
    isNum(r.depreciationOfPpe)
      ? r.depreciationOfPpe
      : isNum(r.depreciation) && isNum(r.amortisationOfIntangibles)
      ? r.depreciation - r.amortisationOfIntangibles
      : isNum(r.depreciation)
      ? r.depreciation
      : null
  );
  const depreciationBasis = rows.map((r, i) => ({
    year: r.fiscalYear,
    basis: isNum(r.depreciationOfPpe)
      ? 'filed depreciation of PP&E'
      : isNum(r.depreciation) && isNum(r.amortisationOfIntangibles)
      ? 'filed D&A less filed amortisation of intangibles'
      : isNum(r.depreciation)
      ? 'filed D&A, which this filing does not split between the two'
      : 'not filed',
    depreciation: filedDepreciation[i],
    capex: isNum(r.capex) ? r.capex : null,
  }));
  const depreciationRates = rows.map((r, i) =>
    isNum(filedDepreciation[i]) && isNum(r.capex) && r.capex > 0 ? filedDepreciation[i] / r.capex : null
  );
  const filedDepreciationRate = mean(depreciationRates);
  if (excluded.length) {
    provenance.excludedPeriods =
      'set aside as not comparable: ' +
      excluded.map((e) => `FY${e.fiscalYear} — ${e.reason}`).join('; ');
  }

  // ---- Tying operating profit to what the company actually reported -------
  //
  // The engine builds operating profit from the cost lines: revenue less COGS,
  // R&D and SG&A. That works when those lines account for every operating cost,
  // which is true of SEC filings — Apple's revenue less COGS, R&D and SG&A comes
  // to its reported operating income to the last dollar.
  //
  // It is NOT true of every source. Yahoo's SG&A for Reliance is a narrow
  // selling-and-admin figure that leaves out depreciation and a large block of
  // other operating expenses. Built from those lines alone the model gave
  // Reliance an operating profit of 2,320,970 against the 1,213,770 it actually
  // reported: a 91% overstatement, carried straight into the valuation, which
  // is where the model's claim that the shares were worth more than twice their
  // market price came from.
  //
  // So where the filing reports operating income, the gap between it and the
  // cost lines is treated as an operating cost. It is carried on its own line,
  // other operating costs, and not added to SG&A: SG&A is the filed SG&A, and
  // no line claims to be something it is not. (It used to be added to SG&A,
  // which showed Microsoft's SG&A as 34,666 against 7,956 filed.) The forecast
  // is then anchored to a margin the company has actually earned. Where the gap
  // is nil nothing changes.
  const unexplainedOperatingCosts = rows.map((row) => {
    if (!isNum(row.operatingIncome) || !isNum(row.revenue) || !isNum(row.cogs)) return 0;
    const fromCostLines =
      row.revenue - row.cogs - (isNum(row.rnd) ? row.rnd : 0) - (isNum(row.sga) ? row.sga : 0);
    const gap = fromCostLines - row.operatingIncome;
    // Every gap is carried, however small. A tolerance of 0.1% of revenue used
    // to leave small gaps out, when the gap went into SG&A and a small one was
    // not worth distorting it for; on its own line it distorts nothing, and
    // operating income then ties exactly (Sony was 1,265,919 against 1,273,205).
    // Only floating-point noise is ignored.
    return Math.abs(gap) > 1e-6 ? gap : 0;
  });

  const anyPlugged = unexplainedOperatingCosts.some((v) => v !== 0);
  if (anyPlugged) {
    provenance.operatingCostReconciliation =
      "revenue less the cost lines the filing names (cost of sales, R&D, SG&A) does not come to its " +
      'operating income, so the difference is carried on its own line, other operating costs, and ' +
      'operating income ties to the filing. It holds whatever the filing charges above operating ' +
      'income without tagging it as one of those lines (cost of revenue it does not tag as such, ' +
      'marketing, restructuring, impairments), including any named line the filing does not report; ' +
      'a negative figure is operating income the named lines leave out';
  }

  // ---- Lines the filing does not report ------------------------------------
  //
  // A blank in the filing is not a zero. These lines are carried as not
  // reported (null) in the reported years, never as nil, and each place that
  // has to do arithmetic with one says here what it does instead.
  const NOT_REPORTED = [
    ['rnd', 'research & development',
      'shown as not reported; any such cost is inside other operating costs, which ties operating income to the filing'],
    ['sga', 'selling, general & administrative',
      'shown as not reported; any such cost is inside other operating costs, which ties operating income to the filing'],
    ['stockComp', 'stock based compensation',
      'shown as not reported; none is charged as its own line or added back to cash from operations, so any the company paid stays inside its cost lines'],
    ['dividendsPaid', 'dividends paid',
      'shown as not reported; the forecast payout ratio is averaged over the years that report dividends only'],
    ['buybacks', 'share repurchases',
      'shown as not reported; forecast repurchases are averaged over the years that report them only'],
  ];
  const notReported = NOT_REPORTED
    .map(([field, label, treatment]) => ({
      field,
      label,
      treatment,
      years: rows.filter((r) => !isNum(r[field])).map((r) => r.fiscalYear),
    }))
    .filter((g) => g.years.length);
  if (notReported.length) {
    provenance.notReported = notReported
      .map((g) => `${g.label} not reported for ${g.years.map((y) => `FY${y}`).join(', ')}: ${g.treatment}`)
      .join('; ');
  }

  // ---- Reported pretax and net income, tied to the filing -----------------
  //
  // The reported column is what the company filed. Operating profit already
  // ties (see above). Below it, the filing's interest expense is carried on
  // its own line; everything else between operating profit and pretax income
  // (interest income, investment gains, other items) is pretax income less
  // operating profit less that interest; and anything between pretax income
  // after tax and the filed net income (non-controlling interests,
  // discontinued operations, equity-method results reported after tax) is
  // carried as items after tax. Previously other income was set to nil and
  // interest left out, so reported net income was operating profit less tax:
  // AbbVie showed 12,711 against 4,226 filed.
  //
  // Operating profit here is the one the engine builds from the cost lines,
  // which other operating costs above tie to the filed figure, so pretax
  // income ties exactly. Where the filing does not report operating income,
  // pretax income, tax or net income in a year, nothing is estimated: the gap
  // is recorded and the engine refuses the model.
  const filedInterestExpense = rows.map((r) =>
    isNum(r.interestExpense) ? -Math.abs(r.interestExpense) : null
  );
  const operatingProfitBuilt = rows.map((r, i) =>
    isNum(r.revenue)
      ? r.revenue - (isNum(r.cogs) ? r.cogs : 0) - (isNum(r.rnd) ? r.rnd : 0) - (isNum(r.sga) ? r.sga : 0) -
        unexplainedOperatingCosts[i]
      : null
  );
  const otherNonOperating = rows.map((r, i) =>
    isNum(r.pretaxIncome) && isNum(operatingProfitBuilt[i])
      ? r.pretaxIncome - operatingProfitBuilt[i] - (filedInterestExpense[i] ?? 0)
      : 0
  );
  const itemsAfterTax = rows.map((r) =>
    isNum(r.netIncome) && isNum(r.pretaxIncome) && isNum(r.taxExpense)
      ? r.netIncome - (r.pretaxIncome - r.taxExpense)
      : null
  );
  const incomeStatementGaps = [
    ['operatingIncome', 'operating income'],
    ['pretaxIncome', 'pretax income'],
    ['taxExpense', 'income tax'],
    ['netIncome', 'net income'],
  ]
    .map(([field, label]) => ({ field, label, years: rows.filter((r) => !isNum(r[field])).map((r) => r.fiscalYear) }))
    .filter((g) => g.years.length);
  provenance.incomeStatement =
    'reported pretax and net income are the filed figures: interest expense as filed, other non-operating ' +
    'income as pretax income less operating income and interest, and items after tax (non-controlling ' +
    'interests, discontinued operations) as net income less pretax income after tax';

  // ------------------------------------------------------------ historicals

  // Balance sheet lines the filing doesn't break out, derived from what it
  // does report. See deriveBalanceSheet: whatever cannot be derived stays
  // null, and the engine refuses a model whose balance sheet does not balance.
  const {
    cashAndSecurities,
    shortTermSecurities,
    securitiesNotSplitYears,
    otherCurrentAssets,
    otherAssets,
    accruedExpenses,
    otherNonCurrentLiabilities,
    equity: equityLine,
    notes: balanceSheetNotes,
    gaps: balanceSheetGaps,
  } = deriveBalanceSheet(rows);
  if (balanceSheetNotes.length) provenance.balanceSheet = balanceSheetNotes.join('; ');

  // Inputs the forecast is built from that the filing never reports at all.
  // Without them the forecast balance sheet cannot be computed, so the engine
  // refuses the model, and names these when it does.
  const forecastInputGaps = [];
  const reportedYears = (field) => rows.filter((r) => isNum(r[field])).length;
  if (reportedYears('cogs') === 0) {
    forecastInputGaps.push({
      field: 'cogs',
      label: 'cost of sales',
      drives: 'inventory, payables and other current assets are forecast from its growth, and the gross margin is read from it',
    });
  }
  if (reportedYears('capex') === 0) {
    forecastInputGaps.push({
      field: 'capex',
      label: 'capital expenditure',
      drives: 'the PP&E schedule and depreciation are built from it',
    });
  }
  if (reportedYears('ppeNet') < 2) {
    forecastInputGaps.push({
      field: 'ppeNet',
      label: 'net property, plant & equipment for two or more years',
      drives: 'the depreciation rate is read from its roll-forward',
    });
  }

  const historical = {
    incomeStatement: {
      revenue,
      cogs: pickNeg('cogs'),
      // As filed; null where the filing does not report the line.
      researchDevelopment: pickNeg('rnd'),
      sellingGeneralAdmin: pickNeg('sga'),
      // Filed operating income less the lines above: see unexplainedOperatingCosts.
      otherOperatingCosts: unexplainedOperatingCosts.map((v) => -v),
      interestExpense: filedInterestExpense,
      otherIncomeExpense: otherNonOperating,
      otherItemsAfterTax: itemsAfterTax,
      pretaxIncomeAsFiled: pick('pretaxIncome'),
      netIncomeAsFiled: pick('netIncome'),
      taxes: pickNeg('taxExpense'),
      basicShares: pick('dilutedShares').map((v) => (isNum(v) ? v / 1e6 : null)),
      dilutedShares: pick('dilutedShares').map((v) => (isNum(v) ? v / 1e6 : null)),
    },

    // Segment detail lives in filing footnotes and is not machine-readable
    // from any free source. An auto-generated model therefore runs on a single
    // combined revenue line. This is the main quality gap against a curated
    // model like Apple's, and the dashboard must say so.
    segments: { 'Total revenue': revenue },

    balanceSheet: {
      cashAndSecurities,
      accountsReceivable: pick('receivables'),
      inventory: pick('inventory'),
      deferredTaxAssets: rows.map(() => 0),
      otherCurrentAssets,
      propertyPlantEquipment: pick('ppeNet'),
      otherAssets,
      // Intangible assets excluding goodwill, as reported. Not a balance sheet
      // line of its own here (it sits inside other assets and is not summed);
      // the engine amortises it down in the forecast.
      intangibleAssets: pick('intangibles'),
      accountsPayable: pick('payables'),
      accruedExpenses,
      revolver: rows.map(() => 0),
      longTermDebt: pick('longTermDebt'),
      otherNonCurrentLiabilities,
      // The filing gives total equity but not its internal split. Putting the
      // whole balance in one line keeps the balance sheet correct; the split
      // between paid-in capital and retained earnings is presentational and
      // does not affect the valuation.
      //
      // Equity is taken as total assets less total liabilities rather than the
      // reported equity line, because the two are not always the same figure.
      // Yahoo reports Reliance's equity excluding minority interests, so the
      // reported line left the balance sheet out by 1.1 to 1.8 million lakh and
      // the balance check failed every year. For an SEC filer the two are
      // identical: Apple's 359,241 less 285,508 is exactly its reported 73,733.
      commonStockAPIC: equityLine,
      treasuryStock: rows.map(() => 0),
      retainedEarnings: rows.map(() => 0),
      otherComprehensiveIncome: rows.map(() => 0),
    },

    cashFlow: {
      depreciationAmortisation: pick('depreciation'),
      // As filed; null where the filing does not report the line (see NOT_REPORTED).
      stockBasedCompensation: pick('stockComp'),
      // Depreciation of PP&E on its own, and amortisation of intangibles on its
      // own, as filed where the filing separates them (see filedDepreciation
      // below and NO_SPLIT). The engine charges the first against capital
      // spending and runs the second off against the intangible pool.
      depreciationOfPpe: filedDepreciation,
      amortisationOfIntangibles: pick('amortisationOfIntangibles'),
      capex: pick('capex'),
      dividends: pickNeg('dividendsPaid'),
      shareRepurchases: pickNeg('buybacks'),
    },

    // NOT the first reported year's own closing balance, which is what used to
    // sit here: opening equal to closing made that year's balance movement come
    // out as exactly its capital spending, a depreciation rate of exactly 100%
    // that nothing had measured, and it went into the average the forecast
    // used (155 of 168 companies). A derived model has no balance from before
    // its first reported year, so this is null and that year has no
    // roll-forward.
    ppeOpeningBalance: null,
    basicSharesClosing: isNum(rows[rows.length - 1]?.dilutedShares)
      ? rows[rows.length - 1].dilutedShares / 1e6
      : null,
    averageSharePrice: fetched.quote?.price ?? null,
  };

  // ------------------------------------------------------------ assumptions
  //
  // Forecast conventions follow the approach set out in the Wall Street Prep
  // financial statement modeling cheat sheet. Where the cheat sheet allows more
  // than one method, the one actually used is named in `provenance` so a reader
  // can check the working rather than take it on trust.

  // The most recent reported value in a series. Used wherever the convention is
  // "last actual year" rather than an average.
  const latest = (series) => {
    for (let i = series.length - 1; i >= 0; i--) {
      if (isNum(series[i])) return series[i];
    }
    return null;
  };

  // REVENUE — cheat sheet approach 1: an aggregate growth rate. Approach 2
  // (segment level, price x volume) needs segment detail, which is not
  // machine-readable from any free source. Capped either side: a company
  // growing 60% for three years will not do so for five more, and a shrinking
  // one should not be extrapolated into oblivion.
  const rawGrowth = cagr(revenue);
  const growth = clamp(rawGrowth, -0.10, 0.25, 0.03);
  provenance.revenueGrowth = `${(growth * 100).toFixed(1)}% — trailing ${
    revenue.filter(isNum).length
  }-year compound growth${
    isNum(rawGrowth) && rawGrowth !== growth ? ', capped' : ''
  }`;

  // MARGINS — the cheat sheet says to make a % margin assumption but does not
  // say which years to read it from. This model uses the LAST REPORTED YEAR,
  // not an average of the reported years, for the same reason the cheat sheet
  // uses the last actual effective tax rate: an average taken across a company
  // that has changed shape describes no year that ever existed. Nvidia is the
  // clearest case — its five-year average operating margin sits far below
  // anything the current business earns.
  const grossMargins = revenue.map((rev, i) =>
    isNum(rev) && isNum(cogs[i]) && rev !== 0 ? (rev - cogs[i]) / rev : null
  );
  const grossMargin = clamp(latest(grossMargins), 0.01, 0.95, 0.35);
  provenance.grossMargin = `${(grossMargin * 100).toFixed(
    1
  )}% — the last reported year, held flat`;

  // R&D, SG&A and other operating costs are all read from the SAME year, the
  // last reported one, because other operating costs is defined against that
  // year's lines: a line the filing leaves out that year is inside it. Taking
  // R&D from an earlier year that did report it would count that cost twice.
  // A line not reported in that year is forecast at nil, and said so, because
  // its cost is already in other operating costs.
  //
  // OTHER OPERATING COSTS, where they are a cost, are forecast at their share
  // of revenue in that year, held flat: the method every other operating cost
  // line uses (design choice D1). They are costs the company charged above
  // operating income; nothing in the filing says they will stop, and
  // forecasting them at nil would add them straight to profit (UnitedHealth's
  // are its medical costs).
  //
  // Where they are INCOME in that year (the named lines come to more than the
  // filing's operating costs), the smaller of that year's income and the
  // median across the reported years is forecast. Two causes look alike here.
  // Usually the filing's named cost tags overlap a little, every year (Procter
  // & Gamble 2.4% of revenue, Walmart 1.0%, MercadoLibre 11%), and nil would
  // count that cost twice. Sometimes it is a one-off gain: Boeing's FY2025 is
  // 10.8% of revenue on a business sale, against at most 0.8% in its other
  // years, and carried forward it turned a refused company into a value. The
  // median follows a pattern that recurs and ignores a single year; taking
  // the smaller of it and the last year never forecasts more income than the
  // company last reported.
  //
  // They are not clamped. The old 0-60% clamp on SG&A applied to SG&A and this residual
  // together, and silently dropped real cost from the forecast where the two
  // exceeded 60% of revenue (UnitedHealth 84%, Caterpillar 80%, UBS 66%), and
  // real income where they fell below nil (Boeing, MercadoLibre). A forecast
  // that then makes no operating profit is refused by the engine, not capped.
  const lastRow = rows[rows.length - 1] || {};
  const shareOfLastRevenue = (v) =>
    isNum(v) && isNum(lastRow.revenue) && lastRow.revenue !== 0 ? v / lastRow.revenue : null;
  const rndMargin = clamp(shareOfLastRevenue(lastRow.rnd), 0, 0.5, 0);
  const sgaMargin = clamp(shareOfLastRevenue(lastRow.sga), 0, 0.6, 0);
  const otherShares = rows
    .map((r, i) => (isNum(r.revenue) && r.revenue !== 0 && isNum(r.operatingIncome) ? unexplainedOperatingCosts[i] / r.revenue : null))
    .filter(isNum);
  const lastOtherShare = shareOfLastRevenue(unexplainedOperatingCosts[rows.length - 1]) ?? 0;
  const otherIsIncome = lastOtherShare < 0;
  const median = (xs) => {
    const s = [...xs].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  const otherOperatingCostsMargin = !otherIsIncome
    ? lastOtherShare
    : Math.min(0, Math.max(lastOtherShare, median(otherShares)));
  const marginText = (label, field, margin) =>
    isNum(lastRow[field])
      ? `${label} ${(margin * 100).toFixed(1)}%`
      : `${label} not reported in FY${lastRow.fiscalYear}, forecast at nil (its cost is inside other operating costs)`;
  provenance.operatingCosts =
    `${marginText('R&D', 'rnd', rndMargin)}; ${marginText('SG&A', 'sga', sgaMargin)}; ` +
    (otherIsIncome
      ? `all held flat at the last reported year; other operating costs are income in that year (${(-lastOtherShare * 100).toFixed(1)}% of revenue), ` +
        `so the smaller of that and the median across the reported years is forecast: ${(-otherOperatingCostsMargin * 100).toFixed(1)}% of revenue as income`
      : `other operating costs ${(otherOperatingCostsMargin * 100).toFixed(1)}% of revenue — the last reported year, held flat`);
  provenance.nonCashCharges =
    'the margins above are as filed; depreciation and stock compensation are taken out of them at ' +
    'the share they took in the last reported year, then charged as their own lines';

  // TAXES — the cheat sheet is explicit: apply the last actual year's effective
  // rate. Previously this averaged the first and last years, which let a year
  // with a one-off charge sit in the forecast forever. Apple FY2024 is exactly
  // that case: a European State-aid charge pushed the effective rate to 24%.
  const effectiveTaxRates = rows.map((row) =>
    isNum(row.taxExpense) && isNum(row.pretaxIncome) && row.pretaxIncome !== 0
      ? row.taxExpense / row.pretaxIncome
      : null
  );
  const taxRate = clamp(latest(effectiveTaxRates), 0, 0.5, 0.21);
  provenance.taxRate = `${(taxRate * 100).toFixed(
    1
  )}% — the last reported year's effective rate`;

  // CAPEX — "in line with historical trends as a % of sales". Capex is lumpy
  // year to year in a way margins are not, so this one stays an average: a
  // single heavy building year should not become the permanent run rate.
  const capexRatios = revenue.map((rev, i) => {
    const capex = rows[i]?.capex;
    return isNum(rev) && isNum(capex) && rev !== 0 ? capex / rev : null;
  });
  const capexRatio = clamp(mean(capexRatios), 0.001, 0.4, 0.04);
  provenance.capex = `${(capexRatio * 100).toFixed(
    1
  )}% of revenue — average of the reported years`;

  const splitYears = depreciationBasis.filter((b) => b.basis === 'filed depreciation of PP&E' || b.basis.startsWith('filed D&A less')).length;
  provenance.depreciation = isNum(filedDepreciationRate)
    ? `${(filedDepreciationRate * 100).toFixed(1)}% of capital spending — filed depreciation over capital spending, averaged over the ` +
      `${depreciationRates.filter(isNum).length} reported years that give both` +
      (splitYears === 0
        ? '. The filing does not separate depreciation from amortisation of intangibles, so all of its D&A is treated as depreciation of PP&E and none is run off'
        : splitYears < depreciationRates.filter(isNum).length
        ? `. ${splitYears} of those years separate depreciation from amortisation of intangibles; the rest treat all D&A as depreciation`
        : '')
    : 'the filing reports no depreciation, so the rate is read from the movement in the PP&E balance instead, for the years that have an opening balance';

  // DIVIDENDS — the cheat sheet says to use the historical average payout ratio
  // (common dividends / net income). This replaces a linear regression through
  // the payout history, which could trend the ratio somewhere the company has
  // never been, including above 100% of earnings.
  const payoutRatios = rows.map((row) =>
    isNum(row.dividendsPaid) && isNum(row.netIncome) && row.netIncome > 0
      ? row.dividendsPaid / row.netIncome
      : null
  );
  const payoutRatio = clamp(mean(payoutRatios), 0, 1, 0);
  provenance.dividends = rows.some((r) => isNum(r.dividendsPaid))
    ? `${(payoutRatio * 100).toFixed(1)}% of net income — average payout ratio across the reported years that report dividends`
    : 'no dividends are reported in any year, so none are forecast';

  // INTEREST — the cheat sheet computes interest as average debt x an interest
  // rate. No free source publishes the coupon on each tranche, so a flat rate
  // is applied to the average of the reported debt balances. Debt is then held
  // flat (straight-lined) rather than run down a maturity ladder we cannot see,
  // which the cheat sheet says is the safer treatment in any case.
  const debtBalances = rows.map((row) =>
    isNum(row.longTermDebt) ? row.longTermDebt : null
  );
  const averageDebt = mean(debtBalances) ?? 0;
  const interestExpense = Math.round(averageDebt * 0.045);
  provenance.interest = `average debt of ${Math.round(
    averageDebt
  ).toLocaleString()} at an assumed 4.5%`;

  const assumptions = {
    grossMargin: Array(FORECAST_YEARS).fill(grossMargin),
    researchDevelopmentMargin: Array(FORECAST_YEARS).fill(rndMargin),
    sellingGeneralAdminMargin: sgaMargin,
    otherOperatingCostsMargin: Array(FORECAST_YEARS).fill(otherOperatingCostsMargin),
    taxRate,

    segmentGrowth: { 'Total revenue': Array(FORECAST_YEARS).fill(growth) },

    // Non-recurring items are forecast as 0, per the cheat sheet.
    otherIncomeExpense: Array(FORECAST_YEARS).fill(0),

    capexRatio,
    capexMethod: 'percentOfRevenue',
    // Depreciation as a share of capital spending, averaged over the reported
    // years from FILED depreciation (see filedDepreciation above).
    // 'avgOfHistory' is the fallback for a filing that reports no D&A at all:
    // the engine then reads the balance-sheet movement for the years it can.
    depreciationAsPercentOfCapex: isNum(filedDepreciationRate)
      ? filedDepreciationRate
      : 'avgOfHistory',

    // Working capital, per the cheat sheet:
    //   receivables grow at the revenue growth rate  (constant DSO)
    //   inventory grows at the COGS growth rate      (constant turnover)
    //   payables grow at the COGS growth rate
    //   accrued expenses grow with revenue
    // Payables previously grew with revenue, which is the convention used in
    // the hand-built Apple workbook. The cheat sheet ties them to COGS, and
    // that is what the derived models now follow.
    workingCapitalDrivers: {
      accountsReceivable: 'revenue',
      inventory: 'cogs',
      accountsPayable: 'cogs',
      accruedExpenses: 'revenue',
      otherCurrentAssets: 'cogs',
      deferredTaxAssets: 'revenue',
    },
    otherAssetsHeldFlat: true,
    otherNonCurrentLiabilitiesHeldFlat: true,

    interestExpenseOnLongTermDebt: Array(FORECAST_YEARS).fill(interestExpense),
    interestExpenseFY2025: interestExpense,
    pikAccrualFY2025: 0,
    // Straight-lined: no free source publishes a maturity ladder, and the
    // cheat sheet notes that most companies refinance maturing debt anyway.
    debtRepaymentSchedule: Array(FORECAST_YEARS).fill(0),

    newShareIssuance: Array(FORECAST_YEARS).fill(0),
    // SBC as a share of operating expenses. The cheat sheet gives two formulas,
    // SBC/revenue and SBC/operating expense; the engine implements the second,
    // and both are sanctioned.
    // Not reported in the last reported year: nil, said so, not a silent zero.
    sbcAsPercentOfOperatingExpenses: isNum(lastRow.stockComp) ? 'lastHistoricalYear' : 0,

    dividendPayoutRatio: payoutRatio,
    authorisedBuybackCeiling: {
      // Null where not reported; the engine averages the years that report them.
      historical: rows.map((r) => (isNum(r.buybacks) ? r.buybacks : null)),
      forecast: Array(FORECAST_YEARS).fill('avgOfPriorFour'),
    },
    repurchasePercentOfCeiling: 'avgOfHistory',

    minimumCashDesired: isNum(rows[rows.length - 1]?.cash)
      ? Math.round(rows[rows.length - 1].cash * 0.5)
      : 0,
    interestRateOnCash: Array(FORECAST_YEARS).fill(0),

    consensusEPS: Array(FORECAST_YEARS).fill(null),
    epsGrowth: Array(FORECAST_YEARS).fill(growth),
  };

  // ------------------------------------------------------------------- DCF

  const price = fetched.quote?.price ?? null;
  const shares = isNum(rows[rows.length - 1]?.dilutedShares)
    ? rows[rows.length - 1].dilutedShares / 1e6
    : null;

  // Without a share count there is no such thing as a value per share. Dividing
  // by nothing produced an intrinsic value of infinity and a market
  // capitalisation of zero for Reliance Infrastructure, which reported no
  // diluted share figure. Refuse instead: an absent denominator is a missing
  // input, not a company worth infinity.
  if (!isNum(shares) || shares <= 0) {
    throw new Error(
      `${fetched.ticker || 'This company'} does not report a diluted share count in the ` +
        `data available, so no value per share can be calculated. The reported ` +
        `figures below are unaffected.`
    );
  }

  // lastRow, the last reported year, is declared with the operating cost margins.

  // ---- Claims on the group that are not its common shareholders' ----------
  //
  // A company that consolidates a subsidiary it only partly owns reports all of
  // that subsidiary's cash flows, so the enterprise value built from them
  // includes value that belongs to the subsidiary's other shareholders. Their
  // claim (minority, or non-controlling, interests) and the claim of preferred
  // shareholders come off before the value per common share. Both are taken at
  // the last reported balance sheet, as net debt is.
  //
  // MINORITY INTERESTS, in order:
  //   1. the filing's own minority-interest balance, plus any redeemable
  //      minority interests it carries outside equity;
  //   2. equity including minority interests less shareholders' equity, where
  //      the filing reports both and they differ;
  //   3. total assets less total liabilities less shareholders' equity, where
  //      all three are FILED (a total liabilities figure this file derived as
  //      assets less equity has the minority interests inside it, so says
  //      nothing about them). On an SEC filing this also picks up redeemable
  //      preferred and other temporary equity, which is also not the common
  //      shareholders'.
  // Where none of those can be read but the filing shows a minority share of
  // net income, minority interests exist and their amount is not known: the
  // model is refused rather than treating them as nil. Where nothing in the
  // filing points to any, there are none, and provenance says so.
  //
  // PREFERRED STOCK: the filing's preferred-stock carrying value. Where the
  // filing says its diluted share count already includes the common shares the
  // preferred converts into, the preferred holders are in the denominator and
  // nothing comes off value (it would count them twice). Where no balance is
  // tagged, nothing converts, and the filing pays preferred dividends, the
  // model is refused.
  const claimsYear = lastRow.fiscalYear;
  const minorityEvidence = isNum(lastRow.netIncomeToMinority) && lastRow.netIncomeToMinority !== 0;
  const taggedMinority = [lastRow.minorityInterest, lastRow.redeemableMinorityInterest].filter(isNum);
  let minorityInterest = null;
  let minoritySource = null;
  if (taggedMinority.length) {
    minorityInterest = taggedMinority.reduce((a, b) => a + b, 0);
    minoritySource = isNum(lastRow.redeemableMinorityInterest)
      ? isNum(lastRow.minorityInterest)
        ? 'the filing\'s minority interests plus its redeemable minority interests'
        : 'the filing\'s redeemable minority interests'
      : 'the filing\'s minority interests';
  } else if (
    isNum(lastRow.equityIncludingMinority) &&
    isNum(lastRow.equity) &&
    lastRow.equityIncludingMinority !== lastRow.equity
  ) {
    minorityInterest = lastRow.equityIncludingMinority - lastRow.equity;
    minoritySource = "equity including minority interests less shareholders' equity, as filed";
  } else if (
    isNum(lastRow.totalAssets) &&
    isNum(lastRow.totalLiabilities) &&
    isNum(lastRow.equity) &&
    // Equity reported only as the figure that includes minority interests
    // hides them from this identity; with a minority share of income on
    // file, it cannot be used.
    !(isNum(lastRow.equityIncludingMinority) && lastRow.equityIncludingMinority === lastRow.equity && minorityEvidence)
  ) {
    const gap = lastRow.totalAssets - lastRow.totalLiabilities - lastRow.equity;
    const tolerance = Math.abs(lastRow.totalAssets) * 0.001;
    if (gap >= -tolerance) {
      minorityInterest = Math.abs(gap) <= tolerance ? 0 : gap;
      minoritySource =
        minorityInterest === 0
          ? "none: total assets equal total liabilities plus shareholders' equity, as filed"
          : "total assets less total liabilities less shareholders' equity, as filed";
    }
  }
  if (minorityInterest === null && !minorityEvidence) {
    minorityInterest = 0;
    minoritySource = 'none: the filing reports no minority interests and no minority share of income';
  }

  let preferredStock = null;
  let preferredSource = null;
  if (isNum(lastRow.preferredConversionShares) && lastRow.preferredConversionShares > 0) {
    preferredStock = 0;
    preferredSource =
      'convertible preferred stock, already counted in the diluted share count as the common shares it converts into';
  } else if (isNum(lastRow.preferredStock)) {
    preferredStock = lastRow.preferredStock;
    preferredSource = "the filing's preferred stock";
  } else if (isNum(lastRow.preferredDividends) && lastRow.preferredDividends !== 0) {
    preferredStock = null;
  } else {
    preferredStock = 0;
    preferredSource = 'none: the filing reports no preferred stock and no preferred dividends';
  }

  const unknownClaims = [
    minorityInterest === null
      ? `a minority share of net income (${lastRow.netIncomeToMinority.toLocaleString('en-US', { maximumFractionDigits: 0 })}) but no minority-interest balance that can be read`
      : null,
    preferredStock === null
      ? `preferred dividends (${lastRow.preferredDividends.toLocaleString('en-US', { maximumFractionDigits: 0 })}) but no preferred-stock balance`
      : null,
  ].filter(Boolean);
  const otherClaimsRefusal = unknownClaims.length
    ? {
        code: 'nonCommonClaimNotReported',
        message:
          `For FY${claimsYear} the filing reports ${unknownClaims.join(', and ')}. Part of the enterprise value ` +
          'belongs to those holders and not to the common shareholders, and without the amount it cannot be ' +
          'taken off, so no value is shown rather than treating it as nil. The reported figures below are unaffected.',
      }
    : null;
  provenance.equityBridge =
    `minority interests ${isNum(minorityInterest) ? minorityInterest.toLocaleString('en-US', { maximumFractionDigits: 0 }) : 'not reported'} ` +
    `(${minoritySource ?? 'amount not in the filing'}) and preferred stock ${isNum(preferredStock) ? preferredStock.toLocaleString('en-US', { maximumFractionDigits: 0 }) : 'not reported'} ` +
    `(${preferredSource ?? 'amount not in the filing'}), FY${claimsYear}, taken off enterprise value with net debt`;

  const lastSecurities = shortTermSecurities[shortTermSecurities.length - 1];
  const lastLongTermSecurities = isNum(lastRow.longTermInvestments) ? lastRow.longTermInvestments : null;
  provenance.netDebt =
    `long-term debt ${isNum(lastRow.longTermDebt) ? lastRow.longTermDebt.toLocaleString('en-US', { maximumFractionDigits: 0 }) : 'not reported'} ` +
    `less cash ${isNum(lastRow.cash) ? lastRow.cash.toLocaleString('en-US', { maximumFractionDigits: 0 }) : 'not reported'} and ` +
    (isNum(lastSecurities)
      ? `short-term marketable securities ${lastSecurities.toLocaleString('en-US', { maximumFractionDigits: 0 })}, as filed`
      : securitiesNotSplitYears.includes(claimsYear)
        ? 'no securities: the filing reports marketable securities but not how much of them is short-term, so none is counted'
        : 'no short-term marketable securities: the filing reports none') +
    (isNum(lastLongTermSecurities) && lastLongTermSecurities > 0
      ? `. Long-term investments of ${lastLongTermSecurities.toLocaleString('en-US', { maximumFractionDigits: 0 })} are reported but not netted off`
      : '') +
    `, FY${claimsYear}`;

  const dcf = {
    sharePrice: price,
    sharePriceDate: (fetched.fetchedAt || new Date().toISOString()).slice(0, 10),
    basicSharesCount: shares,
    dilutedSharesCount: shares,

    // Cash and the short-term securities held with it, as the balance sheet
    // line does. Long-term securities are NOT netted off: they are reported
    // (`longTermSecurities` below) but a holding the company has placed out of
    // reach for a year or more is not money it can pay a lender with tomorrow,
    // and some of what sits there is not marketable at all (Alphabet's
    // non-marketable equity stakes are tagged in the same place).
    netDebt: {
      cashAndSecurities: isNum(cashAndSecurities[cashAndSecurities.length - 1])
        ? -cashAndSecurities[cashAndSecurities.length - 1]
        : 0,
      longTermDebt: isNum(lastRow.longTermDebt) ? lastRow.longTermDebt : 0,
    },
    // Taken off enterprise value with net debt (see above). Null where the
    // filing shows the claim exists but not its amount; the engine then refuses.
    minorityInterest,
    preferredStock,
    // Reported beside net debt, never inside it (see netDebt above).
    longTermSecurities: lastLongTermSecurities,

    longTermGrowthRate: 0.025,
    exitEbitdaMultiple: 12,

    terminalCapexTreatment: 'capexEqualsDepreciation',
    terminalExclusions: ['deferredTaxAssets', 'otherNonCurrentLiabilities'],

    costOfCapital: {
      riskFreeRate: 0.045,
      marketRiskPremium: 0.0423,
      equityBeta: 1.0,
      betaSource: 'equityBeta',
      comparables: [],
    },

    sensitivity: {
      waccSteps: [-0.01, -0.005, 0, 0.005, 0.01],
      growthSteps: [-0.01, -0.005, 0, 0.005, 0.01],
      multipleSteps: [-1.0, -0.5, 0, 0.5, 1.0],
    },
  };

  provenance.terminalGrowth = '2.5% — a flat default, not company-specific';
  provenance.wacc = 'CAPM with a beta of 1.0 — no comparable set is derived';
  provenance.segments =
    'single combined revenue line — segment detail is not machine-readable from free sources';

  const { refusal: listingRefusal, basis: currencyBasis } = listingComparability(fetched);
  provenance.currency = currencyBasis.reportingCurrency
    ? `statements in ${currencyBasis.reportingCurrency} (${currencyBasis.reportingCurrencySource})` +
      (currencyBasis.priceConverted
        ? `; price quoted in ${currencyBasis.quotedCurrency}, converted at ${Number(currencyBasis.rate.toPrecision(6))} ${currencyBasis.reportingCurrency} per ${currencyBasis.quotedCurrency}` +
          `${currencyBasis.pair ? ` (${currencyBasis.pair}${currencyBasis.rateAsOf ? `, ${currencyBasis.rateAsOf.slice(0, 10)}` : ''})` : ''}`
        : currencyBasis.quotedCurrency
        ? `; price quoted in ${currencyBasis.quotedCurrency}`
        : '') +
      (currencyBasis.shareBasis ? `; share count: ${currencyBasis.shareBasis}` : '')
    : 'reporting currency not stated by the source';

  return {
    meta: {
      name: fetched.name || fetched.ticker,
      ticker: fetched.ticker,
      currency: fetched.currency || 'USD',
      unitLabel: `${fetched.currencySymbol || '$'} millions`,
      historicalYears: years,
      forecastYears,
      latestFiscalYearEnd: `${lastYear}-12-31`,
      forecastYearEndDates: forecastYears.map((y) => `${y}-12-31`),
      daysInYear: 365,
      circuitBreaker: 'ON',
      sicCode: fetched.sicCode ? Number(fetched.sicCode) : null,
      sector: fetched.sector || fetched.sicDescription || null,
      // Marks this as derived rather than hand-built, so the dashboard can
      // label it honestly against a curated model like Apple's.
      derived: true,
      // Every balance sheet line the filing did not report, by year, with how
      // (if at all) it was derived. The engine names these when it refuses.
      balanceSheetGaps,
      forecastInputGaps,
      // Income statement lines the filing does not report, by year. The engine
      // refuses a model whose reported income statement cannot be the filed one.
      incomeStatementGaps,
      // Lines shown as not reported rather than nil, by year, with what is done
      // wherever arithmetic needs them (NOT_REPORTED above).
      notReported,
      // Which figure each year's depreciation came from, and the rate built
      // from them (filedDepreciation above).
      depreciationBasis,
      filedDepreciationRate: isNum(filedDepreciationRate) ? filedDepreciationRate : null,
      // Minority interests and preferred stock, where each was read from, and
      // the refusal where the filing shows one exists but not its amount.
      otherClaims: { minorityInterest, minoritySource, preferredStock, preferredSource, year: claimsYear },
      otherClaimsRefusal,
      // Marketable securities: what was netted off with cash, what was only
      // reported, and the years where the filing shows securities but never
      // says how much of them is short-term.
      securities: {
        shortTerm: shortTermSecurities[shortTermSecurities.length - 1] ?? null,
        longTerm: lastLongTermSecurities,
        notSplitYears: securitiesNotSplitYears,
      },
      source: fetched.source,
      sourceUrl: fetched.sourceUrl,
      // Whether the price, the share count and the statements describe the same
      // security in the same currency (listingComparability above). A refusal
      // here withholds every valuation.
      currencyBasis,
      listingRefusal,
    },
    historical,
    assumptions,
    dcf,
    provenance,
  };
}

export default deriveModel;