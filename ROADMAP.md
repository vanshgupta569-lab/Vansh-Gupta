# Marginalia — Roadmap

The forward plan for Marginalia: what is built, what is next, what is waiting and why, and what was decided against. It consolidates the earlier Build Roadmap (Sept 2026 – Feb 2027) and the Master List, with statuses brought up to date as of 21 September 2026.

**This file is the plan. It is not the defect list.** Things that are wrong with what already exists live in `KNOWN_ISSUES.md`. Modelling standards live in `CONVENTIONS.md`, and how the code measures against them lives in `CONVENTIONS_AUDIT.md`. Read those three alongside this one.

## How to maintain this file

- When an item ships, change its status to LIVE and move it to the Shipped log at the bottom, with the commit hash.
- When a new idea is raised, add it as IDEA in the right section. It stays IDEA until Nihar decides to build it.
- Never delete an item silently. Something not being built goes to "Decided against" with the reason.
- If a planned item turns out to be already built, mark it LIVE and say so — several were found this way.
- Keep `KNOWN_ISSUES.md` and this file separate. A defect found while building a roadmap item goes there, not here.

## Status words

| Status | Meaning |
|---|---|
| LIVE | Deployed and checked. |
| IN FLIGHT | Part-built. |
| NEXT | Agreed, and the thing after the current job. |
| QUEUED | Agreed, not started. |
| BLOCKED | Waiting on something specific, named on the line. |
| IDEA | Raised, not yet decided. |
| DROPPED | Decided against, with the reason. |

## Standing decisions

These shape everything below. Changing one is a decision for Nihar, not a code change.

- **Models are built by the engine only.** No hand-built company models on the site. The hand-built Apple data file remains as a test fixture and a verification reference, not as a product.
- **Never ship a module not first built by hand in Excel.** The learning track runs roughly a month ahead of the code it feeds. This is the quality control: the engine was first verified against Nihar's own Apple workbook across 369 checks.
- **Never blend valuation methods.** The three approaches are shown side by side. The perpetuity and exit-multiple terminal values are also shown separately, never averaged (since `933fc2c`).
- **Refuse rather than approximate.** A company the engine cannot honestly model gets a plain-English refusal naming what is missing, not a number. Missing data is never silently treated as zero.
- **Reported, corrected and modelled are three visibly separate states.** A corrected figure is never shown as filed.
- **Explain mechanics, not merit.** A fact plus a definition is education; calling a number a warning sign is an opinion on a security.
- **No false or unverifiable claims.** Anything not built is labelled as being built.
- **Use AI only where its output can be checked against a source.** Extraction with the sentence quoted and its page number is fine; generating a judgement is not.

## Now and next

In order. Engine defects are worked from `KNOWN_ISSUES.md` in parallel with this list; the top of that file is currently method questions rather than missing data.

1. **NEXT — Remaining `KNOWN_ISSUES.md` method entries.** The top of that file is now the undocumented discounting convention (KI-2), the forecast tax rate on a different pretax base (KI-3), and the working-capital drivers that differ between the site and the workbook (KI-4). Entries there carry permanent IDs from 2026-09-22: `KI-4` means the same defect for good, and fixing one no longer renumbers the rest.
2. **NEXT — Primary-filings data layer, India first.** Section 1 below. The largest planned piece of work, and the one that removes the Yahoo dependency behind the currency, ADR and share-count problems.
3. **QUEUED — `CLAUDE.md` house-rules file.** Section 7.
4. **QUEUED — Outsourceable content units.** Did-you-know entries, 10b qualitative factors, eight SEO explainer pages. None needs the repository.
5. **IDEA — A check that the dashboard renders what the engine produced.** The one hole the verification harness leaves, recorded under the verification limits in `KNOWN_ISSUES.md`. `playwright` is already a dev dependency.

---

## 1. Primary-filings data layer

**Status: NEXT.** Raised 21 September 2026.

### Why

For US companies the site already reads the company's own filing: SEC XBRL, which is primary data, not a third party. For every other company it reads Yahoo Finance, which licenses fundamentals from data vendors, who in turn extract them from the same filings. That extra layer is where the worst defects of September 2026 came from: financial statements in yen labelled as US dollars, ADR share counts scaled inconsistently (Toyota a tenth of the Tokyo count, AstraZeneca left at the ordinary count), and Brazilian companies whose currency field contradicted every figure. The fix at the time was to refuse 38 US-listed foreign companies.

Going to the filings directly removes that layer. It has three further advantages:

