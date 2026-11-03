# TABLES_SPEC — decisions (2 November 2026)
- D1: Modal drawer with the stepper: approved.
- D2: 40px rows on desktop, 52px on phone: approved.
- D3: All lines render (no "+ 6 more lines"); hierarchy comes from subtotal, total and memo row styles: approved. This replaces FINANCIALS_SPEC screen-design rule 5.
- D4: † derived, ‡ restated, — not reported, n/a not applicable; whole derived columns/rows carry no per-cell marker: approved.
- D5: Header sticky inside the table container (offset 0): approved.
- D6: Range selection and tab-separated copy: approved, build in step 9.
- D7: Screener paginates, 50 per page (phone 25): approved.
- D8: Two exclusion clauses ("figure missing", "not applicable"): approved.
- D9: DATA FIX NOW (not step 9): store the XBRL concept, accession number, form and filing date for every SEC figure (they are in the SEC company-facts data). Vendor figures keep the honest "Vendor feed, development only" wording.
- D10: Desktop oldest first with the newest column scrolled into view; phone newest first.
- D11: Line sets and labels mapped by the developer from the data, using the spec's lists as the starting point.
- D12: Export: SEC-sourced figures may be exported; vendor (Yahoo) figures are never exported publicly.
- D13: Map 20/28/40 onto DESIGN.md steps plus the approved 24px tile step, as in COMPANY_OVERVIEW_SPEC D1.
- Finding F1 (TTM operating margin 260%, should be 65.2%) is a data error: FIX NOW, with test DAT-3 on every company.
- Built in build step 9, except the two data fixes above. The yellow starburst is a browser extension: ignore.

