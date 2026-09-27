// FILE: src/data/didYouKnow.ts
//
// Short notes shown while a model is being built.
//
// WHAT BELONGS HERE
// Each entry corrects something a reader is likely to believe that the
// accounting does not support. Not trivia, not tips — the test is that someone
// who has read a little about investing would guess wrong, and that knowing
// the mechanism changes how they read a set of accounts.
//
// THE RULE THAT GOVERNS EVERY LINE
// Explain mechanics, not merit. A fact plus the mechanism behind it is
// education; saying a level is good, healthy, strong or a warning sign is an
// opinion on a security, and this site does not give those. So: "negative
// working capital means customers pay before suppliers do, which funds the
// business without borrowing" — never "negative working capital is better".
// If an entry cannot be written without a verdict, it does not belong here.
//
// Every entry is written from general accounting knowledge. Nothing is taken
// from the wording, tables or thresholds of any book. Concepts are nobody's
// property; expression is.
//
// LENGTH
// These appear while someone waits a few seconds. `belief` and `fact` are one
// line each; `why` is at most two sentences. If an entry needs more room than
// that, it is a margin note, not a loading-screen line.

export interface DidYouKnow {
  key: string;
  /* Where it sits in a set of accounts. Used to avoid showing three cash flow
     entries in a row, not shown to the reader. */
  group: 'income' | 'balance' | 'cash' | 'valuation' | 'reading';
  /* What a reader is likely to assume. Stated plainly, without mockery — the
     assumption is usually reasonable, which is why it is common. */
  belief: string;
  /* What the accounting actually says. */
  fact: string;
  /* The mechanism. Two sentences at most. */
  why: string;
}

