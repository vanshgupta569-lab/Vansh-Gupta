# Base-rate check — specification

Compiled 25 October 2026 from research on Mauboussin's The Base Rate Book (2016) and updates (2021, May 2026), Chan, Karceski & Lakonishok (2003), Fama & French (2000), Theising, Wied & Ziggel (2023), and risk-communication research. Items marked UNCONFIRMED must be checked. Part of build step 5 (valuation completion).

## What it does
When a user assumes a growth rate (e.g. 15% revenue CAGR for 5 years), show how many companies in a comparable group actually achieved it in the past: "X of N companies". A fact about a group's history, never a forecast for this company and never a verdict on the assumption.

## Key findings (for the method page and ⓘ text; cite, never mix)
- Mauboussin 2016 (top 1,000 global companies since 1950, real growth, grouped by starting sales): 3-year real CAGR median 5.4%, mean 8.1%, standard deviation 18.7%; for companies above $25bn sales the 5-year median is about 2.0%; about 20% shrink in real terms over 5 years. Share reaching ≥15% real CAGR over 5 years: about 14% overall, 5% above $25bn, 3% above $50bn (arithmetic on the appendix counts; bin convention UNCONFIRMED).
- Growth is weakly persistent (1-year correlation 0.30; 3-year 0.17); gross profitability is highly persistent (0.95 one year, 0.82 five years); excess returns fade, about half gone in 4–5 years for a typical IT company.
- 2021 update: Russell 3000, nominal, five industries; 2026 update: US, nominal and real; narrowing the group shrinks the sample fast (19,264 → 350).
- Chan et al. 2003: about 10% of US firms grew above 18% a year over 10 years; earnings growth showed no persistence beyond chance; analysts' top-quintile forecasts (22.4%) far exceeded realised (9.5%).
- These studies use different universes, periods and real/nominal bases: never combine their numbers in one table.

## Data (DECIDED for version 1)
1. Build our own base rates; do not republish the studies' tables (cite them on the method page only).
2. Version 1 source: SEC XBRL bulk company facts (free, public, reusable) for US companies, about 2009 onward. Check whether deregistered and acquired companies' histories are retained (UNCONFIRMED); if they are, include them.
3. Other countries: show "Base rates for [country] not yet available" until filings data for that country exists (data layer stage 4). Never apply US base rates to a non-US company silently; offer them only as a labelled "US reference group".
4. Our current 175-company set is too small to be a base rate; never use it as one.

## Rules
5. Always show counts with the denominator: "X of N companies", N always visible.
6. Print the group, period, horizon and metric on every result ("US companies with starting revenue $2–5bn, 2009–2025, 5-year revenue CAGR").
7. Real and nominal labelled; compare like with like; show both where possible (deflate with official CPI, e.g. BLS for the US).
8. Default group = starting revenue size band in one stated currency and year; sector narrowing optional, showing how N shrinks. The default is fixed in advance; never auto-pick the group that flatters or alarms.
9. Survivorship: include dead, delisted and acquired companies; if the data can't, say "survivors only; likely overstates growth".
10. M&A: state that reported growth includes acquisitions (no adjustment in version 1).
11. Growth computed in the reporting currency; flag hyperinflation-restated filings (IAS 29).
12. Small samples: show a Wilson interval; below a minimum N (DECIDED: 30, documented) say "too few comparable companies" instead of a number.
13. Overlapping windows mean the effective sample is smaller than N; say so on the method page.
14. Date-stamp each base rate; show by-decade figures where N allows, because base rates change over time.
15. Wording: report the past frequency only. Never "unrealistic", "should", "likely", "aggressive", and no red/green or pass/fail colour.
16. State what it doesn't say: not a forecast for this company; growth is not value.
17. Display as a simple count and a small bar or icon array with the same denominator throughout; no pictograms for shares below 1%.
18. Method and sources page; SEBI question (does a base-rate statistic count as research?) goes to the lawyer with the other Paid · last questions.
