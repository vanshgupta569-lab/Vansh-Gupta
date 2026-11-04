# STUDIO_SPEC_ADDENDUM — findings from screenshots (free-chat review, 3–4 November 2026)

The main spec is docs/STUDIO_SPEC.md (written from the code). This addendum adds what a separate review found by measuring nine screenshots, and records Nihar's decisions on its questions. Where the two disagree, docs/STUDIO_SPEC.md and its decisions (S1–S9) win, and so do earlier decisions (VALUATION_SIDE_BY_SIDE_SPEC: Shapley attribution).

## Decisions (Nihar, 4 November 2026)
- D1 Live recompute: target 400 ms per edit; the developer measures. If it can't be met, edits batch behind a "Recalculate" action and Valuation shows "Out of date" until it runs.
- D2 Step order Figures → Judgements → Valuation → Outputs: approved. Primary action labels follow docs/STUDIO_SPEC.md §1.3 (code-based), not this review.
- D3 Share-based pay inside SG&A or as an "of which" memo: decide from each filing (how the company presents it), recorded per line; the head must show its own total so a reader can see what is inside it.
- D4 Judgement-to-assumption mapping: the existing src/data/qualitativeFactors.ts mapping and caps, shown on the Judgements step.
- D5 Bridge attribution: Shapley (already decided in VALUATION_SIDE_BY_SIDE_SPEC and STEP5_BUILD_PLAN C2), NOT the sequential method proposed in this review.
- D6 Football-field axis: spans the lowest to highest value shown (with padding), with printed ticks; it does not start at zero (bars are ranges, not magnitudes). No zoom control.
- D7 Drafts and versions: in the browser until accounts (docs/ACCOUNTS_PLAN.md); 20 versions per company.
- D8b Reverse DCF showing exactly 5.0% terminal growth: the developer checks whether that is a solved value or the search ceiling; a ceiling must be shown as "at the limit of the range searched (x–y%)", never as a solved value.
- D9 Reasons up to 160 characters; they travel into exported files by default.
- D10 Football-field bars: as STUDIO_SPEC S6 (read fills, ink price line, no oxblood).
- D11 Health score: removed (STUDIO_SPEC S2).

## Findings to fix with the data errors (not step 9)
- G2 Sensitivity matrix disagrees with the ranges printed on the same page (e.g. $111 vs $112.90). Same cause as STUDIO_SPEC conflict 5; the row and column through the base cell must equal the one-at-a-time ranges.
- G4 Revenue chart bar heights are not proportional to revenue (FY26 1.33× FY25 by height, 1.65× by value); no axes or values; bars and margin line both oxblood.
- G7 Hard-coded "every hundred rupees of sales" shown for NVIDIA (a USD company); currency words must come from the company.
- G9 / STUDIO conflict 17 "ROE (LTM)" and "Op margin" labels show FY figures; a label saying LTM must show LTM, else label the basis.
- G10 Ratios table mixes decimals in a row and mixes "net cash" words with bare ratios; one decimal rule per row, signed values with U+2212 and ×.
- G14 "—" (not reported) used in forecast cells that are not forecast; use "n/a" with the reason.
- G22 SG&A appears as a head and again as its first child, and the head shows no total (see D3).
- G36 / D8b Reverse DCF ceiling (above).

## Findings for build step 9 (visual)
G1, G3, G5, G6, G8, G11–G13, G15, G17–G21, G23–G35, G37, G38 — as listed in the full review below.

---
# Full review text (for reference)

STUDIO_SPEC
Marginalia · model studio: step flow, figures, judgements, valuation, outputs · v1.0 · 3 November 2026 · sits beneath VISUAL_SYSTEM v1.0 (with the 30 October 2026 decisions) and DESIGN.md. Reuses the tokens and type steps of COMPANY_OVERVIEW_SPEC §1.2–1.3 and the table geometry of TABLES_SPEC §1–3.
Covers: the step flow (Figures, Judgements, Valuation, Outputs); the figures screen (lines under model heads, drag to reclassify, edit in place, optional reason, undo); judgements; the valuation screen (football field, reverse DCF, the bridge between versions); outputs (Excel workbook, one- and two-pagers). Does not cover the company page, the Financials tab or the screener.
0. Basis, limits, markers
Evidence. Nine screenshots plus VISUAL_SYSTEM_229f90.md, which is the same v1.0 as before. I call the screenshots S1 (Reported figures, profit and loss), S2 (Judgements, top), S3 (Judgements, lower part and actions), S4 (valuation page, top), S5 (ratios table), S6 (revenue and margin chart, DCF sensitivity matrix, financial health score), S7 (football field), S8 (what the price already assumes), S9 (terminal-value share and "what the source does not give us"). All are about 1917px wide at 1:1; every pixel value is ±2px, so confirm with computed styles before logging a bug. Not in any screenshot: the Outputs step, the bridge, refused approaches, the 52-week reference row, and the section numbered 03. Those are specified from scratch. The yellow starburst is ignored, as instructed.
Decisions applied from the top of VISUAL_SYSTEM. ⓘ stays, with a 24×24 hit area (44×44 under pointer: coarse), only on labels that need explaining, never replaced by a dotted underline. Dark is the only instrument theme. No 3D on this page. All other CHANGE items are law.
Markers. KEEP = already in VISUAL_SYSTEM. ADD = new rule. CHANGE = alters VISUAL_SYSTEM or the screenshots. PROPOSED = my value where VISUAL_SYSTEM is silent; it needs sign-off and appears in section 8.
Arithmetic I checked on the screenshots. The product is global, so figures must be right on their own. Growth +68.3% a year = (215,938 ÷ 26,914)^(1/4) − 1. +65.5% = 215,938 ÷ 130,497 − 1. Operating margin 60.4% = 130,387 ÷ 215,938. Premium 60.5% = 204.64 ÷ 127.48 − 1, and 82% = 204.64 ÷ 112.41 − 1 (82.05). The football-field bars in S7 all sit on one linear scale ($0 at x = 114, 3.636px per dollar: the peer-multiple low $134.69 at x = 604, its high $412.16 at x = 1613, the price $204.64 at x = 858). Health score 89 = (100 + 100 + 100 + 43 + 100) ÷ 5 = 88.6. Terminal split 22% / 78%: bar widths 371 and 1,309 of 1,680px. Two things do not reconcile (G2 and G4 in section 6).
Research: five pages I opened
Chosen for relevance and because I could read them. I did not verify rankings.
1. Lucanet xP&A, Using Charts. My search for Causal returned this documentation; I did not verify the product lineage from the page. Take: a waterfall is a starting bar, an ending bar and intermediate bars that break the difference down, and it compares variables, versions or scenarios; labels can be set per bar; a bridge's end can become the next bridge's start (multi-step); a variable can sit on the left or right axis.
2. Pigment, Versions and Scenarios. Take: scenarios are for quick what-if comparison; a version is for planning that must be repeatable and auditable; the two combine. That is the split I use: the draft is the scratch scenario, a saved version is the auditable snapshot, and the bridge compares two versions. A Pigment community thread (search extract only, not opened) has analysts saying that after hundreds of changes there is no clean way to see what moved between scenarios; this is why the change log and the bridge are specified below.
3. IBM Carbon, Progress indicator. Take: labels of one or two words, verb plus noun; numbered steps; states completed, current, not started, error; helper text that marks a step optional. Carbon says not to use it when the process can be done in any order, which is true of the studio, so I borrow its vocabulary and put it in a tab-style row.
4. IBM Carbon, Form usage. Take: when most fields are required, mark only the optional ones (optional), and say so first; helper text stays available while a field has focus; validate when the user leaves the field and clear the message when the value is valid; in a multi-step flow the primary action sits at the right to say "next".
5. Financial Edge Training, Football field analysis. Take: group the approaches; take ranges from real highs and lows, not ±5% around one number; a DCF range comes from flexing WACC and growth; always add the 52-week range as a reference and the share-price line; if your values sit far from both, say why. Corporate Finance Institute's valuation-methods page (search extract only, not opened) describes an average line across methods; Marginalia refuses that on purpose.
Not opened, so not used: Koyfin and Stripe pages about modelling (my searches returned nothing usable; the pages I opened in earlier turns are about tables and filters) and any Excel-like web app.
1. Step flow and layout
1.1 The four steps
Steps: 1 Figures, 2 Judgements, 3 Valuation, 4 Outputs. The order is a default, not a gate: any step opens at any time, because Judgements are optional and the valuation always reflects the current draft.
• One primary per screen, right-aligned in the bottom bar (Carbon: the right position says "next"):
    ◦ Figures: Continue to judgements →
    ◦ Judgements: Build the model →. The label does not change with the number of answers.
    ◦ Valuation: Continue to outputs →
    ◦ Outputs: Download Excel model
• A ghost Back to {previous step} sits to its left on steps 2–4.
• Build the model runs the existing build overlay (VISUAL_SYSTEM §4): nothing is shown for the first second, then it enters over 240ms, and the Two Beats timing (2.2s, DESIGN.md) holds. If the engine answers inside 1 second, no overlay appears.
• S2 and S3 show three different labels for two actions (Skip and build the model, Build the model, Skip instead) and two red primaries on one page (G5). They become one primary and no separate skip: building with no answers is skipping, and the bar says so.
• Step status words (T13, quiet), shown in the step row on desktop:
    ◦ Figures: As filed or 3 changes.
    ◦ Judgements: Optional, then 2 of 8 answered.
    ◦ Valuation: Current, or Out of date only if live recompute is off (D1).
    ◦ Outputs: Not downloaded, then Downloaded 3 Nov 2026.
