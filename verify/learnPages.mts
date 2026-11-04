// FILE: verify/learnPages.mts
//
// THE /learn/ PAGES ON THE TYPE SYSTEM (`docs/LEARN_STATES_SPEC.md` §8 items
// 2–3; `docs/VISUAL_BUILD_PLAN.md` job 9.7). The static pages carry their own
// stylesheet, which `src/index.css`'s remapping cannot reach, so what it asks
// for is what renders. Run by `scripts/buildExplainers.mts` at the end of
// `npm run build`, and on its own:
//
//   npm run build && npx tsx verify/learnPages.mts
//
// It reads dist/learn/ back, as written, and reports:
//   - a font size other than the four steps (Small 13, Body 15, Section 20,
//     Title) — read through the stylesheet's own custom properties;
//   - any text-transform other than none (no capitals set by CSS);
//   - a font weight other than 400, 500 or 600, in the stylesheet or in the
//     font request (a weight that is downloaded is a weight that gets used);
//   - letter-spacing above 0.005em anywhere but the h1;
//   - a page whose <html> is not lang="en-IN", or that has no header with
//     Learn as the current section.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]
  );
}

export function checkLearnPages(dist: string): string[] {
  const problems: string[] = [];
  const learn = path.join(dist, 'learn');
  const files = walk(learn);
  const css = files.filter((f) => f.endsWith('.css'));
  const html = files.filter((f) => f.endsWith('.html'));
  if (!html.length) return [`no pages in ${learn}`];

  // The allowed sizes, read from the token module's values as the stylesheet
  // names them.
  const allowedVars = ['--small', '--body', '--section', '--title'];
  for (const file of css) {
    const text = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const rel = path.relative(dist, file);
    const decl = (prop: string) => [...text.matchAll(new RegExp(`(?:^|[;{\\s])${prop}\\s*:\\s*([^;}]+)`, 'g'))].map((m) => m[1].trim());
    // The custom properties themselves are the steps, so they are checked
    // against the steps; every font-size must then use one of them.
    const vars: Record<string, string> = {};
    for (const m of text.matchAll(/(--[a-z-]+)\s*:\s*([^;}]+)/g)) vars[m[1]] = m[2].trim();
    const wantSteps: Record<string, string> = { '--small': '13px', '--body': '15px', '--section': '20px', '--title': 'clamp(28px, 2.8vw, 36px)' };
    for (const [k, v] of Object.entries(wantSteps)) if (vars[k] !== v) problems.push(`${rel}: ${k} is "${vars[k]}", not the ${v} step`);
    for (const v of decl('font-size')) {
      const m = /^var\((--[a-z-]+)\)$/.exec(v);
      if (!m || !allowedVars.includes(m[1])) problems.push(`${rel}: font-size ${v} is not one of the four steps`);
    }
    for (const v of decl('text-transform')) if (v !== 'none') problems.push(`${rel}: text-transform ${v}`);
    for (const v of decl('font-weight')) if (!['400', '500', '600'].includes(v)) problems.push(`${rel}: font-weight ${v}`);
    // Letter-spacing: only the h1 may set it (−0.015em, LEARN_STATES §2.3).
    for (const m of text.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      const sel = m[1].trim();
      const ls = /letter-spacing\s*:\s*([^;]+)/.exec(m[2]);
      if (!ls) continue;
      const em = parseFloat(ls[1]);
      if (sel !== 'h1' && !(ls[1].trim().endsWith('em') && em <= 0.005)) problems.push(`${rel}: letter-spacing ${ls[1].trim()} on "${sel}"`);
    }
  }
  for (const file of html) {
    const text = fs.readFileSync(file, 'utf8');
    const rel = path.relative(dist, file);
    if (!/<html[^>]*\slang="en-IN"/.test(text)) problems.push(`${rel}: <html> is not lang="en-IN"`);
    if (!/<header class="site">[\s\S]*aria-current="page"[^>]*>Learn</.test(text)) problems.push(`${rel}: no header with Learn as the current section`);
    for (const m of text.matchAll(/fonts\.googleapis\.com\/css2\?([^"]+)"/g))
      for (const w of m[1].matchAll(/wght@([^&"]+)/g))
        for (const part of w[1].split(';')) {
          const weight = part.split(',').pop()!;
          if (!['400', '500', '600'].includes(weight)) problems.push(`${rel}: the font request asks for weight ${weight}`);
        }
    if (/style="[^"]*(font-size|text-transform|font-weight)/.test(text)) problems.push(`${rel}: an inline style sets type, which the stylesheet check cannot see`);
  }
  return problems;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log('\n=== the /learn/ pages on the type system ===');
  const problems = checkLearnPages(path.join(REPO, 'dist'));
  for (const p of problems) console.log(`  PROBLEM: ${p}`);
  if (!problems.length) console.log('  every /learn/ page: four sizes, weights 400/500/600, no capitals, lang="en-IN", Learn current in the header');
  console.log(`\nTOTAL PROBLEMS ON THE LEARN PAGES: ${problems.length}`);
  process.exit(problems.length ? 1 : 0);
}
