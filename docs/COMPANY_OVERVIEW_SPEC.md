# COMPANY_OVERVIEW_SPEC — decisions (1 November 2026)
- D1: Map the 20, 28 and 40px sizes onto DESIGN.md's existing steps plus the approved 24px tile-figure step (VISUAL_SYSTEM finding 8). If a size has no step, use the nearest step; no new sizes.
- D2: Confirmed: 1440px container including gutters, content 1344px.
- D3: Use trailing twelve months (TTM) wherever quarterly data exists (built in step 2); fall back to the latest financial year, always labelled with its basis. The P/E overlay follows the same rule.
- C1 (dividend yield): VERIFY FIRST against the company's own dividend declarations (8-K / exchange filing) before changing anything; the free-chat comparison figure is unconfirmed. Show the trailing-twelve-month dividend and, where declared, the current declared rate, each labelled.
- D4: Split into Sales and Operating margin chips: approved.
- D5: Weak-fit warning keeps the thresholds already built and approved: R² under 10% or standard error above 0.25. Not 30%.
- D6: Edits are saved to the model draft (the browser-saved model, as KI-27) until accounts exist (build step 7). Card wording: "Saved to this model on this device."
- D7: Chart draw-in 400ms + 200ms fill, to stay within the 600ms page-load cap.
- D8: Source links as underlined read-colour text: approved.
- D9: Log scale offered on 10Y and Max when max ÷ min exceeds 20; default linear, user toggles.
- D10: Banks: as built — residual-income valuation; WACC "not applicable"; cost of equity shown.
- Built in build step 9. The yellow starburst is a browser extension: ignore.

# COMPANY_OVERVIEW_SPEC

Marginalia · company page, Overview tab · v1.0 · 1 November 2026 · sits
beneath VISUAL_SYSTEM v1.0 (with the 30 October 2026 decisions) and
DESIGN.md.

Covers: company header and tab row, key-figure tiles, About, data
freshness, "where this came from", price chart, risk and cost-of-capital
card. Does not cover: the global header, or the Financials, Filings,
Model and other tabs.

## 0. Basis, limits, markers

**Evidence.** Five screenshots plus VISUAL_SYSTEM.md. I call them S1
(beta, measured here), S2 (cost of debt, tax, weights, share price), S3
(cost of equity, WACC, risk-free, beta, premiums), S4 (price chart), S5
(company header and tiles). DESIGN.md was not uploaded, so its four type
steps are unknown to me (see D1).

**Measuring.** S1–S3 are 1917px wide at 1:1. S4–S5 are the same page
scaled to 81.8% (1568px wide); I converted back. Every pixel value is
±2px: confirm with computed styles before logging a bug. The yellow
starburst is ignored, as instructed.

**Decisions applied from the top of VISUAL_SYSTEM.**

- ⓘ stays. Hit area 24×24 (44×44 under pointer: coarse) via a
  pseudo-element. ⓘ appears only on labels that need explaining. No
  dotted-underline triggers anywhere.

- Dark is the only instrument theme. No Light tokens in this spec.

- No 3D or particles on this page. All other CHANGE items in
  VISUAL_SYSTEM are approved and are treated as law below.

**Markers.** KEEP = already in VISUAL_SYSTEM. ADD = new token or rule.
CHANGE = alters VISUAL_SYSTEM or the screenshots. PROPOSED = my value
where VISUAL_SYSTEM is silent; it needs owner sign-off and is listed in
section 8.

**Colour names.** Token names throughout. Hex appears only where
VISUAL_SYSTEM prints it. accent, accent-text and the dark positive are
defined in DESIGN.md.

**Data cross-check.** I compared S1–S5 with stockanalysis.com's NVDA
page (opened 1 Nov 2026). Price \$204.64, −4.22%, 52-week range
164.27–243.37 and beta 2.22 agree with S5 and with the 2.248 measured in
S1. Differences in dividend yield, P/E and share count are logged as
C1–C3 in section 6.

## Research: five pages I opened

I chose them for relevance to this page and because I could read them. I
did not verify rankings; the only rating I saw was StockAnalysis's app
score (4.9 on both app stores).

