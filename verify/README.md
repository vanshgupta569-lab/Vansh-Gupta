# verify — the harness every engine change is checked against

Nothing that touches the engine, the derivation or the Excel export ships
without these passing. They are the reason a change can be described in a
commit message with numbers rather than adjectives.

They check that the model is **internally consistent** and that the **workbook
reproduces the site**. They do not judge whether a valuation is sensible; that
is what `KNOWN_ISSUES.md` and a reader's own eyes are for.

## Install

```
npm install
```

`hyperformula` is a dev dependency: it recalculates a built workbook outside
Excel, which is how the suite checks formulas rather than the values the
generator happened to write. It is GPL-3.0 (dual-licensed), used only in
verification and never bundled into the site.

## The six commands

| Command | What it does | Needs payloads |
|---|---|---|
| `npm run verify` | The scenario suite: ten scenarios over one model. | No |
| `npm run verify:dashboard` | Drives the real site in a browser and checks the page against the engine. | No |
| `npm run verify:sweep -- <tag>` | Snapshots what the site would show for every fetched company. | Yes |
| `npm run verify:compare -- <a> <b>` | Measures two snapshots against each other. | No (reads snapshots) |
| `npm run verify:workbook` | Checks the workbook reproduces the site, company by company. | Optional |
| `npm run verify:indices` | Fetches the 21 market indices a beta is measured against. | Writes them |

### The job loop

```
npm run verify:payloads            # once; ~15 minutes, then reused
npm run verify:indices             # once; 21 requests, ~90 seconds
npm run verify:sweep -- before     # before touching anything
#   ...make the change...
npm run verify                     # scenario suite: every Checks row zero
npm run verify:dashboard           # the page still shows what the engine produced
npm run verify:workbook            # workbook still equals the site
npm run verify:sweep -- after
npm run verify:compare -- before after
npx tsc --noEmit && npm run build
```

`compare` prints what moved, by how much, how many moved more than 5%, and
which companies gained or lost a value. That is the before/after a commit
message quotes. `--field wacc` (or `costOfDebt`, `netDebt`, `debt`, `ebitda`,
`beta`, `spread`, …) adds the largest moves on any figure the sweep records,
so a question a particular job is asking rarely needs a new script.

Snapshotting both sides is deliberate: the payloads, the drivers and the
machine are then identical, and the only thing that moved is the code. There
is no dependency on a checkout of the previous commit.

## What the scenario suite checks

`npm run verify` builds the workbook the site would hand a user, recalculates
every formula in it with HyperFormula, and then checks, **in each scenario**:

- every row on the Checks sheet is zero, and its summary says all checks pass;
- the balance sheet balances in every year;
- no error cells anywhere in the workbook;
- each statement sheet ties to the model sheet (48 ties on the curated model,
  54–60 on a fetched one), and every annexure link resolves (544–680);
- the DCF's value per share, recomputed here from the sheet's own cells by
  arithmetic written in the suite, equals what the sheet reports — so a
  workbook that silently stopped matching the engine is caught;
- PIK interest is charged, accrued and added back exactly once;
- the depreciation and stock-compensation sweeps move profit and cash flow by
  the amounts they should;
- no formula reaches into the units column.

It also checks things that are not about a workbook at all, because there was
nowhere better to put them and each is cheap:

- **a driver moves the value the way it reads.** Twelve of the sliders are set
  back to their own defaults, which must reproduce the untouched model to the
  last decimal, and nudged a point each way, where the value must move in the
  direction the driver's label implies. A handler that writes a level where it
  should write a shift passes every other check here and still makes a verdict
  of *this hurts* raise the valuation, which is what the research-spending
  slider did until 2026-09-27.
- **the loading-screen notes hold together.** No entry missing a field, no
  duplicate key, and — over four hundred shuffles — every note shown once and
  never three from the same part of the accounts inside the first twenty.
- **the palette is one palette, and it is legible.** The colours live in
  `src/design/tokens.ts` and are restated as custom properties in
  `src/index.css`, because a stylesheet cannot import a module and a component
  cannot read a custom property. The two are compared, so neither half can drift
  from the other. Every token that carries words is measured against every
  ground it sits on and must clear 4.5:1, the WCAG AA floor for normal text. The
  mark's `-0.21em` right margin is checked, since that is the whole reason it
  has zero advance width. And no component may declare a palette colour of its
  own, which is the habit that produced eight copies of the same six hex codes
  and an eyebrow at 3.90:1 on every screen. Since build step 8 job 8.1 the
  grounds include the overlay and the paper panel, and a second floor of 3:1
  (WCAG 1.4.11) covers the control boundary (`lineControl`, on dark and on
  paper) and every chart series; the five series must not share a stroke; and
  each sequential ramp must run in order (lightest largest on dark, darkest
  largest on paper) with its pale steps — those under 3:1 — named exactly in
  `SEQUENTIAL_NEEDS_OUTLINE`, because a cell in one needs an outline. Since
  job 8.2 the seven type steps in `SIZE` are compared with `--m-size-*`, and
  the hero figure must be the title step; since job 8.3 the motion tokens
  (`--m-ease-*`, `--m-dur-*`) are part of the same mirror.
- **motion runs on the tokens** (build step 8, job 8.3). Every source file
  under `src/` except the tokens is scanned, comments removed, for
  `transition: all`, for a duration, delay or curve written out instead of
  taken from a token, and for anything animated outside transform, opacity,
  clip-path, the hover colours and the disclosure's height. Today's code
  breaks these in twelve files, so the check is a ratchet (decision V4):
  `MOTION_RATCHET` holds each file's count per category as measured on
  2026-11-04 — 3, 99 and 7 in total — and a file may fall below its number
  and never rise above it; a file not listed must be zero.
- **the valuation bridge** (build step 5 part C, `verify/bridge.mts`, on the
  paper fixture, so it needs no payloads). C1: the drivers between two
  versions equal the inputs changed by hand; A with none of B is A, with all
  of B is B; each driver moves the value alone; a refused mix is reported with
  its reason. C2: the spec's worked example to the cent (FCF 161.64, WACC
  272.20, growth 137.59 after largest-remainder rounding, total 571.43, in
  2^3 runs), and on the fixture the parts sum to the total to the cent, with a
  driver that changes nothing at exactly zero. C3: above ten drivers, 2,000
  orders drawn from a fixed seed: on a 14-driver function with interactions
  the parts sum to the total exactly, repeat on the seed, change on another
  seed, and every part is within 1% of the total of the exact answer (worst
  0.089%, measured 4 November 2026).
  C4: ten drivers on the paper company, timed (1,024 runs, about 3–5 seconds
  here); in `verify:dashboard` the same bridge goes through
  `bridgeInWorker` in the real browser and must come back once and whole —
  every part, adding up, equal to the Node bridge part for part — while a
  50ms timer on the page keeps at least half its own idle rate.
