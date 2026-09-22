# Data constraints

**What the filing or the data source does not publish.** None of these is a
defect and none can be fixed in code: the figure is not there to read. What the
site can do is refuse to pretend, and say so.

Defects the model can fix are in `KNOWN_ISSUES.md`. How the engine works, and
why, is in `METHODOLOGY.md`.

**How this file is kept**

- A constraint is added when the source turns out not to publish something the
  model needs. It is removed when a source that does publish it is wired in —
  not when the model is changed to cope, which is what the handling column is
  for.
- Every constraint records **which source it comes from**, so the
  primary-filings data layer (`ROADMAP.md` section 1) can be pointed at the ones
  it would eliminate.
- Every constraint records what the site does about it, and the measured size of
  the error it leaves behind.

---

## The threshold

For each constraint the **bound** is computed per company: the largest move in
value per share the missing figure could cause, capped by what the filing *does*
report. Then:

| Bound | What the site does |
|---|---|
| more than **25%** | **Refuse.** No value is shown and the message names the missing figure. |
| **5%** to 25% | **Warn**, in a banner above the model and again in a panel beside the working, with the size and the direction. |
| below 5% | **Note.** Listed in the panel beside the working, so nothing is hidden, but nothing is flagged. |

**Neither number is invented.**

**25%** is the cut the site already uses for a *wide* disagreement between its
two terminal methods (`src/data/terminalSpread.ts`, `WIDE_SPREAD`), chosen
because the median disagreement between them is 14.5%. A single missing input
that could move the answer further than two legitimate valuation methods
disagree is not a number worth showing.

**5%** is the cut every measurement in `KNOWN_ISSUES.md` uses for "materially
moved". It is the right bar for telling the reader, which is a different and
much lower bar than withholding.

**Where the bound cannot be computed** from the filing, the constraint is judged
on two things instead: the effect measured on the companies that *do* report the
figure, and whether the error has a known direction. An error that can only
ever **understate** the value is a floor, and a floor with its direction stated
is information. An error that could **flatter** the company is not. So an
uncomputable bound warns when the error runs one way and is under 25% on the
companies that can be measured, and refuses otherwise.

The bounds are computed in `src/data/dataConstraints.ts`, which re-runs the
whole model with the missing figure set to the largest value the filing allows.
A constraint that crosses 25% sets a flag on the model data, so the refusal
reaches every path that reads it — the dashboard on every slider move, the batch
screen, the workbook and the verification harness — rather than each having to
remember to check.

**On the payload set of 2026-09-21 (176 fetched, 169 modelled, 69 valued) no
company crosses 25% on a computed bound.** That is the honest result of applying
the threshold, not an absence of machinery: the refusal path is wired and
tested, and the constraints that could flatter a value are the ones the engine
already refuses outright (below). Every other constraint measured either is
small or runs only in the direction that understates.

---

## The constraints

| Constraint | Source | Companies | Handling |
|---|---|---|---|
| Lines the filing does not report at all | both | 116 modelled | note; the treatment ties operating income to the filing |
| Stock compensation never broken out | Yahoo mostly | 54 modelled, 19 valued | **warn** — the value is a floor |
| A price that must be converted | Yahoo | 46 modelled | note; no effect on value |
| Total liabilities not tagged | both | 23 modelled | note; presentation only |
| Bank dividends not split common/preferred | Yahoo | 18 modelled | **warn** |
| Marketable securities not split short/long | both | 14 modelled | note or **warn** by bound; max 3.5% |
| D&A that cannot be split from amortisation | both | 9 valued | note; max 3.8% |
| A cost of debt that cannot be read | both | 5 modelled | note or **warn**; max 0.1% |
| Finance-leased assets with no lease liability | SEC | 0 valued | would **refuse** above 25% |
| *Already refused by the engine* | | | |
| Cost of sales, capex or two years of PP&E never reported | both | 41 of 98 | **refuse** |
| Operating income not filed in a reported year | both | 6 named | **refuse** |
| Pretax income not filed in a reported year | both | 3 named | **refuse** |
| A reported year with no derivable totals | both | 4 named | **refuse** |
| Borrowings missing in the last year, reported earlier | both | 1 (PANW) | **refuse** |
| A depositary receipt whose ratio is unpublished | Yahoo | 38 listings | **refuse** |
| A reporting currency not stated, or stated two ways | both | 3 named | **refuse** |
| A depreciation rate that cannot be measured | both | 3 named | **refuse** |
| A claim on the group whose amount is not filed | both | 6 named | **refuse** |

---

## Warned, with the size stated

### Stock compensation the filing never breaks out

**Source:** Yahoo Finance for 17 of the 19 valued companies; SEC EDGAR for two
(MercadoLibre, Philip Morris). **Affects:** 54 of 169 modelled, 19 of 69 valued
— Toyota, Shell, TotalEnergies, Saudi Aramco, Samsung, Sony, AstraZeneca, BHP,
Enbridge, Equinor, Inditex, LVMH, Reliance, Rio Tinto, Siemens, TCS, Volvo, and
the two SEC filers.