1.  **TradingView Lightweight Charts documentation.** Opened: [docs
    map](https://tradingview.github.io/lightweight-charts/docs_map.md)
    (v5.2, updated 22 Oct 2026), [Two Price
    Scales](https://tradingview.github.io/lightweight-charts/tutorials/how_to/two-price-scales.md),
    [Whitespace
    data](https://tradingview.github.io/lightweight-charts/tutorials/demos/whitespace.md).
    Take: a second axis is an explicit opt-in, one series assigned to
    one scale (left or right), never implicit; a time point with no
    value breaks the line instead of bridging it. The docs map also
    lists keyboard and screen-reader tutorials; I saw only their
    headings.

2.  **IBM Carbon, [Axes and
    labels](https://www.carbondesignsystem.com/building-blocks/data-visualization/axes-and-labels)
    and [Chart
    anatomy](https://carbondesignsystem.com/data-visualization/chart-anatomy/).**
    Take: never interpolate across missing data and label both ends of a
    gap; never change tick increments to suit data availability;
    semibold "landmark" labels where a new month or year begins;
    cropping the Y axis is right for stock-market lines; direct labels
    instead of long legends; tooltips repeat the values; a data table is
    the accessible alternative.

3.  **Stripe Apps, [Chart
    layout](https://docs.stripe.com/stripe-apps/patterns/chart-layout.md).**
    The Stripe Dashboard itself is behind login; this page documents the
    patterns its own pages follow. Take: the container owns the chart
    height (180 compact, 320 featured) and loading, error, empty and
    populated states all use that same height so nothing jumps; headline
    value above the chart; states resolved in the order loading, error,
    empty, populated; at most three charts per row.

4.  **StockAnalysis.com, [NVDA
    overview](https://stockanalysis.com/stocks/nvda/).** Take: one row
    of range chips (1D 5D 1M YTD 3M 6M 1Y 5Y Max); two prices each
    labelled with its own timestamp (close and after-hours); a change
    shown beside the value; a footer that credits data providers, shows
    "Last checked" and offers "Report a data error".

5.  **Koyfin Help, [Inactive
    Securities](https://www.koyfin.com/help/release-notes/inactive-securities/).**
    This is Koyfin's help documentation; its app is behind login. Take:
    a banner at the top that states the last date of available data, and
    every time-based metric (price chart, 52-week range, returns) ends
    on that date. It is the model for the stale-data state here.

**Not opened, so not used:** FT Markets (my fetch was refused and search
returned only third-party copies), Simply Wall St and Yahoo Finance
(search snippets only), the logged-in Koyfin and Stripe products.

## 1. Layout

### 1.1 Frame (1440 and 390)

- Container: max-width: 1440px; margin-inline: auto; padding-inline:
  48px at ≥1024px, 24px below. Content width is 1344 at 1440 and 342
  at 390. (Reading of "content max 1440 with 24px gutters, 48px at lg";
  see D2.)

- Breakpoints: phone \<640 (treated as constrained, VISUAL_SYSTEM §8),
  tablet 640–1023, desktop ≥1024.

- Global header 64px, condensed 48px (KEEP, finding 20). Company content
  starts 24px below it (y = 88, equal to scroll-padding-top: 88px). On
  phone it starts 16px below (y = 80).

- Panel: background panel, border 1px line, radius 0, no shadow, padding
  24 (phone 16).

- Gap between panels: 24 (phone 16). Page bottom padding: 64, plus
  --bottom-bar-inset on phone.

- No border, hairline or band extends beyond the content edges (finding
  11). S5 already passes this for the tab row.

- Type sizes are identical at 390 and 1440. Layout adapts; type does
  not.

- Spacing steps (PROPOSED): 4, 8, 12, 16, 24, 32, 48, 64. No other
  values.

### 1.2 Tokens in use

--page: \#0B0B0D; --panel: \#111114; --overlay: \#16161A;  
--line: \#262521; /\* dividers, tile borders (decorative, 1.28:1) \*/  
--line-control: \#6E6A60;/\* input, segmented-control, checkbox
boundaries (3.49 on panel) \*/  
--ink: \#F2F0EA; --read: \#C6C1B7; --muted: \#A8A29A; --quiet:
\#85816F;  
--chart-s1: var(--ink); --chart-s2: \#C79A2E;  
--scrim: rgba(11,11,13,0.72);

Text roles: ink figures and current items; read body and values; muted
labels; quiet source lines and axis labels (about 4.8:1 on panel,
computed; add to npm run verify). accent-text appears only as the
exceptions in section 3.1 of VISUAL_SYSTEM (budget in 1.7 below).

### 1.3 Type steps

Sizes named in VISUAL_SYSTEM are 13 (floor), 15 (body) and 24 (tile
figure, finding 8). Sizes 20, 28 and 40 are PROPOSED and must map onto
DESIGN.md's steps (D1).

- **T13:** Source Sans 3, 400, 13/18. Labels, source lines, axis labels,
  chips, tooltips. Sentence case, never uppercase, never tracked.

- **T15:** Source Sans 3, 400, 15/22. Body, row values, readout values,
  tab labels.

- **Title-md:** Newsreader, 600, 20/26. Panel titles (h2).

- **Title-lg:** Newsreader, 600, 28/34. Company name (h1).
  Letter-spacing −0.015em, word-spacing 0.04em (CHANGE, finding 19).

- **Tile figure:** Source Sans 3, 600, 24/28, tabular lining numerals,
  ink.

- **Hero figure:** Source Sans 3, 600, 40/44, tabular lining numerals,
  ink. Cost of equity, WACC, value per share. DESIGN.md references
  hero-figure without defining it; this defines it.

- All figures: font-variant-numeric: tabular-nums lining-nums. A figure
  is always ink (finding 14) unless it is the changed figure after an
  edit (section 4.5).

- Glyphs: negative U+2212, multiplication U+00D7 (never "x"), not
  reported U+2014 (—), ranges U+2013.

- Dates in the interface: 30 Oct 2026 (day, abbreviated month, year).
  Times in UTC with the word UTC. ISO dates only in datetime attributes.
  See C9.

- Grouping follows the currency: Indian grouping for INR amounts,
  three-digit grouping for USD. S2 already does this; keep.

### 1.4 Company header block

Panel, padding 24 (phone 16). Contents, top to bottom:

- Line 1: NVDA · NasdaqGS, T13, weight 600, muted. The ticker is not
  oxblood (an eyebrow-class label, VISUAL_SYSTEM §3.1).

- Line 2 (margin-top 4): company name, Title-lg, ink, one line at 1440,
  wraps without truncation at 390.

- Line 3 (margin-top 8): Sector Technology and Currency USD. T13, label
  quiet, value read, 16px between pairs. The abbreviation "exch" is
  removed (the exchange is in line 1).

- Stamp: two lines, T13, label quiet, value read. Prices: close 30 Oct
  2026, 20:00 UTC and Statements: FY2026, ended 25 Jan 2026. Desktop:
  top-right, right-aligned. Phone: below line 3, margin-top 12. The
  stamp is the only freshness text in the header. No clock, no seconds,
  no live dot (VISUAL_SYSTEM §5).

- Height: desktop 24 + 18 + 4 + 34 + 8 + 18 + 24 = 130, plus the 48px
  tab row and two 1px lines, about 180. Phone about 180–215 before the
  tab row.

### 1.5 Tab row

- Sits inside the header panel, above its bottom border, separated by a
  1px line divider. Height 48.

- Tabs in order: Overview, Financials, Filings, Model, Research,
  Ownership, Deals, Credit, Your notes.

- Tab: padding 0 16, T15. Rest muted. Hover ink (110ms colour). Current:
  ink, weight 600, 2px accent bottom border flush with the panel edge
  (does not count towards the accent budget). Reserve the 600-weight
  width so the row never shifts.

- The row hairlines span exactly the panel, which equals the container
  content width.

- Phone: the row scrolls horizontally inside itself (overflow-x: auto,
  scroll-snap-type: x proximity, scrollbar hidden). The next tab is
  visibly clipped as the scroll hint. Each tab is at least 44 wide and
  48 high.

- Semantics: role="tablist", manual activation (arrows move focus, Enter
  or Space selects), Home and End supported. Switching tabs is an
  instant swap (VISUAL_SYSTEM §4); the header and tab row never move.

- "Model a list" style actions do not live in this row (finding 11).

### 1.6 Section order and sizes (Overview tab)

1.  Company header and tab row, about 180 tall.

2.  Key figures, 3 rows × 128 = 384 plus hairlines at 1440.

3.  Price, 600 tall at 1440 (section 3.1).

4.  Risk and cost of capital, variable.

5.  About.

6.  Data freshness.

7.  Where this came from.

Every panel title is an h2 in Title-md. There is no primary button on
this tab (VISUAL_SYSTEM: one primary per screen; the Model tab owns it).

### 1.7 Accent budget on this tab

At rest the Overview tab spends no oxblood fill or wash and no
accent-text words. The only accent items are the current-tab underline,
the scroll-progress rule and the mark (all uncounted), plus the 1px
accent border on selected chips and segmented controls (a border, not a
wash). After an edit in the cost card at most two accent-text words
appear (the edited input and the value per share). Error text is the
only other accent-text use. Source links are not oxblood (see C4).

### 1.8 About panel

- Title: About NVIDIA CORP, Title-md.

- Desktop grid: grid-template-columns: minmax(0, 600px) 320px;
  column-gap: 96px; justify-content: start. Left: description, T15,
  read, max 600px (about 80 characters), left-aligned, hyphens: manual.
  Right: four fact rows (Incorporated in, Fiscal year ends, Employees as
  at {date}, Website). Each row: label T13 quiet over value T15 read,
  12px between rows.

- The description shows 6 lines (132px), then a Disclose row Read more
  (chevron on the left, body indented 24; finding 13). Disclose animates
  height and opacity 200ms in, 140ms out.

- Last line of the panel, T13 quiet: Description: {provider}, as at
  {date} plus a link-source (see 2.5). The opening sentences in S5 match
  StockAnalysis's description word for word; confirm the licence before
  shipping (C12).

- Phone: one column, facts below the text with 16px between.

### 1.9 Data freshness panel

- Title Data freshness. Lede, T13 muted: Every figure on this tab
  carries an as-at date. Ages count back from the price date, 30 Oct
  2026.

- Rows, min-height 40, padding 8 0, hairline between. Desktop columns:
  Item 240 \| As at 160 \| Age 120 \| Source (rest). Phone: item on line
  1, {as at} · {age} on line 2, source link line 3.

- Rows for NVDA (these are test fixtures): Share price, 30 Oct 2026, 0
  days. Share count, 25 Jan 2026, 278 days. Financial statements
  (FY2026), 25 Jan 2026, 278 days. Risk-free rate, 23 Jan 2026, 280
  days. Equity and country risk premium, 5 Jan 2026, 298 days. Beta
  (measured), 30 Oct 2026, 0 days.

- Age is {n} days, T15 read. Beyond 90 days add the words over 90 days
  in T13 quiet. No colour: a fact, not a verdict.

- Stale state (Koyfin pattern): if the last price is older than the
  previous trading day, a one-line banner above the tiles, T15 on panel
  with a 1px line-control border: Last price 24 Oct 2026. Prices after
  this date are not available. The price chart, 52-week range and
  returns end on that date.

### 1.10 Where this came from panel

- Title Where this came from. One row per source: Name (T15, 600,
  link-source), Supplies (T13 muted), As at (T13), Terms (T13 quiet).
  Desktop columns 240 \| 320 \| 160 \| rest.

- Known from S3: US Treasury, supplies the 10-year par yield, as at 23
  Jan 2026, terms a work of the US government, in the public domain.
  Also expected: Damodaran (NYU Stern), company filings, Yahoo Finance
  prices, Marginalia calculations (beta, WACC, value per share), the
  description provider.

- No row ships with a blank Terms cell: show Terms not stated plus the
  link. The data team owns the text.

- Phone: each source is a Disclose row, closed by default under 640px,
  open by default above.

### 1.11 Desktop 1440 versus phone 390 at a glance

- Container content: 1344 vs 342. Panel padding: 24 vs 16. Panel gap: 24
  vs 16.

- Tiles: 4 columns × 3 rows vs 2 columns × 6 rows (3 columns on tablet).

- Chart height: 360 vs 260. Range chips: segmented row of seven at full
  width on phone, each 44.3px.

- Cost card headline: two cells side by side vs stacked.

- Header stamp: top-right vs under the meta line.

- Hover transitions, tile stagger and chart draw-in: on desktop only
  (VISUAL_SYSTEM §8).

## 2. Tiles

### 2.1 Grid

- 12 tiles, fixed order: Price, Change on the day, Market
  capitalisation, 52-week high, 52-week low, Price / earnings, Book
  value per share, Price / book, Dividend yield, ROCE, ROE, Face value.
  The order never changes between companies.

- ≥1024: 4 columns × 3 rows, each tile 336 wide at 1440 (1344 ÷ 4),
  min-height 128. 640–1023: 3 columns × 4 rows. \<640: 2 columns × 6
  rows, each tile 171 wide at 390, min-height 120, rows grow to the
  tallest tile.

- Tiles share 1px line borders (collapsed, margin: 0 -1px -1px 0) inside
  the grid's own 1px line outer border. Background panel. Radius 0. No
  shadow.

- Hover (pointer fine only): tile border to quiet at 40%, 110ms standard
  curve. Raise z-index so the border is not clipped. No lift, scale or
  shadow.

### 2.2 Tile anatomy (top to bottom, padding 16)

- **Label:** T13, muted, up to 2 lines. Then, only on tiles that need
  it, a 4px gap and the ⓘ glyph.

- 8px gap.

- **Figure:** tile figure (24/28, 600, tabular, ink). One line. Never
  truncated, never wrapped. The formatter never returns more than 10
  characters, which fits the 138px inner width at 390 (about 119px at
  24px tabular).

- 4px gap.

- **Source line:** T13, quiet, up to 2 lines (36px). It is a link-source
  (2.5).

- Height at 1440: 16 + 18 + 8 + 28 + 4 + 36 + 16 = 126, rounded up to
  the 128 min-height.

### 2.3 ⓘ rule (decision 1)

- Glyph: 16px outline circle-i, stroke 1.5, square ends, muted at rest,
  ink on hover and focus (110ms). Icon set per VISUAL_SYSTEM §9.

- Hit area: ::after { content:""; position:absolute; inset:-4px } gives
  24×24. Under @media (pointer: coarse) use inset:-14px for 44×44. The
  glyph's box is position: relative. The hit area must not overlap the
  label link text or the tile edge.

- Shown on 7 of 12 labels: Market capitalisation, Price / earnings, Book
  value per share, Dividend yield, ROCE, ROE, Face value. Not on Price,
  Change on the day, 52-week high, 52-week low, Price / book (their
  source lines already state the basis). S5 shows ⓘ on 12 of 12.

- Behaviour: a button with aria-label="About {label}", aria-expanded,
  aria-controls. Pointer fine: opens a popover on hover after 300ms or
  on focus, click or Enter pins it, Esc closes and returns focus. The
  popover does not follow the pointer. Touch: tap opens the bottom sheet
  (VISUAL_SYSTEM §4 "definitions").

- Popover: overlay surface, 1px line, padding 12, max-width 320, T13
  read. Content in this order: a definition of at most 140 characters;
  the basis used on this page; a Method ↗ link-source. If the definition
  needs a formula or more than 200 characters it goes to the 480px right
  drawer instead.

### 2.4 The twelve tiles

Format rules first. Price-style numbers: 2 decimals below 10,000, 0
decimals from 10,000, currency symbol first. Ratios: 1 decimal plus ×.
Percentages: 2 decimals for yields and day change, 1 decimal for ROCE
and ROE. Compact money: T, B, M with 3 significant figures (\$5.02T).
Zero is 0.00%. Not reported is —. Concept does not apply is Not
applicable. Computed but undefined (negative earnings) is Not
meaningful. The word, never a blank or a zero, with the reason in the
source line.

1.  **Price.** \$204.64. Source: Close, 30 Oct 2026 · Nasdaq GS · Yahoo
    Finance ↗ (external). No ⓘ.

2.  **Change on the day.** −4.22%. Source: −\$9.02 on the close of 29
    Oct 2026. No colour; the sign is the signal. No ⓘ.

3.  **Market capitalisation.** \$5.02T. Source: Shares as at 25 Jan 2026
    × \$204.64 on 30 Oct 2026. ⓘ. When a newer share count exists in a
    filing, use it and state its date (C3).

4.  **52-week high.** \$243.37. Source: Highest close, 52 weeks to 30
    Oct 2026, on {date}. Replaces "250 trading days" (C11). Say close or
    intraday, whichever the data is.

5.  **52-week low.** \$164.27. Same pattern.

6.  **Price / earnings.** 41.8×. Source: FY2026 earnings per share,
    ended 25 Jan 2026. ⓘ. Basis rule in D3.

7.  **Book value per share.** \$6.42. Source: FY2026, ended 25 Jan 2026.
    ⓘ.

8.  **Price / book.** 31.9×. Source: FY2026 book value, ended 25 Jan
    2026.

9.  **Dividend yield.** 0.02%. Source: Dividends of FY2026, ended 25
    Jan 2026. ⓘ. If the latest declared annual rate differs from the
    trailing-year rate by more than 25%, add a second source line: At
    the latest declared rate: {x.xx}% (C1).

10. **ROCE.** 74.7%. Source: FY2026, ended 25 Jan 2026. ⓘ. Banks: Not
    applicable, source Capital employed is not defined for banks.

11. **ROE.** 76.3%. Source: FY2026, ended 25 Jan 2026. ⓘ.

12. **Face value.** — when not reported. Source: Not reported in the
    filings. ⓘ. Never hidden: the grid stays 12.

### 2.5 Link-source style (CHANGE, D8)

Every source line is a link to the exact row or document: internal deep
links (/company/NVDA/financials#…, a filing) in the same tab, external
providers with a trailing ↗ glyph and rel="noopener". Rest: read text
with a 1px underline in line-control, offset 2px. Hover and focus: ink.
This keeps oxblood out of the many source links, so the five-word budget
is not spent before an edit (C4). Hit height at least 24px; on touch the
line has 8px vertical padding.

### 2.6 States

- **Loading:** after 200ms of waiting only, the label is shown with a
  static line-coloured block (28 high, 72 wide) where the figure goes.
  No shimmer, no spinner.

- **Error (one tile):** figure Unavailable (T15, quiet), source line
  Could not load. Try again as a link that re-requests that tile only.

- **First-load entrance:** tiles 1–5 fade in with translateY 8px→0,
  200ms --m-ease-enter, 50ms apart; tiles 6–12 start with tile 5's delay
  (200ms), so the last tile ends at 400ms. Once per company per session.
  Off under 640px and under reduced motion (section 5).

- **Never:** counting up, flashing on update, red or green figures, a
  verdict.

## 3. Price chart

### 3.1 Panel and sizes

- Panel padding 24 (phone 16). Title Price, Title-md.

- **Desktop 1440, top to bottom:** padding 24, title 26, gap 16, control
  row 32, gap 16, chart 360, gap 12, readout 24, gap 8, source line 18,
  Disclose row View data as a table 40, padding 24. Total 600.

- **Phone 390:** padding 16, title 26, gap 12, range row 44, gap 12,
  overlay row 44, gap 12, chart 260, gap 12, readout 24, gap 8, source
  line 36 (two lines), Disclose row 44, padding 16. Total 566.

- Control row, desktop: range control on the left; on the right the
  label Overlay (T13 muted), its ⓘ, and the overlay control. Below a
  1100px container it wraps to two rows.

- The chart container has a fixed height in every state (360 desktop,
  260 phone), so loading, empty, error and populated never shift the
  page (Stripe).

- Inside the container: top inset 8, plot height 320 (phone 220), axis
  zone 32 below the plot (baseline, 8 gap, 18 label, 6 slack).

- Left gutter: widest tick label plus 8, minimum 40, rounded up to a
  multiple of 4, recomputed only on range change. Right gutter: fixed 64
  (phone 52), reserved even with no overlay, so toggling an overlay
  never moves the price line.

- Plot width at 1440: 1296 − 48 − 64 = 1184. At 390: 310 − 40 − 52 =
  218.

### 3.2 Axes and gridlines

- **Left axis (S1).** Price in the listing currency. At most 5 tick
  labels on 1-2-5 steps. T13 quiet, right-aligned, 8px from the plot. A
  whole-number label prints without decimals (\$225, not \$225.0; C23).
  Decimals only when the tick step is below 1.

- **Y domain.** Visible min and max, each padded by 8% of the span, then
  extended to the nearest tick. The axis does not start at zero: Carbon
  states that line charts of stock activity may crop the axis.

- **Log scale (D9).** For 10Y and Max, when max ÷ min exceeds 20, use a
  log axis with 1-2-5 ticks and a T13 quiet note Log scale inside the
  plot at its top-left (8px, 4px). Everything else is linear.

- **Right axis (S2).** Appears with an overlay. It has the same number
  of tick intervals as the left axis, so every label sits on one of the
  same ≤5 gridlines. Domain: smallest nice interval covering the
  overlay's min and max, padded 8%. Labels are T13 in the S2 colour
  (7.58:1), 8px right of the plot, with the unit inside the label: 45×,
  \$215bn, 63%. No gridlines belong to the right axis.

- **Gridlines.** Horizontal only, 1px line, one per left tick, never
  more than 5, none vertical. Baseline 1px line. No tick marks.

- **X axis.** Labels T13 quiet, centred under their date. Ticks sit on
  calendar boundaries and never move to suit the data (Carbon). Step:
  for 1M, weeks (Mondays); otherwise the smallest of 1, 2, 3, 6, 12, 24,
  60 months that leaves at least 64px between label centres. If a weekly
  step is under 64px, double it.

- **X labels.** Month abbreviation (Nov). A new year replaces Jan with
  2026, and the first label carries its year (Nov 2025), both in weight
  600 (Carbon landmark labels). Weekly labels read 3 Oct. This removes
  S4's ambiguous Oct 25 and its uneven 3, 4, 3, 2-month spacing (C8).

- **Worked examples.** 1Y at 1440: monthly, 12 labels about 99px apart.
  1Y at 390: 6-month step (3 months would be 54px). 3Y at 1440: 2-month
  step. 5Y: 6-month. 10Y: 12-month.

### 3.3 Series and colour (VISUAL_SYSTEM §3.2)

- **S1, Price.** ink, 1.5px solid, stroke-linejoin: round. Fill below
  the line from 10% ink at the line to 0% at the baseline: the one
  gradient the system allows. The fill stops where the line breaks.

- **S2, Overlay.** \#C79A2E, 1.5px solid, no fill. One overlay at a
  time, so two series on the chart (target 3, cap 5).

- **End labels (only when an overlay is on).** Price in ink and the
  overlay name in the S2 colour, T13, right-aligned to the plot's right
  edge, 6px above each line's last point, drawn with paint-order: stroke
  and a 4px page stroke so they stay legible over a line. If the two
  labels are under 18px apart, the overlay label moves below its point.
  With no overlay the title names the series.

- **Last-point marker at rest:** 3.5px radius dot in the series colour.

- No green or red on this chart (nothing here encodes a sign). Every
  series is named in text; colour never carries meaning alone.

- Run deuteranopia and protanopia simulations before release.

### 3.4 Range chips

- Seven ranges kept from S4: 1M, 6M, 1Y, 3Y, 5Y, 10Y, Max. Default 1Y.
  StockAnalysis also offers 1D, 5D, YTD and 3M; not adopted here (no
  intraday data on this page, and eight chips on a phone would fall
  under 44px); deferred.

- One segmented control, role="radiogroup". Height 32 (phone 36 with a
  44px hit area). Outer border 1px line-control, inner dividers 1px
  line, label T13 muted, padding 0 12, min-width 44. Phone: the seven
  chips share 310px, 44.3px each.

- **Selected (CHANGE, finding 9):** panel ground, 1px accent border, ink
  label, weight 600. S4's maroon wash goes. Reserve the 600-weight width
  with a hidden ::after (attr(data-label), weight 600, height: 0;
  visibility: hidden) so the control never shifts.

- Hover: label ink, 110ms. Press: background line, 70ms. Focus: 2px ink
  outline, 2px offset, instant.

- Keyboard: arrows move focus (roving tabindex); Space or Enter selects.
  Arrowing never changes the range.

- If the company has less history than the range, the chip stays enabled
  and the chart shows what exists (3.7).

### 3.5 Overlay chips

- Overlay label T13 muted plus ⓘ (text: Draws one measure against its
  own axis on the right. Price keeps the left axis.).

- Chips: None, P/E, P/B, EV/EBITDA, Market cap/sales, Sales, Operating
  margin. One radio group with the same control spec as 3.4. Default
  None. Phone: the row scrolls horizontally inside itself; chips 36 high
  with 44 hit area.

- **CHANGE (D4).** S4's Sales and margin chip would put two measures
  with different units on one right axis, breaking the two-axis rule and
  one scale per line. Split into Sales and Operating margin.

- **Values are point-in-time.** Each date uses only the filings
  available on that date. Sales and Operating margin are step lines that
  change on the filing date. The four multiples divide that day's price
  (or value) by the latest filed figure.

- **Undefined is a gap, not a zero.** P/E with non-positive earnings and
  EV/EBITDA with non-positive EBITDA break the line. The readout says
  P/E not meaningful: earnings were negative.

- **Basis rule (D3).** The overlay's last value must equal the matching
  tile to within 0.05×. If the tile stays on the FY basis, the overlay
  is an FY step line; if the tile moves to trailing twelve months, so
  does the overlay.

- **Banks and no data.** EV/EBITDA is disabled for banks:
  aria-disabled="true", label quiet, no hover change, still focusable.
  Hover or focus opens a popover: Not applicable to banks: debt is part
  of how a bank operates. A chip with no underlying filings is disabled
  the same way, with its reason.

- **Toggling.** The S2 layer and right-axis labels fade in over 200ms
  (--m-dur-base, --m-ease-enter), opacity only. Off: 140ms on
  --m-ease-exit. The S1 line and left axis do not change.

### 3.6 Readout: hover, tap, keyboard

- Fixed row under the chart, 24px reserved at all times, T15. Format:
  date in read (30 Oct 2026), then Price (T13 quiet) and \$204.64 (T15,
  600, ink), then with an overlay on: a 16px sample of the S2 line, P/E
  and 41.8×. Series are identified by text and line sample, not colour
  alone.

- **At rest:** the last point of the visible range, 30 Oct 2026 ·
  \$204.64. Never a pinned older date (C7).

- **Pointer (fine):** crosshair is a 1px dashed read line (4/4), full
  plot height, at the data point nearest the pointer's x, with a 3.5px
  dot per series. Readout and crosshair update on the pointer's frame
  with no transition. No tooltip follows the pointer. Leaving the plot
  returns to the last point at once.

- **Touch:** touch-action: pan-y on the plot. Press and drag
  horizontally to scrub; a tap sets a point, which stays until a tap
  outside the plot or on the point again. Target: the whole plot (320
  desktop, 220 phone).

- **Keyboard:** wrapper tabindex="0", role="group", aria-label="Price
  chart, 1 year to 30 Oct 2026". Left and Right move one point;
  Shift+arrow five; Page Up and Page Down 21 points (about a month);
  Home and End jump to the first and last point. Focus ring 2px ink, 2px
  offset. The readout is aria-live="polite", announced for keyboard
  moves only, at most once per 500ms.

- **On a gap:** No data 3 Mar – 19 Mar 2026 (12 trading days) replaces
  the values. Both ends of the gap are named (Carbon).

### 3.7 States

- **Loading.** After 200ms of waiting: a static frame (five gridlines,
  axis labels as —, centred Loading prices T15 quiet) at the same fixed
  height. No spinner, no shimmer.

- **Empty.** Same frame with No price history for {name}. (T15 read) and
  one T13 quiet reason line, e.g. This company has no listed shares in
  our data. Range and overlay controls stay, aria-disabled.

- **Error.** Prices did not load. {Provider} returned an error at 12:34
  UTC. and a ghost button Try again. One request per press; no
  auto-retry loop.

- **Short history.** Draw what exists; the x axis starts at the first
  date; a line under the chart says History starts 14 Mar 2022.

- **Stale.** If the last price is older than the previous trading day,
  the banner in 1.9 appears and the chart ends on that date (Koyfin).

- **Gaps (Carbon, TradingView).** Expected trading days come from the
  listing exchange's calendar; weekends and exchange holidays are not
  gaps. Any missing expected trading day breaks the line and the fill;
  no bridging segment. A gap of 4 or more consecutive expected days also
  gets a band: a 1px line hatch at 45°, 8px pitch, full plot height,
  edged by two 1px dotted quiet verticals (1.5/3.5). The readout names
  both ends.

- **Source line (T13 quiet).** Prices: Yahoo Finance ↗ · closing prices
  · adjusted for splits, and it must say whether dividends are adjusted.
  This is mandatory: 10Y and Max cross splits such as NVIDIA's June 2024
  10-for-1.

- **View data as a table** (Disclose, 40 high). Complete table of the
  visible range: date, close, overlay value. Container max-height 320,
  sticky header row, tabular numerals, rows render complete with no
  animation. Carbon names a data table as the accessible alternative.

### 3.8 First-load draw-in (VISUAL_SYSTEM tokens only)

- Plays once per page view, on the chart's first mount. The chart mounts
  when within 200px of the viewport (IntersectionObserver, rootMargin:
  200px), so the draw-in is actually seen.

- Container clip-path: inset(0 100% 0 0) to inset(0 0 0 0) over
  --m-dur-chart (640ms) on --m-ease-enter. Then the S1 fill fades in:
  opacity 0 to 1 over --m-dur-base (200ms). Total 840ms (D7:
  VISUAL_SYSTEM also caps page-load sequences at 600ms).

- Axes, gridlines, labels and the readout are present from frame 0; only
  the data draws in.

- Never on hover, range change, overlay toggle, data refresh, resize or
  returning to the tab.

- Range change: 110ms opacity crossfade (--m-dur-fast,
  --m-ease-standard). The new layer, axes included, fades in while the
  old fades out, then the old unmounts. No path tweening and no number
  tweening.

- Under 640px, on low-end devices and under reduced motion: no draw-in;
  the chart is visible at once.

- Resize: re-render on the next animation frame from a ResizeObserver,
  no transition.

### 3.9 Chart accessibility

- \<svg role="img"\> with aria-labelledby pointing to a title and a
  description generated from the data: range, first and last close, high
  and low with dates, percentage change, and any gaps.

- All SVG text at least 13px. Every non-text mark at least 3:1 against
  panel: ink, the S2 amber (7.58) and the read crosshair all pass.
  Pointer targets at least 24×24 (44×44 coarse).

## 4. Risk and cost of capital card

### 4.1 Anatomy

Panel with four blocks separated by 1px line dividers (24px padding
each): (1) headline pair, (2) input rows, (3) Beta, measured here, (4)
value per share. Header row: Title-md Risk and cost of capital; at the
right estimates, not facts, T13 muted, in a 1px line box, padding 4 8.
It is a tag, not a pill, and carries no colour.

### 4.2 Headline pair (S3)

- Desktop: two equal cells in one bordered grid. Phone: stacked.

- Cell: label T13 muted plus ⓘ; hero figure (40/44); formula line T13
  muted.

- Cost of equity 8.73%, formula 4.26% risk-free + 1.001 × 4.46% premium.
  WACC 8.72%, formula 99.83% equity at 8.73% + 0.17% debt at 3.96% after
  tax.

- **Rounding rule (C14).** The formula must reproduce the headline from
  the numbers it shows. The formatter prints each input with the fewest
  decimals (2, then 3, then 4) for which recomputing from the displayed
  inputs rounds to the headline, and never more than 4. S3 fails: 4.26 +
  1.001 × 4.46 = 8.72, not 8.73.

- Weights in the formula use 2 decimals, matching the Weights row.

- Banks: the WACC cell reads Not applicable with its reason, and the
  cost-of-equity cell spans both columns (4.8).

### 4.3 Input rows

Desktop grid: grid-template-columns: 224px 144px 104px minmax(0, 660px);
column-gap: 24px. Row padding 16 0, 1px line between rows. Phone:
stacked in the order label, value or input (44 high), status, source.

- **Label.** T15 muted. The ⓘ sits 4px after the text, not at the column
  edge (S3 floats it 60px away on wrapped labels; C13). Labels are
  short: Equity risk premium; the "total, country included" qualifier
  moves into the source text.

- **Value.** T15 ink, weight 400 (as in finding 2), tabular,
  right-aligned to the column edge so decimals line up (C33). Editable
  rows show an input instead (4.4).

- **Status.** T13 quiet: default, measured, included in total, edited.
  Replaces S3's red-bordered included box (C10).

- **Source cell.** Line 1, T13 muted: {Provider} · as at {date}, then
  {n} days before the price date only when over 90 days, then what the
  figure is, then a link-source Source ↗. Line 2, T13 read, tabular: the
  arithmetic. Line 3, T13 quiet: cross-check or terms. A fact is stated
  once (S2 says the interest coverage twice; C20). Left-aligned,
  hyphens: manual, text-wrap: pretty, max 660px (C16).

The eight rows:

1.  **Risk-free rate.** 4.26%. Editable, 2 dp, −1.00% to 15.00%. Source:
    US Treasury · as at 23 Jan 2026 · 280 days before the price date ·
    10-year par yield, mean of 248 daily readings, 27 Jan 2025 – 23
    Jan 2026. Terms: a work of the US government, in the public domain.

2.  **Beta.** 1.001. Editable, 3 dp, 0.000 to 5.000. Status default.
    Source: Marginalia · as at 30 Oct 2026 · asset beta 1.00 relevered
    on debt/equity 0.2%. Line 3: Measured 2.248 over 5 years of monthly
    returns, not used. See Beta, measured here, the last phrase a link
    to \#beta-measured (C15).

3.  **Equity risk premium.** 4.46%. Editable, 2 dp, 0.00% to 15.00%.
    Source: Aswath Damodaran, NYU Stern · as at 5 Jan 2026 · 298 days
    before the price date. Line 2: 4.23% mature + 0.23% country = 4.46%.
    After an edit: Set by you; was 4.23% + 0.23%.

4.  **Country risk premium.** 0.23%. Read-only. Status included in
    total. Source: United States, Moody's Aa1, as at 5 Jan 2026. Counted
    by country of incorporation until revenue-by-country data exists.

5.  **Cost of debt.** 4.66%. Editable, 2 dp, 0.00% to 30.00%. Line 2:
    4.26% risk-free + 0.40% spread = 4.66%. Provenance: Damodaran, as at
    Jan 2026, synthetic Aaa/AAA rating from interest coverage of 503.4×
    in FY2026. Line 3: Historical effective rate 2.67%: interest over
    average borrowings. What it has paid, not what it would pay. Method
    ↗ (replaces S2's "(rule 18)"; C17).

6.  **Tax rate.** 15.12%. Editable, 2 dp, 0.00% to 50.00%. Source:
    Company filings · FY2026 · reported tax over reported pre-tax
    profit. Line 3: Statutory rate in the United States 25.00%
    (Damodaran, 5 Jan 2026).

7.  **Weights.** 99.83% equity · 0.17% debt. Read-only. Source: Equity:
    market capitalisation \$5,016,545m = shares as at 25 Jan 2026 ×
    \$204.64 on 30 Oct 2026. Debt: borrowings \$8,468m at book value, 25
    Jan 2026. Two dates, never "both at one date" (C6).

8.  **Share price.** \$204.64. Read-only. Source: Nasdaq GS · close 30
    Oct 2026 · USD.

All input bounds are PROPOSED.

### 4.4 Editable inputs

- **Editable:** risk-free rate, beta, equity risk premium, cost of debt,
  tax rate. **Not editable:** country risk premium (a component of the
  premium), weights and share price (derived or quoted).

- **Control.** A text input with inputmode="decimal", not type="number"
  (no spinners). Width 104, height 32 (44 on coarse pointers), 1px
  line-control border, radius 0, panel ground, T15 ink, text
  right-aligned and tabular, the unit (%) inside the box in quiet. The
  visible label is the row label via \<label for\>; the source cell is
  aria-describedby.

- **The dotted underline on values in S2 and S3 goes** (decision 1, C5).
  A value with no box is not editable.

- **Commit** on Enter or blur; Esc reverts to the last committed value.
  Format to the row's decimals on commit. Accept , or . as the decimal
  mark.

- **Invalid.** The box keeps its line-control border, because an accent
  border means selected. An error line below, T13 accent-text: Enter
  0.000 to 5.000. The model keeps the previous valid value.

- **Reset.** A text button Reset (T13, read, 1px underline) appears
  beside an edited input with status edited. Reset all is a ghost
  button, 32 high, in the value block.

### 4.5 How an edit and its effect on value are shown

On commit:

1.  The engine recomputes. The value per share swaps instantly, with no
    tween. The edited input's figure and the value per share figure turn
    accent-text over --m-dur-fast (110ms, colour only). These are the
    only two accent-text words; any earlier edited input returns to ink
    and keeps its edited status.

2.  Under the hero value, the joint effect: −\$9.31 (−7.3%) against
    \$127.48 at default inputs. Sign always shown. With nothing edited:
    No inputs edited. Default inputs. (All numbers here are
    illustrative, not engine output.)

3.  In the edited row's status cell, T13 read: On its own: −\$9.31
    (−7.3%), the effect of that input with all others at default. Joint
    and solo effects together show who did what when several inputs
    change.

4.  A line lists the edits: Edited: Beta 1.001 → 1.832 · Tax rate 15.12%
    → 21.00%, followed by Reset all.

5.  Screen readers: aria-live="polite" announces Value per share is now
    \$118.17, 7.3% lower than at default inputs.

6.  Recompute slower than 200ms: the old value stays, with Recomputing
    for the new inputs (T13 quiet) beneath it and aria-busy="true". No
    spinner. On failure: Could not recompute. The value shown is for the
    previous inputs. in accent-text. A value that does not match the
    displayed inputs is never shown without saying so.

7.  Persistence is open (D6). Either way, T13 quiet words say Saved to
    your model or Not saved.

S1 shows \$127.48 with no default to compare against, so the effect of
an input cannot be read from the page (C32). The default value and the
effect line fix that.

### 4.6 Beta, measured here (S1)

Anchor id="beta-measured". Heading T15, 600, ink: Beta, measured here.
Line T13 muted: Against the S&P 500, as at 30 Oct 2026. One row per
regression (desktop columns: description \| stats \| choice).

- **Description.** 5 years, monthly, T15, 600, ink.

- **Stats.** T13 muted, tabular: 59 returns · R² 50.5% · standard error
  0.295 · 30 Nov 2021 – 30 Oct 2026. The same figure everywhere: 0.295
  (S1's warning prints 0.29; C19).

- **Choice.** One segmented control, 32 high (44 touch): Raw 2.248 \|
  Adjusted 1.832 (CHANGE; S1's two unlabelled use buttons, C18). ⓘ on
  Adjusted: Blume adjustment: two-thirds of the measured beta plus
  one-third of 1.0. Selected state per VISUAL_SYSTEM §3.1. No segment is
  selected while the default is in use.

- **Effect preview** beside each segment, T13 read: value \$118.17
  (−7.3%), computed solo by the engine before any click (PROPOSED). The
  four alternatives are computed once per page load.

- **The model line.** The model is using {value} ({source}), where
  source is default, measured, 5 years monthly, raw, measured, 2 years
  weekly, adjusted or typed by you. A text button Back to default 1.001
  appears when not default.

- **No bottom-up beta.** Keep the paragraph, max 600px: No bottom-up
  beta: a derived company has no comparable set. Where a peer set exists
  it is the average unlevered beta of the peers, relevered on this
  company's own debt and equity.

- **Why the default stays at 1.0.** A Disclose row, closed. It keeps
  S1's argument, and its claims (median 2%, up to 515%) link to the data
  behind them (C21).

### 4.7 Warnings: weak beta fit

- **Rule (PROPOSED, D5).** A regression row warns when standard error is
  0.25 or more, or R² is under 30%, or fewer than 80% of expected
  returns exist. The 5-year monthly row (SE 0.295) trips it. The 2-year
  weekly row (SE 0.189, R² 48.8%, 104 returns) does not, which matches
  S1. The rule is printed in the warning, so the threshold is visible.

- **Block** under the row: a 16px outline triangle icon (stroke 1.5,
  square ends) in muted; the words Weak fit (T13, 600, ink); then T13
  read: Standard error 0.295 on a beta of 2.248: two standard errors
  either side gives 1.66 to 2.84. A fit this loose can move value per
  share a long way on little evidence. Flagged when standard error is
  0.25 or more, R² is under 30%, or fewer than 80% of expected returns
  exist.

- Colour carries nothing; the icon and words do. 2px line-control left
  rule, no wash.

- A weak fit never disables a choice. If a weak-fit beta is selected,
  weak fit is appended to the model line.

### 4.8 Banks and Not applicable

The card renders what the engine returns (applicable: false) and never
prints a computed zero.

- Cost of debt, Weights and the WACC headline: Not applicable (T15,
  quiet). Reason in the source cell: Not applicable to banks: deposits
  and borrowings fund lending, so debt is not a financing choice
  separate from operations.

- Beta row: Asset beta 1.00, not relevered: debt is operating for a
  bank.

- Cost of equity spans both headline columns. The EV/EBITDA overlay is
  disabled (3.5). The ROCE tile reads Not applicable (2.4).

- Value per share: the engine's bank-method value if it returns one;
  otherwise Not applicable on the perpetuity method for banks with
  Method ↗ (D10).

- Three distinct words, never mixed: — not reported; Not applicable the
  idea does not apply; Not meaningful it applies but is undefined.

### 4.9 Value per share block

Divider above, padding 24. Label T13 muted: Value per share at these
inputs. Hero figure \$127.48. Effect line (4.5). T13 quiet: Perpetuity
method, recomputed from these inputs by the engine. Method ↗. Desktop,
at the right (T15): Quoted price \$204.64 and Price ÷ value 1.61×: a
ratio with no verdict word. Phone: stacked.

### 4.10 Phone (390)

- Headline cells stacked, hero 40/44.

- Each row stacks label + ⓘ, input or value (44 high), status, source
  (T13, full width).

- Beta regression rows stack. The segmented control is full width, two
  segments of 155 each, 44 high, with effect previews under each
  segment.

- The weak-fit block is full width.

## 5. Motion and reduced motion

Only transform, opacity and (chart reveal only) clip-path animate, plus
color, border-color and background-color on hover, press and the changed
figure, and height on Disclose. transition: all is banned. Every
duration and easing is a --m-\* token; no literals.

### 5.1 What moves

- **Tab switch inside a company:** instant swap. Header, panel frame and
  tab row never move.

- **Route into the company page:** main content region only, opacity and
  translateY 8px to 0; out 120ms --m-ease-exit, in 280ms --m-ease-enter.
  Skeleton only after 200ms of waiting.

- **Tile entrance:** 200ms --m-ease-enter, opacity and translateY 8px to
  0, 50ms stagger on tiles 1–5, none after; total at most 400ms; once
  per company per session.

- **Chart draw-in:** 640ms clip-path, then 200ms fill fade (3.8). Once
  per page view.

- **Range change:** 110ms opacity crossfade. **Overlay on:** 200ms fade
  in. **Overlay off:** 140ms on --m-ease-exit.

- **Hover** (chips, tabs, links, ⓘ, tile border): 110ms
  --m-ease-standard, colour properties only. No lift, scale or shadow.

- **Press** on chips: background line, 70ms.

- **Focus ring:** 0ms, never animated.

- **ⓘ popover:** opacity only, 110ms in, 77ms out (70% of enter,
  --m-ease-exit). **Touch definitions** use the bottom sheet: 280ms in,
  200ms out; scrim fades over 240ms; focus trapped; Esc closes.
  **Desktop long definitions** use the 480px right drawer with the same
  timings.

- **Disclose** (About, table, why-default, sources on phone): height and
  opacity 200ms in, 140ms out; chevron 0 to 90 degrees; body indented
  24.

- **Changed figure** after an edit: colour to accent-text over 110ms;
  the number itself swaps instantly.

- **Crosshair and readout:** no animation; they follow the pointer on
  its own frame.

### 5.2 What never moves

No number tweens or counts up. No flashing or colour change on a price
or ratio update. No skeleton shimmer, no spinner, no looping animation.
No redraw on data refresh or window resize. No staggers beyond 5 items.
No tooltip that follows the pointer. No table row animation. No
scroll-linked effect on this page except the header's scroll-progress
rule (transform only, passive).

### 5.3 Reduced motion

Applies under prefers-reduced-motion: reduce and under the Settings
override data-motion=reduced.

- Transforms and travel go to 0. All transitions become opacity-only and
  no longer than 110ms.

- Chart draw-in and tile stagger are skipped; content is visible at
  once.

- Range crossfade stays (opacity, 110ms). Overlay fade shortens to 110ms
  both ways.

- Disclose snaps with the chevron rotating instantly. Sheets and drawers
  appear with a 110ms fade. Smooth scrolling off.

- JavaScript-driven motion (chart reveal, crosshair easing if any)
  subscribes to the media query's change event, because CSS overrides
  cannot reach it.

### 5.4 Phone and low-end (under 640px, or any low-end signal in VISUAL_SYSTEM §8)

- No tile stagger, no chart draw-in, no hover transitions on touch, no
  parallax.

- Page transition is opacity only, 120ms.

- Header blur and scrim blur dropped (page at 98%, scrim 0.72 flat).

- At most 2 elements animating at once; script per frame at most 8ms.

## 6. Conflicts in the current screenshots

Severity as in VISUAL_SYSTEM: **H** breaks a stated rule or hurts data
trust; **M** inconsistency; **L** polish. Screens: S1–S5 as defined in
section 0.

### 6.1 High

- **C1 (S5) Dividend yield 0.02%.** It uses FY2026 dividends.
  StockAnalysis, checked 1 Nov 2026, shows a \$1.00 annual dividend,
  0.49%, ex-dividend 10 Sep 2026: about 25 times the tile. The basis is
  stated, but the headline understates the yield a reader would earn
  today. Fix: add the declared-rate line (2.4, tile 9) and a Dividends
  row in the freshness table. **H**

- **C22 (S5, global header) Red-washed Search, clock with seconds and
  live dot (07:04:41 UTC).** Findings 4, 5 and 6 of VISUAL_SYSTEM, still
  present. Fix per those findings; the As of stamp in 1.4 replaces the
  clock. **H**

### 6.2 Medium

- **C2 (S5) P/E 41.8× on FY2026.** StockAnalysis shows 25.88 on trailing
  twelve months. Labelled, but nine months stale, and a P/E overlay on a
  trailing basis would disagree with the tile on the same page (D3).
  **M**

- **C4 (S2, S3) Oxblood source links.** Four or five per card viewport.
  It fits the five-word budget only until an edit adds the
  changed-figure words. Fix: link-source style (2.5). **M**

- **C5 (S2, S3) Dotted underlines under 4.26%, 1.001, 4.46%, 0.23%.**
  Contradicts decision 1 and signals nothing. Editable values become
  boxed inputs (4.4). **M**

- **C6 (S2) Weights.** The row says the filings and quote are "both at
  one date" (30 Oct 2026), but market cap uses the 25 Jan 2026 share
  count (5,016,545 ÷ 204.64 = 24.51bn shares; StockAnalysis shows
  24.15bn) and debt is from the filings. The figure 99.83% has no unit
  label. Fix: 4.3 row 7. **M**

- **C7 (S4) Readout at rest shows 31 Dec 2025, \$186.50** with a pinned
  dot. If that is the resting state it contradicts "latest first"; if it
  is a hover capture, the pointer is invisible so I cannot tell. Fix:
  rest state is the last point (3.6). **M**

- **C8 (S4) X axis.** Labels Oct 25, Jan 26, May 26, Aug 26, Oct 26 sit
  about 293, 301, 312 and 277px apart (converted) but span 3, 4, 3 and 2
  months. Oct 25 reads as 25 October. Carbon: never change tick
  increments to suit the data. Fix: 3.2. **M**

- **C9 (S2, S3, S4, S5) Four date formats on one page:** January 5,
  2026, 2026-01-25, 25 January 2026, 31 Dec 2025. One format: 30
  Oct 2026. **M**

- **C10 (S2, S3) included tag with a red border.** A 1px accent border
  means selected; this is a status. Fix: quiet status text (4.3). **M**

- **C12 (S5, S1) About text.** The opening sentences match
  StockAnalysis's description word for word, and S5 shows no source
  line. Confirm the licence and add the source line (1.8). **M**

- **C13 (S3) ⓘ detached from its label.** On the wrapped Equity risk
  premium (total, country included) the glyph sits about 67px after the
  label. Fix: 4.3. **M**

- **C14 (S3) Cost of equity does not recompute.** 4.26% + 1.001 × 4.46%
  = 8.72%, the card says 8.73%. Fix: rounding rule (4.2). **M**

- **C16 (S1–S3) Justified text with automatic hyphenation**
  (bor-rowings, re-ported, de-fault, read-ings), and inconsistent
  measure: No bottom-up beta runs about 1,615px while neighbouring
  paragraphs stop at about 615px. Left-align, hyphens: manual,
  600–660px. **M**

- **C17 (S2) (rule 18).** An internal reference shown to readers.
  Replace with a Method link. **M**

- **C18 (S1) Two outlined use 2.248 and use 1.832 buttons per period.**
  They do not say raw or adjusted and show no selected state (finding
  12). Fix: 4.6. **M**

- **C21 (S1) Unsourced claims.** median 2% and as much as 515% have no
  link or date, against "every number links to its source". **M**

- **C24 (S1, S3) Hero figures look serif** (8.73%, 8.72%, \$127.48).
  Finding 14: figures are Source Sans tabular. Confirm the computed
  font. **M**

- **C25 (S5) ⓘ on 12 of 12 tiles, glyph about 13px, target under 24px.**
  Fix: 7 of 12, 24×24 (44×44 coarse) (2.3). **M**

- **C26 (S4) 1Y and None chips use a maroon wash and red border**
  (finding 9). Fix: 3.4. With the red Search that is three washes, the
  whole budget, before any primary action. **M**

- **C27 (S5) Container.** Panels run 112–1793px at a 1917px viewport:
  1680px wide, against content max 1440 with gutters. See D2. **M**

- **C28 (S5) Price and Change tiles carry no date or basis.** Freshness
  lives only in the header clock. Fix: 2.4 tiles 1 and 2. **M**

- **C31 (S3) Three as-at dates in one calculation, none flagged:**
  risk-free 23 Jan 2026 (280 days before the price date), premiums 5 Jan
  2026 (298), price and beta 30 Oct 2026. A 248-day average also differs
  from a spot rate. Fix: age text and the freshness table (1.9, 4.3).
  **M**

- **C32 (S1) \$127.48 with no default to compare.** The effect of any
  input cannot be read. Fix: 4.5. **M**

### 6.3 Low

- **C3 (S5, S2) Market cap \$5.02T uses the 25 Jan 2026 share count.**
  StockAnalysis: 4.94T on 24.15bn shares; about 1.5% lower. Labelled;
  use the latest filed count and state its date. **L**

- **C11 (S5) 250 trading days** for a 52-week window (about 252). State
  the calendar window. **L**

- **C15 (S3) see below is plain text.** Make it an in-page link. **L**

- **C19 (S1) Standard error is 0.295 in the row and 0.29 in the
  warning.** One figure. **L**

- **C20 (S2) The interest-coverage sentence appears twice** in the cost
  of debt cell. **L**

- **C23 (S4) Y labels \$225.0, \$200.0, \$175.0.** Whole numbers print
  without .0. **L**

- **C29 (S5) Ticker NVDA in oxblood; company name about 20px,** the same
  as panel titles. Ticker to muted eyebrow; name 28/34 (1.4). **L**

- **C30 (S5) Face value — with no explanation.** Source line Not
  reported in the filings (2.4). **L**

- **C33 (S3) Left-aligned values with different decimals** (4.26%,
  1.001). Right-align, tabular (4.3). **L**

### 6.4 Already right: do not change

- Tab row hairlines match the container edges (S5): finding 11 is fixed
  on this page.

- Minus sign is U+2212 (−4.22%). Grouping follows the currency (USD uses
  5,016,545).

- Chart: three gridlines, no vertical ones, readout fixed under the
  chart, a source line under the chart, a gradient fill only under the
  price line.

- Formula lines under headline figures, provenance on every input row,
  an estimates, not facts tag, cross-check lines (2.67% effective rate,
  25.00% statutory).

- Beta cross-check: measured 2.248 (5 years, monthly) is close to the
  2.22 published by StockAnalysis; the Blume-adjusted figures (1.832 and
  1.577) match two-thirds of the raw beta plus one-third.

## 7. Developer checklist

Test at 1440 and 390, Chrome and Safari, with the NVDA fixture as of 30
Oct 2026, unless stated.

### 7.1 Layout and type

- **L1** Container max-width 1440; content width 1344 at 1440 and 342 at
  390.

- **L2** Company content starts at y = 88 on desktop and y = 80 on
  phone; scroll-padding-top is 88.

- **L3** Panels: 1px line border, radius 0, no shadow; panel gap 24
  (phone 16); padding 24 (phone 16).

- **L4** No hairline or band extends beyond the content edges at any
  width.

- **L5** Computed font sizes are 13, 15, 20, 24, 28 or 40 only; none
  under 13, including SVG text.

- **L6** Every figure uses tabular lining numerals, ink, Source Sans 3;
  no figure in Newsreader.

- **L7** Glyphs: U+2212 minus, U+00D7 times, never x or hyphen as minus.

- **L8** One date format, 30 Oct 2026, everywhere on the tab.

- **L9** Header: ticker muted, h1 28/34, no clock, no seconds, no live
  dot, stamp shows close date and time in UTC.

- **L10** Tab row 48 high; current tab ink, 600, 2px accent bottom
  border; no oxblood on other tabs; row scrolls inside itself on phone
  with the next tab visibly clipped.

- **L11** Tab switch does not animate and the header and tab row do not
  move.

- **L12** Data freshness shows the six fixture rows with ages 0, 278,
  278, 280, 298, 0 days; rows over 90 days say over 90 days and carry no
  colour.

- **L13** With a last price older than the previous trading day, the
  stale banner appears and the chart and 52-week range end on that date.

- **L14** Every Terms cell in Where this came from is filled or says
  Terms not stated.

### 7.2 Tiles

- **T1** Twelve tiles in the fixed order; 4 × 3 at 1440 (each 336 wide,
  128 min-height), 2 × 6 at 390 (each 171).

- **T2** No figure exceeds 10 characters and none truncates or wraps at
  390.

- **T3** ⓘ appears on exactly 7 labels; hit area measures 24×24 on
  desktop and 44×44 under pointer: coarse, and does not overlap the
  label text.

- **T4** Every tile has a source line that is a working link; external
  links carry ↗.

- **T5** Price tile shows Close, 30 Oct 2026; Change tile shows the
  absolute change and prior close date.

- **T6** Dividend yield shows the declared-rate line when the two rates
  differ by over 25%.

- **T7** Not reported renders —; not applicable renders Not applicable;
  negative earnings render Not meaningful with the reason. No blank, no
  zero.

- **T8** Tile hover changes only border-color to quiet at 40% in 110ms.
  No lift, scale or shadow.

- **T9** Stagger: tiles 1–5 start at 0, 50, 100, 150, 200ms; tiles 6–12
  start at 200ms; last finishes by 400ms; once per company per session;
  absent at 390 and under reduced motion.

### 7.3 Chart

- **H1** Container height is 360 (260 at 390) in loading, empty, error
  and populated states; the page does not shift between them.

- **H2** Left axis has at most 5 labels and gridlines; no vertical
  gridlines; labels at least 13px quiet; whole-number ticks have no .0.

- **H3** X ticks fall on calendar boundaries; intervals are equal in
  time; Oct 25-style labels do not occur; the year is semibold at each
  January and on the first label.

- **H4** Right gutter is 64 (52) with and without an overlay; the S1
  line does not move when the overlay toggles.

- **H5** With an overlay on, the right axis shows the same number of
  intervals as the left and its labels line up with the same gridlines.

- **H6** Colours: S1 ink 1.5px solid; S2 \#C79A2E 1.5px solid; fill 10%
  ink to 0 under S1 only; no red or green.

- **H7** Range and overlay controls: 32 high (44 hit area on touch);
  selected = panel ground, 1px accent border, ink, 600; no wash; no
  layout shift when selection changes.

- **H8** The seven range chips fit 310px at 390 (44.3 each). Sales and
  margin does not exist; Sales and Operating margin do.

- **H9** Overlay last value equals the matching tile value within 0.05×
  (P/E) or the tile's displayed precision.

- **H10** Hover: crosshair snaps to the nearest data x; readout updates
  with no transition; no floating tooltip; pointer leave restores the
  last point.

- **H11** Resting readout shows 30 Oct 2026 · \$204.64.

- **H12** Keyboard: arrows, Shift+arrows, Page Up and Page Down, Home
  and End move the readout; focus ring is 2px ink with 2px offset;
  live-region announcements are throttled to one per 500ms.

- **H13** A missing expected trading day breaks the line and the fill; a
  gap of 4 or more days shows the hatch band and both ends in the
  readout; weekends and exchange holidays are not gaps.

- **H14** Negative earnings produce a P/E gap and the readout says why.

- **H15** Empty, error and short-history states render with the
  specified words; Try again makes one request.

- **H16** Draw-in: clip-path 640ms then fill fade 200ms, first mount
  only, not on range change, overlay toggle, resize or refresh. Absent
  at 390 and under reduced motion.

- **H17** Range change is a 110ms opacity crossfade; no path or number
  tween.

- **H18** View data as a table lists every point of the visible range
  and is reachable by keyboard.

- **H19** Source line states close prices and the split and dividend
  adjustment.

- **H20** Under deuteranopia and protanopia simulation, price and
  overlay remain distinguishable by label and line sample.

### 7.4 Cost-of-capital card

- **K1** The headline formulas recompute to the headline: for the
  fixture, shown inputs reproduce 8.73% (so inputs print with enough
  decimals) and WACC 8.72%.

- **K2** Eight rows in the stated order; ⓘ within 4px of the label text;
  values right-aligned and tabular.

- **K3** Editable: risk-free, beta, equity risk premium, cost of debt,
  tax rate. Each is a boxed input with a line-control border (at least
  3:1); no other value has a dotted underline or a box.

- **K4** Commit on Enter or blur; Esc reverts; out-of-range shows the
  error line and keeps the previous value; the box border stays
  line-control.

- **K5** After an edit: value per share swaps instantly; the edited
  input and the value turn accent-text in 110ms; at most two accent-text
  words from this feature are on screen; the effect line shows sign,
  dollar change, percent change and the default value.

- **K6** The edited row shows On its own effect; Reset restores that
  input; Reset all restores all and the effect line returns to No inputs
  edited.

- **K7** A recompute over 200ms shows Recomputing for the new inputs
  with aria-busy; a failure shows the error line and keeps the old value
  labelled as previous.

- **K8** Beta block: two segmented controls (Raw and Adjusted) with
  effect previews; none selected at default; the model line names its
  source; Back to default appears when changed.

- **K9** Weak-fit warning shows for the 5-year row (SE 0.295) and not
  for the 2-year row (SE 0.189, R² 48.8%); it states the 1.66 to 2.84
  interval and the threshold; it does not disable a choice.

- **K10** Banks: cost of debt, weights, WACC and ROCE read Not
  applicable with a reason; EV/EBITDA is disabled with a reason; no zero
  is displayed.

- **K11** Source cells contain no rule 18 text; all source links are
  read-coloured underlined links; text is left-aligned with manual
  hyphenation, max 660px.

- **K12** At 390: rows stack, inputs are 44 high, no horizontal scroll.

### 7.5 Accessibility, motion and budgets

- **A1** Every pointer target is at least 24×24 (44×44 coarse); ⓘ, chips
  and Reset included.

- **A2** Focus: 2px solid ink, 2px offset, keyboard only; focused
  elements never sit under the fixed header or bottom bar.

- **A3** Colour contrast for every token on every ground it appears on,
  including quiet on panel and overlay, and the S2 amber on panel.

- **A4** Layout reflows at 320px and at 200% text zoom with no
  horizontal page scroll.

- **A5** No transition: all; no animation of any property outside the
  allowed list; no duration or easing literal outside --m-\*.

- **A6** Reduced-motion pass at 360 and 1440: no transforms, no draw-in,
  no stagger, all fades at most 110ms.

- **A7** At most 5 accent-text words and 3 oxblood fills or washes in a
  1440×900 viewport at any scroll position, at rest and after an edit.

- **A8** No element on the tab animates after first load apart from the
  items in 5.1.

## 8. Decisions I need from you

- **D1** DESIGN.md was not uploaded. Map my 20, 28 and 40 sizes onto its
  four steps plus the 24px tile figure; if it has fewer steps, tell me
  which to merge.

- **D2** I read "content max 1440px with 24px gutters (48px at lg)" as a
  1440px container including gutters (content 1344). S5 renders content
  1680px wide. Confirm.

- **D3** P/E, price / book, ROE, ROCE, dividend yield and market cap are
  on FY2026 (to 25 Jan 2026). Do you want trailing twelve months once
  interim filings exist? The P/E overlay must follow whatever you
  choose.

- **D4** Splitting Sales and margin into Sales and Operating margin is a
  CHANGE. Alternative: keep one chip and draw margin in a small pane
  below.

- **D5** Weak-fit thresholds (standard error 0.25, R² 30%, 80% of
  returns) are mine. Data team to confirm.

- **D6** Are edits saved to the model draft, the session, or nowhere?
  The card needs one of three wordings.

- **D7** VISUAL_SYSTEM's chart draw-in (640 + 200 = 840ms) exceeds its
  own 600ms page-load cap. I followed the draw-in row. To obey the cap,
  use 400 + 200.

- **D8** Source links as underlined read text (not oxblood) is a CHANGE
  to link style.

- **D9** Log scale on 10Y and Max when max ÷ min exceeds 20.

- **D10** Engine behaviour for banks (applicable flags and any value per
  share method) was not in the upload. Needs the engine owner.
