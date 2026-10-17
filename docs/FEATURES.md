<!-- Converted from docs/plan/Marginalia_Feature_Bible.docx on 2026-10-17.
     The content is the document's own: every tool, every table row, every
     status and every link. Two things differ, both presentational: Word's
     Heading 1 and Heading 2 become `##` and `###` so the hierarchy survives
     under one title, and Word's blanket bold inside tables is kept only on the
     header row, the first column and the where-and-when column. The .docx
     remains in docs/plan/ as the original. -->

# Marginalia — Feature Bible

12 October 2026. Every feature of the 27 shortlisted tools, plus FRED and Yahoo Finance, in plain words, with how Marginalia will provide it. Then the new features we get by combining them. Companion to the Product Vision and Idea Book.

## How to read this

- **Update 12 October 2026:** nothing waits on SEBI. Every feature marked "later", "after registration" or "if licensed" is built now on the private site and switched on at public launch. Features needing paid data or services (global prices, live options, analyst estimates, WhatsApp delivery, storage, full-scale AI reading) are built last, just before launch. Scraped contact data and trade execution are not wanted.

- Each tool has a table: their feature, what it does in plain words, the Marginalia version, and where it lives and when (Now = next 6 months, Next = 6–12 months, Later = waits on a licence, data or the deals site, Built = live today).

- Where Marginalia deliberately does it differently (because of our rules on sources, opinions or consent), the table says so.

- Part D lists 30 new features made by combining two or more tools. Those are marked ★ and are where most of the value lies: no single tool offers them.

- Research method: each tool's own website, help centre, product documents and live pages (e.g. Yahoo's and Simply Wall St's Reliance pages, DeepFundamental's Apple page, FRED's full help centre). Fiscal.ai and The Ledger Terminal block automated reading, so their documentation and directory listings were used. HypeEquity's site is offline.

## Part A. The global company page: search any listed company in the world

Correction to the Idea Book: the screener and company pages cover every listed company in the world, not only India. A user types a company name and gets everything Yahoo Finance shows, plus what Yahoo does not: actual reported financials with sources, a transparent beta and cost of capital, the country's macro picture, and an editable model.

### What the page shows

1. **Quote strip.** Price, change, previous close, open, day range, 52-week high and low, volume and average volume, market cap, enterprise value, currency, exchange, delay notice.

1. **Chart.** 1D to All, line or candles, compare with index or peers, annotated with filings and events, moving averages, total return including dividends.

1. **Key statistics.** P/E (trailing and forward), PEG, P/S, P/B, EV/Revenue, EV/EBITDA, each with its quarterly history; margins; ROE, ROA, ROIC; per-share figures; growth; cash, debt, debt/equity, current ratio, book value per share; 50- and 200-day averages; float, shares outstanding, insider and institutional holding %, short interest where reported; dividends, payout, ex-date, splits and bonuses.

1. **Risk and cost of capital card.** Beta calculated by us against the local index, with the method, window and a peer-average alternative shown; the country's risk-free rate (government 10-year yield), equity risk premium and country risk premium, each with source and date; resulting cost of equity and WACC. The user can change any input.

1. **Country macro panel.** From FRED, central banks, IMF and World Bank data: policy rate, 10-year yield, inflation, GDP growth, currency against USD and INR, unemployment, with charts and next release dates.

1. **Financials.** Ten-plus years annual and quarterly, as reported and standardised, every number clickable to its filing; TTM; units and currency switch; Sankey and waterfall.

1. **Profile.** Description, sector, industry, employees, fiscal year-end, address, website, key executives and their pay, board, auditors.

1. **Holders.** Major holders, insiders, institutions and funds, and the "who bought or sold" timeline.

1. **Analysis.** Management guidance against actual results; the user's model; analyst estimates only if licensed.

1. **Options.** Chain and implied volatility where data is licensed; end-of-day first.

1. **ESG.** From the company's own sustainability filings (BRSR in India, ESEF/CSRD in Europe), not third-party scores.

1. **News and filings.** Exchange announcements, results, transcripts, press releases, filings, in one timeline.

1. **Compare.** Up to 10 companies side by side, any metric.

1. **Data status.** When each piece was last updated, from which source, and which automated checks it passed.

### Why we can beat Yahoo on trust: what we found on Yahoo's Reliance page (9 October 2026)

- Beta shown as 0.19 (5-year monthly), with no method or alternative. A user plugging that into a cost of equity would get a badly wrong value.

- TTM EBITDA shown as 1.42T, identical to EBIT, while each annual column shows EBITDA well above EBIT: depreciation is missing from the TTM figure.

- Analyst table shows "year ago sales" of 5.06T and growth of 134%, inconsistent with the 10.57T revenue on the financials tab.

- The October 2024 bonus issue appears as a "2:1 split"; return on equity, return on assets and operating cash flow show "--"; the options and holders tabs are empty for this Indian stock; executive pay is dated "as of December 31, 2026".

- Yahoo's footnotes show its data comes from Refinitiv, Morningstar, EDGAR Online and S&P. Marginalia's answer: every number from the company's own filing, with a link, and checks that would catch each of the errors above.

### Where the data comes from, country by country

1. **United States.** SEC XBRL filings (already used by Marginalia). Free.

1. **India.** NSE and BSE XBRL results and filings; MCA for private companies.

1. **European Union and UK.** Listed companies file annual reports in a structured XBRL format (ESEF); XBRL International's filings.xbrl.org collects them. UK Companies House offers free accounts data.

1. **Japan.** EDINET, the regulator's filing system, with a free API and XBRL.

1. **South Korea.** OpenDART, with a free API.

1. **Others.** Canada (SEDAR+), Brazil (CVM open data), China (CNINFO), Taiwan (MOPS), Australia (ASX announcements). Phased in after the above.

1. **Prices worldwide.** Must be licensed from a market data vendor with display rights; end-of-day first, delayed intraday later.

1. **Risk-free rates and macro.** FRED (including OECD long-term government yields for many countries), central banks, IMF, World Bank.

1. **Equity and country risk premiums.** Professor Aswath Damodaran publishes these free each year; cite and date them, and let users override.

*Honest note: full global coverage is a multi-stage build and prices are a real cost. The order follows the data: US and India first, then Europe/UK, Japan and Korea, then the rest. Every page says which stage its country is at.*

## Part B. FRED in depth

FRED (Federal Reserve Economic Data, St. Louis Fed) holds hundreds of thousands of economic series from over 100 sources, free. Studied through its full help centre and series pages.

