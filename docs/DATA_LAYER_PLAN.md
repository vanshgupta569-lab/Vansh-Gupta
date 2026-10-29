# The primary-filings data layer — India, stage 1

**Status: investigation and design. Nothing here is built.** This document is
the output of one session of measurement against the live sources on
2026-10-20. It exists so that the build jobs that follow argue about design
rather than about facts.

`ROADMAP.md` section 1 names India as the first new adapter after SEC. It also
says, of its source table: *"Availability and terms of use must be confirmed per
source before building. A working map, not verified fact."* This document is
that confirmation, and it changes the plan in three ways that matter. They are
at the top because they are the parts that need a decision rather than a build.

---

## The three findings that change the plan

**1. NSE's terms of use prohibit what this layer would do.** Not by
implication — in these words, on `nseindia.com/static/nse-terms-of-use`:

> "User is prohibited to conduct any systematic or automated data collection
> activities (including scraping, data mining, data extraction and data
> harvesting) on or in relation to our Website / Mobile Application."

And on `nse-copyright`:

> "no portion of the Content may be reproduced on or transmitted to or stored in
> any other website or in other form of electronic retrieval system … Users may
> view, print copies and download the Content for personal, non-commercial or
> educational purpose"

This is the same sentence `DATA_CONSTRAINTS.md` already quotes against CCIL for
the rupee risk-free rate, and the conclusion there was to stay off CCIL. The
same reasoning applies here with more force, because this is not one number a
year — it is the whole feed, stored, and redistributed under stage 2.
**Decision 1 below.**

**2. The exchange feed stops at the quarter ended 31 December 2024.** Every one
of the twelve companies measured has its last financial-results XBRL filed
between 8 January and 11 February 2025, and its last *annual* one for FY2023-24.
This is not a per-company gap: it is SEBI's move to Integrated Filing
(Financial), which replaced the separate results filing from the quarter ended
31 March 2025. The endpoint with fifteen years of history is the **old** one.
The current two years are somewhere else, and I could not reach them without
reverse-engineering an undocumented endpoint, which I did not do. **Decision 2.**

**3. Banks file a different statement, not a different dialect of the same
one.** HDFC Bank and State Bank file under a banking taxonomy with no revenue
line, no total expenses, no profit before tax, no employee benefits and no
depreciation — the engine's field names have no counterpart. That is a separate
adapter and a separate job, not a mapping detail. **Decision 3.**

Everything below is the evidence, and the design that follows from it.

---

## 1. What was measured, and how

**Twelve companies**, chosen to cover the shapes the brief named and a few it
implied:

| Company | Why it is in the set |
|---|---|
| Reliance Industries | the conglomerate; many segments, large lease and intangible balances |
| HDFC Bank | a bank, and a merger — HDFC Ltd merged into it in July 2023 |
| Bajaj Finance | an NBFC |
| TCS | IT services; reports no material cost at all |
| Infosys | a second IT company as a cross-check, and the one the vendor returns in the wrong currency |
| Hindustan Unilever | FMCG, **and a year-end change** — December to March |
| Siemens India | a **30 September year-end**, so "first quarter" means October to December |
| Vodafone Idea | a loss-maker, at a scale that breaks sign assumptions |
| V.S.T Tillers Tractors | a small-cap |
| Cummins India | a mid-cap |
| Eternal (formerly Zomato) | a recent lister **and a renamed company** |
| State Bank of India | a public-sector bank, to check the banking taxonomy twice |

**The request discipline.** Every request was made one at a time, four seconds
apart, with an ordinary browser's headers, from a single session, and cached to
disk so that no analysis refetched anything. Where a protection refused a
request, that refusal was recorded as a measurement and **not worked around** —
see §2.1.

**What could not be measured, and why.** Said plainly, because a design built on
a guess here would be worse than one built on a gap:

- **BSE's terms of use.** `bseindia.com` is a single-page application that
  returns a byte-identical 14,287-byte shell for every path — measured: the home
  page, `/static/about/terms_of_usage.aspx`, `/corporates/Comp_Resultsnew.aspx`
  and a deliberately nonexistent path all hash to `233c6915f664185c`. The
  content is drawn by client-side JavaScript from `api.bseindia.com`, which
  refuses automated requests outright (§2.1). So **BSE's position on automated
  access could not be read from here.**

  **Answered on 2026-10-29**, by Nihar reading the page in a browser and sending
  the text: the terms prohibit "any reproduction, redistribution or
  transmission, for consideration or otherwise, of any such information
  contained on the Website", and require BSE's "express written consent" for
  any reproduction. **BSE is therefore NSE's position rather than a softer one:
  licence needed, Paid · last.** Quoted in full in `docs/ARCHIVE_PLAN.md` §2.9.
  The measurement above stands as the reason it had to be read by a person.
- **The Integrated Filing endpoint.** Finding it means watching a browser's
  network traffic and then calling an endpoint NSE does not document. The
  endpoint names are built at runtime: neither page's HTML nor the site's 591KB
  `nse-min.js` bundle contains the `/api/` path for it.
- **Anything behind MCA's paywall.** MCA21 charges per document; nothing was
  bought.
- **Rate limits as numbers.** Neither exchange publishes one, and the only way
  to find one is to exceed it. I did not. §4 proposes a rate rather than
  discovering one.

---

## 2. What NSE publishes

### 2.1 Reachability, and the protections found

| Host | Plain automated request | With a browser's headers and session | Headless Chromium |
|---|---|---|---|
| `www.nseindia.com` | **403**, Akamai "Access Denied" | 200 | **refused** — `ERR_HTTP2_PROTOCOL_ERROR` at the edge |
| `nsearchives.nseindia.com` | 200 for a known file path | 200 | not tested |
| `www.bseindia.com` | 200, the SPA shell only | 200, the shell only | not tested |
| `api.bseindia.com` | **403**, Akamai "Access Denied" | **403** — a site session does not help | not tested |
| `data.sec.gov`, for contrast | 200 with a contact in the user agent | 200 | 200 |

Two things worth keeping.

**NSE's `robots.txt` and NSE's terms of use disagree.** `robots.txt` is three
lines: `User-agent: *`, `Allow: /`, `Disallow: /market-data-test`. Every path
this investigation touched is allowed by it. The terms of use prohibit automated
collection entirely. **A permissive `robots.txt` is not a licence**, and where
the two differ the terms govern. BSE serves no `robots.txt` at all — the path
returns the SPA shell.

**Headless browsers are refused where curl is served.** That inconsistency is
bot management, and the fact that a politely-shaped request gets through does not
make automated collection permitted. It only means the prohibition in §4 is
contractual rather than technical, which is the harder kind to design around.

### 2.2 The index: what the results listing carries

The listing endpoint behind the financial-results page returns one row per
filing with: company name, symbol, ISIN, standalone or consolidated, audited or
unaudited, the period covered, the financial year, which taxonomy generation it
uses, the board-meeting and dissemination timestamps, and a direct link to the
XBRL instance. Every row measured carried an XBRL link — 169 of 169 across the
Reliance quarterly and annual sets.

| Company | annual rows | consolidated | standalone | earliest FY end claimed | latest FY end | taxonomies named |
|---|---|---|---|---|---|---|
| Reliance | 39 | 19 | 20 | 31 Mar 2005 | 31 Mar 2024 | Non-Ind-AS, Ind-AS New |
| HDFC Bank | 34 | 15 | 19 | 31 Mar 2005 | 31 Mar 2024 | Non-Ind-AS only |
| Bajaj Finance | 30 | 10 | 20 | 31 Mar 2005 | 31 Mar 2024 | Non-Ind-AS, Ind-AS New, **NBFC-IND** |
| TCS | 42 | 21 | 21 | 31 Mar 2005 | 31 Mar 2024 | Non-Ind-AS, Ind-AS New |
| Infosys | 34 | 14 | 20 | 31 Mar 2005 | 31 Mar 2024 | Non-Ind-AS, Ind-AS New |
| Hindustan Unilever | 38 | 19 | 19 | **31 Dec 2005** | 31 Mar 2024 | Non-Ind-AS, Ind-AS New |
| Siemens | 36 | 17 | 19 | **30 Sep 2005** | **30 Sep 2024** | Non-Ind-AS, Ind-AS New |
| Vodafone Idea | 36 | 18 | 18 | 31 Mar 2007 | 31 Mar 2024 | Non-Ind-AS, Ind-AS New |
| V.S.T Tillers | 16 | 1 | 15 | 31 Mar 2011 | 31 Mar 2024 | Non-Ind-AS, Ind-AS New |
| Cummins India | 38 | 16 | 22 | 31 Mar 2005 | 31 Mar 2024 | Non-Ind-AS, Ind-AS New |
| Eternal | 6 | 3 | 3 | 31 Mar 2022 | 31 Mar 2024 | Ind-AS New only |
| State Bank | 41 | 20 | 21 | 31 Mar 2005 | 31 Mar 2024 | Non-Ind-AS only |

Four things this settles:

- **Standalone and consolidated are both published, as separate filings.** The
  engine must choose, say which it chose, and keep the other. Consolidated is
  the right default — it is what the share price is a claim on — and the
  standalone is what a reader comparing against a segment note will want.
- **The year-end change is visible in the data**, not only in the history books:
  Hindustan Unilever has six annual rows ending 31 December and thirty-two
  ending 31 March.
- **A non-March year-end is ordinary.** Siemens's thirty-six rows all end
  30 September, and its filings labelled "First Quarter" cover October to
  December. **`relatingTo` is relative to the company's own financial year**, so
  a period can never be inferred from the quarter's name.
- **A renamed company keeps one history.** Eternal's rows cover Zomato's filings
  under the current symbol; the rename is handled upstream. That is worth knowing
  because it is the opposite of what a symbol-keyed store would assume. **Key on
  ISIN, not on symbol** — §6.3.

### 2.3 Two cliffs

**The retention cliff.** The index claims twenty years. The files do not exist
that far back. Walking every annual standalone row from newest to oldest, asking
only for headers:

| Company | files that resolve | oldest that resolves | newest that 404s |
|---|---|---|---|
| Reliance | 6 | FY2018-19, filed 06 May 2019 | FY2017-18, filed 13 Jun 2018 |
| TCS | 6 | FY2018-19, filed 23 Apr 2019 | FY2017-18, filed 25 May 2018 |
| State Bank | 7 | FY2018-19, filed 24 May 2019 | FY2017-18, filed 03 Aug 2018 |
| Hindustan Unilever | 7 | FY2017-18, filed 26 May 2018 | FY2016-17, filed 08 Jun 2017 |

