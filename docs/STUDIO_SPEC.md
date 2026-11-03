# STUDIO_SPEC

Marginalia · visual pack 6 · the model studio: Figures → Judgements →
Valuation → Outputs · v1.0 · 4 November 2026 · obeys `docs/VISUAL_SYSTEM.md`
v1.0 and the decisions at its top (ⓘ stays, 24×24 hit area, 44×44 on touch;
Dark is the only instrument theme; no 3D on data screens), `DESIGN.md`,
`docs/VALUATION_SIDE_BY_SIDE_SPEC.md` (never averaged; the bridge's parts add
up exactly), `docs/TEARSHEET_SPEC.md` (with its 4 November decisions),
`docs/COMPANY_OVERVIEW_SPEC.md` and `docs/TABLES_SPEC.md` for shared tile and
table rules. Written for build step 9; the valuation bridge and the finished
side-by-side are build step 5 (`docs/STEP5_BUILD_PLAN.md`).

Markers: KEEP, ADD, CHANGE as in VISUAL_SYSTEM. **PROPOSED — needs Nihar** =
my choice where the docs are silent; all listed in section 10. [CONFIRM] = not
checkable from the repository.

## 0. Basis and limits

- Written from the code on 4 November 2026: `src/App.tsx` (the screen
  values and the flow), `src/components/DirectoryScreen.tsx` (search and the
  build pipeline), `figuresEditor.tsx` (1,333 lines), `figuresHint.tsx`,
  `qualitativeIntro.tsx`, `qualitative.tsx`, `src/data/qualitativeFactors.ts`,
  `TerminalDashboard.tsx` (2,311 lines), `valuationSections.tsx`,
  `valuationExtras.tsx`, `howCalculated.tsx`, `nerdViews.tsx`,
  `compsPanel.tsx`, `assetPanel.tsx`, `residualIncomePanel.tsx`,
  `terminalReliancePanel.tsx`, `motionPrimitives.tsx`,
  `savedModelsPanel.tsx`, `houseTemplatePanel.tsx`, `batchPanel.tsx`,
  `src/data/healthScore.js`, `src/data/autoCompany.ts`, `src/data/companies.ts`
  (`valuationBandsFor`), `src/data/marketApproach.ts`, `assetApproach.ts`,
  `reverseDcf.ts`, `src/engine/model.js`.
- No browser measurement. Sizes are what the source asks for; where
  `src/index.css` remaps a size or cancels `uppercase`, the rendered value is
  the remapped one, and the finding is about the source.
- Outside websites were blocked; no new references.

## 1. The flow today, and the flow specified

### 1.1 Today (from `App.tsx`)

Everything after the company page lives at `/` as one `useState` value:

| Screen value | Component | What it is |
|---|---|---|
| `DIRECTORY` | `DirectoryScreen` | Search a company, "Build model", the build pipeline card |
| `FIGURES` | `FiguresEditor` | Filed lines under model heads; correct, move, reason; adjusted EBITDA bridge; "Build the model" in a bottom bar |
| `QUESTIONS` | `QualitativeIntro` | 23 qualitative questions (helps / neutral / hurts), skippable |
| `ANALYSIS` | `TerminalDashboard` | Valuation headline, outputs (three Excel downloads), five tiles, ratios, an "analytics row" (revenue bars, a sensitivity heatmap, a health-score radar), how it was calculated, football field, what the price assumes, full working, comps, asset, qualitative adjustments, house template, batch, saved models |

There is no step indicator, no address per step (Back leaves the studio),
and outputs are buttons inside the valuation screen. The company page's Model
tab opens this flow (`openModelFromHub`).

### 1.2 Specified: four steps, four addresses (PROPOSED — needs Nihar)

`/company/:ticker/model/figures` · `/judgements` · `/valuation` ·
`/outputs`. They sit under the company hub's Model tab (one web address per
company, `docs/VISION.md` §4; the router already parses
`/company/:ticker/:tab`), so the studio is the Model tab opened, not a second
place. Back moves one step.

### 1.3 The step bar (ADD)

- Sticky under the global header at y = 64, height 48, full content width
  (1344 at 1440), page ground, 1px line top and bottom (no hairline wider than
  the content, VISUAL_SYSTEM finding 11).
