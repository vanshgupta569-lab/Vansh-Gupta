# Known issues

A living record of defects that have been found and not yet fixed, and of the
limitations that fixes have deliberately left behind.

**What the engine does, and why, is in `METHODOLOGY.md`.** This file is the
list of what is wrong with it. Where a limitation below is really a design
decision, the treatment and the reasoning live there and the entry here keeps
the measurement and points to it.

**How this file is kept**

- Fixing something listed here? Delete its entry **in the same commit as the
  fix**. Do not mark it resolved; remove it.
- Found something and not fixing it now? Add an entry.
- A fix that leaves a limitation behind (a refusal, an approximation, a case it
  does not cover) records that limitation here.
- Every entry says what is wrong, where it lives, how it was measured, how many
  companies it affects, the worst example, and roughly how much it moves a
  valuation. Entries are ordered by valuation impact, largest first.
- **Every entry has a permanent ID, and an ID is never reused.** `KI-4` means
  the same defect for as long as this file exists; fixing `KI-1` does not make
  anything else `KI-1`. The order of the table still says which matters most,
  but nothing outside this file should refer to an entry by its position.
  Limitations (`L1` and up) have always worked this way.
- Taken so far: `KI-1` to `KI-14`, and `L1` to `L30`. **Next free: `KI-15`,
  `L31`.** Retired, meaning fixed and never to be reused: `KI-1` (forecast
  capital spending a flat share of revenue, fixed 2026-09-22, see `L30`).
- Numbers used before 2026-09-22 — "#4" in a commit message, say — were
  positions in the list on the day they were written, not these IDs.

**Measurement basis, unless an entry says otherwise:** code at `03617c2`;
payloads for curated Apple, the first 100 issuers in the SEC ticker list and
three Yahoo listings (RELIANCE.NS, RELINFRA.NS, TATAMOTORS.NS), frozen on
2026-09-17. Of the 103 fetched, 98 are modelled and 42 show a DCF value at
default drivers. Values are the site's headline value per share. "What if"
figures come from moving existing sliders or recomputing from the engine's own
outputs; no source was changed to measure anything below. KI-2, KI-4 and KI-9
and design choice D1 come from the conventions audit (CONVENTIONS_AUDIT.md),
measured at `f1d9339`. KI-6 comes from the currency sweep and KI-10
from the SG&A sweep, on payloads fetched
2026-09-17. The depreciation work refetched every payload on 2026-09-18 with
filed depreciation and amortisation added (176 fetched, 168 modelled, 82
showing a DCF value), which is the basis for the entries that cite `HEAD`. The equity bridge work refetched them again on
2026-09-18 with minority interests and preferred stock added. The residual
income work refetched them on 2026-09-19 with dividends to common
shareholders added (176 fetched, 169 modelled, 80 showing a value, 17 of them
a residual income value), which is the basis for L19 and L20. The EBITDA
definition work ran on those same payloads on 2026-09-20 (63 companies with a
DCF value, 45 of them reporting stock compensation), which is the basis for
L21; its market-approach figures use peer medians fetched the same day. The
marketable securities work refetched every payload on 2026-09-20 with
short-term and long-term securities added (176 fetched, 169 modelled, 63 with
a DCF value), which is the basis for L22 and, re-measured at `b7432d6` after
the securities went into net debt, L23. The debt work refetched every payload
on 2026-09-20 with short-term borrowings, current maturities and lease
liabilities added (176 fetched, 169 modelled, 64 with a DCF value), which is
the basis for L24, for L25 re-measured at `e1e6cfc`, for L26 re-measured at
`5ecd822` and for L27 re-measured at `933fc2c`, all on the same payloads. The
depreciation work refetched every payload on 2026-09-21, with net PP&E read
from the finance-lease-inclusive tag as well (L28), and both sides of its
measurement were snapshotted on that set with `verify/`. KI-11, KI-12 and
KI-13 were measured at `e52cdc6` on the same 2026-09-21 payloads, over the 69
companies that show a DCF value there.

---

## Defects, by valuation impact

