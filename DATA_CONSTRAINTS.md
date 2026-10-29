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

**On the payload set of 2026-09-23 (176 files, 172 with statements, 169
modelled, 63 valued) one company crosses 25% on a computed bound**: Enbridge, on
what tax its non-operating income bore, at 31.8%. Every other constraint
measured either is small, is bounded below 25%, or runs only in the direction
that understates.

---

## The constraints

| Constraint | Source | Companies | Handling |
|---|---|---|---|
| Lines the filing does not report at all | both | 116 modelled | note; the treatment ties operating income to the filing |
| Selling and administrative reported as one line | both | 161 of 175 payloads | note; the classification default is a stated convention, and the split moves no figure |
| D&A the filing does not report | both | 13 of 175 payloads | note; nothing is added back and the EBITDA bridge says "none filed" |
| Stock compensation never broken out | Yahoo mostly | 54 modelled, 19 valued | **warn** — the value is a floor |
| A price that must be converted | Yahoo | 46 modelled | note; no effect on value |
| Total liabilities not tagged | both | 23 modelled | note; presentation only |
| Bank dividends not split common/preferred | Yahoo | 18 modelled | **warn** |
| How much of a year's growth an acquisition brought | both | 15 modelled | note or **warn** by bound; max 18.5% |
| What tax the non-operating income bore | both | 64 modelled | note, **warn** or **refuse** by bound; max 31.8% |
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
| The tax split between operating and non-operating income | both | 1 (ENB.TO) | **refuse** above 25% |
| *Refused because the filing contradicts the model* | | | |
| Revenue fell while the plant that produces it rose | both | 5 named | **refuse** (`KNOWN_ISSUES.md`, KI-11) |

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

### What tax the non-operating income bore

**Source:** both. **Affects:** 64 of 169 modelled — 52 notes, 11 warnings and
one refusal.

The forecast tax rate is filed tax over filed pretax income, and filed pretax is
operating profit, plus interest, plus other non-operating income. The forecast
carries all three (`METHODOLOGY.md` §5), so the rate is applied to the base it
was measured on. What no filing separates in a readable form is **how the tax
was split between them** — the rate reconciliation that would say so is a
narrative note, not a tagged figure. It matters because the discounted cash flow
applies that rate to operating profit alone.

**Bound:** the two ends the filing leaves open. At one end the non-operating
income was taxed like everything else, which is the rate shown; at the other it
bore no tax at all and the operating profit carried the whole charge. Enbridge
31.8% (refused), Alibaba 23.8%, AbbVie 22.5%, Siemens 18.8%, Marvell 16.0%,
Shell 15.8%, Toyota 11.3%. For 52 companies the non-operating income is small
enough that the two ends are within 5% of each other.

### How much of a year's revenue growth was bought

**Source:** both. **Affects:** 15 of 169 modelled, 5 of them above 5%.

A year in which goodwill jumps is a year in which the company bought a business,
and some of that year's revenue growth came with it. The forecast growth rate is
the median of the company's year-on-year growth, and it reads an acquired year
as an ordinary one.

**The filing says the acquisition happened. It does not say how much revenue it
brought**, and it says nothing at all about the following year, which carries
twelve months of it against the first year's part year. Enbridge's FY2024 added
4,752 of goodwill, 8.9% of that year's revenue, beside revenue growth of 22.5%;
its FY2025 growth of 21.9% is the annualisation, with no goodwill jump to mark
it. So the year is **not excluded** from the growth rate: excluding it would
throw away the organic growth in that year too, and would still leave the
annualisation in.

**Bound:** what the value would be if the growth rate came from the years that
carried no acquisition. That is an upper bound on the error, not an estimate,
because it assumes none of the growth in those years was organic. Enbridge
18.5%, Salesforce 10.5%, Siemens 3.5%, Broadcom 3.1%, Microsoft 0.8%. The bound
is what separates them: Microsoft's Activision year barely moves its value and
is a note; Enbridge's is a warning. A year is counted when the goodwill added is
at least a twentieth of that year's revenue, below which an acquisition cannot
have moved the growth rate much.

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

### The company's own line captions

**Source:** both. **Affects:** every company, every line on the figures screen.

Neither source returns the captions the company actually filed. Both return a
**normalised schema** — the same field names for every company — so the figures
screen shows the fields our source provides, under names of our own writing,
rather than the wording of the annual report.

**What is real about it, and what is not.** Which lines appear genuinely differs
company by company, because it is what the source returned for that company:
Reliance reports no research and development and no share-based pay, and does
report lease obligations; another company is the other way round. That is a
per-company list of real filed figures. What is ours rather than the filing's is
the **wording of each line**, and a reader who took these for the annual
report's own captions would have no way to find out otherwise.