- Left: `{TICKER}` Label 13 600 ink · company name Body 15 read, truncating.
- Centre-left at x = 48 + 320: four steps as a segmented row, each 160 × 48:
  `1 Figures`, `2 Judgements`, `3 Valuation`, `4 Outputs`; number and label
  Body 15. Rest muted; done: read with a 16px check glyph in quiet; current:
  the system's one selected state (panel ground, 1px accent border, ink,
  weight 600). Every step is reachable at any time once the model is built;
  before the first build, 3 and 4 are disabled (40% opacity label kept
  legible, `aria-disabled`).
- Right: the judgement count `3 corrected · 2 moved · 4 answered` (Small,
  read; replaces the header's "Check the figures" control, which NAV_SEARCH
  removes from the global header) and the step's one primary action:
  Figures `Build the model` / `Rebuild with changes`; Judgements `Apply to the
  model`; Valuation none (VISUAL_SYSTEM: one primary per screen, and this
  screen's action is the next step); Outputs `Download Excel model`.
- 390: the bar is 48 tall with the four steps as a segmented control filling
  the width (85.5px each, number above a 13px label), ticker and count move
  to a second 32px row; the primary moves to the bottom bar (existing
  `useBottomBarInset`).

### 1.4 Frame

KEEP COMPANY_OVERVIEW §1.1: container 1440 with 48px gutters (content 1344),
24px under 1024 (content 342 at 390). Panels: panel ground, 1px line, radius
0, padding 24 (16 phone), gap 24 (16). Type: the four DESIGN.md steps plus
the tile figure 24/28. COMPANY_OVERVIEW §1.3's 40/44 hero figure is mapped by
its decision D1 onto the nearest DESIGN.md step, so a hero figure here is
Source Sans 3 600 tabular at the Title size, `clamp(28px, 2.8vw, 36px)`
(`docs/VISUAL_BUILD_PLAN.md` contradiction C5). Content starts at y = 64 + 48 + 24 = 136.

## 2. Step 1 — Figures

### 2.1 What the code does (KEEP the behaviour)

`figuresEditor.tsx`: one table per statement, lines grouped under the model
head the engine forecasts them on (`heads.ts`), with:
- **Edit in place**: click a figure, type, Enter or blur commits; the filed
  figure stays behind the corrected marker with a way back.
- **Move a line**: only the grip (`GripVertical`) is draggable, so clicking a
  figure still places a caret (the bug the file header records); each row
  also has a row menu (`RowMenu`) offering the same move, which is the
  keyboard and touch path.
- **Reason**: an optional one-line field under a changed row, "Add a reason
  (optional)", never blocking.
- **Reset all**: one link that undoes every correction and move.
- The adjusted EBITDA bridge as a disclosure under the statements.
- `StaleFigures` band at the top (KEEP).
- The four states kept apart: reported plain, corrected marked, reclassified
  marked naming the head it left; modelled figures are not on this screen.

### 2.2 Layout at 1440

- Title row: h1 `The figures` Title with the mark; one line of instruction
  Body 15 read, max 640: `Click a figure to correct it. Drag a line by its
  grip, or use its menu, to put it under another head.`
- One statement at a time, chosen with a segmented control `Income
  statement | Balance sheet | Cash flow` (32 high, line-control border,
  selected per VISUAL_SYSTEM 3.1), because a 10-year table at 1344px needs the
  full width (TABLES_SPEC).
- Table: TABLES_SPEC rules (KEEP): sticky header row and first column; label
  column 320; year columns right-aligned, one decimal rule per row
  (`figureFormat.ts`), one right edge per column; row height 40; head rows
  Section-free — a head is a 40px row with Label 13 600 muted and a 1px line
  above, not a heading element with a paragraph.
- Row anatomy, left to right: grip 24×40 (visible on row hover or focus,
  always visible under `pointer: coarse`), label Body 15 read, figures Body 15
  tabular ink, row menu ⋯ 24×24 at the right edge.
- State markers (ADD, so they read in greyscale): corrected figure in ink with
  a 1px accent-text underline and a superscript `c` in quiet; reclassified
  line with `from {head}` Small quiet after the label; reported plain. The
  changed figure is the one allowed accent-text word per edit (VISUAL_SYSTEM
  3.1).
- Drop target: while dragging, every head that accepts the line shows a 2px
  line-control dashed top border; the hovered target shows a 1px accent
  border (selected state). Heads that cannot accept it are 40% opacity.
  `dropTargets()` already decides which.
- Reason field: appears under the row, indented to the label column, Small
  13, read, 1px line-control bottom border, max 480; saved on blur.
- Undo (ADD): `Undo` and `Redo` ghost buttons left of the judgement count in
  the step bar, with ⌘Z / ⌘⇧Z (Ctrl on Windows) while focus is not in a text
  field; 50 steps; an undo restores both the figure and its reason. Today
  only `Reset all` and the per-figure way back exist. (PROPOSED — needs Nihar:
  50 steps, session only.)
- After any change, the step bar's primary reads `Rebuild with changes` and a
  one-line note under the title, Small read: `The valuation below this point
  is from before your changes.` (only once a model exists).

### 2.3 390

One statement at a time (segmented control full width). The table scrolls
sideways inside its own container with the label column pinned at 40% width
(TABLES_SPEC), a visible scroll cue (8px fade of the panel ground at the right
edge — a fade on content, not chrome, PROPOSED — needs Nihar; alternative: a
`Scroll for more years →` caption). Drag is not offered on touch; the row
menu is the only move path (48 × 48 target). Reason field full width.

## 3. Step 2 — Judgements

### 3.1 What exists

Judgements are spread across four places today:
1. The **23 qualitative questions** (`qualitativeIntro.tsx` before the build,
   `qualitative.tsx` after it), each answered helps / neutral / hurts, moving
   named drivers by stated, capped amounts (`qualitativeFactors.ts`).
2. **Expense classification and one-offs**, on the figures screen (heads).
3. **Cost-of-capital edits** on the company page's card (risk-free, beta,
   premiums, country risk; COMPANY_OVERVIEW §4).
