// Marginalia — news proxy
//
// Why this file exists: a browser cannot fetch Google News RSS directly,
// because Google does not send the CORS header browsers require. This runs
// on Vercel's servers instead, where that restriction does not apply.
//
// The dashboard calls:  /api/news?ticker=AAPL
// This returns:         { items: [ { id, time, headline, source, type, url } ] }
//
// Free. No API key. No account needed.

// A ticker alone makes a poor news query — "META" returns metaverse blogs and
// "F" returns nothing useful. The dashboard therefore passes the company's real
// name, and we search on that. The ticker is only a fallback.

// Exchange suffix -> which Google News edition to search. An Indian company is
// covered by the Indian press, so asking the US edition returns very little.
const REGION_BY_SUFFIX = {
  NS: { hl: 'en-IN', gl: 'IN', ceid: 'IN:en' },   // NSE India
  BO: { hl: 'en-IN', gl: 'IN', ceid: 'IN:en' },   // BSE India
  L:  { hl: 'en-GB', gl: 'GB', ceid: 'GB:en' },   // London
  TO: { hl: 'en-CA', gl: 'CA', ceid: 'CA:en' },   // Toronto
  AX: { hl: 'en-AU', gl: 'AU', ceid: 'AU:en' },   // Australia
  HK: { hl: 'en-HK', gl: 'HK', ceid: 'HK:en' },   // Hong Kong
};

const DEFAULT_REGION = { hl: 'en-US', gl: 'US', ceid: 'US:en' };

// Company names carry legal suffixes that add nothing to a news search and
// often narrow it too far. Strip them.
const NAME_NOISE = /\b(inc|inc\.|corp|corp\.|corporation|co|co\.|ltd|ltd\.|limited|plc|sa|nv|ag|holdings|holding|group|company|the)\b/gi;

function cleanName(name) {
  return name
    .replace(NAME_NOISE, ' ')
    .replace(/[.,&]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildQuery(ticker, name) {
  const base = name && name.length > 1 ? cleanName(name) : ticker.split('.')[0];
  // "share price" reads better for Indian coverage, "stock" for US — but both
  // work either way, so keep one consistent term.
  return `${base} stock`;
}

const MAX_ITEMS = 8;

// Pull the contents of a single XML tag, handling CDATA wrappers.
function tagText(block, tag) {
  const match = block.match(
    new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i')
  );
  if (!match) return '';
  return match[1]
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

// Google appends " - Publisher" to most headlines. The publisher is already
// in its own field, so strip the duplicate off the end of the headline.
function stripTrailingSource(headline, source) {
  if (!source) return headline;
  const suffix = ` - ${source}`;
  return headline.endsWith(suffix)
    ? headline.slice(0, -suffix.length).trim()
    : headline;
}

function formatTime(pubDate) {
  const d = new Date(pubDate);
  if (isNaN(d.getTime())) return '—';
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export default async function handler(req, res) {
  const ticker = String(req.query.ticker || '').trim().toUpperCase();
  const name = String(req.query.name || '').trim();

  if (!ticker) {
    res.status(400).json({ items: [], error: 'No ticker given' });
    return;
  }

  const query = buildQuery(ticker, name);

  // The bit after the dot tells us which country's press to search.
  const suffix = ticker.includes('.') ? ticker.split('.').pop() : null;
  const region = (suffix && REGION_BY_SUFFIX[suffix]) || DEFAULT_REGION;
  const url =
    'https://news.google.com/rss/search' +
    `?q=${encodeURIComponent(query)}` +
    `&hl=${region.hl}&gl=${region.gl}&ceid=${region.ceid}`;

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Marginalia/1.0)' },
    });

    if (!response.ok) {
      throw new Error(`Google News returned ${response.status}`);
    }

    const xml = await response.text();
    const blocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];

    const items = blocks.slice(0, MAX_ITEMS).map((block, index) => {
      const source = tagText(block, 'source');
      const rawHeadline = tagText(block, 'title');
      return {
        id: `${ticker}-${index}`,
        time: formatTime(tagText(block, 'pubDate')),
        headline: stripTrailingSource(rawHeadline, source),
        source: source || 'Google News',
        type: 'NEWS',
        url: tagText(block, 'link'),
      };
    });

    // Cache at Vercel's edge for 15 minutes, and keep serving the old copy for
    // an hour after that while a fresh one is fetched. Keeps the page fast and
    // keeps request volume to Google low.
    res.setHeader(
      'Cache-Control',
      'public, s-maxage=900, stale-while-revalidate=3600'
    );
    res.status(200).json({ items });
  } catch (error) {
    // Never break the dashboard over a news failure — return an empty list and
    // let the front end fall back to whatever it already has.
    res.status(200).json({ items: [], error: String(error.message || error) });
  }
}