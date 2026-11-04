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
  /** Hairlines. Decorative: 1.28:1, so never the only boundary of a control. */
  line: '#262521',
  /**
   * A raised surface above a panel: a modal, a sheet, a popover, a menu.
   * Elevation is tonal (`docs/VISUAL_SYSTEM.md` §2): lighter means higher.
   */
  overlay: '#16161A',
  /**
   * The boundary of a control: an input, a segmented control, a checkbox.
   * WCAG 1.4.11 asks 3:1 of a control's boundary; `line` is 1.28:1 and cannot
   * be that boundary. 3.65 on page, 3.49 on panel, 3.35 on overlay.
   */
  lineControl: '#6E6A60',
  /** Behind a modal or a sheet. Not a colour anything is read in. */
  scrim: 'rgba(11,11,13,0.72)',

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
  /** The raised surface on paper, and the paper selected state's ground. */
  panel: '#FAF9F5',
  ink: '#16150F',
  read: '#3A382F',
  quiet: '#6B6759',
  line: '#DAD6CC',
  /** The boundary of a control on paper: 3.43 on the ground, 3.71 on panel. */
  lineControl: '#85816F',

  accent: '#8B1E1E',
  accentText: '#A23A34',
} as const;

// ---------------------------------------------------------------------------
// CHARTS (`docs/VISUAL_SYSTEM.md` §3.2)
//
// Five series at most, three as the target. Every series is a palette colour
// already on the ramp, told apart by its stroke as well as its colour, because
// a chart must read in greyscale and to a reader with a colour-vision
// deficiency. Each carries a direct label; there is no legend to look up.
// Oxblood is not a series: its one categorical use is the this-model forecast
// line, drawn dashed in `accentText`.
export const CHART_SERIES = [
  { key: 's1', role: 'the subject, e.g. the price', colour: DARK.ink, dash: 'solid' },
  { key: 's2', role: 'an overlay on the second axis', colour: DARK.amber, dash: 'solid' },
  { key: 's3', role: 'a third series', colour: DARK.read, dash: '6 4' },
  { key: 's4', role: 'a fourth series', colour: DARK.muted, dash: '1.5 3.5' },
  { key: 's5', role: 'the fifth, and the last', colour: DARK.quiet, dash: '6 3 1.5 3' },
] as const;

/**
 * THE SEQUENTIAL RAMPS, five steps each. On the dark ground the lightest step
 * is the largest value; on paper the darkest is (Carbon's rule). Stepped, never
 * a gradient standing in for one.
 */
export const SEQUENTIAL = {
  dark: ['#2B2B2C', '#50504F', '#7E7E7C', '#B1B0AC', '#F2F0EA'],
  paper: ['#D3D1CB', '#B0AEA8', '#84827C', '#54524C', '#16150F'],
} as const;

/**
 * The steps that fall below 3:1 against their ground, by index. A cell filled
 * with one of these needs a hairline outline and a printed value, because the
 * fill alone does not meet the 3:1 a graphical object needs. Stated here rather
 * than remembered; the verification suite computes the set and fails if this
 * list does not match it.
 */
export const SEQUENTIAL_NEEDS_OUTLINE = {
  dark: [0, 1],
  paper: [0, 1],
} as const;

/**
 * DIVERGING, only where there is a true midpoint (price against value). The
 * two ends are the existing signal colours, the midpoint a neutral step; every
 * cell prints a signed value, so colour never carries the sign alone.
 */
export const DIVERGING = {
  negative: DARK.accentText,
  midpoint: '#50504F',
  positive: DARK.positive,
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
  display: "'Newsreader', Georgia, serif",
  body: "'Source Sans 3', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif",
  /**
   * THE FIGURE FACE IS THE BODY FACE. There is no monospace on this site any
   * more: a column of numbers lines up because Source Sans 3 has true tabular
   * figures and they are asked for, not because every letter is one width.
   * Kept as its own name so a call site can say "this is a number" and get the
   * tabular setting with it.
   */
  figure: "'Source Sans 3', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif",
} as const;

/**
 * THE WHOLE TYPE SCALE. Four steps for words, one for a tile's figure, and
 * two the landing page alone may use — and nothing between them.
 *
 * The four (`title`, `section`, `body`, `small`) are DESIGN.md's. `tile` is the
 * 24px figure step VISUAL_SYSTEM finding 8 approved. `lead` and `display` are
 * the two landing-only steps from the same finding, and appear nowhere else.
 * There is no 40px hero figure: COMPANY_OVERVIEW D1 maps it onto the nearest
 * step, so a hero figure is set at the `title` size in the figure face
 * (`docs/VISUAL_BUILD_PLAN.md` C5). `hero` is that alias, not a new size.
 *
 * Mirrored in `src/index.css` as `--m-size-*`, which also carries the block
 * that snaps every arbitrary size a screen still asks for onto one of these;
 * `npm run verify` compares the two halves.
 */
export const SIZE = {
  title: 'clamp(28px, 2.8vw, 36px)',
  section: '20px',
  body: '15px',
  small: '13px',
  tile: '24px',
  lead: '20px',
  display: 'clamp(40px, 5vw, 64px)',
} as const;

/** A hero figure is the title size, in the figure face. Not a separate step. */
export const HERO_FIGURE_SIZE = SIZE.title;

