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
| — | *the first batch is in progress* | — |

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

---

## Progress notes

*(Three lines per batch, written after the push.)*