| ID | Issue | Companies | Worst example | Value moved |
|---|-------|-----------|---------------|-------------|
| KI-12 | Most of the value is the terminal year, and the terminal year is a step change from the forecast | 56 of 69 over 75% of EV | Enbridge 100.4% of EV; its normalised cash flow flips sign | +-1pt of terminal growth: Enbridge -50.2%/+72.0%, Toyota -36.8%/+66.8% |
| KI-13 | Revenue growth is a clamped trailing CAGR, then +2.5% forever at the join | 8 of 69 clamped; the join affects all | TotalEnergies and Shell shrink 10% a year for five years, then grow forever | holding revenue flat: TotalEnergies +74.9%, BP +51.7%, Shell +33.0% |
| KI-11 | Forecast capital spending assumes revenue measures the size of the plant | 21 of 69 more than 50% from their own filed ratio | Saudi Aramco forecast to spend nothing against 1.82x depreciation filed | not isolated; sets the explicit-stage cash flow and the terminal asset base |
| KI-14 | Every derived company is discounted to a 31 December year end, whatever its real one | every derived company; how many are non-December is not knowable from the payloads | Apple's year ends in late September | re-dated a quarter earlier: median +2.21%, up to +6.20% |
| KI-2 | No stated discounting convention; timing runs from the fetch date | every company | AbbVie, mid-year +5.4% | mid-year median +4.3%; pro-rated first year median -1.5% |
| KI-3 | Forecast tax rate is a filed ratio applied to a different pretax figure | 18 valued with >10% non-operating pretax | AbbVie, non-operating items -128.5% of filed pretax | ~1.2% of value per point of tax rate |
| KI-4 | Working capital drivers differ between site and workbook | every derived company | payables: cost of sales on site, revenue in workbook | none at defaults; not measured after edits |
| KI-5 | Palo Alto may be a false-positive missing-debt refusal | 1 refused (PANW) | Palo Alto | no value shown at all |
| KI-6 | An SEC lookup that fails stops the company loading, with no Yahoo fallback | 3 (IBN, CYATY, RTNTF) | ICICI Bank | no page at all |
| KI-7 | Workbook reported-year operating cash flow is derived, not filed | 78 of 97 differ by >10% | Morgan Stanley 30,253 vs filed 1,086 | none on value; breaks "reported = filed" |
| KI-8 | Reported net income still does not tie for three companies | 3 | McDonald's 19,930 vs filed 8,563 | none (all refused or valued from filed statements) |
| KI-9 | 50% minimum cash buffer has no documented basis | every derived company | — | none on value |
| KI-10 | Stock compensation the filing does not break out is never added back, understating cash generation | 56 (20 valued) | Novo Nordisk Copenhagen +1.8% | not measured for 19 of the 20 |

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

### KI-5. A possible false-positive missing-debt refusal

- **What is wrong.** A company is refused when its borrowings are missing in the
  last reported year but reported earlier (so that debt is not silently counted
  as zero). This is kept on purpose: understating debt overstates value, which
  is worse than an explained refusal. But it cannot tell a changed XBRL tag from
  debt that was genuinely repaid.
- **Where.** `src/data/deriveModel.js` (`deriveBalanceSheet`,
  `blocksValuation`); `api/company.js` (the borrowing tags).
- **How measured.** Company sweep refusals.
- **Affects.** 1: Palo Alto Networks. Broadcom and Coca-Cola were refused for
  this reason until every borrowing was fetched (L24): both tag short-term
  borrowings the fetcher did not read before, and both are now valued
  (Broadcom 225.50, Coca-Cola 46.60). Palo Alto tags none in any form, so the
  test still refuses it.
- **Worst example.** Palo Alto, whose convertible notes may simply have been
  settled; accepted as a possible false positive.
- **Value moved.** No value is shown at all for this company.

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

### KI-8. Reported net income still does not tie for three companies

- **What is wrong.** Pretax income is not filed for a reported year, so the
  derived income statement cannot be tied.
- **Where.** `src/data/deriveModel.js`.
- **How measured.** Reported-line comparison against the filing.
- **Affects.** McDonald's, Oracle, Welltower (95 of 98 tie).
- **Worst example.** McDonald's 19,930 against filed 8,563.
- **Value moved.** None: McDonald's and Oracle are refused; Welltower's residual
  income value is built from the filed statements, not the model.

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

### KI-10. Stock compensation the filing does not break out is never added back

- **What is wrong.** Where a filing does not report stock based compensation,
  the model charges none and adds none back (limitation L14). If the company
  does pay it, the cost sits inside its cost lines and is treated as though it
  were cash, so cash from operations and unlevered free cash flow are short by
  that amount and the value is understated. EBITDA is no longer affected: it
  never adds stock compensation back for anyone (L21), so a company that does
  not break it out is on the same basis as one that does. IFRS filers carry it in a footnote
  more often than in the cash flow statement, which is why the ones affected
  are almost all non-US.
- **Where.** `api/company.js` (`annualStockBasedCompensation` only);
  `src/data/deriveModel.js` (`stockBasedCompensation`); `src/engine/model.js`
  (`sbcPercentOfOpex`, the cash flow add-back).
- **How measured.** At `ea2f020` on the 168 payloads of 2026-09-17: companies
  whose last reported year does not break SBC out, then, where another year
  does report it, that year's share of revenue charged and added back through
  the engine's own SBC assumption.