export const DID_YOU_KNOW: DidYouKnow[] = [
  // ---- working capital and the balance sheet ---------------------------
  {
    key: 'negative-working-capital',
    group: 'balance',
    belief: 'More working capital means a business is on firmer ground.',
    fact:
      'Some of the steadiest businesses in the world run on negative working capital.',
    why:
      'A supermarket collects cash at the till and pays its suppliers sixty days later, so it holds other people\u2019s money in the meantime. That float funds the business without borrowing, and it grows as the business grows.',
  },
  {
    key: 'growth-consumes-cash',
    group: 'cash',
    belief: 'A profitable company that is growing quickly must be generating cash.',
    fact: 'Fast growth usually consumes cash, and the faster the growth the more it consumes.',
    why:
      'Every extra sale has to be stocked and delivered before it is paid for, so inventory and receivables rise before the money arrives. Profit is recorded at the sale; cash arrives months later.',
  },
  {
    key: 'inventory-falling',
    group: 'balance',
    belief: 'Falling inventory means a company is selling well.',
    fact: 'Inventory falls both when a company sells more and when it buys less.',
    why:
      'The balance alone cannot tell you which. Read it beside revenue and cost of sales: inventory down while sales rise is one story, inventory down while sales fall is another.',
  },
  {
    key: 'receivables-growth',
    group: 'balance',
    belief: 'Rising receivables follow naturally from rising sales.',
    fact:
      'They do \u2014 but receivables rising faster than sales means something different.',
    why:
      'It means each sale is taking longer to collect, or is being made on easier terms. The ratio of the two moves independently of either one, which is why days-to-collect is read rather than the balance.',
  },
  {
    key: 'cash-is-not-free',
    group: 'balance',
    belief: 'A large cash balance is money the owners could take out.',
    fact: 'Part of every cash balance is working cash the business cannot operate without.',
    why:
      'Tills need floats, payroll clears before receipts arrive, and subsidiaries hold balances that cannot move freely. Only the surplus above that is genuinely spare.',
  },
  {
    key: 'goodwill-is-not-an-asset-you-can-sell',
    group: 'balance',
    belief: 'Goodwill is an asset like any other.',
    fact: 'Goodwill is the record of a price paid, not a thing the company owns.',
    why:
      'It is what an acquirer paid above the identifiable net assets of a business it bought. It cannot be sold separately, and it only appears because a purchase happened.',
  },
  {
    key: 'book-value-is-historical',
    group: 'balance',
    belief: 'The balance sheet shows what a company\u2019s assets are worth.',
    fact: 'It mostly shows what they cost, less what has been written off since.',
    why:
      'A building bought in 1990 sits at its 1990 price minus depreciation, whatever it would fetch today. That is why book value and market value routinely differ by multiples.',
  },
  {
    key: 'depreciation-is-not-a-fund',
    group: 'balance',
    belief: 'Depreciation sets money aside to replace the asset.',
    fact: 'Depreciation moves no money at all. Nothing is set aside.',
    why:
      'It spreads a cost already paid across the years the asset is used. Replacing the asset requires new cash, from whatever source, at the time it is replaced.',
  },

  // ---- income statement -------------------------------------------------
  {
    key: 'profit-is-an-opinion',
    group: 'income',
    belief: 'Profit is a fact; cash is what needs interpreting.',
    fact: 'Cash is the fact. Profit depends on judgements.',
    why:
      'When a sale is recognised, how long an asset is expected to last, and what a provision should be all rest on estimates. The bank balance rests on none.',
  },
  {
    key: 'revenue-before-payment',
    group: 'income',
    belief: 'Revenue is recorded when the customer pays.',
    fact: 'Revenue is recorded when the goods or service are delivered, whenever payment arrives.',
    why:
      'A company can report a year of record revenue having collected very little of it. The gap sits in receivables, which is why the two are read together.',
  },
  {
    key: 'ebitda-is-not-cash',
    group: 'income',
    belief: 'EBITDA is roughly the cash a business generates.',
    fact: 'EBITDA ignores three things that consume cash every year.',
    why:
      'It is struck before interest, before tax, and before any spending on the plant that wears out. A business with debt, a tax bill and machinery to replace keeps far less than its EBITDA.',
  },
  {
    key: 'margin-across-industries',
    group: 'income',
    belief: 'A company with a higher margin is running a better business.',
    fact: 'Margins are only comparable within an industry.',
    why:
      'A supermarket earning two per cent on enormous turnover and a software firm earning thirty per cent on a fraction of it can produce the same profit. The margin describes the shape of the trade, not its size.',
  },
  {
    key: 'operating-leverage',
    group: 'income',
    belief: 'If sales fall ten per cent, profit falls about ten per cent.',
    fact: 'Profit falls much further, and the more fixed the cost base the further it falls.',
    why:
      'Rent, salaries and depreciation continue whatever the sales. The whole of the lost gross profit comes out of the bottom line, so a modest fall in revenue can erase profit entirely.',
  },
  {
    key: 'one-off-gains',
    group: 'income',
    belief: 'Net income is what the business earned that year.',
    fact:
      'Net income includes items that have nothing to do with trading and will not happen again.',
    why:
      'Selling a building, settling a lawsuit or writing down a subsidiary all land in net income. Reading trading performance means looking above those lines, not at the total.',
  },
  {
    key: 'tax-charge-is-not-tax-paid',
    group: 'income',
    belief: 'The tax line shows what the company paid to the government.',
    fact: 'It shows the tax attributable to the accounting profit, which is a different figure.',
    why:
      'Accounting rules and tax rules measure profit differently, and the gap is recorded as deferred tax. The cash actually paid appears in the cash flow statement.',
  },
  {
    key: 'share-buyback-eps',
    group: 'income',
    belief: 'Rising earnings per share means the company earned more.',
    fact: 'Earnings per share rises whenever the share count falls, even if earnings do not move.',
    why:
      'A buyback reduces the denominator. Read earnings per share beside total net income and the share count, or a company shrinking can look like a company growing.',
  },

  // ---- cash flow --------------------------------------------------------
  {
    key: 'profitable-companies-fail',
    group: 'cash',
    belief: 'A company that is profitable will not run out of money.',
    fact: 'Profitable companies fail regularly, and usually for the same reason.',
    why:
      'Profit is recorded when a sale is made; wages, suppliers and lenders want cash on their own timetable. A company can be solvent on paper and unable to pay anyone this Friday.',
  },
  {
    key: 'cash-can-rise-as-business-shrinks',
    group: 'cash',
    belief: 'Cash rising from operations means the business is improving.',
    fact: 'A shrinking business often produces a surge of cash on the way down.',
    why:
      'Stock is sold off and not replaced, and old invoices are collected while fewer new ones are raised. Working capital unwinds into cash exactly when trading is worst.',
  },
  {
    key: 'depreciation-add-back',
    group: 'cash',
    belief: 'Adding depreciation back to profit is an accounting trick.',
    fact:
      'It is a correction. The cash left when depreciation was charged; it left when the asset was bought.',
    why:
      'The cash flow statement starts from profit, which is after depreciation, and adds it back because no money moved this year. The money moved in the year of purchase, and appears there as capital expenditure.',
  },
  {
    key: 'capex-not-in-profit',
    group: 'cash',
    belief: 'Buying a factory reduces this year\u2019s profit.',
    fact: 'It does not touch profit at all in the year it is bought.',
    why:
      'The spending goes on the balance sheet and reaches the income statement only as depreciation, spread over years. A company can spend everything it has and still report a profit.',
  },
  {
    key: 'financing-cash-flow',
    group: 'cash',
    belief: 'Positive cash flow overall means the business generated cash.',
    fact: 'The total includes money borrowed and money raised from shareholders.',
    why:
      'A company can show cash rising while its operations consume cash, because it issued debt. The three sections are separated precisely so the sources can be told apart.',
  },
  {
    key: 'dividends-come-from-cash',
    group: 'cash',
    belief: 'Dividends are paid out of profit.',
    fact: 'Dividends are paid out of cash. Profit only sets the legal limit.',
    why:
      'A company with reported profit and no cash must borrow or sell something to pay a dividend. Several have done exactly that for years.',
  },

  // ---- valuation --------------------------------------------------------
  {
    key: 'terminal-value-dominance',
    group: 'valuation',
    belief: 'A discounted cash flow valuation mostly reflects the years forecast.',
    fact: 'Most of the answer usually comes from the years beyond the forecast.',
    why:
      'Five discounted years are a small sum beside a perpetuity. For a typical company three quarters or more of the value sits in the terminal figure, which rests on two assumptions.',
  },
  {
    key: 'debt-and-value',
    group: 'valuation',
    belief: 'A company with less debt is worth more.',
    fact: 'Borrowing changes who the value belongs to, not how much the business produces.',
    why:
      'Enterprise value measures what the operations are worth to everyone who funded them. The debt decides how that value is split between lenders and shareholders.',
  },
  {
    key: 'cheap-multiple',
    group: 'valuation',
    belief: 'A low price-to-earnings ratio means a company is cheap.',
    fact: 'It can equally mean the earnings are expected to fall.',
    why:
      'The ratio uses earnings already reported and a price that reflects what buyers expect next. A low number often says the market disagrees with the last set of accounts.',
  },
  {
    key: 'multiples-and-metrics',
    group: 'valuation',
    belief: 'Any multiple can be applied to any measure of profit.',
    fact: 'A multiple must pair with a figure struck at the same point in the accounts.',
    why:
      'Enterprise value sits above interest, so it pairs with revenue, EBITDA or operating profit. Market capitalisation sits below it, so it pairs with net income and earnings per share. Crossing them compares two different things.',
  },
  {
    key: 'growth-is-not-always-value',
    group: 'valuation',
    belief: 'Growth adds value to a company.',
    fact: 'Growth adds value only when the return on the money invested exceeds its cost.',
    why:
      'Growing requires capital, and that capital has a price. A business earning less on new investment than it pays for the funding destroys value as it grows.',
  },

  // ---- reading accounts -------------------------------------------------
  {
    key: 'read-the-notes',
    group: 'reading',
    belief: 'The three statements contain what matters.',
    fact: 'The statements are summaries. The notes hold the substance.',
    why:
      'Which policies were chosen, what is owed but not yet on the balance sheet, who the related parties are and what the auditor questioned all live in the notes. A single line on the face of the accounts can rest on pages behind it.',
  },
  {
    key: 'auditor-opinion',
    group: 'reading',
    belief: 'An audit confirms the figures are correct.',
    fact:
      'An audit gives an opinion that the accounts are free from material misstatement, which is a narrower claim.',
    why:
      'Materiality is a threshold, not a guarantee, and the opinion covers presentation against a standard rather than the wisdom of the business. Reading what the auditor drew attention to is more informative than the opinion itself.',
  },
  {
    key: 'comparability',
    group: 'reading',
    belief: 'Two companies in the same industry report on the same basis.',
    fact: 'They frequently do not, and the difference is a policy choice rather than performance.',
    why:
      'Useful lives, inventory methods, revenue timing and what counts as an exceptional item are all chosen within the rules. Two identical businesses can report noticeably different profits.',
  },
  {
    key: 'restated-figures',
    group: 'reading',
    belief: 'Last year\u2019s figures are settled.',
    fact: 'Comparatives are restated more often than most readers expect.',
    why:
      'A disposal, a change of policy or a correction sends prior years back for restatement. A figure quoted from an old annual report may no longer match the same year in the current one.',
  },

  // ---- added after a pass over standard interview material -------------
  // Topics chosen for how often a reader guesses wrong; every line written
  // from general accounting knowledge, none taken from anyone's wording.
  {
    key: 'deferred-revenue',
    group: 'balance',
    belief: 'Cash received from a customer is revenue.',
    fact: 'Cash received before the work is done is a liability, not revenue.',
    why:
      'The company owes the customer a service it has not yet delivered, and that obligation sits on the balance sheet as deferred revenue. It becomes revenue only as the service is performed.',
  },
  {
    key: 'trapped-cash',
    group: 'balance',
    belief: 'Cash is cash, wherever a company holds it.',
    fact: 'Some of it cannot be brought home without a tax cost, and some cannot be moved at all.',
    why:
      'Earnings held in a foreign subsidiary may be taxed on repatriation, and restricted cash is pledged against an obligation. Both sit in the same line as the money in the current account.',
  },
  {
    key: 'internally-built-intangibles',
    group: 'balance',
    belief: 'A company\u2019s brand and know-how appear somewhere on its balance sheet.',
    fact: 'A brand a company built itself appears nowhere. A brand it bought appears in full.',
    why:
      'Accounting records what was paid for in a transaction, and no transaction happened when a reputation was earned over thirty years. This is why two otherwise identical businesses can show very different assets.',
  },
  {
    key: 'share-price-and-balance-sheet',
    group: 'balance',
    belief: 'If the share price doubles, the balance sheet must change.',
    fact: 'A share price move has no effect on the balance sheet at all.',
    why:
      'Shares change hands between investors; the company is not a party to the trade and receives nothing. Equity on the balance sheet records what shareholders put in and what has been retained since, not what the market thinks today.',
  },
  {
    key: 'negative-enterprise-value',
    group: 'valuation',
    belief: 'A company cannot be worth less than nothing.',
    fact: 'Enterprise value can be negative, and occasionally is.',
    why:
      'It happens when a company holds more cash than its entire market value plus its debt. The equity is still worth something; the operations are being valued at less than the cash sitting behind them.',
  },
  {
    key: 'debt-does-not-change-enterprise-value',
    group: 'valuation',
    belief: 'Borrowing a hundred million makes a company worth a hundred million more.',
    fact: 'Raising debt leaves enterprise value unchanged on the day it is raised.',
    why:
      'Debt goes up and cash goes up by the same amount, so net debt is where it started. The business produces exactly what it did the day before.',
  },
  {
    key: 'minority-interest-in-ev',
    group: 'valuation',
    belief: 'Enterprise value belongs to the company\u2019s own shareholders and lenders.',
    fact: 'Where a subsidiary is only part owned, some of it belongs to outsiders.',
    why:
      'Consolidated accounts include the whole of a subsidiary\u2019s earnings even when the parent owns eighty per cent. The other twenty per cent is added as minority interest, so the value and the earnings describe the same group.',
  },
  {
    key: 'roe-and-leverage',
    group: 'reading',
    belief: 'A higher return on equity means the business earns more on what it uses.',
    fact: 'Return on equity rises with borrowing even when the business has not changed.',
    why:
      'Debt shrinks the equity base without shrinking the earnings, so the ratio climbs. Return on assets or on invested capital is what moves only when the operations move.',
  },
  {
    key: 'averages-in-ratios',
    group: 'reading',
    belief: 'A ratio should use the year-end balance sheet figure.',
    fact: 'Ratios mixing the two statements use an average balance.',
    why:
      'An income statement covers a whole year; a balance sheet is one day. Dividing a year of earnings by a single day\u2019s equity compares a period against a snapshot.',
  },
  {
    key: 'effective-vs-marginal-tax',
    group: 'income',
    belief: 'A company pays the headline corporate tax rate on its profit.',
    fact: 'The rate on the face of the accounts is almost never the statutory rate.',
    why:
      'Losses carried forward, income earned in other countries and permanent differences between tax and accounting rules all move it. The effective rate is an outcome, not a policy.',
  },
  {
    key: 'deferred-tax-liability',
    group: 'balance',
    belief: 'A deferred tax liability is a debt owed to the government.',
    fact: 'It is tax the company has not paid yet because of timing, not tax it has avoided.',
    why:
      'Claiming depreciation faster for tax than for accounts lowers the tax bill early and raises it later. The balance records the reversal that is coming.',
  },
  {
    key: 'depreciation-capex-converge',
    group: 'cash',
    belief: 'Capital spending and depreciation are unrelated figures.',
    fact: 'In a mature business they converge, and the gap between them says which stage it is at.',
    why:
      'A company investing heavily spends well above its depreciation; one merely maintaining what it has spends about the same. Sustained spending below depreciation means the asset base is shrinking.',
  },
  {
    key: 'growth-vs-maintenance-capex',
    group: 'cash',
    belief: 'Capital expenditure is a single figure in the accounts.',
    fact: 'It is, and that is the problem \u2014 replacing worn-out plant and expanding are not separated.',
    why:
      'Only the maintenance half is a cost of staying in business; the other half is a choice to grow. Filings almost never split them, so any split is an estimate.',
  },
  {
    key: 'organic-vs-acquired-growth',
    group: 'income',
    belief: 'Revenue growth shows how much more the business sold.',
    fact: 'It also includes revenue that arrived by buying another company.',
    why:
      'An acquisition adds its revenue from the day it completes, and the following year annualises it. Neither says anything about whether the original business is selling more.',
  },
  {
    key: 'litigation-not-always-one-off',
    group: 'income',
    belief: 'Legal costs are one-off items and can be set aside.',
    fact: 'For some companies litigation is a recurring cost of operating.',
    why:
      'A business sued every year over its products is describing an ordinary expense, whatever it is labelled. Whether an item recurs is a question about the company, not about the label.',
  },
  {
    key: 'negative-retained-earnings',
    group: 'balance',
    belief: 'Negative retained earnings means a history of losses.',
    fact: 'It can equally mean a history of paying shareholders more than was earned.',
    why:
      'Retained earnings falls with dividends and buybacks as well as with losses. Several consistently profitable companies carry a negative balance for that reason alone.',
  },
  {
    key: 'circularity',
    group: 'reading',
    belief: 'A financial model is a straight line of calculations.',
    fact: 'A complete model contains a loop that depends on its own answer.',
    why:
      'Interest depends on debt, debt depends on how much cash is left, and cash depends on interest. Models solve it by repeating the calculation until it settles, or by using opening balances to break the loop.',
  },
  {
    key: 'allowance-for-doubtful-accounts',
    group: 'balance',
    belief: 'Receivables show what customers owe.',
    fact: 'They show what customers owe, less what the company expects never to collect.',
    why:
      'Revenue was recognised on the whole sale, so the expected shortfall is estimated and deducted. That estimate is a judgement, and it can be revised.',
  },
  {
    key: 'operating-leases-on-balance-sheet',
    group: 'balance',
    belief: 'A company that rents rather than owns carries no obligation for it.',
    fact: 'Lease obligations now sit on the balance sheet. They did not always.',
    why:
      'A rented shop was once disclosed only in the notes, so two identical retailers could look very different. Comparing a year before the change with a year after is comparing two different measurements.',
  },
  {
    key: 'pik-interest',
    group: 'cash',
    belief: 'Interest is a cash cost.',
    fact: 'Some interest is never paid in cash \u2014 it is added to the loan.',
    why:
      'Payment-in-kind interest increases the balance owed instead of leaving the bank account. It reduces reported profit while consuming no cash, so it is added back in the cash flow statement and grows the debt.',
  },
  {
    key: 'cash-conversion-cycle-negative',
    group: 'balance',
    belief: 'A company must pay for stock before it can sell it.',
    fact: 'Some collect from the customer well before the supplier is paid.',
    why:
      'The cash conversion cycle adds the days stock is held to the days customers take to pay, less the days taken to pay suppliers. When that total is negative, the business is funded by its own trading cycle.',
  },
  {
    key: 'write-down-vs-write-off',
    group: 'balance',
    belief: 'A write-down and a write-off are the same thing.',
    fact: 'One reduces an asset\u2019s carrying value; the other removes it entirely.',
    why:
      'A write-down says the asset is worth less than recorded. A write-off says it is worth nothing and takes it off the balance sheet.',
  },
];

