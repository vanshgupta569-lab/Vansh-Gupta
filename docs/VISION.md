<!-- Converted from docs/plan/Marginalia_Vision_and_Idea_Book.docx on 2026-10-17.
     The content is the document's own: every section, every table row, every
     status and every link. Two things differ, both presentational: Word's
     Heading 1 and Heading 2 become `##` and `###` so the hierarchy survives
     under one title, and Word's blanket bold inside tables is kept only on the
     header row, the first column and the status column. The .docx remains in
     docs/plan/ as the original. -->

# Marginalia — Product Vision and Idea Book

Version of 12 October 2026. Everything planned, built, decided and rejected for Marginalia in one place, with enough context for a person or an AI tool to understand the product and suggest more ideas.

## How to read this

- Sections 1–3 explain what Marginalia is, who it serves and the rules it runs on. Read these before suggesting anything.

- Section 4 is the structure of the platform. Section 5 is the full list of features with their status.

- A companion document, the Feature Bible, lists every feature of the 27 studied tools plus FRED and Yahoo Finance, how Marginalia provides each, and 30 combined features no single tool offers.

- Sections 6–8 are the newest areas: equity research, "who bought or sold this share", and lessons from EquiSense.

- Section 9 lists what has been rejected and why, so nobody suggests it again. Section 10 lists open questions for reviewers.

**Status words:** Built = live on the site and verified. In flight = part-built. Now = next six months. Next = six to twelve months. Later = waits on another piece being built first. Paid · last = needs money (licensed data, paid services); built just before public launch. Nothing waits on SEBI: regulated features are built now and switched on at launch. Idea = raised, not yet decided. Dropped = decided against.

## 1. What Marginalia is

Marginalia is a financial research and modelling website. It reads a listed company's own filings, builds a three-statement model and a valuation from them, and hands the user a live Excel workbook. It is expanding into a full platform: company data, equity research, an investor area, an Excel add-in and API, and a separate marketplace for buying and selling companies.

**What makes it different.** Any chatbot can "write you a model". Marginalia's product is that every judgement inside the model is surfaced, given a default from the filings, can be changed by the user, and is recorded with its reason, and that every figure traces back to the filing page it came from. A valuer, a CA firm or a boutique advisory shop is paying for defensibility: a model that survives scrutiny.

**The design rule in one line:** the machine does the arithmetic; the human keeps the judgement.

### Who builds it and how

- Built by Nihar Gupta: CA Intermediate (AIR 34), CFA Level I, finishing articleship, joining a front-office investment banking role. He does not write code; all code is written by AI (Claude) from prompts agreed in planning conversations.

- Stack: React, Vite, Tailwind, TypeScript, exceljs for the workbook; hosted on Vercel. A verification harness (scenario checks, workbook recalculation, a browser test of the live site, before-and-after measurement across ~175 companies) runs before every release.

- Working rule: one job per session, full test suite, one commit, push. Our own mistakes are logged in KNOWN_ISSUES; methodology choices in METHODOLOGY; source gaps in DATA_CONSTRAINTS.

### What exists today

- Engine: DCF for operating companies; residual income for banks and financials; reverse DCF; market approach with peer selection; asset approach (book, tangible book, net current asset value); a plain-English refusal for ~100 of 175 companies the engine cannot model honestly.

- Data: US companies read directly from SEC filings; others from a vendor feed (to be replaced). Risk-free rates from each country's own government source.

- Workbook: a live model, not a data dump, with Cover, Assumptions, adjusted EBITDA bridge, three statements, annexures, DCF, ratios, Checks and Sources sheets; a standard 138-row chart of accounts; a circularity switch; a peer workbook (target plus up to ten peers); upload of a firm's own Excel template.

- Site: landing, company directory, figures editor (correct and classify), 23 qualitative questions, company analysis, batch mode, eight explainer articles, 19 Margin Notes, 53 "did you know" notes, a constraints panel.

## 2. Who it serves

1. **Investment banking analyst.** Needs trusted Indian comps, a model that can be defended, a football field and a tearsheet in a pitch deck, fast. Would pay for the Excel add-in, sourced adjustments, version history.

