# Marginalia — Roadmap

The forward plan for Marginalia: what is built, what is next, what is waiting and why, and what was decided against. Statuses current as of 28 September 2026.

**This file is the plan. It is not the defect list.** Things that are wrong with what already exists live in `KNOWN_ISSUES.md`. How the engine actually works lives in `METHODOLOGY.md`. Modelling standards live in `CONVENTIONS.md`, and how the code measures against them in `CONVENTIONS_AUDIT.md`. What the sources do not publish lives in `DATA_CONSTRAINTS.md`. Read those alongside this one.

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

---

## The design rule

**The machine does the arithmetic; the human keeps the judgement.**

Financial modelling has not been automated because it is not arithmetic — it is a sequence of judgements. Whether a carpentry expense is direct or indirect. Whether a legal settlement recurs. Whether a lease is debt. Whether last year's margin or a five-year average is the fair base.

So every judgement in the model is surfaced, given a default drawn from the filings, made overridable, and recorded with its basis and the user's reason. Section 2 is that layer. It is the centre of the product rather than a feature within it, and it is what makes a model defensible line by line.

This is a design principle, not copy. It belongs in this file and in the shape of the product. It does not belong on the site or in a workbook: a deliverable that argues for itself is not one a professional will send to a client.

## Standing decisions

These shape everything below. Changing one is a decision for Nihar, not a code change.

- **Models are built by the engine only.** No hand-built company models on the site. The hand-built Apple data file remains a test fixture and a verification reference, not a product.
- **Judgements belong to the user; arithmetic belongs to the engine.** Where a modelling choice exists, the site states the default, says where the default came from, and lets the user change it. It never hides a judgement inside a calculation.
- **Every module is verified before it ships.** The engine was verified against a hand-built workbook across 369 checks; the harness in `verify/` now does this continuously. A new module is verified first against its own internal arithmetic — the identities that must hold in any correct model, whoever built it — and second against published worked examples, as a cross-check rather than an authority. Where ours and a published example disagree, investigate; do not defer. *(Replaces the former rule that nothing ships before Nihar has built it by hand. Retired 28 September 2026: the standard stays, the wait does not.)*
- **Never blend valuation methods.** The three approaches are shown side by side. The perpetuity and exit-multiple terminal values are shown separately, never averaged (`933fc2c`).
- **Refuse rather than approximate.** A company the engine cannot honestly model gets a plain-English refusal naming what is missing, not a number. Missing data is never silently treated as zero.
- **Reported, corrected, reclassified and modelled are four visibly separate states.** A corrected figure is never shown as filed; a reclassified one is never shown as reported.
- **Explain mechanics, not merit.** A fact plus a definition is education; calling a number a warning sign is an opinion on a security.
- **No false or unverifiable claims.** Anything not built is labelled as being built.
- **Use AI only where its output can be checked against a source.** Extraction with the sentence quoted and its page number is fine; generating a judgement is not.

---

## Now and next

1. **`KNOWN_ISSUES.md` is empty again.** It stood empty from 2026-09-27, and building the Assumptions sheet on 2026-09-28 opened five and closed all five the same day: assumptions with no recorded basis (`KI-22`), the operating margin slider under-moving (`KI-23`), the discount rate and growth fade the workbook held still where the engine recomputes them (`KI-20`, `KI-21`), and the cost of debt found by sweeping for the same pattern (`KI-24`). All five are the `KI-4` shape — a workbook seeded from the engine's answer, right at rest and wrong on the first edit. Nineteen numbered defects were opened between 22 and 27 September: fourteen fixed, three established as things the filings cannot settle, one needing disclosure. The list staying empty is the work, not the milestone, and a sheet whose job is to write down what every number rests on is the kind of work that refills it.
2. **NEXT — Primary-filings data layer** (section 1). The largest piece of work and the foundation for almost everything below.
3. **NEXT — The judgement layer** (section 2). Can begin in parallel: the structural judgements already exist as engine defaults and need surfacing, saving and recording, which does not wait on new data.
4. **QUEUED — Standard chart of accounts** (section 4). Cheap, and several later items depend on it.
5. **QUEUED — `CLAUDE.md` house-rules file** (section 8).

---

## 1. Primary-filings data layer

**Status: NEXT.** Raised 21 September 2026. Broadened from India-first to international on 28 September 2026.

### Why

For US companies the site already reads the company's own filing: SEC XBRL, primary data, not a third party. For every other company it reads Yahoo Finance, which licenses fundamentals from vendors who extract them from the same filings. That extra layer produced the worst defects of September 2026: statements in yen labelled as dollars, ADR share counts scaled inconsistently, Brazilian companies whose currency field contradicted every figure. The fix at the time was to refuse 38 US-listed foreign companies.

