// FILE: scripts/buildExplainers.mts
//
// Writes the eight explainer articles as real HTML files, into the same `dist`
// Vite has just produced. Run by `npm run build`, after `vite build`.
//
//   dist/learn/index.html                  the index of all eight
//   dist/learn/<slug>/index.html           one article
//   dist/learn/explainer.css               the one stylesheet they share
//   dist/sitemap.xml                       the home page and all nine
//
// `src/data/explainers.ts` says why these are files rather than routes in the
// application. This file is the other half of that decision, and it is written
// to FAIL rather than to publish something wrong:
//
//   - a markdown file with no entry in EXPLAINERS, or an entry with no file;
//   - a title in EXPLAINERS that is not the `# ` heading of its own file;
//   - any markdown construct outside the subset rendered here.
//
// That last one matters most. A hand-written renderer that silently drops a
// list, a link or a bold run publishes an article with a hole in it and nobody
// notices for months. The subset is small on purpose — headings, paragraphs and
// pipe tables, which is everything the eight articles use — and anything else
// stops the build and names the file and line.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const CONTENT = path.join(REPO, 'content', 'explainers');
const DIST = path.join(REPO, 'dist');

const { EXPLAINERS, explainerPath, EXPLAINERS_PATH } = await import(
  `file:///${path.join(REPO, 'src/data/explainers.ts').split(path.sep).join('/')}`
);
const P: any = await import(
  `file:///${path.join(REPO, 'src/data/paperPalette.ts').split(path.sep).join('/')}`
);

// The canonical origin. Absolute URLs are needed in the sitemap, in og: tags
// and in the canonical link; a relative one in any of those is ignored or, in
// the sitemap, rejected outright.
const ORIGIN = process.env.SITE_ORIGIN || 'https://marginalia-iota-one.vercel.app';

// ---------------------------------------------------------------- the renderer

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

interface Block {
  kind: 'h1' | 'h2' | 'p' | 'table';
  text?: string;
  head?: string[];
  rows?: string[][];
}

/**
 * Markdown, in the subset these articles are written in.
 *
 * Supported: `# ` and `## ` headings, blank-line-separated paragraphs, and GitHub
 * pipe tables with a header row and a `---` separator. Nothing else — no lists,
 * links, emphasis or code — because the articles use none of it and a renderer
 * that pretends to handle a construct it does not is worse than one that refuses.
 */
function parse(markdown: string, file: string): Block[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  const refuse = (i: number, why: string) => {
    throw new Error(`${file}:${i + 1} ${why}\n    ${lines[i]}`);
  };

  const cells = (line: string) =>
    line
      .replace(/^\s*\|/, '')
      .replace(/\|\s*$/, '')
      .split('|')
      .map((c) => c.trim());

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    if (line.startsWith('# ')) {
      blocks.push({ kind: 'h1', text: line.slice(2).trim() });
      continue;
    }
    if (line.startsWith('## ')) {
      blocks.push({ kind: 'h2', text: line.slice(3).trim() });
      continue;
    }
    if (/^#{3,}\s/.test(line)) refuse(i, 'heading deeper than ## is not rendered');

    if (line.trimStart().startsWith('|')) {
      const head = cells(line);
      const sep = lines[i + 1] ?? '';
      if (!/^\s*\|?[\s:-]*-[\s:|-]*$/.test(sep)) refuse(i, 'a table without a --- separator row');
      const rows: string[][] = [];
      let j = i + 2;
      for (; j < lines.length && lines[j].trimStart().startsWith('|'); j++) {
        const row = cells(lines[j]);
        if (row.length !== head.length) refuse(j, `row has ${row.length} cells, the header has ${head.length}`);
        rows.push(row);
      }
      blocks.push({ kind: 'table', head, rows });
      i = j - 1;
      continue;
    }

    // Anything that is plainly markdown but outside the subset stops the build
    // rather than reaching a reader as literal asterisks or brackets.
    if (/^\s*([-*+]|\d+\.)\s/.test(line)) refuse(i, 'a list is not rendered');
    if (/^\s*>/.test(line)) refuse(i, 'a blockquote is not rendered');
    if (/^\s*```/.test(line)) refuse(i, 'a code fence is not rendered');
    if (/\*\*|__|\[[^\]]*\]\(|`/.test(line))
      refuse(i, 'emphasis, a link or inline code is not rendered');

    blocks.push({ kind: 'p', text: line.trim() });
  }
  return blocks;
}

