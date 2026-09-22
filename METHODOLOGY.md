# Methodology

What the engine actually does, line by line, so it can be compared against a
book without reading the code.

Everything below was read off the source on 2026-09-22 and describes `e52cdc6`.
Where an earlier document says something different, this one is right: it was
written from the code, not from the intentions.

**How this file is kept**

- **Any change to the engine, the derivation, the valuation models or the
  workbook updates this file in the same commit.** A change that moves a number
  and leaves the description standing makes the description a lie, and a
  description nobody can trust is worse than none.
- It says what the code does and why, with the convention each choice follows
  or departs from. It does not list defects — those are in `KNOWN_ISSUES.md` —
  and it does not record history, which is in the commit messages.
- Measured figures quoted here carry the commit and the payload date they were
  measured at, as they do in `KNOWN_ISSUES.md`.

**How conventions are cited.** `CONVENTIONS.md` is a numbered checklist in ten
sections. A citation like `CF 6` means the sixth item of the Cash flow
statement section, counting from its first item. The sections are Income
statement (`IS`), Cash flow statement (`CF`), Depreciation (`Dep`), Working
capital (`WC`), Balance sheet (`BS`), Debt schedule (`Debt`), Circular
references (`Circ`), DCF (`DCF`), Comparables (`Comps`) and Formula discipline
(`FD`). `CONVENTIONS_AUDIT.md` holds the item-by-item audit with its verdicts;
this file explains the machinery those verdicts are about.

---

## Contents

