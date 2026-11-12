# STEP5_BUILD_PLAN — valuation completion, parts B, C and D

Marginalia · build step 5 · v1.0 · 4 November 2026 · a plan, not code.
From `docs/VALUATION_SIDE_BY_SIDE_SPEC.md` (Part 1 = B, Part 2 = C),
`docs/BASE_RATE_SPEC.md` (D), and the code as it stands on 4 November 2026.
Part A of step 5 is not in this brief and is not planned here.

Every job: one session, one commit, the full suite (`npm run verify`,
`verify:workbook`, `verify:dashboard`, `npx tsc --noEmit`, `npm run build`),
every Checks row at zero, `METHODOLOGY.md` updated in the same commit when the
engine's behaviour changes, and **each new check proved to fail by breaking
its fix on purpose** (`CLAUDE.md`). Jobs that change a displayed value run the
sweep before and after (`verify:sweep`, `verify:compare`) and quote the
movement; those need the gitignored payloads and run **locally**. Where a
choice is mine it is marked **PROPOSED — needs Nihar** and listed in section 6.

---

## 1. What already exists

| Piece | Where | State against the spec |
|---|---|---|
| Income approach bars, each flexed by stated assumptions | `src/data/companies.ts` `valuationBandsFor`: perpetuity at terminal growth ± the sensitivity step (1 pt), exit at the multiple ± one turn, each labelled with the range flexed | Meets Part 1 rule 2 for the income rows. |
| Perpetuity and exit values kept apart | `TerminalDashboard.tsx` `terminalMethods`; `src/data/terminalSpread.ts` (the gap stated, `WIDE_SPREAD` 25%) | Meets standing decision 4. |
| Market approach | `src/data/marketApproach.ts`: three multiples, the **median** of the peers for each, implied per-share value per multiple; `low`/`high` = lowest and highest of the up-to-three implied values; `mid` = their median | **Does not meet rule 2**: the range is the spread across three different multiples, not a range from flexing a stated assumption. |
| Asset approach | `src/data/assetApproach.ts`: book, tangible book, NCAV, liquidation at the reader's recovery rates; `informative` flag; `suitability` sentence | Meets rule 5 except the label (the bar is "Asset — what it owns") and the `mid` (a median of different measures, drawn as a point). |
| Football field | `src/components/valuationSections.tsx` `FootballField`; bands assembled inside `TerminalDashboard.tsx` (`fieldBands`) | Price line and 52-week reference row present. **Missing**: rule 6 (a refused approach shows its refusal in its row — today it has no row), rule 7 (non-overlap sentence), rule 8 (the caption), rule 10 (phone layout, view as table), rule 12 (export). Colours and type: `docs/STUDIO_SPEC.md` §4.3. |
| Premium or discount per method | `TerminalDashboard.tsx` `premiumAgainst`, (price − value) ÷ value | Computed in a component; measured against the live quote while the value was struck at the stored price (STUDIO_SPEC conflict 4). |
| A model rebuilt from a set of judgements | `src/data/restoreModel.ts` `restoreFromJudgements(fetched, judgements)` → perpetuity and exit values, or the engine's refusal; `reopensAt` | **The core of part C exists**: every mixed version can be built by passing a mixed judgement record. |
| Saved versions | `src/data/savedModels.ts` (version 3): drivers, view mode, corrections and reasons, heads, verdicts and applied verdicts, peers, recovery rates, the share price; `produced` values | The two versions part C compares. Browser-only until accounts (step 7). |
| "Saved at" beside "reopens at" | `savedModelsPanel.tsx` | Already reports when new filings moved a saved value — the "new data" driver's raw material. |
| Revenue forecast path | `src/engine/model.js` `buildModel` forecast rows; growth fades from a median start to the terminal rate (`METHODOLOGY.md` §2) | The assumed CAGR part D compares against is read from here, never re-derived. |
| SEC company facts per company | `api/company.js` (`data.sec.gov/api/xbrl/companyfacts/CIK….json`), ordered tag lists per line | Part D's revenue must use **the same tag lists** — today they live only inside `api/company.js`. |

Nothing exists yet for the Shapley attribution, the waterfall, or base rates.

## 2. Part B — three approaches side by side