- **the feature register** (build step 8, job 8.6, `src/data/featureRegister.ts`).
  Every feature has a valid status and the VISION.md row it was read from; an
  unshipped one has a future-tense line; a quarter is recorded as "Q1 2027" or
  absent, never computed; no banned word from either list (the screener's and
  LANDING §2.3's); the company-count label follows LANDING §2.3 on eight cases.
  `verify:dashboard` then reads the rendered landing page against it.
- **the landing page budgets** (build step 8, job 8.7; `npm run build && npm
  run verify:landing`, its own command because it needs the build and
  Lighthouse). The bundle: three.js in a chunk of its own, not loaded by
  `index.html`, at most 180KB gzipped; the poster at most 60KB. Lighthouse,
  desktop preset, on `vite preview`: LCP at most 2.5s, CLS at most 0.1, TBT
  (for INP) under a 600ms ratchet while `KI-40` is open (budget 200ms), and the
  largest paint the poster or the hero headline, never the canvas.
- **the explainers are whole.** The eight articles at `/learn/` are static HTML
  written at build time by a small markdown renderer, and a renderer that
  quietly drops a construct publishes a beautifully typeset page with a hole in
  it. So every prose line of every markdown source is looked for in the built
  page, along with the title, description, canonical link, H1 and a way back to
  the index — and the pages are checked to carry no script at all, which is the
  whole point of them. Run before `npm run build`, it says so and checks the
  sources only.

- **the quarters: cumulative, derived, and what the TTM is made of.** Three
  failures that would all look right on screen. **A cumulative figure shown as
  a quarter**: a 10-Q reports cash flow from the start of the year, so Apple’s
  "Q3" point spans 272 days, and printed as a quarter it is nine months of
  cash read as three. Checked as arithmetic rather than trust — four quarters
  must add to the year beside them — and separately against each period’s own
  start and end dates. **A derived quarter with one filing**: a quarter worked
  out as this year-to-date less the last is a claim about two documents, and
  both must be linked. **A TTM that ignores the quarters it has**: where four
  real quarters run past the year end the column must be those four, ending on
  the latest, not the financial year wearing a fresh label. The SEC path is
  held to the sum; the vendor path is measured and reported rather than failed,
  because nothing there is derived by us and a mismatch is the feed
  disagreeing with itself.

- **the financials tab’s four rules.** `docs/FINANCIALS_SPEC.md` is mostly a
  list of ways a financial table lies, and these are the four that can be
  checked without a browser, over every payload on disk. **The TTM method is
  read off the periods the company filed**, not its country — driven with
  constructed period sets so the three branches today’s annual-only data never
  reaches are still exercised. **A gap is an em dash and never a zero**, checked
  against the payload field rather than against the view, so the two come from
  opposite directions. **No bank carries an operating margin, an EBITDA, a gross
  profit or a cost of sales** (rule 13). **No balance sheet line is ever
  summed** (rule 6) — and specifically, the trailing-twelve-month column is
  never the total of the balances behind it. Measured: 35,071 cells over 175
  companies, 4,828 of them with nothing behind them, 178 filed nils kept
  distinct, 36 banks, 2,697 balance sheet rows. Proved by breaking all four at
  once: 7,483 faults.

- **every payload capture is still the capture it was.** Stage 0 of
  `docs/ARCHIVE_PLAN.md`: a fetch keeps the payload under
  `verify/payloads/versions/<TICKER>/` in a file **named for the hash of its own
  contents**, and this reads every one of them back. A capture that has been
  edited no longer hashes to its name; a capture deleted from disk is still in
  the log, and one added without a log line is on disk and not in it, so both
  directions fail; every payload must have at least one capture; and the payload
  the whole suite reads must be byte-for-byte the newest capture of it, which is
  what makes "the set reads the latest" true rather than intended. Proved by
  editing a capture, deleting another and rewriting a pointer in place: six
  faults, each naming what happened.

### The risk and cost-of-capital card: five rules, two defaults, and the regression

Measured over every payload on disk, with the index series from
`npm run verify:indices` so a real beta can be struck for every company
without a network.

**The regression is checked against a series whose answer is known before the
code runs**: an index that moves by a fixed pattern and a share built as exactly
1.3 times it plus half a point a month. The slope must come back 1.3, the
intercept 0.005 and the fit 1. The two series swapped — the easiest mistake, and
invisible, because one over beta is a plausible beta — gives 0.769 and the check
says so. An index that never moved, and a window with five returns in it, must
both be refused rather than answered.

Then the five rules of the card itself:

1. **Country risk is added once.** With the premium switched on, the premium in
   use must be the mature-market figure plus that country’s, the row must rename
   itself to say which of the two it is, and the cost of equity must be the rate
   plus beta times that one premium. Proved by handing the engine the country
   premium twice while the card shows it once: 124 faults.
2. **No bank gets a WACC.** Every company on the bank template must carry no
   WACC, must say it is not applicable, and must not have had its beta
   relevered. Proved by letting banks through: 24 faults.
3. **A minor unit is normalised.** On every listing quoted in pence, cents or
   agorot, the price the card shows times the share count it shows must equal
   the market capitalisation the weights were struck on. Proved by showing the
   quoted figure in the price row: 10 faults, each naming the factor of 100.
4. **Every input shows a publisher and a date**, or says why there is no figure.
   Proved by dropping the date from the risk-free rate: 144 faults.
5. **An edit reaches the model.** A point on the risk-free rate must move the
   cost of equity by exactly a point; setting beta must move it by the premium
   times the change; two points must move the value per share. Proved by cutting
   the edits off from the engine while the rows still show them: 394 faults.

And one the card exposed rather than introduced: **a currency with no published
yield gets no cost of equity and no WACC at all.** Proved by putting back the
`null + premium` arithmetic in `computeWACC`: 22 faults.

Then the two defaults Nihar decided on 2026-10-30:

6. **The country premium is in the premium the ENGINE discounts at**, not only in
   the one the card prints. The two are compared company by company to the
   twelfth decimal place, the engine is asked to say what the premium follows
   (rule 14's label), and switching the premium off on the card must return the
   mature-market figure and say so in the row. Proved by leaving the engine on
   the mature premium while the card shows the total (122 faults) and by
   defaulting the card the other way (923 faults).
7. **Either measured beta can be put into the model, per company.** The figure
   the model uses must be the figure printed on the button that set it — not that
   figure relevered a second time, which is what it was for one day — the card
   must say which of the two it is using, the cost of equity must follow, and the
   warning must appear on exactly the estimates whose R² is under 10% or whose
   standard error is above 0.25. Proved by making the weak-fit test always
   false: 164 faults.

The two copies of the index allow-list — `src/data/marketIndex.ts` and
`api/marketIndex.js`, which cannot import from `src/` — are compared symbol by
symbol and name by name, because a second copy that nothing checks is a second
copy that goes stale.

### One header, on one line, at the width it is tightest

`dashboard.mts`. One header now serves every screen: the wordmark, four nav
links, the way back to the figures, a ghost search and the theme control, in a
bar 64px tall. The inner row is `flex items-center` with **no wrap**, so a bar
that does not fit does not fold onto a second line — it OVERFLOWS, and the
control at the end goes off the edge of the screen where nobody finds it.

**1100px is where it is tightest**, which is why it is the width driven: the nav
links and the figures label appear at the `lg` breakpoint (1024px) and the bar
has least spare room just above it, while below 1024px the links are hidden and
the label collapses to an icon. Four things are asserted at that width, on the
two screens that do not carry the same controls — the routed company page (6
controls) and the valuation screen (7): the row does not overflow its own box,
every child sits inside the 64px band, no child passes the right edge of the
window, and the document itself does not scroll sideways.

**And the way back to the figures is there, in those words.** "Check the
figures" with nothing yet corrected or moved, which is the state a reader
looking at a valuation that seems wrong is in.

Proved by breaking, two ways: the bar's gap widened to 200px, which is the shape
of every header that has ever broken — it does not wrap, it overflows (**436px
past the row on the valuation screen and 279px on a company screen**); and the
label renamed to "Figures", which the saved-model walk reports as the way back
to the figures being gone.

### One decimal rule per row

`docs/VISUAL_SYSTEM.md` finding 1, severity H: a single row printed **9,439.0,
then 11,618, then 16,621**, because the decimals came from each figure’s own
magnitude. Right alignment puts every last glyph on one edge whatever it is, so
the trailing `.0` lines up and pushes the units digit — the digit a reader
compares down a column — left by its own width.

Checked in two places, because it is two different questions. In
`scenarios.mts`, over **53,324 figures across 9,784 rows and 177 companies**:
every row prints one number of decimal places, a row in millions prints none,
zero prints as `0`, a figure nobody reported prints as an em dash, every
negative carries U+2212 and none a hyphen, and **both tables read the rule from
`src/data/figureFormat.ts`** rather than keeping a copy of it. In
`dashboard.mts`, in a real browser on both tables: every figure ends on its
column header’s right edge, and every row stops its **digits** on one edge —
measured with a Range that ends before the decimal point, which is where the
finding’s 6px actually was.

Proved by breaking, five ways: the decimals put back by magnitude (4,979 faults
in `verify`, and the browser reporting “Net income” spreading **6.5px** across
$92.25, $102.4, $112.5, $122.6, $132.8, $146.0 — the finding’s own 6px,
reproduced); the em dash replaced by a zero, the minus sign replaced by a
hyphen, and one table given back its own copy of the rule (8,990 between them);
and the figure cells’ right padding cut from 12px to 4px, which the browser
reported as 8.0px off the column head on every column.

### A margin is a division, in every column

Until 2026-11-03 the trailing-twelve-month column added up whatever the four
quarters held on every row that was not a balance sheet line. That is right for
money and meaningless for a **ratio**: four quarterly operating margins added
gave NVIDIA **260.0%** where the two figures printed directly above it in the
same column — operating income 197,579 and revenue 302,969 — divide to
**65.2%**. There was no wrong denominator; there was no denominator at all.

So this asserts the identity a reader can check with a calculator, on **every
column of every statement of every company**: 1,953 margin cells across 2,260
columns of 142 companies, each equal to the two figures printed in its own
column, divided here rather than taken from the view.

Three arms, because any one of them alone would have held while the column was
wrong. **The division, done in the check** — the printed numerator over the
printed denominator; this is the arm the fault failed, because a sum of ratios
matches nothing. **The bound**: no margin outside −100% to 100% on positive
revenue, which would catch a denominator wrong in the inputs rather than in the
division. **The trailing twelve months really is the four quarters** — 2,346
money figures re-added from the **quarterly** columns, built from the quarter
rows rather than from the method that built the TTM column, because arm 1 proves
only that the margin and the two figures beside it agree, not that any of them
is right. The opposite fault is reported too: a margin withheld where both its
figures are printed is as wrong as a wrong number and quieter.

**Two quarters breach the bound and are read at their own 10-Q rather than
waived.** On the upside the bound is an arithmetic impossibility — operating
income above revenue means income that is not in the denominator — and nothing
in the set does it. On the downside it is not: an impairment or an acquired
in-process research charge is an operating cost with no ceiling. Gilead's
quarter to 30 Jun 2026 is an operating loss of 10,394 on revenue of 7,803,
taken as the difference between the two halves it tags in 10-Q
0000882095-26-000031; Sandisk's quarter to 28 Mar 2025 is 1,881 on 1,695, of
which 1,839 is an operating charge the income template carries no row for
(`DATA_CONSTRAINTS.md`). The list is named and dated, and the check fails
**both ways** — an unlisted breach is a fault, and a listed one that has
stopped breaching is a fault too, so it cannot outlive what it accounts for.

Proved by breaking, five ways: the TTM column put back to adding whatever the
row holds (**155 faults**, every one a trailing margin, both arms reporting);
the four-quarter sum put 1% out, which leaves every ratio unchanged and so is
invisible to arm 1 (**2,344**, all from arm 3); the margin multiplied by four,
the shape the fault was reported in (**2,719**); an accounted-for breach
dropped from the list (**2** — the breach itself, and the note left pointing at
nothing); and a note added for a margin that does not breach (**1**). NVIDIA's
own summed margin is also reconstructed at the end of the check and both arms
are required to report it, so neither alone is carrying the check.

### Every SEC figure names its concept and its own document

The Financials tab's claim is that a number can be traced to its filing. Three
of the four lines that made that claim were guesses or blanks until 2026-11-03,
and the link was wrong: it read "Open the filing" and opened an EDGAR search
page (`KI-37`). What is checked here is the four lines and the link, over every
column of every statement of every company.

**48,089 figures from SEC filings**: 43,581 name the XBRL concept they were read
from and 48,063 name the accession number of the one document they are in. A
concept must be an XBRL element name AND one of the concepts the data layer
actually reads for that line — or, for a financial company's top line, the tag
settled for that company (`KI-32`). A form must be **one form as filed** in the
SEC's own spelling, which the thing it replaced was not. The address of every
document is rebuilt here from the accession number and the CIK rather than
compared against the string the fetcher wrote, because "a plausible URL" and
"this filing's URL" are the same length and only one of them opens the filing.

**The arm that catches the quietest way this could go wrong**: every candidate
list is in order of preference, so a fetcher that recorded the first candidate
instead of the tag that matched would pass everything above — the concept would
be a real element name, in the list, and the same on every company. So at least
one line with more than one candidate must show more than one concept across the
set, and 20 of the 32 do.

**It also holds the evidence sheet's mirror of `US_TAGS` against `US_TAGS`.**
`src/data/financials.ts` cannot import from `api/company.js` — each file in
`api/` is packaged on its own by the host and a shared import there has taken
the route down — so the sheet keeps a copy of the tag lists, and this copy had
gone stale: one concept for stock compensation where the fetcher reads two, one
for depreciation where it reads three. 20,556 figures named a list that did not
contain the concept behind them, which is what the check reported the first time
it ran.

**"Not recorded" is counted and explained rather than tolerated.** 23,951
figures say it on the concept line and 26,482 on each of the form, filing date
and filing ID lines, and every one is either a vendor figure (the feed records
none of the four) or this site's own arithmetic (which has no concept of its
own). A figure read from a filing with neither is a FAULT, not a count. A vendor
figure must not claim a provenance it has not got, and must be offered no link
to a filing it has not got.

In `dashboard.mts`, in a real browser on the fixture: FY2023 revenue and FY2025
revenue, which the fixture deliberately tags under two different concepts, must
show two different concepts — a sheet printing the line's concept would pass on
one year and fail on the other. Each names its form (`10-K`), its date and its
accession number, and its link's address contains that accession number. And
interest expense, which the fixture gives a concept and no accession number,
must read **Not recorded** for the form and the filing and offer **"Find this
filing on EDGAR"**.

Proved by breaking, five ways: the figure's own provenance ignored, which is the
state before this job (**47,680 faults**); the form line restored to "Annual
report (10-K / 20-F), as tagged in XBRL" (**26**); the link labelled "Open the
filing" where it is a search (**26**, and 1 in the browser); one digit cut from
every filing address in a payload (**15**); and the line's first candidate
printed instead of the figure's own, which is what recording the preference
list's head would look like (**24,180**, and 1 in the browser).

### The two judgement-layer hooks: below the line, and debt

`verify/heads.mts`. Both hooks exist because the engine ties built operating
profit to the filed figure by carrying the difference on a reconciling line, so
money taken out of a named cost reappears in that residual and the forecast is
unchanged. Three heads were shown and refused for that reason until 2026-11-04.

**The below-the-line hook has two halves and each is asserted separately**,
because one without the other is worse than no control at all: a hook that takes
a cost out of the forecast operating base and forgets to charge it below the line
values the company as though the cost had vanished. So the first forecast year's
EBIT must rise by the amount moved — as a share of that year's revenue, because
the forecast grows revenue — and forecast PRETAX profit must not, because the
cost is still there one line down. The reported years must still tie to the
filing, the engine's own provenance must say what was done and carry the reader's
reason, and the adjusted EBITDA bridge must show the line, because a cost outside
operating profit is outside EBITDA.

**The debt hook** is checked on four things: the debt total moves by the figure
printed beside the line and by nothing else; the IMPLIED BORROWING RATE does not
move at all, because the filing's interest is the interest on the borrowings the
filing calls borrowings; the value moves in the right direction (more debt is
less equity); and the reader's reason reaches the net-debt provenance, which is
what the Assumptions sheet prints as the basis for it. The amounts are keyed by
fiscal year rather than by index, for the reason the one-offs amounts are: a
dropped period would otherwise take one year's lease out of another year's debt.

**And the screen's own tie still closes.** Revenue less every head must come to
filed operating profit under every assignment, which means subtracting what the
reader moved below the line — the filing charged it above the line, and this site
does not restate a filing. Checked over every single move of every movable line
on six companies.

**Nothing moves until a reader moves something.** `verify:sweep` either side of
the change: 178 payloads, 74 valued on both sides, **0 moved at all**, and the
two snapshots byte-identical — not a value, not a refusal, not a provenance
sentence.

Proved by breaking, seven ways: the amount never leaving the forecast operating
base, which is the state before this job (**6 faults**); nothing charged below
the line for other income (**1**); nothing charged below the line for finance
cost (**1**); the debt move never reaching the total (**2**); the borrowing rate
re-measured on the balance the reader settled rather than on the filing's own
(**2**, and it moves it a long way — 6.28% to 5.01% one way and to 17.21% the
other); the screen's tie forgetting what was moved below the line (**16**); and
the EBITDA bridge dropping the third kind of adjustment (**8**).

### Every column adds up, from revenue to operating income

The statement printed revenue, cost of sales, gross profit, research, selling
costs and operating income, and on 1,267 of its 2,025 columns those figures did
not add up to each other — the difference being an impairment, a restructuring
charge or a gain on a disposal that the template has no row for. `Other
operating items` is that row, and this is what holds it.

**What makes it a check rather than a restatement of its own formula** is which
figure the bridge has to close on. Operating income is the company's own filed
line, read from its own XBRL concept, and nothing in the bridge touches it, so
the column adding up is a tie against the filing. A sign error, a dropped input
or a row quietly gone absent breaks it on every company at once.

Four arms: gross profit is revenue less cost of sales in every column; the
bridge closes on filed operating income in every column of every company,
annual and quarterly, trailing twelve months included (worst gap in 2,025
columns: **4.08e-15**); the row is THERE wherever a bridge can be struck, since
a row that went absent would pass the second arm by having nothing to check; and
it is nil where the named lines account for everything, so the 240 nil columns
and the 1,267 bridged ones are counted rather than assumed. A frequency the
company does not file is not a column — 13 of the 178 file no quarterly income
statement and are told so on the screen, which is a different answer from a grid
that does not add up.

In `dashboard.mts`, in a real browser: the printed figures, read off the screen
with the screen's own minus sign and thousands commas, add up to the printed
operating income — the arithmetic a reader can do, which is the thing that did
not work. The fixture's own statement needs no bridge, so the row must read nil
there rather than a dash, and the cell's evidence must say **Derived** and show
the formula instead of a concept it has not got.

The trailing-twelve-month arm of the margin check re-adds every trailing money
figure to the four quarters it names, and this row is **not additive**: a row
defined against the figures its own column shows cannot also be the sum of its
neighbours. One trailing figure in the set differs from its quarters (TCS.NS, by
98,610), and the arm accounts for the difference to the penny — the lines the
trailing column cannot name, because one quarter reports them and the year
therefore cannot — rather than tolerating it or skipping the row.

**And the count it keeps**: 8 columns in 4 companies carry named costs that
exceed revenue beside an operating profit. That is not impossible arithmetic — a
gain inside operating income does it, and Boeing's FY2025 business sale is 10.8%
of its revenue — but a top line short of the filing's own total does it too, and
that is `KI-39`, which this row is what found.

Proved by breaking, five ways: the sign of the bridge flipped, so a charge reads
as income (**1,267 faults**); selling costs dropped out of the formula
(**1,417**); the row taken out of the template, which is the state before this
job (**271** — two per company, annual and quarterly, rather than one per column,
because a statement with no bridge row at all is one fault about the statement);
the optional inputs made required, so a column that reports no research line
stops adding up instead of carrying that amount in the bridge (**41**, every one
a trailing-twelve-month column, which is where the absent-input rule lives); and
the row's state written as reported rather than derived, which is this site's
arithmetic dressed as the company's own figure (**1,395**).

### A quarterly figure comes from the statement it was reported in

Three arms, because the obvious one cannot fail on its own. Once the data layer
stops reading a proxy statement there is no proxy-sourced figure left on disk,
so a check that only looked at the payloads would pass whether the filter were
there or not — the trap `CLAUDE.md` lists five of.

**The filter itself** is handed the shape of facts a proxy produces: a quarter in
its own 10-Q and tagged again in a proxy filed two years later with a different
figure; a half year only in the proxy; nine months only in an 8-K; a year filed
in a 10-K and restated in a 10-K/A; and a fact whose form the SEC left blank. The
period, the figure and the document each one has to come from are written out by
hand rather than read back from the function under test, and anything else the
filter lets through is a fault rather than a tolerance.

**The invariant over the set**: every quarterly figure of every payload is cited
to a 10-K, a 10-Q or an amendment, that document is in the payload's own
dictionary, and it was filed on or after the period it reports — a statement
cannot be filed before the period it covers. 37,239 figures, 31,206 from 10-Qs,
6,015 from 10-Ks and 18 from 10-Q/As.

**What the rule actually changed, from the capture archive.** Every fetch is
kept, so the payloads built before this fix are still on disk and the comparison
is against real data rather than a fixture: 126 figures across 34 companies now
cite the statement that reports them instead of a `DEF 14A`, an `8-K` or a
`DEF 14C`, 15 of them changing value with it, and none lost. If the archive holds
captures from before the fix and NOT ONE figure moved, the rule changed nothing
and the arm above is vacuous, which is itself the fault.

Proved by breaking, five ways: the form filter taken out, which is the state
before this job (**8 faults** — the proxy's figure in place of the 10-Q's, the
proxy-only half year, the 8-K-only nine months and the fact with no form);
the filter narrowed to reject an amendment (**2** — the 10-K/A's restatement
lost); the 126 citations put back on disk exactly as the capture before the fix
holds them (**127** — 126 figures cited to a document that is not a statement,
and the archive arm's own guard reporting that nothing moved); one figure cited
to a filing the payload does not hold (**1**); and one document dated before the
period it is given as the source of (**27**, that one filing being behind 27
figures). The two payload breaks copy the file to the scratchpad first and
restore it afterwards, and nothing is refetched: a capture built from a payload
broken on purpose would be kept for ever by the rule that keeps every fetch.

### The reporting currency is the main statements' own

Until 2026-11-03 it was read off every monetary tag the facts carried, so one
stray unit left it unestablished and refused the company. A US filer with a euro
bond tags that bond in euros; a Canadian subsidiary's balances are tagged in
Canadian dollars. Those are facts about the bond and the subsidiary, not the
currency the statements are presented in. **Worse than the refusal**: the unit a
figure was read in was whichever currency came first in the XBRL JSON, so where a
stray unit came first the figure itself was read in it and divided into millions
as though it were the reporting currency.

It is now the currency of the **main statement totals** — revenue, total assets
and net income — and every other figure is read in that currency and in no other.

Five rules, applied by one function so that the fault put back on purpose is held
to exactly the same ones. **One currency, and every figure taken in it**: the set
of units a figure was actually taken in must be exactly the reporting currency,
so a figure read in a second currency would show up as a second entry. **A stray
currency in the filing changes nothing** — and the set must contain companies
that exercise that, or the rule ships untested and this check cannot fail;
3 of the 85 SEC filers do, including Enbridge in Canadian dollars beside euros and US dollars, PepsiCo in US dollars beside Canadian dollars and euros, and Welltower in US dollars beside Canadian dollars. **The three the brief
named, against their own filings**: Enbridge presents in Canadian dollars,
PepsiCo and Welltower in US dollars, written in the check from the filings so the
expected answer does not come from the code that produces it. **A refusal names
the disagreement**, line by line and year by year. And **nothing falls back to
dollars**: what the payload shows must be the currency that was established, not
a default standing in for one.

85 of 85 SEC filers settle a currency this way and 0 have main totals
that genuinely disagree. **One company regains a valuation: PepsiCo at 103.47 a share.** All three regain a cost of equity, and Enbridge and Welltower are then refused by refusals they had never reached — no cost of sales, and no filed operating income.

Proved by breaking, five ways. The fetcher twice, asked directly and writing nothing — because a capture built by a deliberately broken fetcher would be kept for ever by the rule that keeps every fetch: the old rule put back, and all three lose their currency again; and `longTermDebt` added to the main totals, which takes Enbridge's currency away because its FY2023 long-term debt is tagged in euros, a euro bond doing exactly what this rule exists to ignore. Then the check three times, by mutating a payload on disk: a payload whose figures were taken in two currencies; one claiming a currency its own filing does not present in; and one that settled its currency on revenue alone. And the check carries the old rule's own output as a constructed case, because with nothing on disk left to find, the arms about a refusal and about falling back to dollars would otherwise ship untested.

### The screener: the universe, the filters and what they set aside

Ten rules of `docs/SCREENER_SPEC.md` are rules about data, so they are checked
over the whole table rather than over one screen of it. 178 companies, 16
metrics, 2,848 figures.

Every column publishes a formula of at least three words, a source and the
period each of its figures covers (rules 2 and 3). **A filter nothing can
fail matches exactly the companies that have the figure**, and every company
that has not got it is set aside and counted, with matched plus rejected plus
excluded equal to the universe on every one of the sixteen (rule 4). The 36
companies on the bank template answer `n.m.` with a reason on all eight
metrics rule 5 names, **and the companies outside it are still asked** — a
rule that marked everything not meaningful would pass the first half and
empty the screener. No banned word appears in any label, formula, source,
operator, column set, absence reason or listing note, nor in the screen’s own
prose (rule 12). **The count equals the rows on 240 screens** (rule 16). A
screen survives its own web address unchanged, ratios and all (rule 22). The
text view and the chips are one set of filters, and nonsense is refused
rather than guessed at (rule 9). A reader’s own formula is arithmetic and
nothing else: seven attempts to make it more than that — `process.exit(1)`,
`globalThis`, `pe.constructor`, a `fetch` — are refused with a reason (rule
8). Nothing sorts by a composite score because there is none, and a figure
that is not a figure sorts last whichever way the column runs (rule 13).

In `dashboard.mts`, against a table written in the check so the screen’s
output can be predicted exactly: the count on the screen equals the rows on
the screen and the data layer’s own answer; a company with no figure for a
filtered metric is set aside and **named in a sentence that opens with the
number**; a bank’s cell reads `n.m.` and says why when asked while an
ordinary company in the same column still shows a figure; the Price /
earnings header publishes its formula and source on **keyboard** focus; and a
filter added by hand lands in the web address, with the address alone
rebuilding the screen.

Proved by breaking, four ways: a missing figure made to fail a filter quietly
(13 faults — 57 companies dropped on EV/EBITDA alone without being counted);
the not-meaningful rule removed so banks are asked what banks cannot answer
(430, and the table’s `n.m.` count falls from 288 to 0); a banned word put in
a column label; and the match count knocked off by one (513 between them, and
both reported in the browser as well).

### Every rate names its publisher, and every publisher its terms

Canada and Denmark were added because their own central banks publish the
yield and permit its reuse; Switzerland was not, although the Swiss National
Bank publishes the same figure, because its terms do not allow commercial
reuse without written permission. The only thing that keeps that distinction
honest is that every source carries its terms beside its link.

So: every source and every fallback must have a name, a publisher, a
statement of terms that is a statement of something, a link those terms can
be read back at, and a stated publication frequency; every rate on disk must
come from a publisher this code declares and carry its terms; and **a source
for the Swiss franc fails the check**, so it cannot be added without the
decision being revisited rather than forgotten.

The terms rule is written as "four words or more" because that is what it
takes to say anything, and it earned its place immediately: the Riksbank’s
terms read "Riksbank open data", three words asserting a licence nobody had
seen. The Riksbank publishes none, and the field now says so.

Proved by breaking: the terms removed from one source, and a source added
for the Swiss franc.

### The risk-free rate: one fetch per currency, three tries, a fallback behind

A single request that did not answer used to take a company’s whole valuation
away (`KI-34`). Five things are checked, every one by standing in for the
publisher rather than waiting for it to have a bad day.

**One fetch per currency, and each company its own window**: four companies
in one currency fetch the series once between them, and two of them three
months apart on a rising curve still get different rates — which is what
makes sharing the series right and sharing the rate wrong. **Three attempts**:
a publisher that drops two requests and answers the third still produces a
rate, and the retry counter proves the retry is what saved it. **A refusal is
not retried**: a 403 is asked once per publisher and respected. **The primary
blocked outright**: with the US Treasury answering 503 the rate is 4.4000%
from *FRED, republishing US Treasury*, and the answer says why it was used.
**A blank cell is not a yield of nought**: a series whose holidays are empty
cells still averages 4.4000% rather than reading them as 0%, which cost 19.7
basis points before this.

### A share count is never a subtraction

Rule 4 earns most of the quarterly figures here by taking one cumulative
figure away from another, which is right for a flow and wrong for an average
(`KI-33`). 159 quarterly share counts across 68 companies were at or below
zero, Amphenol’s quarter to 2025-12-31 reporting −1,270,100,000 shares.

Checked over every payload: no share count is derived, none carries the two
filings a difference would need, and none is a number of shares no company
could have. Then the assertion that keeps the fix from being a ban on all
arithmetic — **the flows are still derived**, and a run where fewer than a
hundred quarterly revenues come from a subtraction has reached past the
averages into the figures rule 4 exists for.

And one **constructed** case, because a fixed payload cannot show the fault:
nine months of Amphenol’s own quarterly counts subtracted from its annual one
must still give a negative number, which is the figure this removed.

Proved by breaking: the non-additive list emptied, which put the subtraction
back — 32 faults across five companies, Apple reporting −46,716,000 shares.

### Every ticker in the set has answered at least once

`TATAMOTORS.NS` sat in the sweep set for eleven days returning an error on
every attempt, and the only thing that said so was one clause at the end of a
fetch run — *1 carrying a fetch error* — which is indistinguishable from a
source having a bad afternoon. It was not a bad afternoon: Tata Motors had
demerged and the exchange had retired the symbol.

A transient failure and a dead ticker look identical in one run and quite
different across the archive, so the archive is what this reads. A ticker
that has answered before and is failing now is the source’s business; a
ticker that has **never** answered, across every capture ever taken of it, is
ours. Payloads belonging to no list are counted and named too, since they are
measured over while belonging to nothing.

Proved by breaking: the retired symbol put back into the set with its last
error payload, which the check reports as *never once returned statements,
across 8 captures*.

### The top line of a financial company, and the age of any figures

Which fiscal years a company has is anchored on revenue, so the tag that is
read decides which years exist. Morgan Stanley and Wells Fargo moved off
`Revenues` and their models were built from the years that still carried it —
FY2014 and FY2019 (`KI-32`).

In `scenarios.mts`: the eighteen-month threshold on six **constructed dates**
asked on a fixed day, because a threshold tested against the clock is a test
that changes its own answer over time — and both sides of the line, including
that a set eighteen months old is current where one nineteen months old is
not. Then over every payload: each SEC-sourced financial company reads its
top line from a named tag, one tag for the whole series, every year the model
carries is a year that tag reports, the tag reaches the latest year any
candidate reaches, no candidate earlier in the order was passed over, and no
financial company is modelled on a contract-revenue line while it also files
a total. A company that is not an SEC-sourced financial carries no financial
revenue definition at all.

In `dashboard.mts`: the warning on the screen, on a **constructed** company
whose statements stop twelve years back — constructed because the fix means
no payload on disk is stale any more. Checked on two tabs of the company
page, to show the band belongs to the company and not to one screen of it;
on the figures screen, which is a screen of its own; and **absent** on a
company that is up to date, which is the assertion that makes the other two
worth having.

### A share count filed before a split

The count comes from a filing and the price comes from today, so a split
between the two stops them belonging to each other and nothing in the figures
shows it (`KI-31`). Amphenol split 2 for 1 on 2026-09-03 and CrowdStrike 4
for 1 on 2026-07-02, both after their last annual report.

Checked over every payload: every split event carries a date, a ratio that is
its own numerator over its denominator, and words for it; **no company
anywhere in the set has a split dated after the figures it is built on
without a record of what was decided about it**; where it was applied the
factor is the product of the events named, the statements carry the adjusted
count rather than only the record, each year moved by the splits that fall
after the day that year was filed, every reported quarter now sits near the
adjusted annual count, and the result agrees within a fifth with the
independent count that settled it; and where it was declined there is a
reason and nothing moved.

Two of the cases are **constructed**, because a fixed payload cannot show
either fault. Amphenol with its adjustment undone is the state the set was in
until 2026-11-01, and the cover-page comparison has to report it; AstraZeneca
with its ADR ratio change forced through has to produce a count its own
source contradicts, because that guard is the whole reason the adjustment is
safe to make anywhere.

Proved by breaking, four ways: the adjustment removed (3 faults, two of them
the invariant above); the reconciliation guard removed so every event applies
blindly (6 — AstraZeneca halved to 781,000,000 against 1,550,905,742
reported, HDFC Bank doubled to 10,212,578,808 against 5,144,097,830); one
factor used for every year instead of each figure’s own filing date (1 —
Amphenol’s FY2021 needs four, having been filed before two of them); and the
quarters left alone (23).

### A share count is a count

An XBRL fact in the `shares` unit is meant to be an absolute count, and all but
a handful of registrants file one. McDonald's tags **716.4** — the figure as its
statements print it, in millions — and the derivation divided it by a million
again, so its market capitalisation came out as 0.18 against borrowings of
43,848: an equity weight of 0.0004% and a WACC that was the cost of debt alone
(`KI-30`). The filing settles its own scale, because the cover page's shares
outstanding is an absolute count from every registrant.

Checked over every payload: the scale is a power of a thousand and carries the
cover count and date it was settled against, the correction is applied to the
statements and not merely recorded, the corrected count agrees with the cover
page within a fifth or says why not, **no company weighs equity at under a tenth
of a per cent**, and on every company the market capitalisation the weights are
struck on is the price times the share count the card shows.

The last one is **constructed**, because a fixed payload cannot show the fault:
McDonald's share counts are put back into the scale its filing tags them in, and
the check that catches a share count in the wrong unit has to report it.

### The cost of debt: a rating, not a history

Measured over every payload on disk. Until 2026-10-31 the engine discounted at
what a company HAD been paying — interest over average borrowings — and **59 of
137 came out borrowing below their own government's ten-year yield** (`KI-29`).
The rate is now the risk-free rate plus a default spread for a synthetic rating
read off interest coverage, so five things are checked:

1. **The table tiles the line.** Both of Damodaran's ladders are read at the
   bottom and the top of each of their fifteen bands, because a lookup that is
   off by one band is invisible in the answer. The two must also differ: 2.5x is
   Baa2/BBB for an ordinary company and Aa2/AA for a financial one, or the
   second table is decoration.
2. **The rate is the sum of its two parts**, to the twelfth decimal place, and
   the spread is the one the table publishes for that company's own coverage
   ratio. Proved by taking the spread away (589 faults) and by reading financial
   firms off the ordinary ladder (52 faults).
3. **Nobody borrows below their own government**, which is the symptom the
   defect was measured by. Proved by putting the effective rate back as the cost
   of debt: 476 faults, naming the companies.
4. **The effective rate is shown and never used** (rule 18): it is still
   computed, it still drives the forecast interest charge, and the rate the WACC
   is struck on must never equal it.
5. **A cost of capital with a hole in it refuses the valuation.** A company that
   cannot be rated has no cost of debt, and if it borrows it has no WACC — and a
   null WACC must refuse rather than discount at `(1 + null)`, which is 1. No
   payload on disk both borrows and fails to be rated, so this one is
   **constructed**: a company that values normally, with its risk-free rate taken
   away. Proved by removing the refusal: Sony answers −7,418.65 a share.

### The scenarios

| | Scenario |
|---|---|
| A | Circularity switch off (the default) |
| B | Circularity switch on |
| C | Switch off, 4% return on cash |
| D | Switch on, 4% return on cash |
| G | Switch off, PIK 3% every forecast year, cash 4% |
| H | Switch on, PIK 3% every forecast year, cash 4% |
| I | Switch off, PIK 3% plus a buyback stress |
| J | Switch on, PIK 3% plus a buyback stress |
| K | Depreciation raised 20 points of capex |
| L | Stock compensation raised 2 points of revenue |

### Which companies

By default the **curated Apple model** (`src/data/AAPL.js`) — the hand-built
workbook the engine was first verified against, and the only model with
authored rather than fetched inputs. It needs no payloads, so the suite runs
on a fresh checkout with no network.

Any fetched company can be substituted, which is worth doing for one with real
debt, leases or foreign currency:

```
CO=AMZN npm run verify
CO=BP.L npm run verify
```

`npm run verify:workbook` covers curated Apple **and every fetched company
with a DCF value** (63 of the 176 on the September 2026 set).

## What the dashboard check checks

Every other command here runs **below the screen**. They would all pass with a
dashboard that read the wrong field, dropped a minus sign, or printed a value
for a company the engine refused. That gap was `KI-16`.

`npm run verify:dashboard` starts the site with Vite, drives it in a real
Chromium through the screens a reader clicks through — search, the figures, the
questions, the analysis — and compares what is on the page with what the engine
returns for the same company **in the same process**. The engine is the
authority; the page is the thing under test.

Figures are compared **as formatted**, not as numbers: the engine's figure goes
through the same rule the component uses (`$1,234`, `9.159%`, `20.4x`) and the
strings must match. A check that parsed the page back into a number would pass a
page that printed a value per share to the nearest million.

Three companies, and no network:

| | |
|---|---|
| **Apple** | the curated model, which the site renders without fetching anything |
| **Fenwick Paper Mills** | a paper company invented in `verify/fixtures/`, reached the way a reader reaches a real one: the fetch, the figures screen, the questions |
| **the same company, refused** | the same fixture with no operating income filed, which is the commonest real refusal in the sweep set |

What it compares, on each valued company: the headline value per share and both
terminal methods and the spread between them; every line of both terminal
methods; the equity bridge from enterprise value through net debt to a share;
the cost of capital and its parts; and the reported and forecast income
statement and balance sheet, year by year.

On the refused company it checks the opposite — that **no value appears
anywhere**: not a premium against the price, not a football-field bar, not a
reverse DCF, not a terminal-reliance panel, and not in the batch screen or the
downloaded workbook, each of which must carry the engine's own reason instead.

**A fifth thing it reads is colour.** The palette check above measures the
TOKENS; this measures what the browser paints, which is not the same. A colour
reaches an element through a token, an inline style, a Tailwind arbitrary value
or one of the legacy remapping rules in `index.css` — and those rules match on
the class attribute, which is case-sensitive, so ten classes written in
lowercase hex were slipping past them and keeping whatever they were written
with. Nothing short of reading the computed style finds that. So every element
holding text, on all five screens, has its computed colour compared with the
first solid background behind it, against the floor its own measured size and
weight call for. 2,285 elements, nothing below AA.

**A sixth is size** (build step 8, job 8.2). Every element holding its own
text, and every SVG `<text>`, is read for its computed font size on every
screen the colour read covers, plus the landing page loaded in a tab of its
own at 1400 and 390 (the colour read labelled "the landing page" runs before
the first navigation, so it measures an empty tab). Each size must be a step
from `SIZE` in `src/design/tokens.ts`, resolved at the screen's width — title,
section, body, small and the 24px tile figure everywhere, lead and display on
the landing page only — and none may be under 13px. One off-step size is
held by a ratchet, `TYPE_RATCHET`: the figures screen's 14px, which comes from
inline styles in `figuresEditor.tsx` no stylesheet can overrule. Its count
(347) may fall and never rise; any other off-step size fails at once.
Measured on 2026-11-04: 21 screens, 3,493 pieces of type.

**A seventh is motion, reduced** (build step 8, job 8.4). Four passes, each
in a context of its own on the landing page and the company overview: motion
on (the control); the operating system asking for reduced motion, at 1440 and
at 360; and the site's stored setting (`marginalia:motion` = `reduced`) with
the operating system silent. Each pass checks that `<html data-motion>` says
what both sources say; samples every element's transform and opacity after
each scroll step and after opening the first closed disclosure, failing on
anything still changing between 150, 400 and 700ms; reports every running
animation longer than 110ms; and asks a 400ms transition the check puts on
the page how long it will run — 400ms with motion on, which proves the probe
can see motion, and at most 110ms under reduced motion. The 1440 pass also
checks the scroll-progress rule: on the header's bottom edge, the accent, no
`box-shadow`.

**An eighth is focus and targets** (build step 8, job 8.5). On the landing
page (with its paper bands), the Margin notes screen (paper) and the company
overview, the keyboard tabs forward 45 times and back 30; every focused
element must show a 2px solid outline 2px off it, in ink on the dark ground
and paper-ink on paper, and none may sit under the fixed header — tabbing
back up the page is the direction `scroll-padding-top` exists for. Then
every ⓘ fully below the header is hit at the four corners of a 24px square
around its centre with a mouse, and of a 44px square in a touch context
(`isMobile`, `hasTouch`, which matches `pointer: coarse`); each corner must
land on that ⓘ.

**A ninth is the hero's particle field** (build step 8, job 8.7). On a 2x
screen with the page's clock slowed to 0.15 of real time (this browser's software GPU
cannot keep a frame under 20ms, and would otherwise freeze the field, which is
checked separately): at most 12,000 points, at most 1.5 device pixels a CSS
pixel, the poster gone once the first frame is drawn, a 24×24 pause control
that holds the frame, the field settled within five slowed seconds of the last
input with no frames asked for afterwards, a scroll waking it, a hidden tab
stopping it. On the real clock, if the field freezes the poster must be back.
Under reduced motion there is no canvas and no pause control, only the
poster.

**A tenth counts WebGL contexts** (job 8.8): every `getContext('webgl…')` is
counted per canvas from before the first script, while the landing page is
scrolled top to bottom at 1440 and 390. More than one fails.

**An eleventh is the accent budget on landing sections 1–4** (job 8.9). From
the top of the page to the end of `#beyond`, in 100px steps at 1440×900 and
390×844 under reduced motion, each viewport may hold at most one
oxblood-washed primary, three oxblood fills (a rule of 2px or less and the
heading mark, `data-mark`, are not fills) and five words in the accent text
colour. No text there may be uppercased by CSS, and the copy of those sections
holds none of LANDING §2.3's banned words.

**A twelfth is phone and low-end** (job 8.11, VISUAL_SYSTEM §8). This
harness's machine reports 4 cores, which is itself low-end, so the checks
that need the particle field declare a capable device (`CAPABLE_DEVICE`: 8
cores, 8GB, no Data Saver, 4g). From that device, one signal at a time — 4
cores, 4GB, Data Saver, a 3g connection, a 390px screen — must give no WebGL
context, no canvas, the poster showing and `data-hero-mode="poster:<why>"`;
the capable desktop itself must get the field, so the check cannot pass on a
page that never draws it. Then the landing page at 390 and 320 wide, scrolled
top to bottom, must never scroll sideways.

**One section at a time, for proofs.** `DASHBOARD_ONLY=hero,webgl,accent npm
run verify:dashboard` runs only the named self-contained sections (motion,
focus, bridge, features, hero, webgl, accent, lowend) and stops, so a deliberate break
is reported by the check it was made for. The run a commit quotes is the full
one, without the variable.

**And a fourth case with no company in it: a slow build.** The fixture is held
open for seventeen seconds on purpose and the loading overlay is read while it
waits. It must carry one of the notes from `didYouKnow.ts` — matched against the
data file, so a truncated or invented line fails — and it must show **more than
one**, because the thing being prevented is a reader waiting twenty seconds on a
single sentence. It is the one screen every reader sees on every build and, in a
fast harness, the one nothing could look at.

```
npm run verify:dashboard              # headless
npm run verify:dashboard -- --headed  # watch it
```

It needs the Chromium that Playwright downloads separately from the npm
package. On a clean checkout:

```
npx playwright install chromium
```

Nothing leaves the machine: every call the site makes to `/api/*` is answered
from the fixture, which is why this needs no payloads and no API keys. When it
fails it writes the screen it stopped on to `verify/out/dashboard-failure.png`
and `.txt`, because a timeout on a button says nothing about where the browser
had got to.

## The payload set has a version, and a stale one stops a run

Every payload records the version of the fetcher that built it, and every tool
here reads them through `payloadSet.mts`. Each run opens with what the set is:

```
payload set: 176 payloads, 176 built by the current fetcher (v4)
```

When any payload predates the fetcher, the run **stops** and says which command
fixes it. That is deliberate. A payload fetched before a field existed is not
obviously broken — the field is simply absent, the engine reads the absence as a
figure the company does not report, and the sweep produces numbers that look
valid. Refusing to measure is the only way to tell the difference (`KI-15`).

It refuses rather than refetching on its own: a refetch takes a quarter of an
hour and hits live sources, so it is your call, and two runs either side of an
implicit refetch would not be comparable anyway.

**Bump `PAYLOAD_VERSION` in `src/data/payloadVersion.ts` whenever you change
what `api/company.js` puts in a payload**, and the matching `FETCHER_VERSION` in
`api/company.js`. The file lists what each version added.

## Payloads: where they live, and why they are not in the repository

`npm run verify:payloads` fetches them into `verify/payloads/`, which is
ignored by git. The ticker list (`verify/tickers.txt`) **is** committed, so
the set is reproducible: the first 100 US filers by the SEC ticker list, plus
home listings and depositary receipts chosen to span currencies, exchanges and
share bases.

They are not committed because the non-US ones come from Yahoo Finance, which
licenses fundamentals from data vendors. Those figures are not the site's to
redistribute — the same constraint that blocks precedent transaction data
(`ROADMAP.md`, section 2). The SEC-sourced ones would be fine on their own,
but a mixed directory with one rule is easier to keep honest than a mixed
directory with two. At 10.3 MB for 176 companies size is not the reason — and
it is not the reason for the version store either, which would come to about
124 MB a year at one full refetch a month (`docs/ARCHIVE_PLAN.md` §3.1).

**Every version of every payload is kept, in `verify/payloads/versions/`**,
which the same ignore rule covers for the same reason. A fetch writes the
capture first and moves `verify/payloads/<TICKER>.json` second; the capture is
named for the hash of its contents and made read-only, and `npm run verify`
fails if any of them is ever changed. `npm run verify:versions` prints what the
store holds; `npx tsx verify/payloadVersions.mts --adopt` takes in any payload
that has no capture yet.

The consequence, stated plainly: a measurement quoted in a commit message can
be reproduced by fetching the same tickers, but not to the figure, because the
sources restate and the prices move. **The version store makes the freeze
automatic**: name the capture in the commit message instead — every one has a
hash and a time, and the bytes behind it cannot change afterwards without the
suite saying so. Measurements in `KNOWN_ISSUES.md` name the date their payloads
were fetched for the same reason, which is now a date that can be resolved to a
file.

Expect a few tickers to fail on any fetch: sources rate-limit, and some have
no statements any more (4 of 176 on the September 2026 set). They are reported
and skipped.

## Files

| File | |
|---|---|
| `scenarios.mts` | The scenario suite. |
| `sweep.mts` | One snapshot of what the site would show, per company. |
| `compare.mts` | Two snapshots measured against each other. |
| `workbook-vs-site.mts` | The workbook's value per share against the engine's. |
| `dashboard.mts` | The rendered page against the engine, in a real browser. |
| `heads.mts` | The head each filed line sits under: every single move checked field by field, the reported tie, and the figures the replaced feature published. |
| `ebitdaBridge.mts` | Reported EBITDA, every adjustment and the three ties, in the model and in the written file. |
| `savedModel.mts` | Every judgement a saved record carries, through the wire format and back. |
| `payloadSet.mts` | What shape the payloads on disk are, and the refusal to measure a stale set. |
| `fixtures/paperCompany.mts` | Five years of statements for a company that does not exist. |
| `fetch-payloads.mts` | Fetches the sweep set through the site's own API handler. |
| `fetch-indices.mts` | Fetches the 21 market indices a beta is measured against, through the site's own route. 21 requests, four seconds apart. |
| `tickers.txt` | The sweep set. |
| `payloads/`, `snapshots/`, `out/` | Working directories, all ignored by git. |

Two things checked here live outside `verify/`: `scripts/buildExplainers.mts`
writes the explainer pages and refuses a markdown construct it cannot render,
and `src/data/explainers.ts` records why those pages are files rather than
routes.
