# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Retail investors, institutional analysts, and professionals at private equity
funds, investment banks, valuation firms and CA firms, anywhere in the world.
Finance students and candidates are one group among them, not the whole of it.
What they share is needing a valuation they can defend: they open a listed
company to see how a three-statement model and DCF are built from its filings,
change the judgements and record why, and take the workbook away to use, extend
or hand to a reviewer.

## Product Purpose

Marginalia values listed companies from what they filed: income statements,
balance sheets and cash flow statements feed a three-statement forecast and a
discounted cash flow, with the equity bridge, sensitivities and a reverse DCF
alongside. Success is a model the user can follow line by line and trust to be
either right about what the filing supports or explicit that it can't say.

## Positioning

- **Refuses rather than guesses.** Where the filing cannot support a valuation
  (a balance sheet that doesn't balance, a missing valuation input, a claim on
  equity with no amount, a listing whose currency or share basis can't be
  established), the company is refused with a stated reason instead of being
  valued on an approximation.
- **All workings visible.** Every forecast figure comes from a named, editable
  assumption, and the whole model exports to a live Excel workbook whose
  formulas recalculate and whose Checks rows must be zero.
- **No verdict.** The gap between the model's value and the market price is
  shown; the product never labels a company buy, hold or sell.

## Operating Context

- Company search and a coverage directory lead into a company; every route into
  a company passes through the qualitative questions first.
- The company view pairs historical statements with the forecast, driver
  sliders, the DCF and bridge, market-approach comparables, residual income for
  banks, and "how it's calculated" views of the working.
- The Excel export is a primary deliverable, not a side feature: users study
  and extend it outside the site.
- Data comes from SEC XBRL filings and Yahoo Finance at request time
  (`api/company.js`), deployed on Vercel.

## Capabilities and Constraints

- Figures a filing does not report are shown as "not reported", never as zero.
- A model with a nonzero balance check is never shown with a valuation.
- Known defects and limitations are tracked in `KNOWN_ISSUES.md`; the modelling
  conventions it is audited against are in `CONVENTIONS.md` and
  `CONVENTIONS_AUDIT.md`. Interface copy must not claim more accuracy than those
  record.
- Terms in use: equity bridge, net debt, minority interests, refusal, reported
  vs forecast years, perpetuity and exit-multiple terminal values.

## Brand Commitments

- Name: Marginalia, from the "financial marginalia": the workings behind the
  headline figures.
- Tagline in use: "A Ledger That Never Lies".

## Evidence on Hand

- Real outputs for the covered companies, reproducible from filings.
- `public/og.png`, favicons and app icons.
- No testimonials, customer names, usage figures or accuracy benchmarks exist;
  future work must not invent them.

## Product Principles

1. The filing is the authority: a number the filing doesn't support doesn't
   appear.
2. Say no out loud: a refusal with its reason beats a plausible-looking value.
3. Show the working: any figure can be traced to its assumption or its filed
   source.
4. Inform, don't advise: present value against price without a recommendation.
