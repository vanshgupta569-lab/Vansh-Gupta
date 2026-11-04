# LEARN_STATES_SPEC

Marginalia · visual pack 7 · the Learn area, the Margin notes, every empty,
error, not-found, offline and stale-data state, and the phone menu · v1.0 · 4
November 2026 · obeys `docs/VISUAL_SYSTEM.md` v1.0 and the decisions at its
top (ⓘ stays with a 24×24 hit area, 44×44 on touch; Dark is the only
instrument theme; Paper stays the reading ground; 3D budgets belong to build
step 8 only), `DESIGN.md`, and `docs/NAV_SEARCH_SPEC.md` for the header and
menu. Written for build step 9.

Markers: KEEP = already in VISUAL_SYSTEM or DESIGN.md. ADD = new rule or
token. CHANGE = alters a built screen or an earlier spec. **PROPOSED — needs
Nihar** = my choice where the docs are silent; every one is listed in section
9. [CONFIRM] = a fact I could not check from the repository.

## 0. Basis and limits

- **Written from the code, not from screenshots.** Read on 4 November 2026:
  `scripts/buildExplainers.mts` (the eight `/learn/` pages and their
  stylesheet), `content/explainers/*.md`, `src/data/explainers.ts`,
  `src/components/marginNotes.tsx`, `src/components/marginNotesSection.tsx`,
  `src/data/marginNotes.ts` (**19** notes — `MARGIN_NOTES.length`, measured
  4 November 2026; this file said 20, which was a miscount, and the count a
  screen prints must be read from the array rather than written here),
  `src/App.tsx`, `src/data/router.ts`,
  `src/data/companyRoute.ts`, `src/components/Header.tsx`,
  `src/components/companyPage.tsx`, `src/components/staleFigures.tsx`,
  `src/data/figuresAge.ts`, `src/components/screenerScreen.tsx`,
  `src/components/DirectoryScreen.tsx`, `src/components/financialsTab.tsx`,
  `src/components/priceChart.tsx`, `src/components/savedModelsPanel.tsx`,
  `src/components/CoverageStatsSection.tsx`, `src/data/autoCompany.ts`,
  `src/index.css`, `vercel.json`, `index.html`.
- **No browser measurement.** Sizes below are what the code asks for. Where
  `src/index.css` remaps a size (the "twenty-sixth size cannot be introduced"
  block, `index.css` lines ~782–806) the computed size is the remapped one,
  and I say so. Confirm with computed styles before logging a bug.
- **Outside websites were blocked in this session**, so this pack cites no
  new external references; it applies the ones VISUAL_SYSTEM §10 and
  NAV_SEARCH §1 already opened.
- The yellow starburst in earlier screenshots is a browser extension (NAV_SEARCH
  decision 2): ignored.

## 1. Shared frame for every screen in this pack

KEEP from COMPANY_OVERVIEW §1.1 and VISUAL_SYSTEM §2:

- Container `max-width: 1440px; margin-inline: auto; padding-inline: 48px` at
  ≥ 1024px, 24px below. Content width 1344 at 1440, 342 at 390.
- Breakpoints: phone < 640, tablet 640–1023, desktop ≥ 1024.
- Global header 64px (condensed 48px), one header on every screen including
  the static `/learn/` pages (NAV_SEARCH §2, CHANGE for `/learn/`, section 2.4).
- Type: the four DESIGN.md steps only — Title `clamp(28px, 2.8vw, 36px)`
  Newsreader 600; Section 20px Newsreader 600; Body 15px Source Sans 3 400;
  Small 13px Source Sans 3 400; Label = Small at 500. The landing-only Lead
  (20px) and Display (clamp 40–64px) steps from VISUAL_SYSTEM finding 8 do
  **not** apply here. Sentence case everywhere; no uppercase, no tracking
  (DESIGN.md "Don't set a label in capitals").
- Spacing steps 4, 8, 12, 16, 24, 32, 48, 64, 96 (COMPANY_OVERVIEW §1.1 plus
  DESIGN.md `section: 96px`).
- Radius 0, no shadow, no gradient, 1px hairlines.

**Two grounds (KEEP, DESIGN.md Two Grounds Rule):** the Learn area and the
Margin notes are **Paper** (`paper #F2F0EA`, `paper-ink #16150F`, `paper-read
#3A382F`, `paper-quiet #6B6759`, `paper-line #DAD6CC`, `paper-accent-text
#A23A34`). Every state in section 3 sits on the **instrument** ground of the
screen it belongs to. The not-found and offline pages are instrument (dark)
because they are site chrome, not reading.

## 2. The Learn area

### 2.1 What exists today

