---
name: Marginalia
description: A dark-ground valuation terminal where the number is read first and its account is folded, never hidden.
colors:
  page: "#0B0B0D"
  panel: "#111114"
  line: "#262521"
  ink: "#F2F0EA"
  read: "#C6C1B7"
  muted: "#A8A29A"
  quiet: "#85816F"
  accent: "#8B1E1E"
  accent-text: "#D05E58"
  positive: "#5FA37B"
  positive-line: "#2F5C45"
  positive-fill: "#12211A"
  amber: "#C79A2E"
  paper: "#F2F0EA"
  paper-ink: "#16150F"
  paper-read: "#3A382F"
  paper-quiet: "#6B6759"
  paper-line: "#DAD6CC"
  paper-accent-text: "#A23A34"
typography:
  display:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "clamp(34px, 4.2vw, 54px)"
    fontWeight: 700
    lineHeight: 1.06
    letterSpacing: "-0.045em"
  headline:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.04
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  editorial:
    fontFamily: "'Playfair Display', Georgia, serif"
    fontSize: "18px"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "-0.012em"
  hero-figure:
    fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "clamp(2.5rem, 5vw, 3.75rem)"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.03em"
    fontFeature: "tabular-nums"
  figure:
    fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "clamp(1.625rem, 3vw, 2.375rem)"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "-0.02em"
    fontFeature: "tabular-nums"
  tile-figure:
    fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "17px"
    fontWeight: 500
    lineHeight: 1
    fontFeature: "tabular-nums"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.7
    letterSpacing: "0.005em"
  body-dense:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "0.005em"
  label:
    fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.55
    letterSpacing: "0.16em"
  label-chrome:
    fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.55
    letterSpacing: "0.08em"
rounded:
  none: "0px"
  full: "9999px"
spacing:
  hairline: "1px"
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "20px"
  xl: "24px"
  block: "40px"
  section: "96px"
components:
  panel:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "16px 20px"
  figure-hero:
    textColor: "{colors.accent-text}"
    typography: "{typography.hero-figure}"
    padding: "24px 20px"
  figure-secondary:
    textColor: "{colors.ink}"
    typography: "{typography.figure}"
    padding: "24px 20px"
  metric-tile:
    backgroundColor: "{colors.page}"
    textColor: "{colors.ink}"
    typography: "{typography.tile-figure}"
    rounded: "{rounded.none}"
    padding: "12px 14px"
  pill-positive:
    backgroundColor: "{colors.positive-fill}"
    textColor: "{colors.positive}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "3px 8px"
  pill-negative:
    textColor: "{colors.accent-text}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "3px 8px"
  pill-neutral:
    backgroundColor: "{colors.page}"
    textColor: "{colors.muted}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "3px 8px"
  pill-warn:
    textColor: "{colors.amber}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "3px 8px"
  button-primary:
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "8px 14px"
  button-ghost:
    textColor: "{colors.muted}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "8px 14px"
  button-ghost-hover:
    textColor: "{colors.ink}"
  chip-ticker:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.muted}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "4px 10px"
  chip-ticker-selected:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "4px 10px"
  disclose-row:
    textColor: "{colors.muted}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "12px 0"
  disclose-row-hover:
    textColor: "{colors.ink}"
  mark:
    backgroundColor: "{colors.accent}"
    size: "0.13em"
---

# Design System: Marginalia

## Overview

**Creative North Star: "The Lit Ledger"**

