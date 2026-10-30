# Marginalia — Roadmap

The forward plan for Marginalia: what is built, what is next, what is waiting and why, and what was decided against. Statuses current as of 28 September 2026.

**This file is the plan. It is not the defect list.** Things that are wrong with what already exists live in `KNOWN_ISSUES.md`. How the engine actually works lives in `METHODOLOGY.md`. Modelling standards live in `CONVENTIONS.md`, and how the code measures against them in `CONVENTIONS_AUDIT.md`. What the sources do not publish lives in `DATA_CONSTRAINTS.md`. The house rules every session reads first are in `CLAUDE.md`. Read those alongside this one.

**The product plan behind this file is `docs/VISION.md` and `docs/FEATURES.md`** (converted 17 October 2026 from the Word originals kept in `docs/plan/`). VISION is what Marginalia is, who it serves, the platform structure and every planned item with its status. FEATURES is every feature of the 27 studied tools plus FRED and Yahoo Finance, how Marginalia provides each, and the 30 combined features no single tool offers. **Where this file and those two disagree, those two are the plan and this file is behind** — say so rather than reconciling them quietly.

## How to maintain this file

- When an item ships, change its status to LIVE and move it to the Shipped log at the bottom, with the commit hash.
- When a new idea is raised, add it as IDEA in the right section. It stays IDEA until Nihar decides to build it.
- Never delete an item silently. Something not being built goes to "Decided against" with the reason.
- If a planned item turns out to be already built, mark it LIVE and say so — several were found this way.
- Keep `KNOWN_ISSUES.md` and this file separate. A defect found while building a roadmap item goes there, not here.

## Status words

**The plan's words, from `docs/VISION.md`.** Sections 13 onward use these, and
new entries anywhere should. The older sections keep the words they were written
with; the mapping is below rather than a rewrite, because rewriting a hundred
existing lines would lose the dates and hashes attached to them.

| Status | Meaning |
|---|---|
| Built | Live on the site and verified. |
| In flight | Part-built. |
| Now | Next six months. |
| Next | Six to twelve months. |
| Later | Waits on another piece being built first. |
| Paid · last | Needs money — licensed data or paid services. Built and tested on a small or free sample now; the paid part bought just before public launch. |
| Idea | Raised, not yet decided. |
| Dropped | Decided against, with the reason. |

**Nothing waits on SEBI.** A regulated feature — ratings, target prices,
recommendations, research carrying an opinion — is built now with the
regulations designed in, and switched on at launch once the licence is in hand.
There is no "blocked on SEBI" status because there is no such item.

| Older word, used in sections 1–12 | The plan's word |
|---|---|
| LIVE | Built |
| IN FLIGHT | In flight |
| NEXT | Now |
| QUEUED | Next, or Later where it names what it waits on |
| BLOCKED | Later, with the thing it waits on named |
| IDEA | Idea |
| DROPPED | Dropped |

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

## Launch principles

Decided 12 October 2026. These govern the order of work, not its content, and
they are the reason several items below read "built now, switched on later".

1. **Nothing waits on SEBI.** Every feature is built now on the private site,
   including ratings, recommendations and research that carries an opinion, with
   the regulations designed in from the start. Building it later would mean
   designing the disclosure, the track record and the audit trail later, which
   is how they get bolted on badly.
1. **The site goes public only after the licences are received.** Private until
   then. A regulated feature is built and left switched off; the switch is the
   licence, not the code.
1. **Paid items are built last**, just before launch: licensed global prices,
   live options data, analyst estimates, WhatsApp message delivery, document
   storage for uploads, AI document reading at full scale, MCA document fees at
   scale. Each is built and tested on a small or free sample first, so the money
   buys coverage rather than discovery.
1. **Not wanted at all**: scraped contact databases, and placing trades. See
   section 12.
1. **Outreach to users starts once the product is fully developed.** Not before.

---

## Now and next

1. **`KNOWN_ISSUES.md` holds two screen faults and nothing that moves a valuation.** `KI-27` — a saved model storing its sliders and not the judgements it was built on — was opened 10 October 2026 and closed 12 October 2026. `KI-25` and `KI-26` remain, both faults on the screen rather than in a number. The list reaching zero is the work, not the milestone, and the history of this item is the reason: it stood empty from 2026-09-27, and building the Assumptions sheet on 2026-09-28 opened five and closed all five the same day: assumptions with no recorded basis (`KI-22`), the operating margin slider under-moving (`KI-23`), the discount rate and growth fade the workbook held still where the engine recomputes them (`KI-20`, `KI-21`), and the cost of debt found by sweeping for the same pattern (`KI-24`). All five are the `KI-4` shape — a workbook seeded from the engine's answer, right at rest and wrong on the first edit. Nineteen numbered defects were opened between 22 and 27 September: fourteen fixed, three established as things the filings cannot settle, one needing disclosure. The list staying empty is the work, not the milestone, and a sheet whose job is to write down what every number rests on is the kind of work that refills it.
2. **NEXT — Primary-filings data layer** (section 1). The largest piece of work and the foundation for almost everything below.
3. **IN FLIGHT — The judgement layer** (section 2). Expense classification shipped 10 October 2026 and built the layer's machinery with it; the adjusted EBITDA bridge shipped 11 October 2026 and is the artefact it produces. The one to take next is **what counts as non-recurring, item by item** — an exclusion today is set aside in every reported year, which is the right unit for a line a company should not have and the wrong one for a settlement it paid once, and the bridge says so on its own face.
4. **LIVE — Standard chart of accounts** (section 4, `4a61ac2`, 10 October 2026). It was the cheap item several later ones depended on, and three of them have since been built on it: peer spreading, the house template and the EBITDA bridge.
5. **Built — `CLAUDE.md` house-rules file** (section 8, 17 October 2026). The house rules every session reads first: one job per session, the three-document split, the standing decisions, the traps, the launch principles, and the first design principle.
6. **Now — the new product plan** (`docs/VISION.md`, `docs/FEATURES.md`, brought into the repository 17 October 2026). Sections 13–18 are the new areas: global company pages and the screener, research, the investor area, the deals site, the add-in and API, macro.
7. **Next — the four decisions of 17 October 2026** (section 19): one system as an open planning item, the figures screen redesigned around model heads, the loading screen rebuilt on the company's own numbers, and the first design principle. Two of them reverse things that are Built, which section 19 says plainly.

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

**Built, monthly, from two publishers** (`23b472b`, and the OECD made primary on 2026-10-25). The item said
BLOCKED and it is no longer true: every INR company is valued. The rate is the OECD’s Main Economic
Indicators long-term interest rate for India — monthly, CC BY 4.0 since 1 July 2024 — read from the
OECD’s own API, with FRED’s republication of the identical series kept behind it. Both carry 178 months
from 2011-12, 175 of them identical to the last digit, so whichever answers gives the same rate.

**What is still open, and it is smaller than it was.** The rate is *monthly*, not daily: the cost of that is
measured in `DATA_CONSTRAINTS.md` (monthly sampling itself moves a one-year mean by 0.1–0.3bp on the two
currencies where both series exist; the real unknown is whether the OECD’s Indian series is constructed
like FBIL’s, and there is no reachable Indian daily series to measure that against). The published
benchmark is FBIL’s 10-year G-Sec par yield and showing it on a website needs a **paid licence — Paid ·
last**. RBI republishes the latest observation with no history; CCIL’s terms forbid automated collection;
NSE publishes a total-return index rather than a yield. A daily Indian series is what would close it.

### Constraints

- Each jurisdiction is its own integration with its own taxonomy. Ind AS, IFRS and US GAAP tag the same item differently; each mapping is built and verified separately. **Outsourceable**: the tag-mapping research needs no repository access.
- Confirm terms of use permit redistribution before stage 2 goes public.
- Every rule in `CONVENTIONS.md` and every refusal applies unchanged. A new source is not a reason to relax one.

---

## 2. The judgement layer