| Page | Address | Built by | Ground |
|---|---|---|---|
| Explainers index | `/learn/` | `scripts/buildExplainers.mts`, static HTML at build | Paper |
| Eight explainers | `/learn/<slug>/` (`what-is-dcf-valuation`, `free-cash-flow-vs-profit`, `wacc-discount-rate`, `terminal-value`, `three-statement-model`, `ev-ebitda-multiple`, `book-value`, `why-analysts-value-differently`) | same, from `content/explainers/*.md` | Paper |
| Margin notes screen | **none** — a `currentScreen === 'NOTES'` state at `/` | `marginNotes.tsx` | Paper |
| Margin notes band on the landing page | `/#margin-notes` | `marginNotesSection.tsx` | Paper |
| Sitemap | `/sitemap.xml` (home, `/learn/`, eight articles) | build script | — |

The static pages carry their own stylesheet (`/learn/explainer.css`, written
by the build script from `PAPER` and `TYPE` in `src/design/tokens.ts`), so
`src/index.css`'s size and capitals remapping **does not reach them**. What
the stylesheet asks for is what renders.

### 2.2 Addresses (APPROVED 4 Nov 2026)

The Margin notes cannot be linked to, bookmarked or reached with Back, and
both `/learn/` pages link "the margin notes" to `/`, which opens the landing
page, not the notes (`buildExplainers.mts`, the `.cta` lines). Proposed:

- `/learn/` — the Learn hub: the explainers **and** the notes on one index.
- `/learn/notes/` — the Margin notes screen, first note open.
- `/learn/notes/<key>/` — one note open (`key` from `marginNotes.ts`,
  e.g. `gross-margin`).
- `/learn/<slug>/` — explainers, unchanged.

Notes stay a client screen (they share `marginNotes.ts` with the landing
band) and need one rewrite in `vercel.json` for `/learn/notes/:path*`.
Consistent with the router's own comment that addresses are added as screens
need them (`router.ts` header).

### 2.3 Learn hub and explainer index — layout

**1440 (content 1344):**

| Element | Spec |
|---|---|
| Header | Global header, 64px, Learn is the current section (NAV_SEARCH selected state). |
| Page top | 64px below the header (y = 128). |
| Breadcrumb | None. The header's current section says where you are; the "← Marginalia" back link goes (CHANGE: `buildExplainers.mts` backLink). |
| h1 | `How a company is valued`, Title, paper-ink, ending in the red square (`Mark on="paper"`). Letter-spacing −0.015em, word-spacing 0.04em (VISUAL_SYSTEM finding 19). Max width 24ch. |
| Standfirst | Body 15/24, paper-read, max 600px, 16px under the h1. Text kept from the build script, with the 20-notes count added. |
| Two columns | `grid-template-columns: minmax(0, 640px) 1fr; column-gap: 96px`, starting 48px under the standfirst. |
| Left: Explainers | Section heading `Explainers` (h2). Eight rows: title Body 15/22 600 paper-ink, standfirst Small 13/20 paper-read, padding 16 0, 1px paper-line between. Row min-height 72. Whole row is the link. Hover: title to paper-accent-text, 110ms `--m-ease-standard`. |
| Right: Margin notes | Section heading `Margin notes`, then three groups (The income statement · The balance sheet · Reading them together), each a Label 13/18 paper-quiet group name and its note titles, Body 15/22 paper-read, row height 40, linking to `/learn/notes/<key>/`. |
| Foot of page | The `.cta` paragraph, Body 15/24 paper-read, 1px paper-line above, 64px top margin, max 640. Links underlined paper-read with a 1px underline in light line-control `#85816F`, offset 2px (COMPANY_OVERVIEW D8 link-source style, Paper version). |
| Page bottom padding | 96. Then the site footer. |

**390 (content 342):** one column. h1 Title at its 28px floor. Explainers
first, then Margin notes; each group of notes is a Disclose row (closed by
default under 640px), chevron on the left, body indented 24 (VISUAL_SYSTEM
Disclose, KEEP). Rows ≥ 44 tall.

### 2.4 One explainer — layout

**1440:**

- Header (Learn current). 64px gap.
- Back link `← All explainers`, Small 13/18 paper-quiet, sentence case, hit
  height ≥ 24 (CHANGE: today 12px uppercase 0.16em, which renders as written
  because the static stylesheet is not remapped).
- 24px. Eyebrow `Explainer`, Label 13/18 **paper-quiet** (CHANGE: today
  12px uppercase 0.22em in `--red-text`; eyebrows are never oxblood, VISUAL_SYSTEM
  §3.1 and finding 14).
- 12px. h1, Title, paper-ink, max 24ch.
- 24px. Standfirst: Body 15/24 **paper-ink**, 1px paper-line under it, 24px
  padding below (CHANGE: today 19/21px, which is between steps).
