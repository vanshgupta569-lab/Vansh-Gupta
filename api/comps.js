// FILE: api/comps.js
//
// Marginalia — comparable companies
//
// Every real valuation gets cross-checked. A discounted cash flow says what a
// business is worth on its own cash; a set of comparable companies says what
// the market is currently paying for businesses like it. When the two disagree
// sharply, that disagreement is the finding.
//
// WHAT THIS DOES
//   1. asks Yahoo which companies it associates with this one
//   2. pulls each peer's market capitalisation, enterprise value, revenue and
//      EBITDA
//   3. works out EV/EBITDA, EV/Sales and P/E for each, and the MEDIAN of each
//
// The median rather than the mean, deliberately: one peer trading at 90x drags
// a mean somewhere no company in the set actually sits.
//
// HONEST LIMITS, and these are stated on screen rather than buried here:
//   - the peer set is Yahoo's association, not a considered choice by an
//     analyst. It is a starting point, not a comp set someone would sign off
//   - trailing figures, not forward. Analysts usually compare forward
//     multiples; forward estimates are not available from a free source
//   - a peer with no EBITDA, or negative EBITDA, is dropped from that column
//     rather than shown as a meaningless number

let yahooAuth = null;

async function getYahooAuth() {
  if (yahooAuth) return yahooAuth;

  const browserHeaders = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  };

  const cookieRes = await fetch('https://fc.yahoo.com', {
    headers: browserHeaders,
    redirect: 'follow',
  });
  const rawCookie = cookieRes.headers.get('set-cookie');
  if (!rawCookie) throw new Error('Yahoo did not issue a session cookie');

  const cookie = rawCookie
    .split(',')
    .map((part) => part.split(';')[0].trim())
    .filter(Boolean)
    .join('; ');

  const crumbRes = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
    headers: { ...browserHeaders, Cookie: cookie },
  });
  const crumb = (await crumbRes.text()).trim();
  if (!crumb || crumb.length > 20 || crumb.includes('<')) {
    throw new Error('Yahoo did not issue a crumb token');
  }

  yahooAuth = { cookie, crumb, browserHeaders };
  return yahooAuth;
}

const num = (v) => {
  if (typeof v === 'number' && isFinite(v)) return v;
  if (v && typeof v.raw === 'number' && isFinite(v.raw)) return v.raw;
  return null;
};

/** Which companies Yahoo associates with this one. */
async function fetchPeers(symbol, auth) {
  try {
    const res = await fetch(
      `https://query2.finance.yahoo.com/v6/finance/recommendationsbysymbol/${encodeURIComponent(
        symbol
      )}?crumb=${encodeURIComponent(auth.crumb)}`,
      { headers: { ...auth.browserHeaders, Cookie: auth.cookie } }
    );
    if (!res.ok) return [];
    const body = await res.json();
    const list = body?.finance?.result?.[0]?.recommendedSymbols || [];
    return list
      .map((entry) => entry?.symbol)
      .filter((s) => typeof s === 'string' && s && s !== symbol)
      .slice(0, 15);
  } catch {
    return [];
  }
}

