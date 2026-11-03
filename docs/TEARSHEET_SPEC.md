# TEARSHEET_SPEC — the one-pager and the two-pager (build step 6)

Marginalia · per-company tearsheet · v0.1 (plan, no code) · 3 November 2026 ·
sits beneath `CLAUDE.md`, `DESIGN.md`, `docs/VISUAL_SYSTEM.md` (with its 30
October decisions), `docs/COMPANY_OVERVIEW_SPEC.md` (with its 1 November
decisions) and `docs/VALUATION_SIDE_BY_SIDE_SPEC.md`.

Covers: what goes on a one-page and a two-page company tearsheet, the exact A4
and US Letter layouts, the print palette, the on-screen view, the rules every
page obeys, how the file is made, five reference tearsheets, and the build in
small jobs. PowerPoint is planned for later (job 12) and only sketched here.

Markers. **DECIDE** = needs Nihar's sign-off before the job that uses it (all
listed in section 9). **UNCONFIRMED** = a fact about another product or a price
I could not open and check. **GAP** = something the repository does not yet
hold, with the job or build step that brings it.

---

## 0. What exists today, and what that means for this job

Read from the code on 3 November 2026, not from the roadmap.

**What the engine already produces, per company**

| Block | Where it is computed | Notes for the tearsheet |
|---|---|---|
| Key figures (price, day change, market cap, 52-week high and low, P/E, book value per share, P/B, dividend yield, ROCE, ROE, face value) | `src/data/companyOverview.ts`, `overviewStats()` | Every stat carries `value`, `missing` (a reason when null), `source`, `asOf` and `formula`. That is already the shape a tearsheet needs. |
| Reported statements, 10-year window plus TTM | `src/data/financials.ts`, `financialsFor(payload, { window: 10 })` | Each cell has a state (`reported`, `reportedZero`, `notReported`, `notApplicable`, `derived`) and, for SEC filers, its concept, accession number, form and filing date (`METHODOLOGY.md` §23b). Bank template has its own rows (`TEMPLATES`, `FORBIDDEN_FOR_BANKS`). |
| Income approach | `src/engine/model.js` `buildDCF`; bands in `src/data/companies.ts` `valuationBandsFor` | Perpetuity and exit-multiple values are separate and never averaged (`METHODOLOGY.md` §13, §20). Banks: residual income, `src/data/residualIncome.js`. |
| Market approach | `src/data/marketApproach.ts` `buildMarketApproach` | EV/EBITDA, EV/Sales, P/E against the peer median; `low`/`high` are the lowest and highest implied value of the usable multiples; each absent multiple has `absentBecause`. |
| Asset approach | `src/data/assetApproach.ts` `buildAssetApproach` | Book, tangible book, NCAV, liquidation at the reader's recovery rates; `informative` says when it is only a floor. |
| Reverse DCF | `src/data/reverseDcf.ts` | For the two-pager's valuation summary. |
| Cost of capital card | `src/data/costOfCapital.ts` `costOfCapitalFor` | Every row has a source and an as-at date. |
| Refusals and constraints | `model.js` `checkValuationApplicability`, `src/data/dataConstraints.ts` | Plain-English reasons, ready to print. |
| Freshness | `src/data/figuresAge.ts`, `overviewStats().freshness` | As-at per block. |
| Figure formatting | `src/data/figureFormat.ts` | One decimal rule per row, U+2212, em dash for not reported. |
| Saved model (every judgement) | `src/data/savedModels.ts`, `restoreModel.ts` | Restores a model to its own figure (`KI-27` closed). The tearsheet of a saved model is built from this record. |
| Workbook | `src/data/excelExport.ts`, `excelSheets.ts` | The Sources sheet already lists filings; the tearsheet's sources block should read the same list, not a second copy. |

**Four findings that shape the plan**

1. **The side-by-side figures live inside a component.** The football-field
   bands, the two terminal values and the premium or discount against each are
   computed in `useMemo` blocks inside `src/components/TerminalDashboard.tsx`
   (`valuationBands`, `terminalMethods`, `premiumAgainst`, `fieldBands`). A
   tearsheet that needs them would have to compute them again — the "two
   copies" trap. **Job 1 lifts them into one pure function both read.**
2. **Every company carries vendor data today.** The share price, the 52-week
   range and the price history come from Yahoo Finance for every company,
   including SEC filers (`METHODOLOGY.md` §1). The business description comes
   from Yahoo's `assetProfile` (`api/company.js`, `fetchProfile`). The peer set
   and the peers' multiples come from Yahoo (`api/comps.js`). Non-US
   statements come from Yahoo. So **on today's data every tearsheet is
   "development only", and no tearsheet can be a public download** until
   licensed prices (Paid · last), a description taken from the filing, and
   licensed or self-built peer data exist. The plan builds everything now and
   leaves the public switch off (launch principle 2).
3. **Ownership and guidance are not held.** Nothing in the payload carries
   shareholding, insider trades or management guidance (GAP: ownership is a
   Next item in `docs/VISION.md` §5b; the guidance tracker is Next in §5a).
   The two-pager reserves their place and says so (section 1.3).
