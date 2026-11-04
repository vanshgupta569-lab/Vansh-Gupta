# VISUAL_BUILD_PLAN — build steps 8 and 9

Marginalia · how the seven visual specs become code · v1.0 · 4 November 2026.
A plan, not a spec: it settles where the specs disagree, orders the work into
one-session jobs, and says which jobs can run in a cloud session and which
need the company data files on a local machine.

Read with: `CLAUDE.md` (first design principle; one job per session; prove
every check fails), `DESIGN.md`, and the seven specs, **each with the
decisions at its top**:

| Spec | Version and decisions | Build step |
|---|---|---|
| `docs/VISUAL_SYSTEM.md` | v1.0, 29 Oct; decisions 30 Oct (ⓘ stays; Light theme Later; 3D budgets in step 8; all other CHANGE items approved) | 8 (tokens, motion), then everywhere |
| `docs/LANDING_SPEC.md` | v1.1, 31 Oct; decisions 31 Oct (every section kept; true counts; tagline kept) | 8 |
| `docs/NAV_SEARCH_SPEC.md` | v1.0, 31 Oct; decisions 1 Nov (built in step 9, after step 8) | 9 |
| `docs/COMPANY_OVERVIEW_SPEC.md` | v1.0, 1 Nov; decisions D1–D10 1 Nov | 9 |
| `docs/TABLES_SPEC.md` | v1.0, 1 Nov; decisions D1–D13 2 Nov | 9 (two data fixes earlier) |
| `docs/STUDIO_SPEC.md` | v1.0, 4 Nov; S1–S9 proposed | 9 |
| `docs/LEARN_STATES_SPEC.md` | v1.0, 4 Nov; L1–L8 proposed | 9 |

`docs/TEARSHEET_SPEC.md` (step 6) shares the type and palette rules and is
cited where it is affected.

Markers: **PROPOSED — needs Nihar** = my choice; listed in section 5.

---

## 1. How a contradiction is settled

In this order; the first rule that applies wins.

1. `CLAUDE.md` — the first design principle and the standing decisions —
   beats every spec.