| **Their feature** | **What it does (plain words)** | **Marginalia version** | **Where · when** |
|---|---|---|---|
| **Search, categories, releases, sources, tags** | Find any series by keyword or by browsing who publishes it and when | Same for company data: browse by sector, country, exchange, filing type; tags like "dividend payer", "bank" | **Companies · Now** |
| **Series page** | Latest value, units, frequency, last updated, next release date, notes, source, citation | Each company figure gets the same: last updated, next results date, source, suggested citation | **Company · Now** |
| **Edit graph: units** | Change, % change, % change from year ago, compounded annual rate, index = 100 | Same switches on every company chart (growth, CAGR, index to 100) | **Company · Now** |
| **Edit graph: frequency and aggregation** | Turn monthly into annual by average, sum or end-of-period | Quarterly to annual, fiscal to calendar year, with the method shown | **Company · Next** |
| **Formula lines** | Combine series with a, b, c and + − × ÷ ^ (e.g. a/b) | Formula lines mixing company and macro data (e.g. Reliance revenue ÷ Brent price) | **Company, Markets · Next ★** |
| **Add series, straight lines, line settings** | Several series on one chart, user-drawn reference lines, styling | Same | **Company · Now** |
| **Recession bars** | Shaded recession periods on every chart | Shade recessions, rate-hike cycles and company events on charts | **Company · Next** |
| **Order of processing explained** | Documented order of transformations | Document our transformations the same way in METHODOLOGY | **Learn · Now** |
| **Growth-rate formulas published** | Exact formulas for each unit option | Publish every ratio and growth formula | **Learn · Now** |
| **Download** | Excel, CSV, PNG image, PowerPoint slide | Every chart and table: Excel, CSV, image, PowerPoint | **All · Now** |
| **Share, embed, short links** | Link to a custom graph; embed on websites, auto-updating or frozen; responsive embed | Shareable and embeddable company charts and tables; a free source of links back to us | **All · Next** |
| **Embeddable widget** | A small "FRED at a glance" widget for any site | A "Marginalia at a glance" company widget for blogs and news sites | **API · Later** |
| **Account: favourites, saved graphs, saved maps** | Keep your work | Saved charts, screens, models | **Account · Now** |
| **Email notifications on new data** | Told when a series updates | Told when a company files, or when a metric you watch changes | **Invest · Next** |
| **Data lists, downloadable and publishable** | Group series, download together, publish a public list (used by teachers) | Company lists you can download and publish; teachers share them with classes | **Account, Learn · Next** |
| **Dashboards with widgets** | Graph, table, single value, data list, notes, map, spacer; drag to arrange; export to PowerPoint; download all data; make public | Personal dashboards mixing companies, macro and notes; publishable | **Account · Next ★** |
| **Maps** | Regional data on maps; change date, units, colours, groups; export and embed | World map of markets and countries (valuations, returns, macro); company footprint maps from disclosed plants and stores | **Markets · Next** |
| **ALFRED vintages** | Every past version of a series: what was known on any date | Point-in-time company data: as first reported vs restated, and a restatement tracker | **Company · Next ★** |
| **Release calendar** | When each release is due | Results calendar worldwide, plus macro releases | **Markets · Now** |
| **Excel add-in** | Pull series into Excel by ID | Marginalia add-in pulls company and macro data by ticker | **Add-in · Next** |
| **API and MCP connector** | Programmatic access; an official AI connector with sign-in | Same for us | **API · Next** |
| **Mobile apps** | iOS and Android | Phone-friendly site first; app later | **All · Later** |
| **Data accuracy desk** | New releases validated against past releases; deviations investigated; links back to source | Our verification harness, run on every data load; publish how we check | **Behind everything · Now** |
| **Digital badges and tutorials** | Free courses with badges | Marginalia certificate | **Learn · Next** |
| **FRASER, CASSIDI, FRED-MD** | Historical documents library; bank market concentration; research-ready datasets | Library of historical annual reports per company; bank sector concentration; research datasets for academics | **Learn, Markets · Later** |

**What Marginalia uses from FRED directly:** risk-free rates for many countries (OECD long-term yields), inflation, GDP, exchange rates, policy rates, commodity prices (oil, metals) for the macro panel and for macro-to-company charts. FRED data is public domain with citation requested; some series carry their source's own terms, so check each.

## Part C. Yahoo Finance in depth

| **Their feature** | **What it does (plain words)** | **Marginalia version** | **Where · when** |
|---|---|---|---|
| **Summary** | Quote, ranges, volume, market cap, beta, P/E, EPS, earnings date, dividend, 1-year target | Quote strip and key stats (Part A); targets only if licensed | **Company · Now** |
| **Performance vs benchmark** | YTD, 1, 3, 5-year total return against the local index | Same, plus in the user's own currency | **Company · Now** |
| **Statistics** | Valuation history by quarter; profitability; balance sheet; trading info; share statistics; dividends and splits; footnotes naming data vendors | Same, from filings, with formulas and sources | **Company · Now** |
| **Financials** | Annual, quarterly, TTM; 1–20 years; units; normalised income; reconciled items | Same, as reported and standardised, clickable to source | **Company · Now** |
| **Analysis** | Revenue and EPS estimates, surprises, EPS trend and revisions, growth estimates vs index | Guidance vs actual; user model; estimates only if licensed | **Company · Next** |
| **Earnings trends** | EPS estimate vs actual chart; revenue vs earnings chart | Results history chart with guidance | **Company · Now** |
| **Historical data** | Daily, weekly, monthly prices, adjusted close, dividends, splits, download | Same, with bonus issues handled correctly | **Company · Now** |
| **Profile** | Executives with pay and birth year, address, employees, description, governance risk scores (US) | Same from annual reports; governance facts, not third-party scores | **Company · Now** |
| **Holders** | Major holders, insider roster, insider transactions, top institutional and fund holders | Ownership tab and "who bought or sold" | **Company · Next** |
| **Options** | Chain, implied volatility, straddle view, 15-minute delay | End-of-day chain first; live after licence | **Invest · Later** |
| **Seasonality** | Average returns by month | Same | **Company · Next** |
| **Sustainability** | Third-party ESG risk scores and controversy level | Company's own ESG filings | **Company · Later** |
| **News feed** | News, earnings calls, press releases, SEC filings | Filings-first timeline | **Company · Now** |
| **Conversations** | Community message board per stock | Public theses tied to models instead of chatter | **Invest · Later** |
| **Compare and "people also watch"** | Up to 4 peers; related tickers | Up to 10 peers; peers chosen by our method | **Company · Built/Now** |
| **Portfolios, watchlists, screeners** | Track holdings, lists, screens | Invest and Companies | **Next** |
| **Markets pages** | Trending tickers, gainers, losers, most active, sectors, crypto heatmap, earnings and economic calendars | Markets menu | **Now/Next** |
| **Premium tier** | Extra data and charts (AlphaSpace for real-time) | Paid plans | **Next** |