Not reported is not nil. Any stock compensation the company paid is inside its
filed cost lines, so operating profit and EBITDA are right and the peer
multiples are comparable. What is missing is the **add-back in cash from
operations**, so the unlevered cash flow the valuation discounts is understated
by whatever the company actually paid.

**Bound:** not computable — the amount is not in the filing. **Measured
instead** on the 49 valued companies that do report it, by taking the add-back
away: the perpetuity value falls by a median **1.6%**, by more than 5% for six
of them, and by **16.5%** at worst (Qualcomm; Tesla 10.2%, BP 7.9%, Meta 7.8%).
Every move is downward. **So the error runs one way and is under 25% at its
worst: the site warns rather than refuses, and says the value is a floor.**

### Bank dividends not split between common and preferred

**Source:** Yahoo Finance. **Affects:** 18 modelled.

Residual income measures the return on the **common** shareholders' equity, so
it needs dividends to common alone. Where the source gives one total and the
company has preferred stock, the total is taken to include the preferred
dividends the filing reports, and those are subtracted. For Royal Bank and
Toronto-Dominion on their Toronto listings that assumption has not been checked
against the filings.

**Effect:** the payout ratio moves by roughly three points either way where the
assumption is wrong. Residual income is not sensitive to it: the payout ratio
changes how fast book equity compounds, not what it earns.

### Marketable securities the filing does not split

**Source:** both. **Affects:** 14 modelled, 7 of them valued — NVIDIA and Dell
among them.

Where a filing reports marketable securities without saying how much of them can
be turned into cash within the year, **nothing is netted off debt**. The balance
stays inside other current assets, where it already was, rather than being read
as nil or split by guesswork. NVIDIA tags a combined 39,520 and maturity
buckets, which are a different idea from the balance-sheet split.

**Bound:** netting every reported security off debt. Amgen 3.5%, NVIDIA 1.0%,
Dell 0.1%, NXP 0.0% — all below 5%, so all notes. The error runs one way: net
debt is at worst too high, so the value is a floor.

---

## Noted, because they cannot move a value

### Lines the filing does not report at all

**Source:** both. **Affects:** 116 modelled.

R&D, SG&A, dividends and buybacks are shown as **not reported**, never as nil.
An unreported R&D or SG&A cost sits inside other operating costs, which is what
ties operating income to the filing, so the forecast is anchored to a margin the
company actually earned. Dividends and buybacks are averaged over the years that
report them only; none reported anywhere means none forecast. A line not
reported in the last reported year is forecast at nil, and the provenance says
so.

The workbook's statement totals read "not reported" cells through `N()`, which
its notes state.

### Total liabilities the filing does not tag

**Source:** both. **Affects:** 23 modelled.

Coca-Cola and Walmart report assets and shareholders' equity but not the SEC's
total-liabilities tag, only liabilities-and-equity combined. Total liabilities is
taken as assets less equity, which carries any non-controlling interest inside
liabilities on the model's balance sheet.

**Presentation only, and not deducted twice:** net debt is borrowings less cash,
never total liabilities, and minority interests are read from the filing's own
balance. The total-assets-less-liabilities-less-equity route to minority
interests uses only a **filed** total-liabilities figure, so it can never read
the derived one.

### D&A that cannot be split from amortisation

**Source:** both (Yahoo publishes no amortisation line; some SEC filers tag only
the combined figure). **Affects:** 9 valued.

Depreciation follows the plant capital spending buys; amortisation runs an
acquired intangible pool down and then stops. The terminal year replaces
depreciation for ever and lets amortisation run off, so the split matters. Where
the source reports the same number as total D&A and as depreciation alone, the
split cannot be made and the whole charge is treated as depreciation of PP&E.

**Bound:** charging the largest amortisation the reported intangible pool and
the filed D&A allow. BP 3.8%, Reliance 3.7%, LVMH 3.5%, Unilever 2.2%, Shell
2.0%, TotalEnergies 1.4%, Equinor 0.8%, Saudi Aramco 0.5%, TCS 0.0% — all below
5%. The direction is upward: the model understates.

### A cost of debt that cannot be read

**Source:** both. **Affects:** 5 modelled — Accenture, Arista, MercadoLibre,
Palantir, Shopify.

A rate above 25% is not a borrowing cost: it is a bank paying depositors, or a
full year's interest divided by debt repaid during the year. Some filers tag no
interest at all against their borrowings. Both fall back to 4.5% and the
provenance says the rate is assumed rather than the company's own.

**Bound:** re-running across a wide band, 2% to 8%. The largest move is Shopify
at **0.07%**, because these are companies that barely borrow. All notes.

### A price converted at one exchange rate