**Status: IN FLIGHT.** Raised 28 September 2026. The centre of the product.
Expense classification, the first structural judgement, is LIVE (`9980f72`,
10 October 2026) and the layer's four rules are built with it: a default that
says where it came from, an optional one-line reason, a visible return to the
default, and an immediate rebuild with the previous value still beside it. Each
judgement below inherits that machinery rather than rebuilding it.

The **adjusted EBITDA bridge** is LIVE with it (11 October 2026): the artefact
the layer produces, naming what the reader has built out of a correction and an
exclusion, on the screen and as its own sheet in the workbook. It is the first
place the layer stops being a set of controls and becomes something a firm
sends to a client.

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
| Expense classification — direct, indirect, selling and distribution, administrative, excluded | **LIVE** | The example that started this. On the figures screen, between reported and modelled. Four lines classifiable, typically three per company; the default for each states where it came from, and the engine's treatment stays beside the user's. Moving a line between the four operating categories moves no figure (nil drift, measured); excluding one is the choice with arithmetic in it (Reliance 706.52 → 1,683.09). Reported operating profit ties to the filing under every classification. Carried into the workbook's two reserved Assumptions columns. `METHODOLOGY.md` §22d. |
| What counts as non-recurring | QUEUED | Currently a median rule, plus a whole-line exclusion from expense classification. Still needs the per-item, per-year choice: a line excluded today is excluded in every reported year, which suits a cost the business no longer carries and not a settlement paid once. |
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
| **Adjusted EBITDA bridge** | **LIVE** | Reported EBITDA from the filing, every correction and every exclusion as its own line with the reader's reason, adjusted EBITDA at the foot, per reported year. Three live ties, its own workbook sheet. The artefact a valuer, a lender or a buyer actually receives. `METHODOLOGY.md` §22e. |
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
| **Quarterly refresh** | IDEA | A saved model re-runs when new results are filed and says what moved. Turns a purchase into a subscription. **Now buildable**: a saved model carries every judgement, so re-running one against fresh filings is the restore path with a new payload, and the saved list already prints what an entry was saved at beside what it reopens at when the filings behind it have changed (`METHODOLOGY.md` §22f). |
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
| ~~Point-in-time filings archive~~ **— reversed 12 October 2026** | Dropped 28 September 2026 on the reasoning that a figure is restated because the first one was wrong, so modelling from superseded numbers is modelling from a known error. **The new plan reverses it** (`docs/VISION.md` §5b, `docs/FEATURES.md` Part D): as-first-reported against restated, with a restatement tracker, is in section 13 as Next. The reversal does not contradict the original reasoning — the model is still built on the current figures — it adds the earlier version as a FACT ABOUT THE COMPANY: a company that quietly revises its history is worth knowing about. Kept here rather than deleted, because the 28 September reasoning is still the reason the model does not forecast from superseded numbers. |
| Branding the output ("prepared using Marginalia") | A customer who must advertise the tool could have used the tool themselves. It devalues the deliverable. Dropped 28 September 2026. |
| Take-private screening filter | Needs a full universe of fundamentals we will not have until the data layer is complete. Revisit then. |
| Scraping court records for litigation | Replaced by what the company disclosed in its own filings. |
| Averaging the three approaches, or the two terminal values | They answer different questions. Side by side, always. |
| Licensed precedent data displayed on the site | Unless a written derived-data permission exists. |
| Hand-built company models on the site | Models are engine-built only. |
| Flooring WACC | A floor is a number chosen to hide a problem. Relevering beta fixed the cause (`5ecd822`). |
| Treating a missing filed figure as zero | Zero is a claim the company reported zero. Show "not reported" or refuse. |
| Gating the build on Nihar having learned the module first | Retired 28 September 2026, and again as "learn it by hand in Excel first" on 11 October 2026. The verification standard replaces it (see standing decisions): verified against the identities a correct model must satisfy, then against published worked examples. |
| Scraped or bought contact databases | Illegal or high-risk under data protection law — Lusha was fined €2 million in Italy in 2026 — and controversial with the investment banking and private equity professionals who would be in them. Replaced by an opted-in verified buyer network. Dropped 12 October 2026. |
| Copying another database (Venture Intelligence, Tracxn) | Build from primary sources only: filings and official registers, each item linked to its own document. A database copied from a database inherits its errors and its licence. Dropped 12 October 2026. |
| Placing trades, or any order execution | Marginalia is not a broker and does not want to be. Every tool that would need it — TradingView's broker integration, Composer's automated execution, paper trading with real accounts — is deliberately not followed. Dropped 12 October 2026. |
| A floor on forecast capital spending | Built, measured and rejected. A floor is a number chosen to hide a problem; the same reasoning as flooring WACC. |
| Exit multiple taken from peer medians | Built, measured and rejected. |
| "No student-built tool has this" as marketing copy | Cannot be verified, so it cannot be said. Dropped 12 October 2026. |
| Third-party ESG and governance risk scores | Shown by Yahoo and Simply Wall St; a score is somebody else's opinion wearing a number's clothes. Replaced by the company's own ESG filings — BRSR in India, ESEF and CSRD in Europe. |
| PowerPoint deck-building tools (agendas, pagination, shapes) | Macabacus does this well and it is not core. Partner instead. |
| Unchecked AI scores or opinions | DeepFundamental's paid AI scores showed NVIDIA's text on Apple's page. AI is used only where its output can be checked against a source. |

---

## 13. Global company pages and the screener

**Status: Now.** From `docs/VISION.md` §5b and `docs/FEATURES.md` Part A. This
supersedes section 6, which was written when the screener was India-only;
section 6 is kept because its entries carry their own history, and where the two
differ this section is the plan.

**The correction that matters:** the screener and the company pages cover
**every listed company in the world**, not only India. A user types a company
name and gets everything Yahoo Finance shows, plus what Yahoo does not — actual
reported financials with a link to the filing, a beta and cost of capital whose
method is shown, the country's macro picture, and an editable model.

| Item | Status | What it is |
|---|---|---|
| **The company page as the hub** | **In flight** | **Built on 2026-10-22**: one web address per company and per tab — `/company/RELIANCE.NS/overview` — with all nine tabs in `src/data/companyRoute.ts`, which the page, the router and the browser check all read rather than keeping their own lists. **Overview and Model are built**; the other seven show one line naming what they will carry and nothing that could be mistaken for data. A deep link renders the company rather than the landing page, an unknown tab lands on the Overview, and `vercel.json` rewrites `/company/*` so a shared link works off a cold load. **Searching a ticker lands here** rather than inside the figures editor (2026-10-24); the figures stay one click away on the Model tab, and the payload the search fetched travels with it so the hub does not fetch again. |
| **Quote strip and key statistics** | **Now** | Price, ranges, volume, market cap, enterprise value, the multiples with their quarterly history, margins, returns, per-share figures, growth, leverage, averages, float, holdings, dividends, splits and bonuses. |
| **Chart** | **Now** | 1D to All, line or candles, compared with index or peers, annotated with filings and events, moving averages, total return including dividends. |
| **Risk and cost-of-capital card** | **Built** | **Built on 2026-10-29** on the Overview tab of every company page. Beta calculated here against a broad index for the market the share trades on, with the recipe, the window, the frequency and all five diagnostics shown; the risk-free rate, the mature-market equity risk premium and the country risk premium, each with its publisher and its date; the cost of equity, the cost of debt, the tax rate, the weights and the WACC. Every input editable, and every edit run back through the engine with the value per share beside it. **The two defaults were decided on 2026-10-30** (rule 9 forbids changing them silently): the model keeps its asset beta of 1.0, because switching to the measured slope moves the value per share by a median 2% and by as much as 515% where the fit explains almost nothing, and the measured figure is offered per company with a warning where the fit is too loose to carry it; the **country risk premium is now added by default**, by country of incorporation until revenue-by-country data exists, which costs the 50 companies that carry one a median 4.1% of value. **What is not here and says so**: there is no peer-average alternative, because a derived company carries no comparable set; and the cost of debt is the historical effective rate rather than a spread over a rating (`KI-29`). |
| **Financials, ten-plus years, every number clickable to its filing** | **Now** | Annual and quarterly, as reported and standardised, TTM, units and currency switch, Sankey and waterfall. Reported, corrected and modelled side by side. |
| **Click any number to see its filing** | **Now** | Source image or page on hover. |
| **Profile, holders, news and filings timeline** | **Now** | Description, sector, employees, fiscal year end, executives and their pay, board, auditors; major holders, insiders, institutions; one timeline of announcements, results, transcripts and filings. |
| **Compare up to ten companies** | **Now** | Any metric, side by side. Ten rather than Yahoo's four. |
| **Data status panel** | **In flight** | **"Where this came from" is built** on the Overview tab: the price and ranges, the statements, the profile and the price history each name their source and the date they are as at. Which automated checks each piece passed is not shown yet. |
| **Screener, worldwide** | **Next** | Every factual filter Finviz offers — exchange, index, sector, industry, country, size, valuation, growth, dividends, returns, margins, liquidity, leverage, ownership and insider activity, short float, earnings date, performance, volatility, beta — with AND/OR logic, a pivot view, rank-within-screen, saved screens and alerts. No filter that carries an opinion. |
| **Company FAQ pages** | **Now** | "What is Reliance's debt?" answered on the page with its source. Brings search traffic. |
| **Seasonality, returns against industry and market** | **Next** | Average returns by month; how the stock compares. |
| **Point-in-time: as first reported against restated** | **Next** | Each figure as originally reported and as later restated, with a restatement tracker — FRED's ALFRED applied to filings. **This reverses the 28 September 2026 decision in section 12**; see the note there. |
| **ESG from the company's own filings** | **Later** | BRSR in India, ESEF and CSRD in Europe. Never a third-party score. |
| **Global prices with display rights** | **Paid · last** | Built and tested on free development data; licensed end-of-day prices bought before launch, delayed intraday after. |
| **Analyst estimates and consensus** | **Paid · last** | Licensed before launch. The screens that compare estimate, guidance and the user's own assumption are built now. |
| **Options chain and implied volatility** | **Paid · last** | End-of-day first from NSE files; live data needs a display licence from an authorised vendor. |

