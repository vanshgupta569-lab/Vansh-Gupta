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
const { MARGIN_NOTES }: any = await import(
  `file:///${path.join(REPO, 'src/data/marginNotes.ts').split(path.sep).join('/')}`
);
// The Margin notes' own address (LEARN_STATES L1): /learn/notes/<key>/.
const NOTES_PATH = '/learn/notes/';
// The palette, from the one place it is declared. This script never loads the
// application, so it reads the tokens directly rather than keeping its own copy
// of the paper colours — which is exactly how the eyebrow red came to be
// 4.43:1 here and in six components at once.
const { PAPER, DARK, TYPE, SIZE }: any = await import(
  `file:///${path.join(REPO, 'src/design/tokens.ts').split(path.sep).join('/')}`
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
// One stylesheet for all nine pages, written from the token module — the
// palette from PAPER and DARK, the sizes from SIZE — so these pages cannot
// drift from the application (`docs/LEARN_STATES_SPEC.md` §2.3–2.4; build
// step 9, job 9.7). `src/index.css`'s size and capitals remapping does not
// reach a static page, so what is written here is what renders: four steps
// (Small 13, Body 15, Section 20, Title), weights 400, 500 and 600 only, no
// capitals, no tracking on body text. `verify/learnPages.mts` reads the
// output and fails the build on anything else.

const STYLES = `/* Generated by scripts/buildExplainers.mts. Do not edit in dist. */
:root {
  --paper: ${PAPER.ground};
  --ink: ${PAPER.ink};
  --read: ${PAPER.read};
  --dim: ${PAPER.quiet};
  --line: ${PAPER.line};
  --line-control: ${PAPER.lineControl};
  --red: ${PAPER.accent};
  --red-text: ${PAPER.accentText};
  --bar: ${DARK.page};
  --bar-ink: ${DARK.ink};
  --bar-muted: ${DARK.muted};
  --bar-line: ${DARK.line};
  --bar-panel: ${DARK.panel};
  --bar-accent: ${DARK.accent};
  --small: ${SIZE.small};
  --body: ${SIZE.body};
  --section: ${SIZE.section};
  --title: ${SIZE.title};
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; scroll-padding-top: 88px; }
body {
  margin: 0;
  background: var(--paper);
  color: var(--read);
  font-family: ${TYPE.body};
  font-size: var(--body);
  line-height: 1.6;
  font-weight: 400;
  -webkit-font-smoothing: antialiased;
}
a:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }

/* THE HEADER, as a static copy (LEARN_STATES L3): the wordmark, the links
   that have a page to go to, Learn as the current section, and a Search link
   that opens the application's search. Dark, like the application's. */
.site {
  position: sticky; top: 0; z-index: 10;
  height: 64px; background: var(--bar); border-bottom: 1px solid var(--bar-line);
  display: flex; align-items: center; gap: 32px;
  padding: 0 24px;
}
@media (min-width: 640px) { .site { padding: 0 48px; } }
.site a { color: var(--bar-muted); text-decoration: none; font-size: var(--small); font-weight: 500; }
.site a:hover { color: var(--bar-ink); }
.site a:focus-visible { outline-color: var(--bar-ink); }
.site .wordmark { font-family: ${TYPE.display}; font-weight: 600; font-size: var(--section); color: var(--bar-ink); line-height: 1; }
.site .wordmark .mark { display: inline-block; width: max(0.13em, 6px); height: max(0.13em, 6px); background: var(--bar-accent); margin-left: 0.02em; }
.site nav { display: flex; gap: 4px; }
.site nav a { display: inline-flex; align-items: center; height: 40px; padding: 0 12px; border: 1px solid transparent; }
/* The system's one selected state: panel ground, 1px accent border, ink, 600. */
.site nav a[aria-current="page"] { background: var(--bar-panel); border-color: var(--bar-accent); color: var(--bar-ink); font-weight: 600; }
.site .search { margin-left: auto; display: inline-flex; align-items: center; height: 36px; padding: 0 12px; border: 1px solid var(--bar-line); }
.skip { position: absolute; left: -9999px; }
.skip:focus { left: 48px; top: 14px; height: 36px; padding: 0 12px; display: inline-flex; align-items: center; background: var(--bar); color: var(--bar-ink); }
@media (max-width: 639px) { .site nav { display: none; } }

.wrap { max-width: 1440px; margin: 0 auto; padding: 64px 24px 96px; }
@media (min-width: 640px) { .wrap { padding: 64px 48px 96px; } }

.back {
  display: inline-flex; align-items: center; gap: 8px; min-height: 24px;
  font-size: var(--small); line-height: 1.4; color: var(--dim); text-decoration: none; margin-bottom: 24px;
}
.back:hover { color: var(--ink); }

.eyebrow { font-size: var(--small); line-height: 1.4; font-weight: 500; color: var(--dim); margin: 0 0 12px; }

h1, h2 { font-family: ${TYPE.display}; font-weight: 600; color: var(--ink); }
h1 {
  font-size: var(--title); line-height: 1.08; margin: 0 0 16px; max-width: 24ch;
  letter-spacing: -0.015em; word-spacing: 0.04em;
}
/* The red square that ends a heading, drawn by the stylesheet so the h1 holds
   only its words (the explainers check reads the h1 as text). */
h1::after { content: ''; display: inline-block; width: max(0.13em, 6px); height: max(0.13em, 6px); background: var(--red); margin-left: 0.02em; }
h2 { font-size: var(--section); line-height: 1.3; margin: 48px 0 12px; }

article { max-width: 640px; }
article p { margin: 0 0 16px; }

.standfirst { color: var(--ink); padding-bottom: 24px; margin: 0 0 24px; border-bottom: 1px solid var(--line); max-width: 640px; }
.hub .standfirst { color: var(--read); border-bottom: 0; padding-bottom: 0; max-width: 600px; }

/* A table of figures cannot reflow, so it scrolls inside its own container
   on a phone, with its first column held (VISUAL_SYSTEM §7). */
.scroll { overflow-x: auto; margin: 0 0 16px; }
table { border-collapse: collapse; width: 100%; font-size: var(--small); line-height: 1.55; font-variant-numeric: tabular-nums lining-nums; }
th, td { text-align: left; padding: 10px 16px 10px 0; border-bottom: 1px solid var(--line); white-space: nowrap; }
th { color: var(--dim); font-weight: 500; }
td { color: var(--read); }
@media (max-width: 639px) { th:first-child, td:first-child { position: sticky; left: 0; background: var(--paper); } }

.label { font-size: var(--small); line-height: 1.4; font-weight: 500; color: var(--dim); margin: 0 0 12px; }

.cta { max-width: 640px; margin-top: 64px; padding-top: 24px; border-top: 1px solid var(--line); color: var(--read); }
.cta a { color: var(--read); text-decoration: underline; text-decoration-color: var(--line-control); text-decoration-thickness: 1px; text-underline-offset: 2px; }
.cta a:hover { color: var(--ink); }

/* Rows of explainers: the hub's left column, and "The other explainers". */
.rows a { display: block; text-decoration: none; min-height: 72px; padding: 16px 0; border-bottom: 1px solid var(--line); }
.rows a:last-of-type { border-bottom: 0; }
.rows .t { display: block; color: var(--ink); font-weight: 600; line-height: 1.45; transition: color var(--m-dur-fast, 110ms) cubic-bezier(0.2, 0, 0.38, 0.9); }
.rows a:hover .t { color: var(--red-text); }
.rows .sub { display: block; color: var(--read); font-size: var(--small); line-height: 1.55; margin-top: 4px; }
.more { max-width: 640px; margin-top: 48px; }

/* The hub: explainers and margin notes side by side (LEARN_STATES §2.3). */
.cols { display: grid; grid-template-columns: minmax(0, 640px) 1fr; column-gap: 96px; margin-top: 48px; }
.cols h2 { margin-top: 0; }
.notes .group { margin-bottom: 24px; }
.notes .narrow { display: none; }
.notes summary { list-style: none; }
.notes summary::-webkit-details-marker { display: none; }
.notes a { display: flex; align-items: center; min-height: 40px; color: var(--read); text-decoration: none; }
.notes a:hover { color: var(--ink); }
@media (max-width: 1023px) { .cols { grid-template-columns: minmax(0, 1fr); row-gap: 48px; } }
@media (max-width: 639px) {
  .notes .wide { display: none; }
  .notes .narrow { display: block; margin: 0; border-bottom: 1px solid var(--line); }
  .notes .narrow summary { margin: 0; }
  .notes .narrow[open] { padding-bottom: 8px; }
  .notes summary { cursor: pointer; display: flex; align-items: center; gap: 8px; min-height: 44px; }
  .notes summary::before { content: ''; width: 0; height: 0; border-left: 5px solid var(--dim); border-top: 4px solid transparent; border-bottom: 4px solid transparent; }
  .notes details[open] summary::before { transform: rotate(90deg); }
  .notes .group a { padding-left: 24px; min-height: 44px; }
}
@media (prefers-reduced-motion: reduce) { .rows .t { transition: none; } }
`;

// ------------------------------------------------------------- the page shells

const head = (opts: { title: string; description: string; url: string }) => {
  // Absolute, not relative: the index sits at /learn/ and an article at
  // /learn/<slug>/, so a relative path needs different numbers of ../ in the
  // two templates and one of them is always wrong. It was.
  const css = '/learn/explainer.css';
  return `<!doctype html>
<html lang="en-IN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(opts.title)} — Marginalia</title>
    <meta name="description" content="${esc(opts.description)}" />
    <link rel="canonical" href="${esc(opts.url)}" />
    <link rel="icon" href="/favicon.ico" sizes="any" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <meta name="theme-color" content="${DARK.page}" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&family=Source+Sans+3:wght@400;500;600&display=swap" rel="stylesheet" />
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
    <header class="site">
      <a class="skip" href="#main">Skip to content</a>
      <a class="wordmark" href="/" aria-label="Marginalia home">marginalia<span class="mark" aria-hidden="true"></span></a>
      <nav aria-label="Main">
        <a href="/screener">Screener</a>
        <a href="${EXPLAINERS_PATH}" aria-current="page">Learn</a>
      </nav>
      <a class="search" href="/">Search companies…</a>
    </header>
    <main id="main" class="wrap">`;
};

const FOOT = `    </main>
  </body>
</html>
`;

const backLink = (href: string, label: string) =>
  `      <a class="back" href="${href}"><span aria-hidden="true">←</span>${esc(label)}</a>`;

const h1With = (text: string) => `      <h1>${esc(text)}</h1>`;

// The margin notes, in their three groups and index order (LEARN_STATES §2.3).
const NOTE_GROUPS: { id: string; label: string }[] = [
  { id: 'income', label: 'The income statement' },
  { id: 'balance', label: 'The balance sheet' },
  { id: 'meaning', label: 'Reading them together' },
];
const notePath = (key: string) => `${NOTES_PATH}${key}/`;

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
    h1With(h1),
    `    <article>`,
    `      <p class="standfirst">${esc(firstPara.text!)}</p>`,
    renderBlocks(rest),
    `    </article>`,
    `      <div class="cta">Marginalia builds a three-statement model and a discounted cash flow for any listed company from its own filings, with every assumption visible and yours to move. <a href="/">Value a company</a>, or read <a href="${NOTES_PATH}">the margin notes</a> on what each line of a set of accounts measures.</div>`,
    `      <nav class="more rows" aria-label="The other explainers">`,
    `        <p class="label">The other explainers</p>`,
    ...others.map(
      (e) =>
        `        <a href="${explainerPath(e.slug)}"><span class="t">${esc(e.title)}</span><span class="sub">${esc(e.standfirst)}</span></a>`
    ),
    `      </nav>`,
    FOOT,
  ].join('\n');

  write(`learn/${entry.slug}/index.html`, body);
}