4. **Model choices inside the valuation screen**: drivers moved in the
   walkthrough (`howCalculated.tsx`), the peer set (`compsPanel.tsx`),
   recovery rates (`assetPanel.tsx`, the only `type="range"` slider), the
   derived/analyst view switch.

### 3.2 Specified

One screen that lists every judgement the model rests on, grouped, each row
showing the four facts standing decision 2 requires: **the judgement, its
default, where the default came from, and the value used** — plus the
reader's reason when given.

- Groups (Section headings): `What the business is` (the qualitative
  questions), `Which figures count` (classification, one-offs — read-only
  here with `Change on the Figures step →`), `Cost of capital`, `Forecast
  drivers`, `Comparables`, `Asset recoveries`.
- Row: 56 min-height; columns at 1440: Judgement 360 · Default 200 · Source of
  the default 320 · Used 200 · Reason (rest). Changed rows: `Used` in ink
  weight 600 and the word `changed` in Small quiet beside it (no accent: a
  long list of changed rows would exceed the accent budget); unchanged rows
  `Used` reads `default` in quiet.
- The qualitative question row: question Body 15 ink, then the three answers
  as a segmented control (32 high), then the drivers it would move and by how
  much, Small read, e.g. `Operating margin +0.5 pt · capped at +1.5 pt in
  total` (KEEP the caps).
- Primary `Apply to the model` (enabled only when something differs from the
  last build). Nothing moves the valuation until it is pressed (KEEP the rule
  in `qualitative.tsx`).
- 390: one column, each row a Disclose: question and `Used` on the closed
  row, default, source and reason inside.

### 3.3 The sliders can mask a judgement (CLAUDE.md trap)

The screen asserts **state**, not only value: a driver pinned by a slider
still shows the classification or answer that would otherwise have moved it,
with `Overridden by your forecast driver` in Small quiet.

## 4. Step 3 — Valuation

### 4.1 Order of the screen (1440)

1. **Headline block** (panel): the approaches' values in one row of cells,
   never one combined figure.
2. **Side by side** — the football field (4.3).
3. **Reverse DCF** — what the price assumes (4.4).
4. **Sensitivity** — WACC × terminal growth and WACC × exit multiple (4.5).
5. **How it was calculated** (the existing walkthrough, `howCalculated.tsx`),
   **Market approach** (`compsPanel.tsx`), **Asset approach**
   (`assetPanel.tsx`), **Residual income** for banks — each a panel, closed to
   its headline line by default (Disclose), open on demand.