**Where the data comes from, by country** (FEATURES Part A): United States — SEC
XBRL, free, already used. India — NSE and BSE XBRL, MCA for private companies.
European Union and UK — ESEF filings via filings.xbrl.org, Companies House for
UK accounts. Japan — EDINET, free API. South Korea — OpenDART, free API. Then
Canada (SEDAR+), Brazil (CVM), China (CNINFO), Taiwan (MOPS), Australia (ASX).
Risk-free rates and macro from FRED, central banks, IMF and the World Bank.
Equity and country risk premiums from Damodaran's free annual publication, cited
and dated, user-overridable.

**Every page says which stage its country is at.** Full global coverage is a
multi-stage build and prices are a real cost; the order follows the data.

### 13a. What every company page must carry

**Status: the list is agreed; the items carry their own statuses.** Recorded
2026-10-20. Section 13 above says what the company page *is* — one address per
company, a tab per section. This is the contents: the information a page must
provide before it is finished.

**The bar is Screener.in, matched or exceeded**, because that is the tool an
Indian user already has and the one they will compare against. Every status
below was read out of the code rather than remembered, and the sources are named
so the next session can check them rather than trust them.

**Stage 1 shipped on 2026-10-22**: the hub, its addresses, and the Overview tab
with the summary figures, the price chart and its five overlays, the about
block and the freshness line. The statuses below are as at that commit.

**Where this page already exceeds Screener**, and these are not in the list
because they are not Screener features: an editable model with every judgement
visible and its default stated, provenance per line, a cost of capital whose
method and window are shown, the adjusted EBITDA bridge, the model heads, the
four visible states, and a workbook with live formulas rather than pasted
values.