## Part D. Combined features (★): what no single tool offers

1. **★ As-first-reported vs restated (ALFRED + filings).** Every company figure as originally reported and as later restated, with a restatement tracker and alerts. Shows when a company quietly revises history.

1. **★ Chart anything (FRED formulas + company data + DeepFundamental metrics).** One formula language across company and macro series: Reliance revenue ÷ Brent; bank loan growth vs nominal GDP.

1. **★ Macro sensitivity card (FRED + model).** For each company, its key macro drivers and a scenario slider: "if crude rises 10%, model value moves X".

1. **★ Transparent cost of capital (Yahoo stats + FRED + Damodaran + our beta).** A WACC card for every listed company in the world, every input sourced and editable.

1. **★ Thesis alerts (FRED notifications + EquiSense WhatsApp + journal).** Alert when a company result or macro series breaks an assumption the user wrote in their thesis.

1. **★ Implied-growth world map (Finviz maps + reverse DCF).** Every market and sector coloured by the growth its prices imply.

1. **★ Insider track record (OpenInsider returns-after + WallStreetZen analyst records).** Each insider's and each well-known investor's past trades and what the price did after, across companies.

1. **★ What managers said vs what they bought (Fiscal.ai fund letters + 13F + Indian mutual fund disclosures).** A fund manager's letter beside the fund's actual buying and selling.

1. **★ Street vs management vs you (Yahoo estimates + guidance tracker + model).** Three numbers side by side for every forecast line: analyst consensus (if licensed), management guidance, the user's assumption.

1. **★ What changed and did they deliver (BamSEC redline + EquiSense Walk the Talk).** Year-on-year annual report changes next to the record of past promises.

1. **★ Annotated price chart (Capital IQ annotations + filings timeline).** Every filing, result, insider trade and corporate action pinned on the price chart.

1. **★ Decision replay (TradingView bar replay + thesis journal).** Replay any past decision with only the information available on that day.

1. **★ Back-test any checklist (Composer back-tests + Simply Wall St checks + Value Line ranks).** Education: how a set of factual checks would have done historically, after costs.

1. **★ Results-day move history (E*TRADE earnings move analyser + results notes).** How the share moved after each past result, beside what the result was.

1. **★ Is protection cheap now? (Optionistics IV history + hedging comparator).** The cost of a hedge today compared with its own past.

1. **★ Ask 500 companies one question (Clay AI per row + filings Q&A).** One question across a whole sector, each answer quoted with its page.

1. **★ CEO pay vs performance (Simply Wall St management checks + annual reports).** Pay against peers and against returns, from disclosed remuneration.

1. **★ Board interlocks (Capital IQ relationship trees + MCA director IDs).** Directors who sit on several boards, and the companies they connect.

1. **★ Personal dashboards (FRED dashboards + company pages).** Mix companies, macro, notes and screens; publish for a class or team.

1. **★ Live pitch pages (Macabacus linking + model + tearsheet).** Football field, comps and tearsheet in PowerPoint that refresh from the model.

1. **★ Recipes (Alteryx workflows + batch + house templates).** Save "load, apply policy, export in our format" and run it on 50 companies.

1. **★ Buyer scoring for listings (Capital IQ Find Buyers + Grata buyer lists + deals database).** Each listing gets a ranked list of likely buyers with reasons.

1. **★ India private market maps (PitchBook market maps + MCA filings).** Visual maps of private companies by sector with filed revenue bands.

1. **★ Deal terms benchmark (Preqin Term Intelligence + SEBI open-offer letters and DRHPs).** What terms are normal in Indian deals, sourced.

1. **★ Verified mandates feed (Grata Deal Network + deals site).** Verified buyers see live, mandated deals only.

1. **★ Buyer interest tracker (Smartlead intent inbox + Sales Navigator intent).** Sellers see which verified buyers opened the teaser and how far each has gone.

1. **★ Data quality badge (Ledger Terminal QA + FRED data desk + our harness).** Each company page shows which automated checks its data passed.

1. **★ Company FAQ pages (WallStreetZen FAQ + our sourced data).** Answers to common questions per company ("What is Reliance's debt?"), each with source; brings search traffic.

1. **★ Curated verified universe (Value Line 600 + our harness).** A set of companies whose models are fully verified, marked as such.

1. **★ Returns in your currency (Yahoo performance + FRED exchange rates).** Any stock's return converted to the user's home currency.

## Part E. Tool by tool, every feature

## E1. Private markets and deals

### PitchBook

*Private and public market database for PE, VC and bankers. Sources: product pages, "PitchBook for Dealmakers" guide, university library guide.*

| **Their feature** | **What it does (plain words)** | **Marginalia version** | **Where · when** |
|---|---|---|---|
| **Company profiles** | Financing history, valuations, investors, competitors, financials for 13M+ companies | Global listed pages plus Indian private companies from MCA filings | **Company · Now/Later** |
| **Round-by-round cap tables** | Who owns what after each round, liquidation preferences, voting rights | Private cap tables from MCA allotment and annual return filings | **Company › Deals · Later** |
| **Deal database** | VC, PE, M&A, IPO, buyouts, PIPEs, with sizes and multiples | Deals database from primary sources | **Markets › Deals · Next** |
| **Valuations and deal multiples** | Pre- and post-money values; purchase multiples | Precedent multiples per deal, sourced | **Studio · Next** |
| **Fund data and benchmarks** | Dry powder, returns (IRR, TVPI, DPI), fund teams, peer benchmarks | Fund profiles from SEBI register and fund sites; return context for LBO | **Deals site · Later** |
| **Normalised public financials, segments, consensus** | Adjusted EPS/EBITDA; segment and geographic data; 800+ analysts' estimates | Adjusted EBITDA bridge (built); segments by extraction; estimates only if licensed | **Company · Built/Next** |
| **Calculation drill-down** | See how each figure was calculated | Click-to-source and formula shown | **Company · Now** |
| **Capital structure** | Debt and equity breakdown, waterfall charts, WACC, solvency ratios, dilution | Credit tab and WACC card | **Company · Next** |
| **Ownership** | Top holders, changes over time, 13F and insider data | Ownership tab | **Company · Next** |
| **Guided buyer list; active acquirers** | Find likely buyers with comparable deals | Buyer scoring for listings | **Deals site · Later** |
| **Professionals, advisers, validated emails** | Find people and their deals; contact details | Opt-in profiles only; adviser pages with tombstones | **Deals site · Later** |
| **Market maps** | Visual sector maps, exported with logos | Sector maps for listed and private companies; export to PowerPoint | **Markets · Next** |
| **Market sizing; emerging spaces** | 120k market size estimates; 125+ emerging spaces with deal metrics | Sector reports with sourced market sizes (government and industry bodies) | **Research · Later** |
| **Research centre and analyst access** | 220k reports; call the analyst; Morningstar research and DCFs | Research packs and sector reports; "ask the author" for firm plans | **Research · Next** |
| **Transcripts across companies** | Search earnings calls of many companies at once | Concall library with cross-company search | **Company › Filings · Next** |
| **Boolean search, pivot tables, ML charting** | Complex searches; pivot results | Screener with AND/OR logic and pivot view | **Companies · Next** |
| **Saved searches and alerts** | Daily, weekly or monthly alerts on new matches | Saved screens with alerts | **Account · Next** |
| **Workspaces** | Shared files, lists, maps; comments; activity log; permissions | Team workspaces | **Account · Next** |
| **Analyst-curated verticals, pre-built searches** | 50+ curated markets, 100 ready searches | Curated screens by theme, written by us | **Companies · Next** |
| **Excel plugin, 30 templates; PowerPoint; Chrome; mobile; CRM; API** | Data wherever the user works | Add-in, templates, extension, API; CRM later | **Add-in/API · Next** |
| **Free certification (Pioneer)** | Courses that build familiarity | Marginalia certificate | **Learn · Next** |
| **Export limits** | Library users capped at 10 rows a day | Generous exports as a differentiator | **All · Now** |

