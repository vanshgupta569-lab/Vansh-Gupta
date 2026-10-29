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
- Taken so far: `KI-1` to `KI-30`. **Next free: `KI-31`.** Retired, meaning
  fixed and never to be reused: `KI-28` (the typecheck checked no component
  props at all, because `@types/react` was never installed; fixed 2026-10-20,
  and `npm run verify` now compiles a component call that must not compile, so
  the hole cannot reopen silently — the fix surfaced seven real type errors,
  one of them a latent bug passing a MouseEvent where a note key belonged),
  `KI-25` (the news ticker scrolled headlines that already fitted their window;
  fixed 2026-10-20 by measuring the strip and animating only when it overflows,
  with both branches driven in a browser), `KI-26` (a render-blocking
  stylesheet fetched on every page load for an icon font nothing drew with;
  fixed 2026-10-20, and every font the page fetches is now matched against the
  families `tokens.ts` names), `KI-27` (a saved model stored its sliders and
  not the judgements it was built on, so it reopened valuing something else;
  fixed 2026-10-12), `KI-1` (forecast capital spending a flat share
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

### `KI-29` — the cost of debt is a history, not a cost

**What is wrong.** The engine takes the cost of debt as **interest expense over
average interest-bearing borrowings**, averaged across the forecast
(`model.js`, `computeWACC`). This project’s own specification
(`docs/COST_OF_CAPITAL_SPEC.md`) says in rule 18 that this figure may be shown
**only** as a labelled cross-check — a "historical effective rate" — and never
as the cost of debt, and in rule 17 that the rate should be the
currency-matched risk-free rate plus a default spread from the company’s
rating, or a synthetic rating from its interest coverage where it has none.

**Why it is wrong and not merely different.** An effective rate looks backwards
and divides by a balance that moved. A company that borrowed cheaply years ago
shows that old rate as the cost of borrowing a pound today.

**Measured on 2026-10-29**, over the 137 companies carrying both a cost of debt
and a risk-free rate: **59 of them come out borrowing below their own
government’s ten-year yield**, which no corporate borrower does. The worst are
Linde at 0.96% against 4.29%, Sea at 0.87% against 4.29%, Intel at 1.87% and
Johnson & Johnson at 1.93%; in India, HDFC Bank at 4.46% and ICICI at 4.44%
against a 6.54% rupee yield. The spread over the risk-free rate across the set
runs from **-4.25 to +22.37 points**, median +0.24.

**What it moves.** Only through the debt weight, so it is largest on the
heaviest borrowers: a point on the cost of debt is **0.79 points** of WACC on
McDonald's, 0.71 on Reliance Infrastructure, 0.40 on Toyota and 0.30 on
Vodafone. On a company that barely borrows it is worth almost nothing.

**Where it is visible.** The risk and cost-of-capital card labels the row
"Cost of debt (historical effective rate)", says in as many words that it is a
cross-check rather than a cost of debt, and shows the interest coverage ratio a
synthetic rating would be read from. **The label is not the fix.** The fix is
the synthetic rating, which needs Damodaran’s coverage-to-spread table and his
separate table for financial firms, and which changes the WACC of every
borrowing company — so it is a job of its own rather than a side effect of
building a screen.

### `KI-30` — one share count a million times too small

**What is wrong.** `MCD`’s payload carries **716.4** diluted shares where every
other SEC filer carries the absolute count, and the derivation divides by a
million to put share counts in millions. So McDonald’s market capitalisation
comes out as **0.18** against borrowings of **43,848**, in the same units.

**Measured on 2026-10-29**, over the 117 companies that produce a cost of
capital: **one** weights equity at under a tenth of a per cent, and it is this
one — an equity weight of **0.0004%**, a debt weight of **100.0%**, and a WACC
of **6.21%**, which is the after-tax cost of debt with no cost of equity in it
at all. Every other company in the set weights equity between 0.4% and 100%
with a market capitalisation that ties to its own price and share count.

**What it moves: no published value.** McDonald’s discounted cash flow is
refused for an unrelated reason, so no value per share is shown for it and none
is wrong. What the defect would do if the refusal lifted is replace the cost of
equity with the cost of debt, which on this company is about two points of
WACC.

**How it was found.** By putting the equity weight on a screen. It had been in
the engine for as long as the weights have, and nothing displayed them.

**What the fix needs**: measuring how the SEC facts tag diluted shares across
the set, because one payload in the wrong unit means the fetcher trusts a unit
it should check. It is a data-layer job and it is not this one.

## A defect found and fixed on 29 October 2026, with no number

**A missing risk-free rate was being read as a rate of nought.**
`computeWACC` computed `c.riskFreeRate + c.marketRiskPremium * beta`, and in
JavaScript `null + 0.0423 * 1.02` is 4.31%. So every company whose currency has
no published ten-year government yield this site can read came out with a cost
of equity equal to the equity risk premium alone: **33 of the 177 payloads** on
disk, in won, renminbi, riyal, new Taiwan dollars, Canadian dollars, Australian
dollars, Singapore dollars, reais, Swiss francs and Danish kroner — 4.29% for
TSMC, 4.30% for Samsung, 4.80% for Alibaba.

**It moved no valuation**, which is why it survived: 32 of the 33 already carry
the engine’s own refusal for the missing rate, the discounted cash flow never
runs, and no screen printed a cost of capital the valuation did not use. The
risk and cost-of-capital card is the first screen that would have, and a card
whose first rule is to show the numbers the engine uses cannot show that one.
Fixed in the same commit: the cost of equity and the WACC are null where the
rate is null, which standing decision 3 requires, and the refusal already there
is what the reader sees. **Proved by breaking:** `npm run verify` reports the
card showing a cost of equity on a company with no risk-free rate.

---

## Closed, and what they were

`KI-25`, `KI-26` and `KI-28` were closed on 2026-10-20:
the news ticker that scrolled headlines which already fitted, the
render-blocking stylesheet fetched for an icon font nothing drew with, and the
typecheck that was checking no component props at all. Each left behind a
check that fails without its fix — the ticker is measured in a browser on both
branches, every font the page fetches is matched against the families
`tokens.ts` names, and `npm run verify` compiles a component call that must not
compile. See the ID ledger above for what each one was.

A short list is not a claim that the engine is correct. It is a claim that
nothing known to be wrong is being left alone unrecorded, which is the only
thing this file can honestly say.

## A defect found and fixed on 20 October 2026, with no number

It is here rather than in the list above because it was opened and closed in one
commit, and the list is for things being left alone. It is here at all because
the count above would otherwise read as nothing having been found.

**The disclosed exchange rate was named with a pair it was a hundred times away
from.** The header, the provenance line and the workbook's Sources sheet printed
`rate` — the composite number the *quoted* figure is multiplied by — beside the
name of the currency pair it came from. London quotes pence, Johannesburg cents
and Tel Aviv agorot, so on those listings the sentence read "converted at
0.013246 (GBPUSD=X)" where GBPUSD=X is 1.3246. Measured on the payload set:
**nine companies with a named pair** — AstraZeneca, BP, HSBC, Rio Tinto, Shell,
Unilever and Vodafone in London, Naspers in Johannesburg, Teva in Tel Aviv —
plus GSK, whose quote is in pence against statements in pounds and which names
no pair at all.

**It moved no valuation**, and that is why it survived: the arithmetic was
right. The price was converted correctly, and the figure the reader was given to
check it against was the wrong one. It was found while building the trading
currency figure beside each value per share, which has to divide by a rate — and
dividing by the composite would have put a London value in pence while calling
it pounds.

`listingComparability` now derives `tradingCurrencyRate` once, the rate per
major unit, and everything that names a pair or converts a figure uses that; the
quoted unit is said separately ("100 to one GBP"). **The check that would have
caught it** reads the sentence rather than the field behind it, because the
fields were right: `npm run verify` parses the rate and the pair out of the
provenance line for every converted company and compares them, and
`npm run verify:dashboard` opens the disclosure in a browser and asserts the
pair's rate is on the page and the composite is not. Both were proved by putting
the defect back: nine reported in the suite, one on the screen.

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
