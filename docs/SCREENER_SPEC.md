# Global screener — specification

Compiled 25 October 2026 from research on Screener.in, Finviz, Stock Analysis, TradingView and Koyfin (vendor pages, pricing, help) and SEBI's Research Analyst and Investment Adviser regulations. Items marked UNCONFIRMED must be checked. Section C needs sign-off from an Indian securities lawyer before public launch (Paid · last).

## A. What the five do (for reference, not to copy)
- Screener.in: text query language (AND, arithmetic, comparisons such as P/E < Industry PE); user-defined ratios as formulas with preview, usable as columns and filters; COALESCE for missing values; period suffixes (none/12m = TTM, "last year", "preceding year"); consolidated by default with standalone fallback; saved screens with alerts (2 free, 75 paid); export paid only; no API.
- Finviz: filter panel, presets, views (Overview, Fundamental, Financial, Technical, Ownership, Performance); each filter's formula documented; US only. Its Debt/Equity uses current liabilities — a reminder to publish formulas.
- Stock Analysis: 330 indicators, country selector, tabbed column views, saved screens; downloads limited by its data licence.
- TradingView: filter groups with TTM / quarterly / semiannual / annual selectors; column sets; multi-market; "primary listing" toggle; base-currency setting for converted values; price always in own currency.
- Koyfin: 100K+ equities, 5,900+ criteria; templates; custom formulas on the top tier; vendor blocks export of some fields.
- None documents how its screens are made fast.

## B. Data rules
1. Universe first: country and exchange multi-select; primary listings by default (hide duplicate listings); state consolidated or standalone.
2. Every metric has a published formula, source and as-of date (tap the column header).
3. Every ratio shows its period type and end (annual, TTM, half-year; "FY Mar-2026, TTM"); half-yearly reporters may have no quarterly TTM — say so.
4. Missing data has three states: value · n.m. (not meaningful) · not available. A null never passes or fails a filter silently; show "N companies excluded: metric missing".
5. Banks, insurers and other financials: EV/EBITDA, Debt/Equity, current ratio, FCF and margins shown as n.m.; financials can be screened separately.
6. Currency: show reporting currency and trading currency; converted values only through an explicit base-currency setting with the FX date; prices always in their own currency. Normalise GBp/ZAc/ILA first.
7. Prices: timestamp in exchange-local time; flag stale or no-trade prices (e.g. no trade in 7 days).
8. Custom ratios: user formulas over our metrics, with preview before saving; usable as filters, columns and sort keys; COALESCE-style fallback allowed but shown.
9. Text query view alongside chips (Screener-style syntax); any natural-language box only translates into chips, never into picks.
10. Speed: precompute every metric for every company when its data changes (nightly or on fetch) into one table; filter on request. Re-measure before advertising an update cadence.
11. Export and public sharing respect the data licence: vendor data (development) is never exported publicly.

## C. Facts, not recommendations (SEBI)
12. Never use: buy, sell, hold, accumulate, target, stop-loss, entry/exit, top pick, undervalued/overvalued/cheap, strong/weak, signal, opportunity, multibagger — in screens, preset names, alerts or emails.
13. No composite score as the default sort or headline; default sort is neutral (market cap or A–Z) or the column the user chose.
14. Presets are named by their rules ("ROE > 15% and Debt/Equity < 0.5"), not their outcome ("Quality stocks").
15. No model portfolios, no "recommended for you", no profile-based personalisation, no third-party analyst ratings in version 1.
16. Results read "N companies match your criteria", "sorted by [column]".
17. User-created screen names and descriptions are moderated.
18. Questions for counsel (Paid · last): whether subscription or ad revenue counts as "consideration"; whether a screener fits the "statistical summaries" exclusion; foreign-market rules.

## D. Screen design
19. Phone (390px): universe picker full-screen; filters in a bottom sheet with large tap targets (well above 24px) and a live match count; results with a pinned identity column (≤30% width) and a visible sideways-scroll cue.
20. Desktop: collapsible filter panel; dense table with sticky header and first column; sortable columns; column sets (Overview, Valuation, Growth, Profitability, Balance sheet, Ownership).
21. Active filters as removable chips; text-query view toggle.
22. Screens shareable by web address (filters in the URL). Saving screens and alerts need accounts (build step 7); until then, save in the browser only.
23. Every company row opens its company page; DESIGN.md rules apply.
