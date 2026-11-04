# LANDING_SPEC — decisions (31 October 2026; replaces the 30 October file)
1. v1.1 keeps every existing section. Sections 02–08 still need screenshots; until then they follow the spec's unseen-section rules. Nothing is removed without Nihar's recorded decision.
2. "Free to use" is not shown until pricing is decided.
3. Every count and claim is read from the database at build; with today's ~175 companies the page shows the true count, never "10,000+".
4. "Three valuation approaches" is shown only once build step 5 has shipped.
5. Feature register (section 2.4) approved. The public roadmap rows must match the current build order in the Idea Book ("Where we are and the build order"); the old quarter dates on the live page are out of date and are replaced from the register.
6. Tagline "A Ledger That Never Lies": KEPT (Nihar, 31 October 2026). It stays as the page title, og:title and twitter:title; it is exempt from the banned-words check for "never". The hero headline and eyebrow follow section 2.1.
8. The neon yellow starburst in the screenshots is a browser extension, not part of the site: ignore finding 3.
7. Built in build step 8, together with VISUAL_SYSTEM.
9. (Nihar, 4 November 2026) The feature register's status mapping from VISION.md and its order: APPROVED. No quarter is printed until one is recorded: APPROVED.
10. (Nihar, 4 November 2026) Total Blocking Time stands in for INP in the Lighthouse check, and the largest contentful paint may be the poster or the hero headline (never the canvas): APPROVED.

LANDING_SPEC
Marginalia landing page · v1.0 · 30 October 2026 · obeys VISUAL_SYSTEM v1.0 and the decisions recorded at its top. Where the two disagree, VISUAL_SYSTEM wins.
v1.1 · 31 October 2026 · correction. v1.0 said that anything not listed was cut. That was wrong, and it is withdrawn. No section is removed. Every existing section is kept and restyled to this system, and the page order is now listed by name (section 3.2). Seven new screenshots added Coverage, Every figure has a source, The margin notes, the roadmap, the feedback form and the start of About the analyst. The sections the page labels 02–08 are still unseen: they stay, and they need screenshots before they can be specified. The new views also show the roadmap contradicting three features the page advertises as available (section 2.4).
0. Basis and limits
• Decisions applied: ⓘ stays (the landing page needs none; any explained term that does use one gets a 24×24px hit area, 44×44px on touch). Dark is the only instrument theme. Paper stays the reading ground and is used only in sections 05 and 06. The 3D and particle budgets apply in build step 8 and this page is that step.
• Screenshots: I have now seen eleven views: the hero; ‘01 · What you can do’; ‘09 · Coverage’; ‘10 · In the margin’ (Every figure has a source); ‘11 · The margin notes’; the roadmap ‘What is being built next’; the feedback form; and the start of ‘04 — About the analyst’. The page labels its sections in two styles and out of sequence (01, 09, 10, 11, 04), and sections 02–08 are unseen. Nothing is cut: unseen sections stay, are restyled to VISUAL_SYSTEM, and are specified once screenshots arrive.
• Live site: a JavaScript app, so fetching it returns metadata only.
• [CONFIRM] marks a claim or fact I cannot verify. The owner must answer before it ships.
• Product numbers shown below (NVDA) are read from your screenshots. The build script must re-read them from the database and check them against the filing.
1. Five reference pages
I opened all five, but only as text: the search tool returns page text, not visuals or motion. Open each in a browser before borrowing any visual idea. Awwwards and Vercel are not used: the earlier Awwwards listing gave me no visuals I could verify, and I did not open Vercel this time.
1. Stripe · https://stripe.com/ · The page puts a stat band under the line ‘The backbone of global commerce’, and every stat carries a unit and a year (for example $1.9T in payments volume processed in 2025). Take: each landing stat gets a unit, a definition and an ‘as of’ date. Do not take the customer testimonials; we have none to show.
2. Linear · https://linear.app/ · The headline is one noun phrase (‘The product development system for teams and agents’), and the header offers Pricing, Docs, Log in and Sign up with no clutter. Take: a headline that names the object, and a header of at most 4 text items plus one search. The restraint essay I opened earlier is at https://linear.app/now/how-we-redesigned-the-linear-ui .
3. Mercury · https://mercury.com/ · The hero offers an Explore Demo button, and a plain disclosure under the headline says what Mercury is and is not (a financial technology company, not a bank). A third-party tech listing says the site uses Three.js and Framer Motion; I could not verify that. Take: a try-it proof object, and the legal status stated at first view. We state ‘not investment advice’ in the same way.
4. Ramp · https://ramp.com/ (I read https://ramp.com/llms.txt and https://ramp.com/platform) · Both list a ‘Try Ramp’ interactive demo, plus pricing, integrations, customers and a trust centre. These pages are machine-readable summaries, so I judged structure, not layout. Take: a try-it demo as proof, and a visible trust page (ours: Coverage and sources).
5. Koyfin · https://koyfin.com/ · The headline names the audience and the deliverable (‘for advisors and investors’, ‘client-ready reports’). It is the closest peer. Take: say who it is for and what leaves the product. Do not take its large user counts as a pattern unless we have our own verified count.
2. The message
2.1 Hero copy (final text)
Element
Text
Length
Eyebrow
Source: company filings
23 chars
Headline
Filed numbers. A model you can argue with.
42 chars; the closing mark replaces a full stop
Sub-headline
Marginalia reads up to five years of a company’s own filings, builds the three-statement model and DCF, and shows where every figure came from.
148 chars
Primary button
Value a listed company

