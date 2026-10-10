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
  or departs from. It does not record history, which is in the commit messages.
- **Three files, one kind of thing each.** What the model does incorrectly is in
  `KNOWN_ISSUES.md`, and that list is meant to reach zero. What the filing or
  the data source does not publish is in `DATA_CONSTRAINTS.md`, with the bound
  on each and the threshold between warning the reader and refusing the model.
  How the engine works, and why, is here. A deliberate behaviour does not belong
  in the defect list, and a gap in the data is not a defect at all.
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
23. [What the source does not give us](#23-what-the-source-does-not-give-us)
24. [What is verified, and what is not](#24-what-is-verified-and-what-is-not)
25. [What is not modelled at all](#25-what-is-not-modelled-at-all)

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

**Which source, and when the first one has nothing.** A ticker with a dotted
suffix (RELIANCE.NS, BP.L) is a foreign listing and goes straight to the second
source. Everything else is asked of the SEC first — and the SEC's ticker list
carries every registrant, including foreign private issuers that file a 20-F
and ADR shells that file nothing but their registration form, none of which are
in the XBRL company-facts API. ICICI Bank, Rio Tinto and the ADR registered
under CYATY each have a CIK, have submissions, and answer **404** for facts.

That 404 used to be thrown as an error, which took the whole request down with
it: the company could not be loaded from anywhere, and the reader got "could
not retrieve data for that ticker right now" on every attempt (`KI-6`, fixed
2026-09-26). It is now read as what it is — *the SEC has nothing for this one* —
and the request falls through to the second source, which carries **its own**
name, currency evidence, listing and source URL. Nothing is borrowed from the
first attempt, so the currency and listing gates (§3) apply exactly as they do
to any other non-SEC company: all three of those companies load and all three
are refused a valuation, two as depositary receipts and one for an income
statement the source does not report.

A **5xx or a network error still fails**, deliberately: that is the SEC being
unavailable rather than empty, and a transient outage must not quietly change
which source a US filer's figures came from. Where neither source has the
company, the failure names what was tried rather than showing a blank page.

**Why this source** travels with the model as `meta.sourceNote` where the
fallback was used, and is shown in the working on screen and on the workbook's
Sources sheet, so a reader is never left wondering why a US-listed company's
figures are not the SEC's.

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
the terminal value. How much weight actually rests there is measured, disclosed
on every valuation and set out in §13.

**Forecast year-ends come from the date the company's year actually ended.**
The fetcher carries the period end of each reported year — the SEC's `end` on
the fact that anchors the year, Yahoo's `asOfDate` — and the derivation takes
the last reported one and advances it a year at a time, keeping the month and
day. Apple's forecast years end on 27 September, Microsoft's on 30 June,
Walmart's on 31 January. 59 of the 172 fetched companies have a non-calendar
year end, so until 2026-09-23, when every one of them was discounted as though
its year ended on 31 December, their cash flows were discounted over the wrong
period in the same direction every year: correcting it raised the value of the
30 affected valued companies by a median 6.1%, up to 9.5% (Home Depot, Dell,
Walmart).

A 52/53-week filer shifts by a few days each year and nothing in the filing
predicts which, so the same month and day is as close as this gets — days,
against the months it was out by before. A payload fetched before the date was
carried has none, and then the old 31 December assumption stands and
`meta.fiscalYearEndSource` says so.

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

**Every assumption below is clamped, and a clamp that binds now says so.** The
bounds exist because one freak year should not set a five-year forecast, and a
figure the clamp replaced is no longer the company's measurement — so a
provenance sentence that names the measurement beside it states something
untrue. Until 2026-09-28 four of them did: the tax rate read "the last reported
year's effective rate" over a clamped figure for 19 companies, six of them
valued (BP's own 83.3% shown as 50.0%, Vodafone's 96.8% as 50.0%, AMD's −2.5% as
0.0%); the payout ratio read "average payout ratio across the reported years"
over the 0–100% clamp for 13, four valued (Vodafone 675.7%, Gilead 214.4%); the
gross margin read "the last reported year, held flat" over the 35% no-data
fallback for 46; and the capital-spending ratio did the same. Each now appends
what the clamp or the fallback did, in the company's own figures, and the
no-data case says the figure is the model's default rather than the company's.
**No value moved** — the clamps themselves are unchanged, and the sweep of
2026-09-28 shows no company moving a cent. What changed is that the sentence and
the number now agree.

### Revenue

**Reported:** as filed.
**Forecast:** a starting rate that fades to the terminal rate.

The **starting rate** is the **median of each year's growth**, clamped to −10%
and +25%, falling back to 3% where it cannot be measured. The median rather than
the compound rate across the whole period, because a compound rate is two
observations however many years lie between them: one unusual year at either end
sets the entire forecast. TotalEnergies' window opens on the 2022 energy price
spike, so its compound rate was −11.5% and it took the clamp — a permanent
decline read off a single peak. The median is the same protection the
other-operating-costs line already uses against one freak year. It is not
uniformly kinder: BP's median is −10.0% against a compound −7.8%, and Enbridge's
is +21.9% against +6.9%, because the median follows the middle year rather than
the endpoints.

The rate then **fades in a straight line to the terminal growth rate**, reaching
it in the last forecast year, so the year being capitalised already grows at the
rate the perpetuity continues. Holding one rate flat and then capitalising at
2.5% made two assumptions that contradicted each other at the join: a company
modelled as shrinking 10% a year became one growing 2.5% a year in the instant
the forecast ended. The engine reads the terminal rate from `dcf.longTermGrowthRate`
when it builds the path, so moving that slider re-fades the forecast to meet it,
and the revenue-growth slider re-strikes the fade from its new starting rate
rather than shifting every year (§21).

The clamp still exists because a company growing 60% for three years will not do
so for five more, and a shrinking one should not be extrapolated into oblivion.
**A rate at the clamp is not the company's measurement**, it is the furthest this
model will extrapolate, and `provenance.revenueGrowth` now says so and gives the
measured figure beside it. It binds for 11 of the valued companies.

**And the revenue line is checked against the plant that produces it.** Everything
downstream assumes revenue measures the size of the business: growth capital
spending is the change in revenue times the plant carried per unit of it (§7).
Where the filing shows revenue **falling** across the reported years while net
PP&E **rose**, that assumption is contradicted by the company's own balance
sheet — it was visibly building while its revenue fell — and the model refuses
(§16) rather than releasing plant the company is demonstrably buying, which
would raise free cash flow and flatter the value. Five of 69 valued companies on
the 2026-09-23 payloads: Saudi Arabian Oil, TotalEnergies, Equinor, Texas
Instruments and Nestlé. The test has no threshold: it asks only whether the two
moved opposite ways. Only that direction refuses — revenue rising while plant
falls makes the model buy plant the company is shedding, which understates the
value, and a conservative error is warned about rather than refused.

How much of a company's growth was **bought** rather than earned is a data
constraint, not a modelling choice: a goodwill jump says an acquisition
happened, and nothing in the filing says how much revenue it brought. See
`DATA_CONSTRAINTS.md`.
**Convention:** `IS 3` (the growth assumption sits in its own cell and revenue
is calculated off it) — followed; the workbook carries one growth cell per
forecast year, seeded with the faded rate. `IS 6` (the projection method is
chosen from a defined menu and recorded) — followed; the median and the fade are
both in `provenance.revenueGrowth`. `IS 1` (revenue by stream) — **departed
from**: segment detail lives in filing footnotes and is not machine-readable
from any free source, so a derived model runs on one combined revenue line and
the dashboard says so. `IS 4` (sanity-check against an outside reference) —
**not applicable**: there is no consensus or guidance feed. The clamp still
binds for the companies whose measured rate falls outside it, and for those the
first forecast year is the clamp rather than the company; the fade means it no
longer compounds for five years.

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
**Forecast:** its share of **revenue** in the last reported year, held flat.
Where the last reported year reports none, nil, and `provenance.notReported`
says so rather than leaving a silent zero.
**Convention:** `CF 3` (material non-cash items added back and documented) —
followed. The checklist offers SBC over revenue or over operating expense, and
sanctions both; revenue is implemented. It was the operating-expense basis until
2026-09-25, when it moved for two reasons. The workbook wrote this row as a
share of revenue whatever the engine did, which is the `KI-4` pattern (§22), and
the operating-expense basis could not be shown there without rebuilding four
filed-basis cost lines the workbook carries for reported years only. And a
filing that reports no cost lines at all — Wells Fargo, Union Pacific, eight
others in the sweep set — has nil operating expense on the filed basis, so the
old ratio was a division by zero and the charge came out infinite.

The level is unchanged for every company that has both. Each forecast cost line
is a fixed share of revenue, so filed operating costs are a fixed multiple of
revenue, and a ratio measured on either basis and applied on the same basis
gives the same charge: no valued company moved a cent (sweep of 2026-09-25,
79 companies compared, none moved).

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
on (§9).

**Other non-operating income is forecast, not set to nil.** This line is
everything between operating profit and pretax income except interest:
equity-method income from affiliates, investment income, currency. `IS 11`
treats it as its own section to be decided on; `IS 17` says *non-recurring*
items are not projected. Those are two different things, and reading them as one
— forecasting the whole residual at nil — is what made the tax rate and its base
disagree, because the rate is measured on a pretax figure that includes this
line. It is now forecast as a share of revenue: **whichever of the last reported
year's share and the median across the reported years is closer to nil**, in
either direction. The median follows what recurs and the last year is the anchor
every other margin uses, so the smaller of them never projects more of a
non-operating item than the company has shown consistently. It matters both
ways: AbbVie's last reported year carries a charge of 9.1% of revenue against a
4.6% median, and projecting the 9.1% for ever turned its forecast pretax profit
into a permanent loss.
**Convention:** `IS 12` (the sign convention is confirmed against the company's
own figures and carried consistently) — followed by construction: interest
expense is forced negative, and everything else is a residual that must tie.

### Tax

**Reported:** filed tax expense; the effective rate is filed tax over filed
pretax income.
**Forecast:** the **last reported year's** effective rate, clamped to 0–50%,
falling back to 21%.

**The base.** The rate is filed tax over filed pretax income, and filed pretax is
operating profit, *plus interest, plus other non-operating income*. Interest
belongs in that denominator: an unlevered valuation taxes operating profit as
though there were no borrowing, which is what an effective rate measured across
a levered year gives (`DCF 5`). The other non-operating income belongs there
only if the forecast also earns some — and until 2026-09-24 the forecast set it
to nil, so the rate was measured on a base the model then threw away. Alibaba is
the extreme: its other non-operating income is 133% of its operating profit, so
most of the denominator was something the forecast did not have.

Two things could have closed that. Taking the non-operating income **out** of the
denominator needs the tax it bore, which no filing separates in a readable form —
the rate reconciliation that would say so is a narrative note, not a tagged
figure. Putting it **into** the forecast needs only a projection rule, and one
already existed for this kind of residual. So the base is matched by forecasting
the income (§5, other non-operating income) rather than by re-cutting the rate,
and what remains — whether that income was taxed like everything else — is a
**data constraint with a measured bound**, not an approximation: see
`DATA_CONSTRAINTS.md`. It bounds 52 companies below 5%, warns 11 and refuses one.

**Convention:** `IS 6`/`IS 7` — the checklist is explicit that the last actual
effective rate is the one to use. Previously this averaged the first and last
years, which let a one-off charge sit in the forecast for ever (Apple FY2024's
European State-aid charge pushed the rate to 24%).

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

**A line the filing stops tagging is absent, not nil.** The forecast starts at
the last reported balance, so a line the filing does not tag in that year has
nothing to start from. Its amount is inside whichever line the filing does tag —
the reported balance sheet adds up without it — so the forecast carries it as
absent too and the balance sheet omits it on both sides. It used to be grown
anyway: `null * (1 + g)` is nought in JavaScript, so Alphabet, which reported
2,670 of inventory two years before its forecast starts, was forecast to hold
none, and where the *driver* was the missing line the growth rate came out
infinite and the balance sheet unaddable (`KI-17`, fixed 2026-09-25). Recorded
per company in `DATA_CONSTRAINTS.md` as `workingCapitalLineNotTagged`; the bound
is 0.0% for all 13 valued companies that carry it.

**The drivers are declared, not asserted twice.** The engine carries the table
above on the model as `workingCapitalDriversUsed`, and the workbook builds each
schedule — its formula, its basis and its row label — from it. This is not
decoration: the workbook used to name a basis in its own code, said payables and
other current assets were a percentage of revenue where the engine grows them
with cost of sales, and because every driver row is seeded from the engine's own
balances the two agreed at rest and parted on the first edit (`KI-4`, fixed
2026-09-25). A rule stated once cannot drift from its own workbook.

The cost-of-sales lines divide by **cost of sales as filed**, which is the line
the engine grows them with (`cogsGrowth`), not the model-basis line that
excludes D&A and SBC. The two differ by the share D&A and SBC took of cost of
sales, which is constant at rest and not constant once a margin moves.

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

Where this treatment does not hold is a company whose revenue moves with a
commodity price or an acquisition rather than with volume. **How much plant a
change in revenue is worth for such a company is not in its filings**, which is
where that question finally settled on 2026-09-27: it is in
`DATA_CONSTRAINTS.md`, not `KNOWN_ISSUES.md`, and the companies where the
forecast shows it are named.

**Bounding the spend was measured six ways and rejected**, on 2026-09-23: a
floor at the lowest multiple of depreciation the company has filed, a symmetric
bound on the same, a bound on capital spending over revenue, the company's own
least-squares slope of plant against revenue in place of the levels ratio, that
slope capped, and the filed bounds faded to one times depreciation. Each brings
the annual spending closer to what the company files and each puts the asset
base somewhere the company has never been.

**Scaling by the company's own filed elasticity was measured and rejected too**,
on 2026-09-27, and it is the sharpest of the seven because it is the one a
reader would reach for. Shell's revenue fell 30.0% across its reported years
while its plant fell 6.8% — an elasticity of 0.23 — so buy and release plant at
0.23 times the levels ratio. Across the 57 valued companies on this rule, the
number ending outside the capital intensity they have actually carried goes from
**3 to 21**, and not one of the three is fixed: Shell ends at 81.3% of revenue
against its own 52.1%–69.3%, further out than the 70.9% it reaches now. The
elasticity does not separate the three either — 0.23 for Shell, 1.04 for
Unilever, and not measurable for Volvo, whose revenue barely moved — so no
threshold on it divides them from the 54 that pass.

**The test that stands** is the one the bounds were rejected against: does the
forecast end inside the band of capital intensity this company has actually
carried? Under the rule above, 54 of 57 do. The three that do not are each
marginally outside, worth 2.9%, 0.5% and 0.1% of value per share to correct, and
each is disclosed against the model rather than silently left.

### The depreciable base, and a missing opening balance

The base is the solved base, not opening plus half of total spending: where
spending floors at nil those differ, and the rate on screen should be the rate
actually charged.

**A missing opening balance is not nil.** Alphabet's last reported year does not
tag net PP&E under the plain name; treating that as an empty yard charged it
depreciation on half a year's capital spending alone — 3,138 against the 21,136
it filed. The base stays null and the company is refused rather than valued off
an asset base that was never reported.

**And no opening balance means no schedule.** The refusal above stopped the
value; it did not stop the arithmetic. JPMorgan tags net PP&E for 2021 and 2022
and not since, so the forecast opened at nothing, spent its own capital
expenditure, and closed the fifth year holding 9,268 of plant the filing never
reported — a number the workbook then reproduced, differently, by chaining its
own schedule through the gap (`KI-18`, fixed 2026-09-25). The whole forecast
schedule is now absent where the last reported year has no plant: no opening
balance, no spending, no charge, no closing balance, in the model and in the
workbook alike. The derivation records the gap as a missing forecast input, so
the refusal names it.

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

**The minimum cash balance is the least cash the company has operated on,
relative to its own size**: the lowest cash-to-revenue ratio across its reported
years, applied to each forecast year's revenue. It was half the last reported
balance for every derived company until 2026-09-26 — a number with no filing and
no convention behind it, which nonetheless sized every revolver movement in the
model (`KI-9`).

A ratio rather than a level, because the need for working cash grows with the
business and a level does not: a floor set at the lowest balance of the last
five years is a real cushion in year one and a thinning one by year five. The
company's own low-water mark rather than a view about how much cash a business
of this kind ought to hold, because the second is not something a filings-only
site can know. Microsoft's comes out at 6.3% of revenue, Walmart's at 1.3%.

`Debt 10` asks for the size and the basis of the cushion to be documented rather
than left unexplained, and treats the amount as a judgement call rather than a
formula. The basis is now in `provenance.minimumCash`, on the Sources sheet, and
in the workbook's own row label, which names the percentage on the row it drives.
It is an assumption row like any other: a reader who knows of a covenant minimum
can type it in, year by year. The curated Apple file keeps the 100,000 its own
source workbook uses.

**What it changed.** Tighter than the flat half, so the model borrows sooner:
across the 172 modelled companies, 54 draw on the revolver in at least one
forecast year against 39 before, over 242 forecast years against 142. Almost all
of that is in companies the site refuses to value, where cash is a balance-sheet
item rather than a working balance — of the 64 valued companies, the same two
draw as before (Micron and Novartis), over 8 forecast years against 4. With the
circularity switch on, Micron's interest expense over the five forecast years
rises from 3,587 to 5,318. No valuation moved: the revolver reaches neither
unlevered free cash flow nor the equity bridge.

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

**Its denominator is the net income the forecast actually has.** Filed net income
is after non-controlling interests and discontinued operations; the forecast's
net income is pretax less tax and has neither, because nothing in the filing says
what either would be in a future year. Measuring the ratio on filed net income
and applying it to the forecast's was the same mismatch as the tax rate's: 55 of
153 companies differ by more than a point on the two bases and 23 by more than
five, BP by 3,238 points on a year when its filed net income all but vanished.
The denominator is filed pretax income less filed tax, which is exactly what the
line it is applied to contains.
**Convention:** `CF 7` wants dividends projected as shares outstanding times an
assumed dividend per share, not as a percentage of net income. This is a
**departure**, made because no free source gives a forward dividend per share,
and the checklist's own cheat-sheet alternative is the historical payout ratio.
It replaced a linear regression through the payout history, which could trend
the ratio somewhere the company has never been, including above 100% of
earnings.

**Buybacks** are a percentage of an authorised ceiling — *for the curated Apple
file, which is the only model that has one*. The ceiling in forecast years is
the average of the reported ceilings plus the first forecast one, over a fixed
window, counting only the ones that exist. The percentage is the average of what
the company actually spent against its ceiling in the years that report
repurchases. None reported, none forecast.

**For a derived company the machinery cancels, and what is left is an average.**
No free source publishes an authorised repurchase programme, so the derivation
sets the ceiling to the repurchases themselves (`deriveModel.js`,
`authorisedBuybackCeiling.historical`). The engine then computes the percentage
as repurchases over ceiling, which is **exactly 1.0 in every reported year**, and
multiplies it back out. The forecast is therefore the plain average of the
repurchases the company reported, and nothing in it is a judgement about a
ceiling. Both figures are read from the same filed field, one of them negated on
the way in, so the result does not depend on which sign convention the source
uses.

This was described here as a percentage of a ceiling until 2026-09-28, which
dressed an average up as something more considered. It was found while writing
the Assumptions sheet (§22): a sheet that has to state the basis of every figure
is a sheet that has to say what the ceiling *is*, and for a derived company the
answer was "the spend". `provenance.buybacks` now states the average and says
that no ceiling is published.
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

`model.js` section 8. **Two bases, and the line between them is stated.**

**Reported years are the filing's.** The three totals of the company's own cash
flow statement (`operatingCashFlow`, `investingCashFlow`, `financingCashFlow`),
and the change in cash as the movement in the filed cash balance, which is a
filed fact at both ends. Null where the filing does not report them, and null
stays null: a total this model cannot vouch for is shown as not reported, never
as the sum of the pieces it happens to carry. They used to be rebuilt from net
income and balance sheet movements, which differed from the filed figure for
every company in the sweep set (`KI-7`, fixed 2026-09-26; §22 has the measure
and what the workbook shows).

**Forecast years are this model's**, built below — nobody files a forecast.

**The difference between the two bases is carried**, per section, as
`cashFlow.otherOperatingItems` and its investing and financing counterparts: in
a reported year it is what the filed section holds that this model does not
(deferred tax, provisions, other non-cash charges, movements in lines the filing
does not tag), and it is nil in every forecast year. So the reported total is
the filing's and what the model does not carry is visible rather than absorbed,
and `cashFlow.reportedAsFiled` marks which years came from the filing.

**Convention:** `CF 1` (three sections, each with its own subtotal, plus the
change in cash) — followed. `BS 2`, which names deriving the cash flow statement
by differencing successive balance sheets as the alternative with a specific
drawback, is no longer relied on for the reported years.

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

**The valuation date is the last reported balance sheet date. The convention is
mid-year.** Both are choices, both are stated, and both are applied to every
explicit year and to the terminal value alike, which is what `DCF 1` requires.

**Why that date.** The equity bridge subtracts net debt taken from that same
balance sheet (§15). An enterprise value struck at one instant cannot be added
to a balance sheet struck at another, and until 2026-09-24 they were months
apart: the cash flows were discounted from the day the price was fetched while
the debt and cash came from the last filing. The second reason is that a
valuation should not move for reasons unconnected to the company. Discounting
from the fetch date meant the same filings gave a different answer every day,
drifting by roughly the discount rate over a year — Apple's first forecast year
was being discounted over 0.01 years because its filing happened to be eleven
months old. The suite now checks that the same model valued in January, August
and December returns the same figure.

What that buys is honesty about what the number is: a value **as at the last
balance sheet date**, compared with a price from today. The model knows nothing
about what has happened since that filing, and dating the answer today would
claim otherwise. The gap is stated on the page rather than closed by a guess.

**Why mid-year.** `DCF 1` treats the choice as a judgment call and says the
mid-year convention "exists specifically to better approximate cash flows
arriving throughout the year rather than in one year-end lump sum". Two things
decide it here. Cash does arrive through the year. And this model already says
so everywhere else: depreciation is charged on the opening balance plus **half**
the year's additions (§7), and interest on average balances when the circuit
breaker is off (§9). Discounting as though every pound arrived on the last day
of the year, while depreciating as though the plant arrived evenly through it,
would be two answers to one question.

So the discount period for forecast year *k* is *k* − 0.5, measured from the
last reported year-end on a 30/360 basis, which for a company whose year-ends
are a year apart is exactly 0.5, 1.5, 2.5, 3.5, 4.5.

**The terminal value takes the last explicit year's period**, not a whole extra
year, and that is the mid-year convention rather than a shortcut. The perpetuity
formula values a stream arriving at the ends of years N+1, N+2, … as at the end
of year N. Under mid-year that stream arrives half a year earlier each time,
which is worth (1 + WACC)^0.5 more at year N — exactly the half year that
discounting over N − 0.5 gives back. One convention runs through both.

**What it cost.** Measured at `35114b3` on the payloads of 2026-09-23: of the 79
companies valued on both sides, 63 move, **one by more than 5%** (Siemens
−5.8%), median −1.7%, 13 up and 50 down. The direction depends on where the old
fetch date happened to fall in the company's year, which is the artefact being
removed: companies whose year had just ended were being discounted over too
short a period and fall (Micron −4.8%, Accenture −4.4%, Costco −4.4%, Apple
−4.1%), while those whose year-end was still months away were discounted over
too long a period and rise (Microsoft +2.3%, Procter & Gamble +2.4%).

**What still moves with the day.** The cost of equity is weighted on market
capitalisation (§14), so a change in the share price changes the discount rate.
That is `DCF 7` working as intended — the weights are meant to be at market
value — and it is a change in what the market thinks, not an artefact of when
the page was opened.

### Terminal value: perpetuity growth

```
terminal capex    = −(D&A of the last forecast year − that year's amortisation)
normalised FCF    = last year's unlevered CFO
                    − the excluded lines
                    + terminal capex
                    − the amortisation's tax shield
terminal value    = normalised FCF × (1 + g) / (WACC − g)
```

with `g` a flat **2.5%** for every derived company — and the same rate the
explicit forecast fades to, so the last modelled year and the perpetuity beyond
it grow at one rate rather than meeting at a step (§5). One consequence worth
naming: because the terminal rate now shapes the forecast as well as the value
beyond it, the valuation is *more* sensitive to it than before, not less.

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

**It is an assumption, and the site says so.** `CONVENTIONS.md` describes this
method as "an assumed multiple, commonly EBITDA-based", which is exactly what
this is — not a figure read off this company's market. Until 2026-09-26 the
number sat in the derivation with nothing behind it while the football field
described it as "taken from the market" (`KI-19`). It now carries its basis in
`provenance.exitMultiple`, shown beside the value it produces, and the football
field says what it is for a derived company.

**Deriving it from the peer set was measured and rejected.** The market approach
already fetches comparables, so a peer median EV/EBITDA looked derivable. It is
not sound on this data: a median comes back for **36 of the 64 valued
companies** — none for Apple, Alphabet, Amazon, BP, GSK, AstraZeneca, BHP, Sony
or Tencent — and where it does it runs from **7.2× to 455.8×** on two to five
companies one vendor associates, on trailing figures. Applying it moved the
exit-multiple value per share for all 36, by more than 5% for all 36, by a
median **50%**: Tata Consultancy +2,752%, Arista +591%, Micron +371%. The spread
between the two terminal methods would go from a median **12% to 45%**, so the
signal `DCF 12` asks to investigate would be swamped by the noise in a three-company
peer median. Recorded in `DATA_CONSTRAINTS.md`, which also says why it is noted
rather than refused.

**Convention:** `DCF 10` (both methods computed) — followed. `DCF 11` (an
assumed multiple, commonly EBITDA-based) — followed, and now stated as an
assumption rather than presented as an observation.

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

### How much of the value is beyond the forecast

`src/data/terminalReliance.ts`, shown on every valuation and carried in the
workbook at DCF rows 60 to 69.

**The level is arithmetic, not a judgement about the company.** Five discounted
years are a small annuity beside a perpetuity: at an 8% discount rate and 2.5%
perpetual growth, about three quarters of the value of *any* going concern sits
beyond a five-year window. So the panel shows the share **and the benchmark** —
what a company whose cash flow never changes would show at this company's own
discount rate and terminal rate — because the share alone tells a reader nothing
about whether this model is unusual. Measured on 2026-09-27 across the 57 valued
companies: median share **77.3%** against a median benchmark of **74.7%**, a
median excess of **1.8 points**, and **50 of 57 within five points** of their own
benchmark.

**One company sits more than ten points above it, and the panel now says why.**
Micron: 95.8% against a 74.2% benchmark. Its five modelled years spend **86% of
their EBITDA on plant** — against the 72% to 92% of EBITDA it has actually spent
across its reported years — so little of what it earns reaches the discounting
and the perpetuity carries the answer. Its capital intensity ends at 139% of
revenue, inside the 120% to 244% it has carried. Nothing in that is a driver
producing figures a reader would not recognise; it is what a memory manufacturer
building fabs looks like when it is modelled faithfully. So the sentence beside
the share quotes the figure rather than leaving the reader to infer a cause:
*"The 5 modelled years spend 86% of their EBITDA on plant, so little of what they
earn reaches the discounting."* No threshold decides whether to say it — the
number is quoted whenever the company is already flagged.

**An explicit stage worth less than nothing is shown, not refused.** When the
tail was three companies, one of them — Enbridge — had five forecast years whose
present value was negative, so more than the whole value sat beyond them. That
is a real pattern, not an error: a business in a heavy building phase consumes
cash for years and is worth what it produces afterwards. Refusing it would
withhold a defensible valuation over its shape rather than over an input nobody
can supply, which is not the bar the other refusals are held to (§16). It is
disclosed instead, in its own sentence: *"The 5 forecast years are worth less
than nothing on their own: the whole of this value, and more, is what the model
assumes happens after 2030."* No company in the set is in that position today —
Enbridge is refused for a currency its data does not establish — and the
sentence stands ready for the next one.

**The sensitivity is shown as values, not as a margin.** Terminal growth a point
either way and the discount rate half a point either way, each read off the
sensitivity grid the engine already builds so the two can never disagree. Each
end is printed as the value it produces rather than as a plus-or-minus: the
perpetuity formula is not symmetric, so a point off the growth rate and a point
on it move the answer by different amounts, and the two ranges are not additive.
Figures are deliberately coarse — whole percentages for the share, no decimals
on the benchmark — because a terminal value is the least precise thing in a
valuation and printing it finely would say otherwise.

**The forecast stays at five years.** `DCF 2` treats the length as a judgment
call balancing forecast reliability against how much rests on the terminal
value. Stretching the fade to seven years takes the median share to 69.1% and to
ten years 59.6%, but raises the value for 52 of 64 companies — a median 3.2% and
7.9%, up to 53.7% for the growth companies. A smaller terminal share bought by
assuming a company stays above its steady state for longer is not a better
model, so it was rejected.

---

## 14. The cost of capital

`model.js`, `computeWACC`.

```
cost of equity = risk-free rate + beta × market risk premium
WACC           = weight of equity × cost of equity
               + weight of debt × cost of debt × (1 − tax rate)
```

**The risk-free rate is fetched, dated and currency-matched** (since
2026-09-26; five currencies since 2026-09-27, six since 2026-10-10). It is the
**mean yield of the 10-year government bond of the currency the statements are
in, over the year ending at the company's own balance sheet date**, taken from
the institution that publishes it: the US Treasury, the European Central Bank,
Japan's Ministry of Finance, the Bank of England and the Riksbank. Each of those
five is daily and returns 245 to 255 observations for a year's window.

**The rupee is monthly, and the engine knows it is.** No daily Indian series is
both openly licensed and reachable from where this site runs, so INR comes from
the OECD's Main Economic Indicators series republished by FRED
(`INDIRLTLT01STM`), which publishes once a month. Because of that, **how many
observations a window must hold is a property of the source, not a constant**:
30 for a daily publisher, 20 for a weekly one, 9 for a monthly one. The old flat
floor of 30 would have refused every rupee company for ever while reporting it
as a fetch failure. A 31 March balance-sheet date — which is most Indian
companies — gives all twelve months; fewer than nine and the rate is refused
rather than averaged from a stub.

The frequency travels with the rate to the page, so the sentence under a rupee
valuation says "the mean of the monthly ... 12 monthly averages" and names the
lag, rather than claiming daily closes that were never read.
`DATA_CONSTRAINTS.md` carries the measured cost: on the two currencies where
both a daily and an OECD monthly series exist, monthly sampling alone moved the
one-year mean by 0.3bp (USD) and 0.1bp (GBP).

So Apple discounts at 4.33% and Toyota at 1.74%, because those are the rates
their cash flows are in. SAP 2.72%, GSK 4.62%, Volvo 2.48%. A single vendor's
chart endpoint publishes only the US curve, which is what this model read first;
that was a fact about the vendor rather than about the data, and the US rate has
moved onto the Treasury's own feed so that every rate now comes from the body
that sets it.

**An average, not a close.** A single day's close makes every valuation move
with one day's bond market, which is the artefact the discounting convention
removed when the valuation date stopped being the day the page was opened (§13).

**The window ends at the valuation date**, not today, for the same reason: the
last reported balance sheet date is what net debt, the discounting and the
equity bridge are all struck at, so the same filings give the same rate for
ever. Re-fetching the company a year later returns the same window and the same
average.

**The ten-year, not the thirty.** `^TYX` is published too and a perpetuity's
natural match is the longest available, but the rate is added to a market risk
premium, and an equity risk premium is quoted against the ten-year benchmark by
convention. Pairing a thirty-year yield with a premium measured against the ten
would be the inconsistency the horizon test is about.

**Is the horizon consistent?** Partly, and here is where it is not. `DCF 9` asks
that the risk-free rate, the beta lookback and the market risk premium come from
one horizon. The rate now has a stated tenor (ten years) and a stated window
(the year to the valuation date). The market risk premium is a flat 4.23% quoted
against a ten-year benchmark, so the two agree by convention rather than by
measurement. **Beta has no window at all** for a derived company: it is a flat
asset beta of 1.0, not measured over any period. So the horizon is consistent
between two of the three terms and undefined for the third, and `DCF 9` is still
not demonstrable — for a different and smaller reason than before.

**A currency without a yield is still refused, not approximated.** Six
publishers are reached; four currencies are not. A company reporting in won,
renminbi, Taiwan dollars or kroner has no risk-free rate and is refused with
`riskFreeRateUnavailable` rather than discounted at another country's rate —
Samsung, Tencent, Alibaba, TSMC, Novo Nordisk. `DATA_CONSTRAINTS.md` sets out
what was tried for each.

**A fetch that fails is absent, not 4.5%.** The rate is null, the reason is
carried, and the company is refused. A rate this important does not quietly
become a constant.

**What it moved, for a dollar reporter.** Measured on the same payloads with the
rate forced back to 4.5%: the cost of equity falls from a median 8.92% to 8.71%;
all 46 valued companies move, **none by more than 5%**; the perpetuity value per
share moves a median **+3.5%** (45 up, 1 down) and the exit-multiple value
**+0.8%**, smaller because only the discounting changes and not the terminal
figure.

**What it moved for everyone else is much larger**, because those companies had
been carrying a foreign country's rate. Against what they showed at the flat
4.5%, the eleven restored companies move: Toyota's cost of equity 12.32% to
9.60% and its value per share **+96.8%**, Sony **+75.2%**, Siemens +57.8%, Volvo
+56.2%, Unilever +41.8%, LVMH +40.6%, ASML +38.1%, SAP +37.6%, Inditex +36.2%,
Vodafone +34.2%. GSK moves **−1.6%**, because the UK ten-year averaged 4.62%,
slightly above the 4.5% it replaced — the one company of the eleven to move less
than 5%, and the one whose own rate was nearest the number the model used to
assume.

A **market risk premium** is not published as a fact by anyone; nor is a
perpetual growth rate. Those two are in `DATA_CONSTRAINTS.md`, shown as
assumptions with their own controls and their own sensitivity grid.

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

### A cost of debt with no debt behind it

A company that owes nothing has **no** cost of debt, and no is not zero. The
average of an empty list is nought over nought, which the sum helper read back
as a clean `0.0%` and the screen showed as the rate Arista and Palantir borrow
at. It is null instead, and the weighted average leaves it out — the same
arithmetic, since the debt weight is nil, and an honest blank on the screen. A
company that *does* owe and reports no interest is a different case, handled as
a data constraint (§23).

### The share-count tolerance, and where it comes from

A listing is refused as `shareCountMismatch` when its shares outstanding and its
filing's diluted count differ by more than **1.5×** either way. The band has to
separate two things: the ordinary difference between a spot count and a
weighted-average diluted count for a fiscal year, and a depositary receipt,
whose smallest real ratio is 2:1 or 1:2.

Measured on the sweep set (2026-09-26): **92 listings report both counts, and
every one lies between 0.91 and 1.06** — 5th percentile 0.92, 95th 1.02, the
furthest from parity being Toyota's New York line at 0.909. So the ordinary
difference runs to about a tenth and the thing the band must catch is a
doubling. 1.5 sits between them, near the geometric midpoint of 1.1 and 2.0, and
nothing observed comes within a third of it from either side.

### Beta

For a derived company the carried beta is **1.0 and it is an asset beta** — the
risk of the business before borrowing. It is relevered onto this company's own
capital structure before the cost of equity is taken from it, using the Hamada
relation:

```
equity beta = asset beta × (1 + (1 − tax rate) × debt / equity)
```

**The industry route is not taken, and now says so.** A curated file may carry
comparables, delever each one's equity beta and average them. A derived company
carries none, and the average of an empty list is nought over nought: both the
industry delevered beta and the beta relevered from it came out as not-a-number
on every company in the sweep set, beside the cost of capital they are shown
with. They are null where there is no industry average to describe. The beta the
model actually uses is the asset beta above; neither figure ever entered it.

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
| 6 | `filingMissingValuationInput` | cost of sales or net PP&E missing **in the last reported year**, which is where the forecast starts; cost of sales or capital expenditure never reported; or fewer than two years of net PP&E |
| 7 | `implausibleDepreciationRate` | no asset base in the last reported year; no measurable rate; a rate at or below zero; or a rate that depreciates the balance past nothing inside the forecast |
| 8 | `revenueDoesNotMeasureTheBusiness` | revenue fell across the reported years while the net PP&E that produces it rose, so the assumption the forecast rests on is contradicted by the filing (§5) |
| 9 | `dataConstraintTooLarge` | a figure the source never publishes whose absence could move the value per share by more than 25% (§23) |
| 9a | `riskFreeRateUnavailable` | no government bond yield is published for the currency the statements are in, so the cost of equity has no first term (§14) |
| 10 | `financialSector` | SIC 6000–6799, or a sector matching financial / bank / insurance / capital market / asset management / NBFC |
| 11 | `negativeOperatingProfit` | operating profit at or below zero in any forecast year |
| 12 | `terminalGrowthExceedsWACC` | terminal growth at or above the cost of capital |
| 13 | `negativeTerminalCashFlow` | normalised terminal cash flow at or below zero |
| 14 | *(no code)* | value per share not a positive finite number, or WACC not above terminal growth |

Codes 1–5 are **integrity refusals**: no valuation of any kind is shown, not the
DCF, not the market or asset approach, not residual income, not the reverse DCF.
The rest refuse the DCF alone.

**Code 1 used to answer for code 6.** A filed line the company stops reporting
was carried into the arithmetic, where null is nought and division by it is
infinity, and the not-a-number reached the forecast balance sheet. So 45
companies — every large bank in the sweep set among them — were told their
balance sheet did not add up, when what had happened was that their filing does
not tag a line this forecast is built from. With absence kept as absence
(§6, §7), those 45 now refuse at 3, 6 or 4 instead, naming the line: 34 for an
operating income the filing does not report, 10 for a forecast input, one for a
currency that cannot be established. **No company's status changed** — all 45
were refused before and are refused now — and no valued company moved a cent.

A bank is refused by 10 and valued by residual income instead (§17), which is
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

Five of them **shift the model's own path** rather than replacing it with a
flat number, because a hand-built model's path is a judgement worth keeping:

- **Revenue growth** shifts every segment's growth path by the same delta.
- **Operating margin** shifts the gross margin path, by exactly what the slider
  says. Gross margin less R&D and SG&A is the operating margin and neither of
  those is changing, so a point on one is a point on the other.

  Until 2026-09-28 the shift was divided by 1 + the SBC share, which **was**
  right and had been made wrong by a change somewhere else. SBC was once a share
  of operating costs, so a point on gross margin trimmed the SBC charge too and
  operating profit moved by d × (1 + share); the division cancelled that. When
  SBC moved to a share of revenue on 2026-09-25 (§5) — which gross margin does
  not touch — the division stopped cancelling anything and started subtracting.
  Measured across the 56 valued companies: a slider asking for one point
  delivered a median **0.9876**, and **0.8674 on Palantir**, 0.8941 on Broadcom,
  0.9077 on Meta — the shortfall being exactly the SBC share of revenue. Thirty
  companies were off by more than a hundredth of a point.

  Removing it moves no published figure (the model at rest is identical to nine
  decimal places) and changes a valuation only for a reader who has moved that
  slider: **44 of 56 move, none by more than 1%**, median 0.06%, worst AMD 0.4%
  on a point either way. The qualitative factors reach this driver too, capped
  at two points (§21 below), so the largest effect anything can have through it
  is about double that.

  It is worth naming why nothing caught it for three days: at rest every driver
  reproduces the model exactly, and the check added in `48c95b6` nudges each
  driver and asserts only the **direction** it moves the value. Under-moving by
  1.4% is the right direction. The suite still does not assert the **size** of a
  driver's response, which is what would have caught this.
- **Capital spending** scales the whole capex line by the ratio of where the
  slider sits to where it started, leaving the projection method alone. A model
  whose capex is a rising line stays a rising line.
- **Research spending** and **selling and admin costs** shift their margin paths
  by the same delta. These two replaced the path until 2026-09-27 and had exactly
  the fault the other three were written to avoid: Apple's file forecasts R&D at
  10% of revenue in the first forecast year and 13% after, and because a slider's
  default is the first forecast year, any nudge flattened the other four back down
  to it. Raising R&D by 0.4 of a point **cut** the R&D bill in years two to five,
  raised operating profit and raised the value from $141.98 to $154.80 a share.
  A shift also disposes of a basis problem the old handler solved by hand: these
  two sliders read margins that exclude D&A and SBC while the assumptions they
  write are on the filed basis, and since the embedded share depends only on
  reported history, a point on one basis is a point on the other and the add-back
  cancels out of a difference.

Replacing the path instead was measurably wrong: Apple's file forecasts decaying
growth and a margin falling from 28.9% to 24.4%, and marking its competitive
position a *weakness* used to **raise** the value, because flattening four years
of margin back up swamped the half point taken off.

**Both properties are now checked rather than assumed** (`verify/scenarios.mts`,
"a driver moves the value the way it reads"). Twelve drivers are set back to their
own defaults, which must reproduce the untouched model to the last decimal the
engine carries, and nudged a point each way, where the value must move in the
direction the driver's label implies. Nothing caught the R&D fault because at rest
every driver reproduces the model exactly, and that was all anything tested. A
nudge that pushes the engine into a refusal it is right to make — a discount rate
cut below the terminal growth rate — is named and not counted. Depreciation as a
share of assets and the dividend payout are left out because their direction is
genuinely ambiguous, not because they pass.

Beta, the risk-free rate and the market risk premium are adjustable directly,
which is more honest than dragging the finished WACC: the reader can watch the
figure they moved flow through the CAPM line. Setting any of them clears a WACC
override that would otherwise win.

### The reader's judgement, and what it may move

`qualitativeFactors.ts`. A model reads accounts; it cannot read a management team,
a regulator or a competitor. **Twenty-three questions** — ten on the business,
five on the long run, eight on risk — each take a verdict of *helps*, *hurts* or
nothing, and each moves the assumption it belongs in rather than the finished
answer. Nine drivers are reachable this way: sales growth, operating margin, the
tax rate, capital spending, research spending, selling and admin costs, the
discount rate, growth after year five, and the exit multiple.

**Every driver has a ceiling on the total a set of verdicts may move it.** With
twenty-three questions the ceilings bind, which they did not with ten: somebody
marking every question against a company would move the discount rate 2.10 points
and terminal growth 1.05, and the caps hold those at 2.0 and 1.0. Operating margin
reaches exactly its cap of 2.0; sales growth and capital spending stay inside
theirs at 1.80 and 0.80. A reader who marks twenty-three questions against a
company is expressing a general gloom, and a discount rate swung by an
accumulation of impressions is an accident rather than a judgement. **Before a
factor is added, the worst case for every driver it touches is recomputed and
recorded in the file's own comment.**

The verdicts are always applied to the model's **own defaults**, never to wherever
the sliders happen to sit, so the same view applied twice is applied once. Both
screens show what the answers would move before anything is applied, in the
driver's own unit: the exit multiple is quoted in turns of EBITDA rather than in
per cent, which both screens hard-coded until a factor first reached it.

---

## 22. The workbook, and where it differs

`excelExport.ts` and `excelSheets.ts`. A **working** model, not a printout with
formulas painted on: every schedule is driven by its own yellow assumption row,
every closing balance is opening plus movement, every movement is its driver
times the line it depends on, and the balance check computes rather than being
asserted.

**It agrees with the site exactly, as it opens.** Every valued company's workbook
returns the site's value per share to nine decimal places on both terminal
methods; the worst difference across the 70 models checked by
`npm run verify:workbook` is 3.87e-9%, which is floating point in the last digit.
Each assumption is seeded from the model's own year-by-year figure, so it opens
agreeing and diverges only where the reader changes something. That is the whole
point.

**And it agrees under an edit, which is the claim that matters**, because the
workbook is only being used once someone has started editing it. Thirteen lines
are checked after a revenue-growth and a margin edit (`npm run verify`,
"workbook against engine, after an edit"), and two edits that used to part from
the engine no longer do:

- **The tax rate.** The cost of capital block carried the beta already relevered
  and the cost of debt already tax-effected, as typed constants, so a tax edit
  moved the engine's discount rate and left the workbook's alone — 18 of 56
  valued companies parting by more than 1%, three by more than 5%, Vodafone by
  12.2%. The sheet now carries the two figures the engine starts from, the
  **asset** beta and the cost of debt **before** tax, and reads the tax rate off
  the model sheet's last forecast year, which is the year `computeWACC` uses. The
  weights are formulas over the same market capitalisation the bridge uses, so a
  share-price edit moves them too (`KI-20`).
- **The terminal growth rate.** The engine reads it when it builds the forecast
  growth path, so moving it re-fades every forecast year; the workbook held five
  seeded rates and moved only the terminal value — 51 of 56 parting by more than
  1%, AbbVie by 3.7%. The first forecast year is now the input and every later
  year interpolates between it and the terminal rate on the DCF sheet, which is
  the fade written out as a rule. Only where the engine says it faded, and only
  with one revenue line to fade: a multi-segment model keeps its seeded rates,
  which `revenueGrowthRuleUsed` declares (`KI-21`).

**A sweep for the same pattern found two more and fixed both.** The cash cushion
was five typed amounts where the engine applies the company's own lowest
cash-to-revenue ratio to each forecast year's revenue, so the floor stayed put
while the revenue under it moved; every forecast year after the first now reads
that share off its own year's revenue.

And the **cost of debt before tax** was one constant where `computeWACC` averages
the debt schedule's own all-in rate across the last reported year and every
forecast year — so editing the interest rate on debt moved interest, profit and
cash and left the rate that discounts them alone. Measured by scaling that
interest by half again on both sides: **36 of 56 valued companies parted by more
than 1%, median 1.67%, Vodafone by 33.8%**. The row is now that average,
written over the schedule's own rate rows, and none of the 56 parts at all.

**It names the years rather than averaging a range, and that was worth measuring
first.** The engine skips a year whose rate it could not measure; the workbook
seeds such a year at 4.5% on the rate rows, which is indistinguishable from a
company that really pays 4.5%, so a plain `AVERAGE` over the columns would
quietly fold it in. The generator knows which years the engine used, so the
formula names those columns. In the event it never bites: of the 56, **two have
an absent year and both owe nothing at all**, so the debt weight is nil and the
cost of debt cannot reach their answer — the largest WACC error a plain average
would have caused is 0.000000000 points. The honest reason to name the columns
anyway is the company this will apply to after the next refetch.

### Where the workbook does something different

**Reported-year cash flows are the filing's, since 2026-09-26.** They used to be
rebuilt: net income, D&A, stock compensation and the movements in the balance
sheet lines this model carries — the indirect method with most of its lines
missing, which `BS 2` names as the alternative to the checklist's preference and
warns obscures which flows drive a net change. It differed from the filed figure
for all 169 companies in the sweep set, by more than 10% for 127 and by a median
24.7%: Morgan Stanley's rebuild came to 30,134 against 1,086 filed, Royal Bank
of Canada's to −72,426 against 55,220, Toyota's to 462,613 against 5,472,920
(`KI-7`). It moved no valuation — the DCF reads forecast years only — but a
column headed with a year the company has already reported is meant to be what
the company reported.

Now, in both the workbook and on the screen (§5 has the engine's side):

- **Cash from operations** in a reported year is the filed figure, and the
  indirect build-up stays beneath it with the difference on its own line —
  *other items in the filed statement, not carried by this model*: deferred tax,
  provisions, other non-cash charges, and movements in lines the filing does not
  tag. It is a median 24.7% of the filed figure and more than 25% of it for 84
  of the 169. Keeping the build-up is the point of a working model: it is how a
  reader sees the forecast's mechanics against the company's own history. Naming
  the difference rather than absorbing it is what makes the total the filing's.
- **Investing and financing** show the filed total where the data carries it and
  **nothing** where it does not. They are not rebuilt from the lines this model
  holds: capital expenditure is not investing, and a company that bought a
  business or a portfolio of securities moved cash this model never sees. Apple
  filed +15,195 of investing cash flow in FY2025 against capital expenditure of
  12,715. The two totals are fetched from `NetCashProvidedByUsedIn…Activities`
  as of this commit, so a payload fetched before it shows them blank.
- **The net change in cash** in a reported year is the movement in the filed
  cash balance, which is a filed fact at both ends.
- **The basis change is stated** rather than left to be inferred: a note under
  the statement in the workbook, and a subtitle on the screen's schedule.

**Every driver row is the engine's rule, written out.** A row that asserts a
rule of its own is the defect `KI-4` was: each assumption is seeded with the
model's own figure for that year, so an asserted rule agrees to the cent at rest
and only parts when the reader edits something — which is exactly when the
workbook is being used. Three rules were being asserted, and all three now come
from the model:

- the **working capital** bases, from `workingCapitalDriversUsed` (§6). The
  workbook had payables and other current assets on revenue where the engine
  grows them with cost of sales, and other non-current liabilities on revenue
  where the engine holds them flat;
- the **capital spending** rule, from `capexMethodUsed`. The workbook wrote
  capital spending as a percentage of revenue whatever the engine did, including
  for the curated Apple file, which compounds it at a growth rate (§7);
- **stock compensation**, which the workbook wrote as a share of revenue while
  the engine took a share of operating expense. The engine moved to revenue
  (§5); both are sanctioned, and only one can be shown here.

The row labels follow, because they are built from the same declaration: the
model sheet and the annexures read one registry of rows and the names given to
them, rather than each naming the line again.

What that was worth, measured on 170 companies by editing the workbook and the
engine the same way and comparing thirteen lines in the last forecast year
(`npm run verify`'s "workbook against engine, after an edit"): before the fix,
**170 of 170 parted after three points on revenue growth** and 147 after two
points off the gross margin, the worst on the curated Apple file being capital
spending 15.1% apart and value per share 1.5% apart. After it, none — save one
refused company whose reported PP&E series has a gap (`KI-18`).

**A refused company's workbook refuses too.** The site declines to value some
companies and says why; the workbook built the whole discounted cash flow
anyway, so the reader who pressed Download got a value per share for a company
the page had just told them could not be valued, with nothing in the file to
say so. Twelve cells carried one. Found by the dashboard check on 2026-09-26
and fixed with it: where the valuation is refused, the DCF sheet is replaced by
the engine's own reason and the cover states it, while the three-statement
model, the filed statements and the annexures stay — they are built from what
the company reported, which the refusal does not touch. The sheet is built and
then discarded rather than blanked cell by cell, because a blanked schedule
still carries the formulas that made it, and one typed assumption would bring
the value back.

**The cost-line drivers carry their sign.** R&D and SG&A as a percentage of
revenue used to be seeded with the size of the line and written as a charge.
Where a filing reports no cost lines at all the engine moves the whole D&A and
SBC charge out of SG&A, which leaves that line **positive**, and the workbook
then charged it twice: operating profit 60% below the engine's on Union Pacific,
54% on Wells Fargo. Both rows now take the signed figure, as other operating
costs already did.

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

**Row numbers on the DCF sheet come from one map.** The three-statement sheet
allocates rows through a registry and formulas reference it, which is `FD 2`.
The DCF sheet used to hard-code its numbers into sixty-odd formulas, which
`FD 2` warns against for the obvious reason, and on 2026-09-28 the warning came
true: the cost of capital needed two more rows, and four hard-coded numbers in
`verify/workbook-vs-site.mts` plus a duplicate layout in the Assumptions sheet
all pointed at the wrong lines. Three of the generator's own calls were
multi-line and escaped the renumbering, so the discount period landed on the
weight-of-debt row and the normalised cash flow on the terminal growth rate —
caught by the suite, which recomputes value per share from the sheet's own cells
and read $42.22 against $141.98.

So the layout is now a single `DR` map in `excelExport.ts`, derived from the band
positions, and every formula, the Assumptions sheet and the verification harness
read it — the harness by finding each row it needs **by its label**, which moves
with the row. The bands are unlevered free cash flow, discounting, perpetuity
growth, exit multiple, the bridge, and what rests on the terminal value, each
with a blank row above it.

**The sheets.** Cover, Assumptions, 3-StatementModel, DCFModel, the filed
statements, annexures, ratios, Checks and Sources. The Checks sheet tests that
reported operating income, pretax income and net income tie to the filing and
that the balance sheet balances in every year.

### The Assumptions sheet

`excelSheets.ts`, `buildAssumptionsSheet`. Every assumption the forecast rests
on, on one sheet, in the order the model builds them: revenue growth and its
fade, each operating margin, the tax rate, capital spending and its split,
depreciation, the amortisation run-off, all eight working-capital lines, the
cost of debt, the PIK and revolver rates, the return on cash, the cash cushion,
the payout ratio, buybacks, issuance, the cost of equity and each of its parts,
the weights, the terminal growth rate, the exit multiple, the bridge and the
share count. A reviewer reads one sheet instead of hunting yellow cells across
ten tabs.

**Two rules hold it together, and both are rules this file has had to learn
twice.**

- **Every value is a link, never a copy.** A pasted figure is right on the day
  it is written and wrong the moment a reader edits the assumption it claims to
  describe — which is exactly when the sheet is being read. Each figure points
  at the cell it comes from, on the model sheet or the DCF sheet, so the sheet
  cannot go stale or disagree with the model beside it. Two columns per row, the
  first and last forecast year, so an assumption held flat reads the same in
  both and the revenue-growth fade shows where it starts and where it arrives.
- **Every basis is the engine's own, never the sheet's.** The basis text is read
  from `provenance`, from `workingCapitalDriversUsed`, from `capexMethodUsed`
  and from `amortisationAnchor` — the same declarations §6, §7 and §8 describe.
  This is `KI-4` applied to prose: a sheet that writes its own account of a rule
  can describe a rule the engine does not use, and nothing would catch it,
  because the account is not arithmetic and nothing recomputes it.

**Where the engine states no basis, the sheet says NOT RECORDED** and names what
the cell was seeded from, rather than composing a plausible sentence from what
the figures appear to show. Building the sheet found three figures in that
position and closed two of them: stock compensation and buybacks now carry
`provenance.stockCompensation` and `provenance.buybacks`, and writing the second
is what turned up the ceiling that was really a spend (§10). A derived company
should now show no NOT RECORDED at all. The curated Apple file shows nothing but,
because a hand-built model carries no provenance — which is true of it, and is
the honest thing for the sheet to say.

**The interest rate on the revolver is the workbook's own assumption**, and the
one figure in the file that has no counterpart on the site. The engine charges no
revolver interest — its circuit breaker is on (§9) — so there is no rate to carry
across, and a revolver that draws needs one here. The row is seeded at the all-in
rate on term debt, on the reasoning that a revolving facility from the same
lenders to the same borrower is priced near its term debt. Nothing in a filing
establishes that, and the sheet says so on the row. **No valuation rests on it:**
unlevered free cash flow starts from operating profit, so revolver interest
reaches the balance sheet and the cash schedule and never the value per share.
It is recorded here rather than in `KNOWN_ISSUES.md` because it is an assumption
with a stated basis, not a figure whose basis is missing.

**Two of the values it links to do not behave in the file the way they do on the
site**, and the sheet says so on the row rather than leaving the reader to find
out: the discount rate does not move when the tax rate does (`KI-20`), and the
terminal growth rate does not re-fade the forecast (`KI-21`). Both are recorded
in `KNOWN_ISSUES.md` with their measurements.

**The two rightmost columns are headed and empty.** They belong to the judgement
layer (`ROADMAP.md` section 2): whether a value is still the default or the
reader's own, and the reason the reader gave. Reserving the room now means
adding them later is a change to two columns rather than a relayout.

---

## 22a. The standard chart of accounts

**Every line of the 3-Statement sheet sits on the same row in every workbook
this site produces.** `$B$26` is revenue for Apple, for Toyota and for Reliance
alike. A firm can write a macro once and run it against every model.

### Why this had to be built rather than observed

Measured across 58 companies before it was: **61 of the model sheet's lines sat
at a different row in a different workbook**, and the layouts fell into five
groups where the most common was shared by only 20 of the 58. Two things caused
it, and neither was a missing line — all 101 lines were present in all 58:

1. **A block of "Not reported:" notes as tall as the number of lines a company
   happened to be missing** — nothing for Apple, three rows for Toyota.
   Everything below moved with it. It now reserves **one row for each of the
   five lines that can be unreported** (`NOT_REPORTED_FIELDS` in
   `deriveModel.js`), blank where the company reports it.
2. **Three rows emitted only when the model splits capital spending** into
   replacement and growth. Worse than a shift: capital expenditure itself sat
   on a *different row* in the two cases, so a macro written against a split
   model would have read depreciation out of a combined one. All three rows are
   now always present, and the two that a combined model does not use say so in
   their own row.

The second was invisible to the payload set — all 58 fetched companies split
their capital spending. It was the **curated Apple model** that exposed it, and
only once the contract below was being enforced. A measurement across real
companies alone would have shipped the bug.

### How the promise is kept

The schema is `MODEL_SHEET_ROWS` in `src/data/excelExport.ts`, frozen, with
`MODEL_SHEET_ROW_LABELS` naming each row. Every row registers through `line`,
`calc`, `driver`, `bopRow` or `asFiled`, and each of those **checks the row it
just took against the schema and throws if it does not match**. A workbook whose
rows have moved cannot be downloaded — the failure is at generation, not merely
in a test somebody might not run. A line with no entry in the schema throws too,
naming itself, so a new line cannot be added without being published here.

`verify:workbook` then re-checks every contracted row in every workbook it
builds, comparing the *name* on the row as well as the number: a line could keep
its row and quietly become a different line, and a macro reading `$B$26` would
never know. Digits are normalised before comparing, because a few rows carry a
figure of the company's own ("Minimum cash balance — 6.0% of revenue"), and the
handful of rows that name the *rule* the engine used carry every wording they
are allowed.

### What happens to a figure the schema has no row for

Nothing is dropped, and nothing silently lands somewhere it does not belong.
The engine maps a filing onto a fixed set of fields; a cost the filing reports
that is not one of the named lines falls into **other operating costs**
(`otherOpex`, row 36), which is defined as operating income less the lines the
filing names, so operating profit still ties to the filing. That line is where
unnamed costs go, by construction, and §9 sets out the rule. What cannot happen
is a *new workbook row* appearing for it: `claim()` throws on any key the schema
does not publish, so adding a line is a deliberate edit to this table and to
`MODEL_SHEET_ROWS_VERSION`, not something that happens to one company's file.

### A company with sparse filings

Toyota reports no R&D, no stock compensation and no share repurchases. Its
workbook is the same shape as Apple's, which reports all three:

- Row 32 is `Research & development` in both. Toyota's reported-year cells are
  **blank** — a blank is a figure the filing does not report, not a nil — and
  the Income Statement annexure renders those cells as "not reported".
- Rows 83–87 are the five not-reported slots. Toyota fills three of them and
  leaves two blank; Apple leaves all five blank.
- `Receivables as % of revenue` is row 91 in both, where before this it was
  row 86 for Apple and row 89 for Toyota.

### The contract, version 1

138 rows. Bump `MODEL_SHEET_ROWS_VERSION` and this table together.

| Row | Key | Line |
|---|---|---|
| **9** | `circBreaker` | *(no label of its own)* |
| **26** | `rev` | Revenue |
| **27** | `revGrowth` | Revenue growth |
| **28** | `gm` | Gross margin before D&A and SBC |
| **29** | `cogs` | Cost of sales, excluding D&A and SBC |
| **30** | `gp` | Gross profit before D&A and SBC |
| **31** | `rndPct` | Research & development, % of revenue |
| **32** | `rnd` | Research & development, excluding D&A and SBC |
| **33** | `sgaPct` | Selling, general & administrative, % of revenue |
| **34** | `sga` | Selling, general & administrative, excluding D&A and SBC |
| **35** | `otherPct` | Other operating costs, % of revenue |
| **36** | `otherOpex` | Other operating costs, excluding D&A and SBC: operating income as filed less the li… |
| **37** | `daCost` | Less: depreciation & amortization |
| **38** | `sbcCost` | Less: stock based compensation |
| **39** | `ebit` | Operating profit (EBIT) |
| **40** | `cashRate` | Return earned on cash |
| **41** | `intInc` | Interest income |
| **42** | `debtRate` | Cash interest rate on debt |
| **43** | `pikRate` | PIK interest rate on debt |
| **44** | `revRate` | Interest rate on revolver |
| **45** | `intExp` | Interest expense |
| **46** | `otherIncPct` | Other income / (expense), % of revenue |
| **47** | `other` | Other income / (expense), net |
| **48** | `pbt` | Pretax profit |
| **49** | `taxRate` | Tax rate |
| **50** | `tax` | Taxes |
| **51** | `afterTax` | Items after tax: non-controlling interests, discontinued operations |
| **52** | `ni` | Net income |
| **54** | `sbcPct` | Stock based compensation, % of revenue |
| **55** | `sbc` | Stock based compensation |
| **56** | `da` | Depreciation & amortization |
| **57** | `ebitda` | EBITDA |
| **60** | `cogsFiled` | Cost of sales, as filed |
| **61** | `rndFiled` | Research & development, as filed |
| **62** | `sgaFiled` | Selling, general & administrative, as filed |
| **63** | `otherFiled` | Other operating costs: operating income as filed less the lines above |
| **64** | `pretaxFiled` | Pretax income, as filed |
| **65** | `niFiled` | Net income, as filed |
| **66** | `cogsEmbedded` | D&A and SBC in cost of sales, % of revenue (last reported year) |
| **67** | `cogsFiledBasis` | Cost of sales on the filed basis, D&A and SBC included |
| **91** | `arPct` | Receivables as % of revenue |
| **92** | `arBop` | Beginning of period |
| **93** | `arChg` | Increase / (decrease) |
| **94** | `arEnd` | End of period |
| **97** | `invPct` | Inventory as % of cost of sales, as filed |
| **98** | `invBop` | Beginning of period |
| **99** | `invChg` | Increase / (decrease) |
| **100** | `invEnd` | End of period |
| **103** | `apPct` | Payables as % of revenue  /  Payables as % of cost of sales, as filed |
| **104** | `apBop` | Beginning of period |
| **105** | `apChg` | Increase / (decrease) |
| **106** | `apEnd` | End of period |
| **109** | `accPct` | Accrued expenses as % of revenue |
| **110** | `accBop` | Beginning of period |
| **111** | `accChg` | Increase / (decrease) |
| **112** | `accEnd` | End of period |
| **115** | `ocaPct` | Other current assets as % of cost of sales, as filed |
| **116** | `ocaBop` | Beginning of period |
| **117** | `ocaChg` | Increase / (decrease) |
| **118** | `ocaEnd` | End of period |
| **121** | `dtaPct` | Deferred tax assets as % of revenue |
| **122** | `dtaBop` | Beginning of period |
| **123** | `dtaChg` | Increase / (decrease) |
| **124** | `dtaEnd` | End of period |
| **127** | `oaMove` | Additions / (disposals), excluding amortisation of intangibles |
| **128** | `oaBop` | Beginning of period |
| **129** | `oaChg` | Increase / (decrease) |
| **130** | `oaEnd` | End of period |
| **133** | `onclMove` | Other non-current liabilities: additions / (disposals) |
| **134** | `onclBop` | Beginning of period |
| **135** | `onclChg` | Increase / (decrease) |
| **136** | `onclEnd` | End of period |
| **139** | `capexPct` | Growth in capital expenditure, year on year  /  Capital expenditure as % of revenue |
| **140** | `depPct` | Depreciation as % of the assets in service |
| **141** | `ppeIntensity` | Net PP&E as % of revenue |
| **142** | `ppeBop` | Beginning of period |
| **143** | `ppeGrowthCapex` | Plus: capital expenditures to add plant  /  Plus: capital expenditures to add plant… |
| **144** | `ppeDep` | Less: depreciation |
| **145** | `ppeCapex` | Plus: capital expenditures  /  Plus: capital expenditures, replacement plus growth |
| **146** | `ppeOther` | Plus: other movements in the balance (disposals, acquisitions, leases, currency) |
| **147** | `ppeEnd` | End of period |
| **150** | `amortAnnual` | Annual amortisation of intangibles, anchored to the last reported year |
| **151** | `intangEnd` | Intangible assets excluding goodwill, end of period |
| **152** | `amort` | Amortisation of intangibles |
| **162** | `debtBorrow` | Additional borrowing / (pay down) |
| **163** | `debtPik` | PIK interest accrued to the balance |
| **164** | `debtBop` | Beginning of period |
| **165** | `debtEnd` | End of period |
| **168** | `minCash` | Minimum cash balance |
| **169** | `revBop` | Revolver, beginning of period |
| **170** | `revDraw` | Revolver draw / (repayment) |
| **171** | `revEnd` | Revolver, end of period |
| **184** | `csIssue` | New share issuances |
| **185** | `csBop` | Beginning of period |
| **186** | `csEnd` | End of period |
| **189** | `payout` | Dividend payout ratio |
| **190** | `reBop` | Beginning of period |
| **191** | `reDiv` | Less: common dividends |
| **192** | `reEnd` | End of period |
| **195** | `buyback` | Share repurchases |
| **196** | `tsBop` | Beginning of period |
| **197** | `tsEnd` | End of period |
| **200** | `ociChg` | Income / (loss) in the period |
| **201** | `ociBop` | Beginning of period |
| **202** | `ociEnd` | End of period |
| **205** | `cfNi` | Net income |
| **206** | `cfDa` | Depreciation & amortization |
| **207** | `cfSbc` | Stock based compensation |
| **208** | `cfWc` | Movements in working capital and other items |
| **209** | `cfPik` | Non-cash PIK interest added back |
| **210** | `cfOther` | Other items in the filed statement, not carried by this model |
| **211** | `cfoFiled` | Cash from operating activities, as filed |
| **212** | `cfo` | Cash from operating activities |
| **213** | `cfi` | Cash from investing activities |
| **214** | `cff` | Cash from financing activities |
| **215** | `netChange` | Net change in cash |
| **216** | `cashBop` | Cash, beginning of period |
| **217** | `cashEnd` | Cash, end of period |
| **227** | `bsCash` | Cash & equivalents |
| **228** | `bsAr` | Accounts receivable |
| **229** | `bsInv` | Inventory |
| **230** | `bsDta` | Deferred tax assets |
| **231** | `bsOca` | Other current assets |
| **232** | `bsPpe` | Property, plant & equipment |
| **233** | `bsOa` | Other assets |
| **234** | `bsTa` | Total assets |
| **236** | `bsAp` | Accounts payable |
| **237** | `bsAcc` | Accrued expenses & deferred revenue |
| **238** | `bsRevolver` | Revolver |
| **239** | `bsDebt` | Long term debt |
| **240** | `bsOncl` | Other non-current liabilities |
| **241** | `bsTl` | Total liabilities |
| **243** | `bsCs` | Common stock & additional paid in capital |
| **244** | `bsTs` | Treasury stock |
| **245** | `bsRe` | Retained earnings |
| **246** | `bsOci` | Other comprehensive income |
| **247** | `bsTe` | Total equity |
| **248** | `bsCheck` | Balance check |

## 22b. The peer spreading workbook

**One file: the target and up to ten peers, each on its own tab, every tab laid
out identically, plus a comparison tab that is nothing but live cross-tab
formulas.**

This is the first thing section 22a bought. Because every company's 3-Statement
tab now puts the same line on the same row, `'MSFT'!$I$26` and `'AAPL'!$I$26`
are both revenue, and a comparison can be written as formulas rather than as a
second copy of the numbers. Change an assumption on a peer's tab and the
comparison moves with it — the rule the Assumptions sheet already follows.

The tabs are produced by **the same generator the single-company workbook uses**,
so the chart of accounts is enforced on each one as it is built: a tab that laid
its lines out differently would throw rather than produce a comparison that
silently reads the wrong line.

### What the comparison tab carries

Size and growth (revenue, growth, EBITDA, EBIT, net income); margins (gross,
EBITDA, operating, net); returns (on equity, on assets, on capital employed);
leverage (net debt, net debt/EBITDA, liabilities/equity); and the multiples —
market capitalisation, enterprise value, EV/EBITDA, EV/revenue, P/E. Every row
carries a **median and a high-minus-low spread**, both computed in the sheet.

### The one thing that is not a formula

A share price and a diluted share count are market facts, not filing lines. They
exist nowhere else in the workbook, so they are stated once on the comparison
tab as dated inputs, in the same yellow the rest of the file uses for an
assumption. **Everything computed from them is a formula** over those cells and
the peer tabs: market capitalisation, enterprise value and all three multiples.
Nothing that exists on a tab is copied onto the comparison.

### Differing fiscal year ends: stated, not adjusted

The engine carries each company's own period end, and this uses it rather than
assuming a common one. **Each column reads that company's own last reported
year from its own tab.** This is not cosmetic: the number of reported years
differs between companies, so the last reported year sits in a different
*column* on different tabs — rows are fixed by the chart of accounts, columns
are not. In a measured eleven-company set, seven companies' last year sat in
column I and four in column H, and the formulas differ accordingly.

The period ends are printed in a row of their own at the top. In that same set
they ran from 2025-08-31 to 2026-03-31 — seven months apart.

**They are not calendarised, and the tab says so.** Restating a March filer onto
a December basis needs quarterly filings this site does not read, and inventing
the overlap would be the kind of silent adjustment this site exists not to make.
What the comparison therefore compares is **each company's most recent full
year**, which is what a spreading exercise compares; it is not a snapshot of one
date, and a reader drawing conclusions across a cyclical turn is told to look at
the dates first.

Currencies are likewise **not converted**. Each tab reports in the currency of
its own filings, named in a "Reported in" row. Margins, returns and multiples
are ratios and survive the difference; revenue, EBITDA, net debt and market
capitalisation do not, and are left in the currency filed rather than translated
at a rate that would be stale before it was read.

### A refused peer keeps its tab

Where the site declines to put a value on a peer, **its tab is still built, from
its filings, and the refusal is stated** — on the tab, and in a "Valuation" row
on the comparison. The comparison is of filings, not of valuations: a company
the model will not value is still a company the filings describe, and dropping
it would quietly narrow the spread the reader asked for. In the measured set of
ten peers, four were refused and all four kept their tabs and their figures.

A peer that cannot be fetched or modelled at all is **reported to the console,
not silently dropped**, for the same reason.

### What it costs

Each peer needs its own filings, which the comparison endpoint does not carry —
it holds market multiples and nothing a model can be built from. So each peer is
its own fetch, run in sequence rather than ten at once, and the button names the
peer it is on.

Measured on a target with ten peers, from payloads already in hand: **12 tabs,
164 KB, 358 ms** to build and write. The fetches dominate the wall clock; the
workbook itself is not the slow part.

### Checked

`verify:workbook` builds the file, loads it back, **recalculates every cell in
HyperFormula** and compares the answers against the engine company by company —
revenue, EBITDA, EBIT, net income, operating margin, and the median and spread.
It also asserts that every refused peer still has a tab with revenue on it, and
that **no figure in a company column is a typed number** apart from the two rows
of market facts. A formula pointing at the wrong row is the failure mode that
looks fine — the cell holds a plausible number belonging to a different line —
so the check recalculates rather than reading the formulas and agreeing they
look right. Pointing every cross-tab read one row low makes it fail on every
company.

## 22c. The house template

**A firm uploads its own Excel layout once, and every export after that arrives
in that layout instead of ours.**

This is the second thing section 22a bought. A template maps onto a fixed set of
lines or it maps onto nothing: if our rows still moved with the company, a
mapping made against one model would point at the wrong lines in the next. The
138 contracted rows are what a template is mapped to.

### How the mapping is captured, and why that way

The obvious design is a form — 138 of our lines down one side, a cell picker
against each. It is also the design that kills the feature. Nobody completes a
138-row form to find out whether something is any good, and a feature that must
be earned before it can be judged does not get earned.

**So the upload does the work and the firm corrects it.** We read their file,
find every text cell that looks like a line name, and match it against the names
the contract publishes:

| How | What it means | Confidence |
|---|---|---|
| `instruction` | they wrote `{{rev}}` in the cell | 1.00 |
| `exact` | the names are the same words | 1.00 |
| `synonym` | a name analysts use for it — "Sales", "COGS", "SG&A", "PP&E" | 0.95 |
| `words` | most of the words overlap | 0.60–0.94 |

Each proposal carries **how** it was matched, so the firm reviews a short list of
uncertain ones rather than confirming a hundred obvious ones. The synonym table
is deliberately a table and not a cleverer algorithm: a wrong guess puts a figure
on the wrong line of a partner's model, so the failure has to be something a
person can read and correct rather than a score to be tuned.

A firm that wants certainty writes `{{rev}}` in a cell and that beats every other
rule. That is the precise path for whoever wants it, and nobody has to learn a
key to begin.

**Our figures are computed, not read off the sheet.** Our model sheet is
formulas — only the reported years are written as numbers — so reading the cells
straight returned "not reported" for Apple's own net income, the exact failure
this feature exists to avoid. The model is recalculated first, by the same
engine `verify:workbook` uses to prove the workbook reproduces the site. That
engine is imported dynamically, so it is fetched only by someone who actually
fills a template: measured, the entry bundle grows 2406 KB → 2435 KB, and its
766 KB sits in a chunk nobody else loads.

### The three rules, and where each is enforced

**A line of ours their template has no place for is reported, never dropped.**
It is listed on screen at mapping time, and again on a sheet written into every
filled file — because the partner reading that model a week later has no other
way of knowing that a hundred of our lines had nowhere to go.

**A cell we cannot fill says so.** It gets the words "not reported", never a
blank and never a zero. A blank in a filled model reads as nil, and a nil we
never had is the one thing this site exists not to print.

**Their formatting is theirs.** The template is loaded and written back out:
every style, formula, merge, print range and logo it arrived with is still
there. We write only the cells the mapping names, we do not restyle a cell or
change a number format, and a line they carry that we do not — "Diluted EPS",
"Dividend per share" — comes back untouched rather than blanked.

### A revised template

Templates change: a row is inserted, a section reordered, a tab renamed. The
mapping is stored **against the name as well as the cell**, so a revision is
reconciled rather than rebuilt. Each mapped line is looked for by its name
first, and the firm is shown what was kept, what moved, what is gone and what is
new.

**Silent re-pointing is what is not done.** A line whose name has disappeared is
reported as lost and dropped from the mapping, rather than quietly left pointing
at whatever now occupies its old cell — which would put revenue on a row that
used to be revenue and is now a spacer. A dropped line reappears in the unmapped
list, and so is reported in every export from then on.

Measured on a revision that inserted two rows into the P&L and renamed the cash
flow tab: 12 lines kept, 20 followed to their new homes, 0 lost.

### What is stored, where, and for how long

The template and its mapping live **in the firm's browser, in IndexedDB**, and
are not sent anywhere. There is no upload in the network sense — the page reads
the file, maps it and fills it. Marginalia runs no server that receives it, so
there is nothing of a firm's to leak or lose, and "we delete it on request" is a
fact about where the bytes are rather than a promise about our operations.

Kept: the file as chosen, the confirmed mapping, a name and two timestamps. Not
kept: any filled output, any figure, and any record anywhere else that a
template exists. Held until the firm removes it or clears the browser's data;
removing deletes bytes and mapping together.

The cost is that a template does not follow a reader to another device — the same
trade `savedModels.ts` makes. **All of this is stated on the screen before the
file is asked for**, in the same words, and `STORAGE_STATEMENT` in
`templateStore.ts` is where the page gets them, so the claim and the code cannot
drift apart.

### Measured

Against a representative firm template — written the way an analyst writes one,
with its own tabs, a units column, a year header and lines we do not carry, and
deliberately **not** built from our labels:

- **32 of 138 contracted rows mapped**: 15 exact, 17 by synonym, 0 needing
  review, 2 conflicts where two of their cells claimed the same line.
- **105 reported as unmapped.** That is the honest shape of it: our 138 rows
  include the drivers, schedules and opening/closing balances a model needs and
  a firm's summary template does not carry. A template maps the reported lines.
- **117 figures written** across 5 periods, with **7 cells reading "not
  reported"** where the model genuinely had no figure.

`verify:workbook` runs the whole flow and asserts every rule above, including
that nothing mapped comes back blank. Leaving an unfillable cell empty instead
of saying "not reported" makes it fail.

## 23. What the source does not give us

`src/data/dataConstraints.ts`. A figure the filing or the data source never
publishes is not a defect and cannot be fixed in code. What the engine can do is
measure how much the absence could matter, and then either refuse or say so.

**The bound.** For each constraint, the model is re-run with the missing figure
set to the largest value the filing allows, and the move in value per share is
the bound. Stock compensation the filing never mentions has no bound at all; a
marketable-securities balance the filing reports without splitting does, because
the total is on the face of the balance sheet.

**The threshold.**

| Bound | What happens |
|---|---|
| more than **25%** | the discounted cash flow is refused and the message names the missing figure |
| **5%** to 25% | a warning above the model and a panel beside the working, with the size and the direction |
| below 5% | listed in the panel, nothing flagged |

25% is the cut the site already uses for a *wide* disagreement between its two
terminal methods (§13), chosen because the median disagreement between them is
14.5%: a single missing input that could move the answer further than two
legitimate methods disagree is not a number worth showing. 5% is the cut every
measurement in `KNOWN_ISSUES.md` uses for "materially moved", which is the right
bar for telling the reader rather than for withholding.

**Where the bound cannot be computed**, the constraint is judged on the effect
measured on the companies that do report the figure, and on whether the error
has a known direction. An error that can only ever understate the value is a
floor, and a floor with its direction stated is information; an error that could
flatter the company is not. So an uncomputable bound warns when the error runs
one way and is under 25% where it can be measured, and refuses otherwise.

**A refusal is set on the model data, not at the point of display**, so it
reaches the dashboard on every slider move, the batch screen, the workbook and
the verification harness alike. It refuses the discounted cash flow and nothing
else: residual income, the market approach and the asset approach do not depend
on the forecast and are unaffected.

`DATA_CONSTRAINTS.md` lists every constraint, the source it comes from, the
measured bound, and which ones a primary-filings data layer would remove.

## 23a. Which shape of payload this code reads

`src/data/payloadVersion.ts`, `api/company.js`, `verify/payloadSet.mts`.

An answer from `/api/company` is cached — six hours at the edge for everyone who
asks, and indefinitely on disk for the verification set. The key was the ticker
alone, so for six hours after any change to what is fetched, code that expected
a new field was handed a payload built before that field existed and read it as
a figure the company does not report: a currency that could not be established,
a cash flow total not filed, a risk-free rate absent. Nothing failed. The page
simply said something untrue, and a sweep over a mixed set produced numbers that
looked valid (`KI-15`, fixed 2026-09-27).

**The version is part of the request.** The browser asks for the shape it knows
how to read (`?v=4`), the answer stamps the shape it is (`fetcherVersion`), and
the two are compared rather than assumed. A bumped version is a different URL,
so no cache anywhere can serve the old shape to new code — that is the fix; the
rest is what to do if it happens anyway:

- **the answer is older than the page** — unreachable through the URL, so if it
  happens something else is wrong, and the page says so rather than reading the
  gap as data;
- **the answer is newer than the page** — the site was deployed while the tab
  was open. The page is the stale thing, and it says to reload.

**The verification set refuses to be measured while it is stale.** Every tool in
`verify/` reads payloads through `payloadSet.mts`, which stamps each run with
what the set is — `payload set: 176 payloads, 176 built by the current fetcher
(v4)` — and stops a sweep, a scenario run or a workbook comparison outright when
any payload predates the fetcher, naming the command that fixes it. It refuses
rather than refetching on its own: a refetch takes a quarter of an hour and hits
live sources, so it is the operator's call, and two runs either side of an
implicit refetch would not be comparable anyway. The fetcher reports the state
of the set it leaves behind, so a partial refetch by ticker is visible at once
rather than at the next measurement.

The version numbers and what each one added are listed in
`src/data/payloadVersion.ts`. **Bump it whenever the fetcher changes what a
payload contains.**

---

## 24. What is verified, and what is not

`verify/`, five commands, runnable from a fresh checkout.

| Command | What it proves |
|---|---|
| `npm run verify` | ten scenarios over the engine and the derivation, plus a sweep; every check must come out zero |
| `npm run verify:dashboard` | the rendered page shows what the engine produced, and a refused company shows no value anywhere |
| `npm run verify:workbook` | the workbook reproduces the site's value per share on both terminal methods, for every valued company |
| `npm run verify:sweep` | snapshots what the site would show for every fetched company, for measuring a change |
| `npm run verify:compare` | two snapshots against each other |

**The workbook agrees with the site exactly.** Every valued company's workbook
returns the site's value per share to nine decimal places on both terminal
methods; the worst difference across the 70 models checked is 3.87e-9%, which is
floating point in the last digit.

**Two limits on the verification itself**, neither of which is a defect in the
model:

- **HyperFormula cannot iterate.** The library used to recalculate workbooks
  outside Excel has no iterative calculation, so a switch-on scenario (§22) is
  verified with a hand-written fixed-point loop over the circular cells rather
  than by an Excel recalculation.
- **The sweep covers 104 companies; the site reaches any listed ticker.** One
  payload fails to fetch on the last full sweep: TATAMOTORS.NS, which Yahoo no
  longer carries statements for after its demerger, and which says so naming
  what was tried. The three that used to fail with it were `KI-6`, fixed
  2026-09-26 (§1). The currency sweep covers 101 non-US listings chosen to span
  every kind: depositary receipts and cross-listings, 10-K filers based abroad,
  and home listings on 22 exchanges quoted in 19 currencies.

**The page agrees with the engine too**, since 2026-09-26. Everything above
runs below the screen, so all of it would pass with a dashboard that read the
wrong field or printed a value for a company the engine refused (`KI-16`).
`npm run verify:dashboard` starts the site with Vite, drives it in a real
Chromium through the screens a reader clicks through, and compares the page
with the engine's own output for the same company: the headline value and both
terminal methods, every line of each method, the equity bridge, the cost of
capital, and the statements year by year — compared **as formatted**, so a
figure printed to the wrong precision fails as loudly as a wrong one.

It also drives the refusal, which is the path a reader is likeliest to meet on
an awkward filer: a refused company must show the engine's reason and no value
**anywhere** — no premium against the price, no football-field bar, no reverse
DCF, no terminal-reliance panel, and none in the batch screen or the downloaded
workbook. It found one: the workbook (§22).

It runs against a paper company invented in `verify/fixtures/`, with every
`/api/*` call answered from that fixture, so it needs no payloads, no API keys
and no network — the fetched payloads are vendor data and are not in the
repository (§23).

## 25. What is not modelled at all

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
- **Any check that the dashboard renders what the engine produced.** See §24
  and `KI-16`.

---

*Written against `e52cdc6` plus the data-constraint handling added the same day. Defects are in `KNOWN_ISSUES.md`; what the
source does not publish is in `DATA_CONSTRAINTS.md`; the convention-by-convention
audit is in `CONVENTIONS_AUDIT.md`; the plan is in `ROADMAP.md`.*