/** The figures needed to compute a multiple, plus what business it is in. */
async function fetchFundamentals(symbol, auth) {
  try {
    const res = await fetch(
      `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
        symbol
      )}?modules=price%2CdefaultKeyStatistics%2CfinancialData%2CsummaryDetail%2CassetProfile&crumb=${encodeURIComponent(
        auth.crumb
      )}`,
      { headers: { ...auth.browserHeaders, Cookie: auth.cookie } }
    );
    if (!res.ok) return null;

    const body = await res.json();
    const r = body?.quoteSummary?.result?.[0];
    if (!r) return null;

    const price = r.price || {};
    const stats = r.defaultKeyStatistics || {};
    const fin = r.financialData || {};
    const summary = r.summaryDetail || {};
    const profile = r.assetProfile || {};

    const marketCap = num(price.marketCap) ?? num(summary.marketCap);
    const enterpriseValue = num(stats.enterpriseValue);
    const revenue = num(fin.totalRevenue);
    const ebitda = num(fin.ebitda);
    const trailingPE = num(summary.trailingPE);

    const evToEbitda =
      enterpriseValue !== null && ebitda !== null && ebitda > 0
        ? enterpriseValue / ebitda
        : null;
    const evToSales =
      enterpriseValue !== null && revenue !== null && revenue > 0
        ? enterpriseValue / revenue
        : null;

    return {
      symbol,
      name: price.longName || price.shortName || symbol,
      currency: price.currency || null,
      sector: profile.sector || null,
      industry: profile.industry || null,
      marketCap,
      enterpriseValue,
      revenue,
      ebitda,
      evToEbitda: evToEbitda === null ? null : Number(evToEbitda.toFixed(2)),
      evToSales: evToSales === null ? null : Number(evToSales.toFixed(2)),
      priceToEarnings: trailingPE === null ? null : Number(trailingPE.toFixed(2)),
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// CHOOSING THE PEERS
// ---------------------------------------------------------------------------
// The data source's "recommended symbols" list is really a people-also-viewed
// list, and for an Indian conglomerate it returned TCS, three banks and L&T:
// the largest companies on the exchange, not companies in the same business.
// Three of them had no EBITDA at all, because banks do not report one.
//
// So the list is now treated as CANDIDATES and filtered:
//
//   1. same industry as the subject, which is the tight match
//   2. failing that, same sector
//   3. a financial company is never compared with a non-financial one, in
//      either direction, because the multiples are not the same measure
//   4. what survives is ranked by how close it is in size, since a company ten
//      times larger is not really a comparable either
//
// If too few survive, that is reported rather than padded out. A short honest
// peer set beats a long misleading one.
const FINANCIAL_SECTORS = new Set(['Financial Services', 'Financial', 'Financials']);

function isFinancial(entry) {
  return FINANCIAL_SECTORS.has(String(entry?.sector || ''));
}

function selectPeers(subject, candidates) {
  const usable = candidates.filter(Boolean);
  const subjectFinancial = isFinancial(subject);

  const sameKind = usable.filter((c) => isFinancial(c) === subjectFinancial);

  const sameIndustry = sameKind.filter(
    (c) => subject?.industry && c.industry && c.industry === subject.industry
  );
  const sameSector = sameKind.filter(
    (c) => subject?.sector && c.sector && c.sector === subject.sector
  );

  let chosen = sameIndustry.length >= 2 ? sameIndustry : sameSector;
  let basis =
    sameIndustry.length >= 2
      ? 'same industry'
      : sameSector.length >= 2
      ? 'same sector'
      : 'none';

  if (basis === 'none') return { peers: [], basis };

  // Rank by closeness in size, on a log scale so a peer half the size and one
  // twice the size are treated as equally close.
  const subjectCap = subject?.marketCap;
  if (typeof subjectCap === 'number' && subjectCap > 0) {
    chosen = chosen
      .map((c) => ({
        c,
        distance:
          typeof c.marketCap === 'number' && c.marketCap > 0
            ? Math.abs(Math.log(c.marketCap / subjectCap))
            : Number.POSITIVE_INFINITY,
      }))
      .sort((a, b) => a.distance - b.distance)
      .map((x) => x.c);
  }

  return { peers: chosen.slice(0, 6), basis };
}

function median(values) {
  const clean = values.filter((v) => typeof v === 'number' && isFinite(v) && v > 0).sort((a, b) => a - b);
  if (!clean.length) return null;
  const mid = Math.floor(clean.length / 2);
  const value = clean.length % 2 ? clean[mid] : (clean[mid - 1] + clean[mid]) / 2;
  return Number(value.toFixed(2));
}

export default async function handler(req, res) {
  const ticker = String(req.query.ticker || '').trim().toUpperCase();
  if (!ticker) {
    res.status(400).json({ error: 'No ticker supplied.' });
    return;
  }

  try {
    const auth = await getYahooAuth();
    const peerSymbols = await fetchPeers(ticker, auth);

    if (!peerSymbols.length) {
      res.status(200).json({
        ticker,
        peers: [],
        medians: {},
        message:
          'No comparable companies could be identified for this ticker from the free sources available.',
        fetchedAt: new Date().toISOString(),
      });
      return;
    }

    // The subject company is fetched too, so its own multiples sit alongside
    // the peers rather than being quoted from a different calculation.
    const all = await Promise.all(
      [ticker, ...peerSymbols].map((symbol) => fetchFundamentals(symbol, auth))
    );

    const subject = all[0];
    const { peers, basis } = selectPeers(subject, all.slice(1));

    if (!peers.length) {
      res.status(200).json({
        ticker,
        subject,
        peers: [],
        medians: {},
        message:
          'The companies the data source associates with this one are not in the same business, so no comparable set is shown. A misleading peer set is worse than none.',
        fetchedAt: new Date().toISOString(),
      });
      return;
    }

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.status(200).json({
      ticker,
      subject,
      peers,
      basis,
      medians: {
        evToEbitda: median(peers.map((p) => p.evToEbitda)),
        evToSales: median(peers.map((p) => p.evToSales)),
        priceToEarnings: median(peers.map((p) => p.priceToEarnings)),
      },
      note: `Peers matched on ${basis} and ranked by closeness in size. Trailing figures, not forward.`,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    res.status(200).json({
      ticker,
      peers: [],
      medians: {},
      message: `Comparable companies could not be fetched: ${error.message}`,
      fetchedAt: new Date().toISOString(),
    });
  }
}