**What it would remove, counted.** `DATA_CONSTRAINTS.md` records five vendor gaps that reading filings directly would close outright: stock compensation never broken out (17 valued companies), bank dividends not split between common and preferred (18), depreciation not separated from amortisation (9), the depositary-receipt ratio (38 refused listings), a reporting currency stated two ways (3 refused).

Three further advantages: figures extracted from public filings are **ours to redistribute**, which licensed data is not; the data arrives **in our own shape** with provenance per line; and the standardised statements are **a product in their own right** (stages 2 and 3).

### What stays the same

Much of September's engine work was not caused by the source. Home Depot's debt tag containing its leases, Wells Fargo reporting common-only dividends, American Express filing preferred at par — all in the companies' own SEC filings. Companies tag the same thing differently everywhere. The standardisation layer in `deriveModel.js` is the real asset and is kept.

### Sources, by jurisdiction

Availability and terms of use must be confirmed per source before building. A working map, not verified fact.

| Market | Primary source | Status |
|---|---|---|
| United States | SEC XBRL company facts | LIVE |
| India | BSE and NSE results in XBRL; MCA filings | First target |
| European Union | Annual reports in iXBRL under ESEF | Second |
| United Kingdom | Companies House and RNS iXBRL | Third |
| Japan | EDINET XBRL | Fourth |
| Australia | ASX and ASIC | Fifth |
| Canada | SEDAR+ | Sixth |
| Elsewhere | Varies | Current path or refused until a primary source exists |

**Ordering principle:** by likely paying users, not by ambition. India first because Reliance and TCS are refused today and it is the market Nihar can check by eye. The order after India is open and should follow where demand appears.

### Stages

1. **India from exchange filings.** Replace the Yahoo path for NSE and BSE companies. Measure against current Yahoo figures before switching, so every difference is explained rather than silently introduced. Currency and share count come from the filing itself.
2. **Standardised reported statements, downloadable on their own.** For a user who does not want a model. Every line traced to its filing, provenance per line, "not reported" where the filing is silent — never a zero. Unblocks the house template upload (section 9).
3. **Reclassification layer.** See section 2 — this is where the judgement layer meets the data.
4. **Other jurisdictions**, in the order above.

### The Indian risk-free rate

**BLOCKED, and the first thing an Indian data layer should close.** The published benchmark is FBIL's 10-year G-Sec par yield, a licensed commercial benchmark. RBI republishes the latest observation with no history; RBI's historical database will not accept connections from outside India. A year's average is what the model needs. Until a usable history is found, every INR company is refused for want of a risk-free rate — including Reliance and TCS. Check whether NSE or CCIL publish a usable series.

### Constraints

- Each jurisdiction is its own integration with its own taxonomy. Ind AS, IFRS and US GAAP tag the same item differently; each mapping is built and verified separately. **Outsourceable**: the tag-mapping research needs no repository access.
- Confirm terms of use permit redistribution before stage 2 goes public.
- Every rule in `CONVENTIONS.md` and every refusal applies unchanged. A new source is not a reason to relax one.

---

## 2. The judgement layer

**Status: NEXT.** Raised 28 September 2026. The centre of the product.

Financial modelling resists automation because it is a chain of judgements, not a calculation. This layer makes every one explicit, defaulted, overridable and recorded.

### The rules

- Every judgement has a **default drawn from the filings or a stated convention**, and the default says where it came from.
- Every override takes an **optional one-line reason**. Without it a model is traceable in its figures but not in its decisions.
- Every override has a visible **return to default**. Without it people stop experimenting.
- Changing a judgement **rebuilds the model immediately**, with the previous value still visible beside it.
- A judgement is never applied silently. `METHODOLOGY.md` names the default for each.

### The structural judgements

| Judgement | Status | Notes |
|---|---|---|
| Expense classification — direct, indirect, selling and distribution, administrative, excluded | QUEUED | The example that started this. Stage 3 of the data layer. Filed classification always kept beside the user's. |
| What counts as non-recurring | QUEUED | Currently a median rule; should be a per-item choice. |
| Operating versus non-operating | QUEUED | |
| Capitalise or expense | QUEUED | |
| Which working-capital line follows revenue and which follows cost of sales | QUEUED | The engine already declares its rule (`c60cb3a`); this exposes it. |
| Whether a lease is debt | QUEUED | The engine's rule is in `METHODOLOGY.md`; make it a choice with that rule as the default. |
| What else is debt-like — pensions, provisions, contingent consideration | QUEUED | A tick list in the equity bridge. |
| How much cash is surplus rather than operating | QUEUED | Default is the company's own lowest filed cash-to-revenue ratio (`a061abc`). |
| Effective or marginal tax rate | QUEUED | |
| Useful lives | QUEUED | |
| Forecast basis — last year, average, minimum, median | QUEUED | Currently the last reported year, recorded as design choice D1. |
| Segment aggregation | BLOCKED | Needs segment data (section 1 or item 13/14). |
| Peer set | IN FLIGHT | Fifteen candidates returned and the user picks (item 16, LIVE). **Extend**: search and add any company, remove any, exclude a peer from the median while keeping it visible, and a reason per inclusion or exclusion — which is also the comparables justification sheet (section 9). |
| Terminal method and rate | QUEUED | Both methods already shown separately; which one drives the headline is currently our choice. |
| Share count — filed or rebuilt by the treasury method | QUEUED | |
| Promoter salary and related-party rent normalisation | QUEUED | Private companies. |