### S&P Capital IQ Pro

*The standard bank terminal. Sources: product page, university user guide.*

| **Their feature** | **What it does (plain words)** | **Marginalia version** | **Where · when** |
|---|---|---|---|
| **Company tearsheet with menu** | One page per company, sections in a side menu | Company hub | **Company · Now** |
| **Auditing financials** | Drill from any figure to the source report and see how it was standardised | Click-to-source plus "how we standardised this line" | **Company · Now** |
| **Estimates and custom consensus** | Broker consensus; build your own consensus from chosen analysts | Licensed before launch; screens built now | **Company · Paid · last** |
| **Transactions** | M&A, buybacks, IPOs, spin-offs with multiples, advisers, filings | Deals tab including buybacks | **Company › Deals · Next** |
| **Fixed income** | Each bond's terms, pricing, yield, covenants | Listed bonds and NCDs per company | **Company › Credit · Later** |
| **Ownership history** | Holdings with dates and history | Ownership tab | **Company · Next** |
| **Professionals and relationship paths** | Executive and board profiles; how people connect | Board interlocks from director IDs ★ | **Company · Later** |
| **Events calendar to Outlook; transcripts as PDF, Word, audio** | Add events to your calendar; transcripts in many formats | Calendar export; transcripts | **Markets · Now** |
| **Key developments** | Dated list of company events with synopses | Event timeline | **Company · Now** |
| **Annotated stock chart** | Headlines pinned on the chart; export to Excel | Annotated chart ★ | **Company · Now** |
| **Quick Comps; similar transactions** | Instant peer and deal comparisons | Peers (built); similar deals | **Built/Next** |
| **Screening 1,000+ criteria; "where is my company?"** | Screen companies, deals, people, bonds; see where one company ranks | Screener plus rank-within-screen | **Companies · Next** |
| **Find Buyers** | Scored buyer matching | Buyer scoring | **Deals site · Later** |
| **Market analysis dashboards** | Industry aggregates, performance, events | Sector pages | **Markets · Next** |
| **Office plug-in** | Right-click audit, link to source, formula builder, 180 templates, modelling team builds models for you | Add-in; paid "model conversion" service later | **Add-in · Next** |
| **ChatIQ, Document Intelligence, Chart Explainer, ChatIQ Spreadsheets** | AI answers with sources; sentiment and summaries; AI explains charts; AI builds and reviews spreadsheets | Quoted answers only; model auditor with plain explanations | **Company, Add-in · Next** |
| **Macro and country risk (236 countries)** | Economic data and country risk research | Macro panel and country risk premiums | **Company · Next** |
| **Mobile with push alerts; Academy; 24x7 support** |  | WhatsApp alerts; certificate; firm support plan | **Next** |

### Preqin

*Alternative assets data. Sources: product pages.*

| **Their feature** | **What it does (plain words)** | **Marginalia version** | **Where · when** |
|---|---|---|---|
| **Investor and manager network** | 250,000 decision-makers for prospecting | Opt-in verified buyer network | **Deals site · Later** |
| **Fund performance and benchmarks (free sample)** | Returns by strategy and vintage | Context for LBO and fund pages | **Later** |
| **Term Intelligence** | Benchmark fund terms; fee items; compliance traffic light | Deal terms benchmark from Indian filings ★ | **Deals site · Later** |
| **Transaction Intelligence** | Entry and exit multiples, leverage, loss ratios, box plots | Precedents with leverage and outcomes where disclosed | **Studio · Later** |
| **Cash-flow pacing and J-curve** | Forecast a fund portfolio's cash calls and distributions | For family offices on the deals site | **Later** |
| **Visual analytics; productivity tools; research reports; Academy** |  | Charts; reports; Learn | **Next** |
| **Data contribution** | Firms give data for access | Advisers report deals for league-table credit | **Deals site · Later** |
| **API, feeds, MCP, partner integrations** |  | API | **Next** |

### Grata (including Sourcescrub)

*Private company search; Sourcescrub merged into it. Sources: product and help pages.*

| **Their feature** | **What it does (plain words)** | **Marginalia version** | **Where · when** |
|---|---|---|---|
| **Search by business description; similar companies** | Find companies like a reference company | Peers by description for listed and private companies | **Companies · Next** |
| **Registry filings structured (Europe, 100M+)** | Company-registry accounts made searchable | MCA filings structured for India | **Deals site · Later** |
| **Seller intent signals** | Signs a company may sell | Factual signals from filings | **Deals site · Later** |
| **Buyer and banker lists** | Lists of acquirers and advisers for a deal | Buyer scoring; adviser directory | **Deals site · Later** |
| **Grata Deal Network** | Browse verified active deals | Verified mandates feed ★ | **Deals site · Later** |
| **Conference lists and travel planning** | Attendee lists matched to criteria | Trade-fair exhibitor lists to find sellers | **Deals site · Later** |
| **Market fragmentation; private market index** | Where markets are unconsolidated; momentum | Sector pages with concentration measures | **Markets · Later** |
| **Pipeline management; shared lists** | Track deals by stage with a team | Buyer pipeline on the deals site | **Deals site · Later** |
| **Extensions, CRM, Excel add-in, API, warehouse, MCP, mobile** |  | Same delivery set | **Next/Later** |