| What the page must provide | Status | Where it stands today |
|---|---|---|
| **Summary ratios** at the top of the page | **Built** | **Twelve figures on the Overview tab** (`src/data/companyOverview.ts`): price, change on the day, market capitalisation, the 52-week high and low, P/E, book value per share, P/B, dividend yield, ROCE, ROE, and face value. Each carries a ⓘ with its formula, the filing it was taken from and its source. **Every ratio comes from one filing** — the newest year reporting both halves of it — so no figure is divided by another year’s share count. Face value is a dash with the reason: neither source publishes one, and the SEC’s par value is a different figure. The nine ratios in `src/data/ratios.js` are still the set behind the Ratios tab of the model. |
| — **user-added ratios** | **Now** | Not built. `RATIO_DEFINITIONS` is a fixed list; nothing lets a reader add one. The definition shape already carries a formula string, so a user-defined ratio has somewhere to live. |
| — **alerts on a ratio** | **Next** | Not built. Needs an account and a scheduled job, neither of which exists; the same scheduler the data layer needs (`docs/DATA_LAYER_PLAN.md` §6.2). |
| **Price chart** | **Built** | **The series is kept** from `payloadVersion.ts` v5: ten years of daily closes and a monthly series back to the listing’s start, as the exchange quoted them. Ranges 1M, 6M, 1Y, 3Y, 5Y, 10Y and Max, measured back from the last close rather than from the clock. Drawn as plain SVG in `src/components/priceChart.tsx`. The prices are Yahoo’s and are **development-only** until a licensed feed is bought (`DATA_CONSTRAINTS.md`). |
| **Ratio charts over time** — P/E, EV/EBITDA, P/B, market cap to sales | **Built** | All four, as overlays on the price chart, **computed from this company’s own filings** and never fetched (`src/data/priceSeries.ts`). Each point divides by the filing that was the latest one on that day and says which, so the line steps at a year end rather than sliding; a day before the earliest filing held draws no point at all, and a loss year draws no P/E. `npm run verify` checks thirteen of these against figures worked out by hand. |
| **Sales and margin chart** | **Built** | The fifth overlay: revenue and operating margin, one point per filed year at that year’s end, each on its own scale, not interpolated between them. |
| **About the company** | **Built** | Description, sector, industry, head count and named officers, from the profile fetch in `api/company.js` `fetchProfile`. |
| **Key points** | **In flight** | The qualitative screen carries factors and a revenue CAGR line (`src/components/qualitativeIntro.tsx`); there is no curated key-points block. |
| **Pros and cons, factual only** | **In flight** | The qualitative factors are built, and **standing decision 6 binds this item**: explain mechanics, not merit. A fact plus a definition is allowed; "a strong balance sheet" is an opinion on a security and is not. Screener's own pros and cons mix the two, so this is a place to diverge deliberately rather than match. |
| **Peers** | **In flight** | Peer gathering and a ten-company spread to a workbook are built (`src/data/peerSpreading.ts`, `MAX_PEERS = 10`, `api/comps.js`). There is no peers table on the page itself. |
| — **sector path** (sector → industry → sub-industry) | **Now** | Not built as a path. The two levels that exist — sector and industry — are now shown on the Overview tab; the hierarchy between them is not. |
| — **index membership** | **Now** | Not built. No index constituent list is held. |
| — **editable columns** on the peer table | **Next** | Not built; waits on the peers table existing. |
| **Quarterly results** | **Built** | **1577 quarters and 291 half-years across 176 companies** (2026-10-26). For an SEC filer they come from the 10-Q and 10-K facts, with Q4 worked out as the year less the nine months and every cash flow quarter as this year to date less the last — each one labelled derived and carrying **both** filings. For a vendor payload it is whatever the feed gives, which is about five quarters of income and less of anything else. Up to thirteen are shown, as Screener does. The controls appear only where the periods exist, and a company that files quarterly income but not a quarterly balance sheet is told which of the two it is. The old note, kept because it is still true of the depth: the fetcher reads annual periods only — `extractUSFact` takes annual facts, and `YEARS_WANTED = 5` applies to years. Quarterly XBRL is published for India (`docs/DATA_LAYER_PLAN.md` §2.3) and for the SEC. |
| — **segment results** | **Later** | Not built. Waits on the data layer: the Indian results XBRL carries revenue, result, assets and liabilities by segment on four axes, but **not the segment names** (`docs/DATA_LAYER_PLAN.md` §3), so a table could be drawn with the right figures and no labels. |
| — **raw filing link** beside each quarter | **In flight** | One link per company is carried (`sourceUrl`, the SEC filing list or the Yahoo page). A link per filing, and per line, is what the data layer's store is designed to give (`docs/DATA_LAYER_PLAN.md` §6.3). |
| **Ten or more years of profit and loss, balance sheet and cash flow** | **In flight** | **The Financials tab is built** (stage A, 2026-10-25): the three statements on one screen, Annual and TTM, **every number opening the evidence behind it** — the period, its duration, the basis, the unit, the state and the source, with the XBRL concepts it was read from for an SEC filer and "Vendor feed, development only" for the 92 payloads that come from one. Industrial and bank templates, the bank’s without an operating margin or an EBITDA. **Five years today** (`YEARS_WANTED = 5`). Worth stating plainly: the NSE archive measured on 2026-10-20 resolves only six to seven annual filings per company, so ten years for India needs a second source — the annual reports, or MCA. The SEC's company facts go back further. |
| — **TTM column** | **Built** | **It is read off the periods the company filed, and it says which.** Four quarters where four exist past the year end, the year-plus-half-less-prior-half bridge for a half-yearly filer, and the year itself where the latest filed period is the year. 149 companies now get a genuine rolling twelve months ending at their latest quarter rather than at their last year end; the rest say "TTM (FY basis)" and mean it. A balance sheet line is never summed into it — the column is the latest balance, which is rule 6. |
| — **consolidated and standalone, switchable** | **Now** | Not built, but **the basis is now labelled on every number** (rule 15): "Consolidated" for an SEC filer, and for the vendor feed a plain statement that it does not say which basis these are. The payload carries one basis. Both are published as separate filings in India, so the data exists and the choice is not yet offered (`docs/DATA_LAYER_PLAN.md` decision 5). |
| — **related-party view** | **Later** | Not built. The figures are in the annual report's notes, not in any XBRL this site reads. |
| **Growth tables — ten, five and three years and TTM, for sales, profit, price CAGR and return on equity** | **Now** | Partly there and not as a table: `cagr()` exists in `deriveModel.js` and a revenue CAGR line is shown in the qualitative intro; return on equity is computed. The compounded table is not built, and price CAGR needs the price history above. |
| **Working-capital ratios — debtor days, inventory days, days payable, cash conversion cycle, ROCE** | **Built** | All five are in `RATIO_DEFINITIONS`, each with its formula and, for ROCE, a note saying the denominator Screener uses is not disclosed precisely so the two will not always agree. That note is the model for every figure on this list where the two tools differ. |
| **Company-specific operating figures from the filings** — tonnes, subscribers, stores, same-store sales | **Later** | Not built. These are in the annual report's notes and the management discussion, never in the results XBRL, so this waits on stage 5 of the data layer. |
| **Shareholding, quarterly and yearly** — promoters, institutions, foreign institutions, public, government | **Now** | Not built. Nothing on the site reads a shareholding pattern. For India it is a separate SEBI filing from the results; for the US it is Yahoo's holders block, already fetched for nothing else. |
| — **number of shareholders** | **Now** | Not built. Published in the Indian shareholding pattern, so it arrives with the item above. |
| **Documents — announcements** | **Built** | `api/news.js`, shown on the analysis screen's ticker. |
| — **annual reports** | **Now** | Not built. The link is the cheap half; reading them is stage 5 of the data layer. |
| — **credit ratings** | **Next** | Not built. The rating agencies publish rationales per issuer; the terms of each need checking first, the same question as `docs/DATA_LAYER_PLAN.md` §4. |
| — **concall transcript** | **Next** | Not built. |
| — **concall summary** | **Next** | Not built, and **standing decisions 6 and 8 both bind it**: a summary may quote and attribute what management said, with the sentence and its place in the transcript, and may not characterise it. An AI summary that cannot be checked against the transcript is not allowed. |
| — **concall presentation** | **Now** | Not built; filed with the exchange alongside the results. |
| **Site tools — query-based screens** | **In flight** | A batch run over a ticker list with a CSV download is built (`src/data/batchRun.ts`). A query language over a universe is the screener of section 13's table, statused Next there, and this row should not drift from it. |
| — **Excel export** | **Built** | `src/data/excelExport.ts` and `downloadWorkbook`, with the 138-row chart of accounts, live formulas and the circularity switch. This already exceeds Screener's export, which is values only. |
| — **user notes on a company** | **Now** | Not built. `MARGIN_NOTES` is editorial explanation, not a reader's own notes; saved models keep a reader's work in this browser's `localStorage` (`src/data/savedModels.ts`) and are the nearest thing. **The "Your notes" tab now exists at its own address** and says it is being built; the store behind it is what is missing. |
| — **commodity prices** | **Later** | Not built. Most series that matter are licensed; the free ones would need the same terms check as every other source. |
| — **shareholder search by name**, across companies | **Later** | Not built. Needs the shareholding item above, for every company, in one store. |

**Two things this list deliberately does not promise.** A target price or a
recommendation, which needs the SEBI Research Analyst licence and is built
switched off (section 14, and launch principle 2). And any figure the sources do
not publish: every row above that says "Later" and names the annual report is a
row that waits on the data layer, not on a design.

---

## 14. Research

**Status: Now, with the opinion parts switched on at launch.** From
`docs/VISION.md` §6.

The goal is a research report on any listed company, as good as a broker's
initiation in structure, with every number sourced and every judgement visible.
A report that gives an opinion on the value of a security needs SEBI Research
Analyst registration, so every pack is built in **two modes**: user-authored
(facts, the user's model, the user's conclusion) and Marginalia-authored (with a
rating and a target). The second is switched on after registration.

| Item | Status | What it is |
|---|---|---|
| **One-pager (tearsheet)** | **Now** | Description, price, ten-year key financials, ratios, multiples against peers, the user's model value, ownership changes. |
| **Two-pager** | **Now** | Adds the three-approach valuation, the football field, the guidance record, risk factors as disclosed, insider and promoter activity. |
| **Full research pack, 15–25 pages** | **Next** | Cover; summary written by the user; business and segments; industry; financial analysis; quality of earnings; valuation; scenarios; risks as disclosed; governance and ownership; guidance record; appendix statements; sources. Word and PDF, figures linked to the workbook. |
| **Results note** | **Next** | Within hours of results: this quarter against last year and against guidance, what changed in the model, concall quotes. Facts only. |
| **Concall note** | **Next** | Guidance, targets and commitments, each with the speaker and the minute. |
| **IPO note** | **Next** | From the DRHP: offer structure, use of proceeds, pre-IPO prices, the issuer's own peer list, restated financials, litigation. Every number verified to its page. |
| **Sector report** | **Next** | Industry structure, KPIs, peer table, recent deals. |
| **Ratings, target prices and "our call"** | **Next** | Written by a registered analyst with every required disclosure — conflicts, holdings, extent of AI use. A public track record of every call from day one. Built now; switched on after registration. |
| **Hindi and other languages** | **Next** | As EquiSense already offers. |
| **AI use disclosure built into every pack** | **Now** | AI drafts only from quoted facts and every sentence carries its source. SEBI's 2024 amendment already requires registered analysts to disclose the extent of AI use, so the disclosure is designed in now rather than added at registration. |

**For students:** the same pack is a strong starting point for the CFA Research
Challenge and college competitions.

**Where it lives:** the Research menu (all packs and notes), Company › Research
(one company), Studio › Outputs (generate from your own model).

---

## 15. The investor area

**Status: Next, after the India data layer.** From `docs/VISION.md` §5d and §7.