Ghost button
Value a private company

• Fallback headline: ‘Valuation, traced to the filing.’ (33 chars).
• Why the old wording goes: ‘Live models’ can be read as live market data, and ‘Filed data, not estimates’ sits above a DCF, which is an estimate. The page title ‘A Ledger That Never Lies’ (also in og:title and twitter:title) is an absolute claim. Replace it with ‘Marginalia — Equity valuation from company filings’.
2.2 Audience sections (final text)
Each column is a label, one claim of at most 10 words, three facts, one closing line and one text link. Every fact is a feature visible in your screenshots, but a fact may appear only while its status in the feature register is ‘shipped’ (section 2.4).

Investors
Analysts
Firms (PE, banks, valuation, CA)
Claim
Read the accounts, then test the price.
Audit the model line by line.
One model for listed and private companies.
Fact 1
Five years of income statements, balance sheets and cash flows, exactly as filed.
Click a figure to change it, or drag a line to move it.
Enter a private company’s accounts and get the same three-statement model and DCF.
Fact 2
Two intrinsic-value methods beside the current price, with the gap between the methods stated.
The full working is shown for each valuation, not only the result.
Reformat an existing workbook to house convention without changing a number.
Fact 3
‘What the price assumes’ solves for the growth, multiple or discount rate the current price implies.
Download the model as Excel, with blue inputs and black formulas. Spread a company against peers.
Save models and apply your own template.
Closing line
Marginalia reports measurements. It does not tell you to buy or sell.
Every figure links to its source.
A one- or two-page summary of any company.
Link
Value a listed company →
Open a sample model →
Value a private company →
2.3 Claims register (each needs a test, section 9)
Claim on page
Evidence the build must produce
‘10,000+ listed companies’
A live count from the database. The string ‘10,000+’ is allowed only if the count is at least 10,000; otherwise print the count rounded down to the nearest 100.
Exchanges (NYSE, NASDAQ, NSE, BSE, LSE, TSX)
Generated from the database; each listed exchange has at least 1 company.
‘Up to five fiscal years’
True for the filings held; newer companies show fewer, so the wording is ‘up to’.
‘Free to use’ [CONFIRM]
Read from a pricing flag, never hard-coded.
‘Three valuation approaches: Income, Market, Asset’ [CONFIRM]
Your screenshots show an income approach (two DCF methods) and a ‘Valuation range’ tab. List only the approaches that ship.
‘Not one number changes’ (Excel reformat)
An automated test comparing every cell value before and after reformatting.
‘Every figure has a source’
A test that fails if any rendered figure on the landing page lacks a data-source value.
Banned in all landing copy (CI regex, case-insensitive): buy, sell, hold, undervalued, overvalued, upside, downside, outperform, beat the market, guarantee, best, most accurate, never, always, real-time (unless proven), AI-powered, trusted by. Required in the footer, with counsel review [CONFIRM]: ‘Marginalia presents figures from company filings and model outputs. It is not investment advice or a recommendation to buy or sell any security.’
2.4 Feature status: the page may not claim what the roadmap says is not built
The roadmap block says Private company inputs is in build for Q1 2027, One-page desk summary is in build for Q3 2027, and Workbook reformatting is planned for Q1 2028. The same page describes the matching features in the present tense: ‘Type in the accounts you already have and get the same model’, ‘A whole company on one page’, ‘Not one number changes’. The hero also carries a ‘Value a private company’ button. The page contradicts itself, and the claims in the first group cannot be proved today. My mapping of Four ways in to roadmap items is an inference [CONFIRM].
Page element
Roadmap item
Status on the live roadmap
Four ways in 02, ‘Value a private company’; hero ghost button; Firms fact 1
Private company inputs
In build, Q1 2027
Four ways in 03, ‘Make a one or two-pager’; the Firms closing line
One-page desk summary
In build, Q3 2027
Four ways in 04, ‘Reformat your Excel model’; Firms fact 2; ‘Not one number changes’
Workbook reformatting
Planned, Q1 2028
Firms fact 3 (templates, saved models); Analysts fact 3 (Excel download, peers)
Not on the roadmap; both appear in the product screenshots
Shipped [CONFIRM]
Rule. One feature register (id, status: shipped, in_build or planned, quarter) feeds the roadmap rows, Four ways in, the audience facts and the hero buttons.
• shipped: present tense, with its link or button.
• in_build or planned: the item keeps its place, shows the status label (‘In build · Q1 2027’, ‘Planned · Q1 2028’), is written in future tense, and has no link, button or ‘Type in’ instruction.
• Hero: while private-company inputs are not shipped, the ghost button is replaced by the text link ‘What is being built next ↓’ (anchor #roadmap). The primary button is unchanged.
• ‘Not one number changes’ appears only after workbook reformatting ships and its cell-comparison test passes.
• CI: every present-tense statement about a feature sits in an element with data-feature, and the build fails if that feature’s status is not shipped.
3. Layout
3.1 Global values

Desktop 1440×900
Phone 390×844
Content width
1344px (48px gutters)
342px (24px gutters)
Grid
12 columns, 90px, 24px gap. Spans: 4 cols = 432px, 6 = 660px, 8 = 888px
1 column, 16px gap
Header
64px fixed; condensed 48px after 80px scroll
64px fixed; condensed 48px
Gap between sections
96px, then a 1px line hairline, then 40px of padding
64px, hairline, 32px of padding
Paper bands
Full-bleed, 96px above and below
Full-bleed, 64px above and below
Anchor offset
scroll-padding-top: 88px
88px
Type (VISUAL_SYSTEM steps only):
Role
Size / line
Face and weight
Display (H1, stat figures)
clamp(40px, 5vw, 64px) / 1.05 (64px at 1440; 40px at 390)
Newsreader 600 for the H1; Source Sans 3 600 tabular for stats. Letter-spacing -0.015em, word-spacing 0.04em on the H1.
Title
clamp(28px, 2.8vw, 36px) / 1.08 (36px at 1440; 28px at 390)
Newsreader 600
Section
20px / 1.2
Newsreader 600
Lead
20px / 1.5 (hero sub only)
Source Sans 3 400
Body
15px / 1.65
Source Sans 3 400
Small
13px / 1.55
Source Sans 3 400/500
• Mark: max(0.13em, 6px), which is 8.3px on the 64px H1.
• Eyebrow: 13px muted words with an 8px oxblood hairline beside them. The number in an eyebrow is in quiet, never in accent-text.
• Prose is capped at 76ch and is left-aligned on this page; the hero is centred.
3.2 Sections
Page order and keep list. The live order, as far as the screenshots show it. Every row is kept. Where the spec below says ‘rebuild’ it means restyle and correct, not remove.
#
Section (live label)
Seen
Decision
1
Hero
Yes
Keep; spec below
2
What you can do (‘01’) = Four ways in
Yes
Keep; items gated by the feature register
3
Who it is for (new, from my brief)
New
Add after Four ways in; drop it if sections 02–08 already cover the three audiences [CONFIRM]
4
Sections labelled 02–08
No
Keep. Send screenshots; until then they follow the unseen-section rules below
5
Coverage (‘09’)
Yes
Keep; fix as listed
6
Every figure has a source (‘10’, In the margin)
Yes
Keep the layout idea; rebuild with real, labelled data
7
The margin notes (‘11’)
Yes
Keep; restyle and correct copy
8
What is being built next (roadmap)
Yes
Keep; becomes the feature register’s public view
9
Feedback form (‘Direct research dispatch’)
Yes
Keep; rewrite and restyle
10
About the analyst (‘04’)
Edge only
Keep; content unseen
11
Footer
No
Keep; spec below, confirm against what exists
The final-call band in v1.0 is removed from the spec. The page already ends on a form, and a second primary button there would break the one-primary rule.
01 Hero · dark · page. Min-height min(100svh, 900px).

Desktop (y positions at 1440×900)
Phone (y at 390×844)
Wordmark box
1120×270px, centred, y 96–366
Poster only, 342×82px, y 88–170
Eyebrow
y 406–426
y 202–222
H1
Display 64/67, max-width 1000px, text-wrap: balance, 2 lines, y 442–576
Display 40/42, 3 lines, y 238–364
Sub
Lead 20/30, max-width 620px, 3 lines, y 600–690, colour read
Lead 20/30, 5 lines, y 388–538
Buttons
Two, 48px high, 20px side padding, 12px gap, y 722–770
Stacked, 342px wide, 48px high, 12px gap, y 562–610 and 622–670
Section end
Padding-bottom 64px; the next section’s hairline lands at y 834, so its eyebrow shows at the fold
Padding-bottom 48px
Every figure has a source · paper · keep the layout, rebuild the content. The live section pairs a table on the left with an annotation on the right (a definition and a source line). That pattern is the best idea on the page, so it stays. What changes: the sample becomes a real, labelled company; the pink row tint (#EFE4E0, not in the palette) goes; the red figure goes; rows shrink from about 97px to 40px. Eyebrow muted ‘Every figure’, Title ‘Every figure has a source.’ with the Mark, then one Body line: ‘NVIDIA CORP, fiscal years 2022–2026, US$ millions, as filed. Select a row to see where it came from.’ (max 76ch). Colours: paper, paper-ink, paper-quiet, paper-line. The selected row takes a 1px accent border and weight 600; the annotation takes a 2px accent left rule. Details in section 6.

Desktop
Phone
Table
Cols 1–8 (888px). Header row 40px; 4 data rows of 40px, text vertically centred. Row label Body 15 weight 400 paper-ink; figures tabular, weight 400, right-aligned to one edge shared with the FY header.
Full width, scrolls inside its own container; first column sticky, 140px
Annotation
Cols 9–12 (432px), 24px left padding, 1px paper-line left rule. 13px label (the row name, paper-quiet; the live page sets it in red). Definition in Body 15 Source Sans, paper-ink; the live page sets it in Newsreader regular, which is outside the pairing rule. Under it a hairline and the source fields.
Under the table, 1px paper-line top rule, 16px padding
Connector
A 1px accent line from the selected row’s vertical centre to the annotation rule. At 40px rows it meets the figure. The live connector already leaves at the row centre, but the row is 97px tall with the text at the top, so it points at blank space.
Hidden
Excluded rows
Operating margin, free cash flow and value per share. They are computed outputs, not filed figures, and ‘value per share’ on a named company would read as a verdict.
Same
03 Four ways in · dark. Eyebrow ‘What you can do’ (the live page prints ‘01’; numbering rule in the unseen-section rules below), Title ‘Four ways in.’

Desktop
Phone
Visual
Cols 1–5 (546px): a static SVG hexagon, 420×420px, 1px stroke in line-control
Hidden
Items
Cols 7–12 (660px). Number 13px quiet; title Section 20/24; 8px gap; Body 15 in read; 32px between items; a 13px muted text link per item
Single column; 28px between items
Item text (kept from the current page): 01 ‘Value a listed company’, 02 ‘Value a private company’, 03 ‘Make a one or two-pager’, 04 ‘Reformat your Excel model’, each with its current description.
Status gating (section 2.4). Item 01 is unchanged. Items 02–04 render from the feature register until they ship, as: 02 ‘Private company inputs are in build for Q1 2027: you will enter the accounts you already have and get the same model a listed company gets.’; 03 ‘A one-page desk summary is in build for Q3 2027.’; 04 ‘Workbook reformatting is planned for Q1 2028.’ Each shows its status label in 13px muted beside the title, and none has a link.
04 Who it is for · dark. Title ‘Who it is for.’ Three columns of 432px, 24px gap; each is a 1px line top rule, 24px padding, a 13px muted label, the Section-20 claim (max 2 lines), then three fact rows (Body 15, 12px vertical padding, 1px line between rows), then a 13px quiet closing line, then a 13px muted link. No boxes or fills. Phone: stacked with 40px between columns.
05 Coverage · paper. Colours: paper ground, paper-ink, paper-quiet, paper-line; no raised fill.

Desktop
Phone
Stats
4 columns of 318px; numeral Display 64px Source Sans 3 600 tabular, paper-ink; label Body 15 weight 500; detail 13px paper-quiet
2×2 grid; 32px row gap, 16px column gap; numeral 40px
As-of line
13px paper-quiet, 40px below the stats: ‘Counts as of 30 Oct 2026, from the Marginalia database.’
Same
Stat set: listed-company count; ‘Up to 5 fiscal years of filed history’ (IS · BS · CF · WC · PP&E · Debt · Equity); ‘Free to use’ [CONFIRM]; ‘Valuation approaches’ [CONFIRM].
Coverage fixes seen in the new screenshots. The paper band has a rounded top-left corner of about 40px; make it 0px (square corners everywhere). The eyebrow ‘Coverage’ is red on the live page; make it muted. The numerals are Newsreader; make them Source Sans 3 tabular. The gap between the stat details and the next eyebrow is about 205px; make it 96px. ‘Free to use’ and ‘Valuation approaches’ stay [CONFIRM]; the roadmap also lists a leveraged buyout model as planned, so list only approaches that ship.
The margin notes · paper · keep. Live label ‘11 · The margin notes’. Eyebrow muted ‘Margin notes’. Title ‘Margin notes’ with the Mark: the live title ‘The Margin Notes’ is in Title Case and has no mark, unlike the other titles. Body line: replace ‘Read any company’s accounts without a finance degree.’ with ‘Plain-language explainers on how to read a company’s accounts.’ (the live line promises an outcome we cannot test [CONFIRM]).
• Cards: the 3 notes from /learn the editor selects. Three columns of 432px with a 1px paper-line rule on the left of columns 2 and 3 and 24px padding. Title Section 20 Newsreader 600; excerpt Body 15 in paper-read, 3 lines at most; link ‘Read the note’ in paper-ink, Body 15, underlined on hover. The live links are accent-text, which makes 9 accent words in one viewport against a budget of 5.
• Excerpt copy: change ‘each pound of sales’ to ‘each unit of sales’. The audience is worldwide and the page should not assume sterling.
• Button: a ghost button ‘All {n} notes’, 40px high, where n is the live count from the database (the page shows 19).
• Phone: stacked, a 1px paper-line rule between cards; the button is full width.
What is being built next · paper · keep. Five live rows: Q1 2027 Private company inputs, In build; Q2 2027 Things to check in a filing, In build; Q3 2027 One-page desk summary, In build; Q4 2027 Leveraged buyout model, Planned; Q1 2028 Workbook reformatting, Planned. The label ‘What is being built next’ is 13px paper-quiet. Each row is 72px with a 1px paper-line rule below: quarter in a 120px column (13px paper-quiet), title Body 15 paper-ink, status at the right edge in 13px. ‘In build’ is paper-ink weight 600 and ‘Planned’ is paper-quiet weight 400. The live page sets ‘In build’ in accent-text three times, which spends the accent budget on a status word. The rows come from the feature register, and the block has the anchor id=roadmap. Under the list, 13px paper-quiet: ‘Dates are plans and may change.’ [CONFIRM with counsel].
Send feedback · dark · keep, rewrite and restyle. Live label ‘DIRECT RESEARCH DISPATCH’, title ‘Send Feedback or Model Inquiries’.
• Panel: panel, 1px line, padding 24px (phone 16px/20px). The decorative corner wash at its top right is the one radius shape the system allows; keep it and add no other.
• Eyebrow: ‘Feedback’, 13px muted, sentence case, no icon, 8px oxblood hairline. The live eyebrow is uppercase, tracked, oxblood and carries an icon.
• Title: ‘Send feedback.’ with the Mark, Title step 36px (28px on phone), sentence case.
• Body line: ‘Report a bug, ask for a company, or question an assumption in the model.’ Remove ‘Transmit your feedback directly to our research inbox’ and ‘Dispatch’: say what the form does in plain words.
• Fields: visible 13px labels above each field (‘Email, optional, so we can reply’ and ‘Message’); placeholders are examples only. Input 44px high, textarea at least 120px, border 1px line-control (the live line border is 1.28:1 and fails the 3:1 rule for a control boundary), 2px ink focus ring.
• Button: ‘Send feedback’, the screen’s one primary: oxblood wash at 20% with an oxblood border, 44px high, 16px icon at an 8px gap. The live button is a solid oxblood fill with a glow shadow under it; the system has no fills for buttons and no shadows.
• Footnote: delete ‘* SECURE WEB3FORMS ENDPOINT · RESPONSES ROUTED DIRECTLY TO YOUR INBOX’. It is uppercase and tracked, names a vendor, says ‘your inbox’ to a visitor, and claims ‘secure’ without proof. Replace with 13px quiet: ‘We use your email only to reply to this message.’ [CONFIRM against the privacy policy].
• States: sending (button at 40% opacity, label ‘Sending…’, form kept); success (the form is replaced by ‘Thanks. We have your message.’ in an aria-live=polite region, fade 200ms); error (‘The message was not sent. Try again.’ in accent-text with an icon, role=alert, the typed text kept). A honeypot field and a server rate limit handle spam.
About the analyst · dark · keep, content unseen. The live eyebrow ‘04 — ABOUT THE ANALYST’ is uppercase, tracked, oxblood, with a square bullet, and it is numbered 04 between sections numbered 09–11: a leftover of the retired label style. Restyle to the shared eyebrow (13px muted sentence case ‘About the analyst’ with the 8px hairline). Only the edge of a box is visible, so layout waits for a screenshot. Rules until then: every statement of credentials, experience or track record links to a document a reader can open, or it is removed; no performance claims; no buy or sell language; a photograph, if used, is a real one, square, 0px radius [CONFIRM it exists].
Sections labelled 02–08 · unseen · keep. Send screenshots and I will add them to the table above. Until then each follows these rules:
• Eyebrow: one style across the page: 13px, sentence case, muted, 8px oxblood hairline. No uppercase, no tracking, no oxblood words, no icon.
• Numbering: generate any numerals with a CSS counter in quiet, consecutive down the page, or drop them. No two sections may share a number (the live page has 01, 09, 10, 11 and 04).
• Titles: sentence case, Newsreader 600, Title step, ending in the Mark.
• Surfaces: a hairline and space, not boxes; 0px radius; no shadow or glow.
• Numbers: Source Sans 3 tabular, ink, never Newsreader; no number animates except the Coverage count-up.
• Claims: any claim about a feature follows the feature register; any statistic carries a unit, a date and a source.
• Controls: targets at least 24×24px (44×44 on touch), borders at least 3:1, 2px ink focus ring, one primary per viewport.
08 Footer · dark. 1px line top rule, 40px padding. Left: the legal line (section 2.3), 13px quiet, max 76ch. Right: Coverage, Margin notes, Terms, Privacy, Contact, 13px muted, 24px apart. Phone: stacked, 24px between.
Header. Left: wordmark. Then 3 links at 13px muted, ink on hover (How it works, Coverage, Margin notes). Right: a ghost button ‘Search a company’ with a ⌘K hint, 36px high. Phone: the wordmark, a 44×44 search icon button, and a 44×44 menu button that opens the sheet (280ms). There is no clock, no ‘live’ dot and no oxblood link.
4. The hero visual
Particle wordmark (budgets from VISUAL_SYSTEM section 6; build step 8).
• Source: the word ‘marginalia’ rasterised from Newsreader 600 on an offscreen 1120×270 canvas, with 12,000 particles sampled from the mask: 11,400 in ink at 85% alpha, 600 in accent for the closing mark.
• Particle size: 1.5 CSS px at DPR 1 and 2.25px at DPR 1.5. DPR is capped at 1.5, and the internal resolution at 1920×1080.
• No ambient star field outside the wordmark box, and no bloom or glow.
• Timeline: the canvas fades in over 400ms after its first frame. Particles then travel from a 40px scatter to the wordmark over 700ms on --m-ease-expr. Between 1.1s and 5.0s they drift at most 0.5px. At 5.0s the animation freezes on the final composition (WCAG 2.2.2).
• Pointer: while the pointer moves inside the box, particles within 80px displace by up to 12px and return over 400ms on --m-ease-standard. No spring or overshoot. Pointer input stops reacting after 5s of no movement.
• Pause control: a 24×24px button (44×44 on touch) at the lower right of the box, aria-pressed, label ‘Pause animation’, ink 2px focus ring. It is hidden when nothing is playing.
• Poster (LCP): <picture>, WebP 1680×405 ≤ 60KB on desktop; 684×165 ≤ 20KB at ≤ 640px. Explicit width and height, fetchpriority=high, alt=‘’. The H1 and sub render as server HTML at full opacity with no entrance animation, so LCP is never delayed.
• Engine: a lazy chunk of ≤ 180KB gzip, loaded after first paint. One WebGL context; frame cost ≤ 4ms; adaptive halving per VISUAL_SYSTEM section 6; paused under 10% visibility or when document.hidden.
• Fallback (poster only, canvas never created): prefers-reduced-motion, the ‘Reduce motion’ setting, any viewport ≤ 640px, low-end detection, saveData, no WebGL2, or a lost context.
Secondary scene (optional, ticket 8b).
• Default (8a): the static 1px SVG hexagon in section 03. Ship this.
• 8b: only if 8a passes the Lighthouse budgets. The hero canvas stays mounted and its particles morph into the hexagon outline when section 03 is 50% visible. Rules: 6,000 particles, 700ms on --m-ease-expr, a single context, desktop only, same pause rule. If it needs a second canvas, it is not allowed.
5. Motion by section
Tokens only; nothing else animates. Parallax: none. Under reduced motion, or ≤ 640px, or on a low-end device, every row below is skipped and content shows immediately.
Section
Motion
Token(s)
Header
Scroll-progress rule (scaleX); condensed bar slides from -60px
1:1 with scroll; --m-dur-slow 280ms, --m-ease-enter
Hero
Canvas fade-in; particle assembly; pointer displacement. Text and buttons do not animate.
--m-dur-reveal 400ms enter; --m-dur-hero 700ms, --m-ease-expr; 400ms, --m-ease-standard
What you can do; Who it is for
Items reveal: opacity and translateY 12px→0, stagger 50ms, at most 4 siblings (150ms total)
--m-dur-reveal, --m-ease-enter
Sections labelled 02–08
Reveal only. No count-up, no number animation, no parallax.
--m-dur-reveal
Coverage
Count-up on the numerals once at 50% visible: 600ms, ease standard. The final value is in the HTML.
--m-dur-count, --m-ease-standard
Every figure has a source
The section reveals once. Table rows and figures never animate. Selecting a row swaps the annotation instantly and changes the row border colour over 110ms.
--m-dur-reveal 400ms; --m-dur-fast 110ms
Margin notes
Cards reveal, stagger 50ms across 3 (100ms)
--m-dur-reveal
What is being built next
Rows reveal once as one block (no per-row stagger beyond the 4th)
--m-dur-reveal
Send feedback
Panel reveals once. Sending state: colour and opacity only, 110ms. Success message fades in over 200ms.
--m-dur-reveal; --m-dur-fast; --m-dur-base
About the analyst
Reveal only
--m-dur-reveal
Buttons and links (all)
Hover colour 110ms; press 70ms; focus ring appears instantly (no animation)
--m-dur-fast, --m-dur-press
Menu sheet (phone)
Slides from the bottom, 280ms in and 200ms out; scrim fades in 240ms
--m-dur-slow, --m-dur-mod
Navigating to a product page
Main region: 120ms out, 280ms in
--m-dur-slow, --m-ease-exit / --m-ease-enter
Total entrance sequences on any one screen stay under 600ms.
6. Real product proof
Stock images, invented company screenshots, invented numbers, customer logos, testimonials and user counts are all banned until we hold real ones.
1. Every figure has a source (required; the existing section, rebuilt). A snapshot generated at build from the database for one real company; NVDA as default. It reproduces the as-filed table: revenue 26,914 / 26,974 / 60,922 / 130,497 / 215,938; cost of sales 9,439 / 11,618 / 16,621 / 32,639 / 62,475; research and development 5,268 / 7,339 / 8,675 / 12,914 / 18,497; selling, general and administrative 2,166 / 2,440 / 2,654 / 3,491 / 4,579 (US$ millions, FY2022–FY2026, as in your screenshot; formatted at 0 dp so the decimals bug in the product table is not copied). Labels weight 400, figures 400 tabular, US grouping for USD.
    ◦ Annotation fields: the row’s plain definition (the live Revenue sentence stays: ‘What the company billed its customers, before a single cost is taken off.’); the statement it comes from (the live ‘Income statement, as filed’); company and ticker; form type; fiscal period end (FY2026 ended 25 January 2026 per your screenshots); filing date; source (SEC EDGAR); a link ‘Open the filing ↗’. Form type, filing date and link come from the database at build and are [CONFIRM] against the filing.
    ◦ Interaction: each row is a button. The selected row takes the selected state (1px accent border, ink, weight 600) and the annotation takes a 2px accent left rule. Arrow keys move between rows.
    ◦ Under the section (13px paper-quiet): ‘Snapshot generated {date}. Figures as filed, US$ millions.’ A ghost link ‘Open NVDA on Marginalia →’ follows.
    ◦ Not shown: intrinsic value, premium or discount, or any verdict on the company.
2. Workbook preview (optional, second state). A segmented control ‘As filed | Excel export’. The export state is a real .xlsx written by CI for the same company, rendered to WebP (≤ 90KB at 2×). Caption: ‘NVIDIA CORP export generated {date}. Blue cells are inputs, black cells are formulas.’ Allowed because the Excel download is in the product today [CONFIRM].
3. Private-company flow. No screenshot, demo or sample until the feature ships (roadmap: Q1 2027, in build). After it ships, a real screenshot of the empty input form, never a filled invented company.
4. Removed: the old ‘Sample output’ rows (‘10,52,851’, ‘13.8%’, ‘48,933’, ‘1,636.71’). It names no company, currency, unit or period, which contradicts ‘Every figure has a source’, and ‘value per share’ is a model output.
7. Calls to action
Exactly one oxblood-washed primary per viewport.
Viewport
Primary
Everything else
Hero
Value a listed company (opens search)
Ghost ‘Value a private company’ only once that feature ships; until then the text link ‘What is being built next ↓’. Header: ghost search.
What you can do; Who it is for
none
13px muted text links; items for unshipped features have no link
Sections labelled 02–08
none until specified
Existing controls restyled per the unseen-section rules
Coverage; Every figure has a source; Margin notes; Roadmap
none
Row links in paper-ink with underline on hover; ghost ‘All {n} notes’; ghost ‘Open NVDA on Marginalia →’
Send feedback
Send feedback (oxblood wash, 44px)
none
About the analyst
none
Text links
The hero and feedback primaries share no viewport (test in the checklist). There is no final-call band and no sticky bar: the page ends on the feedback form, About the analyst and the footer.
8. What to change in the current screenshots
#
Where
Finding
Fix
Sev
1
Hero
Four oxblood nav links and an oxblood-washed Search
Muted at rest, ink on hover; Search becomes ghost
H
2
Four ways in; hero
Items 02–04 and the hero ghost button describe features the roadmap lists as in build or planned (private company inputs, one-page summary, workbook reformatting)
Feature register; status labels; no claim until shipped (section 2.4)
H
3
All 7 new views
A neon yellow starburst in a rounded dark square at the right edge. If it is ours it adds a second hue and a radius; if it is a browser extension, ignore it. I cannot tell which.
If ours: square, quiet, palette colours, bottom-right
H
4
Every figure has a source
‘Sample output’ names no company, currency, unit or period. Rows are about 97px tall with the text at the top. One row label is ink and the rest are grey. The pink row tint is off-palette. The revenue figure is red. ‘Value per share’ is a model output.
Real labelled company, 40px rows, palette-only selection, ink figures, no computed rows (sections 3.2 and 6)
H
5
Send feedback
A solid oxblood button with a glow shadow under it; an uppercase, tracked, oxblood eyebrow with an icon; a Title Case heading
Oxblood wash, no shadow; shared eyebrow; sentence case
H
6
Send feedback
Footnote names a vendor (Web3Forms), says ‘YOUR INBOX’ to the visitor and claims ‘SECURE’. Copy says ‘Dispatch’ and ‘Transmit’.
Plain words and a privacy line [CONFIRM]
H
7
Hero; Four ways in
Clock with seconds and a ‘live’ dot in the header
Remove (VISUAL_SYSTEM section 5)
M
8
Hero
Scattered star specks across the whole page, and ‘Scroll to see how it works’
Remove both
M
9
Hero
Eyebrow ‘Filed data, not estimates’ and the page title ‘A Ledger That Never Lies’
Replace (section 2.1)
M
10
Four ways in
A second particle scene (the hexagon)
Static SVG hexagon (section 4)
M
11
Hero
Paragraph about 22px; closing mark about 5px; H1 tracking tight at word gaps
Lead 20px; mark max(0.13em, 6px); word-spacing 0.04em
L
12
Whole page
Eyebrow numbers 01, 09, 10, 11 and ‘04 —” in two label styles
One eyebrow style; CSS counter or no numbers
M
13
Coverage; Every figure; Margin notes
Eyebrows are red on paper (and muted on dark)
Muted on both grounds
M
14
Coverage
The paper band has a rounded top-left corner of about 40px; numerals are Newsreader; the gap below is about 205px
0px radius; Source Sans tabular; 96px
M
15
Margin notes
Title Case title with no Mark; ‘pound’ in an excerpt; ‘Read the note’ in oxblood three times; ‘without a finance degree’
Section 3.2
M
16
Roadmap
‘In build’ in oxblood three times; dated promises with no disclaimer
Ink weight 600; ‘Dates are plans and may change.’
M
17
Send feedback
Placeholder-only fields with a 1.28:1 border
Visible labels; line-control border
M
18
About the analyst
Uppercase, tracked, oxblood eyebrow numbered 04
Shared eyebrow; credentials need proof
M
19
Whole page
Sections 02–08 not yet seen
Kept; send screenshots

9. Developer checklist
Content and claims
1. H1, sub, button, eyebrow and audience text match section 2 character for character.
2. The banned-words regex (section 2.3) returns 0 matches across the built HTML.
3. og:title, twitter:title and <title> contain no ‘never’ or ‘always’.
4. The listed-company count and exchange list come from the database; the build fails if ‘10,000+’ is shown and the count is below 10,000.
5. Every figure on the page has a data-source; the test fails on any that does not.
6. The footer contains the not-advice line; the Excel ‘not one number changes’ test passes.
7. No stock image, no logo wall, no testimonial, no user count in the HTML.
Layout (screenshots at 1440×900 and 390×844)
8. Content width is 1344px at 1440 and 342px at 390, with no horizontal page scroll.
9. Hero y positions are within ±8px of the table in section 3.2; the next section’s hairline is at y ≤ 840 at 1440×900.
10. Section gaps are 96px (64px on phone); no other gap token appears.
11. Every hairline and band sits inside the 1344px container, except the full-bleed paper bands.
12. Font sizes in use are only 13, 15, 20, 36 (clamped), Display and 24px figures if present; no size under 13px.
13. Every figure uses font-variant-numeric: tabular-nums lining-nums; no Newsreader on a number.
14. No accent (#8B1E1E) as text; no oxblood outside the budget: at most 1 washed button, 3 fills, 5 accent-text words per viewport.
Hero visual
15. Particles ≤ 12,000; frame cost ≤ 4ms on the reference laptop; one WebGL context on the page.
16. The animation freezes by 5.0s; the pause control works with the keyboard and mouse and is ≥ 24×24px (44×44 on touch).
17. With prefers-reduced-motion: reduce, at 390px wide, with saveData, or with WebGL disabled, the poster shows and no canvas exists in the DOM.
18. The lazy 3D chunk is ≤ 180KB gzip and loads after first paint; the desktop poster is ≤ 60KB and the phone poster ≤ 20KB.
Motion
19. Every duration and easing is an --m-* token; transition: all returns 0 matches.
20. Only transform, opacity and the chart clip-path animate; there is no animation on a table row or a figure.
21. Count-up appears only in section 05; the final numbers are present in the HTML.
22. No parallax, no looping animation after 5s, and no ticking clock anywhere on the page.
Calls to action, accessibility and performance
23. At every scroll position there is at most one oxblood-washed primary in the viewport (test at 1440×900 and 390×844, scrolling in 100px steps).
24. Focus ring: 2px ink with a 2px offset; Tab order follows the visual order; no focused element is hidden under the header.
25. Every text token on page and paper is ≥ 4.5:1; non-text marks ≥ 3:1; pointer targets ≥ 24px (44px on touch).
26. Lighthouse on a mid-range phone profile: LCP ≤ 2.5s, CLS ≤ 0.1, INP ≤ 200ms; initial JavaScript ≤ 170KB gzip excluding the lazy 3D chunk; fonts ≤ 4 files, font-display: swap, ₹ (U+20B9) present in the subset.
27. The page is usable at 320 CSS px wide and at 200% text zoom.
Existing sections
28. Every row of the page-order table in section 3.2 exists in the built page; none is removed without a recorded owner decision.
29. One eyebrow style everywhere: 13px, sentence case, muted, 8px oxblood hairline; no uppercase, no tracking, no oxblood words, no icon.
30. Section numerals come from a CSS counter or are absent; no two sections share a number.
31. Computed border-radius is 0 on every section, panel, button and field. Circles appear only on status dots and rings, plus the one corner wash on the feedback panel.
32. No box-shadow or filter: drop-shadow anywhere on the page.
33. Feature register: every present-tense statement about a feature sits in a data-feature element whose status is shipped; the roadmap, Four ways in and the hero buttons read the same register.
34. Feedback form: visible labels, line-control borders at 3:1 or more, success and error messages announced through live regions, no vendor name or uppercase text in the UI.
35. ‘All {n} notes’ equals the database count; generic explainer excerpts contain no currency word.
36. Every credential in About the analyst links to a document, and the roadmap shows ‘Dates are plans and may change.’