### The smaller ones

Each is a few lines of work and disproportionately useful.

| Judgement | Status |
|---|---|
| Which historical years to include — exclude a COVID year or a one-off peak from every average | QUEUED |
| Which year is the base for margins | QUEUED |
| How growth is measured — median, compound, last year, or typed | QUEUED |
| Per-line forecast method, so cost of sales can follow revenue while SG&A follows a growth rate | QUEUED |
| Editing a forecast cell directly, with the driver recomputed behind it | QUEUED |
| Forecast length — five, seven or ten years | QUEUED |
| Mid-year or year-end discounting | QUEUED |
| Beta — own, peer-derived, or typed | QUEUED |
| Exit on EV/EBITDA, EV/EBIT or P/E | QUEUED |
| Whether a control premium applies | QUEUED |
| A restated year read as restated or as originally filed | QUEUED |
| Trailing twelve months or last full year as the base period | QUEUED |

### What turns the list into a product

| Item | Status | Notes |
|---|---|---|
| **Named policies** | QUEUED | Save a set of judgements and apply it to any company. A firm sets its house view once and every analyst inherits it. This is the switching cost, and it arrives through the feature people most want. |
| **Decision trail** | QUEUED | Who chose what, when and why, exported with the workbook. The auditable model: not only figures traced to filings, but decisions traced to people. |
| **What others chose** | IDEA | Once enough people have classified the same line, show the distribution, anonymised. Grows with use; cannot be bought or prompted into existence. Needs a privacy position first. |
| **Corrections database** | QUEUED | Item 11a already captures corrections to extracted figures; nothing currently learns from them. Every correction says a tag was wrong for a company. After a thousand, a normalisation library nobody can replicate. Anonymised and aggregated, never republished per user. |

---

## 3. Engine and valuation methods

### Income approach

| Item | Status | Notes |
|---|---|---|
| DCF, operating companies | LIVE | |
| Residual income, banks and financials | LIVE | Parent's common-shareholder basis (`e277bf5`, `2d02f95`). |
| Reverse DCF | LIVE | Solves against the perpetuity value. **Surface it for retail** (section 7): "at today's price, buyers are assuming X% growth for ten years; it has managed Y%." |
| Refusal logic | LIVE | |
| Health score | LIVE | |
| Batch mode | LIVE | |
| Terminal values shown separately | LIVE | `933fc2c` |
| Systematic company sweep | LIVE | `verify/`, `48c95b6` |
| The rendered page checked against the engine | LIVE | `verify:dashboard`, `43b6fee`. Drives the real site in a real browser and compares every figure a reader acts on against what the engine returns in the same process, as formatted rather than as numbers. Covers the refusal path — a refused company must show its reason and no value anywhere, including the football field, the batch screen and the downloaded workbook — and now also the loading screen and the contrast of every element holding text. **This was carried as an IDEA in the previous version of this file and had already shipped.** Restored 28 September 2026. |
| Depreciation on the asset base | LIVE | `4cdec07` |
| Company-specific beta | QUEUED | Asset beta of 1.0 relevered; a real lookback is missing (L25). Becomes a judgement (section 2). |
| Monte Carlo simulation | IDEA | Thousands of runs, inputs drawn from ranges, a spread rather than one figure. Every range must come from the company's own filed history — never arbitrary assumptions, or it is false precision. Five years is a thin base, so show the width of the evidence beside the spread. Build after 9 + 12b. |
| Segment revenue | BLOCKED | Unblocked by the data layer or item 13/14. |

### Market approach

| Item | Status | Notes |
|---|---|---|
| Market approach as a stated method | LIVE | `ac400b6` |
| Choose the comparables (16) | LIVE | Extended by the peer judgement in section 2. |
| Market range on the football field | LIVE | |
| Precedent transactions | BLOCKED | Licensed data cannot be redistributed. |
| Hand-built precedent database | QUEUED | Open offer letters, exchange announcements, annual reports. Every row links to its filing. Unblocked by the data layer. |
| Written redistribution permission from a vendor | QUEUED | Ask before signing any seat licence. |

