# Known issues

A living record of defects that have been found and not yet fixed, and of the
limitations that fixes have deliberately left behind.

**How this file is kept**

- Fixing something listed here? Delete its entry **in the same commit as the
  fix**. Do not mark it resolved; remove it.
- Found something and not fixing it now? Add an entry.
- A fix that leaves a limitation behind (a refusal, an approximation, a case it
  does not cover) records that limitation here.
- Every entry says what is wrong, where it lives, how it was measured, how many
  companies it affects, the worst example, and roughly how much it moves a
  valuation. Entries are ordered by valuation impact, largest first.

**Measurement basis, unless an entry says otherwise:** code at `03617c2`;
payloads for curated Apple, the first 100 issuers in the SEC ticker list and
three Yahoo listings (RELIANCE.NS, RELINFRA.NS, TATAMOTORS.NS), frozen on
2026-09-17. Of the 103 fetched, 98 are modelled and 42 show a DCF value at
default drivers. Values are the site's headline value per share. "What if"
figures come from moving existing sliders or recomputing from the engine's own
outputs; no source was changed to measure anything below. Entries 4, 5, 8
and 13 and design choice D1 come from the conventions audit
(CONVENTIONS_AUDIT.md), measured at `f1d9339`. Entries 1 and 10 come from the
currency sweep and entry 14 from the SG&A sweep, on payloads fetched
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
the basis for entry 1 and L24.

---

## Defects, by valuation impact

| # | Issue | Companies | Worst example | Value moved |
|---|-------|-----------|---------------|-------------|
| 1 | Cost of debt is a flat rate, so borrowing lowers the discount rate without limit | 3 valued with a debt weight above 50% | RELINFRA.NS WACC 4.27%, 997.55 vs 49.99 | up to 20x the price |
| 2 | Forecast depreciation tracks same-year capex, not assets in service | 22 | Microsoft D&A 6.3% of revenue forecast vs 10.3% filed | not isolated |
| 3 | Perpetuity and exit-multiple values averaged; divergence not investigated | 23 of 42 valued more than 10% apart | TotalEnergies 33.85 vs 77.00 | headline ~8% (median) to 39% from either method |
| 4 | Workbook and site DCF disagree on the terminal year and net debt | every company | NVIDIA workbook 181.83 vs site 160.06 | -5.4% to +13.6% |
| 5 | No stated discounting convention; timing runs from the fetch date | every company | AbbVie, mid-year +5.4% | mid-year median +4.3%; pro-rated first year median -1.5% |
| 6 | Forecast tax rate is a filed ratio applied to a different pretax figure | 18 valued with >10% non-operating pretax | AbbVie, non-operating items -128.5% of filed pretax | ~1.2% of value per point of tax rate |
| 7 | Forecast interest is 4.5% of average debt, not the filed interest | 16 valued outside 0.67x-1.5x of filed | Amphenol forecast 0 vs filed 368 | small; not measured |
| 8 | Working capital drivers differ between site and workbook | every derived company | payables: cost of sales on site, revenue in workbook | none at defaults; not measured after edits |
| 9 | Palo Alto may be a false-positive missing-debt refusal | 1 refused (PANW) | Palo Alto | no value shown at all |
| 10 | An SEC lookup that fails stops the company loading, with no Yahoo fallback | 3 (IBN, CYATY, RTNTF) | ICICI Bank | no page at all |
| 11 | Workbook reported-year operating cash flow is derived, not filed | 78 of 97 differ by >10% | Morgan Stanley 30,253 vs filed 1,086 | none on value; breaks "reported = filed" |
| 12 | Reported net income still does not tie for three companies | 3 | McDonald's 19,930 vs filed 8,563 | none (all refused or valued from filed statements) |
| 13 | 50% minimum cash buffer has no documented basis | every derived company | — | none on value |
| 14 | Stock compensation the filing does not break out is never added back, understating cash generation | 56 (20 valued) | Novo Nordisk Copenhagen +1.8% | not measured for 19 of the 20 |

