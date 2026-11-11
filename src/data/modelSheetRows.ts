// FILE: src/data/modelSheetRows.ts
//
// THE PUBLISHED ROW CONTRACT OF THE MODEL SHEET, and nothing else.
//
// WHY IT IS ITS OWN FILE (`KI-40`, 2026-11-11). These are row numbers and
// labels — plain data, with no dependency on anything. They used to live in
// `excelExport.ts`, which imports ExcelJS at its top, so ANY module that
// wanted a row number pulled the whole workbook library in behind it.
// `heads.ts` wants one, `App.tsx` reaches `heads.ts`, and the result was
// **exceljs and JSZip inside the entry chunk the landing page loads first** —
// a megabyte of workbook writer shipped to a reader who has not asked for a
// workbook and may never ask.
//
// It also ends a cycle that was documented rather than fixed: `excelSheets`
// imported `heads`, `heads` imported `excelExport`, and `excelExport` imported
// `excelSheets`. ES modules resolve a cycle by handing back a half-initialised
// module, so which screen you entered by decided whether the map was ready.
// Nothing imports in a circle through this file: it imports nothing at all.
//
// ONE DEFINITION STILL. `CLAUDE.md` warns that two copies of a positional
// layout is how one goes stale; this moves the single definition, it does not
// copy it. `excelExport.ts` re-exports these names, so every existing importer
// is unchanged and `verify:workbook` checks the same contract it always did.

/* =========================================================================
   THE STANDARD CHART OF ACCOUNTS

   Every line the 3-Statement sheet carries, and the row it sits on, in every
   workbook this site produces. A firm writing a macro against one model can
   run it against all of them: `B$26` is revenue for Apple, for Toyota and for
   Reliance alike.

   WHY THIS IS A CONSTANT AND NOT A COMMENT. The rows used to be wherever the
   running counter happened to reach. Measured across 58 companies before this
   was written, 61 of the model sheet's lines sat at a different row in a
   different workbook and no two companies shared a layout -- not because
   lines were missing (all 101 were present in all 58) but because a block of
   "Not reported:" notes was as tall as the number of lines a company happened
   not to report: nothing for Apple, three rows for Toyota. Everything below
   moved with it. That block now reserves one row per line that CAN be
   unreported, blank where the company reports it, which is the same rule the
   rest of the site follows and the reason these numbers can be promised.

   HOW IT IS ENFORCED. Every row registers through `line`, `calc` or `asFiled`,
   and each of those checks the row it just took against this map. A line that
   lands anywhere else throws while the workbook is being built, so a broken
   contract cannot be downloaded -- it is not merely asserted in a test that
   somebody might not run. `verify:workbook` re-checks it against every payload.

   CHANGING IT IS ALLOWED, QUIETLY CHANGING IT IS NOT. Insert a line and every
   row below moves; update this map and METHODOLOGY.md section 22a in the same
   commit, and the published contract has a new version rather than a silent
   edit.
   ========================================================================= */
export const MODEL_SHEET_ROWS: Readonly<Record<string, number>> = Object.freeze({
  circBreaker: 9,
  rev: 26,
  revGrowth: 27,
  gm: 28,
  cogs: 29,
  gp: 30,
  rndPct: 31,
  rnd: 32,
  sgaPct: 33,
  sga: 34,
  otherPct: 35,
  otherOpex: 36,
  daCost: 37,
  sbcCost: 38,
  ebit: 39,
  cashRate: 40,
  intInc: 41,
  debtRate: 42,
  pikRate: 43,
  revRate: 44,
  intExp: 45,
  otherIncPct: 46,
  other: 47,
  pbt: 48,
  taxRate: 49,
  tax: 50,
  afterTax: 51,
  ni: 52,
  sbcPct: 54,
  sbc: 55,
  da: 56,
  ebitda: 57,
  cogsFiled: 60,
  rndFiled: 61,
  sgaFiled: 62,
  otherFiled: 63,
  pretaxFiled: 64,
  niFiled: 65,
  cogsEmbedded: 66,
  cogsFiledBasis: 67,
  arPct: 91,
  arBop: 92,
  arChg: 93,
  arEnd: 94,
  invPct: 97,
  invBop: 98,
  invChg: 99,
  invEnd: 100,
  apPct: 103,
  apBop: 104,
  apChg: 105,
  apEnd: 106,
  accPct: 109,
  accBop: 110,
  accChg: 111,
  accEnd: 112,
  ocaPct: 115,
  ocaBop: 116,
  ocaChg: 117,
  ocaEnd: 118,
  dtaPct: 121,
  dtaBop: 122,
  dtaChg: 123,
  dtaEnd: 124,
  oaMove: 127,
  oaBop: 128,
  oaChg: 129,
  oaEnd: 130,
  onclMove: 133,
  onclBop: 134,
  onclChg: 135,
  onclEnd: 136,
  capexPct: 139,
  depPct: 140,
  ppeIntensity: 141,
  ppeBop: 142,
  ppeGrowthCapex: 143,
  ppeDep: 144,
  ppeCapex: 145,
  ppeOther: 146,
  ppeEnd: 147,
  amortAnnual: 150,
  intangEnd: 151,
  amort: 152,
  debtBorrow: 162,
  debtPik: 163,
  debtBop: 164,
  debtEnd: 165,
  minCash: 168,
  revBop: 169,
  revDraw: 170,
  revEnd: 171,
  csIssue: 184,
  csBop: 185,
  csEnd: 186,
  payout: 189,
  reBop: 190,
  reDiv: 191,
  reEnd: 192,
  buyback: 195,
  tsBop: 196,
  tsEnd: 197,
  ociChg: 200,
  ociBop: 201,
  ociEnd: 202,
  cfNi: 205,
  cfDa: 206,
  cfSbc: 207,
  cfWc: 208,
  cfPik: 209,
  cfOther: 210,
  cfoFiled: 211,
  cfo: 212,
  cfi: 213,
  cff: 214,
  netChange: 215,
  cashBop: 216,
  cashEnd: 217,
  bsCash: 227,
  bsAr: 228,
  bsInv: 229,
  bsDta: 230,
  bsOca: 231,
  bsPpe: 232,
  bsOa: 233,
  bsTa: 234,
  bsAp: 236,
  bsAcc: 237,
  bsRevolver: 238,
  bsDebt: 239,
  bsOncl: 240,
  bsTl: 241,
  bsCs: 243,
  bsTs: 244,
  bsRe: 245,
  bsOci: 246,
  bsTe: 247,
  bsCheck: 248,
});