**The boundary is the filing date, around mid-2018, not the fiscal year.** So the
real depth is **six to seven annual filings per company**, in each of standalone
and consolidated, against the twenty the index advertises. The engine wants five
years (`YEARS_WANTED = 5` in `api/company.js`), so this is just enough and has no
margin: a company whose history the archive has pruned one year further cannot be
modelled on five years from this source.

**A 404 from the archive must never be read as "the company did not file".** It
is the failure in this source most likely to be mistaken for a reported absence,
which the standing decision on zeroes exists to prevent.

**The integrated-filing cliff.** The last quarterly filing per company, from the
same endpoint:

| Company | last filing | period | Company | last filing | period |
|---|---|---|---|---|---|
| TCS | 08 Jan 2025 | Q3 FY2024-25 | Reliance | 15 Jan 2025 | Q3 FY2024-25 |
| Infosys | 15 Jan 2025 | Q3 FY2024-25 | Hindustan Unilever | 21 Jan 2025 | Q3 FY2024-25 |
| HDFC Bank | 22 Jan 2025 | Q3 FY2024-25 | Bajaj Finance | 28 Jan 2025 | Q3 FY2024-25 |
| Cummins India | 05 Feb 2025 | Q3 FY2024-25 | State Bank | 05 Feb 2025 | Q3 FY2024-25 |
| Vodafone Idea | 10 Feb 2025 | Q3 FY2024-25 | Siemens | 11 Feb 2025 | Q1 FY2024-25 |

Twelve for twelve, inside five weeks of each other, every one at the quarter
ended 31 December 2024. The site's own asset version string reads `v=16102026`,
so the site is live and current; the *endpoint* is the thing that stopped. The
annual series stops a year earlier still, at FY2023-24, because the FY2024-25
annual results were filed in April 2025 under the new regime.

**What this means for the engine.** Today the vendor gives FY2023 to FY2026 for
Reliance. This source gives FY2019 to FY2024. Switching India to it as it stands
would make the newest modelled year **two years older than it is now**, which is
a worse model, not a better-sourced one. Stage 1 cannot ship on the old endpoint
alone.

### 2.4 Inside the instance document

One Reliance consolidated annual filing, FY2023-24: 83KB, 365 facts. The schema
reference is `Ind-AS_entry_point_2020-03-31.xsd` and the namespace is
`http://www.bseindia.com/xbrl/fin/2020-03-31/in-bse-fin`. **That is a BSE
namespace on a file served by NSE**: the two exchanges share one taxonomy, so
one mapping serves both, and the exchange becomes a delivery choice rather than
a format choice.

**The statements are all there.** Non-zero reported lines per filing, across the
twenty-four annual filings, by family:

| | Ind AS (19) | banking (4) | NBFC (2) |
|---|---|---|---|
| profit and loss | 29.9 | 34.0 | 46.0 |
| balance sheet | 43.4 | 9.0 | 27.5 |
| cash flow | 33.9 | 31.0 | 39.0 |
| segment facts, dimensioned | 33.5 | 87.3 | 9.0 |
| **total reported lines** | **107.2** | **74.0** | **112.5** |

About a hundred real reported lines per filing, against the forty-eight fields
the vendor payload carries. And they are **Schedule III's own captions**, which
is the entire point of the layer. Reliance's profit and loss, as filed, in
crores:

```
RevenueFromOperations                                  9,14,472
OtherIncome                                              16,057
Income                                                 9,30,529
CostOfMaterialsConsumed                                3,74,747
PurchasesOfStockInTrade                                1,80,562
ChangesInInventoriesOfFinishedGoods…                     30,034
EmployeeBenefitExpense                                   25,699
FinanceCosts                                             23,118
DepreciationDepletionAndAmortisationExpense              50,832
OtherExpenses                                          1,51,929
Expenses                                                8,26,189
ProfitBeforeExceptionalItemsAndTax                     1,04,340
ExceptionalItemsBeforeTax                                     0
ProfitBeforeTax                                        1,04,340
CurrentTax / DeferredTax / TaxExpense           17,394 / 8,313 / 25,707
ProfitLossForPeriod                                      79,020
ProfitOrLossAttributableToOwnersOfParent                 69,621
ProfitOrLossAttributableToNonControllingInterests         9,399
```

and its balance sheet runs to forty-six lines, both sides tying exactly at
₹17,55,986 crore — the full Schedule III breakdown, with the current and
non-current split, `CapitalWorkInProgress` and `IntangibleAssetsUnderDevelopment`
on their own lines, and `TradePayablesCurrent` separate from
`OtherCurrentFinancialLiabilities`.

**Units.** Values are absolute rupees with `decimals="-7"`, so they are exact to
the crore. `LevelOfRoundingUsedInFinancialStatements` says `Crores` and describes
the *presentation*, not the figures. Per-share figures carry a real `INRPerShare`
unit — Reliance's FY2024 basic earnings per share, ₹102.90 — and share counts
carry a `shares` unit. So no scale inference is needed anywhere, which is a
marked improvement on the vendor path and its `MINOR_UNITS` table and
currency-evidence field.

### 2.5 Three taxonomies, not one

The twenty-four annual filings fall into three families whose income statements
barely overlap. Filings with a non-zero value in the full-year column:

| Element | Ind AS (19) | banking (4) | NBFC (2) |
|---|---|---|---|
| `RevenueFromOperations` | 19 | **0** | 2 |
| `CostOfMaterialsConsumed` | 12 | 0 | 0 |
| `EmployeeBenefitExpense` | 19 | **0** | 2 |
| `FinanceCosts` | 19 | **0** | 2 |
| `DepreciationDepletionAndAmortisationExpense` | 19 | **0** | 2 |
| `OtherExpenses` | 19 | **0** | 0 |
| `Expenses` | 19 | **0** | 2 |
| `ProfitBeforeTax` | 19 | **0** | 2 |
| `InterestEarned` | **0** | 4 | 2 |
| `InterestExpended` | **0** | 4 | 0 |
| `OperatingExpenses` / `EmployeesCost` | **0** | 4 | 0 |
| `OperatingProfitBeforeProvisionAndContingencies` | **0** | 4 | 0 |
| `ProfitLossFromOrdinaryActivitiesBeforeTax` | **0** | 4 | 0 |
| `FeesAndCommissionIncome` | **0** | 0 | 2 |
| `ImpairmentOnFinancialInstruments` | **0** | 0 | 2 |

Banks file under `banking_entry_point_2019-09-30` — the RBI's Form A, not
Schedule III. HDFC Bank's FY2024 income statement as filed is interest earned
₹2,83,649 cr, other income ₹1,24,346 cr, interest expended ₹1,54,139 cr,
operating expenses ₹1,52,269 cr of which employees ₹31,023 cr, operating profit
before provisions ₹1,01,587 cr, provisions ₹25,018 cr, profit ₹64,062 cr; and a
nine-line balance sheet of capital, reserves, deposits, borrowings, advances,
investments and totals. Every one of those is a real and useful figure. **None of
them is a field the engine has.**

**Ind AS still covers the great majority of listed companies**, and the banking
and NBFC families are a bounded set that the exchange's own `bank` flag and the
taxonomy name both identify *before* a single figure is read. So they can be
detected reliably and refused honestly until their adapter exists, which is what
"refuse rather than approximate" requires.

### 2.6 Four traps in this format

Each of these produces plausible wrong numbers rather than an error, which is the
kind this repository has already paid for.

**1. The XBRL period dates are degenerate, and the real period is a fact.** Every
`xbrli:context` in Reliance's annual filing carries the same period,
`2024-01-01` to `2024-03-31` — the fourth quarter. The columns are distinguished
by the context *id* (`OneD`, `FourD`, `OneI`), and the true period of each is
published as a fact inside it:

| Filing | duration columns | what each actually covers | balance sheet? |
|---|---|---|---|
| Q1, FY2024-25 | `OneD` | 2024-04-01 .. 2024-06-30 | **no** |
| Q2, FY2024-25 | `OneD`, `FourD` | the quarter; and 2024-04-01 .. 2024-09-30 | **yes** |
| Q3, FY2024-25 | `OneD`, `FourD` | the quarter; and 2024-04-01 .. 2024-12-31 | **no** |
| Annual, FY2023-24 | `OneD`, `FourD` | 2024-01-01 .. 2024-03-31; and **2023-04-01 .. 2024-03-31** | **yes** |

A reader that trusts `xbrli:period` would label Reliance's full-year revenue of
₹9,14,472 crore as a single quarter's, and nothing in the file would contradict
it. **The period must be read from `DateOfStartOfReportingPeriod` and
`DateOfEndOfReportingPeriod` in the same context**, and a context whose dates are
absent must be refused rather than assumed. Note also that the annual filing and
the Q4 filing are **one document**, at an identical URL, carrying both columns.

**2. A filed zero is often "not reported".** Filers must tag the whole template,
so every element appears in every file; that is why a count of elements *present*
is worthless and every count in this document is over *non-zero* values. The
clearest case: `DebtServiceCoverageRatio` and `InterestServiceCoverageRatio` carry
a non-zero value in **2 of 19** Ind AS filings. Reliance files `0.00` for
debt-to-equity, which is not its gearing.

The rule this suggests, and which stage 1 should implement: **a zero is believed
only where an identity corroborates it.** `ExceptionalItemsBeforeTax = 0` is
believed because `ProfitBeforeExceptionalItemsAndTax + ExceptionalItemsBeforeTax
= ProfitBeforeTax` holds to the rupee; a ratio has no identity behind it, so a
zero ratio is **not reported**. This is the `KI-4` shape turned around: not a
value copied from an answer, but a value that looks like an answer and is a
placeholder.

**3. The sign convention on exceptional items is additive.** A charge is filed as
a **negative** number: TCS FY2024 files ₹62,955 cr before exceptionals, −₹958 cr
of exceptionals, and ₹61,997 cr profit before tax. Subtracting gives ₹63,913 cr,
wrong by twice the item. Across the nineteen Ind AS filings, `before +
exceptional = PBT` holds **19/19**; `before − exceptional` holds 9/19. The nine
that happen to agree are the ones with no exceptional item, which is exactly how
this kind of error survives a test.

**4. `ProfitLossForPeriod` is not the shareholders' profit.** It includes
non-controlling interests. Reliance: ₹79,020 cr in total, ₹69,621 cr to owners,
₹9,399 cr to minorities — and the owners' figure matches the vendor's net income
**to the rupee**. Mapping `netIncome` to the total would overstate Reliance's
earnings by 13.5%, which on a per-share value is not a rounding difference. The
attribution split is tagged on **7 of 9** consolidated filings; Vodafone Idea and
V.S.T Tillers leave it at zero, so for those two the filing does not say whose
the profit is. Refuse, or state the difference; do not silently take the total.

