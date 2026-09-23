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
- Taken so far: `KI-1` to `KI-16`. **Next free: `KI-17`.** Retired, meaning
  fixed and never to be reused: `KI-1` (forecast capital spending a flat share
  of revenue, fixed 2026-09-22), `KI-13` (revenue growth a clamped trailing
  average stepping into the terminal rate, fixed 2026-09-23) and `KI-14` (every
  company discounted to a 31 December year end, fixed 2026-09-23). Moved out on 2026-09-22 and never to be
  reused: `KI-5`, `KI-8` and `KI-10`, all to `DATA_CONSTRAINTS.md`. The
  limitation numbers `L1` to `L30` were retired with them; each is accounted
  for in `METHODOLOGY.md` or `DATA_CONSTRAINTS.md`.
- Numbers used before 2026-09-22 — "#4" in a commit message, say — were
  positions in the list on the day they were written, not these IDs.

**Measurement basis, unless an entry says otherwise:** payloads for curated
Apple, the first 100 issuers in the SEC ticker list and a set of non-US
listings, refetched on 2026-09-23 when the fiscal period end date was added to
the fetch; 176 files, 172 with statements, 169 modelled, 64 showing a DCF value
(69 before the revenue-against-plant refusal of the same day). Values are the site's perpetuity value per share. "What if" figures come
from moving existing sliders or recomputing from the engine's own outputs; no
source was changed to measure anything below. Entries that cite an earlier
commit were measured on the payload set of that date and say so.

---

## Defects, by valuation impact

| ID | Issue | Companies | Worst example | Value moved |
|---|-------|-----------|---------------|-------------|
| KI-12 | Three companies rest on the terminal value far more than the arithmetic explains | 3 of 64 more than 10 points above their benchmark; 52 within 5 | Enbridge, 121.7% of EV against a 75.7% benchmark | +-1pt of terminal growth: Enbridge -61.3%/+91.5%, median -13.8%/+19.5% |
| KI-11 | Revenue is a weak proxy for plant where revenue fell much faster than plant | 19 of 64 more than 50% from their own filed ratio in year one | Shell 0.21x against 0.93x filed; BP 0.35x against 0.85x | not isolated; the worse tail is now refused, see the entry |
| KI-2 | No stated discounting convention; timing runs from the fetch date | every company | AbbVie, mid-year +5.4% | mid-year median +4.3%; pro-rated first year median -1.5% |
| KI-3 | Forecast tax rate is a filed ratio applied to a different pretax figure | 18 valued with >10% non-operating pretax | AbbVie, non-operating items -128.5% of filed pretax | ~1.2% of value per point of tax rate |
| KI-4 | Working capital drivers differ between site and workbook | every derived company | payables: cost of sales on site, revenue in workbook | none at defaults; not measured after edits |
| KI-15 | The payload cache is not keyed to the code that reads it | every company for up to six hours after a change | a cached Yahoo payload has no currency evidence and is refused until it refreshes | none on value; a company is refused or read on the old basis until the cache expires |
| KI-6 | An SEC lookup that fails stops the company loading, with no Yahoo fallback | 3 (IBN, CYATY, RTNTF) | ICICI Bank | no page at all |
| KI-7 | Workbook reported-year operating cash flow is derived, not filed | 78 of 97 differ by >10% | Morgan Stanley 30,253 vs filed 1,086 | none on value; breaks "reported = filed" |
| KI-16 | Nothing checks that the dashboard renders what the engine produced | every screen | a component reading the wrong field would pass every check | not knowable until it is built |
| KI-9 | 50% minimum cash buffer has no documented basis | every derived company | — | none on value |

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

### KI-11. Revenue is a weak proxy for plant in a company whose revenue fell much faster than its plant

- **What is wrong.** Growth capital spending is the change in revenue times the
  plant this company carries per unit of it, so the forecast reads a change in
  revenue as a change in the size of the business. Where a company's revenue
  fell far faster than its plant, the rule releases plant the company kept:
  Shell's revenue fell 30.0% across its reported years while its net PP&E fell
  6.8%, and the forecast has it spending **0.21 times depreciation** against the
  0.85 to 1.01 it has filed. BP's revenue fell 21.6% against plant down 10.5%,
  and it spends 0.35x against a filed 0.74 to 0.92.
- **Where.** `src/data/deriveModel.js` (`ppeToRevenue`, and the growth rate that
  drives it); `src/engine/model.js` (the PP&E schedule).
- **How measured.** Forecast capital spending over depreciation against the same
  ratio averaged across the company's reported years, in the first forecast year
  and the last.
