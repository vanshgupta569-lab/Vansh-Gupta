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
- Taken so far: `KI-1` to `KI-19`. **Next free: `KI-20`.** Retired, meaning
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
  payloads, fixed 2026-09-27). Moved out on 2026-09-27: `KI-11`, to
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

**None open.**

The list reached zero on 2026-09-27. That is not a claim that the model is
right — it is a claim that nothing on it is a mistake of ours that we know about
and have not dealt with. Everything that was here has been fixed, or established
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
