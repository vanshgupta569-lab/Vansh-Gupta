# Three approaches side by side, and the valuation bridge — specification

Compiled 26 October 2026 from research on the International Valuation Standards (2022 and 2025 editions), ICAI Valuation Standard 103 (2018), SEC-filed fairness opinions, training sources (labelled as such), and attribution methods (sequential walks, Shapley). Items marked UNCONFIRMED must be checked. Part of build step 5.

## Standards (for the method page; we do not claim compliance)
- IVS: renumbered — "IVS 105 (2022)" became "IVS 103 (2025)". The 2025 glossary treats weighting as reconciling indications of value and says it does not include averaging, which is not acceptable (wording from third-party copies; paragraph numbers UNCONFIRMED). One approach may suffice; several should be considered; the reconciliation is explained in the report.
- ICAI VS 103: one or more approaches; reliability-based weights by judgement are allowed; an exposure-draft sentence says simple weighting is not appropriate when values differ significantly (final text UNCONFIRMED).
- Our rule "never averaged" matches IVS and is stricter than ICAI practice. DECIDED: no averaging and no weighting by default. A user may enter their own weights later as a labelled personal judgement, never as a Marginalia default (Next, not this job).
- Bank fairness opinions show a range of implied per-share value for each analysis against the current and deal price; 52-week range and analyst targets "for reference only"; one states "no weighting is attributed to any specific indication".

## Part 1: Approaches side by side (football field)
1. One row per approach (income/DCF, market multiples, cost/asset), on one shared axis and one stated unit (per share for listed companies; enterprise value where per share is meaningless).
2. Each range comes from flexing stated assumptions (e.g. WACC and terminal growth for DCF; peer multiple quartiles for market), never ±x% around a point. The flexed assumptions are listed.
3. No cross-approach average, midpoint, blended value, weights or "consensus zone".
4. A current-price line is always shown; the 52-week range is a labelled reference row, never a fourth approach.
5. The asset-based result is a point or a narrow band if there is no honest range; label it "cost/asset approach" and say what it includes (book, tangible book, net current asset value).
6. A refused approach shows its plain-English refusal in its row (engine rule), not a blank.
7. If ranges don't overlap, say so neutrally ("the ranges do not overlap"), no verdict.
8. Caption: "Shown side by side; not combined."
9. Displayed values rounded sensibly; exact numbers on tap/hover.
10. Phone (390px): label above a full-width bar per row, low/high at the bar ends, shared axis, one current-price line; rows well above 24px tall; tap a row for a bottom sheet with its assumptions; "view as table" toggle so nothing depends on colour.
11. Desktop: same chart with an assumptions column aligned to each bar; hover for exact numbers.
12. Exports to the workbook and the one-/two-pagers (step 6).

## Part 2: Valuation bridge between two versions
Worked example (checked): V = FCF ÷ (WACC − g). Version A: FCF 100, WACC 10%, g 3% → 1,428.57. Version B: FCF 110, WACC 9%, g 3.5% → 2,000.00. Change +571.43.
- One-at-a-time from A sums to 490.84 (80.59 left unexplained); from B, 656.18.
- Sequential walks always add up but depend on order: WACC's share ranges from 238.10 to 307.69 across the six orders.
- Shapley (average over all orders): FCF 161.64, WACC 272.20, g 137.58 (137.59 after largest-remainder rounding) = 571.43 exactly, order-independent.

Rules:
13. Same model, same output metric in both versions; every changed input listed.
14. DECIDED method: Shapley attribution by default. Exact for up to 10 drivers (2^k model runs: 8 for 3 drivers, 1,024 for 10). Above 10, sample orders with a fixed seed (still sums exactly).
15. Group dependent inputs into one driver (e.g. all cost-of-capital inputs = "cost of capital"; each judgement-layer judgement = one driver).
16. Every mixed version must be runnable; if a mix is refused by the engine, report it rather than skip it.
17. Parts sum exactly to the total change, with a visible reconciliation line ("parts = total ✓") and an automated test. Round with largest remainder so displayed parts add up.
18. A new filing or data change between versions is its own labelled driver ("new data"), never hidden inside an assumption.
19. Zero-change drivers get zero. Guard "% of total" when the total change is near zero (show "n.m.").
20. Compute on the metric displayed; never convert an EV attribution into per-share afterwards.
21. Optional view: a sequential walk in the user's chosen order, labelled "results change with the order".
22. Wording: "associated with", never "caused by".
23. Method line: "Each driver's share is its average effect across all orders of applying the changes."
24. Phone: horizontal waterfall sorted by size; each row shows driver, from → to (e.g. WACC 10.0% → 9.0%) and signed value change; pinned total row. Desktop: vertical waterfall plus a table (driver, A value, B value, value change, % of total).
25. Versions come from saved models (KI-27 already restores every judgement); until accounts exist (step 7), versions are those saved in the browser.