### Asset approach

| Item | Status | Notes |
|---|---|---|
| Book, tangible book and net current asset value | LIVE | |
| Liquidation value with user-set recovery rates | IN FLIGHT | |
| Method suitability stated on screen | LIVE | `b8e7615`. **Already built, found on checking 28 September 2026** — it predates this file. Property, plant and inventory as a share of total assets decides it at a 20% threshold, and the sentence states which case the company is in rather than leaving the reader to assume: for an asset-light one, that these figures "are correct and largely beside the point. They are shown as a floor, not as a valuation." |
| Three-approaches summary on the company screen | QUEUED | The football field already draws all three side by side. What does not exist is the summary block. |

### Committed backlog

| Item | Status | Notes |
|---|---|---|
| 11a — correct the extracted figures | LIVE | |
| Mark a corrected figure on the historicals table | QUEUED | The one gap left from 11a. |
| 12a — rule-based flags, no AI | QUEUED | Seven checks over data already fetched. States what the numbers do; never characterises them. |
| 9 + 12b — scenario comparison side by side | QUEUED | Runs on the corrected figures and the flags. |
| 13 + 14 — AI reads the filed documents | QUEUED | Related parties, contingent liabilities, litigation as disclosed, auditor qualifications, CARO remarks, segment revenue. Extraction with quote and page number only. Roughly ₹15–60 a company. **This is where n8n earns its place** (section 8). |
| 17.1 — debt capacity and covenant headroom | QUEUED | Shares machinery with the LBO module; building it first makes the LBO cheaper. |
| 10b — more qualitative factors | LIVE | Twenty-three questions, from ten. |
| 17.4 — industry research reports | QUEUED | Written, not computed. |
| 17.3 — FP&A, narrow version | QUEUED | Budget alongside actuals. |
| 11b — upload a financials file | BLOCKED | Needs paid hosting, a parsing budget and a written data policy. Partly superseded by the data layer. |

---

## 4. The workbook and exports

The Excel export is what a paying user is most likely to value. Nobody else supplies a ready-built, convention-formatted, live three-statement workbook for a listed company.

| Item | Status | Notes |
|---|---|---|
| Live working model | LIVE | |
| Ten sheets, statements and annexures linked live | LIVE | |
| Checks sheet | LIVE | |
| Sources sheet | LIVE | |
| Ratios sheet with data bars | LIVE | |
| Circularity switch | LIVE | Verified converging in real Excel. |
| Revolver as a proper roll-forward | LIVE | |
| **Assumptions sheet** | LIVE | Every assumption on one sheet, with the value used and the basis it was derived on, second in the tab order after the Cover. Each value is a live link to the cell it comes from rather than a copy, and each basis is read from the engine's own `provenance` and declarations rather than composed by the sheet — the `KI-4` rule applied to prose. It did force the engine to state a basis it had been leaving out, which was the point of building it: four provenance sentences named a measurement where a clamp or a fallback had quietly replaced it, and two assumptions had no basis at all (`KI-22`, written and retired in the same commit). Writing the buyback sentence established that a derived company's "authorised ceiling" is its own spend and its percentage exactly 1.0, correcting `METHODOLOGY.md` §10. Following each value to the cell it drives turned up `KI-20` and `KI-21`; renaming a field to match what it holds turned up `KI-23`. The two judgement-layer columns are headed and left empty. |
| **Standard chart of accounts** | QUEUED | A rigid schema so every company's line items sit at identical row positions. Sounds dull; is the most commercially valuable item here. A firm writes a macro once and runs it on every model we produce. Nothing a chatbot outputs is positionally stable, and a standard is hard to leave. Do this before the peer workbook and the template upload, which both depend on it. |
| **Cell-level deep linking** | QUEUED | A hyperlink inside each historical cell opening the filing it came from. The provenance exists; this exposes it in the file itself. |
| **Tamper highlighting** | QUEUED | Conditional formatting marking a cell where a formula has been overwritten with a typed number. The workbook enforcing its own integrity after it leaves us. |
| **Dynamic scenario manager** | QUEUED | A dropdown switching Base, Bull and Bear across every schedule. Pairs with 9 + 12b. |
| Named ranges and input validation | QUEUED | |
| Automated calendarisation | QUEUED | Align differing fiscal year ends to a common twelve months. Needed by the peer workbook. |
| Native Excel charts | BLOCKED | ExcelJS has no chart API. Data bars are the substitute; hand-written chart XML is the route if it matters. |
| Tearsheet, the one-pager | QUEUED | A print layout over figures already computed. |
| **Peer spreading workbook** | QUEUED | Target and up to ten peers on identical formula-driven tabs. Depends on the standard chart of accounts. |
| **Excel add-in** | IDEA | Professionals live in Excel, not in browser tabs. Refresh a model, pull a figure, set a judgement, from inside the sheet. This is how the terminals became habits rather than websites. |
| Excel round trip | IDEA | Take the model out, work on it, bring it back. |
| Batch export | IDEA | Twenty companies at once. |

