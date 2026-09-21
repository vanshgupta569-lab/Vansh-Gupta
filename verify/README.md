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

## The four commands

| Command | What it does | Needs payloads |
|---|---|---|
| `npm run verify` | The scenario suite: ten scenarios over one model. | No |
| `npm run verify:sweep -- <tag>` | Snapshots what the site would show for every fetched company. | Yes |
| `npm run verify:compare -- <a> <b>` | Measures two snapshots against each other. | No (reads snapshots) |
| `npm run verify:workbook` | Checks the workbook reproduces the site, company by company. | Optional |

### The job loop

```
npm run verify:payloads            # once; ~15 minutes, then reused
npm run verify:sweep -- before     # before touching anything
#   ...make the change...
npm run verify                     # scenario suite: every Checks row zero
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
| `fetch-payloads.mts` | Fetches the sweep set through the site's own API handler. |
| `tickers.txt` | The sweep set. |
| `payloads/`, `snapshots/`, `out/` | Working directories, all ignored by git. |
