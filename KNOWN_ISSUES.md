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

| ID | Issue | Companies | Worst example | Value moved |
|---|-------|-----------|---------------|-------------|
| KI-12 | Three companies rest on the terminal value far more than the arithmetic explains | 3 of 64 more than 10 points above their benchmark; 52 within 5 | Enbridge, 121.7% of EV against a 75.7% benchmark | +-1pt of terminal growth: Enbridge -61.3%/+91.5%, median -13.8%/+19.5% |

---

### KI-12. Three companies rest on the terminal value far more than the arithmetic explains

- **What is wrong.** Not the level. Across the 64 valued companies the terminal
  value is a median 76.5% of enterprise value, and **52 of them are within five
  points of what the arithmetic of a five-year window requires**: five
  discounted years are a small annuity beside a perpetuity, so a company with a
  flat cash flow at the same discount rate and the same perpetual growth would
  show a median 73.8%. The gap between actual and that benchmark has a median of
  **2.0 points**. What is wrong is the tail — three companies sit more than ten
  points above it, and one of those has an explicit stage worth less than
  nothing, so its five modelled years contribute nothing at all to the answer.
- **Where.** `src/engine/model.js` (`buildDCF`); the drivers that set the
  explicit years are in `src/data/deriveModel.js`.
- **How measured.** Present value of the explicit years against the present
  value of the perpetuity terminal value, per company, each compared with the
  benchmark a flat cash flow would give at that company's own WACC and terminal
  rate. At `6e70dca` on the payloads of 2026-09-23.
- **Affects.** 3 of 64: Enbridge (121.7% of enterprise value against a 75.7%
  benchmark, 45.9 points), Micron (95.7% against 73.5%) and Reliance Industries
  (84.0% against 73.8%). 52 of 64 are within five points of their benchmark.
- **Worst example.** Enbridge: every explicit year's unlevered cash flow is
  negative, so the modelled years are worth less than nothing and the terminal
  value is more than the whole enterprise value. Its growth rate is
  acquisition-inflated, which is warned about separately
  (`DATA_CONSTRAINTS.md`).
- **Value moved.** One point of terminal growth either side of 2.5% moves the
  median company -13.8% / +19.5%, and Enbridge -61.3% / +91.5%. Half a point of
  WACC moves the median -7.8% / +9.2%, Enbridge -37.1% / +44.6%. Three companies
  move more than 25% on the growth rate alone.

**The level is a fact and is now disclosed, not buried.** Every valuation
carries a panel saying how much of it is what happens after the forecast, with
the benchmark beside it so a reader can tell the ordinary shape of a DCF from a
company where something else is going on, and with the value at each end of a
stated range for the two assumptions that carry it — terminal growth a point
either way, the discount rate half a point either way. The ranges are shown as
values rather than as a plus-or-minus, because the perpetuity formula is not
symmetric and the two are not additive. The workbook carries the same rows,
computed live from its own cells (DCF sheet rows 60 to 69), and the scenario
suite checks them against the engine's own sensitivity grid.

**Running the forecast longer was measured and rejected.** `CONVENTIONS.md`
DCF 2 treats the length as a judgment call balancing forecast reliability
against how much weight rests on the terminal value, and five to seven is its
usual range. Stretching the fade to seven years lowers the median terminal share
from 76.5% to 69.1%, and to ten years 59.6% — but it **raises** the value for 52
of the 64, by a median 3.2% at seven years and 7.9% at ten, and by up to 53.7%
at ten (Novo Nordisk, Nvidia, MercadoLibre, Broadcom, Arista, Palantir, all
growth companies). That is not rebalancing where the value sits; it is assuming
the company stays above its steady state for longer, on no evidence, and
handing the result a smaller terminal share as cover. The forecast stays at
five years.

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
