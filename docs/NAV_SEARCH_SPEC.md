# NAV_SEARCH_SPEC — decisions (1 November 2026)
1. Accepted as written, with these notes:
2. The yellow starburst is a browser extension, not the site: ignore finding 4.
3. "Coming" items and their dates come from the feature register (LANDING_SPEC 2.4), which follows the Idea Book build order; the quarter dates quoted in this spec are the old live-page dates and are not to be hard-coded.
4. Menu sections keep the names and order from the Idea Book platform structure (Companies, Research, Markets, Invest, Tools, Learn, Deals). A section with no shipped destination is hidden, as the spec says. The "Invest" name stays; its contents follow the facts-only rule.
5. Loading-screen stage names and the "Usually about n seconds" line use the engine's real stages and real build-time records; the developer reports them before shipping.
6. Built in build step 9 (screen-by-screen polish), after VISUAL_SYSTEM and the landing page (step 8).
7. (Nihar, 4 November 2026) The menu shows Companies and Learn only while the other sections have no shipped destination: APPROVED. A section appears when it has one.
8. (Nihar, 4 November 2026) The loading screen names the two stages this wait really has (reading the filings, checking the filed statements), not five: APPROVED.

NAV_SEARCH_SPEC
Marginalia · global header, main menu, search (⌘K) and loading screen · v1.0 · 31 October 2026 · obeys VISUAL_SYSTEM v1.0 and the decisions at its top (ⓘ stays; dark is the only instrument theme).
0. Basis and limits
• Screens seen: three: the landing header with the particle wordmark, the ‘Value any listed company’ search screen, and the loading card (‘Common myth’, step 5/5). I have not seen the company-screen header after scrolling, any menu, any palette, or any phone view, so those are specified from scratch. Measurements are read off screenshots (±2px); confirm with computed styles.
• Uploaded VISUAL_SYSTEM.md matches the version I wrote; its decisions are applied. Where this spec changes DESIGN.md or VISUAL_SYSTEM it says CHANGE; new tokens say ADD. [CONFIRM] marks something I cannot verify.
• Product facts used: the sections you listed (Companies, Research, Markets, Invest, Tools, Learn, Deals); the company tabs seen earlier (Overview, Financials, Filings, Model, Research, Ownership, Deals, Credit, Your notes); the roadmap (private company inputs Q1 2027, things to check in a filing Q2 2027, one-page desk summary Q3 2027, leveraged buyout model Q4 2027, workbook reformatting Q1 2028); the feature register from LANDING_SPEC section 2.4.
1. Five references
I opened all five, but as text: the tool returns page text, not visuals or motion, so judge look and feel in a browser. Stripe was not opened for this task, so it is not used.
1. Vercel Geist: Command Menu, Skeleton, Spinner · https://vercel.com/geist/command-menu · https://vercel.com/design/skeleton · https://vercel.com/geist/spinner · Take: bind ⌘K and Ctrl+K and never reuse it for an in-page filter; a placeholder that names its scope and ends with …; show recent items when the input is empty; trap focus and return it on close; an aria-live=polite result count; skeletons sized to the final content so nothing shifts. Do not take the spinner: your system forbids looping animation on product screens.
2. Linear: Navigating Linear · https://linear.app/enablement/guide/navigating-linear · Take: one overlay for commands and jumping to pages (⌘K), and a separate quick key (/) for searching content, including by ID. Marginalia copies the second idea: / is a second way to open company search.
3. Raycast: Search Bar manual · https://manual.raycast.com/search-bar · Take: a written ranking order (exact alias, prefix, fuzzy title match, keyword match, then how recently and often you used it); items shown before you type; ↑ and ↓ at the ends of the list cycling through search history; a way to reset learned ranking.
4. GitHub: Command palette docs · https://docs.github.com/en/get-started/accessibility/github-command-palette · Take: the shortcut can conflict with browser and OS shortcuts, so offer an alternative; ⌘K or Esc closes it; ⌘Backspace clears the query; prefix characters narrow what is searched.
5. Koyfin: Getting started and release 3.11 · https://www.koyfin.com/help/getting-started-with-koyfin/amp/ · https://www.koyfin.com/help/release-notes/release-v3-11/ · Take: a command bar at the top for jumping to securities, and a security search filterable by country, sector, exchange and trading currency. This is the closest peer for multi-country search.
Supporting source for the loading screen: Jakob Nielsen, Progress Indicators Ease the Wait, https://www.uxtigers.com/post/progress-indicators (show nothing for the first second; once an indicator appears, keep it up for at least half a second; use a percent-done bar with an honest estimate for waits of 10 seconds to a minute).
2. Global header
One header on every screen. It replaces the three different headers seen today (landing: four red links and Search; search screen: Home only; company screens: Check the figures, Search, Home, All companies).
2.1 Desktop, 1440px (and any width from 1100px up)
Property
Value
Height
64px, position: fixed, full width. Content is the 1344px container (48px gutters).
Ground
page at 95% with backdrop-filter: blur(8px); 1px line hairline on the bottom edge. Page content starts at padding-top: 64px.
Order, left to right
1 Skip link (visible on focus only). 2 Wordmark. 3 Seven nav triggers. 4 Flexible space. 5 Search trigger. Nothing else: no clock, no live dot, no Home, no All companies, no Check the figures.
Skip link
‘Skip to content’, 36px high, 13px, at x=48 y=14, 2px ink focus ring.
Wordmark
112×28px, link to /, aria-label=Marginalia home, closing Mark kept. x=48→160.
Nav
Starts at x=200. Seven buttons in the order Companies, Research, Markets, Invest, Tools, Learn, Deals. Each is 40px high, 12px side padding, 13px weight 500, 4px gap; total about 480px (x=200→680).
Search trigger
A ghost button 320×36px, right edge at x=1392. A 16px search icon (muted), the label ‘Search companies…’ (13px muted), and a key hint ⌘K (13px quiet in a 1px line box 28×20px). On Windows and Linux the hint reads Ctrl K. The hint is hidden under (pointer: coarse). Hover: border accent, label ink.
Vertical alignment
Every item centred on y=32.
Nav item states
State
Treatment
Rest
muted (#A8A29A, 7.77:1), weight 500
Hover
Ink; 110ms colour change
Pressed
Ink; no scale
Keyboard focus
2px ink outline, 2px offset
Open (aria-expanded=true)
Ink, weight 600
Current section (the route is inside it)
CHANGE: the system’s one selected state (panel ground, 1px accent border, ink, weight 600). VISUAL_SYSTEM section 3.1 says primary-nav current items use it; the 2px underline stays for the company tab row only.
At most one nav item is current, so the header adds at most one oxblood border to a viewport.
2.2 Condensed state
• Trigger: scrolling down past 80px scroll offset shows the 48px bar; scrolling back up to 40px or less restores the 64px header (a 40px dead band prevents flicker).
• Mechanism: two elements, not a height animation. The full header slides translateY(0→-64px) in 200ms (--m-ease-exit); the 48px bar slides translateY(-48px→0) in 280ms (--m-ease-enter). Page padding-top stays 64px, so nothing shifts.
• Contents of the 48px bar: the 24px Mark only, the Search icon button (36×36px), the Menu button (36×36px, opens the menu sheet below).
2.3 Company screens, condensed context strip
Where DESIGN.md already specifies a condensed bar for a company, it keeps: ticker, company name, price and implied value. Changes: the ticker is ink weight 600, CHANGE (DESIGN.md sets it in accent-text, which the accent budget no longer allows); figures are Source Sans 3 tabular, not mono; it never animates a number.
2.4 Narrower than 1100px
Width
Header
640–1099px
64px. Wordmark; Search icon button 44×44px; Menu button 44×44px. The menu opens as a right drawer 480px wide.
≤ 639px (390px reference)
64px. Wordmark 96×24px at x=24; Search icon button 44×44px at x=246→290; Menu button 44×44px at x=322→366 (8px gap, 24px right gutter). Top padding env(safe-area-inset-top). Backdrop blur off, page at 98%.
Phone menu sheet. A bottom sheet whose top edge sits at y=64px (the header stays visible and the Menu button becomes Close, aria-expanded). Seven accordion rows of 56px, each opening to link rows of 48px; chevron on the left, 12px, rotating 90° in 200ms (the Disclose pattern). A footer row of 56px holds the ‘Reduce motion’ switch. Scrim rgba(11,11,13,0.72), no blur. Esc and the Close button dismiss; focus returns to the Menu button.
3. Menu structure
Rules
• The seven names and their order are fixed: Companies, Research, Markets, Invest, Tools, Learn, Deals.
• A top-level section shows only if it has at least one shipped destination. A destination that is in build or planned appears only in a final text group ‘Coming’ inside its section, with its status and no link (the register rule from LANDING_SPEC 2.4); the group ends with a link ‘See the roadmap →’ to #roadmap.
• Each destination appears once in the whole menu.
• A panel holds at most 8 links in at most 2 groups.
• Company-level destinations (Financials, Filings, Model and so on) open the current company when one is in context. With none in context they open company search titled ‘Choose a company for Financials’.
• Panel (desktop): opens on click, Enter, Space or ↓, never on hover. overlay ground, 1px line, 0 radius, no shadow, 480px wide (two 224px columns, 32px gap), 16px padding, top edge at y=64px aligned under its trigger. Group label 13px quiet; link rows 36px, Body 15, read, ink on hover. Only one panel is open; moving between triggers swaps the panel with no delay.
Section
Contents (proposed from what is visible)
Status
Companies
Search a company (⌘K) · All companies · Overview · Financials · Filings · Model · Ownership · Credit. Coming: Value a private company (Q1 2027).
Shipped except the last [CONFIRM]
Research
The company Research tab · Your notes. Coming: Things to check in a filing (Q2 2027).
Shipped except the last [CONFIRM]
Markets
Browse by exchange (NYSE, NASDAQ, NSE, BSE, LSE, TSX) · Browse by country.
[CONFIRM]: does browse exist? If not, the section is hidden.
Invest
Not defined. Rule for whatever goes here: measurements only, no ratings, no buy or sell wording, no brokerage links.
[CONFIRM]: owner to define; hidden until then. The name itself may imply advice.
Tools
Download Excel model · Spread against peers · Your template · Saved models. Coming: One-page desk summary (Q3 2027); Workbook reformatting (Q1 2028); Leveraged buyout model (Q4 2027).
Shipped except the last three [CONFIRM]
Learn
Margin notes (‘All {n} notes’) · How it works · Coverage and sources · What is being built next.
Shipped
Deals
The company Deals tab.
[CONFIRM]
4. Search
4.1 Ways in
Entry
Behaviour
⌘K (Mac) or Ctrl+K
Opens the palette from any screen, except while focus is in a text field the page owns. The shortcut is never reused for a page filter.
/
Same palette. Ignored while typing in an input, textarea or editable region. This is the fallback where the browser or OS takes Ctrl+K.
Header trigger
Click or Enter.
Phone
Search icon button in the header.
Search screen (/search)
⌘K and / focus the page’s own field instead of opening a modal, and the header trigger is hidden there, so there is never a second search on screen.
4.2 The palette
Property
Desktop (≥ 640px)
Phone (≤ 639px)
Container
Modal, 640px wide, centred, top at max(64px, 12vh) (108px at 900px high), max height min(560px, 100svh - 2×top). overlay ground, 1px line, 0 radius, no shadow. Scrim rgba(11,11,13,0.72) with blur(6px).
Full-screen sheet at 100svh, overlay, no blur. Top padding env(safe-area-inset-top).
Input row
56px high. 16px search icon at x=16. Input text 16px ADD (an input step of 16px, since iOS Safari zooms fields smaller than 16px). Placeholder ‘Search companies by name or ticker…’ in quiet. Right: ‘Esc’ key hint, 13px quiet.
56px high; a 44×44 ‘Cancel’ text button (15px muted) replaces the Esc hint.
Divider
1px line under the input row
same
Result row
44px high, 16px side padding. Columns: name (flexible, about 316px, ellipsis), ticker 112px, exchange 96px, country 48px, 12px gaps.
56px, two lines: name (15px) over ‘TICKER · Exchange · Country’ (13px quiet).
Group label
32px, 13px quiet, ‘Recent’, ‘Companies’, ‘Go to’
same
Footer hint bar
40px, 13px quiet: ↑↓ Navigate · ↵ Open · ⌘↵ New tab · Esc Close. Hidden under (pointer: coarse).
none
Rows shown
8 without scrolling (352px); list scrolls inside the dialog
fills the area above the keyboard (sized from visualViewport)
Result row fields (the four you asked for):
• Name: Body 15, ink, weight 500. Matched characters are weight 600 and ink; the rest is read. Legal suffixes (Inc, Ltd, plc, AG and so on) stay in the display name.
• Ticker: tabular, 13px, muted, never truncated. Allows digits, dots and non-Latin scripts (7203.T, RELIANCE.NS).
• Exchange: 13px quiet, the short label already used on screens (NasdaqGS, NSE, BSE, LSE, TSX).
• Country: ISO 3166 alpha-2 code, 13px quiet; the full country name sits in the second line on phone and in the row’s accessible name. No flag emoji.
• A name in a right-to-left script gets dir=auto.
• The same ticker on several exchanges (for example a dual listing) is shown as separate rows, one per listing, so the person picks the listing they meant, as the search screen already says.
Highlighted row (keyboard or pointer): page background, a 2px ink rule on the left edge, name weight 600. The pointer moves the highlight only on real mouse movement, never on scroll.
4.3 Matching and ranking
Case-, accent- and punctuation-insensitive (Nestlé = Nestle, AT&T = ATT); legal suffixes ignored for matching; native-script names matched alongside Latin names where the database holds both. Order of results:
1. Exact ticker match (and exact TICKER.EXCHANGE form, e.g. RELIANCE.NS).
2. Exact ISIN (pattern ^[A-Z]{2}[A-Z0-9]{9}[0-9]$). [CONFIRM]: your NVDA screenshot shows an empty ISIN field, so ship ISIN search only after the field is populated.
3. Name starts with the query.
4. A name word starts with the query.
5. Fuzzy name match: one edit allowed for queries of 5 or more characters, two for 9 or more.
6. Ticker starts with the query.
Ties break by this person’s recent opens, then by market capitalisation (largest first) [CONFIRM], then by name A→Z. No location bias: results must not depend on where the person is. One character is enough to search. Return 10, show 8 and scroll for the rest. A P2 Country filter and Exchange filter (selected-state chips) can follow, as Koyfin does.
4.4 Keyboard
Key
Action
↓ / ↑
Move highlight. ↑ on the first row returns focus to the input with the caret at the end. No wrap.
Home / End, PageUp / PageDown
First / last row; ±5 rows
↵
Open the highlighted company (and start its build)
⌘↵ / Ctrl+↵
Open in a new tab
⌘Backspace / Ctrl+Backspace
Clear the query
Delete (empty input, a Recent row highlighted)
Remove that recent search
Esc
Close; focus returns to the element that opened it
Tab / Shift+Tab
Cycle inside the dialog (focus is trapped)
Semantics: the dialog is role=dialog aria-modal=true aria-label=Search companies. The input is role=combobox with aria-expanded, aria-controls and aria-activedescendant; the list is role=listbox with role=option rows. A visually hidden aria-live=polite region announces ‘{n} results’ as the list narrows.
4.5 States
State
Content
Empty input, has recent
‘Recent’: up to 5 companies, newest first, each with a 24×24px × button (44×44 on touch) and a ‘Clear recent’ ghost button at the group’s right. Stored on the device only (up to 10, try/catch, memory fallback).
Empty input, no recent
‘Try’: Apple, Reliance, Nvidia, Tata Motors (the current placeholder’s four names), 4 rows.
Typing
Previous results stay on screen until new ones arrive. Rows never animate. A ‘Go to’ group of at most 2 rows appears only when the query matches a section name exactly or by prefix of 3 or more characters.
Slow (no response by 1,000ms)
A 24px status row reserved at the foot of the list (no layout shift) reads ‘Still searching…’ in 13px quiet; it stays at least 500ms. No spinner.
No results
15px ink: ‘No company matches “{query}”.’ 13px quiet: ‘Try the ticker, a shorter name, or the exchange form such as RELIANCE.NS. All countries and exchanges were searched.’ If fuzzy matches exist, a ‘Closest matches’ group of up to 3 rows. A ghost button ‘Ask us to add it’ opens the feedback form with the query prefilled. No dead ends.
Error or offline
‘Search is unavailable.’ with a ghost ‘Try again’ button; role=alert; the typed query is kept.
Selected
Row shows the busy style (below, section 5) and the palette closes when the route starts.
4.6 Speed targets
Measure
Target
⌘K to input focused and painted
≤ 100ms (p95); the dialog chunk is prefetched when the trigger is focused, on first pointer approach, or after 2s of idle
Keystroke to results painted
p50 ≤ 80ms, p95 ≤ 200ms on desktop; p95 ≤ 400ms on a throttled Fast 4G phone profile
Typing latency
Input is never blocked; no main-thread task over 50ms
Requests
One per input event, coalesced to at most 1 per 50ms; at most 1 in flight; older responses are aborted and can never overwrite newer ones; cache by prefix
Instant start
The 200 largest listings ship with the dialog chunk (≤ 20KB gzip) so common names answer with no network call
Response size
≤ 10 results, ≤ 2KB gzip
Selection to route start
≤ 100ms
4.7 The search screen (/search, ‘Value any listed company’)
Same engine, same row component, rendered as a combobox under an inline field instead of a modal. Keep: the Title, the placeholder, the line about SEC EDGAR, exchange disclosures and banks, insurers and lenders being shown without a DCF. The ‘Build model’ button is the screen’s one primary (oxblood wash, 40% opacity until a listing is chosen). The input has an aria-label (‘Company name or ticker’).
5. Loading screen
The loading overlay appears after a company is chosen and its model needs building. It keeps the existing logic: no card in the first second, then the belief, then the correction. It never speaks about ‘this company’, per the Common Myth rule.
5.1 Layout
Element
Desktop (modal)
Phone
Surface
overlay (CHANGE: the current card uses panel), 1px line, 0 radius, no shadow, 720px wide, centred; about 460px high (content-driven; the card area is fixed). Scrim rgba(11,11,13,0.72) with blur(6px).
Full-screen overlay, 100svh, no blur, padding 24px (top max(24px, env(safe-area-inset-top) + 16px))
Padding
40px
24px
Row A (y 40–60)
‘Building the model’ (13px muted, weight 500) left; ‘Step n of 5’ (13px muted, tabular) right
same
Progress rule (y 72)
1px line track across 640px; a 2px ink fill. Fill is transform: scaleX(completed stages ÷ 5), origin left.
same, 342px
Stage name (y 88–108)
13px muted, the current stage
same
Card area (y 128–360)
Fixed height 232px, so nothing moves when text arrives
Fixed 264px
— label
‘Common myth’, 13px quiet
same
— belief
CHANGE: Section step (Newsreader 600, 20px/1.2) in muted, in curly quotes, roman. The current card sets it in italic, which is a variant outside the pairing rule.
same
— correction
CHANGE: Title step (Newsreader 600, 36px at 1440, 28px on phone) in ink, up to 3 lines. The current card sets it at about 44px, above the Title cap.
same
— ⓘ
Kept, inline at the end of the correction. 24×24px hit area (44×44 on touch) by pseudo-element. Opens a tooltip on overlay, 13px sans, weight 400, with the sentence naming the condition that chose the card.
same
Divider (y 392)
1px line
same
Footer line (y 408)
‘Reading the filings, running the same engine used for every company’, 13px quiet
same
Cancel
Ghost button ‘Cancel’, 36px, bottom right, appears with the modal
44px, full width, bottom, env(safe-area-inset-bottom)
5.2 Timeline
Time
What is on screen
0ms
The trigger shows its busy style (40% opacity, label ‘Building…’, aria-busy=true, still focusable). A 2px page progress rule sits under the header (track line, fill read), empty until the first real stage event. Nothing else.
0–1,000ms
Only that rule. If the build finishes in this window the rule completes and the next screen renders: no modal, no card, no flash.
1,000ms
The modal opens (scrim fades 240ms, dialog 240ms). The rule moves into the modal. Cancel appears.
1,000ms (card gate)
The belief fades in over 200ms only if the server’s estimated remaining time is at least 3,400ms (2,200ms beat + 1,200ms to read). With no estimate, use the fallback: show it only if the build is at stage 2 or earlier. Otherwise the card area stays empty.
3,200ms (belief + 2,200ms)
The correction fades in over 200ms below the belief. Beats are scheduled once and never restarted.
Build completes before the correction
The correction shows immediately and holds 1,200ms, then the modal closes. Worst-case extra wait is 1,200ms.
Build completes after the correction
The modal holds until the correction has been visible 1,200ms, and has been up at least 500ms in total, then closes.
Close
Rule fills to 100% (instant), modal fades out in 168ms, the company screen renders and its first-load tile entrance plays.
5.3 Progress honesty
• The fill and the ‘Step n of 5’ count come only from real server stage events. Nothing creeps on a timer.
• At step 5 the fill reads 80% until the build ends. The current screenshot shows 5/5 with the fill stopping near 92%, which is neither.
• No percentage text and no elapsed-seconds counter (a ticking number is forbidden).
• ‘Usually about {n} seconds’ appears in 13px quiet only when at least 50 comparable builds exist [CONFIRM].
• At 15,000ms: ‘Taking longer than usual.’ appears, static. At 90,000ms: error.
• Stage names are [CONFIRM]; proposed: 1 Reading the filings, 2 Standardising the statements, 3 Building the three-statement model, 4 Forecasting, 5 Discounting cash flows (the one name visible today).
• Screen readers hear one aria-live=polite message per stage change, at least 1,000ms apart (‘Step 3 of 5: Building the three-statement model’). The myth card is not announced.
5.4 Error and cancel
Error replaces the card area: ‘The model could not be built for {Company}.’ in the Title step, a 15px reason line [CONFIRM list of reasons], a ghost ‘Try again’ and a ghost ‘Back’. Cancel aborts the build and returns focus to the trigger. Esc cancels as well, from 0ms.
6. Motion
Tokens only (VISUAL_SYSTEM section 4). Exit is 70% of enter.
Element
Motion
Duration · curve
Nav hover, press
Colour
110ms · standard; 70ms
Menu panel (desktop)
opacity 0→1, translateY -4px→0 / out 140ms
200ms · enter
Condensed bar
In as 2.2; full header out
280ms · enter; 200ms · exit
Menu sheet and drawer
Slide; scrim fade
280ms in / 200ms out; scrim 240ms
Accordion rows
height and opacity; chevron 0→90°
200ms / 140ms
Palette open
Scrim fade; dialog opacity 0→1 and translateY -8px→0
240ms · enter; close 168ms · exit
Highlight, list updates
None
0ms
Page progress rule
scaleX on each stage event
200ms · standard
Loading modal
As the palette
240ms in, 168ms out
Belief, correction
opacity only, no travel
200ms · enter
Busy trigger
Opacity change, instant
0ms
Reduced motion (prefers-reduced-motion or the ‘Reduce motion’ switch): all travel and transforms go to 0. Menu panel, palette, modal and sheet fade over 110ms. The condensed bar swaps with a 110ms cross-fade. The progress fill jumps with no transition. The belief and correction keep their 2,200ms beat (it is pacing, not movement) but fade over 110ms. Accordion rows snap.
Forbidden here: spinners and looping dots (including an animated ‘Searching…’), skeleton shimmer, fake-progress creep, a ticking elapsed time, hover-open menus, any animation of result rows, and any blur other than the one scrim blur.
7. Conflicts in your current screenshots
#
Screenshot
Finding
Fix
Sev
1
Header (landing, search)
A clock with seconds (23:40:41, 23:59:42, 00:03:40) and a green live dot
Remove (VISUAL_SYSTEM section 5)
H
2
Landing header
Four nav links in oxblood plus an oxblood-washed Search
Muted nav; ghost Search with a ⌘K hint
H
3
Landing vs search
Different header contents on each screen (four links; Home only)
One header, section 2
H
4
All three
The yellow starburst at the right edge. If it is ours it adds a second hue and a radius; if it is a browser extension, ignore it. I cannot tell which.
If ours: square, quiet, palette colours
H
5
Loading
At 5/5 the fill stops near 92%
Fill = completed stages ÷ 5, never ahead of the count
M
6
Loading
Correction about 44px, above the 36px Title cap; belief in italic
Title step; roman in quotes
M
7
Loading
ⓘ about 13px, a target well under 24px
Keep ⓘ; 24×24px hit area, 44×44 on touch
M
8
Search
The field’s outline looks like 1px oxblood
2px ink focus ring; resting border line-control
M
9
Search
‘Build model’ disabled reads muddy (dark red on dark red)
The enabled style at 40% opacity with the label kept legible; one primary
L
10
Search
Numbered eyebrows (‘01 · Search’, ‘02 · Built by hand’) on a tool screen
Drop numerals on tool screens
L
11
Search
Subtitle about 17px and caption about 14px, between the steps
Body 15 and Small 13 (verify computed sizes)
L
12
Loading
Surface is panel
overlay
L
13
Search
Placeholder is the only label
aria-label on the field
L
8. Checklist for the developer
Header
1. Height is 64px at 1440 and 390 (48px condensed); the page content starts at 64px.
2. Items at 1440, in order: wordmark, seven triggers, Search trigger 320×36px with its right edge at x=1392. No clock, no ‘live’ dot, no Home, no All companies, no Check the figures.
3. No nav label is oxblood. Computed colour at rest is #A8A29A; at hover #F2F0EA.
4. At most one nav item has the selected state at a time.
5. From 1100px up the header is the desktop layout; below 1100px it collapses to wordmark, Search and Menu buttons, each 44×44 on touch.
6. The condensed bar uses transform only; switching causes no layout shift (CLS 0); dead band 40px.
7. Skip link is first in Tab order and visible on focus.
Menu
8. Seven section names and their order match section 3; a section with no shipped destination is absent.
9. In-build and planned items are text with a status and no link; no destination appears twice.
10. A panel opens by click, Enter, Space or ↓; never by hover; Esc closes and returns focus.
11. A panel has at most 8 links; rows 36px; ground overlay; no shadow.
12. Phone: sheet top at y=64px; rows 56px and 48px; every target at least 44×44.
Search
13. ⌘K and Ctrl+K open the palette; / opens it except in a text field; on /search both focus the page field.
14. Focus is trapped while open and returns to the opener on close.
15. Rows show name, ticker, exchange and country; a same-ticker dual listing yields two rows.
16. Ranking tests: exact ticker above name prefix; accents and legal suffixes ignored; RELIANCE.NS resolves; AT&T finds ATT; a native-script name matches.
17. Keystroke to painted results: p50 ≤ 80ms and p95 ≤ 200ms on desktop; p95 ≤ 400ms on the throttled phone profile; stale responses never overwrite newer ones.
18. Empty state shows Recent or ‘Try’; no-results shows the message, up to 3 closest matches and ‘Ask us to add it’; error shows ‘Try again’ and keeps the query.
19. Input text is 16px; there is no iOS zoom on focus.
20. Recent searches stay on the device; ‘Clear recent’ empties them.
21. The result count is announced politely; options have accessible names that include the full country.
Loading screen
22. In the first 1,000ms only the 2px page rule shows; a build under 1,000ms never opens the modal.
23. The modal opens at 1,000ms (±50ms), stays at least 500ms, and closes in 168ms.
24. The belief never shows unless its correction can follow (estimate ≥ 3,400ms, or stage ≤ 2); the correction appears 2,200ms after the belief; the beats are never restarted.
25. The correction is visible for at least 1,200ms before close; worst-case extra wait is 1,200ms.
26. The fill equals completed stages ÷ 5 and never moves without a server event; ‘Step n of 5’ matches.
27. No spinner, no elapsed-time counter, no percentage text; ‘Taking longer than usual.’ at 15s; error at 90s.
28. Card area height is fixed (232px desktop, 264px phone); no layout shift when text appears.
29. Cancel and Esc work from 0ms; focus returns to the trigger.
30. ⓘ has a 24×24px hit area (44×44 on touch) and opens a 13px tooltip.
Motion and accessibility
31. Every duration and curve is an --m-* token; transition: all returns 0 matches.
32. With reduced motion on, no transform runs, all fades are ≤ 110ms, and the beat timings are unchanged.
33. Focus ring is 2px ink with a 2px offset everywhere; no focused element is hidden under the 64px header.
34. Text tokens clear 4.5:1 on page and overlay; the resting field border (line-control) clears 3:1.