6. **Terminal reliance** (`terminalReliancePanel.tsx`, KEEP — how much of the
   value lies beyond the forecast).
7. **Valuation bridge** between two saved versions (4.6), when two exist.
8. **Full working** (`nerdViews.tsx`), last.

The **health score card and its radar are removed** (conflict 1), and the
five reported ratios move into the Ratios table as plain ratios with their
formulas.

### 4.2 Headline block

- Cells, in a hairline grid (KEEP the pattern): `Income · perpetuity growth`,
  `Income · exit multiple`, `Market · peer multiples` (median of usable
  implied values, with low–high under it), `Asset · {measures}`
  (low–high; point only where one measure survives), and `Price`. Banks:
  `Income · residual income`, `Asset · book`, `Price`.
- Each value cell: eyebrow Label 13 muted, figure in the hero step (Title size, see §1.4) for
  the first cell and the tile step 24/28 for the others (one hero per
  screen), and one line Small read: `Price {12.3}% above` / `below`. **No
  pill colour carries the sign** (CHANGE: today premium is a red "negative"
  pill and discount a green "positive" pill — a traffic light, VISUAL_SYSTEM
  finding 21, and an opinion by colour, standing decision 6). Neutral pills
  at most, with the word.
- A refused approach's cell holds its refusal sentence in Body 15 read, not a
  dash (VALUATION_SIDE_BY_SIDE rule 6).
- The price cell: `Price, close {date} {time} UTC` — the **price the
  valuation was struck at** (4.7). If a newer quote exists, a second line
  `Latest {price} at {time}; the valuation uses {struck price}` and the
  step bar shows `Rebuild at the latest price` as a ghost button.
- Numbers never tween, never flash (CHANGE: `TweenNumber` and `FlashOnChange`
  today animate 450–700ms and tint green/red on change). The changed figure
  after an edit turns accent-text with an instant swap (VISUAL_SYSTEM §4).
- Currency line (KEEP): where the statements and the listing differ, each
  value also in the trading currency at the one disclosed rate.

### 4.3 Side by side — the football field (VALUATION_SIDE_BY_SIDE Part 1)

- Panel title `Three approaches, side by side` Section 20; caption under it,
  Small read: `Shown side by side; not combined.` (rule 8; missing today).
- One row per approach, in this order: Income — perpetuity growth; Income —
  exit multiple (labelled as an income approach carrying a market assumption,
  `METHODOLOGY.md` §20); Market — peer multiples; Asset — book, tangible
  book, net current assets (and liquidation at the reader's recoveries);
  then the reference row `52-week trading range — reference, not a valuation`.
- Row geometry at 1440: label column 320 (Body 15 ink, then Small read with
  the flexed assumptions, e.g. `growth 2.0–4.0%, WACC 9.1%`), bar track 640,
  figures column 384 (`low – high`, point, `Price x% above/below`). Row height
  56 (well above 24, rule 10). One shared per-share axis, ticks Small 13
  quiet, at most 5 gridlines, no vertical gridlines except the price line.
- Bars: approaches as solid fills in `read` at 100% with a 2px ink tick at
  the engine's point; the reference row as a 1px line-control outline with a
  dashed edge and no fill. **No approach is oxblood** (CHANGE: today the
  income bars are oxblood, the market bar pale, the asset bar dashed — colour
  doing the labelling and oxblood spent on two bars). The current-price line is
  the chart's subject series, 1px **ink** (VISUAL_SYSTEM §3.2: S1, the
  subject, is ink; the only categorical oxblood is the this-model forecast
  line), labelled with the price and date at the top of the axis. Nothing in
  the chart is oxblood.
- A refused approach is a row with its refusal sentence across the bar track
  (CHANGE: today an unavailable market or asset approach simply has no row).
- If no two approach ranges overlap: one Small read line `The ranges do not
  overlap.` (rule 7). Nothing else is said about the gap.
- `View as table` toggle (rule 10), same columns.
- 390: label above a full-width bar, low and high at the bar ends, one price
  line; tap a row for a bottom sheet with its assumptions.