**So the screen says it, in those words**, visible above the table rather than
folded into a disclosure: "These are the fields our source provides for
&lt;ticker&gt;, not yet its own line captions."

**It cannot move a value.** A caption is a name, not a figure; every number
under it is the filed one and every head it sits under is stated with its basis
(`METHODOLOGY.md` §22d). What it costs is recognition — a reader comparing the
screen against the annual report in front of them has to match our wording to
theirs line by line, and on a filing with unusual captions that is real work.

What would remove it: the primary-filings data layer, which reads the filing's
own tags and the labels attached to them (`ROADMAP.md` section 1).

### A vendor feed the site is not licensed to publish from

**Source:** Yahoo Finance. **Affects:** every price series on the site, and
every figure for every company outside the United States — 83 of the 176
payloads take their statements from it, and all 175 that carry a price take
their price history from it.

**This is a development-only source and MUST BE REPLACED BY A LICENSED SOURCE
BEFORE PUBLIC LAUNCH.** It is written here, in the file about what the sources
do not give us, because the thing it does not give us is the right to show it to
anybody: Yahoo's terms allow personal, non-commercial use and do not permit
redistribution. The site is private while it is being built (launch principle 2),
and that is the only reason this is a constraint rather than a defect.

What it covers today:

- **The price, the previous close and the 52-week range** for every company,
  curated and derived alike.
- **The daily price history** behind the chart on the company page: ten years
  of daily closes and a monthly series back to the listing's start
  (`payloadVersion.ts` v5). This is the largest single thing taken from the
  vendor and the one with the clearest licensing cost — end-of-day prices with
  display rights are a product sold by exchanges and vendors, and `ROADMAP.md`
  §13 already carries "global prices with display rights" as **Paid · last**.
- **Every statement for every Indian company**, and for every other company
  outside the SEC's reach. The United States is already on primary filings;
  India is not, and `docs/DATA_LAYER_PLAN.md` is the plan that moves it.

**It cannot move a value by itself** — the figures are the vendor's extraction
of the same filings, and where that extraction has been wrong the defect was
opened against us and fixed (`ROADMAP.md` §1 records the September 2026 run:
statements in yen labelled dollars, depositary share counts, Brazilian currency
fields contradicting their own figures, which is why 38 US-listed foreign
companies are refused outright). What it costs is the right to publish, and a
dependency on a third party's extraction where the filing itself is public.

**What removes it, in order.** The Indian primary-filings layer for statements
(`docs/DATA_LAYER_PLAN.md`, stages 1 to 5), and a licensed end-of-day price feed
bought before launch for the chart. Until both are done, nothing on this site is
public.

### The lines eleven of the sixty myth-versus-fact cards rest on

**Source:** both. **Affects:** 11 of the 60 cards on the loading screen, which
can never be shown; measured over 175 companies on 2026-10-24.

The cards shown while a company builds are chosen by testing each one's "Show
when" condition against that company's filed figures. Eleven conditions rest on
lines neither the SEC's XBRL nor the vendor feed returns, so they can never be
established and the cards are never shown:

| Cards | The line that is missing |
|---|---|
| 21 | cash interest paid, as distinct from the interest expense charged |
| 38 | cash paid for acquisitions |
| 50 | deferred revenue |
| 51 | impairment charges |
| 54 | cash taxes paid, as distinct from the tax expense charged |
| 55, 58 | customer deposits |
| 56, 60 | interest income and non-interest income, separated |
| 57, 58 | gross loans |
| 59 | provisions for credit losses |

**Six of the eleven are the bank cards**, which is the sharper half of this: a
bank's own schema — deposits, loans, interest income, provisions — is not in
either source at all, so every card written about banking is unreachable and a
bank is shown one of the cards written for any company instead. Measured: of 36
banks in the payload set, 27 still earn a card from a condition that reads only
the lines both sources do return, and 9 fall back.

**It cannot move a value.** No card is an input to anything; the loading screen
reads the filings and shows one of sixty fixed statements about how accounts
behave. What it costs is relevance — a bank waits in front of a card about
companies in general rather than about banks.

**It is not treated as a near miss.** A condition that cannot be established is
not false and is never read as nil: `npm run verify` removes one filed line at
a time from four real companies and fails if any answer turns into a different
answer rather than into "cannot be established". That check was written because
the obvious spelling — `(leases ?? 0) > (debt ?? 0) / 5` — reads an absent line
as a reported zero, and it caught three of those in the first version of this
code.

What would remove it: the primary-filings data layer, which reads the filing's
own tags rather than a normalised schema, and for India reads the bank
schedules themselves (`docs/DATA_LAYER_PLAN.md` §2.3).

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

### Depreciation and amortisation the filing does not report

