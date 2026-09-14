export interface MarginNote {
  key: string;            // short slug, e.g. 'gross-margin'
  group: 'income' | 'balance' | 'meaning';
  title: string;          // plain language, e.g. "What gross margin tells you"
  answer: string;         // ONE sentence. This is the card face.
  article: string[];      // 3-6 short paragraphs, plain strings
  onSite?: string;        // one line: where a reader sees this on Marginalia
  buffettLens?: string;   // optional callout, labelled "The Buffett Lens" in the UI. Describes, in
                          // our own words, the QUESTION Mary Buffett & David Clark direct a reader
                          // to ask in "Warren Buffett and the Interpretation of Financial
                          // Statements" (Scribner, 2008). Their own numeric thresholds are NOT
                          // reproduced here — readers are pointed to the book for those. Always
                          // presented as their view, never as fact or as advice.
}

export const MARGIN_NOTES: MarginNote[] = [
  {
    key: 'revenue',
    group: 'income',
    title: 'What revenue actually measures',
    answer:
      'Revenue is the total value of goods or services a company delivered in a period, recorded when the sale is earned, not necessarily when the cash lands.',
    article: [
      'Revenue sits at the top of the income statement. It is sometimes called sales or turnover, and all three words mean the same thing: what the business billed customers for the goods or services it delivered during the period.',
      'Accounting rules generally require revenue to be recognised when it is earned, which is usually when the product ships or the service is performed, rather than when the invoice is paid. A company can therefore report high revenue while still waiting on the cash.',
      'Because revenue is a single figure covering many products, regions, and customers, it says little on its own about who bought what or why. It is a starting point for reading the rest of the statement, not a conclusion.',
      'Comparing revenue across several years shows whether a business is growing, shrinking, or holding steady, and comparing it with the revenue of similar companies gives a rough sense of scale.',
    ],
    onSite: 'Shown as the top line of the income statement view for every listed company on Marginalia.',
    buffettLens: "Mary Buffett and David Clark, in Warren Buffett and the Interpretation of Financial Statements, suggest tracking a company's revenue over many years to see whether growth is consistent rather than erratic, since consistency is what they treat as the more telling signal.",
  },
  {
    key: 'cost-of-sales',
    group: 'income',
    title: 'What cost of sales includes',
    answer:
      'Cost of sales is the direct cost of producing or acquiring whatever the company sold during the period, before any selling or administrative expense is subtracted.',
    article: [
      'Cost of sales, also labelled cost of goods sold or cost of revenue, captures the direct inputs behind what a company sold: raw materials, factory labour, or the wholesale price paid for goods that were resold.',
      'It excludes costs that support the business more broadly, such as marketing, head office salaries, or research. Those appear further down the income statement under their own headings.',
      'Cost of sales is matched to the units actually sold in the period, not the units produced. A company that builds inventory faster than it sells will not see that extra production cost hit the income statement yet; it sits on the balance sheet as inventory instead.',
      'Subtracting cost of sales from revenue produces gross profit, which is the figure used to calculate gross margin.',
    ],
    onSite: 'Listed as a line item directly beneath revenue in the income statement breakdown.',
    buffettLens: "Mary Buffett and David Clark note that cost of sales is worth reading alongside gross profit, since it is the base from which a company's pricing power, or lack of it, becomes visible.",
  },
  {
    key: 'gross-margin',
    group: 'income',
    title: 'What gross margin tells you',
    answer:
      'Gross margin is gross profit expressed as a percentage of revenue, showing how much of each pound of sales is left after direct production costs.',
    article: [
      'Gross profit is revenue minus cost of sales. Dividing that figure by revenue converts it into a percentage, which is gross margin. A gross margin of forty per cent means forty pence of every pound in sales remains after paying for the direct costs of making or sourcing what was sold.',
      'Gross margin varies enormously between industries because the cost structure of a grocery retailer looks nothing like that of a software company or a mining operation. Comparisons are therefore most useful within a single industry rather than across different ones.',
      'The percentage can move for several reasons: a change in the price charged, a change in the cost of inputs, a shift in the mix of products sold, or a change in production efficiency. The income statement alone does not say which of these has happened.',
      'Gross margin is calculated before selling, administrative, research, interest, and tax costs are deducted, so it measures only the first layer of profitability, not the business as a whole.',
    ],
    onSite: 'Shown alongside gross profit in the income statement view.',
    buffettLens:
      "Mary Buffett and David Clark read gross margin as a question about pricing power: does the company set its own price, or does the market set it for them? Their method is to look across a decade rather than a single year, and to compare only within an industry. The specific levels they use are set out in their book.",
  },
  {
    key: 'sga',
    group: 'income',
    title: 'What sits inside SG&A',
    answer:
      'Selling, general and administrative expenses cover the costs of running and marketing the business that are not tied directly to making a specific product.',
    article: [
      'SG&A is a broad bucket. It typically includes sales staff salaries and commissions, advertising, office rent, head office administration, legal and accounting fees, and similar overheads.',
      'Because it is a bucket, two companies can report similar SG&A totals for very different reasons: one might spend heavily on advertising, another on a large administrative headcount. The income statement usually does not split the total further, though footnotes sometimes do.',
      'SG&A is generally expressed as a percentage of revenue so that companies of different sizes can be compared. A rising percentage over several years means overheads are growing faster than sales; a falling one means the opposite.',
      'Some companies separate marketing or advertising costs into their own line, while others fold everything into a single SG&A figure, so it is worth checking exactly what is included before comparing two companies.',
    ],
    onSite: 'Appears as its own line item in the expense breakdown beneath gross profit.',
    buffettLens:
      "Mary Buffett and David Clark read selling and administrative cost against gross profit rather than against revenue, asking how much of each year's trading profit is consumed simply by keeping the selling effort going. They read the ratio across many years, since a single year says little. The levels they treat as meaningful are set out in their book.",
  },
  {
    key: 'research-development',
    group: 'income',
    title: 'How research and development is expensed',
    answer:
      'Research and development spending is generally charged in full against the income statement in the year it is incurred, rather than spread over future years.',
    article: [
      'Under most accounting standards, the research phase of R&D is expensed immediately. Some later-stage development costs can be capitalised and spread over time if strict conditions are met, but the bulk of R&D typically hits the income statement in the year it is spent.',
      'This treatment means a company investing heavily in new products will show lower current profit than an otherwise identical company that spends nothing on R&D, even if the investment eventually pays off.',
      'R&D spending is usually shown as its own line so a reader can see how much of revenue is being reinvested into future products, expressed as a percentage of revenue for comparison across periods.',
      'Not every company reports R&D separately. Retailers and service businesses often have little or none, while pharmaceutical and technology companies tend to report it prominently.',
    ],
    onSite: 'Displayed as its own expense line whenever a company reports R&D spending separately in its filings.',
    buffettLens:
      "Mary Buffett and David Clark treat research spending as a question about dependence: are these profits tied to continuous invention, or would they persist if the product stayed much as it is? They read the answer as central to how durable the earnings are, and set out their own reasoning in their book.",
  },
  {
    key: 'depreciation',
    group: 'income',
    title: 'Why depreciation is a real cost',
    answer:
      'Depreciation spreads the cost of a long-lived asset, such as machinery or a building, over the years it is expected to be used, rather than expensing it all at once.',
    article: [
      'When a company buys equipment that will last several years, accounting rules do not let it deduct the full purchase price as an expense in the year of purchase. Instead, the cost is spread, or depreciated, across the asset\'s estimated useful life.',
      'Depreciation does not involve a fresh cash payment in the year it is recorded; the cash went out when the asset was bought. It is nonetheless a genuine cost, because the asset is wearing out or becoming obsolete and will eventually need replacing.',
      'The amount of annual depreciation depends on estimates: the asset\'s useful life and its expected value at the end of that life. Two companies with identical machinery can report different depreciation charges if they use different estimates or methods.',
      'Depreciation reduces reported profit but is added back on the cash flow statement, which is why profit and cash generated from operations are rarely the same figure.',
      'Amortisation is the equivalent process for intangible assets, such as patents with a defined legal life, and works on the same principle.',
    ],
    onSite: 'Appears wherever depreciation and amortisation are reported in the statements.',
    buffettLens:
      "Mary Buffett and David Clark compare depreciation with gross profit, within an industry and across many years, asking how much of each year's profit is absorbed by wearing out the assets that produced it. Their own interpretation of the ratio is set out in their book.",
  },
  {
    key: 'interest-cost',
    group: 'income',
    title: 'What interest expense shows',
    answer:
      'Interest expense is the cost of servicing a company\'s borrowings during the period, separate from repaying the borrowed amount itself.',
    article: [
      'Interest expense reflects the price a company pays to borrow money, whether through bank loans, bonds, or other debt instruments. It is charged on the outstanding balance, not on the total ever borrowed.',
      'It sits below operating profit on the income statement because it relates to how the business is financed, rather than to how well the underlying operations performed.',
      'A company can also earn interest income on cash it holds or has lent out, and some income statements show this separately or net it against interest expense. Checking which is which matters when comparing companies.',
      'The ratio of operating profit to interest expense, often called interest cover, indicates how comfortably a company\'s operating earnings could absorb its interest payments, though it says nothing about the principal that will eventually fall due.',
    ],
    onSite: 'Shown as a distinct line between operating profit and profit before tax on the income statement.',
    buffettLens:
      "Mary Buffett and David Clark read interest as a share of operating profit, compared against companies in the same industry, asking how much of a year's trading profit is committed to lenders before shareholders see any of it. The levels they use are set out in their book.",
  },
  {
    key: 'one-off-gains',
    group: 'income',
    title: 'Why one-off gains are not earnings',
    answer:
      'One-off, or non-recurring, gains and losses arise from events outside a company\'s normal trading activity and are not expected to repeat.',
    article: [
      'Examples include the profit from selling a building, a gain from a legal settlement, or a one-time insurance payout. These items pass through the income statement but do not come from selling the company\'s ordinary products or services.',
      'Because they are unlikely to recur, including them in profit can make a single year look stronger or weaker than the underlying business trend suggests. Companies are generally required to disclose such items separately so a reader can identify them.',
      'The same logic applies in reverse to one-off charges, such as restructuring costs or asset write-downs, which can depress a single year\'s profit without reflecting a change in the ongoing business.',
      'Reading several years of results side by side, and noting which years contained unusual items, makes it possible to separate the pattern of ordinary trading from the effect of isolated events.',
    ],
    onSite: 'Appears in the income statement view wherever a filing discloses a non-recurring item.',
    buffettLens: "Mary Buffett and David Clark recommend stripping one-off gains and losses out of the earnings picture entirely before judging a company's ordinary trading performance.",
  },
  {
    key: 'profit-before-tax',
    group: 'income',
    title: 'What profit before tax represents',
    answer:
      'Profit before tax is the total profit a company generated from its operations and financing activities before any tax charge is deducted.',
    article: [
      'Profit before tax, sometimes labelled pre-tax income, is calculated after all operating expenses, interest, and any one-off items have been included, but before applying the tax charge for the period.',
      'It is a useful comparison point between companies operating in different tax jurisdictions, since tax rates and rules vary by country and can change year to year for reasons unrelated to the business itself.',
      'The gap between profit before tax and profit after tax is the tax charge, which depends on the statutory tax rate, any tax credits or reliefs, and how much of the profit was earned in higher- or lower-tax locations.',
      'Profit before tax still includes financing costs such as interest, so it reflects how the company is funded as well as how its operations performed.',
    ],
    onSite: 'Displayed as a subtotal line directly above the tax charge on the income statement.',
    buffettLens: "Mary Buffett and David Clark note that comparing figures on a pre-tax basis makes it easier to weigh one investment against another, since after-tax comparisons can be distorted by differing tax treatments.",
  },
  {
    key: 'net-earnings',
    group: 'income',
    title: 'What net earnings include and exclude',
    answer:
      'Net earnings, or net income, is the profit remaining after every expense, interest charge, and tax has been deducted from revenue.',
    article: [
      'Net earnings is the bottom line of the income statement. It represents the amount theoretically available to shareholders, whether it is paid out as a dividend or kept in the business as retained earnings.',
      'Because it is calculated after every other line on the statement, net earnings absorbs the effect of one-off items, changes in tax rate, and financing costs, alongside the performance of ordinary operations. A single year\'s net earnings figure can therefore be shaped by factors unrelated to the core business.',
      'Net earnings is the figure used to calculate earnings per share and is the profit measure most commonly quoted in headlines, but it is only one of several profit measures on the statement, each isolating a different set of costs.',
      'Comparing net earnings across several years, alongside the operating profit and gross profit lines above it, shows whether growth in the bottom line is coming from the core business or from items further down the statement.',
    ],
    onSite: 'Shown as the final line of the income statement, with prior-year figures alongside for comparison.',
    buffettLens:
      "Mary Buffett and David Clark read net earnings as a percentage of revenue rather than as an absolute figure, and across a decade rather than a single year, asking how much of each pound of sales survives to the bottom line. The levels they treat as meaningful are set out in their book.",
  },
  {
    key: 'earnings-per-share',
    group: 'income',
    title: 'How earnings per share is calculated',
    answer:
      'Earnings per share divides net earnings by the number of shares in issue, converting total profit into a per-share figure.',
    article: [
      'Earnings per share, usually written as EPS, takes the net earnings for a period and divides it by the weighted average number of shares outstanding during that period.',
      'Basic EPS uses the actual number of shares in issue. Diluted EPS also accounts for shares that could be created from options, warrants, or convertible securities, and is therefore always equal to or lower than basic EPS.',
      'Because EPS depends on the share count as well as on profit, it can change even when total net earnings stays flat. Issuing new shares lowers EPS by spreading the same profit over more shares; buying back and cancelling shares raises it by spreading profit over fewer.',
      'EPS makes it possible to compare profit generation on a per-share basis across different periods for the same company, though comparing EPS directly between two different companies is less meaningful unless their share prices are also considered.',
    ],
    onSite: 'Shown alongside net earnings at the foot of the income statement, with basic and diluted figures where both are reported.',
    buffettLens: "Mary Buffett and David Clark recommend looking at ten years of per-share earnings at once, checking for a consistent, gently rising pattern rather than a single strong year.",
  },
  {
    key: 'cash-and-equivalents',
    group: 'balance',
    title: 'What counts as cash and equivalents',
    answer:
      'Cash and equivalents covers physical cash, bank balances, and short-term investments that can be converted to cash within roughly three months without material risk of loss in value.',
    article: [
      'This balance sheet line combines cash held in bank accounts with highly liquid short-term instruments, such as treasury bills or money market funds, that mature quickly and are considered close to cash in nature.',
      'It is the most straightforward asset on the balance sheet to verify, since it is generally confirmed directly with banks during an audit, unlike assets such as inventory or receivables that rely more on estimates.',
      'A large cash balance shows liquidity at a point in time, but the balance sheet alone does not explain why the cash accumulated or what the company intends to do with it; the cash flow statement provides that context.',
      'Cash levels can fluctuate significantly between reporting dates due to the timing of large receipts or payments, so a single snapshot is best read alongside the trend over several periods.',
    ],
    onSite: 'Listed as the first line of current assets on the balance sheet view.',
    buffettLens: "Mary Buffett and David Clark suggest checking several years of balance sheets to see whether a cash pile was built up by the ongoing business itself, rather than by a one-off bond sale or asset disposal.",
  },
  {
    key: 'inventory',
    group: 'balance',
    title: 'How inventory is valued',
    answer:
      'Inventory is recorded on the balance sheet at cost, or at market value if that is lower, covering raw materials, work in progress, and finished goods not yet sold.',
    article: [
      'Inventory represents goods a company holds for production or resale that have not yet reached a customer. It is generally valued at the lower of its original cost and its current market value, which prevents overstating the balance sheet when goods lose value.',
      'The method used to assign cost to inventory, such as first-in-first-out or weighted average, affects the value reported and can differ between companies, so it is worth checking the accounting policy note before comparing two businesses.',
      'Inventory sits on the balance sheet until it is sold, at which point its cost moves to the income statement as part of cost of sales. Until then, it ties up cash that has already been spent but not yet recovered through a sale.',
      'The relationship between inventory levels and the pace of sales, often measured through inventory turnover, indicates how quickly stock is moving relative to the size of the balance.',
    ],
    onSite: 'Shown as a current asset line in the balance sheet view.',
    buffettLens:
      "Mary Buffett and David Clark read inventory alongside earnings across several years, asking whether the two move together or whether inventory builds and clears in sharp cycles. They treat the shape of that pattern as telling, and set out their reasoning in their book.",
  },
  {
    key: 'receivables',
    group: 'balance',
    title: 'What accounts receivable represents',
    answer:
      'Accounts receivable is money owed to the company by customers for goods or services already delivered but not yet paid for.',
    article: [
      'When a company makes a sale on credit, the revenue is recorded on the income statement immediately, while the corresponding cash is recorded on the balance sheet as a receivable until the customer actually pays.',
      'Receivables are usually reported net of an allowance for amounts the company does not expect to collect, based on historical experience and the age of outstanding balances.',
      'A rising receivables balance can result simply from higher sales, but it can also mean customers are taking longer to pay, or that credit terms have been extended to support sales growth. The balance sheet alone does not distinguish between these causes.',
      'Comparing receivables to revenue over several periods, or calculating the average number of days it takes to collect a sale, shows whether the pace of collection is changing over time.',
    ],
    onSite: 'Shown as a current asset line in the balance sheet view, beside revenue for the same period.',
    buffettLens:
      "Mary Buffett and David Clark read net receivables as a share of sales, compared against direct competitors, asking who is extending more credit to win the same sale. Their own interpretation is set out in their book.",
  },
  {
    key: 'property-plant-equipment',
    group: 'balance',
    title: 'What property, plant and equipment covers',
    answer:
      'Property, plant and equipment, often abbreviated to PP&E, covers the physical, long-lived assets a company uses to operate, such as land, buildings, and machinery.',
    article: [
      'PP&E is reported on the balance sheet at its original cost, less accumulated depreciation charged over the years the asset has been in use. This is known as net book value, and it is an accounting figure rather than a current market estimate.',
      'Because depreciation reduces the reported value steadily over time, an older asset can carry a low net book value on the balance sheet while still being fully functional, and a newer asset can carry a high value while contributing no more to operations.',
      'The scale of PP&E relative to revenue varies enormously by industry. A manufacturer or a utility typically carries far more PP&E than a services or software business, reflecting how much physical capital each type of business needs to operate.',
      'Spending to acquire or upgrade PP&E, known as capital expenditure, appears on the cash flow statement rather than the income statement, and is a separate figure from depreciation.',
    ],
    onSite: 'Shown as a non-current asset line in the balance sheet view.',
    buffettLens:
      "Mary Buffett and David Clark read plant and equipment against earnings, asking how much must be spent on the asset base simply to keep profits where they are, and therefore how much of each year's profit is free for anything else. They set out their reasoning in their book.",
  },
  {
    key: 'goodwill-intangibles',
    group: 'balance',
    title: 'What goodwill and intangibles represent',
    answer:
      'Goodwill arises when a company pays more to acquire another business than the fair value of its identifiable net assets, while intangibles cover non-physical assets such as patents, trademarks, and licences.',
    article: [
      'Goodwill is not something a company can create internally; it only appears on the balance sheet following an acquisition, representing the premium paid over the measurable value of the assets acquired, often reflecting expected future benefits such as brand strength or customer relationships.',
      'Other intangible assets, such as patents, trademarks, customer contracts, or software, can also arise from acquisitions, or in some cases be capitalised when developed internally, subject to specific accounting conditions.',
      'Unlike PP&E, goodwill is generally not depreciated on a fixed schedule. Instead, it is tested periodically for impairment, meaning its value is written down if the business it relates to is judged to be worth less than when it was acquired.',
      'A large goodwill balance signals that a company has grown significantly through acquisitions rather than solely through internal expansion, and makes the balance sheet more dependent on management\'s judgement about future value than assets recorded at hard cost.',
    ],
    onSite: 'Listed as a separate non-current asset line, distinct from other intangible assets, wherever a company reports it.',
    buffettLens: "Mary Buffett and David Clark note that a steadily rising goodwill balance over several years usually points to an ongoing pattern of acquisitions, which is worth examining alongside the quality of the businesses being acquired.",
  },
  {
    key: 'long-term-debt',
    group: 'balance',
    title: 'What long-term debt covers',
    answer:
      'Long-term debt is money a company has borrowed that is due to be repaid more than one year from the balance sheet date.',
    article: [
      'This line typically includes bonds issued by the company, long-term bank loans, and similar borrowings. The portion of any such debt due within the next twelve months is usually reclassified as a current liability.',
      'Long-term debt sits alongside shareholders\' equity as one of the two main ways a company funds its assets: through money owed to lenders or through money contributed and retained by owners.',
      'The terms attached to debt, including the interest rate, repayment schedule, and any conditions set by lenders, are usually disclosed in the notes to the accounts rather than on the face of the balance sheet itself.',
      'Comparing total debt to shareholders\' equity, or to annual earnings, gives a sense of how a company\'s asset base is financed and how large its borrowings are relative to the resources available to service them.',
    ],
    onSite: 'Shown as a non-current liability line in the balance sheet view, beside shareholders equity.',
    buffettLens:
      "Mary Buffett and David Clark relate long-term debt to earnings rather than to assets, asking how many years of profit it would take to clear the borrowing entirely. The benchmark they use is set out in their book.",
  },
  {
    key: 'shareholders-equity-roe',
    group: 'balance',
    title: 'What shareholders\u2019 equity and return on equity measure',
    answer:
      'Shareholders\u2019 equity is the residual value of a company\u2019s assets after all liabilities are subtracted, and return on equity measures how much profit is generated relative to that residual value.',
    article: [
      'Shareholders\u2019 equity, also called book value or net assets, equals total assets minus total liabilities. It represents the accounting value attributable to shareholders if all assets were sold at their balance sheet value and all liabilities paid off.',
      'It is made up of several components, typically including share capital contributed by investors, retained earnings built up from profits not paid out as dividends, and other reserves arising from specific accounting adjustments.',
      'Return on equity divides net earnings for the period by shareholders\u2019 equity, usually expressed as a percentage. It shows how much profit was generated relative to the equity base, though the figure is sensitive to how much debt a company uses, since more debt reduces the equity base the return is measured against.',
      'Because shareholders\u2019 equity is an accounting measure built from historical costs and estimates, it does not necessarily match the market value of a company, which is set by what investors are willing to pay for its shares.',
    ],
    onSite: 'Shown at the foot of the balance sheet view, beside net earnings for the same period.',
    buffettLens:
      "Mary Buffett and David Clark read return on equity across many years rather than one, alongside the direction of the share count, asking how much profit each pound of shareholder capital produces and whether that capital base is growing or shrinking. The levels they use are set out in their book.",
  },
  {
    key: 'reading-the-three-statements-together',
    group: 'meaning',
    title: 'Why no single statement stands alone',
    answer:
      'The income statement, balance sheet, and cash flow statement each capture a different slice of a company\u2019s activity, and reading only one leaves gaps the others fill.',
    article: [
      'The income statement covers performance over a period: what was earned and what was spent to earn it. The balance sheet is a snapshot at a single date: what the company owns and owes at that moment. The cash flow statement tracks the actual movement of cash during the period, which can differ substantially from reported profit.',
      'A company can report a healthy profit on the income statement while its cash position weakens, if that profit is tied up in growing receivables or inventory rather than collected in cash. Equally, a company can show a net loss while still generating positive cash from operations, if the loss was driven by non-cash charges such as depreciation or an asset write-down.',
      'Figures that look similar in isolation, such as two companies with matching net earnings, can reflect very different underlying businesses once their balance sheets and cash flow statements are compared alongside the income statement.',
      'Reading the three statements together, and reading each one across several years rather than a single period, builds a more complete and checkable picture than any one figure can provide on its own.',
    ],
    onSite: 'Draws on all three statements as Marginalia presents them.',
  },
];