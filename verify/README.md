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
  and an eyebrow at 3.90:1 on every screen.
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

### The risk and cost-of-capital card: five rules, and the regression

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

The two copies of the index allow-list — `src/data/marketIndex.ts` and
`api/marketIndex.js`, which cannot import from `src/` — are compared symbol by
symbol and name by name, because a second copy that nothing checks is a second
copy that goes stale.

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