---

### 1. Cost of debt is a flat rate, so borrowing lowers the discount rate

- **What is wrong.** The cost of debt is the model's own forecast rate, 4.5%
  before tax for every derived company, whatever the borrower. It is below
  every company's cost of equity, so the more debt a company carries, the lower
  its weighted average cost of capital goes, without limit and without regard
  to whether that debt is cheap or the company is in trouble. Weighting on
  gross debt (L23) is right, and fetching all of the debt (L24) is right, and
  together they hand the full weight to a rate that does not vary.
- **Where.** `src/data/deriveModel.js` (`dcf.costOfDebt`, 4.5%);
  `src/engine/model.js` (`computeWACC`, `afterTaxCostOfDebt`).
- **How measured.** At `HEAD` on payloads fetched 2026-09-20, after every
  borrowing was fetched: the debt weight and WACC of each valued company
  against its value and its price.
- **Affects.** 3 of the 64 valued companies carry a debt weight above 50%, and
  they are exactly the three furthest above their own share price.
- **Worst example.** Reliance Infrastructure: debt 49,367 against a market
  capitalisation near 20,400, so the debt weight is 71% and WACC 4.27%, below
  the 4.5% risk-free rate it is built from. Value 997.55 against a price of
  49.99. Before its short-term borrowings were fetched it was 339.88 (6.8x);
  now it is 20.0x, because the missing debt was cheap in the model.
  Vodafone: debt weight 60%, WACC 4.51%, 4.7x its price. Toyota: 52%, 5.07%,
  1.6x, and its value fell 34.6% when its finance arm's borrowings arrived.