- **Affects.** 19 of 64 valued companies are more than 50% from their own filed
  ratio in year one, 17 in the last forecast year; median gap 30%.
- **Worst example.** Shell 0.21x against 0.93x filed, BP 0.35x against 0.85x.
  Running the other way, Shopify 3.95x against 0.70x and Enbridge 5.73x against
  1.28x, the second of which is now warned about (`DATA_CONSTRAINTS.md`).
- **Value moved.** Not isolated: it sets both the explicit years' cash flow and
  the asset base that reaches the terminal year.

**Both tails were attacked at the revenue line on 2026-09-23, and the worse one
closed.** Six bounds on capital spending had already been measured and rejected
(recorded below), because each put the asset base somewhere the company had
never been. The fault was upstream.

**The under-spending tail is now refused.** Where the filing shows revenue
falling across the reported years while the net plant that produces it rose, the
assumption the forecast rests on is not approximately wrong for that company, it
is contradicted by its own balance sheet — it was visibly building while its
revenue fell. Forecasting that revenue down releases plant it is demonstrably
buying, which raises free cash flow and flatters the value, so no value is shown
and the message gives both figures. Five of the 69: Saudi Arabian Oil (revenue
-26.3%, plant +22.0%, capital spending +34.9%), TotalEnergies (-30.7%, +5.7%,
+8.0%), Equinor (-29.0%, +8.0%, +59.8%), Texas Instruments (-3.6%, +139.6%,
+84.8%) and Nestlé (-5.2%, +8.0%, -8.4%). Their year-one spending was -97%,
-86%, -31%, -70% and -54% away from their own filed ratio: the whole of the
worst of this entry. **No other company's value moved at all** — 80 valued on
both sides, none moved, because the change refuses rather than approximates.
The test has no threshold in it: it asks only whether the two moved opposite
ways. Nestlé is the marginal case, a 5.2% revenue dip against 8.0% more plant.
Only that direction is refused; revenue rising while plant falls makes the model
buy plant the company is shedding, which understates the value, and an error
that can only run conservative is warned about rather than refused.

**The over-spending tail is warned, not fixed, because it cannot be.** A year in
which goodwill jumps is a year in which the company bought a business and some
of that year's revenue growth came with it. That much the filing says. It does
not say how much revenue the acquisition brought, and it says nothing at all
about the following year, which carries twelve months of it against the first
year's part year — Enbridge's FY2024 added 4,752 of goodwill, 8.9% of that
year's revenue, beside revenue growth of 22.5%, and its FY2025 growth of 21.9%
is the annualisation with no goodwill jump to mark it. So the year is **not**
excluded: excluding it would throw away the organic growth in that year and
still leave the annualisation in. It is named, with a bound — what the value
would be if the growth rate came from the years that carried no acquisition —
and that bound decides whether the reader is warned or merely told. 15 of the
169 modelled companies are flagged, 5 of them above 5% (Enbridge 18.5%,
Salesforce 10.5%); Microsoft's Activision year moves its value 0.8% and is a
note, which is the bound doing its job.

**What is left is the middle of the same family.** Shell and BP shrank their
plant as their revenue fell, so the signs agree and the test does not reach
them — but plant fell a quarter and a half as fast as revenue, and the rule
assumes they fall together. Catching them needs a threshold on the *magnitude*
of the divergence rather than its sign, and no non-arbitrary one presented
itself. That is this entry now.

**Six bounds on capital spending, measured 2026-09-23 and all rejected.** Kept
so none is proposed again. Measured at `87ba00e` over the then 69 valued
companies against four tests: the year-one and final-year gap to the company's
own filed capex-to-depreciation ratio, distance from its average capital
intensity, whether the normalised terminal cash flow stays within half to twice
the last explicit year (`KI-12`), and whether the asset base ends inside the
capital intensity the company has actually filed.

| Rule | yr1 >50% | last >50% | drift >10% | drift >25% | step outside | outside own filed range |
|---|---|---|---|---|---|---|
| **today** | 23 | 18 | 27 | 5 | **0** | **0** |
| floor at the lowest filed multiple | 14 | 8 | 37 | 18 | 5 | 22 |
| bounded by the filed multiples | **2** | **2** | 41 | 26 | 5 | 32 |
| bounded by filed capex / revenue | 8 | 12 | 41 | 23 | 2 | 19 |
| the filed plant-to-revenue slope | 24 | 24 | 51 | 27 | 3 | 43 |
| that slope, capped at intensity | 22 | 23 | 46 | 17 | 0 | 30 |
| base held in the filed intensity band | 23 | 18 | 27 | **4** | 0 | 0 |
| filed multiples, then that band | 15 | 18 | 31 | 9 | 0 | 0 |
| filed floor fading to 1x depreciation | 14 | 24 | 34 | 10 | 0 | 10 |
| filed band fading to 1x depreciation | **2** | 24 | 39 | 19 | 0 | 22 |