| Job | What | Check | Proved to fail by | Where |
|---|---|---|---|---|
| B1 | **BUILT 4 November 2026.** **One valuation summary.** Lift `valuationBands`, `terminalMethods`, `premiumAgainst` and `fieldBands` out of `TerminalDashboard.tsx` into a pure `src/data/valuationSummary.ts` that takes the source, drivers, the market and asset results and **the struck price**. The dashboard reads it. This is also `docs/TEARSHEET_SPEC.md` job 1 — one job, not two. | Across the payload set, every band, point and premium equals what the dashboard printed before the move, captured from the rendered page (not from the new function — CLAUDE.md "comparing a figure against itself"). Premium is struck at the record's price (STUDIO S3). | Flip the premium's sign in the new function: the browser check and the sweep comparison both fail. | Local (sweep); the dashboard half runs on fixtures |
| B2 | **Market range from a stated flex.** For each usable multiple, the implied per-share value at the peers' 25th and 75th percentile multiple, with the median as the point; the row's range is the union across the usable multiples and its detail line names them (`EV/EBITDA 9.8–14.1×, P/E 18–26×, 7 peers`). Fewer than 4 peers on a multiple: that multiple uses min–max of the peers and says so. **APPROVED 4 Nov 2026** (B-1). **BUILT 8 Nov 2026**: 56 companies get a market range from a sector peer set and all 56 widened, the widest 11.9x at ADI; no valuation moves, because the market approach is never folded into the headline. `METHODOLOGY.md` §18. | Identities on every company: low ≤ point ≤ high; each bound reproduces from the listed peer multiples and the company's own figure (computed independently in the check); a peer set changed by the reader moves the range. Sweep before/after: how many market ranges widened or narrowed, and the largest move. | Use the mean instead of the percentile in the builder: the independent recomputation fails. | Local |
| B3 | **Asset row.** Label `Asset — book, tangible book, net current assets` (plus `liquidation at your recovery rates` when shown); the point is drawn only where one measure survives (rule 5: "a point or a narrow band if there is no honest range"); `informative: false` prints the suitability sentence in the row. **BUILT 8 Nov 2026**: 149 asset rows, 34 with one measure and a point, 115 with a range and none, 81 carrying the suitability sentence. `METHODOLOGY.md` §17a. | Every asset row's label lists exactly the measures inside its range; no point drawn when more than one measure is in range. | Re-add the median point: fails. | Cloud (fixtures) |
| B4 | **Refusals, caption, overlap.** A refused approach (market unavailable, asset all negative, DCF refused) is a row carrying the engine's sentence (rule 6); `Shown side by side; not combined.` (rule 8); `The ranges do not overlap.` when no two approach ranges intersect, and never otherwise (rule 7). **BUILT 8 Nov 2026**: shown + refused = 3 on all 174 companies, 254 refused rows; the sentence appears on 6, is withheld on 54 that overlap and 114 with fewer than two ranges. The scan found the income approach's own label reading `EV / EBITDA exit`; D4's allow-list is implemented in `screener.ts` as `bannedWordsInCopy`. `METHODOLOGY.md` §17a. | Over every company: approaches shown + approaches refused = approaches attempted; the overlap sentence appears iff the computed ranges are disjoint. Banned-word scan (`src/data/screener.ts` `bannedWordsIn`, with the exit-multiple allow-list of TEARSHEET D4) over every row string. | Hide one refused row: the count identity fails. Print the overlap sentence on an overlapping case: fails. | Local for "every company"; fixtures for the browser half |
| B5 | **No average anywhere.** A scan that fails on any field named or computed as a cross-approach mean, midpoint, weight or "consensus" in `valuationSummary.ts`, the workbook builder and the tearsheet contract. | Static and runtime: no output value equals the mean of two approach points except by coincidence flagged for review (report the count; today 0 expected). | Add a "blended" field: fails. | Cloud |
| B6 | **Export.** The side-by-side table in the workbook (rule 12) — each row's low, point and high as **live formulas or links** to the cells that produce them, never pasted (KI-4). Adding a sheet changes the sheet set, which `CLAUDE.md` says to ask about first: **APPROVED 4 Nov 2026** (B-2): a new `Valuation summary` sheet after DCF, appended so no existing row position moves. The tearsheet reads B1's summary directly. | `verify:workbook`: each workbook row recalculates to the site's value; editing the WACC cell in the workbook moves the income rows (the KI-4 first-edit test). | Paste a value instead of a formula: the first-edit test fails. | Cloud (Apple) + local (every company) |
| B7 | **Phone and table view** (rule 10) — the visual half is `docs/VISUAL_BUILD_PLAN.md` job 9.22; this job adds `View as table` and the bottom sheet of assumptions. | 390px: label above bar, ≥ 24px rows, one price line; the table holds the same numbers as the chart. | Drop one row from the table view: fails. | Cloud |