### 4.4 Reverse DCF — what the price assumes

KEEP `reverseDcf.ts`. Panel: `What the price assumes`; one sentence, Body 15:
`At {price} the model needs revenue growth of {x}% a year for {n} years,
against {y}% in your forecast` plus the other implied figures as a 3-column
table (figure, implied, yours). Solved at the **struck price** (4.7). If no
solution exists, the reason, not a blank.

### 4.5 Sensitivity

- Two grids: WACC × terminal growth (perpetuity value) and WACC × exit
  multiple (exit value). 5 × 5, steps of 0.5 pt and 0.5 turn around the
  current inputs, current cell outlined 1px accent.
- **Every cell computes at the inputs its row and column print** (conflict 3:
  today's grid clamps WACC to ≥ 4% and growth to ≥ 0.5% inside the
  computation while the axis prints the unclamped value). Where an input is
  not admissible (growth ≥ WACC, a negative rate), the cell reads `n.m.` and
  the axis still prints the true input.
- Cells print their value (Small 13 tabular). Shading, if any, is the
  VISUAL_SYSTEM diverging ramp around the **struck price**, with every cell's
  value printed; no hover scale (CHANGE: `hover:scale-105` today).

### 4.6 Valuation bridge (VALUATION_SIDE_BY_SIDE Part 2, build step 5 C)

- Between two saved versions of the same model and metric. Shapley
  attribution by default; parts sum exactly to the total, with a visible
  line `Parts {sum} = total {Δ} ✓` (rule 17).
- Desktop: vertical waterfall, start bar (version A value), one bar per
  driver sorted by absolute size, end bar (version B value); increases in
  `read`, decreases in `quiet` outlined — sign carried by the `+`/`−` label
  and the bar direction, not by green and red. Under it a table: driver ·
  A value · B value · value change · % of total (`n.m.` when the total is
  near zero, rule 19).
- Phone: horizontal waterfall sorted by size, each row `driver, from → to,
  signed change`, pinned total row (rule 24).
- Wording `associated with`, never `caused by` (rule 22); method line rule 23.
- New data between versions is its own driver, `New filings` (rule 18).

### 4.7 Every figure on this screen reconciles with its inputs (ADD)