- **Redistribution.** Figures extracted from public filings are the site's own to redistribute. Licensed vendor data is not — the same constraint that blocks precedent transactions (section 2). Building this layer removes that ceiling everywhere.
- **Format.** The data arrives in the site's required shape rather than being mapped from someone else's, so each line carries its own provenance.
- **A product in its own right.** See stages 2 and 3.

### What stays the same

Much of September's engine work was not caused by the source. Home Depot's debt tag already containing its leases, Wells Fargo reporting common-only dividends, American Express filing its preferred stock at par — those are in the companies' own SEC filings. Companies tag the same thing differently in every jurisdiction. The standardisation layer in `deriveModel.js`, and every rule it now enforces, is the real asset and is kept.

### Sources, by jurisdiction

Availability and terms of use must be confirmed per source before building. Recorded here as the working map, not as verified fact.

| Market | Primary source | Notes |
|---|---|---|
| United States | SEC XBRL company facts | LIVE. Already the US path. |
| India | BSE and NSE financial results in XBRL; MCA filings in XBRL for many companies | First target. Nihar's intended market and the weakest path today. |
| European Union | Annual reports in iXBRL under ESEF | Mandatory for listed companies' annual reports. |
| United Kingdom | iXBRL filings | |
| Japan | EDINET XBRL | |
| Elsewhere | Varies | Stays on the current path, or refused, until a primary source is established. |

### Stages

1. **India from exchange filings.** Replace the Yahoo path for NSE and BSE companies with the exchanges' own XBRL results, falling back to MCA filings. Measure against the current Yahoo figures for the same companies before switching, so any difference is explained rather than silently introduced. Currency and share count come from the filing itself, which removes the inference that caused the ADR problems for Indian listings.
2. **Standardised reported statements, downloadable on their own.** A user who does not want a model downloads the company's reported statements, in the site's standard layout, with every line traced to its filing. Provenance per line, and "not reported" wherever the filing is silent — never a zero. This stage is what unblocks the house template upload in section 6: the figures it pours into a firm's own layout are these.
3. **Reclassification layer.** Sits between reported and corrected. The user decides how each expense line is treated: direct or indirect, selling and distribution, administrative, extraordinary and excluded. The filed classification is always kept beside the user's, the same way 11a keeps the filed value beside a correction. The model then runs on the user's classification if they want it to. This extends the existing reported / corrected / modelled rule rather than adding a new one.
4. **Other jurisdictions.** EU, UK and Japan in that order, each as its own integration.

### Constraints

- Each jurisdiction is a separate integration with its own taxonomy. Ind AS, IFRS and US GAAP tag the same economic item differently, and the mapping for each must be built and verified separately.
- Confirm each exchange's or portal's terms of use permit redistribution before stage 2 goes public.
- Every rule in `CONVENTIONS.md` and every refusal rule in the engine applies unchanged. A new source is not a reason to relax one.
- The engine only builds models (standing decision). The data layer feeds it; it does not replace it.

---

## 2. Engine and valuation methods

### Income approach

| Item | Status | Notes |
|---|---|---|
| DCF, operating companies | LIVE | Verified against the hand-built Apple workbook. |
| Residual income, banks and financials | LIVE | Runs on the parent's common-shareholder basis: preferred stock and minority interests excluded from book equity (`e277bf5`, `2d02f95`). Gated on the filed balance sheet balancing. |
| Reverse DCF | LIVE | Solves against the perpetuity value, named as such. |
| Refusal logic | LIVE | Extended through September: balance sheet integrity, missing income statement lines, missing forecast inputs, implausible depreciation rates, currency and listing comparability, untagged preferred or minority claims. |
| Health score | LIVE | Each ratio, its value, and the threshold it was judged against. |
| Batch mode | LIVE | Method column names the perpetuity basis. |
| Terminal values shown separately | LIVE | Perpetuity and exit multiple side by side with the spread; a gap over 25% is explained on screen (`933fc2c`). |
| Systematic company sweep | LIVE | The planned ~30-name test pass was superseded by a 104–176 company sweep, now run as part of every engine change. The harness lives in `verify/` (`48c95b6`). |
| Depreciation on the asset base | LIVE | Charged on opening PP&E plus half the year's additions, not on the year's capital spending. |
| Company-specific beta | QUEUED | Derived companies use an asset beta of 1.0 relevered on their own capital structure. A real beta lookback is missing (limitation L25). |
| Monte Carlo simulation | IDEA | Thousands of model runs with the inputs drawn from ranges, giving a spread of values rather than one figure. Every range must come from the company's own filed history — how much its growth, margins and capital spending actually varied — never from arbitrary assumptions, or the output is false precision. Build after 9 + 12b, the scenario comparison, which it extends. |
| Segment revenue | BLOCKED | No free structured source carries it; every derived model runs on one revenue line. Unblocked by AI filing extraction (13 + 14) or the data layer. |

