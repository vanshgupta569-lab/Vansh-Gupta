# The Impeccable review, screen by screen

What the design review changed on each screen, and — kept separately and just
as carefully — **every suggestion it made that conflicts with a rule of this
repository, recorded and NOT applied**, for Nihar to decide.

**Started 13 November 2026**, on Nihar's instruction of the same day: every
screen of the site at 1440 and 390, in batches of about five screens, one
commit per screen, a push and a three-line progress note after each batch.

---

## How a suggestion is treated

The review proposes; this repository's rules dispose. A suggestion is applied
only where it follows `docs/VISUAL_SYSTEM.md`, `DESIGN.md` and the specs in
`docs/` with the decisions at their tops. Three kinds are never applied, and
are written into the conflicts list instead:

1. **Anything that changes a figure**, a data rule, a default, a threshold or
   a refusal.
2. **Anything that changes facts-only wording** into something that carries an
   opinion on a security — calling a number strong, cheap, a risk or a warning
   sign. A fact plus a definition is education; the adjective is the opinion
   (standing decision 6).
3. **Anything that hides a state a reader is owed**: a refusal, a correction, a
   missing figure, or the difference between reported, corrected, reclassified
   and modelled (standing decision 5).

A fourth is not a conflict but a stop: **the Excel workbook's structure is
never simplified without asking** — not the 138-row chart of accounts, not the
sheet set, not the circularity switch, not the live formulas, not the row
positions a firm's macro depends on.

---

## The order of the work

As Nihar set it on 13 November 2026:

| Batch | Screens |
|---|---|
| 1 | Landing page; header and menus (desktop and phone); search palette and search screen; company Overview |
| 2 | Financials tab and evidence sheet; cost-of-capital card and price chart; screener; valuation screen |
| 3 | Figures, judgements and outputs; saved models, house template, peer workbook, batch |
| 4 | Loading screen; Learn hub, explainers, Margin notes; not-found page |
| 5 | Every empty, error and stale-data state |

---

## What changed, screen by screen

*(Filled in as each screen is committed. Each row names the screen, what moved,
and the commit.)*

| Screen | What changed | Commit |
|---|---|---|
| **Landing page** (batch 1) | The `VERIFIED LEAD` badge and its shield deleted; the Web3Forms footnote replaced with what actually happens to the reader's address; the form's solid oxblood fill and its 15px glow replaced with the hero's wash and border; four box-shadows and both band radii removed; the decorative quarter-circle wash removed; the emerald success state onto the one green, and announced through `role="status"`; the hero poster no longer cropped at 390. `verify:craft` added, running at 1440 **and 390**. | `(this commit)` |

---

## Suggestions NOT applied, because they conflict with a rule

*(Nihar decides each. Nothing here has been changed in the code.)*

### 1. The day's price-change pill is still coloured by its sign