**Source:** both. **Affects:** 13 of 175 payloads — 11 report none in any year
(CB, CRWD, MELI, MS, NEE, SCHW, V, VALE, VALE3.SA, WELL, XOM), 2 in some years
(CBA.AX and CNQ, three years each).

Mostly banks and insurers, where the free sources tag no D&A line in the cash
flow statement at all.

Where it is missing the engine adds back nothing, so **EBITDA equals operating
profit** for that year, and the forecast depreciation is read from the
balance-sheet movement instead (`METHODOLOGY.md` §6). The adjusted EBITDA bridge
(§22e) prints **none filed** on the add-back line rather than a nil, because a
nil in a column of figures reads as a measurement and this is an absence.

**It cannot be bounded the usual way**: the figure is not a missing input to an
otherwise complete model, it is a missing line in a reported year, and the
engine refuses a company whose forecast depreciation it cannot measure at all.
Of the 11, every one is a financial company, which the engine values by residual
income rather than by a discounted cash flow.

What would remove it: the cash flow statement read from the primary filing,
where the line is almost always disclosed (section 1 of `ROADMAP.md`).

### Selling and administrative costs reported as one line

**Source:** both. **Affects:** 161 of 175 payloads report an SG&A line at all;
every one of them reports it combined.

Neither source splits selling and distribution from administration. The filings
themselves usually do not either — "selling, general and administrative" is one
caption in most jurisdictions — and nothing in the data says how much of it is
which.

So the expense classification layer (`METHODOLOGY.md` §22d) cannot read that
split from the filing, and **its default for this line is a stated convention
rather than a reading**: the whole line is treated as administrative, and the
screen says in those words that the default is a convention. A reader who knows
the split can move the line, or correct the figures to separate it.

**It cannot move a value.** Selling and distribution and administrative are both
operating categories, and operating profit is the sum of the same lines whatever
they are called, so the split changes the subtotals a reader reads and no figure
the valuation depends on. Measured: nil drift across every grouping move.

What would remove it: segment and expense-note extraction from the primary
filings, where a company does split the caption in its notes (section 1 of
`ROADMAP.md`).

### A balance sheet line the filing stops tagging

**Source:** both. **Affects:** 13 valued, 61 modelled. **Bound:** 0.0% on every
one of the 13.

Alphabet reported inventory until 2022 and stopped. Alibaba tags no accounts
payable at all. Accenture has never reported inventory, because it holds none.
In each case the forecast has no balance to start the line from.

**Not tagged is not nil, and it is not missing either.** The amount is inside
whichever line the filing *does* tag, and the filing proves it: the reported
balance sheet adds up without the line. So the forecast carries the line as
absent, exactly as the last reported year does, and the balance sheet omits it
on both sides. Putting a figure back — a stale balance rolled forward, or the
nil the arithmetic used to produce by accident — would count the same money
twice.

What is lost is not an amount but a **pairing**: the money is forecast at the
driver of the line that absorbed it rather than at its own. That is what the
bound prices, by moving every working capital line to the other base
`CONVENTIONS.md` sanctions. It comes to **0.0% for all 13 valued companies**,
because forecast cost of sales is a fixed share of revenue, so the two bases
grow at the same rate for as long as the margin is held where the filing put it.
A reader who edits the margin in the workbook parts them, which the workbook's
own driver rows show.

Recorded per company as `workingCapitalLineNotTagged` and listed beside the
model. Where the line the filing stops tagging is one the **forecast itself** is
built from — cost of sales, capital expenditure, or net PP&E — there is nothing
to absorb it and no value is shown at all; see *Already refused, and why*.

### A government bond yield for the won, the renminbi, the Taiwan dollar and the krone — and a monthly one for the rupee

**Source:** the institutions that publish these rates, where they can be
reached. **Affects:** 4 companies refused, 4 valued on a monthly series.
**Bound:** not computable for the four refused; for the rupee, **measured at
0.4bp to 7.7bp** — see below.

The cost of equity starts from a risk-free rate, and a risk-free rate belongs to
a currency: a yen cash flow discounted at a US Treasury yield is not an
approximation, it is a different country's rate. Toyota's cost of equity was
12.32% on a US rate and is 9.60% on a Japanese one.

**Five currencies are now fetched from the body that publishes them.** One
vendor's chart endpoint carries only the US curve, which is where this file
first left the matter; that was a fact about one vendor, not about the data.

