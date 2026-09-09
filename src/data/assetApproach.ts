// FILE: src/data/assetApproach.ts
//
// Marginalia — the asset approach
//
// The third way to value a company. The income approach asks what the business
// earns, the market approach asks what buyers pay for businesses like it, and
// this one asks the oldest question of the three: what are the things it owns
// actually worth, once everything it owes is paid?
//
// EVERY FIGURE HERE COMES FROM THE FILINGS, NOT THE FORECAST. That is not a
// shortcut, it is the point. An asset approach is a statement about what exists
// today. The moment it borrows a projected balance sheet it stops answering its
// own question.
//
// Four measures, from the most conservative reading to the least:
//
//   BOOK VALUE            total assets less total liabilities. What the
//                         accounts say the owners' share is worth.
//   TANGIBLE BOOK VALUE   the same, with goodwill and intangibles removed.
//                         Goodwill is the premium somebody once paid over the
//                         value of what they bought. In a break-up it fetches
//                         nothing, so a buyer of assets ignores it.
//   NET CURRENT ASSET     current assets less ALL liabilities, ignoring every
//   VALUE                 fixed asset entirely. Benjamin Graham's floor: what
//                         would be left if the factories were worth zero.
//   LIQUIDATION VALUE     each class of asset written down by a recovery rate
//                         the READER sets, less all liabilities.
//
// THE DIVISION OF LABOUR IN THE LAST ONE MATTERS. The balance sheet figures are
// reported facts. The recovery rates are the reader's judgement, and they are
// yellow assumption rows exactly like every other driver on the site. Nothing
// here quietly decides for them how much a warehouse of inventory fetches in a
// forced sale.
//
// A measure that comes out negative is not shown as a value. A negative floor
// is not a floor, and printing one would invite the reader to average it into
// something. The reason is stated instead.

export interface RecoveryRates {
  cash: number;
  receivables: number;
  inventory: number;
  otherCurrentAssets: number;
  propertyPlantEquipment: number;
  intangibles: number;
  otherAssets: number;
}

// Two presets, because the honest answer depends entirely on which question is
// being asked, and a single set of rates hides that.
//
//   FORCED SALE      the company has failed and everything must go this
//                    quarter. Buyers know it. This is what an insolvency
//                    practitioner would assume.
//   ORDERLY WIND-DOWN the company closes by choice, with a year or two to find
//                    proper buyers for the plant and to collect the debts.
//
// The same company can be worth nothing on the first and a great deal on the
// second. Showing both teaches that in one click, which no single default can.
export const FORCED_SALE: RecoveryRates = {
  cash: 1.0,
  receivables: 0.8,
  inventory: 0.5,
  otherCurrentAssets: 0.25,
  propertyPlantEquipment: 0.3,
  intangibles: 0,
  otherAssets: 0.2,
};

export const ORDERLY_WINDDOWN: RecoveryRates = {
  cash: 1.0,
  receivables: 0.9,
  inventory: 0.75,
  otherCurrentAssets: 0.5,
  propertyPlantEquipment: 0.65,
  intangibles: 0,
  otherAssets: 0.4,
};

export const RECOVERY_PRESETS: {
  key: 'forcedSale' | 'orderly';
  label: string;
  description: string;
  rates: RecoveryRates;
}[] = [
  {
    key: 'forcedSale',
    label: 'Forced sale',
    description:
      'everything must be sold this quarter, and the buyers know it',
    rates: FORCED_SALE,
  },
  {
    key: 'orderly',
    label: 'Orderly wind-down',
    description:
      'the company closes by choice, with a year or two to find proper buyers',
    rates: ORDERLY_WINDDOWN,
  },
];

// The starting point. The harsher of the two, because a floor that flatters is
// not a floor.
export const DEFAULT_RECOVERY: RecoveryRates = FORCED_SALE;

