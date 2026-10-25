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
  title:
    fontFamily: "'Newsreader', Georgia, serif"
    fontSize: "clamp(28px, 2.8vw, 36px)"
    fontWeight: 600
    lineHeight: 1.08
    letterSpacing: "-0.02em"
  section:
    fontFamily: "'Newsreader', Georgia, serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.012em"
  body:
    fontFamily: "'Source Sans 3', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: "0.005em"
  small:
    fontFamily: "'Source Sans 3', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "0.005em"
  figure:
    fontFamily: "'Source Sans 3', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif"
    fontSize: "inherit"
    fontWeight: 400
    fontFeature: "tabular-nums lining-nums"
  label:
    fontFamily: "'Source Sans 3', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.55
    letterSpacing: "normal"
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
    textColor: "{colors.ink}"
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

## The first design principle

> **At every point, on every screen, Marginalia must look modern, highly
> attractive and high-budget, yet simple, clear and professional. Never messy or
> cluttered. The first impression is the look, so no screen ships unless it
> meets this standard.**

Decided 17 October 2026. It comes before everything else in this document, and
it is repeated in `CLAUDE.md` so every session reads it before touching a screen.

Everything below is how that standard is met on this product in particular --
the warm ramp, the hairlines, the number first -- but the standard itself is the
test, and it is a test a screen can fail while following every rule below. A
screen that is correct and ugly is not finished. A change that makes a screen
busier is a reason to rethink the layout, not a cost to accept.

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
**the number first, the explanation on demand**. A figure is large, tabular
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
- Every figure tabular; every title Newsreader at 600, cut tight. One pairing, four sizes.
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

**Title Font:** Newsreader (with Georgia, serif) — the display face, for titles only
**Text and Figure Font:** Source Sans 3 (with ui-sans-serif, system-ui, -apple-system, Segoe UI, Helvetica, Arial)
**There is no third face, and there is no monospace.**

### The pairing, and why it is this one

Chosen 20 October 2026, from three candidates rendered on the real landing page
and the real figures screen rather than on a specimen sheet. The site had been
carrying four faces — Inter for headings, Inter for body, JetBrains Mono for
every number and label, Playfair Display opt-in — and changed register between
screens because of it.

**Newsreader** for titles. It is drawn by Production Type for reading on
screens, and at the one size the scale gives it the high-contrast cut reads as
a masthead: newspaper-grade, which is the register a company's accounts should
arrive in. It is not one of the faces an AI-built site reaches for.

**Source Sans 3** for everything else, including every figure. The product
lives at 13px — a table of sixty numbers, a label beside each — and Source Sans
3 is exceptional at that size: open apertures, unambiguous 1/l/I, and it holds
its colour on a near-black ground where a higher-contrast sans goes thin. It
has **true tabular figures**, measured in a browser rather than assumed, so a
column lines up because the figures are tabular and not because the letters are
all one width.

Both are free (SIL Open Font License), and **both carry ₹ in Google's base
latin subset** — read off the stylesheet Google actually serves, not inferred,
because ₹ sits at U+20B9 and a face that only carries it in latin-ext would
render it from a fallback on a page of Indian accounts. Indian digit grouping
(87,78,350) is the browser's `en-IN` formatting and works in any face that has
the digits; what the face has to supply is the grouping commas at tabular
width, which both do.

### The four steps, and nothing between them

| Step | Size | Face | What it is |
|---|---|---|---|
| **Title** | `clamp(28px, 2.8vw, 36px)` | Newsreader 600 | The one heading that names a page |
| **Section** | 20px | Newsreader 600 | A heading inside a page |
| **Body** | 15px | Source Sans 3 400 | Paragraphs, table rows, controls |
| **Small** | 13px | Source Sans 3 400 | Captions, labels, secondary lines |

**Measured before this replaced the old ramp: the site asked for twenty-five
sizes between 9px and 62px** — 91 uses of 13px, 90 of 12px, 86 of 11px, 74 of
14px, 47 of 15px, and single uses of 22, 26, 46 and 62. Neighbouring panels set
14px and 15px, which reads as a mistake rather than a distinction, and nothing
told a new screen which size to reach for.

**How the scale is held, and why it is held there.** Rewriting six hundred call
sites across thirty components would have been a very large diff for a change
nobody could check, so the scale is imposed in `src/index.css`, the way that
file already remaps stray hex values onto the palette. A screen may still write
`text-[11px]`; it gets the small step. That is the point — **a twenty-sixth size
cannot be introduced by writing one.** `src/design/tokens.ts` exports the four as
`SIZE` and `src/index.css` mirrors them as `--m-size-*`.

### Named Rules