1. One price per valuation: the price the model was struck at (it sets the
   equity weight in WACC). Every premium, the reverse DCF, the sensitivity
   shading, P/B and the tearsheet use that price. A newer quote is shown as a
   fact beside it, never silently swapped in (CLAUDE.md "the share price is a
   valuation input"; conflict 2).
2. A value displayed under a label is the value computed for that label —
   no fallback from one method's figure into another's cell (today the
   perpetuity cell falls back to `dcfResult.targetPrice` when the perpetuity
   band is absent; [CONFIRM] it is always the same figure, then remove the
   fallback).
3. A missing input is shown as missing: no `?? 0` into a displayed ratio
   (conflict 4).
4. A check in `verify/dashboard.mts` recomputes every displayed figure from
   the inputs shown beside it, the way the screen says it computes them
   (CLAUDE.md "compute the expected value the way the screen computes it").

## 5. Step 4 — Outputs

- One panel per output, in a 2-column grid at 1440 (660 each), one column at
  390. Each: title Section 20, one line on what it is, what it contains, the
  file format, and its action. One primary on the screen: `Download Excel
  model`; everything else ghost.
  1. **Excel model** (KEEP `excelExport.ts`): `Download Excel model`; with a
     house template saved, `Download in {template}` and `Download in
     Marginalia's layout` (KEEP the existing pair).
  2. **Peer workbook** (KEEP): target and up to ten peers.
  3. **House template** (KEEP `houseTemplatePanel.tsx`) — upload, map,
     remove.
  4. **One-pager and two-pager** (TEARSHEET_SPEC): a thumbnail of the
     page (Paper sheet, 1px line, 160px wide), `One page | Two pages`, `A4 |
     Letter`, `Print / save as PDF` (D6: the browser print button ships
     first), later `Download PDF`. The development-only banner state is stated
     on the panel: `Contains vendor data: development only.`
  5. **Saved versions** (KEEP `savedModelsPanel.tsx`): each with the figure
     it was saved at beside the figure it reopens at; `Compare two` opens the
     bridge (4.6).
  6. **Batch** (KEEP `batchPanel.tsx`): run the same judgements over a list.
  7. **Being built** (standing decision 7): Research pack, Word report,
     PowerPoint pages — text with `being built`, no button.

## 6. Motion (tokens only, VISUAL_SYSTEM §4)

| Motion | Where | Properties | Token |
|---|---|---|---|
| Step change | main region | opacity; translateY 8px→0 | out 120ms `--m-ease-exit`, in `--m-dur-slow` 280ms `--m-ease-enter` |
| Statement switch, view-as-table | panel content | opacity cross-fade | `--m-dur-fast` 110ms |
| Drag | the dragged row | transform only (follows pointer, no easing) | — |
| Drop | row settling in its new head | transform → 0 | `--m-dur-base` 200ms `--m-ease-standard` |
| Undo / redo | the figure | instant value swap; accent-text colour on | `--m-dur-fast` 110ms colour |
| Disclose panels | §4.1 item 5 | height, opacity; chevron | `--m-dur-base` 200ms / 140ms |
| Football field, waterfall first mount | the chart container | `clip-path: inset(0 100% 0 0)→0` | `--m-dur-chart` 640ms `--m-ease-enter` once per page view (COMPANY_OVERVIEW D7 caps draw-in at 400ms + 200ms on the Overview's page-load budget — PROPOSED — needs Nihar: same 400 + 200 here) |
| Data change (after Apply or rebuild) | charts | none — redraw instantly | 0 |
| Hover | rows, bars, cells | colour only | `--m-dur-fast` 110ms |

Forbidden here (CHANGE where built): number tweens (`TweenNumber`), flash on
change (`FlashOnChange`), the health radar's 900ms polygon morph, hover
scale on sensitivity cells, staggered tile entrances, `transition-colors
duration-500/700` literals.

### 6.1 Reduced motion

All translate and clip-path go to 0; step change and cross-fades opacity-only
≤ 110ms; the dragged row still follows the pointer (it is direct
manipulation, not animation) but the drop snaps; Disclose snaps; charts appear
complete.

## 7. Accessibility

- Drag always has the row-menu equivalent (KEEP); the menu is reachable by
  Tab and opens with Enter; moving announces `Moved {line} to {head}` via
  `aria-live="polite"`.
- Editing: each figure is a button that becomes an input; Esc cancels, Enter
  commits; the corrected marker is in the accessible name (`corrected; filed
  {x}`).
- Charts have a table alternative (football field, waterfall, sensitivity).
- Targets ≥ 24×24, ≥ 44×44 on touch; the grip 24×40 desktop, absent on touch.
- Focus ring 2px ink, offset 2px; nothing focused under the 64 + 48px sticky
  bars (`scroll-padding-top: 136px` on studio routes, ADD).

## 8. Conflicts found in the current code

Severity: **H** breaks a stated rule or hurts data trust; **M**
inconsistency; **L** polish.

| # | Where | Finding | Fix | Sev |
|---|---|---|---|---|
| 1 | `healthScore.js`, `TerminalDashboard.tsx` ~1924–2017 | **A composite "Financial health score" /100**: five ratios scored 0–100 against fixed thresholds and averaged, shown as a radar and an oxblood `{n}/100` badge. A score is a verdict, not a fact (standing decision 6). Its own text characterises numbers: "Below 1.0x is a warning; 2.0x is comfortable", "above 4.0x is heavily geared", "2% is thin, 25% is strong", "the classic warning sign in accounting fraud". The thresholds are ours and unsourced (standing decision 2). | Remove the score, the radar and the badge; keep the five ratios as plain ratios with formulas in the Ratios table; move the definitions to Margin notes without the threshold words. | H |
| 2 | same | **The radar's axes are mislabelled**: `toRadarMetrics` maps leverage onto `cashFlowCoverage`, profitability onto `accrualRisk` and return on assets onto `valuationMoat`, and the fallback grid prints "Moat Rating: {return-on-assets score}%" and "Cash Flow: {leverage score}%". The figure under each label is not the label's figure. | Removed with 1. | H |
| 3 | same | **Missing data scored as zero**: `toRadarMetrics` uses `score ?? 0` and `overallScore: health.overall ?? 0`, so a ratio the filing cannot support is drawn as the worst score (standing decision 3). | Removed with 1. | H |
| 4 | `TerminalDashboard.tsx` ~363–424, ~1087, ~1133 | **Two prices on one screen.** The model is struck at `company.price` (the stored price; it sets the equity weight in WACC), but the headline premiums, P/B tile, reverse DCF and football field use `displayPrice` (a live quote fetched after load), while the sensitivity shading and the (unused) `premiumToModelPct` use `company.price`. A premium can be measured against a price the value was not computed at. | §4.7 rule 1. | H |
| 5 | `TerminalDashboard.tsx` ~1129–1140 | **Sensitivity cells do not match their axis**: each cell is computed at `Math.max(4, wacc)` and `Math.max(0.5, g)` while the axis prints the unclamped `wacc` and `g`; with terminal growth at 1.0%, the 0.0% and 0.5% columns are both computed at 0.5% and print the same value under different labels. | §4.5. | H |
| 6 | `autoCompany.ts` ~264–266 | **Displayed ratios fall back to zero**: `roePct`, `roaPct` and `opMarginPct` use `?? 0`, so a missing ROE prints `0.0%` — a claim the company reported nil. | Print `—` with the reason. | H |
| 7 | `TerminalDashboard.tsx` ~1370–1395 | Premium pill tone `negative` (red) and discount `positive` (green): a traffic light that reads as a verdict on the security. | §4.2, words only. | H |
| 8 | `valuationSections.tsx` | Football field has no "Shown side by side; not combined." caption, no non-overlap sentence, and an unavailable approach has no row instead of its refusal (VALUATION_SIDE_BY_SIDE rules 6–8). Market range is the spread of the three implied values, not a range from flexing stated assumptions (rule 2). | §4.3; build step 5 B. | H |
| 9 | `motionPrimitives.tsx`, 17 uses | `TweenNumber` (450ms) and `FlashOnChange` (700ms) animate and tint figures green/red on change; VISUAL_SYSTEM §5 forbids any number tweening. | Instant swap; accent-text for the changed figure. | M |
| 10 | `TerminalDashboard.tsx` ~1097–1124 | Dead code that would hide judgements if revived: `applyPreset` (BULL, BEAR, FORENSIC multiply growth, margin, WACC, tax and capex by unsourced factors such as ×1.3 and ×0.9) and `premiumDiscountLabel` in capitals. Not called today. | Delete; any scenario feature goes through the judgement layer with stated sources. | M |
| 11 | `valuationSections.tsx` | Income bars in oxblood, market pale, asset dashed: colour labels the approaches and spends oxblood on two bars; numbered uppercase eyebrow `02 — valuation range`. | §4.3. | M |
| 12 | `TerminalDashboard.tsx` | 101 hex literals in the component, sizes 9/10/11/12px (remapped to 13 by `index.css`, so they render on the floor), uppercase tracked labels (`DCF SENSITIVITY MATRIX`, `FINANCIAL HEALTH SCORE`, `NO VALUE SHOWN`) written as literal capitals. | Tokens; sentence case. | M |
| 13 | `TerminalDashboard.tsx` ~1876 | `hover:scale-105` on sensitivity cells; `shadow-inner` on the readout; `transition-colors duration-500` literals. | No scale, no shadow, tokens. | M |
| 14 | Flow | No step indicator and no address per step; Back leaves the studio; outputs are buttons inside the valuation screen. | §1.2–1.3. | M |
| 15 | `figuresEditor.tsx` | No undo beyond `Reset all` and the per-figure way back. | §2.2. | M |
| 16 | `TerminalDashboard.tsx` | The stale-figures band is not shown on the valuation screen (also LEARN_STATES conflict 3). | Add. | M |
| 17 | `TerminalDashboard.tsx` | Tiles labelled `ROE (LTM)`, `ROA (LTM)` are the last fiscal year's ratios (`M.ratios.roe[last]`), not trailing twelve months [CONFIRM against `deriveModel.js`]. | Label with the basis (COMPANY_OVERVIEW D3). | M |
| 18 | `TerminalDashboard.tsx` ~2024 and ~2070 | Two elements can carry `id="working"` (bank and non-bank branches) [CONFIRM they never render together]. | One id per branch. | L |
| 19 | Engine and screen | Internal name `targetPrice` for the value per share; harmless in code, but the word is on the banned list and must never reach a label or an export. | Rename when touched (`valuePerShare`). | L |

## 9. Developer checklist

Flow
1. Each step has its own address under `/company/:ticker/model/…`; Back moves one step; a deep link to a later step before a build lands on Figures with a one-line reason.
2. Step bar sticky at y = 64, 48 tall, inside the content edges; one selected step; one primary per step (none on Valuation).

Figures
3. Clicking any figure places a caret (regression check for the draggable-ancestor bug).
4. A line moves by grip-drag and by row menu; both produce the same `HeadAssignment`.
5. Undo and redo restore figure, head and reason together; `Reset all` still works.
6. Corrected, reclassified and reported are distinguishable in greyscale.

Judgements
7. Every judgement row shows default, source of default, value used; a changed row is marked; nothing changes the valuation until `Apply`.
8. A driver pinned by a forecast slider still shows the overridden judgement (assert state, not value).

Valuation
9. No composite score anywhere on the screen (`grep -ri "health score\|/100"` in components returns nothing user-facing).
10. One price: every premium, the reverse DCF, the sensitivity shading and P/B use the struck price; the latest quote, if different, is printed as a fact.
11. Every sensitivity cell recomputes to its printed row and column inputs (check in `verify/dashboard.mts`, expected value computed independently).
12. Football field: caption present; refused approach shows its refusal in its row; non-overlap sentence when, and only when, ranges do not overlap; no oxblood anywhere in the chart; price line ink.
13. No displayed ratio is `0` where its input is missing.
14. Bridge: parts sum exactly to the total (largest-remainder rounding), reconciliation line shown; zero-change drivers show 0.
15. No number tweens or flashes; the changed figure turns accent-text instantly.

Outputs
16. One primary (`Download Excel model`); tearsheet panel offers One/Two pages and A4/Letter with the print button; vendor state stated.

Motion and accessibility
17. Every duration and curve is a `--m-*` token; reduced motion leaves no transform except direct manipulation of a dragged row.
18. Every chart has a table alternative; every target ≥ 24×24 (44×44 on touch); `scroll-padding-top: 136px` on studio routes.

## 10. Decisions for Nihar

- **S1. PROPOSED — needs Nihar.** The studio lives at
  `/company/:ticker/model/{figures|judgements|valuation|outputs}`, inside the
  Model tab, rather than at a separate `/studio/` address.
- **S2. PROPOSED — needs Nihar.** Remove the financial health score, its
  radar and its badge entirely (conflicts 1–3), keeping the five ratios as
  plain ratios. This removes a feature `ROADMAP.md` §3 lists as LIVE ("Health
  score") and `docs/VISION.md` does not mention; consistent with standing
  decision 6 and with `docs/FEATURES.md`'s own answer to Simply Wall St's
  snowflake (factual checks, not a scored shape), but a removal, so it is
  yours to confirm. `ROADMAP.md` would move it to "Decided against" with the
  reason (another session owns that file).
- **S3. PROPOSED — needs Nihar.** One price per valuation: the struck price,
  with a newer quote shown beside it and a `Rebuild at the latest price`
  action, rather than silently re-pricing (conflict 4).
- **S4. PROPOSED — needs Nihar.** Undo and redo, 50 steps, held for the
  session only.
- **S5. PROPOSED — needs Nihar.** One statement at a time on the Figures
  step with a segmented control, rather than all three stacked.
- **S6. PROPOSED — needs Nihar.** Football-field bars in `read` for every
  approach and an ink price line; nothing in the chart oxblood; approaches
  told apart by label.
- **S7. PROPOSED — needs Nihar.** The chart draw-in on the studio's charts
  uses COMPANY_OVERVIEW D7's 400 + 200ms rather than VISUAL_SYSTEM's 640ms.
- **S8. PROPOSED — needs Nihar.** A right-edge fade as the sideways-scroll
  cue on phone tables, or a text caption instead.
- **S9. PROPOSED — needs Nihar.** Delete the unused BULL / BEAR / FORENSIC
  presets rather than keep them for later (conflict 10).