## E2. Modelling, filings and data tools

### BamSEC

*Filings and transcripts reader. Sources: site and help docs.*

| **Their feature** | **What it does (plain words)** | **Marginalia version** | **Where · when** |
|---|---|---|---|
| **Search across all filings and transcripts** | Find any phrase in any document | Same for every country we cover | **Company › Filings · Next** |
| **Screen by document text** | Find every company whose filings mention a phrase | Text screens ("all companies mentioning a capacity expansion") | **Companies · Next** |
| **Table tools; similar tables** | Any table to Excel; same table across past periods | Same | **Filings · Next** |
| **Compare filings** | Redline between two documents | Year-on-year annual report redline ★ | **Filings · Next** |
| **Link to text or table; highlights** | Share exact locations; highlight passages | Same, plus links from workbook cells | **Filings · Next** |
| **Key exhibits** | Credit agreements, indentures, material contracts | Debt agreements, SHAs, schemes | **Filings · Next** |
| **Insider transaction summaries** | Insider trades per company | Who bought or sold | **Ownership · Next** |
| **Email alerts; watched list; documents feed** |  | Alerts (WhatsApp and email) | **Invest · Next** |

### Macabacus

*Excel, PowerPoint and Word add-in for bankers. Source: features page.*

| **Their feature** | **What it does (plain words)** | **Marginalia version** | **Where · when** |
|---|---|---|---|
| **Formula auditing; error visualisations; Model Check** | Find errors and inconsistencies | Model auditor | **Add-in · Next** |
| **100+ shortcuts; spreadsheet formatting** | Format numbers, colours, borders fast | Reformat to convention | **Add-in · Next** |
| **Power tools; file optimisation** | Fix common model pain points; shrink files | Same | **Add-in · Later** |
| **Charting, brand-compliant** | Complex charts in house style | Charts in the firm's house style | **Add-in · Later** |
| **Insert ready tables (DCF, Black-Scholes)** | Drop analysis blocks into any sheet | Insert Marginalia DCF, WACC, sensitivity blocks | **Add-in · Next** |
| **Link Excel to PowerPoint and Word** | One-click refresh of linked content | Live pitch pages ★ | **Add-in · Next** |
| **PowerPoint tools: agendas, pagination, shapes, MasterShapes, Omnibar** | Faster deck building | Not core; partner instead | — |
| **Corporate dictionary; proofing; template rules; Deck Check; AI deck review** | Consistent wording and required slides | House style rules for our research packs and reports | **Research · Later** |
| **Shared libraries; slide linking; tombstones; logo library; user groups** | Firm content in one place | Firm workspace library; adviser tombstones on deals site | **Account, Deals · Later** |
| **Doc Builder** | NDAs and engagement letters from a questionnaire | Auto-generated NDA on the deals site | **Deals site · Later** |
| **Model templates (DCF, merger, LBO, VC cap table, IPO)** | Approved starting models | Merger model, VC cap table and IPO valuation added to the engine | **Studio · Later** |
| **Track changes** | See edits to a deck or model | Version history and valuation bridge | **Studio · Now** |

### Alteryx

*Visual data workflows. Source: Designer page.*

| **Their feature** | **What it does (plain words)** | **Marginalia version** | **Where · when** |
|---|---|---|---|
| **300+ drag-and-drop tools; visual canvas** | Build data processes without code | Recipes ★ | **Tools · Next** |
| **80+ connectors, 70+ outputs** | Read and write many systems | API and exports | **API · Next** |
| **Extract data from PDFs and images** | Turn documents into tables | Annual report PDF extraction for countries without XBRL | **Data · Now** |
| **Spatial analytics** | Maps and location analysis | Company footprint maps (plants, stores) from disclosures | **Company · Later** |
| **Predictive and prescriptive analytics** | Forecasting models | Monte Carlo and scenarios (no black-box forecasts) | **Studio · Later** |
| **Ask Alteryx; AI tool palette** | Build workflows by describing them | Describe a screen or recipe in words; the tool builds it, user confirms | **Tools · Later** |
| **Scheduling and server; audit trail** | Run on a timetable; every step visible | Scheduled refresh; decision trail | **Next** |

### DeepFundamental

*Source-validated US financials. Visited the live Apple pages.*

| **Their feature** | **What it does (plain words)** | **Marginalia version** | **Where · when** |
|---|---|---|---|
| **Filing timeline** | Every 10-K and 10-Q listed; pick one to view | Same per company | **Company › Filings · Now** |
| **Sankey and waterfall per period** | Visual flow from revenue to profit | Same | **Company · Now** |
| **Metrics workbench and starter pack** | Build metrics with formulas from filing tags; 15 ready metrics | Chart anything ★ | **Company · Next** |
| **Reverse DCF simulator** | Multi-stage growth and discount; solve for any input; plain-English summary | Extend our reverse DCF | **Studio · Next** |
| **Links to SEC.gov** | Open the source filing | Click-to-source | **Company · Now** |
| **Education blog** | E.g. "68 of 73 data items differ between screeners and SEC filings" | India and global versions of the same study; "check any number" | **Learn · Now** |
| **AI scores (paid)** | Moat, leadership, cheapness scored 1–10; showed NVIDIA's text on Apple's page | Lesson: no unchecked AI opinions | — |

### Fiscal.ai (formerly FinChat)

*Research terminal; $49–99 a month. Sources: developer docs and a detailed review.*