### Market approach

| Item | Status | Notes |
|---|---|---|
| Market approach as a stated method | LIVE | EV/EBITDA, EV/Sales and P/E applied to the company's own figures, shown as a range. EBITDA standardised to exclude stock compensation to match the peers (`ac400b6`). |
| Choose the comparables (16) | LIVE | Up to fifteen candidates; the user picks. |
| Market range on the football field | LIVE | Already built, found on checking 21 September 2026. The field draws a "Market — peer multiples" bar with its low, mid and high, beside the two terminal values and an asset bar (`TerminalDashboard.tsx`, `fieldBands`). |
| Precedent transactions | BLOCKED | Licensed data cannot be redistributed. See the hand-built database below, and the data layer, which removes the licensing constraint for figures the site extracts itself. |
| Hand-built precedent database | QUEUED | Open offer letters under the takeover code, exchange announcements, annual reports. Every row links to its filing. |
| Written redistribution permission from a vendor | QUEUED | Ask before signing any seat licence. The answer is usually no without a separate addendum. |

### Asset approach

| Item | Status | Notes |
|---|---|---|
| Book value, tangible book value, net current asset value | LIVE | Straight from the filings. |
| Liquidation value with user-set recovery rates | IN FLIGHT | Figures reported, haircuts the user's, as yellow assumption rows. |
| Method suitability stated on screen | QUEUED | Asset-light companies see the asset figures with the limit spelled out. Same discipline as refusing a DCF for a bank. |
| Three-approaches summary on the company screen | QUEUED | Side by side, never averaged. The headline stays the income approach for operating companies. |

### Committed backlog items

| Item | Status | Notes |
|---|---|---|
| 11a — correct the extracted figures | LIVE | Editable table before modelling; filed value kept beside any change. |
| Mark a corrected figure on the historicals table | QUEUED | The one gap left from 11a. Lives in `TerminalDashboard.tsx`, so its own job. |
| 12a — rule-based flags, no AI | QUEUED | Seven checks over data already fetched. States what the numbers do; never characterises them. |
| 9 + 12b — scenario comparison side by side | QUEUED | Runs on the corrected figures and the flags. |
| 13 + 14 — AI reads the filed documents | QUEUED | Related parties, contingent liabilities, litigation as disclosed, auditor qualifications, CARO remarks, segment revenue. Roughly ₹15–60 per company. Extraction with quote and page number only. |
| 17.1 — debt capacity and covenant headroom | QUEUED | Shares machinery with the LBO module; building it first makes the LBO cheaper. |
| 10b — more qualitative factors | QUEUED | Pure data file. Outsourceable to another account. |
| 17.4 — industry research, two to three page reports | QUEUED | Written, not computed. See "Industry research as a product" in section 9. |
| 17.3 — FP&A, narrow version | QUEUED | Budget alongside actuals on the figures screen. Real FP&A needs monthly data the site cannot have. |
| 11b — upload a financials file | BLOCKED | Waiting on evidence 11a gets used, paid hosting, a parsing budget and a written data policy. Partly superseded by the data layer. |

---

## 3. The workbook and exports

The Excel export is the product a paying user is most likely to value (section 6). Nobody else supplies a ready-built, convention-formatted, live three-statement workbook for a listed company.

| Item | Status | Notes |
|---|---|---|
| Live working model | LIVE | Every schedule driven by its own yellow assumption row; closing balance is opening plus movement; the balance check computes rather than asserts. |
| Sheets: Cover, 3-Statement Model, Income Statement, Balance Sheet, Cash Flow, Annexures, DCF Model, Ratios, Checks, Sources | LIVE | Statement sheets and annexures link live to the model sheet. |
| Checks sheet | LIVE | Every check a difference that must be zero, plus an "as filed" tie for pretax and net income in reported years. |
| Sources sheet | LIVE | Every filed line with its year and value; currency basis and conversion rate stated. |
| Ratios sheet with data bars | LIVE | Live cross-sheet formulas; conditional-formatting data bars on margin and return rows. |
| Circularity switch | LIVE | Circuit breaker cell; iterative calculation written into the file. Verified converging in real Excel. |
| Revolver as a proper roll-forward | LIVE | |
| Split `excelExport.ts` | LIVE | Read-only sheets live in `excelSheets.ts`. |
| Named ranges and input validation | QUEUED | No defined names or data validation yet. Makes the assumption cells safe to hand to someone else. |
| Native Excel charts | BLOCKED | ExcelJS has no chart API. Would need a different library or hand-written chart XML. Data bars are the current substitute. |
| Tearsheet, the one-pager | QUEUED | Description, price, key financials, multiples, model value, premium or discount. A print layout over figures already computed. Call it a tearsheet. |