export const RECOVERY_LABELS: { key: keyof RecoveryRates; label: string }[] = [
  { key: 'cash', label: 'Cash and equivalents' },
  { key: 'receivables', label: 'Trade receivables' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'otherCurrentAssets', label: 'Other current assets' },
  { key: 'propertyPlantEquipment', label: 'Property, plant and equipment' },
  { key: 'intangibles', label: 'Goodwill and intangibles' },
  { key: 'otherAssets', label: 'Other non-current assets' },
];

export interface WorkingLine {
  label: string;
  value: number | null;
  /** Shown in grey beneath, e.g. the recovery rate applied. */
  note?: string;
  emphasis?: boolean;
}

export interface AssetMeasure {
  key: 'book' | 'tangibleBook' | 'ncav' | 'liquidation';
  label: string;
  question: string;
  perShare: number | null;
  workings: WorkingLine[];
  absentBecause?: string;
}

export interface AssetApproachResult {
  available: boolean;
  message?: string;
  fiscalYear: number | null;
  measures: AssetMeasure[];
  usable: AssetMeasure[];
  low: number | null;
  high: number | null;
  mid: number | null;
  /** False when the balance sheet holds little of what makes the company work. */
  informative: boolean;
  suitability: string;
  /** True when goodwill or intangibles were not disclosed separately. */
  intangiblesIncomplete: boolean;
}

const isNum = (v: any): v is number => typeof v === 'number' && isFinite(v);
const or0 = (v: any) => (isNum(v) ? v : 0);

/**
 * @param reported  the LAST REPORTED year, straight from the filings, in the
 *                  same money units as the rest of the model (millions)
 * @param shares    diluted shares IN MILLIONS, matching those money units
 * @param recovery  the reader's recovery rates
 * @param isFinancial banks and lenders get no liquidation measure
 */