2. A **decision recorded at the top of a spec** beats that spec's own body
   (e.g. VISUAL_SYSTEM's body replaces ⓘ; its decision 1 keeps it).
3. A **later recorded decision** beats an earlier one on the same question.
4. VISUAL_SYSTEM beats LANDING_SPEC (LANDING says so) and every later spec
   that says it "obeys VISUAL_SYSTEM".
5. An **approved CHANGE** in VISUAL_SYSTEM beats the DESIGN.md text it
   changes; DESIGN.md is then out of date and is updated by the session that
   owns it (not this one). Where DESIGN.md is not changed by an approved item,
   DESIGN.md wins over every spec.
6. A specific number beats a general rule written in the same document
   (the general rule is then corrected).

## 2. (a) Every contradiction, and the rule that wins

| # | Between | The contradiction | What wins | By rule |
|---|---|---|---|---|
| C1 | VISUAL_SYSTEM §9 / its decision 1 | Body: replace ⓘ with a dotted underline. Decision: ⓘ stays, 24×24 hit area (44×44 touch), only on labels that need it. | **ⓘ stays.** Every later spec already follows the decision. | 2 |
| C2 | VISUAL_SYSTEM §2 / its decision 2 | Body: ADD an optional Light theme for instrument screens. Decision: Later. | **Dark only on instrument screens.** The Light instrument tokens in §2 are not built in step 8. Paper (the reading ramp) is unaffected. | 2 |
| C3 | LANDING_SPEC §2.1 / its decision 6 | Body: replace the title "A Ledger That Never Lies". Decision: kept, exempt from the banned-word check for "never". | **Kept.** | 2 |
| C4 | DESIGN.md "four steps" / VISUAL_SYSTEM finding 8 (approved) | DESIGN.md: four sizes and nothing between them; tile figure 17px. VISUAL_SYSTEM: add a 24px tile-figure step and two landing-only steps, Lead 20/1.5 and Display `clamp(40px, 5vw, 64px)`. | **Six product steps** (Title, Section 20, Body 15, Small 13, tile figure 24) **plus two landing-only steps** (Lead, Display). DESIGN.md and `src/index.css` must follow: today `index.css` remaps `text-[24px]` to the Section step (20px), so a 24px tile figure cannot be written. | 5 |
| C5 | COMPANY_OVERVIEW §1.3 / its D1 (and TABLES D13) | Body defines Title-md 20, Title-lg 28, hero figure 40/44. D1: map 20, 28 and 40 onto DESIGN.md steps plus the 24 step; nearest step; no new sizes. TABLES_SPEC body calls D1 "still open" while its own D13 settles it. | **No 40px size.** Title-md = Section (20); Title-lg = Title (`clamp(28px, 2.8vw, 36px)`); hero figure = Source Sans 3 600 tabular at the Title size (36 at 1440, 28 at 390), the nearest step. STUDIO_SPEC §1.4/§4.2 corrected in this commit to say so. | 2, 3 |
| C6 | VISUAL_SYSTEM §4 (chart draw-in 640ms) / VISUAL_SYSTEM §5 (page-load sequences ≤ 600ms) / COMPANY_OVERVIEW D7 | The system's own draw-in token breaks its own 600ms page-load cap. D7: draw-in 400ms + 200ms fill. | **400 + 200ms on every chart** (Overview, studio, tearsheet preview); `--m-dur-chart` is redefined as 400. Settles STUDIO S7. | 3, 6 |
| C7 | VISUAL_SYSTEM §4 rule / its own table | "Exit = 70% of enter, always", but the page transition is out 120 / in 280 (43%). | **The table's numbers** (120 / 280); the rule is corrected to "exit ≈ 70% of enter unless a value is given". | 6 |
| C8 | DESIGN.md spacing tokens / COMPANY_OVERVIEW §1.1 (PROPOSED, not decided) / LANDING, NAV, TABLES | DESIGN.md: 1, 4, 8, 12, 20, 24, 40, 96. COMPANY_OVERVIEW proposes 4, 8, 12, 16, 24, 32, 48, 64 "no other values" (never decided). The specs use both sets (16, 32, 48, 64 in NAV/TABLES/COMPANY; 20, 40 in DESIGN and LANDING). | **The union**: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 96. Nothing in any spec then needs a value outside it. **APPROVED 4 Nov 2026** (V1). | 5 (DESIGN wins on its own values; the proposal only adds) |
| C9 | VISUAL_SYSTEM §3.2 (price = S1 = ink; the only categorical oxblood is the this-model forecast line) / the football field in code, STUDIO_SPEC and TEARSHEET_SPEC drafts | Code draws the income bars oxblood; my drafts put the current-price line in accent-text. | **Price line ink** (paper-ink on paper); no oxblood in the football field. STUDIO_SPEC §4.3 and TEARSHEET_SPEC §2.6 corrected in this commit. | 4 |
| C10 | VISUAL_SYSTEM §3.1 (one selected state: raised ground, 1px accent border, ink, 600) / COMPANY_OVERVIEW §1.5 (2px underline on the company tab row) / LEARN_STATES draft (2px accent bar on the current note and menu row) | Three "current" markers. | **One selected state**, with the single exemption VISUAL_SYSTEM itself grants: the 2px active-tab underline on the company tab row. LEARN_STATES §2.5 and §4 and STUDIO §3.2 corrected in this commit. The Paper raised ground is `#FAF9F5` (VISUAL_SYSTEM §2 Paper panel). | 4 |
| C11 | LANDING_SPEC header (wordmark, three links, ghost Search) / NAV_SEARCH §2 (one header on every screen: seven sections, Search, no clock) | Two headers for the landing page. | **NAV_SEARCH's one header.** It is later (1 Nov) and "one header on every screen" is its whole point. Until job 9.1 ships, the landing job leaves the existing header in place rather than build LANDING's version and replace it a week later. | 3, 4 |
| C12 | NAV_SEARCH (header collapses below 1100px) / COMPANY_OVERVIEW, TABLES, LEARN, STUDIO (desktop ≥ 1024) | Two desktop thresholds. | **Both, scoped**: 640 / 1024 for page layout everywhere; 1100 for the header alone (seven labels and a 320px search trigger do not fit at 1024). Written down so nobody "fixes" one to match the other. | 6 |
| C13 | VISUAL_SYSTEM §2 ("content max 1440px with 24px gutters, 48 at lg") / COMPANY_OVERVIEW D2 / code (`max-w-[1380px]` on the Margin notes and in `/learn/`; `max-w-[1440px] px-12` elsewhere) | Container width. | **D2: 1440 including gutters, content 1344** at ≥ 1024, 24px gutters below. | 2 |
| C14 | DESIGN.md (focus outline in read-oxblood) / VISUAL_SYSTEM §7 CHANGE | Focus colour. | **2px ink, offset 2px** (paper-ink on Paper). | 5 |
| C15 | DESIGN.md frontmatter `chip-ticker-selected` (solid oxblood) / VISUAL_SYSTEM §3.1 CHANGE | Selected chip. | **The one selected state** (C10). | 5 |
| C16 | DESIGN.md ("a computed figure" may be accent-text) / VISUAL_SYSTEM finding 14 ("a figure is always ink") | Figure colour. | **Ink**, except the changed figure after an edit (VISUAL_SYSTEM §3.1). | 5 |
| C17 | DESIGN.md PriceChart axis 11px / VISUAL_SYSTEM §3.2 CHANGE | Axis size. | **13px.** | 5 |
| C18 | DESIGN.md "uppercase mono" on buttons, chips, pills, nav / DESIGN.md's own Uniform Label rule and 13px floor / VISUAL_SYSTEM debt list | DESIGN.md contradicts itself. | **Sentence case, Source Sans 3, 13px** (already enforced in `index.css` by cancelling `.uppercase`). Literal capitals in source text (`NOTHING TO SHOW`, `FINANCIAL HEALTH SCORE`) are not reached by that and are fixed per screen. | 5 |
| C19 | DESIGN.md "Do set every number with `.font-figure`… including any number that tweens" / VISUAL_SYSTEM §5 CHANGE ("no number tweens") | Tweening. | **No number tweens** (`TweenNumber`, `FlashOnChange` go). | 5 |
| C20 | Missing-value notation: COMPANY_OVERVIEW §2.4 (words: Not reported `—`, Not applicable, Not meaningful) / TABLES D4 (`—`, `n/a`, `†` derived, `‡` restated) / SCREENER_SPEC rule 4 (value · `n.m.` · not available) / TEARSHEET (`c`, `r`, italic modelled) | Four notations. | **Scoped, one meaning each**: in a table cell, TABLES D4 symbols (`—` not reported, `n/a` not applicable, `n.m.` not meaningful — added to D4's set because SCREENER rule 4 and COMPANY_OVERVIEW both need it, `†` derived, `‡` restated); on a tile or in prose, the words; on paper, TABLES D4 symbols plus TEARSHEET's `c` and `r` for the user's own corrections and reclassifications, which D4 does not cover. Never `n/a` for "not available". **APPROVED 4 Nov 2026** (V2), because it extends TABLES D4. | 6 |
| C21 | TABLES D2 (rows 40 desktop, 52 phone) / LEARN_STATES (note index rows 40 / 48) / NAV_SEARCH (menu rows 36 desktop, 48 phone) | Row heights. | **No conflict once scoped**: D2 governs data-table rows; navigation lists keep their own spec's height. Recorded so the check for D2 is scoped to tables. | 6 |
| C22 | VISUAL_SYSTEM §4 (reveal on scroll allowed on landing and /learn) / LEARN_STATES L6 (not on article body) | Scope of reveal. | **LEARN_STATES' narrower rule**, which is permitted (it uses less motion than allowed). Proposed as L6. | 6 |
| C23 | LANDING decision 3 (true counts read at build) / LANDING §2.1 sub-headline ("up to five years of a company's own filings") / TABLES and TEARSHEET (ten years) | The page claims five years while the Financials tab and tearsheet show up to ten. | **The claims register** (LANDING §2.3): the number is read from what the build actually holds, with its date. The sentence is rewritten from the register in job 8.7. | 2 |
| C24 | LANDING decision 4 ("Three valuation approaches" only once step 5 ships) / the current football field already showing three approaches | Is step 5 shipped? | **Not shipped** until step 5 B lands (`docs/STEP5_BUILD_PLAN.md`): the landing claim stays off until then. | 2 |
| C25 | VISUAL_SYSTEM §2 (blur on the desktop scrim only) / NAV_SEARCH (palette scrim blur 6px) / LEARN_STATES and STUDIO (no blur on phone) | — | **No conflict**; recorded because the check must allow exactly one blurred layer at ≥ 640 and none below. | — |
| C26 | Header height: VISUAL_SYSTEM finding 20, NAV_SEARCH, COMPANY_OVERVIEW (64 / 48 condensed) / code (`py-4` header of variable height; `ScrollProgressBar` fixed at `top-20` = 80px with a `box-shadow` glow and a raw hex) | Code against specs, not spec against spec. | **64 / 48.** The progress rule sits at the header's bottom edge, transform-only, no shadow (DESIGN.md: not one `box-shadow`). Fixed in job 8.4. | 5 |

Corrections made to my own specs in this commit (C5, C9, C10): STUDIO_SPEC
§1.4, §3.2, §4.2, §4.3, checklist 12 and S6; TEARSHEET_SPEC §2.6 palette
row; LEARN_STATES_SPEC §2.5, §4, §5, checklist 5. Each now cites this file.

## 3. (b) Build order

One job per session, one commit, the full suite (`npm run verify`,
`verify:workbook`, `verify:dashboard`, `npx tsc --noEmit`, `npm run build`),
every Checks row at zero, and **each new check proved to fail by breaking its
fix on purpose** (CLAUDE.md). Where existing code breaks a new rule
everywhere, the check is a **ratchet**: it records today's measured count and
fails if the count rises; each later job lowers the recorded number, and the
rule's last job sets it to zero. A ratchet is not a removed check — it never
loosens.

### Step 8 — shared visual layer, then the landing page

| Job | What | Check | Proved to fail by |
|---|---|---|---|
| 8.1 | **Colour tokens.** Add VISUAL_SYSTEM §2–3 tokens to `src/design/tokens.ts` and their `--m-*` mirrors in `index.css`: `overlay`, `line-control`, `scrim`, the chart series S1–S5, the sequential and diverging ramps, the Paper raised ground. No Light instrument theme (C2). | `npm run verify` contrast block extended (VISUAL_SYSTEM §12.1): every text token ≥ 4.5:1 and every boundary token ≥ 3:1 on every ground it is used on; the two-file mirror check covers the new tokens. Report each ratio. | Setting `line-control` to `#3A3833` (≈ 1.6:1) fails the boundary check; deleting one mirror line fails the mirror check. |
| 8.2 | **Type steps.** Tile figure 24/28 and the landing-only Lead and Display steps in `SIZE`; hero figure = Title size (C5); the `index.css` remap corrected so `text-[24px]` reaches the tile step on tiles, and the unremapped `text-[52px]`, `text-[54px]` and `text-[60px]` (Margin notes, directory, methodology grid) snap to Title. DESIGN.md's table to be updated by its owner. | `verify:dashboard`: computed font sizes on every route the harness drives fall in the allowed set for that route (Display and Lead only on `/`); none below 13px including SVG text (§12.5). | Adding a `text-[60px]` element to a fixture route fails; an SVG `<text font-size="11">` fails. |
| 8.3 | **Motion tokens.** `--m-ease-*` and `--m-dur-*` (VISUAL_SYSTEM §4 with C6, C7) in `index.css` and `tokens.ts`. | Static scan (in `verify`): `transition: all` / `transition-all` → 0 (VISUAL_SYSTEM §12.2); animated properties outside transform, opacity and the chart's clip-path → ratchet; duration and easing literals outside `--m-*` (CSS `duration-500`, `ease-out`; motion `duration: 0.45`) → ratchet with today's count reported. | Adding `transition-all` to one component fails; adding one `duration-700` raises the count above the ratchet and fails. |
| 8.4 | **Reduced motion and the progress rule.** `data-motion="reduced"` on `<html>` from the media query and a stored setting; one hook JS motion subscribes to; the scroll-progress rule moved to the header's edge with no shadow (C26). | `verify:dashboard` reduced-motion pass at 360 and 1440 (§12.6): no running transform animation, every fade ≤ 110ms; the progress rule has no `box-shadow`. | Removing the media-query listener leaves a transform running under reduced motion and fails. |
| 8.5 | **Global interaction rules.** Focus ring 2px ink offset 2px (C14); `scroll-padding-top: 88px`; ⓘ hit area 24×24 / 44×44 via pseudo-element; selection and caret from the palette. | `verify:dashboard`: tabbing through each driven route, every focused element has a 2px outline in ink; every ⓘ's hit box ≥ 24×24 (≥ 44×44 under a coarse-pointer emulation); no focused element under the header. | Setting the ring to 1px or shrinking one ⓘ hit area fails. |
| 8.6 | **Landing: claims and counts.** The feature register (LANDING §2.4) as data; every count and claim read at build (decision 3), including the "five years" sentence (C23) and the step-5 gate (C24). | Build fails if a claim's feature is not `shipped`; the printed company count equals the count in the build's company set; every statistic has a unit, a date and a source. | Marking one feature `planned` while its claim is on the page fails the build. |
| 8.7 | **Landing: hero.** Copy (§2.1), Display and Lead steps, the particle wordmark within budget (VISUAL_SYSTEM §6), poster as LCP, pause control. | Particle count ≤ 12,000; one WebGL context on the page; poster ≤ 60KB; Lighthouse on the built landing page: LCP ≤ 2.5s, CLS ≤ 0.1, INP ≤ 200ms (§12.7); 3D chunk ≤ 180KB gzip. | Raising the particle count to 12,001 fails; a second `getContext('webgl2')` fails. |
| 8.8 | **Landing: the second scene.** The hexagon reuses the hero's canvas or becomes a static SVG (VISUAL_SYSTEM §6). | One WebGL context per page. | Re-adding the second context fails. |
| 8.9 | **Landing: sections 1–4** (what you can do, four ways in, who it is for, how it works) restyled per LANDING §3. | First design principle review by screenshot at 1440 and 390 (attached to the commit); accent budget per viewport (≤ 1 washed primary, ≤ 3 oxblood fills, ≤ 5 accent-text words) measured by the dashboard check; no uppercase computed text. | Adding a second washed primary in one viewport fails the budget. |
| 8.10 | **Landing: sections 5–8** (coverage with the only count-up, every figure has a source, the Margin notes band — links to `/learn/notes/` once L1 ships —, roadmap, feedback form states, about, footer). | As 8.9; the count-up only on the coverage stats, once, final value in the HTML. | A count-up added to another figure fails. |
| 8.11 | **Landing: phone and low-end.** VISUAL_SYSTEM §8 drops; 320px reflow; reduced motion. | 390 and 320 screenshots with no horizontal scroll; low-end emulation (4 cores, saveData) shows the poster, no WebGL. | Forcing WebGL on the saveData path fails. |

### Step 9 — every other screen

| Job | What (spec) | Check | Proved to fail by |
|---|---|---|---|
| 9.1 | **Global header and menu** (NAV_SEARCH §2–3; LEARN_STATES §4 phone sheet). No clock, ghost Search, seven sections, one selected state, phone sheet. | NAV checklist 1–12: height 64 / 48; no nav label oxblood at rest (computed `#A8A29A`); ≤ 1 selected item; sheet top at y = 64; targets ≥ 44 on touch; no `animate-pulse` in the header. | Re-adding the clock fails item 2; giving two items the selected state fails item 4. |
| 9.2 | **Search palette** (NAV_SEARCH §4–5) with the empty, no-match and error states of LEARN_STATES S12–S13. | NAV checklist 13–21 layout and focus items against the fixture; latency p50/p95 measured. | Removing the focus trap fails item 14. |
| 9.3 | **Loading screen** (NAV_SEARCH §6). | NAV checklist 22–30 with fake timers. | Opening the modal at 900ms fails item 22. |
| 9.4 | **One state anatomy and the error map** (LEARN_STATES §3.1, §3.5; `src/data/errorText.ts`, L8), applied to S1–S15. | Forcing offline, a 504 HTML reply and malformed JSON each render the mapped wording; no state title in literal capitals; online retry fires once. | Restoring `response.json()` before `response.ok` shows a parse error and fails. |
| 9.5 | **Not found** (LEARN_STATES §3.6): static `404.html`, in-app not-found, `vercel.json` rewrites for app routes. | Direct loads of `/screener?…`, `/learn/notes/x` and `/nope` in `vite preview` return the right screen; unknown path prints the path. | Deleting the `/screener` rewrite fails the direct-load case. |
| 9.6 | **Stale bands** (LEARN_STATES §3.4) on the company page, figures and valuation screens; stale-price band. | The dashboard's existing stale fixture shows the band on all three screens; border contrast ≥ 3:1. | Removing it from the valuation screen fails. |
| 9.7 | **Learn static pages** (LEARN_STATES §2.3–2.4): stylesheet from `SIZE`, static header, `lang="en-IN"`. | Build-time check over `dist/learn/**`: only allowed sizes, no uppercase, weights 400/500/600 only, `lang="en-IN"`. | Writing `font-weight: 300` back into the template fails. |
| 9.8 | **Margin notes** address and layout (LEARN_STATES §2.2, §2.5; L1). | Every note reachable by URL; Back works; phone index closed; previous/next order equals index order. | Breaking one note key's route fails. |
| 9.9 | **Company header and tab row** (COMPANY_OVERVIEW §1.4–1.6). | Header heights; stamp text; tab underline is the only accent at rest. | — as per spec checklist §7.1. |
| 9.10 | **Overview tiles** (COMPANY_OVERVIEW §2, D3–D5). | Twelve tiles in fixed order; formatter output ≤ 10 characters for every company in the payload set; every null has a reason. | Feeding a 12-character figure fails. |
| 9.11 | **Price chart** (COMPANY_OVERVIEW §3, D7, D9). | Spec checklist §7.3; draw-in 400 + 200ms (C6); gaps not bridged. | Interpolating across a gap fails. |
| 9.12 | **Cost-of-capital card** (COMPANY_OVERVIEW §4, D5, D6, D10). | Spec checklist §7.4. | Lowering the weak-fit threshold fails. |
| 9.13 | **Financials table** (TABLES §1–…, D1–D5, D10). | Rows 40 / 52; sticky header offset 0; every line renders; one right edge per column. | Re-adding "+ 6 more lines" fails. |
| 9.14 | **Evidence sheet** (TABLES, D1, D9). | Every SEC figure's sheet names concept, accession, form and date and links that document. | Blanking a concept fails. |
| 9.15 | **Screener results table** (TABLES, D7, D8, D12). | 50 per page (25 phone); two exclusion clauses; no export of vendor rows. | Exporting one vendor row fails. |
| 9.16 | **Studio addresses and step bar** (STUDIO §1, S1). | Four addresses; Back moves one step; one primary per step. | — |
| 9.17 | **Figures step** (STUDIO §2, S4, S5): undo/redo, state markers. | Caret placement regression; undo restores figure, head and reason; greyscale-distinguishable states. | Making the row draggable again fails the caret check. |
| 9.18 | **Judgements step** (STUDIO §3). | Every row shows default, source, used; nothing moves until Apply; pinned-driver state asserted. | Applying on change instead of on Apply fails. |
| 9.19 | **Valuation: one price and no zeros** (STUDIO §4.7, S3; conflicts 4, 6). | Every premium, the reverse DCF, the sensitivity shading and P/B recompute from the struck price shown; no displayed ratio is `0` where its input is missing; sweep before/after reports how many companies' premiums moved. | Reverting one premium to the live quote fails. |
| 9.20 | **Remove the health score** (STUDIO conflicts 1–3, S2). | No user-facing "health score" or `/100`; the five ratios still present in the Ratios table with formulas. | Re-rendering the radar fails. |
| 9.21 | **Sensitivity grids** (STUDIO §4.5, conflict 5). | Every cell recomputes at its printed row and column inputs; inadmissible cells read `n.m.`. | Restoring the `Math.max` clamp fails. |
| 9.22 | **Football field restyle** (STUDIO §4.3, S6, C9) — the visual layer only; the data changes are step 5 B. | Caption present; refused approach has a row with its sentence; no oxblood in the chart; price line ink. | Hiding a refused row fails. |
| 9.23 | **Headline block and motion clean-up** (STUDIO §4.2, §6): no pill colours for sign, `TweenNumber` and `FlashOnChange` removed; the 8.3 ratchets set to 0. | Ratchets at zero; premium text in words; no green/red tone on premium pills. | Re-adding one `TweenNumber` fails. |
| 9.24 | **Outputs step** (STUDIO §5) with the tearsheet panel once step 6 job 5 exists. | One primary; being-built items have no button. | Adding a button to a being-built item fails. |

Order constraints: 8.1 → 8.2 → 8.3 → 8.4 → 8.5 before anything else; 8.6
before 8.7–8.10; 9.1 before 9.2 and 9.3; 9.4 before 9.5–9.6; 9.16 before
9.17–9.18 and 9.24; 9.19 before 9.21 and 9.23. Step 5 B data changes should
land before 9.22 so the restyle is done once.

## 4. (c) Cloud session or local machine

**What decides it.** Company payloads (`verify/payloads/`) are gitignored and
fetched from the SEC and Yahoo; a cloud session here cannot reach outside
websites, and has none on disk. `npm run verify` (the curated Apple model),
`verify:dashboard` (every `/api/*` call answered from `verify/fixtures`) and
`verify:workbook` (Apple by default) run without them. `verify:sweep`,
`verify:compare`, `npm run screener:table` and any check "over every company"
need them, so those jobs run **locally in Cursor** with `npm run
verify:payloads` done first.

| Job | Where | Why |
|---|---|---|
| 8.1 tokens | Cloud | Contrast and mirror checks are pure arithmetic. |
| 8.2 type steps | Cloud | Dashboard on fixtures. |
| 8.3 motion tokens | Cloud | Static scan. |
| 8.4 reduced motion | Cloud | Dashboard on fixtures. |
| 8.5 interaction rules | Cloud | Dashboard on fixtures. |
| 8.6 landing claims and counts | **Local** | The count is the build's real company set, and the claims register is checked against it. |
| 8.7 hero | Cloud, if the npm registry is reachable for Lighthouse; otherwise **local** | Lighthouse is not a dependency today. |
| 8.8 second scene | Cloud | Context count in the browser. |
| 8.9 landing sections 1–4 | Cloud | Screenshots and budgets on the static page. |
| 8.10 landing sections 5–8 | **Local** | The coverage figures are read from the company set. |
| 8.11 landing phone | Cloud | |
| 9.1 header | Cloud | |
| 9.2 search palette | Cloud for layout; **local** for ranking tests | `/api/search` ranking needs the real company list. |
| 9.3 loading screen | Cloud | Fake timers. |
| 9.4 states and error map | Cloud | Forced failures in the fixture router. |
| 9.5 not found | Cloud | `vite preview`. |
| 9.6 stale bands | Cloud | The stale fixture exists. |
| 9.7 learn pages | Cloud | Build output only. |
| 9.8 margin notes | Cloud | |
| 9.9 company header | Cloud | |
| 9.10 tiles | **Local** | "≤ 10 characters for every company" is a sweep over payloads. |
| 9.11 price chart | Cloud (fixtures), with one **local** pass over real series for gaps and log-scale D9 | |
| 9.12 cost-of-capital card | **Local** | Beta needs the index series (`verify:indices`) and real payloads. |
| 9.13 financials table | Cloud for layout; **local** for "every line renders on every company" | |
| 9.14 evidence sheet | **Local** | Concept and accession per SEC figure. |
| 9.15 screener table | **Local** | The table is built from payloads (`screener:table`). |
| 9.16 studio addresses | Cloud | |
| 9.17 figures step | Cloud | Fixture company. |
| 9.18 judgements step | Cloud | |
| 9.19 one price, no zeros | **Local** | Moves displayed premiums; needs sweep before/after and counts of companies affected. |
| 9.20 remove health score | Cloud | Display only; no valuation moves. |
| 9.21 sensitivity grids | **Local** | Changes displayed values; measure how many companies' grids change. |
| 9.22 football field restyle | Cloud | Fixtures include a refused case. |
| 9.23 headline and motion | Cloud | |
| 9.24 outputs step | Cloud | |

Documentation-only jobs (this file, the specs) run anywhere and need no suite.

## 5. Decisions (Nihar, 4 November 2026)

**V1 to V6 are approved.**

- **V1. APPROVED** (Nihar, 4 November 2026). Spacing scale = the union of DESIGN.md's
  and the specs' values: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 96 (C8).
- **V2. APPROVED** (Nihar, 4 November 2026). Missing-value notation scoped by place:
  symbols in table cells (TABLES D4 plus `n.m.`), words on tiles and in
  prose, TEARSHEET's `c` and `r` added on paper (C20).
- **V3. APPROVED** (Nihar, 4 November 2026). `--m-dur-chart` becomes 400ms everywhere
  (C6), settling STUDIO S7.
- **V4. APPROVED** (Nihar, 4 November 2026). Ratchet checks for motion literals and
  animated properties until step 9 removes the last one (section 3), rather
  than fixing every component in job 8.3.
- **V5. APPROVED** (Nihar, 4 November 2026). The landing page keeps today's header until
  job 9.1 builds NAV_SEARCH's single header, instead of building LANDING's
  three-link header first (C11).
- **V6. APPROVED** (Nihar, 4 November 2026). DESIGN.md to be updated for C4, C14–C19 by
  the session that owns it; until then the approved VISUAL_SYSTEM CHANGE items
  are treated as law (rule 5).