---

## 4. LBO and private companies

Gated on the learning track (section 8). Nothing here starts before its hand model exists.

| Item | Status | Notes |
|---|---|---|
| LBO hand model in Excel | QUEUED | One Indian mid-cap end to end: sources and uses, debt schedule with a cash sweep, exit multiple, IRR and money multiple. Match the engine's conventions so the module is a translation, not a redesign. |
| Break the hand model on purpose | QUEUED | Run it at 4x and 6x leverage; find where the cash sweep never clears the debt. That failure point is what the module must detect and refuse. |
| LBO module | QUEUED | Entry multiple, debt quantum and exit multiple as yellow rows; IRR and money multiple out. Reads the engine's forecast cash flows. Biggest single differentiator. |
| LBO refusals | QUEUED | None for banks, NBFCs or insurers, and none where cash flows cannot service the debt. |
| Label the LBO as a hypothetical take-private | QUEUED | On screen, or it becomes a claim the site cannot stand behind. |
| Verify against the hand model | QUEUED | Replay the module's output against the Excel build on the same company before it goes live. |
| Typed-input private company form | QUEUED | Owner types revenue, costs, working capital and debt. Runs in the browser; nothing uploaded, stored or transmitted, and the page can say so. |
| Same engine, same schema | QUEUED | If private companies need their own code path, the design is wrong. |
| Document upload for private companies | BLOCKED | Needs paid hosting, a retention and deletion policy, and a confirmation step showing extracted figures against the source page. |

---

## 5. Content and education

| Item | Status | Notes |
|---|---|---|
| Margin Notes data file, 19 notes | LIVE | Written from general accounting knowledge. |
| Buffett lens callouts | LIVE | Our summary of the questions Mary Buffett and David Clark ask. Their numeric thresholds are deliberately excluded; the book is credited instead. Never reproduce the thresholds. |
| Margin Notes screen | LIVE | Paper palette; index plus article reader. |
| SEO explainer pages, eight articles | QUEUED | What is a DCF, free cash flow, WACC, terminal value, EV/EBITDA, book value, why two analysts differ, the three-statement model. Outsourceable. |
| Did you know, on the loading screen | QUEUED | Short insights while the model builds; `BuildPipeline` already exists. Entries outsourceable. Why negative working capital can be a strength is the first. |
| Naive investor section | QUEUED | Insights from the reported statements. Explain mechanics, not merit. |
| Landing page rewrite | QUEUED | Less theory, a clearer statement of what the site does, and the basics of financial modelling for someone arriving cold. |
| Explainer video | QUEUED | Record once, when nothing significant is left to add. Screen capture of the real product. |
| Animated advertisement | IDEA | Raised, not scoped, not costed. |
| Use Pignataro and other books to shape conventions | LIVE (in part) | `CONVENTIONS.md` is the Pignataro-derived checklist, written in our own words. Same limit for any further book: structure and method yes, expression, tables and thresholds no. |
| Aswath Damodaran resources | IDEA | Check what is freely usable and under what terms. |
| MCQ platform with explanations and memory tricks | IDEA | From the FR book. A separate product from the valuation site. |

---

## 6. Making it a paid product

The wedge: nobody supplies a ready-built, convention-formatted, live three-statement workbook for a listed company. The buyer is the independent valuer, the CA firm and the boutique advisory shop, who need a model that survives scrutiny and currently rebuild one from scratch each time. What they buy is defensibility and time, not the number.

