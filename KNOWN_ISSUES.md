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
  of revenue, fixed 2026-09-22). Moved out on 2026-09-22 and never to be
  reused: `KI-5`, `KI-8` and `KI-10`, all to `DATA_CONSTRAINTS.md`. The
  limitation numbers `L1` to `L30` were retired with them; each is accounted
  for in `METHODOLOGY.md` or `DATA_CONSTRAINTS.md`.
- Numbers used before 2026-09-22 — "#4" in a commit message, say — were
  positions in the list on the day they were written, not these IDs.

**Measurement basis, unless an entry says otherwise:** payloads for curated
Apple, the first 100 issuers in the SEC ticker list and a set of non-US
listings, frozen on 2026-09-21; 176 fetched, 169 modelled, 69 showing a DCF
value. Values are the site's perpetuity value per share. "What if" figures come
from moving existing sliders or recomputing from the engine's own outputs; no
source was changed to measure anything below. Entries that cite an earlier
commit were measured on the payload set of that date and say so.

---

## Defects, by valuation impact

| ID | Issue | Companies | Worst example | Value moved |
|---|-------|-----------|---------------|-------------|
| KI-12 | Most of the value is the terminal year, and the terminal year is a step change from the forecast | 56 of 69 over 75% of EV | Enbridge 100.4% of EV; its normalised cash flow flips sign | +-1pt of terminal growth: Enbridge -50.2%/+72.0%, Toyota -36.8%/+66.8% |
| KI-13 | Revenue growth is a clamped trailing CAGR, then +2.5% forever at the join | 8 of 69 clamped; the join affects all | TotalEnergies and Shell shrink 10% a year for five years, then grow forever | holding revenue flat: TotalEnergies +74.9%, BP +51.7%, Shell +33.0% |
| KI-11 | Forecast capital spending assumes revenue measures the size of the plant | 21 of 69 more than 50% from their own filed ratio | Saudi Aramco forecast to spend nothing against 1.82x depreciation filed | not isolated; sets the explicit-stage cash flow and the terminal asset base |
| KI-14 | Every derived company is discounted to a 31 December year end, whatever its real one | every derived company | Apple's year ends in late September | re-dated a quarter earlier: median +2.21%, up to +6.20% |
| KI-2 | No stated discounting convention; timing runs from the fetch date | every company | AbbVie, mid-year +5.4% | mid-year median +4.3%; pro-rated first year median -1.5% |
| KI-3 | Forecast tax rate is a filed ratio applied to a different pretax figure | 18 valued with >10% non-operating pretax | AbbVie, non-operating items -128.5% of filed pretax | ~1.2% of value per point of tax rate |
| KI-4 | Working capital drivers differ between site and workbook | every derived company | payables: cost of sales on site, revenue in workbook | none at defaults; not measured after edits |
| KI-15 | The payload cache is not keyed to the code that reads it | every company for up to six hours after a change | a cached Yahoo payload has no currency evidence and is refused until it refreshes | none on value; a company is refused or read on the old basis until the cache expires |
| KI-6 | An SEC lookup that fails stops the company loading, with no Yahoo fallback | 3 (IBN, CYATY, RTNTF) | ICICI Bank | no page at all |
| KI-7 | Workbook reported-year operating cash flow is derived, not filed | 78 of 97 differ by >10% | Morgan Stanley 30,253 vs filed 1,086 | none on value; breaks "reported = filed" |
| KI-16 | Nothing checks that the dashboard renders what the engine produced | every screen | a component reading the wrong field would pass every check | not knowable until it is built |
| KI-9 | 50% minimum cash buffer has no documented basis | every derived company | — | none on value |

---

### KI-12. Most of the value is the terminal year, and the terminal year is a different company

- **What is wrong.** Two things that compound. First, the terminal value is
  most of the answer: across the 69 valued companies it is a median 77.9% of
  enterprise value, more than 75% for 56 of them and more than 90% for three.
  Second, the terminal year is not the steady state the explicit forecast
  arrives at. Terminal capital spending is set equal to depreciation, while the
  explicit years spend whatever the drivers give, so where the two differ the
  normalised cash flow is a step away from the last forecast year rather than a
  continuation of it. A five-year forecast that contributes a fifth of the
  value, and whose last year does not resemble the year being capitalised, is a
  one-year capitalisation wearing a DCF's clothes.