1. **PE associate.** Needs targets and buyers, quality of earnings, an LBO, a diligence list. Would pay for private-company data from MCA filings and the deals database.

1. **CA firm or registered valuer.** Needs reports that satisfy regulators and survive challenge years later. Would pay for statutory calculators, house templates, frozen models, reviewer sign-off.

1. **Equity research analyst or student.** Needs a fast first draft of an initiation report and results notes, every number sourced.

1. **Retail investor.** Needs plain explanations, alerts, a record of why they bought, who else is buying. Would pay for WhatsApp alerts, the thesis journal and research packs.

1. **Company owner or fund.** On the deals site: sellers want buyers; funds want verified deals.

1. **Colleges.** Academic licences, as IIM libraries already buy Venture Intelligence.

## 3. The rules everything runs on

These are standing decisions. Changing one is a decision for Nihar, not a code change.

1. **The engine builds every model.** No hand-built company models on the site.

1. **Judgements belong to the user; arithmetic belongs to the engine.** Every modelling choice shows its default, its source, and can be changed.

1. **Refuse rather than approximate.** A company that cannot be modelled honestly gets a plain refusal naming what is missing. Missing data is never treated as zero.

1. **Never blend valuation methods.** Income, market and asset approaches sit side by side, never averaged.

1. **Four visible states.** Reported, corrected, reclassified and modelled figures are always distinguishable.

1. **Explain mechanics, not merit.** A fact plus a definition is education; calling a number a warning sign is an opinion on a security. Opinion features (ratings, targets, calls, recommendations) are built now and switched on only when the SEBI licence is in place.

1. **No false or unverifiable claims.** Anything not built is labelled as being built.

1. **AI only where its output can be checked.** Extraction with the sentence quoted and its page number is fine; AI-generated judgements are not.

1. **Every module verified before it ships.** Against the identities a correct model must satisfy, then against published worked examples.

1. **Copyright.** Books shape structure and topics; their wording, tables and numeric thresholds are not reproduced.

1. **Primary sources only.** Data comes from filings and official registers, each item linked to its document; never copied from another database.

1. **Consent for personal data.** No scraped contact databases; buyers and sellers opt in.

## 4. Platform structure

One brand, one login, one data layer, four things users see:

- **Marginalia (main site):** companies, models, research, markets data, the investor area, tools and Learn

- **Marginalia Deals (separate site):** the company marketplace

- **Marginalia for Excel:** the add-in

- **Marginalia API:** data and models for firms' systems and AI assistants

### Main site menu

- **Companies:** search, sector browsing, screener, and the company page

- **Research:** research packs, results notes, IPO notes, sector reports

- **Markets:** deals database, who-bought-what, heatmaps, IPOs, calendar, macro

- **Invest:** portfolio, thesis journal, decision scorecard, alerts, hedging education, strategies

- **Tools:** batch runs, private company model, statutory calculators, model auditor, "check any number"

- **Learn:** explainers, Margin Notes, certificate

- **Deals ↗:** link to the deals site

### The company page: the hub (one web address per company)

- **Overview:** description, price and volume chart, key figures, data freshness, factual checks, latest filings

- **Financials:** ten-plus years of actual statements (like Screener, but every number clickable to its source); reported/corrected/modelled side by side; Sankey and waterfall; segments and KPIs; metric builder

- **Filings:** all filings; search; year-on-year redline; tables to Excel; concall transcripts; answers from filings with quotes; management guidance tracker

- **Model:** three approaches side by side, football field, reverse DCF, base-rate checks, LBO; "open in model studio"

- **Research:** one-pager, two-pager, full research pack, results notes for this company

- **Ownership:** shareholding over time, promoters and pledges, insider trades, bulk and block deals, named large holders, mutual funds; "who bought or sold" timeline

- **Deals:** this company's funding rounds, acquisitions, open offers, schemes

- **Credit:** ratings and rationales, debt schedule, covenant headroom

- **Your notes:** thesis, alerts, saved models and versions

### The model studio (today's screens, kept)

Figures → Judgements → Valuation → Outputs. Outputs holds the workbook, house template, one- and two-pagers, research pack, Word report, PowerPoint pages, version history with a valuation bridge, reviewer sign-off and share links.