| Item | Status | Notes |
|---|---|---|
| Sources and Checks sheets | LIVE | The two sheets that make the workbook defensible. |
| Standardised reported statements download | NEXT | Stage 2 of the data layer. A product for users who don't want a model. |
| Reclassification layer | NEXT | Stage 3 of the data layer. |
| House template upload | IDEA | A firm uploads its own Excel layout once and the site fills it with the company's reported filings, the feature Screener offers. Depends on the data layer's standardised reported statements (section 1, stage 2), which is what supplies the figures. What it adds beyond Screener: every figure traced to its filing, "not reported" rather than zero, the reclassification layer, the Checks sheet, and a live model built on top. Where Screener sources its data is unconfirmed, and worth establishing before relying on that comparison. Strongest retention feature on the list; the same engine as item 15 pointed the other way. |
| 15 — reformat a user's model to convention | QUEUED | Formatting only, never a number. In the browser via exceljs, so the file never leaves their machine. |
| Model versioning, freeze and shareable link | IDEA | Freeze a model with a date so it can be reproduced later. |
| Comparables justification sheet | IDEA | Why each peer was included and each rejected. The most attacked section of any valuation report. |
| Draft valuation report in Word | IDEA | The deliverable they are paid for, with figures traced back to workbook cells. |
| Method-specific outputs | IDEA | Net asset value alongside DCF in the shape Rule 11UA expects; ESOP valuation; purchase price allocation. Nihar to say which comes up most. |
| Excel round trip | IDEA | Take the model out, work on it, bring it back. |
| Batch export | IDEA | Twenty companies at once. |
| Peer workbook | IDEA | Target and all comparables on identical sheets in one file. |
| Refresh on new results | IDEA | A saved model re-runs when new results are filed and says what moved. Turns a purchase into a subscription. |
| Invert the product | IDEA | If the workbook is what people pay for, the site is where a model is configured and checked. Changes what the landing page says. |
| Watch two numbers, not visitors | IDEA | How many people correct a figure; how many open a second company. |
| SEBI research analyst question | QUEUED | The definition of a research report covers an opinion as to the value of a security, and the site prints a target price. One question for someone qualified before any money is taken. |
| Cost of being paid | IDEA | Uptime, support, refunds, invoices, GST. Price high to few rather than low to many. |
| Paid domain and paid data provider | IDEA | Nihar's stated intention once users pay. The data layer may make a paid provider unnecessary for filed figures; prices and market data would still need a source. |

---

## 7. Site, design, workflow and housekeeping

| Item | Status | Notes |
|---|---|---|
| Security: validation, headers, CSP, CORS, cache, no echoed input | LIVE | |
| Favicon and link preview image | LIVE | |
| Typography stylesheet, search box fix, brand assets | LIVE | |
| How this was calculated, as a plain-English explainer | LIVE | |
| Qualitative questions before the model is built | LIVE | Reported facts beside the questions; prominent skip. |
| Red square with zero advance width on every screen | LIVE | `marginRight: -0.21em`. Fixed in `DirectoryScreen.tsx` (`2ce16ff`). |
| Privacy and terms footnotes | LIVE | Footer modals on every screen. |
| "Things to check" wording, never "anomaly" | LIVE | |
| Contrast fix and shared tokens file | QUEUED | Dim grey at 3.5:1 and the eyebrow red at 3.9:1, both under 4.5:1. Declared as local constants in eight files and applied inline, so a stylesheet cannot reach them. One shared tokens file fixes it and stops the colours and the square drifting again. |
| `CLAUDE.md` house-rules file | QUEUED | The standing decisions above, the palette, Inter and Playfair, the square, the costs-are-negative convention, verify-by-recalculating. Read by Claude Code every session. |
| README verdict badge | QUEUED | Flagged by Claude Code as contradicting the product. A public claim that isn't true. |
| Commit `package.json` and lockfile | QUEUED | Left uncommitted across many jobs; commit on its own. |
| Development in Claude Code | LIVE | Planning and judgement in chat; code in Claude Code, one job per session; small self-contained content jobs in other accounts. |
| Antigravity for design work | IDEA | Being set up by Nihar. Proposed split: Claude Code owns the engine and workbook, where the verification discipline matters; Antigravity takes screens and design. Nothing touching the engine or export ships without the scenario suite and every Checks row at zero, whichever tool builds it. |
| One commit per job | LIVE | Protects Vercel build credits. Separate commits for genuinely independent fixes. |

---

## 8. The learning track

Runs about a month ahead of the build it feeds. CFA Level II is the variable: if the exam falls inside the window, move the whole tail by about eight weeks rather than resequencing.