function renderBlocks(blocks: Block[]): string {
  const out: string[] = [];
  for (const b of blocks) {
    if (b.kind === 'h1') continue; // the H1 is placed by the page template
    if (b.kind === 'h2') out.push(`      <h2>${esc(b.text!)}</h2>`);
    else if (b.kind === 'p') out.push(`      <p>${esc(b.text!)}</p>`);
    else {
      out.push('      <div class="scroll"><table>');
      out.push(`        <thead><tr>${b.head!.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>`);
      out.push('        <tbody>');
      for (const row of b.rows!)
        out.push(`          <tr>${row.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`);
      out.push('        </tbody>');
      out.push('      </table></div>');
    }
  }
  return out.join('\n');
}

// ------------------------------------------------------------------ the styles
//
// One stylesheet for all nine pages, written from the palette module so the
// explainers and the Margin Notes screen cannot drift apart. The type sizes
// match that screen's: 40px display headings, 21px standfirst, 17px body at a
// 1.7 line height, measure capped at 68 characters.

const STYLES = `/* Generated by scripts/buildExplainers.mts. Do not edit in dist. */
:root {
  --paper: ${P.PAPER};
  --ink: ${P.PAPER_INK};
  --read: ${P.PAPER_READ};
  --dim: ${P.PAPER_DIM};
  --line: ${P.PAPER_LINE};
  --red: ${P.RED};
  --red-text: ${P.RED_TEXT};
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  background: var(--paper);
  color: var(--read);
  font-family: ${P.BODY_FAMILY};
  font-weight: 300;
  -webkit-font-smoothing: antialiased;
}
.wrap { max-width: 1380px; margin: 0 auto; padding: 64px 24px; }
@media (min-width: 640px) { .wrap { padding: 64px 40px; } }
@media (min-width: 1024px) { .wrap { padding: 96px 64px; } }

.back {
  display: inline-flex; align-items: center; gap: 8px;
  font-family: ${P.MONO_FAMILY};
  font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase;
  color: var(--dim); text-decoration: none; margin-bottom: 48px;
}
.back:hover { color: var(--red); }
.back span[aria-hidden] { font-size: 14px; line-height: 1; }

.eyebrow {
  display: flex; align-items: center; gap: 12px;
  font-family: ${P.MONO_FAMILY};
  font-size: 12px; letter-spacing: 0.22em; text-transform: uppercase;
  color: var(--red-text); margin: 0 0 24px;
}
.eyebrow::before { content: ''; display: block; width: 32px; height: 1px; background: var(--red); flex: none; }

h1, h2 {
  font-family: ${P.DISPLAY_FAMILY};
  font-weight: 500; letter-spacing: -0.01em; color: var(--ink);
}
h1 { font-size: 34px; line-height: 1.04; margin: 0 0 16px; }
@media (min-width: 640px) { h1 { font-size: 46px; } }
@media (min-width: 1024px) { h1 { font-size: 56px; } }
h2 { font-size: 24px; line-height: 1.15; margin: 48px 0 16px; }
@media (min-width: 1024px) { h2 { font-size: 28px; } }

article { max-width: 68ch; }
article p { font-size: 16px; line-height: 1.7; margin: 0 0 24px; }
@media (min-width: 1024px) { article p { font-size: 17px; } }

.standfirst {
  font-size: 19px; line-height: 1.5; color: var(--ink);
  padding-bottom: 32px; margin: 0 0 32px; border-bottom: 1px solid var(--line);
}
@media (min-width: 1024px) { .standfirst { font-size: 21px; } }

/* A table of figures is the one thing on these pages that cannot reflow, so it
   is given its own scroll rather than forcing the page sideways on a phone. */
.scroll { overflow-x: auto; margin: 0 0 24px; }
table { border-collapse: collapse; width: 100%; font-size: 15px; }
th, td { text-align: left; padding: 10px 16px 10px 0; border-bottom: 1px solid var(--line); white-space: nowrap; }
th {
  font-family: ${P.MONO_FAMILY};
  font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--dim); font-weight: 500;
}
td { color: var(--read); }

.label {
  font-family: ${P.MONO_FAMILY};
  font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase;
  color: var(--dim); margin: 0 0 16px;
}
.more { max-width: 68ch; margin-top: 96px; padding-top: 32px; border-top: 1px solid var(--line); }
.more a { display: block; color: var(--ink); text-decoration: none; font-size: 16px; line-height: 1.4; padding: 10px 0; border-bottom: 1px solid var(--line); }
.more a:last-of-type { border-bottom: 0; }
.more a:hover { color: var(--red-text); }
.more a .sub { display: block; color: var(--dim); font-size: 14px; margin-top: 4px; font-weight: 300; }

.cta { max-width: 68ch; margin-top: 48px; padding-top: 32px; border-top: 1px solid var(--line); font-size: 15px; line-height: 1.65; }
.cta a { color: var(--red-text); }

.index-list { max-width: 68ch; margin-top: 48px; }
.index-list a { display: block; text-decoration: none; padding: 24px 0; border-bottom: 1px solid var(--line); }
.index-list a:last-of-type { border-bottom: 0; }
.index-list a:hover h2 { color: var(--red-text); }
.index-list h2 { font-size: 22px; margin: 0 0 8px; }
@media (min-width: 1024px) { .index-list h2 { font-size: 24px; } }
.index-list p { margin: 0; color: var(--read); font-size: 16px; line-height: 1.6; }
`;

