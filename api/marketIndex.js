// FILE: api/marketIndex.js
// Marginalia — the index a beta is measured against
//
// The company page calls:  /api/marketIndex?symbol=^GSPC
// This returns:            { symbol, name, currency, dates[], closes[], ... }
//
// WHY A ROUTE AND NOT A FIELD ON THE PAYLOAD. An index is not company data. One
// index serves every company listed on that market, so putting its series in
// each company's payload would store the S&P 500 seventy-six times, grow every
// payload, and make a change to the sampling a refetch of the whole set. As its
// own address it is fetched once per market and cached, and `/api/company` does
// not change at all.
//
// ONLY THE INDICES THIS SITE USES. `?symbol=` is checked against the list
// below, so the route cannot be pointed at an arbitrary instrument by anybody
// who finds it. The list is the one in `src/data/marketIndex.ts`, duplicated
// because each file in this directory is packaged on its own by the host and a
// shared import that fails to bundle takes the route down — the same reason
// `FETCHER_VERSION` is duplicated in `api/company.js`. `npm run verify` asserts
// the two lists are identical, which is the only thing that keeps a second copy
// honest.
//
// WHAT IT RETURNS, AND WHY IT IS THE DAILY SERIES. Monthly and weekly closes
// are what a beta is regressed on, but the SAMPLING has to be identical on both
// sides of the regression or the pairs are wrong, and the company's own series
// arrives here as daily closes. So this returns daily closes and
// `src/data/marketIndex.ts` samples both series with one function.
//
// VENDOR DATA, DEVELOPMENT ONLY. Index levels are licensed for display just as
// share prices are (`docs/COST_OF_CAPITAL_SPEC.md` rule 6 — **Paid · last**).
// Nothing here is stored or redistributed; the series is fetched on demand and
// the terms it comes under travel with it so the screen can say so.

import { guardRequest, noStore, logAndHide } from './_guard.js';

// symbol -> name, so the answer carries what to call it rather than the caller
// having to know. Must equal INDICES in src/data/marketIndex.ts.
const INDEX_NAMES = {
  '^GSPC': 'S&P 500',
  '^CRSLDX': 'Nifty 500',
  '^FTAS': 'FTSE All-Share',
  '^N225': 'Nikkei 225',
  '^KS11': 'KOSPI',
  '^GDAXI': 'DAX',
  '^GSPTSE': 'S&P/TSX Composite',
  '^AXJO': 'S&P/ASX 200',
  '^HSI': 'Hang Seng',
  '^FCHI': 'CAC 40',
  '^AEX': 'AEX',
  'FTSEMIB.MI': 'FTSE MIB',
  '^IBEX': 'IBEX 35',
  '^SSMI': 'SMI',
  '^OMX': 'OMX Stockholm 30',
  '^OMXC25': 'OMX Copenhagen 25',
  '^BVSP': 'Ibovespa',
  '^TWII': 'TAIEX',
  '^TA125.TA': 'TA-125',
  '^J203.JO': 'FTSE/JSE All Share',
  '^STI': 'Straits Times',
};

const TERMS =
  'Index levels from Yahoo Finance, free for development use and licensed before launch ' +
  '(Paid · last). Not redistributed.';

/**
 * Ten years of daily closes, with every gap dropped.
 *
 * A null in a close series is not a level of nothing — it is a day the index
 * was not published — so the day is dropped rather than interpolated, exactly
 * as `api/company.js` does for a share price. Dropping it is also what makes
 * the month-end sampling safe: the last close OF THE MONTH is the last one
 * that exists, not the one nearest the 31st.
 */
function seriesFrom(result) {
  const stamps = Array.isArray(result?.timestamp) ? result.timestamp : [];
  const closes = result?.indicators?.quote?.[0]?.close || [];
  const dates = [];
  const values = [];
  for (let i = 0; i < stamps.length; i++) {
    const close = closes[i];
    if (typeof close !== 'number' || !isFinite(close)) continue;
    if (typeof stamps[i] !== 'number') continue;
    dates.push(new Date(stamps[i] * 1000).toISOString().slice(0, 10));
    // Six significant figures, as the share price series uses: an index level
    // runs to five digits before the point and a beta is computed from ratios.
    values.push(Number(close.toPrecision(6)));
  }
  return { dates, closes: values };
}

export default async function handler(req, res) {
  if (!guardRequest(req, res)) return;

  const asked = String(req.query.symbol || '').trim();
  if (!asked || !Object.prototype.hasOwnProperty.call(INDEX_NAMES, asked)) {
    noStore(res);
    res.status(400).json({
      error:
        'Provide one of the indices this site measures beta against, for example ?symbol=^GSPC. ' +
        'No other instrument is served here.',
    });
    return;
  }

  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(asked)}` +
        '?range=10y&interval=1d',
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Marginalia/1.0)' } }
    );
    if (!response.ok) {
      noStore(res);
      res.status(502).json({
        error: `The index series for ${asked} could not be read (HTTP ${response.status}).`,
      });
      return;
    }
    const result = (await response.json())?.chart?.result?.[0];
    const meta = result?.meta;
    const series = seriesFrom(result);
    if (!series.dates.length) {
      noStore(res);
      res.status(502).json({ error: `The index series for ${asked} came back empty.` });
      return;
    }

    // An index level moves once a day, so a long cache is honest and it means
    // one fetch serves every company on that market.
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=21600');
    res.status(200).json({
      symbol: asked,
      name: INDEX_NAMES[asked],
      currency: meta?.currency || null,
      source: 'Yahoo Finance (chart)',
      terms: TERMS,
      from: series.dates[0],
      to: series.dates[series.dates.length - 1],
      asOf: meta?.regularMarketTime
        ? new Date(meta.regularMarketTime * 1000).toISOString()
        : new Date().toISOString(),
      dates: series.dates,
      closes: series.closes,
    });
  } catch (error) {
    logAndHide('marketIndex', error, asked);
    noStore(res);
    res.status(502).json({ error: `The index series for ${asked} could not be read.` });
  }
}