- **Affects.** 56 companies, 20 of them valued. For 19 of the 20 no year
  reports it at all, so the size is unknown: Samsung, Saudi Aramco, Sony,
  Toyota (Tokyo), AstraZeneca (London), BHP, Enbridge, Equinor, Inditex, LVMH,
  MercadoLibre, Reliance Industries, Rio Tinto, Shell (London), Siemens, TCS,
  TotalEnergies (Paris), Volvo, ExxonMobil.
- **Worst example.** Novo Nordisk's Copenhagen listing, the one case where an
  earlier year reports it: 0.8% of revenue, value 870.97 against 886.88 with it
  charged and added back.
- **Value moved.** +1.8% in the one case that can be estimated; not measurable
  for the other 19 without the figure the filing does not give.

---

## Limitations left by fixes

These are deliberate behaviours, not bugs, recorded so they are not mistaken
for either.

- **L1. Forecasts that cannot be computed are refused.** When the filing never
  reports cost of sales, capex, or two years of PP&E, the forecast balance sheet
  comes out not-a-number and the model is refused (41 of 98). This includes the
  DCF of every bank, and non-banks such as Linde, Mastercard, Disney, RTX,
  Union Pacific, NextEra (no cost of sales), Meta, Salesforce, Chevron, Micron
  (no PP&E). Banks keep their residual income value (L7). `src/engine/model.js`,
  `src/data/deriveModel.js`.
- **L2. No filed operating income, no value.** Refused rather than estimated:
  ConocoPhillips (was 347.99), Eaton (246.51), IBM (244.17), Johnson & Johnson
  (283.03), KLA (76.64), Merck (169.19). `src/engine/model.js`
  (`incomeStatementRefusal`).