- **Where.** `src/engine/model.js` (`buildDCF`, `terminalCapexTreatment` and
  the normalised cash flow); the drivers that set the explicit years are in
  `src/data/deriveModel.js`.
- **How measured.** Present value of the explicit years against the present
  value of the perpetuity terminal value, per company; and the normalised
  terminal cash flow against the last explicit year's unlevered free cash flow.
- **Affects.** 56 of 69 valued companies take more than 75% of enterprise value
  from the terminal value, 3 more than 90%, and 1 more than 100% because its
  explicit stage is worth less than nothing. 7 of 69 have a normalised cash
  flow outside half to twice the last explicit year's.
- **Worst example.** Enbridge: every explicit year's unlevered cash flow is
  negative (-94 to -259 against capital spending of 16,160 to 21,305), so the
  explicit stage is worth -707 against a terminal value of 168,150 — 100.4% of
  enterprise value — and the normalised cash flow of 12,796 is the opposite
  sign to the -259 it follows. Toyota: 98.2% of enterprise value, the
  normalised cash flow 8.07 times the last explicit year's, because the
  terminal year stops buying the plant the five forecast years bought at 1.72
  times depreciation. Running the other way, TotalEnergies' normalised cash
  flow is 0.40 of its last explicit year, Shell's 0.46 and BP's 0.52, because
  the terminal year makes them pay for the replacement the forecast years did
  not.
- **Value moved.** Everything that touches the terminal year moves the whole
  valuation. One point of terminal growth either side of 2.5%: Enbridge -50.2%
  / +72.0%, Toyota -36.8% / +66.8%, BP -17.2% / +25.7%. Half a point of WACC:
  Enbridge -31.8% / +37.0%, Toyota -25.4% / +28.2%. The exit-multiple method is
  insensitive to all of it — its terminal value is EBITDA times a flat 12x,
  which no capital-spending or depreciation change touches — which is why the
  two methods now disagree by roughly a factor of two on these companies
  (TotalEnergies 43.95 against 91.06, BP 5.74 against 12.52). L26 records the
  spread as a fact to be shown; this entry is about what is behind it.

### KI-13. Revenue growth is a clamped trailing average, capitalised at 2.5% forever

- **What is wrong.** The forecast growth rate is the trailing compound growth
  of the reported years, clamped to -10% and +25%, held flat for all five
  forecast years. Two problems. The clamp binds for 8 of 69 valued companies,
  and where it binds the figure is the clamp, not the company. And whatever the
  rate, the terminal year capitalises the final forecast year at +2.5% growth
  in perpetuity, so a company modelled as shrinking 10% a year for five years
  becomes a company growing 2.5% a year forever at the instant the forecast
  ends, with nothing in between. For a business whose reported window happens
  to straddle a commodity peak, the whole valuation is an extrapolation of the
  fall from that peak.
- **Where.** `src/data/deriveModel.js` (`rawGrowth`, `clamp(rawGrowth, -0.10,
  0.25, 0.03)`); `src/engine/model.js` (the perpetuity terminal value).
- **How measured.** The clamp counted where the default sits exactly on -10% or
  +25%; the join measured by holding revenue flat at 0% instead of the default
  and re-reading the perpetuity value per share.
- **Affects.** 8 of 69 are clamped: Arista, MercadoLibre, Nvidia, Palantir and
  Shopify at +25%, Equinor, Shell and TotalEnergies at -10%. The
  shrink-then-grow join affects every company whose forecast growth differs
  from 2.5%, which is all of them.
- **Worst example.** TotalEnergies: revenue peaked at 263,310 in 2022 and was
  182,344 in 2025, a trailing compound rate of -11.5% that the clamp holds at
  -10%. The forecast takes revenue down another 41% to 107,672, and then grows
  it at 2.5% a year forever. Shell is the same shape.
