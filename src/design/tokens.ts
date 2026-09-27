// FILE: src/design/tokens.ts
//
// THE PALETTE. One file, read by everything.
//
// Before this, the colours were declared as local constants at the top of eight
// components and applied as inline styles, and the same five or six hex codes
// were written out in each. They drifted, as copies do. The red square that
// ends a heading was copied into five files and had already gone wrong in two
// more: the header's has no negative margin, so it takes real width, and the
// methodology grid's is 0.16em rather than 0.13em. Nobody could have noticed
// without opening seven files side by side.
//
// TWO GROUNDS, TWO RAMPS. The instrument screens are a warm near-black; the
// reading screens — Margin Notes and the explainers — are paper. A colour that
// is legible on one is usually not legible on the other, so they are separate
// sets rather than one set used twice. `paperPalette.ts`, which was written for
// the explainer pages, has been folded into `PAPER` below.
//
// CONTRAST IS A PROPERTY OF THE TOKEN, NOT OF THE COMPONENT. Every colour here
// that carries words clears 4.5:1 — the WCAG AA threshold for normal text — on
// every ground it is used on. `verify/scenarios.mts` measures it and fails if a
// token drops below, so this cannot quietly stop being true. What was measured
// on 2026-09-27, and what changed:
//
//   role            ground   before                      after
//   ------------------------------------------------------------------------
//   eyebrow red     dark     #C0453E  3.90 / 3.74  FAIL  #D05E58  5.08 / 4.87
//   eyebrow red     paper    #C0453E  4.43         FAIL  #A23A34  5.77
//   quiet grey      dark     #6B6759  3.47 / 3.33  FAIL  #85816F  5.03 / 4.82
//   faint grey      dark     #7C766D  4.37 / 4.19  FAIL  #85816F  (same step)
//
// Each lift holds the hue exactly and moves only lightness, except the dark
// eyebrow, which also takes its saturation from 51% to 56% — nearer the mark's
// own 64% — because lightening a red at fixed saturation is what turns oxblood
// into dusty pink. It is still hue 3°, as it was.
//
// `faint` and `quiet` were two greys a single step apart. Once both have to
// clear 4.5:1 on a ground where `muted` sits at 7.77:1, there is not room for
// two, and two greys 0.9:1 apart were not doing distinct work anyway. They are
// one token now.
//
// THE MARK IS NOT TEXT. `accent` is the oxblood, and it is 2.16:1 on the dark
// ground: fine for a square, a rule or a fill, illegible as words. Where the
// oxblood has to carry words there is `accentText`. The two are separate tokens
// so that the distinction is stated rather than remembered.
//
// THE OTHER HALF OF THE SOURCE is `src/index.css`, which declares the same
// values as CSS custom properties — Tailwind utilities and the explainer pages
// need them as CSS, not as TypeScript. The two are checked against each other
// in `npm run verify`, the same way the payload versions are.

/** The instrument screens: search, figures, questions, the dashboard. */
export const DARK = {
  /** The ground. */
  page: '#0B0B0D',
  /** Any raised surface: a card, a modal, a panel. */
  panel: '#111114',
  /** Hairlines. */
  line: '#262521',

  /** Headings, figures, anything being read closely. */
  ink: '#F2F0EA',
  /** Body paragraphs. */
  read: '#C6C1B7',
  /** Labels, captions, secondary lines. */
  muted: '#A8A29A',
  /** The smallest print: disclaimers, placeholders, units. The floor. */
  quiet: '#85816F',

  /** The mark, rules and fills. NEVER text — 2.16:1 on the page. */
  accent: '#8B1E1E',
  /** The oxblood where it carries words: eyebrows, labels, figures. */
  accentText: '#D05E58',

  /** One green, for a live state or a positive. */
  positive: '#5FA37B',
  positiveLine: '#2F5C45',
  positiveFill: '#12211A',
  /** One amber, for a warning that is a fact rather than a judgement. */
  amber: '#C79A2E',
} as const;

/** The reading screens: Margin Notes, and the explainer pages under /learn/. */
export const PAPER = {
  ground: '#F2F0EA',
  ink: '#16150F',
  read: '#3A382F',
  quiet: '#6B6759',
  line: '#DAD6CC',

  accent: '#8B1E1E',
  accentText: '#A23A34',
} as const;

// ---------------------------------------------------------------------------
// THE MARK
//
// The red square that ends a heading, in place of a full stop. Zero advance
// width, on purpose: given real width, a heading that exactly fills its measure
// pushes the mark onto a line of its own, which looks like a bug and loses it.
// The negative right margin makes it hang into the gutter instead, which is
// what optical margin alignment does anyway.
//
// `marginRight` must stay at -0.21em. It is the whole point.
export const MARK = {
  size: '0.13em',
  marginLeft: '0.08em',
  marginRight: '-0.21em',
} as const;

// ---------------------------------------------------------------------------
// TYPE
//
// Matched to the faces loaded in index.html. The explainer pages are written by
// a build script that never loads the application, so it reads these rather
// than repeating the stacks.
export const TYPE = {
  display: "'Playfair Display', Georgia, serif",
  body: "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
} as const;

/** A display heading, as both reading screens set one. */
export const DISPLAY_HEADING = {
  fontFamily: TYPE.display,
  fontWeight: 500,
  letterSpacing: '-0.01em',
  lineHeight: 1.04,
} as const;

// ---------------------------------------------------------------------------
// WHAT index.css MUST SAY
//
// The custom properties the stylesheet declares, and what each must equal. The
// verification suite reads `src/index.css`, parses its `:root` block, and fails
// if any of these disagrees — so the CSS half of the palette cannot drift from
// this half. Add a token above and add its variable here, or the check says so.
export const CSS_VARIABLES: Record<string, string> = {
  '--m-page': DARK.page,
  '--m-panel': DARK.panel,
  '--m-line': DARK.line,
  '--m-ink': DARK.ink,
  '--m-read': DARK.read,
  '--m-muted': DARK.muted,
  '--m-quiet': DARK.quiet,
  '--m-accent': DARK.accent,
  '--m-accent-text': DARK.accentText,
  '--m-positive': DARK.positive,
  '--m-positive-line': DARK.positiveLine,
  '--m-positive-fill': DARK.positiveFill,
  '--m-amber': DARK.amber,

  '--m-paper': PAPER.ground,
  '--m-paper-ink': PAPER.ink,
  '--m-paper-read': PAPER.read,
  '--m-paper-quiet': PAPER.quiet,
  '--m-paper-line': PAPER.line,
  '--m-paper-accent-text': PAPER.accentText,
};

// ---------------------------------------------------------------------------
// THE CONTRAST CONTRACT
//
// Which tokens carry words, and on which grounds. This is what the verification
// suite measures; a token listed here that drops below 4.5:1 fails the run.
// `accent` is deliberately absent from the text list on the dark ground: it is
// the mark, and the check asserts it stays out of text.
export const TEXT_ON_DARK: (keyof typeof DARK)[] = [
  'ink', 'read', 'muted', 'quiet', 'accentText', 'positive', 'amber',
];
export const TEXT_ON_PAPER: (keyof typeof PAPER)[] = ['ink', 'read', 'quiet', 'accentText', 'accent'];
export const DARK_GROUNDS: (keyof typeof DARK)[] = ['page', 'panel'];

/** WCAG AA for normal text. Nothing on either ground is allowed below it. */
export const CONTRAST_FLOOR = 4.5;
