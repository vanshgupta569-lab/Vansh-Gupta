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
outputs; no source was changed to measure anything below.

---

## Defects, by valuation impact

| # | Issue | Companies | Worst example | Value moved |
|---|-------|-----------|---------------|-------------|
| 1 | Foreign listings valued in reporting currency against a US-dollar price and US share count | at least 7 badly, ~11 in all | Toyota 354,859.91 a share against $192.21 | up to 1,846x the price |
| 2 | PP&E depreciation rate derived from the roll-forward counts disposals, leases and acquisitions | 12 of 41 valued move >5% | Amazon rate -91.8% (filed basis 49.9%) | -44.5% to +41.7% (Toyota +69.8%) |
| 3 | Two EBITDA definitions: model adds SBC back, peers' multiples do not | 22 valued (SBC >5% of EBITDA) | Arm, SBC 47.6% of EBITDA | exit-multiple value -36.3%; EV/EBITDA method overstated 90.9% |
| 4 | Non-controlling interests not deducted from equity value | 14 valued | Reliance Infrastructure 276.16 a share | up to 48.1% of value |
| 5 | "Cash" excludes marketable securities, so net debt is overstated for cash-rich companies | 15 valued | Alibaba, other current assets 176.47 a share | up to 39.7% of value (upper bound) |
| 6 | Forecast depreciation tracks same-year capex, not assets in service | 22 | Microsoft D&A 6.3% of revenue forecast vs 10.3% filed | not isolated; part of #2's range |
| 7 | Workbook and site DCF disagree on the terminal year and net debt | every company | NVIDIA workbook 181.83 vs site 160.06 | -5.4% to +13.6% |
| 8 | Forecast tax rate is a filed ratio applied to a different pretax figure | 18 valued with >10% non-operating pretax | AbbVie, non-operating items -128.5% of filed pretax | ~1.2% of value per point of tax rate |
| 9 | Forecast interest is 4.5% of average debt, not the filed interest | 16 valued outside 0.67x-1.5x of filed | Amphenol forecast 0 vs filed 368 | small; not measured |
| 10 | Broadcom and Palo Alto may be false-positive missing-debt refusals | 3 refused (AVGO, PANW, KO) | Palo Alto | no value shown at all |
| 11 | Workbook reported-year operating cash flow is derived, not filed | 78 of 97 differ by >10% | Morgan Stanley 30,253 vs filed 1,086 | none on value; breaks "reported = filed" |
| 12 | Reported SG&A is not the filed SG&A | 47 (34 valued) | UnitedHealth 377,948 vs filed 59,592 | none directly; SG&A slider acts on the wrong base |
| 13 | Nil shown where the filing reports nothing | R&D 43, SBC 22, dividends 17, buybacks 23 | — | small (SBC nil is never charged or added back) |
| 14 | Reported net income still does not tie for three companies | 3 | McDonald's 19,930 vs filed 8,563 | none (all refused or valued from filed statements) |
| 15 | Net debt excludes lease liabilities | not measured (not fetched) | Amazon | not measured |

---

### 1. Foreign listings valued in reporting currency against a US-dollar price and share count

- **What is wrong.** For Yahoo-sourced listings in the US (ADRs and foreign
  ordinary shares), the payload is labelled `USD` while the statements are in
  the company's reporting currency. The model values yen, kroner, yuan or
  Canadian dollars of cash flow over the listing's share count and compares the
  result with a US-dollar price. Where the listing is an ADR representing
  several ordinary shares, the share count is a second mismatch.
- **Where.** `api/company.js` (Yahoo path: currency taken from the quote, not
  the statements' financial currency); `src/data/deriveModel.js` (`dcf`,
  `meta.currency`).
- **How measured.** Frozen payloads: value per share against quoted price, with
  the payload's currency label and revenue scale. The reporting currency is
  inferred from revenue magnitude and the companies' known reporting
  currencies; confirming it needs Yahoo's `financialCurrency`.
- **Affects.** Large distortion: Toyota (JPY), MUFG and SMFG (JPY), Novo Nordisk
  (DKK), Alibaba (CNY), TD and Royal Bank (CAD). Likely smaller: SAP, ASML,
  Santander, BBVA (EUR). US-dollar reporters (AstraZeneca, Novartis, BHP, Shell,
  TotalEnergies, HSBC, UBS) look consistent.
- **Worst example.** Toyota: revenue 50,684,952 (yen, millions), value
  354,859.91 against a $192.21 price, 1,846x. MUFG residual income 3,122.24
  against $23.18 (135x); SMFG 3,444.20 against $26.29 (131x); Novo Nordisk
  1,279.10 against $41.71 (31x); Alibaba 444.36 against $107.27 (4.1x).