| **Their feature** | **What it does (plain words)** | **Marginalia version** | **Where · when** |
|---|---|---|---|
| **Customisable dashboard; portfolio with broker link** | Your tickers, metrics, alerts, allocations | Personal dashboards; portfolio import | **Account, Invest · Next** |
| **Company page with bull and bear views** | Both sides of the case | Bull and bear as the user's own scenarios with their assumptions | **Studio · Next** |
| **Financials and real-time ratios; as-reported and standardised** |  | Same, plus corrected and modelled | **Company · Now** |
| **Segments and KPIs (2,500 companies, 12+ years)** | Operating metrics beyond statements | Segments by extraction with page references | **Company · Next** |
| **Sourcing to filing as images and PDFs** | See the source table | Source image on hover | **Company · Now** |
| **Peer charting with image export** |  | Compare and export | **Company · Now** |
| **Screener (~200 metrics)** |  | Screener | **Companies · Next** |
| **Estimates, guidance, transcripts with speaker and timestamps, IR slides, event-tagged news** |  | Guidance tracker; concall notes with speaker and minute | **Filings · Next** |
| **Ownership and insiders** |  | Ownership tab | **Next** |
| **Fund letters (30,000 from 750+ investors)** | Investor letters, twice-daily updates | Fund letters library, including Indian PMS and AMC letters | **Invest · Later** |
| **Earnings calendar in five views incl. heatmap** | Agenda, day, week, month, heatmap; watchlists; exports | Same views | **Markets · Now** |
| **Valuation templates: DCF, IRR, reverse DCF, comps** |  | Our engine already; IRR added with LBO | **Studio · Built/Next** |
| **MCP connectors; ChatGPT data partner; prompt skills catalogue** | Data inside AI assistants; ready prompts | API connector plus a library of ready prompts | **API · Next** |
| **Data 3–7 minutes after earnings (US/EU)** | Speed | Results within hours, then minutes | **Data · Next** |

## E3. Investor research

### EquiSense

*Indian filings explained in plain language. Sources: every public page.*

| **Their feature** | **What it does (plain words)** | **Marginalia version** | **Where · when** |
|---|---|---|---|
| **WhatsApp alerts in English, Hindi, Gujarati** | Filings, results, insider and bulk deals, board meetings, summarised | Same channel and languages | **Invest · Next** |
| **Theme alerts** | Alerts on a theme across all companies (e.g. defence orders) | Same | **Invest · Next** |
| **Discover: scored stocks and themes** | Quality score from governance, earnings, momentum | Themes yes; scores later (licence) | **Companies · Next** |
| **Research Q&A** | Questions answered from filings, in three languages | Quoted answers only | **Filings · Next** |
| **Deep Dive: results, concalls, 360° profile, Walk the Talk, news and deals timeline** | One-screen company view | Company hub; guidance tracker; who-bought timeline | **Company · Now/Next** |
| **Glance** | All results in a season, one-line takeaways, filters | Results table with facts | **Markets · Now** |
| **Concalls live** | Live audio; guidance extracted within minutes | Concall notes | **Research · Next** |
| **IPO decoded** | DRHP numbers verified to page | IPO notes | **Research · Next** |
| **Report incorrect data** | Link on every page | Feeds our corrections database | **All · Now** |
| **MCP for Claude** |  | API connector | **API · Next** |
| **WhatsApp OTP login; UPI payments; free tier of 5 stocks** |  | Same conveniences | **Account · Now** |

### Simply Wall St

*Visual research for retail investors; covers NSE. Sources: plans, help, Reliance page, published model.*

| **Their feature** | **What it does (plain words)** | **Marginalia version** | **Where · when** |
|---|---|---|---|
| **Snowflake: 30 checks** | Six pass/fail checks each for value, future, past, health, dividends; shape and colour show the result | Factual check sets, each linked to its data; no verdict | **Company · Next** |
| **Separate health checks for banks** | Loans to deposits, bad-loan provisions, etc. | Sector-specific checks (banks, insurers, NBFCs) | **Company · Next** |
| **Management checks** | CEO pay vs peers, pay rise with falling EPS, tenure, insider selling | CEO pay vs performance ★ | **Company · Next** |
| **DCF fair value and community narratives** | Fair value with analyst inputs; users write narratives with fair values | User models and public theses | **Studio, Invest · Next** |
| **Returns vs industry and market; volatility vs deciles** | How the stock compares | Same | **Company · Now** |
| **Data status and sources table** | When each data type updated and where from | Data status panel | **Company · Now** |
| **Portfolio: transaction-based, AI import, broker sync, equity curve, dividend analysis, shareable** |  | Invest portfolio | **Invest · Next** |
| **Screener with saved alerts; curated ideas** |  | Same | **Companies · Next** |
| **Report limits by plan; Excel/PDF export at top tier** |  | Paywall exports, not reading | **All · Next** |
| **Charlie AI; Chrome extension; weekly newsletter; video courses (DCF, dividends, retirement)** |  | Quoted Q&A; extension; newsletter; Learn videos | **Next/Later** |

### WallStreetZen

*US research with A–F ratings. Sources: home, Zen Ratings and Apple pages.*

| **Their feature** | **What it does (plain words)** | **Marginalia version** | **Where · when** |
|---|---|---|---|
| **Zen Ratings** | A–F from 115 factors in 7 components; returns per grade published since 2006; recalculated daily | Ratings later with public record | **Invest · Later** |
| **Due-diligence checks (38 in 5 groups)** | Includes a Graham formula value check | Factual checks free; Graham number as education | **Company · Next** |
| **Top analysts** | Analyst accuracy and returns; filter weak forecasters | Insider track record ★ | **Ownership · Next** |
| **Price-move explanations** | Researchers explain each move in one sentence | Linked to that day's filings | **Company · Next** |
| **Industry rank; peer table** |  | Rank within sector on facts | **Company · Next** |
| **Pre-built screens (dividends, 52-week, buy the dip, most active)** |  | Factual pre-built screens | **Companies · Next** |
| **Stock FAQ section per company** | Common questions answered on the page | Company FAQ pages ★ | **Company · Now** |
| **Newsletters and model portfolios (Zen Investor)** | Paid stock picks | Later, after registration | **Later** |

### The Ledger Terminal

*Value Line-style tearsheets, $144 a year. Source: directory listings.*

| **Their feature** | **What it does (plain words)** | **Marginalia version** | **Where · when** |
|---|---|---|---|
| **One-page tearsheets** | Description, 15 years of data, valuation chart, checks, filings, news | One-pager | **Research · Now** |
| **Automated QA checks on data** | Data checked before display | Data quality badge ★ | **Company · Now** |
| **Log valuation chart with four lenses** | Price vs P/E, P/FCF, P/CF, owner-earnings values | Same, plus our model value history | **Company · Next** |
| **9-point quality checklist** |  | Factual checklist | **Company · Next** |
| **Screener (200+ filters, 27 categories); heatmaps; discover feed** |  | Screener; heatmaps | **Companies · Next** |
| **AI business briefings from filings** | Outlook and guidance summarised | Quoted briefings | **Company · Next** |
| **UK coverage from ESEF filings** | Structured European filings | Our Europe/UK stage | **Data · Next** |

### Value Line

*Independent research since the 1930s. Source: official platform guide.*