- Article column `max-width: 640px` (about 72 characters at 15px). Paragraphs
  Body 15/24 paper-read, 16px apart. h2 Section 20/26 Newsreader 600, 48px
  above, 12px below (CHANGE: today 24/28px, weight 500).
- Tables: Small 13/20, head row Label 13/18 paper-quiet sentence case (CHANGE:
  today 11px uppercase 0.14em), figures tabular-nums right-aligned, 1px
  paper-line between rows, scroll inside their own container under 640px with
  a sticky first column (VISUAL_SYSTEM §7).
- 64px. `.cta` block as the hub's.
- 48px. `The other explainers`: Label paper-quiet, then seven rows as on the
  hub (title + standfirst), sub-line weight 400 (CHANGE: today weight 300,
  14px).
- Right rail at ≥ 1280 only (APPROVED 4 Nov 2026): "Related margin notes",
  up to three links, Small, sticky at top 88. Hidden below 1280 so the
  article never narrows.

**390:** same order, one column, h1 at 28px, tables scrolling inside
themselves, no right rail.

### 2.5 The Margin notes screen — layout

Today: `marginNotes.tsx`, Paper, container `max-w-[1380px]` with 24/40/64px
padding, index column 280px, `gap-20` (80px), article `max-w-[68ch]`.

**1440 (CHANGE to the shared frame):**