### The deals site

Listings (anonymous teasers), verified buyers with mandates, seller deal-readiness check, NDA, information memorandum generated from the model, deal room with process tracker and Q&A, distressed listings from IBBI notices. Free to list; success fee on completion.

### What must change on today's site

- Accounts and a server database (today nothing is stored on a server; the privacy promise must be reworded).

- Company page as the hub, with its own web address per tab; directory becomes search plus screener; landing page rewritten for three audiences; background jobs for data and alerts; payments with UPI; good phone layout; design system and verification harness extended to every new area.

## 5. Everything planned

### 5a. Engine and valuation

| **Item** | **Status** | **What it is** |
|---|---|---|
| **DCF, residual income, reverse DCF** | **Built** | Income approach; residual income for banks and financials. |
| **Refusal logic** | **Built** | Plain-English refusal naming what is missing. |
| **Market approach and choosing comparables** | **Built** | EV/EBITDA, EV/Sales, P/E on the company's own figures; user picks peers. |
| **Asset approach** | **Built** | Book, tangible book, net current asset value. |
| **Liquidation value with user recovery rates** | **In flight** | Figures reported; haircuts the user's. |
| **Adjusted EBITDA bridge** | **Built** | Every adjustment with its reason, per year. |
| **Expense classification** | **Built** | First piece of the judgement layer. |
| **Saved models reopen exactly (KI-27)** | **Now** | Save every judgement, not only sliders. |
| **Judgement layer: 16 structural + 12 smaller judgements** | **Now** | Non-recurring items, leases as debt, surplus cash, years included, growth measure, and more. |
| **Named policies, decision trail, corrections database** | **Next** | A firm saves its policy and applies it anywhere; who chose what and why; learns from user fixes. |
| **Three approaches side by side** | **Now** | Never averaged. |
| **Valuation bridge between versions** | **Now** | Which assumption moved the value, by how much. |
| **Base-rate check on growth** | **Now** | How often similar companies achieved the assumed growth. |
| **Guidance against assumptions** | **Next** | Management's guidance, quoted, next to the user's assumption. |
| **Rule-based flags** | **Next** | Factual checks over fetched data, no characterisation. |
| **Scenario comparison** | **Next** | Side-by-side scenarios on corrected figures. |
| **LBO module with refusals** | **Next** | Entry multiple, debt, exit; IRR and money multiple; labelled hypothetical take-private. |
| **Debt capacity and covenant headroom** | **Next** | Shares machinery with the LBO. |
| **Private company model** | **Next** | Typed input in the browser, then MCA filings. |
| **Company-specific beta** | **Next** | Instead of sector defaults. |
| **Precedent transactions from public filings** | **Next** | Every row linked to its filing. |
| **Segment revenue** | **Later** | Unblocked by AI extraction from filings with page references. |
| **Sector templates (banks, insurers, NBFCs, real estate, telecom)** | **Next** | Own KPIs and refusal rules each. |
| **Statutory calculators (ICDR, takeover code, Rule 11UA, FEMA)** | **Next** | Inputs traced to exchange data; draft annexure for the valuer. Formulas to be confirmed by a qualified person. |
| **Maker-checker review** | **Next** | Build, review, sign off, with cell comments. |
| **Model freeze and share link** | **Next** | Reproduce the same model years later. |
| **Refresh on new results** | **Next** | Saved model re-runs when new results file and says what moved. |
| **Monte Carlo** | **Later** | Distribution of values from assumption ranges. |
| **Narrow FP&A** | **Later** | Budget beside actuals. |

### 5b. Data

