# What is terminal value, and why is it most of a valuation

Terminal value is the estimated value of all the cash flows a business is expected to generate after the final year of an explicit forecast period, discounted back to today and added into a valuation alongside the forecasted years themselves. It typically accounts for a large share of a discounted cash flow valuation's total value, because it stands in for every year of cash flow after the forecast period ends, rather than only the handful of years the forecast explicitly covers.

## Why a forecast has to stop somewhere

A business, in principle, might keep generating cash indefinitely, but forecasting revenue, costs, and investment year by year becomes less reliable the further into the future it extends. Most discounted cash flow (DCF) models therefore build an explicit forecast for a limited number of years — often five to ten — and then use terminal value to capture everything beyond that point in a single figure, rather than attempting to forecast individual years indefinitely.

## Two common methods

The perpetuity growth method assumes that, after the forecast period, free cash flow grows at a constant rate forever. Terminal value is calculated as the final forecast year's cash flow, grown by one more year at the assumed long-term rate, divided by the discount rate minus that growth rate: terminal cash flow ÷ (discount rate − growth rate).

The exit multiple method instead assumes the business is sold at the end of the forecast period for a multiple of a financial metric at that time, commonly EV/EBITDA (covered in a separate article). Terminal value is calculated as that final year's EBITDA multiplied by an assumed exit multiple.

Both methods produce a single lump-sum figure sitting at the end of the forecast period, which is then discounted back to the present using the same discount rate applied to the earlier forecast years.

## A worked example

Take a company with free cash flow of £68.0 million in the final year (year five) of its forecast, a discount rate of 10%, and an assumed long-term growth rate of 3% for the perpetuity growth method.

Year six's cash flow = £68.0m × 1.03 = £70.0m.

Terminal value = £70.0m ÷ (0.10 − 0.03) = £70.0m ÷ 0.07 = £1,000 million.

That £1,000 million sits at the end of year five, so it is discounted back to the present using the year-five discount factor of 0.621 (1 ÷ 1.10⁵), giving a present value of roughly £621 million.

If the present value of the explicit five-year forecast in this example totals £219 million, the terminal value's present value of £621 million makes up roughly 74% of the total enterprise value of £840 million.

For comparison, using the exit multiple method: if year-five EBITDA is £100 million and an exit multiple of 8x is assumed, terminal value = £100m × 8 = £800 million, discounted back at the same factor of 0.621 to a present value of roughly £497 million — a different result from the £621 million produced by the perpetuity growth method above, despite both methods describing the same moment in the company's future.

## Why the terminal value dominates

The reason terminal value typically makes up most of a DCF's total isn't a quirk of any one example — it follows from what the terminal value represents. The explicit forecast covers a handful of years, while the terminal value stands in for every year after that, discounted back but still summing an unlimited stream of future cash flow into one number. Because the terminal value formula divides by (discount rate − growth rate), a denominator that can be a fairly small number, relatively modest cash flows late in the forecast can translate into a very large terminal figure.

## What terminal value does not tell you

Terminal value is highly sensitive to the growth rate and discount rate used, precisely because both sit in the denominator of the perpetuity formula. A shift of a single percentage point in either figure — easily within the range of reasonable disagreement between two people looking at the same company — can move the terminal value, and therefore the overall valuation, by a large percentage. It also carries an implicit assumption that whatever margins, growth, and reinvestment patterns are used to define that one terminal-year cash flow continue unchanged indefinitely, which is a simplification of how any individual business actually behaves over a long horizon. And as the comparison above shows, the perpetuity growth method and the exit multiple method can produce meaningfully different terminal values for the same company, so the terminal value tells you as much about which method and assumptions were chosen as it does about the business itself.