- **L3. One unbalanceable year refuses the company.** A reported year with no
  derivable totals (a spin-off's first year) refuses the whole company:
  BlackRock, GE Vernova, Shopify, SanDisk.
- **L4. The amortisation run-off needs the filing to separate amortisation.**
  The annual charge is the filed amortisation of intangibles, or filed D&A less
  the filed depreciation the forecast charges. Where a filing gives neither
  (27 of 168 companies, almost all Yahoo-sourced, which publishes no
  amortisation line), all of its D&A is treated as depreciation of PP&E and no
  amortisation is run off. No amortisation is charged where intangibles are not
  tagged (Apple, Costco). The terminal value excludes any remaining
  amortisation tax shield, which is conservative (AstraZeneca's pool lasts 33.5
  years). `src/engine/model.js`, `api/company.js`.
- **L5. Reported D&A and SBC are allocated pro rata across cost lines.** Filings
  do not say which line carries how much, so the reported cost of sales, R&D and
  SG&A excluding D&A and SBC are allocations; operating profit is exact.
  `src/engine/model.js` section 4b.
- **L6. Derived total liabilities include non-controlling interests.** Where
  total liabilities is worked out as total assets less shareholders' equity
  (23 of 169 companies), minority interests sit in liabilities on the model's
  balance sheet. That is presentation only and is not deducted twice: the
  equity bridge takes net debt as long-term debt less cash, never total
  liabilities, and reads minority interests from the filing's own balance
  (15 of the 23) or finds none (8). The total-assets-less-liabilities-less-
  equity route to minority interests uses only a FILED total liabilities
  figure, so it can never read the derived one. `src/data/deriveModel.js`.
- **L7. Bank residual income is exempt from the forecast refusal.** It is gated
  on the filed balance sheet balancing, because it is built from the filing,
  not the forecast. BlackRock's is withheld (L3). `src/data/autoCompany.ts`.

- **L8. A US listing of a company based elsewhere gets no value.** A depositary
  receipt can stand for a fraction or a multiple of an ordinary share, and no
  free source publishes the ratio reliably; Yahoo's own share counts for these
  listings are scaled to the receipt for some (Toyota a tenth, Shell a half,
  Alibaba an eighth) and not for others (AstraZeneca, whose receipt is half a
  share). So every Yahoo-sourced listing on a US market by a company not based
  in the United States is refused, and so is London's international order book
  (Samsung's GDR). That includes listings that are in fact ordinary shares one
  for one (Toronto-Dominion, Royal Bank, Arm, Sea, Nu, UBS). The currency sweep
  refuses 38 such listings; 35 of them showed a value before, and none do now. The home-market
  listing (7203.T, SHEL.L, TD.TO) is valued instead. Non-US companies that file
  10-Ks (Eaton, Linde, Medtronic, Accenture) are unaffected: their statements
  count the registered shares their ticker trades. `src/data/deriveModel.js`
  (`listingComparability`).
- **L9. A reporting currency that is not stated, or stated two ways, gets no
  value.** Yahoo's financialCurrency is cross-checked against the currency
  stamped on each figure, and the SEC path reads the XBRL units. Refused where
  they disagree: Vale (VALE, VALE3.SA) and Petrobras (PBR, PETR4.SA), whose
  figures are stamped USD while financialCurrency says BRL; Enbridge's SEC
  filing mixes CAD and USD units. `api/company.js`, `src/data/deriveModel.js`.
- **L10. A converted price uses the rate on the day it was fetched.** Where the
  statements and the listing differ in currency (Shell in London: USD
  statements, price in pence), the price, previous close and 52-week range are
  converted at one Yahoo rate fetched with the price, so the 52-week range is
  today's rate applied to a year of prices. No rate within a week, no value.
  The header says the price is converted and at what rate; the workbook's
  Sources sheet records it. `api/company.js` (`quoteInReportingCurrency`).
- **L11. The share-count check on home listings is loose.** A Yahoo listing's
  own shares outstanding must be within 1.5 times the filing's diluted count.
  It catches a gross mismatch, not a small one, and it is skipped when Yahoo
  gives no count. `src/data/deriveModel.js`.
- **L12. Cached payloads from before this fix.** The API response is cached for
  up to six hours (a day stale). A cached Yahoo payload has no currency
  evidence and is refused until it refreshes; a cached SEC payload is read as
  US dollars, as it was built. A payload cached before dividends to common
  shareholders were fetched (L19) has none, so residual income takes dividends
  paid less preferred dividends; for a filer whose dividends paid is already
  common only (Wells Fargo) that understates the payout ratio until it refreshes.

- **L13. Other operating costs are forecast by a rule, not from a named line.**
  Where they are a cost, their share of revenue in the last reported year is
  held flat, like every other cost line (D1). Where they are income (the
  filing's named cost tags come to more than its operating costs), the smaller
  of that year's income and the median across the reported years is forecast,
  so a one-off gain is not carried forward (Boeing's FY2025 business-sale gain,
  10.8% of revenue) while an overlap that recurs is (Procter & Gamble 2.4%,
  MercadoLibre 11%). The median test cannot tell a gain that recurs from an
  overlap. Removing the old 0-60% SG&A clamp, which applied to SG&A and this
  residual together, moved MercadoLibre from 632.04 to 1,373.31: its forecast
  operating margin had been held at 5.7% against 15.7% filed. There is no
  slider for other operating costs; the SG&A slider now moves filed SG&A.
  `src/data/deriveModel.js` (`otherOperatingCostsMargin`).
- **L14. A line the filing does not report is not nil, but some arithmetic
  counts it as nil, and says so.** R&D, SG&A, stock compensation, dividends and
  buybacks are shown as not reported. Where a sum needs them: an unreported R&D
  or SG&A cost is inside other operating costs, so operating income still ties;
  unreported stock compensation is neither charged nor added back, so any the
  company paid stays inside its cost lines (and cash from operations is not
  credited with it, which is KI-10); a line not reported in the last reported year is forecast
  at nil. Dividends and buybacks are averaged over the years that report them,
  and none are forecast where none are. The workbook's statement totals read
  "not reported" cells through N(), which its notes state; the provenance lists
  each unreported line and year. `src/data/deriveModel.js` (`NOT_REPORTED`),
  `src/engine/model.js`, `src/data/excelSheets.ts`.

- **L15. A depreciation rate that cannot be forecast from refuses the company.**
  The rate is filed depreciation over capital spending. Where it is not a
  positive number, or where it depreciates the PP&E balance past nothing inside
  the forecast, there is no value: Sony's Tokyo listing (197% of capital
  spending), Palantir (114%), ExxonMobil (whose filing carries no D&A tag at
  all, so the balance movement is all there is, and it is negative). A rate
  above 100% is kept where the balance survives the forecast, which is the
  ordinary position of a company spending less than it depreciates: 44 of 158
  measured rates are above 100%, the highest 243%. `src/engine/model.js`
  (`depreciationRateProblem`).
- **L16. Where the filing reports no depreciation at all, the balance movement
  is still used.** 11 of 168 companies report no D&A in any year. For them the
  rate comes from the movement in the PP&E balance, which counts disposals,
  impairments, leases and acquisitions, for the years that have an opening
  balance — never the first reported year, which has none. Five of the 11 are
  refused for other reasons; the rest are refused by L15 where the movement is
  negative. `src/engine/model.js` (`avgOfHistory`).
- **L17. An input the forecast needs and the filing never reports now refuses
  explicitly.** Cost of sales, capital expenditure, or two years of PP&E. These
  used to refuse a company only through the not-a-number they left in the
  forecast balance sheet, which reading the rate from filed depreciation
  removed; Meta, Micron and Philip Morris report no net PP&E at all and would
  have been valued from an opening balance of nil. `src/engine/model.js`
  (`filingMissingValuationInput`).

- **L18. Minority interests and preferred stock come off at book value.** Both
  are taken at the last reported balance sheet, as net debt is, not at the
  value the market puts on them; a minority interest's market value is not
  observable and a preferred balance filed at par is not the claim. Where the
  filing shows a claim exists but gives no amount, the company is refused
  rather than the claim treated as nil (Boeing, Morgan Stanley and Santander on
  this sweep, none of which had a discounted cash flow value before; Morgan
  Stanley's residual income value is withheld too, L19). How each is read, and
  why convertible preferred already in the diluted count is not taken off
  again, is in METHODOLOGY.md §15. `src/data/deriveModel.js`,
  `src/engine/model.js` (`nonCommonClaimNotReported`).

- **L19. Residual income values the common shares, and refuses where the
  preferred claim cannot be read.** Each year's preferred stock comes out of
  book equity, its preferred dividends out of net income, and dividends to
  common shareholders are used for the payout ratio: the filing's common
  dividends where it tags them (Wells Fargo), else dividends paid less preferred
  dividends, because the tags used then include preferred dividends (checked
  against the SEC filings for Citigroup, JPMorgan, Bank of America, Goldman
  Sachs and Schwab). For Royal Bank and Toronto-Dominion (Toronto listings),
  Yahoo gives only total cash dividends and no split; they are taken to include
  preferred dividends, which has not been checked against their filings, and
  moves the payout ratio by about 3 points either way. Convertible preferred
  already in the diluted share count stays in, as in L18. Where either of the
  last two reported years shows a preferred claim without both its balance and
  its dividends, no value is shown: ICBC (preferred stock, no preferred
  dividends; was 12.70), American Express (preferred dividends beside a
  preferred balance filed as nil, the par value; was 555.07) and Morgan Stanley
  (preferred dividends, no balance; was 15.04). Measured against `80b27f2` on
  the same payloads: Schwab 88.90 to 103.18 (+16.1%), Citigroup 74.79 to 68.36
  (-8.6%), Wells Fargo -4.0%, Bank of America -3.1%, Goldman Sachs -2.1%,
  Toronto-Dominion +1.7%, JPMorgan +1.6%, Royal Bank -0.8%. Values rise where
  the preferred stock costs less than the common shareholders earn: taking it
  out raises the return on common equity more than it lowers the book.
  `src/data/residualIncome.js` (`preferredClaims`), `api/company.js`
  (`commonDividendsPaid`).

- **L20. Residual income book equity is the parent's, minority interests taken
  out.** Book equity is total assets less FILED total liabilities, which is the
  whole group's including minority interests, while the filing's net income is
  the parent's share. Minority interests now come out of each year's book on
  the same sourcing as the equity bridge (L18): the filing's own balance plus
  any redeemable minority interests, else equity including minority interests
  less shareholders' equity, else total assets less total liabilities less
  shareholders' equity, all filed. Where a filing reports a minority share of
  net income and no balance that can be read, no value is shown rather than
  the claim treated as nil; no company on this sweep is refused for that.
  Checked on all 17 companies shown: book plus preferred stock equals the
  filed parent equity figure exactly for every one, including UnitedHealth,
  whose equity line is the group figure (100,090 against the parent's 94,110).
  Measured against `e277bf5` on the same payloads: HDFC Bank 529.82 to 578.15
  (+9.1%), UnitedHealth 178.63 to 193.31 (+8.2%), Welltower 5.45 to 5.87
  (+7.7%), Chubb +3.3%, Mitsubishi UFJ +2.8%, HSBC (Hong Kong and London)
  +2.1%, Wells Fargo +0.3%, Royal Bank +0.1%, Citigroup -0.1%, DBS and Bank of
  America under 0.05%. `src/data/residualIncome.js` (`minorityClaims`).

- **L21. The DCF and the exit multiple take different views of stock
  compensation, and both are published.** EBITDA leaves it in costs, because
  the peers' multiples do; unlevered free cash flow adds it back, because that
  calculation is about cash. The two methods therefore disagree about it by
  construction, and neither is corrected towards the other: they stand side by
  side (L26) so a reader can see which carries the charge. That is a design
  boundary, not a measurement, and it is not quantified. Where a filing never
  breaks stock compensation out, its EBITDA was already on this basis (18 of
  the 63 valued companies then); what is still missing for those is the
  cash-flow add-back, which is KI-10. The definition and the evidence for it
  are in METHODOLOGY.md §5. Measured against `2d02f95` on the payloads of
  2026-09-19: of the 63 companies with a DCF value, 22 moved more than 5% on
  the exit multiple (AMD -23.3%, Tesla -23.2%, Marvell -22.6%, Cisco -14.6%,
  Qualcomm -14.3%); on the market approach, 18 of the 28 companies with a peer
  median moved more than 5% (Marvell -28.4%, AMD -27.1%, Cisco -20.0%).
  `src/engine/model.js` (`S.ebitda`), `src/data/excelExport.ts`,
  `src/data/excelSheets.ts`, `src/data/marketApproach.ts`.

- **L22. Securities the filing does not split are not counted at all.** Where a
  filing reports marketable securities but never says how much of them is
  short-term, nothing is netted off: they stay inside other current assets,
  where they already were, rather than being read as nil or split by guesswork.
  That was 35 of the 176 payloads and 7 of the 63 companies with a value,
  NVIDIA and Dell among them; NVIDIA tags a combined 39,520 and maturity
  buckets, which are a different idea from the balance-sheet split. Long-term
  securities are reported and never netted, for the reasons in METHODOLOGY.md
  §4, which also sets out what is netted and why. Taking securities out of
  other current assets changes the forecast as well as net debt, because other
  current assets is a working capital driver: checked on all 50 companies that
  report them, other current assets falls by exactly the securities, none goes
  negative, every reported year balances to 0.0000, and for 16 of the 50 the
  smaller working capital drag outweighs the cash itself. `api/company.js`
  (`shortTermInvestments`, `longTermInvestments`, `securitiesNotSplit`),
  `src/data/deriveModel.js` (`deriveBalanceSheet`, `dcf.netDebt`).

- **L23. Debt is weighted at book value, because no free source gives its
  market value.** The conventions ask for both sides of the capital weights at
  market value; equity is, debt cannot be, and the workbook's row label says
  so. The weighting itself — gross debt against market equity, cash left out
  because the bridge already has it — is in METHODOLOGY.md §14. Measured
  against `b7432d6` on the payloads of 2026-09-20: all 63 valued companies rise
  or hold, none falls, median +2.4%, 14 move more than 5% (Toyota +24.0%, BP
  +15.0%, Reliance Industries +12.3%, Vodafone +12.3%, Alibaba +11.7%, Amphenol
  +10.1%). Before the fix 27 of the 63 carried a negative debt weight and an
  equity weight above 100%; now none do, and debt weights run 0.0% to 50.4%
  (median 5.7%). `src/engine/model.js` (`computeWACC`).

- **L24. Operating leases under US GAAP are reported beside net debt, not in
  it.** Their rent is already charged inside operating profit, so the cash flow
  the enterprise value is built from carries them; netting the liability as
  well would charge the shareholder twice (Amazon 89,252, Home Depot 9,578).
  This is the point reasonable people differ on, and it is a judgment, not a
  fact: the test used, and the treatment of finance leases and of IFRS 16, are
  in METHODOLOGY.md §4. Where a filing shows finance-leased assets with no
  readable lease liability, none is counted and the provenance says so.
  Counting every borrowing was checked by hand against the filings for Apple
  (99,887), Amazon (81,137) and Home Depot, and against the source's own total
  debt for Reliance Infrastructure (49,367, to the rupee). The borrowings come
  out of the liability plugs, so no plug goes negative (one did before:
  MercadoLibre at -1,907) and every reported year still balances. Because net
  debt feeds the WACC weights as well as the bridge, adding debt moves value
  twice and in opposite directions; the bridge effect is the larger for 43 of
  the 62 companies valued on both sides. `api/company.js`,
  `src/data/deriveModel.js` (`debtLines`).

- **L25. A cost of debt that cannot be read falls back to 4.5%, an assumption.**
  A rate above 25% is not a borrowing cost — a bank paying depositors (JPMorgan
  118%, HSBC 29%, ICBC 35%), or debt repaid mid-year divided into a full year's
  interest (Accenture 36%) — and some filers tag no interest at all against
  their borrowings (Arm, Caterpillar, GE, NextEra, T-Mobile, MercadoLibre).
  Those fall back to the old flat rate and the provenance says it is assumed
  rather than the company's own. Where it can be read, the rates run from 0.19%
  (Toyota, borrowing in yen) to 22.7% (Reliance Infrastructure), median 4.49%,
  so the flat 4.5% was a fair guess at the middle and wrong about almost every
  company. How the rate is measured, and why the beta is relevered so that a
  cheap cost of debt cannot drag the cost of capital down without limit, are in
  METHODOLOGY.md §9 and §14. Measured: no valued company is left below the
  risk-free rate (the range is 5.95% to 9.13%, against 4.27% to 8.73% before),
  so no WACC floor and no leverage refusal were needed, and none was added.
  `src/data/deriveModel.js` (`costOfDebtRate`), `src/engine/model.js`
  (`computeWACC`).

- **L26. The exit multiple is a flat 12x for every derived company.** The two
  terminal values are published side by side and never averaged, and where one
  figure is needed it is the perpetuity value, named — because the multiple is
  the same assumption for a software company and a steelmaker. Why they are not
  averaged, what a wide spread means in each direction, and where the quarter
  cut comes from are in METHODOLOGY.md §13. **The spread as measured at
  `933fc2c`:** median 14.5%, quartiles 7.7% and 31.7%, widest BP 128% (5.00
  against 11.39), MercadoLibre 120%, TotalEnergies 104%, Vodafone 73%, Toyota
  70%, Shell 68%, Equinor 57%, Broadcom 54% (the only one of the widest where
  the perpetuity value is higher), Enbridge 48%, Rio Tinto 46%. The exit
  multiple is the higher figure for 27 of the 63. No valuation changed when
  averaging stopped: it is a presentation and a choice of which figure
  downstream code reads. `src/data/terminalSpread.ts`,
  `src/components/TerminalDashboard.tsx`, `src/components/howCalculated.tsx`,
  `src/data/excelExport.ts` (DCF rows 53-58), `src/data/reverseDcf.ts`,
  `src/data/batchRun.ts`.

- **L27. The workbook reproduces the site exactly.** Every valued company's
  workbook now returns the site's value per share to nine decimal places on
  both terminal methods; the worst difference across the 63 is 5e-9%, which is
  floating point in the last significant digit and not a difference in method.
  Two treatments had to be reconciled, and each was settled by deciding which
  side was right rather than by making one copy the other.
  **The normalised terminal cash flow: the engine was right.** The workbook
  took EBIAT plus stock compensation plus amortisation after tax, leaving
  working capital out of the terminal year entirely. A terminal year with no
  working capital investment assumes a growing business needs no further
  receivables or inventory, ever, which overstates the cash flow it is
  capitalising: on NVIDIA by 17%, which is where its 13.8% gap came from. The
  workbook now starts from the final forecast year's own free cash flow, puts
  capital expenditure back, replaces it with terminal capex equal to PP&E
  depreciation, and strips the same two timing lines the engine strips (the
  deferred tax asset and other non-current liabilities).
  **Net debt: the workbook was right.** The engine used `dcf.netDebt`, a figure
  carried beside the model; the workbook read the model's own balance sheet at
  the last reported date. For a derived company the two are identical by
  construction, so this had already stopped mattering for 63 of the 64
  companies once securities and borrowings were fetched (L22, L24). It still
  mattered for the curated Apple file, which carried 146,517 of cash and 82,347
  of debt against a balance sheet showing 132,420 and 90,678. The balance sheet
  wins: it is the statement a reader can see, and a bridge resting on a figure
  that appears nowhere in the model cannot be checked. Apple's site value moves
  from 131.25 to 129.98, which is what its workbook already said. The WACC
  weights read the same balance sheet, so the weights and the bridge can no
  longer describe different capital structures.
  **Measured** at `933fc2c` against this change, on the payloads of
  2026-09-20: before, 49 of 63 companies were more than 1% apart, 19 more than
  5% and 3 more than 25%, median 2.4%, worst Toyota at 108.1% (workbook
  5,414.88 against site 2,601.94); after, all 63 agree exactly. The recorded
  range of -5.4% to +13.6% was stale: the securities, borrowings and cost of
  debt commits had moved it to 108%. The exit-multiple values already agreed,
  because that method never used the normalised cash flow.
  **The suite's own check was stale too** and is updated with it: its
  independent recomputation of value per share hard-coded the old terminal
  formula, so it would have passed a workbook that no longer matched the
  engine. It now reads the working capital movement and the two excluded lines
  off the model sheet. `src/engine/model.js` (`balanceSheetNetDebt`),
  `src/data/excelExport.ts` (DCF row 34).

- **L28. One depreciation pool, one rate, no vintages or useful lives.**
  Depreciation is charged on the assets in service — opening net PP&E plus half
  the year's additions — at one rate read from filed depreciation, which is as
  close to the convention's separate vintage stacks as a single pool allows.
  The rate, its three sourcing steps and the fallbacks are in METHODOLOGY.md §7.
  **Measured** at `48c95b6` against the change that introduced it, on payloads
  refetched 2026-09-21: 82 companies valued on both sides, 18 move more than
  5%, 27 up and 38 down, median 0.0%; the largest TotalEnergies -47.9%, Toyota
  -30.4%, Shell -27.7%, Enbridge +23.0%, Texas Instruments -19.9%, BP -19.8%,
  Equinor -15.3%, Siemens +14.1%. Forecast depreciation lands near what these
  companies file: Texas Instruments 7.2% of revenue to 10.8% against 10.8%
  filed, Microsoft 7.7% to 12.0% against 10.3%, Amazon 5.4% to 6.9% against
  5.8%. `src/engine/model.js` (PP&E schedule), `src/data/deriveModel.js`
  (`depreciationRates`), `src/data/excelExport.ts`.

- **L30. Capital spending is replacement plus growth, and the drift is reduced
  rather than removed.** 27 of 69 valued companies still end the forecast more
  than 10% from their own reported capital intensity, which follows from adding
  at the margin: a company whose last filed intensity sits above or below its
  own history keeps that position, and nothing pulls it back. That is the
  intended behaviour — the alternative, targeting the historical ratio, forces
  a one-off correction in year one — and the reasoning, the symmetric treatment
  of a shrinking business and the solved circularity are in METHODOLOGY.md §7.
  Where the treatment does not hold at all is KI-11. **Measured** at `26d954c`
  against this change, on payloads fetched 2026-09-21: capital intensity more
  than 10% from the company's own reported average falls from 53 of 70 to 27 of
  69, more than 25% from 33 to 5, more than 50% from 11 to none. Of the 85
  companies valued on both sides, 31 move more than 5%, 47 up and 21 down,
  median +0.4%: TotalEnergies +135.0%, Toyota +90.8%, Shell +57.7%, Enbridge
  -50.7%, BP +42.7%, Sony -34.9%, Texas Instruments +32.7%. Naspers loses its
  value: its exit-multiple value was already negative, and neither method now
  covers the 30,514 of minority interests and the net debt its bridge takes
  off. `src/engine/model.js` (PP&E schedule), `src/data/deriveModel.js`
  (`ppeToRevenue`), `src/data/excelExport.ts`.

- **L29. Two things the depreciation base exposed, both fixed here.**
  **Net PP&E is also tagged with finance-lease right-of-use assets in it.**
  Alphabet, Home Depot and Tesla stopped tagging `PropertyPlantAndEquipmentNet`
  after their FY2024 or FY2025 filing and moved to
  `PropertyPlantAndEquipmentAndFinanceLeaseRightOfUseAssetAfterAccumulated-
  DepreciationAndAmortization`. Where both exist they agree to the million
  (Alphabet 171,036 for FY2024 under either), so it is the same measure under a
  longer name, and it is now read as a fallback. It matters more than it did:
  a missing balance used to cost nothing, because depreciation was charged on
  capital spending. Including the lease asset also pairs correctly with net
  debt, which carries the lease liability (L24).
  **A missing opening balance is not an empty yard.** With the asset base
  missing, the forecast charged depreciation on half a year's capital spending
  alone - Alphabet 3,138 against the 21,136 it files - because a null opening
  balance added as zero. The model now refuses a company whose last reported
  year has no net PP&E rather than valuing it off an asset base that was never
  reported. With the tag above in place, no company on this sweep is refused
  for that.
  **One company is refused that was not:** Cisco, whose filed D&A is a flat
  700 for four straight years while its filed amortisation of intangibles
  rises to 1,028, so depreciation measured as D&A less amortisation is negative
  in two of them. Averaged over capital spending that came out positive and
  produced a value; averaged over the asset base it comes out at -0.8%, and a
  negative rate refuses the company. The refusal is right and the cause is the
  source's rounded D&A, not the base.

## Design choices, with their measured effect

Deliberate choices that differ from a textbook convention. They are not
defects: do not change them as a fix, only as a decision to change the design.

- **D1. Forecast margins come from the last reported year, not a conservative
  average.** The checklist's conservative default (the lowest of recent years)
  is a rule of thumb, and the last reported year is defensible: an average or a
  minimum taken across a company that has changed shape describes no year it
  now operates in. The choice, and which lines it applies to, are in
  METHODOLOGY.md §5. Measured at `f1d9339` by moving the operating margin by
  the gap between the lowest of the last three reported years and the last:
  median value -11.5%; 23 of 42 valued companies fall by more than 10% and 10
  by more than 25% (AMD -95.9%, Gilead -85.0%, Seagate -80.3%, AbbVie -42.8%);
  Arm, Marvell and Palantir would be refused; 11 are unchanged, their last year
  already the lowest. `src/data/deriveModel.js` (margins). See
  CONVENTIONS_AUDIT.md, IS 7.

## Verification limits

- **Nothing checks that the dashboard renders what the engine produced.** The
  suite in `verify/` covers the engine, the derivation and the workbook, and
  `verify:workbook` proves the workbook reproduces the engine to 4e-9%. No
  check stands between the engine's output and the React screens: a component
  reading the wrong field, or a label naming a figure it is not showing, would
  pass everything. `playwright` is already a dev dependency, so a check that
  loads a company, reads the headline figures off the page and compares them
  with a direct engine run would close it. Not built.

- HyperFormula, used to recalculate workbooks outside Excel, cannot iterate:
  switch-on scenarios are verified with a hand-written fixed-point loop over the
  circular cells, not an Excel recalculation.
- The sweep covers 104 companies; the site reaches any listed ticker. Three
  payloads failed to fetch: CYATY and RTNTF (see KI-6) and TATAMOTORS.NS, which
  Yahoo no longer carries statements for after its demerger.
- The currency sweep covers 101 non-US listings (97 fetched) chosen to span
  every kind: US depositary receipts and cross-listings, 10-K filers based
  abroad, and home listings on 22 exchanges quoted in 19 currencies, including
  prices in pence, cents and agorot. The site can reach more listings than that
  through search.