**Source:** Yahoo Finance (the rate). **Affects:** 46 modelled.

Where the statements and the listing differ in currency, the price, the previous
close and the 52-week range are converted at the one rate fetched with the
price, because no free source gives the rate on each day of the past year.

**No effect on the value per share**, which is computed in the statements' own
currency. The 52-week range is a year of prices at today's rate, so it is
indicative rather than exact. The header says the price is converted and at what
rate; the workbook's Sources sheet records it.

### Finance-leased assets with no lease liability

**Source:** SEC EDGAR. **Affects:** 0 valued companies on this payload set.

Where a filing shows a finance-lease right-of-use asset and no lease liability
that can be read, none is counted as debt. **This is the one constraint whose
error flatters:** a liability left out of net debt makes the shares look worth
more. The bound is the leased asset itself, taken as the liability behind it,
and it would refuse above 25%.

---

## Already refused, and why

These were data constraints before this file existed, and the engine already
refuses them. `METHODOLOGY.md` §16 lists the refusals in the order they are
tested.

| What the source does not give | Refusal | Named |
|---|---|---|
| Cost of sales, capital expenditure, or two years of net PP&E, in any year | `filingMissingValuationInput` | 41 of 98 on the first sweep, including every bank's DCF, Linde, Mastercard, Disney, RTX, Union Pacific, NextEra, Meta, Salesforce, Chevron, Micron |
| Filed operating income in a reported year | `filingMissingIncomeStatementLine` | ConocoPhillips, Eaton, IBM, Johnson & Johnson, KLA, Merck |
| Filed pretax income in a reported year | `filingMissingIncomeStatementLine` | McDonald's, Oracle, Welltower |
| Any derivable totals for one reported year | `balanceSheetDoesNotBalance` | BlackRock, GE Vernova, Shopify, SanDisk |
| Cash in the last reported year, or borrowings there when earlier years report some | `filingMissingValuationInput` | Palo Alto Networks |
| The ratio of a depositary receipt to an ordinary share | `listingNotComparable` | 38 US and IOB listings of non-US companies; the home listing is valued instead |
| A reporting currency stated once and consistently | `listingNotComparable` | Vale, Petrobras (figures stamped USD, currency said BRL); Enbridge's SEC filing mixes CAD and USD |
| A depreciation rate that can be measured and forecast from | `implausibleDepreciationRate` | Sony's Tokyo listing, Palantir, ExxonMobil |
| The amount of a minority interest or preferred claim the filing shows exists | `nonCommonClaimNotReported` | Boeing, Morgan Stanley, Santander; and for residual income, ICBC and American Express |

Two of these deserve their reasoning stated, because the refusal is a judgment
rather than an arithmetic necessity:

**Borrowings missing in the last year, reported earlier.** The test cannot tell a
changed XBRL tag from debt that was genuinely repaid. It is kept because
understating debt overstates value, which is worse than an explained refusal.
Broadcom and Coca-Cola were refused for this reason until every borrowing tag
was fetched; both are now valued. Palo Alto tags none in any form, so the test
still refuses it, and it is accepted as a possible false positive.

**One unbalanceable year refuses the whole company.** A reported year with no
derivable totals — a spin-off's first year — refuses every year, because a
balance sheet that does not add up in one year means the statements are not the
set the model thinks they are.

---

## What a primary-filings data layer would remove

`ROADMAP.md` section 1 plans to read filings directly rather than through a
vendor. Counted against this payload set, that would remove:

| Constraint | Removed by reading filings directly? |
|---|---|
| Stock compensation never broken out | **Yes** for the 17 Yahoo-sourced companies — it is in the cash flow statement of every filing that pays it |
| Bank dividends not split | **Yes** — the split is on the face of the statement |
| D&A not split from amortisation | **Yes** for the Yahoo-sourced ones; the cash flow statement separates them |
| The depositary-receipt ratio | **Yes** — the ratio is in the deposit agreement, and the home filing can be read directly |
| A reporting currency stated two ways | **Yes** — the filing states it once |
| Total liabilities not tagged | **Yes** — it is on the face of the balance sheet even where the vendor's tag is absent |
| Marketable securities not split | **Partly** — the balance sheet splits them where the filer does; a filer who genuinely reports one figure still does |
| Lines not reported at all | **Partly** — a vendor's gap closes, a filer's genuine silence does not |
| A cost of debt that cannot be read | **Partly** — the interest is in the filing, but a bank's interest is still mostly its depositors' |
| Finance leases with no readable liability | **No** — if the filer does not disclose the liability, no source has it |
| Cost of sales for a bank | **No** — banks do not report one |

The first five are vendor gaps. They are the argument for the data layer stated
in figures rather than in principle.

---

*Written against `e52cdc6` plus the constraint handling added 2026-09-22, on the
payload set of 2026-09-21. Defects are in `KNOWN_ISSUES.md`; the engine is
described in `METHODOLOGY.md`.*