The last column decided it. Under today's rule every valued company ends the
forecast inside the capital intensity it has actually carried, and every rule
that bounds the spending pushes 10 to 32 of them outside it. The asset base is
what the terminal value is taken on and the terminal value is three quarters of
the answer, so a rule that makes the annual spending look more familiar while
putting the base somewhere the company has never been is a worse model. A filed
multiple of depreciation is what a company spent **while growing at the rate it
was growing then**, and the forecast fades to a 2.5% steady state where the
multiple should be one. After the refusal above, the four tests stand at 19 of
64 in year one, 17 in the last year, 23 over 10% of drift and 3 over 25%, no
company outside the half-to-twice terminal band, and none outside its own filed
intensity range.

### KI-2. No stated discounting convention; timing runs from the fetch date

- **What is wrong.** Each forecast year's cash flow is discounted from the price
  date to that fiscal year-end, as though all of it arrives at year-end, and no
  end-of-year or mid-year choice is stated. The first forecast year's full cash
  flow is discounted over only the part of the year left, while net debt is
  taken at the last reported year-end. That is not double counting (cash earned
  since that year-end is not in net debt), but the balance sheet is dated at one
  point and the cash flows timed from another, and the whole discounting
  schedule shifts with the day the price was fetched.
- **Where.** `src/engine/model.js` (`buildDCF`, `yearFrac(sharePriceDate, ...)`);
  `src/data/excelExport.ts` (DCF sheet rows 27-28).
- **How measured.** Code at `f1d9339`, valuation date 2026-09-17 (0.29 years to a
  December year-end): every discount period shortened by half a year (mid-year
  convention); separately, the first year's cash flow scaled to the fraction of
  the year remaining.
- **Affects.** Every company with a DCF.
- **Worst example.** Mid-year: AbbVie +5.4%, Home Depot +4.7%. First year
  pro-rated: Shell -5.3%, AbbVie -5.1%, Gilead -4.6%, Apple -4.1%.
- **Value moved.** Mid-year median +4.3% (max +5.4%); pro-rated first year median
  -1.5% (max -5.3%). Both depend on the fetch date.

### KI-3. Forecast tax rate: a filed ratio on a different pretax figure

- **What is wrong.** The forecast rate is filed tax over filed pretax income,
  which includes non-operating items (investment gains, interest, one-offs) that
  may be taxed differently. It is applied to a forecast pretax figure that
  carries no other income and interest at an assumed rate, and in the DCF to
  operating profit.
- **Where.** `src/data/deriveModel.js` (`taxRate`); `src/engine/model.js`
  (`taxFcst`, `buildDCF` EBIAT).
- **How measured.** Non-operating share of filed pretax income; value per share
  re-run at +1 point of tax rate.
- **Affects.** 18 valued companies whose filed pretax income is more than 10%
  non-operating.
- **Worst example.** AbbVie, non-operating items -128.5% of filed pretax;
  Reliance Infrastructure 65.2%; Marvell 56.6%; Alibaba 53.9%.
- **Value moved.** One point of tax rate moves value by a median -1.2% (range
  -3.0% to +6.3%); the misstatement in points is not yet measured.

### KI-4. Working capital drivers differ between site and workbook

- **What is wrong.** On the site, derived models grow payables and other current
  assets with cost of sales, and every model holds other non-current liabilities
  flat. The workbook drives all three as a % of revenue. It seeds each year's %
  from the engine's balances, so at default assumptions the two agree to the
  cent; they part as soon as revenue growth or gross margin is changed in the
  workbook, and the labels ("Payables as % of revenue") describe a driver the
  site does not use.
- **Where.** `src/data/deriveModel.js` (`workingCapitalDrivers`);
  `src/engine/model.js` (working capital schedule); `src/data/excelExport.ts`
  (the `ap`, `oca` and `oncl` schedules).
- **How measured.** Code comparison during the conventions audit; agreement at
  defaults from the site-vs-workbook run (L27).
- **Affects.** Every derived company (payables, other current assets); every
  company (other non-current liabilities).