---

## 5. LBO, private companies and professional modules

**No longer gated on the learning track.** Each is verified against its own internal arithmetic and cross-checked against published worked examples (see standing decisions).

| Item | Status | Notes |
|---|---|---|
| **LBO module** | QUEUED | Entry multiple, debt quantum and exit multiple in; five-year debt sweep, IRR and money multiple out. Reads the engine's forecast cash flows. The biggest single differentiator. **Verification**: sources equal uses; the debt schedule rolls; cash available ties to the cash flow statement; the exit bridge reconciles; IRR and money multiple agree with each other and with the cash flows. Every one holds in any correct LBO, whoever built it — a downloaded example failing them is wrong, not us. |
| LBO refusals | QUEUED | None for banks, NBFCs or insurers; none where cash flows cannot service the debt. Find the failure point by running it at 4x and 6x deliberately. |
| Label the LBO as a hypothetical take-private | QUEUED | On screen, or it becomes a claim the site cannot stand behind. |
| **Debt capacity and covenant headroom (17.1)** | QUEUED | Build before the LBO; shares its machinery. |
| Typed-input private company form | QUEUED | Owner types revenue, costs, working capital and debt. Runs in the browser; nothing uploaded, stored or transmitted, and the page can say so. |
| Same engine, same schema | QUEUED | If private companies need their own code path, the design is wrong. |
| **Private company comparables from registers** | IDEA | A PE firm looking at an unlisted target has no comparables, because nobody has structured private company filings. MCA in India, Companies House in the UK, ASIC in Australia — all public. Build it as a pattern rather than an India project. Listed comps are a commodity; unlisted comps are not. |
| Document upload for private companies | BLOCKED | Needs paid hosting, a retention and deletion policy, and a confirmation step showing extracted figures against the source page. |
| **Model auditor** | QUEUED | Upload any model — ours or anyone's — and get back: hardcoded values inside formula rows, formulas breaking their pattern across a row, circular references, broken links, whether the balance sheet ties and the cash flow reconciles, sign errors, references to the wrong column. Every associate has been burned by a model that looked fine. Our unfair advantage is the catalogue of failure modes earned finding nineteen of them in our own engine. Hard to copy for that reason. |
| 15 — reformat a user's model to convention | QUEUED | Formatting only, never a number. In the browser via exceljs, so the file never leaves their machine. |
| **Quarterly refresh** | IDEA | A saved model re-runs when new results are filed and says what moved. Turns a purchase into a subscription. |
| **Portfolio monitoring** | IDEA | Covenant headroom across ten companies, flagged before a breach. For PE. |
| **Diligence reader** | IDEA | A 200-page annual report in; related-party transactions, contingent liabilities and auditor remarks out, each with a page link. Overlaps 13 + 14. |
| Method-specific outputs | IDEA | Net asset value in the shape Rule 11UA expects; ESOP valuation; purchase price allocation; fairness opinion; impairment testing. Each is a document someone is paid to produce. Nihar to say which comes up most. |
| MD&A and risk-factor diff | IDEA | Red and green comparison of management discussion between two annual reports. Depends on holding both documents. |

---

## 6. The screener — competing with Yahoo and Screener

The data layer makes this possible; this section is what to do with it. International from the start, in the order of section 1.

| Item | Status | Notes |
|---|---|---|
| Reported filings displayed, every line traced | NEXT | Stage 2 of the data layer. **Click-to-source drawer**: the XBRL tag, the filing date, a link to the filing itself. Credibility no competitor offers. |
| **1-click data to model** | QUEUED | A button converting ten years of history into a live model. The handoff between the two halves of the product. |
| **Interactive EBITDA normalisation** | QUEUED | Toggle non-recurring items below the reported statement and watch adjusted EBITDA, margins and multiples recompute. The judgement layer applied to the screener. |
| **Segment and geographic tabs** | BLOCKED | Needs segment data. |
| Computed beta, with its window stated | QUEUED | From price history we hold, not bought. |
| Price and dividend history | QUEUED | |
| Screening across the universe | QUEUED | On figures we extracted, not licensed — so redistributable. |
| **Governance and risk badges** | QUEUED | Auditor qualifications and resignations, CARO remarks, contingent liabilities above a stated share of net worth, related-party transactions as a share of revenue over time. **In India these are the best early warnings available and no free source surfaces them.** Wording must state what the filing says, never characterise it. |
| Promoter pledging, and its change quarter on quarter | QUEUED | India. Among the most predictive disclosures there is. |
| Shareholding pattern changes | QUEUED | India. |
| Credit rating actions, bulk and block deals, board changes | IDEA | India. |
| Restatement history | IDEA | What a year said when first filed against what it says now. A by-product of holding filings, not a feature built for its own sake. |

