# Conventions audit

An audit of the engine, the derivation and the Excel export against every item
in [CONVENTIONS.md](CONVENTIONS.md). No code was changed to produce it.

**Files audited**
- `model.js`: `src/engine/model.js`
- `deriveModel.js`: `src/data/deriveModel.js`
- `excelExport.ts`: `src/data/excelExport.ts`
- `excelSheets.ts`: `src/data/excelSheets.ts`

The comparables items are audited against `api/comps.js`, which is the only
place the site builds comparables.

**Two kinds of model.** Most companies are *derived* models, built by
`deriveModel.js` from SEC or Yahoo filings with no analyst input. Apple is the
one *hand-built* model (`src/data/AAPL.js`). Where the two differ, the item says
so.

**What the verdicts mean**
- **Followed**: the convention is implemented.
- **Partly followed**: some of it is implemented and the rest is not.
- **Not followed**: it is not implemented.
- **Not applicable**: the item needs company guidance, management commentary or
  manual research, or it describes a practice for a person keying a
  spreadsheet by hand. This site models from filed data with no analyst input,
  so these items are by design, not gaps.
- **Rule of thumb**: where the checklist marks an item as a rule of thumb, the
  entry says what we do instead and whether the difference is defensible.

**Measurement basis.** Code at `f1d9339`. The payloads are the ones frozen on
2026-09-17 for [KNOWN_ISSUES.md](KNOWN_ISSUES.md): 98 companies modelled, 42
showing a DCF value at default drivers. Every value change quoted is the
headline value per share (both terminal methods weighted equally).

Figures come from two places:
- **Existing measurements** from KNOWN_ISSUES.md, marked "KI #n".
- **New read-only recomputations** from the engine's own outputs: WACC weights,
  the discounting convention, the gap between the two terminal values, and the
  margin method.

Some figures are recorded as "not measured". In each case the payloads do not
carry the data needed, such as betas, cover-page share counts, option tables,
lease liabilities or deferred tax detail.

---

## Failures, by how much each would change a valuation

Everything marked *not followed* or *partly followed* below, ordered by its
largest measured effect on a displayed value. Items that cannot move a value
come last, together.