Order: B1 → B2 → B3 → B4 → B5 → B6 → B7. LANDING_SPEC decision 4 ("Three
valuation approaches" on the landing page) switches on after B4.

## 3. Part C — the valuation bridge (Shapley attribution)

**The metric.** One displayed per-share value in one version pair: the
perpetuity value by default, the exit-multiple value on request; never one
converted into the other, and never an EV attribution turned into per share
afterwards (rule 20). The market and asset rows are not bridged in version 1
(they move only with peers and recoveries, which are their own drivers); the
screen says so. **APPROVED 4 Nov 2026** (C-1).

**The drivers (rule 15), from `SavedJudgements`:**

| Driver | What it groups |
|---|---|
| New filings | the payload differs (a later filing; `reopensAt` already detects it) — always its own driver (rule 18) |
| Share price | the record's `sharePrice` (it moves the WACC weights) |
| Cost of capital | every cost-of-capital input moved together |
| Each forecast driver | revenue growth, operating margin, tax, capex, working capital… one driver per slider key |
| Each corrected figure | one driver per corrected field |
| Each moved line | one driver per head assignment |
| Qualitative answers | all applied verdicts as **one** driver, because their caps make them interact |
| View mode | derived / analyst |

| Job | What | Check | Proved to fail by | Where |
|---|---|---|---|---|
| C1 | **Driver list and version mixing.** `src/data/bridge.ts`: `driversBetween(A, B)` lists every input that differs, grouped as above (rule 13); `mix(A, B, subset)` returns a judgement record taking `subset` from B and the rest from A; each mix valued with `restoreFromJudgements`. A refused mix is reported, not skipped (rule 16). | For every pair of saved fixtures: `mix(A,B,∅)` reproduces A's value and `mix(A,B,all)` B's, exactly; every changed input appears in exactly one driver; a mix the engine refuses appears in the result with its sentence. | Drop one input from the grouping: the "exactly one driver" identity fails. | Cloud (fixtures) |
| C2 | **Exact Shapley up to 10 drivers.** 2^k runs, cached by subset; largest-remainder rounding of the displayed parts. | The spec's worked example as a fixture: A 1,428.57, B 2,000.00, change +571.43; FCF 161.64, WACC 272.20, growth 137.58 (137.59 after rounding); one-at-a-time from A sums to 490.84 and is **not** what is shown; parts sum to the total to the cent on every random pair of fixtures; a zero-change driver gets exactly 0 (rule 19). Measure the time for 10 drivers (1,024 runs) and report it. | Replace Shapley with a sequential walk in a fixed order: the worked example fails (WACC 238.10 or 307.69, not 272.20). | Cloud |
| C3 | **Above 10 drivers: sampled orders** with a fixed seed. Each sampled order's contributions sum to the total, so the average does too (rule 14). | Sum exactness on a 14-driver fixture; same seed gives identical parts; the sampled estimate for a 10-driver case lies within a stated tolerance of the exact one (tolerance measured and recorded). | Change the seed per run: the repeatability check fails. | Cloud |
| C4 | **Performance.** If C2's measurement exceeds 2 seconds on the dashboard's machine, run the subsets in a Web Worker with the bridge shown after it completes, not progressively. **APPROVED 4 Nov 2026** (C-2) only if needed. | Time to result reported; the UI never shows partial parts. | Render before completion: the "parts = total" line fails mid-run. | Cloud |
| C5 | **The screen.** STUDIO_SPEC §4.6: waterfall sorted by size, table (driver · A · B · change · % of total, `n.m.` near zero), `Parts {sum} = total {Δ} ✓`, the method line (rule 23), "associated with" (rule 22), optional sequential walk labelled "results change with the order" (rule 21). Phone horizontal waterfall (rule 24). **BUILT 12 Nov 2026** as `src/components/valuationBridge.tsx`; the share rule is asked of `bridge.ts` rather than reimplemented on the screen, and sign is carried by the label and the bar rather than by colour. Proved by breaking five ways. | Dashboard: the reconciliation line's two numbers are equal on the page; every displayed part matches C2's rounded output; no "caused" string (scan). | Remove largest-remainder rounding: the displayed parts stop adding up on the worked example and the line fails. | Cloud |
| C6 | **Real versions.** Bridge between a saved model and its reopen after new filings, over the payload set: how often "New filings" is the largest driver, largest absolute part. **BUILT 12 Nov 2026** as `verify/bridgeVersions.mts` (`npm run verify:bridge`), on the capture archive: 93 companies whose filings changed, 36 bridging, "New filings" the largest driver on 31 of them, largest part 336.88 a share at MELI, worst parts-to-total gap 9.95e-14. Bridged + refused = pairs found, which caught two pairs escaping a `catch`. | Every company with two versions: parts sum exactly; no NaN; refused mixes counted. | Corrupt one payload's statements: its mixes are reported as refused, not skipped. | Local |

## 4. Part D — the base-rate check (SEC bulk data)

**What is shown** (BASE_RATE_SPEC): beside the model's revenue growth, `X of
N US companies with starting revenue $2–5bn grew revenue at ≥ {the model's
5-year CAGR} over five years, 2009–2025`, with N always visible, a Wilson
interval, real and nominal labelled, "too few comparable companies" below N =
30, and no verdict words or colours.

**The model's CAGR** is read from the engine's forecast revenue (first to
fifth forecast year against the last reported year), never recomputed from
the drivers.

### 4.1 What the data needs

- **Source (DECIDED in BASE_RATE_SPEC):** the SEC's XBRL bulk company facts
  — one archive holding every filer's `companyfacts` JSON, the same shape
  `api/company.js` already reads one company at a time. Facts from about
  2009 onward (XBRL phase-in).
- **Revenue concept:** the ordered tag list `api/company.js` uses for revenue,
  **moved into one shared module** both read, so the base rate and the model
  cannot disagree about what revenue is (CLAUDE.md "two copies").
- **Annual values only:** 10-K / 20-F / 40-F facts with a full-year duration
  (about 365 days, allowing 52/53-week years as `METHODOLOGY.md` §2 does);
  restated values keep the latest filed figure for a period, and the
  as-first-reported figure is kept beside it for a later point-in-time view.
- **Currency:** USD reporters in version 1; a non-USD filer is excluded and
  counted (rule 11).
- **Size bands:** starting revenue in nominal USD of the start year, bands
  fixed in advance and published: < $0.5bn, $0.5–2bn, $2–5bn, $5–25bn, ≥
  $25bn. **APPROVED 4 Nov 2026** (D-1) — our own bands, not a study's.
- **Real growth:** deflated with BLS CPI-U annual averages (rule 7), the
  series and its as-at date stored with the table.
- **Survivorship:** include every company whose facts exist for the window,
  dead or alive (rule 9); if deregistered or acquired filers are not in the
  archive, the result says `survivors only; likely overstates growth`.
- **Output:** a small precomputed table committed to the repository
  (`src/data/baseRates.json`: band × horizon × start-decade → N, and the
  sorted CAGRs or a fine histogram so any threshold can be counted), with the
  build date, the archive's date and the CPI vintage. The raw archive stays
  out of git (gitignored, like `verify/payloads/`). **PROPOSED — needs
  Nihar** (D-2).

### 4.2 Open questions (could not be confirmed here — outside websites are blocked in this session)

1. **Size of the bulk download.** The SEC publishes the company-facts archive
   as one zip. Its current size is **not confirmed**: from memory it is of the
   order of a gigabyte compressed and many times that unpacked, which would
   put it beyond a cloud session's disk allowance and decides that D2 runs
   locally. Measure it on download and record it in `DATA_CONSTRAINTS.md`.
2. **Are deregistered and acquired companies included?** **Not confirmed.**
   BASE_RATE_SPEC item 2 already marks it UNCONFIRMED. Test it directly in D0:
   look up three companies known to have stopped filing (an acquired one, a
   bankrupt one, a voluntarily deregistered one) and see whether their facts
   are present.
3. **If they are not:** the SEC's XBRL **frames** API (one concept, one
   period, every filer that reported it) and the quarterly **Financial
   Statement Data Sets** both index filings as filed, so a company that later
   stopped filing should still appear for the years it filed — **not
   confirmed** either; D0 checks the same three companies there.
4. **Fair-access limits.** The SEC asks automated clients to identify
   themselves and limit request rates; the bulk archive avoids per-company
   requests. The current figure for the limit is not confirmed here.
5. **Licence.** SEC filings are US government records; BASE_RATE_SPEC records
   the data as "free, public, reusable". No further check needed for the
   computed table, which is ours.

### 4.3 Jobs

| Job | What | Check | Proved to fail by | Where |
|---|---|---|---|---|
| D0 | **Answer the open questions** (4.2 items 1–4) and record them in `DATA_CONSTRAINTS.md` (what the source does not publish) with the bound on what a missing group could do (rule 9). Documentation plus a measurement script. | The three named companies' presence or absence recorded with the file and date checked. **DONE 12 Nov 2026**: 1.33GB compressed, 18.16GB unpacked, 20,571 filers, read from the zip directory without unpacking. Time Warner Cable Inc., Sears Holdings Corp and Dell Inc are all present, so the universe is NOT survivors-only and rule 9's warning is not required. `DATA_CONSTRAINTS.md`. | — (a measurement) | **Local** (network, disk) |
| D1 | **One revenue definition.** Move the revenue tag list (and the annual-period rule) out of `api/company.js` into a shared module both the fetcher and the base-rate builder import. No behaviour change. | `verify:sweep` before and after: every company's revenue identical in every year. **DONE 12 Nov 2026** as `api/_revenueDefinition.js` — a SIBLING in `api/`, not `src/data/`, because a file in `api/` is packaged on its own and an import into `src/` takes the route down (the same constraint `payloadVersion.ts` exists for). 170 entries compared — 85 filers' whole revenue series and the tag each chose — all identical. | Reorder two tags in the shared list: the sweep shows companies whose revenue changed. | **Local** |
| D2 | **The builder.** `scripts/buildBaseRates.mts`: read the archive, select annual USD revenue per filer, compute every h-year CAGR (h = 3, 5, 10) for every start year, nominal and real, band by starting revenue, write `src/data/baseRates.json` with the vintages. | Identities: X ≤ N for every threshold; N per band sums to the companies with a value in that window; a company appears at most once per start year and horizon; CAGR recomputed from the two revenue figures for a sample of 50 company-windows reproduces exactly; real < nominal whenever CPI rose. Report N per band and horizon, and the excluded counts (non-USD, too short, missing years — never filled, rule 3 of the standing decisions). **BUILT 12 Nov 2026** as `scripts/buildBaseRates.mts` with `verify:baserates`: 20,571 filers streamed from the archive without unpacking it, 6,914 contributing 60,771 company-windows in 154s. Excluded and counted: 10,362 no usable revenue, 2,959 a start not positive, 2,816 too short, 2,363 a missing year, 5,336 no CPI at both ends, 28 not USD. Five-year median nominal growth falls 8.6% / 7.2% / 4.7% / 3.4% / 3.9% / 3.3% as starting size rises, and the share reaching 15% falls from 41% to 2%. `METHODOLOGY.md` §17d. | Treat a missing year as zero revenue: the recomputation and the N identity fail. Leave one non-USD filer in: the currency check fails. | **Local** |
| D3 | **Cross-check, not a target.** Compare our 5-year nominal and real distributions with the published studies' figures on the method page only (median, share above 15%), each with its own universe stated, never in one table (BASE_RATE_SPEC "never combine"). Where ours is far from theirs, investigate and write down why (standing decision 9). | A written comparison in `METHODOLOGY.md`; no pass/fail threshold. | — | Cloud (reads the committed table) |
| D4 | **The lookup.** `baseRateFor(company, horizon, assumedCagr)` → group, period, horizon, metric, X, N, Wilson interval, real/nominal, or `too few comparable companies` (N < 30), or for a non-US company `Base rates for {country} not yet available` with an optional, labelled `US reference group` (rule 3). The group default is fixed (starting revenue band) and never chosen by the result (rule 8); sector narrowing optional with N shown shrinking. | Fixture companies: correct band; N always present; the suppression at 29 and display at 30; a non-US company never receives a US figure unless the reference group is chosen. Wording scan: BASE_RATE_SPEC rule 15's words (unrealistic, should, likely, aggressive) plus `BANNED_WORDS`. | Set the minimum N to 29: the suppression check fails. Auto-pick the narrower group: the fixed-default check fails. | Cloud |
| D5 | **On the valuation screen.** Beside the revenue growth assumption: the sentence, a small icon array or bar with the same denominator, the interval, the "what it doesn't say" line (rule 16), the M&A line (rule 10), the date stamp (rule 14); no red/green, no pass/fail (rule 15). Tearsheet two-pager gains it in its valuation summary. | Dashboard: N printed; no colour other than the palette's neutral ramp on the array; the string scan passes; the figure equals D4's output for the fixture. | Colour the array by whether the assumption is above the median: fails. | Cloud |
| D6 | **Method page** in `/learn/` — what the group is, where the data comes from, overlapping windows (rule 13), survivorship, the studies cited and not reproduced (BASE_RATE_SPEC rule 1). | Build-time check: the page exists, cites the table's vintages; LEARN_STATES type rules. | — | Cloud |

Order: D0 → D1 → D2 → D3 → D4 → D5 → D6. D0–D2 need the archive and run in
Cursor; from D3 on, the committed table is enough.

## 5. Order across B, C and D

B1 first (the tearsheet and C both read the summary). Then B2–B4, so the
side-by-side is finished before anything is exported or bridged. C1–C3 can run
beside B because they read only `restoreFromJudgements`. D0–D2 are
independent and can start at any time on the local machine. B6 (export) and
C5 (screen) wait for their decisions (B-2, C-1).

## 6. Decisions (Nihar, 4 November 2026)

**B-1, B-2, C-1, C-2, D-1 and D-2 are approved.** B-2 is the one that needed
asking under `CLAUDE.md` — a new sheet in the workbook — and it is approved as
proposed: a `Valuation summary` sheet **appended after DCF**, so no existing
sheet moves and no row position a firm's macro depends on changes. **D-3 is not
a proposal and stays open**, to be answered by measurement in job D0.

- **B-1. APPROVED** (Nihar, 4 November 2026). The market range is the peers' 25th–75th
  percentile of each usable multiple applied to the company's own figure, with
  min–max below four peers, said in the row.
- **B-2. APPROVED** (Nihar, 4 November 2026). A new `Valuation summary` sheet in the
  workbook, appended after DCF so no row position moves. `CLAUDE.md` requires
  asking before the sheet set changes.
- **C-1. APPROVED** (Nihar, 4 November 2026). Version 1 of the bridge explains the
  perpetuity value (exit value on request) only, not the market or asset
  rows.
- **C-2. APPROVED** (Nihar, 4 November 2026). Run the bridge in a Web Worker if 1,024
  engine runs take more than 2 seconds.
- **D-1. APPROVED** (Nihar, 4 November 2026). Size bands < $0.5bn, $0.5–2bn, $2–5bn,
  $5–25bn, ≥ $25bn, nominal USD of the start year.
- **D-2. APPROVED** (Nihar, 4 November 2026). Commit the computed base-rate table to the
  repository; keep the SEC archive out of git.
- **D-3. Open (not a proposal):** the archive's size and whether deregistered
  and acquired companies are included (4.2) — answered by measurement in D0.

### Decisions raised while building (cloud run, 4 November 2026)

- **C-3. APPROVED (Nihar, 4 November 2026).** "% of total" on the bridge reads `n.m.`
  when the total change is under **0.5% of version A's value**
  (`SHARE_NOT_MEANINGFUL_BELOW` in `src/data/bridge.ts`). Rule 19 asks for
  `n.m.` "near zero" without a number; half a percent is small enough that a
  real move is never hidden and large enough that a rounding-sized change is
  never divided by.
- **C-4. APPROVED (Nihar, 4 November 2026).** The bridge explains the values
  `restoreFromJudgements` returns, which are rounded to the cent (they come
  from `valuationBandsFor`). The parts therefore explain the cent-rounded
  value per share the site shows, not the engine's unrounded figure; the
  difference is under a cent per run. Changing it needs `restoreModel.ts`,
  which another session owns.