1. [Where the figures come from](#1-where-the-figures-come-from)
2. [Which periods are used at all](#2-which-periods-are-used-at-all)
3. [Is the price comparable with the statements](#3-is-the-price-comparable-with-the-statements)
4. [The reported balance sheet, and its plugs](#4-the-reported-balance-sheet-and-its-plugs)
5. [The income statement, line by line](#5-the-income-statement-line-by-line)
6. [The working capital schedule](#6-the-working-capital-schedule)
7. [The PP&E schedule](#7-the-ppe-schedule)
8. [Amortisation of intangibles](#8-amortisation-of-intangibles)
9. [The debt schedule, the revolver and cash](#9-the-debt-schedule-the-revolver-and-cash)
10. [Equity, shares and EPS](#10-equity-shares-and-eps)
11. [The cash flow statement](#11-the-cash-flow-statement)
12. [The balance sheet, and the check](#12-the-balance-sheet-and-the-check)
13. [The discounted cash flow](#13-the-discounted-cash-flow)
14. [The cost of capital](#14-the-cost-of-capital)
15. [The equity bridge](#15-the-equity-bridge)
16. [Refusals, in the order they are tested](#16-refusals-in-the-order-they-are-tested)
17. [Residual income](#17-residual-income)
18. [The market approach](#18-the-market-approach)
19. [The asset approach](#19-the-asset-approach)
20. [The valuation range](#20-the-valuation-range)
21. [The drivers the reader can move](#21-the-drivers-the-reader-can-move)
22. [The workbook, and where it differs](#22-the-workbook-and-where-it-differs)
23. [What is not modelled at all](#23-what-is-not-modelled-at-all)

---

## 1. Where the figures come from

`api/company.js`. Two sources, one output shape, so nothing downstream knows or
cares which a company came from.

**SEC EDGAR (US filers).** The company's own XBRL facts. The same real number
is filed under different tag names by different companies and by the same
company in different years, so each line has an ordered list of tags and the
first that exists wins. The lists are ordered by what filers use *now*, not by
age: a filer that moved from `AvailableForSaleSecuritiesCurrent` to
`MarketableSecuritiesCurrent` years ago would otherwise be read off the stale
tag for ever (Apple's last `AvailableForSale` is 2018).

**Yahoo Finance (everything else).** The fundamentals timeseries, one named
field per line. Money leaving the company is filed negative there and positive
here, so capital expenditure, dividends and buybacks have their sign flipped on
the way in.

Both paths take the **five most recent annual periods**, convert money to
millions of the reporting currency, and leave share counts as counts.

Key tag choices worth naming, because they are where a careless read goes
wrong:

| Line | SEC, in order | Yahoo |
|---|---|---|
| Revenue | `RevenueFromContractWithCustomerExcludingAssessedTax`, `…IncludingAssessedTax`, `Revenues`, `SalesRevenueNet` | `annualTotalRevenue` |
| Net PP&E | `PropertyPlantAndEquipmentNet`, then the longer `…AndFinanceLeaseRightOfUseAsset…` name | `annualNetPPE` |
| D&A | `DepreciationDepletionAndAmortization`, `DepreciationAmortizationAndAccretionNet`, `Depreciation` | `annualDepreciationAndAmortization` |
| Depreciation of PP&E alone | `Depreciation` | `annualDepreciation` |
| Amortisation of intangibles | `AmortizationOfIntangibleAssets` and two variants | not published |
| Dividends to common only | `PaymentsOfDividendsCommonStock` | `annualCommonStockDividendPaid` |

**Net PP&E under two names.** Filers that put finance-lease right-of-use assets
on the same line renamed the tag, several of them in their latest year only
(Alphabet, Home Depot, Tesla). Where both exist they agree to the million, so
this is one measure under a longer name, not a second basis. Without the second
name the last reported year has no asset base at all, which refuses the company
(§16).

**Marketable securities are fetched in three pieces**: short-term, long-term,
and a "reported but not split" figure. The third is evidence that securities
exist and is never an amount to net off (§4).

**Borrowings are fetched piece by piece and added by the derivation, not by the
fetcher**, because the tags overlap: `LongTermDebt` is the whole loan including
its current portion, `LongTermDebtNoncurrent` is only the part due later, and
`DebtCurrent` is every borrowing due within the year. Adding the wrong two
double-counts (§4).

---

## 2. Which periods are used at all

`deriveModel.js`, `selectComparablePeriods`. A forecast built from a company's
own history assumes the history describes one company. After a demerger it does
not, and no source warns you.

Two tests, applied before anything else. Neither guesses at causes; both discard
rather than repair.

1. **A collapse in revenue means the reporting entity changed.** Where revenue
   falls to less than 40% of the prior year, everything before the most recent
   such break is dropped. Only a collapse counts — a surge is what fast growth
   looks like, and Nvidia's doubling is perfectly usable history.
2. **Depreciation cannot exceed the assets being depreciated.** A full year
   whose depreciation is larger than closing net PP&E is a stub period, a
   restatement, or two entities stitched together, and that year is dropped
   (Tata Motors FY2025: 232,560 against net PP&E of 124,380).

Fewer than two comparable years left and the company is refused outright: no
growth rate can be measured from one period. The periods set aside, and why,
are carried in `provenance.excludedPeriods` and shown on screen.

The forecast is **five years** (`FORECAST_YEARS`), which `DCF 2` treats as a
judgment call balancing forecast reliability against how much weight rests on
the terminal value. How much weight actually rests there is in `KNOWN_ISSUES.md`
(`KI-12`).

**Forecast year-ends are assumed to be 31 December for every derived company.**
The fetch does not carry the fiscal period end date, only the fiscal year, so
the derivation writes `${year}-12-31` for each forecast year and for the last
reported year-end. The curated Apple file carries its real dates (27 September
2025, then 30 September 2026 and so on). For a non-December filer the discount
periods in §13 are therefore wrong by up to a few months in the same direction
every year. How many companies are affected cannot be counted from the frozen
payloads, because the end date is not in them; the size of the error can be.
Re-dating every forecast year-end to 30 September, a quarter earlier, raises the
perpetuity value by a median 2.21% across the 69 valued companies (range 1.80%
to 6.20%, 64 of them by more than 2%). That is `KI-14`.

---

## 3. Is the price comparable with the statements

`deriveModel.js`, `listingComparability`. A value per share is statements
divided by a share count, compared with a price. That comparison means
something only if all three describe the same security in the same currency.

Three gates, in order. Any failure refuses **every** valuation, residual income
included.

1. **The reporting currency must be stated, and stated once.** Taken from the
   filing's own statement of it — the SEC's XBRL units, or Yahoo's
   `financialCurrency` cross-checked against the currency stamped on each
   figure — never inferred. Figures stamped with a second currency refuse the
   company.
2. **The share count must count the security the price is for.** An SEC filer's
   statements count the registered shares its ticker trades. For a Yahoo
   listing: London's international order book (`IOB`) is refused outright as a
   depositary-receipt venue; a listing on a US market by a company based
   elsewhere is refused, because a receipt can stand for a fraction or a
   multiple of an ordinary share and nothing free publishes the ratio reliably
   (Yahoo's own counts are scaled to the receipt for Toyota, Shell and Alibaba,
   and to the ordinary share for AstraZeneca); and a home listing whose
   outstanding count differs from the filed diluted count by more than 1.5× in
   either direction is refused.
3. **The price must be in the reporting currency.** Where it is not, it is
   converted at a rate fetched with it. No rate, no value.

---

## 4. The reported balance sheet, and its plugs

`deriveModel.js`, `deriveBalanceSheet`. The engine needs a fixed set of lines.
Filings report a different set. This step builds the engine's lines so that
assets equal liabilities plus equity **by construction**, and records every
place it had to derive something.

**The identity fills a missing total.** Total liabilities is total assets less
shareholders' equity where the filing gives the other two (Coca-Cola and
Walmart report assets and equity but not the SEC's total-liabilities tag). Any
non-controlling interest the filing keeps outside equity lands in liabilities,
which is where a lender would count it — recorded as a limitation, not hidden.

**A missing component of a reported total is absorbed into that total's "other"
line and named.** Other current assets is current assets less cash, securities,
receivables and inventory; other assets is total assets less current assets and
net PP&E; accrued and other current liabilities is current liabilities less
payables and current borrowings; other non-current liabilities is total
liabilities less current liabilities and non-current borrowings. Where current
assets or current liabilities are not reported at all, everything beyond the
named lines goes into the non-current "other" line instead, and a note says so.

**What cannot be derived stays null**, the balance check fails, and the company
is refused (§16). Two gaps refuse a company even when the sheet can be made to
add up, because absorbing them would balance it while corrupting net debt: cash
in the last reported year, and borrowings in the last reported year where
earlier years report some.

**Equity is total assets less total liabilities, not the reported equity line.**
The two are not always the same figure: Yahoo reports Reliance's equity
excluding minority interests, and the reported line left the balance sheet out
by 1.1 to 1.8 million lakh in every year. For an SEC filer they are identical
(Apple's 359,241 less 285,508 is exactly its reported 73,733). The engine
carries the whole balance in one line and leaves treasury stock, retained
earnings and OCI at nil in reported years: the split between paid-in capital
and retained earnings is presentational and does not touch the valuation.

### Borrowings

Everything borrowed, split into what falls due within the year and what does
not. Convention `Debt 2` wants every instrument on the balance sheet tracked;
`Debt 3` wants each tranche modelled separately, which is departed from (§9).

Counted in full: short-term borrowings, commercial paper, current maturities of
long-term loans, and the rest of those loans. Where `LongTermDebt` (the whole
loan) is the only tag, the current maturities counted above are subtracted from
it before use — Home Depot tags only that one, at 49,397 including the 4,967
already counted.

**Leases.** The test is whether the model's own cash flow already bears the
whole cost of the lease, since enterprise value is built from unlevered free
cash flow, struck after operating costs and before financing.

- A **finance lease** under US GAAP reaches profit as depreciation plus
  interest. Operating profit carries only the depreciation, so the financing
  half is missing from the cash flow: the liability is debt and comes off.
- An **operating lease** under ASC 842 reaches profit as a single operating
  lease cost, inside operating profit. The rent is already charged in full
  against the cash flow the enterprise value is built from, so taking the
  liability off as well would charge the shareholder twice. It is reported
  beside net debt and never netted.
- Under **IFRS 16** there is no operating lease: every lease is depreciation
  plus interest, so the whole lease obligation is debt. That is the treatment
  on the Yahoo path, where the source publishes one combined figure.

This is the point reasonable people differ on, which is the reason to state it:
the answer is not "leases are debt" or "leases are rent", it is that a lease
liability belongs in net debt exactly when the forecast cash flow does not
already bear the financing part of it.

A right-of-use asset with no readable liability beside it is recorded and
nothing is counted as debt.

### Cash and securities

Cash plus **short-term** marketable securities, as one line. Securities are
money parked in instruments rather than in the bank; a company holding them is
no more indebted for it. They are taken out of other current assets at the same
time, or the balance sheet would carry them twice.

**Long-term securities are reported and never netted.** A holding placed out of
reach for a year or more is not money a lender can be paid with tomorrow, and
some of what sits in that tag is not marketable at all (Alphabet's
non-marketable equity stakes are tagged there).

**Where the filing shows securities but never says how much is short-term,
nothing is netted.** The securities stay inside other current assets, where
they already were, rather than being read as nil or split by guesswork. The
years this happens in are recorded and shown.

---

## 5. The income statement, line by line

`model.js` sections 2, 4b and 6, on assumptions from `deriveModel.js`.

The chain is EBITDA → less D&A → EBIT → less net interest → EBT → less tax →
net income, with a margin beside each subtotal, which is `IS 13`.

### Revenue

**Reported:** as filed.
**Forecast:** the last reported year grown at one rate, held flat for five
years. The rate is the trailing compound growth across the reported years,
**clamped to −10% and +25%**, falling back to 3% where it cannot be measured.
The clamp exists because a company growing 60% for three years will not do so
for five more, and a shrinking one should not be extrapolated into oblivion.
**Convention:** `IS 3` (the growth assumption sits in its own cell and revenue
is calculated off it) — followed. `IS 1` (revenue by stream) — **departed
from**: segment detail lives in filing footnotes and is not machine-readable
from any free source, so a derived model runs on one combined revenue line and
the dashboard says so. `IS 4` (sanity-check against an outside reference) —
**not applicable**: there is no consensus or guidance feed. The clamp's effect
is recorded as `KI-13`.

### Cost of sales

**Reported:** as filed, carried negative.
**Forecast:** the balancing line of an assumed gross margin — the **last
reported year's** gross margin, clamped to 1%–95%, held flat.
**Convention:** `IS 5` (variable costs as a percentage of revenue) — followed.
`IS 6` (the method is chosen from a defined menu and recorded) — followed; the
choice is in `provenance.grossMargin`. `IS 7` (a conservative method is the
default when the choice is close) — **departed from**, deliberately: an average
or a minimum across a company that has changed shape describes no year it now
operates in. Measured effect in `KNOWN_ISSUES.md` (`D1`).

### Research & development, and selling, general & administrative

**Reported:** as filed, and **null where the filing does not report the line** —
not nil. A blank is an absence.
**Forecast:** each line's share of revenue in the last reported year, held flat;
R&D clamped to 0–50%, SG&A to 0–60%. A line not reported in that year is
forecast at nil and said so, because its cost is already inside other operating
costs.
Both are read from the **same** year, the last reported one, because other
operating costs is defined against that year's lines. Taking R&D from an earlier
year that did report it would count that cost twice.

### Other operating costs

This line does not exist in any filing. It exists because the engine builds
operating profit from the named cost lines, and those lines do not account for
every operating cost in every source. Yahoo's SG&A for Reliance is a narrow
figure that leaves out depreciation and a large block of operating expenses;
built from the named lines alone the model gave Reliance an operating profit of
2,320,970 against the 1,213,770 it reported.

**Reported:** filed operating income less revenue less the named cost lines.
Every gap is carried however small, so operating income ties to the filing
exactly. It is **not** added to SG&A — SG&A is the filed SG&A, and no line
claims to be something it is not.
**Forecast:** where the residual is a **cost** in the last reported year, its
share of revenue in that year, held flat. Where it is **income** in that year
(the named lines come to more than the filing's operating costs), the smaller of
that year's income and the median across the reported years. Two causes look
alike: usually the filing's cost tags overlap a little every year (Procter &
Gamble 2.4% of revenue, Walmart 1.0%, MercadoLibre 11%) and nil would count that
cost twice; sometimes it is a one-off gain (Boeing FY2025, 10.8% of revenue on a
business sale against at most 0.8% elsewhere). The median follows a pattern that
recurs and ignores a single year, and the smaller of the two never forecasts
more income than the company last reported.
It is **not clamped**. A forecast that makes no operating profit is refused by
the engine, not capped.
**Convention:** `CF 4` (a line without a feeder schedule is projected by one of
a defined set of methods, documented) — followed by analogy; the choice is in
`provenance.operatingCosts`.

### Depreciation and amortisation

Charged as its own line in the EBITDA-to-EBIT bridge, which is `IS 8`.
**Reported:** filed D&A.
**Forecast:** the PP&E schedule's depreciation (§7) plus the intangible
amortisation run-off (§8).

### Stock-based compensation

Charged as its own line, and **it stays a cost** — EBITDA is before D&A only
(§13).
**Reported:** as filed; null where not reported.
**Forecast:** its share of **total operating costs on the filed basis** in the
last reported year, held flat. Where the last reported year reports none, nil,
and `provenance.notReported` says so rather than leaving a silent zero.
**Convention:** `CF 3` (material non-cash items added back and documented) —
followed. The checklist offers SBC over revenue or over operating expense; the
second is implemented and both are sanctioned.

### Taking D&A and SBC out of the cost lines

The margins above are observed on the filed basis, with D&A and SBC inside the
cost lines. Charging them again as their own lines would double-count. So:

- **Reported years:** each filed cost line gives up its pro-rata share of filed
  D&A and SBC, allocated by that line's share of total operating costs. The
  three lines plus D&A plus SBC equal filed operating costs exactly, so
  reported operating profit and everything below it is unchanged.
- **Forecast years:** each cost line gives up the share of revenue that D&A and
  SBC took of it in the last reported year, and the forecast D&A and SBC are
  then charged in full. Operating profit therefore falls where D&A and SBC
  outgrow the level the reported margins embedded, and rises where they shrink
  below it.

**Convention:** `IS 9` (a host expense line is reduced by buried D&A so it can
be shown separately without double-counting) — followed. `IS 10` (the exact
split between cost of sales and SG&A is immaterial as long as EBITDA is right)
— relied on: the filings do not say which line carries how much, and the pro-rata
allocation is an approximation whose only effect is on the gross-margin
breakout, not on EBITDA, EBIT or anything below.

### Interest expense, interest income and other income

**Reported:** filed interest expense on its own line. Everything else between
operating profit and pretax income — interest income, investment gains, other
items — is pretax income less operating profit less that interest, so pretax
income ties to the filing exactly.
**Forecast:** interest expense is the debt schedule's charge (§9). **Interest
income is zero** and revolver interest is zero, because the circuit breaker is
on (§9). Other income is **zero**, per `IS 17` (non-recurring items are not
projected forward).
**Convention:** `IS 12` (the sign convention is confirmed against the company's
own figures and carried consistently) — followed by construction: interest
expense is forced negative, and everything else is a residual that must tie.

### Tax

**Reported:** filed tax expense; the effective rate is filed tax over filed
pretax income.
**Forecast:** the **last reported year's** effective rate, clamped to 0–50%,
falling back to 21%.
**Convention:** `IS 6`/`IS 7` — the checklist is explicit that the last actual
effective rate is the one to use. Previously this averaged the first and last
years, which let a one-off charge sit in the forecast for ever (Apple FY2024's
European State-aid charge pushed the rate to 24%). The rate is a filed ratio
applied in the DCF to operating profit, which is `KI-3`.

### Items after tax, and reported net income

**Reported:** anything between pretax income after tax and filed net income —
non-controlling interests, discontinued operations, equity-method results
reported after tax — carried as one line, so reported net income is the filed
figure rather than operating profit relabelled. Filed pretax income and filed
net income are also carried alongside, and the workbook's Checks sheet tests
that the built figures tie to them.
**Forecast:** nil.
**Convention:** `IS 15` (a second, as-reported net income line for
reconciliation) — followed. `IS 14` (non-recurring items moved below a clean
net income line) and `IS 16` (distributions shown as their own section) —
**not followed**: nothing in the free sources identifies which items are
non-recurring, so no adjusted net income line exists.

### EBITDA

**Operating profit plus depreciation and amortisation. Stock compensation stays
in costs.**

This is a definition the model does not get to choose. A multiple is only
meaningful against the same measure it was computed from, and the peer
EV/EBITDA multiples (§18) come from a source that computes EBITDA as operating
income plus D&A with stock compensation left in — checked against that source's
own annual figures, where for Arm, Palantir, Salesforce and Apple its EBITDA
equals operating income plus depreciation to the last million and is short of
the SBC add-back by exactly the stock compensation. Adding it back here and then
applying their multiple would value a larger EBITDA at a multiple derived from a
smaller one.

It is also the honest treatment on its own terms: stock compensation is a real
cost of employing people, paid in shares rather than cash, and the dilution it
causes is carried in the share count rather than waved through as a non-cash
add-back. The unlevered cash flow still adds it back, because that calculation
is about cash.

---

## 6. The working capital schedule

`model.js` section 3. Convention `WC 1` defines operating working capital
narrowly as current assets excluding cash less current liabilities excluding
interest-bearing debt, which is what the lines below are.

Six lines, each forecast by growing the prior balance at a driver's growth rate:

| Line | Grows with | Convention `WC 2` pairing |
|---|---|---|
| Accounts receivable | revenue | receivables to revenue — followed |
| Inventory | cost of sales | inventory to cost of sales — followed |
| Accounts payable | cost of sales | payables to cost of sales — followed |
| Accrued expenses | revenue | accruals to operating expense — approximated by revenue |
| Other current assets | cost of sales | no pairing named |
| Deferred tax assets | revenue | accrued taxes to the tax line — **departed from** |

Deferred tax assets are nil for every derived company (the filings' split is not
fetched), so that last departure has no effect on a derived model.

Other assets and other non-current liabilities are **held flat** at the last
reported balance, except that other assets falls by the intangible amortisation
charge (§8).

**Convention `WC 4` and `WC 5` are departed from.** The checklist wants days
metrics computed on the *average* of the current and prior balance over the
period's driver, and the forecast solved forward from a held-constant days
figure. The engine grows the prior balance at the driver's growth rate instead,
which is the same thing when the driver grows smoothly and is not the same thing
when it does not. The DSO, DPO and inventory-turnover figures shown beside the
schedule use the **period-end** balance, not the average, and are presentational.

**Convention `WC 7` and `WC 8` are followed**: the change in each asset line
reaches the cash flow sign-flipped, each liability line without a flip.

---

## 7. The PP&E schedule

`model.js` section 4. This is the schedule most of the recent work has been in,
and the one furthest from the checklist.

### Reported years

Opening balance is the prior year's closing balance. A derived model has **no
balance before its first reported year**, so that year has no roll-forward at
all — opening is null. It used to be seeded with the year's own closing
balance, which made the movement come out as exactly that year's capital
spending, a depreciation rate of exactly 100% that nothing had measured, in 155
of 168 companies.

**Depreciation is the filed figure**, in this order:

1. filed depreciation of PP&E, where the filing reports it alone;
2. filed D&A less filed amortisation of intangibles, where it reports those two;
3. filed D&A, where the filing does not split it — amortisation is then treated
   as depreciation of PP&E, none is run off, and `meta.depreciationBasis`
   records it per year.

Where no D&A is filed in any year, the rate falls back to the balance-sheet
movement for the years that have an opening balance.

**Everything else that moved the balance** — disposals, impairments,
finance-lease additions, acquisitions, currency — is shown on its own line
rather than called depreciation. This is why the rate is not measured from the
balance sheet any more: read that way Amazon came out at −92% of capital
spending and Union Pacific at 419%.

### The rate

Filed depreciation over the **assets in service**: opening net PP&E plus half
the year's additions, averaged across the reported years that give both. The
first reported year measures nothing and is left out rather than counted as nil.

Half, because a machine bought during the year is in service for part of it,
which is the convention a hand-built schedule uses when it cannot see purchase
dates. The opening balance alone would charge nothing for a year's additions;
the closing balance would charge a full year for a machine installed in
December.

**Convention:** `Dep 1` (straight-line on a pooled base with nil residual) —
followed in effect. `Dep 7` (the opening balance is linked from the prior year's
closing balance) — followed. `Dep 6` (existing PP&E depreciated separately from
each future year's capex vintage, stacked) — **not followed**: one pool, one
rate. `Dep 8` (separate useful-life cells per vintage, with a plausibility check
against historical depreciation growth) — **not followed**, for the same reason.

### Forecast capital spending

Where the company's net PP&E to revenue ratio can be measured, capital spending
is split in two. Where it cannot — no net PP&E, or no revenue — it falls back to
a flat average share of revenue and `provenance.capex` says so.

```
growth      = (revenue − prior revenue) × this company's own net PP&E / revenue,
              averaged across the reported years
maintenance = depreciation
capex       = max(0, maintenance + growth)
```

**Why the split.** `CF 6` asks for capital spending taken off company guidance
and cross-checked against the historical share of revenue, "rather than relying
on a percent-of-revenue assumption in isolation", and warns that a
percent-of-sales-only projection is too mechanical for a business with lumpy
investment. The site reads filings and has no guidance to read, so it keeps the
half of the rule it can: the line is split, and only the growth half is tied to
revenue. Growth capital spending is "a percentage of a related balance-sheet
line", one of the projection methods `CF 4` names, documented as that item
requires. Maintenance equal to depreciation is what keeps a pooled asset base
standing, and the same treatment the terminal year already used.

**It works in both directions.** A company whose revenue falls releases plant in
the same proportion. Flooring growth at nil was tried and rejected on the
measurement: holding the whole base against a shrinking business sent
TotalEnergies' capital intensity to 126% of revenue against the 62% of its
reported years, while the filings show the symmetric behaviour — BP spent 0.74
to 0.92 times its depreciation over four reported years as its plant shrank.
**Total** spending is floored at nil: the model does not sell plant for cash.

**Targeting the historical ratio directly was considered and rejected**, because
it forces a one-off correction in the first forecast year wherever a company's
current intensity differs from its own average — for Microsoft, 94% of revenue
today against a 61% average, that is writing off a third of its plant in year
one. Adding at the margin leaves the company where its last filing left it.

**The circularity is solved, not iterated.** Maintenance is depreciation, and
depreciation is charged on a base that includes half the year's additions:

```
d = r(open + (d + g)/2)   ⟹   d = r(open + g/2) / (1 − r/2)
```

Where the ratio cannot be measured the old method stands: capital spending is
the average capex share of revenue across the reported years, clamped to
0.1%–40%. The curated Apple file uses a third method, a growth rate on the prior
year's capital spending.

Where this treatment does not hold — a company whose revenue moves with a
commodity price or an acquisition rather than with volume — is `KI-11`.

### The depreciable base, and a missing opening balance

The base is the solved base, not opening plus half of total spending: where
spending floors at nil those differ, and the rate on screen should be the rate
actually charged.

**A missing opening balance is not nil.** Alphabet's last reported year does not
tag net PP&E under the plain name; treating that as an empty yard charged it
depreciation on half a year's capital spending alone — 3,138 against the 21,136
it filed. The base stays null and the company is refused rather than valued off
an asset base that was never reported.

---

## 8. Amortisation of intangibles

`model.js`, after the PP&E schedule. Filed D&A is depreciation of PP&E plus
amortisation of intangibles, and the forecast's own depreciation formula
produces only the first. The difference is charged separately, and **it runs
off**.

**The anchor** is the filed amortisation of intangibles for the last reported
year where the filing reports it, failing that filed D&A less the filed
depreciation the forecast charges. Nothing is charged at all when the filing
reports no amortisation, when it cannot be split, or when the filing reports no
intangible assets to amortise (Apple). The reason is recorded and shown.

**The run-off.** The anchored amount is charged flat each year until the
intangibles reported in the last year are used up, and nothing replaces them.
The filings show a finite pool being consumed at about that rate: Microsoft's
intangibles fell from 27,597 to 18,609 over two years against an anchored 3,252
a year, Caterpillar's from 1,042 to 241 against 193, Amgen's from 32,641 to
22,276 against 4,055. The forecast buys no intangibles, so persisting the charge
would mean reinvesting in an acquisition of that size every year for ever — it
cut Amgen's value by a third when tried.

The charge reduces other assets, where intangibles sit, and the other-assets
movement the cash flow reads **excludes** it, so operating cash flow does not add
it back twice. The terminal value is normalised as though the run-off is
complete (§13).

---

## 9. The debt schedule, the revolver and cash

`model.js` sections 5, 6 and 9.

### Borrowings

**One blended tranche**, not one per instrument. `Debt 3` wants each tranche
with its own balance, issuances, retirements and interest unless there is a
stated reason to combine; the stated reason is that no free source publishes the
instruments or their coupons. `Debt 5` (a blended rate weighted by principal) is
therefore what is done, on the whole balance.

**Held flat.** No repayment schedule: `debtRepaymentSchedule` is zero in every
forecast year, because no free source publishes a maturity ladder and most
companies refinance maturing debt anyway. `Debt 4` (mandatory and non-mandatory
lines kept separate) is **not followed** — there is only the revolver's
automatic movement.

### The cost of debt

**Each company pays its own rate**, not a flat assumption. Each reported year's
filed interest over the average of that year's and the prior year's borrowings,
averaged across the years that have both. The first reported year is skipped: it
has no opening balance. This is `Debt 6` — interest on the average of opening
and closing balances rather than on the closing balance alone.

Two answers are not usable, and both say so rather than pretending:

- **A rate above 25%.** Filed interest is not always interest on this debt: a
  bank's is mostly what it pays depositors (JPMorgan 118%, HSBC 29%), and a
  company that repaid its debt mid-year divides a full year's interest by a
  balance that is no longer there (Accenture 36%). The highest rate that is
  genuinely a borrowing cost on the sweep is Reliance Infrastructure's 22.7%,
  what a distressed Indian borrower pays, so the cut sits above it.
- **No filed interest at all** in any year with debt (Arm, Caterpillar, GE,
  NextEra, T-Mobile, MercadoLibre). Apple stopped tagging interest expense after
  FY2023 and is carried by its earlier years.

In both cases the rate falls back to **4.5%**, and the provenance says it is an
assumption rather than the company's own.

The rate is charged on the balance the **forecast** carries — the last reported
one held flat — not on the average across reported years. Charging the average
against a smaller closing balance made the forward rate something the company
never pays: Reliance Infrastructure came out paying 36.8% on a 22.7% rate.

### The circuit breaker

`meta.circuitBreaker` is `ON` for every derived company. With it on there is no
interest income on cash and no revolver interest, so the income statement closes
without iterating. `Circ 1` and `Circ 2` describe the intentional circularity
and Excel's iterative calculation; the engine avoids the loop entirely rather
than iterating, and the **workbook** implements the switch properly (§22).
`Debt 11` (interest income on the average cash balance) is therefore **not
followed** on the site: it is nil.

### The revolver and the cash sweep

A roll-forward, as `Debt 1` and `Debt 12` describe:

```
cash available = opening cash − minimum cash + operating + investing
               + every financing flow except the revolver
draw/(repay)   = −min(opening revolver balance, cash available)
```

A shortfall is drawn in full; a surplus repays at most the opening balance. This
is `Debt 12`'s minimum function — pay down whichever of cash available and the
outstanding balance is smaller, draw when cash available is negative. `Debt 13`
(a stated facility cap) is **not followed**: no cap is known, so none is applied.

**The minimum cash balance is 50% of the last reported cash balance.** `Debt 10`
requires the cushion to be documented rather than left as an unexplained number;
it is documented here and in the provenance, but its *basis* is a judgment with
nothing behind it, which is why it is also recorded as `KI-9`.

---

## 10. Equity, shares and EPS

`model.js` section 7.

**Common stock and paid-in capital** roll forward by new issuance (nil in every
forecast year) plus the stock-compensation charge.

**Retained earnings** roll forward by net income less dividends.

**Dividends** are the forecast payout ratio times net income. The ratio is the
**average** across the reported years that report dividends, clamped to 0–100%;
years that report none are left out rather than counted as nil. No dividends
reported anywhere means none forecast.
**Convention:** `CF 7` wants dividends projected as shares outstanding times an
assumed dividend per share, not as a percentage of net income. This is a
**departure**, made because no free source gives a forward dividend per share,
and the checklist's own cheat-sheet alternative is the historical payout ratio.
It replaced a linear regression through the payout history, which could trend
the ratio somewhere the company has never been, including above 100% of
earnings.

**Buybacks** are a percentage of an authorised ceiling. The ceiling in forecast
years is the average of the reported ceilings plus the first forecast one, over
a fixed window, counting only the ones that exist. The percentage is the average
of what the company actually spent against its ceiling in the years that report
repurchases. None reported, none forecast.
**Convention:** `CF 5` (discretionary buybacks flagged and conservatively
defaulted) — partly followed: they are extrapolated from history rather than
defaulted to zero, which the checklist warns against, but only from years that
report them.

**Other comprehensive income** is held flat.

**Share count.** The last reported diluted count rolls forward: shares issued
are new issuance over the average share price, shares repurchased are the
buyback over the same price, and the average share price itself grows at the EPS
growth rate. Basic shares in a forecast year are the average of opening and
closing; the dilutive impact is held at the last reported year's absolute
difference between diluted and basic.
**Convention:** `IS 18` (basic shares from the filing's cover page) — **not
followed**: the diluted weighted-average count is used for both, because that is
what both sources publish. `IS 19` (diluted shares rebuilt by the treasury stock
method) — **not followed**: option and warrant detail is not machine-readable.
The engine carries the reported diluted count, which already embeds the filer's
own treasury-stock calculation for the reported years, and holds the dilutive
increment flat thereafter.

---

## 11. The cash flow statement

`model.js` section 8. **Forecast years only.** Reported-year cash flows are not
built by the engine at all; the site shows filed operating cash flow straight
from the statements, and the workbook derives them by differencing balance
sheets (§22, and `KI-7`).

Operating activities, in order, which is `CF 3`:

```
net income
+ depreciation & amortisation
+ stock-based compensation
+ PIK interest accrued
− change in receivables        (sign-flipped, WC 7)
− change in inventory
+ change in payables           (not flipped, WC 8)
+ change in accrued expenses
− change in other current assets
− change in deferred tax assets
− change in other assets, excluding the amortisation charge
+ change in other non-current liabilities
```

Investing is capital expenditure alone. Financing is borrowing, dividends, share
issuance, buybacks, the OCI movement and the revolver draw.

**Convention:** `CF 2` (operating cash flow starts from net income before
distributions) — followed for forecast years, where the forecast starts from net
income before dividends and items after tax are nil, so it is the same figure.
`CF 9` (every working-capital line linked from the schedule's year-over-year
change) — followed. `CF 8` (financing debt lines linked from the debt schedule
rather than projected independently) — followed. `CF 1` (three sections with
subtotals and a grand total) — followed.

---

## 12. The balance sheet, and the check

`model.js` section 9. Every line is a schedule's closing balance; nothing is
restated. The balance check **computes** — total assets less total liabilities
less total equity, rounded to a thousandth — rather than being asserted.

**Convention:** `BS 2` (the cash flow drives the balance sheet, not balance-sheet
differencing) — followed for forecast years. `BS 3` (asset balances move against
their cash-flow driver, cash and liabilities and equity with it) — followed by
construction. `BS 5` (every cash-flow line used exactly once) — followed.
`BS 6` and `BS 7` (a differences column, and a consistent formula shape for
locating an error) — **not applicable to a program**; the workbook carries a
Checks sheet instead.

A non-zero check in **any** year, reported or forecast, refuses every valuation
(§16). A wrong number with a caveat beside it is still a wrong number.

---

## 13. The discounted cash flow

`model.js`, `buildDCF`.

### Unlevered free cash flow

Per forecast year:

```
EBIT × (1 − tax rate)                      ← the unlevered tax, DCF 5
+ depreciation & amortisation
+ stock-based compensation
+ the movement in working capital, taken with its own sign
− capital expenditure
```

Net income is deliberately absent: it is already inside EBIAT, and adding it
again would count earnings twice.

**Convention:** `DCF 3` (UFCF starts from EBIT, not net income) — followed.
`DCF 4` (adds back D&A, deferred taxes and other non-cash items; takes the
working-capital change directly from the cash flow statement with its existing
sign; subtracts capex) — followed. `DCF 5` (unlevered tax computed as EBIT ×
rate rather than pulling the reported tax expense) — followed. `DCF 6`
(non-cash adjustments cross-checked against how the cash flow statement treats
the same item) — followed: SBC is added back here because the cash flow
statement adds it back.

### Discounting

Each year's cash flow is discounted from the **valuation date** to that fiscal
year-end, using a 30/360 year fraction. The valuation date is the date the
payload was fetched. There is one convention, applied to every year and to both
terminal values, which is what `DCF 1` asks for — but it is not *stated* as a
choice between end-of-year and mid-year, and the first forecast year's **full**
cash flow is discounted over only the fraction of the year remaining while net
debt is taken at the last reported year-end. That is `KI-2`.

### Terminal value: perpetuity growth

```
terminal capex    = −(D&A of the last forecast year − that year's amortisation)
normalised FCF    = last year's unlevered CFO
                    − the excluded lines
                    + terminal capex
                    − the amortisation's tax shield
terminal value    = normalised FCF × (1 + g) / (WACC − g)
```

with `g` a flat **2.5%** for every derived company.

**Terminal capital spending equals depreciation of PP&E**, which is the steady
state a pooled asset base sits in. The terminal year is normalised as though the
intangible run-off is complete: the amortisation comes out of the depreciation
figure, so "capex equals depreciation" replaces PP&E only, and the amortisation's
tax shield — which lasts only as long as the intangibles — is not capitalised in
perpetuity.

**Two lines are excluded from the terminal year only**: deferred tax assets and
other non-current liabilities. Both are timing items with no reason to persist
in perpetuity. They stay in the explicit forecast years.

**Working capital stays in.** A terminal year with no working-capital investment
assumes a growing business needs no more receivables or inventory, ever; on
NVIDIA that overstated the normalised cash flow by 17%.

A normalised cash flow at or below zero refuses the company: it cannot be
capitalised.

**Convention:** `DCF 10` (perpetuity growth from the final year's UFCF grown one
more year, over the discount rate less the growth rate) — followed. `DCF 11`
(the rate is kept low and grounded in a macro proxy) — followed in level, but
2.5% is a flat default and not company-specific, which the provenance says.

### Terminal value: exit multiple

The last forecast year's EBITDA times a flat **12×** for every derived company.
The implied exit multiple from the perpetuity value, and the implied perpetual
growth from the multiple, are both computed and shown.

**Convention:** `DCF 10` (both methods computed) — followed.

### They are never averaged

`DCF 12` says a material divergence between the two is investigated rather than
silently averaged or ignored. Both stand on the headline with the gap between
them stated. Averaging produced a figure that is neither method's answer and
buried the disagreement, which is the most useful thing on the page.

**Where the gap is wide** — more than a quarter, against the smaller of the two
— the page says in plain language what the divergence means, in whichever
direction it runs: an exit multiple above the perpetuity value means the
multiple is pricing in growth these cash flows do not produce, or the forecast
is too conservative; below it means the cash flows are worth more than the
market pays for businesses like this, so either the forecast is too generous or
the multiple prices in a risk the cash flows do not show. A quarter is the cut
because the median spread was 14.5% on the sweep of 2026-09-20, so it sits
comfortably beyond ordinary disagreement.

**Where one figure is genuinely needed it is the perpetuity value, named.** That
is the batch screen, the reverse DCF's solves, the income approach's figure
where the three approaches are compared, and the premium against the share price
in the workbook. Not because it is more correct, but because it is built from
this company: the exit multiple is a flat 12× for every derived company, so a
figure resting on it moves with an assumption that is the same for a software
company and a steelmaker.

### Sensitivity

Two five-by-five grids: WACC against terminal growth for the perpetuity method,
WACC against the exit multiple for the other, each re-running the whole
valuation rather than scaling the headline.

---

## 14. The cost of capital

`model.js`, `computeWACC`.

```
cost of equity = risk-free rate + beta × market risk premium
WACC           = weight of equity × cost of equity
               + weight of debt × cost of debt × (1 − tax rate)
```

Risk-free rate **4.5%**, market risk premium **4.23%**, both flat defaults for
every derived company. The tax rate is the last forecast year's.

**Convention:** `DCF 8` (CAPM) — followed. `DCF 7` (an after-tax cost of debt and
a cost of equity, each weighted at market value, with the debt component
tax-effected) — partly followed, see the weights below. `DCF 9` (risk-free rate,
beta lookback and market risk premium drawn from one consistent tenor) — **not
demonstrable**: the two rates are flat constants with no tenor attached.

### The weights: gross debt at book, equity at market

The weights say how the business is financed — what share of the money in it was
borrowed and what share was put in by shareholders. A company that borrows 100
and holds 150 in the bank still has 100 of borrowed money in it, costing what it
costs. Weighting on **net** debt made that share negative, the equity weight
more than 100%, and the whole cost of capital higher than the cost of equity
alone, so holding cash made a company worth less.

Cash does not belong in the weights for a second reason: it is already in the
equity bridge, where it is added to what the shareholders get. Netting it off
the weights as well counts it twice.

Debt is at **book value**, which is what the filing gives; the market value of a
company's bonds is not in any free source. `DCF 7` asks for market value on both
sides, so this is a departure of necessity, and the workbook's row label says
so. Equity is at **market value**, which is the price the model is comparing
itself against anyway. Both come off the same balance sheet the bridge uses, so
the weights and the bridge cannot describe different capital structures.

### Beta

For a derived company the carried beta is **1.0 and it is an asset beta** — the
risk of the business before borrowing. It is relevered onto this company's own
capital structure before the cost of equity is taken from it, using the Hamada
relation:

```
equity beta = asset beta × (1 + (1 − tax rate) × debt / equity)
```

**Why.** Debt is cheaper than equity, so weighting capital on gross debt means a
company that borrows more gets a lower cost of capital. Left there, that runs
away: Reliance Infrastructure, borrowing more than twice its market
capitalisation, came out at a WACC of 4.27% — below the risk-free rate the model
starts from, which is not a defensible rate at which to discount anybody's
equity. Borrowing does not make a business safer; it moves risk onto the
shareholders, who rank behind the lenders. As leverage rises the equity weight
shrinks, but the cost of equity rises to meet it, and the cost of capital falls
only by the tax shield rather than without limit.

Delevering and relevering both carry **gross** debt, for the same reason the
weights do: the formula asks how much of the equity's risk comes from borrowing,
and a borrower's leverage is what it owes, not what it owes less its bank
balance. On net debt a company with more cash than debt came out with a beta
*below* its industry's unlevered beta, which says its shares are safer than the
same business with no debt at all.

**Convention:** `DCF 15` (the unlevering and relevering formula explicitly
incorporates the tax rate and the debt-to-equity ratio) — followed. `DCF 14`
(comparables' betas unlevered, averaged, and relevered on the target's
structure) — **not followed for a derived company**: no comparable set is
derived, and the asset beta is a flat 1.0. The machinery exists and the curated
Apple file uses it.

There is also a direct WACC override, used by the slider, which bypasses CAPM
entirely.

---

## 15. The equity bridge

`model.js`, `equityBridge`.

```
enterprise value
− net debt
− minority interests
− preferred stock
= equity value ÷ diluted shares = value per share
```

which is `DCF 13` exactly.

**Net debt comes off the model's own balance sheet** at the last reported date:
the borrowings and revolver it shows, less the cash and securities it shows. Not
from a figure carried beside the model. The workbook always read the balance
sheet and the engine read a hand-entered figure; for a derived company the two
are the same by construction, but the curated Apple file carried 146,517 of cash
and 82,347 of debt against a balance sheet showing 132,420 and 90,678, so the
site and the workbook bridged the same enterprise value to different answers.
The balance sheet wins: it is the statement the reader can see, and a bridge
using a figure that appears nowhere in the model cannot be checked.

**Minority interests**, in order:

1. the filing's own minority-interest balance, plus any redeemable minority
   interests carried outside equity;
2. equity including minority interests less shareholders' equity, where the
   filing reports both and they differ;
3. total assets less total liabilities less shareholders' equity, where all
   three are **filed** — a total-liabilities figure this code derived as assets
   less equity has the minority interests inside it and says nothing about them.
   On an SEC filing this also picks up redeemable preferred and other temporary
   equity, which is also not the common shareholders'.

Where none can be read but the filing shows a minority share of net income, they
exist and their amount does not: **refused**, not treated as nil.

**Preferred stock:** the filing's carrying value. Where the filing says the
diluted share count already includes the common shares the preferred converts
into, the preferred holders are in the denominator and nothing comes off — it
would count them twice (Procter & Gamble, 68.3 million shares). Where no balance
is tagged, nothing converts, and the filing pays preferred dividends,
**refused**.

Both come off at **book value**, because that is what the filing gives. A
minority interest's market value is not observable, and a preferred balance
filed at par is not the claim. This is an approximation, recorded as such in
`KNOWN_ISSUES.md`.

---

## 16. Refusals, in the order they are tested

`model.js`, `checkValuationApplicability`, and the guards around it. The
principle: **a wrong number with a caveat beside it is still a wrong number.**

Tested in this order, so that when a model is broken the reason given is the
deepest one:

| # | Code | Trigger |
|---|---|---|
| 1 | `balanceSheetDoesNotBalance` | assets ≠ liabilities + equity in any year with a balance sheet, reported or forecast, to a thousandth; or any line that is not a finite number |
| 2 | `filingMissingValuationInput` | cash missing in the last reported year, or borrowings missing there when earlier years report some — either would balance the sheet while corrupting net debt |
| 3 | `filingMissingIncomeStatementLine` | filed operating income, pretax income, tax or net income missing in any reported year |
| 4 | `listingNotComparable` | any of the three gates in §3 |
| 5 | `nonCommonClaimNotReported` | a minority share of income with no readable balance, or preferred dividends with no preferred balance |
| 6 | `filingMissingValuationInput` | cost of sales never reported, capital expenditure never reported, or fewer than two years of net PP&E |
| 7 | `implausibleDepreciationRate` | no asset base in the last reported year; no measurable rate; a rate at or below zero; or a rate that depreciates the balance past nothing inside the forecast |
| 8 | `financialSector` | SIC 6000–6799, or a sector matching financial / bank / insurance / capital market / asset management / NBFC |
| 9 | `negativeOperatingProfit` | operating profit at or below zero in any forecast year |
| 10 | `terminalGrowthExceedsWACC` | terminal growth at or above the cost of capital |
| 11 | `negativeTerminalCashFlow` | normalised terminal cash flow at or below zero |
| 12 | *(no code)* | value per share not a positive finite number, or WACC not above terminal growth |

Codes 1–5 are **integrity refusals**: no valuation of any kind is shown, not the
DCF, not the market or asset approach, not residual income, not the reverse DCF.
The rest refuse the DCF alone.

A bank is refused by 8 and valued by residual income instead (§17), which is
gated separately on whether the **filed** balance sheet balances, because that
is what residual income is built from. A bank's forecast usually cannot be
computed at all — banks do not report cost of sales, capital expenditure or PP&E
the way the forecast needs — and that says nothing about the book value the
other model uses.

Two refusals happen earlier still, in the derivation, and throw rather than
returning a code: fewer than two comparable periods (§2), and no diluted share
count. An absent denominator is a missing input, not a company worth infinity.

---

## 17. Residual income

`residualIncome.js`. For banks and other financial companies, which the DCF
refuses for good reason.

Unlevered free cash flow values a business before financing, so the question
stays about the business rather than how it is funded. That framing breaks
completely for a bank: borrowing is not how a bank finances itself, it is the
raw material it sells. Capital expenditure and working capital barely exist.
Unlevered free cash flow for a bank is not a small figure, it is a meaningless
one.

```
equity value    = opening book value
                + PV of each forecast year's residual income
                + PV of the terminal value
residual income = net income − cost of equity × opening book value
```

**Book equity** is total assets less total liabilities, for the same reason as
§4, **less** minority interests and **less** preferred stock. **Net income** is
the filing's figure — already the parent's share — **less** preferred dividends.
Both sides on the parent's common shareholders' basis: book equity measured
across a mismatch with the parent's earnings understates the return.

Minority interests and preferred stock are read **per reported year**, in the
same order as the equity bridge (§15). Where either cannot be read in the last
two years, the model refuses rather than treating it as nil. A preferred balance
filed as nil beside preferred dividends is par value, not the claim (American
Express: nil, and 58 paid).

**Common dividends** are the filing's common-only figure where it tags one;
failing that, total dividends less preferred dividends. The distinction matters
because some filers tag common only (Wells Fargo) and others tag the total
(Bank of America, 9,563 of which 8,083 is common).

**Drivers:**

| | |
|---|---|
| Return on equity | the **last reported year's** return on **opening** book equity, clamped −50% to +60%, default 12% |
| Payout ratio | the **average** across reported years, clamped 0–95%, default 20% — dividends are lumpy and one year is a poor guide |
| Cost of equity | CAPM on the same risk-free rate, market risk premium and beta the DCF carries |
| Terminal growth | 3%, never allowed within a point of the cost of equity |

**The beta is not relevered.** The DCF relevers its asset beta onto the
company's own capital structure (§14); residual income takes the carried beta
straight — 1.0 for a derived company, giving a cost of equity of
4.5% + 1.0 × 4.23% = 8.73% for every bank. A bank's equity risk is not a flat
1.0, and nothing in the model makes it company-specific.

**The forecast** rolls book value forward: opening plus earnings less dividends,
with earnings the opening book times the return on equity. The terminal value is
the final year's residual income growing at the terminal rate, capitalised at
the cost of equity and discounted back.

**What it assumes, stated on screen as well as here:** that reported book equity
is roughly right, which for a bank means trusting the loan-loss provisioning —
and provisioning is exactly where a bank in trouble flatters itself. It says
nothing about capital adequacy, which is often the binding constraint on whether
a bank can grow at all, and regulated dividend limits are not modelled.

---

## 18. The market approach

`marketApproach.ts`, on peers from `api/comps.js`.

Three multiples, each applied to this company's own figure, each producing a
value per share:

| Multiple | Applied to | Bridge |
|---|---|---|
| EV / EBITDA | reported EBITDA | less net debt and other claims, ÷ diluted shares |
| EV / Sales | reported revenue | same |
| Price / Earnings | reported earnings per share | none — a P/E is already an equity figure |

**Two rules the file enforces.**

1. **Trailing multiples go on trailing figures.** The peer multiples arrive as
   trailing numbers — what each peer trades at on profit it has already
   reported. Applying a trailing multiple to a forecast EBITDA prices in every
   year of growth twice, once in the forecast and once in the multiple. So every
   figure used is the **last reported year**, never the forecast. This is
   `Comps 13`'s requirement that every multiple sit on the same time basis
   across the set, applied to the subject as well.
2. **A method that cannot be computed is left out, not shown as zero.** A
   loss-making company has no meaningful P/E; a company with negative EBITDA has
   no EV/EBITDA value. Those rows do not appear and the reason is stated.

**The median, not the average**, because one peer on an extreme number would
drag an average somewhere no company in the set actually trades. It is
recomputed in the browser from whatever peers are selected rather than taken
from the server, so it can never disagree with the list on screen — the reader
can add and remove peers.

**The bridge matches the DCF's**: enterprise value less net debt, minority
interests and preferred stock.

**Conventions not followed.** `Comps 1` to `Comps 3` (LTM built from interim
periods, calendarised to the subject's fiscal period, day-weighted) — the
multiples arrive pre-computed from the source on its own basis. `Comps 4` and
`Comps 5` (each peer's non-recurring items reclassified out of EBITDA on the
same standard as the subject, net of tax) — not done; nothing identifies them.
`Comps 7` to `Comps 9` (deriving a missing quarter) and `Comps 10` (each peer's
diluted count rebuilt by the treasury stock method) — not done. `Comps 11`
(enterprise value built from diluted market capitalisation plus all
interest-bearing debt, preferred and minority interests, less cash) — done by
the source, not here. `Comps 12` (metrics after interest paired with equity
value, metrics before it with enterprise value) — **followed**, which is the one
that would produce a wrong answer rather than an imprecise one.

---

## 19. The asset approach

`assetApproach.ts`. **Every figure comes from the filings, not the forecast.**
That is the point, not a shortcut: an asset approach is a statement about what
exists today, and the moment it borrows a projected balance sheet it stops
answering its own question.

Four measures, most conservative reading last:

| Measure | What it is |
|---|---|
| Book value | total assets less total liabilities |
| Tangible book value | the same, less goodwill and other intangibles — in a break-up, the premium somebody once paid fetches nothing |
| Net current asset value | current assets less **all** liabilities, every fixed asset ignored: Graham's floor |
| Liquidation value | each class of asset written down by a recovery rate, less all liabilities |

**The division of labour in the last one matters.** The balance-sheet figures
are reported facts. The recovery rates are the reader's judgement, and they are
assumption inputs like every other driver on the site. Two presets, because the
honest answer depends on which question is being asked:

| | Cash | Receivables | Inventory | Other current | PP&E | Intangibles | Other |
|---|---|---|---|---|---|---|---|
| Forced sale *(default)* | 100% | 80% | 50% | 25% | 30% | 0% | 20% |
| Orderly wind-down | 100% | 90% | 75% | 50% | 65% | 0% | 40% |

The forced sale is the default because a floor that flatters is not a floor.

**A measure that comes out negative is not shown as a value**, and the reason is
stated instead. A negative floor is not a floor, and printing one would invite
the reader to average it into something.

**Banks get no liquidation measure**: a lender's assets are loans, and what they
fetch depends on the credit behind them rather than on a recovery rate applied
to a category.

**The page says whether any of it is informative for this company.** Where
property, plant and inventory are less than 20% of assets, the figures are
correct and largely beside the point — what makes a software business valuable
never reaches its balance sheet — and they are labelled a floor rather than a
valuation.

---

## 20. The valuation range

`companies.ts`, `valuationBandsFor`. The football field is not an invented band
around a single number. It is the two methods the model actually runs, each
widened by the same sensitivity steps the grid uses:

- perpetuity growth, at the terminal rate ± one percentage point;
- exit multiple, at the multiple ± one turn;
- the 52-week trading range, for comparison.

The exit-multiple bar is labelled as an income approach carrying a market
assumption, because that is what it is: five years of discounted cash flow with
a multiple only at the end. Calling it purely one or the other would be wrong.

Nothing here is a confidence interval and none of it forecasts a share price.
Each bar is a value the model produces under stated inputs. The income, market
and asset approaches are shown side by side and **never blended**, for the same
reason the two terminal values are not averaged.

---

## 21. The drivers the reader can move

`companies.ts`, `buildOverridden`. An override applies **only where the reader
has moved that driver away from its default**, compared at the precision the
slider works in. An untouched dashboard reproduces the data file exactly.

Three of them **shift the model's own path** rather than replacing it with a
flat number, because a hand-built model's path is a judgement worth keeping:

- **Revenue growth** shifts every segment's growth path by the same delta.
- **Operating margin** shifts the gross margin path. Gross margin less R&D and
  SG&A is the operating margin and neither of those is changing, so a point on
  one is a point on the other — except that SBC is a share of operating costs,
  so the shift is scaled by 1/(1 + SBC share) to make the operating margin move
  by exactly what the slider says.
- **Capital spending** scales the whole capex line by the ratio of where the
  slider sits to where it started, leaving the projection method alone. A model
  whose capex is a rising line stays a rising line.

Replacing the path instead was measurably wrong: Apple's file forecasts decaying
growth and a margin falling from 28.9% to 24.4%, and marking its competitive
position a *weakness* used to **raise** the value, because flattening four years
of margin back up swamped the half point taken off.

The R&D and SG&A sliders read margins that exclude D&A and SBC and write
assumptions on the filed basis, so the embedded share is added back and a slider
set to 12.0% gives a modelled margin of exactly 12.0%.

Beta, the risk-free rate and the market risk premium are adjustable directly,
which is more honest than dragging the finished WACC: the reader can watch the
figure they moved flow through the CAPM line. Setting any of them clears a WACC
override that would otherwise win.

---

## 22. The workbook, and where it differs

`excelExport.ts` and `excelSheets.ts`. A **working** model, not a printout with
formulas painted on: every schedule is driven by its own yellow assumption row,
every closing balance is opening plus movement, every movement is its driver
times the line it depends on, and the balance check computes rather than being
asserted.

**It agrees with the site exactly.** Every valued company's workbook returns the
site's value per share to nine decimal places on both terminal methods; the
worst difference across the 70 models checked by `npm run verify:workbook` is
3.87e-9%, which is floating point in the last digit. Each assumption is seeded
from the model's own year-by-year figure, so it opens agreeing and diverges only
where the reader changes something. That is the whole point.

### Where the workbook does something different

**Reported-year cash flows are derived, not filed.** The site shows the filed
operating cash flow from the statements. The workbook builds the reported years
by differencing successive balance sheets, which `BS 2` names as the alternative
to the checklist's preference and warns has a specific drawback — it obscures
which flows are driving a net change. A note on the sheet says so. This is
`KI-7`; 78 of 97 companies differ by more than 10%, and it moves no valuation,
because the DCF reads forecast years only.

**Three working-capital lines are driven off a different base.** The workbook
drives payables and other current assets off **revenue** where the engine drives
them off **cost of sales**, and drives other non-current liabilities off revenue
where the engine holds them flat. Receivables, inventory, accrued expenses,
deferred tax assets and other assets are driven the same way on both. At default
drivers the two agree exactly, because each driver row is seeded with that
year's own ratio from the model. They part company the moment the reader edits
one. This is `KI-4`.

**Interest is charged on opening balances by default.** Average balances are
circular in Excel: interest changes profit, which changes cash, the revolver
draw and the closing balances, which change interest. The **Circularity switch**
at the top of the model sheet turns average balances on; left at its default of
off, nothing computes circularly and the difference to the answer is small.

Excel's circular-reference detection is structural rather than value-based — it
is built from every cell a formula's text mentions, including inside an `IF()`
branch that never runs — so `IF(switch=1, <circular>, <safe>)` is flagged as
circular whichever way the switch is set. That is the ordinary shape of a
circuit breaker in a real model, and why such models keep iterative calculation
on permanently. The workbook does the same: `excelIterativeCalc.ts` patches the
setting into the serialized file, because exceljs has no way to write it.

This is `Circ 2` followed properly, where the site avoids the loop entirely.

**The forecast rate and the capital intensity are carried, not re-derived.** The
depreciation rate row and the net-PP&E-to-revenue row take the engine's own
constants in forecast years rather than recomputing a ratio per year.
Re-deriving them looked identical until capital spending floored at nil for a
company whose revenue falls, where the base and the charge stop agreeing — Saudi
Aramco, caught by `verify:workbook` at 0.0127%.

**Row numbers on the DCF sheet are positional.** The three-statement sheet
allocates rows through a registry and formulas reference it, which is `FD 2`.
The DCF sheet hard-codes its row numbers, which `FD 2` warns against: inserting
a row there silently breaks the formulas. The DCF sheet's layout is fixed —
unlevered free cash flow in rows 9–16, discounting 19–30, perpetuity 33–37, exit
multiple 40–44, the bridge 47–58.

**The sheets.** Cover, 3-StatementModel, DCFModel, the filed statements,
annexures, ratios, Checks and Sources. The Checks sheet tests that reported
operating income, pretax income and net income tie to the filing and that the
balance sheet balances in every year.

---

## 23. What is not modelled at all

Named here so the absence is a statement rather than an oversight.

- **Segment revenue.** One combined line for every derived company. Segment
  detail is in filing footnotes and is not machine-readable from any free
  source. This is the main quality gap against a hand-built model.
- **Company guidance, consensus estimates, investor presentations.** Nothing is
  cross-checked against an outside reference point, because there is no feed to
  cross-check against. Three conventions rest on this (`IS 4`, `CF 6`,
  `CF 7`).
- **Non-recurring items.** Nothing identifies them, so none are separated out,
  and there is no adjusted net income line.
- **Depreciation vintages and useful lives.** One pool, one rate.
- **Deferred tax liabilities from accelerated tax depreciation**, and **net
  operating loss carryforwards** (`Dep 10`, `Dep 11`). Not modelled.
- **The treasury stock method** for the subject or for peers. The filed diluted
  count is used, with its increment held flat.
- **A revolver capacity limit**, a debt maturity ladder, and per-tranche rates.
- **Precedent transactions.** Licensed vendor data, which the site cannot
  redistribute.
- **Any check that the dashboard renders what the engine produced.** The
  verification harness in `verify/` covers the engine, the derivation and the
  workbook. Nothing stands between the engine's output and the React screens.

---

*Written against `e52cdc6`, 2026-09-22. Defects are in `KNOWN_ISSUES.md`; the
convention-by-convention audit is in `CONVENTIONS_AUDIT.md`; the plan is in
`ROADMAP.md`.*