export function buildAssetApproach(
  reported: any,
  shares: number | null,
  recovery: RecoveryRates = DEFAULT_RECOVERY,
  isFinancial = false
): AssetApproachResult {
  const empty: AssetApproachResult = {
    available: false,
    fiscalYear: null,
    measures: [],
    usable: [],
    low: null,
    high: null,
    mid: null,
    informative: false,
    suitability: '',
    intangiblesIncomplete: false,
  };

  if (!reported || !isNum(shares) || shares <= 0) {
    return {
      ...empty,
      message:
        'The asset approach needs a reported balance sheet and a share count. One of them is missing for this company.',
    };
  }

  const totalAssets = isNum(reported.totalAssets) ? reported.totalAssets : null;
  const totalLiabilities = isNum(reported.totalLiabilities)
    ? reported.totalLiabilities
    : null;

  if (totalAssets === null || totalLiabilities === null) {
    return {
      ...empty,
      fiscalYear: isNum(reported.fiscalYear) ? reported.fiscalYear : null,
      message:
        'The filing does not give total assets and total liabilities, so nothing can be built from the balance sheet.',
    };
  }

  const perShare = (value: number) => value / shares;
  const fiscalYear = isNum(reported.fiscalYear) ? reported.fiscalYear : null;

  const goodwill = isNum(reported.goodwill) ? reported.goodwill : null;
  const intangibles = isNum(reported.intangibles) ? reported.intangibles : null;
  const softAssets = or0(goodwill) + or0(intangibles);
  const intangiblesIncomplete = goodwill === null || intangibles === null;

  const currentAssets = isNum(reported.currentAssets) ? reported.currentAssets : null;
  const ppe = isNum(reported.ppeNet) ? reported.ppeNet : null;
  const cash = isNum(reported.cash) ? reported.cash : null;
  const receivables = isNum(reported.receivables) ? reported.receivables : null;
  const inventory = isNum(reported.inventory) ? reported.inventory : null;

  const measures: AssetMeasure[] = [];

  // ---- 1. Book value -------------------------------------------------------
  // Assets less liabilities rather than the reported equity line, because one
  // of the two data sources reports equity excluding minority interests, and
  // the subtraction is the same figure computed the same way for everybody.
  const bookValue = totalAssets - totalLiabilities;
  measures.push({
    key: 'book',
    label: 'Book value',
    question: 'what the accounts say the owners’ share is worth',
    perShare: bookValue > 0 ? perShare(bookValue) : null,
    absentBecause:
      bookValue > 0
        ? undefined
        : 'liabilities exceed assets, so the accounts show no positive equity',
    workings: [
      { label: 'Total assets', value: totalAssets },
      { label: 'Less total liabilities', value: -totalLiabilities },
      { label: 'Book value of equity', value: bookValue, emphasis: true },
      { label: 'Diluted shares (millions)', value: shares },
    ],
  });

  // ---- 2. Tangible book value ---------------------------------------------
  if (goodwill === null && intangibles === null) {
    measures.push({
      key: 'tangibleBook',
      label: 'Tangible book value',
      question: 'the same, with goodwill and intangibles removed',
      perShare: null,
      absentBecause:
        'this filer does not disclose goodwill or intangibles separately, so they cannot be removed',
      workings: [],
    });
  } else {
    const tangible = bookValue - softAssets;
    measures.push({
      key: 'tangibleBook',
      label: 'Tangible book value',
      question: 'the same, with goodwill and intangibles removed',
      perShare: tangible > 0 ? perShare(tangible) : null,
      absentBecause:
        tangible > 0
          ? undefined
          : 'once goodwill and intangibles are removed there is no positive equity left',
      workings: [
        { label: 'Book value of equity', value: bookValue },
        { label: 'Less goodwill', value: goodwill === null ? null : -goodwill,
          note: goodwill === null ? 'not disclosed separately' : undefined },
        { label: 'Less other intangibles', value: intangibles === null ? null : -intangibles,
          note: intangibles === null ? 'not disclosed separately' : undefined },
        { label: 'Tangible book value', value: tangible, emphasis: true },
      ],
    });
  }

  // ---- 3. Net current asset value -----------------------------------------
  if (currentAssets === null) {
    measures.push({
      key: 'ncav',
      label: 'Net current asset value',
      question: 'what is left if every fixed asset is worth nothing',
      perShare: null,
      absentBecause: 'the filing does not separate current assets',
      workings: [],
    });
  } else {
    const ncav = currentAssets - totalLiabilities;
    measures.push({
      key: 'ncav',
      label: 'Net current asset value',
      question: 'what is left if every fixed asset is worth nothing',
      perShare: ncav > 0 ? perShare(ncav) : null,
      absentBecause:
        ncav > 0
          ? undefined
          : 'current assets do not cover all liabilities, so this floor is negative and no floor at all',
      workings: [
        { label: 'Current assets', value: currentAssets },
        { label: 'Less ALL liabilities, current and long term', value: -totalLiabilities },
        { label: 'Net current asset value', value: ncav, emphasis: true },
      ],
    });
  }

  // ---- 4. Liquidation value -----------------------------------------------
  if (isFinancial) {
    measures.push({
      key: 'liquidation',
      label: 'Liquidation value',
      question: 'each asset written down to what a forced sale would fetch',
      perShare: null,
      absentBecause:
        'a lender’s assets are loans, and what they fetch depends on the credit behind them rather than on a recovery rate applied to a category. Book value is the measure that carries meaning for a financial company',
      workings: [],
    });
  } else if (currentAssets === null || ppe === null) {
    measures.push({
      key: 'liquidation',
      label: 'Liquidation value',
      question: 'each asset written down to what a forced sale would fetch',
      perShare: null,
      absentBecause:
        'the filing does not break the balance sheet into enough categories to apply recovery rates',
      workings: [],
    });
  } else {
    const otherCurrent = Math.max(
      0,
      currentAssets - or0(cash) - or0(receivables) - or0(inventory)
    );
    const otherNonCurrent = Math.max(0, totalAssets - currentAssets - ppe - softAssets);

    const buckets: { key: keyof RecoveryRates; label: string; gross: number }[] = [
      { key: 'cash', label: 'Cash and equivalents', gross: or0(cash) },
      { key: 'receivables', label: 'Trade receivables', gross: or0(receivables) },
      { key: 'inventory', label: 'Inventory', gross: or0(inventory) },
      { key: 'otherCurrentAssets', label: 'Other current assets', gross: otherCurrent },
      { key: 'propertyPlantEquipment', label: 'Property, plant and equipment', gross: ppe },
      { key: 'intangibles', label: 'Goodwill and intangibles', gross: softAssets },
      { key: 'otherAssets', label: 'Other non-current assets', gross: otherNonCurrent },
    ];

    const recovered = buckets.reduce(
      (sum, b) => sum + b.gross * (recovery[b.key] ?? 0),
      0
    );
    const liquidation = recovered - totalLiabilities;

    measures.push({
      key: 'liquidation',
      label: 'Liquidation value',
      question: 'each asset written down to what a forced sale would fetch',
      perShare: liquidation > 0 ? perShare(liquidation) : null,
      absentBecause:
        liquidation > 0
          ? undefined
          : 'at these recovery rates the assets do not cover the liabilities, so there is nothing left for shareholders',
      workings: [
        ...buckets.map((b) => ({
          label: b.label,
          value: b.gross * (recovery[b.key] ?? 0),
          note: `${b.gross.toLocaleString(undefined, {
            maximumFractionDigits: 0,
          })} recovered at ${Math.round((recovery[b.key] ?? 0) * 100)}%`,
        })),
        { label: 'Total recovered from assets', value: recovered, emphasis: true },
        { label: 'Less total liabilities', value: -totalLiabilities },
        { label: 'Left for shareholders', value: liquidation, emphasis: true },
      ],
    });
  }

  // ---- Is any of this informative for THIS company? ------------------------
  //
  // An asset approach describes a company whose value sits on its balance
  // sheet. For a software or services business the value sits in people and in
  // intellectual property that never reaches the balance sheet at all, so these
  // figures are true and beside the point. Say which one this is rather than
  // letting the reader assume.
  const hardAssets = or0(ppe) + or0(inventory);
  const hardShare = totalAssets > 0 ? hardAssets / totalAssets : 0;
  const informative = hardShare >= 0.2;
  const suitability = informative
    ? `Property, plant and inventory are ${(hardShare * 100).toFixed(
        0
      )}% of this company’s assets, so the balance sheet holds a real part of what the business is. These figures are worth weighing against the other two approaches.`
    : `Property, plant and inventory are only ${(hardShare * 100).toFixed(
        0
      )}% of this company’s assets. What makes this business valuable does not sit on its balance sheet, so these figures are correct and largely beside the point. They are shown as a floor, not as a valuation.`;

  const usable = measures.filter((m) => isNum(m.perShare));
  const values = usable.map((m) => m.perShare as number).sort((a, b) => a - b);
  const middle = Math.floor(values.length / 2);

  return {
    available: usable.length > 0,
    message: usable.length
      ? undefined
      : 'Every measure in the asset approach came out negative or could not be computed for this company. Nothing is shown rather than a figure that means nothing.',
    fiscalYear,
    measures,
    usable,
    low: values.length ? values[0] : null,
    high: values.length ? values[values.length - 1] : null,
    mid: values.length
      ? values.length % 2
        ? values[middle]
        : (values[middle - 1] + values[middle]) / 2
      : null,
    informative,
    suitability,
    intangiblesIncomplete,
  };
}

export default {
  buildAssetApproach,
  DEFAULT_RECOVERY,
  FORCED_SALE,
  ORDERLY_WINDDOWN,
  RECOVERY_PRESETS,
  RECOVERY_LABELS,
};