| **Item** | **Status** | **What it is** |
|---|---|---|
| **India data layer, stage 1: exchange filings (XBRL first)** | **Now** | Replace the vendor feed; figures become ours to redistribute. |
| **Stage 2: standardised statements downloadable on their own** | **Now** | Without building a model. |
| **Stage 3: reclassification layer** | **Next** | User reclassifies expenses on standard rows. |
| **Stage 4: Europe and UK (ESEF), Japan (EDINET), Korea (OpenDART), then Canada, Brazil, China, Taiwan, Australia** | **Next** | Every listed company in the world, phased by data source. |
| **Global screener and company pages: every listed company worldwide** | **Now** | Search any company by name: reported financials (ten-plus years, each number linked to its filing) plus everything Yahoo Finance shows: price, 52-week range, chart, volume, market cap, valuation multiples, dividends, holders. Not India only. |
| **Risk and cost-of-capital card for every company** | **Now** | Beta calculated by us with method shown, country risk-free rate, equity and country risk premiums, cost of equity and WACC; all sourced and editable. |
| **Country macro panel (from FRED and central banks)** | **Next** | Policy rate, 10-year yield, inflation, GDP, currency, unemployment for the company's country. |
| **FRED-style chart tools on company data** | **Next** | Growth, CAGR, index to 100, frequency conversion, formula lines mixing company and macro series, dashboards, notifications. |
| **As-first-reported vs restated history** | **Next** | Point-in-time company figures and a restatement tracker, like FRED's ALFRED. |
| **Global prices with display rights** | **Paid · last** | Built and tested on free development data; licensed end-of-day prices bought before launch, delayed intraday after. |
| **Analyst estimates and consensus** | **Paid · last** | Licensed from a data vendor before launch; the comparison screens are built now. |
| **Click any number to see its filing** | **Now** | Source image or page on hover. |
| **Filing search, year-on-year redline, tables to Excel** | **Next** | Annual reports, concalls, announcements. |
| **Ownership: shareholding, pledges, insiders, bulk/block, mutual funds** | **Next** | Exchange and AMFI disclosures. |
| **Deals database (Venture Intelligence-style)** | **Next** | From MCA, exchanges, SEBI, NCLT, CCI, IBBI, DRHPs; each deal linked to its document. |
| **Ratings and debt from rating rationales** | **Next** | CRISIL, ICRA, CARE, India Ratings. |
| **Results and events calendar; corporate actions** | **Now** | Bonus and split adjustments for per-share history. |
| **India macro detail** | **Next** | RBI rates, inflation, production, GST. |
| **ESG from BRSR filings** | **Later** | Top 1,000 listed companies file structured BRSR. |
| **Promoter group map** | **Later** | Inter-company loans, sales and guarantees within a group. |

### 5c. Outputs

| **Item** | **Status** | **What it is** |
|---|---|---|
| **Live Excel workbook** | **Built** | All statements, annexures, DCF, ratios, Checks, Sources, Assumptions. |
| **House template upload; peer workbook** | **Built** | Firm's own format; target plus ten peers. |
| **Named ranges and input validation** | **Next** | Safe to hand over. |
| **One-pager (tearsheet)** | **Now** | Description, price, key financials, multiples, model value, premium or discount. |
| **Two-pager** | **Now** | Adds valuation summary, ownership and guidance record. |
| **Research pack and Word report draft** | **Next** | See section 6. |
| **PowerPoint pages** | **Next** | Football field, comps, tearsheet linked to the model. |
| **Batch export** | **Next** | Twenty companies at once. |
| **Reformat a user's model to convention** | **Next** | Formatting only, never a number; in the browser. |
| **Model auditor** | **Next** | Hard-codes, broken links, colour conventions. |
| **Native Excel charts** | **Later** | Blocked by the export library. |

### 5d. Investor area

| **Item** | **Status** | **What it is** |
|---|---|---|
| **Naive-investor section** | **Next** | Insights from reported statements, mechanics not merit; after the India data layer. |
| **Portfolio and holdings import** | **Next** | From broker files or contract notes. |
| **Thesis journal** | **Next** | Why I bought, tied to model assumptions; "I will sell if…" recorded at purchase. |
| **Decision scorecard** | **Next** | After a year: which reasons worked, how long winners and losers were held. |
| **Alerts on WhatsApp and email** | **Next** | Filings, results, insider trades, thesis breaks; English and Hindi. |
| **Who bought or sold this share** | **Next** | See section 7. |
| **Volume trends and investing strategies** | **Next** | Education, clearly labelled; back-tests after costs. |
| **Hedging comparator** | **Next** | Protective put, collar, short future side by side, on end-of-day data. |
| **IPO section** | **Next** | DRHP-based, every number verified to its page. |
| **Live options data** | **Paid · last** | Display licence from an NSE-authorised vendor bought before launch; everything else built now on end-of-day data. |
| **Marginalia ratings and "our call"** | **Next** | Built now; switched on after SEBI Research Analyst registration; public track record from day one. |
| **Hedge recommendations** | **Next** | Built now; switched on after SEBI Investment Adviser registration. |

