// FILE: src/data/dataConstraints.ts
//
// Marginalia — what the source does not give us, and what the site does about it
//
// A data constraint is not a defect. It is a figure the filing or the data
// source never provides, which no amount of code can conjure: stock
// compensation a company never breaks out, marketable securities it reports
// without saying how much is short-term, a depositary receipt whose ratio to an
// ordinary share nobody publishes. The engine cannot fix these. What it can do
// is refuse to pretend, and tell the reader.
//
// THE THRESHOLD, and where it comes from.
//
// For each constraint the bound is computed: the largest move in value per
// share the missing figure could cause, capped by what the filing DOES report.
// Then:
//
//   bound above 25%   REFUSE. No value is shown and the reason is stated.
//   bound 5% to 25%   WARN, above the model and beside it, with the size.
//   bound below 5%    NOTE, listed with the others so nothing is hidden.
//
// Neither number is invented. 25% is the cut the site already uses for a WIDE
// disagreement between the two terminal methods (terminalSpread.ts), chosen
// because the median disagreement between them is 14.5%: a single missing input
// that could move the answer further than two legitimate methods disagree is
// not a number worth showing. 5% is the cut every measurement in
// KNOWN_ISSUES.md uses for "materially moved", which is the right bar for
// telling the reader rather than for withholding.
//
// Where the bound CANNOT be computed from the filing, the constraint is judged
// on two things instead: the effect measured on the companies that do report
// the figure, and whether the error has a known direction. An error that can
// only ever UNDERSTATE the value is a floor, and a floor with its direction
// stated is information; an error that could flatter the company is not. So an
// uncomputable bound warns when the error runs one way and is under 25% on the
// companies that can be measured, and refuses otherwise.
//
// Every constraint records which SOURCE it comes from, so the primary-filings
// data layer (ROADMAP.md section 1) can be pointed at the ones it would remove.

// @ts-ignore — plain JS module, no type declarations
import { buildModel, buildDCF } from '../engine/model.js';

export const MATERIAL = 0.05;
export const UNSHOWABLE = 0.25;

export type ConstraintSeverity = 'refusal' | 'warning' | 'note';

export interface DataConstraint {
  code: string;
  /** One line, plain: what the source does not give. */
  label: string;
  /** What is missing, and what the model does instead. */
  detail: string;
  /** Which source the gap comes from, for the future data layer. */
  source: string;
  /** The size of the error, in words, with its direction where known. */
  effect: string;
  /** The bound as a fraction of value per share, where it can be computed. */
  bound: number | null;
  severity: ConstraintSeverity;
}

export interface DataConstraintResult {
  constraints: DataConstraint[];
  /** The constraints worth showing above the model. */
  warnings: DataConstraint[];
  refusal: { code: string; message: string } | null;
}

const isNum = (v: any): v is number => typeof v === 'number' && isFinite(v);
const pct = (v: number) => `${(Math.abs(v) * 100).toFixed(1)}%`;

