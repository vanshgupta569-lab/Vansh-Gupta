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

## The five commands

| Command | What it does | Needs payloads |
|---|---|---|
| `npm run verify` | The scenario suite: ten scenarios over one model. | No |
| `npm run verify:dashboard` | Drives the real site in a browser and checks the page against the engine. | No |
| `npm run verify:sweep -- <tag>` | Snapshots what the site would show for every fetched company. | Yes |
| `npm run verify:compare -- <a> <b>` | Measures two snapshots against each other. | No (reads snapshots) |
| `npm run verify:workbook` | Checks the workbook reproduces the site, company by company. | Optional |

### The job loop

```
npm run verify:payloads            # once; ~15 minutes, then reused
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
directory with two. At 1.8 MB for 176 companies size is not the reason.

The consequence, stated plainly: a measurement quoted in a commit message can
be reproduced by fetching the same tickers, but not to the figure, because the
sources restate and the prices move. Where an exact reproduction matters,
freeze a copy of `verify/payloads/` outside the repository and say in the
commit message which set was used. Every measurement in `KNOWN_ISSUES.md`
names the date its payloads were fetched for this reason.

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
| `payloadSet.mts` | What shape the payloads on disk are, and the refusal to measure a stale set. |
| `fixtures/paperCompany.mts` | Five years of statements for a company that does not exist. |
| `fetch-payloads.mts` | Fetches the sweep set through the site's own API handler. |
| `tickers.txt` | The sweep set. |
| `payloads/`, `snapshots/`, `out/` | Working directories, all ignored by git. |