### 5e. Deals site

| **Item** | **Status** | **What it is** |
|---|---|---|
| **Verified buyer network with mandates** | **Later** | Funds and corporates opt in and verify; the moat. |
| **Anonymous listings and teasers** | **Later** | Generated from the Marginalia model. |
| **Information memorandum from the model** | **Later** | Every number linked to its source. |
| **Deal-readiness check for sellers** | **Later** | Audits, MCA filings, auditor remarks, related parties, pledges. |
| **NDA, deal room, process tracker, Q&A** | **Later** | Teaser → NDA → IM → offer → diligence → signing. |
| **Buyer matching** | **Later** | From past deals and stated mandates. |
| **Distressed listings** | **Later** | From IBBI invitations for expressions of interest. |
| **MCA-filing data for private companies** | **Later** | Pre-fills listings; finds sellers. |

### 5f. Add-in, API and extensions

| **Item** | **Status** | **What it is** |
|---|---|---|
| **Excel add-in with live formulas** | **Next** | =MARGINALIA("RELIANCE","EBITDA",2025) with source. |
| **Template library and link to PowerPoint/Word** | **Next** | One-click refresh. |
| **API with AI connector (MCP)** | **Next** | For firms' systems and AI assistants. |
| **Chrome extension: PDF red-flag highlighter** | **Later** | Highlights disclosed facts in annual report PDFs; no terms-of-service problem. |
| **Chrome extension: our figures on other sites** | **Later** | Verified numbers on any company page. |

### 5g. Content, learning and business

| **Item** | **Status** | **What it is** |
|---|---|---|
| **Margin Notes, did-you-know, explainers** | **Built** | 19 notes, 53 entries, 8 articles. |
| **Buffett lens** | **Built** | Questions credited to the book; its thresholds deliberately left out. |
| **"Check any number" tool** | **Now** | Paste a figure from any site; see the filed figure. |
| **Landing page rewrite** | **Now** | Three audiences. |
| **Certificate and modelling tests** | **Next** | Free certificate; screening tests for firms. |
| **Academic licences** | **Next** | Per campus. |
| **Explainer video** | **Later** | Screen capture of the real product, once stable. |
| **Animated advertisement** | **Idea** | Not scoped. |
| **MCQ platform (from FR book)** | **Idea** | Separate product. |
| **Pricing tiers** | **Next** | Free, Investor, Professional, Firm, Academic; deals on success fee. |
| **SEBI opinion** | **Now** | One qualified opinion on research, advice, finfluencer and merchant banker questions before money is taken. |
| **Data protection** | **Now** | DPDP Rules obligations from 13 May 2027; design for them now. |
| **Watch two numbers** | **Now** | How many users correct a figure; how many open a second company. |

## 6. Equity research section (new)

Goal: give every user a research report on any listed company, as good as a broker's initiation in structure, but with every number sourced and every judgement visible. Everything below is built now; opinion parts are switched on at launch, once the SEBI licence is in place.

### Research packs (built now)

A research report that gives an opinion on the value of a security needs SEBI Research Analyst registration. Packs are built with both modes: user-authored (facts, the user's model, the user's conclusion) and Marginalia-authored (with rating and target), the second switched on after registration.

1. **One-pager.** Description, price, ten-year key financials, ratios, multiples against peers, the user's model value, ownership changes.

1. **Two-pager.** Adds three-approach valuation, football field, guidance record, risk factors as disclosed, insider and promoter activity.

1. **Full research pack (initiation-style, 15–25 pages).** Cover; summary written by the user; business and segments; industry; financial analysis; quality of earnings; valuation (DCF, comps, asset); scenarios; risks as disclosed; governance and ownership; management guidance record; appendix statements; sources. Word and PDF, figures linked to the workbook.

