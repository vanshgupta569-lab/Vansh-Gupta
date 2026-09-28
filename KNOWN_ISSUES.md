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
- Taken so far: `KI-1` to `KI-23`. **Next free: `KI-24`.** Retired, meaning
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
  engine counterpart, and it moved to `METHODOLOGY.md` §22). Moved out on
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

| ID | What is wrong | Worst | Valued companies affected |
|---|---|---|---|
| `KI-20` | The workbook's discount rate does not move with its tax rate | Vodafone, 12.3% on value per share | 18 of 56 above 1% |
| `KI-21` | The workbook's terminal growth rate does not re-fade its forecast | AbbVie, 3.7% on value per share | 51 of 56 above 1% |
| `KI-23` | The operating margin slider under-moves, by the stock compensation share of revenue | not yet measured | every company reporting SBC |

`KI-20` and `KI-21` were found on 2026-09-28 while building the Assumptions
sheet, which is what turned them up: writing down what every assumption rests on
means following each one to the cell it drives, and two of them stop short of
where the engine carries them. `KI-23` came from the same job by a different
route — renaming a field to match what it holds, and reading what consumed it. Both are the `KI-4` pattern — a workbook that agrees with the site
exactly at rest and parts from it on the first edit — and `KI-4`'s own measured
lesson applies: the agreement at rest is worth nothing, because the workbook is
only being used once someone has started editing it.

Neither moves a published figure. `npm run verify:workbook` compares the two at
rest and still returns the site's value per share on both terminal methods for
every valued company, worst difference 3.87e-9%.

### `KI-20` — the discount rate does not move with the tax rate

**Where:** `src/data/excelExport.ts`, DCF sheet rows 21 and 23.

Beta is written to the sheet already relevered, and the cost of debt already tax
effected, both as typed constants. The engine does neither in advance: it
relevers beta by `(1 − tax)` and tax-effects the cost of debt against whatever
rate the model is carrying, so moving the tax rate moves its WACC. In the
workbook the tax rate reaches the cash flows — DCF row 10 links to the model
sheet — and never reaches the rate that discounts them.

**Measured** 2026-09-28 on the payloads of 2026-09-23, by raising the tax rate
five points in the workbook and on the engine and comparing value per share
across the 56 valued companies: **18 part by more than 1%, three by more than
5%**, median 0.52%. Worst: **Vodafone −12.3%**, whose beta relevers from 1.75 to
1.67 and whose after-tax cost of debt falls from 2.20% to 1.98% on the engine
while the workbook holds both. A reader who tests a tax change in the file gets
an answer the site would not give.

**What it would take to fix:** write rows 21 and 23 as formulas over the model
sheet's tax rate — the Hamada relation on an asset beta, and the pre-tax cost of
debt times `(1 − tax)`. Both need two constants the sheet does not currently
carry (the asset beta and the pre-tax cost of debt), which the engine does have.

### `KI-21` — terminal growth does not re-fade the forecast

**Where:** `src/data/excelExport.ts`, DCF sheet row 33 against the model sheet's
revenue growth row.

Since `5a2b858` the forecast growth rate fades in a straight line to the terminal
rate, and the engine reads `dcf.longTermGrowthRate` when it builds that path — so
moving the terminal rate re-strikes every forecast year to meet the new one. The
workbook seeds the growth cells with the faded rates as typed numbers and wires
row 33 to the terminal value alone. Moving it changes what the perpetuity grows
at and leaves the forecast that feeds it where it was, which is the join the fade
was built to remove.

**Measured** the same way, terminal growth one point higher on both sides:
**51 of 56 part by more than 1%**, none by more than 5%, median 2.2%. Worst:
**AbbVie −3.7%**, whose forecast growth should re-fade from 3.51%→2.50% to
3.51%→3.50% and does not move at all.

**What it would take to fix:** write the model sheet's forecast growth cells as a
formula interpolating between a first-year rate and DCF row 33, which makes the
fade a rule in the file rather than five numbers. The Assumptions sheet states
the limitation beside both rows in the meantime.

### `KI-23` — the operating margin slider under-moves

**Where:** `src/data/companies.ts`, `buildOverridden`, the `operatingMarginPct`
branch.

The slider shifts the gross margin path and then scales the shift by
1/(1 + SBC share). That scaling was correct while stock compensation was
forecast as a share of **operating costs**: a point on gross margin cut operating
costs, which cut the SBC charge with them, so operating profit moved by
d × (1 + share) and the shift had to be divided by that factor to make the
operating margin move by exactly what the slider said.

Since 2026-09-25 stock compensation is a share of **revenue** (`METHODOLOGY.md`
§5), which gross margin does not touch. Operating profit now moves by exactly d
already, so dividing by (1 + share) makes the slider move the operating margin
**less** than it says — by a factor of the SBC share of revenue, which is a
fraction of a point for most companies and several points for software.

**Found** 2026-09-28, by renaming `sbcPercentOfOpex` to `sbcPercentOfRevenue`
and reading what consumed it. The field had held a share of revenue for three
days under a name that said otherwise, and the one place that read it was built
on the name.

**Not yet measured.** The shell was unavailable for the whole of the session that
found it, so no sweep was run. It is recorded here without a figure rather than
with a guessed one. The measurement is the ordinary one: set the operating margin
slider a point either way on the sweep set, and compare the operating margin the
model actually produces against the one the slider asked for.

**What it would take to fix:** delete the scaling, so the shift is `delta`. That
moves a published figure for every company that reports stock compensation, which
is why it is not done in the commit that found it.

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