| Currency | Publisher | Series | History | Terms |
|---|---|---|---|---|
| USD | US Treasury | daily par yield curve, 10-year | by calendar year, daily | a work of the US government, public domain |
| EUR | European Central Bank | euro-area AAA government bond spot rate, 10-year | daily, any window | ECB statistics, reusable with the source acknowledged |
| JPY | Ministry of Finance, Japan | JGB daily interest rates, 10Y | daily, from 1974 | Japanese government standard terms, free reuse with attribution |
| GBP | Bank of England | IADB series IUDMNZC, 10-year nominal par yield | daily, any window | Bank statistics, reusable with acknowledgement |
| SEK | Sveriges Riksbank | SWEA SEGVB10YC, 10-year benchmark | daily, any window | open data |
| INR | **OECD**, with FRED as a fallback | MEI long-term interest rates `IRLT`, 10-year, **monthly** | monthly, from Dec 2011 | OECD content published from 1 July 2024 is CC BY 4.0; FRED redistributes the same series |

Each was fetched for a full year ending eighteen months in the past on
2026-09-27 and returned 245 to 255 observations. The US moved off the vendor's
index onto the Treasury's own feed at the same time, so every rate in the model
now comes from the institution that sets it: Apple's rate changed by half a
basis point in the move.

**The rupee’s publisher went down, and that single point of failure is now
closed.** On 2026-10-22, refetching the whole set for the price history, FRED
answered every request with its own "Site Maintenance" page, so **six Indian
companies lost their risk-free rate in one afternoon** — Reliance, TCS, HDFC
Bank, HDB, ICICI and Reliance Infrastructure — and every one of them was
refused a valuation rather than discounted at something else, which is the
behaviour standing decision 3 requires. It was also the only single point of
failure in the set that could take a company’s valuation away without any code
changing: every other currency is fetched from the institution that sets the
rate, and the rupee was fetched from a third party republishing a sixth.

**Since 2026-10-25 the OECD is asked first, through its own SDMX API, and FRED
is kept behind it.** The OECD compiles the series; FRED republishes it. Measured
over the whole overlap on 2026-10-24:

| | months | first | last | identical to the last digit |
|---|---|---|---|---|
| OECD `IRLT` (India, monthly) | 178 | 2011-12 | 2026-09 | **175 of 178** |
| FRED `INDIRLTLT01STM` | 178 | 2011-12 | 2026-09 | the other 3 agree to 7e-7 of a percentage point |

The three that differ differ because the OECD API rounds to six decimals where
FRED prints fourteen. **The six Indian payloads were refetched against the OECD
directly and the rate did not move at all**: 6.540458% over the same twelve
months, to the last digit, for all six.

**What is still true:** both are the same monthly series, so this removes a
dependency on one host rather than the monthly-data constraint below. And the
OECD’s own API is not perfectly reliable either — one request in about a
dozen during this work came back `500` and answered normally on the next
attempt, which is exactly what the fallback is for and why it was kept rather
than replaced. A usable **daily** Indian series from FBIL, NSE or CCIL is what
would remove the real constraint (`ROADMAP.md` §1).

**Four currencies could not be reached, and those companies stay refused**:
Samsung (won), Tencent and Alibaba (renminbi), TSMC (Taiwan dollar), Novo
Nordisk (krone).

**The rupee is settled, on a monthly series, and the cost is stated.**

Every daily publisher of the Indian ten-year was checked on 2026-10-10:

| Source | Daily history? | Terms | Reachable from a US server? |
|---|---|---|---|
| FBIL (the benchmark itself) | yes | **licensed commercially: a paid licence is needed to display it on a website** — **Paid · last** | n/a — no licence |
| RBI NSDP page | no — a handful of **weekly** figures, no history | public | yes |
| RBI DBIE (`data.rbi.org.in`) | yes, behind an undocumented gateway | public | **yes** — see below |
| CCIL | yes | Terms of Use forbid *"systematic or automated data collection, including scraping, data mining, data extraction and data harvesting"* | no — timed out from both India and a US datacentre |
| NSE | a total-return **index**, not a yield | redistribution restricted | no — 200 from India, timed out from a US datacentre |
| World Bank | **no such indicator exists** — every "yield" series it publishes is agricultural | open | yes |
| IMF | monthly at best; IFS was restructured in 2025 | open | yes |
| OECD, direct (`sdmx.oecd.org`) | **monthly** | CC BY 4.0 since 1 July 2024, with attribution | **yes** — this is what is read |
| OECD via FRED | **monthly** | the same series, redistributed | **yes** — kept as the fallback |

**One earlier conclusion in this file was wrong and is corrected here.** It said
the Bank's historical database "resolves but does not complete a connection from
outside India". `dbie.rbi.org.in` no longer resolves *even from India*; the live
host is `data.rbi.org.in`, and it is **not** geo-blocked — its gateway answers in
about 0.4 seconds from India and from a US datacentre alike. The obstacle there
is that the service path is undocumented, not where the server sits.