**Where.** The valuation screen's headline block, the `Price the valuation is
struck at` cell — `src/components/TerminalDashboard.tsx`, two pills reading
`+1.12%` in the positive green and the oxblood when negative.

**What the review would do.** Make them neutral too, for the same reason the
premium and discount pills became neutral on 13 November: `STUDIO_SPEC §4.2`
says no pill colour carries the sign, and standing decision 6 says explain
mechanics, not merit.

**Why it was not applied.** Nihar's decision of 13 November names *"the
headline premium/discount pills"* specifically, and §4.2's own wording is about
the premium and discount pair — it does not mention the day's move. A day's
price change is also a different kind of fact from a premium to a model: it is
the market's own reported move, not a comparison this site computed, and
green-for-up is the convention every price source uses. **Changing it is a
decision, not a tidy-up, so it is here rather than in the code.**

### 2. Shortening the landing page

**Where.** The whole page: 15,969px at 1440 and **16,053px at 390** — longer on a phone than on a desktop, because nine `Block`s are `min-h-screen` and nothing compresses.

**What the review would do.** Drop `min-h-screen py-32` from sections 02–07 and let them stack on the spec's 96px gap; keep the hero formation and one secondary scene instead of ten. It measures roughly 4,500–5,000px of the page as vacancy reserved for a particle object that contributes no visible mass below the hero, and 2,638px of empty cream inside the paper run.

**Why it was not applied.** `LANDING_SPEC` line 2 is unambiguous: *"Nothing is removed without Nihar's recorded decision."* Reducing nine full-viewport sections to stacked blocks is removing the composition even where the words survive. **This is the single largest design finding on the page and it needs your decision, not mine.**

### 3. "Four ways in", where three doors are shut

**Where.** `landingPage.tsx:277`, the `ROUTES` list.

**What the review would do.** It noted that dropping the three "Planned" labels would read better — and then argued against itself, correctly: that hides a state the reader is owed and breaks the feature register. **Not applied, and should never be.** Its better suggestion is a copy change: the heading "Four ways in" promises four and delivers one, so *"One way in today, three being built"* is both truer and better. That is a wording change on a non-factual heading, so it is yours to approve rather than mine to make.

---

## Found and not yet done

Carried forward rather than dropped. None is a conflict; each is work.

| # | Screen | Finding | Measured |
|---|---|---|---|
| 1 | Landing | **A second hero poster for phones.** `LANDING_SPEC §4` specifies two — WebP 1680×405 ≤60KB desktop, 684×165 ≤20KB at ≤640px — and one exists. The interim is `object-contain` at phone widths, which shows the whole word small rather than a fragment large. The real fix is the second asset. | At 390 under `object-cover` the poster kept **29% of its width**: the name read "rgina". `verify:craft` reports the percentage. |
| 2 | Landing | **Twelve headings write responsive ladders that do nothing.** `text-[28px] sm:text-[34px] lg:text-[44px]` — all three snap to `--m-size-title` in `src/index.css`. The remap is deliberate and correct; the page is authored against eight sizes it never gets. The closing statement renders no larger than a mid-page subhead. | 12 headings, 1 rendered size (clamp(28px, 2.8vw, 36px)). Only one `text-display` on the page. |
| 3 | Landing | **`MARGIN_LINES` is invented sample data under a heading that says "Every figure has a source."** No company, currency, unit or period, and three of four are computed outputs. `LANDING_SPEC §6.1` already records the replacement rows (NVDA as-filed, FY2022–26, US$m). | 4 rows, 0 sources. `LANDING_SPEC` finding 4, Sev H, unfixed. |
| 4 | Landing | **The Keynes attribution is almost certainly wrong.** "I would rather be vaguely right than precisely wrong" traces to Carveth Read (*Logic*, 1898). Standing decision 10 is primary sources only, and this is set at display size under a heading about sourcing. | 1 quote, 0 sources. |
| 5 | Landing | **`min-h-screen` where `LANDING_SPEC:221` says `min(100svh, 900px)`.** `100vh` is the mobile browser-chrome bug and there is no 900px cap. | `landingPage.tsx:135`, on every Block. |
| 6 | Landing | **The motion pause control is 24×24 on touch too.** The spec's own decision line says 24×24, and 44×44 on touch. | `landingPage.tsx:624`, `h-6 w-6`, no `pointer-coarse` variant. |
| 7 | Landing | **Motion rules.** The margin connector animates `top` with `transition: all duration-500`; `CountUp` runs 1,900ms against a 600ms token; the hero primary holds navigation 1,150ms with no busy state, against a 280ms interaction budget. | `landingPage.tsx:1023`, `:240`, `:456`. |
| 8 | Landing | **Three eyebrow styles, four numbering schemes, no "09".** `LANDING_SPEC` checklist 29 asks for one eyebrow style everywhere. | 3 styles, 4 schemes. |
| 9 | Landing | **26 exchange names as a comma run.** The hardest possible form for the scan a reader actually makes ("is mine here?"). | 26 items, one run-on. |
| 10 | Docs | **`PRODUCT.md` is stale.** Its Operating Context still says "every route into a company passes through the qualitative questions first", which item 1 ended on 12 November. Not repaired here: the skill's rule is that drift is reported, not fixed as a side effect of a design task. | 1 sentence. |
| 11 | Docs | **`DESIGN.md` states something that was false.** "There are no shadows in this system. Not one `box-shadow` is declared anywhere in the build" — there were four. True again as of this commit, and `verify:craft` now keeps it true. | 4 shadows, now 0. |

## Progress notes

*(Three lines per batch, written after the push.)*