---

## 7. Content, education and the naive investor

| Item | Status | Notes |
|---|---|---|
| Margin Notes, 19 notes and screen | LIVE | |
| Buffett lens callouts | LIVE | Thresholds deliberately excluded; the book credited. |
| Eight SEO explainer pages | LIVE | `/learn/`, static HTML at build time. |
| Did you know, on the loading screen | LIVE | 53 notes. |
| **Naive investor section** | QUEUED | For someone who invests on instinct and wants a better-informed one. **The trap is that "insights" becomes recommendations**, which breaks explain-mechanics-not-merit and moves toward SEBI's definition of a research report. The version that does not: explain the company's own history back to them, in plain language, every number traceable. Show where the money comes from by segment and geography; who else has a claim on it before shareholders; **what the market is currently assuming**, from the reverse DCF, against what the company has actually managed; three sliders for growth, margin and discount rate with "move these until you believe them"; how steady the business has been over ten years; and what the accounts do not tell you, from `DATA_CONSTRAINTS.md` in plain English. **Build after the data layer** — pointing it at vendor data for Indian companies means showing wrong numbers to the people least able to spot them. |
| Landing page rewrite | QUEUED | Less theory; a clearer statement of what the site does. |
| Explainer video | QUEUED | Record once, when nothing significant is left to add. Screen capture of the real product, with cursor-tracking zoom added in post. |
| Animated advertisement | IDEA | |
| Damodaran resources | IDEA | Check what is freely usable and under what terms. |
| MCQ platform | IDEA | A separate product. |

---

## 8. Distribution, site, workflow and housekeeping

| Item | Status | Notes |
|---|---|---|
| **Chrome extension** | IDEA | A sidebar on a financial site showing our reverse DCF, valuation range and a one-click model download; a peer matrix built from companies selected while browsing; a red-flag marker on the scrollbar of an open annual report PDF. **Two cautions before building**: injecting into third-party sites is a terms-of-service question worth settling first, and an overlay breaks whenever those sites change their markup. The PDF highlighter has neither problem — it works on a file the user opened — and is the part worth building first. |
| Security: validation, headers, CSP, CORS, cache | LIVE | |
| Favicon, link preview, typography, brand assets | LIVE | |
| How this was calculated, as a plain-English explainer | LIVE | |
| Qualitative questions before the model is built | LIVE | Twenty-three of them. |
| Red square in one component | LIVE | `src/design/Mark.tsx`; verify fails if the margin changes. |
| Contrast fix and shared tokens | LIVE | `src/design/tokens.ts`; every token measured against every ground. |
| Privacy and terms footnotes | LIVE | |
| `CLAUDE.md` house-rules file | QUEUED | The standing decisions, Inter and Playfair, costs-are-negative, verify-by-recalculating. The palette and the square no longer need writing down — the suite enforces them. |
| README verdict badge | QUEUED | A public claim that isn't true. |
| Commit the lockfile | QUEUED | `package.json` is tracked and was last committed in `239ccae`. Only `package-lock.json` is still untracked. |
| Development in Cursor with Claude Code | LIVE | Planning and judgement in chat; code in Claude Code, one session per job; content jobs in other accounts. |
| **n8n** | QUEUED | Build it as part of item 13 + 14, not before. It earns its place for work that is long-running, scheduled or calls paid APIs: AI document extraction, quarterly refresh, batch exports. **Not** for routing business logic — refusals and method selection belong in the engine, inside the verification harness. |
| Antigravity for design | IDEA | Proposed split: Claude Code owns the engine and workbook; Antigravity takes screens. Nothing touching the engine or export ships without the suite and every Checks row at zero, whichever tool builds it. |
| One commit per job | LIVE | |

---

## 9. Making it a paid product

The wedge: nobody supplies a ready-built, convention-formatted, live three-statement workbook for a listed company — and nobody at all exposes the judgements behind it. The buyer is the independent valuer, the CA firm and the boutique advisory shop, who need a model that survives scrutiny and currently rebuild one each time. What they buy is defensibility and time, not the number.