**What the monthly series costs, measured rather than asserted.** On the two
currencies where this site holds a daily series *and* the OECD publishes a
monthly one for the same country, over the same twelve-month window
(2025-09-01 to 2026-08-31):

| | daily mean | OECD monthly mean | gap | of which frequency | of which source definition |
|---|---|---|---|---|---|
| USD (Treasury, 250 obs) | 4.2998% | 4.2958% | **−0.4bp** | −0.3bp | −0.1bp |
| GBP (BoE IUDMNZC, 253 obs) | 4.7694% | 4.6920% | **−7.7bp** | +0.1bp | −7.8bp |

For scale, the daily series moved 78bp and 86bp high-to-low inside those same
windows. The decomposition is the part that matters: **monthly sampling itself
costs almost nothing** — 0.3bp and 0.1bp, because a mean of twelve monthly
averages and a mean of 250 daily closes are estimating the same thing. The
7.7bp on sterling is almost entirely *source definition*: the OECD's UK series
is not constructed the same way as the Bank's nominal par yield. So the risk the
rupee carries is not that the data is monthly. It is that the OECD's Indian
series may be defined differently from FBIL's benchmark, and **there is no
Indian daily series reachable from here to measure that against** — which is
the whole reason this constraint exists. On the evidence from the two
currencies that can be checked, the plausible size is single-digit basis
points, against a cost of equity near 10.8%.

**It also lags.** The latest observation on 2026-10-10 was **2026-07**, 101 days
back. For a one-year mean this is minor — the window is anchored to the
company's own balance-sheet date, and for a 31 March year-end all twelve months
are published — but the rate is not a current one, and a company with a very
recent period end averages fewer months. Below nine monthly observations in the
window the rate is refused rather than averaged from a stub.

**What would remove it:** an open daily history for each of the four refused
currencies; and for the rupee, an open *daily* Indian series — either an FBIL
licence, or the DBIE gateway's service path documented well enough to depend
on. Until then the rupee is valued on a monthly series that is named as monthly
everywhere it is shown.

### The yield publishers that need permission or money before launch

**Source:** the publishers themselves. **Affects:** 1 currency valued today
(INR), 3 currencies that are candidates for later (CHF, SGD, CNY).
**Bound:** none on any value today — **noted, so that a licence is bought or
asked for before a public site needs it, not after.**

Six of the seven publishers this site reads are open: the US Treasury (public
domain), the ECB, the Bank of England, Japan’s Ministry of Finance, the
Riksbank and the OECD (CC BY 4.0 since 1 July 2024, with attribution). Four
others are not, and each is recorded here before it is needed rather than
discovered at launch.

| Publisher | Currency | What it gives | What it needs | Status |
|---|---|---|---|---|
| **FBIL** | INR | the official Indian benchmark, daily | **a paid licence to display it on a website** | **Paid · last** |
| **SNB** (Swiss National Bank) | CHF | daily Confederation bond yields | **permission before public use** | Later |
| **MAS** (Monetary Authority of Singapore) | SGD | daily SGS benchmark yields | **permission before public use** | Later |
| **ChinaBond** | CNY | the daily CGB yield curve | **permission before public use** | Later |

None of the three is read today, and the companies that would need them are
refused rather than approximated: 1 payload reports in Swiss francs, 1 in
Singapore dollars and 7 in renminbi. Building against any of them is a request
for permission first, and the request is a launch-time task, not a development
one — the same rule the paid items follow in `docs/VISION.md`.

The OECD’s own terms page is worth one note: `www.oecd.org` answers an
automated request with `403`, so the licence was read in a browser and from the
OECD’s July 2024 announcement rather than fetched. The data API
(`sdmx.oecd.org`) has no such block, answers a plain HTTPS request, and sets
`Cache-Control: public, max-age=7200`; one request per company build, against a
payload that is then cached on disk, is well inside what that invites.

### What the quarterly figures cover, and where they stop

**Source:** both, and they are not alike. **Affects:** the Financials tab.
**Bound:** **no effect on any valuation** — the engine models from annual
figures and does not read the quarterly periods at all — but the tab is only
as deep as the feed behind it, and the two feeds are a world apart.

**Measured on 2026-10-26, over the whole payload set.**

| | SEC path | Vendor feed |
|---|---|---|
| companies | 84 | 93 |
| carrying any quarters | **84** | **92** |
| quarters held | 1084 | 493 |
| the most for one company | **13** | **7** |
| half-years held | 291 | 0 |
| figures worked out rather than filed | 7,108 | 0 |

