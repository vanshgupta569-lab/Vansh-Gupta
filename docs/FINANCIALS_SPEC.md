# Financials tab — specification

Compiled 25 October 2026 from two independent research reports (Screener.in, Yahoo Finance, Stock Analysis, Macrotrends, Simply Wall St, Stockopedia; SEBI, SEC, FCA, ASX, IFRS sources). Items marked UNCONFIRMED must be checked before relying on them.

## What we learned from the five sites
- Screener: best structure (12 years + TTM on one screen, raw-PDF link per quarter, consolidated/standalone toggle, "+" to expand rows). Weaknesses: regroups lines silently, overwrites old numbers when restated, no history of what was first reported.
- Stock Analysis: best controls (Annual / Quarterly / TTM, Standardised vs As Reported, units, currency, "Period ending" date row, dash for not reported). Free tier only 5 years.
- Yahoo: familiar three-tab layout with TTM column; short history on the free tier.
- Macrotrends: long single-metric history; snaps fiscal dates to month-end and mixes $0 with N/A (do not copy).
- Simply Wall St: TTM by default; narrative and charts.
- **None of the five links every number to the filing behind it. That is our differentiator.**

## Data rules (must)
1. Store every fact with: period start and end dates, duration, fiscal-year label, unit, scale, currency, accounting basis (consolidated / standalone), form type, filing date, filing ID, source, and version.
2. Read units and scale from the filing metadata, never from digit counts. 1 crore = 10 million = 100 lakh.
3. Five value states, never confused: reported value · reported zero · not reported (—) · not applicable · derived. Never fill a gap with zero.
4. Discrete quarters from cumulative figures: Q2 = H1 − Q1; Q3 = 9M − H1; Q4 = FY − 9M. Cash flow quarter = YTD − prior YTD. Label as derived and link both source filings.
5. TTM follows the periods the company actually filed, not its country:
   - quarterly filer: sum of the latest 4 discrete quarters;
   - half-yearly filer: FY + current H1 − prior H1;
   - right after an annual report: TTM = FY;
   - India: income statement quarterly; balance sheet and cash flow only at half-year and year-end, so TTM cash flow = FY + H1 − prior H1;
   - Japan: statutory quarterly reports abolished April 2024; exchange tanshin remain; cash flow patchy, so compute TTM cash flow only at half-year and year-end where needed.
   - Show the TTM end date and basis in the header, e.g. "TTM (H1 basis)".
6. Balance sheet items are point-in-time: show the latest balance, never sum.
7. Margins and ratios on TTM are recomputed from TTM numerator and denominator; never add or average percentages.
8. Growth shows "n/m" when the prior value is zero or negative.
9. Transition periods (changed year-end) and 52/53-week years: own column labelled by length (e.g. "11M transition"), excluded from YoY and CAGR.
10. Label columns by period-end date ("FY25 · 31 Mar 2025"); the FY name is a secondary tag.
11. Restatements: keep both versions. Default view = latest restated; option "as first filed". Never mix versions in one calculation.
12. EPS: keep reported EPS and split/bonus-adjusted EPS with the split factor and date. TTM EPS = sum of the four split-adjusted quarterly diluted EPS figures (Screener's convention), stated in the ⓘ.
13. Separate templates for industrials, banks and insurers. Keep regulatory rows for banks (interest earned, interest expended, operating profit before provisions, provisions, deposits). Never compute operating margin or EBITDA for a bank.
14. Currency: show the filed currency by default; conversion optional, disclosing rates (closing rate for balance sheet, average rate for flows, per IAS 21). Statement currency can differ from trading currency.
15. Consolidated by default; standalone toggle only where both are filed; label which basis every number is.
16. Track the SEC proposal (reported May 2026) to allow half-yearly 10-S filing — UNCONFIRMED; handle companies that change filing frequency mid-history.

## Screen design
1. Three statements (Income statement, Balance sheet, Cash flow) with Annual / Quarterly / Half-year / TTM controls, showing only periods that exist.
2. Desktop: 10–12 years plus TTM at once; column highlight on hover; keyboard navigation.
3. Phone (390px): sticky label column (≤ 30% width) and sticky header; about 3 periods visible; scroll-snap to whole periods; scroll contained in the table (page never scrolls sideways); visible cue that more columns exist.
4. Window chips: 5Y / 10Y / All; time-order toggle (oldest→newest or newest→oldest), TTM pinned beside the latest year.
5. About 8 key rows per statement by default; "+" expands detail rows.
6. View switch: Values / % of revenue / YoY / Per share. Standardised vs As reported switch.
7. Period header chips: 12M, 9M YTD, H1, TTM (basis), derived, restated, transition; unit and currency under the header.
8. Tap any number: evidence sheet (bottom sheet on phone, side panel on desktop) showing filing, form, date, page or XBRL concept, unit, duration, reported/derived/restated, original value if restated, and "Open filing".
9. Row detail: 10-year sparkline/chart for that row (not an extra column on phone).
10. Export to Excel keeps the filing links.
11. Follows DESIGN.md: Newsreader + Source Sans 3, ⓘ pattern, the gap-is-a-gap rule, calm and uncluttered.