// ------------------------------------------------------------- the page shells

const head = (opts: { title: string; description: string; url: string }) => {
  // Absolute, not relative: the index sits at /learn/ and an article at
  // /learn/<slug>/, so a relative path needs different numbers of ../ in the
  // two templates and one of them is always wrong. It was.
  const css = '/learn/explainer.css';
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(opts.title)} — Marginalia</title>
    <meta name="description" content="${esc(opts.description)}" />
    <link rel="canonical" href="${esc(opts.url)}" />
    <link rel="icon" href="/favicon.ico" sizes="any" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <meta name="theme-color" content="${P.PAPER}" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500&family=JetBrains+Mono:wght@400;500&family=Playfair+Display:wght@400;500;600&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="${css}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="Marginalia" />
    <meta property="og:url" content="${esc(opts.url)}" />
    <meta property="og:title" content="${esc(opts.title)}" />
    <meta property="og:description" content="${esc(opts.description)}" />
    <meta property="og:image" content="${ORIGIN}/og.png?v=2" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(opts.title)}" />
    <meta name="twitter:description" content="${esc(opts.description)}" />
    <meta name="twitter:image" content="${ORIGIN}/og.png?v=2" />
  </head>
  <body>
    <div class="wrap">`;
};

const FOOT = `    </div>
  </body>
