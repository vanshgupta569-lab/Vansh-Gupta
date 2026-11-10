# TEARSHEET_SPEC §5 — references checked (free-chat research, 11 November 2026)

Replaces the "not confirmed" reference notes in docs/TEARSHEET_SPEC.md §5 where this pass opened the source. Type sizes were not readable from any source.

## Decisions (Nihar, 11 November 2026)
1. ADD to the two-pager: "Multiples against the company's own history" — current P/E, P/B and EV/EBITDA beside their own minimum, median and maximum over the years we hold, stated as fact, no band colours, no verdict words.
2. ADD to the one-pager header block: a slim key-data line (shares outstanding, market cap, 52-week range), as broker notes do.
3. KEEP our 13px (9.75pt) type floor; the research suggested 8pt body and 6.5pt footnotes, which we reject as too small.
4. KEEP: no ratings, scores, stars, moat labels, target prices or "upside"; ranges with stated assumptions only (confirms §1.4).
5. Every block ends with its source and date line (confirms §3.1); every figure labelled with its basis (consolidated/standalone, TTM/fiscal year) — the Value Research page shows two different profit figures for one company with no explanation, which is exactly what we must never do.
6. Shareholding over three dates (Promoter / institutions / others, definitions in a footnote) is the shape of the ownership block when ownership data arrives (GAP, job 11).
7. Print on white/off-white paper with charcoal text, never the dark theme (confirms §2.6).

---
# Research text (for reference)

I opened four of the five sources in full and could only partly open the fifth (S&P). No text extraction gives font sizes, so type sizes are “not confirmed” for all five. I could only see text and tables, not rendered pages.

1. Value Line (opened: official guide with a Disney sample page)

Blocks, in order:

The top strip carries the recent price, P/E, relative P/E and dividend yield. The Timeliness, Safety, Technical and Beta box sits in the upper left, with a 3–5 year projections box. The long price chart carries a “cash flow” line, relative strength and volume, with a target price range box in its upper right. 
valueline
Capital structure, current position and annual rates of change (past 5 and 10 years, plus estimates) come next. The statistical array is in the centre and the quarterly grids at the bottom left. Footnotes follow, then a 300–400 word analyst commentary, with a ratings box in the lower right. 
valueline
Left versus right placement is only partly confirmed, taken from the guide’s description of each box.

Years: The guide says up to 17 years of history. The sample array shows 2001–2016 as actuals, two estimate years in bold italics, and one 3–5 year projection column. 
valueline

Ratios: Per-share lines cover revenue, cash flow, EPS, dividends, capex, book value and shares. Valuation lines are average annual P/E, relative P/E and average yield. Operating margin, net margin, return on total capital, ROE, retained-to-equity and payout follow. 
valueline

Sources and dates: Dates are attached to individual items: rank changes carry a date, total return and capital structure carry “as of” dates, and the analyst’s commentary is signed and dated. Each page is refreshed every 13 weeks. 
valueline

Valuation: There is no single fair value. It uses the price-versus-cash-flow-line chart plus a 3–5 year target price range, built from projected earnings times an estimated P/E. 
valueline

2. S&P Capital IQ (partly confirmed)

I couldn’t see the tearsheet’s rendered layout, and I found no public sample PDF. So block order, number of years, ratio list, and source/date style are all not confirmed.

What I did confirm:

The tearsheet is a set of widgets, and the “Financial Information (Basic)” widget is the starting point for historical profitability. A separate Financials/Valuation section has filters for period, currency and restatement type. Clicking a line item opens the original filing. 
spglobal
A third-party library manual (Tsinghua) describes a Quick Report PDF with business description, key financials, market data and management, and a Word tearsheet export. 
tsinghua
3. Morningstar (opened: full 24-page Apple report as distributed by Firstrade)

I did not open the CMC Markets or Interactive Brokers pages, only a CMC search snippet.

Running header: Every page carries a strip with last price and its date, fair value with a UTC timestamp, price/fair value, market cap, moat, style box, uncertainty and capital allocation. The report’s own title line gives the report timestamp, reporting and trading currency, exchange and page count. 
firstrade
Page 1: A price-versus-fair-value chart with overvalued and undervalued ends, an annual table of price/fair value and total return (2020 to year-to-date), a dated contents list and the analyst note. 
firstrade
Body: Business description, strategy, bulls and bears, a four-company comparison table (with 1-star and 5-star prices), moat, fair value drivers, risk and capital allocation. 
firstrade
Financials (page 15 of 24): A model summary covers 2022–2029, under actual and forecast headings. It has 3-year and 5-year average columns and rows for margins, growth, valuation multiples, ROA, ROE, ROIC and leverage. A forecast-revisions table compares prior and current estimates, with dates. 
firstrade
Valuation: It is presented as a single point estimate, with the key drivers (cost of equity, WACC, long-run tax rate) and a DCF bridge from firm value to per-share value. 
firstrade
Footer: Copyright and disclaimer text repeats on every page.
4. Indian broker initiation notes

