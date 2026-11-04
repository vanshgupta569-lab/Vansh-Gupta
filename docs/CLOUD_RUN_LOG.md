# CLOUD_RUN_LOG — the long cloud run of 4 November 2026

Branch `claude/cloud-run-step5c-step8-step9`, started from
`claude/step8-reduced-motion-focus` (jobs 8.1–8.5). One line per job: what was
done, what was measured, how each new check was proved to fail, and what must
still be run locally in Cursor (the company payloads are gitignored and outside
websites are blocked in this session).

Standing limits of this session, true for every job below:

- `npm run verify` runs with an empty `verify/payloads/` folder and stops, as it
  always has here, at the first section that reads a company payload; every
  section before that point runs (the palette, motion, the bridge).
- `verify:workbook`, `verify:sweep` and `verify:compare` need payloads and are
  **LOCAL**.
- Files another session is changing are not touched: TerminalDashboard.tsx,
  valuationSections.tsx, figuresEditor.tsx, financialsTab.tsx, src/engine/,
  api/, autoCompany.ts, figureFormat.ts, financials.ts, companies.ts,
  marketApproach.ts, assetApproach.ts, savedModels.ts, restoreModel.ts,
  DESIGN.md, ROADMAP.md, docs/VISION.md, CLAUDE.md.

## Log

| # | Job | Result |
|---|---|---|
| 0 | Merge `origin/main` (Nihar's 4 November decisions in each plan; the new single header; tearsheet, studio and token branches) into this branch | Two conflicts, both resolved. `src/index.css`: kept this branch's focus ring (it fixes the fade-in from `transition-colors` and wins over a component's own `outline: none`) and took main's `[data-ground="paper"]` hook as the paper selector, replacing the background-attribute match. `verify/dashboard.mts`: took main's comment on the 383 ratchet. verify (to the payload stop), dashboard 0 problems, tsc 0, build OK. |
| C1 | Bridge drivers and version mixing: `src/data/bridge.ts` (`driversBetween`, `mixVersion`, `valueOfVersion`), every version valued through `restoreFromJudgements`, unchanged | Check `verify/bridge.mts` (run from `npm run verify`, on the paper fixture): the drivers equal the 6 inputs changed by hand (share price, cost of capital as one, three forecast drivers, one correction); A with none of B is A (27.14), with all of B is B (36.31); A is not changed by mixing; each driver alone moves the value; a mix on refused filings reports the engine's sentence; a changed peer set is listed as not bridged. Proved to fail: share price left out of the drivers (driver list wrong); the correction skipped in mixing (A+all = 34.68, not 36.31; the correction inert). Found: `restoreFromJudgements` returns values rounded to the cent (`valuationBandsFor`), so the bridge explains cent-rounded values. |
| C2 | Exact Shapley up to 10 drivers: `shapley`, `largestRemainder`, `bridgeBetween` in `src/data/bridge.ts` | The spec's worked example as a fixture: 1,428.57 → 2,000.00, FCF 161.64, WACC 272.20, growth 137.59 (137.5846 unrounded) = 571.43 in 8 runs; one-at-a-time 490.84, not used. The paper fixture with 7 drivers (one a reason-only change): 128 runs, 567ms, parts = total to the cent (9.17), the inert driver exactly 0; a refused mix leaves no bridge and names the mix. Proved to fail: a fixed-order walk instead of Shapley (FCF 142.86, WACC 261.90, growth 166.67); plain rounding instead of largest remainder (growth 137.58, the total off a cent). PROPOSED C-3 (n.m. below 0.5% of A) and C-4 (the bridge explains cent-rounded values) in `docs/STEP5_BUILD_PLAN.md`. |
| C3 | Sampled orders above 10 drivers, fixed seed (`SAMPLED_ORDERS` 2,000, `SAMPLE_SEED` 20261104, `mulberry32`) | 14-driver function with interactions: parts sum to the total exactly; same seed, same parts; another seed, different parts; worst part 0.1007 from the exact attribution (16,384 runs), 0.089% of the 113.78 total, inside the 1% tolerance recorded in the check. 2,000 orders over 14 drivers touched 9,620 distinct subsets: on the real engine (about 4.4ms a run, measured in C2) that is roughly 42 seconds, so a bridge over more than 10 drivers is slow — see C4. Proved to fail: a seed that changes every run (parts not repeatable); averaging over one order too few (parts sum to 113.84, not 113.78). |
| C4 | Timing for 10 drivers; a Web Worker because it is over 2 seconds (C-2): `src/data/bridgeWorker.ts`, `src/data/bridgeRunner.ts` (`bridgeInWorker`: one answer, the finished bridge; no progress callback) | Measured: 10 drivers, 1,024 runs, 3.3–4.7 seconds in Node (3.2–4.6ms a run) and 4.3 seconds in the browser — over the line, so the worker is built. Dashboard check: the ten-driver fixture through `bridgeInWorker` in the real browser returns all 10 parts summing to 7.82, each equal to the Node bridge, while the page's 50ms timer kept 86 of ~86 ticks. The first version of the timer check ran on the landing page, whose particle canvas holds the main thread on its own (9 ticks in 5s with the bridge in a worker); it now runs on the company overview with reduced motion and compares against the page's own idle rate. Proved to fail: the bridge forced onto the page (0 ticks in 2.8s against 20 a second idle); the worker answering first with a part-way bridge (5 parts, not 10; sum 5.86, not 7.82). |
