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
outputs; no source was changed to measure anything below. Entries 7, 8, 10,
13 and 18 and design choice D1 come from the conventions audit
(CONVENTIONS_AUDIT.md), measured at `f1d9339` on the same payloads. Entries
1 and 15 come from the currency sweep, and entry 19 and the first-year
measurement in entry 2 from the SG&A sweep at `ea2f020`: both on payloads
fetched 2026-09-17, 172 fetched and 168 modelled.

---

## Defects, by valuation impact

| # | Issue | Companies | Worst example | Value moved |
|---|-------|-----------|---------------|-------------|
| 1 | Reliance Infrastructure values at twelve times its price; likely unfetched short-term debt | 1 | RELINFRA.NS 630.54 vs 50.76 | 12.4x the price |
| 2 | PP&E depreciation rate derived from the roll-forward counts disposals, leases and acquisitions | 12 of 41 valued move >5% | Amazon rate -91.8% (filed basis 49.9%) | -44.5% to +41.7% |
| 3 | Two EBITDA definitions: model adds SBC back, peers' multiples do not | 22 valued (SBC >5% of EBITDA) | Arm, SBC 47.6% of EBITDA | exit-multiple value -36.3%; EV/EBITDA method overstated 90.9% |
| 4 | Non-controlling interests not deducted from equity value | 14 valued | Reliance Infrastructure 276.16 a share | up to 48.1% of value |
| 5 | "Cash" excludes marketable securities, so net debt is overstated for cash-rich companies | 15 valued | Alibaba, other current assets 176.47 a share | up to 39.7% of value (upper bound) |
| 6 | Forecast depreciation tracks same-year capex, not assets in service | 22 | Microsoft D&A 6.3% of revenue forecast vs 10.3% filed | not isolated; part of #2's range |
| 7 | Perpetuity and exit-multiple values averaged; divergence not investigated | 23 of 42 valued more than 10% apart | TotalEnergies 33.85 vs 77.00 | headline ~8% (median) to 39% from either method |
| 8 | WACC weights capital on net debt; 13 negative debt weights | 42 valued | Alibaba WACC 7.1% vs 5.9% on gross debt | median +1.2%, up to +21.2% |
| 9 | Workbook and site DCF disagree on the terminal year and net debt | every company | NVIDIA workbook 181.83 vs site 160.06 | -5.4% to +13.6% |
| 10 | No stated discounting convention; timing runs from the fetch date | every company | AbbVie, mid-year +5.4% | mid-year median +4.3%; pro-rated first year median -1.5% |
| 11 | Forecast tax rate is a filed ratio applied to a different pretax figure | 18 valued with >10% non-operating pretax | AbbVie, non-operating items -128.5% of filed pretax | ~1.2% of value per point of tax rate |
| 12 | Forecast interest is 4.5% of average debt, not the filed interest | 16 valued outside 0.67x-1.5x of filed | Amphenol forecast 0 vs filed 368 | small; not measured |
| 13 | Working capital drivers differ between site and workbook | every derived company | payables: cost of sales on site, revenue in workbook | none at defaults; not measured after edits |
| 14 | Broadcom and Palo Alto may be false-positive missing-debt refusals | 3 refused (AVGO, PANW, KO) | Palo Alto | no value shown at all |
| 15 | An SEC lookup that fails stops the company loading, with no Yahoo fallback | 3 (IBN, CYATY, RTNTF) | ICICI Bank | no page at all |
| 16 | Workbook reported-year operating cash flow is derived, not filed | 78 of 97 differ by >10% | Morgan Stanley 30,253 vs filed 1,086 | none on value; breaks "reported = filed" |
| 17 | Reported net income still does not tie for three companies | 3 | McDonald's 19,930 vs filed 8,563 | none (all refused or valued from filed statements) |
| 18 | 50% minimum cash buffer has no documented basis | every derived company | — | none on value |
| 19 | Stock compensation the filing does not break out is never added back, understating cash generation | 56 (20 valued) | Novo Nordisk Copenhagen +1.8% | not measured for 19 of the 20 |
| 20 | Net debt excludes lease liabilities | not measured (not fetched) | Amazon | not measured |

---

### 1. Reliance Infrastructure values at twelve times its price