1. **Results note.** Within hours of results: this quarter against last year and against guidance, what changed in the model, concall quotes. Facts only.

1. **Concall note.** Guidance, targets and commitments, each with speaker and minute.

1. **IPO note.** From the DRHP: offer structure, use of proceeds, pre-IPO prices, the issuer's own peer list, restated financials, litigation; every number verified to its page.

1. **Sector report.** Industry structure, KPIs, peer table, recent deals.

- **For students and competitions:** the same pack is a strong starting point for the CFA Research Challenge and college competitions.

- **AI use:** AI drafts only from quoted facts; every sentence carries its source. SEBI's 2024 amendment already requires registered analysts to disclose the extent of AI use, so build that disclosure into every pack now.

### Marginalia Research with ratings and targets (built now, switched on after registration)

- Ratings and target prices, written by a registered analyst, with all required disclosures (conflicts, holdings, AI use).

- A public track record of every call from day one, like Value Line and WallStreetZen publish theirs.

- Hindi and other languages, as EquiSense already offers.

### Where it lives

Research menu (all packs and notes), Company › Research (one company), Studio › Outputs (generate from your model).

## 7. Who bought or sold this share (new)

When someone opens a company, a timeline shows named people and institutions who bought or sold its shares, with dates, amounts, and what the price did afterwards.

### India (the main market)

- **Insiders and promoters:** SEBI insider-trading rules require promoters, directors and designated persons to disclose trades above a threshold; companies pass these to the exchanges within two trading days.

- **Bulk and block deals:** NSE and BSE publish the buyer and seller names daily.

- **Large shareholders:** Each quarter, companies list holders above 1%. Tracking these names across companies shows what well-known investors added or cut.

- **Substantial acquisitions:** Takeover-code disclosures when holdings cross 5% and change by 2% thereafter.

- **Mutual funds:** Monthly portfolio disclosures show which funds bought or sold.

### United States (for US companies on the site)

- **Corporate insiders:** SEC Form 4, filed within two business days.

- **Members of Congress:** STOCK Act disclosures within 45 days, in value ranges.

- **The US President and senior officials:** Office of Government Ethics Form 278-T periodic transaction reports, in value ranges. Donald Trump's Q1 2026 report listed 3,642 transactions (including purchases of Oracle, Microsoft, Amazon, Nvidia and Apple), filed weeks after the quarter.

- **Large funds:** Quarterly 13F holdings.

### How to show it honestly

- Show the facts: who, role, date traded, date disclosed, amount or range, and the price change 1 week, 1 month and 6 months after. Let the user judge.

- Show the delay: insider data is days old, Congress data up to 45 days, presidential reports months. Many presidential and fund trades are made by managers, not the person.

- Signal labels and interpretation are built now and switched on after registration; until then the facts alone are shown.

- Leave out Indian politicians' election-affidavit holdings for now: they are filed only at elections and are sensitive.

### Where it lives

Company › Ownership ("who bought or sold" timeline); Markets › Who bought what (screens such as "promoter buying this week", "cluster buys", "well-known investors' new positions"); Invest › Alerts.

## 8. What EquiSense does well, and what we take

EquiSense (founded 2025, Wealthveda Technology) explains 5,500+ NSE and BSE companies in plain English, Hindi and Gujarati, and positions itself as an information platform, not a SEBI-registered adviser. Studied page by page:

1. **WhatsApp first.** Alerts and login by WhatsApp; payment by UPI. Take: alerts on WhatsApp from launch.

1. **Theme alerts.** "The next big Defence order was just filed": alerts by theme across all companies, not only a watchlist. Take: theme alerts.

1. **Results at a glance.** Every result in one table during earnings season, filterable by sector and watchlist, with a one-line takeaway. Take: the table and takeaway, as facts without positive/negative tags.

1. **Live concalls.** Live call audio and guidance extracted within minutes. Take: concall notes with speaker and minute.

1. **Walk the Talk.** Whether management delivered its guidance over 8+ quarters. Take: and link it to the user's model assumption.