4. **Build step 5 is not finished.** The football field already shows income,
   market and asset bars side by side, but the market range is the spread of
   three implied values, not a range from flexing stated assumptions as
   `VALUATION_SIDE_BY_SIDE_SPEC.md` rule 2 asks, and the caption, the
   non-overlap sentence and the per-row refusal (rules 6–8) are to be checked.
   The tearsheet prints whatever the shared valuation summary holds, so it
   does not wait for step 5 — but when step 5 changes the summary, the
   tearsheet changes with it, and that is the point of job 1.

**Where the plan documents disagree (said, not reconciled)**

- `docs/VISION.md` §6 puts the three-approach valuation and the football field
  on the **two-pager**, and "ownership changes" on the one-pager. This brief
  puts the three approaches on the **one-pager** and ownership on the
  two-pager. This spec follows the brief, which is newer. `docs/VISION.md`
  §5c and §6 and `ROADMAP.md` §14 should be updated to match once Nihar
  confirms (D1).
- `ROADMAP.md` §4 still lists "Tearsheet, the one-pager" as QUEUED, while §14
  and `docs/VISION.md` say Now. The `docs/` files are the plan; the roadmap
  row is behind.
- `docs/VISION.md` §6 lists "risk factors as disclosed" and "insider and
  promoter activity" on the two-pager. Risk factors need the AI extraction of
  build step 13 + 14 (quote and page number); they are left off version 1 and
  added when that exists (GAP).

---

## 1. Contents

### 1.1 Shared header (every page)

- Line 1 (eyebrow): `TICKER · Exchange · Country`, Small, weight 600,
  paper-quiet. Not oxblood (VISUAL_SYSTEM §3.1).
- Line 2: company name, Title, paper-ink, ending in the red square mark.
- Line 3: Sector · Reporting currency (and trading currency where they
  differ, as the company page shows Infosys) · Fiscal year end.
- Right-aligned stamp, two lines, Small: `Price: close 30 Oct 2026, 20:00 UTC`
  and `Statements: FY2026, ended 25 Jan 2026`.
- Basis line, Small, paper-read: `Built on Marginalia defaults` **or**
  `Built on your saved model of 2 Nov 2026 · 3 judgements changed from the
  default (listed on page 2)`. The one-pager of a saved model lists the
  changed judgements in its sources block if there is no page 2.

### 1.2 The one-pager

In order, top to bottom:

1. **Header** (1.1).
2. **Key figures strip**, six tiles in one row: Price, Market capitalisation,
   52-week range (low–high), Price / earnings, Price / book, Dividend yield.
   Each tile: label, figure, one source line. Taken from `overviewStats()`;
   the formatter, labels and "not reported / not applicable / not meaningful"
   words are the company page's own. Banks swap Price / earnings for nothing:
   the six stay, and ROCE is never offered.
3. **About** (left) and **Multiples** (right), side by side.
   - About: at most four lines of description. **GAP:** today's description
     is vendor text (Yahoo `assetProfile`); a public tearsheet needs the
     company's own words — the opening of Item 1 of the 10-K for SEC filers,
     quoted, with the document and section named. Until then the paragraph
     carries the development-only mark (rule 3.5).
   - Multiples table, columns: Multiple · This company · Peer median · Peers
     used. Rows: P/E, P/B, EV/EBITDA, EV/Sales, Dividend yield. Basis line
     under it: `Peers: the data source's suggested set (8)` or `Peers: your
     selection (5)`, and `Trailing figures, FY2026`. Bank rows: EV/EBITDA
     and EV/Sales print `n.m.` with the reason in a footnote (SCREENER_SPEC
     rule 5).
4. **Key financials, ten years**: up to ten reported fiscal years plus TTM
   where quarterly data exists (COMPANY_OVERVIEW D3). A company with fewer
   reported years gets fewer columns; columns are never padded and a year is
   never invented. (`api/company.js` notes Yahoo "often carries only four"
   years, so vendor-path companies will show four or five.) Rows, industrial
   template, fixed order: Revenue · Revenue growth % · EBITDA · EBITDA margin %
   · Net income · Diluted EPS · Cash from operations · Capital expenditure ·
   Free cash flow · Net debt (net cash shown negative) · ROE %. Bank template:
   the bank rows of `TEMPLATES` in `financials.ts`, fixed in job 2. Unit
   stated once in the table head (D3).
5. **Valuation: three approaches side by side** (the centrepiece):
   - One row each, on one shared per-share axis in the statement currency:
     **Income — perpetuity growth**, **Income — exit multiple** (two rows,
     never averaged; standing decision 4), **Market — peer multiples**,
     **Asset — book, tangible book, net current assets**. Banks: **Income —
     residual income** replaces both DCF rows.
   - Reference row, drawn differently and labelled `Reference, not a
     valuation`: the 52-week trading range.
   - One vertical current-price line across all rows, labelled with the price
     and its date.
   - Each row's figures column: low – high, the point the engine reports
     where it reports one, and **the premium or discount of the price to that
     point**, written as a fact: `Price 12.3% above` / `Price 8.1% below`.
     Formula: (price − value) ÷ value, as the dashboard's `premiumAgainst`
     computes it. No colour carries the sign; the words do.
   - A refused approach shows its refusal sentence in its row (spec rule 6),
     never a blank or a dash.
   - Caption: `Shown side by side; not combined.` If no two ranges overlap:
     `The ranges do not overlap.` Nothing more.
   - In a converted-currency case (statements in USD, shares quoted in INR),
     the row also prints the value in the trading currency at the one rate
     the price was converted at, as the dashboard does.
   - If the whole company is refused, the block is the refusal: its heading,
     the plain-English reason from `checkValuationApplicability`, and the
     sentence `No valuation is shown rather than an approximate one.` The rest
     of the page (facts) still prints.