- **Worst example.** —
- **Value moved.** None at default assumptions. After a workbook edit, only the
  working capital movement differs; not measured.

### KI-15. The payload cache is not keyed to the code that reads it

- **What is wrong.** The API response is cached for up to six hours, so for that
  long after a change the code reads payloads built by the code before it. A
  Yahoo payload cached before the currency evidence was fetched carries none and
  is refused until it refreshes; an SEC payload cached before it is read as US
  dollars, as it was built; one cached before dividends to common shareholders
  were fetched has none, so residual income falls back to dividends paid less
  preferred dividends, which understates the payout ratio for a filer whose
  dividends paid is already common only (Wells Fargo). The cache key is the
  ticker alone, so nothing invalidates it when the shape of what is fetched
  changes.
- **Where.** `api/company.js` (the response cache).
- **How measured.** Observed after each fetch-layer change; not swept.
- **Affects.** Every company, for up to six hours after any change to what is
  fetched.
- **Worst example.** A company refused for a missing currency it does in fact
  report, until its cache entry expires.
- **Value moved.** None directly: a stale payload either refuses the company or
  reads it on the basis it was built with. It is the inconsistency that is the
  defect, not the figure.

### KI-6. An SEC lookup that fails stops the company loading at all

- **What is wrong.** When the SEC's ticker list has a CIK for a ticker but its
  company-facts file answers 404, the fetcher throws instead of falling back
  to Yahoo, so the company cannot be loaded. This is what was recorded under
  verification limits as "source unavailable".
- **Where.** `api/company.js` (`fetchFromSEC` throws on a non-OK response; the
  handler falls back to Yahoo only when it returns null).
- **How measured.** Currency sweep, 2026-09-17: the handler's error for each.
- **Affects.** 3 found: ICICI Bank (IBN), CyberAgent (CYATY), RTNTF.
- **Worst example.** ICICI Bank: "Could not retrieve data for that ticker right
  now", on every attempt.
- **Value moved.** No page at all for these companies.

### KI-7. Workbook reported-year operating cash flow is derived, not filed

- **What is wrong.** The workbook's reported-year cash from operations is built
  from net income, D&A, SBC and balance sheet movements, not taken from the
  filing. The site's "as reported" panel uses the filed figure; the workbook's
  model and Cash Flow sheets do not.
- **Where.** `src/data/excelExport.ts` (`cfo` and its components for reported
  years); `src/data/excelSheets.ts` (Cash Flow sheet).
- **How measured.** The workbook's derivation recomputed from engine outputs for
  the last reported year, against filed operating cash flow.
- **Affects.** 78 of 97 companies differ by more than 10%, 54 by more than 25%.
- **Worst example.** Morgan Stanley 30,253 against filed 1,086; Bank of America
  -64,914 against 12,613; Tesla -34,047 against 14,747.
- **Value moved.** None (reported years do not enter the DCF), but the reported
  column is not the filed one.

### KI-16. Nothing checks that the dashboard renders what the engine produced

- **What is wrong.** The suite in `verify/` covers the engine, the derivation
  and the workbook, and `verify:workbook` proves the workbook reproduces the
  engine to 4e-9%. No check stands between the engine's output and the React
  screens: a component reading the wrong field, or a label naming a figure it is
  not showing, would pass everything.
- **Where.** `src/components/` (every screen); `verify/` (what it does not
  cover).
- **How measured.** By inspection of what the harness runs.
- **Affects.** Every screen.
- **Worst example.** Not knowable until the check exists, which is the point.
- **Value moved.** Unknown. `playwright` is already a dev dependency, so a check
  that loads a company, reads the headline figures off the page and compares
  them with a direct engine run would close it. Not built.

### KI-9. The 50% minimum cash buffer has no documented basis

- **What is wrong.** Derived models set the minimum cash balance at half the
  last reported cash. Every other derived assumption states its basis in
  `provenance`, shown on the Sources sheet; this one does not, and the workbook
  shows the figure without saying where it comes from. (Apple's hand-built
  100,000 comes from its source workbook.)
- **Where.** `src/data/deriveModel.js` (`minimumCashDesired`);
  `src/data/excelExport.ts` (`minCash` driver, recovered from the engine's
  excess-cash line).
- **How measured.** Code review during the conventions audit.
- **Affects.** Every derived company.
- **Worst example.** —
- **Value moved.** None. It sizes forecast revolver draws and, with the
  circularity switch on, revolver interest; neither reaches unlevered free cash
  flow or the equity bridge.

---

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