| Item | Status | Notes |
|---|---|---|
| Sources and Checks sheets | LIVE | The two sheets that make the workbook defensible. |
| Standardised reported statements download | NEXT | Stage 2 of the data layer. |
| Reclassification layer | NEXT | Section 2. |
| **House template upload** | QUEUED | A firm uploads its Excel layout once; every export arrives in its format. Depends on stage 2 and the standard chart of accounts. Strongest retention feature on the list. |
| Model versioning and freeze | QUEUED | **Half of it is built** (`37c899e`): a set of drivers can be saved under a name with a note, dated, carrying the value per share at the time, and the whole set exports to a file and imports again — in the browser, per device, which is stated on screen. What is missing is the freeze. It stores the drivers, not the filings they ran on, so reopening it after a refresh will not reproduce the number. That missing half is what would make it an audit file, and it is why this stays QUEUED. |
| Comparables justification sheet | QUEUED | Why each peer was included and each rejected — produced by the peer judgement in section 2 rather than built separately. |
| Draft valuation report in Word | IDEA | The deliverable they are paid for, figures traced to workbook cells. |
| Refresh on new results | IDEA | Turns a purchase into a subscription. |
| Invert the product | IDEA | If the workbook is what people pay for, the site is where a model is configured and checked. Changes what the landing page says. |
| Watch two numbers, not visitors | IDEA | How many people correct a figure; how many open a second company. |
| **SEBI research analyst question** | QUEUED | The definition of a research report covers an opinion as to the value of a security, and the site prints a target price. One question for someone qualified **before any money is taken**. |
| Cost of being paid | IDEA | Uptime, support, refunds, invoices, GST. Price high to few rather than low to many. |
| Paid domain and data provider | IDEA | The data layer may make a paid provider unnecessary for filed figures; prices and market data still need a source. |

---

## 10. The learning track

**No longer a gate on anything.** Retained because it makes the work better, not because the build waits for it. CFA Level II moves this section; it does not move the roadmap.

| Item | Status |
|---|---|
| Comparable companies and precedent transactions | QUEUED |
| LBO | QUEUED |
| Quality of earnings | QUEUED |
| Private company modelling | QUEUED |
| Deal structuring | QUEUED |

---

## 11. Raised, not yet scoped

| Item | Status | Notes |
|---|---|---|
| Risk and debt syndication | IDEA | |
| Industry research as a product | IDEA | Overlaps 17.4. One thing or two? |
| Find comparables as a standalone tool | IDEA | |
| Reading about new startups outside India | IDEA | Input, not a feature. |

---

## 12. Decided against

| Item | Reason |
|---|---|
| Point-in-time filings archive | A figure is restated because the first one was wrong. Modelling from superseded numbers is modelling from a known error. Restatement history survives as a by-product, not a feature. Dropped 28 September 2026. |
| Branding the output ("prepared using Marginalia") | A customer who must advertise the tool could have used the tool themselves. It devalues the deliverable. Dropped 28 September 2026. |
| Take-private screening filter | Needs a full universe of fundamentals we will not have until the data layer is complete. Revisit then. |
| Scraping court records for litigation | Replaced by what the company disclosed in its own filings. |
| Averaging the three approaches, or the two terminal values | They answer different questions. Side by side, always. |
| Licensed precedent data displayed on the site | Unless a written derived-data permission exists. |
| Hand-built company models on the site | Models are engine-built only. |
| Flooring WACC | A floor is a number chosen to hide a problem. Relevering beta fixed the cause (`5ecd822`). |
| Treating a missing filed figure as zero | Zero is a claim the company reported zero. Show "not reported" or refuse. |
| Gating the build on Nihar having learned the module first | Retired 28 September 2026. The verification standard replaces it (see standing decisions). |

---

## Shipped log

Most recent first. Defect detail and measurements are in the commit messages and in the history of `KNOWN_ISSUES.md`.

**Read this log as incomplete by history, not as authoritative.** Every hash in
this file was checked against `git log` on 28 September 2026. All of them
resolve and all of them describe the right commit — but **thirteen shipped
commits had never been entered at all**, and are added below. Two of them sat
behind lines in section 4 that already said LIVE: the circularity switch and the
Ratios, Checks and Sources sheets. Others were whole defects closed — the
browser check against the engine, the filed cash flow statement, the SEC
empty-answer fix, the workbook reading its own drivers.

Eleven of the thirteen were missing before this rewrite too, so the gap is older
than the file. And the log does not reach back past the roadmap: work shipped
before 21 September 2026, when this file was created, is only partly here.
"Method suitability stated on screen" was found that way — built on 9 September,
still marked QUEUED nineteen days later. **Assume anything not below may still
have shipped, and check the repository before trusting a status.**

The rule that closes this is the first maintenance rule at the top of the file:
an item ships with its hash, in the same commit as the work.