| **Their feature** | **What it does (plain words)** | **Marginalia version** | **Where · when** |
|---|---|---|---|
| **Timeliness, Safety, Technical ranks; financial strength grade** | Simple ranks with decades of record | Ratings later; public record | **Later** |
| **Price stability, growth persistence, earnings predictability indexes** | 0–100 consistency measures | Factual consistency measures | **Company · Next** |
| **3–5 year projections with target range on chart** |  | User scenario range on the chart | **Studio · Next** |
| **Movable report modules; saved layouts** | Arrange the report your way | Customisable company page | **Company · Later** |
| **PDF one-page archive by date** | Past reports kept | Frozen dated tearsheets | **Research · Next** |
| **Analyst commentary; statistical milestones; total return vs index** |  | Research packs; returns vs index | **Research · Next** |
| **Value Line 600; Select newsletters; funds, options, convertibles, ETFs** |  | Curated verified universe ★; convertibles later | **Later** |
| **Dashboard, screeners, watchlists, alerts hub, portfolio tool** |  | Same | **Next** |

### Finviz

*Fast screener and market maps. Sources: Elite page, screener help.*

| **Their feature** | **What it does (plain words)** | **Marginalia version** | **Where · when** |
|---|---|---|---|
| **Screener filters** | Exchange, index, sector, industry, country, market cap; valuation; EPS and sales growth; dividends; ROA, ROE, ROIC, margins; liquidity and leverage; insider and institutional ownership and transactions; short float; analyst rating; earnings date; performance; volatility; beta; ATR; RSI; gaps; moving averages; patterns; candlesticks; volume; price | All factual filters, worldwide | **Companies · Next** |
| **Signals** | Top gainers/losers, new highs/lows, most volatile, most active, unusual volume, overbought/oversold, upgrades/downgrades, earnings before/after, major news, chart patterns | Factual signal lists | **Markets · Next** |
| **Maps** | Treemaps by sector, world, ETF; coloured by performance | Implied-growth world map ★ | **Markets · Next** |
| **Groups** | Sector, industry, country, size aggregates | Sector and country pages | **Markets · Next** |
| **Insider, futures, forex, crypto pages** |  | Who-bought pages; macro panel | **Markets · Next** |
| **Portfolio (100 portfolios); calendar** |  | Invest; calendar | **Next** |
| **Elite: real-time, alerts, exports, chart layouts, correlations, "held by", ETF holdings treemap, backtests** |  | Alerts, exports, fund holdings | **Next** |

### OpenInsider

*Free US insider-trade tracker. Sources: home and screener.*

| **Their feature** | **What it does (plain words)** | **Marginalia version** | **Where · when** |
|---|---|---|---|
| **Screener** | Filing and trade dates, filing delay, transaction type, value, ownership change, title, industry, grouping | Same on SEBI, SEC and other disclosures | **Ownership · Next** |
| **Ready screens** | Cluster buys, CEO/CFO buys over $25k, top buys and sells today/week/month, penny stock buys | Same, India-first | **Markets · Next** |
| **Returns after each trade** | 1 day, 1 week, 1 month, 6 months | Insider track record ★ | **Ownership · Next** |
| **Transaction codes legend** | Purchase, sale, grant, option exercise, gift, tax | Plain-language legend | **Learn · Next** |

## E4. Trading, charts and options

### E*TRADE / Power E*TRADE

*US broker. Sources: platform pages, options guide, independent review.*

| **Their feature** | **What it does (plain words)** | **Marginalia version** | **Where · when** |
|---|---|---|---|
| **Snapshot Analysis; TradeLab** | Max profit/loss, breakeven, probability, risk curve; scroll price and time; Greeks in plain English | Hedging comparator | **Invest · Next** |
| **Strategy recognition; up to 4 legs** | Names the strategy you built | Same | **Invest · Next** |
| **Earnings Move Analyzer** | Implied vs historical earnings moves | Results-day move history ★ | **Company · Next** |
| **Live Action scanners; Behind the Move; pattern recognition; 121 indicators** |  | Signals; move explanations | **Markets · Next** |
| **Market statistics (breadth)** | Advances/declines, new highs/lows, volume flow | Market breadth page | **Markets · Next** |
| **Sectors and industries vs index** | P/E, P/B, growth by sector | Sector pages | **Markets · Next** |
| **Revenue exposure breakdown** | Where revenue comes from | Segments and geography | **Company · Next** |
| **Third-party research (8 providers incl. Argus, TipRanks)** |  | Research packs; licensed research later | **Later** |
| **Positions with 96 columns; watchlists with 43 fields; "price added" field** | Track ideas without money | Watchlists with "price when added" | **Invest · Next** |
| **Bond ladder tool; yield curve visualiser** |  | Yield curve in macro panel; bond tools later | **Markets · Later** |
| **Risk-profile asset allocator; retirement score; calculators** |  | Education calculators | **Learn · Later** |
| **Paper trading; education library; webinars** |  | Practice on past data; Learn | **Later** |
| **Not offered: trade journal, quizzes, progress tracking** | Gaps in E*TRADE | Our thesis journal, scorecard, certificate fill these | **Invest, Learn · Next** |

### TradingView

*Charting and social platform. Source: features page.*

| **Their feature** | **What it does (plain words)** | **Marginalia version** | **Where · when** |
|---|---|---|---|
| **21 chart types; 400+ indicators; 110+ drawing tools; pattern recognition** |  | Embed their free widgets for charts | **Company · Now** |
| **Bar Replay** | Replay history | Decision replay ★ | **Invest · Later** |
| **Seasonals; fundamental graphs (100+ metrics)** |  | Seasonality; chart anything | **Company · Next** |
| **Alerts: price, drawing, script, watchlist, multi-condition; webhooks** |  | Alerts with webhooks | **Invest, API · Next** |
| **Pine Script; strategy tester** | Write and back-test strategies | Back-tests (education) | **Invest · Later** |
| **Screeners: stocks, ETFs, bonds, crypto** |  | Stocks first | **Companies · Next** |
| **Heatmaps; economic calendar; macro maps (400+ indicators); yield curves (40+ countries)** |  | Markets menu; macro panel | **Markets · Next** |
| **Options builder, chain, volatility curves** |  | Hedging comparator | **Invest · Next/Later** |
| **Broker integration; paper trading; competitions** |  | Not planned (no broking) | — |
| **Community ideas; news; widgets and charting libraries; MCP** |  | Public theses; widgets; API | **Later** |

### StockCharts

*Technical charting with strong education. Source: features page.*

