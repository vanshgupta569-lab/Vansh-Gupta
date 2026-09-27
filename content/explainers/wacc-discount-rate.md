# What is WACC, and what does a discount rate actually mean

The weighted average cost of capital, or WACC, is the blended rate of return a company must generate on its assets to satisfy both its lenders and its shareholders, weighted by how much of the company is funded by debt versus equity. In a valuation, this same rate is used as the discount rate — the percentage used to convert future cash flows into today's money, because it represents the return that capital providers require for tying their money up in this particular business.

## Two sources of capital, two costs

A company is typically funded by a mix of debt (borrowed money, such as loans and bonds) and equity (money raised from shareholders, plus retained profit). Each source has a cost. The cost of debt is the interest rate lenders charge, adjusted down for the tax saving that comes from interest being deductible against taxable profit in most jurisdictions — this is called the after-tax cost of debt. The cost of equity is less directly observable, because shareholders aren't paid a fixed rate; instead, it's estimated as the return shareholders would require given the risk of holding the shares, most commonly using the Capital Asset Pricing Model (CAPM).

CAPM calculates the cost of equity as the risk-free rate (the return on a very low-risk government bond) plus the company's beta (a measure of how much the share price moves relative to the wider market) multiplied by the equity risk premium (the extra return investors require for holding shares generally, above the risk-free rate).

## Combining the two into WACC

WACC weights the cost of debt and the cost of equity by their share of the company's total capital, using market values rather than accounting book values for that weighting.

## A worked example

Assume a company has a risk-free rate of 5%, a beta of 1.2, and an equity risk premium of 6%. Cost of equity = 5% + (1.2 × 6%) = 12.2%.

Assume the company's cost of debt is 6%, and it pays tax at 25%. After-tax cost of debt = 6% × (1 − 0.25) = 4.5%.

Assume the company's capital structure, measured at market value, is 70% equity and 30% debt.

WACC = (70% × 12.2%) + (30% × 4.5%) = 8.54% + 1.35% = 9.89%, or roughly 9.9%.

| Component | Weight | Cost | Weighted cost |
|---|---|---|---|
| Equity | 70% | 12.2% | 8.54% |
| Debt (after tax) | 30% | 4.5% | 1.35% |
| WACC | | | 9.89% |

This 9.9% figure is the rate used to discount the company's future free cash flows in a DCF. A higher WACC shrinks future cash flows more, reducing the value placed on cash expected further in the future relative to cash expected sooner; a lower WACC does the opposite.

## What the discount rate is actually doing

Discounting does more than strip out the time value of money — it also folds in risk. A cash flow that is highly uncertain gets discounted at a higher rate than an equally sized cash flow that is close to guaranteed, because a higher rate shrinks it by more. This is why WACC combines a company-specific risk measure (beta) with the general premium investors require for holding risky assets over safe ones: the discount rate is meant to reflect both how much time will pass before the cash arrives and how confident anyone can be that it will arrive as forecast.

## What WACC does not tell you

WACC is built from several inputs that each require a choice rather than a direct observation. Beta can be measured over different time periods or against different market indices and will not come out identical each time. The equity risk premium is an estimate of what investors require across the market as a whole, not a fixed constant. And a company's capital structure — the split between debt and equity — can shift over time, particularly as it borrows more or less, changing WACC along with it.

WACC also does not adjust for risks specific to an individual decision within the company, such as one division being far riskier than another; a single company-wide WACC applied to all of a diversified company's cash flows implicitly treats every part of the business as equally risky, which may not reflect how those cash flows actually behave.