| Commit | What |
|---|---|
| `aca809e` | The workbook's cost of capital and growth fade computed rather than pasted: `KI-20` and `KI-21` fixed, the cash cushion fixed with them, the DCF sheet's row numbers moved into one map, and `KI-24` opened for the cost of debt. |
| `PENDING3` | The workbook's cost of debt averaged off its own debt schedule rather than pasted: `KI-24` fixed, and the absent-rate case measured rather than assumed. |
| `fac1d4d` | The Assumptions sheet: every assumption, its value linked live to the cell it comes from, and the basis the engine recorded for it. Four provenance sentences corrected where a clamp had replaced the measurement they named, two written where none existed (`KI-22`, opened and retired here), `METHODOLOGY.md` §10 corrected on what the buyback machinery does for a derived company, and `sbcPercentOfOpex` renamed to what it holds. `KI-20`, `KI-21` and `KI-23` opened. |
| `3332cf7` | Shared design tokens; contrast fixed on both grounds; the red square in one component. |
| `239ccae` | Eight explainer pages at `/learn/` as static HTML. |
| `fe2256e` | Fifty-three did-you-know notes on the loading screen. |
| `de3fcd3` | Twenty-three qualitative factors, from ten; a driver-layer fault fixed with them. |
| `012228c` | Payload cache keyed to the fetcher that built it. |
| `71d401c` | Version drift check; KI-11 established as something the filings cannot settle. |
| `4745e58` | Terminal reliance explained where it is flagged; `KNOWN_ISSUES.md` reached empty. |
| `b2b39eb` | Exit multiple and share-count tolerance grounded; two rates moved to constraints. |
| `71892a1`, `6038f11` | Risk-free rate from each currency's own government, a year's average to the balance sheet date. |
| `a061abc` | Cash cushion set at the least a company has actually run on, from its own filed history. |
| `b8d4da0` | An empty answer from the SEC read as an answer, so a filer its XBRL holds no facts for loads instead of failing. |
| `684a99f` | Reported cash flow statement taken from the filing rather than rebuilt from net income and balance sheet movements. |
| `43b6fee` | The rendered page checked against the engine, in a real browser. |
| `dbd6caa` | A figure the filing never reported kept out of the arithmetic, rather than carried into it as a number. |
| `c60cb3a` | The workbook reads its drivers from the engine instead of asserting rules of its own. |
| `6bd1c88` | Each company valued at the date of its own balance sheet, discounted mid-year. |
| `35114b3` | The tax rate given the base it was actually measured on. |
| `ebe5884` | How much of a valuation is the part nobody modelled, measured and shown on every valuation. |
| `6e70dca` | A company whose revenue fell while its plant rose refused rather than valued. |
| `f25a9c4` | Six bounds on capital spending measured, and all six rejected on the evidence. |
| `5a2b858` | Growth fades to the terminal rate from a median start; forecast years run from the company's own year end. |
| `ce0805f` | `METHODOLOGY.md`: what the engine does, line by line. |
| `7b5f7d8` | `DATA_CONSTRAINTS.md`; `KNOWN_ISSUES.md` reduced to our own mistakes. |
| `e52cdc6` | Capex split into replacement and growth; permanent IDs for defects. |
| `4cdec07` | Depreciation charged on the assets in service. |
| `48c95b6` | The verification harness committed to `verify/`. |
| `15232f9` | `ROADMAP.md` added. |
| `52e062a` | Workbook and site agree exactly on value per share. |
| `933fc2c` | Terminal values no longer averaged. |
| `5ecd822` | Each company's own cost of debt; beta relevered on its capital structure. |
| `e1e6cfc` | Borrowings, current maturities and finance leases counted as debt. |
| `7240d06` | WACC weights on gross debt and market equity. |
| `b7432d6` | Short-term securities netted off debt. |
| `ac400b6` | EBITDA excludes stock compensation, matching the peers. |
| `2d02f95`, `e277bf5` | Residual income on the parent's common-shareholder basis. |
| `80b27f2` | Equity bridge deducts minority interests and preferred stock. |
| `8b309d0` | Depreciation rate from filed depreciation; fabricated first year removed. |
| `ea2f020` | Filed SG&A shown as SG&A; "not reported" instead of zero. |
| `42919ee` | Reporting currency confirmed from the filing; unknown ADR ratios refused. |
| `03617c2` | Reported net income ties to the filing. |
| `13de608` | Amortisation runs off against the reported pool. |
| `1bd507b`, `e608fdd` | No valuation on a balance sheet that does not balance. |
| `7d73857`, `1f8b8f1` | Depreciation and stock compensation charged as their own lines; capex sign corrected. |
| `58f6fb4`, `7633302` | PIK interest charged; revolver as a proper roll-forward. |
| `f746e7f`, `41bc482` | Statement sheets and annexures; first-year formula fixes. |
| `2f3cd4e` | Accidental circularity fixed, and a circularity switch the user controls. |
| `f4b7197` | Ratios, Checks and Sources sheets added to the Excel export. |
| `2ce16ff`, `113f8e3`, `f1d9339` | The red square; the conventions files; `KNOWN_ISSUES.md` created. |