| **Their feature** | **What it does (plain words)** | **Marginalia version** | **Where · when** |
|---|---|---|---|
| **SharpCharts; GalleryView; CandleGlance; PerfCharts (12 symbols); P&F; seasonality** |  | Chart views | **Company · Next** |
| **Relative Rotation Graphs; MarketCarpets; sector summary** | Sector strength and rotation | Sector rotation page | **Markets · Next** |
| **SCTR ranking** | Technical strength rank | Factual momentum rank | **Markets · Later** |
| **ChartLists, public ChartLists, ChartPacks, user-defined indexes** |  | Lists; publish; portfolio as index | **Invest · Next** |
| **Scans of 50,000 symbols; custom alerts by email/SMS** |  | Screens and alerts | **Next** |
| **Member dashboard; expert commentary; ChartSchool** |  | Dashboards; Learn | **Next** |

### Composer

*No-code automated strategies. Source: home page.*

| **Their feature** | **What it does (plain words)** | **Marginalia version** | **Where · when** |
|---|---|---|---|
| **Strategy from plain language with metrics** | AI builds an editable strategy with return and Sharpe ratio | Strategy builder (education) | **Invest · Later** |
| **Visual blocks: if/then, weighting, sort and select top N** |  | Same blocks | **Invest · Later** |
| **Back-test with fees and slippage; allocation history chart** |  | Back-test any checklist ★ | **Invest · Later** |
| **Discover and remix community strategies** |  | Public strategies (education) | **Invest · Later** |
| **Automated execution; brokerage accounts** |  | Not planned (no broking) | — |

### Optionistics

*Options data and calculators. Sources: home and QQQ chain.*

| **Their feature** | **What it does (plain words)** | **Marginalia version** | **Where · when** |
|---|---|---|---|
| **Filterable option chain; IV vs historical volatility** |  | NSE chain from end-of-day files | **Invest · Next** |
| **Volatility quotes, skew charts, Strike Pegger, IV highs/lows** |  | Is protection cheap now? ★ | **Invest · Next** |
| **Screens: hot sheet, volume change, covered calls, spreads, straddles, condors** |  | Education screens | **Invest · Later** |
| **Put/call ratio; open-interest changes** |  | Same from NSE data | **Markets · Next** |
| **Options and probability calculators; tutorial; glossary; history downloads** |  | Learn and tools | **Learn · Next** |

## E5. Outreach tools

### Clay

*Data enrichment and AI research per row.*

| **Their feature** | **What it does (plain words)** | **Marginalia version** | **Where · when** |
|---|---|---|---|
| **AI research agent per row** |  | Ask 500 companies one question ★ | **Tools · Next** |
| **Waterfall over 200+ providers** | Try sources in turn | Data layer fallbacks with source shown | **Data · Now** |
| **Scoring tiers by formula; signals; sequencer; ads audiences** |  | Buyer ranking; filing signals | **Deals site · Later** |

### Airscale

*Contact enrichment.*

| **Their feature** | **What it does (plain words)** | **Marginalia version** | **Where · when** |
|---|---|---|---|
| **Pay only when data is found** |  | Usage pricing for the API | **API · Later** |
| **Hiring-signal and local-business finders; AI research agent** |  | Seller sourcing | **Deals site · Later** |
| **MCP: describe a workflow, the agent runs it** |  | Same via our API | **API · Later** |

### Smartlead

*Cold-email at scale.*

| **Their feature** | **What it does (plain words)** | **Marginalia version** | **Where · when** |
|---|---|---|---|
| **Unified inbox with AI intent tagging; subsequences** |  | Buyer interest tracker ★ | **Deals site · Later** |
| **Deliverability tools; verification** |  | Our own sales outreach | **Sales · Next** |

### LinkedIn Sales Navigator

*Finding and tracking decision-makers.*

| **Their feature** | **What it does (plain words)** | **Marginalia version** | **Where · when** |
|---|---|---|---|
| **Relationship map; TeamLink warm paths** |  | Advisers with past dealings with a buyer (opt-in) | **Deals site · Later** |
| **Buyer intent; who viewed; alerts on job changes** |  | Teaser views; mandate change alerts | **Deals site · Later** |
| **Account IQ and Lead IQ (AI summaries)** |  | One-page buyer profiles from public data | **Deals site · Later** |

### HypeEquity

Website offline (Wix domain error) and help pages block reading. Not covered; add when a working link or screenshots are available.

## Sources

- FRED help centre and series pages — https://fred.stlouisfed.org/help ; https://fred.stlouisfed.org/series/GDP ; https://alfred.stlouisfed.org

- Yahoo Finance, Reliance pages (summary, key statistics, analysis, holders, profile, financials, history, options) — https://finance.yahoo.com/quote/RELIANCE.NS/

- PitchBook for Dealmakers — https://files.pitchbook.com/website/files/pdf/PitchBook_for_Dealmakers.pdf ; integrations and data pages

- Capital IQ user guide (CBS) — https://www.cbs.dk/sites/default/files/2025-11/sp_capital_iq_-_user_guide.pdf ; Capital IQ Pro product page

- Preqin Pro — https://www.preqin.com/our-products/preqin-pro

- Grata — https://grata.com/why-grata ; https://help.grata.com/en/

- BamSEC — https://www.bamsec.com ; https://help.bamsec.com/docs

- Macabacus features — https://macabacus.com/features

- Alteryx Designer — https://www.alteryx.com/products/alteryx-designer

- DeepFundamental — https://deepfundamental.com/AAPL ; /AAPL/metrics

- Fiscal.ai — https://docs.fiscal.ai ; review at https://ryanoconnellfinance.com/?p=15061

- EquiSense — https://equisense.ai and section pages

- Simply Wall St model — https://github.com/SimplyWallSt/Company-Analysis-Model ; plans and Reliance page

- WallStreetZen — https://www.wallstreetzen.com/zen-ratings ; Apple page

- The Ledger Terminal — https://www.findmymoat.com/tools/the-ledger-terminal

- Value Line platform guide — https://www.betterinvesting.org/getmedia/48c12200-e944-43fd-877e-6bcaaaa6ca1f/The-Value-Line-Digital-Platform.pdf

- Finviz — https://finviz.com/elite ; https://finviz.com/help/screener.ashx

- OpenInsider — http://openinsider.com/screener

- E*TRADE — https://us.etrade.com/platforms/power-etrade ; https://stockbrokers.com/review/etrade

- TradingView — https://www.tradingview.com/features/ ; StockCharts — https://stockcharts.com/features/ ; Composer — https://www.composer.trade ; Optionistics — https://www.optionistics.com

- Clay, Airscale, Smartlead, LinkedIn Sales Navigator — their home and product pages

- ESEF filings — https://www.xbrl.org/news/xbrl-international-launches-filings-xbrl-org-for-esef-filings/