| Item | Status | What it is |
|---|---|---|
| **Naive-investor section** | **Next** | Insights read off the reported statements. Mechanics, not merit. |
| **Portfolio and holdings import** | **Next** | From broker files or contract notes. |
| **Thesis journal** | **Next** | Why I bought, tied to the model assumptions it rests on; "I will sell if…" recorded at the time of purchase, not afterwards. |
| **Decision scorecard** | **Next** | After a year: which reasons worked, how long winners and losers were held. |
| **Alerts on WhatsApp and email** | **Next** | Filings, results, insider trades, thesis breaks. English and Hindi. Theme alerts across all companies, not only a watchlist. |
| **Who bought or sold this share** | **Next** | A timeline of named people and institutions, with the date traded, the date disclosed, the amount or range, and what the price did 1 week, 1 month and 6 months after. India: insider and promoter disclosures, bulk and block deals, holders above 1% each quarter, takeover-code disclosures, monthly mutual fund portfolios. United States: Form 4, STOCK Act congressional disclosures, Form 278-T for the President and senior officials, quarterly 13F holdings. |
| **Show the delay, always** | **Next** | Insider data is days old, congressional data up to 45 days, presidential reports months. Many presidential and fund trades are made by managers, not the person. Signal labels and interpretation are built now and switched on after registration; until then the facts alone. |
| **Volume trends and investing strategies** | **Next** | Education, clearly labelled. Back-tests after costs. |
| **Hedging comparator** | **Next** | Protective put, collar and short future side by side, on end-of-day data. |
| **IPO section** | **Next** | DRHP-based, every number verified to its page. |
| **Hedge recommendations** | **Next** | Built now; switched on after SEBI Investment Adviser registration. |
| **Live options data** | **Paid · last** | Display licence from an NSE-authorised vendor, bought before launch. Everything around it built now on end-of-day data. |
| **Indian politicians' election-affidavit holdings** | **Dropped** | Filed only at elections and sensitive. Left out for now. |

---

## 16. The deals site

**Status: Later.** A separate site, `docs/VISION.md` §5e. Free to list; a
success fee on completion.

| Item | Status | What it is |
|---|---|---|
| **Verified buyer network with mandates** | **Later** | Funds and corporates opt in and verify. This is the moat, and it is the hard part: consent, not scraping. |
| **Anonymous listings and teasers** | **Later** | Generated from the Marginalia model. |
| **Information memorandum from the model** | **Later** | Every number linked to its source. |
| **Deal-readiness check for sellers** | **Later** | Audits, MCA filings, auditor remarks, related parties, pledges. |
| **NDA, deal room, process tracker, Q&A** | **Later** | Teaser → NDA → IM → offer → diligence → signing. |
| **Buyer matching and buyer scoring** | **Later** | From past deals and stated mandates, each listing with a ranked list of likely buyers and the reason for each. |
| **Buyer interest tracker** | **Later** | Sellers see which verified buyers opened the teaser and how far each has gone. |
| **Distressed listings** | **Later** | From IBBI invitations for expressions of interest. |
| **MCA-filing data for private companies** | **Later** | Pre-fills listings and finds sellers. |
| **Deal terms benchmark** | **Later** | What terms are normal in Indian deals, from SEBI open-offer letters and DRHPs. |
| **Adviser pages and tombstones** | **Later** | Opt-in profiles only. Advisers report their own deals for league-table credit. |

---

## 17. The Excel add-in and the API

**Status: Next.** From `docs/VISION.md` §5f.

| Item | Status | What it is |
|---|---|---|
| **Excel add-in with live formulas** | **Next** | `=MARGINALIA("RELIANCE","EBITDA",2025)`, with the source behind the cell. |
| **Template library, link to PowerPoint and Word** | **Next** | One-click refresh of a football field, a comps table or a tearsheet from the model. |
| **Insert ready blocks** | **Next** | Drop a Marginalia DCF, WACC or sensitivity block into any sheet. |
| **Model auditor** | **Next** | Hard-codes, broken links, colour conventions, inconsistent formulas — with plain explanations. |
| **Reformat a user's model to convention** | **Next** | Formatting only, never a number. |
| **API with an AI connector (MCP)** | **Next** | For firms' systems and for AI assistants. Ships with a library of ready prompts. |
| **Embeddable company widget** | **Later** | A "Marginalia at a glance" card for blogs and news sites. A free source of links back. |
| **Chrome extension: PDF highlighter** | **Later** | Highlights disclosed facts in annual report PDFs. |
| **Chrome extension: our figures on other sites** | **Later** | Verified numbers shown on any company page. |
| **Usage pricing for the API** | **Later** | Pay for what is pulled. |

---

## 18. Macro

**Status: Next.** From `docs/VISION.md` §5b and `docs/FEATURES.md` Part B, which
studies FRED in depth. Macro is not a separate product here: it exists so a
company can be read against its own economy.

| Item | Status | What it is |
|---|---|---|
| **Country macro panel on every company page** | **Next** | Policy rate, 10-year yield, inflation, GDP growth, currency against USD and INR, unemployment, with charts and the next release date. From FRED, central banks, the IMF and the World Bank. |
| **India macro detail** | **Next** | RBI rates, inflation, industrial production, GST collections. |
| **FRED-style chart tools on company data** | **Next** | Growth, CAGR, index to 100, frequency conversion with the method shown, several series on one chart, user-drawn reference lines, recession and rate-cycle shading. |
| **Formula lines mixing company and macro series** | **Next** | Reliance revenue ÷ Brent; bank loan growth against nominal GDP. One formula language across both. |
| **Macro sensitivity card** | **Next** | For each company, its key macro drivers and a scenario slider: if crude rises 10%, the model value moves by X. |
| **Results and macro release calendar** | **Now** | Worldwide, with corporate actions and the bonus and split adjustments that per-share history needs. |
| **World and sector maps** | **Next** | Markets and countries coloured by valuation, return or macro reading; an implied-growth map built from the reverse DCF. |
| **Personal dashboards** | **Next** | Mix companies, macro, notes and screens on one page; publish it for a class or a team. |
| **Yield curves** | **Later** | By country, in the macro panel. |

**Charts, downloads and embeds throughout:** every chart and table goes to
Excel, CSV, image and PowerPoint, and can be shared or embedded — auto-updating
or frozen. FRED data is public domain with citation requested; some series carry
their source's own terms, so each is checked.

---

## 19. Decided 17 October 2026 — four items

These four were decided in the planning conversation of 17 October 2026. Three
were things to build; the first is a thing to plan. They are numbered together
rather than filed under the areas they touch because they were decided together.

**19b is now Built** (19 October 2026). 19a and 19c are still NEXT, and 19d is
the bar every item clears rather than an item with a status.

### 19a. One system — NEXT, and a planning item before it is a build item

**The decision:** every tool works on its own, AND the tools connect into one
journey:

    screen → company → model → reasons to avoid → decide → monitor → review

Each step stands alone — a user who only wants the screener gets the screener.
But the chain is the product, and the point of the chain is that it should
produce **combined results no single tool can**: outputs that exist only because
the screen, the model, the reasons, the decision and the monitoring are the same
system reading the same data.

**What those combined results are is not yet decided, and must not be invented
here.** `docs/FEATURES.md` Part D lists thirty combined features, and they are
the right kind of thing — as-first-reported against restated, street against
management against you, decision replay, thesis alerts — but Part D is a list of
features, not an account of what the connected journey produces that the
features separately do not.

So this is recorded as **an open planning item, not a feature list**:

- **To be explored and planned before anything is built.** What does the whole
  journey give a user that the seven steps give separately? Name the outputs.
- **The test for each candidate:** could it exist if the steps were seven
  separate products? If yes, it belongs in its own section, not here.
- **What it is not:** a menu reshuffle, a dashboard that embeds the other
  screens, or a wizard that walks a user through steps they did not ask for.
  Each tool must still work on its own.
- **Where the planning output goes:** its own section in this file, with the
  combined outputs named and statused, and the journey's shape in
  `docs/VISION.md`.

### 19b. The figures screen, redesigned — BUILT

**The decision:** the figures screen shows each company's line items **exactly
as filed**, already placed under the model heads by the engine's default
classification, with the reason for each default shown. Where the user
disagrees, they **drag the line to a different head**.

