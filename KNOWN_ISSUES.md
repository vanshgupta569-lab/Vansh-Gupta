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
- Taken so far: `KI-1` to `KI-42`. **Next free: `KI-43`.** Retired, meaning
  fixed and never to be reused: `KI-40` (the landing page's first script held the main thread. `heads.ts` wanted a row number, the published row map lived in `excelExport.ts`, and that file imports ExcelJS at its top — so **exceljs and JSZip travelled into the entry chunk the landing page loads first**, a megabyte of workbook writer downloaded and evaluated by a reader who had not asked for a workbook. The map is its own module now, `modelSheetRows.ts`, which imports nothing; one definition still, moved rather than copied, and it ends a cycle `heads.ts` documented rather than fixed. Measured 2026-11-11: the entry chunk fell from **1,695KB to 677KB raw**, nothing blocks before the first paint at all (0ms), and the two long tasks left start at about 1.1 and 1.4 seconds — after the page is on screen, when the particle field mounts. TBT medians 39, 71, 83, 137 and 200ms against a 200ms budget, where this page measured 453–506ms. `verify:landing` now names any workbook library in a script loaded before the first paint, and reports 2 faults with the import put back), `KI-41` (the search palette found nothing when
  the query was a company's WHOLE name. `nameWords` drops legal suffixes from
  the listing, so "Nestlé S.A." is matched as "nestle", but the query was only
  folded — so a reader who typed or PASTED the full name asked for "nestle sa",
  and "nestle".startsWith("nestle sa") is false. The company fell to the
  catch-all tier and sat among 177 listings it had nothing to do with. Typing
  half the name worked and typing all of it did not. Measured on 2026-11-11
  against the real company list: **only 11 of 178 full names ranked their own
  company first, and 166 faults in all**; with the query stripped by the same
  function as the name, 149 of 178 rank first and the other 29 are each beaten
  only by another listing of the SAME company on another exchange, asserted as
  such. Found by `verify:search`, the LOCAL half of build step 9 job 9.2, on the
  day the cloud run was merged; fixed in the same commit, and the check reports
  329 faults without the fix), `KI-39` (a revenue tag that is only part of the
  top line. The revenue tags were read in order of preference and the first one
  present won, so a company whose revenue is not all revenue from contracts
  with customers — a pipeline selling commodities, an oil major with equity
  earnings and commodity sales — had a COMPONENT of its top line shown as the
  top line. Found by the "other operating items" row of 4 November 2026,
  because the cost of sales alone then exceeded the revenue being shown.
  Measured on 2026-11-08 by asking the fetcher for every SEC filer in the set:
  **7 of the 85 SEC filers in the set change their revenue**, worst Enbridge, FY2021 19,432 -> 47,071 (+142.2%), where the contract-revenue tag is 55.0% short of the total. Fixed by payload version 14: every
  company settles its own top line, not only a financial one — the first tag that
  MEANS total revenue and reaches the filer's latest reported year, in the order
  `Revenues`, `SalesRevenueNet`, then the contract-revenue forms. Written as
  "the largest figure" first, and disproved the same afternoon by Mastercard,
  which tags its GROSS revenue under the contract tag and its net revenue — the
  top line of its own income statement — under `Revenues`: 29,845 against
  18,884. `KI-32`'s rule for financial companies is untouched, and both rules
  are the same rule: the line the filer puts on the face of its income
  statement, which for a bank is the SMALLER `RevenuesNetOfInterestExpense`. Of those seven, five are refused a valuation for reasons that have nothing to do with revenue -- no cost of sales filed, no operating income filed -- both before and after. The two that are valued both move: Walmart 51.65 to 52.46 (+1.6%) and MercadoLibre 583.89 to 581.80 (-0.4%).), `KI-36` (a quarterly figure read from a proxy
  statement or an 8-K. The annual path has taken 10-K facts and nothing else
  since the beginning; the quarterly path filtered by PERIOD and not by form
  at all, and its rule that the most recently filed point wins — which is
  there so a restatement supersedes what it restated — then let any later
  document that happened to tag the same period supersede the 10-Q the figure
  was reported in. A proxy filed in April 2026 is more recent than every
  filing it reports on. **126 figures across 34 companies**, 82 from a
  `DEF 14A`, 41 from an `8-K` and 3 from a `DEF 14C`, 85 of them net income.
  Fixed 2026-11-04 by payload version 13: a quarterly fact is read only from
  a form a statement is filed on — `10-K`, `10-Q` and their amendments. All
  126 now cite the 10-K or the 10-Q that reports them and none was lost. **15
  of them changed value as well as document**, every one a fourth-quarter net
  income, because a fourth quarter is the year less the nine months and the
  superseding document's figure for the YEAR was not the 10-K's: JPMorgan's
  2023 came out at 9,355 against the 10-K's 9,307, the whole 48 of the
  difference landing in that one quarter. So it was not only a citation after
  all, on those fifteen), `KI-38` (the unit a figure was read in was
  whichever currency came FIRST in the XBRL JSON. `extractUSFact` took
  `Object.keys(entry.units)[0]` and read every point from it, so a tag
  carrying both USD and EUR points could have its figure read in euros and
  divided into millions as though it were the reporting currency. **Latent on
  the payload set**: 610 annual figures across Enbridge, PepsiCo and Welltower
  — the only three filers with more than one currency in their facts — were
  compared before and after, and not one moved, because for every tag whose
  figure is used the reporting currency happened to come first. It is recorded
  because the ordering of keys in a JSON object is not a property anything
  should depend on, and a filing that listed them the other way round would
  have put a euro figure in a dollar column with nothing to show it. Fixed
  2026-11-03: the reporting currency is settled first, from the main statement
  totals, and every monetary figure is then read in THAT unit and in no other,
  so the first key no longer decides anything), `KI-37` (the evidence sheet
  printed a
  provenance the payload did not hold. The concept line named the LIST of
  candidate tags the data layer reads with the sentence "which one this company
  used is not recorded in the data we hold"; the form line read "Annual report
  (10-K / 20-F), as tagged in XBRL", which is a statement about which forms
  this site reads dressed up as a statement about where a figure came from; the
  filing date and the filing ID read "not recorded by the feed" on every annual
  figure of every SEC filer; and the link read "Open the filing" and opened an
  EDGAR SEARCH PAGE. Fixed 2026-11-03 by payload version 11, which records the
  concept and the accession number of every figure. A SECOND DEFECT WAS FOUND
  WITH IT, and is the reason the first was invisible: the candidate list in
  `src/data/financials.ts` is a mirror of `US_TAGS` in `api/company.js`, which
  cannot be imported there, and it had gone stale — one concept for stock
  compensation where the fetcher reads two, one for depreciation where it reads
  three — so Apple's stock compensation and AbbVie's depreciation were read
  from tags the sheet's own list did not contain, and 20,556 figures named a
  list that did not include the concept behind them. The list is now generated
  from `US_TAGS` and `npm run verify` holds the two against each other),
  `KI-35` (the trailing-twelve-month column added
  up whatever the four quarters held on every row that was not a balance sheet
  line, which is right for money and meaningless for a RATIO: four quarterly
  operating margins added gave NVIDIA 260.0% where the two figures printed
  directly above it in the same column — operating income 197,579 and revenue
  302,969 — divide to 65.2%. There was no wrong denominator; there was no
  denominator at all. 109 of the 142 companies with a margin showed one roughly
  four times their own, the worst being SanDisk at 262.4% against 72.5%. It
  moved no valuation — the engine reads the statements, not this view — and it
  was the first figure on the Financials tab a reader would check with a
  calculator. Fixed 2026-11-03: a derived row's trailing twelve months is its
  formula applied to the trailing twelve months of its INPUTS, which leaves
  gross profit, EBITDA and free cash flow exactly where they were, because a
  difference of sums is the sum of the differences), `KI-34` (the risk-free rate was fetched once
  per COMPANY with no retry and, for five of the six currencies, nothing
  behind the publisher, so one HTTP request that did not answer took a
  company's whole valuation away — 6 of 115 dollar payloads and 3 of 6 rupee
  ones in a single refetch, the casualty moving between companies from one run
  to the next. Fixed 2026-11-01: the SERIES is fetched once per currency and
  shared, while each company still averages its own window; three attempts
  with a backoff, and never against a refusal; and a fallback behind the US
  Treasury, the Bank of Japan, the Bank of England and the Riksbank. A latent
  defect was found with it: FRED prints an empty cell for every market
  holiday and `Number('')` is 0, which put twelve days of 0% into a year of
  Treasury yields and took 19.7 basis points off the mean), `KI-33` (a quarterly share count was worked
  out as this year to date less the last, which is right for a flow and wrong
  for an average: the average over a year is not the four quarterly averages
  added up, so the difference between a year and nine months of it is not the
  fourth quarter of anything. 159 figures across 68 companies were at or below
  zero, Amphenol’s quarter to 2025-12-31 reporting −1,270,100,000 shares.
  Fixed 2026-11-01 by naming the fields that may not be derived by
  subtraction and leaving the quarter to carry the count its company filed or
  nothing at all; 249 figures went, 164 of them impossible and 85 positive
  enough to look ordinary, across 82 companies), `KI-32` (which fiscal years a company has is
  anchored on revenue, and Morgan Stanley and Wells Fargo had both stopped
  tagging `Revenues` for `RevenuesNetOfInterestExpense`, which the anchor did
  not read — so their models were built from whatever years still carried the
  old tag, FY2014 and FY2019, every figure correct about itself and eleven and
  six years out of date. Fixed 2026-11-01 by settling what the top line of a
  financial company is, measured across all twelve SEC-sourced financial
  companies in the set, and by adding a guard that warns on every screen when
  any company’s figures are more than eighteen months old), `KI-31` (a share count filed before a stock
  split was paired with a price struck after one, so Amphenol's market
  capitalisation was half what it is and its value per share 89.58 against
  43.99 — a 45% overvaluation published as a 13% undervaluation. Fixed
  2026-11-01: every share count is put on today's basis by the splits dated
  after the day that figure was filed, with the event applied only where an
  independently reported count of shares outstanding agrees with the adjusted
  count and not with the filed one, so an ADR ratio change is recorded and not
  applied), `KI-30` (`MCD`'s payload carried 716.4 diluted
  shares where every other SEC filer carries the absolute count, because
  McDonald's tags the figure as its statements print it — in millions — and the
  derivation divided it by a million again; its market capitalisation came out
  as 0.18 against borrowings of 43,848, an equity weight of 0.0004% and a WACC
  that was its cost of debt alone. Fixed 2026-10-31 by reading the scale off the
  filing's own cover page, which every registrant tags as an absolute count
  (`dei:EntityCommonStockSharesOutstanding`, 710,398,642 at 2026-01-31 against
  the 716.4 inside), applying it to every share count in the payload and
  recording what was done; `npm run verify` puts the fault back on purpose and
  watches the check report it), `KI-29` (the cost of debt was the historical
  effective rate — interest over average borrowings — which rule 18 allows only
  as a cross-check, and 59 of 137 companies came out borrowing below their own
  government's ten-year yield; fixed 2026-10-31 by striking it as the
  currency-matched risk-free rate plus a default spread for a synthetic rating
  read off interest coverage, from Damodaran's published table, with his
  separate ladder for financial service firms. The cost of debt moved on 137
  companies by −19.16 to +21.43 points, the WACC on 141 by −9.32 to +6.95, and
  the value per share on 59 by −30.1% to +14.0%, median −0.19%. The effective
  rate is still computed: it drives the forecast interest charge and is shown
  beside the cost of debt as the cross-check it is), `KI-28` (the typecheck
  checked no component
  props at all, because `@types/react` was never installed; fixed 2026-10-20,
  and `npm run verify` now compiles a component call that must not compile, so
  the hole cannot reopen silently — the fix surfaced seven real type errors,
  one of them a latent bug passing a MouseEvent where a note key belonged),
  `KI-25` (the news ticker scrolled headlines that already fitted their window;
  fixed 2026-10-20 by measuring the strip and animating only when it overflows,
  with both branches driven in a browser), `KI-26` (a render-blocking
  stylesheet fetched on every page load for an icon font nothing drew with;
  fixed 2026-10-20, and every font the page fetches is now matched against the
  families `tokens.ts` names), `KI-27` (a saved model stored its sliders and
  not the judgements it was built on, so it reopened valuing something else;
  fixed 2026-10-12), `KI-1` (forecast capital spending a flat share
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
  payloads, fixed 2026-09-27) and `KI-22` (assumptions reaching the valuation
  with no basis recorded: stock compensation and buybacks, both opened and fixed
  on 2026-09-28 in the commit that built the Assumptions sheet — writing the
  buyback sentence is what established that a derived company's authorised
  ceiling is its own spend and its percentage exactly 1.0, so `METHODOLOGY.md`
  §10 was corrected with it. The third figure in that entry, the workbook's
  revolver rate, was not a defect: it is an assumption with a stated basis and no
  engine counterpart, and it moved to `METHODOLOGY.md` §22), `KI-23` (the
  operating margin slider under-moving by the stock compensation share of
  revenue, fixed 2026-09-28) and `KI-20` with `KI-21` (the workbook's discount
  rate not moving with its tax rate, and its terminal growth rate not re-fading
  its forecast, both fixed 2026-09-28; the sweep that followed them fixed the
  cash cushion the same way and opened `KI-24` for the cost of debt) and `KI-24`
  itself (the workbook's cost of debt a constant where the engine averages the
  debt schedule's own rates, fixed 2026-09-28 once the absent-rate cases had been
  measured and found to reach no valued company's answer). Moved out on
  2026-09-27: `KI-11`, to
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

**One is open, as of 2026-11-11**, and it moves no valuation: `KI-42` is the
browser check not finishing. It is not a figure a reader could quote.
`KI-31` to `KI-39` were all fixed within eight days of each other, and the ID
ledger above says what each retired number was.

**What the list being short does not mean.** It is not a claim that the model is
right about everything, only that **nothing else is known to be wrong and left
standing**. What the sources do not publish is in `DATA_CONSTRAINTS.md`; what
the engine does on purpose is in `METHODOLOGY.md`. The next defect found goes
here as `KI-39`.

### `KI-42` The browser check does not finish on this machine

**Where:** `verify/dashboard.mts`, against the app as merged from the cloud runs.

**What is wrong.** `npm run verify:dashboard` does not run to the end. It stops
at a different place each time, always on a timeout.

**ONE CAUSE WAS FOUND AND FIXED ON 2026-11-11**, and it was a real defect of the
site rather than of the check. `CountUp` on the landing page read
`useConstrained() !== null || useReducedMotion()`, and `||` short-circuits: on a
wide screen the right-hand hook runs and the component uses two hooks; at phone
width it never runs and the component uses one. React tracks hooks by call
order, so the count changing between renders desynchronised its internal list
and **the whole landing page rendered nothing** — zero pieces of text. It needed
the TRANSITION between widths, which no single-width check performs; the
dashboard resizes to 390 to read contrast, so it met the bug and then failed
wherever the run happened to be. Measured: 20 narrowings, 20 blank pages. Both
hooks are called before their answers are combined now, and `verify:phone`
reproduces the transition in seconds — 7 faults with the conditional hook put
back.

**What is still wrong.** With that fixed the run gets further and the failures
stop moving randomly, but it still does not finish. Five runs on 2026-11-11:

| Run | Stopped at |
|---|---|
| 1 | nothing — 0 problems |
| 2 | the landing page at 390 held 0 pieces of text (the hooks bug) |
| 3 | a `waitFor` timeout |
| 4, 5 | the webfont count read 2, then the execution context was destroyed |
| 6 | the figures screen was not reached — the Reported figures table and the EBITDA bridge both absent |

The webfont count of 2 did not recur on the sixth run, and the check now names
the requests it saw: two for ONE url is a page loaded twice, which is what that
was.

**What is NOT known** is whether the rest is the app or this machine, and this
entry says so rather than guessing. Each journey the check walks has been walked
BY HAND, with a screenshot at every step, and each completes every time: the
curated company reaches its valuation and the fetched one reaches the questions.
What distinguishes the full run is length — one browser, dozens of navigations,
ten minutes. Against the machine: it suspended network IO (`ERR_NETWORK_IO_SUSPENDED`)
during one run, and background tasks have twice been killed for low memory on
the same day. A WebGL context leak was tested and ruled out: 24 visits, one
canvas and one live context every time.

**What it does not affect.** Nothing the engine computes. Every other check is
at zero: `verify`, `verify:workbook`, `verify:routes`, `verify:search`,
`verify:chart`, `verify:phone`, and the sweep.

**The fix** is a session with the run instrumented rather than watched: record
the browser's memory and the page's own state at each screen, and find whether
the failures track a resource climbing. A check that cannot be trusted to finish
is worth as much time as a defect in the site, because it is the thing that
finds the defects.

**What the list being short does not mean.** It is not a claim that the model is
right about everything, only that **nothing else is known to be wrong and left
standing**. What the sources do not publish is in `DATA_CONSTRAINTS.md`; what
the engine does on purpose is in `METHODOLOGY.md`. The next defect found goes
here as `KI-39`.

## A defect found and fixed on 29 October 2026, with no number

**A missing risk-free rate was being read as a rate of nought.**
`computeWACC` computed `c.riskFreeRate + c.marketRiskPremium * beta`, and in
JavaScript `null + 0.0423 * 1.02` is 4.31%. So every company whose currency has
no published ten-year government yield this site can read came out with a cost
of equity equal to the equity risk premium alone: **33 of the 177 payloads** on
disk, in won, renminbi, riyal, new Taiwan dollars, Canadian dollars, Australian
dollars, Singapore dollars, reais, Swiss francs and Danish kroner — 4.29% for
TSMC, 4.30% for Samsung, 4.80% for Alibaba.

**It moved no valuation**, which is why it survived: 32 of the 33 already carry
the engine’s own refusal for the missing rate, the discounted cash flow never
runs, and no screen printed a cost of capital the valuation did not use. The
risk and cost-of-capital card is the first screen that would have, and a card
whose first rule is to show the numbers the engine uses cannot show that one.
Fixed in the same commit: the cost of equity and the WACC are null where the
rate is null, which standing decision 3 requires, and the refusal already there
is what the reader sees. **Proved by breaking:** `npm run verify` reports the
card showing a cost of equity on a company with no risk-free rate.

---

## Closed, and what they were

`KI-25`, `KI-26` and `KI-28` were closed on 2026-10-20:
the news ticker that scrolled headlines which already fitted, the
render-blocking stylesheet fetched for an icon font nothing drew with, and the
typecheck that was checking no component props at all. Each left behind a
check that fails without its fix — the ticker is measured in a browser on both
branches, every font the page fetches is matched against the families
`tokens.ts` names, and `npm run verify` compiles a component call that must not
compile. See the ID ledger above for what each one was.

A short list is not a claim that the engine is correct. It is a claim that
nothing known to be wrong is being left alone unrecorded, which is the only
thing this file can honestly say.

## A defect found and fixed on 20 October 2026, with no number

It is here rather than in the list above because it was opened and closed in one
commit, and the list is for things being left alone. It is here at all because
the count above would otherwise read as nothing having been found.

**The disclosed exchange rate was named with a pair it was a hundred times away
from.** The header, the provenance line and the workbook's Sources sheet printed
`rate` — the composite number the *quoted* figure is multiplied by — beside the
name of the currency pair it came from. London quotes pence, Johannesburg cents
and Tel Aviv agorot, so on those listings the sentence read "converted at
0.013246 (GBPUSD=X)" where GBPUSD=X is 1.3246. Measured on the payload set:
**nine companies with a named pair** — AstraZeneca, BP, HSBC, Rio Tinto, Shell,
Unilever and Vodafone in London, Naspers in Johannesburg, Teva in Tel Aviv —
plus GSK, whose quote is in pence against statements in pounds and which names
no pair at all.

**It moved no valuation**, and that is why it survived: the arithmetic was
right. The price was converted correctly, and the figure the reader was given to
check it against was the wrong one. It was found while building the trading
currency figure beside each value per share, which has to divide by a rate — and
dividing by the composite would have put a London value in pence while calling
it pounds.

`listingComparability` now derives `tradingCurrencyRate` once, the rate per
major unit, and everything that names a pair or converts a figure uses that; the
quoted unit is said separately ("100 to one GBP"). **The check that would have
caught it** reads the sentence rather than the field behind it, because the
fields were right: `npm run verify` parses the rate and the pair out of the
provenance line for every converted company and compares them, and
`npm run verify:dashboard` opens the disclosure in a browser and asserts the
pair's rate is on the page and the composite is not. Both were proved by putting
the defect back: nine reported in the suite, one on the screen.

## What the 28 September run of entries was about

Five were opened on 2026-09-28 and all five closed the same day, all from one job:
building the workbook's Assumptions sheet. Writing down what every assumption
rests on means following each one to the cell it drives, and four of them stopped
short of where the engine carries them.

`KI-22` was two assumptions with no recorded basis — written, and retired.
`KI-23` was the operating margin slider under-moving by the stock compensation
share of revenue, a scaling that was correct when written and made wrong by a
change elsewhere. `KI-20` and `KI-21` were typed constants on the DCF sheet and
the model sheet where the engine computes a figure: the discount rate did not
move with the tax rate, and the terminal growth rate did not re-fade the
forecast. `KI-24` was the same pattern again, found by sweeping for it rather
than by hitting it: the cost of debt was a constant where the engine averages
the debt schedule's own rates. It was left open for a day on the grounds that
reproducing the engine's handling of a year with no filed interest might need
something the workbook does not carry — then measured, and it does not. Of the
56 valued companies, two have such a year and both of them owe nothing at all,
so the debt weight is nil and the cost of debt cannot reach their answer. The
formula names the years the engine actually used rather than averaging a range,
so the case still cannot bite the company it one day applies to.

**All five are the `KI-4` shape**, and `KI-4`'s lesson is the one that matters:
a workbook seeded from the engine's own answer agrees exactly at rest and parts
on the first edit, which is precisely when anyone is reading it. Agreement at
rest is worth very little. `npm run verify` now checks thirteen lines after an
edit, the size of a driver's response as well as its direction, and that every
value on the Assumptions sheet is a link rather than a copy.

## Where the list stood before these

The list reached zero on 2026-09-27. That is not a claim that the model is
right — it is a claim that nothing on it is a mistake of ours that we know about
and have not dealt with. Everything that was there has been fixed, or established
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

**A defect that lived for one day and never got a number.** The risk and
cost-of-capital card shipped on 2026-10-29 with an editable beta row, and the
figure a reader put into that row was handed to the engine as an ASSET beta —
which the engine relevers onto the company's own borrowings before taking a cost
of equity from it. A beta measured by regressing a share price is already
levered: the borrowings are in the price history. So the button offering BP's
measured 0.598 put 0.635 into the model, and the row showed one number while the
valuation used another, which is the single thing that card exists to prevent. It
was found on 2026-10-30 while building the switch that lets a reader choose the
measured beta, and fixed in the same commit: an edit to the beta row now sets
`betaIsUnlevered` to false, the engine uses the figure as given, and
`npm run verify` asserts the beta the model uses is the figure printed on the
button that set it. The engine's own default is still an asset beta of 1.0 and is
still relevered, which is right for a figure that describes the business rather
than the share (`METHODOLOGY.md` §14).

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