Marginalia is a warm near-black instrument with a paper annex. Everything on the
instrument side is measured in a single warm ramp — a warm page, a warm off-white
ink, and warm greys between them — because the one cool grey the build used to
carry (Tailwind's zinc, 62 uses sitting beside 300 uses of a warm grey) read as
faintly dirty against the ground and nobody could say why. The reading side —
Margin Notes and the explainers under `/learn/` — is a separate ramp on paper,
not the same ramp inverted, because a colour legible on one ground is usually not
legible on the other.

Density is a value here, not a side effect. An eyebrow label, a figure at 17px, a
hairline and no shadow: a professional reads a row of tiles at a glance and wants
them close together, and the airy version of the same card says "dashboard"
rather than "terminal". The governing pattern of the shipped company screen is
**the number first, the explanation on demand**. A figure is large, monospaced
and alone; everything that accounts for it sits behind a disclosure that opens
beside the figure rather than in a footnote at the bottom of the panel. The prose
was never the fault — it is the reason to trust the number — but a reader who
already trusts it should not walk past three sentences to find the value.

Contrast is a property of the token, not of the component. Every colour that
carries words clears 4.5:1 on every ground it is used on; `verify/scenarios.mts`
measures it and `npm run verify` fails the run if a token drops below. The one
deliberate exception is stated as its own token rather than remembered: the
oxblood that carries words is a different value from the oxblood that is a
square.

**Key Characteristics:**
- Two grounds, two ramps: a warm near-black instrument, warm paper for reading.
- Hairlines and tonal layering only. Not one `box-shadow` in the build.
- Square corners. Radius appears only as a full circle, on a status dot or a diagram ring.
- Every figure monospace and tabular; every heading Inter at 700, cut tight.
- One red, one green, one amber. Their rarity is what makes them mean anything.
- A red square, not a full stop, ends a heading.
- Even the surfaces nobody draws — scrollbar, selection, caret, focus ring — come from the palette.

## Colors

A warm single ramp on each of two grounds, with one oxblood accent, one green and
one amber permitted as colour.

### Primary
- **Oxblood** (`colors.accent`): the mark, rules, fills, the selected ticker chip,
  the scrollbar thumb on hover, and text selection at 55%. Measured at 2.16:1 on
  the page black — right for a square, a rule or a fill, illegible as words. It
  is never text.
- **Read Oxblood** (`colors.accent-text`): the same red lifted to carry words —
  eyebrows, the ticker lockup, section numbers, links, a computed figure — and
  also the caret and the keyboard focus outline. 5.08:1 on the page and 4.87:1 on
  a panel. The lift holds hue at 3° and moves lightness, taking saturation from
  51% to 56% (nearer the mark's own 64%), because lightening a red at fixed
  saturation is what turns oxblood into dusty pink.

### Secondary
- **Ledger Green** (`colors.positive`): one green, for a live state or a positive.
  Four emerald shades had been in use; the tone of a gain should not depend on
  which screen it is on. `positive-line` and `positive-fill` are its hairline and
  its wash.
- **Statement Amber** (`colors.amber`): a warning that is a fact rather than a
  judgement — a data constraint, a basis the filing will not support.

### Neutral
- **Page Black** (`colors.page`): the instrument ground, and the ground a metric
  tile sits back down onto.
- **Panel Black** (`colors.panel`): any raised surface — a card, a modal, a panel.
  One black, where four near-identical ones had accumulated.
- **Hairline** (`colors.line`): every rule and border on the dark ground, and the
  scrollbar thumb. Warm, so it does not read as the blue-cast grey-on-grey it
  replaced.
- **Ink** (`colors.ink`): headings, figures, anything being read closely.
- **Reading Grey** (`colors.read`): body paragraphs — bright enough to actually
  read on a near-black ground, which the old greys were not.
- **Muted Grey** (`colors.muted`): labels, captions, secondary lines.
- **Quiet Grey** (`colors.quiet`): the smallest print — disclaimers, placeholders,
  units, eyebrows. This is the floor, at 5.03:1 on the page and 4.82:1 on a panel.
  It absorbed a second grey that sat 0.9:1 away; two greys that close were not a
  hierarchy, and once both had to clear the floor there was no room for two.
- **Paper, Paper Ink, Paper Read, Paper Quiet, Paper Line, Paper Read Oxblood**
  (`colors.paper*`): the reading ramp. The paper read-oxblood is a darker cut
  (5.77:1 on paper) and, unlike the dark ground, paper permits the deep oxblood
  as text.

### Named Rules
**The Mark Is Not Text Rule.** `accent` is the mark, the rule and the fill, and is
never set as type at any size. Words in oxblood take `accent-text`. The two are
separate tokens so the distinction is stated rather than remembered, and the
contrast check asserts `accent` stays out of the text list.

**The Two Grounds Rule.** Dark tokens are for instrument screens, paper tokens
for reading screens. Never carry a token across grounds, and never derive one
ramp from the other by inversion.

**The 4.5:1 Floor Rule.** Any token that carries words clears 4.5:1 on every
ground it appears on. A colour is chosen by measurement, not by eye, and the
measurement is enforced by `npm run verify`.

**The One Voice Rule.** One red, one green, one amber. A new state borrows an
existing tone or goes grey; it does not introduce a hue.

**The Palette Lives In One File Rule.** `src/design/tokens.ts` is the source;
`src/index.css` mirrors it as `--m-*` custom properties and `@theme` names them
as `--color-*` utilities pointing at those properties, so there is no third copy
to drift. A component that declares a palette hex of its own fails verification.

**The No Browser Default Rule.** The scrollbar, the selection, the caret and the
focus ring are palette colours. A default blue selection is the one colour on the
page that belongs to no palette, and it is the difference between a page that was
built and one that was assembled.

## Typography

**Display Font:** Inter (with system-ui, sans-serif) — cut tight and heavy
**Body Font:** Inter (with ui-sans-serif, system-ui, -apple-system, Segoe UI, Helvetica, Arial)
**Label/Figure Font:** JetBrains Mono (with ui-monospace, SFMono-Regular, Menlo, Consolas)
**Editorial Font:** Playfair Display (with Georgia, serif) — opt-in only

**Character:** An institution, not a magazine. Headings are Inter at 700 pulled in
hard, because an editorial serif at display size reads as a periodical and this is
meant to read as an institution; if the search screen kept the serif, the site
would change register the moment somebody opened a company. Playfair Display is
still loaded and still earns three opt-in places — the wordmark, a blockquote, and
anything marked `.editorial` — and that is where the system's one flourish lives.
Every number is JetBrains Mono.

### Hierarchy
- **Display** (Inter 700, `clamp(34px, 4.2vw, 54px)`, 1.06, -0.02em at section
  level, -0.045em at `h1`): landing-page and long-section headings.
- **Headline** (Inter 700, 24px, 1.04, -0.035em): screen headings.
- **Title** (Inter 700, 20px, 1.2, -0.02em): panel headings.
- **Hero Figure** (JetBrains Mono 600, `clamp(2.5rem, 5vw, 3.75rem)`, 1, -0.03em,
  tabular): the one figure a screen exists to show — the intrinsic value. A clamp
  rather than three breakpoint steps, because the hero should simply fill the
  width it is given and three `sm:text-` steps describe that worse.
- **Figure** (JetBrains Mono 500, `clamp(1.625rem, 3vw, 2.375rem)`, 1, -0.02em,
  tabular): the figures beside the hero — exit multiple, live price.
- **Tile Figure** (JetBrains Mono 500, 17px, 1, tabular): the measure in a metric
  tile.
- **Body** (Inter 400, 16px, 1.7, 0.005em): paragraphs. Reading text on a
  near-black ground needs more room to breathe than the same text on white; the
  slight positive tracking stops thin strokes closing up.
- **Body Dense** (Inter 400, 13px, 1.55): the sentence inside a disclosure.
- **Label / Eyebrow** (JetBrains Mono 500, 13px, 0.16em, uppercase): what a thing
  is — a figure's name, a row's unit, a tile's label, a chip's ticker.
- **Chrome Label** (JetBrains Mono 500, 12px, 0.08em, uppercase, nowrap): the top
  bar only.

### Named Rules
**The Figures Are Mono Rule.** Every number is JetBrains Mono with `tabular-nums`.
Inter's digits are proportional, so a column of them does not line up and a figure
that tweens as a slider drags jitters sideways. A `span` or `div` marked
`.font-display` is resolved to mono for exactly this reason: a serif price above a
mono ratio row was the last place the build changed its mind about itself.

**The 13px Floor Rule.** Nothing anyone has to read is set below 13px. Section
labels at 9, 10 and 11px read fine on a large monitor and are work on a laptop or
a phone. There is one exemption and it is stated in the stylesheet rather than
left as a mystery in a component: the top bar carries seven labels, a clock and
two buttons on a fixed 1440px rule, is glanced at rather than read, and is held at
12px with `white-space: nowrap` because at 13px its last three labels wrap.

**The Seven Sizes Rule.** 13 / 15 / 16 / 18 / 20 / 24, plus 30-48 on the landing
page only, each declared with its own line height — leading that suits a 13px
label suffocates a 16px paragraph. Thirteen sizes between 8px and 24px is not a
hierarchy; 14px and 15px in neighbouring panels read as a mistake rather than a
distinction.

**The Uniform Label Rule.** Every uppercase mono label is 0.16em and weight 500,
set once in the stylesheet. Four different tracking values is the sort of thing
nobody notices individually and everybody notices in aggregate. A tracking
utility written on an uppercase mono element does not win against it.

**The Prose Is Not Mono Rule.** Monospace carries figures and the small-caps
labels above them. A paragraph set in it reads as a terminal dump, so any
monospace block with relaxed leading and no small caps is reset to the reading
face. Labels, tickers and every number are untouched.

## Layout

A fixed institutional measure: content is capped at 1440px, centred, with 24px
side gutters opening to 48px at `lg`. The screen's vertical frame is 96px top and
80px bottom; major blocks separate by 40px, panels by 24px.

Spacing runs on a tight rhythm — 4 / 8 / 12 / 20 / 24px — with 20px (24px at `lg`)
as the standard panel inset and 24px as its vertical inset. Tile grids run 2
columns, 3 at `sm`, 5 at `lg`, with an 8px gutter. Figure groups divide at 1px: a
`gap-px` grid over a hairline background, so columns separate by letting one
background through the gaps instead of adding three more borders.

Body prose is **not** capped at a reading measure. A paragraph runs the full width
of the panel it sits in, which is the width of the table or chart beneath it,
because blocks lining up is most of what makes a page look considered. Prose is
justified with `text-justify: inter-word` and `hyphens: auto` — a flush right edge
is what makes a financial page read as typeset rather than typed, and hyphenation
is what stops justification opening rivers of white space. Below 640px the
justification is switched off and the column goes ragged-right; on a phone the
measure is too narrow to justify without forcing gaps into every line. One
container is excluded from the prose rule by design: the feedback modal carries
the same class and is a container, not prose. Anchor targets carry 84px of scroll
margin to clear the fixed header and its progress rule.

### Named Rules
**The Density Rule.** Rows of measures sit close. If a surface feels airy it is
reading as a dashboard rather than a terminal, and the padding is wrong.

**The Blocks Line Up Rule.** A paragraph, a table and a chart in the same panel
share one left and one right edge. Three different prose widths beside full-width
tables is what makes a page read as ragged columns floating in empty space.

## Elevation & Depth

**There are no shadows in this system.** Not one `box-shadow` is declared anywhere
in the build. Depth is entirely tonal plus hairline: the page is the ground, a
panel is one step up, a metric tile sits back down on the page colour inside a
hairline, and a 1px warm line does all the separating. The only atmospheric effect
is the condensed header, which is the page colour at 95% with a small backdrop
blur, so content scrolling beneath it reads as texture rather than as words.

### Named Rules
**The Hairline Rule.** Separation is a 1px warm line or a one-step tonal change. A
surface is never lifted off the page with a shadow, a glow or a gradient.

## Shapes

Square. Every panel, tile, chip, pill and button has a 0px radius, and that right
angle is the form language: a ruled sheet, not a card deck. Radius exists in
exactly two guises — a full circle on a status dot and on the hero's concentric
diagram rings, and one decorative corner wash. Borders are 1px hairlines, and a
border is the default way an element is bounded; fills are the exception, reserved
for accent states.

The signature silhouette is the **mark**: a 0.13em oxblood square that ends a
heading in place of a full stop, with a 0.08em left margin and a **-0.21em right
margin**. The negative margin is the whole point — it gives the mark zero advance
width, so a heading that exactly fills its measure cannot push the mark onto a
line of its own (which looks like a bug and loses it). Instead it hangs into the
gutter, which is what optical margin alignment does anyway. A word joiner precedes
it so a line cannot break between the last letter and the mark. Both grounds use
the same oxblood today; the component keeps them as separate arguments so a change
to one cannot silently move the other.

### Named Rules
**The Zero Advance Width Rule.** `marginRight: -0.21em` on the mark is not a
tuning value and is never adjusted. Render the mark through the one `Mark`
component; never hand-roll the square, and never write a literal full stop before
one.

## Components

### Buttons
- **Shape:** square (0px radius), 1px hairline border, uppercase mono label with
  wide tracking.
- **Primary:** an oxblood border over an oxblood wash at 20%, ink label, 14px
  horizontal / 8px vertical padding, a 14px inline SVG icon at an 8px gap. Used
  for the one action a screen exists for — downloading the workbook.
- **Hover / Focus:** the wash deepens to 35%; colour transitions only, no lift and
  no shadow. Keyboard focus is a 1px read-oxblood outline at 2px offset, and only
  for the keyboard. Disabled drops to 40% opacity, with the label swapped for its
  progress phrasing ("Building the workbook…").
- **Ghost:** hairline border, muted label; on hover the border goes oxblood and the
  label goes ink. This is the default for a secondary action.

### Chips
- **Style:** ticker chips are square, 10px / 4px padding, uppercase mono.
  Unselected is the panel ground with a hairline border and a muted label;
  selected is a solid oxblood ground with an ink label at weight 600.
- **State:** hover on an unselected chip lifts the border to quiet at 40% and the
  label to ink. The "+ All" escape chip carries read oxblood rather than muted,
  marking it as the one that leaves the set.

### Cards / Containers
- **Corner Style:** square (0px).
- **Background:** panel for a container; a metric tile deliberately uses the page
  colour, so a row of tiles reads as wells cut into the panel rather than cards
  floating on it.
- **Shadow Strategy:** none — see Elevation & Depth.
- **Border:** 1px hairline throughout; internal sections divide with a hairline
  rather than with a gap.
- **Internal Padding:** 20px horizontal / 16-24px vertical on a panel (24px side
  padding at `lg`); 14px / 12px on a metric tile.

### Inputs / Fields
- **Style:** square, hairline border on the panel ground, placeholder in quiet.
- **Focus:** a 1px read-oxblood `:focus-visible` outline at 2px offset; the caret
  is read oxblood in every input, textarea and editable cell.

### Navigation
- **Style:** a fixed top bar of uppercase mono chrome labels at 12px / 0.08em,
  never allowed to wrap. Once the full header scrolls out, a condensed bar slides
  down from -60px over 280ms `easeOut` on the page colour at 95% with a backdrop
  blur and a hairline bottom border, carrying the ticker in read oxblood, the
  company name in muted, and price and implied value as small mono figures.

### Signature Components

**Figure.** An eyebrow in quiet above, the number large and alone, an optional
pill on its baseline and an optional quiet footnote beneath. `scale="hero"` is the
one figure the screen exists to show; `tone="accent"` marks a figure this product
computed rather than fetched, which is why the intrinsic value is the one thing on
the screen set in read oxblood.

**Pill.** A square hairline capsule beside a figure: uppercase mono, tabular,
weight 600, 8px / 3px padding. Four tones and no more — positive (green on its
fill and line), negative (read oxblood on a 10% oxblood wash with a 50% oxblood
border), neutral (muted on the page colour inside a hairline), warn (amber on a
10% amber wash with a 40% amber border). A discount reads positive and a premium
reads oxblood: a measurement, never a verdict.

**MetricTile.** An eyebrow label, truncated with the full text in `title`; a 17px
mono figure; an optional smaller quiet note for the basis; an optional nested
"basis" disclosure. The border lifts to quiet at 40% on hover. Tiles enter
staggered at 50ms per child with 8px of travel.

**Disclose.** The row that holds the prose. A real `<button>` with `aria-expanded`
and a controlled region — the keyboard has to reach it and a screen reader has to
be told the state. A 12px chevron rotates 90° over 200ms rather than swapping
glyph, so the control cannot reflow as it opens; the body animates height and
opacity over 200ms `easeOut` and is indented 24px to line up with the summary past
the chevron, so an open disclosure reads as one block. A trailing value stays
visible on the closed row when it is a measurement a reader must see without
opening anything — the spread between two methods is shown closed; what the
disagreement means is what opens.

**RefStrip.** A `<dl>` of identity facts — exchange, sector, ISIN — eyebrow key
beside a muted tabular value, 20px apart. Identity is reference, not headline: a
reader who typed the ticker knows which company this is, so it is set at label
size and the space the company name used to take went to the figure.

## Do's and Don'ts

### Do:
- **Do** take colour from the ramp by utility name (`text-ink`, `bg-panel`,
  `border-line`, `text-accent-text`), which resolves through `--m-*` to
  `src/design/tokens.ts`.
- **Do** set every number in JetBrains Mono with `tabular-nums`, including any
  number that tweens.
- **Do** use `accent-text` for oxblood words and `accent` for the mark, rules and
  fills.
- **Do** separate with a 1px warm hairline or a one-step tonal change.
- **Do** keep square corners (0px) on panels, tiles, chips, pills and buttons.
- **Do** put the figure first and fold its account into a `Disclose` beside it,
  leaving a measurement visible on the closed row where a reader needs it.
- **Do** render the heading mark through the `Mark` component, keeping
  `marginRight: -0.21em`.
- **Do** build new screens from the `instrument.tsx` primitives (`Figure`, `Pill`,
  `MetricTile`, `Disclose`, `RefStrip`) rather than new markup.
- **Do** give an interactive row a real `<button>` with `aria-expanded` and a
  palette `:focus-visible` outline.
- **Do** run `npm run verify` after touching a colour: it compares `tokens.ts`
  against `index.css` and measures every text token against the 4.5:1 floor.
- **Do** keep prose at full panel width, justified with hyphenation above 640px.

### Don't:
- **Don't** set `accent` (#8B1E1E) as text at any size. It is 2.16:1 on the page.
- **Don't** declare a palette hex inside a component; verification fails it.
- **Don't** add a second green, a second red, a second panel black, or a cool grey.
  The ground is warm, and a cool grey on it reads as faintly dirty.
- **Don't** use Playfair Display for a heading. Headings are Inter 700; the serif
  is opt-in for the wordmark, a blockquote and `.editorial`.
- **Don't** add a `box-shadow`, a glow or a gradient to lift a surface.
- **Don't** set type below 13px outside the top bar's stated 12px exemption.
- **Don't** add a font size between the seven steps, or set a size without its
  line height.
- **Don't** set a paragraph in the monospace face.
- **Don't** leave a browser default on the scrollbar, the selection, the caret or
  the focus ring.
- **Don't** loosen tile or row padding into an airy grid; density is the register.
- **Don't** round, rename or re-derive a token hex. The frontmatter values are the
  measured ones.
