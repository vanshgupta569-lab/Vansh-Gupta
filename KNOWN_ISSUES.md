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
- Taken so far: `KI-1` to `KI-34`. **Next free: `KI-35`.** Retired, meaning
  fixed and never to be reused: `KI-31` (a share count filed before a stock
  split was paired with a price struck after one, so Amphenol's market
  capitalisation was half what it is and its value per share 89.58 against
  43.99 — a 45% overvaluation published as a 13% undervaluation. Fixed
  2026-11-01: every share count is put on today's basis by the splits dated
  after the day that figure was filed, with the event applied only where an
  independently reported count of shares outstanding agrees with the adjusted
  count and not with the filed one, so an ADR ratio change is recorded and not
  applied), `KI-30` (`MCD`'s payload carried 716.4 diluted
  shares where every other SEC filer carries the absolute count, because
  McDonald's tags the figure as its statements print it — in millions — and the
  derivation divided it by a million again; its market capitalisation came out
  as 0.18 against borrowings of 43,848, an equity weight of 0.0004% and a WACC
  that was its cost of debt alone. Fixed 2026-10-31 by reading the scale off the
  filing's own cover page, which every registrant tags as an absolute count
  (`dei:EntityCommonStockSharesOutstanding`, 710,398,642 at 2026-01-31 against
  the 716.4 inside), applying it to every share count in the payload and
  recording what was done; `npm run verify` puts the fault back on purpose and
  watches the check report it), `KI-29` (the cost of debt was the historical
  effective rate — interest over average borrowings — which rule 18 allows only
  as a cross-check, and 59 of 137 companies came out borrowing below their own
  government's ten-year yield; fixed 2026-10-31 by striking it as the
  currency-matched risk-free rate plus a default spread for a synthetic rating
  read off interest coverage, from Damodaran's published table, with his
  separate ladder for financial service firms. The cost of debt moved on 137
  companies by −19.16 to +21.43 points, the WACC on 141 by −9.32 to +6.95, and
  the value per share on 59 by −30.1% to +14.0%, median −0.19%. The effective
  rate is still computed: it drives the forecast interest charge and is shown
  beside the cost of debt as the cross-check it is), `KI-28` (the typecheck
  checked no component
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

`KI-32` was found on 2026-11-01 by the sweep `KI-30` asked for — *check whether
any other company has the same fault*. It is not the same fault: no other
company in the set tags a share count in millions. It was found because the
cover-page check `KI-30` installed holds a filed share count against the
filing’s own cover page, and three companies came back with a ratio that is
neither a match nor a scale. Two of those three turned out to be `KI-31`,
fixed on 2026-11-01; the third was Mastercard, where the check itself falls
short rather than the data (`DATA_CONSTRAINTS.md`, *No cover-page share count
for a company with more than one share class*). This one came from the same
reading and is a different fault again.

### `KI-32` — two banks’ statements stop years back

**What is wrong.** Which fiscal years a company has is anchored on revenue: the
years that carry one of the four revenue tags in `US_TAGS.revenue` are the years
the model is built from. Morgan Stanley and Wells Fargo both stopped tagging
`Revenues` and now tag **`RevenuesNetOfInterestExpense`**, which is not in the
list. So their models are built from whatever years still carry the old tag.

**Measured on 2026-11-01**, over the 176 payloads in the set: **two** have a
latest fiscal year before FY2024, and these are the two. The other 174 end at
FY2025 (128) or FY2026 (46).

| | latest year shown | revenue shown | what FY2025 actually was |
|---|---|---|---|
| `MS` Morgan Stanley | **FY2014** | 34,275 | 70,645 |
| `WFC` Wells Fargo | **FY2019** | 85,063 | 83,699 |

Confirmed at source: `us-gaap:Revenues` has its last annual value at 2014-12-31
for Morgan Stanley and 2019-12-31 for Wells Fargo, while
`us-gaap:RevenuesNetOfInterestExpense` runs to 2025-12-31 for both.

**What it moves: no published value, and every published figure.** Both are on
the bank template, so neither gets a WACC or a discounted cash flow and no value
per share of either is wrong. What is wrong is everything the company page and
the financials tab show: Morgan Stanley is presented as a company half its
current size with figures **eleven years** out of date, and the chart overlays,
the per-share figures and the quarterly bridge are all struck against them. A
reader has no way to tell, because every figure is correctly labelled with the
year it belongs to — the years are simply the wrong ones.

**What the fix needs.** Adding the tag is one line, and that is the reason to be
careful rather than quick: `Revenues` and `RevenuesNetOfInterestExpense` are not
the same quantity — the second is already net of interest expense — so a bank
whose years come from one tag and whose interest lines are read for the other
would double-count. It needs the bank template’s revenue definition settled
first, and measuring across all 36 banks in the set, not just these two.

**How both were found.** Neither by a check that was looking for them. The
cover-page comparison `KI-30` installed exists to catch a share count in the
wrong unit; what it actually does is hold a filed count against a figure from a
different filing, and any disagreement is worth reading. A check is worth more
than the fault it was built for.

### `KI-33` — a quarterly share count worked out by subtraction

**What is wrong.** A quarter a company did not file on its own is worked out
as this year to date less the last — `Q4 = FY − 9M` — which is right for a
flow and **wrong for a share count**. A weighted-average diluted share count
is not additive: the average over a year is not the sum of the averages over
its quarters, and subtracting one from another produces a number that means
nothing. Because the annual average and the nine-month average are close, the
difference is usually a **negative share count**.

**Measured on 2026-11-01**, over the 176 payloads: **159 quarterly share
counts at or below zero, across 68 companies** — Apple, Microsoft, Alphabet,
JPMorgan and 64 more. Worst example: Amphenol’s quarter to 2025-12-31 reports
**−1,270,100,000 shares**. The figures are identical before and after the
split adjustment of 2026-11-01, measured both ways, so this is not that job’s
doing — it found it.

**What it moves: no value, and a visible figure.** No valuation uses a
quarterly share count; the annual one drives everything. What it reaches is
the Financials tab, where the diluted-share row prints the derived quarter as
a figure like any other, correctly labelled derived and plainly impossible.

**What the fix needs.** A list of fields that may not be derived by
subtraction, checked in `quarterValue` beside the guard that already stops a
subtraction between two different tags (the Arista fix of 2026-10-26). A
count that cannot be filed honestly is not reported rather than derived,
which standing decision 3 requires. It is a one-guard change, and it moves
the quarterly figures of 68 companies, so it wants its own commit and its own
measurement rather than a corner of another job.

### `KI-34` — a yield that fails to fetch costs a company its valuation

**What is wrong.** The risk-free rate is fetched once per company, with no
retry. When the publisher does not answer for that one request the payload is
written with no rate, and the engine then refuses the valuation — correctly,
because discounting at an invented rate would be worse. But the refusal is
not a fact about the company. It is a fact about one HTTP request, and a
reader cannot tell the difference.

**Measured on 2026-11-01**, across one full refetch of the set: **6 of the
115 payloads reported in US dollars came back with no US Treasury yield**
(`KLAC`, `KO`, `LIN`, `ENB`, `PEP`, `WELL`) and **3 of the 6 in rupees came
back with no OECD yield**, while the other 112 and 3 succeeded in the same
run against the same publishers. The failures move between companies from one
refetch to the next: Walmart lost its valuation this way on 2026-10-31 and
regained it on 2026-11-01, when Coca-Cola lost one instead. This is also the
whole of the reason the workbook check covered 58 models rather than 59.

**What it moves: one valuation at a time, at random.** Each affected company
loses its cost of equity, its WACC and its value per share entirely, and is
given a refusal naming a missing rate. Nothing shown is wrong; what is wrong
is that it is withheld for no reason to do with the company.

**What the fix needs.** A retry with a short backoff around each yield fetch,
and — better — a rate cached across the set within one run, since every
dollar-reporting company in a refetch asks the same publisher for the same
number on the same day. 115 identical requests is also the reason some of
them fail.

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

**A defect that lived for one day and never got a number.** The risk and
cost-of-capital card shipped on 2026-10-29 with an editable beta row, and the
figure a reader put into that row was handed to the engine as an ASSET beta —
which the engine relevers onto the company's own borrowings before taking a cost
of equity from it. A beta measured by regressing a share price is already
levered: the borrowings are in the price history. So the button offering BP's
measured 0.598 put 0.635 into the model, and the row showed one number while the
valuation used another, which is the single thing that card exists to prevent. It
was found on 2026-10-30 while building the switch that lets a reader choose the
measured beta, and fixed in the same commit: an edit to the beta row now sets
`betaIsUnlevered` to false, the engine uses the figure as given, and
`npm run verify` asserts the beta the model uses is the figure printed on the
button that set it. The engine's own default is still an asset beta of 1.0 and is
still relevered, which is right for a figure that describes the business rather
than the share (`METHODOLOGY.md` §14).

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
