// FILE: api/search.js
// Marginalia — company name search
//
// Powers the type-ahead on the directory screen. The user types letters, this
// returns matching companies with their tickers, so nobody has to know that
// Reliance is RELIANCE.NS or that Berkshire is BRK-B.
//
//   /api/search?q=reli  ->  { results: [ { ticker, name, exchange, type } ] }
//
// Yahoo's search endpoint covers every exchange globally and needs no key.

import { guardRequest, readSearchQuery, noStore, logAndHide } from './_guard.js';

const MAX_RESULTS = 8;

export default async function handler(req, res) {
  if (!guardRequest(req, res)) return;

  // Anything the box cannot legitimately contain is stripped before the value
  // is ever put into a URL. Too short after cleaning means no suggestions.
  const query = readSearchQuery(req.query.q);

  if (!query) {
    res.setHeader('Cache-Control', 'public, s-maxage=86400');
    res.status(200).json({ results: [] });
    return;
  }

  try {
    const response = await fetch(
      `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
        query
      )}&quotesCount=${MAX_RESULTS}&newsCount=0&listsCount=0`,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36',
        },
      }
    );

    if (!response.ok) throw new Error(`search unavailable (${response.status})`);

    const body = await response.json();

    // Keep equities only. Funds, indices, currencies and futures cannot be
    // modelled with a 3-statement DCF, so offering them would only lead the
    // user into a dead end.
    const results = (body.quotes || [])
      .filter((q) => q.quoteType === 'EQUITY' && q.symbol)
      .slice(0, MAX_RESULTS)
      .map((q) => ({
        ticker: q.symbol,
        name: q.longname || q.shortname || q.symbol,
        exchange: q.exchDisp || q.exchange || '',
      }));

    res.setHeader(
      'Cache-Control',
      'public, s-maxage=86400, stale-while-revalidate=604800'
    );
    res.status(200).json({ results });
  } catch (error) {
    // A failed lookup must not block the user — they can still type the exact
    // ticker and press enter. The reason goes to the Vercel log rather than
    // back to the caller, so a failure never describes our internals.
    logAndHide('search', error, `q="${query}"`);
    noStore(res);
    res.status(200).json({ results: [] });
  }
}