// ---------------------------------------------------------------------------
// THE ORDER THEY ARE SHOWN IN
//
// This lives beside the data rather than beside the loading screen because it is
// the only reason the `group` field exists.
//
// Shuffled, so a reader who builds two models in a row does not read the same
// note twice, and then reordered so that NO THREE CONSECUTIVE NOTES COME FROM
// THE SAME PART OF THE ACCOUNTS. Seventeen of the entries sit on the balance
// sheet, so an unordered shuffle regularly puts three or four of them together
// and the screen reads as though the site only knows about one thing.
//
// The reordering is greedy: take the first remaining note whose group differs
// from the last two shown. Near the end of a long order the remainder can be a
// single group, at which point there is no choice and the first remaining note
// is taken. That happens only in the last few of fifty-three, which is far past
// any build worth waiting through. It is a rule the data can exhaust, not a
// guarantee, and it is written that way rather than looping forever looking for
// an arrangement that may not exist.
// ---------------------------------------------------------------------------
export function noteOrder(
  entries: DidYouKnow[] = DID_YOU_KNOW,
  random: () => number = Math.random
): DidYouKnow[] {
  const pool = entries.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const out: DidYouKnow[] = [];
  while (pool.length) {
    const last = out[out.length - 1]?.group;
    const beforeThat = out[out.length - 2]?.group;
    const wouldBeThree = (g: string) => last !== undefined && last === beforeThat && g === last;
    let next = pool.findIndex((n) => !wouldBeThree(n.group));
    if (next < 0) next = 0;
    out.push(pool.splice(next, 1)[0]);
  }
  return out;
}

export default DID_YOU_KNOW;
