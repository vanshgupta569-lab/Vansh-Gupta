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
the fetch; 176 files, 172 with statements, 169 modelled, 69 showing a DCF
value. Values are the site's perpetuity value per share. "What if" figures come
from moving existing sliders or recomputing from the engine's own outputs; no
source was changed to measure anything below. Entries that cite an earlier
commit were measured on the payload set of that date and say so.

---

## Defects, by valuation impact

| ID | Issue | Companies | Worst example | Value moved |
|---|-------|-----------|---------------|-------------|
| KI-12 | Most of the value is the terminal year | 57 of 69 over 75% of EV, median 76.4% | Enbridge, 100.4% of EV: its explicit stage is worth less than nothing | +-1pt of terminal growth: Enbridge -61.3%/+91.5%, Toyota -29.5%/+54.1% |
| KI-11 | Forecast capital spending assumes revenue measures the size of the plant | 23 of 69 more than 50% from their own filed ratio in year one | Shopify 3.95x against 0.70x filed; Saudi Aramco 0.06x against 1.82x | not isolated; sets the explicit-stage cash flow and the terminal asset base |
| KI-2 | No stated discounting convention; timing runs from the fetch date | every company | AbbVie, mid-year +5.4% | mid-year median +4.3%; pro-rated first year median -1.5% |
| KI-3 | Forecast tax rate is a filed ratio applied to a different pretax figure | 18 valued with >10% non-operating pretax | AbbVie, non-operating items -128.5% of filed pretax | ~1.2% of value per point of tax rate |
| KI-4 | Working capital drivers differ between site and workbook | every derived company | payables: cost of sales on site, revenue in workbook | none at defaults; not measured after edits |
| KI-15 | The payload cache is not keyed to the code that reads it | every company for up to six hours after a change | a cached Yahoo payload has no currency evidence and is refused until it refreshes | none on value; a company is refused or read on the old basis until the cache expires |
| KI-6 | An SEC lookup that fails stops the company loading, with no Yahoo fallback | 3 (IBN, CYATY, RTNTF) | ICICI Bank | no page at all |
| KI-7 | Workbook reported-year operating cash flow is derived, not filed | 78 of 97 differ by >10% | Morgan Stanley 30,253 vs filed 1,086 | none on value; breaks "reported = filed" |
| KI-16 | Nothing checks that the dashboard renders what the engine produced | every screen | a component reading the wrong field would pass every check | not knowable until it is built |
| KI-9 | 50% minimum cash buffer has no documented basis | every derived company | — | none on value |

---

### KI-12. Most of the value is the terminal year

- **What is wrong.** The terminal value is a median **76.4%** of enterprise
  value across the 69 valued companies, more than 75% for 57 of them and more
  than 90% for two. A five-year forecast that contributes a fifth of the answer
  is a one-year capitalisation wearing a DCF's clothes, and every figure that
  touches the terminal year moves the whole valuation while five years of
  modelled trading barely register.
- **Where.** `src/engine/model.js` (`buildDCF`, the perpetuity terminal value);
  the drivers that set the explicit years are in `src/data/deriveModel.js`.
- **How measured.** Present value of the explicit years against the present
  value of the perpetuity terminal value, per company.
- **Affects.** 57 of 69 valued companies take more than 75% of enterprise value
  from the terminal value, 2 more than 90%, and 1 more than 100% because its
  explicit stage is worth less than nothing.
- **Worst example.** Enbridge: every explicit year's unlevered cash flow is
  negative, so the explicit stage is worth less than nothing and the terminal
  value is 100.4% of enterprise value.
- **Value moved.** One point of terminal growth either side of 2.5%: Enbridge
  -61.3% / +91.5%, Toyota -29.5% / +54.1%, BP -20.8% / +31.9%, TotalEnergies
  -16.9% / +25.0%. Half a point of WACC: Enbridge -37.1% / +44.6%, Toyota
  -19.7% / +26.4%.
- **The other half of this entry is fixed.** Until 2026-09-23 the terminal year
  was also a step change from the forecast — the normalised cash flow was
  outside half to twice the last explicit year's for 7 of 69 companies, Enbridge
  at -49.34x and Toyota at 8.07x. Fading the growth rate to the terminal rate
  (`KI-13`, fixed) closed it: **no company is now outside that range**, and the
  whole population sits between 0.83x and 1.65x. What remains is the dominance,
  not the discontinuity. The sensitivity above is **larger** than it was, not
  smaller, because the terminal growth rate now sets the shape of the forecast
  as well as the value beyond it.

### KI-11. Forecast capital spending assumes revenue measures the size of the plant

- **What is wrong.** Growth capital spending is the change in revenue times the
  company's own net PP&E over revenue (`METHODOLOGY.md` §7). That holds where
  revenue moves with volume. It fails where revenue moves for another reason: an
  oil major whose revenue falls with the crude price is modelled as releasing
  plant it has not sold, and a pipeline that bought a gas utility has the
  acquired revenue treated as organic and builds two units of plant for every
  unit of it. The ratio is stable enough for a manufacturer and a utility, and
  not for a price taker or a serial acquirer.
- **Where.** `src/data/deriveModel.js` (`ppeToRevenue`); `src/engine/model.js`
  (the PP&E schedule's `maintenancePlusGrowth` branch).
- **How measured.** Forecast capital spending over depreciation against the same
  ratio averaged across the company's reported years, in the **first** forecast
  year and in the **last**. Both are quoted because the growth fade (`KI-13`,
  fixed) acts on the later years only: year one still grows at the rate measured
  from history.
- **Affects.** In year one, 23 of 69 valued companies are more than 50% from
  their own filed ratio and 6 are more than twice out. In the last forecast
  year, 18 of 69 and **1**.
- **Worst example.** Year one: Shopify 3.95x against 0.70x filed, Enbridge 5.73x
  against 1.28x, Broadcom 2.21x against 0.91x; running the other way, Saudi
  Aramco 0.06x against 1.82x and TotalEnergies 0.17x against 1.20x.
- **Value moved.** Not isolated, and it cannot be: it sets both the explicit
  years' cash flow and the size of the asset base that reaches the terminal
  year.
- **The extremes are largely gone.** Fading the growth rate stopped the
  companies whose revenue was modelled as collapsing from spending almost
  nothing on plant. In the last forecast year, capital spending against
  depreciation: TotalEnergies 0.23x to **1.19x** against 1.20x filed, Shell
  0.25x to 1.18x against 0.93x, BP 0.50x to 1.15x against 0.85x, Equinor 0.53x
  to 1.12x against 1.16x, and Saudi Aramco from spending **nothing at all** to
  1.30x against 1.82x. Enbridge comes down from 2.58x to 1.57x. What the fade
  does not fix is the anchor itself: the median gap to the filed ratio is
  unchanged at about a third, because a faded forecast pushes every company
  towards replacement-plus-a-little while the ratios they actually file vary
  widely.

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