**The heads a line can be dragged to:**

| Statement | Heads |
|---|---|
| Profit and loss | revenue, cost of goods sold, research and development, selling general and administrative, depreciation and amortisation, other operating, other income, finance cost, one-offs, tax |
| Balance sheet | debt (including leases), and each working-capital item |

**Numbers are edited in the same row**, with the filed value kept beside any
change — the rule that a corrected figure is never shown as filed does not move.

**This removes the direct / indirect / selling / admin classification**, which
shipped on 10 October 2026 (`9980f72`, `METHODOLOGY.md` §22d). Recorded plainly
because it is a reversal of something Built, and because removing it is not a
small edit:

- Five categories and the four classifiable lines go; the heads above replace
  them. The judgement becomes "which head does this filed line belong under",
  which is the judgement an analyst actually makes.
- The adjusted EBITDA bridge (`METHODOLOGY.md` §22e) reads the classification
  for its exclusion lines, so "one-offs" becomes the head that drives it.
- The workbook's two judgement columns on the Assumptions sheet, the
  `classification` field on a saved model (§22f), `verify/classification.mts`
  and the browser check of the classification band all follow the heads instead.
- What must not be lost: every default states where it came from; every override
  takes an optional one-line reason; there is a visible return to the default; a
  change rebuilds the model at once with the previous value beside it; and
  reported operating profit still ties to the filing whatever the user does.

**Built on 19 October 2026.** `METHODOLOGY.md` §22d carries the method and every
measurement; the headline numbers are that the payload sweep over 176 companies
shows **zero drift with nothing moved**, that reported operating profit ties to
the filing within **9.13e-16 of itself** under every one of 215 assignments, and
that the one-offs head reproduces the three figures expense classification
published (706.52, 1,044.32 and 1,683.09 on Reliance) exactly — which is the
evidence that removing the old feature lost nothing.

**What was built, and what was deliberately left:**

- **Built as drop targets**, each proved to change a number the model publishes:
  cost of sales, research and development, selling general and administrative,
  depreciation and amortisation, other operating costs and one-offs on the
  profit and loss; cash and investments, receivables, inventory, payables, fixed
  assets and other on the balance sheet. Twelve heads; eleven of them move value
  per share and one moves the gross margin and the line composition without
  moving the value, which the screen states rather than glossing.
- **Shown and refused, each saying why on screen**: revenue, other income,
  finance cost, tax, debt including leases, and equity.
- **One engine hook was needed and built**: one-offs. The engine's reconciling
  line would otherwise hand the money straight back, so `deriveModel` takes the
  amount out of that residual's forecast base while the reported years keep it.
  Without it every move to one-offs changed value per share by nothing at all.
- The saved model is at **version 3**. A version 2 record's `excluded` lines
  become one-offs and reopen at the figure they were saved at; its four grouping
  categories become nothing, because they changed no number in any model, and
  the record says so in words rather than dropping a field silently.

**The two hooks this job did not do, which are the next job:**

1. **The debt hook.** The engine builds the debt total from up to fourteen
   overlapping filed fields with separate US GAAP and IFRS paths — combined
   debt-and-lease figures where a filing publishes them, debt-only where it does
   not, finance leases netted and operating leases never netted. A move cannot
   be honoured by rewriting one field. Until it exists the debt head is shown
   with its filed lines and is not a drop target.
2. **The below-the-line hook.** Moving an operating cost to other income or to
   finance cost cannot change the forecast today, because the reconciling line
   absorbs it. Honouring it needs the engine to take the amount out of the
   forecast operating base *and* add it below the line. Revenue needs the same
   shape of hook before a one-off sale can be set aside.

Both are recorded here rather than built, because each touches engine code that
this job was already replacing a live feature in, and because a control that
moves a line and changes no number is worse than no control.

### 19c. The loading screen — the card is BUILT, the live progress is NEXT

**The decision:** replace the generic quotes with **live progress using the
company's real numbers**, plus **one myth-versus-fact card drawn from that
company's own data**.

This supersedes the 53 did-you-know notes (`fe2256e`, Built). Those are generic
by construction — the same 53 for every company — and a reader waiting for
Reliance to build should be reading Reliance's figures arriving, not a general
remark about EBITDA.

- **Live progress on real numbers:** which filing is being read, which year has
  arrived, the revenue and profit figures as they land, which checks have
  passed. The wait becomes the first sight of the data.
- **One myth-versus-fact card from this company's own data:** the myth stated,
  then the company's own filed figure that settles it. One card, not a carousel.
- The rule that holds: mechanics, not merit. A card states a fact and a
  definition; it does not call a number good or bad.
- The existing check that a slow build does not leave one note on screen for the
  whole wait (`verify:dashboard`) applies to whatever replaces the notes.

**Built on 2026-10-24: the card.** Sixty myth-versus-fact cards, written and
checked away from this repository and kept in `src/data/myth_fact_cards.csv`
as the copy of record, with `src/data/mythFactCards.ts` generated from it and
compared against it cell by cell on every run so no card can be reworded here.
Each card carries a condition, and `src/data/mythFactMatch.ts` carries the
predicate behind it over the company's filed statements. A card is shown only
where its audience includes the company and its condition is TRUE — not
unknown, not false — so a reader is never shown a claim about their company
that the filing does not support. Measured over 175 companies: 166 earn a card
of their own and 9 fall back to one written for any company, all 9 of them
banks. The myth is shown first, the fact a beat later, and the mechanism sits
behind a ⓘ rather than as a third paragraph on a screen somebody is waiting
to leave.

**Finished on 2026-10-25: the three points the brief carried.** The card is
labelled **"Common myth"**, and nothing on the screen — with the mechanism open
or closed — says *this company*: the sentence that introduces an earned card
gives the condition that picked it and puts it as education rather than as a
finding. **A build that finishes in under a second shows no card at all**; the
card waits a second, and a quick build closes with the progress rule as its
only content. Checked at 1600px and 390px against the first design principle:
no sideways scroll, nothing clipped, the panel 342×392 inside a 390-wide
phone.

**And a defect in what shipped on 2026-10-24, found while doing it and fixed in
the same commit.** The two beats restarted whenever the figures arrived, so on
any build slower than about two and a half seconds the correction was scheduled
for after the overlay had closed: the reader was shown a belief and never the
fact. The beats are now scheduled once and the card is replaced only while its
myth is still alone. `verify:dashboard` now drives the card check against a
three-second cold fetch and asserts the earned card’s own correction reached
the screen before it closed; run against the version that shipped, it reports
the defect.

**Still Next: the live progress on real numbers.** Which filing is being read,
which year has arrived, the revenue and profit figures as they land. The card
half shipped on its own because it was what was asked for; this half is
untouched and is a job of its own.

### 19d. The first design principle — recorded, not scheduled

> **At every point, on every screen, Marginalia must look modern, highly
> attractive and high-budget, yet simple, clear and professional. Never messy or
> cluttered. The first impression is the look, so no screen ships unless it
> meets this standard.**

It is the **first** design principle, above everything in `DESIGN.md`, and it is
recorded in `CLAUDE.md` as a house rule so every session reads it before
touching a screen. It is not an item with a status: it is the bar every item
clears.

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

**It drifted again.** On 10 October 2026, building expense classification, the
log was found to be missing **fourteen** commits — everything from `7c66c96`
onward, including four whole features: the chart of accounts, peer spreading,
the house template and the rupee's risk-free rate. All fourteen are entered
below. The gap is the same shape as the one this section was written about, so
the warning above stands rather than being softened: check the repository before
trusting a status.