| Item | Status | Notes |
|---|---|---|
| Comparable companies and precedent transactions | QUEUED | One to two weeks. Control premia, synergies in the price, and why a precedent multiple is not a trading multiple. |
| LBO | QUEUED | Four to six weeks. The heaviest item. Needs a clear run. |
| Quality of earnings | QUEUED | Two to three weeks. Closest to articleship work. Pairs with the asset approach and the naive investor section. |
| Private company modelling | QUEUED | Three to four weeks. Cleaning promoter salary and related-party rent; a cost of equity with no market price. |
| Deal structuring | QUEUED | Reading only, lowest priority. Makes most sense after the LBO and private company work. |
| CFA Level II | BLOCKED | Exam date sets the calendar. |

---

## 9. Raised, not yet scoped

| Item | Status | Notes |
|---|---|---|
| Risk and debt syndication on the site | IDEA | Raised as a question, not a plan. |
| Industry research as a product | IDEA | Overlaps 17.4. Decide whether they are one thing or two. |
| Find comparables as a standalone tool | IDEA | The engine already selects peers; this exposes that on its own. |
| AI-assisted document review for diligence | IDEA | AI gathers and flags; the professional validates and defends. Overlaps 13 + 14. |
| Reading about new startups, especially outside India | IDEA | Input rather than a feature. |

---

## 10. Decided against

| Item | Reason |
|---|---|
| Scraping court records for litigation | Replaced by what the company disclosed in its own DRHP and annual report. |
| Rebuilding comparable company analysis | Already built; extended rather than restarted. |
| "No student-built tool has this" as copy | Fine as private motivation. It cannot be verified. |
| Averaging the three approaches, or the two terminal values | They answer different questions. Side by side, always. |
| Licensed precedent data displayed on the site | Unless a written derived-data permission exists. |
| Hand-built company models on the site | Models are engine-built only (standing decision, 21 September 2026). |
| Flooring WACC | A floor is a number chosen to hide a problem. Relevering beta on each company's capital structure fixed the underlying cause (`5ecd822`). |
| Treating a missing filed figure as zero | Zero is a claim the company reported zero. Show "not reported" or refuse. |

---

## Shipped log

Engine and workbook work from September 2026, most recent first. Defect detail and measurements are in the commit messages and in the history of `KNOWN_ISSUES.md`.

| Commit | What |
|---|---|
| `4cdec07` | Forecast depreciation charged on the assets in service, not on the year's capital spending. |
| `48c95b6` | The verification harness committed to `verify/`, runnable from a fresh checkout. |
| `15232f9` | `ROADMAP.md` added. |
| `52e062a` | Workbook and site agree exactly on value per share; both terminal treatments reconciled. |
| `933fc2c` | Terminal values no longer averaged; spread shown and explained. |
| `5ecd822` | Each company's own cost of debt; asset beta relevered on its capital structure. |
| `e1e6cfc` | Short-term borrowings, current maturities and finance leases counted as debt; operating leases reported, not netted, under ASC 842. |
| `7240d06` | WACC weights on gross debt and market equity. |
| `b7432d6` | Short-term marketable securities netted off debt. |
| `ac400b6` | EBITDA excludes stock compensation, matching the peers. |
| `2d02f95` | Residual income book equity excludes minority interests. |
| `e277bf5` | Residual income on the common-shareholder basis. |
| `80b27f2` | Equity bridge deducts minority interests and preferred stock. |
| `8b309d0` | Depreciation rate from filed depreciation; fabricated first year removed. |
| `ea2f020` | Filed SG&A shown as SG&A with the residual on its own line; "not reported" instead of zero. |
| `42919ee` | Reporting currency confirmed from the filing; US listings of foreign companies refused on unknown ADR ratios. |
| `03617c2` | Reported net income ties to the filing. |
| `13de608` | Amortisation of intangibles runs off against the reported pool. |
| `1bd507b` | Bank residual income gated on the filed balance sheet. |
| `e608fdd` | No valuation shown on a balance sheet that does not balance. |
| `7d73857` | Depreciation and stock compensation charged as their own lines. |
| `1f8b8f1` | Capex sign corrected for derived companies. |
| `58f6fb4` | PIK interest charged in interest expense. |
| `7633302` | Revolver as a proper roll-forward. |
| `f746e7f` | Income Statement, Balance Sheet, Cash Flow and Annexures sheets. |
| `41bc482` | First-year growth and depreciation formulas no longer reach the units column. |
| `2ce16ff` | Red square fixed in `DirectoryScreen.tsx`. |
| `113f8e3` | `CONVENTIONS.md` and `CONVENTIONS_AUDIT.md`. |
| `f1d9339` | `KNOWN_ISSUES.md` created. |
