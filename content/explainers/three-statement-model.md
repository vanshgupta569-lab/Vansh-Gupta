# What is a three-statement model

A three-statement model is a financial model in which the income statement, balance sheet, and cash flow statement are built together and linked to each other, so that a change in one flows through to affect the other two automatically. It's called a three-statement model because all three of a company's core financial statements are built as a connected set, rather than as separate, standalone schedules.

## Why the three statements need to connect

In a company's actual financial reporting, the income statement, balance sheet, and cash flow statement are not independent documents — they describe the same underlying activity from different angles, and specific figures on each one are mathematically tied to figures on the others. Net income from the income statement flows into retained earnings on the balance sheet. The cash flow statement starts from net income and reconciles it to the actual change in cash during the period, and that ending cash figure becomes the cash balance on the balance sheet. A three-statement model recreates these links directly in the model's formulas, so that when an assumption changes — a revenue growth rate, for instance — the effect ripples through all three statements automatically, rather than requiring each statement to be updated separately by hand.

## How the pieces fit together

The income statement is built first, forecasting revenue, costs, and down to net income, based on assumptions about growth, margins, and other drivers.

The cash flow statement then starts from that net income and adjusts it for non-cash items and changes in balance sheet accounts: depreciation and amortisation are added back, changes in working capital items — inventory, receivables, payables — are added or subtracted depending on whether they used or released cash, and cash used for capital expenditure and debt repayment or new borrowing is included under investing and financing activities. This produces the change in cash for the period.

The balance sheet is then updated: the ending cash figure from the cash flow statement becomes the balance sheet's cash line, retained earnings increase by net income less any dividends paid, and other balance sheet items — inventory, receivables, payables, debt, fixed assets — are updated to reflect the same activity captured in the cash flow statement. If the model is built correctly, total assets will equal total liabilities plus equity at the end of this process — the balance sheet "balances" — which acts as a built-in check that the links between the three statements have been constructed correctly.

## A worked example

Take a single period with an opening cash balance of £50 million. Net income for the period is £40 million. Depreciation and amortisation of £10 million is added back, being non-cash, capital expenditure of £15 million is subtracted, and an increase in net working capital of £5 million is subtracted — giving cash generated from operating and investing activities of £40m + £10m − £15m − £5m = £30 million. During the period, the company also repays £10 million of debt, a financing outflow.

Change in cash = £30m − £10m = £20 million. Ending cash = £50m (opening) + £20m = £70 million.

| Line | Amount |
|---|---|
| Opening cash | £50m |
| Net income | £40m |
| Add: depreciation & amortisation | +£10m |
| Less: capital expenditure | −£15m |
| Less: increase in working capital | −£5m |
| Less: debt repayment | −£10m |
| Ending cash | £70m |

That £70 million ending cash figure becomes the cash line on the balance sheet at the end of the period, and also becomes the opening cash balance for the next period's cash flow statement — this is the link that carries the model forward, period after period.

## Why debt and interest can create circularity

If a company's cash flow in a given period is forecast to fall short of what's needed, a model will often assume it draws on a revolving credit facility to cover the gap, which increases the debt balance on the balance sheet. But additional debt carries additional interest, and that interest expense reduces net income on the income statement in that same or a following period — which is the figure the cash flow statement started from. This loop, where the debt schedule depends on cash flow and cash flow depends on interest expense from the debt schedule, is what's referred to as circularity in a three-statement model, and it's typically handled using an iterative calculation or a specific formula structure designed to resolve it.

## What a three-statement model does not tell you

A three-statement model enforces internal consistency — it ensures that whatever assumptions are entered flow through correctly to all three statements and that the balance sheet balances — but it does not validate whether those assumptions themselves are realistic. A model can be built with perfect mechanical accuracy and still produce a misleading forecast if the revenue growth, margin, or capital expenditure assumptions driving it don't reflect how the business is actually likely to perform. The model's internal consistency is a check on the arithmetic, not a check on the judgement behind the inputs.
