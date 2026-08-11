// Apple Inc. — company data file.
// EVERY number here comes from Vansh's Excel model. No calculations live in this
// file. Any other company is a copy of this file with different numbers.
// Units: US$ millions (Apple reports in millions).

const AAPL = {
  meta: {
    name: 'Apple Inc.',
    ticker: 'AAPL',
    currency: 'USD',
    unitLabel: '$ millions',
    historicalYears: [2023, 2024, 2025],
    forecastYears: [2026, 2027, 2028, 2029, 2030],
    latestFiscalYearEnd: '2025-09-27',
    // Fiscal year-end date of each FORECAST year (used for DCF discounting)
    forecastYearEndDates: ['2026-09-30', '2027-09-30', '2028-09-29', '2029-09-29', '2030-09-29'],
    daysInYear: 365,
    circuitBreaker: 'ON', // ON = no interest income / no revolver interest (kills circularity)
    // Used to decide whether a DCF is the right instrument at all. SIC 6000-6799
    // is the finance range; sector comes from Yahoo. Either one flags a bank,
    // NBFC or insurer, and the dashboard then shows no implied value.
    sicCode: 3571,
    sector: 'Technology',
  },

  // ---------------------------------------------------------------- HISTORICALS
  // Arrays run [2023, 2024, 2025]. `null` = not in the Excel model.
  historical: {
    incomeStatement: {
      revenue: [383285, 391035, 416161],
      cogs: [-214137, -210352, -220960],
      researchDevelopment: [-29915, -31370, -34550],
      sellingGeneralAdmin: [-24932, -26097, -27601],
      otherIncomeExpense: [-565, 269, -321],
      taxes: [-16741, -29749, -20719],
      basicShares: [15744.231, 15343.783, 14948.5],
      dilutedShares: [15812.547, 15408.095, 15004.697],
    },

    segments: {
      // Segment label -> historical revenue
      iPhone: [200583, 201183, 209586],
      Mac: [29357, 29984, 33708],
      iPad: [28300, 26694, 28023],
      'Wearables, Home and Accessories': [39845, 37005, 35686],
      Services: [85200, 96169, 109158],
    },

    balanceSheet: {
      // 2023 column is blank in the Excel model, hence the leading null
      cashAndSecurities: [null, 156650, 132420],
      accountsReceivable: [null, 33410, 39777],
      inventory: [null, 7286, 5718],
      deferredTaxAssets: [null, 19499, 20777],
      otherCurrentAssets: [null, 47120, 47765],
      propertyPlantEquipment: [null, 45680, 49834],
      otherAssets: [null, 55335, 62950],
      accountsPayable: [null, 78927, 77839],
      accruedExpenses: [null, 86553, 75442],
      revolver: [null, 0, 0],
      longTermDebt: [null, 96662, 90678],
      otherNonCurrentLiabilities: [null, 45888, 41549],
      commonStockAPIC: [null, 83276, 93568],
      treasuryStock: [null, 0, 0],
      retainedEarnings: [null, -19154, -14264],
      otherComprehensiveIncome: [null, -7172, -5571],
    },

    cashFlow: {
      depreciationAmortisation: [11519, 11445, 11698],
      stockBasedCompensation: [10833, 11688, 12863],
      capex: [null, 9447, 12715],
      dividends: [-15025, -15234, -15421],
      shareRepurchases: [-77550, -94949, -90711],
    },

    // Opening PP&E balance for the first year that has a schedule (FY2024)
    ppeOpeningBalance: 43715,
    // Basic share count at the end of FY2025 (schedule opening balance)
    basicSharesClosing: 14773.26,
    // Average share price during FY2025
    averageSharePrice: 223.64,
  },

  // --------------------------------------------------------------- ASSUMPTIONS
  // Arrays run [2026, 2027, 2028, 2029, 2030] — one value per forecast year.
  assumptions: {
    grossMargin: [0.455, 0.44, 0.44, 0.44, 0.44],
    researchDevelopmentMargin: [0.1, 0.13, 0.13, 0.13, 0.13],
    // 'avgOfHistory' = average of the three historical years, held flat
    sellingGeneralAdminMargin: 'avgOfHistory',
    // 'avgOfFirstAndLast' = average of FY2023 and FY2025 effective rates, held flat
    taxRate: 'avgOfFirstAndLast',

    segmentGrowth: {
      iPhone: [0.03, 0.025, 0.02, 0.015, 0.01],
      Mac: [0.095, 0.075, 0.06, 0.048, 0.038],
      iPad: [0.04, 0.024, 0.015, 0.0009, 0.0005],
      // 'trailingTwoYearAverage' = average of the previous two years' growth,
      // recalculated each year (so forecast years feed the next year's average)
      'Wearables, Home and Accessories': 'trailingTwoYearAverage',
      Services: [0.13, 0.125, 0.12, 0.115, 0.11],
    },

    otherIncomeExpense: [0, 0, 0, 0, 0],

    // ---- PP&E ----
    // capexRatio is 0.368 in the Excel. See capexMethod below — this single
    // switch is the difference between capex compounding at 36.8% a year and
    // capex sitting at 36.8% of R&D spend.
    capexRatio: 0.36801736613603475,
    //   'growth'       -> capex(t) = capex(t-1) * (1 + capexRatio)   [replicates the Excel]
    //   'percentOfRnD' -> capex(t) = R&D(t) * capexRatio             [matches the row label]
    capexMethod: 'growth',
    depreciationAsPercentOfCapex: 'avgOfHistory',

    // ---- Working capital drivers ----
    // Which line each balance is grown by: 'revenue' or 'cogs'
    workingCapitalDrivers: {
      accountsReceivable: 'revenue',
      inventory: 'cogs',
      accountsPayable: 'revenue',
      accruedExpenses: 'revenue',
      otherCurrentAssets: 'cogs',
      deferredTaxAssets: 'revenue',
    },
    otherAssetsHeldFlat: true,
    otherNonCurrentLiabilitiesHeldFlat: true,

    // ---- Debt ----
    interestExpenseOnLongTermDebt: [2600, 2600, 2600, 2600, 2600],
    interestExpenseFY2025: 2600,
    pikAccrualFY2025: 467, // used to derive the PIK % of interest expense
    debtRepaymentSchedule: [12393, 10078, 9300, 5235, 4972], // positive = paydown

    // ---- Capital stock ----
    newShareIssuance: [0, 0, 0, 0, 0],
    sbcAsPercentOfOperatingExpenses: 'lastHistoricalYear',

    // ---- Dividends & buybacks ----
    dividendPayoutRatio: 'linearRegression', // regressed on the 3 historical years, held flat
    authorisedBuybackCeiling: {
      historical: [90000, 90000, 110000], // 2023, 2024, 2025
      forecast: [100000, 'avgOfPriorFour', 'avgOfPriorFour', 'avgOfPriorFour', 'avgOfPriorFour'],
    },
    repurchasePercentOfCeiling: 'avgOfHistory',

    // ---- Cash & revolver ----
    minimumCashDesired: 100000,
    interestRateOnCash: [0.035, 0.03, 0.025, 0.02, 0.015],

    // ---- Share count roll-forward ----
    consensusEPS: [8.77, 9.69, null, null, null], // nulls are grown by epsGrowth
    epsGrowth: [null, null, 0.138, 0.138, 0.138],
  },

  // ---------------------------------------------------------------------- DCF
  dcf: {
    sharePrice: 308.9,
    sharePriceDate: '2026-08-05',
    basicSharesCount: 14656.1,
    dilutedSharesCount: 14714.676,

    // LTM net debt bridge — hardcoded in the Excel, not pulled from the model
    netDebt: {
      cashAndSecurities: -146517,
      longTermDebt: 82347,
    },

    longTermGrowthRate: 0.04,
    exitEbitdaMultiple: 20.4,

    // 'deductActualCapex' | 'capexEqualsDepreciation' | 'excludeCapex'
    terminalCapexTreatment: 'capexEqualsDepreciation',

    // Working-capital lines removed from the TERMINAL year only. They stay in
    // every explicit forecast year. Deferred tax movements are a timing item,
    // so they are normalised out of the perpetuity.
    // Other non-current liabilities are excluded on the same reasoning.
    terminalExclusions: ['deferredTaxAssets', 'otherNonCurrentLiabilities'],

    costOfCapital: {
      riskFreeRate: 0.04625,
      marketRiskPremium: 0.0423,
      equityBeta: 1.1,
      betaSource: 'equityBeta', // or 'industryUnlevered'
      comparables: [
        { name: 'MSFT', sharePrice: 487.46, dilutedShares: 7445, cash: 76650, debt: 128810, taxRate: 0.194, equityBeta: 1.1 },
        { name: 'GOOG/GOOGL', sharePrice: 362.43, dilutedShares: 12309, cash: 242470, debt: 120790, taxRate: 0.184, equityBeta: 1.25 },
        { name: 'META', sharePrice: 588.77, dilutedShares: 2564, cash: 90260, debt: 112320, taxRate: 0.222, equityBeta: 1.25 },
      ],
    },

    sensitivity: {
      waccSteps: [-0.010, -0.005, 0, 0.005, 0.010],
      growthSteps: [-0.010, -0.005, 0, 0.005, 0.010],
      multipleSteps: [-1.0, -0.5, 0, 0.5, 1.0],
    },
  },
};

export default AAPL;