6. **Sources and as-of dates** (section 3.1 gives the format): one row per
   source, numbered, plus the freshness rows (share price, share count,
   statements, risk-free rate, premiums, beta, peers) with their as-at dates.
7. **Foot** (in the bottom margin): page number `1 / 1`, the generated
   timestamp in UTC, the facts-only line (rule 3.4), the permanent link, and
   the development-only stamp where it applies.

### 1.3 The two-pager

Page 1 is the one-pager, unchanged, so a reader who has seen one has seen
the first page of the other (and the checks for page 1 are shared). Page 2:

1. **Valuation summary** (top half):
   - Income approach table: forecast years, WACC (with cost of equity, cost
     of debt and weights), terminal growth, exit multiple, value per share by
     each terminal method, the share of value that lies beyond the forecast
     (`METHODOLOGY.md` §13), and the reverse-DCF implied growth.
   - Market approach: the peer list (name, EV/EBITDA, EV/Sales, P/E), the
     medians, and which of the three multiples could not be applied and why.
   - Asset approach: each measure with its per-share figure and, for
     liquidation, the recovery rates used and whose they are (the reader's
     preset or custom).
   - **Judgements**: every judgement that differs from its default — name,
     default and where the default came from, the value used, and the
     reader's recorded reason (standing decision 2). If none differ: `Every
     judgement is at its default.`
   - **Figures not as filed**: every corrected or reclassified figure, its
     filed value beside the value used (standing decision 5). If none:
     `Every figure is as filed.`
2. **Ownership** (GAP): when the data layer holds it — promoter / insider /
   institutional / public shares at the last two disclosed dates, pledged
   shares, and the latest insider and bulk or block trades, each with its
   disclosure date and its filing. Until then one line: `Ownership: not yet in
   Marginalia's data. Planned from exchange shareholding filings and, for US
   companies, SEC Forms 3, 4 and 13F.` (standing decision 7: what is not
   built is labelled as being built).
3. **Guidance record** (GAP): when the guidance tracker exists — each
   statement quoted, with speaker, document and date, beside what was later
   reported. Until then the same one-line form as ownership. No "met / missed"
   verdict words; the two figures side by side.
4. **Sources in full**: one row per filing any figure on either page was read
   from — fiscal year, form, accession number, filing date, link. This is the
   list that makes the paper self-contained (rule 3.1).
5. Foot, as page 1, `2 / 2`.

### 1.4 What a tearsheet never contains

A rating, a target price, a recommendation, a composite score, a "fair value"
headline, an average or midpoint across approaches, a "consensus zone", a
traffic-light colour, an AI-written sentence, or a figure the page cannot
source. The Marginalia-authored mode with a rating (`docs/VISION.md` §6) is a
later job behind the licence switch (job 13) and is not in this layout.

---

## 2. Layout

### 2.1 Paper and margins

| | A4 (210 × 297 mm) | US Letter (215.9 × 279.4 mm) |
|---|---|---|
| Margins left / right | 15 mm | 15.95 mm (0.628 in) |
| Margin top | 14 mm | 14 mm |
| Margin bottom (holds the foot) | 16 mm | 16 mm |
| Content box | 180 × 267 mm | 184 × 249.4 mm |
| Content box in CSS px (96 / in) | 680 × 1009 | 695 × 943 |

**One layout, drawn in the common box.** Every block is laid out in a
**680 × 943 px** box — the narrower width (A4) and the shorter height
(Letter). On A4 the 66 px left over sits as white space between the sources
block and the foot; on Letter the 15 px of extra width is split equally
either side. So the page break, the rows and the wrapping are identical on
both papers, one set of checks covers both, and a tearsheet printed in Mumbai
and one printed in New York show the same thing in the same place. The cost
is 17 mm of unused A4; it is accepted rather than maintaining two layouts.

CSS: `@page { size: A4; margin: 14mm 15mm 16mm }` and the Letter equivalent,
chosen by a `paper` parameter; the foot is drawn in the bottom margin with a
fixed-position element (Chromium does not yet support `@page` margin boxes
reliably — UNCONFIRMED for the version pinned, checked in job 3).

### 2.2 Grid

- 12 columns across 680 px, gutter 16 px: column = (680 − 11 × 16) ÷ 12 = 42 px.
- Vertical rhythm on DESIGN.md's spacing steps only: 4, 8, 12, 20, 24.
  Gap between blocks 20 px; inside a block 8 or 12.
- No panel fills, no boxes around blocks. A block is a Section heading and
  a 1px rule above it. (On paper a filled panel prints as a grey slab and is
  the first thing a cheap printer bands.)

### 2.3 One-pager, block by block (px, inside the 943 px box)

| Block | Columns | Height | Contents |
|---|---|---|---|
| Header | 1–12 | 84 | eyebrow 18 · 4 · title 34 · 4 · meta 18 · 6; stamp right-aligned in cols 9–12 |
| Rule + gap | | 12 | |
| Key figures strip | 6 tiles × 2 cols | 80 | label 18 · 4 · figure 28 · 4 · source 18, padding 4 top and bottom; 1px rules between tiles |
| Gap | | 20 | |
| About · Multiples | 1–5 · 6–12 | 140 | heading 26 + four lines of 22 (About); heading 26 + head row + 5 rows of 20 (Multiples) |
| Gap | | 20 | |
| Key financials | 1–12 | 284 | heading 26 · head row 20 · 11 rows × 20 · unit / basis line 18 |
| Gap | | 20 | |
| Valuation | 1–12 | 192 | heading 26 · 5 rows × 26 (labels cols 1–3, bars cols 4–8, figures cols 9–12) · axis 18 · caption 18 |
| Gap | | 20 | |
| Sources and as-of | 1–6 · 7–12 | 71 + spare | two columns of Small lines |
| **Total** | | **943** | sources has whatever is left and must fit — job 3 fails the build if it does not |

**When it does not fit, the content gives way, never the type.** A row is
removed (in the order: capital expenditure, cash from operations, then the
dividend-yield multiple) and the omission is said in the basis line. Type
never drops below the 13 px floor to make room.

Key financials columns: label 132 px, then up to 11 value columns of
(680 − 132) ÷ 11 = 49.8 px. At 13 px tabular Source Sans 3 a digit is about
6.5 px, so a column holds 7 characters (`391,035`, `−12,345`). See D3 for
companies whose largest figure is longer.

### 2.4 Two-pager page 2 (680 × 943)

| Block | Columns | Height |
|---|---|---|
| Header (same as page 1, eyebrow + name + stamp only) | 1–12 | 62 |
| Income approach table | 1–6 | 260 |
| Market approach table (peer list up to 10) | 7–12 | 260 |
| Asset approach · Judgements · Figures not as filed | 1–4 · 5–8 · 9–12 | 180 |
| Ownership · Guidance record (one line each until held) | 1–6 · 7–12 | 80 (grows when held) |
| Sources in full (up to 11 filings, one per line) | 1–12 | 240 |
| Gaps (5 × 20) | | 100 |
| **Total** | | **922** + 21 spare |

When ownership and guidance arrive they take the spare height and, if
needed, the sources list moves to two columns. The job that adds them
re-measures the page.

### 2.5 Type, mapped to DESIGN.md (no new sizes; COMPANY_OVERVIEW D1)

Print uses the same CSS px as the screen; 1 px = 0.75 pt on paper.

| DESIGN.md step | px | On paper | Used for |
|---|---|---|---|
| Title (fixed at its minimum, 28 px; `vw` means nothing on paper) | 28 / 34 | 21 pt | Company name |
| Tile figure (VISUAL_SYSTEM finding 8) | 24 / 28 | 18 pt | Key-figure tiles |
| Section | 20 / 26 | 15 pt | Block headings |
| Body | 15 / 22 | 11.25 pt | About paragraph, valuation figures |
| Small | 13 / 18 or 20 | 9.75 pt | Tables, labels, sources, foot |
| Label (Small at 500) | 13 / 18 | 9.75 pt | Column heads, tile labels |

Newsreader for the name and headings only; Source Sans 3 for everything
else, every figure tabular and lining. No third face, no monospace. Both
fonts are self-hosted for the renderer and embedded in the PDF (SIL OFL
permits embedding). The 13 px floor is larger than most printed tearsheets
(Value Line and broker notes run nearer 7–8 pt, UNCONFIRMED), which is
deliberate: this page has fewer, larger figures.

### 2.6 Print-safe palette

White paper, no background fills, ink only where it carries meaning. The
Paper ramp is used, because it is the reading ramp (DESIGN.md, Two Grounds
Rule); contrasts below are computed against white (WCAG relative luminance).

| Token | Hex | On white | Use on the page |
|---|---|---|---|
| paper-ink | #16150F | 18.29 | Name, headings, every figure |
| paper-read | #3A382F | 11.75 | Body text, row labels |
| paper-quiet | #6B6759 | 5.66 | Source lines, units, foot, axis labels |
| paper-accent-text | #A23A34 | 6.58 | The red square mark and the current-price line only (two uses per page; VISUAL_SYSTEM §3.1 budget) |
| light line-control | #85816F | 3.91 | Bar outlines, the axis, the 1px rule above each block |
| paper-line | #DAD6CC | 1.45 | Table row dividers only — decorative; the page still reads if a printer drops them |

Rules:

- **Reads the same in greyscale.** No green or red for sign; sign is the
  word (`above` / `below`) and U+2212. The approaches are told apart by their
  labels, not by colour. Job 9 renders every page in greyscale and checks.
- Bars: outline 1px light line-control, fill paper-line at 100% for the
  three approaches; the reference row (52-week range) is an outline with no
  fill and a dashed edge (6/4), so it cannot be mistaken for an approach. The
  engine's point is a 2px paper-ink tick.
- No element thinner than 0.75 pt (1 px); no tint lighter than paper-line.
- Links print as text with the URL visible (a printed page cannot be
  clicked); in the PDF they are also live links.
- The four visible states on paper (standing decision 5), because colour
  cannot be relied on: a corrected figure carries a superscript `c`, a
  reclassified one `r`, a modelled one is set in italic; a reported figure is
  plain. The key is printed in the financials basis line whenever any marker
  appears.

### 2.7 On screen

- **Where:** Company › Research tab (`docs/VISION.md` §4), and Studio ›
  Outputs for a saved model. One route renders both the preview and the
  print: `/company/:ticker/research/tearsheet?pages=1|2&paper=a4|letter`.
- **Desktop (≥ 1024 px):** the page is shown as a sheet of Paper
  (#F2F0EA, the reading ground) on the dark instrument page, at its true
  proportions, scaled to fit the content width, with a 1px line border and
  no shadow (DESIGN.md: no `box-shadow`). Every token above passes on Paper
  too (paper-quiet 4.97, light line-control 3.43). Above the sheet: a
  segmented control `One page | Two pages`, another `A4 | Letter`, and the
  screen's one primary action, **Download PDF** (VISUAL_SYSTEM: one primary
  per screen). The development-only stamp shows on the preview exactly as it
  will print.
- **Tablet and phone (< 1024 px):** a scaled sheet at 390 px would set 13 px
  type at about 7 px, under the floor. So the same block components reflow
  into one column (key-figure tiles 2 across, the financials table scrolling
  sideways inside its own container with a sticky label column, the valuation
  rows as label-above-bar per VALUATION_SIDE_BY_SIDE rule 10), followed by the
  Download button. The file downloaded on a phone is the same fixed A4 or
  Letter PDF.
- **Screen and paper are one set of components.** The layout differences
  are CSS only (grid and scale). No block has a "print version".

---

## 3. Rules

### 3.1 Every number traceable to its source

- Every figure on the page carries a source key: a small superscript number
  on the block heading where every figure in the block shares a source (key
  figures, multiples, valuation), or per column in the financials table (one
  key per fiscal year, because each year's figures come from that year's
  filing — or a later one that restated it).
- The one-pager's sources block lists each key once: name, what it supplies,
  as-at date, and the document (form, filing date) or provider page. For SEC
  filers the financials key per year names the form and filing date; the
  accession numbers are on the two-pager's page 2 and in the online version.
- Each figure the site worked out (EBITDA, free cash flow, a margin, a
  multiple, a value) is labelled as Marginalia's arithmetic over sourced
  figures, as the Financials tab already says, with the method page linked.
- The printed permanent link opens the online tearsheet, where every figure
  opens its filing. **GAP:** "Model freeze and share link" is Next
  (`docs/VISION.md` §5a). Until it exists, the link opens the live page,
  whose figures can change on a restatement, so the foot says `Figures as at
  {date}; the online page may since have been updated.`
- A figure with no source is not printed. The check in job 2 fails a
  tearsheet that contains one.

### 3.2 Missing, not meaningful, not applicable

Printed exactly as the company page prints them: `—` for not reported
(never 0, never blank — CLAUDE.md "a blank cell reads as a reported nil"),
`n.m.` with its reason, `Not applicable` with its reason. Reasons go in a
footnote line under the block, not in the cell.

### 3.3 Refusals shown with their reason

A refused approach prints its plain-English refusal in its own row; a refused
company prints the refusal in place of the valuation block (1.2 item 5). A
refused peer multiple prints its `absentBecause`. A data constraint at the
"warn" threshold of `DATA_CONSTRAINTS.md` prints its one-line warning under
the valuation block, in paper-read, with the bound it states.

### 3.4 Facts only — no buy or sell wording

- Every string the tearsheet can print — labels, headings, captions,
  reasons, the basis lines, the file name, the PDF metadata — is scanned with
  `BANNED_WORDS` / `bannedWordsIn` from `src/data/screener.ts` (the list
  SCREENER_SPEC rule 12 defines: buy, sell, hold, accumulate, target,
  stop-loss, entry, exit, top pick, undervalued, overvalued, cheap, strong,
  weak, signal, opportunity, multibagger). One list, imported, never copied.
- **Conflict to settle (D4):** "exit multiple" is the standard name of the
  second terminal value and appears on the company page; the list bans
  "exit". Proposed: a short, written allow-list of fixed method phrases
  (`exit multiple`, `exit-multiple`) checked as whole phrases, with the
  exemption recorded the way the screener recorded its footer exemption —
  rather than renaming the method on paper only, which would give one thing
  two names. Similarly the weak-beta-fit wording must print as `low R²` or
  `wide standard error`, not "weak".
- Premium and discount are stated as arithmetic (`Price 12.3% above the
  perpetuity value`), never characterised.
- The facts-only line in the foot, worded without a banned word: `This page
  sets out figures from company filings and the result of a model under the
  assumptions shown. It is not an opinion on, or advice about, any security.`
  The legal wording is for counsel before public launch (Paid · last, as
  SCREENER_SPEC rule 18).
- AI disclosure (ROADMAP §14, designed in now): `No text on this page was
  written by AI.` When AI-extracted text arrives (risk factors, guidance),
  this line names what was extracted and that each item is quoted with its
  page.

### 3.5 Vendor data is "development only" and never in a public download

- Every block knows its source; a block is **vendor** when any figure in it
  comes from the vendor feed (`payload.source !== 'SEC EDGAR'` for
  statements; always, today, for price, 52-week range, description, peers).
- A tearsheet with any vendor block carries, on every page: a diagonal
  `Development only — contains vendor data not licensed for redistribution`
  stamp in paper-quiet at 12% (the only tint permitted, and it is a mark, not
  a fill), the words repeated in the foot, and each vendor block's source
  line ending `· vendor feed, development only` (the wording the screener
  already uses).
- **The public switch is off and enforced on the server.** A configuration
  flag (`PUBLIC_DOWNLOADS`, off) gates the download endpoint; with it on, the
  endpoint refuses any tearsheet with a vendor block and says which blocks.
  The refusal is the product working, not an error.
- Turning the switch on is a decision for Nihar at launch, after licensed
  prices exist (launch principle 3). It is not part of this build.

### 3.6 Generated from the engine, never re-calculated

- The tearsheet calls no arithmetic of its own. It reads one object,
  `tearsheetFor(...)` (job 2), which is assembled from the functions in the
  table in section 0 and the shared valuation summary (job 1).
- Formatting goes through `figureFormat.ts`. Labels come from where the
  company page takes them.
- **The share price is a valuation input** (CLAUDE.md trap). A tearsheet
  prints the price its values were struck against, with its timestamp, and a
  re-download of a saved model re-uses that price rather than fetching a new
  one.

---

## 4. How the file is made

### 4.1 The options

| | A. Browser print CSS | B. Server renderer, headless Chromium | C. Hosted HTML-to-PDF service | D. PDF library drawing in JavaScript |
|---|---|---|---|---|
| How | The route in 2.7 plus `@media print` / `@page`; the reader's browser saves the PDF | A Vercel function opens the same route in headless Chromium (`puppeteer-core` + `@sparticuz/chromium-min`, or `playwright-core`) and returns `page.pdf()` | Same route posted to a paid API (Browserless, DocRaptor, PDFShift…) | jsPDF / pdfmake / react-pdf draws the page in code |
| Same layout as the screen | Yes | Yes — the same route | Yes | **No — a second copy of the layout** |
| Same output for every reader | No: Chrome, Safari and Firefox differ on margins and fonts, and the reader can switch headers and footers on | Yes: one pinned browser | Yes | Yes |
| One-click download, file name, PDF metadata | No: a print dialog, the reader names the file | Yes | Yes | Yes |
| Enforces the vendor gate | No: anything on screen can be printed | Yes, on the server | Yes, if we gate before sending | Yes |
| Batch export (20 companies, VISION §5c) | No | Yes | Yes | Yes |
| Running cost | Nil | Function time only. Vercel's 250 MB function limit is why the slim Chromium packages exist ([Vercel guide](https://docs.vercel.com/guides/deploying-puppeteer-with-nextjs-on-vercel), not opened — search summary only; UNCONFIRMED for today's limit and price). Estimate: 2–4 s at 1–2 GB per page; measured in job 8 | Per-document or monthly fee (UNCONFIRMED), and company data leaves our hosting | Nil |
| Effort | The route (needed by every option) | The route + one function, about a day; cold-start and timeout to be measured (one community report says renders over ~15 s failed, UNCONFIRMED) | The route + an account | A full second layout, kept in step with the first for ever |
| Our harness can check it | Yes, Playwright's `page.pdf()` is the same engine as B | Yes, identically | Partly | Separately |

### 4.2 Recommendation

**Build A's route as the one layout, and ship B as the download.** The print
route is the work in every option except D; B is then one function that
opens it in the same Chromium the harness already drives through Playwright
(`verify/dashboard.mts`), so what the checks
measure is exactly the file a reader gets. A "Print / save as PDF" button
(option A) ships first in job 5, labelled as printing, so the feature works
on the private site before the function exists. D is rejected as the
two-copies trap. C is not needed and would send company data to a third
party; revisit only if B's cold start or limits fail the measurement in job
8.

The saved-model case: the browser posts the saved-model record (every
judgement, the price and its timestamp — already the `KI-27` record) to the
function, which loads the route with that record, so the server builds the
same model the reader is looking at. No figure is computed on the server
that the browser did not compute in the same code.

File name: `Marginalia_{TICKER}_{one-page|two-page}_{A4|Letter}_{YYYY-MM-DD}.pdf`.
PDF metadata: title (company and page type), author `Marginalia`, creation
date, and a keyword `development-only` while the stamp applies.

### 4.3 PowerPoint, later (job 12)

`pptxgenjs` in the browser, writing a 16:9 slide from the **same**
`tearsheetFor` object: header, key figures, the valuation rows as native
shapes, the sources as slide notes. It inherits every rule in section 3 by
reading the same object and running the same checks. Native editable charts
are not required; shapes are enough. Next, not this build.

---

## 5. Five reference tearsheets

**None of these pages could be opened from this session**: the network
policy refused every host (investor.valueline.com,
pages.marketintelligence.spglobal.com, cmcmarkets.com,
interactivebrokers.ca). What is below comes from search-result summaries and,
where marked, from general knowledge of the published format. **Everything in
this section is not confirmed** and must be checked against the page before
it is relied on. To open them, the hosts must be allowed in the environment's
network settings.

1. **Value Line, the one-page report.** Links:
   [How to Read a Value Line Report (Value Line, 2017)](https://investor.valueline.com/hubfs/Guides/1503516_Reading_VL_Report_WEB_2.7.17.pdf),
   [BetterInvesting copy](https://www.betterinvesting.org/getmedia/4667cfdd-c36f-4555-83fd-197f6a360f43/How-to-Read-a-VL-Report.pdf),
   [annotated sample](https://dividendgrowthinvestingandretirement.com/wp-content/uploads/2018/08/Value-Line-Investment-Survey-Sample-Report-with-Explanations.pdf).
   Not confirmed (general knowledge): a long statistical array of per-share
   and annual figures across the page, a price chart above it, capital
   structure and business description in blocks below, all on one sheet in
   very small type. **Take:** the long history on one page, and a fixed
   layout that is identical for every company so a reader learns it once.
   **Leave:** the ranks and projections (opinions), and the very small type.
2. **S&P Capital IQ tearsheet.** Links:
   [Capital IQ Jump Start: Tearsheet & Financials](https://pages.marketintelligence.spglobal.com/SP-Capital-IQ-Jump-Start-Tearsheet-and-Financials.html),
   [a Capital IQ quick start guide (HSE copy)](https://finance.hse.ru/data/2019/09/06/1538828773/Capital%20IQ_Quick%20Start%20Guide.pdf).
   Search summaries say the tearsheet covers business description, industry
   classification, investors, office, stock information, financial
   statistics, key executives and subsidiaries, and exports as a PDF "Quick
   Report" or a Word report (from an older translated manual). **Take:** the
   tearsheet as a summary of everything held, with export as a first-class
   action; description and identity at the top. **Leave:** widget sprawl —
   it is the opposite of the first design principle on paper.
3. **Morningstar equity report.** Links:
   [CMC Markets: Morningstar research reports (annotated Apple sample)](https://cmcmarkets.com/en-gb/platform-guides/morningstar-research-reports),
   [Interactive Brokers sample page](https://www.interactivebrokers.ca/en/index.php?f=14262),
   [Morningstar Equity Research Methodology (2023)](https://s205.q4cdn.com/437373358/files/doc_downloads/2025/07/Morningstar-Equity-Research-Methodology-2023-06-14.pdf).
   Search summaries: the report centres on a fair value estimate against the
   current price, with moat, uncertainty and a star rating, and the
   quantitative version prints price ÷ fair value. **Take:** the current
   price set directly against each value, and an explicit statement of how
   uncertain the value is (our version: the ranges and the flexed
   assumptions). **Leave:** the single fair value, the star rating and the
   "undervalued / overvalued" labels — a blend and an opinion.
4. **Indian broker initiation note (Motilal Oswal, Bharti Hexacom, 6 June
   2025).** Link:
   [Morning India, 6 Jun 2025 (DSIJ copy)](https://www.dsij.in/productAttachment/premarketreports/MORNING_INDIA-20250606-MOSL-MI-PG024.pdf).
   Search summary: the first page carries a small valuation table (P/E,
   P/BV, EV/EBITDA, dividend yield) and a "Shareholding pattern (%)" block
   (promoter, DII, FII, others) with the date of each column. **Take:** the
   shareholding block with dated columns — the shape of our ownership block
   — and multiples in a compact table. **Leave:** the rating and target
   price that headline every such note.
5. **Value Research Online stock snapshot (retail, India).** Link:
   [Value Research Online](https://www.valueresearchonline.com/stories/28395/8-questions-to-ask-before-you-buy-a-stock/).
   Search summary: a snapshot of price, P/E, market capitalisation and
   high–low. **Take:** the short key-figure strip a retail reader expects
   first. **Leave:** anything beyond facts.

What none of them is described as doing, and this page does: a source and
as-at date on every block, refusals in place of numbers, the approaches side
by side and never combined, and the reader's own judgements listed.

---

## 6. Build sequence

One job per session, each with its own commit and the full suite
(`npm run verify`, `verify:workbook`, `verify:dashboard`, `tsc --noEmit`,
`build`). Every new check is proved by breaking its fix on purpose and
watching it fail (CLAUDE.md, "a check that cannot fail").

| # | Job | Check (and how it is proved to fail) |
|---|---|---|
| 0 | Nihar settles D1–D7 (section 9). Documentation only. | None needed; no verification reads `docs/`. |
| 1 | **Lift the valuation summary out of the component.** Move `valuationBands`, `terminalMethods`, `premiumAgainst` and `fieldBands` from `TerminalDashboard.tsx` into one pure `src/data/valuationSummary.ts`; the dashboard reads it. No behaviour change. | Across the payload set, every band, point and premium equals what the dashboard printed before the move (captured from the rendered page by `verify/dashboard.mts`, not from the new function — "comparing a figure against itself"). Break: flip the premium sign in the new function; both the scenario and the browser check fail. |
| 2 | **The tearsheet contract.** `src/data/tearsheet.ts`, `tearsheetFor(payload, savedRecord?)`: every block, every figure as `{ value, state, sourceKey, asOf, reason? }`, the sources list, the vendor flag per block, the refusals. No arithmetic; formatting via `figureFormat.ts`. | In `verify/scenarios.mts`, over every company: every printed figure equals its origin function's figure; every figure has a source key that resolves to a sources row; every null has a reason; every string passes `bannedWordsIn`; the vendor flag is true wherever the price is vendor (all companies today). Report counts: companies, refused, banks, vendor. Break each: drop a source key, blank a reason, insert "cheap" into a label. |
| 3 | **The A4 one-pager route.** Block components, the grid, print CSS, self-hosted fonts. | In `verify/dashboard.mts`: `page.pdf({ format: 'A4' })` is exactly 1 page for a fixture set (an SEC industrial, a bank, a vendor-path company, a refused company, a converted-currency company); no element's box leaves the 680 × 943 area; no computed font size under 13 px; only Newsreader and Source Sans 3 in use; each figure's text on the page equals the contract (scoped to the page region — strict-mode trap). Break: add a twelfth financials row — the one-page check fails. |
| 4 | **US Letter.** The `paper` parameter. | The same checks on Letter; every block's position and size identical to A4 (to the pixel, inside the common box). Break: give Letter its own margin for one block. |
| 5 | **On-screen preview and print button.** The Research tab sheet, segmented controls, phone reflow, "Print / save as PDF". | 1440 px: sheet on Paper, one primary button, accent budget held. 390 px: no horizontal page scroll, financials scroll inside their own container, no type under 13 px. Break: let the table overflow its container. |
| 6 | **The two-pager.** Page 2 blocks; the judgements and not-as-filed lists from the saved record; ownership and guidance as labelled "not yet held". | Exactly 2 pages on both papers; page 1 identical to the one-pager; the sources-in-full table lists exactly the accession numbers referenced by the financials cells (computed independently from the cells); a saved model with three changed judgements lists those three. Break: drop one accession; change a judgement without listing it. |
| 7 | **Vendor gating and the stamp.** Stamp, foot line, source suffixes, `PUBLIC_DOWNLOADS` flag. | Every page of every vendor-flagged tearsheet carries the stamp and the foot words; with the flag on, the endpoint (or its stand-in until job 8) refuses every vendor tearsheet and names the blocks. Break: remove the price block's vendor flag — the check fails on every company. |
| 8 | **Server download.** `api/tearsheet.js` opening the route in headless Chromium; the saved record and price passed in; file name and metadata. | For the fixture set, the downloaded PDF's extracted text equals the preview's figures; a saved model's PDF shows the value the saved list shows; cold start and warm render times measured and reported, against the function limits. Break: let the function fetch a fresh price instead of the record's. |
| 9 | **Print safety.** Greyscale and contrast. | Contrast of every print token on white and on Paper added to `npm run verify`; each fixture page rendered in greyscale reads the same (no information carried by hue alone — every bar and line has a label). Break: colour the premium words green and red without the words. |
| 10 | **Docs and roadmap.** `METHODOLOGY.md` section on the tearsheet (what it reads, never computes), `ROADMAP.md` status to Built with the shipped log, `docs/VISION.md` §5c/§6 aligned with D1. | Documentation only; the follow-up "point the shipped log" commit. |
| 11 | **Ownership and guidance blocks**, each when its data lands (GAP). | Each figure dated and linked to its disclosure; no verdict words; page 2 re-measured to stay at 2 pages. |
| 12 | **PowerPoint slide** from the same contract (Next). | The slide's figures equal the contract's; banned-word scan on every text frame. |
| 13 | **Marginalia-authored mode slot**, built and switched off (launch principle 1). | With the switch off, no rating or target string can reach any output; proved by switching it on in the test only. |

---

## 7. Phone, accessibility and motion

- The tearsheet preview has no motion beyond the shared page transition;
  no figure animates (VISUAL_SYSTEM §5).
- The PDF is tagged where Chromium tags it (headings, tables); the online
  preview is the accessible version, with the valuation rows also offered as
  a table (VALUATION_SIDE_BY_SIDE rule 10).
- `lang="en-IN"`; Indian grouping for INR amounts, three-digit grouping
  otherwise, as the company page does.

## 8. What is deliberately not in version 1

Risk factors as disclosed (needs build step 13 + 14), insider and promoter
activity (needs the ownership data layer), peer multiples against
forward estimates (Paid · last), a price chart (it adds a block the
one-pager has no height for; the 52-week range row carries the fact), and
Word export (the research pack, Next).

## 9. Decisions I need from you

- **D1.** The brief puts the three approaches on the one-pager and ownership
  on the two-pager; `docs/VISION.md` §6 has it the other way. Confirm the
  brief, and the docs are updated in job 10.
- **D2.** One layout in the common 680 × 943 px box for both papers, leaving
  about 17 mm unused at the foot of A4. Accept, or ask for a taller A4 variant
  (two layouts, two sets of checks).
- **D3.** Units in the financials table. A seven-character column fits
  `391,035` but not Reliance's revenue in rupees million (`96,46,930`, nine
  characters). Proposed: one unit per table, the smallest of million or
  billion at which the largest
  figure has at most seven characters; billions take one decimal; the unit is
  printed in the table head. For rupee companies, say whether you want crore
  instead of million / billion. Either way this adds a rule to
  `figureFormat.ts`.
- **D4.** "exit" is on the banned list and "exit multiple" is the method's
  name. Proposed: a written allow-list of fixed method phrases. Alternative:
  rename the method everywhere (screen, workbook, tearsheet) to "terminal
  multiple".
- **D5.** The development-only stamp as a diagonal 12% mark on every page,
  or a top banner only.
- **D6.** Ship the browser "Print / save as PDF" button in job 5 ahead of the
  server download in job 8, or hold the feature until job 8.
- **D7.** The facts-only foot line and the AI line as worded in 3.4, pending
  counsel before public launch.
