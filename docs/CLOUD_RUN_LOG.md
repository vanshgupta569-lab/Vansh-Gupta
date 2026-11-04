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
