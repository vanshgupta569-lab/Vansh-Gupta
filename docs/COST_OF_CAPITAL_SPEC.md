# Risk and cost-of-capital card — specification

Compiled 25 October 2026 from two independent research reports (Yahoo, Bloomberg, Morningstar, Damodaran, Screener, Kroll, OECD, academic studies). Items marked UNCONFIRMED must be checked before relying on them. Decisions marked DECIDED are Marginalia's own choices.

## Principle
Beta and WACC are estimates, not facts. Every input on the card shows its source, method, as-of date and currency, is editable, and has a reset. The card shows the same numbers the engine uses; it never shows one rate while the model uses another.

## What providers do (for the ⓘ text, not to copy)
- Yahoo: "Beta (5Y Monthly)", price returns over 60 months, S&P 500 for US stocks; adjustment and non-US index UNCONFIRMED.
- Bloomberg: default 2-year weekly, Blume-adjusted (0.67 × raw + 0.33 × 1.0); default index UNCONFIRMED (S&P 500 or local).
- Morningstar: 36-month monthly; a 60-month total-return version also documented; country index list UNCONFIRMED.
- Damodaran: industry betas only (no company betas — his vendor agreements forbid it); weekly returns against the local index.
- Screener.in: method not documented.
- Research note: a flat beta of 1 sometimes predicts as well as adjusted betas, so show raw and adjusted side by side and never imply precision.

## Beta rules
1. We calculate beta ourselves from one stated recipe; never paste a vendor's beta.
2. DECIDED default recipe: 5 years of monthly total returns (price-only if dividends unavailable, labelled) against a broad local index in the listing currency. Also show 2-year weekly as a second estimate.
3. Show raw and Blume-adjusted (⅔ × raw + ⅓ × 1) side by side, with the formula in the ⓘ.
4. Diagnostics on every regression: number of observations, R², standard error, window, frequency, as-of date.
5. Thin trading or too few observations (flag thresholds to be set and documented): flag it and offer a bottom-up beta (average unlevered beta of comparable companies, relevered at the company's market debt/equity) as a separate estimate. Dimson or Scholes–Williams corrections only if labelled.
6. Default indices (user can change): US S&P 500 · India Nifty 500 (Nifty 50 / Sensex as alternatives) · UK FTSE All-Share · Japan TOPIX · Korea KOSPI · Germany CDAX (DAX alternative) · Canada S&P/TSX Composite · Australia S&P/ASX 200. Index price data follows the same development-only vendor rule as share prices (Paid · last).
7. ADRs and cross-listings: compute beta on the primary home listing against its home index; say so.
8. Banks and insurers: do not unlever/relever (deposits are operating liabilities).
9. Which beta the model uses by default is NOT changed silently: report what the engine uses today (sector defaults) and present the choice to Nihar before switching.

## Risk-free rate
10. Same rate the engine uses, in the currency of the accounts (METHODOLOGY §3, policy (a)); publisher, series type (par/spot/benchmark), tenor and date shown.
11. Consistency trap: Damodaran's ERP assumes a risk-free rate of US Treasury minus the US default spread; Kroll pairs its 5.0% US ERP with the 20-year Treasury. Never mix an ERP with a risk-free rate from a different convention without stating it. Document our pairing in METHODOLOGY.

## Equity and country risk premiums
12. Source: Damodaran's country table (mature-market ERP + country risk premium = total country ERP). Store the vintage date of every value (January 2026 table: US ERP 4.46%, mature 4.23%, India CRP 2.85%, total 7.08%; a July 2026 paper reportedly uses 4.20% mature — UNCONFIRMED).
13. Show whether "ERP" means mature-market or total country ERP; never add country risk twice.
14. Country risk follows where revenue and operations are (Damodaran). DECIDED: default to the country of incorporation until revenue-by-geography data exists, labelled as such; then weight by revenue geography.
15. Licence: Damodaran says "no strings attached" and that permission need not be asked, with acknowledgement requested; there is no formal licence text. Acknowledge him on the card; get his written OK before public launch (record in DATA_CONSTRAINTS). Kroll's figures: display terms UNCONFIRMED — do not display.
16. There is no official global ERP. OECD country risk classification is not a premium; do not use it as one.

## Cost of debt
17. Default: currency-matched risk-free rate + default spread from an actual rating where available, else a synthetic rating from interest coverage (EBIT ÷ interest expense) using Damodaran's table, with the separate table for financial firms. Show the rating used and its source.
18. Interest expense ÷ average interest-bearing debt shown only as a labelled cross-check ("historical effective rate"), never as the cost of debt.
19. Cost of debt in the same currency as cost of equity, whatever currency the company borrows in.
20. Tax rate: marginal statutory rate for the country, with the effective rate shown for comparison; a one-off low effective rate is not used for the tax shield.

## WACC
21. WACC = ke × E/V + kd × (1 − t) × D/V (+ preference capital where material).
22. Weights: market capitalisation for equity (price date and share count shown); book debt as a labelled proxy for market debt; lease liabilities included in debt (links to the debt-and-leases hook in build step 5). All in one currency at one date.
23. Show current weights; target capital structure only as an optional user override.
24. Banks and insurers: WACC "not applicable"; show cost of equity only (the engine already values them with residual income).

## Units and currency
25. Normalise GBp (pence), ZAc (cents) and ILA (agorot) to the main unit before any calculation.
26. Switching currency does not remove country risk; currency conversions use inflation differentials where needed.

## Card layout
- Headline: cost of equity and WACC (or "not applicable" for banks), each with an ⓘ.
- Rows: risk-free rate · beta (raw / adjusted / bottom-up, with diagnostics behind ⓘ) · ERP · country risk premium · cost of equity · cost of debt (rating, spread) · tax rate · weights · WACC.
- Every row editable; edits flow into the model and are recorded with an optional reason (Assumptions sheet), like the figures screen.
- Desktop and 390px phone; DESIGN.md rules apply.