| Element | Spec |
|---|---|
| Container | 1440 / 48px gutters (CHANGE from 1380 with 64px). |
| Back | Removed. The header's Learn current state and the browser's Back do this once the screen has an address (2.2). |
| Eyebrow | `The margin notes`, Label 13/18 paper-quiet (CHANGE: today accent-text with a red rule, uppercase). |
| h1 | `Read any company's accounts`, Title (CHANGE: today 34/46/60px; 60px is outside the remap list in `index.css`, so it renders at **60px** — the one size on this screen that escapes the four steps). |
| Standfirst | Body 15/24 paper-read, max 600 (CHANGE: today 17/19px, remapped to 15). |
| Grid | `grid-template-columns: 280px minmax(0, 640px); column-gap: 96px`. |
| Index | Sticky at `top: 88px` (64 header + 24), max-height `calc(100svh - 112px)` with its own scroll. Group label Label 13/18 paper-quiet with 1px paper-line under it, 12px below; note rows Body 15/22, height 40, paper-read at rest, and when current the system's one selected state (VISUAL_SYSTEM §3.1: raised ground — `#FAF9F5` on Paper — 1px paper-accent-text border, paper-ink, weight 600; replaces today's 3×3px red dot). Explainers group last, each with a 16px ↗-free "opens a page" right arrow in paper-quiet. |
| Article | Note title in Section 20/26 Newsreader 600 paper-ink, not the Title step, which would compete with the page's h1 (CHANGE: today 28/34/40px). Then the note's "one line" Body 15/24 paper-ink, 1px rule under it; paragraphs Body 15/24 paper-read. |
| Buffett lens | Left rule 2px paper-accent-text (KEEP — one oxblood element), label `The Buffett lens` Label paper-quiet (CHANGE: today accent-text uppercase), body Body 15/24. The credit paragraph at the foot is Small paper-quiet and stays (load-bearing: see the file's header comment). |
| Previous / next | ADD. Under the article, 48px, two links `← {previous note}` and `{next note} →`, Body 15, in the index order, so a reader walks the statements in order without returning to the index. |

**390:** the index becomes one Disclose row at the top, `All 19 notes` (the
count is read from `MARGIN_NOTES.length`, never written into the label),
closed by default, opening the three groups in place; the article follows.
Today the full index (28 rows, about 1,100px) sits above the article on a
phone, so the note the reader tapped is a long scroll away (conflict 9).
Previous / next stay, full-width, 48px tall each.

### 2.6 The Margin notes band on the landing page

Owned by `docs/LANDING_SPEC.md` (build step 8). This pack only fixes where
its links go: each card to `/learn/notes/<key>/`, `All 19 notes` to
`/learn/notes/`. The count is read from `MARGIN_NOTES.length` (KEEP — it
already is; `docs/VISION.md` still says 19).

## 3. States across the site

### 3.1 One anatomy for every state (ADD)

Every loading, empty, error, not-found and offline state is the same block,
so the site has one voice for "there is nothing here, and why":

- Container: the panel the content would have filled, at the **height the
  content would have had** where known (Stripe chart-layout rule KEEP from
  COMPANY_OVERVIEW research 3), else min-height 160. Ground panel, 1px line,
  padding 24 (16 on phone).
- Line 1, title: Body 15/22, weight 600, ink, sentence case. One short
  phrase. **Never set in capitals in the source** (today four states write
  `READING THE FILINGS`, `NOTHING TO SHOW`, `NOTHING TO SCREEN`, `NO CHART`
  as literal capitals, which the `.uppercase` remap cannot undo).
- Line 2, reason: Body 15/24, read, max 600px. A full sentence saying what
  happened and, where known, why. Never a raw exception message (3.5).
- Line 3, action (optional): one ghost button (hairline line-control border,
  muted label, ink on hover), 36px tall, Label 13. Never a primary: a state is
  not the screen's one action.
- No icon, no illustration, no spinner, no colour on the title. Accent-text
  only for a refusal or error **word** in the reason, within the five-word
  budget (VISUAL_SYSTEM §3.1). Amber only for a data fact (stale figures,
  excluded companies), never for an error.
- Loading: the block appears only after 200ms of waiting (VISUAL_SYSTEM §4),
  title `Reading the filings` etc., no animated dots; a static line-coloured
  bar 2px high across the top of the block may show progress only if a real
  stage count exists (NAV_SEARCH loading rules).

### 3.2 Inventory, from the code

| # | Where | Today (file) | Kind | Spec |
|---|---|---|---|---|
| S1 | Company page, loading | `companyPage.tsx` ~118: `READING THE FILINGS` / "Fetching {ticker} from its source." | loading | Title `Reading the filings`, reason `Fetching {ticker} from {SEC EDGAR / the vendor feed}.` Block height 384 (the tile grid it replaces). |
| S2 | Company page, error | `companyPage.tsx` ~126: `NOTHING TO SHOW` in accent-text, the raw error, `Try again` | error | Title `{Ticker} could not be read`; reason from the error map (3.5); action `Try again`. Title in ink, not accent-text. |
| S3 | Company page, unbuilt tab | `companyPage.tsx` ~305: Section heading + `being built` pill + the `coming` line | empty (not built) | KEEP. It is the model for standing decision 7. Pill stays neutral. |
| S4 | Financials, a frequency with nothing held | `financialsTab.tsx` ~192: heading + `none held` pill + reason | empty (data) | KEEP; reason states which frequencies the company does file. |
| S5 | Price chart, nothing to draw | `priceChart.tsx` ~264: `NO CHART` + `series.missing` | empty (data) | Title `No price history`; reason `series.missing`; block height = chart height (360 desktop, 260 phone, COMPANY_OVERVIEW §1.11). |
| S6 | Cost of capital, index series failed | `costOfCapitalCard.tsx` ~358 | error (part) | Inline in the beta row: reason sentence only, Small read, no block. |
| S7 | Screener, table failed | `screenerScreen.tsx` ~222: `NOTHING TO SCREEN` + message | error | Title `The screener table could not be read`; action `Try again` (missing today). |
| S8 | Screener, loading | `screenerScreen.tsx` ~233: `READING THE TABLE` | loading | Title `Reading the table`; reason kept. |
| S9 | Screener, zero matches | `screenerScreen.tsx` ~769: "No company in the universe satisfies every filter." + amber exclusion | empty (result) | KEEP wording (SCREENER_SPEC rule 16). Add action `Remove the last filter`. Exclusion line stays amber, it is a data fact. |
| S10 | Company search (directory), wrong listing | `DirectoryScreen.tsx` ~288: grey hint box with a red square bullet | guidance | KEEP grey (the comment's reasoning is right); replace the red square bullet with nothing — the mark is the heading's, not a bullet (DESIGN.md mark rule). |
| S11 | Company search, build failed | `DirectoryScreen.tsx` ~298: oxblood-washed box `rgba(139,30,30,0.10)`, 13px figure font | error | Standard block (3.1), no wash. A wash here spends one of the three oxblood fills per viewport on an error that is often the reader's typo. |
| S12 | Company search, suggestions request failed | `DirectoryScreen.tsx` ~104: `.catch` empties the list, **says nothing** | error (silent) | ADD: under the field, Small read, `Suggestions could not be loaded. You can still enter a ticker.` The field keeps working. |
| S13 | Company search, no suggestions | `DirectoryScreen.tsx`: an empty list, nothing said | empty (result) | ADD: `No listed company matches "{query}". Try the ticker with its market suffix, e.g. RELIANCE.NS.` (NAV_SEARCH checklist 18 for the palette). |
| S14 | Saved models, none | `savedModelsPanel.tsx` ~202: "Nothing saved for {company} yet." 14px `#8A8A8F` | empty | Body 15 read via token; add the line `Saved on this device only.` (COMPANY_OVERVIEW D6 wording family). |
| S15 | Feedback form | `CoverageStatsSection.tsx` ~35–51: "Sending...", "Success! …", "Error submitting form. Please try again." | progress / error | `Sending…` (one ellipsis glyph), `Sent. Thank you.`, error `Your message was not sent. Try again, or email us.` No exclamation marks. |
| S16 | Stale figures | `staleFigures.tsx`, band, amber eyebrow, when the latest period ended > 18 calendar months ago (`figuresAge.ts`) | stale | 3.4. |
| S17 | Stale price | **Not built.** Specified in COMPANY_OVERVIEW §1.9 (Koyfin pattern) | stale | 3.4. |
| S18 | Page not found | **Not built** | not found | 3.6. |
| S19 | Offline | **Not built** | offline | 3.5. |
| S20 | Wrong company tab slug | `companyRoute.ts` ~159 falls back to Overview silently | not found (part) | `replace` the address to `/company/{T}/overview` so the address bar matches the screen (router's own rule). No message. |

### 3.3 Empty states — rules

1. Empty because **not built**: say what it will carry and nothing else (S3).
2. Empty because **the source does not publish it**: say which source and
   which period (S4, S5). Never a zero, never a blank (standing decision 3).
3. Empty because **the reader's filters exclude everything**: say so, keep
   the filters visible, offer to remove the last one (S9).
4. Empty because **the reader has saved nothing yet**: one sentence and
   where things will be saved (S14).
5. Never: sample data, a greyed-out table, a mock chart, an illustration.

### 3.4 Stale-data states

**Stale figures (S16, KEEP the rule, CHANGE the look):**
- Rule unchanged: `figuresAge.ts`, latest period end more than 18 calendar
  months before today.
- Band at the top of the screen's content, directly under the header block,
  full content width: panel ground, **1px amber border at full strength**
  (today `border-amber/50`, a 50% border that measures under 3:1 on panel —
  [CONFIRM] with the contrast check), padding 12 24, one line at 1440: Label
  13 amber `{age.label}`, then Body 15 read `{age.detail}`. Wraps to two lines
  at 390. No icon, no dismiss (it is a fact about the figures, not a
  notification).
- Shown on **every screen that presents filed statements** (DESIGN.md: "every
  screen that presents filed statements uses" `StaleFigures`). Today it is on
  the company page and the figures editor only, **not on the valuation screen
  (`TerminalDashboard.tsx`)**, which shows the same filed years (conflict 3).

**Stale price (S17, ADD per COMPANY_OVERVIEW §1.9):**
- When the last close is older than the previous trading day of its exchange:
  the same band, line-control border (not amber: a price gap is a market fact,
  not a filing caution — COMPANY_OVERVIEW wording), text `Last price {date}.
  Prices after this date are not available.` The chart, 52-week range and
  returns end on that date.
- Both bands can show at once; stale price first.

### 3.5 Error and offline states

**Never show a raw exception.** Today `fetchCompanyPayload` throws whatever
the server or the browser said: a network failure surfaces as the browser's
own words (Chrome "Failed to fetch", Safari "Load failed" [CONFIRM per
browser]), and a non-JSON reply (a Vercel timeout page) surfaces as a JSON
parse error, because `response.json()` is read before `response.ok` is
checked (`autoCompany.ts` ~53). ADD one mapping, in one place
(`src/data/errorText.ts`, PROPOSED name), used by every state:

| Cause (detected by) | Title | Reason |
|---|---|---|
| Offline (`navigator.onLine === false`, or a `TypeError` from `fetch`) | `You are offline` | `Marginalia needs a connection to read filings. Nothing you changed on this page is lost.` |
| Server timeout or non-JSON reply | `The source took too long` | `{Source} did not answer in time. This is usually brief.` |
| Server error with a message (`fetched.error`) | `{Ticker} could not be read` | The server's own sentence — these are already written for readers (e.g. the two-years-of-history refusal). |
| Payload version mismatch (`payloadVersionProblem`) | `This page is out of date` | `The site was updated while this page was open. Reload to read the current version.` Action `Reload`. |
| Anything else | `Something went wrong` | `This is our fault, not yours. Try again; if it repeats, the report link below tells us.` |

**Offline behaviour (S19):**
- Detection as above; listen for the `online` event and retry **once**,
  automatically, for the request that failed; otherwise `Try again`.
- The header stays usable. No full-page takeover: the block replaces only the
  panel that needed the network.
- A top-of-page band for offline? No — one state per panel is enough and a
  second band would stack with the stale bands. (APPROVED 4 Nov 2026.)
- The static `/learn/` pages have no offline handling and need none beyond the
  browser's; a service worker for reading offline is out of scope (Next).

### 3.6 Page not found (S18)

Today there is no not-found page anywhere:
- In the app, any path that is not `/company/…` or `/screener` renders the
  **landing page at the wrong address** (`App.tsx`: the `HOME` branch runs for
  every other path), so `/learn/notes` typed before 2.2 exists, or a mistyped
  link, silently shows the home page.
- On the deployed site, `vercel.json` rewrites only `/company/:path*` to the
  app, so a direct load of `/screener?…` or any unknown path is answered by
  Vercel's own 404 page, off-brand [CONFIRM on the live site — the screener
  link in the address bar is its whole point, SCREENER_SPEC rule 22].

Spec (ADD):
- **Static `404.html`** at the build output root, instrument ground, global
  header (static copy, 2.4 note), served by Vercel for any unknown static
  path [CONFIRM Vercel serves a root `404.html` for this project type].
- **In-app not-found** for unknown client paths, same content.
- Content, centred in the content column at 1440, left-aligned at 390, top
  at y = 160 (64 + 96): eyebrow none; h1 `This page does not exist`, Title,
  ink, with the mark; Body 15 read `The address {path} is not a page on
  Marginalia. It may have moved, or the link may have a typo.`; then three
  links as a list, Body 15 link-source style: `Search a company` (opens the
  palette), `Learn` (`/learn/`), `Home` (`/`). No illustration, no "404" in
  display type, no joke.
- A company that does not exist is **not** a 404: it is S2 at its real
  address, because the reader may have typed a valid ticker the source has
  not got.

## 4. The phone menu

Not built: today's header at 390 (`Header.tsx`) has the 20px wordmark and up
to four icon buttons (Check the figures, Search a company, Home, All
companies), no menu. NAV_SEARCH §2 specifies the sheet; this pack completes it
for the Learn area and the states.

- Trigger: `Menu` button, 44×44, right of Search, below 1100px (NAV_SEARCH
  checklist 5). Label `Menu`, becomes `Close` with `aria-expanded="true"`.
- Sheet: top edge at y = 64 (header stays visible), height `calc(100svh -
  64px)`, overlay ground, no radius, no shadow, scrim `rgba(11,11,13,0.72)`
  with **no blur** on phone (VISUAL_SYSTEM §2). Focus trapped, Esc and Close
  dismiss, focus returns to Menu.
- Seven accordion rows, 56px, in the Idea Book order (Companies, Research,
  Markets, Invest, Tools, Learn, Deals); a section with no shipped
  destination is hidden (NAV_SEARCH decision 4). Row label Body 15 ink, chevron
  12px on the left rotating 0→90°.
- Link rows 48px, Body 15 read, indented 24. Current page: ink, weight 600,
  the selected state (overlay-raised ground, 1px accent border; one oxblood
  border).
- Learn opens to: `All of Learn` (`/learn/`), `Margin notes` (`/learn/notes/`),
  then the eight explainers by title. In-build items appear as text with a
  `being built` word and no link (NAV_SEARCH checklist 9).
- Footer row 56px: the `Reduce motion` switch (a real `role="switch"`), Label
  13 muted, switch 44×24 with line-control border.
- Offline: the sheet works (it needs no network); links that need data open
  their screen, which shows S19.
- Tablet (640–1023) uses the same sheet; ≥ 1100px uses the desktop menu.

## 5. Motion (tokens only, VISUAL_SYSTEM §4)

| Motion | Where | Properties | Duration · curve |
|---|---|---|---|
| Page transition | main region, Learn and notes routes | opacity; translateY 8px→0 | out 120ms `--m-ease-exit` · in `--m-dur-slow` 280ms `--m-ease-enter` |
| Note switch inside the notes screen | article only | opacity cross-fade, no travel | `--m-dur-fast` 110ms `--m-ease-standard` |
| Index current marker | the selected state | none — instant | 0 |
| Hover on links and rows | colour only | color | `--m-dur-fast` 110ms `--m-ease-standard` |
| Disclose (phone note index, phone Learn groups, menu accordion) | height, opacity; chevron 0→90° | `--m-dur-base` 200ms `--m-ease-enter` / 140ms exit |
| Menu sheet | translateY(100%→0); scrim opacity | `--m-dur-slow` 280ms in `--m-ease-enter` / `--m-dur-base` 200ms out `--m-ease-exit`; scrim `--m-dur-mod` 240ms |
| State block appearing | after 200ms of waiting | opacity 0→1 | `--m-dur-base` 200ms `--m-ease-enter` |
| State block → content | swap | opacity cross-fade | `--m-dur-fast` 110ms |
| Stale bands | none | — | appear with the page, never animate in |
| 404 page | none beyond the page transition | — | — |

Scroll on note change: `window.scrollTo({ behavior: 'smooth' })` today
(`marginNotes.tsx` `open`). CHANGE: scroll the article's top to y = 88
**instantly** under reduced motion and when the article top is already within
one viewport; smooth only otherwise.

Never: reveal-on-scroll on /learn article text (VISUAL_SYSTEM §4 allows it on
landing and /learn — APPROVED 4 Nov 2026: not on article body, which is
read, only on the hub's two column headings); skeleton shimmer; spinners;
typewriter; animated "…"; any number tweening.

### 5.1 Reduced motion

Under `prefers-reduced-motion: reduce` or `data-motion="reduced"`: all
translate goes to 0; page transition, note switch, sheet and state blocks
become opacity-only at ≤ 110ms; Disclose snaps with the chevron rotating
instantly; smooth scrolling is off. The static `/learn/` stylesheet carries
the same media query (it has none today; it has no motion today either, so
nothing breaks).

## 6. Accessibility

- `lang="en-IN"` on the app and every static page (VISUAL_SYSTEM §7; today
  `index.html` and the `/learn/` template both say `lang="en"`).
- Every state block is `role="status"` (loading, empty) or `role="alert"`
  (error, offline), with the title as its accessible name; a state never
  steals focus except after the reader pressed `Try again`, when focus moves
  to the title.
- Focus ring 2px ink, offset 2px; on Paper 2px paper-ink (VISUAL_SYSTEM §7).
- Targets ≥ 24×24, ≥ 44×44 under `(pointer: coarse)`; the note index rows are
  40 at 1440 and 48 at 390.
- Reflow at 320px and at 200% zoom without horizontal page scroll; tables
  scroll inside their own container.

## 7. Conflicts found in the current code

Severity: **H** breaks a stated rule or hurts data trust; **M**
inconsistency; **L** polish.

| # | Where | Finding | Fix | Sev |
|---|---|---|---|---|
| 1 | `/learn/` static stylesheet (`buildExplainers.mts` ~173–246) | Off the type system and outside the `index.css` remap: back link and eyebrows 12px uppercase tracked 0.16–0.22em, table heads and labels 11px uppercase, h1 34/46/56px, h2 24/28px at weight 500, standfirst 19/21px, body 16/17px, sub-lines 14px at weight 300, body weight 300. Breaks the 13px floor, the no-capitals rule, the four steps and "every title Newsreader at 600". | Section 2.3–2.4 sizes; generate the stylesheet from `SIZE` in `tokens.ts` as it already does from `PAPER`. | H |
| 2 | Not-found | No not-found page; unknown app paths render the landing page at the wrong address; on the live site unknown and `/screener` direct loads may get Vercel's 404 (only `/company/:path*` is rewritten). | Section 3.6; add the rewrite for app routes. [CONFIRM live] | H |
| 3 | `TerminalDashboard.tsx` | `StaleFigures` is not shown on the valuation screen, which presents the same filed years, against DESIGN.md's "every screen that presents filed statements uses" it. | Add the band (3.4). | H |
| 4 | `autoCompany.ts` ~53, `App.tsx` ~170 | Raw exception text reaches the reader (offline, timeout, JSON parse error), because `response.json()` runs before `response.ok`. | Error map (3.5). | H |
| 5 | Margin notes | No address: cannot be linked, bookmarked, or reached with Back; `/learn/` links "the margin notes" to `/`, which opens the landing page. | Section 2.2. | H |
| 6 | `marginNotes.tsx` ~103, `MethodologyGrid.tsx` ~90 | `text-[60px]` is not in the remap list, so the h1 renders at 60px — outside the four steps. | Title step. | M |
| 7 | `companyPage.tsx`, `screenerScreen.tsx`, `priceChart.tsx` | State titles written as literal capitals (`READING THE FILINGS`, `NOTHING TO SHOW`, `NOTHING TO SCREEN`, `READING THE TABLE`, `NO CHART`); the `.uppercase` remap cannot reach literal text. `NOTHING TO SHOW` and `NOTHING TO SCREEN` are in accent-text. | Sentence case, ink (3.1). | M |
| 8 | `DirectoryScreen.tsx` ~298 | Build error in an oxblood wash with a 50% oxblood border; spends a wash on a possible typo. | Standard block. | M |
| 9 | `marginNotes.tsx` (phone) | The whole 28-row index sits above the article on a phone; the tapped note is about 1,100px down. | Disclose index (2.5). | M |
| 10 | `DirectoryScreen.tsx` ~104 | A failed suggestions request empties the list and says nothing; no "no matches" line either. | S12, S13. | M |
| 11 | `Header.tsx` | No phone menu; the clocks with seconds and a pulsing green dot (`animate-pulse`) still render at ≥ 1536px (`2xl`). Already NAV_SEARCH conflict 1; repeated because the Learn pages will share this header. | Section 4; NAV_SEARCH §2. | M |
| 12 | `staleFigures.tsx` | Amber border at 50% opacity on panel: likely under the 3:1 boundary minimum. | Full-strength border. [CONFIRM contrast] | M |
| 13 | `index.html`, `/learn/` template | `lang="en"`, not `en-IN`. | Change both. | L |
| 14 | `marginNotes.tsx` | Eyebrow in accent-text with a red rule; current note marked by a 3×3px red dot (below any visible target size); hover to raw `#8B1E1E` (remapped to accent-text in `index.css`, so it renders, but the source names a hex). | Section 2.5. | L |
| 15 | `CoverageStatsSection.tsx` | `Sending...` (three full stops), `Success!` | S15. | L |
| 16 | `savedModelsPanel.tsx` ~202 | 14px and hex `#8A8A8F` in the source (both remapped, so it renders on-system). | Tokens. | L |
| 17 | `DirectoryScreen.tsx` ~288 | The red square used as a bullet in the hint box. | Remove (S10). | L |
| 18 | `docs/VISION.md` §1, §5g | Says 19 Margin notes; `marginNotes.ts` holds 20. Not edited here (another session owns the file). | Update when that file is next edited. | L |

## 8. Developer checklist

Learn
1. `/learn/`, `/learn/<slug>/`, `/learn/notes/`, `/learn/notes/<key>/` each load directly (not only by in-app navigation) and Back works between them.
2. Every `/learn/` page has the global header with Learn current, and `lang="en-IN"`.
3. Computed font sizes on every `/learn/` page are only 13, 15, 20 and the Title clamp; no `text-transform: uppercase`; no letter-spacing above 0.005em on body text; headings weight 600; no weight 300.
4. Article column ≤ 640px; tables scroll inside their own container at 390 with a sticky first column.
5. Margin notes index is sticky at 88px at ≥ 1024px and a closed Disclose at < 640px; current note has the selected state; previous/next links follow the index order.
6. Every link from the landing band, the explainers and the menu to a note lands on that note.

States
7. Every loading, empty, error, not-found and offline state uses the 3.1 block: title in sentence case, ink; no literal capitals in source (`grep -E '>[A-Z ]{6,}<'` on components returns no state titles).
8. No state shows a raw exception: forcing offline, a 504 HTML reply and a malformed JSON reply each produce the 3.5 wording.
9. Offline: going back online retries the failed request exactly once.
10. A loading block never appears before 200ms; a state block has the height of what it replaces (no layout shift, CLS 0 on the company page).
11. Stale-figures band appears on the company page, the figures screen and the valuation screen for a company whose latest period ended more than 18 months ago, and on none of them otherwise; its border measures ≥ 3:1.
12. Stale-price band appears when the last close predates the previous trading day; the chart and 52-week range end on that date.
13. An unknown path shows the not-found page with the path printed; an unknown company tab slug rewrites the address to Overview.
14. Search with no suggestions says so; a failed suggestions request says so and the field still builds a model.

Phone menu
15. Menu at < 1100px, 44×44; sheet top at y = 64; rows 56 and 48; no blur; focus trapped; Esc returns focus to Menu.
16. Learn section lists Learn hub, Margin notes and the eight explainers; in-build items have no link.

Motion and accessibility
17. Every duration and curve is a `--m-*` token; `transition: all` returns 0 matches.
18. Reduced motion: no transform runs; fades ≤ 110ms; Disclose snaps; no smooth scroll.
19. Focus ring 2px ink (paper-ink on Paper), offset 2px; nothing focused sits under the header.
20. Reflow at 320px and 200% zoom with no horizontal page scroll.

## 9. Decisions (Nihar, 4 November 2026)

**L1 to L8 are approved.** Each was my choice, made to stay closest to the
existing docs; the build proceeds on them.

- **L1. APPROVED** (Nihar, 4 November 2026). Addresses `/learn/notes/` and
  `/learn/notes/<key>/` for the Margin notes, and `/learn/` as one hub for
  explainers and notes (2.2).
- **L2. APPROVED** (Nihar, 4 November 2026). Long-form reading on Paper uses the Body
  step (15px) with a 640px measure rather than a larger reading size, because
  COMPANY_OVERVIEW D1 forbids new sizes and the landing-only Lead step is
  landing-only.
- **L3. APPROVED** (Nihar, 4 November 2026). The global header on the static `/learn/`
  pages as a static copy generated at build (wordmark, menu links, a Search
  link that opens the app's search), since the palette cannot run on a
  static page.
- **L4. APPROVED** (Nihar, 4 November 2026). A "Related margin notes" rail on explainers
  at ≥ 1280px only.
- **L5. APPROVED** (Nihar, 4 November 2026). Offline is shown per panel, with no
  site-wide offline band.
- **L6. APPROVED** (Nihar, 4 November 2026). No reveal-on-scroll on article body text in
  /learn, although VISUAL_SYSTEM §4 permits it on /learn; only the hub's
  column headings may reveal.
- **L7. APPROVED** (Nihar, 4 November 2026). The stale-price band uses a line-control
  border, the stale-figures band amber, as COMPANY_OVERVIEW §1.9 already
  words them.
- **L8. APPROVED** (Nihar, 4 November 2026). One error-wording module
  (`src/data/errorText.ts`) owning the 3.5 table, so no screen writes its own.