- **What is wrong.** Reliance Infrastructure (RELINFRA.NS) values far above its
  price. It is not the foreign-listing currency or share-basis defect, now
  fixed: its statements and its price are both in rupees, and the listing's own share
  count (408 million) matches the filing's (406 million). The likeliest cause is
  debt the model does not see. Net debt counts only the fetched long-term debt,
  while the filing's current liabilities exceed its payables by 148,487, and
  short-term borrowings are not fetched, so how much of that is debt cannot be
  confirmed. Non-controlling interests (#4) add to it.
- **Where.** `api/company.js` (no short-term borrowings fetched);
  `src/data/deriveModel.js` (`dcf.netDebt`).
- **How measured.** Payload fetched 2026-09-17 with the working API: net debt,
  current liabilities, payables and the DCF bridge from the engine's outputs.
- **Affects.** 1 known.
- **Worst example.** Perpetuity value 574.45 and exit-multiple value 686.63
  (headline 630.54) against a price of 50.76. Enterprise value 229,926
  (perpetuity) against net debt of -3,370: long-term debt 13,720, cash 17,090;
  current liabilities 320,810 against payables 172,324.
- **Value moved.** The headline is 12.4 times the price. Not diagnosed further.

### 2. PP&E depreciation rate derived from the roll-forward

- **What is wrong.** Historical depreciation is worked out as opening PP&E plus
  capex less closing PP&E. Anything else that moves PP&E (disposals,
  impairments, finance-lease additions, acquisitions, currency) is counted as
  depreciation. The forecast depreciation rate is the average of those ratios,
  so it can be negative or several times capex. It also sets the amortisation
  anchor (see limitation L4).
- **The first year of the roll-forward is not a measurement at all.** A derived
  model has no PP&E balance from before its first reported year, and
  `ppeOpeningBalance` is set to that year's own closing balance. Opening equals
  closing, so depreciation comes out as exactly the year's capex and the rate as
  exactly 100% of it, for every company whose first year reports capex and
  PP&E. That fabricated 100% then sits in the average the forecast uses.
- **Where.** `src/engine/model.js`, PP&E schedule
  (`S.ppe.depreciation` for reported years, `depreciationAsPercentOfCapex`
  `avgOfHistory`, which still averages with `avg` and so counts a year whose
  rate cannot be computed as nil); `src/data/deriveModel.js`
  (`depreciationAsPercentOfCapex`, `ppeOpeningBalance`).
- **How measured.** Roll-forward depreciation against filed D&A in the last
  reported year, across the 76 non-financial companies with both; rate counts;
  and value per share re-run with the depreciation slider set to filed
  D&A / capex. The first year separately, at `ea2f020` on the 168 payloads of
  2026-09-17: the rate recomputed with that year dropped from the average, and
  value re-run through the same slider.
- **Affects.** Roll-forward depreciation negative for 4 companies (Boeing,
  Oracle, Lilly, Verizon), above 125% of filed D&A for 15, below 50% for 17.
  Historical rate negative for 3 (AMZN -92%, SHOP -35%, SNDK -41%), above 100%
  of capex for 15 (UNP 419%, HD 236%, IBM 191%). With the filed-basis rate, 12
  of 41 valued companies move by more than 5% and 5 by more than 20%. The
  fabricated first year affects 155 of 168 modelled companies, 63 of them
  valued; dropping it moves value by a median 0.9%, and by more than 5% for 13.
- **Worst example.** Amazon: rate -91.8% (so forecast depreciation is negative);
  on the filed basis (49.9%) its value moves 400.75 to 222.38, -44.5%. Also
  Alibaba +41.7%, Alphabet +27.4% (rate 100.4% against 23.1%), Home Depot
  +21.9%, Amgen -18.5%. (Toyota's New York listing +69.8%; that listing is now refused, L8.)
- **Value moved.** -44.5% to +41.7% where material. The filed-basis rate is a
  diagnostic, not a proposed fix: filed D&A includes amortisation. Dropping the
  fabricated first year on its own: Reliance Industries +24.0% (rate 51.8% to
  35.7%), Toyota's Tokyo listing +19.7%, ExxonMobil +18.7% (2.2% to -30.4%),
  Enbridge Toronto +16.0%, Samsung +8.1%, Novo Nordisk Copenhagen +7.1%, Home
  Depot -5.3% (236% to 270%).

### 3. Two EBITDA definitions

- **What is wrong.** The engine's EBITDA is operating profit plus D&A plus stock
  compensation. Peers' EV/EBITDA multiples (Yahoo) use EBITDA without the SBC
  add-back, and so does the site's "as reported" EBITDA margin and the ratios
  screen's net debt / EBITDA. The market approach applies the peer multiple to
  the model's larger EBITDA, and the DCF's exit-multiple method applies a
  multiple to it too.
- **Where.** `src/engine/model.js` (`S.ebitda`, `buildDCF` terminal EBITDA);
  `src/data/marketApproach.ts` (subject EBITDA from the model); `api/comps.js`
  (peer EBITDA); `src/data/companies.ts` (`financialsFromStatements`
  `ebitdaMargin`, EBIT + D&A); `src/data/ratios.js` (net debt / EBITDA).
- **How measured.** SBC as a share of model EBITDA in the last reported year;
  exit-multiple value recomputed with terminal EBITDA less SBC; market-approach
  enterprise value overstatement = SBC / (EBITDA - SBC).
- **Affects.** 22 valued companies with SBC above 5% of EBITDA.
- **Worst example.** Arm: SBC 47.6% of EBITDA; exit-multiple value 54.58 falls to
  34.76 (-36.3%); EV/EBITDA method overstated 90.9%. Palantir -27.7% / 47.5%,
  AMD -23.3% / 38.9%, Marvell -22.6% / 38.2%.
- **Value moved.** Exit-multiple value up to -36% when corrected; market
  approach EV up to +91% overstated. The headline blends both DCF methods, so
  it moves by part of this.

### 4. Non-controlling interests not deducted from equity value

- **What is wrong.** The equity bridge takes enterprise value less net debt.
  Minority shareholders' claim on consolidated subsidiaries is not deducted, so
  the full enterprise value is attributed to the parent's shareholders. The
  model's reported equity line includes NCI too, so it differs from filed
  shareholders' equity for 30 companies (19 valued).
- **Where.** `src/engine/model.js` (`buildDCF`, `equityBridge`);
  `src/data/deriveModel.js` (`dcf.netDebt`; equity = total assets less total
  liabilities).
- **How measured.** NCI = filed total assets less filed total liabilities less
  filed shareholders' equity, per diluted share, against value per share.
- **Affects.** 14 valued companies carry NCI.
- **Worst example.** Reliance Infrastructure 112,156 = 276.16 a share, 48.1% of
  value; Reliance Industries 15.5%; Alibaba 6.1%; ExxonMobil 3.7%.
- **Value moved.** Overstated by up to 48%; under 4% for most.

### 5. "Cash" excludes marketable securities

- **What is wrong.** The fetched cash line is cash and cash equivalents only.
  Short-term marketable securities fall into other current assets and never
  reach net debt, understating the net cash of companies that hold them.
- **Where.** `api/company.js` (cash tags); `src/data/deriveModel.js`
  (`dcf.netDebt.cashAndSecurities` from `cash`).
- **How measured.** Other current assets per diluted share against value per
  share. This is an upper bound: other current assets include more than
  securities, and securities are not fetched separately.
- **Affects.** 15 valued companies where other current assets exceed 5% of
  value (19 where they exceed 40% of current assets).
- **Worst example.** Alibaba 176.47 a share, up to 39.7% of value;
  TotalEnergies up to 39.6%; Reliance Industries 19.7%; Dell 14.9%; Palantir
  14.6%; Arista 13.0%.
- **Value moved.** Understated by up to ~40% at the upper bound; the true figure
  needs the securities balance.

### 6. Forecast depreciation tracks same-year capex

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
  the terminal year (capex = depreciation); #2's filed-rate re-run includes it.

### 7. The two terminal values are averaged, not investigated

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
  also #3.

### 8. WACC weights capital on net debt

- **What is wrong.** The debt weight is net debt / (market capitalisation + net
  debt). For a company holding more cash than debt the debt weight is negative
  and the equity weight above 100%, so WACC comes out above the cost of equity.
  Market-value weights use gross debt; cash is already counted in the equity
  bridge. The relevered-beta formula uses net debt the same way (not reached
  today: no derived model has comparables and Apple uses a stated beta). The
  workbook hard-codes the engine's weights as inputs rather than computing them.
- **Where.** `src/engine/model.js` (`computeWACC`: `weightDebt`, `relevered`);
  `src/data/excelExport.ts` (DCF sheet rows 23-25).
- **How measured.** Code at `f1d9339`: WACC recomputed with gross long-term debt
  at book value (market value is not fetched), the same cost of equity and
  after-tax cost of debt; both terminal values re-discounted; headline compared.
- **Affects.** All 42 valued companies; 13 carry a negative debt weight; 1 moves
  by more than 10%.
- **Worst example.** Alibaba: WACC 7.1% to 5.9%, value +21.2%. Amphenol (debt
  weight -12.7%): WACC 9.8% to 8.7%, +9.8%. Novo Nordisk +8.1%, TotalEnergies
  +5.7%, BHP +5.3%. (Toyota's New York listing +9.3%; now refused, L8.)
- **Value moved.** Median +1.2%; up to +21.2%.

### 9. Workbook and site DCF disagree

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

### 10. No stated discounting convention; timing runs from the fetch date

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

### 11. Forecast tax rate: a filed ratio on a different pretax figure

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

### 12. Forecast interest is 4.5% of average debt

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

### 13. Working capital drivers differ between site and workbook

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
  defaults from the site-vs-workbook run (#9).
- **Affects.** Every derived company (payables, other current assets); every
  company (other non-current liabilities).
- **Worst example.** —
- **Value moved.** None at default assumptions. After a workbook edit, only the
  working capital movement differs; not measured.

### 14. Possible false-positive missing-debt refusals

- **What is wrong.** A company is refused when long-term debt is missing in the
  last reported year but reported earlier (so that debt is not silently counted
  as zero). This is kept on purpose: understating debt overstates value, which
  is worse than an explained refusal. But it cannot tell a changed XBRL tag from
  debt that was genuinely repaid.
- **Where.** `src/data/deriveModel.js` (`deriveBalanceSheet`,
  `blocksValuation`); `api/company.js` (long-term debt tags).
- **How measured.** Company sweep refusals.
- **Affects.** 3: Broadcom (debt reported FY2021 only), Palo Alto Networks
  (FY2022-FY2023 only), Coca-Cola (FY2021-FY2023 only).
- **Worst example.** Palo Alto, whose convertible notes may simply have been
  settled; accepted as a possible false positive. Broadcom and Coca-Cola look
  like tag changes the fetcher does not follow.
- **Value moved.** No value is shown at all for these companies.

### 15. An SEC lookup that fails stops the company loading at all

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

### 16. Workbook reported-year operating cash flow is derived, not filed

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

### 17. Reported net income still does not tie for three companies

- **What is wrong.** Pretax income is not filed for a reported year, so the
  derived income statement cannot be tied.
- **Where.** `src/data/deriveModel.js`.
- **How measured.** Reported-line comparison against the filing.
- **Affects.** McDonald's, Oracle, Welltower (95 of 98 tie).
- **Worst example.** McDonald's 19,930 against filed 8,563.
- **Value moved.** None: McDonald's and Oracle are refused; Welltower's residual
  income value is built from the filed statements, not the model.

### 18. The 50% minimum cash buffer has no documented basis

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

### 19. Stock compensation the filing does not break out is never added back

- **What is wrong.** Where a filing does not report stock based compensation,
  the model charges none and adds none back (limitation L14). If the company
  does pay it, the cost sits inside its cost lines and is treated as though it
  were cash, so cash from operations and unlevered free cash flow are short by
  that amount and the value is understated. IFRS filers carry it in a footnote
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

### 20. Net debt excludes lease liabilities

- **What is wrong.** Lease liabilities are not fetched, so they are not in net
  debt, while lease-financed assets depreciate through filed D&A.
- **Where.** `api/company.js`; `src/data/deriveModel.js` (`dcf.netDebt`).
- **How measured.** Not measured; found while diagnosing #2 (Amazon's negative
  roll-forward depreciation is lease-driven).
- **Affects.** Not measured.
- **Worst example.** Amazon.
- **Value moved.** Not measured.

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
- **L4. The amortisation anchor inherits #2.** Annual amortisation = filed D&A
  less capex at the historical depreciation rate, so where that rate is
  distorted the split between depreciation and amortisation is too (Analog
  Devices amortises 16 a year against a pool of 8,014; Merck 166 against
  26,681). No amortisation is charged where intangibles are not tagged (Apple,
  Costco). The terminal value excludes any remaining amortisation tax shield,
  which is conservative (AstraZeneca's pool lasts 33.5 years).
  `src/engine/model.js`.
- **L5. Reported D&A and SBC are allocated pro rata across cost lines.** Filings
  do not say which line carries how much, so the reported cost of sales, R&D and
  SG&A excluding D&A and SBC are allocations; operating profit is exact.
  `src/engine/model.js` section 4b.
- **L6. Derived total liabilities include non-controlling interests.** Where
  total liabilities is worked out as total assets less shareholders' equity
  (Coca-Cola, Walmart, 24 companies), NCI sits in liabilities.
  `src/data/deriveModel.js`.
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
  US dollars, as it was built.

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
  credited with it, which is #19); a line not reported in the last reported year is forecast
  at nil. Dividends and buybacks are averaged over the years that report them,
  and none are forecast where none are. The workbook's statement totals read
  "not reported" cells through N(), which its notes state; the provenance lists
  each unreported line and year. `src/data/deriveModel.js` (`NOT_REPORTED`),
  `src/engine/model.js`, `src/data/excelSheets.ts`.

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
  payloads failed to fetch: CYATY and RTNTF (see #15) and TATAMOTORS.NS, which
  Yahoo no longer carries statements for after its demerger.
- The currency sweep covers 101 non-US listings (97 fetched) chosen to span
  every kind: US depositary receipts and cross-listings, 10-K filers based
  abroad, and home listings on 22 exchanges quoted in 19 currencies, including
  prices in pence, cents and agorot. The site can reach more listings than that
  through search.
