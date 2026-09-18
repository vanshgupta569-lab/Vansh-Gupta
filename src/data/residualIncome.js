// FILE: src/data/residualIncome.js
//
// Marginalia — residual income model, for banks and other financial companies
//
// WHY A SECOND MODEL EXISTS AT ALL
//
// The discounted cash flow values a business through unlevered free cash flow:
// the cash left after the business has paid its costs and its upkeep, measured
// before interest, so the question stays about the business rather than how it
// is financed. That framing breaks completely for a bank. Borrowing is not how
// a bank finances itself, it is the raw material it sells. Capital expenditure
// and working capital barely exist. Unlevered free cash flow is not a small
// figure for a bank, it is a meaningless one.
//
// So the engine refuses, correctly. This is the different method it refuses in
// favour of.
//
// HOW RESIDUAL INCOME WORKS, in one paragraph
//
// A bank starts with a book value of equity. Shareholders require a return on
// that equity: the cost of equity. If the bank earns exactly that, it has
// created nothing beyond the book value already on its balance sheet, and the
// shares are worth book value. Anything it earns ABOVE the required return is
// residual income, and the present value of that stream is what the shares are
// worth over and above book. So:
//
//     equity value = opening book value
//                  + the present value of each year's residual income
//                  + the present value of everything after the forecast
//
//     residual income = net income − (cost of equity × opening book value)
//
// Both on the common shareholders' basis: book value after preferred stock,
// net income after preferred dividends.
//
// This is a standard technique, not an invention: it is the method used for
// financial institutions precisely because it works from book equity and
// earnings, which banks report, rather than from free cash flow, which they do
// not meaningfully have.
//
// WHAT DRIVES THE FORECAST
//
//     return on equity     from reported history
//     payout ratio         from reported history
//     book value rolls     opening book + earnings retained after dividends
//     cost of equity       CAPM, the same risk free rate, market risk premium
//                          and beta the discounted cash flow uses
//
// LIMITS, stated on screen as well as here:
//   - it assumes reported book equity is roughly right. For a bank that means
//     trusting the loan loss provisioning, and provisioning is exactly where a
//     bank in trouble flatters itself. A residual income valuation of a bank
//     with understated provisions will be too high, and no model built on the
//     filed numbers can see that
//   - it says nothing about capital adequacy, which is often the binding
//     constraint on whether a bank can grow at all
//   - regulated dividend limits are not modelled

const isNum = (v) => typeof v === 'number' && isFinite(v);

const clamp = (v, low, high, fallback) => {
  if (!isNum(v)) return fallback;
  return Math.min(high, Math.max(low, v));
};

const mean = (values) => {
  const clean = values.filter(isNum);
  if (!clean.length) return null;
  return clean.reduce((a, b) => a + b, 0) / clean.length;
};

/**
 * Is this a company the residual income model is for?
 * Mirrors the engine's own test so the two never disagree about who is a bank.
 */
export function isFinancialCompany(fetched) {
  const sic = fetched?.sicCode != null ? Number(fetched.sicCode) : null;
  const sicIsFinancial = sic != null && sic >= 6000 && sic <= 6799;
  const sector = String(fetched?.sector || fetched?.sicDescription || '');
  const sectorIsFinancial = /financ|bank|insur|capital market|credit/i.test(sector);
  return sicIsFinancial || sectorIsFinancial;
}

const fmt = (v) => v.toLocaleString('en-US', { maximumFractionDigits: 0 });

/**
 * The preferred holders' claim, per reported year: the balance to take out of
 * book equity and the dividends to take out of net income, or why it cannot be
 * read. The same reading as the discounted cash flow's equity bridge, per year.
 */
function preferredClaims(rows) {
  const last = rows[rows.length - 1];
  const converts = isNum(last?.preferredConversionShares) && last.preferredConversionShares > 0;
  return rows.map((r) => {
    if (converts) {
      return {
        balance: 0,
        dividends: 0,
        source:
          'Preferred stock converts and is already in the diluted share count as the common shares it becomes, so it stays in book equity',
      };
    }
    const balance = isNum(r.preferredStock) ? r.preferredStock : null;
    const dividends = isNum(r.preferredDividends) ? Math.abs(r.preferredDividends) : null;
    if (!(balance > 0) && !(dividends > 0)) {
      return {
        balance: 0,
        dividends: 0,
        source: 'The filing reports no preferred stock and no preferred dividends',
      };
    }
    // A preferred balance filed as nil beside preferred dividends is the par
    // value, not the claim (American Express: nil, and 58 paid).
    if (!(balance > 0)) {
      return {
        balance: null,
        dividends: null,
        unreadable: `preferred dividends (${fmt(dividends)}) but no preferred-stock balance`,
      };
    }
    if (dividends === null) {
      return {
        balance: null,
        dividends: null,
        unreadable: `preferred stock (${fmt(balance)}) but no preferred dividends`,
      };
    }
    return {
      balance,
      dividends,
      source:
        `Preferred stock ${fmt(balance)} taken out of book equity and preferred dividends ${fmt(dividends)} ` +
        `out of net income, FY${r.fiscalYear}, as filed`,
    };
  });
}