/** The steps any screen may use, and the extra ones only the landing page may. */
export const SIZE_STEPS_EVERYWHERE: (keyof typeof SIZE)[] = ['title', 'section', 'body', 'small', 'tile'];
export const SIZE_STEPS_LANDING_ONLY: (keyof typeof SIZE)[] = ['lead', 'display'];

// ---------------------------------------------------------------------------
// MOTION (`docs/VISUAL_SYSTEM.md` §4, with `docs/VISUAL_BUILD_PLAN.md` C6, C7)
//
// The curves are Carbon's productive set, so they are tested rather than
// invented. Motion exists only to explain a state change; nothing on a product
// screen lasts longer than `slow` on an interaction, and no number ever moves.
//
// Two values differ from the VISUAL_SYSTEM table, both by the build plan:
// `chart` is 400ms, not 640ms, because 640ms broke the system's own 600ms
// page-load cap (C6, matching COMPANY_OVERVIEW D7's 400ms draw-in plus a 200ms
// fill); and `pageOut` is 120ms, the page transition's exit as the table gives
// it, which is shorter than the "exit = 70% of enter" rule would make it (C7).
//
// Mirrored in `src/index.css` as `--m-ease-*` and `--m-dur-*`; the palette
// check compares the two halves. `MOTION_JS` is the same values in the units a
// JavaScript animation library takes (seconds, and a curve as four numbers),
// so a component never writes a duration of its own.
export const EASE = {
  /** A state change in place. */
  standard: 'cubic-bezier(0.2, 0, 0.38, 0.9)',
  /** Things arriving. */
  enter: 'cubic-bezier(0, 0, 0.38, 0.9)',
  /** Things leaving. */
  exit: 'cubic-bezier(0.2, 0, 1, 0.9)',
  /** The landing hero only. */
  expressive: 'cubic-bezier(0.4, 0.14, 0.3, 1)',
} as const;

/** Durations in milliseconds. */
export const DURATION_MS = {
  press: 70,
  fast: 110,
  pageOut: 120,
  base: 200,
  mod: 240,
  slow: 280,
  reveal: 400,
  chart: 400,
  count: 600,
  hero: 700,
} as const;

const curve = (css: string): [number, number, number, number] =>
  css.replace(/^cubic-bezier\(|\)$/g, '').split(',').map(Number) as [number, number, number, number];

/** The same tokens for a JavaScript animation: seconds, and curves as arrays. */
export const MOTION_JS = {
  ease: Object.fromEntries(Object.entries(EASE).map(([k, v]) => [k, curve(v)])) as Record<
    keyof typeof EASE,
    [number, number, number, number]
  >,
  duration: Object.fromEntries(Object.entries(DURATION_MS).map(([k, v]) => [k, v / 1000])) as Record<
    keyof typeof DURATION_MS,
    number
  >,
} as const;

/** A display heading, as both reading screens set one. */
export const DISPLAY_HEADING = {
  fontFamily: TYPE.display,
  fontWeight: 600,
  letterSpacing: '-0.02em',
  lineHeight: 1.08,
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
  '--m-overlay': DARK.overlay,
  '--m-line-control': DARK.lineControl,
  '--m-scrim': DARK.scrim,

  '--m-paper': PAPER.ground,
  '--m-paper-ink': PAPER.ink,
  '--m-paper-read': PAPER.read,
  '--m-paper-quiet': PAPER.quiet,
  '--m-paper-line': PAPER.line,
  '--m-paper-accent-text': PAPER.accentText,
  '--m-paper-panel': PAPER.panel,
  '--m-paper-line-control': PAPER.lineControl,

  ...Object.fromEntries(CHART_SERIES.map((s) => [`--m-chart-${s.key}`, s.colour])),
  ...Object.fromEntries(SEQUENTIAL.dark.map((c, i) => [`--m-seq-${i + 1}`, c])),
  ...Object.fromEntries(SEQUENTIAL.paper.map((c, i) => [`--m-paper-seq-${i + 1}`, c])),
  '--m-div-negative': DIVERGING.negative,
  '--m-div-midpoint': DIVERGING.midpoint,
  '--m-div-positive': DIVERGING.positive,

  '--m-ease-standard': EASE.standard,
  '--m-ease-enter': EASE.enter,
  '--m-ease-exit': EASE.exit,
  '--m-ease-expr': EASE.expressive,
  ...Object.fromEntries(
    Object.entries(DURATION_MS).map(([k, v]) => [`--m-dur-${k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}`, `${v}ms`])
  ),
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
export const DARK_GROUNDS: (keyof typeof DARK)[] = ['page', 'panel', 'overlay'];
export const PAPER_GROUNDS: (keyof typeof PAPER)[] = ['ground', 'panel'];

/**
 * Which tokens draw the boundary of a control, and so must clear 3:1 on every
 * ground (WCAG 1.4.11). `line` is deliberately absent: it is decorative.
 */
export const BOUNDARY_ON_DARK: (keyof typeof DARK)[] = ['lineControl'];
export const BOUNDARY_ON_PAPER: (keyof typeof PAPER)[] = ['lineControl'];
/** Chart marks sit on the page and on panels, never on an overlay. */
export const CHART_GROUNDS: (keyof typeof DARK)[] = ['page', 'panel'];

/** WCAG AA for normal text. Nothing on either ground is allowed below it. */
export const CONTRAST_FLOOR = 4.5;
/** WCAG 1.4.11: control boundaries, focus indicators and chart marks. */
export const BOUNDARY_FLOOR = 3;