**The SEC path is deep and the vendor feed is shallow**, and the difference is
not a setting. The SEC publishes every quarter a company ever filed, so the
thirteen the tab shows are a ceiling we chose rather than one the source
imposed. The vendor publishes about five quarters of income and fewer of
anything else: measured on 2026-10-25, Reliance returned five quarters of
revenue and **two** of balance sheet, both of them year ends, and HDFC Bank
two of revenue against four of balance sheet.

**And that is rule 5’s India case arriving for real.** An Indian company files
its income quarterly and its balance sheet and cash flow only at the half year
and the year end, so on those companies the Financials tab has a quarterly
income statement and no quarterly balance sheet — and says which of the two it
is rather than reporting "no quarters" for a company that plainly files them.

**What is still missing, and it is the vendor’s to fix, not ours:** a quarterly
cash flow for most non-US companies, and more than about five quarters of
history. The primary-filings layer in `docs/DATA_LAYER_PLAN.md` is what closes
it; India publishes quarterly XBRL and the plan measures it.

**A cumulative figure is never shown as a quarter, and that is the whole
difficulty.** A 10-Q reports the income statement for the quarter but the cash
flow **cumulatively from the start of the year**: measured on Apple’s own
facts, its Q3 operating cash flow point spans 272 days, not 90. Printed under a
"Q3" heading it would be nine months of cash read as three, and it would look
entirely ordinary. So a point is taken as a quarter only when its own start and
end dates say it is one — 80 to 100 days — and otherwise the quarter is
worked out as **this year to date less the last**, which is the same
subtraction that gives Q4 = FY − 9M. Every figure worked out that way is
labelled derived and carries **both** of the filings it is the difference of.

**What it cost in storage**, which is the honest price of all this: the payload
set went from 10.34 MB to 13.95 MB, **35% larger**. An SEC
payload went from 62.0 KB to 102.1 KB on average and a vendor one from
58.5 KB to 61.4 KB — the vendor feed holds so little that it barely
moved. A full refetch went from about 22 minutes to 25 minutes.

**And five lines a bank statement needs are in neither feed:** interest earned
separated from other income, operating profit before provisions, provisions and
contingencies, deposits, and advances. Deposits are the largest liability a bank
has. The bank template lists all five and marks them not reported, because a
reader who knows what a bank’s accounts contain should be able to see what is
missing from ours.

**What would remove it:** quarterly periods in the payload, which is a change to
`api/company.js` and a payload version bump; and for the bank lines, a source
that files to a banking schema — RBI Form A for India (`DATA_CONSTRAINTS.md`
already refuses banks in the India plan for the same reason).

### The index a beta is measured against, and the four markets with none

**Source:** the vendor chart endpoint (index levels). **Affects:** the risk and
cost-of-capital card on 5 of 177 listings, which get no measured beta at all.
**Bound:** **none on any valuation** — the model discounts at its own asset
beta of 1.0 relevered, not at the measured figure (`METHODOLOGY.md` §14) — but
on those five the card has no beta of its own to show beside it.

**Measured on 2026-10-29**, every symbol fetched once before it was written
down:

| Index | Symbol | Result |
|---|---|---|
| **TOPIX** (Japan), rule 6’s default | `^TOPX`, `^TPX`, `998405.T` | **404 on all three.** An ETF tracking it answers; a fund is not the market, so Japan uses the Nikkei 225 instead and the card names it |
| **CDAX** (Germany), rule 6’s default | `^CDAXX`, `^CDAX` | **one close and no history**, and 404. Germany uses the DAX, which rule 6 names as the alternative |
| **Oslo All-Share** (Norway) | `^OSEAX` | **404.** No beta for an Oslo listing |
| **Tadawul All Share** (Saudi Arabia) | `^TASI.SR` | **one close and no history.** No beta for a Riyadh listing |

The other seventeen answered with ten years of daily closes. Twenty-one markets
are configured in all, covering **172 of the 177** listings; the five left are
Norway, Saudi Arabia, two over-the-counter listings and one on the London
international order book. **A market with no verified broad index is not given a
neighbour’s**: a beta against the wrong economy is a different quantity wearing
the same name, so the card shows none and says which index it would need.

**The levels are vendor data, exactly as the share price is.** Free for
development, licensed before launch — **Paid · last**, the same status
`docs/VISION.md` §13 gives global prices. Nothing is stored or redistributed:
the series is fetched on demand through `/api/marketIndex`, whose allow-list is
the twenty-one symbols and nothing else.

**And the returns are price returns.** The series are closes, split-adjusted
and **not** dividend-adjusted, so a beta measured here excludes dividends. The
card says so. The vendor does publish an adjusted series; reading it is a
fetcher change rather than a missing source.

**A depositary receipt gets no beta either**, and that is rule 7 rather than a
gap: a beta belongs to the home listing, measured against the home index, and
where this site holds only the receipt it holds the wrong series. Those
listings are already refused a value per share for the same reason
(`METHODOLOGY.md` §3).