/**
 * Build a residual income valuation from fetched statements.
 *
 * `options` carries the cost of equity inputs so the two models use the same
 * risk free rate and market risk premium rather than drifting apart.
 */
export function buildResidualIncome(fetched, options = {}) {
  const rows = Array.isArray(fetched?.statements) ? fetched.statements : [];
  if (rows.length < 2) {
    return { applicable: false, message: 'Not enough reported history to build a model.' };
  }

  const forecastYears = Number(options.forecastYears) || 5;
  const riskFreeRate = isNum(options.riskFreeRate) ? options.riskFreeRate : 0.045;
  const marketRiskPremium = isNum(options.marketRiskPremium) ? options.marketRiskPremium : 0.05;
  const beta = isNum(options.beta) ? options.beta : 1.1;
  const costOfEquity = riskFreeRate + beta * marketRiskPremium;

  const last = rows[rows.length - 1];

  // Book equity. Taken as total assets less total liabilities rather than the
  // reported equity line, for the same reason the DCF does: some sources report
  // equity excluding minority interests, which leaves the balance sheet out.
  //
  // What is valued is the common shares, so preferred stock comes out of book
  // equity, its dividends out of net income, and out of the dividends paid,
  // year by year: the preferred holders' claim stays theirs, and returns are
  // measured on the common equity that earns them. Preferred stock that
  // converts, and is already in the diluted share count as the common shares
  // it becomes, stays in, as in the discounted cash flow's equity bridge.
  const claims = preferredClaims(rows);
  const bookValue = rows.map((r, i) =>
    isNum(r.totalAssets) && isNum(r.totalLiabilities) && isNum(claims[i].balance)
      ? r.totalAssets - r.totalLiabilities - claims[i].balance
      : null
  );
  const incomeToCommon = rows.map((r, i) =>
    isNum(r.netIncome) && isNum(claims[i].dividends) ? r.netIncome - claims[i].dividends : null
  );
  const commonDividends = rows.map((r, i) => {
    if (isNum(r.commonDividendsPaid)) return r.commonDividendsPaid;
    if (!isNum(r.dividendsPaid) || !isNum(claims[i].dividends)) return null;
    // Without the common figure, dividends paid is the total the filing tags
    // (Citigroup, JPMorgan, Bank of America), preferred dividends included.
    const common = Math.abs(r.dividendsPaid) - claims[i].dividends;
    return common >= 0 ? common : null;
  });

  // The forecast starts from the last year's book and the last year's return
  // on the year before's, so a preferred claim that cannot be read in either
  // year leaves nothing to start from. Refused, not treated as nil.
  const unread = rows
    .map((r, i) => ({ r, c: claims[i] }))
    .slice(-2)
    .filter(({ c }) => c.unreadable);
  if (unread.length) {
    return {
      applicable: false,
      message:
        unread
          .map(({ r, c }) => `For FY${r.fiscalYear} the filing reports ${c.unreadable}.`)
          .join(' ') +
        ' Book equity and earnings include what belongs to the preferred holders, and without both ' +
        "figures the common shareholders' share cannot be separated, so no value is shown rather " +
        'than treating it as nil. The reported figures below are unaffected.',
    };
  }
  const openingBook = bookValue[bookValue.length - 1];
  if (!isNum(openingBook) || openingBook <= 0) {
    return {
      applicable: false,
      message:
        'Book equity could not be read from the filings, and a residual income model is ' +
        'built on book equity. No value per share is shown.',
    };
  }

  // Return on equity, per year, on OPENING book value, which is the basis the
  // residual income formula uses.
  const roeByYear = rows.map((r, i) => {
    const opening = i === 0 ? null : bookValue[i - 1];
    return isNum(incomeToCommon[i]) && isNum(opening) && opening > 0 ? incomeToCommon[i] / opening : null;
  });

  // The forecast return on equity: the last reported year, for the same reason
  // the discounted cash flow takes margins from the last reported year. An
  // average across a bank that has recovered from a bad year describes neither
  // the bad year nor the recovery.
  const latestRoe = [...roeByYear].reverse().find(isNum) ?? null;
  const roe = clamp(latestRoe, -0.5, 0.6, 0.12);

  // Payout ratio, averaged, because dividends are lumpy and a single year is
  // a poor guide.
  const payoutByYear = rows.map((r, i) =>
    isNum(commonDividends[i]) && isNum(incomeToCommon[i]) && incomeToCommon[i] > 0
      ? commonDividends[i] / incomeToCommon[i]
      : null
  );
  const payout = clamp(mean(payoutByYear), 0, 0.95, 0.2);

  // Growth after the forecast. Kept modest and never allowed to reach the cost
  // of equity, which would make the terminal value diverge.
  const terminalGrowth = clamp(
    isNum(options.terminalGrowth) ? options.terminalGrowth : 0.03,
    0,
    Math.max(0, costOfEquity - 0.01),
    0.03
  );

  const shares = isNum(last?.dilutedShares) ? last.dilutedShares / 1e6 : null;
  if (!isNum(shares) || shares <= 0) {
    return {
      applicable: false,
      message:
        'No diluted share count is reported, so no value per share can be calculated.',
    };
  }

  // ---- the forecast ------------------------------------------------------
  const years = [];
  let opening = openingBook;
  let pvResidual = 0;
  let lastResidual = 0;

  const startYear = Number(last.fiscalYear) || new Date().getFullYear();

  for (let t = 1; t <= forecastYears; t++) {
    const netIncome = opening * roe;
    const requiredReturn = opening * costOfEquity;
    const residual = netIncome - requiredReturn;
    const dividends = netIncome * payout;
    const closing = opening + netIncome - dividends;
    const discountFactor = 1 / Math.pow(1 + costOfEquity, t);

    years.push({
      year: startYear + t,
      openingBook: opening,
      netIncome,
      roe,
      requiredReturn,
      residualIncome: residual,
      dividends,
      closingBook: closing,
      discountFactor,
      presentValue: residual * discountFactor,
    });

    pvResidual += residual * discountFactor;
    lastResidual = residual;
    opening = closing;
  }

  // Terminal value: the final year's residual income continuing, growing at the
  // terminal rate, discounted back.
  const terminalValue =
    costOfEquity > terminalGrowth
      ? (lastResidual * (1 + terminalGrowth)) / (costOfEquity - terminalGrowth)
      : null;
  const pvTerminal = isNum(terminalValue)
    ? terminalValue / Math.pow(1 + costOfEquity, forecastYears)
    : null;

  if (!isNum(pvTerminal)) {
    return {
      applicable: false,
      message:
        'The growth assumed after the forecast is at or above the cost of equity, which ' +
        'makes the valuation diverge. No value is shown.',
    };
  }

  const equityValue = openingBook + pvResidual + pvTerminal;
  const valuePerShare = equityValue / shares;

  if (!isNum(valuePerShare) || valuePerShare <= 0) {
    return {
      applicable: false,
      message:
        'This model does not produce a usable value per share for this company. The ' +
        'reported figures below are unaffected.',
    };
  }

  const bookPerShare = openingBook / shares;

  return {
    applicable: true,
    method: 'residualIncome',
    costOfEquity,
    riskFreeRate,
    marketRiskPremium,
    beta,
    roe,
    payout,
    terminalGrowth,
    openingBook,
    bookPerShare,
    pvResidual,
    terminalValue,
    pvTerminal,
    equityValue,
    shares,
    valuePerShare,
    // Above one means the market, or the model, judges the bank able to earn
    // more than its cost of equity. Below one means the opposite.
    impliedPriceToBook: valuePerShare / bookPerShare,
    years,
    history: rows.map((r, i) => ({
      year: r.fiscalYear,
      netIncome: incomeToCommon[i],
      bookValue: bookValue[i],
      roe: roeByYear[i],
      payout: payoutByYear[i],
    })),
    provenance: {
      roe: `${(roe * 100).toFixed(1)}% — the last reported year's return on opening book equity`,
      payout: `${(payout * 100).toFixed(1)}% of earnings — average payout across the reported years`,
      costOfEquity: `${(costOfEquity * 100).toFixed(2)}% — risk free ${(riskFreeRate * 100).toFixed(
        2
      )}% plus beta ${beta.toFixed(2)} times a ${(marketRiskPremium * 100).toFixed(2)}% market risk premium`,
      terminalGrowth: `${(terminalGrowth * 100).toFixed(1)}% — a flat default, not company specific`,
      preferred: claims[claims.length - 1].source,
    },
  };
}

export default { isFinancialCompany, buildResidualIncome };