</html>
`;

const backLink = (href: string, label: string) =>
  `      <a class="back" href="${href}"><span aria-hidden="true">←</span>${esc(label)}</a>`;

// ---------------------------------------------------------------------- build

const write = (rel: string, body: string) => {
  const target = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, body, 'utf8');
  return target;
};

if (!fs.existsSync(DIST)) {
  console.error(`No dist/ to write into. Run "vite build" first (npm run build does both).`);
  process.exit(2);
}

const onDisk = fs
  .readdirSync(CONTENT)
  .filter((f) => f.endsWith('.md'))
  .map((f) => f.replace(/\.md$/, ''));
const listed: string[] = EXPLAINERS.map((e: any) => e.slug);

for (const slug of onDisk)
  if (!listed.includes(slug))
    throw new Error(
      `content/explainers/${slug}.md has no entry in src/data/explainers.ts, so nothing would link to it.`
    );
for (const slug of listed)
  if (!onDisk.includes(slug))
    throw new Error(`src/data/explainers.ts lists "${slug}" but content/explainers/${slug}.md does not exist.`);

write('learn/explainer.css', STYLES);

// ---- one page per article
for (const entry of EXPLAINERS as any[]) {
  const file = `content/explainers/${entry.slug}.md`;
  const blocks = parse(fs.readFileSync(path.join(CONTENT, `${entry.slug}.md`), 'utf8'), file);

  const h1 = blocks[0]?.kind === 'h1' ? blocks[0].text : null;
  if (!h1) throw new Error(`${file} does not start with a "# " heading.`);
  if (h1 !== entry.title)
    throw new Error(
      `${file} is titled "${h1}" but src/data/explainers.ts calls it "${entry.title}". ` +
        `The index would link to a name the page does not carry.`
    );

  // The first paragraph is the standfirst: these articles all open with a
  // one-paragraph definition, which is exactly what a search result should show.
  const firstPara = blocks.find((b) => b.kind === 'p');
  if (!firstPara) throw new Error(`${file} has a heading and no prose.`);

  const rest = blocks.filter((b) => b !== firstPara);
  const url = `${ORIGIN}${explainerPath(entry.slug)}`;
  const others = (EXPLAINERS as any[]).filter((e) => e.slug !== entry.slug);

  const body = [
    head({ title: entry.title, description: entry.standfirst, url }),
    backLink(EXPLAINERS_PATH, 'All explainers'),
    `      <p class="eyebrow">Explainer</p>`,
    `      <h1>${esc(h1)}</h1>`,
    `    <article>`,
    `      <p class="standfirst">${esc(firstPara.text!)}</p>`,
    renderBlocks(rest),
    `    </article>`,
    `      <div class="cta">Marginalia builds a three-statement model and a discounted cash flow for any listed company from its own filings, with every assumption visible and yours to move. <a href="/">Value a company</a>, or read <a href="/">the margin notes</a> on what each line of a set of accounts measures.</div>`,
    `      <nav class="more">`,
    `        <p class="label">The other explainers</p>`,
    ...others.map(
      (e) =>
        `        <a href="${explainerPath(e.slug)}">${esc(e.title)}<span class="sub">${esc(e.standfirst)}</span></a>`
    ),
    `      </nav>`,
    FOOT,
  ].join('\n');

  write(`learn/${entry.slug}/index.html`, body);
}

// ---- the index
{
  const url = `${ORIGIN}${EXPLAINERS_PATH}`;
  const description =
    'Eight short articles on how a company is valued: discounted cash flow, free cash flow, WACC, terminal value, the three-statement model, EV/EBITDA, book value, and why two analysts disagree.';
  const body = [
    head({ title: 'Explainers', description, url }),
    backLink('/', 'Marginalia'),
    `      <p class="eyebrow">Explainers</p>`,
    `      <h1>How a company is valued</h1>`,
    `      <article><p class="standfirst">${esc(description)} No prior finance required, and nothing here tells you what to buy.</p></article>`,
    `      <div class="index-list">`,
    ...(EXPLAINERS as any[]).map(
      (e) =>
        `        <a href="${explainerPath(e.slug)}"><h2>${esc(e.title)}</h2><p>${esc(e.standfirst)}</p></a>`
    ),
    `      </div>`,
    `      <div class="cta">These explain the method. <a href="/">Marginalia</a> runs it: a three-statement model and a discounted cash flow for any listed company, built from its own filings, with every assumption visible and yours to move.</div>`,
    FOOT,
  ].join('\n');
  write('learn/index.html', body);
}

// ---- the sitemap, and robots pointing at it
{
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    `${ORIGIN}/`,
    `${ORIGIN}${EXPLAINERS_PATH}`,
    ...(EXPLAINERS as any[]).map((e) => `${ORIGIN}${explainerPath(e.slug)}`),
  ];
  write(
    'sitemap.xml',
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      urls.map((u) => `  <url><loc>${u}</loc><lastmod>${today}</lastmod></url>`).join('\n') +
      '\n</urlset>\n'
  );
}

console.log(
  `explainers: ${EXPLAINERS.length} articles, an index and a sitemap written to dist/learn/ — ` +
    `${(EXPLAINERS as any[]).map((e: any) => e.slug).join(', ')}`
);