**The One Pairing Rule.** Newsreader for titles, Source Sans 3 for everything
else. A screen that wants a third voice uses weight, colour or size from the
four steps. There is no editorial face, no label face and no code face, because
four faces is what made the site read as assembled rather than designed.

**The Figures Are Tabular Rule.** Every number is set with
`font-variant-numeric: tabular-nums lining-nums`, carried by the `.font-figure`
class. This replaces *The Figures Are Mono Rule*, which required JetBrains Mono
for the same purpose. The purpose was always alignment, and alignment is a
font *feature*, not a font: a monospace face buys a lined-up column by making
every letter the same width, which is a heavy price paid in the letters around
the numbers. Source Sans 3's tabular figures line up exactly as well, and the
prose beside them stays prose. `.font-figure` is the former `.font-mono`,
renamed across 343 call sites in 30 files, because a class that said "mono"
while resolving to a proportional face would be a lie in the markup.

**The Uniform Label Rule.** A label is a word, and it is set like one: sentence
case, at the small step, at weight 500, with normal letter-spacing. **No
uppercase and no tracking.**

This reverses the old rule, which set every label in spaced small capitals and
spent its text arguing about *how much* tracking — 0.16em, then narrowed to
0.11em when that read as a row of characters rather than a word. Narrowing
treated the symptom. Spaced capitals are a device, and a device used on every
eyebrow, tile name, tab and unit on every screen stops being emphasis and
becomes the voice of the site: shouted rather than set, and the single thing
that most made it look machine-made. The capitals are switched off at the
source (`.uppercase` in `index.css`, and the `EYEBROW` and `LABEL` constants in
`instrument.tsx`) rather than unpicked across three hundred call sites, so a
screen that still writes `uppercase` gets sentence case.

**The No Red Labels Rule.** The accent never carries a label. An eyebrow keeps
its oxblood hairline — the 8px rule beside the words — and the words themselves
are muted. Oxblood as text survives only where it is a signal that is meant: a
link, a changed figure, a refusal. A label set in the accent colour on every
section is the same mistake as spaced capitals, made in colour.

**The 13px Floor Rule, and no exemptions.** Nothing is set below 13px, and the
top bar no longer needs the exemption it used to be granted. It carries seven
labels, a clock and two buttons on a fixed 1440px rule, and at 13px in spaced
capitals the last three wrapped — so it was held at 12px. Sentence-case labels
without tracking are narrower than spaced capitals, so the same seven fit at
the small step. **The floor is now true everywhere on the site.**

**The Prose Is Not A Table Rule.** What distinguishes a column of figures from
a sentence is the tabular setting, not the family. Both are Source Sans 3, so a
disclosure summary, a basis sentence and a figure can sit in one row without the
row changing its mind about itself. The old rule here — that monospace carries
numbers, tickers, codes and units while sentences take Inter — was a boundary
that had to be policed on five screens and 103 passages; it needs no policing
now, because there is no second face to cross into.

**The Families Live In The Tokens Rule.** `src/design/tokens.ts` exports `TYPE`
and `SIZE`; `src/index.css` mirrors them as `--font-*` and `--m-size-*`; every
rule and every component reads those. **No component and no stylesheet rule
names a font family literally.** Changing the pairing is changing `TYPE`, the
four `--font-*` properties and the one `<link>` in `index.html`.

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

### Sections: Rules And Space, Not Boxes

**A section is a hairline above it and space, not a container.**
`border-t border-line pt-8 sm:pt-10`, full width to the page gutter, no
background and no side or bottom border.

**Why the step exists.** Every section used to be `border + bg-panel + p-7`,
stacked. Measured, the company screen drew 50 bordered-and-filled boxes. Each
one was defensible on its own; together they said that the screen is a pile of
separate cards, when it is one continuous argument about one company — the
ratios are not a different document from the valuation above them. A reader
scanning for a figure was crossing a border every time, and a border reads as
"new thing, re-orient". Rules and space say "still the same document, next
part", which is what is true.

**One raised surface, then a document.** The verdict block keeps its panel,
because it is the object the screen exists to deliver. Everything below it sits
on the page. Exactly one thing being raised is what makes raising it mean
anything.

**What stays a box.** Things that are genuinely objects rather than parts of the
argument: a metric tile, a chart panel, the news strip, an overlay. The test is
whether it would still make sense lifted out and put somewhere else. A section
would not; a tile would.