/**
 * The name each contracted row carries, so a reader checking the contract is
 * checking a line and not just a number. Where a label embeds a figure of the
 * company's own ("Minimum cash balance - 6.0% of revenue"), the digits are
 * what differ; the check normalises them before comparing.
 */
export const MODEL_SHEET_ROW_LABELS: Readonly<Record<string, string | readonly string[]>> =
  Object.freeze({
  rev: "Revenue",
  revGrowth: [
    "Revenue growth",
    "Revenue growth — fades in a straight line to the terminal rate on the DCF sheet",
  ],
  gm: "Gross margin before D&A and SBC",
  cogs: "Cost of sales, excluding D&A and SBC",
  gp: "Gross profit before D&A and SBC",
  rndPct: "Research & development, % of revenue",
  rnd: "Research & development, excluding D&A and SBC",
  sgaPct: "Selling, general & administrative, % of revenue",
  sga: "Selling, general & administrative, excluding D&A and SBC",
  otherPct: "Other operating costs, % of revenue",
  otherOpex: "Other operating costs, excluding D&A and SBC: operating income as filed less the lines above",
  daCost: "Less: depreciation & amortization",
  sbcCost: "Less: stock based compensation",
  ebit: "Operating profit (EBIT)",
  cashRate: "Return earned on cash",
  intInc: "Interest income",
  debtRate: "Cash interest rate on debt",
  pikRate: "PIK interest rate on debt",
  revRate: "Interest rate on revolver",
  intExp: "Interest expense",
  otherIncPct: "Other income / (expense), % of revenue",
  other: "Other income / (expense), net",
  pbt: "Pretax profit",
  taxRate: "Tax rate",
  tax: "Taxes",
  afterTax: "Items after tax: non-controlling interests, discontinued operations",
  ni: "Net income",
  sbcPct: "Stock based compensation, % of revenue",
  sbc: "Stock based compensation",
  da: "Depreciation & amortization",
  ebitda: "EBITDA",
  cogsFiled: "Cost of sales, as filed",
  rndFiled: "Research & development, as filed",
  sgaFiled: "Selling, general & administrative, as filed",
  otherFiled: "Other operating costs: operating income as filed less the lines above",
  pretaxFiled: "Pretax income, as filed",
  niFiled: "Net income, as filed",
  cogsEmbedded: "D&A and SBC in cost of sales, % of revenue (last reported year)",
  cogsFiledBasis: "Cost of sales on the filed basis, D&A and SBC included",
  arPct: "Receivables as % of revenue",
  arBop: "Beginning of period",
  arChg: "Increase / (decrease)",
  arEnd: "End of period",
  invPct: "Inventory as % of cost of sales, as filed",
  invBop: "Beginning of period",
  invChg: "Increase / (decrease)",
  invEnd: "End of period",
  apPct: [
    "Payables as % of revenue",
    "Payables as % of cost of sales, as filed",
  ],
  apBop: "Beginning of period",
  apChg: "Increase / (decrease)",
  apEnd: "End of period",
  accPct: "Accrued expenses as % of revenue",
  accBop: "Beginning of period",
  accChg: "Increase / (decrease)",
  accEnd: "End of period",
  ocaPct: "Other current assets as % of cost of sales, as filed",
  ocaBop: "Beginning of period",
  ocaChg: "Increase / (decrease)",
  ocaEnd: "End of period",
  dtaPct: "Deferred tax assets as % of revenue",
  dtaBop: "Beginning of period",
  dtaChg: "Increase / (decrease)",
  dtaEnd: "End of period",
  oaMove: "Additions / (disposals), excluding amortisation of intangibles",
  oaBop: "Beginning of period",
  oaChg: "Increase / (decrease)",
  oaEnd: "End of period",
  onclMove: "Other non-current liabilities: additions / (disposals)",
  onclBop: "Beginning of period",
  onclChg: "Increase / (decrease)",
  onclEnd: "End of period",
  capexPct: [
    "Growth in capital expenditure, year on year",
    "Capital expenditure as % of revenue",
  ],
  depPct: "Depreciation as % of the assets in service",
  ppeIntensity: [
    "Net PP&E as % of revenue — not used: this model projects capital spending as a single line",
    "Net PP&E as % of revenue",
  ],
  ppeBop: "Beginning of period",
  ppeGrowthCapex: [
    "Plus: capital expenditures to add plant — not used: capital spending is projected as a single line",
    "Plus: capital expenditures to add plant, on the increase in revenue",
  ],
  ppeDep: "Less: depreciation",
  ppeCapex: [
    "Plus: capital expenditures",
    "Plus: capital expenditures, replacement plus growth",
  ],
  ppeOther: "Plus: other movements in the balance (disposals, acquisitions, leases, currency)",
  ppeEnd: "End of period",
  amortAnnual: "Annual amortisation of intangibles, anchored to the last reported year",
  intangEnd: "Intangible assets excluding goodwill, end of period",
  amort: "Amortisation of intangibles",
  debtBorrow: "Additional borrowing / (pay down)",
  debtPik: "PIK interest accrued to the balance",
  debtBop: "Beginning of period",
  debtEnd: "End of period",
  minCash: [
    "Minimum cash balance",
    "Minimum cash balance — 6.0% of revenue, the least this company has operated on",
    "Minimum cash balance — 18.7% of revenue, the least this company has operated on",
    "Minimum cash balance — 3.9% of revenue, the least this company has operated on",
    "Minimum cash balance — 8.5% of revenue, the least this company has operated on",
    "Minimum cash balance — 13.5% of revenue, the least this company has operated on",
    "Minimum cash balance — 188.2% of revenue, the least this company has operated on",
    "Minimum cash balance — 175.3% of revenue, the least this company has operated on",
  ],
  revBop: "Revolver, beginning of period",
  revDraw: "Revolver draw / (repayment)",
  revEnd: "Revolver, end of period",
  csIssue: "New share issuances",
  csBop: "Beginning of period",
  csEnd: "End of period",
  payout: "Dividend payout ratio",
  reBop: "Beginning of period",
  reDiv: "Less: common dividends",
  reEnd: "End of period",
  buyback: "Share repurchases",
  tsBop: "Beginning of period",
  tsEnd: "End of period",
  ociChg: "Income / (loss) in the period",
  ociBop: "Beginning of period",
  ociEnd: "End of period",
  cfNi: "Net income",
  cfDa: "Depreciation & amortization",
  cfSbc: "Stock based compensation",
  cfWc: "Movements in working capital and other items",
  cfPik: "Non-cash PIK interest added back",
  cfOther: "Other items in the filed statement, not carried by this model",
  cfoFiled: "Cash from operating activities, as filed",
  cfo: "Cash from operating activities",
  cfi: "Cash from investing activities",
  cff: "Cash from financing activities",
  netChange: "Net change in cash",
  cashBop: "Cash, beginning of period",
  cashEnd: "Cash, end of period",
  bsCash: "Cash & equivalents",
  bsAr: "Accounts receivable",
  bsInv: "Inventory",
  bsDta: "Deferred tax assets",
  bsOca: "Other current assets",
  bsPpe: "Property, plant & equipment",
  bsOa: "Other assets",
  bsTa: "Total assets",
  bsAp: "Accounts payable",
  bsAcc: "Accrued expenses & deferred revenue",
  bsRevolver: "Revolver",
  bsDebt: "Long term debt",
  bsOncl: "Other non-current liabilities",
  bsTl: "Total liabilities",
  bsCs: "Common stock & additional paid in capital",
  bsTs: "Treasury stock",
  bsRe: "Retained earnings",
  bsOci: "Other comprehensive income",
  bsTe: "Total equity",
  bsCheck: "Balance check",
  });

/** The contract's version, bumped whenever a row number above changes. */
export const MODEL_SHEET_ROWS_VERSION = 1;