| Commit | What |
|---|---|
| `398c629` | **The risk and cost-of-capital card, on every company page (§13).** Two figures — the cost of equity and the WACC — and under them the nine inputs they are made of, each with its publisher, its date and an ⓘ, each editable, and every edit run back through the engine so the value per share beside it is the engine’s answer under the reader’s own numbers. **The card shows the numbers the engine uses and nothing else**, which is the specification’s own principle and the thing every other site breaks. **Beta is calculated here, from one stated recipe**: five years of monthly price returns against a broad index for the market the share trades on, two years weekly beside it, raw and Blume-adjusted together, with the observations, R squared, standard error, window and dates all on the card — 170 listings across 21 markets, median 0.855. Twenty-one index symbols were read at the source before being written down, and the three that failed are recorded as failures (TOPIX is not on the endpoint; the CDAX returns one close; Norway and Saudi Arabia get no beta at all). **The model still uses its own asset beta of 1.0 relevered, and the card says so**: rule 9 makes that a decision to be taken rather than a screen’s to make. **The country risk premium is shown and not added**, from Damodaran’s January 2026 table captured whole (178 countries, vintage stored); switching it on adds it once and renames the premium row so the two cannot be read as additive. **A bank gets no WACC**, only a cost of equity, and is not relevered. **A defect of the engine’s, found by putting these numbers on a screen and fixed in the same commit**: a missing risk-free rate was being read as a rate of nought, so 33 payloads carried a cost of equity equal to the premium alone. Two more were measured and recorded rather than fixed: `KI-29`, the cost of debt is the historical effective rate and 59 of 137 companies come out borrowing below their own government; `KI-30`, one share count a million out. **Proved by breaking**: the premium added twice, a bank given a WACC, a price left in pence, a row stripped of its date, every edit cut off from the engine, the regression run the wrong way round, and the missing-rate guard removed. |
| `5b3882e` | **Quarterly and half-year periods, and a trailing twelve months that is actually trailing (§13a).** The data layer now fetches interim periods as well as years: 1084 quarters and 291 half-years from SEC facts across 84 companies, and 493 quarters from the vendor feed across 92. For an SEC filer a quarter the company never filed on its own is worked out as **this year to date less the last** — the one subtraction behind Q2 = H1 − Q1, Q3 = 9M − H1, Q4 = FY − 9M and every cash flow quarter — and each of the 7,108 figures derived that way is labelled derived and carries **both** of the filings it is the difference of. **A cumulative figure is never shown as a quarter**: a point is taken as one only when its own dates say so, which on Apple means rejecting the 272-day "Q3" cash flow its 10-Q files. **TTM is read off the periods actually filed** (rule 5, all four branches), so 149 companies now get a rolling twelve months ending at their latest quarter rather than at their last year end. **Four defects of my own, found by measuring rather than by reading**: the unfinished fiscal year was dropped entirely, which is the one a reader wants; a subtraction between two different XBRL concepts put Arista's Q4 net income at −2,556 against a year of 2,852; a company filing nothing between year ends had its whole year taken as "Q1", 364 days long; and a 52/53-week filer’s sixteen-week fourth quarter was being thrown away. **Quarters that do not add up to the year beside them are refused** rather than shown, which standing decision 3 requires and which the check then verifies. **Proved by breaking**: a cumulative figure planted as a quarter, a derived figure stripped to one filing, and a TTM forced back onto the financial year. Cost: the payload set grew 10.34 MB → 13.95 MB (**35%**), a full refetch 22 → 25 minutes. |
| `015d31b` | **The Financials tab: the three statements, and the evidence under every number (§13a).** Stage A of `docs/FINANCIALS_SPEC.md`: income statement, balance sheet and cash flow, Annual and TTM, industrial and bank templates, on desktop and at 390px. The spec’s own survey is the reason it exists — of the five sites it studied, **none links a number to the filing behind it** — so every cell is a button that opens what period it covers, how long that period is, the basis, the unit, its state and its source, with the XBRL concepts it was read from for an SEC filer and **“Vendor feed, development only”** for the 92 payloads that come from one. **The five value states are never confused**: reported, reported nil, not reported, not applicable, derived — and a derived figure with a missing input is not reported rather than a partial sum. **Four rules checked over every payload**: the TTM method is read off the filed periods (all four branches of rule 5, three of them driven by constructed period sets because annual-only data never reaches them); a gap is an em dash and never a zero, checked against the payload rather than the view; no bank carries an operating margin, EBITDA, gross profit or cost of sales; and no balance sheet line is ever summed. Measured: 35,071 cells over 175 companies, 4,828 gaps, 178 filed nils, 36 banks, 2,697 balance sheet rows. **Proved by breaking**: all four at once reported 7,483 faults, and removing the evidence handler reported every sampled number. |
| `92a50c2` | **The rupee’s risk-free rate comes from the OECD, with FRED behind it.** FRED was a single point of failure with a measured outage behind it: on 2026-10-22 it answered every request with its own "Site Maintenance" page and six Indian companies lost their valuation in an afternoon. The OECD compiles the series and publishes it under CC BY 4.0 since 1 July 2024, so it is now asked first through its own SDMX API and FRED is kept as the fallback; if both go, the valuation is still refused rather than discounted at something else. **They are the same series, measured rather than assumed**: 178 months from 2011-12 to 2026-09 on both, 175 identical to the last digit and the other 3 inside 7e-7 of a percentage point, which is the OECD API rounding to six decimals. The six Indian payloads were refetched and the rate did not move at all — 6.540458% over the same twelve months, for all six. **The publisher is now on the screen and in the workbook**, and says plainly when the fallback answered and why. `METHODOLOGY.md` names the series, its construction (par, spot or benchmark), its frequency and its publisher for all six currencies; `DATA_CONSTRAINTS.md` records FBIL as **Paid · last** and SNB, MAS and ChinaBond as needing permission before public use. **Proved by breaking**: with the fallback removed the check reports 5 faults including "with the OECD blocked the rate came back as null"; with the OECD’s months left dated as `2025-04` rather than `2025-04-01` it reports that the two sources describe the same year differently. The check runs offline, against canned answers in each publisher’s own format, so the suite does not depend on either being up to test what happens when one is down. |
| `11bd40e` | **The loading screen carries one myth-versus-fact card from the company’s own figures (§19c).** Sixty cards converted from `src/data/myth_fact_cards.csv` into typed data with every column kept, and compared with the CSV cell by cell on every run — 420 cells — so a card cannot be reworded in the code. Each card’s "Show when" condition is a predicate over the filed statements, and **a condition has three answers, not two**: true, false, and cannot-be-established, which is never read as false. Over 175 companies: 1,891 conditions true, 4,969 false, 3,640 that the source cannot settle; 166 companies earn a card of their own, 9 fall back, all 9 banks. Eleven cards can never be shown because neither source returns the line they rest on — six of them the bank cards — recorded in `DATA_CONSTRAINTS.md`. The myth is shown first, the fact a beat later, the mechanism behind a ⓘ. The 53 did-you-know notes are no longer rendered; the file is kept and says so. **Four breaks proved the checks**: a reworded card, two different ways of reading an absent line as nil, and the mechanism printed in the open. The one-line-at-a-time probe that caught the second of those also found three real faults in this code before it shipped. |
| `61f8e73` | **The company page, stage 1: the hub and the Overview tab (§13).** One address per company and per tab — `/company/RELIANCE.NS/overview` — with all nine tabs from `docs/VISION.md` in one list that the page, the router and the browser check all read. Overview and Model are built; the other seven carry one line naming what they will hold and nothing that could be mistaken for data. **The Overview**: twelve summary figures, each with its formula, the filing it came from and its source behind a ⓘ, and every ratio taken from the one filing that reports both of its halves. **The price chart**: the daily series the quote fetch had been downloading and discarding since the beginning is now kept (`payloadVersion.ts` v5, ten years daily plus monthly to the start, as quoted), with seven ranges and five overlays — P/E, P/B, EV/EBITDA, market cap to sales, and sales with operating margin — every one of them computed from this company’s own filings, each point naming the filing it divided by, and no point at all before the earliest filing held. **The header no longer draws over itself at phone width**: measured at 320px, the wordmark now ends 153px clear of the controls where the two used to overlap. **Three checks, each proved by breaking it**: no figure prints as a zero it does not have (264 dashes across 175 payloads; breaking it reported all 264), every overlay matches a figure worked out by hand (13 of them; three separate breaks reported 3, 4 and 3), and every tab address loads in a browser (breaking the unknown-tab fallback and the unbuilt-tab line each reported it). The hand-worked figures caught their own author first: the EV/EBITDA expectation was written with the wrong net debt. |
| `125faa9` | **One currency through every model, and the value shown in the currency the share trades in.** Investigated as a reported defect on Infosys — statements in US dollars against a rupee price — and measured to be none: the statements, the risk-free rate and the converted price are all in dollars, and Infosys’s two listings agree, the New York price at $10.50 unconverted against $10.40 for the Bombay price converted. 48 of 176 payloads trade in a currency their statements are not in; the conversion succeeded on all 48, and nothing had a risk-free or displayed quote currency differing from its statements. So no entry was opened. **The policy is now written down** rather than only implemented (`METHODOLOGY.md` §3), with the two alternatives measured: discounting at the trading currency’s rate moves Infosys −25.8%, Unilever −30.8% and Vodafone −27.6%, and withdraws five companies that have a value today for want of a published bond yield. **A regression check was built**, because nothing asserted the invariant: `npm run verify` sweeps every payload for a model labelled in one currency, priced in a second or discounted at a third, and mixes two copies of a real payload on purpose to prove it can fail. **Each value per share now also carries the trading currency** at the one disclosed rate — Infosys reads ₹1,393 under $14.49 — which found and fixed a defect of our own: the disclosed rate was the composite applied to the quoted figure, printed beside the name of a pair a hundred times away from it, on nine companies. Zero drift across 70 valued companies. |
| `ddfe798` | **`KNOWN_ISSUES.md` is empty: the last three defects closed.** `KI-28` — `tsc --noEmit` was checking no component props anywhere, because `@types/react` was never installed, so the suite was blind to a whole class of error and exited 0 while checking nothing. Installing the types surfaced seven real errors, one of them a latent bug passing React's MouseEvent where a margin-note key belonged, and one a `DCFResult` interface missing the share price three screens read off it. `KI-25` — the news ticker animated unconditionally, so headlines that fitted their window were dragged off the left edge anyway; it measures itself now and only scrolls when it overflows, with the content duplicated and the translation halved so the loop closes without a gap. `KI-26` — a render-blocking stylesheet fetched on every page load for an icon font nothing drew with. Each left a check that fails without its fix: `verify` compiles a component call that must not compile, and `verify:dashboard` drives both ticker branches and matches every font the page fetches against the families `tokens.ts` names. |
| `894cc84` | **The figures screen made short, and one type system for the whole site.** The screen is a title, one line, two tabs and a compact table; every explanation moved behind a ⓘ that opens on hover, on keyboard focus and on tap, so no paragraph is left on it. The profit and loss went from twenty-two rows to thirteen — most heads carry one line and the table printed its name twice — and measures about 560px, inside a laptop screen. **The editing bug is fixed**: the row was a React component declared inside the screen's own render, so every keystroke gave React a new component type and it remounted the input; measured, clicking a cell left `document.activeElement` on BODY and typing changed nothing. Drag moved off the row onto a grip, a ⋯ menu gives the keyboard a way to move a line, and the reason is an optional inline field. **Typography: Newsreader and Source Sans 3**, chosen from three pairings rendered on the real screens, applied through `tokens.ts`. Monospace is gone from the site (`font-mono` renamed to `font-figure` across 343 call sites and pointed at the body face with tabular figures); so are uppercase letter-spaced labels and red label text. One four-step scale replaces twenty-five sizes, held by a remapping block so a twenty-sixth cannot be written. `DESIGN.md` rewritten to match. |
| `511234c` | **The figures screen, redesigned (§19b)**: every filed line under the model head the engine assigns, with the basis for each default, draggable to another head and with a keyboard menu beside it, the figure editable in the same row. Replaces expense classification (`9980f72`), reversed here. The re-aggregation is a transfer of one line's own amount rather than a re-sum by head, which is what the first implementation did and what double counted share-based pay into SG&A and short-term investments into cash; one engine hook built, for one-offs, which reproduces the replaced feature's figures exactly. Zero drift across 176 payloads with nothing moved; reported operating profit ties to the filing within 9.13e-16 under every assignment. Saved model at version 3. `METHODOLOGY.md` §22d. |
| `6cb1c29` | **`KI-27` fixed: a saved model reopens at the figure it was saved at.** The record now carries every input that decides the valuation — the sliders, the corrections and their reasons, the expense classification and its reasons, the qualitative answers, the peer set, the recovery rates, and the share price the valuation was struck against, which moves the answer through the cost of capital. Reopening rebuilds the company record rather than setting the sliders, through one path the harness uses too. The saved list reopens every row as it lists it, so it never prints a figure the entry cannot produce; a record saved before the fix names what it never stored and nothing is guessed at. Versioned and behind a store interface, so it moves to an account unchanged. `METHODOLOGY.md` §22f. |
| `216265e` | **The adjusted EBITDA bridge**: reported EBITDA from the filing, every correction and every exclusion as its own line with the reader's reason, adjusted EBITDA at the foot, every reported year. Three live ties, recalculated inside the written file. Its own workbook sheet, and reasons added to corrections for the first time. Two defects fixed with it: the bridge's own top line linking to the corrected model, and the Sources sheet printing corrected figures under “what the filing actually said”. `METHODOLOGY.md` §22e. |
| `9980f72` | **Expense classification**, the first piece of the judgement layer (section 2), on the figures screen between reported and modelled. Four cost lines, five categories, a default per line that states where it came from, an optional reason, a visible return to the default and an immediate rebuild with the previous value beside it. Grouping moves proved to move no figure; an exclusion proved to move one. The workbook's two reserved Assumptions columns filled. The figures screen added to the contrast pass, where it had never been. `METHODOLOGY.md` §22d. |
| `bc52544` | An unmapped line in a house template carries its figures and not only its name, and our own layout stays one click away beside the firm's. |
| `b7fbcaa` | **The house template**: a firm uploads its own Excel layout once and every export arrives in it. Mapping proposed from their own line names and corrected by them, held in their browser only, reconciled rather than rebuilt on a revision. `METHODOLOGY.md` §22c. |
| `c66cb66` | **Peer spreading**: the target and up to ten peers on identical formula-driven tabs, with a comparison tab of live cross-tab formulas, medians and spreads. A refused peer keeps its tab and its refusal. `METHODOLOGY.md` §22b. |
| `4a61ac2` | **The standard chart of accounts**: 138 contracted rows, every line at the same row position in every workbook, with a suite check that asserts it line by line. `METHODOLOGY.md` §22a. |
| `23b472b` | A risk-free rate for the rupee, from the FRED OECD series, published monthly and said on screen to be monthly; the observation threshold made frequency-aware and the monthly-against-daily gap measured rather than asserted. |
| `0f88184` | The standing bar measured rather than guessed at, and every scrollable page given padding that clears it. |
| `9c27b9f` | Sections divided by a rule and space rather than a box each; the prose measure capped where full-bleed sections had removed the only constraint on it. |
| `062645d` | One monospace face for figures and one sans for sentences, and a single radius throughout. |
| `bf81dfe` | The dashboard check stopped filling the feedback form and calling it a search — a flake that would have passed against a screen that never had a model. |
| `3bb70df` | `DESIGN.md` refreshed, and a claim it made about a figure corrected. |
| `f571a01` | The number first on every screen that had the explanation ahead of it. |
| `e9d73d8` | Two faults on the screen measured and fixed, and one claim withdrawn that measurement did not support. |
| `1981959` | The number first, the explanation on demand. |
| `7c66c96` | The operating margin slider moved the margin by the point it asks for (`KI-23`). |
| `aca809e` | The workbook's cost of capital and growth fade computed rather than pasted: `KI-20` and `KI-21` fixed, the cash cushion fixed with them, the DCF sheet's row numbers moved into one map, and `KI-24` opened for the cost of debt. |
| `a96b85f` | The workbook's cost of debt averaged off its own debt schedule rather than pasted: `KI-24` fixed, and the absent-rate case measured rather than assumed. |
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