// ---- the index: the Learn hub, explainers and margin notes on one page
{
  const url = `${ORIGIN}${EXPLAINERS_PATH}`;
  const description =
    'Eight short articles on how a company is valued: discounted cash flow, free cash flow, WACC, terminal value, the three-statement model, EV/EBITDA, book value, and why two analysts disagree.';
  const notesCount = (MARGIN_NOTES as any[]).length;
  const groups = NOTE_GROUPS.map((g) => {
    const notes = (MARGIN_NOTES as any[]).filter((n) => n.group === g.id);
    if (!notes.length) return '';
    // Twice, so the page needs no script (the explainers check holds these
    // pages to none): an open list from 640px up, and under it a closed
    // disclosure per group (LEARN_STATES §2.3). One is display: none at any
    // width, so a reader and a screen reader meet each link once.
    const links = notes.map((n) => `            <a href="${notePath(n.key)}">${esc(n.title)}</a>`);
    return [
      `          <div class="group wide">`,
      `            <p class="label">${esc(g.label)}</p>`,
      ...links,
      `          </div>`,
      `          <details class="group narrow">`,
      `            <summary class="label">${esc(g.label)}</summary>`,
      ...links,
      `          </details>`,
    ].join('\n');
  });
  const unknown = (MARGIN_NOTES as any[]).filter((n) => !NOTE_GROUPS.some((g) => g.id === n.group));
  if (unknown.length) throw new Error(`margin notes in no group the hub prints: ${unknown.map((n) => n.key).join(', ')}`);
  const body = [
    head({ title: 'Learn', description, url }),
    `    <div class="hub">`,
    h1With('How a company is valued'),
    `      <p class="standfirst">${esc(description)} Beside them, ${notesCount} margin notes on what each line of a set of accounts measures. No prior finance required, and nothing here tells you what to buy.</p>`,
    `      <div class="cols">`,
    `        <section class="rows" aria-labelledby="explainers">`,
    `          <h2 id="explainers">Explainers</h2>`,
    ...(EXPLAINERS as any[]).map(
      (e) =>
        `          <a href="${explainerPath(e.slug)}"><span class="t">${esc(e.title)}</span><span class="sub">${esc(e.standfirst)}</span></a>`
    ),
    `        </section>`,
    `        <section class="notes" aria-labelledby="notes">`,
    `          <h2 id="notes">Margin notes</h2>`,
    ...groups,
    `        </section>`,
    `      </div>`,
    `      <div class="cta">These explain the method. <a href="/">Marginalia</a> runs it: a three-statement model and a discounted cash flow for any listed company, built from its own filings, with every assumption visible and yours to move.</div>`,
    `    </div>`,
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
  // The Margin notes get their own addresses in job 9.8; until a note is
  // served at its address it is not put in the sitemap.
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

// THE CHECK ON WHAT WAS JUST WRITTEN (LEARN_STATES §8 items 2–3; job 9.7).
// It reads dist/learn/ back and fails the build on a size off the four
// steps, a capital set by CSS, a weight outside 400/500/600, or a page not in
// en-IN.
const { checkLearnPages } = await import(
  `file:///${path.join(REPO, 'verify/learnPages.mts').split(path.sep).join('/')}`
);
const learnProblems: string[] = checkLearnPages(DIST);
if (learnProblems.length) {
  for (const p of learnProblems) console.error(`  PROBLEM: ${p}`);
  console.error(`the /learn/ pages are off the type system: ${learnProblems.length} problems`);
  process.exit(1);
}