- **Value moved.** The whole value, by the exchange rate and any ADR ratio.
- **Related, not diagnosed.** Reliance Infrastructure (RELINFRA.NS) is quoted and
  reported in INR yet values at 574.33 against 51.54, 11.1x.

### 2. PP&E depreciation rate derived from the roll-forward

- **What is wrong.** Historical depreciation is worked out as opening PP&E plus
  capex less closing PP&E. Anything else that moves PP&E (disposals,
  impairments, finance-lease additions, acquisitions, currency) is counted as
  depreciation. The forecast depreciation rate is the average of those ratios,
  so it can be negative or several times capex. It also sets the amortisation
  anchor (see limitation L4).
- **Where.** `src/engine/model.js`, PP&E schedule
  (`S.ppe.depreciation` for reported years, `depreciationAsPercentOfCapex`
  `avgOfHistory`); `src/data/deriveModel.js` (`depreciationAsPercentOfCapex`).
- **How measured.** Roll-forward depreciation against filed D&A in the last
  reported year, across the 76 non-financial companies with both; rate counts;
  and value per share re-run with the depreciation slider set to filed
  D&A / capex.
- **Affects.** Roll-forward depreciation negative for 4 companies (Boeing,
  Oracle, Lilly, Verizon), above 125% of filed D&A for 15, below 50% for 17.
  Historical rate negative for 3 (AMZN -92%, SHOP -35%, SNDK -41%), above 100%
  of capex for 15 (UNP 419%, HD 236%, IBM 191%). With the filed-basis rate, 12
  of 41 valued companies move by more than 5% and 5 by more than 20%.
- **Worst example.** Amazon: rate -91.8% (so forecast depreciation is negative);
  on the filed basis (49.9%) its value moves 400.75 to 222.38, -44.5%. Also
  Alibaba +41.7%, Alphabet +27.4% (rate 100.4% against 23.1%), Home Depot
  +21.9%, Amgen -18.5%. (Toyota +69.8%, but see #1.)
- **Value moved.** -44.5% to +41.7% where material. The filed-basis rate is a
  diagnostic, not a proposed fix: filed D&A includes amortisation.

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

### 7. Workbook and site DCF disagree

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

### 8. Forecast tax rate: a filed ratio on a different pretax figure

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

### 9. Forecast interest is 4.5% of average debt

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

### 10. Possible false-positive missing-debt refusals

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

### 12. Reported SG&A is not the filed SG&A

- **What is wrong.** Where the cost lines do not add up to filed operating
  income, the difference is carried in SG&A so operating income ties. The line
  is labelled SG&A but includes costs the filing puts elsewhere (acquired R&D,
  restructuring, cost of revenue not tagged as such).
- **Where.** `src/data/deriveModel.js` (`unexplainedOperatingCosts`,
  `sgaTotal`).
- **How measured.** Reported-line comparison against the filing.
- **Affects.** 47 companies, 34 of them valued.
- **Worst example.** UnitedHealth 377,948 against filed 59,592; Microsoft 34,666
  against 7,956; AbbVie 27,881 against 14,010.
- **Value moved.** None directly (operating income is right), but the SG&A
  margin slider moves a base that is not SG&A.

### 13. Nil shown where the filing reports nothing

- **What is wrong.** R&D, stock compensation, dividends and buybacks show 0 when
  the filing is silent, rather than "not reported".
- **Where.** `src/data/deriveModel.js` (`researchDevelopment`,
  `stockBasedCompensation`, `dividends`, `shareRepurchases`).
- **How measured.** Reported-line comparison against the filing.
- **Affects.** R&D 43, SBC 22, dividends 17, buybacks 23.
- **Worst example.** —
- **Value moved.** Small. A nil SBC is never charged and never added back.

### 14. Reported net income still does not tie for three companies

- **What is wrong.** Pretax income is not filed for a reported year, so the
  derived income statement cannot be tied.
- **Where.** `src/data/deriveModel.js`.
- **How measured.** Reported-line comparison against the filing.
- **Affects.** McDonald's, Oracle, Welltower (95 of 98 tie).
- **Worst example.** McDonald's 19,930 against filed 8,563.
- **Value moved.** None: McDonald's and Oracle are refused; Welltower's residual
  income value is built from the filed statements, not the model.

### 15. Net debt excludes lease liabilities

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

## Verification limits

- HyperFormula, used to recalculate workbooks outside Excel, cannot iterate:
  switch-on scenarios are verified with a hand-written fixed-point loop over the
  circular cells, not an Excel recalculation.
- The sweep covers 104 companies; the site reaches any listed ticker. Three
  payloads failed to fetch (CYATY, RTNTF: source unavailable; TATAMOTORS.NS: no
  statements found).