| # | Convention (section) | Type | Companies | Worst example | Value moved |
|---|---|---|---|---|---|
| 1 | Conservative method as default when choosing a cost driver (IS 7) | Rule of thumb; kept by design (KI D1) | 31 of 42 valued would change | AMD, GILD, STX; ARM, MRVL, PLTR would be refused | median −11.5%; 23 lower by >10%, 10 by >25%; worst −95.9% |
| 2 | Consistent definition of "core operating" EBITDA across the comp set and the exit multiple (Comps 4; DCF 12) | Hard rule | 22 valued (SBC >5% of EBITDA) | Arm, SBC 47.6% of EBITDA | exit-multiple value −36.3%; EV/EBITDA method overstated 90.9% (KI #2) |
| 3 | EV to equity deducts non-controlling interests and preferred securities (DCF 15) | Hard rule | 14 valued with NCI | Reliance Infrastructure | up to 48.1% of value; fixed after this audit: minority interests and preferred stock now come off enterprise value |
| 4 | Depreciation schedule: existing PP&E vs capex vintages, useful lives, historical plausibility check (Dep 6, 8) | Hard rule / rule of thumb | 15 of 82 valued move >5% | Amazon −24.2%; Toyota Tokyo +23.8% | the rate is now read from filed depreciation (fixed after this audit); vintages and lives are not (KI #4) |
| 5 | Net debt covers all interest-bearing debt and all cash (DCF 15; Debt 2) | Hard rule | 15 valued (securities) | Alibaba | up to 39.7% of value (upper bound, KI #3); leases and short-term borrowings not measured (KI #18) |
| 6 | A material gap between the exit-multiple and perpetuity values is investigated, not averaged (DCF 14) | Hard rule | 23 of 42 more than 10% apart; 12 more than 25% | TotalEnergies 77.9% apart; Amazon 52.0% | choosing either method alone moves the headline by half the spread: median ±8%, up to ±39% |
| 7 | WACC weights debt and equity at market value (DCF 7) | Hard rule | 42; 13 have a *negative* debt weight | Alibaba WACC 7.1% → 5.9% on gross debt | median +1.2%; Alibaba +21.2%, Amphenol +9.8% |
| 8 | Explicit end-of-year or mid-year discounting choice, applied consistently (DCF 1) | Judgment call | every company | first forecast year is a full year's cash flow discounted over 0.29 years | mid-year: median +4.3% (max +5.4%); pro-rating the first year: median −1.5% (max −5.3%) |
| 9 | Diluted shares by the treasury stock method; basic shares from the cover page (IS 18, 19; Comps 10) | Hard rule | every derived company | Apple (hand-built): cover 14,656.1 vs diluted 14,714.7 | not measured; value per share moves one-for-one with the count |
| 10 | Consistent tenor for risk-free rate, beta and market risk premium; comparable betas unlevered and relevered (DCF 9, 10) | Preference | every derived company | beta 1.0 for all, so every derived company has the same cost of equity | not measured (no betas in payloads) |
| 11 | Deferred taxes added back; DTL from tax depreciation; NOL carryforwards (CF 3; Dep 10, 11) | Hard rule | every company | — | not measured (deferred tax detail not fetched) |
| 12 | Working capital: narrow operating definition, days metrics on average balances, each item mapped to its own driver (WC 1, 2, 4, 5) | Hard rule | every company | payables driven by COGS on the site, by revenue in the workbook | small; not isolated |
| 13 | Other income sits in its own section with a documented above/below-EBIT decision; non-recurring items separated (IS 11, 14, 17) | Hard rule / rule of thumb | 18 valued with >10% non-operating pretax | AbbVie | through the tax rate: ~1.2% of value per point (KI #9) |
| 14 | Capex projected from guidance, not a percentage of revenue alone (CF 6) | Rule of thumb | every derived company | — | not measured |
| 15 | Items that cannot move a value | — | — | — | none on value: listed below |

**The items in row 15** each appear in their section below with a reason. None
moves a DCF value, because unlevered free cash flow and the equity bridge do not
depend on them.
- IS 13, 15, 16: the order of the income statement chain, margins beside each
  subtotal, the distributions section.
- IS 21: backing into reported EPS.
- CF 7, 8: dividends per share; buybacks set by default instead of extrapolated.
- WC 9: a total working capital match check.
- BS 2 (reported years), BS 6: reported cash flows derived from balance sheets;
  a differences column.
- Debt 3, 5, 6, 8, 13, 14: debt tranches, mandatory and discretionary lines,
  average-balance interest by default, the interest split, the sweep toggle,
  the revolver cap.
- Comps 1–3, 7–9, 11: LTM, calendarization, missing quarters. These change the
  market approach, not the DCF, and were not measured.
- FD 2: DCF sheet rows placed by number in the generator.

**Recorded in KNOWN_ISSUES.md.** Row 6 is KI #5, row 7 is KI #6, row 8 is
KI #8, the site-vs-workbook working capital drivers in row 12 are KI #11, and
the undocumented minimum cash buffer (Debt 10) is KI #16. Row 1 is recorded
there as design choice D1, with its measured effect, not as a defect: the last
reported year is a defensible choice and the conservative default is a rule of
thumb.

---

## Income statement

| # | Item | Verdict | Reason |
|---|---|---|---|
| IS 1 | Revenue by stream, summed | Partly followed | Hand-built Apple builds five segments and sums them (`model.js:60-85`). Derived models use a single revenue line because segment detail is not machine-readable from free sources, and the model says so (`deriveModel.js`, `provenance.segments`). |
| IS 2 | Historical growth as a formula | Followed | The revenue growth row is a formula on prior and current revenue cells in reported years (`excelExport.ts:546-560`). |
| IS 3 | Projected revenue off a growth input cell | Followed | Revenue = prior × (1 + growth input) (`excelExport.ts:546`; `model.js:85`). |
| IS 4 | Growth sanity-checked against consensus or guidance | Not applicable | Needs consensus, guidance or an investor presentation, which this site does not use. Derived growth is the trailing compound rate capped at −10% to +25% (`deriveModel.js:579`). Rule of thumb: the cap is our only outside discipline. That is defensible for a no-input model, but it is not a cross-check. |
| IS 5 | Costs classed fixed/variable; variable costs as % of revenue | Followed | Every cost line is modelled as a percentage of revenue, which treats it as variable (`model.js:381-440`). Nothing is modelled as fixed. |
| IS 6 | Driver from a defined menu, method recorded | Followed | Derived models use the last reported year and record it (`deriveModel.js:594-614`, `provenance.grossMargin`/`operatingCosts`). Hand-built Apple names its methods in the data file (`avgOfHistory`, `avgOfFirstAndLast`). |
| IS 7 | Conservative method as default when close | **Not followed** (rule of thumb) | We use the last reported year, which is not the conservative choice. The minimum of the reported years would lower the median value by 11.5% and refuse 3 more companies. Defensibility: the recorded reason is sound for companies whose shape has changed (Nvidia's average margin describes no year that ever existed). Its cost is that a company whose last year is a peak is valued at that peak. Recorded as a design choice (KNOWN_ISSUES.md D1), not a defect. Failures #1. |
| IS 8 | D&A found and broken out of host lines | Followed | Filed D&A comes from the cash flow statement. It is charged as its own line (`model.js:381-440`) and shown as "Less: depreciation & amortization" (`excelExport.ts:613`). |
| IS 9 | Host line reduced by the D&A inside it | Followed | Each filed cost line gives up its pro-rata share of D&A and SBC, and forecast margins are converted by the share embedded in the last reported year (`model.js:428-439`). The Checks sheet confirms operating profit still ties (`excelSheets.ts:310-318`). |
| IS 10 | Unclear COGS/SG&A split treated as immaterial if EBITDA is right | Followed (rule of thumb) | The split is pro-rata by line size, not researched. The model says so in a note (`excelExport.ts`, note under the as-filed memo). EBITDA is unaffected by the split. Defensible. |
| IS 11 | Other income in its own section, above/below EBIT documented | Partly followed | Other non-operating income is its own line below EBIT (`model.js:461-472`; `excelExport.ts` `other` row). Equity-method income, FX and the like are not separated: they are one residual, and the decision is not documented beyond the derivation note. The forecast sets it to zero (`deriveModel.js:683`). |
| IS 12 | Interest sign convention confirmed against filings | Followed | Filed interest is normalised to an expense with `-Math.abs` (`deriveModel.js:412`) and carried in the same sign in the forecast (`model.js:519`). One exception: Disney files the tag negative; it is carried as an expense, and Disney is refused. |
| IS 13 | EBITDA → D&A → EBIT → interest → EBT → tax → NI chain, margin beside each | Partly followed | The chain runs revenue → cost lines → less D&A and SBC → EBIT → interest → pretax → tax → net income. EBITDA is a memo line below it, not the top of the chain (`excelExport.ts:724`). Margins are on the Ratios sheet for gross, operating, EBITDA and net, but not pretax, and not beside the subtotals (`excelSheets.ts:146-151`). No value effect. |
| IS 14 | Non-recurring items below clean net income | Not applicable | Identifying non-recurring items needs footnotes and management commentary. Filed tags do not flag them. Whatever is non-operating sits in "other income" below EBIT, so EBIT and EBITDA exclude it by construction. |
| IS 15 | As-reported net income kept for reconciliation | Followed | "Net income, as filed" memo row (`excelExport.ts:751`) and a Checks row, "Net income = net income as filed" (`excelSheets.ts:326-332`). It ties for 95 of 98 companies. |
| IS 16 | Distributions section between adjusted and reported NI | Not followed | Non-controlling interests and discontinued operations are one combined "items after tax" line (`model.js:458-471`). Dividends are in the equity schedule, not the income statement. No value effect. |
| IS 17 | Non-recurring items not projected | Followed (rule of thumb) | Other income and items after tax are forecast at zero (`deriveModel.js:683`; `model.js:520-523`). This is the book's default. |
| IS 18 | Basic shares from the cover page | **Not followed** | The derived "basic" count is the filed diluted weighted-average count (`deriveModel.js:499`). Payloads carry no cover-page figure (`dei:EntityCommonStockSharesOutstanding` is not fetched). Hand-built Apple uses the cover figure. Failures #9. |
| IS 19 | Diluted shares by treasury stock method | **Not followed** | The derived diluted count is the filed weighted-average diluted count (`deriveModel.js:765`). The forecast holds dilution at a constant absolute impact (`model.js:745`). The filed count already includes the company's own TSM, but on a weighted average, not at the valuation date. Failures #9. |
| IS 20 | EPS on reported NI over basic and diluted shares | Followed | `basicEPS = NI / basic`, `dilutedEPS = NI / diluted`, where NI is after items after tax in reported years (`model.js:720-724`). |
| IS 21 | Back into reported EPS to confirm convention | Not followed | Filed EPS is not fetched, so there is nothing to back into. No value effect: EPS is not a valuation input. |
| IS 22 | Blue inputs, black formulas | Followed | Hard-codes and inputs use blue font (`excelExport.ts:167`), formulas black (`:182`); green marks cross-sheet links, which is a standard extension. |

## Cash flow statement

| # | Item | Verdict | Reason |
|---|---|---|---|
| CF 1 | Three sections with subtotals and total change in cash | Followed | Operating, investing, financing, each with a total, plus the change in cash (`excelSheets.ts:684-722`; `model.js:613-633`). |
| CF 2 | CFO starts from NI before distributions | Partly followed | The forecast starts from net income before dividends, and forecast items after tax are zero, so it is the same figure. In reported years CFO starts from net income *after* non-controlling interests (`model.js:617`), because the filing's "net income" is attributable to parent. The workbook's reported CFO is derived, not filed (KI #14). |
| CF 3 | Every material non-cash item added back and documented | **Partly followed** | D&A, SBC and PIK interest are added back and labelled (`excelSheets.ts:687-690`). Deferred taxes are not: there is no deferred tax expense line, and the deferred tax asset moves as a working capital line at a % of revenue (`excelExport.ts:845`). Failures #11. |
| CF 4 | CF D&A linked from the IS D&A line | Followed | The cash flow D&A links the model's `da` row, which the income statement charges through `daCost` and which is itself built from the PP&E and amortisation schedules (`excelExport.ts:613, 724`). |
| CF 5 | Unscheduled CF items from a defined, documented method | Followed | Dividends use the average payout, buybacks the average % of a ceiling, and other income zero. Each method is named in `provenance` (`deriveModel.js:646-672`). |
| CF 6 | Capex off guidance, cross-checked with % of revenue | Not applicable in part; the rest rule of thumb | Guidance needs management commentary: not applicable. What we do instead: the average capex % of revenue across the reported years, capped at 40% (`deriveModel.js:636-644`), with no second reference. Defensible as a no-input default. The average softens lumpiness, but it will miss a planned step-change such as an AI data-centre build-out. Failures #14. |
| CF 7 | Discretionary items flagged, defaulted conservatively (often zero) | Not followed (rule of thumb) | Buybacks are extrapolated as the average % of the historical ceiling (`deriveModel.js:717-721`; `model.js:580`), not defaulted to zero. Defensibility: harmless to value, because buybacks sit below unlevered free cash flow. They do drive forecast cash, the revolver, and (switch on) interest. Zero would be the more honest no-research default. |
| CF 8 | Dividends = shares × DPS | Not followed | Dividends = payout ratio × net income (`model.js:563`; `deriveModel.js:650-658`). DPS from disclosure is not fetched. No value effect. |
| CF 9 | Debt lines linked from the debt schedule | Followed | Term-debt and revolver financing lines link `debtBorrow` and `revDraw` from the debt schedule (`excelSheets.ts:711-712`). Capital leases are not modelled (see Debt 2). |
| CF 10 | WC lines linked from the schedule's changes, asset signs flipped | Followed | Each working capital line links the schedule's change with `flip: -1` on assets (`excelSheets.ts:681, 691-700`). |

## Depreciation

| # | Item | Verdict | Reason |
|---|---|---|---|
| Dep 1 | Straight-line = cost less residual ÷ life | Not followed | There are no useful lives. Depreciation = capex × a historical depreciation-to-capex ratio (`model.js:224-256`; `excelExport.ts:863`). Failures #4. (The rate has since been changed to filed depreciation over capital spending, with a refusal where it cannot be forecast from; useful lives and vintages are unchanged.) |
| Dep 2 | Accelerated method only for tax depreciation | Not applicable | Tax depreciation needs asset-level tax basis data that filings do not disclose. The model keeps no tax books. |
| Dep 3 | Declining-balance rate mechanics | Not applicable | As Dep 2. |
| Dep 4 | Sum-of-the-years'-digits mechanics | Not applicable | As Dep 2. |
| Dep 5 | MACRS mid-quarter default | Not applicable (rule of thumb) | As Dep 2: no placed-in-service data exists in filings. |
| Dep 6 | Existing PP&E separated from each capex vintage | **Not followed** | One pool: this year's depreciation tracks this year's capex, not the assets in service (`model.js:256`). Amortisation of intangibles is separated and runs off (`model.js:273`), which is the one split we make. Failures #4 (KI #4). |
| Dep 7 | Opening PP&E linked from prior ending | Followed | `ppeBop` links the prior `ppeEnd` (`excelExport.ts` PP&E block; `model.js:210-260`). |
| Dep 8 | Separate useful-life cells; projected depreciation checked against history | **Not followed** (rule of thumb) | There are no useful-life cells, and the forecast is not checked against historical depreciation growth. Instead we use one depreciation-to-capex ratio from the PP&E roll-forward, which counts disposals, leases and acquisitions as depreciation (Amazon came out at -91.8% of capital spending). Defensibility: a filed-data model cannot see asset lives, so a ratio is defensible. A roll-forward ratio with no plausibility check is not. A net PP&E ÷ D&A implied life, checked against filed D&A growth, is available from filed data. Failures #4. (The rate has since been changed to filed depreciation over capital spending, with a refusal where it cannot be forecast from; useful lives and vintages are unchanged.) |
| Dep 9 | Fixed useful life anchored with absolute references | Not applicable | There is no useful-life cell to anchor (Dep 1). The depreciation rate is a per-year input row, not a copied constant. |
| Dep 10 | DTL = (accelerated − straight-line) × tax, added back | Not applicable | Needs tax depreciation (Dep 2). The filed deferred tax *expense* that would stand in for it is covered under CF 3. |
| Dep 11 | NOL deferred tax asset via carryback/carryforward | Not followed | No NOL schedule: forecast tax = pretax × rate, so a loss year gets a tax credit (`model.js:521`). Carryforward balances are tagged in filings but not fetched. Effect is limited today, because a negative operating profit refuses the DCF. Failures #11. |

## Working capital

| # | Item | Verdict | Reason |
|---|---|---|---|
| WC 1 | Narrow definition: ex cash, ex interest-bearing debt | Partly followed | Cash and debt are excluded. But deferred tax assets, other assets and other non-current liabilities also move through the working capital block and unlevered free cash flow (`model.js:154-208`, `:1062-1073`), and other current assets can hold marketable securities (KI #3). Failures #12. |
| WC 2 | Only operating items, each on its own driver | Partly followed | Receivables → revenue and inventory → COGS are followed. Accrued expenses → revenue, not SG&A. Payables → COGS on the site (`deriveModel.js:702`) but revenue in the workbook (`excelExport.ts:842`), and other current assets → COGS on the site but revenue in the workbook. There is no accrued-tax line. Failures #12. |
| WC 3 | Non-recurring/discontinued items excluded | Not applicable | Identifying held-for-sale or discontinued balances needs footnote research. Filed current-asset tags are taken as reported. |
| WC 4 | Historical days on average balances × 360 | Not followed | The Ratios sheet computes DSO, DIO and DPO on period-end balances × 365 (`excelSheets.ts:178-195`), and DPO is on revenue, not COGS. No value effect: the ratios are display only. |
| WC 5 | Projected balances from constant days, not % growth | Not followed | Balances grow with revenue or COGS growth (`model.js:154-208`). The workbook holds them as a % of the driver (`excelExport.ts:840-847`). Constant % of the driver on period-end balances is arithmetically the same as constant period-end days, so the forecast is equivalent to the convention in all but name and the average-balance basis. |
| WC 6 | Historical average formula not copied into projections | Followed | The forecast uses a forward % of the driver, never the historical ratio formula (`excelExport.ts:797-835`). |
| WC 7 | Asset changes enter CF sign-flipped | Followed | `-change` for asset lines (`model.js:617-630`; `excelSheets.ts:681`). |
| WC 8 | Liability changes enter CF unflipped | Followed | `+change` for payables, accrued and other non-current liabilities (`model.js:623-629`). |
| WC 9 | Each CF WC line checked off; total match check | Partly followed | Every schedule has a roll-forward check (`excelSheets.ts:358-366`), and the cash tie proves nothing is double-linked. There is no row confirming the sum of individual changes equals the total change in operating working capital. |

## Balance sheet

| # | Item | Verdict | Reason |
|---|---|---|---|
| BS 1 | Each line tied to the CF item(s) that drive it, with direction | Followed | Every forecast balance is beginning + movement = end, with the movement taken from the cash flow line (`model.js:635-703`; `excelExport.ts` `bopRow`/`eopRow`). |
| BS 2 | CF drives BS (not BS differencing) | Partly followed | Forecast years are CF-driven. Reported-year cash flows in the workbook are derived by differencing filed balance sheets, which the Cash Flow sheet says in a note (`excelSheets.ts:720-723`; KI #14). |
| BS 3 | Sign convention: assets opposite, cash/liabilities/equity same | Followed | The Checks sheet's balance and cash tie rows are zero across all scenarios (`excelSheets.ts:336-352`). |
| BS 4 | Each CF item used exactly once | Followed | The cash tie "change in cash = CFO + CFI + CFF" and the balance check would both break on an omission or duplicate. Both are zero. |
| BS 5 | Imbalance diagnosed into four error types | Partly followed | No diagnosis is written up, but the per-schedule roll-forward checks isolate an omitted, duplicated or mis-signed link to one line (`excelSheets.ts:356-406`). Derived models whose balance check is nonzero are refused outright (`model.js`, `balanceSheetRefusal`). |
| BS 6 | "Differences" column to locate imbalances | Not followed | No differences column. No value effect: nonzero balance checks refuse the valuation. |
| BS 7 | Consistent prior ± driver formula pattern | Followed | Every end-of-period row is `bop + movement` (`excelExport.ts` `eopRow`), so a visual scan catches a wrong sign or column. |

## Debt schedule

| # | Item | Verdict | Reason |
|---|---|---|---|
| Debt 1 | Built last, once the balance sheet balances | Followed | The circularity switch defaults to off, so the model balances without the loop; only switching it on closes the loop (`excelExport.ts:513-536`). The build order is fixed in code, not a manual step. |
| Debt 2 | Every debt instrument has a section | **Not followed** | Only long-term debt and a revolver are tracked (`model.js:482-508`). Short-term borrowings, the current portion of long-term debt and lease liabilities are not (KI #12, #19). Failures #5. |
| Debt 3 | Each tranche modelled separately | Not followed | One blended long-term debt balance. The filings the site reads do not tag tranches. Defensible for filed data, but unstated in the workbook. |
| Debt 4 | Tranche opening balance linked from prior ending | Followed | `debtBop` and `revBop` link the prior ending balance (`excelExport.ts:914-978`; `model.js:500`). |
| Debt 5 | Mandatory and discretionary lines kept separate | Partly followed | "Additional borrowing / (pay down)" (input) is separate from the automatic revolver draw (`excelExport.ts:914, 970`), so the sweep cannot overwrite it. There is no contractual maturity schedule: derived models hold debt flat (`deriveModel.js:715`) because maturity ladders are not machine-readable. |
| Debt 6 | Interest on average balance × rate | Partly followed | Workbook: opening balance with the switch off (the default), average with it on (`excelExport.ts:629-680`). Site engine: a fixed dollar amount, 4.5% of average reported debt (`deriveModel.js:669`; `model.js:505`). No DCF effect (KI #10). |
| Debt 7 | Blended rate for sub-tranches, weighted by principal | Not applicable | Needs coupons per tranche from the debt footnote, which is manual research. We apply an assumed 4.5% (`deriveModel.js:669`). |
| Debt 8 | Total interest = sum of tranches; company's split mirrored | Partly followed | Interest expense = term debt cash interest + PIK + revolver interest (`excelExport.ts:669-676`). The filing's split (e.g. finance-lease interest) is not mirrored. |
| Debt 9 | "Cash flow before debt paydown" feeds the debt schedule | Followed | Cash available = opening cash − minimum cash + CFO + CFI + non-revolver financing (`model.js:643-655`; `excelExport.ts:959-975`). |
| Debt 10 | Minimum cash buffer subtracted, basis documented | Partly followed (rule of thumb) | The buffer is subtracted. Derived models set it at 50% of last reported cash (`deriveModel.js:730`), but unlike every other derived assumption it has no `provenance` entry. The covenant basis is not applicable (needs credit agreement research). 50% is a judgment call, defensible, but undocumented. |
| Debt 11 | Interest income on average cash × conservative rate | Partly followed (rule of thumb) | The workbook charges the return on cash on the same opening/average switch as debt (`excelExport.ts:629-640`). The default rate is 0%, the most conservative choice. The site engine sets forecast interest income to zero (`model.js:517`). Defensible, and no DCF effect. |
| Debt 12 | Debt schedule ending cash checked against BS cash | Followed | Checks sheet: "Change in cash = CFO + CFI + CFF", and the balance check (`excelSheets.ts:342-352`). |
| Debt 13 | Automatic paydown with MIN and an on/off toggle | Partly followed | `-MIN(opening revolver, cash available)` draws when short and repays from surplus (`model.js:655`; `excelExport.ts:970`). There is no toggle to disable the sweep; the circularity switch changes the interest basis only. |
| Debt 14 | Revolver draw capped at facility limit | Not followed | No capacity input; the revolver draws without limit. Facility size is a footnote item, so the cap value itself would not be applicable, but there is no cell for it. |

## Circular references

| # | Item | Verdict | Reason |
|---|---|---|---|
| Circ 1 | Circularity understood as intentional | Followed | The note beside the switch sets out the loop (`excelExport.ts:522-536`). |
| Circ 2 | Iterative calculation on, ~100 iterations | Followed (rule of thumb) | `iterate="1" iterateCount="100" iterateDelta="0.001"` is written into the file (`src/data/excelIterativeCalc.ts:32-33`). This is the book's default. |
| Circ 3 | Error propagation through the loop understood | Not applicable | This is troubleshooting practice for someone keying cells by hand. The workbook is generated rather than keyed, and during development each scenario was recalculated and checked for error cells. The switch lets a user break the loop if they introduce one. |
| Circ 4 | Corrections undone cleanly, not patched | Not applicable | As Circ 3: a hand-editing practice. |

## DCF

| # | Item | Verdict | Reason |
|---|---|---|---|
| DCF 1 | Explicit end-of-year vs mid-year choice, applied consistently | **Partly followed** (judgment call) | One convention is applied consistently to every year and both terminal values: each year's cash flow is discounted from the valuation date to its fiscal year-end (`model.js:1085`; `excelExport.ts` rows 27-28). But it is not stated as a choice. The first forecast year's *full* cash flow is discounted over the fraction of the year left (0.29 years at the frozen date), while net debt is taken at the last reported year-end, so the cash flows and the balance sheet are timed from different dates (KI #8). Mid-year would add a median 4.3%; pro-rating the first year would take off a median 1.5%. Failures #8. |
| DCF 2 | Projection length a judgment call | Followed | Five years, as a named constant (`deriveModel.js`, `FORECAST_YEARS`), within the common 5-7. |
| DCF 3 | UFCF starts from EBIT | Followed | EBIAT = EBIT × (1 − tax) (`model.js:1056`; `excelExport.ts` row 11). |
| DCF 4 | Adds D&A, deferred taxes, non-cash items and CF-statement WC; subtracts capex | Partly followed | D&A, SBC and working capital from the model's cash flow statement are added and capex subtracted (`model.js:1059-1083`; `excelExport.ts` rows 12-15). Deferred taxes are not a separate add-back (CF 3). |
| DCF 5 | Unlevered tax = EBIT × rate | Followed | `M.ebit[i] * (1 - M.taxRate[i])` (`model.js:1056`). The rate itself is a filed ratio on a different pretax base (KI #9), which the convention does not address. |
| DCF 6 | Non-cash adjustments cross-checked against CF treatment | Followed | SBC is in UFCF because the cash flow statement adds it back (`model.js:617-631`). Deferred tax and other non-current movements are excluded from the terminal year only, with the reason in the data file (`deriveModel.js:777`). |
| DCF 7 | WACC on market-value weights, after-tax debt | **Not followed** | Cost of debt is tax-effected and equity is at market value. But the "debt" weight is *net* debt, `netDebt / (marketCap + netDebt)` (`model.js:1229-1231`), so 13 of 42 valued companies carry a negative debt weight and an equity weight above 100%. Gross debt at book value (market value is not available from filings) would move the median value by +1.2%, Alibaba by +21.2%. The workbook hard-codes the engine's weights as inputs (`excelExport.ts` rows 24-25). Failures #7. |
| DCF 8 | CAPM cost of equity | Followed | rf + β × MRP (`model.js:1227`; `excelExport.ts` row 22). |
| DCF 9 | Consistent tenor across rf, beta and MRP | **Not followed** (preference) | rf 4.5%, MRP 4.23% and β 1.0 for every derived company (`deriveModel.js:780-783`). No beta lookback exists and no tenor is stated. The 1.0 beta is recorded in `provenance.wacc`. Defensibility: β = 1.0 is an honest no-data default, and the provenance says so. But it gives every derived company the same cost of equity, which is a larger simplification than any tenor mismatch. Failures #10. |
| DCF 10 | Comparable betas unlevered, averaged, relevered to target | Partly followed | Implemented with tax and D/E (`model.js:1218-1226`), but relevered on net debt (DCF 7). No derived model has comparables (`deriveModel.js:787`), and hand-built Apple uses its stated beta (`AAPL.js:186`), so the path is never taken. |
| DCF 11 | Unlever/relever formula uses tax and D/E | Followed | `β_u = β_e × E / ((D − C)(1 − t) + E)` and its inverse (`model.js:1220-1224`). Net rather than gross debt, as DCF 7. |
| DCF 12 | Both TV methods, discounted consistently | Followed | Both are built and discounted at the same WACC and final-period factor (`model.js:1094-1143`; `excelExport.ts` rows 33-44). The exit multiple is a flat 12x for derived companies (`deriveModel.js:776`). |
| DCF 13 | Perpetual growth low, tied to GDP/inflation | Followed for derived; not followed for Apple (rule of thumb) | Derived models use 2.5%, provenance "a flat default". It sits inside long-run nominal GDP and inflation, so it is defensible. Hand-built Apple uses 4.0% (`AAPL.js:170`), carried from its source workbook. That is at or above long-run nominal GDP for a perpetuity, and hard to defend. |
| DCF 14 | Divergence between TV methods investigated, not averaged | **Not followed** | The headline averages the two methods (`TerminalDashboard.tsx:505-518`; `excelExport.ts` row 53). The spread is shown (row 54, and the football field) but never investigated. A large spread triggers no flag or refusal. Median spread 15.9%; 12 of 42 above 25%. Failures #6. |
| DCF 15 | EV − net debt − NCI − preferred, ÷ diluted shares | **Not followed** | `equityValue = enterpriseValue − netDebt` only (`model.js:1169-1170`; `excelExport.ts` rows 47-51). No NCI (up to 48.1%) and no preferred at the time of this audit; both have since been deducted. Cash excludes marketable securities (KI #3). Leases are excluded (KI #17). Failures #3 and #5. |

## Comparables (`api/comps.js`)

| # | Item | Verdict | Reason |
|---|---|---|---|
| Comps 1 | LTM from annual + interims − prior interims | Not followed | We take Yahoo's trailing figures (`comps.js:196-200`) rather than building LTM from filings. Trailing is the right basis, but it is not constructed or checked. |
| Comps 2 | Calendarize to target's fiscal period | Not followed | No calendarization; peers' trailing periods are used as-is. |
| Comps 3 | Most granular data (rule of thumb) | Not followed (rule of thumb) | Only what the provider gives. Defensible for a free-data source, but not a choice we make. |
| Comps 4 | Non-recurring items reclassified consistently across the set | **Not followed** | The subject's EBITDA adds SBC back (`model.js:526-528`); peers' provider EBITDA does not. Identifying non-recurring items would not be applicable (research), but the SBC inconsistency is ours. Failures #2 (KI #2). |
| Comps 5 | Tax effect of reclassified items net of tax | Not applicable | Depends on identifying non-recurring items (Comps 4), which needs research. |
| Comps 6 | Unclear depreciation split immaterial if EBITDA right (rule of thumb) | Followed (rule of thumb) | Provider EBITDA is taken as stated; the split is not modelled. Defensible. |
| Comps 7 | Missing quarter = full year − interims for flows | Not followed | No quarterly data is fetched. No value effect on the DCF. |
| Comps 8 | Missing-quarter rates recomputed, not subtracted | Not followed | As Comps 7. |
| Comps 9 | Share count as point-in-time | Not followed | As Comps 7. The provider's market capitalisation is used. |
| Comps 10 | Peer diluted shares by TSM | Not followed | The provider's market capitalisation is taken as given (`comps.js:196`). Same gap as IS 19. |
| Comps 11 | Peer EV from diluted equity + all debt + preferred + NCI − cash | Not followed | The provider's `enterpriseValue` is taken as given (`comps.js:197`), with no rebuild. Off-balance-sheet research would not be applicable. |
| Comps 12 | Multiple bases paired correctly | Followed | EV/EBITDA and EV/Sales on enterprise value; P/E on price (`comps.js:203-223`). |
| Comps 13 | Same three time bases across the set | Partly followed | Trailing only, the same for every peer (`comps.js:22-23`). Forward estimates are not applicable (consensus data); fiscal-year multiples are not built. |

## Formula discipline

| # | Item | Verdict | Reason |
|---|---|---|---|
| FD 1 | Absolute vs relative references chosen deliberately | Followed | The switch (`$E$n`, `excelExport.ts:515`), WACC (`$F$26`, row 28) and embedded non-cash share are anchored; period formulas are relative. |
| FD 2 | Cells located by reference, not by counted positions | Partly followed | The model and supporting sheets resolve every row by key through a two-pass registry. The DCF sheet places rows at fixed numbers (`vRow(9…)` to `vOne(56…)`) and its formulas name those numbers (`excelExport.ts:1159-1253`). A generated workbook stays correct, because Excel re-points references when a user inserts a row. But a code change to the DCF layout can silently break them. |
| FD 3 | Blue inputs, black formulas across the whole model | Followed | Same styling helpers on every sheet (`excelExport.ts:82-84, 160-185`; the cover legend at `:255-263`). |
| FD 4 | Period-specific assumptions get their own cells | Followed | Every driver is a per-year input row (`excelExport.ts` `driver(...)`), not a copied constant. There are no per-vintage useful lives because there are no vintages (Dep 6). |
| FD 5 | Judgment calls documented in the model | Mostly followed | Notes beneath each block (the D&A split, amortisation run-off, revolver, circularity) and the per-assumption `provenance` on the Sources sheet (`deriveModel.js:560-795`). Gaps: the minimum cash buffer (Debt 10) and the averaging of the two terminal values beyond "weighted equally". |
