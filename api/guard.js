// FILE: api/_guard.js
// Marginalia — shared request guard for the API routes
//
// Every file in /api is a public URL. Anyone on the internet can call it, with
// anything in the query string. This file is the single place where we decide
// what counts as a reasonable request, so all four routes behave the same way
// and a fix only has to be made once.
//
// Vercel ignores files in /api whose name begins with an underscore, so this
// is a helper the other routes import, never an endpoint of its own.
//
// Three jobs:
//   1. guardRequest  — reject anything that is not a plain GET from our site
//   2. readTicker / readSearchQuery / readName — clean and check the inputs
//   3. noStore       — stop errors being cached at Vercel's edge
//
// What this does NOT do: stop someone calling the API from a script. CORS is a
// browser rule, so it only stops OTHER WEBSITES using our API in a visitor's
// browser. A program calling us directly is unaffected. Rate limiting is the
// tool for that, and it lives in the Vercel firewall rule, not here.

// Origins allowed to call these routes from a browser.
const ALLOWED_EXACT = new Set([
  'https://marginalia-iota-one.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
]);

// Vercel gives every preview deployment its own address, so those are matched
// by shape rather than listed one by one.
function isAllowedOrigin(origin) {
  if (ALLOWED_EXACT.has(origin)) return true;
  try {
    const url = new URL(origin);
    return url.protocol === 'https:' && url.hostname.endsWith('.vercel.app');
  } catch {
    return false;
  }
}

// Errors and rejections must never be cached, or one bad response gets served
// to everybody for hours.
export function noStore(res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
}

// Returns true if the request may continue. If it returns false it has already
// sent a response, and the route must simply return.
export function guardRequest(req, res) {
  // A browser asks permission before some cross-site calls. Answer, then stop.
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'GET, HEAD, OPTIONS');
    res.status(204).end();
    return false;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    noStore(res);
    res.setHeader('Allow', 'GET, HEAD, OPTIONS');
    res.status(405).json({ error: 'Method not allowed.' });
    return false;
  }

  // Browsers send an Origin header only when the page making the call sits on
  // a different address from the one it is calling. Our own pages therefore
  // send nothing here, and anything that does send one is another site.
  const origin = req.headers.origin;
  if (origin && !isAllowedOrigin(origin)) {
    noStore(res);
    res.status(403).json({ error: 'This API is not open to other sites.' });
    return false;
  }

  // Never allow another site to read the answer, even by accident.
  res.setHeader('Vary', 'Origin');
  return true;
}

// ---------------------------------------------------------------------------
// Input cleaning
//
// Each of these returns a safe value or null. A route that gets null replies
// with a fixed sentence rather than repeating back whatever was sent, because
// echoing raw input is how a plain error message turns into an attack.
// ---------------------------------------------------------------------------

// Tickers are short and use a very small alphabet: letters, digits, and the
// dot and hyphen that separate exchange suffixes (RELIANCE.NS, BRK-B).
const TICKER = /^[A-Z0-9][A-Z0-9.\-]{0,19}$/;

export function readTicker(value) {
  const raw = String(value == null ? '' : value).trim().toUpperCase();
  if (!TICKER.test(raw)) return null;
  // Two dots or a trailing dot is never a real ticker and would only be a
  // probe at the upstream service.
  if (raw.includes('..') || raw.endsWith('.') || raw.endsWith('-')) return null;
  return raw;
}

// The type-ahead box. People type company names, so this alphabet is wider,
// but it still excludes everything that carries meaning in a URL or in HTML.
const SEARCH_ALLOWED = /[^A-Za-z0-9 .\-&'()]/g;

export function readSearchQuery(value) {
  const cleaned = String(value == null ? '' : value)
    .replace(SEARCH_ALLOWED, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 64);
  return cleaned.length >= 2 ? cleaned : null;
}

// The company name passed to the news route. Never shown back to the user and
// only used to build a search phrase, but still capped and cleaned.
export function readName(value) {
  return String(value == null ? '' : value)
    .replace(/[^\p{L}\p{N} .,&'()\-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

// One place to turn an internal failure into something safe to send out. The
// real reason goes to the Vercel log, where only you can read it.
export function logAndHide(scope, error, detail) {
  const reason = error && error.message ? error.message : String(error);
  console.error(`[${scope}]${detail ? ' ' + detail : ''} — ${reason}`);
}