TABLES_SPEC
Marginalia · data tables: Financials tab, evidence sheet, global screener results · v1.0 · 1 November 2026 · sits beneath VISUAL_SYSTEM v1.0 (with the 30 October 2026 decisions) and DESIGN.md. Shares type and colour tokens with COMPANY_OVERVIEW_SPEC.
Covers: Financials tab (income statement, balance sheet, cash flow; annual, quarterly, half-year, TTM), the "select a number" evidence sheet, and the future screener results table. Does not cover the company header, Overview tab, charts, or the global header.
0. Basis, limits, markers
Evidence. Two screenshots plus VISUAL_SYSTEM_1.md. I call them F1 (Financials tab: income statement, annual, All (5), with TTM) and E1 (evidence sheet for Cost of sales, FY23). Both are about 1917px wide, read at 1:1; every pixel value is ±2px, so confirm with computed styles before logging a bug. VISUAL_SYSTEM_1.md reads as the same v1.0 (29 October 2026) with the 30 October decisions. DESIGN.md was not uploaded. The yellow starburst is ignored, as instructed.
Decisions applied from the top of VISUAL_SYSTEM. ⓘ stays, with a 24×24 hit area (44×44 under pointer: coarse), shown only on labels that need explaining, and no dotted-underline triggers. Dark is the only instrument theme. All other CHANGE items are law.
Markers. KEEP = already in VISUAL_SYSTEM. ADD = new token or rule. CHANGE = alters VISUAL_SYSTEM or the screenshots. PROPOSED = my value where VISUAL_SYSTEM is silent; it needs sign-off and is listed in section 9.
Tokens and type. I reuse COMPANY_OVERVIEW_SPEC §1.2–1.3: T13 (Source Sans 3, 400, 13/18), T15 (400, 15/22), Title-md (Newsreader 600, 20/26), Title-lg (28/34), tile figure (24/28), hero figure (40/44), all figures tabular lining numerals. Its open decision D1 (mapping 20, 28 and 40 onto DESIGN.md's steps) still stands. Colour names are tokens; hex appears only where VISUAL_SYSTEM prints it.
Data cross-check. I compared F1 with stockanalysis.com's NVDA financials page (opened 1 Nov 2026). Revenue, gross profit and net income agree in all five fiscal years. TTM revenue 302,969 (SA 302,970), gross profit 226,241, operating income 197,579 agree. TTM net income is 192,879 here and 192,880 on SA (one unit of rounding). Two real differences: the TTM operating margin (F1 says 260.0%, SA says 65.21%; 197,579 ÷ 302,969 = 65.2%) and FY23 operating income (4,224 here, 5,577 on SA; a search extract of SA's income statement shows a 1,353 restructuring charge in FY23, and 5,577 − 1,353 = 4,224, so Marginalia's figure is the filing's and SA's excludes the charge).
Research: five pages I opened
Chosen for relevance and because I could read them. I did not verify rankings; the only rating I saw was StockAnalysis's app score (4.9 on both stores).
1. StockAnalysis.com, NVDA financials. Take: one page with Annual, Quarterly and TTM views plus 5Y, 10Y and Max; a header that pairs a fiscal label with its end date; growth shown as a sub-row under its line; a footer that names the data provider, "Last updated", "Last checked" and "Report a data error". Its table is flat (no subtotal hierarchy, no evidence per cell): that is the gap Marginalia fills.
2. IBM Carbon, Data table. Take: five row heights (24, 32, 40, 48, 64) with 40 as the default; the header row matches the row height; row hover is always on, even for non-interactive rows; only the sorted column shows a sort arrow, and unsorted arrows appear on hover only; skeletons instead of spinners; pagination at the bottom, at row height; at most five toolbar actions; column titles of one or two words, wrapped to two lines.
3. Screener.in, a public screen. Take: the count line (119 results found: Showing page 1 of 5); sortable headers that are plain links so the sort is in the URL (?sort=…&order=desc); results per page 10, 25 or 50; Export and Edit Columns beside the table; the query printed as editable text; units in the header. Avoid: abbreviated headers (Piotski Scr), a header row repeated every 15 rows, and no word about companies a filter could not evaluate.
4. Stripe Apps, Filter controls. The Stripe Dashboard itself is behind login; this documents the pattern its own pages follow. Take: a chip has two states, suggested (a plus, opens a menu) and active (the value and a cancel mark); chip labels match column headers; Clear filters appears only while a filter is active; filter the data before it reaches the table so counts and pages stay true.
5. Koyfin Help, Equity Screener release note. This is Koyfin's help documentation; its app is behind login. Take: every criterion becomes a column; each min and max box shows the universe's own min and max as light text, and a blank box is an open bound; screens re-evaluate and "some stocks might drop out"; it discloses that the data vendor restricts export of financials.
Not opened, so not used: FT data pages (a fetch was refused earlier and search returned only third-party copies), Stripe Dashboard and the Koyfin app (login).
1. Table layout
1.1 Frame: Financials tab
Order below the company header and tab row (COMPANY_OVERVIEW_SPEC §1.4–1.5): controls panel, table panel, freshness line. Container content width 1344 at 1440, 342 at 390; panel gap 24 (phone 16); panels are panel ground, 1px line border, radius 0, no shadow.
Controls panel. Padding 24 (phone 16).
• Desktop, two rows. Row A (32 high): statement control at the left, period control at the right. Row B (32 high, 16 below): range control and order control at the left, USD millions with ⓘ at the right. Height 24 + 32 + 16 + 32 + 24 = 128.
• Statement control: Income statement, Balance sheet, Cash flow. Period control: Annual, Quarterly, Half-year, TTM. Order control: Oldest first, Newest first.
• CHANGE (F3): each is one segmented control: height 32 (phone 44), outer border 1px line-control, inner dividers 1px line, label T13 muted, padding 0 12, min-width 44. Selected (VISUAL_SYSTEM §3.1): panel ground, 1px accent border, ink label, weight 600; no wash. The 600-weight width is reserved so nothing shifts.
• Range control rule: Annual shows 5Y, 10Y, All (n); Quarterly and TTM show 8Q, 20Q, All (n); Half-year shows 4H, 10H, All (n). A chip whose result equals another chip's is hidden. With 5 annual periods held, the control is replaced by T13 muted text 5 years held (F13).
• Unit text: USD millions, T13 muted, ⓘ after it explaining that per-share rows are in USD, share counts in millions, and ratios in % or ×.
• Phone: statement control (44) and period control (44) stacked with 8px between; below them a ghost button Options (44 high) whose label shows Options · 5Y · Oldest first; it opens the bottom sheet holding the range and order controls. Unit text sits to its right. Height 16 + 44 + 8 + 44 + 8 + 44 + 16 = 180.
Table panel. No padding; the table touches the panel border. Accessible name through a visually hidden <caption>: NVIDIA CORP income statement, annual, USD millions. At its foot, a legend row (1.7).
1.2 Column geometry
Desktop (≥1024):
• Label column: sticky left, width 320 (min 240, max 360), padding 0 16, right border 1px line.
• Data columns: width clamp(104px, (content − 320px) ÷ n, 176px), right-aligned, padding 0 16. At 1440 with n = 6 (five fiscal years plus TTM) that is 170.67px. With n = 11 (10Y plus TTM) the minimum 104 applies, the table is 320 + 11 × 104 = 1464 wide, and it scrolls horizontally inside its own container with the label column sticky.
• Every data column is the same width, TTM included (F11). The TTM column has a 1px line rule on its left edge.
• Shared right edge (F-1 fixed, KEEP): header text and cell text are both text-align: right with 16px right padding, so the last digit of every cell and the last character of its header share one vertical line. Suffix glyphs (%, ×, †, ‡) hang into the right padding so the final digit still lines up with money rows.
• Container: overflow: auto, max-height: calc(100dvh − 64px − 16px) (phone: also minus the bottom-bar inset), scrollbar-gutter: stable, padding: 4px 4px 4px 0 inside the scrolling area so focus rings are never clipped, scroll-padding-top equal to the header height, scroll-padding-left: 320px (phone 148px). VISUAL_SYSTEM §7 says tables scroll in their own container with a sticky first column; this keeps the header sticky in the same container. A short table (the income statement is 808px tall at 1440) does not scroll vertically.
• Sticky offsets: header top: 0 inside the container; label column left: 0; the corner cell has the highest z-index. All sticky cells are opaque (panel, or overlay on a hovered row). No shadow marks the stuck edge; the 1px line rules do.
• Initial scroll: on mount the container is scrolled instantly (behavior: auto) so the newest column is visible at the right edge.
Phone (390):
• Label column sticky, 148 wide (padding 0 8 0 12). Data columns 104. Visible data width 342 − 148 = 194, so one full column and 90px of the next: the clipped column is the scroll hint.
• scroll-snap-type: x proximity, scroll-snap-align: start on data columns.
• Display labels are at most 32 characters, so every label fits two lines at 148px and one line in the 320px desktop column. The full XBRL concept name lives in the evidence sheet.
1.3 Header
• Period label, T15, 600, ink: FY26, Q2 FY27, H1 FY27, TTM. End date, T13, muted: 25 Jan 2026 (the day-month-year format in F1 is KEEP).
• Chips (below the date, right-aligned, 24 high, 4px apart): T13, muted, 1px line border, padding 0 8, radius 0, no fill.
    ◦ Basis chip, always on the TTM column: TTM (4 quarters); phone TTM · 4Q.
    ◦ Duration chip, only when it differs from the view's standard (Annual: 12 months; Quarterly: 3 months; Half-year: 6 months): 53 weeks, 11 months. F1 prints 12M on all five annual columns; that repeats the control and goes (F10).
    ◦ derived: the column's values are computed by Marginalia, not filed as such: Q4 = full year − nine months; quarterly cash flow from year-to-date filings; half-year = two quarters.
    ◦ restated: at least two captures of the period exist and differ on some line.
    ◦ A TTM column is derived by definition, so it never carries derived. At most two chips per column; if they do not fit one row they wrap to a second.
    ◦ Each chip is a button: it opens the evidence sheet in its period variant (4.6).
• Header height: 12 top padding + 22 + 18 + 12 bottom = 64 with no chips; 88 with one chip row (12 + 22 + 18 + 4 + 24 + 8); 116 with two. The height is a property of the table state, so it does not change while scrolling. Carbon says header and rows share a height; the period header is a deliberate multi-line exception.
• Corner cell: the statement name, T13 muted, aligned to the date line. Header bottom border 1px line.
1.4 Rows
Row kind
Label
Value
Rules
Line
T15, 400, read, indent level 0, 16 or 32px
T15, 400, ink
1px line below
Subtotal
T15, 600, ink
T15, 600, ink
1px line-control above
Total (net income, total assets, net change in cash)
T15, 600, ink
T15, 600, ink
1px line-control above, 3px double line-control below
Memo (ratios, margins)
T15, 400, muted, indent 16
T15, 400, ink
unit suffix on every cell
Group heading (Assets, Operating)
T13, 600, muted, sentence case
none
32 high, 1px line above
• Heights: body row 40 (desktop), 52 (phone, which holds two label lines and meets the 44px touch target). Group row 32 (phone 36). Row height does not vary with content.
• Indent: padding-left 16 plus 0, 16 or 32. Deductions (cost of sales, tax) sit one level in.
• Labels 400, subtotals 600, values 400 (finding 2). Labels are never bold at rest.
• Units in cells: money rows carry no currency symbol (the unit is in the controls panel; F1 prints $ in all 36 money cells, F6). A row that differs from the table unit says so: per-share rows $4.90 (2 dp), share counts in millions with no symbol (0 dp), ratios 37.3% (1 dp), multiples 12.0× (1 dp).
• One decimal rule per row (finding 1, KEEP): 0 dp for millions, 2 for per-share, 1 for ratios; never mixed within a row.
• Negatives use U+2212 (−1,234). Parentheses are not used. A non-zero value that rounds to zero prints <1 (or −<1), never 0.
• Hover and selection: section 3.
1.5 Default line sets (PROPOSED; data team confirms labels and order)
• Income statement (18 rows, all visible, 720px of rows at 1440): Revenue; Cost of sales (L1); Gross profit; Research and development (L1); Sales, general, administrative (L1); Other operating items (L1); Operating income; Interest, net (L1); Other income (expense) (L1); Pre-tax income; Income tax (L1); Net income (total); memo Operating margin, Net margin, Effective tax rate; per share Diluted EPS, Diluted shares. F1 hides six lines behind + 6 more lines; tables render complete, so that button goes (F8).
• Balance sheet: groups Assets, Liabilities, Equity; subtotals Total current assets, Total assets (total), Total current liabilities, Total liabilities; Total liabilities and equity (total); memo Net cash (debt), Current ratio, Debt to equity.
• Cash flow: groups Operating, Investing, Financing; subtotals Cash from operations, Cash from investing, Cash from financing; Net change in cash (total); memo Free cash flow (derived: operations less capital expenditure).
• Identities the data must satisfy (tested in section 8): gross profit = revenue − cost of sales; total assets = total liabilities + equity; net change in cash = operations + investing + financing + currency effect.
1.6 Phone summary (390)
• Container 342. Controls 180. Table: label 148 sticky, data 104, rows 52, header 64/88/116, group row 36. Hit target of every number: 104 × 52. Opening a number opens the bottom sheet (section 4).
• Landscape does not change the layout.
1.7 Legend and freshness
• Legend row inside the panel foot: 40 high (phone: wraps, up to 64), 1px line above, padding 0 16. T13 quiet: — not reported · n/a not applicable · † derived · ‡ restated. At the right: Select any number for the filing behind it (device-neutral; F12).
• Freshness line under the panel (T13 quiet): Statements: FY2026, ended 25 Jan 2026 · TTM to 26 Jul 2026 · Source: SEC EDGAR, XBRL company facts ↗ · Last checked 1 Nov 2026 · Report a data error. Links use the link-source style from COMPANY_OVERVIEW_SPEC §2.5 (read text, 1px underline). The pattern follows StockAnalysis's footer.
• Stale state: the Koyfin banner pattern from COMPANY_OVERVIEW_SPEC §1.9.
2. The five value states
The state belongs to the cell (line × period). It is carried by a glyph or word, never by colour alone.
1. Reported. The filing carries a tagged value.
    ◦ Cell: the number, ink, 400 (600 on subtotal rows), 0 dp (row rule), U+2212 for negatives.
    ◦ Tappable: yes. Sheet tag Reported. Sheet sentence: Tagged in the filing as {concept}.
    ◦ Accessible name: {value} million dollars, {line}, {period}, reported.
2. Reported zero. The filing carries a value and it is zero.
    ◦ Cell: 0 (per share 0.00, ratio 0.0%), ink, same weight as reported.
    ◦ Tappable: yes. Tag Reported zero. Sentence: The filing reports 0 for this line. This is not a missing figure.
    ◦ Name: zero, {line}, {period}, reported zero.
3. Not reported. The filing carries no tagged value for this line and period.
    ◦ Cell: — (U+2014), quiet (5.03 on page, about 4.8 on panel), right-aligned on the digits' edge.
    ◦ Tappable: yes (the absence is evidence too). Tag Not reported. Sentence: The filing carries no tagged value for {line} in {period}. This does not mean the figure is zero.
    ◦ Name: not reported, {line}, {period}.
4. Not applicable. The idea does not apply to this company or period (for example, gross profit for a bank, or a line introduced after the period).
    ◦ Cell: n/a, quiet, right-aligned.
    ◦ Tappable: yes. Tag Not applicable. Sentence: {Line} does not apply here: {reason}. The reason is required data.
    ◦ Name: not applicable, {line}, {period}.
5. Derived. Marginalia computed the value from reported figures.
    ◦ Cell: the number in ink, with a hanging † in quiet (T13) 2px to its right, inside the right padding.
    ◦ Marker rule: † appears only on a cell that is derived within a column or row that is not itself derived. A column whose header chip says TTM or derived, and a memo row whose label carries ⓘ with the formula, are derived as a whole, so their cells carry no †. This stops the whole TTM column from being covered in daggers.
    ◦ Tappable: yes. Tag Derived. The sheet shows the formula and each input (4.4, block 5).
    ◦ Name: {value} million dollars, {line}, {period}, derived.
Restated is not a fifth state: it is a property of a reported or derived cell. A restated cell gets a hanging ‡ (after † if both apply, 2px apart), and the sheet shows the earlier value.
Copy and export. Reported and derived copy as plain digits (U+2212 kept, no marker). Reported zero copies 0. Not reported copies an empty cell. Not applicable copies n/a. Excel export writes a real blank and a text n/a, and adds a state column per row in a second sheet.
Mixed rows. A row never converts — to 0, and a column total never counts — or n/a as 0: a subtotal whose inputs include a — is itself marked derived and its sheet lists the missing input.
3. Hover, selected row and column, keyboard
3.1 Hover (pointer fine only; none on touch)
• Row hover is always on (Carbon), even though only the cells are interactive. The whole row, label cell included, goes from panel to overlay (+1 tonal step) over --m-dur-fast (110ms) on --m-ease-standard, background-color only. Sticky cells take the same colour, so no cell shows through.
• The cell under the pointer also gets a 1px quiet at 40% outline, outline-offset: -1px (the existing tile-hover rule applied to a cell), 110ms. No lift, scale or shadow.
• The column header above the hovered cell goes from muted to ink on its date line (110ms). There is no vertical column band: it would double the visual noise of 40px rows.
• Cursor: pointer on data cells and header chips; default on group rows and on labels without ⓘ.
• Hover never opens anything by itself. The ⓘ popover opens on hover after 300ms as in COMPANY_OVERVIEW_SPEC §2.3, and it does not follow the pointer.
3.2 Selected cell, row and column
Selected means "its evidence is open" (or, after 3.5, "part of the range"). It uses the one selected-state definition (VISUAL_SYSTEM §3.1).
• Cell: panel ground, 1px accent border drawn by an inset pseudo-element (not box-shadow, not outline, which belongs to focus). The value stays ink, weight unchanged.
• Row: the label cell goes to weight 600 and ink.
• Column: the header's period label stays 600 ink; its date line goes from muted to ink, and a 1px accent rule runs along the header cell's bottom edge.
• Applied at 0ms, so the state never lags the keyboard. Cleared when the sheet closes; focus returns to the cell.
• Selection uses an accent border only: it spends no oxblood fill or wash and no accent-text words.
• While the sheet is open on desktop, the selected cell remains visible under the scrim, because the table is scrolled so the cell sits left of the drawer (the drawer covers x ≥ 960 at 1440) with an instant scrollLeft change.
3.3 Keyboard (ARIA grid)
• Table: role="grid", aria-readonly="true", aria-rowcount, aria-colcount. Label cells role="rowheader", period headers role="columnheader", numbers role="gridcell". Group rows role="row" with one rowheader.
• One tab stop: the active cell has tabindex="0", all others -1 (roving). First entry lands on the first data cell of the first body row, or the last active cell.
• Arrow keys move one cell; they stop at edges (no wrap). From the first data column, Left goes to the label cell. From the first body row, Up goes to the header (chips are cells).
• Home / End: first / last cell in the row (label to newest value). Ctrl+Home / Ctrl+End: first / last cell of the grid.
• Page Up / Page Down: move by (visible body rows − 1).
• Enter or Space: on a data cell opens the evidence sheet; on a label with ⓘ opens its definition popover; on a header chip opens the period variant (4.6); on a group row does nothing.
• Esc: closes the sheet or popover and returns focus to the cell that opened it (or, after the sheet's stepper moved the selection, to the currently selected cell).
• Tab: leaves the grid to the legend links; Shift+Tab returns to the controls panel.
• Focus ring: 2px solid ink, outline-offset: 2px, keyboard only, never restyled. The container padding (1.2) and scroll-padding keep the ring unclipped and never under the sticky header or label column (WCAG 2.4.11).
• Accessible name of a number: {value} million dollars, {line}, {period}, {state} (section 2). Group and total rows state their kind: subtotal, total.
• Polite live-region announcements only for the sheet title and for sort changes in the screener. Moving focus inside the grid announces nothing extra.
3.4 Touch
• A tap on a number opens the bottom sheet. There is no hover, no long-press, no double-tap. Cells use touch-action: manipulation; the container uses touch-action: pan-x pan-y.
• Every number is at least 104 × 52 (above the 44×44 minimum). Header chips and ⓘ glyphs get 44×44 hit areas through their pseudo-elements.
• Horizontal scrolling uses native momentum with scroll-snap-type: x proximity. No animation runs while the table scrolls (VISUAL_SYSTEM §8).
3.5 Range selection and copy (PROPOSED, D6)
• Shift+Arrow extends a rectangle from the active cell; Ctrl/⌘+A selects every data cell; Esc clears it.
• Ctrl/⌘+C copies the rectangle as tab-separated values with the copy rules in section 2 (digits only, U+2212 kept, no markers). Copying a whole row or column includes its label or period header.
• A selected rectangle draws one 1px accent border around its outer edge and nothing inside it. Enter opens evidence for the active cell only.
• Analysts live in spreadsheets; this takes the table to Excel without the Excel export step.
4. The evidence sheet
4.1 Geometry and modality
Desktop (≥1024): right drawer.
• Width 480 (CHANGE: E1 measures about 516–531, E2), full viewport height, top: 0; right: 0; bottom: 0. Background overlay, 1px line on the left edge, no shadow, radius 0, padding 24.
• Modal, as VISUAL_SYSTEM §4 specifies for sheets: a scrim (rgba(11,11,13,0.72)) covers the whole viewport, including the header and the table, with backdrop-filter: blur(6px) on desktop only (permitted by VISUAL_SYSTEM §2). E1 leaves the header's left half bright above the scrim (E7). The scrim covers it.
• One blurred layer only: while the sheet is open the header's own blur(8px) is switched off (header at 98% page), so exactly one layer blurs.
• Focus is trapped; Esc, the close button, a scrim click and the browser Back button all close it.
• Body scroll is locked (overflow: hidden with scrollbar-gutter: stable) so the page does not shift.
Phone and tablet (<1024): bottom sheet.
• Full width, bottom: 0, max-height: 85dvh, height follows content, top border 1px line, background overlay, radius 0, padding 16 and padding-bottom: calc(16px + env(safe-area-inset-bottom)). The scrim is a flat 0.72 with no blur.
• Content scrolls inside the sheet; the header block and the stepper footer stay fixed.
• Dismiss: close button (44×44), scrim tap, Back, Esc. Optionally a downward drag that starts on the header strip (top 64px) and passes 80px (PROPOSED); the rest of the sheet scrolls normally.
Why modal. A modal drawer follows VISUAL_SYSTEM literally. Its cost is one close and reopen per number, which the in-sheet stepper (4.7) removes. A non-modal side panel is the alternative if you prefer it (D1).
4.2 Open and close
• Open: the sheet translates translateX(100%) to 0 (phone translateY(100%) to 0) over --m-dur-slow (280ms) on --m-ease-enter; the scrim fades over --m-dur-mod (240ms). Nothing else moves; the table does not scroll or resize.
• Close: 200ms on --m-ease-exit (70% of 280, rounded); scrim 168ms (70% of 240).
• Stepping inside the sheet swaps the content instantly (no slide, no fade). The scrim and panel do not move.
• Deep link: ?evidence=income.cost_of_sales.FY23 (screener: ?evidence=roe.NVDA.latest). Opening pushes a history entry, so Back closes the sheet. Loading a URL that already holds the parameter shows the sheet open at once with no travel.
• Focus on open: moves to the sheet title (tabindex="-1"), then Tab runs back (if any), close, copy actions, derived-input rows, the filing link, stepper, and loops. On close: to the originating cell, scrolled into view.
• role="dialog", aria-modal="true", aria-labelledby the title.
4.3 Layout, top to bottom
Blocks 1–7 below are the order on both desktop and phone.
1. Header (min-height 64). Left: eyebrow Evidence (T13 muted), then the title Cost of sales · FY23 (Title-md, ink, wraps to two lines at most). In nested views a ‹ Back text button (T13) sits above the eyebrow. Right: a 32×32 close button (44×44 hit area on coarse), 1px line-control border, 16px × icon.
2. Figure row (margin-top 16). Hero figure (40/44, ink) 11,618 followed by USD million in T13 muted on the same baseline (E6: E1 shows $11,618 with no unit). Right-aligned: the state tag, T13, 1px line-control border, padding 4 8, one of the five state words. A zero shows 0; not reported shows — in quiet; not applicable shows n/a in quiet.
3. Facts, below a 1px line divider with 24px above and below.
4. Restatement (only when restated).
5. How this figure is built (only when derived).
6. Where it came from.
7. Actions.
The footer stepper (4.7) is fixed under block 7.
4.4 Fields
Block 3, facts. A definition list, grid-template-columns: 128px 1fr, row gap 12, labels T13 quiet, values T15 read, left-aligned and wrapping inside their column (E1 right-aligns values, so not known — one capture held… becomes a ragged-left block; E3). Fields in order:
• Line. Cost of sales.
• Concept. The XBRL element, us-gaap:CostOfRevenue. If the data does not record it: Not recorded, then T13 quiet: The filing could use CostOfGoodsAndServicesSold, CostOfRevenue or CostOfServices. (E4; the data team should store the element, D9).
• Period. 30 Jan 2022 – 29 Jan 2023 · 12 months · FY23. One field replaces E1's Period and Duration.
• Basis. Consolidated.
• Unit. USD millions. Replaces E1's Unit and Currency (E9).
• Form. The exact form: 10-K, annual report. Never 10-K / 20-F (E5).
• Filed. 24 Feb 2023, or Not recorded.
• Accession number. 0000000000-00-000000 (format), or Not recorded.
• Restated. No: later filings repeat this figure, or Yes: earlier value 11,350 (captured 3 Mar 2023), or Unknown: one capture held, so there is no earlier version to compare (E1's wording, kept and shortened).
• E1's State row goes: the tag already says it (E8).
Block 4, restatement. A two-row list: Now and Earlier, each with the value (tabular, right-aligned), the capture date, and the signed change +268 in U+2212/+ form. Heading T13 muted: Restated.
Block 5, how this figure is built (Derived only).
• Formula sentence, T15 read: Q4 FY24 = FY24 − nine months FY24.
• One row per input, 40 high (phone 52), 1px line between: label and period at the left, value right-aligned and tabular, a 16px chevron at the right. Each row opens that input's own evidence in the same sheet (Back returns). A missing input is listed with — and the words not reported; the result then reads Not computable unless the rule in section 2 ("Mixed rows") applies.
• A final row = with the result, 600, ink, with a 1px line-control rule above it.
Block 6, where it came from. Heading T13 muted. Body T15 read: SEC EDGAR, XBRL company facts. Each figure is a tagged fact in the filing. Then the one oxblood element of the sheet: the link Open the filing ↗, accent-text, 24px minimum height, opens the exact filing by accession number. A link is an allowed accent-text use (VISUAL_SYSTEM §3.1) and it is the sheet's primary action.
• If the accession number is not recorded (E1's case, E1-conflict): the link reads Find this filing on EDGAR ↗ and opens an EDGAR search prefilled with the company's CIK, the form type and the period end. A T13 quiet line says The filing number was not recorded, so this link searches EDGAR instead of opening the filing. The sheet never says Open the filing when it cannot.
Block 7, actions. Two text buttons, T13 read, 1px underline, 24px high: Copy value and Copy link to this number (the deep link in 4.2). A copied state replaces the label with Copied for 2 seconds, with no animation.
4.5 Content by value state
• Reported: every block as above; Restated shows its answer.
• Reported zero: the figure row shows 0 USD million and the tag Reported zero; a line under the facts: The filing reports 0 for this line. This is not a missing figure.
• Not reported: figure —, tag Not reported, no Concept or Accession row when none exists; a sentence in T15 read: The filing carries no tagged value for Cost of sales in FY23. This does not mean the figure is zero. Block 6 stays: the filing is still the evidence of the absence.
• Not applicable: figure n/a, tag Not applicable, sentence {Line} does not apply here: {reason}.
• Derived: tag Derived; Concept shows Computed by Marginalia; block 5 is shown; block 6 links the filings of the inputs.
4.6 Period variant (opened from a header chip)
• Title {Period label} · {end date} (for example Q4 FY24 · 28 Jan 2024); eyebrow Period; no figure row.
• Facts: Period (start to end, duration), Basis, Form(s), Filed, Accession number(s), Restated.
• Block 5 explains the chip: derived shows the construction (Q4 = FY − nine months) with the filings used; TTM (4 quarters) lists the four quarters with their end dates and their filings; restated lists each line that changed with old and new values.
• No stepper in this variant.
4.7 Stepper (ADD)
• A fixed footer, 56 high, 1px line above, padding 12 24 (phone 12 16 plus the safe-area inset).
• Desktop: two segmented controls, 32 high, T13: ‹ Earlier | Later › (the same line, adjacent period) and ↑ Line above | ↓ Line below. Phone: one control of four 44px-high segments, 75.5px each: Earlier, Later, Above, Below, each with a 16px icon.
• Keyboard: Alt+←, Alt+→, Alt+↑, Alt+↓. Plain arrows scroll the sheet.
• A segment is aria-disabled at an edge (first or last period; first or last line). The stepper visits every cell, including — and n/a, because absence is evidence.
• Each step moves the selected cell in the table behind the scrim and scrolls it into view instantly. Content swaps with no animation; the title is announced politely.
• Group headings are skipped.
4.8 Loading and error
• The title, figure and tag come from the table at once, so the sheet never opens empty. Facts that need a request show T13 quiet blocks (static, line colour) only after 200ms of waiting. No spinner, no shimmer.
• Error: in place of the facts, T15 read: The evidence did not load. plus a ghost button Try again. The figure and tag stay.
4.9 Accessibility
• Dialog semantics as in 4.2. Every control at least 24×24 (44×44 coarse). All text at least 13px. Contrast: quiet on overlay is about 4.6:1 (computed; add to npm run verify).
• The sheet is a complete alternative to hover, so nothing is hover-only.
• Reduced motion: section 6.
5. Screener results table (future, global)
The screener reuses sections 1–4: the same cell states, grid keyboard model, hover and selected rules, and the same evidence sheet. This section lists only what differs.
5.1 Page structure
From the top, under the global header, 24px below it (y = 88):
1. Screener, h1, Title-lg. Under it, 8px down, T15 muted: Companies that match your filters, using the latest filed figures.
2. Filter panel (margin-top 24, padding 16 24, panel, 1px line): applied and suggested chips, then Add filter (ghost, 32 high), then at the right Clear all (text button, T13, only while at least one filter is active).
3. Table panel (margin-top 24): toolbar (48), table, pagination bar (48).
The screen has no primary button on the page itself. The only oxblood wash is the primary inside the filter sheet (5.2).
Toolbar (48 high, padding 0 24). Left: the count block (5.3). Right: the column-set control (5.4) and a ghost Download CSV button (32 high). At most five toolbar actions (Carbon). Phone: count block, then a row with Columns and Download CSV ghost buttons, 44 high each, 8px apart.
Phone filter panel: padding 12 16; chips scroll horizontally inside one row (no wrapping), each 32 visible and 44 hit height; Add filter is the first item.
5.2 Filter chips and the filter sheet
Chips follow Stripe's two-state pattern.
• Applied chip: {Column header} {operator} {value}, in words: ROE above 15%, Market cap at least $1T, P/E between 5× and 20×, Sector: Technology, Energy. Height 32, T13 read, 1px line-control border, panel ground, padding 0 8 0 12, a trailing 24×24 × button (44×44 hit area coarse) with aria-label="Remove filter ROE above 15%". A chip whose basis is not the default adds · TTM or · FY2026. Chip labels match the column headers they filter.
• Suggested chip (shown only while no filter is active): + Market cap, + Sector, + P/E, + ROE, same size, muted label. Pressing one opens the filter sheet at that metric.
• Pressing an applied chip's label reopens the sheet at that criterion. Chips are not "selected" controls, so they carry no accent border.
• Logic: chips combine with AND. A multi-value chip is OR inside itself. A page that hides the rule is an unsafe screener, so the sheet's header states All filters must match.
• Filter sheet: right drawer 480 (desktop), bottom sheet (phone), same motion tokens as the evidence sheet. Contents: metric picker (search field, then grouped radio list); for numeric metrics two inputs Min and Max (32 high, 44 coarse, 1px line-control), and under each, T13 quiet, the universe's own range (Universe min −412%, Universe max 1,860%), and a blank box means an open bound (Koyfin); a basis radio group Latest annual (default), TTM, Fiscal year with a year select; a live line 1,204 companies match (T15) that updates as the inputs commit. Footer: the one primary button Show 1,204 companies (oxblood wash, 44 high), and a text button Remove filter.
• Filters apply on press of the primary; the page table does not change while the sheet is open.
5.3 Match count and exclusions
The count block is two lines (T15 line 22 + T13 line 18, plus 8 padding = 48).
• No filters: 4,812 companies, number in 600 ink. Second line T13 quiet: Universe: US-listed companies with filed accounts. Figures as at 30 Oct 2026.
• With filters: line 1 1,204 of 4,812 companies match. Line 2, T13 muted: 38 companies excluded: figure missing · 8 excluded: not applicable · See which. Each clause appears only if its count is above zero. When both are zero line 2 reads No company was excluded. (an explicit zero builds trust).
• Definition. A company is excluded when an active filter needs a figure it lacks on the chosen basis. It is neither a match nor a non-match. It is counted once even if it lacks several figures. Invariant, tested in section 8: matches + non-matches + excluded (missing) + excluded (not applicable) = universe.
• See which (link-source style) opens the excluded drawer (480 / bottom sheet). Title Excluded from this screen. Two Disclose rows (chevron on the left), Figure missing (38) and Not applicable (8), each holding a table: Company, Figure, Latest period held, Reason. 25 rows per page, sorted by market cap, largest first. A row links to that company's Financials tab with the cell selected.
• Zero matches: 0 of 4,812 companies match. Line 2: Most restrictive filter: ROE above 60% (31 companies pass it alone). A Clear all button sits below.
• Counts change instantly. No count-up, no flashing (VISUAL_SYSTEM §5). A polite live region announces 1,204 companies match. 38 excluded. after a 300ms debounce.
5.4 Column sets
Column-set control: desktop, a segmented control in the toolbar (32 high): Overview, Valuation, Quality, Growth, Balance sheet. Phone: the Columns button opens a bottom sheet with a radio list of the five sets. Each set has at most 8 numeric columns after the Company column.
• Overview: Price, Change on the day, Market cap, P/E, Revenue, Net margin, ROE, Dividend yield.
• Valuation: Price, Market cap, P/E, P/B, EV/EBITDA, Market cap/sales, Dividend yield, FCF yield.
• Quality: Operating margin, Net margin, ROE, ROCE, Interest coverage, Debt to equity, Current ratio, Tax rate.
• Growth: Revenue, Revenue growth (1Y), Revenue CAGR (3Y), Net income growth, EPS growth, Operating margin change, FCF growth.
• Balance sheet: Total assets, Cash and investments, Total debt, Net cash (debt), Debt to equity, Current ratio, Book value per share, Shareholders' equity.
• Filter columns (Koyfin): every active filter whose metric is not in the set adds a column right after Company, in filter order, so a reader sees why each row passed. Added columns are marked by the chip's presence above, not by colour.
• Column titles are one or two words and may wrap to two lines; they are never abbreviated (Screener.in's Piotski Scr). A title wraps rather than truncates.
5.5 Geometry
• Company column (sticky): desktop 280, phone 148. Desktop cell, two lines: name (T15, ink, a link, 1px ink underline on hover) over NVDA · NasdaqGS (T13 muted). Names wrap to two lines rather than truncate. Phone cell: ticker (T15, 600, ink) over the name (T13 muted, single line, the one place an ellipsis is permitted; the full name is in the title attribute and the company page).
• Numeric columns: width clamp(112px, (1344px − 280px) ÷ n, 160px), phone 104. With 8 columns at 1440 that is 133px; with 11 (three added filter columns) the 112 minimum applies and the table scrolls inside its container. Right-aligned, padding 0 16, tabular, shared right edge with the header (section 1.2).
• Row height: desktop 48, phone 52. Pagination bar and toolbar are also 48 (Carbon pairs them with the row height).
• Header: 80 high at both widths: 12 padding, a two-line title (36), a one-line basis (18), 12 padding, one pixel of tolerance. Title T13, 600, ink. Basis line T13 muted: latest FY, TTM, FY2026, close 30 Oct 2026. Every column states its basis, because companies have different fiscal years.
• Container, sticky header and column, scroll padding, focus-ring padding: as 1.2. Max height calc(100dvh − 64px − 16px); with 50 rows (2,400px) the table scrolls vertically inside its container.
• ⓘ only on headers that need explaining (P/E, EV/EBITDA, ROCE, FCF yield, Interest coverage, EPS growth), separate from the sort button, 24×24 hit area.
5.6 Sorting
• The whole header cell is a sort button (80 high, full column width). Sorting is on the full result set, on the server, and returns to page 1.
• First press: numeric columns sort largest first, Company sorts A to Z. Second press reverses. Third press returns to the default (market cap, largest first).
• Indicator (Carbon): only the sorted column shows a 16px outline arrow, up or down, in ink, at the left of the title. Unsorted arrows show in quiet on hover and focus only (opacity 110ms). aria-sort="ascending|descending" on the header.
• Missing values always sort last, in both directions: — and n/a come after every number.
• Tie-break: market cap, largest first, then ticker A to Z. Sorting is stable and deterministic.
• The change is an instant swap. Rows do not move, fade or reorder with animation (VISUAL_SYSTEM §5). Focus stays on the header button. A polite announcement says Sorted by ROE, largest first.
5.7 Pagination
• Bar at the bottom, 48 high, 1px line above. Left: 1–50 of 1,204. Right: Rows per page select (25, 50, 100; default 50, phone 25), ‹ Previous and Next › ghost buttons (32 high, 44 phone), and Page 1 of 25.
• A page change scrolls the container to the top instantly and moves focus to the first data cell. A polite announcement says Page 2 of 25.
• 1,204 rows at 50 per page is 25 pages (24.08 rounded up).
5.8 URL and history
• State lives in the URL so any screen can be shared: ?set=quality&f=roe:gte:15;mcap:gte:1e12&sort=roe:desc&page=1&per=50. Sort headers are real links (Screener.in).
• Changing filters pushes a history entry; changing sort, page or column set replaces it. Back after a filter change removes that filter.
5.9 Numbers and evidence
• Every number follows the five states in section 2. In the screener the metrics are computed per column, so cells carry no †; the header's ⓘ gives the formula and the evidence sheet lists the inputs.
• Tapping a number opens the same evidence sheet. Title NVIDIA CORP · ROE, period field latest FY: FY26 (25 Jan 2026), block 5 lists net income and equity, each a nested evidence view.
• Enter on the Company cell follows the company link; Enter on a number opens the sheet.
5.10 States
• First load: the server sends the complete first page. No skeleton unless the response takes longer than 200ms; then static line blocks in 10 rows, no shimmer.
• Updating (filter, sort, page): the previous table stays; after 200ms the count block's second line reads Updating… (T13 quiet); aria-busy="true" on the table; the result swaps in at once on arrival. No dimming, no spinner.
• Error: Results did not load. Your 3 filters are still applied. and a ghost Try again.
• Stale universe: the Koyfin pattern in COMPANY_OVERVIEW_SPEC §1.9, with the as-at date in the count block.
• Re-evaluation (Koyfin): a screen opened later re-runs with current data; if the count changed since the user last saw it, line 2 adds Changed since you last ran this screen: +12, −3.
5.11 Export
• A ghost button Download CSV exports all matched rows (not just the page), the columns of the current set plus filter columns, and for each metric its basis and as-at date. Not reported exports blank, not applicable exports n/a. Excluded companies export from the excluded drawer.
• Koyfin discloses that its vendor restricts exporting financials. If any Marginalia source restricts export, the button states which columns are left out before the download starts (D12).
5.12 Phone (390)
• Filter chips scroll in one row. Toolbar stacks. Company column 148, numeric 104, row 52, header 80, pagination bar 48 with 44px buttons. Filter sheet and excluded drawer become bottom sheets.
• Visible numeric width 194 (one full column plus 90px), so the clipped column signals scrolling.
6. Motion and reduced motion
Only transform, opacity and (chart reveal only) clip-path animate, plus color, border-color, background-color and outline-color on hover and press. transition: all is banned. Every duration and easing is a --m-* token; no literals. Numbers and rows never animate.
6.1 What moves
• Evidence sheet open: translateX(100%) to 0 (phone translateY(100%) to 0), --m-dur-slow (280ms), --m-ease-enter. Close: 200ms, --m-ease-exit.
• Scrim: opacity, --m-dur-mod (240ms) in; 168ms out (70%).
• Row hover: background-color, --m-dur-fast (110ms), --m-ease-standard. Cell hover outline: outline-color, 110ms. Header date line on column hover: color, 110ms. Pointer devices only.
• Press on segmented-control segments, chips and ghost buttons: background-color, --m-dur-press (70ms).
• Sort arrow on hover or focus (unsorted columns): opacity 110ms. The arrow on the sorted column appears instantly with the sort.
• Focus ring and selected-cell border: 0ms.
• Excluded drawer and filter sheet: the same timings as the evidence sheet.
• Disclose rows outside tables (excluded drawer groups, Why-style rows): height and opacity 200ms in, 140ms out, chevron 0 to 90 degrees.
• Page transition into the Financials tab or the screener: main content region only, opacity and translateY(8px) to 0, 280ms in, 120ms out. Tab switches inside a company (Overview to Financials) and statement, period, range or order switches inside the Financials tab are an instant swap.
6.2 What never moves
• Any value: no tween, no rolling digits, no flash on update, no count-up (the screener's match count included).
• Rows and columns: no entering, leaving, reordering, sliding or highlighting on sort, filter, page, range, period, statement or column-set change. Tables render complete.
• The sticky header and label column: no shadow, no fade, no transform when they stick.
• Programmatic scrolling (selected cell into view, scroll to latest, page change): behavior: auto, never smooth.
• No skeleton shimmer, no spinner, no looping animation, no tooltip that follows the pointer, no stagger.
• The "more lines" reveal does not exist (1.5); Disclose's height animation is never used inside a table.
6.3 Reduced motion
Under prefers-reduced-motion: reduce and the Settings override data-motion=reduced:
• Sheet and drawer travel goes to 0; each appears with a 110ms opacity fade (close 77ms). Scrim 110ms.
• Colour and background transitions snap (0ms). The sort-arrow fade (opacity, 110ms) stays.
• Disclose snaps; the chevron rotates instantly.
• Page transition becomes opacity only, 110ms.
• Smooth scrolling off. JavaScript that scrolls or moves anything subscribes to the media query's change event.
6.4 Phone and low-end (under 640px or any low-end signal)
• No hover transitions (no hover on touch). No blur: the scrim is a flat 0.72, the header at 98% page.
• At most 2 elements animate at once: the sheet and its scrim. Script per frame at most 8ms.
• No animation runs while a table scrolls.
• Page transition is opacity only, 120ms.
7. Conflicts in the current screenshots
Severity as in VISUAL_SYSTEM: H breaks a stated rule or hurts data trust; M inconsistency; L polish. Finding IDs F1–F14 belong to the Financials screenshot and E1–E9 to the evidence screenshot. Where sections 0–4 write "F1" or "E1" without a finding number, they mean the screenshots.
7.1 High
• F1 Operating margin, TTM column: 260.0%. 197,579 ÷ 302,969 = 65.2%, and StockAnalysis shows 65.21%. The five fiscal-year margins are correct (37.3%, 15.7%, 54.1%, 62.4%, 60.4%). 197,579 ÷ 2.600 = 75,992, about a quarter of TTM revenue, so the denominator looks wrong. A margin above 100% on positive revenue is impossible here. Fix the TTM denominator and add test DAT-3. H
• E1 Filing date and filing ID read not recorded by the feed, yet the sheet offers Open the filing and the product claim is that every number links to its filing. Without an accession number the link cannot open a specific filing. Fix: store the accession number and filing date (D9); until then the fallback in 4.4, block 6. H
7.2 Medium
• F2 Three oxblood-washed controls (Income statement, Annual, All (5)) plus the Financials tab. The wash budget is 3 per viewport; the table spends all of it before the global header's Search or any primary. Selected becomes panel ground and a 1px accent border (1.1). M
• F3 The controls are separate outlined buttons about 8px apart, about 36 high, not segmented controls (finding 12). Fix: 1.1. M
• F4 Label column is 508px wide (x 114→622), so a short label such as Revenue sits about 600px from its first value (finding 18). Fix: 320px label column, sticky (1.2). M
• F5 No hierarchy. Gross profit, Operating income, Pre-tax income and Net income share weight and indent with plain lines, and Operating margin (a ratio, with ⓘ) is styled like a money row. Fix: subtotal, total and memo rows (1.4; finding 2). M
• F7 Oldest first shows no state: the reader cannot tell whether it is on. Fix: a two-segment control (1.1). M
• F8 + 6 more lines is an outlined button with a plus sign, not a Disclose row with a left chevron (finding 13), and it hides lines behind a click in a table that must render complete. Fix: show every line (1.5). M
• F9 Table header is 111px tall (y 286→397) for three lines. With the 64px global header, 175px (19% of a 900px viewport) would stay fixed if the header were sticky. Fix: 64, 88 or 116 by chip rows (1.3). M
• F13 Dead controls. 5Y and All (5) show the same five periods, and 10Y is selectable with only five held. Fix: range rule in 1.1. M
• E2 Drawer is about 516–531px wide (x 1386→ viewport edge; the viewport includes a scrollbar of about 15px), against the 480px drawer in VISUAL_SYSTEM §4. M
• E3 Fact values are right-aligned, so not known — one capture held, so no earlier version to compare becomes a ragged-left block and the label and value sit far apart. Fix: 128px label column, left-aligned values (4.4). M
• E4 Which one this company used is not recorded in the data we hold weakens the line above it ("each figure is a tagged fact in the filing"). Fix: store the XBRL element (D9); until then the Concept: Not recorded row (4.4). M
• E5 Form reads Annual report (10-K / 20-F), as tagged in XBRL: it lists the possible forms, not the filing's actual form. For NVIDIA it is a 10-K. M
• E6 The figure $11,618 has no unit. The unit appears only in the list ($, milli…, cropped by the starburst). Fix: 11,618 USD million (4.3). M
• E7 The header clock (23:13:09 IST | 17:43:09 UTC, seconds and a live dot; finding 6) stays bright above a scrim that dims everything else. Fix: the scrim covers the header; the clock goes (4.1). M
7.3 Low
• F6 $ in all 36 money cells. The unit is already stated above the table. Fix: no symbol on money rows (1.4). L
• F10 12M chip on all five annual columns repeats the control and teaches the reader to ignore chips. Show duration only when it differs (1.3). L
• F11 The TTM column is 256px wide, the others 183px. Same width for all (1.2). L
• F12 Tap any number for the evidence behind it is shown on desktop where users click, and nothing in the cells signals that they open. Fix: Select any number for the filing behind it, pointer cursor and row hover (1.7, 3.1). L
• F14 TTM net income 192,879 against 192,880 on StockAnalysis. One unit of rounding: sum unrounded quarters, or state sum of reported quarters in the TTM period sheet. L
• E8 The Reported tag and a State: Reported row say the same thing. Drop the row. L
• E9 Currency: USD repeats the unit $, millions. Merge into Unit: USD millions. L
7.4 Already right: do not change
• Date format 30 Jan 2022 is consistent in all six headers (the Overview page mixes four; this table does not).
• Every cell in a column shares one right edge, with no 9,439.0 rows (finding 1 is fixed in F1).
• Rows are 52px (above the 40px minimum), hairlines run to the container edges, and the TTM column is set apart by a rule and a basis chip.
• E1 says not known — one capture held, so no earlier version to compare instead of pretending there was no restatement: keep the honesty.
• A blurred page behind the drawer is permitted on desktop (VISUAL_SYSTEM §2).
• Arithmetic I checked: gross profit = revenue − cost of sales in all six columns (for example 215,938 − 62,475 = 153,463), and the five fiscal-year operating margins recompute.
• FY23 operating income 4,224 agrees with the filing; StockAnalysis's 5,577 excludes a restructuring charge. A reader who compares sources will see this difference, which is why the sheet must say which figure the filing reports.
7.5 Not verifiable from these screenshots
Whether the header and label column are sticky; hover, selected and focus states; whether cells are keyboard-focusable; the phone layout; what Half-year shows; whether numbers use tabular figures (they look tabular); the tab row's selected style (a red box and underline appear on Financials; the spec is a 2px underline only).
8. Developer checklist
Test at 1440 and 390, Chrome and Safari, with the NVDA fixture (annual FY22–FY26 plus TTM to 26 Jul 2026) unless stated.
8.1 Layout
• LAY-1 Container content width 1344 at 1440 and 342 at 390; panel gap 24 (phone 16).
• LAY-2 Controls panel is 128 high at 1440 and 180 at 390; each control is one segmented control, 32 high (44 phone); selected = panel ground, 1px accent border, ink, 600; no wash.
• LAY-3 Range control: with 5 annual periods held it is replaced by 5 years held; with 8 held it shows 5Y and All (8); with 12 held it shows 5Y, 10Y, All (12).
• LAY-4 Label column is 320 wide (min 240) and sticky; data columns are clamp(104, (1344 − 320) ÷ n, 176): 170.67 at n = 6; 104 at n = 11 (table 1464, scrolls).
• LAY-5 All data columns, TTM included, have the same width.
• LAY-6 Header and cell text share one right edge to within 1px; suffix glyphs (%, ×, †, ‡) hang so the last digit of every row aligns.
• LAY-7 Body row 40 (phone 52); group row 32 (phone 36); no row height varies with content.
• LAY-8 Header is 64 with no chip, 88 with one chip row, 116 with two; it is position: sticky inside the table container and opaque.
• LAY-9 The label column and header stay in place while scrolling both ways; no cell shows through a sticky cell on hover.
• LAY-10 At 1440 the income statement (18 rows) fits without vertical scrolling at a 900px-high viewport; the container never exceeds 100dvh − 80px.
• LAY-11 On mount the newest column is visible without user scrolling, via an instant scroll.
• LAY-12 At 390 the label column is 148 and data columns 104; one full column and 90px of the next are visible.
• LAY-13 Every display label is at most 32 characters and fits two lines at 148px.
• LAY-14 Money rows show no currency symbol; per-share rows $4.90; ratio rows 1 dp with %; multiples 1 dp with × (U+00D7).
• LAY-15 Subtotal rows are 600 with a 1px line-control rule above; total rows add a 3px double rule below; labels on plain lines are 400.
• LAY-16 + 6 more lines does not exist; all line-set rows render.
8.2 Value states
• STA-1 Reported: ink, tappable, name ends reported.
• STA-2 Reported zero prints 0 (per share 0.00, ratio 0.0%), never —.
• STA-3 Not reported prints — (U+2014) in quiet, tappable, sheet says This does not mean the figure is zero.
• STA-4 Not applicable prints n/a, with a stored reason shown in the sheet.
• STA-5 Derived cells in a non-derived column and row carry a hanging †; cells in a TTM or derived column, and memo rows with a formula ⓘ, carry none.
• STA-6 Restated cells carry a hanging ‡; a derived restated cell shows †‡.
• STA-7 A non-zero value that rounds to zero prints <1 or −<1.
• STA-8 Negative numbers use U+2212; no hyphen-minus and no parentheses.
• STA-9 Copying a cell yields digits only; a not-reported cell copies blank; n/a copies n/a.
• STA-10 A subtotal with a — input is marked derived and its sheet lists the missing input.
• STA-11 Header chips: TTM (4 quarters) on the TTM column (TTM · 4Q at 390); derived on Q4, half-year and quarterly cash-flow columns; restated only when two captures differ; duration chip only when different from the view's standard.
8.3 Interaction
• INT-1 Row hover changes panel to overlay in 110ms on pointer devices only; the hovered cell gets a 1px quiet 40% outline; no lift, scale or shadow.
• INT-2 Selected cell has a 1px accent border via a pseudo-element, applied at 0ms; its row label is 600 ink; its column header's date line is ink with a 1px accent bottom rule.
• INT-3 One tab stop for the grid; arrows move one cell and stop at edges; Home, End, Ctrl+Home, Ctrl+End, Page Up and Page Down behave as in 3.3.
• INT-4 Enter or Space opens evidence on a number, the definition popover on a label with ⓘ, the period sheet on a header chip.
• INT-5 Esc closes the sheet or popover and focus returns to the originating cell.
• INT-6 Focus ring is 2px ink, offset 2px, and is not clipped at any edge cell and not covered by the sticky header or label column.
• INT-7 Cell accessible names follow {value} million dollars, {line}, {period}, {state}.
• INT-8 Shift+Arrow selects a rectangle; Ctrl/⌘+C copies tab-separated digits (D6).
• INT-9 On touch every number target is at least 104 × 52; a tap opens the bottom sheet; no hover state appears.
8.4 Evidence sheet
• EVD-1 Desktop drawer is 480 wide, full height, overlay ground, 1px line left edge; phone sheet is full width, max-height: 85dvh.
• EVD-2 Scrim rgba(11,11,13,0.72) covers the whole viewport including the header; desktop blur 6px, phone flat; only one blurred layer exists while open.
• EVD-3 Open 280ms --m-ease-enter; close 200ms --m-ease-exit; scrim 240ms in, 168ms out.
• EVD-4 Focus moves to the title on open, is trapped, and returns on close; Esc, close button, scrim tap and Back all close it.
• EVD-5 Opening pushes a history entry; ?evidence=… opens the sheet on load with no travel.
• EVD-6 Block order is header, figure row, facts, restatement, how built, where it came from, actions.
• EVD-7 Figure row prints the unit (11,618 USD million) and one state tag.
• EVD-8 Facts are a 128px / 1fr grid with left-aligned values; there is no State row and no separate Currency row.
• EVD-9 Missing concept, filing date or accession number prints Not recorded, never a blank or an internal phrase.
• EVD-10 Form prints the actual form (10-K, annual report).
• EVD-11 With an accession number the link reads Open the filing ↗ and opens that filing; without one it reads Find this filing on EDGAR ↗ with the explanation line.
• EVD-12 Derived sheets list each input as a tappable row; Back returns to the parent.
• EVD-13 The stepper moves the selected cell instantly, visits — and n/a cells, skips group rows, disables at edges, and works with Alt+arrows.
• EVD-14 Stepping, nested navigation and content swaps do not animate.
• EVD-15 The accent-text words in the sheet are limited to the filing link.
8.5 Screener
• SCR-1 Count block reads {matches} of {universe} companies match; line 2 shows each exclusion clause only when above zero, or No company was excluded.
• SCR-2 Invariant: matches + non-matches + excluded (missing) + excluded (not applicable) = universe, for every filter combination in the test set.
• SCR-3 See which opens the excluded drawer with the two groups and per-company reasons; counts equal line 2.
• SCR-4 Chips: applied chips show words and a 24×24 (44 coarse) remove button; suggested chips appear only with no filter; Clear all appears only with at least one filter.
• SCR-5 Filter sheet shows universe min and max under each box; a blank bound is open; the primary button shows the live count.
• SCR-6 Column sets have at most 8 numeric columns; each header names its basis; filter columns are added after Company.
• SCR-7 Sort: first press largest first (Company A to Z); second reverses; third restores market cap descending; aria-sort is set; only the sorted column shows an arrow.
• SCR-8 — and n/a sort last in both directions; ties break by market cap then ticker.
• SCR-9 Sorting, paging and filtering swap content instantly with no animation; focus stays on the header button.
• SCR-10 Pagination: 50 per page (phone 25), Page 1 of 25 for 1,204 rows; a page change scrolls to top instantly and focuses the first data cell.
• SCR-11 The URL encodes set, filters, sort and page; reloading it reproduces the screen.
• SCR-12 Row 48 (phone 52), header 80, toolbar and pagination 48; Company column 280 (phone 148).
• SCR-13 Tapping a number opens the same evidence sheet with the company in the title.
• SCR-14 CSV exports all matched rows with basis and as-at columns; blank for not reported, n/a for not applicable.
8.6 Motion, accessibility, budgets
• MOT-1 No animation of any property outside transform, opacity and the allowed colour properties; no transition: all; no duration or easing literal outside --m-*.
• MOT-2 No value or row animates on sort, filter, page, range, period or statement change.
• MOT-3 Reduced-motion pass at 360 and 1440: sheet fades in 110ms with no travel; colour transitions snap; no smooth scrolling.
• MOT-4 Under 640px: no blur, no hover transitions, at most 2 elements animating, none while the table scrolls.
• A11Y-1 Every pointer target is at least 24×24 (44×44 coarse): numbers, chips, ⓘ, remove buttons, sort headers, stepper segments.
• A11Y-2 All text at least 13px; contrast for quiet on panel, overlay and hovered rows is at least 4.5:1 (computed about 4.8, 4.6 and 4.6).
• A11Y-3 The page reflows at 320px and at 200% text zoom with scroll confined to the table container.
• A11Y-4 The grid is operable with keyboard alone, including opening, stepping and closing the sheet.
• A11Y-5 Colour carries no meaning alone: states use glyphs or words; the selected state uses a border and weight.
• BUD-1 At most 3 oxblood fills or washes and 5 accent-text words in a 1440×900 viewport: the Financials tab spends none at rest; the screener spends one (the filter sheet's primary) only while that sheet is open.
8.7 Data integrity (run on every company in the fixture set)
• DAT-1 Gross profit = revenue − cost of sales, to the displayed precision, in every column.
• DAT-2 Total assets = total liabilities + equity; net change in cash = operations + investing + financing + currency effect (within 1 unit of display rounding).
• DAT-3 Margin rows recompute from their displayed inputs for every column, TTM included; any margin above 100% or below −100% with positive revenue fails the build (the F1 bug).
• DAT-4 A TTM column equals the sum of its four quarters (within 1 unit), and its sheet lists the four quarters.
• DAT-5 Q4 = full year − nine months, and the Q4 column carries derived.
• DAT-6 Every number resolves to either an accession number and filing date or an explicit Not recorded; the count of Not recorded per company is reported.
• DAT-7 The five fiscal-year values for revenue, gross profit and net income match the filings; spot-check against StockAnalysis (agrees for NVDA on 1 Nov 2026).
9. Decisions I need from you
• D1 Evidence sheet on desktop: I specified the modal drawer VISUAL_SYSTEM §4 requires, plus a stepper so analysts need not close it per number. If you prefer a non-modal side panel (no scrim, no focus trap, table stays live), it needs a change to §4 and a way to keep the selected cell out from under it.
• D2 Row height: I specified 40px on desktop (Carbon's default, the VISUAL_SYSTEM minimum) and 52px on phone. F1 uses 52px everywhere. Confirm the denser desktop table.
• D3 Removing + 6 more lines makes the income statement 18 rows. Confirm that page length is acceptable.
• D4 The markers † (derived), ‡ (restated) and the words n/a and —. Confirm, or name alternatives; the rule that whole derived columns and rows carry no per-cell marker is what keeps TTM clean.
• D5 Sticky offset inside the table container is 0 because the container scrolls itself; if you want the header sticky against the page instead, the offset becomes 64px (48px if the condensed bar replaces the header). Confirm.
• D6 Range selection and copy as tab-separated values (3.5).
• D7 Screener paginates (50 per page) instead of virtual scrolling. Pagination keeps copy, find and screen readers simple; virtualisation is the alternative.
• D8 Exclusion wording: figure missing and not applicable as two clauses rather than one number.
• D9 The data feed does not record XBRL element, accession number or filing date (E1, E4). They are needed for the filing link and the concept row. Needs the data owner.
• D10 Default order is oldest first on desktop (as F1) with the newest column scrolled into view on load. Confirm, or default phone to newest first.
• D11 Line sets and display labels (1.5) are my proposal for NVDA and need the data team to map each statement's lines.
• D12 Which columns may be exported under the data licences (Koyfin restricts financials; Marginalia's sources are not in the upload).
• D13 DESIGN.md was not uploaded; sizes 20, 28 and 40 (reused from COMPANY_OVERVIEW_SPEC) still need mapping onto its four steps.