**This raises contrast rather than lowering it.** Text moved from `panel`
(#111114) onto the darker `page` (#0B0B0D), so every ratio in the sweep improved
or held. Nothing got harder to read.

### A Fixed Bar And The Page Beneath It

**A bar pinned to the viewport is painted over the page, never laid out in it.**
The page clears it only if something measures it. Never a constant.

`useBottomBarInset` (in `instrument.tsx`) puts a `ResizeObserver` on the bar and
writes `--bottom-bar-inset`; `body` in `index.css` reads it. A screen with no
bar is unaffected, because the fallback is `0px`.

**The inset goes on the document, not on the screen's own panel.** This is the
part that is easy to get wrong and was: the figures screen padded its content
div, which looked correct and fixed nothing, because the footer is rendered by
the screen's *parent* and follows it. Measured, the disclaimer ran **48px under
the bar** at every width with that padding in place. A bar fixed to the viewport
covers the document, so the document carries the inset.

**Why not a constant.** The figures screen used `pb-40` — 160px, a guess about a
height nobody had measured. The bar is 79px on a desktop, 123px at 360px wide,
and **184px at 360px once a figure is corrected**, because correcting one adds a
Reset button and wraps the row. The guess was smaller than the thing it was
guessing at.

**On a phone, also the safe area.** The browser's own chrome is drawn over the
bottom of the viewport, so a bar at `bottom: 0` puts its buttons underneath it.
The bar carries `padding-bottom: env(safe-area-inset-bottom)`, which needs
`viewport-fit=cover` on the viewport meta or it resolves to zero. Both, or
neither does anything.

**Checked, not remembered.** `verify:dashboard` scrolls the figures screen to
the end at 360px, with and without a corrected figure, and asserts the page's
last ink ends above the bar. Asking instead whether some *control* lands under
the bar passes throughout the defect — that is luck, not clearance.

### Cards / Containers
- **Corner Style:** square (0px).
- **Background:** `panel`. A metric tile is `panel` **on the page ground** —
  this inverted when sections stopped being boxes. A tile used to be page-
  coloured so it read as a well cut into a panel; with the panel gone it would
  have been invisible against the ground it was contrasting with, so the tile is
  now the raised surface and the ground is the page. The relationship is the
  same; which side carries it swapped.
- **Shadow Strategy:** none — see Elevation & Depth.
- **Border:** 1px hairline on an object; a **section** gets a top hairline only.
  Internal divisions within a panel divide with a hairline rather than a gap.
- **Internal Padding:** 20px horizontal / 16-24px vertical on a panel (24px side
  padding at `lg`); 16px / 14px on a metric tile. **A section has no horizontal
  padding** — it aligns to the page gutter, which is what makes the rule above
  it read as a rule rather than as the top edge of a box.
- **Measure:** with sections full-bleed, nothing constrains prose any more, so
  the line length is capped in CSS at **76ch** rather than by panel padding. See
  the note on `.max-w-2xl` in `index.css`; before the cap the ratios intro ran
  to about 160 characters.

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

**Section tabs, inside a screen.** A company has one address per section
(`/company/RELIANCE.NS/overview`), and the tabs that move between them are a
row directly under the identity block, not a second bar at the top of the
page: the fixed header already owns that edge, and two bars of chrome above
the first figure is the clutter the first principle forbids.

The row is the panel ground inside the same hairline box as the block above
it, with a hairline between tabs; the current tab takes the page ground and a
two-pixel oxblood underline drawn as an inset shadow, so the tab reads as cut
out of the bar rather than painted on it. Labels are the small step in muted,
ink on hover, and the row scrolls horizontally on a phone rather than wrapping
to two lines or collapsing into a menu — nine sections wrapped is a paragraph
of chrome, and a menu hides the fact that the sections exist.

**THE RULE OF THE EMPTY END.** The hairlines between tabs are drawn by the
tabs, never by letting a line-coloured ground show through a gap. Drawn the
second way, the space to the right of the last tab is a slab of line colour
across the page — which is what it was at first, and it reads as a broken
element rather than as a divider.

**A tab that is not built shows one line and nothing else.** A heading, a
neutral "being built" pill, and the sentence naming what it will carry. No
greyed-out table, no placeholder rows, no empty state dressed as a company
with no data: a mocked-up section is the most convincing false claim a site
can make, and standing decision 7 forbids it.

### Signature Components

**Figure.** An eyebrow in quiet above, the number large and alone, an optional
pill on its baseline and an optional quiet footnote beneath. `scale="hero"` is the
one figure the screen exists to show.

**A figure is always ink, and there is no option to make it otherwise.** It had a
`tone` prop, and the intrinsic value was set in oxblood through it — which on a
dark instrument screen reads as a warning rather than as the headline it is: a red
number is the one that has gone wrong. The red belongs to the mark and to a signal
that is meant, which is the premium badge on the figure's own baseline. The prop
was removed rather than left unused, because an option to make a figure red is an
invitation to.

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

**PriceChart.** Plain SVG, no charting library. A library decides for itself
what to do with a gap in the data, and the one thing this chart must never do
is join a line across a ratio that does not exist; every decision about an
absence is made in the data layer, where the suite can measure it, and the
component only draws what it is given.

The price is a 1.5px ink line over a fill that fades from 10% ink to nothing.
Range and overlay chips are the chip component. Axis labels are 11px quiet,
tabular; the crosshair is a quiet 3/3 dash with a 3px ink dot. The readout
sits in a fixed place under the chart rather than following the pointer: a
tooltip that moves makes the eye chase it, and the figures it carries are
meant to be compared with the ones above.

**THE TWO-AXIS RULE.** The price owns the left axis and an overlay owns the
right, always, and an overlay is drawn in amber so it cannot be mistaken for
the price. They are never put on one scale: a price-to-earnings of 46 and a
price of $344 share an axis only by flattening one of them into the baseline,
and a flat line is a claim about a quantity that did not move.

Where an overlay carries two lines — sales and the margin on it — **each gets
its own scale**, the second is drawn dashed in read oxblood, the right axis
labels the first, and the caption says which axis belongs to which. The
alternative, normalising both onto one axis, draws two shapes that are true
only relative to themselves and leaves the reader no way to know it.

**A gap is a gap.** Where the series has no point — a loss year with no
price-to-earnings, a day before the earliest filing — the path breaks and
starts again rather than bridging. The readout says so in words too, because
a reader pointing at that stretch is owed a reason and not a blank.

**BuildPipeline.** The overlay a reader waits on, and the only screen seen on
every single build: a capped progress rule with the stage named beneath it in
the quietest type on the card, and one myth-versus-fact card. The card is the
content and the progress is the furniture.

**The Common Myth Rule.** The card carries the label **"Common myth"** — the
eyebrow, sentence case, 13px, quiet — and nothing on the screen, with the ⓘ
open or closed, says *this company*. The sixty cards are about how accounts
behave, not about whoever is being built; the same sentence introduced as a
finding about the company on screen is a verdict on a security, which standing
decision 6 does not allow. The sentence behind the ⓘ still gives the condition
that picked the card, because the reader is owed it, and still puts it as
education: *"General education, not a verdict on anyone. This card is shown
where the filings being read meet — …"*

**The No Flicker Rule.** Nothing is shown for the first second. Answers are
cached at the edge, so a company somebody looked at this morning can come back
in a few hundred milliseconds, and a card that appears and goes inside that is
a flicker rather than a sentence. A build that finishes inside the second
closes with the progress rule as its only content, which is honest: there was
nothing to wait through. The rule generalises — **a screen does not show
something it is about to take away.**

**The Two Beats Rule, and the card that does not move under the reader.** The
belief first, alone; the correction a beat later (2.2s). A fact printed under
the belief at the same instant is a caption on it, and a reader has to have had
the chance to agree with the myth for the correction to land. **The beats are
scheduled once**, and the card may be replaced only while its myth is still
alone. Restarting them when better data arrives reads well and loses the fact:
the overlay closes as soon as the work is done, so a correction rescheduled
late is a correction the reader never sees. A belief shown without its
correction is worse than showing nothing, because the belief is the half that
is wrong.

**A tooltip is not a title.** The ⓘ panel is prose: sans, weight 400, upright,
13px, whatever it hangs off. It used to inherit, which was invisible while
every ⓘ sat on a sans table row and produced three lines of Newsreader medium
the first time one was put at the end of a display-face sentence.

## Do's and Don'ts

### Do:
- **Do** take colour from the ramp by utility name (`text-ink`, `bg-panel`,
  `border-line`, `text-accent-text`), which resolves through `--m-*` to
  `src/design/tokens.ts`.
- **Do** set every number with `.font-figure`, which carries `tabular-nums` and
  `lining-nums`, including any number that tweens.
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
- **Don't** name a font family in a component or a stylesheet rule. Families come
  from `TYPE` in `src/design/tokens.ts` and nowhere else.
- **Don't** add a `box-shadow`, a glow or a gradient to lift a surface.
- **Don't** set type below 13px. There is no exemption any more, including the top bar.
- **Don't** add a font size between the four steps; the remapping block in
  `index.css` will snap it onto one of them anyway.
- **Don't** set a label in capitals, track it out, or colour it with the accent.
- **Don't** leave a browser default on the scrollbar, the selection, the caret or
  the focus ring.
- **Don't** loosen tile or row padding into an airy grid; density is the register.
- **Don't** round, rename or re-derive a token hex. The frontmatter values are the
  measured ones.