- **Value moved.** Up to 20x the price for the worst case. A cost of debt read
  from each company's own filed interest over its own debt would fix the
  direction; whether it fixes Reliance Infrastructure is not known until it is
  tried, and its filed interest is itself suspect (#7).

### 2. Forecast depreciation tracks same-year capex

- **What is wrong.** Forecast depreciation is that year's capex times a rate,
  so it follows the capex forecast rather than the assets already in service.
  When forecast capex falls below the last reported year, depreciation falls
  at once, although the installed base keeps depreciating.
- **Where.** `src/engine/model.js`, PP&E forecast loop.
- **How measured.** Forecast capex share of revenue against the last reported
  year; forecast D&A share against filed.
- **Affects.** 22 companies whose forecast capex share differs from the last
  reported year by more than 2 points.
- **Worst example.** Microsoft: capex 34.9% of revenue last year, 20.3% in the
  forecast; forecast D&A 6.3% of revenue in year one against 10.3% filed.
- **Value moved.** Not isolated. D&A reaches value through the tax shield and
  the terminal year (capex = depreciation). The rate itself is now filed
  depreciation over capital spending (fixed at `HEAD`); what remains is that it
  is applied to the year's own capital spending rather than to the assets in
  service.

### 3. The two terminal values are averaged, not investigated

- **What is wrong.** The headline is the mean of the perpetuity-growth and
  exit-multiple values. The spread between them is shown (workbook DCF row 54,
  the dashboard's football field) but nothing acts on it: a company whose two
  methods land 78% apart gets a headline as confident as one where they agree.
  The convention is to investigate a material divergence, because it says
  whether the exit multiple or the cash-flow forecast is out of line.
- **Where.** `src/components/TerminalDashboard.tsx` (`blendedValue`);
  `src/data/excelExport.ts` (DCF sheet rows 53-54); `src/engine/model.js`
  (`buildDCF`, both terminal values).
- **How measured.** Code at `f1d9339`: spread = |exit-multiple value -
  perpetuity value| / headline, per valued company. Taking either method alone
  moves the headline by half the spread.
- **Affects.** 23 of 42 valued companies more than 10% apart, 12 more than 25%;
  median spread 15.9%.
- **Worst example.** TotalEnergies perpetuity 33.85 against exit multiple 77.00
  (77.9% apart); Shell 57.18 / 100.30 (54.8%); Amazon 400.75 / 235.47 (52.0%);
  Arista 62.25 / 100.36 (46.9%); Palantir 15.76 / 24.62 (43.9%). (Toyota's New York
  listing 130.6%; now refused, L8.)
- **Value moved.** The headline sits half the spread from either method: median
  about 8%, up to 39% (TotalEnergies). The exit multiple is a flat 12x for every
  derived company, so part of the spread is the multiple, not the business; see
  also L21.

### 4. Workbook and site DCF disagree

- **What is wrong.** The workbook's normalised terminal cash flow is EBIAT + SBC
  (+ amortisation after tax), leaving out working capital and the terminal
  exclusions the engine applies. The workbook's net debt is the model's debt
  plus revolver less cash at the last reported date; the engine uses
  `dcf.netDebt` from the data file. Explicit-year cash flows agree to the cent.
- **Where.** `src/data/excelExport.ts` (DCF sheet rows 34 and 47-49);
  `src/engine/model.js` (`buildDCF`).
- **How measured.** Site-vs-workbook run: each company's workbook built as the
  dashboard builds it, recalculated, compared with the engine.
- **Affects.** Every company with a DCF.
- **Worst example.** NVIDIA workbook 181.83 against site 160.06 (+13.6%);
  Walmart -5.4%; Apple 122.67 against 126.89 (-3.3%); Microsoft +1.2%;
  ExxonMobil -0.1%.
- **Value moved.** -5.4% to +13.6% between the two.

### 5. No stated discounting convention; timing runs from the fetch date

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

### 6. Forecast tax rate: a filed ratio on a different pretax figure

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

### 7. Forecast interest is 4.5% of average debt

- **What is wrong.** No coupon is fetched, so forecast interest is average
  reported long-term debt at 4.5%. Filed interest expense is now fetched (since
  `03617c2`) but only used for reported years. A company with no long-term debt
  tag forecasts no interest at all.
- **Where.** `src/data/deriveModel.js` (`interestExpenseOnLongTermDebt`);
  `src/engine/model.js` (`computeWACC` cost of debt from the weighted average
  rate).
- **How measured.** First-year forecast interest against filed interest.
- **Affects.** 16 valued companies outside 0.67x-1.5x of filed interest.
- **Worst example.** Amphenol forecast 0 against filed 368; BHP 798 against
  2,108; Cisco 692 against 1,470.
- **Value moved.** Small: unlevered cash flow excludes interest; it reaches value
  through the cost of debt in WACC. Not measured.

### 8. Working capital drivers differ between site and workbook

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
  defaults from the site-vs-workbook run (#4).
- **Affects.** Every derived company (payables, other current assets); every
  company (other non-current liabilities).
- **Worst example.** —
- **Value moved.** None at default assumptions. After a workbook edit, only the
  working capital movement differs; not measured.

### 9. A possible false-positive missing-debt refusal

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

### 10. An SEC lookup that fails stops the company loading at all

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

### 11. Workbook reported-year operating cash flow is derived, not filed

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

### 12. Reported net income still does not tie for three companies

- **What is wrong.** Pretax income is not filed for a reported year, so the
  derived income statement cannot be tied.
- **Where.** `src/data/deriveModel.js`.
- **How measured.** Reported-line comparison against the filing.
- **Affects.** McDonald's, Oracle, Welltower (95 of 98 tie).
- **Worst example.** McDonald's 19,930 against filed 8,563.
- **Value moved.** None: McDonald's and Oracle are refused; Welltower's residual
  income value is built from the filed statements, not the model.

### 13. The 50% minimum cash buffer has no documented basis

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

### 14. Stock compensation the filing does not break out is never added back

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
  credited with it, which is #14); a line not reported in the last reported year is forecast
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

- **L18. Minority interests and preferred stock come off at book value, as
  filed.** Both are taken at the last reported balance sheet, as net debt is,
  not at the value the market puts on them. Minority interests are read from
  the filing's own balance (plus redeemable minority interests where it has
  them), else from equity including minority interests less shareholders'
  equity, else from total assets less filed total liabilities less
  shareholders' equity; preferred stock from its carrying value. Where the
  filing shows a claim exists (a minority share of net income, preferred
  dividends) but gives no amount, the company is refused rather than the claim
  treated as nil (Boeing, Morgan Stanley and Santander on this sweep, none of
  which had a discounted cash flow value before; Morgan Stanley's residual
  income value is withheld too, L19). Convertible preferred that the filing already counts in
  its diluted share count is not taken off again (Procter & Gamble, 68.3
  million shares). `src/data/deriveModel.js`, `src/engine/model.js`
  (`nonCommonClaimNotReported`).

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

- **L21. EBITDA is before depreciation and amortisation only; stock
  compensation stays a cost.** A multiple means nothing against a measure other
  than the one it was computed from, and the peers' EV/EBITDA multiples come
  from a source that computes EBITDA as operating income plus depreciation and
  amortisation. That was checked rather than assumed, within that source and
  within one fiscal year, against its own components: for Arm, Palantir,
  Salesforce and Apple its annual EBITDA equals its operating income plus its
  depreciation exactly, and falls short of the stock-compensation add-back by
  exactly the stock compensation. So the model's EBITDA follows it. Stock
  compensation is also a real cost of employing people, paid in shares, and the
  dilution is carried in the share count rather than waved through. The
  definition is now the same in the engine, the exit multiple, the market
  approach, the workbook's income statement and DCF sheet, the reported EBITDA
  margin and net debt / EBITDA (the last two were already on this basis).
  Unlevered free cash flow still adds stock compensation back, because that
  calculation is about cash rather than about a multiple; the two methods
  therefore take different views of it and are averaged into the headline (#3),
  which is a design boundary, not a measurement, and it is not quantified here.
  Where a filing never breaks stock compensation out, its EBITDA was already on
  this basis, because the cost stays inside the filed cost lines and operating
  profit is after it (18 of the 63 valued companies): those companies need no
  adjustment and are comparable with the peers, and what is still missing for
  them is the cash-flow add-back, which is #14. Measured against `2d02f95` on
  the payloads of 2026-09-19: of the 63 companies with a DCF value, 22 move
  more than 5% on the exit multiple (AMD -23.3%, Tesla -23.2%, Marvell -22.6%,
  Cisco -14.6%, Qualcomm -14.3%) and 11 on the headline, which averages the
  exit multiple with a perpetuity value that did not move at all. On the market
  approach, 18 of the 28 companies for which a peer median came back move more
  than 5% (Marvell -28.4%, AMD -27.1%, Cisco -20.0%). The entry this replaces
  named Arm as its worst case; Arm has had no value since the currency work
  refused it as `listingNotComparable`. `src/engine/model.js` (`S.ebitda`),
  `src/data/excelExport.ts`, `src/data/excelSheets.ts`,
  `src/data/marketApproach.ts`.

- **L22. Net debt takes off cash and short-term marketable securities, not
  long-term ones.** Short-term securities are money parked in instruments
  rather than in the bank, and a company holding them is no more indebted for
  it, so they come off debt with cash. Long-term securities are fetched and
  reported beside net debt but never netted off: a holding placed out of reach
  for a year or more is not money a lender can be paid with tomorrow, and some
  of what filers tag there is not marketable at all (Alphabet's non-marketable
  equity stakes, 68,687, are tagged in the same place as its bonds). Where a
  filing shows securities but never says how much of them is short-term,
  NOTHING is netted off and the provenance says so on screen and in the
  workbook's Sources sheet: the securities stay in other current assets, where
  they already were, rather than being read as nil or split by guesswork. That
  is 35 of the 176 payloads and 7 of the 63 companies with a value, NVIDIA and
  Dell among them; NVIDIA tags a combined 39,520 and maturity buckets, which
  are a different idea from the balance-sheet split, so they are not used.
  Securities are taken out of other current assets at the same time, which is
  where an untagged balance sat: checked on all 50 companies that report them,
  other current assets falls by exactly the securities, none goes negative, and
  every reported year still balances to 0.0000 (the workbook too, run for
  Microsoft, Alphabet and Arista as well as curated Apple). Because other
  current assets is a working capital driver, that also changes the forecast:
  a smaller base means a smaller working capital drag, so free cash flow rises.
  For 16 of the 50 that effect, together with the discount rate, outweighs the
  cash itself. The discount rate moved at the time because net debt was also a
  WACC weight: Equinor gained 14,297 of securities and LOST 4.2%, because its
  WACC rose 7.82% to 8.49% as the debt weight fell. That weighting has since
  been fixed (L23) and Equinor gains 8.0% back. `api/company.js`
  (`shortTermInvestments`, `longTermInvestments`, `securitiesNotSplit`),
  `src/data/deriveModel.js` (`deriveBalanceSheet`, `dcf.netDebt`).

- **L23. Capital is weighted on gross debt at book value and equity at market
  value.** The weights say how the business is financed: what share of the
  money in it was borrowed. A company that borrows 100 and holds 150 in the
  bank still has 100 of borrowed money in it, costing what it costs. Weighting
  on net debt made that share negative for a company with net cash, the equity
  weight more than 100%, and the whole cost of capital higher than the cost of
  equity alone, so holding cash made a company worth less. Cash is left out for
  a second reason: it is already added to the shareholders' side in the equity
  bridge, and netting it off the weights as well counts it twice. Debt is at
  book value because the market value of a company's bonds is not in any free
  source; equity is at market value, which is the price the model is compared
  against anyway. The beta relevering carries gross debt for the same reason,
  and its old form was visibly backwards: delevering Alphabet on net debt
  produced an unlevered beta of 1.278 against its own equity beta of 1.25,
  which says the business is riskier without its borrowings than with them.
  Delevered peers are now MSFT 1.069, Alphabet 1.223, Meta 1.182 (were 1.087,
  1.278, 1.236) and Apple's industry unlevered beta 1.201 to 1.158. No derived
  model reaches it: 0 of 169 carry comparables or ask for the industry beta,
  and curated Apple states its beta, so switching it on is the only way to see
  it (Apple would be 124.36 rather than 119.43 with the fixed formula).
  Measured against `b7432d6` on the payloads of 2026-09-20: all 63 valued
  companies rise or hold, none falls, median +2.4%, 14 move more than 5%
  (Toyota +24.0%, BP +15.0%, Reliance Industries +12.3%, Vodafone +12.3%,
  Alibaba +11.7%, Amphenol +10.1%). Before the fix 27 of the 63 carried a
  negative debt weight and the same 27 had a WACC above their own cost of
  equity; now none do, and debt weights run 0.0% to 50.4% (median 5.7%, 8
  companies with no debt at all). `src/engine/model.js` (`computeWACC`),
  `src/data/excelExport.ts` (DCF sheet rows 24-25).

- **L24. Net debt counts every borrowing, and the lease liabilities whose
  financing cost the cash flow does not already carry.** Short-term borrowings,
  commercial paper, the current maturities of long-term loans and the loans
  themselves are all in it; only the last of these used to be. The tags overlap
  and the overlaps are where a total goes wrong, so each is fetched separately
  and the most inclusive figure a filer gives is used without adding the pieces
  it already contains: `LongTermDebt` is the whole loan including its current
  maturities (Apple 90,678 = 78,328 + 12,350), `LongTermDebtAndCapitalLease-
  Obligations` has the finance leases inside it (Home Depot 46,341), and
  `LongTermDebtAndCapitalLeaseObligationsCurrent` has the current lease inside
  it (4,967). Checked by hand against the filings for Apple (99,887), Amazon
  (81,137) and Home Depot, and against the source's own total debt for
  Reliance Infrastructure (49,367, to the rupee).
  **Leases.** A lease liability belongs in net debt exactly when the forecast
  cash flow does not already bear the financing half of it. A finance lease
  reaches profit as depreciation plus interest, so operating profit carries
  only the depreciation: it is debt. An operating lease under ASC 842 reaches
  profit as a single operating lease cost inside operating profit, so the rent
  is already charged in full against the cash flow the enterprise value is
  built from, and taking the liability off as well would charge the shareholder
  twice: it is reported beside net debt and not netted (Amazon 89,252, Home
  Depot 9,578). Under IFRS 16 there is no operating lease - every lease is
  depreciation plus interest - so for the non-SEC listings the whole lease
  obligation is debt. This is the point reasonable people differ on, and the
  answer here is not "leases are debt" or "leases are rent" but that it depends
  on which line of the income statement the lease already passes through.
  **What is not netted and why:** operating leases under US GAAP, as above.
  **Missing is not nil:** where a filing shows finance-leased assets with no
  lease liability that can be read, none is counted and the provenance says so.
  **Knock-on:** the borrowings come out of the liability plugs, so what the
  debt line gains, accrued liabilities or other non-current liabilities give
  up; no company's plug goes negative (one did before this change:
  MercadoLibre at -1,907) and every reported year still balances, in the
  workbook too (Amazon, Home Depot and Walmart run alongside curated Apple).
  Because net debt now feeds the WACC weights as well as the bridge, adding
  debt moves value twice and in opposite directions: the bridge takes the debt
  off the shareholders, while the heavier debt weight lowers the discount rate
  and raises enterprise value. The bridge effect is the larger of the two for
  43 of the 62 companies valued on both sides; where the discount rate wins,
  the cause is the flat cost of debt (#1). `api/company.js`,
  `src/data/deriveModel.js` (`debtLines`).

## Design choices, with their measured effect

Deliberate choices that differ from a textbook convention. They are not
defects: do not change them as a fix, only as a decision to change the design.

- **D1. Forecast margins come from the last reported year.** Gross margin, R&D
  and SG&A are the last reported year's share of revenue, held flat, and each
  model's provenance says so. The checklist's conservative default (the lowest
  of recent years) is a rule of thumb in the book, and the last reported year is
  defensible: an average or a minimum taken across a company that has changed
  shape describes no year it now operates in (Nvidia is the case the code
  cites). Measured at `f1d9339` by moving the operating margin by the gap
  between the lowest of the last three reported years and the last: median
  value -11.5%; 23 of 42 valued companies fall by more than 10% and 10 by more
  than 25% (AMD -95.9%, Gilead -85.0%, Seagate -80.3%, AbbVie -42.8%); Arm,
  Marvell and Palantir would be refused; 11 are unchanged, their last year
  already the lowest. `src/data/deriveModel.js` (margins). See
  CONVENTIONS_AUDIT.md, IS 7.

## Verification limits

- HyperFormula, used to recalculate workbooks outside Excel, cannot iterate:
  switch-on scenarios are verified with a hand-written fixed-point loop over the
  circular cells, not an Excel recalculation.
- The sweep covers 104 companies; the site reaches any listed ticker. Three
  payloads failed to fetch: CYATY and RTNTF (see #10) and TATAMOTORS.NS, which
  Yahoo no longer carries statements for after its demerger.
- The currency sweep covers 101 non-US listings (97 fetched) chosen to span
  every kind: US depositary receipts and cross-listings, 10-K filers based
  abroad, and home listings on 22 exchanges quoted in 19 currencies, including
  prices in pence, cents and agorot. The site can reach more listings than that
  through search.