1.2 Frame (1440 and 390)
• Container content 1344 at 1440 and 342 at 390 (24px gutters), as COMPANY_OVERVIEW_SPEC §1.1. Every hairline, band and bar shares those edges. S1's body column is 1,335px wide (x 286→1621) under a header that spans 114→1794, and its bottom bar's content follows the narrow edges (G21).
• Global header 64 (condensed 48). Content starts 24px below it (y = 88); phone 16px (y = 80). scroll-padding-top: 88px; scroll-padding-bottom: calc(var(--bottom-bar-inset) + 16px).
• Header contents follow VISUAL_SYSTEM: no clock, no live dot, Search as a ghost button. The extra Check the figures and All companies buttons in S2–S4 leave the header: the step row does that job (G34).
• Panel: panel ground, 1px line border, radius 0, no shadow, padding 24 (phone 16). Gap between panels 24 (phone 16).
1.3 Step row
• Below the global header, inside the container, 48 high, 1px line rule under it spanning the container width.
• Four items, desktop: {n} (T13, quiet), 8px, {Label} (T15), 8px, ·, 8px, {status} (T13, quiet). Padding 0 16. Rest: label muted; hover: ink (110ms). Current: ink, weight 600, 2px accent underline flush with the row rule (uncounted in the accent budget). Reserve the 600-weight width.
• Each item is a link (aria-current="step" on the current one). Route change uses the page transition (section 5); the row and bottom bar do not move.
• Phone: four items of 85.5px, 48 high, label only (T13, 600 current), no numbers and no status (the status moves to the page header's line). Judgements at T13 is about 68px and fits.
• Not a Carbon linear indicator: no connecting line and no disabled future steps.
1.4 Page header
From the top, 24px under the step row:
• Eyebrow, T13, 600, muted: NVDA · NVIDIA CORP · Step 1 of 4. S2's eyebrow carries an 8px oxblood square: that is a red fill on a label (G30).
• H1, Title-lg (28/34), ink, then the brand mark (a period, max(0.13em, 6px)). S1 and S2 set H1 at about 44px, outside the type steps (D13). Titles: Reported figures, What the filings cannot tell us about NVIDIA CORP, Valuation, Outputs. The H1 may wrap (phone: up to 3 lines).
• Intro, T15, muted, left-aligned, hyphens: manual, max 600px. S2 and S5–S7 justify with automatic hyphenation (as-sumption, sched-ules, col-lecting; G28).
• Right cluster on desktop (top-aligned with the eyebrow): the change counter button (No changes or 3 changes), Undo and Redo (ghost, 32 high), Save as version (ghost, 32 high). Steps 1–4 show it. Phone: the counter and Undo stay on one row under the H1 (44 high); Redo and Save as version move into a More menu (44×44).
1.5 Bottom bar
• Fixed, full viewport width, height 72 plus env(safe-area-inset-bottom), panel ground (opaque, no blur), 1px line on top. Its contents sit on the container edges. --bottom-bar-inset = 72 plus the safe-area inset. The bar never moves during page transitions.
• Desktop: status sentence at the left, T13 muted, max 640px, up to 2 lines. Right: ghost Back (40 high) and the primary (40 high), 12px apart. The primary's label may include a trailing 16px arrow icon.
• Status sentences:
    ◦ Figures: Every figure as filed, every line on its default head. After edits: 3 edited figures, 1 moved line. Everything else as filed.
    ◦ Judgements: 2 of 8 answered. Unanswered ones use the model's own assumptions.
    ◦ Valuation: Approaches are shown side by side. Marginalia does not combine them.
    ◦ Outputs: Version: Current draft. 3 edited figures, 2 judgements answered.
• Phone: height 68 plus inset; no status text (it lives in the page header); a 44×44 Back icon button and the primary, 44 high, filling the rest.
1.6 Drafts and versions
• Current draft is autosaved 1 second after the last change. T13 quiet words say Saved to your model or Not saved: sign in to keep it (D7).
• Model default is the filed figures with no edits, moves or answers. It always exists and cannot be deleted.
• Saved version: an immutable snapshot of edits, moves, answers, assumption changes, reasons, as-at dates and engine version. Save as version opens a sheet (right drawer 480, phone bottom sheet): Name (required, up to 40 characters), Note ((optional), up to 160). Carbon's rule: one required and one optional field, so only the optional one is marked, under the line All fields are required unless marked optional. The sheet's own primary is Save version.
• Saved models (the ghost button S4 calls Saved models) opens the same drawer: rows with name, saved date, value per share (perpetuity), number of changes; actions Open, Use as bridge start, Use as bridge end, Rename, Delete (confirmed in a modal; a deleted version cannot be undone). Up to 20 versions per company (PROPOSED).
1.7 Desktop 1440 versus phone 390
• Container 1344 vs 342; panel padding 24 vs 16; panel gap 24 vs 16.
• Step row: labels with numbers and status vs four labels of 85.5px.
• Figures: table 1040 plus a 280 rail vs one column with a 148 label column; Judgements: 392 + 904 two columns vs one column with the filings panel as a Disclose.
• Bottom bar: 72 with status vs 68 with no status.
• Sheets: right drawer 480 vs bottom sheet (max-height: 85dvh).
2. Figures and judgements
2.1 Figures screen layout
• Under the page header: a statement segmented control (Profit and loss | Balance sheet), 32 high (phone 44), then a 16px gap. S1 shows two separate outlined buttons with an oxblood wash on the selected one (G24; findings 9 and 12). Selected = panel ground, 1px accent border, ink, 600.
• Desktop (1440): a grid 1040px 280px, 24px gap (1040 + 24 + 280 = 1344). Left: the editable table. Right: the effect rail.
• Table geometry is TABLES_SPEC §1.2–1.4: label column 320 (sticky), data columns 144 (five fiscal years, 720), rows 40, header 64 (88 with a chip row), container scrolling inside itself, shared right edge for header and cells. FY22 with its end date 30 Jan 2022 (T13 muted) replaces S1's FY2022 (the page uses FY22, FY2022 and FY26 in different places; G25b). The corner cell reads Line · USD millions (T13 muted).
• Rail (280, sticky at top 88, panel, padding 16): label Value per share (T13 muted), hero figure (40/44) $127.48, then the effect line (T15): No changes or −$2.31 (−1.8%) against $127.48 at filed figures; then Changes (T13, 600, muted) with the last three entries (T13 read, one line each, On its own effect right-aligned) and a link-source View all changes. The rail's value uses the live-recompute rule of COMPANY_OVERVIEW_SPEC §4.5 (D1).
• Phone (390): no rail. The counter and effect sit under the H1: 3 changes · −$2.31. The table is TABLES_SPEC's phone table: label column 148 sticky, data columns 104, rows 52.
• At the foot of the table panel, a legend row (TABLES_SPEC §1.7) adding ✎ edited · moved from default head; the pencil is the 16px outline icon.
2.2 Heads, lines and totals
• A model head is the category the engine reads (Revenue, Cost of sales, Research and development, Selling, general and administrative, Depreciation and amortisation, Other operating costs, Finance cost, One-offs, and so on). A line is a filed figure sitting under a head.
• A head with exactly one line renders as one row (the line is the head). A head with two or more lines renders a head row (label 600 ink, the head total in 600, a T13 quiet note sum of the lines below after the label) followed by its lines indented 16. S1's Selling, general and administrative head repeats the name of its first child and shows no total (G22).
• A line is a component (adds into its head) or a memo (of which: shown, never summed). A memo's label is muted, indented 16 more, prefixed of which, and carries ⓘ. Whether Share-based pay (2,004 in FY22, against SG&A of 2,166) is a component or a memo decides whether the head total is 4,170 or 2,166, and S1 does not say (D3).
• Head total = sum of its components, exactly, in the row's units. An empty head (every line moved out) shows 0 with the note no lines.
• Cells follow the five value states of TABLES_SPEC §2. S1 already separates 0 (reported zero, Other operating costs) from — (not reported, One-offs): keep.
• The same right edge for every cell (G1): S1's numbers end at x = 887 while the header ends at 893, and the 0 and — cells and the Other operating costs row end at 893.
• Labels are 400 and head rows 600; values 400 and head totals 600 (finding 2). S1 sets every label and every value in bold (G26).
• A moved line carries a moved tag after its label (T13, muted, 1px line border, 24 high, padding 0 8); its popover says Moved from {default head} and offers Back to default head.
2.3 Editing a number in place
• Start: click or tap a number, press Enter or F2 on a focused cell, or type a digit, . or − on a focused cell (which replaces the content).
• The cell becomes an input in place: width 128 (column 144 minus 16), height 32 (44 on coarse pointers), 1px line-control border, panel ground, T15, right-aligned, tabular, content selected. No other cell moves.
• Accepted input: digits, , grouping, . as decimal, a leading − or hyphen (normalised to U+2212 on commit), parentheses as negative (pasted statements). Up to 4 decimals are stored; the row prints its own precision.
• Validation (Carbon: when the user leaves the field; cleared as soon as the value is valid): Enter a number. for non-numeric; a sign rule per line (Revenue cannot be negative.). The message sits under the input in accent-text, T13. The input keeps its line-control border, because an accent border means selected. An invalid value is never saved: on blur the cell returns to its previous value and a polite announcement says Revenue, FY26: "abc" is not a number. Kept 215,938.
• Facts while typing (instant, no tween): under the input, T13 quiet: Filed 215,938 · change +14,062 (+6.5%). A large change is a fact, not an error: no blocking and no warning colour.
• Commit: Enter (focus moves to the cell below), Tab (right), Shift+Enter and Shift+Tab (up, left), or blur when valid. Cancel: Esc. A value equal to the previous one logs nothing.
• Derived cells (gross profit, head totals, ratios, the rail's value) recompute on the same frame. No tween.
2.4 The optional reason
• While editing, a panel attaches under the cell (above it if there is no room): overlay surface, 1px line, padding 12, width 320, T13. Contents in order:
    ◦ Label Reason (optional). Carbon's rule: one required field (the value) and one optional field, so only the optional one is marked, and an instruction precedes the form: All fields are required unless marked optional.
    ◦ Text input, 32 high, placeholder Why you changed it, max 160 characters, counter 0/160 (T13 quiet) from 120 characters.
    ◦ Helper (T13 quiet): Shown in the change log, the bridge and the workbook.
    ◦ Footer: Filed 26,914 · Open the filing ↗ (link-source, opens the evidence sheet of TABLES_SPEC §4), and text buttons Reset to filed (disabled when equal) and Cancel.
• Focus order: value input, reason input, Reset to filed, Cancel. Enter in either field commits both; Esc cancels both; a reason without a changed value is not saved.
• After commit the panel closes. A reason can be added or edited later from the cell's pencil marker (2.5) or the changes drawer (2.7).
• Phone: tapping a number opens a bottom sheet: title Edit {line} · {period}, value input (44, inputmode="decimal"), reason input (44), the Filed line, Save (the sheet's primary), Cancel (ghost), Reset to filed (text button).
2.5 Marker, counter, changed figure
• Edited marker: a 16px outline pencil icon in muted, in the left padding of the cell (8px from the edge), 24×24 hit area (44×44 coarse). It opens a popover with the reason field and Reset to filed. Accessible name: {value}, edited, filed value {filed}. S1 has no way to see which numbers were changed.
• Changed figure: the most recent edit's number and the rail's value per share turn accent-text over 110ms and stay so until the next edit elsewhere or until the user leaves the step. At most two accent-text words come from this feature, so the five-word budget is not spent by a long editing session. Earlier edits revert to ink and keep the pencil.
• Counter (replaces S1's No changes): No changes (T13 quiet, not a button) or 3 changes (a button opening the changes drawer). It counts distinct items: each edited cell, each moved line, each answered judgement, each assumption edit. Resetting an item removes it.
2.6 Drag a line to reclassify
Which moves are allowed. A line moves within its statement and between heads of the same class (income, operating cost, below the line; for the balance sheet, current assets, non-current assets, and so on). The model defines the classes. S1's subtitle says only "drag a line to move it".
Handle. A 16px outline grip icon (three stacked lines) at the left of the label cell, 24×24 hit area, quiet at rest and ink on hover and focus. The label cell is [handle 24][label] with 8px left padding. Head rows are drop zones, not draggable.
Pointer drag (desktop).
1. Pointer down on the handle. After 4px of movement the drag starts.
2. A copy of the row (label and values) follows the pointer through transform, with overlay ground and a 1px line-control border. No transition. The original row stays in place with a 1px dashed line-control outline and opacity: 0.4 (instant).
3. Over an eligible head, the head and its lines get a 1px accent border, and a 1px accent insertion line shows the drop position. Ineligible heads show nothing and the cursor is not-allowed.
4. Drop: the line moves instantly. No reorder animation. Focus goes to the moved row's handle. Head totals update at once; a change is logged; the rail shows the new value.
5. Cancel: Esc, release outside the table, or pointercancel. Nothing is logged.
6. Auto-scroll when the pointer is within 48px of the container's top or bottom edge: 12px per frame, instant, no easing.
Touch (phone). No visible handle (the 148px label column has no room). Long-press the label for 400ms to pick the line up (touch-action: none applies only after pick-up); drop targets and insertion line as above. Tapping the label opens a Line options sheet instead: Move to…, Back to default head (if moved), Show filed values.
Alternatives to dragging (required, WCAG 2.5.7).
• Move to… menu: a 16px outline overflow icon in the label cell (visible on hover and focus on desktop; always visible on touch above 640px), 24×24 (44×44 coarse). It opens a list of eligible heads (a radio list) and Move. On phone it is a bottom sheet.
• Keyboard: on a focused label cell, Space picks up (polite announcement: Picked up Share-based pay. Up and Down choose a head, Space drops, Esc cancels.), Up and Down cycle eligible drop positions, Space drops, Esc cancels. M opens the Move to… menu.
After a move: Moved Share-based pay: Selling, general and administrative → Other operating costs, with its solo effect on value per share (the change with every other edit held at default), in the rail and the changes drawer.
2.7 Undo, redo and the changes drawer
• History: up to 100 steps per draft: edit, reason change, reset, move, answer, clear, assumption edit, Reset all. Ctrl or ⌘+Z undoes; Shift+Ctrl or ⌘+Z (and Ctrl+Y) redoes. While a text field has focus, the browser's own undo applies inside that field.
• Buttons: Undo and Redo ghost buttons, 32 high (phone 44), with the shortcut in the tooltip. They are aria-disabled when their stack is empty.
• After an undo or redo the content swaps instantly. For 8 seconds the counter position shows Undid: Revenue FY26 → 215,938 (T13 quiet, polite live region) and then the counter returns. No animation.
• Reset all is a single undoable step and needs no confirmation, because Undo restores everything.
• Changes drawer (right drawer 480; phone bottom sheet). Title Changes · 3. Newest first; each entry has a 1px line rule below and padding 16 0:
    ◦ Line 1, T15 ink: the change. Revenue, FY26: 215,938 → 230,000; Share-based pay: Selling, general and administrative → Other operating costs; Competitive position: a strength; Terminal growth: 2.5% → 3.0%.
    ◦ Line 2: the reason in T15 read, or a text button Add a reason. Editing happens in place with the same input and limits as 2.4.
    ◦ Line 3, T13 read: On its own: +$1.42 (+1.1%). At the right of the entry: Reset this change (text button), independent of order.
    ◦ Empty: No changes. Everything is as filed.
2.8 ⓘ on this screen (decision 1)
S1 puts ⓘ on 11 of 11 row labels (G23). Rule: ⓘ appears only when (a) a head groups two or more filed lines, (b) a line is a memo, (c) the model's treatment differs from the filing's wording (One-offs, how they are identified), or (d) the label is not the filing's own wording. For the NVDA profit and loss that is Selling, general and administrative, Share-based pay, Other operating costs and One-offs: 4 of 9 rows. The glyph sits 4px after the label text (not at the column edge), 16px, muted, with a 24×24 hit area (44×44 coarse). Content: the model's treatment in at most 140 characters, then Evidence ↗. One ⓘ also stays at the end of the page intro.
2.9 Judgements screen layout
• Desktop: a grid 392px 904px with a 48px gap (392 + 48 + 904 = 1344).
• Left, "What the filings do say" (panel, sticky at top 88, padding 24): title T13, 600, muted; the sentence NVIDIA CORP — model built automatically from SEC EDGAR filings. (T15); then five fact rows with a 1px line rule between, padding 12 0: label T13 muted at the left, figure T15 ink right-aligned and tabular (+68.3% a year), a T13 quiet explanation line beneath. Facts in S2/S3: sales growth FY22 to FY26 compound; sales growth, most recent year; operating margin; net debt to EBITDA.
    ◦ Currency: the explanation what it keeps from every hundred rupees of sales is hard-coded for a USD company (G7). Copy takes the company's currency word (every hundred dollars of sales).
    ◦ Ratios: 0.02x net cash becomes −0.02×, with the explanation Negative means net cash: more cash than borrowings. The × glyph is U+00D7, never x (finding 17).
    ◦ At the bottom, a Disclose row (chevron on the left, body indented 24): Want to know more about this company? with the body link Read the latest coverage ↗. S3 puts the chevron on the right (G29).
• Right: groups. Each group is a heading (Title-md The business), a T15 muted line, then a panel of question rows.
• Phone: the filings panel becomes a closed Disclose row What the filings do say above the groups.
2.10 Judgement rows
• Row: padding 16 24, min-height 80 (S2 rows are 118), 1px line between. Grid 1fr 312px, 24px gap, so the text column is 904 − 48 − 24 − 312 = 520px.
    ◦ Title: T15, 600, ink. Question: T15, muted, max 520px. Third line: the effect line (below).
    ◦ Control: one segmented control, role="radiogroup" labelled by the title, three equal segments of 104 (S2 has three separate outlined buttons of 103, 83 and 112 with 10px between; G27): A strength, Neither, A weakness. Height 32 (phone 44; segments 102 each at 306px).
    ◦ Selected: panel ground, 1px accent border, ink, 600. Unanswered: no segment selected.
    ◦ Neither is an answer (you looked and see no edge). Blank is not (leave it alone). The intro says so: Every question is optional. Leave one blank if you have no view. Neither means you looked and see no edge either way.
    ◦ A Clear text button (T13, 24 high) appears under the control, right-aligned, only when answered.
• Keyboard: arrows move focus between segments (roving tabindex); Space or Enter selects. Arrowing never changes the answer, so no recompute fires while moving.
• ⓘ only on titles that are jargon (Cost pass-through, Claims and contingencies): one sentence on what evidence to weigh, 140 characters at most.
• The effect line (T13, third line of the row):
    ◦ Unanswered: Would change: terminal growth (quiet). The reader sees which assumption an answer moves before answering. Each answer moves one assumption by a fixed step defined in the model (D4).
    ◦ Answered: Terminal growth 2.5% → 3.0% · on its own +$4.12 (+3.2%) (read). Neither: No change to the model. While the engine is working past 200ms: Calculating… (quiet). No spinner.
• Summary panel, "What this will change in the model" (kept from S3), padding 24, below the groups: a list of answered items with before and after, then Together: +$6.40 (+5.0%) against $127.48. This is not the sum of the lines above. Empty: Nothing yet. The model will use its own assumptions, exactly as if you had skipped.
• Why the model needs your judgement at all: a Disclose row, closed by default, chevron on the left, body indented 24 (S2 does this right: keep). Its text stays within 600px and is left-aligned.
• Answers join the history (2.7) and the changes drawer. No row has its own skip control: leaving a row blank is skipping it.
• Phone: each row stacks title, question, effect line, then the full-width control (44 high). The summary panel moves into the bottom sheet opened from the header counter.
3. Valuation
3.1 Page order and in-page navigation
Sections, each a panel with a Title-md title and a muted section number at the right (S5–S8 already do this: KEEP):
• 01 Ratios · 02 Valuation range (football field) · 03 Bridge between versions · 04 What the price already assumes (reverse DCF) · 05 Terminal value · 06 Source gaps.
• S5 to S8 number their sections 01, 02 and 04. Section 03 is in no screenshot; I assume it is where the bridge belongs (D8).
• An in-page row below the headline block, 48 high, tab-row style: Ratios, Valuation range, Bridge, What the price assumes, Terminal value, Source gaps. The links scroll instantly with scroll-padding-top: 88px. The row spans the container content width (S4's row runs x 54→1854 against content 114→1794, and holds a red-outlined Model a list button; G33).
3.2 Headline block
• A panel of three cells, equal thirds on desktop with 1px line rules between (phone: stacked). Each cell: label T13 muted, hero figure (40/44), one line T13 read.
    ◦ Intrinsic value · perpetuity growth, $127.48, Price is 60.5% above this value.
    ◦ Value · exit multiple, $112.41, Price is 82.0% above this value.
    ◦ Price · close 30 Oct 2026, $204.64, −4.22% on the day.
• No pills. S4 shows three red-washed pills (60.5% premium, 82% premium, -4.22%): three washes where one is allowed, red beside the headline value reads as a verdict, and the precision differs (60.5% against 82%; G6). The line above is plain text, 1 decimal everywhere, with the word above or below and the base stated.
• Never combined. There is no blended, average or "fair" value anywhere on the page (test in section 7).
• Two Disclose rows (chevron on the left, body indented 24): Why there are two values, and what the gap means, with the right-hand text The two methods differ by 13.4%, measured against the lower value (S4 says 13% apart and does not name the base), and Where the working is.
• The meta line prints no label without a value: ISIN — when not reported (S4 prints a bare isin; G31). The ticker is not oxblood and not a filled chip (G32).
• S4's action row (Download Excel model, Spread against 2 peers, Your template, Saved models) leaves this page: downloads move to Outputs, Saved models to the page header (1.6). Four outlined buttons in a row break finding 12.
3.3 Football field (section 02)
Intro (T15 muted, left-aligned, max 600px): Each bar is the range one approach gives when its main assumption is moved. Approaches sit side by side and are never combined. The vertical line is the traded price. A Disclose row How to read this (closed) holds S7's explanation, kept in its honesty: no confidence interval, no forecast of the share price, the grey reference row is not a valuation, and a bar's width is the range its own method gives when its main assumption moves.
Rows and groups (the order never changes; group headings T13, 600, muted, 32 high):
• Income approach: DCF, perpetuity growth; DCF, EV/EBITDA exit.
• Market approach: Peer multiples.
• Asset approach: What it owns.
• Reference: 52-week range.
• Approaches that cannot be drawn keep their row (3.4).
Row anatomy, desktop (inner width 1296), 88 high. Line 1 (22): title T15, 600, ink at the left; range text T15 tabular ink at the right, always two decimals with an en dash: $112.90 – $147.64 (S7 prints $112.9 – $147.64; G19). 8px. Track (32): a 1px line hairline through the middle and the bar centred, 24 high. 8px. Caption (T13 muted, one line, up to two): Terminal growth 1.5% to 3.5% · base case $127.48 · price is above this range. The last clause is always price is above / inside / below this range, computed against the low and high.
Bars. Each approach has its own shape, so the chart also reads in greyscale and under colour-vision deficiency.
• Income: 1.5px solid accent-text outline, no fill; the base case is a 2px × 32px tick in accent-text. This is the one categorical use of oxblood (this model's own value). S7 uses oxblood washed fills; two bars would spend two of the three washes in a viewport (G20, D10).
• Market: 1.5px solid read outline with a 45° hatch fill (1px lines, 8px pitch, at 12% read); base tick 2px read.
• Asset: 1.5px dashed read outline (6/4), no fill; a tick only if a base case exists.
• Reference (52-week range): no outline; an 8px-high solid bar in line-control. It is not a valuation and is drawn thinner so it cannot be mistaken for one.
• A bar narrower than 4px is drawn 4px wide. Its hit area is the whole row.
Axis and scale.
• Domain $0 to M, where M is the largest high or the price, times 1.05, rounded up to a multiple of 50. For the NVDA fixture: max(412.16, 204.64) × 1.05 = 432.77, so M = 450. Zero is always the start: per-share values and the asset approach ($1.17–$6.42) need a true zero.
• Tick step: the smallest of 1, 2 or 5 × 10^k with M ÷ step ≤ 5 (phone: ≤ 3). Desktop NVDA: step 100, labels $0 $100 $200 $300 $400. Phone: step 200, labels $0 $200 $400.
• Pixels per dollar: desktop 1296 ÷ 450 = 2.88; phone 310 ÷ 450 = 0.689. Desktop NVDA: the perpetuity bar is 34.74 × 2.88 = 100px wide; the exit-multiple bar 14.04 × 2.88 = 40px; peer multiples 277.47 × 2.88 = 799px; the price line sits at 204.64 × 2.88 = 589px. Phone: 24px, 10px and 191px; the asset bar is 4px.
• Axis row (40 high) below the last row: 1px line baseline, 4px line-control tick marks, T13 quiet labels centred on ticks, and Value per share, USD at the right end. No vertical gridlines (VISUAL_SYSTEM §3.2: horizontal only, at most 5). S7 has no axis at all, so values can only be read from text (G17).
Price line. 1px ink from the top of the first row to the baseline. It is drawn behind the captions and range text (they sit on panel backgrounds), so it never crosses text; in S7 it runs through market price sits above this range (G18). A label above the chart, centred on the line and clamped inside the plot: Price $204.64 · close 30 Oct 2026, T13, 600, ink.
52-week row. Title 52-week range, range text $164.27 – $243.37, caption Highest and lowest close in the 52 weeks to 30 Oct 2026. Not a valuation.
Never combined. No midpoint, no average, no overall range, no weighted value, no "fair value" marker or label, no total row. The bottom of the section says Approaches are shown side by side. Marginalia does not combine them. (T13 quiet).
Readout (a fixed row under the axis, 24 high, T15). At rest: Price is above 3 ranges and inside 1. (a count of what the line does, in words). Hovering or focusing a row: Peer multiples: $134.69 – $412.16 · base $313.52 · price is inside this range. S6's matrix says Hover a cell to inspect; hover-only information fails for touch and keyboard (G3), so every row opens a sheet.
Interaction.
• Rows are a list (role="list"), one tab stop with arrow keys moving focus (roving tabindex). Enter, click or tap opens the method sheet (right drawer 480; phone bottom sheet): method name; Low, Base, High with the assumption values that produce them (Terminal growth 1.5% → $112.90; 3.5% → $147.64); how the range was defined (Lowest and highest of 3 peers, on reported figures, a real high and low rather than ±5% around one value, per Financial Edge); the peers or inputs, each tappable into the evidence sheet; the as-at date; Open the working ↗; and This is a range from its own method, not a forecast.
• Row hover (pointer fine): panel to overlay, 110ms. No other effect.
Phone (inner width 310). The range text sits under the title (not right-aligned); caption wraps to three lines; the row is about 146 high (22 + 22 + 8 + 32 + 8 + 54). Ticks as above.
States. The container keeps its height in every state. Loading (after 200ms): static line rows. Error: The valuation range did not load. and a ghost Try again. A footnote (T13 quiet): Price: close 30 Oct 2026. Figures: FY26, ended 25 Jan 2026, and TTM to 26 Jul 2026. Version: Current draft. There is no draw-in: VISUAL_SYSTEM allows the chart draw-in for the price chart only.
3.4 Refused approaches
• A refused approach keeps its group, order and title. The track holds no bar. The range slot shows a tag Not shown (T13, 600, ink, 1px line-control, padding 4 8). The caption is replaced by the reason (T15 read, up to two lines) and a text link What would unlock it.
• Reasons are facts with numbers:
    ◦ Peer multiples are not shown: 2 comparable companies have reported figures and the method needs 3.
    ◦ A P/E range is not shown: earnings were negative in FY26.
    ◦ The perpetuity DCF is not shown: free cash flow was negative in 3 of the last 5 years.
    ◦ EV/EBITDA does not apply to banks, so no exit-multiple value is shown.
    ◦ The asset approach is not shown: the balance sheet does not split assets into the lines the method needs.
• A refused row is never replaced by a default bar or a placeholder range. The readout and the status count both: 4 shown, 1 not shown.
• Not shown is ink, not oxblood, so three refusals do not exhaust the accent-text budget.
3.5 Reverse DCF (section 04, "What the price already assumes")
Intro (T15 muted, max 600px): Everything above asks what this company is worth. This asks the other way round: what would have to be true for today's price of $204.64 to be right. It shows only the assumptions the market is already making. Second paragraph, above the table (S8 puts it below the fold): Each line moves one assumption and leaves every other one where the model had it, so the four are not additive and are not a path from model to price.
Table (desktop). Columns minmax(0, 1fr) 160px 160px 160px, 24px gaps (744 + 480 + 72 = 1296): Assumption, This model, Price implies, Difference. Header T13, 600, muted, numeric headers right-aligned, 40 high. Rows: min-height 72 (about 94 with a two-line description; S8's are 115), padding 16 0, 1px line between. Title T15 ink; description T13 muted, max 560px, up to two lines.
• This model: T15 400 ink. Price implies: T15 600 ink. Difference: T15 400 ink, signed with U+2212 and a unit: +2.5 pp, +13.1×, −2.3 pp.
• Precision: percentages 1 decimal; cost of capital 2 decimals (matches the 8.72% printed elsewhere; S8 shows 8.7%); multiples 1 decimal with U+00D7 (S8 prints 12.0x).
• Header and cell right edges are shared (TABLES_SPEC §1.2).
• Rows and their descriptions: Annual revenue growth (Solved against the perpetuity value.); Growth for ever, after year five (The exit-multiple method has no terminal growth to solve for. Solved against the perpetuity method.); EV/EBITDA on exit (What the business would have to sell for in year five. Solved against the exit-multiple method.); Cost of capital (The discount rate at which the model agrees with the price. Solved against the perpetuity value.).
Solver states (the Price implies cell).
• Solved: the figure.
• Out of range: Out of range (T15 quiet) with tried −20% to 60% a year under it (T13 quiet), so the reader sees what was searched. Difference: n/a.
• Limit reached: 5.0% or more with search limit under it. S8 prints exactly 5.0% for terminal growth; if that is the search ceiling it must not read as a solved value (D8b).
• Not defined: n/a and the reason.
• Search ranges (PROPOSED): revenue growth −20% to 60% a year; terminal growth 0% to 5.0%; exit multiple 1× to 60×; cost of capital 3% to 20%.
Optional action (PROPOSED): a text button Try this value in the description line saves a new version from Model default with that one assumption set to the implied value and the reason Price-implied value. It does not touch the current draft.
Accuracy. With each implied value applied alone, the engine's value per share equals the traded price to within $0.005.
Phone. Rows stack: title, description, then a three-column grid (103px each) of This model, Price implies, Difference (labels T13 muted, values T15).
3.6 The bridge between versions (section 03)
A waterfall that explains how value per share moved from one version to another. The parts add up exactly.
Controls (desktop, 32 high): From select, a swap button (32×32, icon), To select, and at the right a segmented control From zero | Zoom to changes. Phone: the selects stack (44 high) with the swap button between them. Selects list versions with their value per share at the right (T13 quiet). Defaults: From = Model default, To = Current draft.
Method line (T13 quiet, under the controls): Each step applies one change on top of the steps before it, in the order shown. The steps add up to the total exactly. Their sizes depend on the order; the total does not. Lucanet's waterfall is a start bar, an end bar and intermediate bars; so is this one. Pigment's distinction applies: the bridge compares two saved or default versions, and the current draft only when the reader picks it.
What a step is. One change item, as in the changes drawer (2.7). Figure edits are grouped by line (Revenue, 3 years edited is one step whose cells are applied together). Order, fixed: (1) figure edits in statement order, (2) moved lines, (3) judgement answers in screen order, (4) assumption edits in model order.
Number of steps. At most 8 are drawn. If more exist, the smallest by absolute effect collapse into one step N smaller changes (the sum of its members' displayed effects) placed last before the end bar; pressing it opens a list. Steps whose effect displays as 0.00 are listed in a Disclose row under the chart (3 changes with no effect at this precision) and still count in the change log.
Exactness rule.
1. The engine returns full-precision values at each cumulative state: V0 (From), V1 … Vn (To, with every change applied).
2. Display S = V0 rounded to cents and E = Vn rounded to cents.
3. Raw step d_i = V_i − V_(i−1), rounded to cents.
4. Let R = (E − S) − Σ(rounded d_i), in cents. Distribute |R| cents, one cent at a time and with the sign of R, to the steps whose rounding left the largest remainder (largest-remainder method; ties go to the earlier step).
5. Every running total shown is S plus the cumulative displayed steps, so each is an exact cent value, and the last one equals E.
6. There is no Other or Unexplained bar and no zero-size residual. If the engine cannot attribute a pair, the section says These two versions cannot be bridged: {reason}. and shows no chart.
Geometry, desktop. Chart container 360 high: top inset 36 (value labels above bars), plot 252, axis zone 72 (three label lines). Left gutter 56 for tick labels; plot width 1296 − 56 = 1240. With at most 11 columns (start, 8 steps, N smaller changes, end) each column is 112.7px; a bar is 56 wide (24 minimum).
Axis. From zero (default): domain 0 to M, with the step the smallest of 1, 2 or 5 × 10^k that gives at most 5 intervals and M = 1.08 × the highest cumulative value rounded up to a multiple of the step. NVDA fixture, highest cumulative $127.48: step 50, M = 150, ticks $0 $50 $100 $150. Horizontal gridlines only, 1px line, at ticks (at most 5). A 1px line-control baseline carries $0. Zero baseline is mandatory in this mode (VISUAL_SYSTEM §3.2: a sign legend and a zero baseline).
Zoom to changes: domain from the lowest cumulative value minus 8% of the span to the highest plus 8%, snapped to the nice step. The start and end bars are drawn broken (two 8px diagonal strokes at their base) and a T13 muted note at the axis says Axis starts at $120, not zero. Connectors and steps are unchanged.
Bars.
• Start and end: 1px line-control outline, line fill, from the baseline to the value.
• A step that raises the value: 1.5px positive outline, no fill. A step that lowers it: 1.5px accent-text outline, no fill. Outline colour is an extra cue only: every step prints its sign (+$3.10, −$2.31, U+2212) in T13, 600, ink, 4px above the bar. Start and end print From: Model default and To: Current draft (T13, 600) with their values (T15, 600).
• Connectors: 1px line-control horizontal rules from each running level to the next bar.
• Category labels under the axis: T13 read, centred, at most 3 lines per column (about 17 characters a line); the full change text opens in the sheet.
• Legend (one line, T13 quiet, under the chart): Green outline raises the value. Red outline lowers it. The sign is printed on every step.
• Minimum bar height 2px; every bar has a hit area of at least 24×24 (44×44 coarse).
Readout (fixed, 24 high, T15). Step 3 of 9 · Moved Share-based pay: SG&A → Other operating costs · +$0.41 · value after this step $128.27, and the reason, if any, on a second line (T13 quiet). At rest it shows From $127.48 to $131.54: +$4.06 in 9 steps (example values). Pointer, touch and keyboard all update it.
Interaction. A bar opens a sheet: the change (before and after), its reason, its effect in this bridge and its effect on its own, and Open in figures ↗ (selects the cell or line). Keyboard: the chart is a group; Left and Right move between bars, Home and End jump to the ends, Enter opens the sheet. View as a table (Disclose) is always present: Step, Change, Reason, Effect, Running total.
Chaining (PROPOSED). Add next version (ghost) extends the bridge: the previous end bar becomes a subtotal and a third version is added (Lucanet's multi-step waterfall). At most 3 versions.
Phone: a horizontal waterfall. Eleven 28px columns are not legible at 310px, so steps become rows 64 high: the label (T13, up to 2 lines), a 20px track, the signed value at the right (T13, 600, 72 wide). Track width 310 − 72 − 8 = 230. Zero baseline at the left of the track (broken-bar marks in zoom mode). Start and end rows first and last.
States. Same versions: These two versions are identical. Choose a different version. Draft equals default: Current draft has no changes against Model default. Loading (after 200ms): static line rows. Error: The bridge did not load. and Try again.
3.7 Other sections on this page that need fixing (outside this spec's scope, but visible in S5–S9)
• DCF sensitivity matrix (S6, G2 and G3). A 5×5 grid with the WACC values (7.72%, 8.22%, 8.72%, 9.22%, 9.72%) printed at the row heads and the terminal growth values (1.5%, 2.0%, 2.5%, 3.0%, 3.5%) at the column heads. Cells print dollars with cents. The base cell keeps its 1px ink outline. The row and column through the base cell must equal the one-at-a-time ranges printed in section 05 (S9). A fixed readout shows the pair for the focused or tapped cell (no hover-only text). Keyboard: a grid with arrow keys.
• Revenue and margin chart (S6, G4). Bars from a zero baseline on a linear scale, labelled left axis; margin as a line on a labelled right axis in the S2 colour; direct labels; a data table. Oxblood does not carry historical data.
• Ratios (S5). Equal column widths; one decimal rule per row; forecast as a chip under the year, not oxblood text; forecast cells for ratios the model does not forecast read n/a, not —, with the reason in the sheet; a single ? or ⓘ glyph (S5 uses ?, the rest of the product uses ⓘ; G13).
• Source gaps (S9). Kept: it states the largest effect each missing figure could have. The pills up to 1.3% of the value become muted text with a hairline, not red.
4. Outputs
No screenshot shows this step; it is specified from scratch. The outputs are an Excel workbook, a one-pager and a two-pager (PDF). Each is a file the reader keeps, so it carries the version, the as-at dates and every change with its reason.
4.1 Layout
Desktop (1440).
• Under the page header, a row (32 high): Version label (T13 muted), a select 320 wide (Current draft, saved versions, Model default), then T13 quiet: 3 edited figures, 1 moved line, 2 judgements answered, and a link-source Saved models.
• Below it a grid 480px 840px with a 24px gap (480 + 24 + 840 = 1344).
• Left, 480:
    ◦ Output radio group of three cards, each a panel (1px line, padding 16, min-height 104, 8px apart): title T15, 600, ink; description T13 muted, up to two lines; meta line T13 quiet.
        ▪ Excel workbook: A live model you can recalculate. Every filed figure links to its filing. Meta: .xlsx · 8 sheets · live formulas.
        ▪ One-pager: The football field, the three values, what you changed and why. Meta: PDF · 1 page · A4.
        ▪ Two-pager: The one-pager plus five-year figures, ratios, what the price assumes and the bridge. Meta: PDF · 2 pages · A4.
    ◦ Selected card: panel ground, 1px accent border, title 600. Arrow keys move between cards, Space selects (roving tabindex). Default: Excel workbook.
    ◦ Options (a panel under the cards, padding 16, instruction first: Defaults are already set.): for Excel, checkboxes Include change log and reasons (on), Include sources sheet (on), Spread against peers (off; when on, a peer picker for up to 3 companies), and a Template select (Marginalia template, then the user's saved templates). For the PDFs: a Paper segmented control A4 | Letter (A4 when the company's currency or the user's locale is en-IN), Include reasons (on) and, for the two-pager, Include the bridge (on only if the two versions differ). Checkboxes are 24×24 boxes (44×44 coarse) with T15 labels and T13 quiet helper lines.
    ◦ There is no download button on a card. One primary exists on the screen, in the bottom bar, and its label follows the selection: Download Excel model, Download one-pager, Download two-pager.
• Right, 840: preview (panel, padding 24, min-height 640).
    ◦ Header: Preview (T13, 600, muted) and the output name; T13 quiet: Generated 3 Nov 2026, 14:02 UTC, or Out of date: you changed something after this preview was made; a ghost Refresh preview (32 high) shown only when it is out of date or not yet generated. The preview never refreshes by itself.
    ◦ Excel: a sheet tab row (40 high, scrolls inside itself) listing Summary, Figures, Judgements, Model, Valuation, Bridge, Changes, Sources; below it a read-only grid of the selected sheet's first 14 rows and 7 columns, drawn with the TABLES_SPEC conventions (label column 240, data columns 96, rows 32, right-aligned tabular figures, the five value states). A line says The preview shows the first 14 rows. The workbook holds everything.
    ◦ One-pager: one A4 page image at 560×792 (A4 at 0.94 scale), centred.
    ◦ Two-pager: two page images, 380×537 each with 16px between (776 wide, inside the 792px content width).
    ◦ Page images are server-rendered at 2× with alt text that states what the page holds. A link Open the preview in a new tab ↗ sits under them.
Phone (390).
• Version select (44 high), then the three output cards stacked, 8px apart, each 104 high.
• Options is a closed Disclose row under the cards (chevron on the left, body indented 24).
• A ghost Preview button (44 high) opens a bottom sheet with the pages scrolling vertically (the Excel preview scrolls horizontally inside its own container).
• Bottom bar: Back to valuation icon button (44×44) and the primary (44 high).
4.2 What each output holds
Excel workbook. Eight sheets, names up to 31 characters:
• Summary: company, version, as-at dates, value per share by approach (the two DCFs shown separately; no blended value), the price, the 52-week range, the number of changes.
• Figures: for each line and period the filed value, the model value, an edited flag, the head it sits under and whether it was moved. Every filed figure is a hyperlink to its filing by accession number, or Not recorded where the feed lacks it (TABLES_SPEC D9).
• Judgements: question, answer, the assumption moved, before and after, effect on its own.
• Model: live formulas for the forecast, WACC and both DCFs; assumptions in named cells styled as inputs; no pasted values for any output.
• Valuation: the football-field data (low, base, high per approach; refused approaches with their reasons), the price, the 52-week range, the reverse DCF table.
• Bridge: From and To, each step with its change, reason and effect, and the exact running totals of 3.6.
• Changes: the change log with reasons.
• Sources: sources, as-at dates and terms (COMPANY_OVERVIEW_SPEC §1.10).
• Peers is added when Spread against peers is on: the peers spread onto the same lines and ratios.
• Conventions: a units row on every sheet; negatives use a custom number format with U+2212; not reported is an empty cell and not applicable is the text n/a (TABLES_SPEC §2); no macros and no add-ins.
• Acceptance: opening the workbook and recalculating gives the same value per share as the screen, to $0.01, for every approach and every version.
One-pager (A4 portrait, 595×842pt, 36pt margins; Letter 612×792pt, same margins):
• Header: company, ticker, version name, as-at dates.
• The football field at the full 523pt width and 220pt high, same encodings as 3.3 (outline, hatch, dashes, thin reference bar; refused approaches with their reasons).
• The three headline figures, plain text, the 52-week range and the price line.
• The assumptions that differ from Model default: the six largest by absolute effect, each with its reason.
• The three largest source gaps with their maximum effect on value.
• Footer: sources, date, and Marginalia shows facts and the working behind the model. It does not recommend buying or selling.
Two-pager: page 1 as above; page 2 adds the five-year figures summary, the ratios, the reverse DCF table, the terminal-value share, and (if the versions differ) the bridge with at most 8 steps. Exactly two pages; if content does not fit, the smallest items are cut by the same rules as the screen (never shrunk below the print floor).
Print rules (PROPOSED): text at least 8pt; tabular figures; fonts embedded; a tagged PDF with alt text for each chart; no gradient except the price fill; the same state glyphs as the screen.
4.3 Download behaviour
• Press the primary. If preparing takes longer than 200ms the label becomes Preparing… (disabled, aria-busy), with no spinner. The browser's download starts when the file is ready.
• The bar's status sentence then reads Downloaded NVDA_current-draft_2026-11-03.xlsx · 214 KB. The step row's status becomes Downloaded 3 Nov 2026.
• Filename: {TICKER}_{version-slug}_{YYYY-MM-DD}.{ext}; the slug is lowercase, hyphenated, at most 32 characters.
• Error: The file could not be prepared. and the label returns to the primary, so one press retries. No automatic retry loop.
• Unchecking Include change log and reasons removes the Changes sheet and the reason columns. It never removes the edited flags or the filed-value columns: an edited number is always marked as edited.
• The files are the user's. Nothing in them calls Marginalia's servers for a calculation.
5. Motion and reduced motion
Only transform, opacity and (price chart only) clip-path animate, plus color, border-color, background-color and outline-color on hover and press, and height on Disclose. transition: all is banned. Every duration and easing is a --m-* token. Numbers never animate.
5.1 What moves
• Step change: the main region only, opacity and translateY(8px) to 0; 280ms in, 120ms out. The step row and the bottom bar never move. Changes inside a step (statement switch, version select, output card selection, judgement answer, bridge zoom toggle) are instant swaps.
• Build overlay: opacity and translateY(8px) to 0, 240ms; nothing for the first second; the 2.2s Two Beats timing holds (VISUAL_SYSTEM §4).
• Sheets and drawers (changes, versions, method, evidence, filters, line options, reason on phone): translateX(100%) to 0 (phone translateY(100%) to 0), 280ms in on --m-ease-enter, 200ms out on --m-ease-exit; the scrim fades over 240ms in and 168ms out. Focus is trapped; Esc closes.
• Popovers (ⓘ, reason panel, move menu, pencil marker): opacity only, 110ms in, 77ms out.
• Hover (rows, cells, chips, links, football-field rows): 110ms, colour properties. Press: background-color, 70ms. Focus ring: 0ms.
• Changed figure: color to accent-text, 110ms. The number itself swaps instantly.
• Disclose rows outside tables (How to read this, Why the model needs your judgement, Want to know more, Options): height and opacity 200ms in and 140ms out; the chevron turns 0 to 90 degrees.
• Drag is direct manipulation: the dragged copy follows the pointer through transform with no easing. The drop is instant; nothing reorders with animation. Auto-scroll while dragging is instant.
5.2 What never moves
• Any value: value per share, effect lines, counters, deltas, running totals, solver results, recompute results. No tween, no rolling digits, no flash on update.
• The football field, the bridge and the matrix: no draw-in, no growing bars, no connector animation, no crossfade when the version changes. They are complete when they appear. (The price chart's draw-in and range crossfade are specific to the price chart.)
• Rows: no entering, leaving, sorting or reordering animation in any table or list, including after a move, an undo or a redo.
• Undo and redo: instant. The status text swaps without a transition.
• No skeleton shimmer, no spinner, no looping animation, no tooltip that follows the pointer, no stagger, no parallax.
• The scroll-progress rule stays (transform only, passive); smooth scrolling is never used.
5.3 Reduced motion
Under prefers-reduced-motion: reduce and the Settings override data-motion=reduced:
• Transforms and travel go to 0; every transition is opacity only and at most 110ms.
• Sheets and drawers appear with a 110ms fade (close 77ms). The scrim fades over 110ms. The build overlay appears with opacity only.
• Colour and background transitions snap (0ms). Popovers fade for 110ms.
• Disclose snaps and the chevron turns instantly. The step transition is opacity only, 110ms.
• Drag still works because the user drives it; its auto-scroll steps instantly and a smaller 6px per frame.
• JavaScript motion (the build overlay, drag auto-scroll) subscribes to the media query's change event.
5.4 Phone and low-end (under 640px or any low-end signal)
• No hover transitions (no hover on touch). No blur: scrim flat 0.72, header at 98% page.
• At most 2 elements animate at once (a sheet and its scrim), and at most 6 composited layers.
• No animation runs while a table scrolls. The step transition is opacity only, 120ms.
• Script per frame at most 8ms; motion JavaScript on product screens at most 20KB gzip.
6. Conflicts in the current screenshots
Severity as in VISUAL_SYSTEM: H breaks a stated rule or hurts data trust; M inconsistency; L polish. Each finding names its screenshot (S1–S9, section 0). Measurements are ±2px.
6.1 High
• G1 (S1) Two right edges in one column. The numbers end at x = 887 while the column header ends at 893. The 0 and — cells and the whole Other operating costs row end at 893, so one column holds values 6px apart (finding 1). Fix: one shared right edge (2.2). H
• G2 (S6, S9) The sensitivity matrix disagrees with the ranges printed on the same page. Assuming five equal steps (WACC 7.72%–9.72%, growth 1.5%–3.5%, which the +/-1% axis labels and S9's end values imply): at 8.72% and growth 1.5% the matrix shows $111, S9 says $112.90; at 3.5% it shows $150, S9 says $147.64; at 7.72% and 2.5% it shows $153, S9 says $152.20. The row and column through the base cell are the same one-at-a-time ranges, so they must match. H
• G3 (S6) Hover-only, unlabelled. The matrix prints no WACC or growth value on its rows and columns, and its only readout is Hover a cell to inspect the valuation at that pair; the health score says Hover any line for its basis. Touch and keyboard users get nothing. Fix: 3.7. H
• G4 (S6) Revenue and margin chart. Bar heights are not proportional to revenue: FY26 is 1.33× FY25 by height (165px against 124px) but 1.65× by value (215,938 ÷ 130,497). There are no axes or values, revenue bars and margin lines are both oxblood, and the legend asks the reader to match two similar red marks. Fix: 3.7. H
• G5 (S2, S3) Two primaries and a third wash on one page. Skip and build the model (top) and Build the model (bottom) are both washed oxblood, and Search a company in the header is a third (finding 5). Three different labels (Skip and build, Build, Skip instead) cover two actions. Fix: one primary, no separate skip (1.1). H
• G8 (S1–S4) Header carry-over. Search a company is still a washed button, and the clock still ticks (18:33:28 IST, 13:03:28 UTC) with a live dot (findings 4, 5 and 6). H
• G10 (S5) Mixed decimals inside rows. Net debt / EBITDA reads 0.8x, 1.09x, 0.03x, 0x net cash, 0.02x net cash; Operating margin reads 60.3%, 60.2%, 60.1%, 60%, 59.9% (finding 1). Some cells say net cash and others print a bare ratio, so the sign is unclear. Fix: one decimal rule per row, ratios as signed values with U+00D7 (−0.02×). H
6.2 Medium
• G6 (S4) Three washed pills (60.5% premium, 82% premium, -4.22%) where one is allowed, red beside the headline value, and 60.5% against 82% at different precision. Fix: 3.2. M
• G7 (S3) Hard-coded currency. what it keeps from every hundred rupees of sales is shown for NVIDIA, a USD company. High for any non-INR company, since the product is global. Fix: currency word from the company (2.9). M
• G9 (S4) Basis mismatch. ROE (LTM) 76.3% and Op margin 60.4% equal the FY26 figures (the company Overview labels them on FY2026), while the TTM operating margin is 65.2%. A label that says LTM must show LTM. M
• G11 (S5) Forecast headers in oxblood: FY27 forecast and FY28–FY31, six accent-text words in one header (budget 5; oxblood is not for labels). Fix: a forecast chip. M
• G12 (S5) Unequal column widths. Right edges at x = 537, 657, 776, 954, 1168, 1299, 1418, 1537, 1657, 1776: gaps of 120, 119, 178, 214, 131, 119, 119, 120, 119. The FY25 and FY26 columns are wider because net cash makes them auto-size. M
• G13 (S5) A ? glyph instead of ⓘ (decision 1). M
• G14 (S5) — in every forecast cell of Net debt / EBITDA, Current ratio and Cash realisation. — means not reported; these are not forecast. n/a with the reason. M
• G15 (S6) Uppercase tracked panel titles (REV & MARGIN TREND, DCF SENSITIVITY MATRIX, FINANCIAL HEALTH SCORE) and red uppercase chips (5-YEAR GAAP, 89/100): the uniform label rule and "never on labels". M
• G16 (S6) Financial health score. A composite 89/100 in an accent chip, averaged from "fixed thresholds" the page does not show, with a hover-only basis. It behaves like a verdict on a site that shows facts. Outside this spec; for the page owner. M
• G17 (S7) Football field has no axis. Its scale is linear ($0 at x = 114, 3.636px per dollar) but nothing prints it; the reader sees two DCF bars 126px and 51px wide beside a 1,009px peer bar and no tick. Fix: 3.3. M
• G18 (S7) The price line (x = 858) crosses text: market price sits above this range in the second row. M
• G19 (S7) Mixed decimals in ranges: $112.9 – $147.64; S9 prints the same number as $112.90. M
• G20 (S7) Oxblood fills for the income bars: two washes before a primary is counted. Fix: outline (3.3, D10). M
• G21 (S1) Body narrower than the header. The body spans x 286→1621 (1,335px) under a header spanning 114→1794, and the bottom bar's content follows the narrow edges (finding 11). M
• G22 (S1) Head row with no total and a duplicated name: Selling, general and administrative appears as a head and again as its first child; the head shows no figure, so the reader cannot tell whether 2,004 is inside 2,166. Fix: 2.2, D3. M
• G23 (S1) ⓘ on 11 of 11 rows (finding 10). Fix: 4 of 9 (2.8). M
• G24 (S1) Statement choice is two separate outlined buttons with an oxblood wash on the selected one (findings 9 and 12). M
• G26 (S1) Every label and every value is bold. Nothing leads; heads and totals look like lines (finding 2). M
• G27 (S2, S3) Judgement choices are three separate outlined buttons of 103, 83 and 112px, 10px apart, with no visible selected state (finding 12). M
• G28 (S2, S5, S7) Justified text with automatic hyphenation (as-sumption, sched-ules, col-lecting). M
• G29 (S3) Want to know more about this company? has its chevron on the right (finding 13); S2 and S4 put it on the left, correctly. M
• G30 (S2) An 8px oxblood square before the eyebrow Before the model — NVDA: a red fill on a label. M
• G31 (S4) isin printed with no value. M
• G32 (S4) The NVDA ticker is a solid oxblood chip (finding 9). M
• G33 (S4) The in-page row spans x 54→1854 against content 114→1794, and holds a red-outlined Model a list button; four outlined buttons sit in a row beneath the headline (finding 12). M
• G34 (S2–S4) The header grows to four controls (Check the figures, Search a company, Home, All companies) (finding 5). M
• G35 (S9) Figures in serif ($112.90, $147.64, $152.20, $109.62; finding 14), and the pills up to 1.3% of the value in red. M
6.3 Low
• G25 (S1) Row heights vary 37–53px (heads 50–53, children 37–40). Fixed row heights (TABLES_SPEC §1.4). L
• G25b (S1, S2, S5) Three period labels: FY2022, FY22 to FY26, FY26. One form: FY22. L
• G36 (S8) Reverse DCF details: 12.0x and 25.1x with a letter x; 8.7% where the page prints 8.72% elsewhere; out of range as plain text with no range tried; rows 115px tall. L
• G37 (S1, S2) H1 about 44px, outside the type steps (D13). L
• G38 (S4, S6) Hyphen-minus in -4.22% and -0.02; use U+2212. L
6.4 Already right: do not change
• S1: Every figure as filed, every line on its default head states the contract; 0 (reported zero) and — (not reported) are different glyphs.
• S2, S3: Each answer moves one assumption inside the model, and you will see exactly which; Skipping changes nothing about the model; What this will change in the model: Nothing yet…; the Disclose row with a left chevron.
• S4: two values side by side and the price, with no blended figure.
• S7: the vertical price line; the neutral phrases market price sits above / inside this range; the plain-language honesty about what the grey bar is not; one linear scale for every bar.
• S6: the base cell of the matrix outlined.
• S8: solved against the perpetuity value and the statement that lines are not additive.
• S9: What the source does not give us, with the largest effect each gap could have; the 22% / 78% split that sums to 100%.
• Arithmetic: every number checked in section 0 recomputes except G2 and G4.
6.5 Not verifiable from these screenshots
What happens after an edit; hover, drag and focus states; whether S1's header or label column is sticky; the Outputs step, the bridge, refused approaches and the 52-week row; a label on the price line (cropped); behaviour on touch; whether the grey bar and further rows exist below S7's fourth row; whether the exactly 5.0% in S8 is a solved value or the search limit.
7. Developer checklist
Test at 1440 and 390, Chrome and Safari, with the NVDA fixture (FY22–FY26 filed figures, price $204.64 at close 30 Oct 2026) unless stated.
7.1 Step flow and frame
• FLOW-1 The step row is 48 high with four items in order (1 Figures, 2 Judgements, 3 Valuation, 4 Outputs); the current one is ink, 600, with a 2px accent underline; at 390 there are four 85.5px items with no numbers or status.
• FLOW-2 Any step opens at any time; Judgements shows Optional.
• FLOW-3 Each screen has exactly one primary: Continue to judgements, Build the model, Continue to outputs, Download {output}; no other oxblood-washed button is on the page and Search is a ghost button.
• FLOW-4 Build the model shows no overlay if the engine answers within 1s; otherwise the overlay enters in 240ms, and the Two Beats timing holds.
• FLOW-5 The bottom bar is 72 high plus the safe-area inset (68 at 390 with no status text), opaque, with a full-width 1px line top, and its content sits on the container edges.
• FLOW-6 scroll-padding-bottom equals the bar inset plus 16; a focused element never sits under the bar or the header.
• FLOW-7 The eyebrow is muted with no red square; the H1 is 28/34 with the brand mark; no justified or hyphenated text.
• FLOW-8 The page header holds the counter, Undo, Redo, Save as version (at 390 Redo and Save as version are in More).
• FLOW-9 The draft autosaves 1 second after the last change; the words Saved to your model or Not saved are shown.
• FLOW-10 Save as version: Name required (40 characters), Note marked (optional) (160 characters); up to 20 versions; Model default cannot be deleted.
• FLOW-11 The container is 1344 wide at 1440 and 342 at 390; the body, the in-page row and the bottom bar share the same edges.
7.2 Figures
• FIG-1 At 1440 the grid is 1040 + 24 + 280; the rail is sticky at top 88.
• FIG-2 The table follows TABLES_SPEC geometry: label column 320, data columns 144, rows 40 (390: label 148, data 104, rows 52).
• FIG-3 Headers read FY22 with an end date; no FY2022.
• FIG-4 A head with two or more lines shows a head row whose total equals the sum of its components exactly; a one-line head is one row; memo lines are never summed; an empty head shows 0 and no lines.
• FIG-5 Reported zero prints 0; not reported prints —; never mixed.
• FIG-6 In every row, including 0 and — cells, the right edge of the content equals the header's right edge to within 1px.
• FIG-7 Labels and values are 400; head rows and totals are 600.
• FIG-8 ⓘ appears on exactly the four rows the rule selects (SG&A head, Share-based pay, Other operating costs, One-offs); each glyph is 4px after its label, 24×24 (44×44 coarse).
• FIG-9 The legend row names the pencil and moved.
7.3 Editing
• EDT-1 Click, tap, Enter, F2 or typing a digit starts an edit; the input is 128 × 32 (44 coarse) in the same cell, content selected, no other cell moves.
• EDT-2 Accepted: digits, ,, ., a leading hyphen or U+2212 (stored and shown as U+2212), parentheses as negative; up to 4 decimals stored.
• EDT-3 An invalid value shows its message under the input in accent-text after blur, the border stays line-control, the previous value is kept and a polite announcement is made.
• EDT-4 While typing, Filed {value} · change {+n} ({+p%}) updates instantly with no tween.
• EDT-5 Enter commits and moves down; Tab right; Shift reverses; Esc cancels; an unchanged value logs nothing.
• EDT-6 Derived cells (gross profit, head totals, ratios, the rail) update on the same frame as the commit.
• EDT-7 The reason panel shows Reason (optional), 160 characters max, a counter from 120, the helper line, Filed {value} · Open the filing ↗, Reset to filed, Cancel; Enter commits both; Esc cancels both; a reason with no value change is not saved.
• EDT-8 An edited cell shows a 16px pencil with a 24×24 hit area; its popover edits the reason and offers Reset to filed; its name says edited, filed value {n}.
• EDT-9 After an edit the edited figure and the rail value turn accent-text in 110ms; no more than two accent-text words come from this feature; earlier edits return to ink.
• EDT-10 The counter reads No changes (not a button) or {n} changes (a button); resetting an item reduces it.
• EDT-11 At 390 an edit opens a bottom sheet with 44px inputs and Save as its primary.
7.4 Drag, undo, changes
• DRG-1 Only lines have a handle (16px icon, 24×24 hit); head rows are drop zones.
• DRG-2 The drag starts after 4px; a copy follows the pointer with no transition; the original keeps a dashed outline at 0.4 opacity.
• DRG-3 An eligible head gets a 1px accent border and a 1px insertion line; an ineligible head shows nothing and the cursor is not-allowed.
• DRG-4 The drop is instant, with no reorder animation; focus moves to the moved row's handle; head totals update; the change is logged with its solo effect.
• DRG-5 Esc, release outside the table and pointercancel log nothing.
• DRG-6 Auto-scroll is 12px per frame within 48px of the container's top or bottom edge, instant.
• DRG-7 Move to… performs every move that dragging can, on desktop and at 390.
• DRG-8 Keyboard: Space picks up, Up and Down choose, Space drops, Esc cancels, M opens the menu; each step is announced.
• DRG-9 At 390 a 400ms long-press on a label picks the line up; a tap opens Line options.
• DRG-10 A moved line shows moved; Back to default head restores it and removes the change.
• UND-1 Ctrl or ⌘+Z undoes, Shift+Ctrl or ⌘+Z and Ctrl+Y redo; the stack holds 100 steps; text fields keep native undo.
• UND-2 Undo and Redo are aria-disabled when their stack is empty.
• UND-3 After an undo the status text reads Undid: {change} for 8 seconds, then the counter returns; nothing animates.
• UND-4 Reset all is one undoable step with no confirmation.
• UND-5 The changes drawer lists newest first with the change, the reason or Add a reason, the On its own effect and Reset this change; the empty text is No changes. Everything is as filed.
7.5 Judgements
• JDG-1 At 1440 the grid is 392 + 48 + 904 and the left panel is sticky at top 88; at 390 it is a closed Disclose row.
• JDG-2 Rows are at least 80 high, grid 1fr 312px, text column 520.
• JDG-3 Each control is one segmented control with three equal 104px segments (390: 102px, 44 high); nothing is selected until answered; Clear appears only when answered.
• JDG-4 Neither counts as answered; blank does not; the counter and the summary treat them differently.
• JDG-5 Arrow keys move focus only; Space or Enter selects.
• JDG-6 The effect line shows Would change: {assumption} when unanswered, {assumption} {before} → {after} · on its own {effect} when answered, and Calculating… only after 200ms.
• JDG-7 The summary panel gives the joint effect and says it is not the sum of the lines; its empty text is the sentence in 2.10.
• JDG-8 No hard-coded currency word: for a USD company the copy says dollars; the ratio reads −0.02× with the × glyph.
• JDG-9 All Disclose rows have the chevron on the left and the body indented 24.
7.6 Valuation
• VAL-1 Sections are numbered 01–06 in order; the in-page row spans the container width and scrolls instantly.
• VAL-2 The headline has three cells and no pills, one decimal for every percentage, the words above or below; no element anywhere shows a blended, average, midpoint or fair value (a text search for those words returns nothing on this screen).
• VAL-3 A missing meta value prints —, never a bare label.
• FF-1 Rows and groups appear in the specified order; a row is 88 high; ranges print two decimals with an en dash.
• FF-2 Income bars: 1.5px solid accent-text outline, no fill, 2px tick; market: 1.5px solid read outline with hatch; asset: 1.5px dashed 6/4; reference: 8px solid line-control bar.
• FF-3 For the NVDA fixture: M = 450; step 100; labels $0 $100 $200 $300 $400 (390: step 200, $0 $200 $400).
• FF-4 At 1296px: the price line is at 589 ±1px; the perpetuity bar is 100 ±1px wide; the exit-multiple bar 40 ±1px; the peer bar 799 ±1px. At 310px: 24, 10 and 191px; the asset bar is 4px.
• FF-5 An axis with tick labels exists; no vertical gridlines exist.
• FF-6 The price line is drawn behind captions and range text and never overlaps text; its label reads Price $204.64 · close 30 Oct 2026.
• FF-7 Every caption ends with price is above / inside / below this range, and each is correct for its row.
• FF-8 No combined value exists in the DOM or the exports.
• FF-9 The 52-week row shows $164.27 – $243.37 and the words Not a valuation.
• FF-10 The readout shows Price is above 3 ranges and inside 1. at rest; every row opens its method sheet by click, tap and Enter; nothing is hover-only.
• FF-11 A refused approach keeps its row, shows Not shown, states its reason with numbers, and the status counts 4 shown, 1 not shown; no placeholder bar exists.
• FF-12 The football field has no draw-in and no animation at mount.
• RD-1 The paragraph saying the lines are not additive sits above the table.
• RD-2 Columns are 744 + 3 × 160 with 24px gaps; differences are signed with U+2212 and a unit (pp, ×); cost of capital prints 2 decimals, other percentages 1, multiples 1 with ×.
• RD-3 Applying an implied value alone returns a value per share equal to the price within $0.005.
• RD-4 Out of range prints the range tried; Limit reached prints {value} or more and search limit.
• BRG-1 Defaults are Model default to Current draft; the swap button works; equal versions show the identical-versions text.
• BRG-2 At most 8 steps are drawn; extras collapse into N smaller changes whose effect equals the sum of its members' displayed effects; zero-effect steps are in the Disclose row.
• BRG-3 For 1,000 random version pairs, the sum of the displayed steps equals displayed To minus displayed From, to the cent; every running total is an exact cent value; the last equals To.
• BRG-4 No Other or Unexplained bar exists; an unbridgeable pair shows the refusal text and no chart.
• BRG-5 From zero is the default with a visible $0 baseline; Zoom to changes draws broken total bars and prints Axis starts at {value}, not zero.
• BRG-6 Every step prints its sign (U+2212 for negatives); raising steps have a 1.5px positive outline, lowering steps a 1.5px accent-text outline; the legend line is present; hit areas are at least 24×24 (44×44 coarse).
• BRG-7 The readout updates on pointer, touch and keyboard; Enter or tap opens the step sheet; Left, Right, Home, End move between bars.
• BRG-8 View as a table lists Step, Change, Reason, Effect, Running total and matches the chart.
• BRG-9 At 390 the bridge is a horizontal waterfall with 64px rows and a 230px track.
• BRG-10 The bridge in the workbook and the two-pager equals the one on screen, step for step.
• MAT-1 The matrix base row and column equal the one-at-a-time ranges to the cent: $112.90, $147.64, $152.20, $109.62; row and column heads are printed; the readout is not hover-only.
7.7 Outputs
• OUT-1 At 1440 the grid is 480 + 24 + 840; three radio cards; options change with the selection; the primary's label follows the selection; no card has its own download button.
• OUT-2 The preview shows its generation time, becomes Out of date after any change, never refreshes by itself; page images are 560×792 (one page) or 380×537 × 2 with 16px between.
• OUT-3 The workbook has the eight named sheets (plus Peers when selected); every filed figure links to its filing or says Not recorded; recalculating reproduces the on-screen value per share to $0.01 for each approach and version.
• OUT-4 The one-pager is exactly 1 page and the two-pager exactly 2 (A4 595×842pt or Letter 612×792pt, 36pt margins); text at least 8pt; fonts embedded; charts have alt text.
• OUT-5 After 200ms of waiting the primary reads Preparing…; the file is named {TICKER}_{version-slug}_{YYYY-MM-DD}.{ext}; the bar then says Downloaded {file} · {size}; an error returns the label and one press retries.
• OUT-6 Unchecking Include change log and reasons removes the reasons, never the edited flags or the filed-value columns.
7.8 Motion, accessibility, data
• MOT-1 No animation of any property outside transform, opacity, the allowed colour properties and Disclose height; no transition: all; no duration or easing literal outside --m-*.
• MOT-2 No number tweens: value per share, effects, counters, deltas, running totals and solver results swap instantly.
• MOT-3 No row reorders, enters or leaves with animation, after a move, undo, redo or sort.
• MOT-4 The football field, bridge and matrix have no draw-in and no crossfade on a version change.
• MOT-5 Sheets 280ms in and 200ms out; scrim 240ms and 168ms; popovers 110ms and 77ms; step transition 280ms in and 120ms out; build overlay 240ms.
• MOT-6 Reduced motion at 360 and 1440: sheets fade in 110ms with no travel; colour transitions snap; Disclose snaps; the step transition is opacity only.
• MOT-7 At 390: no blur, no hover transitions, at most 2 elements animating, none while a table scrolls.
• A11Y-1 Every pointer target is at least 24×24 (44×44 coarse): ⓘ, handles, pencil markers, chips, segments, checkboxes, bars.
• A11Y-2 Every drag has a non-drag alternative; every hover-only reveal has a touch and keyboard path.
• A11Y-3 All text is at least 13px; contrast of quiet on panel and overlay is at least 4.5:1; every chart mark is at least 3:1.
• A11Y-4 Colour carries no meaning alone: bridge steps print signs, football-field bars differ by shape, states use glyphs or words.
• A11Y-5 The page reflows at 320px and at 200% text zoom with scroll confined to tables and charts' own containers.
• BUD-1 At most 3 oxblood fills or washes and 5 accent-text words in a 1440×900 viewport, at rest and after an edit: at rest the studio spends one wash (the primary).
• DAT-1 Head totals equal the sum of their components for every head and year.
• DAT-2 The +68.3% a year fact equals (215,938 ÷ 26,914)^(1/4) − 1; +65.5% equals 215,938 ÷ 130,497 − 1; the premium text equals price ÷ value − 1 to one decimal.
• DAT-3 A judgement's effect on its own equals the engine's value with only that answer applied, minus the default.
• DAT-4 A lint finds no hard-coded currency name in user-facing copy.
• DAT-5 Bar heights and positions in charts are linear in value on a stated scale (revenue chart: FY26 ÷ FY25 height = 1.65 ±0.01).
8. Decisions I need from you
• D1 Live recompute. The rail, the judgement effects, the reverse DCF and the bridge all need the engine to answer per edit. Is a 400ms target realistic? If not, edits batch behind a Recalculate action and the Valuation status becomes Out of date until it runs.
• D2 Step order and labels (Figures, Judgements, Valuation, Outputs) and which action Build the model sits on (I put it on Judgements; S1 puts it on Figures).
• D3 Is Share-based pay a component of SG&A or an of which memo? It decides whether the head is 4,170 or 2,166 in FY22. The data team should mark each line.
• D4 The mapping from each judgement to the assumption it moves and by how much (a fixed step per answer). It is not in any screenshot; the effect lines depend on it.
• D5 Bridge attribution. I specified sequential attribution in a fixed order (exact by construction, order-dependent). An order-independent method (such as averaging over all orders) is heavier and harder to round exactly.
• D6 Football-field axis: always from zero. Peer multiples reaching $412 make the DCF bars 100px and 40px wide at 1440. Is a zoom control wanted, and if so how is it labelled?
• D7 Where drafts and versions live (account, session, nowhere), and the 20-version cap.
• D8 Section 03 is in no screenshot; I assumed the bridge. D8b Whether S8's exactly 5.0% terminal growth is a solved value or the search ceiling, and the search ranges in 3.5.
• D9 Reason length (160 characters) and whether reasons travel into files shared with others (default: yes, switchable).
• D10 Income-approach bars as oxblood outlines instead of washed fills (CHANGE from S7).
• D11 The health score and its radar (G16): a composite verdict-like number on a facts-only site. Keep, rename, or drop?
• D12 Export terms: which columns the data licences allow into the workbook and the PDFs.
• D13 DESIGN.md was not uploaded; the 20, 28 and 40px sizes reused from COMPANY_OVERVIEW_SPEC still need mapping onto its four steps, and S1/S2's 44px H1 sits outside them.
• D14 Engine behaviour for banks and refusals (which approaches are refused, and the reason strings). The reasons in 3.4 are my wording.