### 2.7 The identities that hold, and are therefore the checks

Measured across all nineteen Ind AS annual filings, in the full-year column:

| Identity | holds |
|---|---|
| `RevenueFromOperations + OtherIncome = Income` | **19/19** to the rupee |
| `Income − Expenses = ProfitBeforeExceptionalItemsAndTax` | **19/19** |
| `ProfitBeforeExceptionalItemsAndTax + ExceptionalItemsBeforeTax = ProfitBeforeTax` | **19/19** |
| `CurrentTax + DeferredTax = TaxExpense` | **19/19** |
| `ProfitBeforeTax − TaxExpense = ProfitLossForPeriodFromContinuingOperations` | **19/19** |
| `Assets = EquityAndLiabilities` | **18/19**; one filing has no balance sheet |
| `Equity + Liabilities = EquityAndLiabilities` | **18/19**; the same filing |
| operating + investing + financing = movement in cash | **19/19** |
| owners + non-controlling = `ProfitLossForPeriod`, consolidated only | **7/9** |
| `NoncurrentAssets + CurrentAssets = Assets` | **12/19** |
| D&A in the cash flow = D&A in the profit and loss | **20/20** where both exist |

Two of these deserve comment.

**The subtotals do not always equal their parts.** Three companies' filings
disagree with themselves by small amounts: Cummins India ₹3 cr, Hindustan
Unilever ₹12 cr, Vodafone Idea ₹49 cr. Every figure is exact to the crore, so
this is the filer's own inconsistency and not rounding in the arithmetic. The
treatment follows this repository's existing rule for a reported total: **read
the subtotal as filed and check the parts against it**, reporting the difference,
rather than deriving either from the other.

**One annual filing has no balance sheet at all** — Eternal's FY2021-22
standalone. So a balance sheet is not guaranteed even in an annual filing, and
the engine's existing refusal for a missing asset base is the right response, not
a carried-forward prior year.

These eleven identities are the backbone of the stage-1 check, and they are worth
having because they are **internal to the filing**: they compare the source
against itself, so they cannot fall into the trap of comparing a figure against
the same code path that produced it.

---

## 3. What is not in the XBRL, and how the gap gets filled

The results XBRL is a results statement, not an annual report. Measured against
the 338 distinct elements seen across all twenty-five instances:

| Not there | Measured | Consequence | How it gets filled |
|---|---|---|---|
| **Research and development** | **no such element exists** in the taxonomy | the engine's R&D head is permanently empty for every Indian company from this source | annual-report notes, stage 5; Schedule III does not require the line, so for most companies there is nothing to fill |
| **Selling and administrative** | **no such element** | `sga` has no Indian counterpart; Schedule III gives `EmployeeBenefitExpense` and `OtherExpenses` instead | never — this is a presentation difference, and §7 maps around it rather than inventing a split |
| **Right-of-use assets** | **no such element** | a lessee's leased asset base is absent; Reliance's PPE + CWIP is ₹7,58,466 cr against the vendor's ₹7,67,493 cr, and the unexplained ₹9,027 cr is most likely this | annual-report notes, stage 5 |
| **Lease liabilities on the balance sheet** | only `PaymentsOfLeaseLiabilities…` in the cash flow | **this bounds the "debt including leases" engine hook** that `ROADMAP.md` lists as the job after the figures screen — for Indian companies the liability is not in this source | annual-report notes, stage 5; or a later taxonomy, if one adds it |
| **Share-based pay as an expense** | only `AdjustmentsForSharebasedPayments` in the cash flow, non-zero on **12 of 24** filings | usable, and **better than today** — see below | already filled, from the cash flow |
| **The detailed notes** | the whole of them | no maturity profile of debt, no related-party detail, no tax reconciliation, no segment capital employed | stage 5, from the annual report |
| **Segment detail beyond four axes** | `ReportableSegmentsAxis`, `…FinanceCostsAxis`, `…AssetsAxis`, `…LiabilitiesAxis`, plus `DetailsOfOtherExpensesAxis`; 33.5 dimensioned facts per Ind AS filing, 87.3 per bank filing | revenue, result, assets and liabilities by segment are there; capital expenditure and depreciation by segment are not | stage 5 |
| **The segment axes' member labels** | members are `OneReportableSegmentRevenue01Member` … `05Member`; **the segment's name is not in the instance** | a segment table can be built with the right figures and no names | the presentation linkbase in the taxonomy's own `.xsd`, or the annual report |

**Two gaps this source closes that neither current source does.** Both are live
constraints in `DATA_CONSTRAINTS.md` today:

- **Share-based pay.** It is recorded as the one **warn**-level gap, on 54
  modelled and 19 valued companies, because the value is a floor. The Indian cash
  flow statement tags it: non-zero on 12 of 24 filings measured, from Infosys's
  ₹652 cr to HDFC Bank's ₹1,732 cr. For Indian companies the warning can come off
  where the company reports it.
- **Depreciation for banks.** `DATA_CONSTRAINTS.md` records D&A missing on 13 of
  175 payloads, "mostly banks and insurers, where the free sources tag no D&A
  line in the cash flow statement at all". The Indian banking taxonomy has no D&A
  line in the profit and loss — but
  `AdjustmentsForDepreciationAndAmortisationExpense` is non-zero on **24 of 24**
  filings, including all four bank filings (HDFC Bank ₹3,092 cr, State Bank
  ₹3,849 cr). And where the profit and loss does carry the line, the two agree
  exactly on 20 of 20 filings, so the cash-flow figure is the same measure and
  not a second basis.

---

## 4. Terms of use, rate limits, and a respectful approach

### What the sources say

**NSE.** Quoted at the top of this document. The prohibition on "systematic or
automated data collection activities (including scraping, data mining, data
extraction and data harvesting)" is unqualified, and the copyright page confines
downloads to "personal, non-commercial or educational purpose" and forbids
storing Content "in any other form of electronic retrieval system". **A hosted
site that fetches, stores and redisplays the feed is outside all three.** No rate
limit is published; none was probed.

**BSE.** Read in a browser on 2026-10-29 (§1, and quoted in
`docs/ARCHIVE_PLAN.md` §2.9). Reproduction, redistribution and transmission are
prohibited "for consideration or otherwise", and any reproduction needs BSE's
"express written consent". **The same position as NSE: a hosted site that
fetches, stores and redisplays the feed is outside it, and it needs a licence —
Paid · last.** No rate limit is published; none was probed.

**MCA21.** Fees per document. An authoritative register for private companies and
for the full annual accounts of listed ones; not a bulk source, and not free.

**SEBI.** Sets the filing obligation. LODR regulation 46 requires every listed
company to publish its own financial results on **its own website**, which makes
the company the actual primary source. That route has its own problems:
`ril.com` rejected an automated request outright, returning "Request Rejected"
and a support ID, and `tcs.com` returned an Akamai 403. So company sites sit
behind the same kind of protection with none of the uniformity.

### The proposed approach

For whichever source is chosen, these are the terms the build should hold itself
to, and they belong in the code rather than in a person's memory:

1. **One request at a time, four seconds apart, from one session.** No
   concurrency, no connection pools, no parallel workers. At that rate a full
   history for one company is about two minutes, and a quarterly update for 500
   companies is about twelve hours — which is a scheduled job's problem, not a
   source's.
2. **Fetch once, ever.** A filing is immutable: the document at a given URL does
   not change. So the store *is* the cache, every document is fetched exactly
   once, and a re-run reads disk. This is the single biggest reduction in load,
   and §6.3 makes it structural rather than optional.
3. **Identify the client honestly**, with a contact address, as the SEC path
   already does through `SEC_CONTACT` in `api/company.js`.
4. **Never defeat a protection.** A 403, a challenge, a CAPTCHA or a
   headless-browser refusal is a refusal. It is recorded and the run stops. No
   user-agent rotation, no proxies, no residential IPs, no challenge solving.
   This investigation held to that, which is why §1 has unmeasured items in it.
5. **Honour `Retry-After` and back off exponentially** on any 429 or 5xx, with a
   ceiling after which the run gives up rather than retrying.
6. **Stop at the first sign of being unwelcome**, and raise it as a decision
   rather than tuning around it.

**What needs permission or a licence, flagged as the brief asked.** NSE's terms,
on their face, require **prior written permission** for what this layer does. NSE
licenses data commercially, and its own site links to `/nse-data-and-analytics`
and `/market-data/real-time-data-subscription`. The cost and terms of a
fundamentals licence were not established — that is a conversation, not a
measurement.

---

## 5. The vendor comparison: what would change, and what would not

The brief asks how the vendor feed is retired "without any value changing unless
the filing genuinely differs". The method is already measurable: this repository
holds vendor payloads for four Indian companies, and the filings for the same
year are now on disk. Comparing field by field for FY2024, in crores:

### Reliance — 30 comparable fields

**21 agree to 0.0%**: total assets, current assets, current liabilities, total
liabilities, equity, equity including minorities, non-controlling interest,
receivables, inventory, payables, long-term and current borrowings, goodwill,
capital expenditure, operating cash flow, financing cash flow, dividends paid,
depreciation, tax expense and profit before tax among them. That is the result
that matters most: **where both sources answer the same question they mostly
agree exactly**, so a switch does not move the model.

Of the nine that differ, **three are explained to the rupee**, and each is the
vendor bundling what the filing separates:

| Field | Filing | Vendor | Explanation | Residual |
|---|---|---|---|---|
| `netIncome` | 79,020 | 69,621 | the vendor uses the owners' share; `ProfitOrLossAttributableToOwnersOfParent` is **69,621** | **0** |
| `intangibles` | 1,58,912 | 3,45,385 | `OtherIntangibleAssets` **+** `IntangibleAssetsUnderDevelopment` (1,86,473) | **0** |
| `ppeNet` | 6,06,084 | 7,67,493 | `PropertyPlantAndEquipment` **+** `CapitalWorkInProgress` (1,52,382) = 7,58,466 | **9,027**, most likely right-of-use assets, which the taxonomy does not carry (§3) |

Two more are mapping differences rather than source differences: `cogs` (−13.2%)
because Schedule III has no cost-of-sales line and the vendor manufactures one,
and `sga` (absent) for the same reason. §7 handles both by not inventing them.