I opened a Prabhudas Lilladher note on Blue Star (July 2026). For Motilal Oswal, I only saw search excerpts, because I couldn’t fetch its initiation PDF.

Prabhudas Lilladher:

Pages 1–2: A cover with rating, price and target, then contents.
First content page: A key-data block (exchange codes, 52-week range, market cap, shares, average volume), a shareholding split, and stock performance (absolute and relative, 1–12 months). A key-financials table covers FY25–FY28E, and a thesis paragraph and “quick pointers” fill the main column. Sidebar placement is not confirmed. 
plindia
Table rows: Sales, EBITDA, margin, PAT, EV, debt, cash, EPS and growth, DPS, yield, RoE, RoCE, EV/Sales, EV/EBITDA, P/E and P/BV. 
plindia
Valuation: A sum-of-the-parts table (EPS times target P/E per segment), a forward-P/E band chart showing peak, average, median and minimum, and a peer matrix. An eight-year comparison runs FY21–FY28E with growth rates. 
plindia
Back pages: The income statement, balance sheet, cash flow, four quarters and key metrics, then a rating legend and disclaimers. 
plindia
Sources and dates: Each exhibit is tagged “Source: Company, PL”, the report date is in the header, and “E” marks estimates. 
plindia

Motilal Oswal (excerpts only):

The valuation block shows P/E, P/BV, EV/EBITDA and dividend yield across three forward years. 
business-standard
The shareholding block shows three period-ends with Promoter, DII, FII and Others rows. 
business-standard
A footnote clarifies that FII includes depository receipts. 
business-standard
Page position and the rest of the first page are not confirmed.
5. Value Research Online (opened: Reliance stock page)

Blocks, in order: Name and exchange codes, price with an “as on” date, and five headline stats (market cap, TTM revenue, P/E, P/B, yield). Four proprietary scores out of 10 follow, then day and 52-week ranges and a liquidity gauge. Next come a fundamentals list, a 10-year aggregate block, a performance table against the Sensex and a sector index, and calendar-year returns. After those: 
valueresearchonline

Essential Checks: three questions on solvency, creative accounting and last-year performance.
Financials and Key Ratios: both load dynamically, so I couldn’t read them.
Peers, shareholding, news and FAQs: the FAQ gives P/E and P/B at each financial year-end for 2022–2026.

Not confirmed: the financial charts, ratio bands and shareholding contents, which showed as “loading” or blank.

Inconsistency on this one page: TTM net profit is ₹74,727 Cr in the fundamentals list but ₹87,930 Cr in the peers row, and ROE is 11% versus 8.4%. The page doesn’t say why. 
valueresearchonline

Ten layout ideas for the one-pager
Identity strip: name, tickers, exchange, currency and price with an “as of” date, as in Morningstar and Value Research.
Key-data sidebar: shares, market cap, 52-week range and average volume, as in the Prabhudas Lilladher note.
One financial table: 3 actual and 3 projected years, fiscal year-end and units in the header, estimates marked with “E” and italics (Value Line, Prabhudas Lilladher).
Fixed-order ratio block: margins, ROE, ROA and asset turnover, with the formula in a footnote.
Football-field valuation: DCF, multiples and asset-based ranges side by side, never averaged, with the current price as a vertical line.
Assumptions box beside it: WACC, terminal growth, exit multiple and growth inputs, plus a short EV-to-per-share bridge (the Morningstar pattern).
Multiples versus own history: current P/E against its min/median/max, stated as fact (Prabhudas Lilladher, Value Research).
Peer table: identical columns and dates for each peer, with the subject company shaded.
Shareholding over three dates: Promoter, institutions and others, with definitions in a footnote (the Motilal Oswal pattern).
Source-and-date line under every block: each block ends with where the data came from and when.

For page 2, I’d add condensed statements, the valuation bridge, the base-rate check, company-stated risks, and a methodology block.

Your existing off-white and oxblood palette should work best inverted for print, with off-white paper and charcoal text. A dark PDF is heavy on ink and hard to read on paper.

Five things to avoid
Ratings or scores of any kind: Value Line ranks, Morningstar stars and moat, Value Research’s 0–10 scores, and broker Buy/Neutral calls.
Point targets and “upside” language: show ranges with stated assumptions instead of a single fair value or target price.
Clutter: Value Line packs dozens of data lines, a chart and commentary onto one page, and Morningstar repeats a nine-field header on all 24 pages. Keep page 1 to about six blocks and repeat only a slim running header.
Tiny type: my suggested floors are about 8pt for body text, 7.5pt for table numerals and 6.5pt for footnotes. Those are my recommendations, not measurements from these documents.
Undated or mixed-basis numbers: the Value Research page shows two different profit figures with no explanation. Label every figure with its basis (consolidated or standalone, TTM or fiscal year) and its date.