1. **IPO decoded.** Every DRHP number verified against its page. Take: our IPO note, same standard.

1. **360° profile.** Governance, accounting quality, pledges and red flags, scored. Take: facts and scores, built now; scores switched on after registration.

1. **News and deals timeline.** Announcements, bulk deals and insider trades in one timeline. Take: the "who bought or sold" timeline.

1. **Report incorrect data.** A link on every page. Take: feeds our corrections database.

1. **AI connector for Claude.** An MCP server. Take: our API ships with one.

**Where Marginalia goes further:** the editable model behind every number, the Excel workbook, professional depth (LBO, statutory calculators, maker-checker), and the deals site. EquiSense tells you what happened; Marginalia lets you work out what it is worth and defend it.

## Launch principles (decided 12 October 2026)

- Nothing is held back because Marginalia lacks a SEBI licence. Every feature, including ratings, recommendations and research with opinions, is built now on the private site, with the regulations designed in.

- The site goes public only after the required licences are received.

- Features that cost money are built last, just before launch: licensed global prices, live options data, analyst estimates, WhatsApp message delivery, document storage for uploads, AI document reading at full scale, MCA document fees at scale. Each is built and tested on a small or free sample first.

- Not wanted: scraped contact databases (controversial with IB and PE professionals; data protection law) and placing trades.

- Outreach to users starts once the product is fully developed.

## 9. Decided against, and why

1. **Hand-built company models on the site.** Only the engine builds models; the hand-built Apple file is a test fixture.

1. **Averaging the valuation approaches.** They answer different questions.

1. **A floor on forecast capital spending.** Built, measured and rejected.

1. **Exit multiple from peer medians.** Built, measured and rejected.

1. **Scraping court records for litigation.** Replaced by what the company itself discloses.

1. **Showing licensed precedent data on the site.** Not without written redistribution permission.

1. **Placing trades.** Not a broker; no order execution. Not wanted.

1. **Scraped or bought contact databases.** Illegal or high-risk under data protection law; Lusha was fined €2 million in Italy in 2026. Replaced by an opted-in buyer network.

1. **Copying other databases (Venture Intelligence, Tracxn).** Build from primary sources only.

1. **"No student-built tool has this" as marketing copy.** Cannot be verified.

1. **"Learn it by hand in Excel first" as a gate.** Removed on 11 October 2026; verification against identities and worked examples remains.

## 10. Open questions for reviewers

If you are a person or an AI tool reading this, these are the questions where new ideas help most:

1. **What would make a CA firm pay ₹50,000 a year for this?** Which single feature is missing?

1. **What would make a retail investor open the app every day?** Without giving opinions on securities.

1. **How should the deals site get its first 50 verified buyers and first 20 sellers?**

1. **Which Indian public data sources have we missed?** Structured, free or cheap, legally reusable.

1. **What could go wrong?** Regulatory, data accuracy, AI errors, security. What check would catch it?

1. **What should we stop doing?** Which planned item adds the least?

## Sources for the newest sections

- EquiSense pages: https://equisense.ai (alerts, discover, research, deep-dive, glance, concalls, ipo, disclaimer)

- Trump Q1 2026 Form 278-T: https://www.benzinga.com/news/politics/26/05/52576337/trump-q1-2026-trade-disclosure-nvidia-amd-palantir-microsoft-oracle

- White House periodic transaction report (example): https://www.whitehouse.gov/wp-content/uploads/2025/11/President-Donald-J.-Trump-Periodic-Transaction-Report-11.14.25.pdf

- Congressional trading rules and data: https://www.quantvps.com/blog/congressional-stock-trading-rules-and-data-sources

- Tracking Indian large investors: https://tradingqna.com/t/how-to-track-portfolio-of-investors-like-rakesh-jhunjhunwala-dolly-khanna-ramesh-damani-ashish-kacholia-etc/111598

- SEBI Research Analyst amendment 2024 (AI disclosure): https://www.scconline.com/blog/post/2024/12/19/sebi-research-analyst-third-amendment-regulations-2024/

- Earlier research in this project: Competitor Study v2 and Platform Structure documents (11–12 October 2026).