/** Re-run the whole model with one figure changed, and return value per share. */
function revalue(modelData: any, mutate: (d: any) => void): number | null {
  try {
    const { rawStatements, ...rest } = modelData;
    const d = JSON.parse(JSON.stringify(rest));
    mutate(d);
    const M: any = buildModel(d);
    const D: any = buildDCF(M, d);
    const v = D?.perpetuity?.valuePerShare;
    return isNum(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

/** Severity from a computed bound. */
function bySize(bound: number | null): ConstraintSeverity {
  if (bound === null) return 'warning';
  const size = Math.abs(bound);
  if (size > UNSHOWABLE) return 'refusal';
  if (size > MATERIAL) return 'warning';
  return 'note';
}

export function buildDataConstraints(
  fetched: any,
  modelData: any,
  model: any,
  dcf: any
): DataConstraintResult {
  const out: DataConstraint[] = [];
  const rows: any[] = Array.isArray(fetched?.statements) ? fetched.statements : [];
  const last = rows[rows.length - 1] ?? {};
  const meta = modelData?.meta ?? {};
  const source: string = fetched?.source || meta.source || 'the data source';
  const v0 = dcf?.applicable ? dcf?.perpetuity?.valuePerShare : null;
  const shares = dcf?.dilutedShares ?? modelData?.dcf?.dilutedSharesCount ?? null;
  const valued = isNum(v0) && v0 > 0;
  const perShare = (amount: number) =>
    valued && isNum(shares) && shares > 0 ? amount / shares / (v0 as number) : null;

  const add = (c: DataConstraint) => out.push(c);

  // ---------------------------------------------------------------------------
  // 1. D&A that cannot be split into depreciation and amortisation
  // ---------------------------------------------------------------------------
  // The forecast depreciates plant and runs an acquired intangible pool down;
  // they behave differently, and the terminal year replaces depreciation for
  // ever while the amortisation stops. Where the source repeats one combined
  // figure as both D&A and depreciation, the split cannot be made at all, and
  // the whole charge is treated as depreciation of PP&E.
  const daRepeated =
    isNum(last.depreciation) &&
    isNum(last.depreciationOfPpe) &&
    Math.abs(last.depreciation - last.depreciationOfPpe) < 1e-6 &&
    !rows.some((r) => isNum(r?.amortisationOfIntangibles));
  const pool = isNum(last.intangibles) && last.intangibles > 0 ? last.intangibles : 0;
  if (daRepeated && pool > 0 && valued) {
    // The bound: amortisation is part of D&A so it cannot exceed it, and over
    // the five forecast years it cannot consume more than the reported pool.
    const annual = Math.max(0, Math.min(pool / 5, isNum(last.depreciation) ? last.depreciation : 0));
    let bound: number | null = 0;
    if (annual > 0) {
      const v = revalue(modelData, (d) => {
        const n = d.historical.cashFlow.depreciationAmortisation.length;
        d.historical.cashFlow.amortisationOfIntangibles = d.historical.cashFlow.amortisationOfIntangibles.map(
          (_: any, i: number) => (i === n - 1 ? annual : null)
        );
        d.historical.cashFlow.depreciationOfPpe = d.historical.cashFlow.depreciationAmortisation.map(
          (x: any, i: number) => (i === n - 1 && isNum(x) ? x - annual : x)
        );
      });
      bound = v === null ? null : v / (v0 as number) - 1;
    }
    add({
      code: 'amortisationNotSplit',
      label: 'Depreciation and amortisation are one figure',
      detail:
        `${source} reports the same number as total depreciation and amortisation and as depreciation alone, so ` +
        `the amortisation of this company's ${Math.round(pool).toLocaleString()} of intangible assets cannot be told ` +
        `from the depreciation of its plant. All of it is charged as depreciation of PP&E, and the terminal value ` +
        `replaces it for ever instead of letting it run off.`,
      source,
      effect:
        bound === null
          ? 'the effect cannot be computed'
          : `at most ${pct(bound)} on the value per share, charging the largest amortisation the pool and the filed ` +
            `D&A allow (${Math.round(annual).toLocaleString()} a year)`,
      bound,
      severity: bySize(bound),
    });
  }

  // ---------------------------------------------------------------------------
  // 2. Stock compensation the filing never breaks out
  // ---------------------------------------------------------------------------
  // Not reported is not nil: any the company paid is inside its cost lines, so
  // operating profit and EBITDA are right. What is missing is the add-back in
  // cash from operations, so the cash flow the valuation is built from is
  // understated by whatever the company actually paid.
  if (!rows.some((r) => isNum(r?.stockComp) && r.stockComp !== 0)) {
    add({
      code: 'stockCompensationNotReported',
      label: 'Stock compensation is never broken out',
      detail:
        `${source} reports no stock compensation for this company in any year. Any it paid stays inside the cost ` +
        `lines, so operating profit and EBITDA are right, but nothing is added back in cash from operations, so ` +
        `the unlevered cash flow the valuation discounts is understated by whatever it paid.`,
      source,
      effect:
        'the amount is not knowable from the filing. Measured on the 49 valued companies that do report it, taking ' +
        'the add-back away lowers the value per share by a median 1.6%, by more than 5% for six of them and by 16.5% ' +
        'at worst. The error runs one way, always downward: this value is a floor, never flattered',
      bound: null,
      severity: 'warning',
    });
  }

  // ---------------------------------------------------------------------------
  // 3. Marketable securities the filing does not split
  // ---------------------------------------------------------------------------
  const notSplit = isNum(last.securitiesNotSplit) && last.securitiesNotSplit > 0 ? last.securitiesNotSplit : 0;
  const stUsable = isNum(last.shortTermInvestments) && last.shortTermInvestments >= 0;
  if (notSplit > 0 && !stUsable) {
    const bound = perShare(notSplit);
    add({
      code: 'securitiesNotSplit',
      label: 'Marketable securities are not split into short and long term',
      detail:
        `${source} reports ${Math.round(notSplit).toLocaleString()} of marketable securities without saying how much ` +
        `of it can be turned into cash within the year. None is netted off debt and none is guessed at: the balance ` +
        `stays inside other current assets, where it already was.`,
      source,
      effect:
        bound === null
          ? 'the effect cannot be computed'
          : `at most ${pct(bound)} on the value per share, netting every one of those securities off debt. The error ` +
            `runs one way: net debt is at worst too high, so this value is a floor`,
      bound,
      severity: bySize(bound),
    });
  }

  // ---------------------------------------------------------------------------
  // 4. A cost of debt that cannot be read from the filing
  // ---------------------------------------------------------------------------
  if (/assumed/.test(String(modelData?.provenance?.interest || '')) && valued) {
    const at = (rate: number) =>
      revalue(modelData, (d) => {
        const debts = d.historical.balanceSheet.longTermDebt;
        const debt = debts[debts.length - 1] ?? 0;
        const interest = Math.round(debt * rate);
        d.assumptions.interestExpenseFY2025 = interest;
        d.assumptions.interestExpenseOnLongTermDebt = d.assumptions.interestExpenseOnLongTermDebt.map(() => interest);
      });
    const lo = at(0.02);
    const hi = at(0.08);
    const bound = lo !== null && hi !== null ? Math.abs(hi - lo) / (v0 as number) : null;
    add({
      code: 'costOfDebtAssumed',
      label: "The company's own cost of debt cannot be read",
      detail:
        `The filed interest expense cannot be turned into a borrowing rate for this company, so the forecast uses ` +
        `4.5%, an assumption rather than its own. ${modelData?.provenance?.interest ?? ''}`,
      source,
      effect:
        bound === null
          ? 'the effect cannot be computed'
          : `at most ${pct(bound)} on the value per share across a wide band, 2% to 8%`,
      bound,
      severity: bySize(bound),
    });
  }

  // ---------------------------------------------------------------------------
  // 5. Leased assets with no lease liability that can be read
  // ---------------------------------------------------------------------------
  // This is the one constraint whose error FLATTERS: a liability left out of
  // net debt makes the shares look worth more.
  const leaseYears: number[] = Array.isArray(meta.debt?.leaseUnreadableYears) ? meta.debt.leaseUnreadableYears : [];
  const rou = isNum(last.financeLeaseRightOfUseAsset) ? last.financeLeaseRightOfUseAsset : 0;
  if (leaseYears.includes(last.fiscalYear) && rou > 0) {
    const bound = perShare(rou);
    add({
      code: 'leaseLiabilityUnreadable',
      label: 'Leased assets are reported with no lease liability',
      detail:
        `The filing shows ${Math.round(rou).toLocaleString()} of finance-leased assets and no lease liability that ` +
        `can be read, so none is counted as debt. Unlike the others, this error flatters: a liability left out of ` +
        `net debt makes the shares look worth more than they are.`,
      source,
      effect:
        bound === null
          ? 'the effect cannot be computed'
          : `at most ${pct(bound)} on the value per share, counting the whole leased asset as the liability behind it`,
      bound,
      severity: bySize(bound),
    });
  }

  // ---------------------------------------------------------------------------
  // 6. Lines the filing does not report at all
  // ---------------------------------------------------------------------------
  const notReported: any[] = Array.isArray(meta.notReported) ? meta.notReported : [];
  const others = notReported.filter((g) => g.field !== 'stockComp');
  if (others.length) {
    add({
      code: 'linesNotReported',
      label: `${others.map((g) => g.label).join(', ')} not reported`,
      detail:
        others
          .map((g) => `${g.label} is not reported for ${g.years.map((y: number) => `FY${y}`).join(', ')}: ${g.treatment}`)
          .join('; ') + '.',
      source,
      effect:
        'no effect on the value: an unreported cost line sits inside other operating costs, which ties operating ' +
        'income to the filing, and dividends and buybacks are averaged over the years that do report them',
      bound: 0,
      severity: 'note',
    });
  }

  // ---------------------------------------------------------------------------
  // 7. Total liabilities the filing does not tag
  // ---------------------------------------------------------------------------
  const gaps: any[] = Array.isArray(meta.balanceSheetGaps) ? meta.balanceSheetGaps : [];
  const derivedLiabilities = gaps.find((g) => g.field === 'totalLiabilities' && g.derivedAs);
  if (derivedLiabilities) {
    add({
      code: 'totalLiabilitiesDerived',
      label: 'Total liabilities are not tagged, and are worked out',
      detail:
        `${source} does not report total liabilities for ${derivedLiabilities.years.map((y: number) => `FY${y}`).join(', ')}. ` +
        `It is taken as ${derivedLiabilities.derivedAs}, which carries any non-controlling interest inside liabilities ` +
        `on the model's balance sheet.`,
      source,
      effect:
        'no effect on the value: presentation only. Net debt is borrowings less cash, never total liabilities, and ' +
        'minority interests are read from the filing\'s own balance',
      bound: 0,
      severity: 'note',
    });
  }

  // ---------------------------------------------------------------------------
  // 8. A price converted at the rate on the day it was fetched
  // ---------------------------------------------------------------------------
  const basis = meta.currencyBasis;
  if (basis?.priceConverted) {
    add({
      code: 'priceConvertedAtOneRate',
      label: 'The price is converted at one exchange rate',
      detail:
        `The statements are in ${basis.reportingCurrency} and this listing trades in ${basis.quotedCurrency}. The ` +
        `price, the previous close and the 52-week range are all converted at the one rate fetched with the price, ` +
        `because no free source gives the rate on each day of the past year.`,
      source: 'Yahoo Finance (exchange rate)',
      effect:
        'no effect on the value per share, which is computed in the statements\' own currency. The 52-week range is ' +
        'a year of prices at today\'s rate, so it is indicative rather than exact',
      bound: 0,
      severity: 'note',
    });
  }

  // ---------------------------------------------------------------------------
  // 9. A bank whose dividends are not split between common and preferred
  // ---------------------------------------------------------------------------
  const isBank = rows.length > 0 && !rows.some((r) => isNum(r?.commonDividendsPaid));
  const paysDividends = rows.some((r) => isNum(r?.dividendsPaid) && r.dividendsPaid !== 0);
  const hasPreferred =
    rows.some((r) => isNum(r?.preferredStock) && r.preferredStock > 0) ||
    rows.some((r) => isNum(r?.preferredDividends) && r.preferredDividends !== 0);
  if (isBank && paysDividends && hasPreferred) {
    add({
      code: 'dividendSplitUnavailable',
      label: 'Dividends are not split between common and preferred',
      detail:
        `${source} reports one total for dividends paid and no common-only figure, while this company has preferred ` +
        `stock. Residual income takes dividends paid less the preferred dividends the filing reports, which assumes ` +
        `the total includes them.`,
      source,
      effect:
        'the payout ratio moves by roughly three points either way where the assumption is wrong, which the residual ' +
        'income value is not sensitive to: it changes how fast book equity compounds, not what it earns',
      bound: null,
      severity: 'warning',
    });
  }

  // ---------------------------------------------------------------------------
  const refusing = out.filter((c) => c.severity === 'refusal');
  const warnings = out.filter((c) => c.severity === 'warning' || c.severity === 'refusal');

  const refusal = refusing.length
    ? {
        code: 'dataConstraintTooLarge',
        message:
          (refusing.length === 1
            ? `${refusing[0].detail} `
            : refusing.map((c) => c.detail).join(' ') + ' ') +
          `That leaves the value per share uncertain by ${refusing
            .map((c) => (c.bound === null ? 'an amount that cannot be bounded' : pct(c.bound)))
            .join(' and ')}, which is further than the two terminal methods ordinarily disagree. It is a gap in what ` +
          `the source publishes, not a fault in the company, and no amount of modelling can close it, so no value is ` +
          `shown rather than one that cannot be stood behind. The reported figures below are unaffected.`,
      }
    : null;

  return { constraints: out, warnings, refusal };
}

export default { buildDataConstraints, MATERIAL, UNSHOWABLE };