### An issuer credit rating, which no free source publishes

**Source:** none of the three. **Affects:** the cost of debt on every company.
**Bound:** see `KI-29` — the engine uses the historical effective rate instead,
and on the five most heavily borrowed companies a point on the cost of debt is
0.30 to 0.79 points on the WACC.

`docs/COST_OF_CAPITAL_SPEC.md` rule 17 wants the risk-free rate plus a default
spread read from the company’s **actual** rating. The agencies publish ratings
on their own sites behind their own terms, and none of the three sources this
site reads carries one. What **is** free is the synthetic route: a rating
inferred from interest coverage, with Damodaran’s coverage-to-spread table and
his separate table for financial firms. That is buildable and not built; it is
on the roadmap, and the card shows the interest coverage it would be read off
so the missing step is visible rather than implied.

### How much plant a change in revenue is worth

**Source:** neither. **Affects:** 3 of the 57 companies whose forecast buys
plant this way. **Bound:** 2.9% at worst — **noted**.

The forecast buys and releases plant in proportion to revenue: growth capital
spending is the change in revenue times the plant this company carries per unit
of it. For a company whose revenue and plant have moved together, that is a fair
reading of what a bigger or smaller business needs. For one whose two have
parted, it is wrong, and **nothing in the filings says by how much**.

This was `KI-11`, carried as a defect for a fortnight and attacked twice. Six
bounds on capital spending were measured and rejected on 2026-09-22, each
putting the asset base somewhere the company had never been. The revenue line
was fixed on 2026-09-23, which closed the worse tail — a company whose revenue
fell while its plant rose is now refused outright.

**What was left was a question of magnitude, and it cannot be answered from the
filings.** The obvious candidate was the company's own filed elasticity of plant
to revenue: Shell's revenue fell 30.0% across its reported years while its plant
fell 6.8%, an elasticity of 0.23, so scale the proportion by that. Measured on
2026-09-27 across the 57 companies on this rule, it is **worse than the rule it
would replace**: companies ending outside the capital intensity they have
actually carried go from **3 to 21**, and none of the three is fixed — Shell
ends further out, not nearer. The elasticity does not even separate the three:
Shell's is 0.23, Unilever's is 1.04, and Volvo's cannot be measured because its
revenue barely moved. No threshold on it divides the three from the 54 that pass.

So the site names the companies where it shows instead of pretending to a number
it does not have. The test is the one established for the defect: **does the
forecast end inside the band of capital intensity — net PP&E over revenue — that
this company has actually carried?** Where it does not, the constraint is
recorded with the size measured by taking the forecast to the nearest edge of
that band:

| | ends at | its own range | bound |
|---|---|---|---|
| Shell | 70.9% of revenue | 52.1%–69.3% | 2.9% |
| Volvo | 26.1% | 20.0%–25.9% | 0.5% |
| Unilever | 17.7% | 17.8%–22.2% | 0.1% |

All three are marginally outside, and all three are below the 5% bar, so each is
noted rather than warned — the severity follows the measurement, and a company
that one day ends far outside will warn or refuse on the same rule without
anything else changing.

**What would remove it:** nothing a filing contains. How much plant a business
needs when its revenue moves is a question about the business, and the accounts
record only what it did hold.

### A forward multiple nobody publishes

**Source:** neither. **Affects:** every company with a discounted cash flow.
**Bound:** the exit-multiple value moves in proportion; noted rather than
refused, for the reason below.

The exit-multiple method needs the multiple the market would pay for this
business at the end of the forecast. No free source publishes a forward
EV/EBITDA. The peer sets that can be fetched are two to five companies one
vendor associates with this one, on trailing figures — "a starting point, not a
comp set someone would sign off", in the fetcher's own words.

**Deriving the multiple from them was measured and rejected** (2026-09-26). A
peer median comes back for **36 of the 64 valued companies** — not for Apple,
Alphabet, Amazon, BP, GSK, AstraZeneca, BHP, Sony or Tencent, which return no
peers at all — and where it does, it runs from **7.2× to 455.8×**. Applying it
moved the exit-multiple value per share for all 36, by more than 5% for all 36,
by a **median 50%**: Tata Consultancy +2,752% on two peers at 455.8×, Arista
+591% on four at 123×, Micron +371%. The spread between the two terminal
methods, which this site treats as a signal and refuses above 25%, would go from
a median **12% to 45%**. A trailing median of three companies cannot carry a
headline value five years out.

So the multiple stays a flat **12×**, and the site says that rather than
claiming it came from somewhere: `provenance.exitMultiple` states it beside the
value it produces, the football field no longer describes a derived company's
multiple as "taken from the market", and the row carries its own control.

