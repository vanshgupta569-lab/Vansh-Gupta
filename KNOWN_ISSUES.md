# Known issues

**Our own mistakes: things the model does incorrectly.** Every entry here is
something this repository got wrong and can fix. The list is meant to reach
zero.

Two kinds of entry that used to live here have moved, because they are not
mistakes and would never be fixed:

- **How the engine works, and why** is in `METHODOLOGY.md` — every line's
  source, its forecast driver, what happens when a figure is missing, and the
  `CONVENTIONS.md` item each choice follows or departs from.
- **What the filing or the data source does not publish** is in
  `DATA_CONSTRAINTS.md`, with the bound on what each one could do to a value,
  the threshold between warning the reader and refusing the model, and which
  source each gap comes from.

**How this file is kept**

- Fixing something listed here? Delete its entry **in the same commit as the
  fix**. Do not mark it resolved; remove it.
- Found something the model does incorrectly and not fixing it now? Add an
  entry. Found a behaviour that is deliberate, or a figure the source does not
  publish? It belongs in one of the other two files, not here.
- Every entry says what is wrong, where it lives, how it was measured, how many
  companies it affects, the worst example, and roughly how much it moves a
  valuation. Entries are ordered by valuation impact, largest first.
- **Every entry has a permanent ID, and an ID is never reused.** `KI-4` means
  the same defect for as long as this file exists; fixing `KI-1` does not make
  anything else `KI-1`. The order of the table still says which matters most,
  but nothing outside this file should refer to an entry by its position.