**Four remain genuinely unexplained and must be investigated in stage 1, not
reconciled away:** revenue +1.5% (₹9,14,472 cr filed against ₹9,01,064 cr; the
leading hypothesis is a levies-inclusive revenue measure, untested), cash +3.9%
and current investments −9.8% (together ₹7,915 cr, and no combination of filed
lines reproduces the vendor's split), interest expense +6.2%, and investing cash
flow −0.6%.

### TCS — 21 of 29 agree to 0.0%

`cogs` is the instructive one: TCS files **no** `CostOfMaterialsConsumed` and no
`PurchasesOfStockInTrade`, and the vendor reports a cost of revenue of
₹1,32,871 cr. The filing is right and the vendor's figure is a construction. The
same bundling as Reliance explains `ppeNet` and `intangibles`. Receivables
(+20.6%) and payables (+208%) differ on what each includes and need stage-1
investigation.

### Infosys — the currency bug, measured

**Every field differs by about 8,200%.** The vendor payload's `currency` is
**USD**; Infosys files in rupees. Fitting the payload's scale against the filing
gives 8.34 × 10⁷ rupees per unit rather than the 10⁶ every other Indian payload
uses, which is the dollar conversion hiding inside the unit. The filing gives
revenue ₹1,53,670 cr and profit ₹26,248 cr; the vendor gives 1,856 and 317 of
something.

This is the class of defect `ROADMAP.md` section 1 cites as the reason for the
whole layer — "statements in yen labelled as dollars … Brazilian companies whose
currency field contradicted every figure" — and here it is live on a company the
site models today. **It is the clearest single argument for the layer, and also
something to check against `KNOWN_ISSUES.md` immediately, independent of this
plan.** I changed nothing to establish it; see decision 6.

### HDFC Bank — 23 of 29 fields have no counterpart

The vendor returns revenue, pre-tax income, interest expense, depreciation, cash,
investments, receivables, PPE, payables, debt, total liabilities, equity,
minorities, goodwill, intangibles, capital expenditure and stock compensation.
The banking taxonomy has **none** of those lines. The one field both answer is
total assets, and they differ: filed ₹40,30,194 cr against the vendor's
₹44,11,857 cr, **−8.7%**. Nothing can be concluded about which is right without
the annual report, and nothing should be.

### How the switch gets measured

The harness for this already exists and should be used rather than rebuilt:
`verify/sweep.mts` and `verify/compare.mts` run the engine over the payload set
and compare two runs. Stage 1's check is the same shape:

1. Build the India payload from the filings, in the existing payload shape, and
   write it **beside** the vendor payload, not over it.
2. **For every field, every company and every overlapping year, print the pair
   and the difference**, classified into: agrees to the rupee; differs and is
   explained by a named identity, with the residual shown; differs and is not
   explained.
3. **The third list must be empty, or individually signed off, before the
   switch.** Not "small" — explained. A 1.5% revenue difference on Reliance
   changes the value and needs a reason attached to it before anyone sees it.
4. Run the full model both ways and print **value per share, both sources, every
   company**, each with the price it was struck against — because, as the traps
   list says, the share price is a valuation input and a reproduction without its
   price proves nothing.
5. The four companies with vendor payloads on disk are the floor, not the target.
   The set should be every Indian company the site can model.

---

## 6. The proposed design

### 6.1 One shape, one adapter per country

The thing worth protecting is the shape `api/company.js` already returns: a
ticker, a currency with its evidence, a source and a source URL, and an array of
annual statement rows with forty-eight named fields. `deriveModel.js` reads that
shape and nothing else, and `ROADMAP.md` is right that "the standardisation layer
in `deriveModel.js` is the real asset". So:

```
                         ┌─ sec.ts      US GAAP tags  ──┐
  ticker ─> registry ──> ├─ india.ts    in-bse-fin    ──┼─> filed lines
            (ISIN,       ├─ esef.ts     (later)       ──┤   + captions
             country,    └─ edinet.ts   (later)       ──┘   + provenance
             source)                                            │
                                                                v
                                                  the common payload shape
                                                                │
                                                  heads.ts ──> deriveModel.js
```

An adapter's contract is narrow and should be stated as a type: given an
identifier, return **filed lines** — each with its own caption, its element name,
its period, its value, its unit, and the URL of the document it came from — plus
the metadata the engine needs. Everything downstream is shared. `US_TAGS` in
`api/company.js` is already this, minus the captions and the provenance; the
India adapter is the second instance, and building it is what forces the shape to
become explicit rather than implied.

**The captions are the deliverable.** `DATA_CONSTRAINTS.md` records "The
company's own line captions" as a noted constraint and names this layer as what
removes it. The Indian taxonomy's element names *are* Schedule III's captions, so
the figures screen can finally show "Cost of materials consumed" rather than
`cogs`, and the notice above the table — "These are the fields our source
provides for &lt;ticker&gt;, not yet its own line captions" — comes off for
India. The element names still need rendering into readable English, and the
taxonomy's presentation linkbase carries the official label for each; that is a
small piece of work with a verifiable answer, which is the only kind this
repository allows.

### 6.2 Where the fetching runs

**Not in the browser.** The sources are not CORS-enabled, the terms question is
not something to answer from a visitor's IP, and a visitor's network would be
making requests on the site's behalf.

**Not in the request path.** Today `api/company.js` fetches live on every model
build. For India a full history is six to seven annual filings per company per
basis, plus quarterlies — minutes at a respectful rate, against a Vercel
function's seconds. More importantly, fetching in the request path means fetching
the same immutable document again for every visitor.

**So: a scheduled collector writing to a store, and a request path that reads
only the store.** Three consequences worth stating:

- The site stops depending on a source being reachable at the moment a user
  clicks. That also fixes a present fragility: the engine refuses a company when
  a live fetch fails, which is indistinguishable to the user from the company
  being unmodellable.
- The collector is the only thing that touches the source, so the rate discipline
  of §4 lives in one place and can be verified.
- It is **new infrastructure this repository does not have**: there is no
  database, no cron, and `vercel.json` configures only headers. Decision 4.

### 6.3 The store: every version of every figure

`ROADMAP.md` section 13 lists "Point-in-time: as first reported against restated"
as a Next item, and notes that it reverses a decision in section 12. This design
has to carry it from the start, because a store that overwrites cannot be made
point-in-time later — the history is gone.

The grain is **one row per (company, basis, period, element, filing)**:

| Column | What it is |
|---|---|
| `isin` | the identifier. **Not the symbol** — Eternal's history proves symbols are renamed, and the ISIN survived it |
| `country`, `source`, `taxonomy` | which adapter, and which family: `indas`, `banking`, `nbfc` |
| `basis` | `consolidated` or `standalone`, never blended |
| `period_start`, `period_end` | read from the two date facts, never from `xbrli:period` (§2.6) |
| `element`, `caption` | the filing's own tag, and its label |
| `value`, `unit`, `decimals` | as filed, unscaled |
| `filing_id`, `filed_at`, `document_url`, `document_sha256` | which filing this came from, when it was filed, where it is, and a hash so the document can be proved unchanged |
| `superseded_by` | the later filing that restated this figure, or null |

The same figure filed twice gives two rows, not an update. "As first reported" is
the row with the earliest `filed_at`; "as restated" is the latest. The
restatement tracker section 13 wants becomes a query rather than a feature, and
the provenance the figures screen needs becomes a column rather than a
reconstruction.

**The document itself is kept, not only the figures.** A hash in the store with
no document means the provenance claim cannot be re-checked. Storing the
instances is cheap — 43KB to 109KB each, so six years of two bases for 500
companies is well under a gigabyte — and it makes every later stage re-runnable
offline, which is also what makes the payload-set discipline in
`verify/payloadSet.mts` possible for India.

### 6.4 What does not change

Stated explicitly, because a new source is the classic occasion for quietly
relaxing a rule, and the house rules forbid exactly that:

- Every refusal, threshold and published default stands unchanged. A filing is
  not a reason to lower a bar.
- **Missing data is never zero** — which in this format makes §2.6's second trap
  a first-class requirement rather than a nicety, since this source expresses
  "not reported" *as* a zero.
- Income, market and asset approaches stay side by side; no blending.
- The four visible states stay distinguishable. A figure read from a filing is
  **reported**; the engine's standardisation of it is **reclassified**; they are
  not the same state, and the store's `element` and `caption` columns are what
  keeps them apart.
- `deriveModel.js` keeps its standardisation layer. India's quirks join the US
  ones there.

---

## 7. How the filing's own lines reach the model heads

The figures screen already does the hard part: eighteen heads, a default
assignment with a reason for each, drag to move a line, and a transfer model in
`src/data/heads.ts` that re-aggregates without double counting. What the India
adapter must supply is a **default head per Schedule III caption, with its
reason**. Proposed, for the Ind AS family:

### Profit and loss

| The filing's caption | Default head | Why that head |
|---|---|---|
| Revenue from operations | **Revenue** | the top line of the statement of profit and loss |
| Other income | **Other income and expense** | Schedule III places it outside revenue from operations, and the engine forecasts it separately rather than inside the operating margin |
| Cost of materials consumed | **Cost of sales** | the cost of the things sold; it moves with volume |
| Purchases of stock-in-trade | **Cost of sales** | goods bought to resell |
| Changes in inventories of finished goods, work-in-progress and stock-in-trade | **Cost of sales** | the adjustment that turns purchases into cost of goods sold. **It can be negative, and is not an error when it is** |
| Employee benefits expense | **Selling, general and administrative** | Schedule III reports employee cost as **one line for the whole business**, so no split between factory and office exists to read. SG&A forecasts on revenue, the better default for a single mixed line. **A manufacturer whose wages are mostly factory wages should drag this to cost of sales** — and where that is true, it changes the forecast |
| Finance costs | **Finance cost** | interest; below the operating line |
| Depreciation, depletion and amortisation expense | **Depreciation and amortisation** | the measure the engine already forecasts off the asset base |
| Other expenses | **Other operating costs** | Schedule III's residual operating line, and the engine's residual head. This is where the reconciling line lands, so operating profit ties to the filing |
| Exceptional items before tax | **One-offs** | **the only line the filing itself labels as non-recurring.** Schedule III calls it exceptional precisely because it is not expected to recur, so the default needs no judgement of ours. Note the additive sign (§2.6) |
| Current tax, Deferred tax | **Tax** | the two components of the charge |
| Total income, Total expenses, Profit before exceptional items and tax, Profit before tax, Profit for the period, Profit attributable to owners | **anchors, not drop targets** | the filing's own subtotals, shown so the screen ties to the filing and excluded from head totals, exactly as `anchor: true` already does for the US path |
| — | **Research and development** | **empty for every Indian company**: the taxonomy has no such element (§3). The screen already shows an empty head as a single row with "—" that still accepts drops |

### Balance sheet

| The filing's caption | Default head | Why that head |
|---|---|---|
| Cash and cash equivalents | **Cash and investments** | cash |
| Bank balances other than cash and cash equivalents | **Cash and investments** | cash the company cannot spend today but holds |
| Current investments | **Cash and investments** | realisable in days, and part of net debt — the existing treatment of short-term investments |
| Non-current investments | **Other, on no driver of its own** | reported, never netted off — the existing treatment of long-term investments |
| Trade receivables, current | **Receivables** | the working-capital driver |
| Trade receivables, non-current | **Other, on no driver of its own** | not part of the working-capital cycle |
| Inventories | **Inventory** | the working-capital driver |
| Trade payables, current | **Payables** | the working-capital driver |
| Property, plant and equipment | **Fixed assets** | the asset base capital spending builds |
| Capital work-in-progress | **Fixed assets** | plant being built; the same asset base one year earlier. **This is a judgement, and a visible one** — the vendor bundles it into PPE and the filing separates it, so a reader who disagrees can drag it out |
| Goodwill; Other intangible assets; Intangible assets under development | **Other, on no driver of its own** | follows the decision already taken for the US path: goodwill and intangibles default to other assets, not fixed assets, because capital spending does not build them |
| Borrowings, current and non-current | **Debt, including leases** | borrowings |
| Debt securities; Subordinated liabilities *(NBFC)* | **Debt, including leases** | borrowings under another name |
| Equity share capital; Other equity | **Equity** | and equity stays **derived** — assets less liabilities — so it is **not a drop target**, as already decided |
| Non-controlling interest | not a head | the equity bridge deducts it from enterprise value |
| Everything else: other current and non-current assets and liabilities, provisions, deferred tax, other financial assets and liabilities | **Other, on no driver of its own** | honest about having no driver, which is why that head is phrased the way it is |
| Total assets; Total equity and liabilities; the current and non-current subtotals | **anchors** | the filing's own subtotals, shown and excluded |

**Three notes on this table.** First, every default above is a *default*: the
point of the heads layer is that the user disagrees by dragging, and the reason
is on screen. Second, the two defaults most likely to be wrong for a given
company are flagged in the table itself — employee benefits, and capital
work-in-progress — because a default whose weakness is stated is a judgement and
one that is hidden is a trick. Third, **`sga` and `rnd` are not invented.** The
engine's fields exist; for India there is nothing to put in them, and the figures
screen shows an empty head rather than a zero.

The banking and NBFC families need their own table. That is decision 3, not a
line in this one.

---

## 8. The staged build plan

Each stage is one session and one commit, per the house rules, and each lists the
check that makes it provable. No stage begins before decision 1 is answered.

**Stage 0 — the licence question.** Not a build. Establish, in writing, which
source may be used: NSE under a licence, BSE under terms that must first be read,
or something else. Record the answer in `DATA_CONSTRAINTS.md` with its date and
the wording relied on. *Nothing below is safe to build before this.*

**Stage 1 — the reader, offline.** A pure function from an instance document to
filed lines. No network. The fixtures are the twenty-five documents already on
disk. *Checks:* the eleven identities of §2.7 hold on every fixture; the period
of every column comes from the date facts, and a document with a missing date
fact is refused; the exceptional-items sign is asserted on the five companies
that have one; `netIncome` is the owners' share, and the two filings that do not
tag it are refused; a zero is carried as "not reported" unless an identity
corroborates it, proved on a fixture whose ratio block is zero-filled.
*Break-to-prove:* subtract exceptional items instead of adding, and watch the TCS
tie fail by ₹1,916 cr.

**Stage 2 — the collector and the store.** The scheduled fetcher, the rate
discipline, the point-in-time schema of §6.3, and the stored documents with their
hashes. *Checks:* a document is fetched exactly once and the second run makes no
network request at all; a re-filed figure produces two rows and not an update;
every row resolves to a document whose hash matches; a 403 or a challenge stops
the run and reports it. *Break-to-prove:* make the store overwrite instead of
append, and watch the point-in-time check lose a first-reported figure.

**Stage 3 — the India adapter, behind a flag.** The store to the common payload
shape, captions and provenance included; the heads mapping of §7; India payloads
written beside the vendor ones. Nothing user-visible changes. *Checks:* the full
field-by-field comparison of §5 prints for every Indian company and every
overlapping year, with the unexplained list **empty or signed off**; value per
share both ways, with the price each was struck against; the banking and NBFC
families detected and refused by name rather than modelled badly.

**Stage 4 — the switch, and the captions on screen.** India reads the filings.
The figures screen shows Schedule III's own captions under the heads, and the
"fields our source provides" notice comes off for India. The constraints this
closes are deleted from `DATA_CONSTRAINTS.md` in the same commit, as the house
rules require, and the ones it opens are added with their measured size.
*Checks:* the dashboard check reads a real caption on screen for an Indian
company; every figure on the screen carries a link to its filing; the full suite
with every Checks row at zero.

**Stage 5 — the annual report, for what the results filing lacks.** The notes:
right-of-use assets, **lease liabilities, which the next engine job needs**,
segment names, the detailed breakdowns. This is where document extraction comes
in, and the standing decision binds it: AI only where its output can be checked
against a source, with the sentence quoted and its page number.

**Stage 6 — standardised statements as their own download**, which is
`ROADMAP.md` section 1's stage 2. It needs the redistribution question of stage 0
answered affirmatively, not merely the access question.

**Then** the banking and NBFC adapters, and the other jurisdictions in the order
section 1 already sets.

---

## 9. Risks

| Risk | Size | What reduces it |
|---|---|---|
| **The terms prohibit the use** | the whole project, as planned | stage 0, before anything is built |
| **The current two years are unreachable** | stage 4 cannot ship: India would go from FY2026 to FY2024 | find the Integrated Filing route, or license, or keep the vendor for recent years and label every year by its source |
| **Six years of history is the ceiling, with no margin** | a company one year shallower than Reliance cannot be modelled on five years | measure the depth per company before promising a model; refuse rather than model four years as five |
| **Banks and NBFCs need their own adapter** | HDFC Bank, State Bank, Bajaj Finance and every peer | refuse them by name from stage 3; never map Form A onto Schedule III fields |
| **A zero-filled element read as a reported nil** | silent, and valuation-moving | the identity-corroborated zero rule, with a fixture that proves it |
| **An archive 404 read as "did not file"** | silent | a 404 is an error, never an absence; asserted in stage 2 |
| **Reliance's revenue differs by 1.5% and nobody notices** | small per field, systemic in aggregate | the unexplained list must be empty before the switch — this is the whole of §5 |
| **New infrastructure** — a store and a scheduler | cost, and a second place for state to go stale | decision 4; and `payloadVersion.ts`'s existing discipline extended to the store |
| **Infosys may be modelled in dollars today** | a live defect, not a future risk | check it now, independently of this plan — decision 6 |

---

## 10. What this changes in the existing documents

Not done in this commit, because this is a planning job and these are claims that
need the decisions below first. Listed so they are not lost:

- **`ROADMAP.md` section 1 is out of date on the rupee.** It says "every INR
  company is refused for want of a risk-free rate — including Reliance and TCS",
  and asks whether NSE or CCIL publish a usable series. `DATA_CONSTRAINTS.md`
  settled it on 2026-10-10: the rupee is valued on the OECD's monthly series via
  FRED, measured at a cost of 0.4 to 7.7 basis points, and CCIL's terms forbid
  automated collection. Section 1 should be corrected to match.
- **Section 1's source table** should carry what §2 measured: the shared
  `in-bse-fin` taxonomy, the three families, the six-year depth, and the
  integrated-filing cliff.
- **`DATA_CONSTRAINTS.md`** gains, once stage 1 measures them on more than twelve
  companies: no R&D line in the Indian taxonomy; no right-of-use asset; **no
  lease liability**, which bounds the debt-including-leases job; no segment names
  in the instance; and the attribution split untagged on 2 of 9 consolidated
  filings. And it loses, at stage 4, "The company's own line captions" for India.
- **`METHODOLOGY.md`** gains the India mapping and its reasons, in the same commit
  as the adapter, as the house rules require.

---

## 11. The decisions I need from you

**1. The licence question, and it gates everything.** NSE's terms prohibit
automated collection and prohibit storing the content elsewhere. Which do you
want?

- **(a)** Ask NSE for written permission, or price their data licence, and build
  nothing until there is an answer.
- **(b)** Read BSE's terms in an ordinary browser first — they are unverified and
  may be more permissive — and build on BSE if they allow it. **Closed on
  2026-10-29: they are not more permissive.** BSE prohibits reproduction,
  redistribution and transmission and requires express written consent (§4), so
  there is no cheaper Indian exchange route and this option is gone.
- **(c)** Treat the company's own website as the primary source, since LODR
  regulation 46 compels every listed company to publish its results there. More
  honest in principle and much harder in practice: no uniformity, and the two
  company sites I tried are behind the same protections.
- **(d)** Pay for a licensed Indian fundamentals feed, and give up "ours to
  redistribute" — keeping the captions and the provenance but not the
  independence.

My recommendation was **(b) then (a)**: read BSE's terms, because it costs one
browser visit and the taxonomy is shared so the adapter is the same either way;
and open the NSE conversation in parallel, because stage 6's redistribution needs
a written answer regardless.

**(b) came back on 2026-10-29, and the answer was no.** BSE's terms are NSE's,
so the choice is now between **(a)**, **(c)** and **(d)** — a written permission
or a licence from either exchange, the companies' own websites under LODR
regulation 46, or a paid feed. The browser visit was still the right first step:
it cost one page view and it removed an option that would otherwise have been
built on a guess.

**2. The two missing years.** The old endpoint stops at the quarter ended
31 December 2024. Do you want me to (a) find the Integrated Filing route and
measure it as a short investigation job before stage 1; or (b) build stages 1-3
on the historical data and treat the recent quarters as a separate problem; or
(c) keep the vendor for the most recent years and label every year with the source
it came from, on screen? I would do **(a)**, and it is half a session: the data
exists and the shape is almost certainly the same taxonomy.

**3. Banks and NBFCs.** Confirm that stage 3 **refuses** them by name rather than
mapping Form A onto Schedule III fields. It means HDFC Bank, State Bank, Bajaj
Finance and their peers show a plain refusal naming the reason until their own
adapter is built. I think that is clearly right under "refuse rather than
approximate", but it is a visible withdrawal from companies the site models
today, so it should be your call.

**4. The store.** A point-in-time store and a scheduled collector are new
infrastructure this repository has never had — no database, no cron. Do you want
to pick the technology, or should I propose two options with costs as the first
half of stage 2?

**5. Consolidated or standalone as the default.** I propose consolidated, with the
standalone kept and switchable, since the share price is a claim on the group.
Both are published as separate filings, so this is a display decision rather than
a data one.

**6. One thing I found and did not touch.** The Infosys vendor payload is in
**USD** while Infosys files in rupees, and the site models INFY.NS today. If the
model is built on dollar figures and its output read as rupees, that is a live
defect and belongs in `KNOWN_ISSUES.md` with a measured number — not in this
plan. I did not investigate further and changed nothing, because this was a
planning job and it would change a valuation. Say the word and it is its own
session.

---

## 12. The Company Brain: where each item is published, by country

**Status: investigation. Nothing here is built.** Measured against the live
sources on 2026-10-25, in the same way as the rest of this document: what could
be read at the source was read, and what could not is marked as such rather than
filled in from memory.

`ROADMAP.md` §13a lists what a company page must carry. Most of it is not a
figure: what the business is made of, who runs it, who it sells to, what it
owns, what it has promised. That is the **Company Brain**, and this section
records, for eight jurisdictions, **where each item is actually published and in
what form** — because the form decides who reads it.

**Two forms, and the difference is the whole design.**

- **Structured** — XBRL, or a form whose fields the regulator prescribes. Parsed,
  checked against identities, stored as data. No model involved, and the figure
  can be reproduced from the document by anyone.
- **Text** — prose in a PDF or an HTML filing. Read by extraction, and under
  standing decision 8 (*"AI only where its output can be checked against a
  source"*) **only with the sentence quoted and its page number recorded beside
  the extracted value**, so every claim can be checked against the document it
  came from. Where the document is silent the answer is **"not disclosed"** —
  never zero, never inferred, never carried over from last year.

The practical consequence, stated once rather than per row: **an item that is
text in a country is a per-document extraction job with a provenance record, and
an item that is structured is a parser.** The cost difference between the two is
roughly the cost difference between the whole of this plan's stage 1 and stage 4.

### 12.1 How to read these tables

Every row carries a verification mark, and the marks mean exactly this:

| Mark | Meaning |
|---|---|
| **✓** | **Read at the source on 2026-10-25**, by fetching the regulator's or exchange's own document. The source is named in the row or in the notes under the table. |
| **~** | **Recorded from a secondary source** — a law firm's note, a regulator's summary page, trade press, or a filer's own filing citing the rule. Plausible and consistent, not read at the rule itself. |
| **?** | **Unconfirmed.** Either the source refused an automated request, or nothing authoritative was found. These are listed again in §12.12 so none of them can be mistaken for a measurement. |

**What refused an automated request today**, recorded because a refusal is a
finding and because this plan's §4.4 forbids working around one:

| Source | Result |
|---|---|
| `www.bseindia.com` | **403** on the home page and on the terms page — which is why the terms had to be read by a person. **Read in a browser on 2026-10-29: reproduction, redistribution and transmission prohibited, express written consent required** (§1, §4, and `docs/ARCHIVE_PLAN.md` §2.9). |
| `www.mca.gov.in` | **403** (Akamai "Access Denied"). The Companies Act rules could not be read at the source. |
| `www.indiacode.nic.in` | **403**. Same consequence. |
| `www.jpx.co.jp` | **403** to one fetcher; the JPX pages below were read through a search index that quoted them, not fetched. |
| `law.krx.co.kr` | **no connection**. KRX's disclosure regulation could not be read at the source. |
| `www.oecd.org` | **403** (the data API `sdmx.oecd.org` answers normally — see `DATA_CONSTRAINTS.md`). |

Nothing was retried with a different user agent, a proxy, or a browser
automation. One attempt each, and the answer is recorded.

### 12.2 The eleven items, defined

So that a ✓ in one country means the same thing as a ✓ in another.

| Item | What counts as the item |
|---|---|
| **Segments** | Revenue, result and assets by reportable segment, as the accounting standard defines them |
| **Geography** | Revenue and non-current assets by country or region |
| **Major customers** | Customers above the standard's threshold (10% of revenue), named or not |
| **Suppliers** | Who the company buys from, or a concentration measure of it |
| **Plants / capacity** | Where the company produces, and how much it can produce |
| **Directors** | Who the board and key management are, and every change |
| **Related parties** | Transactions with the group, the promoters and the people who run it |
| **Guidance** | Management's own forecast of its results |
| **Group structure** | Subsidiaries, associates and joint ventures, with holdings |
| **Auditor changes** | Appointment, resignation or dismissal, and the reason |
| **Pledges** | Promoter or director shares pledged or otherwise encumbered |

---

### 12.3 India

Read at the source today: the **SEBI (LODR) Regulations, 2015 as last amended
15 October 2026**, the consolidated PDF published at `sebi.gov.in` (2.4MB,
11,973 lines of extracted text), and the **BRSR format**, Annexure I to the
circular of 10 May 2021, also at `sebi.gov.in`.

| Item | Where it is published | Form | Mark |
|---|---|---|---|
| Segments | Ind AS 108 note in the annual report; segment columns in the quarterly results filed under Reg 33 | text in the report; **XBRL** in the results, if the results taxonomy carries the segment block — **not measured** | ? |
| Geography | Ind AS 108 secondary-segment note | text | ~ |
| Major customers | Ind AS 108 major-customer disclosure (>10% of revenue), customarily unnamed | text | ~ |
| Suppliers | Not disclosed as a list. **BRSR Principle 8, item 4** gives *percentages* of input material "sourced from suppliers", split "Directly sourced from MSMEs/small producers" and "Sourced directly from within the district"; trade-payable ageing and MSME dues are in the notes | **XBRL** (BRSR, see below) for the percentages; text otherwise | ✓ |
| Plants / capacity | **BRSR Section A, item 16**: *"Number of locations where plants and/or operations/offices of the entity are situated"*, split national / international, as **counts of plants and offices** — not a list of sites, and no capacity figure. Installed capacity has not been a Schedule III requirement since 2011 | **XBRL** (BRSR) for the counts | ✓ |
| Markets | **BRSR Section A, item 17**: number of states served, number of countries served, exports as a percentage of turnover, and "a brief on types of customers" | **XBRL** (BRSR) | ✓ |
| Directors | **LODR Schedule III Part A Para A, item 7**: *"Change in directors, key managerial personnel … Auditor and Compliance Officer"*, disclosed to the exchanges under Reg 30; the corporate governance report under Reg 27(2) carries the standing board | text for the event; **prescribed form** for the governance report | ✓ |
| Related parties | **Reg 23(9)**: *"The listed entity shall submit to the stock exchanges disclosures of related party transactions in the format as specified by the Board … and publish the same on its website"*, every six months **on the date of publication** of the standalone and consolidated results (from 1 April 2023; it was within 30 days before) | **prescribed format**; filed in XBRL mode per exchange circulars — **the circulars could not be read at BSE (403)** | ✓ rule / ? XBRL |
| Guidance | **No mandatory forecast.** Where management gives one it is in the earnings call, and **Schedule III Para A item 15(b)(iii)** requires the transcript on the website *"along with simultaneous submission to recognized stock exchanges within five working days of the conclusion of such calls"*; audio within 24 hours or before the next trading day, video within 48 hours. **Item 15(a)(ii)** requires the investor presentation itself to be disclosed to the exchanges *before* the event | text | ✓ |
| Group structure | **Form AOC-1** (Companies Act s.129(3) with Rule 5 of the Companies (Accounts) Rules 2014) — salient features of every subsidiary, associate and joint venture, attached to the annual accounts; and **BRSR Section A item 21(a)**, *"Names of holding / subsidiary / associate companies / joint ventures"* with the percentage of shares held | AOC-1: text in the annual report (MCA holds it as a filing, behind a fee); BRSR item 21: **XBRL** | ✓ BRSR / ~ AOC-1 |
| Auditor changes | **Schedule III Para A item 7** (the change) and **item 7A**: on an auditor's resignation, *"detailed reasons for resignation of auditor, as given by the said auditor"* must be disclosed within 24 hours of receiving them. Item 7B does the same for an independent director | text | ✓ |
| Pledges | The quarterly **shareholding pattern** under **Reg 31(1)** — "within twenty one days from the end of each quarter", in the format SEBI specifies — carries the encumbered column; SAST Reg 31 requires the promoter's own encumbrance disclosure | **prescribed format**, filed in XBRL; the *format* was not read at the source | ✓ rule / ~ column |

**BRSR, and what it actually gives.** Reg 34(2)(f) requires it of the **top 1,000
listed entities by market capitalisation from FY2022-23**, in the format SEBI
specifies, with BRSR Core assessment or assurance and — "with effect from and in
the manner as may be specified" — value-chain disclosures. It is filed in **XBRL**
with the exchanges alongside a PDF: that is reported consistently by the exchange
circulars of July 2022 and by filers, **but the circulars sit on BSE and NSE,
both of which refuse an automated request**, so the XBRL mode is marked ~ rather
than ✓.

**The honest size of the BRSR win.** It is real but narrower than it sounds. BRSR
gives *counts* of plants and offices, *counts* of states and countries served,
and *percentages* of sourcing. It does not name a plant, state a capacity, or
name a supplier. The one place it names anything is item 21, the group structure.
A Company Brain built on BRSR alone would know that a company has 14 plants and
sells into 23 countries, and nothing about where they are.

---

### 12.4 United States

Read at the source today: **SEC Form 8-K** (`sec.gov/files/form8-k.pdf`),
**17 CFR 229.403** and **229.601(b)(21)** (Cornell LII, the eCFR having redirected
an automated request to an unblock page), and **Apple's FY2025 Form 10-K** as
filed on EDGAR on 2025-10-31 (accession `0000320193-25-000079`).

| Item | Where it is published | Form | Mark |
|---|---|---|---|
| Segments | ASC 280 note in the 10-K | **XBRL, detail-tagged.** Measured on Apple's 10-K: the business-segments axis is used **15 times** in the inline document | ✓ |
| Geography | Same note | **XBRL, detail-tagged** — the geographical axis, **15 uses** in the same filing | ✓ |
| Major customers | Concentration-of-risk disclosure | **XBRL, detail-tagged** — major-customer and concentration-risk axes, **17 uses** | ✓ |
| Suppliers | Not required. Risk factors and the MD&A describe dependence in prose | text | ~ |
| Plants / capacity | **Item 2, Properties** of the 10-K | text | ~ |
| Directors | **8-K Item 5.02**, *"Departure of Directors or Certain Officers; Election of Directors; Appointment of Certain Officers; Compensatory Arrangements of Certain Officers"*; the standing board is in the proxy statement | text; the 8-K **cover page** is tagged, the body is not | ✓ |
| Related parties | Item 404 of Regulation S-K in the proxy; ASC 850 note in the 10-K | proxy: text. Note: **XBRL** | ~ |
| Guidance | **Not required at all.** Where it exists it is in the earnings release furnished under **8-K Item 2.02**, which requires the registrant to *"include the text of that announcement or release as an exhibit"* — in practice Exhibit 99.1, and *furnished* rather than filed, so it is not subject to Section 18 liability | text | ✓ |
| Group structure | **Exhibit 21** under Item 601(b)(21): *"List all subsidiaries of the registrant, the state or other jurisdiction of incorporation or organization of each"*, with the names under which each does business; subsidiaries that would not together be a significant subsidiary may be omitted | **text, and untagged.** Measured: Apple's Exhibit 21.1 is 11,921 bytes, a 21-row table of name and jurisdiction, with **zero inline XBRL tags**, against **1,131** tagged facts in the 10-K itself | ✓ |
| Auditor changes | **8-K Item 4.01**, *"Changes in Registrant's Certifying Accountant"*, carrying the Item 304(a) disclosure including any disagreements | text | ✓ |
| Pledges | **Item 403(b)**: of the shares shown in the beneficial-ownership table, the registrant must *"indicate, by footnote or otherwise, the amount of shares … that are pledged as security"*. It is in the **proxy**, not the 10-K, and it is a footnote to a table | text | ✓ |

**The US is the only one of the eight where the three hardest commercial items —
segments, geography and customer concentration — arrive as data rather than as
prose.** That is not because the US discloses more; it is because US detail
tagging reaches into the notes, and the EU's and the UK's does not (§12.5, §12.6).
Everything a reader would call *qualitative* — properties, suppliers, directors,
pledges, the earnings release — is prose, and half of it is in the proxy rather
than the 10-K, which is a second document with a second cadence.

---

### 12.5 United Kingdom

Nothing in this table was read at the FCA Handbook itself; the structured-reporting
rules were taken from an FRC document and from law-firm notes, and the item rows
from the accounting standards they rest on. **This is the weakest of the eight
tables.**

| Item | Where it is published | Form | Mark |
|---|---|---|---|
| Segments | IFRS 8 note in the annual report, filed to the **National Storage Mechanism** | **iXBRL block tag only** — the note is tagged as a block of text, not figure by figure | ~ |
| Geography | Same note | iXBRL block tag only | ~ |
| Major customers | Same note | iXBRL block tag only | ~ |
| Suppliers | Not required; payment-practices reporting is a separate government service | text | ? |
| Plants / capacity | Strategic report, in prose | text | ~ |
| Directors | Directors' report and the RNS announcement through the NSM; PDMR dealings under MAR Article 19 | text; PDMR notifications use a **prescribed form** | ~ |
| Related parties | IAS 24 note | iXBRL block tag only | ~ |
| Guidance | Trading statements and outlook paragraphs, announced through an RIS | text | ~ |
| Group structure | **Companies Act 2006 s.409** — subsidiary undertakings, with name, registered office and holding, in the notes | text (iXBRL block at best) | ~ |
| Auditor changes | RNS announcement; the s.519 statement of circumstances on ceasing to hold office | text | ~ |
| Pledges | No direct equivalent of the Indian or US disclosure; DTR 5 major-holdings notifications (TR-1) are a prescribed form | prescribed form | ? |

**On the structured-reporting rule itself:** `DTR 4.1.14`, which used to carry the
requirement by reference to the EU ESEF Regulation, has been **deleted**; the
requirements were moved into DTR 4.1.15–4.1.23 and a new Annex with effect from
28 July 2023, applying to financial years beginning on or after 1 January 2022,
and the approved taxonomies moved into FCA Technical Note TN/507.1. Marked **~**:
this came from two law-firm notes and an FRC paper, not from the Handbook.

---

### 12.6 EU / Germany

Read at the source today: **HGB §315**, at `gesetze-im-internet.de`.

| Item | Where it is published | Form | Mark |
|---|---|---|---|
| Segments | IFRS 8 note in the consolidated annual financial report | **ESEF iXBRL block tag only.** Detailed tagging is required of the primary statements (from 2020); the notes are **block-tagged** from financial years beginning on or after 1 January 2022 | ~ |
| Geography | Same note | block tag only | ~ |
| Major customers | Same note | block tag only | ~ |
| Suppliers | Not required; the Lieferkettensorgfaltspflichtengesetz report is a separate filing about due diligence, not a supplier list | text | ? |
| Plants / capacity | Group management report, in prose | text | ~ |
| Directors | Vorstand and Aufsichtsrat in the annual report; Directors' Dealings under MAR Article 19 | text; dealings use a prescribed form | ~ |
| Related parties | IAS 24 note; §111a AktG for approval of related-party transactions | block tag only | ~ |
| Guidance | **Mandatory.** HGB §315(1) requires the group management report to assess and explain expected development: *"Ferner ist im Konzernlagebericht die voraussichtliche Entwicklung mit ihren wesentlichen Chancen und Risiken zu beurteilen und zu erläutern; zugrunde liegende Annahmen sind anzugeben."* The word *Prognosebericht* does not appear in the statute — the duty does, including the duty to state the assumptions it rests on | **text**, in the management report | ✓ |
| Group structure | Anteilsbesitzliste under §313 HGB, published with the accounts in the Bundesanzeiger | text | ~ |
| Auditor changes | Appointment by the AGM under §318 HGB; a change is an AGM item rather than an event filing | text | ~ |
| Pledges | Not generally disclosed | — | ? |

**Germany is the one jurisdiction of the eight where management's own forecast is
compulsory**, which makes it the natural place to test guidance extraction: there
is a forecast in every group management report, in a named section, with its
assumptions stated beside it. It is also prose, so it is an extraction job and
not a parser — which is the point of testing it there.

---

### 12.7 Japan

| Item | Where it is published | Form | Mark |
|---|---|---|---|
| Segments | セグメント情報 in the 有価証券報告書 (EDINET) and in the 決算短信 | **XBRL** in EDINET; the depth of tagging in the segment note is **not measured** | ~ |
| Geography | Same note | XBRL, depth not measured | ~ |
| Major customers | 主要な顧客ごとの情報 in the segment note | XBRL, depth not measured | ~ |
| Suppliers | Not required as a list; 仕入先 appear in prose where material | text | ? |
| Plants / capacity | **設備の状況** in the 有価証券報告書 — a named list of plants with their equipment, and capacity where the company states it. The richest plant disclosure of the eight | text | ~ |
| Directors | 役員の状況 in the 有価証券報告書; a change files an 臨時報告書 | text | ~ |
| Related parties | 関連当事者情報 note | XBRL, depth not measured | ~ |
| Guidance | **The tanshin forecast, and it is XBRL.** JPX states that TDnet provides XBRL for 決算短信, for 業績予想の修正 (revisions to the forecast) and for 配当予想の修正, alongside the summary PDF, the full PDF and the corporate governance report. The forecast is in the summary section, which is the part that is tagged | **XBRL** | ~ |
| Group structure | 関係会社の状況 in the 有価証券報告書 | XBRL/text, not measured | ~ |
| Auditor changes | 臨時報告書 on a change of accounting auditor | text | ~ |
| Pledges | 大量保有報告書 (the 5% rule) records 担保契約等重要な契約 | prescribed form | ~ |

**TDnet's free window is 31 days, and it was measured rather than taken on
trust.** JPX's own page says the viewing service covers *31 days including the
day of disclosure*; the public site at `release.tdnet.info` was fetched on
2026-10-25 and its date selector offered **exactly 31 dates, 2026-09-25 to
2026-10-25 inclusive**. Anything older is gone from the free service. The paid
routes are a server-type feed and a TDnet API under a JPX contract — JPX states
that information taken from the TDnet API **may be redistributed to third
parties**, and that the server-type service charges per volume for
redistribution. Marked ~: the JPX pages were read through a search index because
`jpx.co.jp` returned 403 to a direct fetch.

**So Japan is the one country where waiting costs data permanently.** Every other
source in this section keeps its archive. This is the single strongest argument
in `docs/ARCHIVE_PLAN.md`.

---

### 12.8 Korea

| Item | Where it is published | Form | Mark |
|---|---|---|---|
| Segments | 사업보고서, and the financial statement notes | **XBRL.** OpenDART's own menu offers "XBRL재무제표 원문 내려받기" and "주석 일괄다운로드" — XBRL statements and a bulk download of the notes | ✓ availability / ? depth |
| Geography | Same | as above | ? |
| Major customers | 사업의 내용 in the 사업보고서 | text | ~ |
| Suppliers | 원재료 및 생산설비 section, in prose | text | ~ |
| Plants / capacity | 생산설비 및 가동률 — production facilities **and utilisation rates**. With Japan, the most specific capacity disclosure of the eight | text | ~ |
| Directors | 임원 현황 in the 사업보고서 | text | ~ |
| Related parties | 특수관계자 거래 note, and 대규모내부거래 disclosures for large groups | XBRL for the note | ~ |
| Guidance | **Fair disclosure (공정공시).** Where a company gives a forecast of sales or operating profit selectively, the exchange's disclosure regulation requires it to be filed first; failing to do so has led KRX to designate companies as unfaithful-disclosure corporations. **The regulation's article number is unconfirmed** — `law.krx.co.kr` did not answer, and the one primary corroboration found (a listed company's own disclosure control policy) would not extract from its PDF | text / prescribed form | ? |
| Group structure | 계열회사 현황 in the 사업보고서; the KFTC's large-business-group disclosures | text | ~ |
| Auditor changes | 감사인 변경 disclosure | prescribed form | ~ |
| Pledges | 주식등의 대량보유상황보고서 (5% rule) and 임원·주요주주 소유상황보고서 | prescribed form | ~ |

**OpenDART's terms were read at the source** (`opendart.fss.or.kr/intro/terms.do`)
and are recorded in `docs/ARCHIVE_PLAN.md`: free in principle, a registered key,
a published usage quota, and the Public Data Act behind it. **The quota's number
could not be read** — the FAQ page returns a shell that fills in from script.

---

### 12.9 Canada

Nothing in this table was read at a regulator's rule today. **SEDAR+'s terms were**,
and they are the finding that matters for Canada — see §12.11 and the archive plan.

| Item | Where it is published | Form | Mark |
|---|---|---|---|
| Segments | IFRS 8 note in the financial statements on SEDAR+ | **text/PDF.** Canada has **no XBRL mandate**: the CSA ran a *voluntary* XBRL filing programme in which filings are supplementary and the PDF remains the official statement | ~ |
| Geography | Same note | text | ~ |
| Major customers | Same note | text | ~ |
| Suppliers | Not required | text | ? |
| Plants / capacity | Annual Information Form (Form 51-102F2); NI 43-101 technical reports for miners | text | ~ |
| Directors | Management information circular (Form 51-102F5); material change reports | text | ~ |
| Related parties | IAS 24 note; MI 61-101 for related-party transactions | text | ~ |
| Guidance | Forward-looking information in the MD&A, with the update and comparison duties of NI 51-102 | text | ~ |
| Group structure | Intercorporate relationships in the AIF | text | ~ |
| Auditor changes | The change-of-auditor reporting package under NI 51-102 | text | ~ |
| Pledges | Insider reports on SEDI; the circular's ownership disclosure | prescribed form | ? |

---

### 12.10 Australia

Read at the source today: **ASIC Information Sheet 284**, on the consolidated
entity disclosure statement.

| Item | Where it is published | Form | Mark |
|---|---|---|---|
| Segments | AASB 8 note in the annual report, lodged with ASX | **text/PDF.** No XBRL mandate for listed financial reports | ~ |
| Geography | Same note | text | ~ |
| Major customers | Same note | text | ~ |
| Suppliers | Not required | text | ? |
| Plants / capacity | Operations review in the annual report; JORC reports for miners | text | ~ |
| Directors | Appendix 3X / 3Y / 3Z director's interest notices under the Listing Rules; the annual report for the standing board | prescribed form | ~ |
| Related parties | AASB 124 note; Chapter 10 of the Listing Rules for approvals | text | ~ |
| Guidance | Continuous disclosure under Listing Rule 3.1, and the Appendix 4D / 4E results announcements | text | ~ |
| Group structure | **The consolidated entity disclosure statement.** ASIC: it applies to *"Australian public companies (listed and unlisted)"*, and where consolidated statements are prepared it must *"disclose details of each entity within the company's consolidated group"* — name; whether a body corporate, partnership or trust; any trustee, partner or joint-venture role; place of incorporation; the percentage of share capital held; and Australian residency, with each foreign jurisdiction of residence listed. It applies to **each financial year commencing on or after 1 July 2023**, so first to 30 June 2024; the tax-residency amendments apply from years commencing on or after 1 July 2024. ASIC adds that accounting materiality does **not** apply — dormant and shelf entities must still be listed — and the directors must declare it *"true and correct"*, a higher standard than *true and fair* | **text**, in the annual report; a prescribed content list rather than a prescribed file format | ✓ |
| Auditor changes | ASIC consent/resignation forms; an ASX announcement | prescribed form | ~ |
| Pledges | Substantial holder notices (Forms 603/604); director interest notices | prescribed form | ~ |

**Australia's group-structure disclosure is the best of the eight** — a complete
list of group entities with holdings, incorporation and tax residency, with
materiality switched off and a "true and correct" declaration over it. It is also
plain prose in a PDF, so it is an extraction job rather than a parser.

---

### 12.11 Across the eight

**Which items arrive as data anywhere.**

| Item | Structured in | Text everywhere else |
|---|---|---|
| Segments / geography / customers | **US** (detail-tagged), **Japan** and **Korea** (XBRL, depth unmeasured), **EU/UK** (block tag only — a tag around the whole note, which is not the same as data) | India, Canada, Australia |
| Guidance | **Japan** (tanshin forecast in XBRL) | everywhere else — and in **Germany** it is at least compulsory and in a named section |
| Group structure | **India** (BRSR item 21) | US (Exhibit 21, measured untagged), Australia (CEDS), UK (s.409), everywhere else |
| Related parties | **India** (Reg 23(9) prescribed format) | everywhere else |
| Pledges | **India** (shareholding pattern), and the 5% notification forms in Japan and Korea | US (a proxy footnote), everywhere else |
| Plants / capacity | **nowhere** | and the best *text* is Japan's 設備の状況 and Korea's 생산설비 및 가동률 |
| Suppliers | **nowhere**, and in most places it is not disclosed at all. India gives percentages in the BRSR; nobody names a supplier | — |
| Directors / auditor changes | event filings are prescribed forms in several places but the content is prose everywhere | — |

**Three conclusions for the build.**

1. **"AI-extracted with page references" is the normal case, not the exception.**
   Seven of the eleven items are prose in six of the eight countries. The
   extraction contract — value, the sentence it came from, the page, the document
   hash, and *"not disclosed"* where the document is silent — is therefore
   infrastructure, and belongs in the store design of §6.3 rather than in a later
   stage. A Company Brain field without a quotable sentence behind it does not
   ship.
2. **Block tagging is not data.** The EU and UK tag a note as one lump of text.
   An adapter that treats an ESEF filing as structured because it is iXBRL will
   find the primary statements tagged figure by figure and the segment note tagged
   as a single string — which is the same extraction problem as a PDF, with an
   extra step.
3. **The countries sort into three groups**, and it is the opposite of the order
   one would guess from market size: **US** (notes are data, qualitative items are
   prose in a second document), **Japan and Korea** (deep reports, rich plant and
   capacity disclosure, XBRL of unmeasured depth, and in Japan a 31-day window on
   the free feed), and **UK, EU, Canada, Australia, India** (a PDF annual report
   and a handful of prescribed forms around it).

### 12.12 The leads in the brief, checked one by one

| Lead | Verdict | Evidence |
|---|---|---|
| India: BRSR is XBRL | **~ reported, not verified** | Exchange circulars of July 2022 and filer practice say XBRL plus PDF; the circulars are on BSE and NSE, which refuse automated requests |
| India: BRSR carries plant locations, markets, value chain | **✓ with a correction** | Section A item 16 gives **counts** of plants and offices, not locations; item 17 gives counts of states and countries plus exports as a percentage of turnover; "value chain" in BRSR is assessment percentages and awareness programmes (Principle 8 item 4, Principle 3), **not a supplier list** |
| India: AOC-1 carries subsidiaries, associates, JVs | **~** | Section 129(3) with Rule 5 of the Companies (Accounts) Rules 2014; confirmed from secondary reproductions of the rule and the form, because `mca.gov.in` and `indiacode.nic.in` both returned 403 |
| India: investor presentations filed under Reg 30 | **✓ with the precise hook** | Reg 30 read with **Schedule III Part A Para A item 15(a)(ii)**: presentations for analyst or institutional investor meets and for post-earnings or quarterly calls, disclosed to the exchanges *prior to the beginning of such events*. Item 15(a)(i) requires the meet schedule two working days ahead |
| India: concall transcripts | **✓, with the deadline** | **Item 15(b)**: audio before the next trading day or within 24 hours, whichever is earlier; video within 48 hours; **transcripts within five working days**, on the website and to the exchanges simultaneously. Reg 46(2)(oa) mirrors it for the company's own website |
| India: Reg 23(9) related-party filings | **✓, and the cadence has changed** | Reg 23(9) now requires submission in SEBI's format **on the date of publication** of the half-yearly results, not within 30 days of it (from 1 April 2023) |
| US: 8-K Item 2.02, earnings release as Ex 99.1 | **✓** | Form 8-K: *"include the text of that announcement or release as an exhibit"*; Item 2.02 material is **furnished, not filed**, and so outside Section 18 liability unless the registrant says otherwise |
| US: 8-K Item 4.01 auditor change | **✓** | *"Changes in Registrant's Certifying Accountant"*, carrying Item 304(a) of Regulation S-K including disagreements |
| US: 8-K Item 5.02 director change | **✓** | *"Departure of Directors or Certain Officers; Election of Directors; Appointment of Certain Officers; Compensatory Arrangements of Certain Officers"* |
| US: Exhibit 21 subsidiaries, untagged | **✓, measured** | Item 601(b)(21) requires the list with jurisdictions. Apple's FY2025 Exhibit 21.1: 11,921 bytes, 21 table rows, **0 inline XBRL tags**, against 1,131 tagged facts in the 10-K itself |
| US: Item 403(b) pledge footnotes | **✓ with a correction** | The duty is in **paragraph (b) itself** — *"indicate, by footnote or otherwise, the amount of shares … that are pledged as security"* — not in a numbered Instruction; none of the seven Instructions to Item 403 mentions pledging. It appears in the **proxy**, not the 10-K |
| Japan: tanshin forecasts in XBRL | **~** | JPX states TDnet provides XBRL for 決算短信, 業績予想の修正 and 配当予想の修正; read through a search index because `jpx.co.jp` returned 403 |
| Japan: TDnet keeps only ~31 days free | **✓, measured** | JPX says 31 days including the disclosure day; the public site's date selector offered exactly 31 dates on 2026-10-25, 2026-09-25 to 2026-10-25 |
| Germany: forecast mandatory in the group management report | **✓** | HGB §315(1): *"Ferner ist im Konzernlagebericht die voraussichtliche Entwicklung mit ihren wesentlichen Chancen und Risiken zu beurteilen und zu erläutern; zugrunde liegende Annahmen sind anzugeben."* The statute does not use the word *Prognosebericht* |
| Korea: fair-disclosure forecasts on DART | **? substance yes, rule unconfirmed** | The obligation and its enforcement are described consistently by Korean financial press, including KRX designating a company as an unfaithful-disclosure corporation for not filing a 영업실적 전망 fair disclosure. The regulation's article could not be read: `law.krx.co.kr` did not answer |
| Australia: consolidated entity disclosure statement | **✓, with the dates pinned** | ASIC INFO 284: all Australian public companies, listed and unlisted; contents as quoted in §12.10; **financial years commencing on or after 1 July 2023** for the statement, and on or after 1 July 2024 for the tax-residency amendments. Accounting materiality does not apply, and the directors declare it *true and correct* |

### 12.13 What this section asks of you

**Nothing yet, and that is deliberate** — this is a map, not a build. Two things
are worth knowing before the first Company Brain stage is scoped:

1. **The ? rows are work, not gaps in the write-up.** Five sources refused an
   automated request today and three claims could not be read at the rule. Each
   one is a browser visit by a person, not a code change.
2. **The extraction contract is the real decision.** Seven of eleven items are
   prose almost everywhere, so the Company Brain stands or falls on whether every
   extracted value carries its sentence, its page and its document hash. If that
   is accepted now it is a column in the store design; if it is added later it is
   a migration.
