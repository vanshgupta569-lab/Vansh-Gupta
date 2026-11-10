// FILE: verify/routes.mts
//
// DIRECT LOADS OF THE SITE'S ADDRESSES, ROUTED AS VERCEL ROUTES THEM
// (`docs/LEARN_STATES_SPEC.md` §3.6; `docs/VISUAL_BUILD_PLAN.md` job 9.5).
// Run after `npm run build`:
//
//   npm run build && npm run verify:routes
//
// `vite preview` answers every unknown path with the app, so it cannot show
// what the deployed site does. This serves dist/ the way Vercel does for this
// project: a file that exists is served (a folder by its index.html); else
// the first rewrite in vercel.json whose source matches sends the app's
// index.html; else dist/404.html with status 404. The rewrites are read from
// vercel.json itself, so deleting one is caught here.
//
// Then, in a real browser, each address must land on its own screen:
//   /screener?exchange=NSE   the screener, at that address, filters kept
//   /learn/notes/<key>/      that note (the app, through the rewrite)
//   /learn/notes             the notes screen
//   /learn/                  the static Learn hub
//   /company/X/overview      the app
//   /nope                    status 404, the not-found page, "/nope" printed
//
// Nothing leaves the machine: the app's /api/* calls are answered with 404.

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const DIST = path.join(REPO, 'dist');

let problems = 0;
const say = (line: string) => console.log(`  ${line}`);
const fail = (line: string) => {
  problems++;
  console.log(`  PROBLEM: ${line}`);
};

console.log('\n=== direct loads, routed as Vercel routes them ===');
if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  fail('dist/ is not built: run npm run build first');
  process.exit(1);
}

/** Vercel's path syntax, as far as this project uses it: literal segments and a trailing `:name*`. */
export function sourceToRegex(source: string): RegExp {
  const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = /^(.*?)\/:([a-z]+)\*$/i.exec(source);
  if (m) return new RegExp(`^${esc(m[1])}(?:/.*)?$`);
  return new RegExp(`^${esc(source)}/?$`);
}

const vercel = JSON.parse(fs.readFileSync(path.join(REPO, 'vercel.json'), 'utf8'));
const rewrites: { source: string; destination: string; re: RegExp }[] = (vercel.rewrites || []).map((r: any) => ({
  ...r,
  re: sourceToRegex(r.source),
}));

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.xml': 'application/xml',
  '.woff2': 'font/woff2', '.txt': 'text/plain',
};

function resolve(pathname: string): { file: string; status: number; via: string } {
  const clean = decodeURIComponent(pathname);
  const asFile = path.join(DIST, clean);
  if (!asFile.startsWith(DIST)) return { file: path.join(DIST, '404.html'), status: 404, via: 'outside' };
  if (fs.existsSync(asFile) && fs.statSync(asFile).isFile()) return { file: asFile, status: 200, via: 'file' };
  const index = path.join(asFile, 'index.html');
  if (fs.existsSync(index)) return { file: index, status: 200, via: 'folder' };
  for (const r of rewrites) if (r.re.test(clean)) return { file: path.join(DIST, r.destination === '/' ? 'index.html' : r.destination), status: 200, via: `rewrite ${r.source}` };
  return { file: path.join(DIST, '404.html'), status: 404, via: 'not found' };
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://x');
  if (url.pathname.startsWith('/api/')) {
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end('{"error":"offline"}');
    return;
  }
  const r = resolve(url.pathname);
  if (!fs.existsSync(r.file)) {
    res.writeHead(404);
    res.end('no 404.html');
    return;
  }
  res.writeHead(r.status, { 'content-type': TYPES[path.extname(r.file)] || 'application/octet-stream', 'x-routed-by': r.via });
  fs.createReadStream(r.file).pipe(res);
});
await new Promise<void>((ok) => server.listen(0, '127.0.0.1', () => ok()));
const PORT = (server.address() as any).port;
const BASE = `http://127.0.0.1:${PORT}`;

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const p = await ctx.newPage();
  const visit = async (address: string) => {
    const resp = await p.goto(`${BASE}${address}`, { waitUntil: 'domcontentloaded' });
    return { status: resp?.status() ?? 0, via: resp?.headers()['x-routed-by'] ?? '' };
  };
  const waitFor = (selector: string) => p.waitForSelector(selector, { timeout: 20_000 }).then(() => true).catch(() => false);

  const cases: { address: string; status: number; what: string; selector: string; extra?: () => Promise<string | null> }[] = [
    {
      address: '/screener?exchange=NSE',
      status: 200,
      what: 'the screener',
      selector: 'h1:has-text("Screener")',
      extra: async () => (new URL(p.url()).searchParams.get('exchange') === 'NSE' ? null : `the filter was dropped: ${p.url()}`),
    },
    { address: '/learn/notes/gross-margin/', status: 200, what: 'the gross margin note', selector: 'article[data-note="gross-margin"]' },
    { address: '/learn/notes', status: 200, what: 'the margin notes screen', selector: 'article[data-note]' },
    { address: '/learn/', status: 200, what: 'the Learn hub', selector: 'h1:has-text("How a company is valued")' },
    { address: '/company/PAPERC/overview', status: 200, what: 'the app', selector: '#root *' },
    {
      address: '/nope',
      status: 404,
      what: 'the not-found page',
      selector: 'h1:has-text("This page does not exist")',
      extra: async () => {
        await p.waitForFunction(`(document.querySelector('[data-not-found-path]')?.textContent || '').includes('/nope')`, null, { timeout: 5000 }).catch(() => {});
        const t = (await p.textContent('[data-not-found-path]').catch(() => null)) || '';
        return t.includes('/nope') ? null : `the address asked for is not printed ("${t}")`;
      },
    },
  ];
  for (const c of cases) {
    const r = await visit(c.address);
    const found = await waitFor(c.selector);
    const extra = found && c.extra ? await c.extra() : null;
    if (r.status !== c.status) fail(`${c.address} answers ${r.status} (${r.via}), not ${c.status}`);
    else if (!found) fail(`${c.address} (${r.via}) does not show ${c.what}`);
    else if (extra) fail(`${c.address}: ${extra}`);
    else say(`${c.address} → ${r.status}, ${c.what} (${r.via})`);
  }
  await ctx.close();
} finally {
  await browser.close();
  server.close();
}

console.log(`\nTOTAL PROBLEMS IN THE DIRECT LOADS: ${problems}`);
process.exit(problems ? 1 : 0);