- **Value moved.** Holding revenue flat instead of the default, on the
  perpetuity value: TotalEnergies +74.9%, BP +51.7%, Shell +33.0%. Two points
  either side of the default moves TotalEnergies +11.8% / -10.8% and BP +11.3%
  / -10.1%, so the sensitivity is not linear in the clamp — it is the level,
  not the slope, that carries the value.

### KI-11. Forecast capital spending assumes revenue measures the size of the plant

- **What is wrong.** Growth capital spending is the change in revenue times the
  company's own net PP&E over revenue (L30). That holds where revenue moves
  with volume. It fails where revenue moves for another reason. An oil major
  whose revenue falls with the crude price is modelled as releasing plant it
  has not sold and will not sell, so it is forecast to spend almost nothing; a
  pipeline that bought a gas utility has the acquired revenue treated as
  organic growth and is forecast to build two units of plant for every unit of
  it. The ratio is stable enough for a manufacturer and a utility, and not for
  a price taker or a serial acquirer.
- **Where.** `src/data/deriveModel.js` (`ppeToRevenue`); `src/engine/model.js`
  (the PP&E schedule's `maintenancePlusGrowth` branch).
- **How measured.** Forecast year-one capital spending over depreciation
  against the same ratio averaged across the company's reported years.
- **Affects.** 21 of 69 valued companies are more than 50% away from their own
  filed ratio, and 6 are more than twice out.
- **Worst example.** Saudi Aramco is forecast to spend nothing at all — total
  spending floors at nil because the release exceeds replacement — against
  1.82 times depreciation across its reported years. Shopify 3.95x against
  0.70x filed, Broadcom 2.26x against 0.91x, Enbridge 2.62x against 1.28x;
  running the other way, TotalEnergies 0.17x against 1.20x, Shell 0.21x against
  0.93x, Texas Instruments 0.95x against 3.23x. In money, TotalEnergies is
  forecast to spend 2.3bn a year against the 16.3bn a year it averaged over its
  four reported years.
- **Value moved.** Not isolated, and it cannot be: it sets both the explicit
  years' cash flow and the size of the asset base that reaches the terminal
  year, which are the two halves of KI-12. The predecessor defect, a flat share
  of revenue, moved 31 of 85 valued companies by more than 5% when it was
  replaced (L30); this is the part of that replacement that does not hold.

### KI-14. Every derived company is discounted to a 31 December year end

- **What is wrong.** The fetch carries the fiscal *year* of each period and not
  the date it ended, so the derivation writes 31 December for the last reported
  year-end and for each of the five forecast year-ends. Every company is
  therefore discounted as though its year ended on 31 December. It does not for
  Apple, Microsoft, Oracle, Nvidia, Walmart, Toyota or any other filer with a
  non-calendar year, and the error runs the same way in every forecast year
  rather than cancelling. The curated Apple file shows what the right dates look
  like (27 September 2025, then 30 September 2026 and so on); no derived company
  has them.
- **Where.** `api/company.js` (the fetch never reads the period end date);
  `src/data/deriveModel.js` (`latestFiscalYearEnd`, `forecastYearEndDates`),
  consumed by `src/engine/model.js` (`buildDCF`, `yearFrac`).
- **How measured.** Re-dating every forecast year-end to 30 September, a quarter
  earlier than the assumption, and re-reading the perpetuity value per share, at
  `e52cdc6` on the payloads of 2026-09-21. This measures the size of the error
  for a September filer, not how many companies have one, which the payloads
  cannot say.
- **Affects.** Every derived company's discounting. The subset with a
  non-December year end is discounted wrongly and cannot be identified without
  refetching.
- **Worst example.** Re-dated a quarter earlier, the largest move is +6.20%.
- **Value moved.** Median +2.21% across the 69 valued companies, range +1.80% to
  +6.20%, 64 of them more than 2%. It runs one way: a company whose year really
  ends earlier than assumed has its cash flows discounted over too long a period,
  so it is undervalued. Distinct from KI-2, which is about the convention not
  being stated and the first year being timed from the fetch date; this is the
  year-end itself being wrong.

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