**Why this is noted and not refused.** By the bound alone a figure that moves a
value by a median 50% is a refusal. That rule is for figures the model must
guess and then presents as computed. This one is declared: it is on the page as
an assumption with its own adjuster, its basis is stated next to the number, and
an independent second method — the perpetuity value, built from the company's
own cash flows — is published beside it and does not use the multiple at all.
Withholding a valuation over a number the reader can see and change would be
refusing over a disclosure rather than over a gap in the data.

**What would remove it:** a forward EV/EBITDA consensus, or a comp set chosen
by someone accountable for it.

### A market risk premium and a long-run growth rate, neither of them published

**Source:** neither. **Affects:** every derived company. **Bound:** not
isolated; both move every discounted figure.

The cost of equity needs an equity risk premium, and the perpetuity needs a rate
the economy grows at for ever. The site uses **4.23%** and **2.5%**, flat for
every company. Neither is published as a fact by any free source: an equity risk
premium is an estimate that reputable people disagree about by two points, and a
perpetual growth rate is a judgement about the next century.

They are shown as what they are — assumption rows with their own controls, moved
on the row they sit on, with the sensitivity grid beside the value showing what
happens when they move. What is *not* claimed is that either was derived.

**What would remove it:** nothing a free source publishes. These are judgements,
and the honest treatment is to show them and let the reader move them.

**Where the 4.23% comes from, since 2026-10-29.** It is the **mature-market**
equity risk premium in Damodaran’s country table, whose own page is dated
*Last updated: January 5, 2026*; the table is captured whole into
`src/data/countryRisk.ts`, 178 countries, with that vintage stored beside every
figure. The mature figure is read off the table rather than typed in: the twelve
Aaa sovereigns all carry a country premium of nought and a total premium of
exactly 4.23%. The country premiums are shown on the risk and cost-of-capital
card and **not added to the cost of equity** — see `METHODOLOGY.md` §14 for why
that is a decision rather than an oversight.

**His licence, and Kroll’s.** Damodaran states that his data carries no strings
attached and that permission need not be asked, and asks for acknowledgement;
there is **no licence text to quote**. He is named on the card wherever one of
his figures appears. **Getting his written agreement is a launch-time task**,
not a development one, and it is recorded here so it happens before the site is
public rather than after. **Kroll’s figures are not used at all**: its 5.0% US
premium is paired with a 20-year Treasury, which is a different convention from
ours, and its display terms are unverified. There is no official global equity
risk premium; the OECD’s country risk classification is a classification and
not a premium, and is not used as one.

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

**Source:** Yahoo Finance (the rate). **Affects:** 47 modelled, measured on
2026-10-20.

Where the statements and the listing differ in currency, the price, the previous
close and the 52-week range are converted at the one rate fetched with the
price, because no free source gives the rate on each day of the past year. The
value per share is shown in the trading currency at that same rate, beside the
value in the statements' own currency the model computes (`METHODOLOGY.md` §3).

**And now the whole price chart.** From `payloadVersion.ts` v5 the site keeps
ten years of daily closes, and the company page draws them at that same single
rate. It scales every point by one constant, so the SHAPE of the line — every
rise, fall and drawdown — is exactly the shape the exchange published; what is
at today's rate is the LEVEL, and the axis labels with it. A reader comparing a
price from 2017 against the axis is reading what that price would be worth at
today's exchange rate, not what it was worth then. The ratio overlays carry the
same qualification, because the price in them is this converted one while the
earnings under it are in the statements’ own currency.

**What removes it:** a source of daily historical rates. None of the free ones
reached so far publishes a usable history, which is the same gap that stops the
statements themselves being translated (`METHODOLOGY.md` §3).

**No effect on the value per share**, which is computed in the statements' own
currency. The figure shown beside it in the trading currency moves with the
rate, as the price does, so the premium or discount between the two is
unchanged. The 52-week range is a year of prices at today's rate, so it is
indicative rather than exact. The header says the price is converted and at
what rate; the workbook's Sources sheet records it.

**One company left this constraint on 2026-10-20**, and its price was never
converted between currencies at all: GSK's London listing is quoted in pence
against statements already in pounds, so the only step is the quote's own unit
and no rate is fetched. The note said one had been.

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
| The company's own line captions | **Yes** — the caption is attached to the tag in the filing, which is the whole point of reading one |

The first five are vendor gaps. They are the argument for the data layer stated
in figures rather than in principle.

---

*Written against `e52cdc6` plus the constraint handling added 2026-09-22 and the
acquisition constraint added 2026-09-23, on the payload set of 2026-09-23. Defects are in `KNOWN_ISSUES.md`; the engine is
described in `METHODOLOGY.md`.*