- Taken so far: `KI-1` to `KI-27`. **Next free: `KI-28`.** Retired, meaning
  fixed and never to be reused: `KI-1` (forecast capital spending a flat share
  of revenue, fixed 2026-09-22), `KI-13` (revenue growth a clamped trailing
  average stepping into the terminal rate, fixed 2026-09-23), `KI-14` (every
  company discounted to a 31 December year end, fixed 2026-09-23), `KI-3`
  (the forecast tax rate measured on a base the forecast did not have, fixed
  2026-09-24; what the filing cannot separate moved to `DATA_CONSTRAINTS.md`)
  `KI-2` (no stated discounting convention, and timing that ran from the
  day the price was fetched, fixed 2026-09-24), `KI-4` (the workbook
  asserting drivers the engine does not use, fixed 2026-09-25), `KI-17`
  with `KI-18` (a filed figure the company does not report carried into the
  arithmetic, in the model and in the workbook, fixed 2026-09-25), `KI-16`
  (nothing checked that the screen showed what the engine produced, fixed
  2026-09-26 by `npm run verify:dashboard`), `KI-7` (a reported cash flow
  statement rebuilt rather than filed, fixed 2026-09-26), `KI-6` (a filer
  the SEC's XBRL has no facts for could not be loaded at all, fixed
  2026-09-26), `KI-9` (a cash cushion with no basis, fixed 2026-09-26) and
  `KI-19` (valuation constants with no stated basis: the exit multiple and the
  share-count tolerance settled 2026-09-26, the risk-free rate fetched the same
  day and widened on 2026-09-27 to the five currencies whose central banks and
  finance ministries publish one, and the market risk premium and terminal
  growth moved to `DATA_CONSTRAINTS.md` because nothing publishes them) and
  `KI-15` (a payload cache keyed to the ticker alone, so new code read old
  payloads, fixed 2026-09-27) and `KI-22` (assumptions reaching the valuation
  with no basis recorded: stock compensation and buybacks, both opened and fixed
  on 2026-09-28 in the commit that built the Assumptions sheet — writing the
  buyback sentence is what established that a derived company's authorised
  ceiling is its own spend and its percentage exactly 1.0, so `METHODOLOGY.md`
  §10 was corrected with it. The third figure in that entry, the workbook's
  revolver rate, was not a defect: it is an assumption with a stated basis and no
  engine counterpart, and it moved to `METHODOLOGY.md` §22), `KI-23` (the
  operating margin slider under-moving by the stock compensation share of
  revenue, fixed 2026-09-28) and `KI-20` with `KI-21` (the workbook's discount
  rate not moving with its tax rate, and its terminal growth rate not re-fading
  its forecast, both fixed 2026-09-28; the sweep that followed them fixed the
  cash cushion the same way and opened `KI-24` for the cost of debt) and `KI-24`
  itself (the workbook's cost of debt a constant where the engine averages the
  debt schedule's own rates, fixed 2026-09-28 once the absent-rate cases had been
  measured and found to reach no valued company's answer). Moved out on
  2026-09-27: `KI-11`, to
  `DATA_CONSTRAINTS.md` — how much plant a change in revenue is worth is a
  relationship the filings do not settle, and the three companies where the
  forecast shows it are named there. Moved out on 2026-09-22 and never to be
  reused: `KI-5`, `KI-8` and `KI-10`, all to `DATA_CONSTRAINTS.md`. The
  limitation numbers `L1` to `L30` were retired with them; each is accounted
  for in `METHODOLOGY.md` or `DATA_CONSTRAINTS.md`.
- Numbers used before 2026-09-22 — "#4" in a commit message, say — were
  positions in the list on the day they were written, not these IDs.

**Measurement basis, unless an entry says otherwise:** payloads for curated
Apple, the first 100 issuers in the SEC ticker list and a set of non-US
listings, refetched on 2026-09-23 when the fiscal period end date was added to
the fetch; 176 files, 172 with statements, 169 modelled, 63 showing a DCF value
(69 before the revenue-against-plant refusal of 2026-09-23 and the tax-attribution
refusal of 2026-09-24). Values are the site's perpetuity value per share. "What if" figures come
from moving existing sliders or recomputing from the engine's own outputs; no
source was changed to measure anything below. Entries that cite an earlier
commit were measured on the payload set of that date and say so.

---

## Defects, by valuation impact

**One of these moves a valuation and two do not.** `KI-27` makes a saved model
disagree with its own stored figure; the other two are faults on the screen,
found while redesigning the company screen on 2026-10-02, and they are here
because this file is the list of things this repository does incorrectly — not
only the ones that change a number.

| ID | What is wrong | Measured |
|---|---|---|
| `KI-27` | A saved model does not save the judgements it was built on, so it reopens valuing something else | Reliance saved at 1,044.32, reopens at 706.52 — 32.3% |
| `KI-25` | The news ticker scrolls text out of view that already fits | strip 730px inside a 1117px window |
| `KI-26` | A render-blocking stylesheet for an icon font nothing uses | one request per page load, zero usage |

### `KI-27` — a saved model reopens on judgements it was not built on

**Where:** `src/data/savedModels.ts`, `SavedModel`; restored at
`src/components/TerminalDashboard.tsx:2039`.

A saved model stores `drivers`, `viewMode` and the `valuePerShare` it had when
it was saved. It does **not** store the reader's corrections to the filed
figures (feature 11a) or their expense classification
(`METHODOLOGY.md` §22d). Restoring applies the drivers and the view mode and
nothing else, so a model built on a corrected figure or a reclassified cost line
reopens on the filed figures and the engine's default treatments — while the
saved list goes on printing the value the model had *with* those judgements.

**Measured** 2026-10-10 on RELIANCE.NS. Saved with selling, general and
administrative excluded as non-recurring, the model values at **1,044.32** and
the list stores that figure. Restored, the same entry rebuilds at **706.52**:
the list and the screen disagree by **32.3%**, and nothing on either says why.
Excluding other operating costs instead makes the gap **138%**.

It predates the judgement layer — corrections have never been saved either — but
expense classification widens it, so it is written down now rather than left as
a shape nobody had measured.

**What it would take to fix:** carry `corrections` and `classification` on
`SavedModel` and re-apply both on restore, which means restore has to rebuild
the company record rather than only set the sliders. The honest interim, if that
is deferred, is for the saved list to say that a saved entry keeps its sliders
and not its judgements — but a sentence is not the fix, and the figure in the
list is wrong until the judgements travel with it.

### `KI-25` — the ticker scrolls away text that fits

**Where:** `src/index.css`, the `marquee` keyframes and `.animate-marquee`,
used by the news ticker in `src/components/TerminalDashboard.tsx`.

The animation translates the strip from `translateX(0)` to `translateX(-100%)`
unconditionally. When the headlines are wider than the window that is a ticker.
When they are **narrower** it is a fault: the text fits entirely, needs no
scrolling, and is dragged off the left edge anyway until nothing is left, then
snaps back and does it again.

**Measured** 2026-10-02 on the dev server at 1440px, sampling the strip's offset
inside its window every 1.6 seconds: the strip is **730px wide in a 1117px
window** — it fits with 387px to spare — and its left edge moves from −9px to
−105px over fifteen seconds, continuing to −730px before restarting. A
screenshot taken mid-cycle caught the placeholder reading `oading...]` where it
should read `[Loading...]`.

The 2026-09 fix that made the strip start at `translateX(0)` rather than off the
right edge is the reason the first headline is readable at all; it did not add
the condition that the strip should only move when it has somewhere to go.

**What it would take to fix:** animate only when the strip is wider than its
window, which needs its width measured rather than assumed — or duplicate the
content and translate by half, the usual marquee construction, which also
removes the blank period before the restart.

### `KI-26` — a stylesheet fetched for an icon font nothing uses

**Where:** `index.html`, line 17.

The page loads `Material+Symbols+Outlined` from Google Fonts in `<head>`. The
application draws every icon with `lucide-react` inline SVG: there is no
`material-symbols` class, no `Material Symbols` font-family and no ligature text
anywhere in `src/`, `scripts/`, `content/` or `api/`.

**Measured** 2026-10-02. The font **file** is never fetched — a browser loads a
webfont only when a glyph needs it, and the request list for a page load shows
`materialsymbols woff2 fetched: false`. So the cost is not the 1,137,972-byte
woff2 the family would weigh; it is the **688-byte CSS request itself**, made on
every page load, as a render-blocking `<link rel="stylesheet">` to a third-party
origin in `<head>`. It also keeps `fonts.googleapis.com` in the critical path
for a resource with no consumer.

**What it would take to fix:** delete the line. It is recorded rather than done
because deleting a font link is the kind of change that wants a page-by-page
check that nothing renders a glyph through it, and the redesign commit it was
found in had a different subject.


## What the 28 September run of entries was about

Five were opened on 2026-09-28 and all five closed the same day, all from one job:
building the workbook's Assumptions sheet. Writing down what every assumption
rests on means following each one to the cell it drives, and four of them stopped
short of where the engine carries them.

`KI-22` was two assumptions with no recorded basis — written, and retired.
`KI-23` was the operating margin slider under-moving by the stock compensation
share of revenue, a scaling that was correct when written and made wrong by a
change elsewhere. `KI-20` and `KI-21` were typed constants on the DCF sheet and
the model sheet where the engine computes a figure: the discount rate did not
move with the tax rate, and the terminal growth rate did not re-fade the
forecast. `KI-24` was the same pattern again, found by sweeping for it rather
than by hitting it: the cost of debt was a constant where the engine averages
the debt schedule's own rates. It was left open for a day on the grounds that
reproducing the engine's handling of a year with no filed interest might need
something the workbook does not carry — then measured, and it does not. Of the
56 valued companies, two have such a year and both of them owe nothing at all,
so the debt weight is nil and the cost of debt cannot reach their answer. The
formula names the years the engine actually used rather than averaging a range,
so the case still cannot bite the company it one day applies to.

**All five are the `KI-4` shape**, and `KI-4`'s lesson is the one that matters:
a workbook seeded from the engine's own answer agrees exactly at rest and parts
on the first edit, which is precisely when anyone is reading it. Agreement at
rest is worth very little. `npm run verify` now checks thirteen lines after an
edit, the size of a driver's response as well as its direction, and that every
value on the Assumptions sheet is a link rather than a copy.

## Where the list stood before these

The list reached zero on 2026-09-27. That is not a claim that the model is
right — it is a claim that nothing on it is a mistake of ours that we know about
and have not dealt with. Everything that was there has been fixed, or established
as something the filings cannot settle and moved to `DATA_CONSTRAINTS.md` where
the affected companies are named against the model.

The last entry, `KI-12`, is the one worth reading about before adding another.
It asked why three companies rested on their terminal value far more than the
arithmetic of a five-year window explains. The answer, in the end, was that two
of them stopped being valued at all for unrelated reasons — Enbridge for a
currency its data does not establish, Reliance for a rupee risk-free rate nobody
publishes — and the third, Micron, is faithful to its own filings: its five
modelled years spend 86% of their EBITDA on plant, against the 72% to 92% it has
actually spent, so little of what it earns reaches the discounting and the
perpetuity carries the answer. There was nothing to fix. What the entry produced
instead is in `METHODOLOGY.md` §13: the share is measured against what an
ordinary five-year forecast would give, shown on every valuation, and where a
company sits far above it the panel now says **why** rather than only by how
much.

**A twentieth defect was found and fixed on the same day**, so it never got a
number, and it is recorded here because the count above would otherwise be
misleading. Installing thirteen new qualitative factors pointed six of them at
drivers no factor had touched, and two of those drivers — research spending and
selling and admin costs — were applied to the model by REPLACING its forecast
path with the slider's own value. A slider's default is the first forecast year,
so on Apple's curated file, whose R&D runs at 10% of revenue in the first
forecast year and 13% after, a reader marking research dependence a weakness
flattened years two to five down to 9.7%, cut the R&D bill by $12bn to $14bn a year,
raised operating profit and raised the value from $141.98 to $154.80 a share.
A judgement that the company is worse off made it worth 9% more. The three
sliders beside these two had been converted to shifts months earlier for exactly
this reason and these two were missed. Both now shift, no published number moved
(the sweep compares 67 valued companies at 0.0% median change, because nothing
changes until a driver is edited), and `npm run verify` now nudges twelve drivers
a point each way and fails if any moves the value against its own label —
`METHODOLOGY.md` §21. **What let it survive is worth more than the fix:** every
driver reproduces the model exactly at rest, and at rest was the only place
anything was tested.

**How to add one.** An entry here is a thing the model does incorrectly that we
could do correctly. If the filing does not carry what would be needed, it is a
data constraint. If it is a choice we made and would defend, it is methodology.
Both have their own file. The rules for an entry — a permanent ID, what is
wrong, where, how it was measured, how many companies, the worst example, and
how much it moves a valuation — are above, and they have not changed.

## Where the rest went

`KNOWN_ISSUES.md` held three kinds of entry until 2026-09-22. Only the first
kind is still here.

| Was | Now |
|---|---|
| L5, L7, L11, L13, L18, L21, L23, L24, L26, L27, L28, L30, D1 | `METHODOLOGY.md` — deliberate behaviours, each in the section that describes the machinery |
| KI-5, KI-8, KI-10, L1, L2, L3, L4, L6, L8, L9, L10, L12 (in part), L14, L15, L16, L17, L19, L20, L22, L25 | `DATA_CONSTRAINTS.md` — figures the source does not publish, with the bound on each |
| L12 (the cache half), the dashboard verification gap | KI-15 and KI-16 above |

Nothing measured was dropped. Every figure that was recorded against a moved
entry travelled with it.
