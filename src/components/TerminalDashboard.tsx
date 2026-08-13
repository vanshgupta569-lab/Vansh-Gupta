import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CompanyData, TabType, ValuationDrivers, DCFResult, ForecastRow, NewsItem } from '../types';
import { calculateDCFFor, COMPANIES_DATA, AAPL_SOURCE, defaultDriversFor, financialsFromStatements, valuationBandsFor, buildModelFor } from '../data/companies';
import { FootballField, RatioBand } from './valuationSections';
import { reportedRatios, forecastRatios } from '../data/ratios.js';
import { loadDerivedModelData } from '../data/autoCompany';
import { TweenNumber, FlashOnChange, GrowBar } from './motionPrimitives';
import {
  TrendingUp,
  BarChart2,
  Sliders,
  DollarSign,
  Activity,
  Maximize2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Info,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  LineChart,
} from 'lucide-react';

interface TerminalDashboardProps {
  companies: Record<string, CompanyData>;
  selectedTicker: string;
  onSelectTicker: (ticker: string) => void;
  onOpenDirectory: () => void;
}

export const TerminalDashboard: React.FC<TerminalDashboardProps> = ({
  companies,
  selectedTicker,
  onSelectTicker,
  onOpenDirectory,
}) => {
  const company = companies[selectedTicker] || companies['AAPL'];

  // Tab State
  const [activeTab, setActiveTab] = useState<TabType>('DCF_OUTPUT');

  // Live news headlines, fetched from our own /api/news proxy.
  // Starts empty; if the fetch fails or returns nothing, the ticker falls back
  // to whatever placeholder text lives in the company data file.
  const [liveNews, setLiveNews] = useState<NewsItem[]>([]);

  // Live quote for the company on screen. Curated data files carry the price as
  // at the date the model was built, which goes stale; the header should always
  // show what the shares actually trade at now.
  const [liveQuote, setLiveQuote] = useState<{
    price: number;
    changePct: number;
    fiftyTwoWeekHigh: number | null;
    fiftyTwoWeekLow: number | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLiveQuote(null);

    fetch(`/api/company?ticker=${encodeURIComponent(company.ticker)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data?.quote?.price) {
          setLiveQuote({
            price: data.quote.price,
            changePct: data.quote.changePct ?? 0,
            fiftyTwoWeekHigh: data.quote.fiftyTwoWeekHigh ?? null,
            fiftyTwoWeekLow: data.quote.fiftyTwoWeekLow ?? null,
          });
        }
      })
      .catch(() => {
        // Silent — the stored price stays on screen.
      });

    return () => {
      cancelled = true;
    };
  }, [company.ticker]);

  const displayPrice = liveQuote?.price ?? company.price;

  // A slim bar that appears once the full ticker header has scrolled away,
  // keeping the ticker, live price and implied value in view while reading the
  // statements below. Institutional terminals all do this; it is useful rather
  // than decorative.
  const [headerCondensed, setHeaderCondensed] = useState(false);
  const headerSentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Measured against scroll position rather than IntersectionObserver: the
    // marker is a zero-height element, and a zero-height box combined with a
    // negative rootMargin does not reliably report as intersecting.
    const check = () => {
      const node = headerSentinel.current;
      if (!node) return;
      // Condense once the marker has passed above the top of the viewport.
      setHeaderCondensed(node.getBoundingClientRect().top < 8);
    };

    check();
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    return () => {
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, []);
  const displayChangePct = liveQuote?.changePct ?? company.priceChangePct;

  useEffect(() => {
    let cancelled = false;
    setLiveNews([]);

    fetch(
      `/api/news?ticker=${encodeURIComponent(company.ticker)}` +
        `&name=${encodeURIComponent(company.name || '')}`
    )
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data.items) && data.items.length > 0) {
          setLiveNews(data.items);
        }
      })
      .catch(() => {
        // Silent — the placeholder headline stays on screen.
      });

    return () => {
      cancelled = true;
    };
  }, [company.ticker]);

  const newsToShow = liveNews.length > 0 ? liveNews : company.recentNews;

  // Drivers State (initialized per company)
  const [drivers, setDrivers] = useState<ValuationDrivers>(company.defaultDrivers);

  // Switching company must load that company's own starting assumptions,
  // otherwise the previous company's sliders silently carry over.
  useEffect(() => {
    setDrivers(company.defaultDrivers);
  }, [company.ticker]);

  // Update local drivers if ticker changes
  React.useEffect(() => {
    setDrivers(company.defaultDrivers);
  }, [selectedTicker]);

  // Recalculate DCF live
  // Auto-generated companies carry their own derived data file; Apple uses the
  // curated one. Same engine either way — only the inputs differ.
  // ---- Model view: derived vs analyst ------------------------------------
  // A company always has a derived model, built from its filings. A few also
  // have an analyst model — a data file built by hand in Excel and verified
  // line by line. Where both exist the user can switch between them and see
  // exactly what the hand work changes.
  const analystSource = company.engineBacked ? AAPL_SOURCE : null;
  const [viewMode, setViewMode] = useState<'DERIVED' | 'ANALYST'>(
    company.engineBacked ? 'ANALYST' : 'DERIVED'
  );

  // For a curated company we still fetch its derived counterpart, so the
  // comparison is available. For everything else the derived model is already
  // on the record.
  const [derivedSource, setDerivedSource] = useState<any>(company.modelData ?? null);

  useEffect(() => {
    setViewMode(company.engineBacked ? 'ANALYST' : 'DERIVED');
    setDerivedSource(company.modelData ?? null);

    if (!company.modelData) {
      let cancelled = false;
      loadDerivedModelData(company.ticker)
        .then((md) => { if (!cancelled) setDerivedSource(md); })
        .catch(() => { /* toggle simply stays unavailable */ });
      return () => { cancelled = true; };
    }
  }, [company.ticker]);

  const activeSource =
    viewMode === 'ANALYST' && analystSource ? analystSource : derivedSource;

  const canCompare = Boolean(analystSource && derivedSource);

  // The starting assumptions belong to the MODEL, not to the company. The
  // derived model and the analyst model reach different conclusions about
  // growth, margin, tax, capex and WACC, so each has its own defaults.
  //
  // This used to be missed. `drivers` was set from company.defaultDrivers and
  // only reset when the ticker changed, so switching Apple to DERIVED ran the
  // derived data file with the ANALYST model's assumptions: 5.5% growth and
  // 4.0% terminal growth instead of the derived 3.3% and 2.5%. That produced
  // $168.48 a share, against $146.60 for the derived model actually run on its
  // own assumptions. Two models were being mixed and the result belonged to
  // neither.
  const activeDefaults: ValuationDrivers = useMemo(() => {
    if (!activeSource) return company.defaultDrivers;
    const derived = defaultDriversFor(activeSource);
    const merged: any = { ...company.defaultDrivers };
    for (const [key, value] of Object.entries(derived)) {
      if (value !== undefined && value !== null) merged[key] = value;
    }
    return merged as ValuationDrivers;
  }, [activeSource, company.defaultDrivers]);

  // Reported history is the same whichever model is selected, so it is read
  // from the filings that travel with the derived model rather than from a
  // model file. That is why every company now shows every year the source
  // provided (five, where there are five) instead of the three the hand-built
  // Apple file happens to carry.
  const historicals = useMemo(() => {
    const raw = derivedSource?.rawStatements ?? activeSource?.rawStatements;
    return raw && raw.length ? financialsFromStatements(raw) : company.financials;
  }, [derivedSource, activeSource, company.financials]);

  // Ratios: reported years straight from the filings, forecast years read off
  // the engine's own schedules.
  const ratioData = useMemo(() => {
    const raw = derivedSource?.rawStatements ?? activeSource?.rawStatements;
    const reported = reportedRatios(raw || []);
    let forecast: any = { periods: [], applicable: {} };
    try {
      if (activeSource) {
        const model = buildModelFor(activeSource, drivers);
        forecast = forecastRatios(model, activeSource.meta?.forecastYears || []);
      }
    } catch {
      // A company the engine cannot model still shows its reported ratios.
    }
    return { reported, forecast };
  }, [derivedSource, activeSource, drivers]);

  // The bars for the football field: the two valuation methods, each widened
  // by the sensitivity steps the grid already uses.
  const valuationBands = useMemo(() => {
    if (!activeSource) return [];
    return valuationBandsFor(activeSource, drivers, displayPrice);
  }, [activeSource, drivers, displayPrice]);

  // A figure the filing does not give us is an absence, not a zero.
  const money = (v: number | null | undefined) =>
    v === null || v === undefined ? '—' : `${company.currencySymbol}${v.toLocaleString()}`;
  const pct = (v: number | null | undefined, signed = false) =>
    v === null || v === undefined ? '—' : `${signed && v > 0 ? '+' : ''}${v}%`;

  // Switching between the derived and analyst models resets the sliders to
  // that model's own starting point. Anything the user had moved is cleared,
  // which is correct: a slider position means nothing once the underlying
  // model has changed beneath it.
  useEffect(() => {
    setDrivers(activeDefaults);
  }, [viewMode, derivedSource, analystSource]);

  const runDCF = React.useCallback(
    (d: ValuationDrivers) => calculateDCFFor(activeSource ?? AAPL_SOURCE, d, displayPrice),
    [activeSource, displayPrice]
  );

  // A placeholder record has neither its own model nor a curated one, so any
  // valuation shown for it would be Apple's cash flows wearing another
  // company's name. Say so instead of showing a number.
  const hasRealModel = Boolean(company.modelData) || company.engineBacked;

  const dcfResult = useMemo(() => runDCF(drivers), [drivers, runDCF]);

  // Calculate Upside %
  const potentialUpsidePct = useMemo(() => {
    const diff = dcfResult.targetPrice - company.price;
    return Number(((diff / company.price) * 100).toFixed(1));
  }, [dcfResult.targetPrice, company.price]);

  // Premium or discount TO THE MODEL, so the model value is the denominator.
  //
  // This used to divide by the market price, which produced figures that were
  // arithmetically impossible: Reliance showed "133.9% DISCOUNT TO MODEL", and
  // a discount cannot exceed 100% without the price being negative. Measured
  // against the model value it is a 57% discount. Read it as: what the market
  // is paying, relative to what the model says the shares are worth.
  const premiumToModelPct = useMemo(() => {
    const value = dcfResult.targetPrice;
    if (!value || value <= 0) return 0;
    return Number((((company.price - value) / value) * 100).toFixed(1));
  }, [dcfResult.targetPrice, company.price]);

  // premiumToModelPct > 0 → market is above model → PREMIUM to model
  // premiumToModelPct < 0 → market is below model → DISCOUNT to model
  const premiumDiscountLabel = premiumToModelPct > 0
    ? `${premiumToModelPct}% PREMIUM TO MODEL`
    : `${Math.abs(premiumToModelPct)}% DISCOUNT TO MODEL`;
  const premiumDiscountStyle = potentialUpsidePct < 0
    ? 'bg-rose-950/60 text-rose-300 border-rose-700'
    : 'bg-emerald-950/60 text-emerald-300 border-emerald-700';

  // Preset Scenario Handlers
  const applyPreset = (preset: 'BASE' | 'BULL' | 'BEAR' | 'FORENSIC') => {
    // Presets flex the ACTIVE model's own defaults, not the company record's.
    const base = activeDefaults;
    if (preset === 'BASE') {
      setDrivers(base);
    } else if (preset === 'BULL') {
      setDrivers({
        ...base,
        revenueGrowthPct: Number((base.revenueGrowthPct * 1.3).toFixed(1)),
        operatingMarginPct: Number((base.operatingMarginPct * 1.15).toFixed(1)),
        waccPct: Number((base.waccPct * 0.9).toFixed(1)),
      });
    } else if (preset === 'BEAR') {
      setDrivers({
        ...base,
        revenueGrowthPct: Number((base.revenueGrowthPct * 0.6).toFixed(1)),
        operatingMarginPct: Number((base.operatingMarginPct * 0.8).toFixed(1)),
        waccPct: Number((base.waccPct * 1.15).toFixed(1)),
      });
    } else if (preset === 'FORENSIC') {
      setDrivers({
        ...base,
        operatingMarginPct: Number((base.operatingMarginPct * 0.75).toFixed(1)),
        taxRatePct: Number((base.taxRatePct * 1.25).toFixed(1)),
        capexPctOfRev: Number((base.capexPctOfRev * 1.4).toFixed(1)),
        waccPct: Number((base.waccPct * 1.2).toFixed(1)),
      });
    }
  };

  // Sensitivity Matrix Calculations
  const waccRange = [drivers.waccPct - 1.0, drivers.waccPct - 0.5, drivers.waccPct, drivers.waccPct + 0.5, drivers.waccPct + 1.0];
  const gRange = [drivers.terminalGrowthPct - 1.0, drivers.terminalGrowthPct - 0.5, drivers.terminalGrowthPct, drivers.terminalGrowthPct + 0.5, drivers.terminalGrowthPct + 1.0];

  const sensitivityMatrix = useMemo(() => {
    return waccRange.map((w) =>
      gRange.map((g) => {
        const res = runDCF({ ...drivers, waccPct: Math.max(4, w), terminalGrowthPct: Math.max(0.5, g) });
        return res.targetPrice;
      })
    );
  }, [drivers, runDCF]);

  const [hoveredMatrixCell, setHoveredMatrixCell] = useState<{ wacc: number; g: number; val: number } | null>(null);
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);

  return (
    <section id="terminal" className="pt-16 pb-20 max-w-[1440px] mx-auto px-6 lg:px-12">
      {/* Condensed header, shown once the full one has scrolled out of view */}
      <AnimatePresence>
        {headerCondensed && (
          <motion.div
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            className="fixed top-0 left-0 right-0 z-40 bg-[#0B0B0D]/95 backdrop-blur-sm border-b hairline-border-b"
          >
            <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-3 flex items-center justify-between gap-6">
              <div className="flex items-baseline gap-3 min-w-0">
                <span className="font-mono text-[11px] text-[#8B1E1E] font-bold tracking-widest shrink-0">
                  {company.ticker}
                </span>
                <span className="font-sans text-sm text-[#A1A1AA] font-light truncate hidden sm:block">
                  {company.name}
                </span>
              </div>

              <div className="flex items-center gap-6 shrink-0">
                <div className="text-right">
                  <div className="font-mono text-[9px] text-[#8A8A8F] uppercase tracking-widest">
                    Price
                  </div>
                  <div className="font-mono text-sm text-[#F2F0EA]">
                    <TweenNumber value={displayPrice} prefix={company.currencySymbol} />
                  </div>
                </div>

                {hasRealModel && (
                  <div className="text-right">
                    <div className="font-mono text-[9px] text-[#8A8A8F] uppercase tracking-widest">
                      Implied
                    </div>
                    <div className="font-mono text-sm text-[#8B1E1E] font-semibold">
                      <TweenNumber
                        value={dcfResult.targetPrice}
                        prefix={company.currencySymbol}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Terminal Title & Ticker Selector Bar */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4 border-b hairline-border-b pb-6">
        <div>
          <h2 className="font-display text-2xl sm:text-3xl text-[#F2F0EA] tracking-tight">
            Company Specific Analysis
          </h2>
        </div>

        {/* Company Quick Ticker Selector */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] text-[#8A8A8F] mr-2 hidden sm:inline uppercase tracking-widest">SELECT TICKER:</span>
          {Object.keys(companies).map((t) => (
            <button
              key={t}
              onClick={() => onSelectTicker(t)}
              className={`font-mono text-[11px] uppercase tracking-wider px-4 py-1.5 transition-all cursor-pointer ${
                selectedTicker === t
                  ? 'bg-[#8B1E1E] text-[#F2F0EA] font-semibold border border-[#8B1E1E] shadow-[0_0_10px_rgba(139,30,30,0.3)]'
                  : 'bg-[#111114] text-[#A1A1AA] border hairline-border hover:bg-[#222228] hover:text-[#F2F0EA]'
              }`}
            >
              {t}
            </button>
          ))}
          <button
            onClick={onOpenDirectory}
            className="font-mono text-[11px] uppercase tracking-wider px-3 py-1.5 bg-transparent border hairline-border text-[#8B1E1E] hover:text-[#F2F0EA] hover:border-[#8B1E1E] transition-colors cursor-pointer ml-2"
          >
            + All Companies
          </button>
        </div>
      </div>

      {/* Primary Header Info Bar */}
      <div className="bg-[#111114] border hairline-border p-6 lg:p-8 mb-6 shadow-lg">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="font-mono text-[10px] tracking-widest text-[#8A8A8F] border border-[#222228] px-2 py-0.5 uppercase bg-[#0B0B0D]">
                {company.exchange}: {company.ticker}
              </span>
              <span className="font-mono text-[10px] tracking-widest uppercase text-[#8A8A8F]">{company.sector}</span>
              <span className="font-mono text-[10px] tracking-widest uppercase text-[#8A8A8F]">ISIN: {company.isin}</span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-medium text-[#F2F0EA] tracking-tight">
              {company.name}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <div className="text-left md:text-right border-l md:border-l-0 md:border-r-0 hairline-border-l pl-4 md:pl-0">
              <div className="font-mono text-[11px] text-[#8A8A8F] tracking-widest mb-1 uppercase">
                {liveQuote ? 'LIVE PRICING' : 'LAST STORED PRICE'} ({company.currency})
              </div>
              <div className="flex items-baseline gap-3 md:justify-end">
                <span className="font-display text-3xl sm:text-4xl text-[#F2F0EA] font-semibold">
                  {company.currencySymbol}{displayPrice.toFixed(2)}
                </span>
                <span
                  className={`font-mono text-[11px] tracking-wider font-semibold flex items-center gap-0.5 px-2 py-0.5 ${
                    displayChangePct >= 0 ? 'text-emerald-400 bg-emerald-950/40' : 'text-rose-400 bg-rose-950/40'
                  }`}
                >
                  {displayChangePct >= 0 ? '+' : ''}{displayChangePct}%
                </span>
              </div>
            </div>

            {/* Derived vs analyst model switch — only where both exist */}
            {canCompare && (
              <div className="text-left md:text-right">
                <div className="font-mono text-[10px] text-[#8A8A8F] tracking-widest uppercase mb-1">
                  Model
                </div>
                <div className="flex border hairline-border">
                  <button
                    onClick={() => setViewMode('DERIVED')}
                    className={`font-mono text-[10px] px-3 py-2 uppercase tracking-wider cursor-pointer transition-colors ${
                      viewMode === 'DERIVED'
                        ? 'bg-[#8B1E1E] text-[#F2F0EA] font-semibold'
                        : 'text-[#8A8A8F] hover:text-[#F2F0EA]'
                    }`}
                  >
                    Derived
                  </button>
                  <button
                    onClick={() => setViewMode('ANALYST')}
                    className={`font-mono text-[10px] px-3 py-2 uppercase tracking-wider cursor-pointer transition-colors ${
                      viewMode === 'ANALYST'
                        ? 'bg-[#8B1E1E] text-[#F2F0EA] font-semibold'
                        : 'text-[#8A8A8F] hover:text-[#F2F0EA]'
                    }`}
                  >
                    Analyst
                  </button>
                </div>
              </div>
            )}

            {/* Model Implied Value & Premium/Discount */}
            {hasRealModel ? (
              <div className="bg-[#0B0B0D] border hairline-border p-3 px-5 text-left md:text-right shadow-inner">
                <div className="font-mono text-[10px] text-[#8A8A8F] tracking-widest uppercase mb-1">
                  MODEL IMPLIED VALUE
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <FlashOnChange watch={viewMode} className="px-1 -mx-1">
                    <span className="font-display text-2xl text-[#8B1E1E] font-bold">
                      <TweenNumber
                        value={dcfResult.targetPrice}
                        prefix={company.currencySymbol}
                      />
                    </span>
                  </FlashOnChange>
                  <span className={`font-mono text-[10px] px-2.5 py-1 font-semibold uppercase tracking-widest border ${premiumDiscountStyle}`}>
                    {premiumDiscountLabel}
                  </span>
                </div>
                <div className="font-mono text-[9px] text-[#8A8A8F] uppercase tracking-widest mt-2">
                  {viewMode === 'ANALYST' && analystSource
                    ? 'Analyst model — built by hand, verified against the filings'
                    : 'Derived model — assumptions from reported history'}
                </div>
              </div>
            ) : (
              <div className="bg-[#0B0B0D] border hairline-border p-3 px-5 text-left md:text-right shadow-inner max-w-xs">
                <div className="font-mono text-[10px] text-[#8A8A8F] tracking-widest uppercase mb-1">
                  NO MODEL BUILT
                </div>
                <div className="font-mono text-[11px] text-[#A1A1AA] leading-relaxed">
                  Placeholder record. Search this ticker in the directory to build
                  a model from its filings.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 5 Key Metric Cards */}
        <motion.div
          initial="hidden"
          animate="shown"
          variants={{ shown: { transition: { staggerChildren: 0.06 } } }}
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-6 hairline-border-t"
        >
          <motion.div variants={{ hidden: { opacity: 0, y: 10 }, shown: { opacity: 1, y: 0 } }} className="bg-[#0B0B0D] border hairline-border p-4 hover:border-[#222228] transition-colors cursor-default">
            <span className="font-mono text-[10px] text-[#8A8A8F] uppercase tracking-widest block mb-1">Market Cap</span>
            <span className="font-mono text-lg text-[#F2F0EA] font-semibold">{company.marketCapStr}</span>
          </motion.div>

          <motion.div variants={{ hidden: { opacity: 0, y: 10 }, shown: { opacity: 1, y: 0 } }} className="bg-[#0B0B0D] border hairline-border p-4 hover:border-[#222228] transition-colors cursor-default">
            <span className="font-mono text-[10px] text-[#8A8A8F] uppercase tracking-widest block mb-1">ROE (LTM)</span>
            <span className="font-mono text-lg text-[#F2F0EA] font-semibold"><TweenNumber value={company.roePct} decimals={1} suffix="%" /></span>
          </motion.div>

          <motion.div variants={{ hidden: { opacity: 0, y: 10 }, shown: { opacity: 1, y: 0 } }} className="bg-[#0B0B0D] border hairline-border p-4 hover:border-[#222228] transition-colors cursor-default">
            <span className="font-mono text-[10px] text-[#8A8A8F] uppercase tracking-widest block mb-1">ROA (LTM)</span>
            <span className="font-mono text-lg text-[#F2F0EA] font-semibold"><TweenNumber value={company.roaPct} decimals={1} suffix="%" /></span>
          </motion.div>

          <motion.div variants={{ hidden: { opacity: 0, y: 10 }, shown: { opacity: 1, y: 0 } }} className="bg-[#0B0B0D] border hairline-border p-4 hover:border-[#222228] transition-colors cursor-default">
            <span className="font-mono text-[10px] text-[#8A8A8F] uppercase tracking-widest block mb-1">Op Margin</span>
            <span className="font-mono text-lg text-[#F2F0EA] font-semibold"><TweenNumber value={company.opMarginPct} decimals={1} suffix="%" /></span>
          </motion.div>

          <motion.div variants={{ hidden: { opacity: 0, y: 10 }, shown: { opacity: 1, y: 0 } }} className="bg-[#0B0B0D] border hairline-border p-4 hover:border-[#222228] transition-colors cursor-default">
            <span className="font-mono text-[10px] text-[#8A8A8F] uppercase tracking-widest block mb-1">Net Debt / EBITDA</span>
            <span className="font-mono text-lg text-[#F2F0EA] font-semibold">{company.netDebtEbitda}</span>
          </motion.div>
        </motion.div>
      </div>

      {/* Marks where the full header ends, for the condensed bar above */}
      <div ref={headerSentinel} className="h-px w-full" aria-hidden="true" />

      {/* Live News Ticker Marquee */}
      <div className="hairline-border border bg-[#0B0B0D] py-3 px-4 overflow-hidden mb-8 relative flex items-center shadow-inner">
        <div className="font-mono text-[11px] text-[#8B1E1E] uppercase tracking-widest font-bold shrink-0 border-r hairline-border-r pr-4 mr-4 flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 animate-pulse" />
          <span>NEWS DISPATCH:</span>
        </div>
        <div className="overflow-hidden relative w-full">
          <div className="animate-marquee flex gap-12 font-mono text-xs text-[#A1A1AA]">
            {newsToShow.map((news) =>
              news.url ? (
                <a
                  key={news.id}
                  href={news.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  <span className="text-[#8B1E1E] font-semibold tracking-wider">[{news.time}]</span>
                  <span className="text-[#F2F0EA] font-medium tracking-wide">{news.headline}</span>
                  <span className="text-[#8A8A8F] text-[10px] tracking-widest uppercase">({news.source})</span>
                </a>
              ) : (
                <span key={news.id} className="inline-flex items-center gap-2">
                  <span className="text-[#8B1E1E] font-semibold tracking-wider">[{news.time}]</span>
                  <span className="text-[#F2F0EA] font-medium tracking-wide">{news.headline}</span>
                  <span className="text-[#8A8A8F] text-[10px] tracking-widest uppercase">({news.source})</span>
                </span>
              )
            )}
          </div>
        </div>
      </div>

      {/* Ratios and the valuation range. These sit above the analytics row for
          now; the full reordering of this screen happens when the assumption
          sliders move into the "for the nerds" section. */}
      <div className="space-y-6 mb-10">
        <RatioBand
          reported={ratioData.reported as any}
          forecast={ratioData.forecast as any}
        />
        {dcfResult.applicable !== false && (
          <FootballField
            bands={valuationBands}
            marketPrice={displayPrice}
            fiftyTwoWeekHigh={liveQuote?.fiftyTwoWeekHigh ?? company.fiftyTwoWeekHigh}
            fiftyTwoWeekLow={liveQuote?.fiftyTwoWeekLow ?? company.fiftyTwoWeekLow}
            currencySymbol={company.currencySymbol}
          />
        )}
      </div>

      {/* Analytics Row (3 Columns: Rev Trend Bar Chart, DCF Sensitivity Heatmap, Health Radar) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
        
        {/* Card 1: Revenue & Margin Trend Bar Chart */}
        <div className="bg-[#111114] border hairline-border p-6 flex flex-col justify-between relative min-h-[360px] shadow-md">
          <div>
            <div className="flex justify-between items-center mb-4">
              <span className="font-mono text-[11px] text-[#8A8A8F] uppercase tracking-widest font-medium">
                REV & MARGIN TREND
              </span>
              <span className="font-mono text-[9px] tracking-widest text-[#8B1E1E] border border-[#8B1E1E]/40 px-2 py-0.5 uppercase bg-[#8B1E1E]/5">
                5-YEAR GAAP
              </span>
            </div>

            {/* Custom Bar Visualization */}
            <div className="h-52 flex items-end justify-between gap-3 pt-8 pb-2 px-2 border-b hairline-border-b relative">
              {historicals.years.map((yr, idx) => {
                const revValues = historicals.revenue.filter(
                  (x): x is number => typeof x === 'number'
                );
                const maxRev = revValues.length ? Math.max(...revValues) : 0;
                const thisRev = historicals.revenue[idx];
                const revHeightPct =
                  maxRev > 0 && typeof thisRev === 'number'
                    ? Math.round((thisRev / maxRev) * 100)
                    : 0;
                const margin = historicals.ebitdaMargin[idx] ?? 0;

                return (
                  <div
                    key={yr}
                    onMouseEnter={() => setHoveredBarIndex(idx)}
                    onMouseLeave={() => setHoveredBarIndex(null)}
                    className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer relative"
                  >
                    {/* Hover Inspect Tooltip */}
                    {hoveredBarIndex === idx && (
                      <div className="absolute bottom-full mb-2 bg-[#0B0B0D] border hairline-border p-3 z-20 font-mono text-[10px] text-[#A1A1AA] whitespace-nowrap shadow-xl">
                        <div className="text-[#8B1E1E] font-bold tracking-widest uppercase mb-1">{yr} Metrics</div>
                        <div className="tracking-wider">Rev: <span className="text-[#F2F0EA]">{typeof thisRev === 'number' ? `${company.currencySymbol}${(thisRev / 1000).toFixed(1)}B` : '—'}</span></div>
                        <div className="tracking-wider">EBITDA Margin: <span className="text-[#F2F0EA]">{margin}%</span></div>
                      </div>
                    )}

                    {/* Red Accent Pin line for EBITDA Margin indicator */}
                    <div
                      style={{ bottom: `${Math.min(95, margin * 2)}%` }}
                      className="absolute w-full h-[2px] bg-[#8B1E1E] z-10 group-hover:scale-y-150 transition-transform"
                    />

                    {/* Revenue Bar — grows from the baseline on first view,
                        and eases to its new height when the company changes. */}
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${revHeightPct}%` }}
                      transition={{
                        duration: 0.75,
                        delay: idx * 0.09,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                      className="w-full bg-[#222228] group-hover:bg-[#8B1E1E]/40 transition-colors relative"
                    >
                      <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#8B1E1E]" />
                    </motion.div>

                    <span className="font-mono text-[10px] tracking-widest text-[#8A8A8F] mt-3 group-hover:text-[#F2F0EA] transition-colors">
                      {yr}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-between items-center font-mono text-[9px] uppercase tracking-widest text-[#8A8A8F] pt-4">
            <span className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-[#222228] border border-[#8B1E1E]" /> Revenue
            </span>
            <span className="flex items-center gap-2">
              <span className="w-3 h-0.5 bg-[#8B1E1E]" /> EBITDA Margin %
            </span>
          </div>
        </div>

        {/* Card 2: DCF Sensitivity Heatmap Matrix */}
        <div className="bg-[#111114] border hairline-border p-6 flex flex-col justify-between relative min-h-[360px] shadow-md">
          <div>
            <div className="flex justify-between items-center mb-3">
              <span className="font-mono text-[11px] text-[#8A8A8F] uppercase tracking-widest font-medium">
                DCF SENSITIVITY MATRIX
              </span>
              <span className="font-mono text-[9px] tracking-widest uppercase text-[#8A8A8F]">WACC vs. G%</span>
            </div>

            {/* 5x5 Cell Matrix */}
            <div className="grid grid-cols-5 gap-1 my-3 relative">
              {sensitivityMatrix.map((row, rIdx) =>
                row.map((val, cIdx) => {
                  const currWacc = waccRange[rIdx];
                  const currG = gRange[cIdx];
                  const isCurrentDriver = rIdx === 2 && cIdx === 2;
                  
                  // Color calculation based on upside/downside
                  const ratio = val / company.price;
                  let cellBg = 'bg-[#1c1110]';
                  if (ratio > 1.2) cellBg = 'bg-[#8B1E1E]';
                  else if (ratio > 1.05) cellBg = 'bg-[#8B1E1E]/70';
                  else if (ratio > 0.9) cellBg = 'bg-[#222228]';
                  else cellBg = 'bg-[#111114]';

                  return (
                    <motion.div
                      key={`${rIdx}-${cIdx}`}
                      onMouseEnter={() => setHoveredMatrixCell({ wacc: currWacc, g: currG, val })}
                      onMouseLeave={() => setHoveredMatrixCell(null)}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      /* Fill diagonally, so the grid resolves from the top-left
                         corner outward rather than appearing all at once. */
                      transition={{ duration: 0.28, delay: (rIdx + cIdx) * 0.035, ease: 'easeOut' }}
                      className={`h-9 border border-[#222228] flex items-center justify-center cursor-pointer transition-colors duration-500 hover:scale-105 hover:z-10 ${cellBg} ${
                        isCurrentDriver ? 'ring-1 ring-[#F2F0EA]' : ''
                      }`}
                    >
                      <span className="font-mono text-[10px] text-[#F2F0EA] font-semibold tracking-tighter">
                        {company.currencySymbol}{Math.round(val)}
                      </span>
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* Matrix Cell Inspector */}
            <div className="bg-[#0B0B0D] border hairline-border p-3 font-mono text-[10px] text-[#A1A1AA] tracking-wider flex justify-between items-center min-h-[42px] shadow-inner mt-4">
              {hoveredMatrixCell ? (
                <>
                  <span className="uppercase tracking-widest">
                    WACC: <strong className="text-[#F2F0EA]">{hoveredMatrixCell.wacc.toFixed(1)}%</strong> | Term G:{' '}
                    <strong className="text-[#F2F0EA]">{hoveredMatrixCell.g.toFixed(1)}%</strong>
                  </span>
                  <span className="text-[#8B1E1E] font-bold tracking-widest uppercase">
                    Target: {company.currencySymbol}{hoveredMatrixCell.val.toFixed(2)}
                  </span>
                </>
              ) : (
                <span className="text-[#8A8A8F] uppercase tracking-widest">Hover matrix cell to inspect valuation sensitivity.</span>
              )}
            </div>
          </div>

          <div className="font-mono text-[9px] tracking-widest uppercase text-[#8A8A8F] flex justify-between items-center pt-3">
            <span>Y-Axis: WACC (+/-1%)</span>
            <span>X-Axis: Term Growth (+/-1%)</span>
          </div>
        </div>

        {/* Card 3: Health Score Radar Chart */}
        <div className="bg-[#111114] border hairline-border p-6 flex flex-col justify-between relative min-h-[360px] shadow-md">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="font-mono text-[11px] text-[#8A8A8F] uppercase tracking-widest font-medium">
                FINANCIAL HEALTH SCORE
              </span>
              <span className="font-mono text-[12px] text-[#8B1E1E] font-bold border border-[#8B1E1E] px-2 py-0.5 bg-[#8B1E1E]/5">
                {company.healthMetrics.overallScore}/100
              </span>
            </div>

            {/* SVG Geometric Radar Polygon Chart */}
            <div className="h-52 flex items-center justify-center relative my-1">
              <svg className="w-48 h-48 overflow-visible" viewBox="0 0 200 200">
                {/* Concentric pentagon/rings */}
                <polygon points="100,20 176,60 147,150 53,150 24,60" fill="none" stroke="#222228" strokeWidth="1" />
                <polygon points="100,50 145,75 128,130 72,130 55,75" fill="none" stroke="#222228" strokeWidth="1" />
                <polygon points="100,80 115,90 109,110 91,110 85,90" fill="none" stroke="#222228" strokeWidth="1" />

                {/* Radar Axis lines */}
                <line x1="100" y1="100" x2="100" y2="20" stroke="#222228" strokeWidth="1" />
                <line x1="100" y1="100" x2="176" y2="60" stroke="#222228" strokeWidth="1" />
                <line x1="100" y1="100" x2="147" y2="150" stroke="#222228" strokeWidth="1" />
                <line x1="100" y1="100" x2="53" y2="150" stroke="#222228" strokeWidth="1" />
                <line x1="100" y1="100" x2="24" y2="60" stroke="#222228" strokeWidth="1" />

                {/* Calculated Polygon points based on metrics */}
                {(() => {
                  const m = company.healthMetrics;
                  const p1 = [100, 100 - (80 * m.balanceSheetStrength) / 100];
                  const p2 = [100 + (76 * m.earningsQuality) / 100, 100 - (40 * m.earningsQuality) / 100];
                  const p3 = [100 + (47 * m.cashFlowCoverage) / 100, 100 + (50 * m.cashFlowCoverage) / 100];
                  const p4 = [100 - (47 * m.accrualRisk) / 100, 100 + (50 * m.accrualRisk) / 100];
                  const p5 = [100 - (76 * m.valuationMoat) / 100, 100 - (40 * m.valuationMoat) / 100];

                  const pts = `${p1[0]},${p1[1]} ${p2[0]},${p2[1]} ${p3[0]},${p3[1]} ${p4[0]},${p4[1]} ${p5[0]},${p5[1]}`;

                  // The polygon morphs between shapes when the company or the
                  // model view changes, rather than snapping to the new one.
                  return (
                    <motion.polygon
                      animate={{ points: pts }}
                      initial={{ points: '100,100 100,100 100,100 100,100 100,100' }}
                      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                      fill="rgba(139, 30, 30, 0.4)"
                      stroke="#8B1E1E"
                      strokeWidth="2"
                    />
                  );
                })()}
              </svg>
            </div>
          </div>

          {/* The score is only worth showing if the reasoning is shown with it:
              each ratio, its actual value, and the threshold it was judged on. */}
          {company.healthDetail ? (
            <div className="pt-3 border-t hairline-border-t space-y-1.5">
              {Object.values(company.healthDetail.components).map((c: any) => (
                <div
                  key={c.label}
                  className="flex items-baseline justify-between gap-3 font-mono text-[10px]"
                  title={c.basis}
                >
                  <span className="text-[#8A8A8F] uppercase tracking-widest truncate">
                    {c.label}
                  </span>
                  <span className="flex items-baseline gap-2 shrink-0">
                    <span className="text-[#A1A1AA]">
                      {c.ratio == null ? '—' : c.ratio}
                      {c.unit.startsWith('%') ? '%' : ''}
                    </span>
                    <span className="text-[#F2F0EA] font-semibold w-8 text-right">
                      {c.score == null ? 'n/a' : Math.round(c.score)}
                    </span>
                  </span>
                </div>
              ))}
              <div className="font-mono text-[9px] text-[#8A8A8F] pt-2 leading-relaxed">
                Five reported ratios scored against fixed thresholds, then
                averaged. Hover any line for its basis. Nothing here uses the
                share price.
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-[9px] uppercase tracking-widest text-[#8A8A8F] pt-3 border-t hairline-border-t">
              <div>Bal Sheet: <span className="text-[#F2F0EA] font-semibold">{company.healthMetrics.balanceSheetStrength}%</span></div>
              <div>Earnings Quality: <span className="text-[#F2F0EA] font-semibold">{company.healthMetrics.earningsQuality}%</span></div>
              <div>Cash Flow: <span className="text-[#F2F0EA] font-semibold">{company.healthMetrics.cashFlowCoverage}%</span></div>
              <div>Moat Rating: <span className="text-[#F2F0EA] font-semibold">{company.healthMetrics.valuationMoat}%</span></div>
            </div>
          )}
        </div>

      </div>

      {/* Interactive Terminal Workspace Tabs */}
      <div className="bg-[#111114] border hairline-border p-6 lg:p-8 shadow-xl">
        
        {/* Navigation Tabs Header */}
        <div className="flex flex-wrap gap-4 sm:gap-8 border-b hairline-border-b pb-4 mb-8">
          {[
            { id: 'HISTORICAL', label: 'Historical Financials', icon: BarChart2 },
            { id: 'FORECASTED', label: 'Forecasted Financial Statements', icon: LineChart },
            { id: 'DRIVERS', label: 'Driver Assumptions', icon: Sliders },
            { id: 'DCF_OUTPUT', label: 'DCF Model Output', icon: TrendingUp },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`relative font-mono text-xs uppercase tracking-widest pb-2 flex items-center gap-2 transition-colors cursor-pointer ${
                  isActive
                    ? 'text-[#F2F0EA] font-semibold'
                    : 'text-[#8A8A8F] hover:text-[#F2F0EA]'
                }`}
              >
                <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-[#8B1E1E]' : 'text-[#8A8A8F]'}`} />
                <span>{tab.label}</span>
                {/* One underline shared across the tabs: motion moves it to
                    whichever tab is active rather than redrawing it. */}
                {isActive && (
                  <motion.span
                    layoutId="tab-underline"
                    className="absolute left-0 right-0 -bottom-[1px] h-[2px] bg-[#8B1E1E]"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* TAB 1: HISTORICAL FINANCIALS */}
        {activeTab === 'HISTORICAL' && (
          <div className="overflow-x-auto">
            <div className="flex justify-between items-center mb-5">
              <span className="font-mono text-[11px] tracking-widest text-[#8A8A8F] uppercase">
                3-Statement GAAP Financial Summary ({company.currency} Millions)
              </span>
              <span className="font-mono text-[10px] tracking-widest text-[#8B1E1E] bg-[#8B1E1E]/5 px-2 py-0.5 border border-[#8B1E1E]/30">
                AS REPORTED{company.dataSource ? ` · ${company.dataSource}` : ''}
              </span>
            </div>

            <table className="w-full text-left font-mono text-xs border-collapse">
              <thead>
                <tr className="border-b hairline-border-b text-[#8A8A8F] text-[11px] uppercase tracking-widest">
                  <th className="py-3 pr-6 font-medium">Line Item</th>
                  {historicals.years.map((y) => (
                    <th key={y} className="py-3 px-4 text-right font-medium">
                      {y}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222228] text-[#F2F0EA] tracking-wider">
                <tr className="hover:bg-[#1a1a1f] transition-colors">
                  <td className="py-3 pr-6 font-medium text-[#F2F0EA]">Total Revenue</td>
                  {historicals.revenue.map((v, i) => (
                    <td key={i} className="py-3 px-4 text-right">{money(v)}</td>
                  ))}
                </tr>

                <tr className="text-[#A1A1AA] bg-[#0B0B0D]/50 hover:bg-[#1a1a1f] transition-colors">
                  <td className="py-2.5 pr-6 pl-3 text-[11px] uppercase tracking-widest">Revenue Growth %</td>
                  {historicals.revenueGrowth.map((v, i) => (
                    <td key={i} className={`py-2.5 px-4 text-right text-[11px] font-semibold ${
                      v === null || v === undefined ? 'text-[#8A8A8F]' : v >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {pct(v, true)}
                    </td>
                  ))}
                </tr>

                <tr className="text-[#A1A1AA] hover:bg-[#1a1a1f] transition-colors">
                  <td className="py-3 pr-6 font-medium">Gross Margin %</td>
                  {historicals.grossMargin.map((v, i) => (
                    <td key={i} className="py-3 px-4 text-right">{pct(v)}</td>
                  ))}
                </tr>

                <tr className="text-[#A1A1AA] hover:bg-[#1a1a1f] transition-colors">
                  <td className="py-3 pr-6 font-medium">EBITDA Margin %</td>
                  {historicals.ebitdaMargin.map((v, i) => (
                    <td key={i} className="py-3 px-4 text-right">{pct(v)}</td>
                  ))}
                </tr>

                <tr className="hover:bg-[#1a1a1f] transition-colors">
                  <td className="py-3 pr-6 font-medium text-[#F2F0EA]">Net Income</td>
                  {historicals.netIncome.map((v, i) => (
                    <td key={i} className="py-3 px-4 text-right">{money(v)}</td>
                  ))}
                </tr>

                <tr className="bg-[#0B0B0D]/50 hover:bg-[#1a1a1f] transition-colors">
                  <td className="py-3 pr-6 pl-3 text-[#A1A1AA]">Operating Cash Flow</td>
                  {historicals.operatingCashFlow.map((v, i) => (
                    <td key={i} className="py-3 px-4 text-right text-[#A1A1AA]">{money(v)}</td>
                  ))}
                </tr>

                <tr className="hover:bg-[#1a1a1f] transition-colors">
                  <td className="py-3 pr-6 font-semibold text-[#8B1E1E]">Free Cash Flow (FCF)</td>
                  {historicals.freeCashFlow.map((v, i) => (
                    <td key={i} className="py-3 px-4 text-right font-semibold text-[#8B1E1E]">{money(v)}</td>
                  ))}
                </tr>

                <tr className="text-[#8A8A8F] text-[11px] hover:bg-[#1a1a1f] transition-colors">
                  <td className="py-2.5 pr-6">Total Debt</td>
                  {historicals.totalDebt.map((v, i) => (
                    <td key={i} className="py-2.5 px-4 text-right">{money(v)}</td>
                  ))}
                </tr>

                <tr className="text-[#8A8A8F] text-[11px] hover:bg-[#1a1a1f] transition-colors">
                  <td className="py-2.5 pr-6">Cash & Equivalents</td>
                  {historicals.cashAndEquivalents.map((v, i) => (
                    <td key={i} className="py-2.5 px-4 text-right">{money(v)}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 2: FORECASTED FINANCIAL STATEMENTS — driven by the real engine */}
        {activeTab === 'FORECASTED' && (
          <div className="overflow-x-auto space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#0B0B0D] p-4 border hairline-border">
              <div>
                <span className="font-mono text-[11px] text-[#A1A1AA] uppercase tracking-widest font-semibold block mb-1">
                  5-YEAR INTEGRATED MODEL ({company.currency} MILLIONS)
                </span>
                <span className="font-mono text-[9px] text-[#8A8A8F] uppercase tracking-widest">
                  Revenue growth {drivers.revenueGrowthPct}% · Op margin {drivers.operatingMarginPct}% · Tax {drivers.taxRatePct}% · CapEx {drivers.capexPctOfRev}% of rev · WACC {drivers.waccPct}%
                  {!company.engineBacked && ' · Figures illustrative — engine data file not yet built'}
                </span>
              </div>
              <button
                onClick={() => setActiveTab('DRIVERS')}
                className="font-mono text-[11px] uppercase tracking-widest px-4 py-2 bg-[#8B1E1E] text-[#F2F0EA] hover:bg-[#6a1515] transition-colors cursor-pointer flex items-center gap-2 font-semibold whitespace-nowrap shadow-[0_0_10px_rgba(139,30,30,0.3)]"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Adjust Drivers</span>
              </button>
            </div>

            {!dcfResult.applicable ? (
              <div className="p-8 border hairline-border bg-[#0B0B0D] font-mono text-xs text-[#8A8A8F] shadow-inner text-center tracking-wide">
                <strong className="text-[#F2F0EA] block mb-2 uppercase tracking-widest">MODEL NOT APPLICABLE</strong>
                {dcfResult.message}
              </div>
            ) : (
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead>
                  <tr className="border-b hairline-border-b text-[#8A8A8F] text-[11px] uppercase tracking-widest">
                    <th className="py-3 pr-6 font-medium">Line Item</th>
                    {dcfResult.forecastRows.map((row: ForecastRow) => (
                      <th key={row.year} className="py-3 px-4 text-right font-medium text-[#8B1E1E]">
                        {row.year}E
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#222228] text-[#F2F0EA] tracking-wider">
                  <tr className="hover:bg-[#1a1a1f] transition-colors">
                    <td className="py-3 pr-6 font-medium">Revenue</td>
                    {dcfResult.forecastRows.map((row: ForecastRow, i: number) => (
                      <td key={i} className="py-3 px-4 text-right font-bold">
                        {company.currencySymbol}{row.revenue.toLocaleString()}
                      </td>
                    ))}
                  </tr>
                  <tr className="text-[#A1A1AA] bg-[#0B0B0D]/50 hover:bg-[#1a1a1f] transition-colors">
                    <td className="py-2.5 pr-6 pl-3 text-[11px] uppercase tracking-widest">Revenue Growth %</td>
                    {dcfResult.forecastRows.map((row: ForecastRow, i: number) => (
                      <td key={i} className={`py-2.5 px-4 text-right text-[11px] font-semibold ${row.revenueGrowthPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {row.revenueGrowthPct >= 0 ? '+' : ''}{row.revenueGrowthPct}%
                      </td>
                    ))}
                  </tr>
                  <tr className="hover:bg-[#1a1a1f] transition-colors text-[#A1A1AA]">
                    <td className="py-3 pr-6 font-medium">EBIT</td>
                    {dcfResult.forecastRows.map((row: ForecastRow, i: number) => (
                      <td key={i} className="py-3 px-4 text-right">
                        {company.currencySymbol}{row.ebit.toLocaleString()}
                      </td>
                    ))}
                  </tr>
                  <tr className="text-[#A1A1AA] bg-[#0B0B0D]/50 hover:bg-[#1a1a1f] transition-colors">
                    <td className="py-2.5 pr-6 pl-3 text-[11px] uppercase tracking-widest">Operating Margin %</td>
                    {dcfResult.forecastRows.map((row: ForecastRow, i: number) => (
                      <td key={i} className="py-2.5 px-4 text-right text-[11px]">{row.operatingMarginPct}%</td>
                    ))}
                  </tr>
                  <tr className="text-[#8A8A8F] text-[11px] hover:bg-[#1a1a1f] transition-colors">
                    <td className="py-2.5 pr-6">Taxes ({drivers.taxRatePct}%)</td>
                    {dcfResult.forecastRows.map((row: ForecastRow, i: number) => (
                      <td key={i} className="py-2.5 px-4 text-right">
                        ({company.currencySymbol}{row.taxAmt.toLocaleString()})
                      </td>
                    ))}
                  </tr>
                  <tr className="font-semibold bg-[#0B0B0D]/30 hover:bg-[#1a1a1f] transition-colors">
                    <td className="py-3 pr-6">EBIAT (NOPAT)</td>
                    {dcfResult.forecastRows.map((row: ForecastRow, i: number) => (
                      <td key={i} className="py-3 px-4 text-right">
                        {company.currencySymbol}{row.ebiat.toLocaleString()}
                      </td>
                    ))}
                  </tr>
                  <tr className="text-[#8A8A8F] text-[11px] hover:bg-[#1a1a1f] transition-colors">
                    <td className="py-2.5 pr-6 pl-3">Add: D&A</td>
                    {dcfResult.forecastRows.map((row: ForecastRow, i: number) => (
                      <td key={i} className="py-2.5 px-4 text-right">
                        {company.currencySymbol}{row.da.toLocaleString()}
                      </td>
                    ))}
                  </tr>
                  <tr className="text-[#8A8A8F] text-[11px] hover:bg-[#1a1a1f] transition-colors">
                    <td className="py-2.5 pr-6 pl-3">Less: CapEx</td>
                    {dcfResult.forecastRows.map((row: ForecastRow, i: number) => (
                      <td key={i} className="py-2.5 px-4 text-right">
                        ({company.currencySymbol}{row.capex.toLocaleString()})
                      </td>
                    ))}
                  </tr>
                  <tr className="text-[#8A8A8F] text-[11px] hover:bg-[#1a1a1f] transition-colors">
                    <td className="py-2.5 pr-6 pl-3">Less: Δ Working Capital</td>
                    {dcfResult.forecastRows.map((row: ForecastRow, i: number) => (
                      <td key={i} className="py-2.5 px-4 text-right">
                        ({company.currencySymbol}{row.wcChange.toLocaleString()})
                      </td>
                    ))}
                  </tr>
                  <tr className="bg-[#8B1E1E]/10 border-t-2 border-[#8B1E1E]">
                    <td className="py-3 pr-6 font-bold text-[#8B1E1E]">Unlevered FCF</td>
                    {dcfResult.forecastRows.map((row: ForecastRow, i: number) => (
                      <td key={i} className="py-3 px-4 text-right font-bold text-[#8B1E1E]">
                        {company.currencySymbol}{row.ufcf.toLocaleString()}
                      </td>
                    ))}
                  </tr>
                  <tr className="text-[#8A8A8F] text-[10px] uppercase tracking-widest hover:bg-[#1a1a1f] transition-colors">
                    <td className="py-3 pr-6">Discount Factor (WACC {drivers.waccPct}%)</td>
                    {dcfResult.forecastRows.map((row: ForecastRow, i: number) => (
                      <td key={i} className="py-3 px-4 text-right">{row.discountFactor}</td>
                    ))}
                  </tr>
                  <tr className="font-semibold bg-[#111114] border-t hairline-border-t">
                    <td className="py-4 pr-6">PV of Unlevered FCF</td>
                    {dcfResult.forecastRows.map((row: ForecastRow, i: number) => (
                      <td key={i} className="py-4 px-4 text-right">
                        {company.currencySymbol}{row.pvUfcf.toLocaleString()}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* TAB 3: DRIVER ASSUMPTIONS */}
        {activeTab === 'DRIVERS' && (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#0B0B0D] p-5 border hairline-border shadow-inner">
              <span className="font-mono text-[11px] text-[#A1A1AA] uppercase tracking-widest font-semibold">
                SCENARIO PRESETS:
              </span>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => applyPreset('BASE')}
                  className="font-mono text-[10px] tracking-widest px-4 py-2 bg-[#222228] text-[#F2F0EA] hover:bg-[#8B1E1E] transition-colors cursor-pointer uppercase font-semibold"
                >
                  Reset Base Case
                </button>
                <button
                  onClick={() => applyPreset('BULL')}
                  className="font-mono text-[10px] tracking-widest px-4 py-2 bg-emerald-950/60 border border-emerald-700 text-emerald-300 hover:bg-emerald-900 transition-colors cursor-pointer uppercase font-semibold"
                >
                  Bull Case (+30% Growth)
                </button>
                <button
                  onClick={() => applyPreset('BEAR')}
                  className="font-mono text-[10px] tracking-widest px-4 py-2 bg-rose-950/60 border border-rose-700 text-rose-300 hover:bg-rose-900 transition-colors cursor-pointer uppercase font-semibold"
                >
                  Bear Case (-40% Growth)
                </button>
                <button
                  onClick={() => applyPreset('FORENSIC')}
                  className="font-mono text-[10px] tracking-widest px-4 py-2 bg-[#8B1E1E]/40 border border-[#8B1E1E] text-[#F2F0EA] hover:bg-[#8B1E1E] transition-colors cursor-pointer uppercase font-semibold shadow-[0_0_10px_rgba(139,30,30,0.2)]"
                >
                  Forensic Stress Test
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Slider 1: Revenue Growth % */}
              <div className="bg-[#0B0B0D] border hairline-border p-6 space-y-4 shadow-md">
                <div className="flex justify-between items-center font-mono text-[11px] tracking-widest">
                  <label className="text-[#8A8A8F] uppercase font-semibold">Revenue Growth %</label>
                  <span className="text-[#8B1E1E] font-bold text-lg">{drivers.revenueGrowthPct}%</span>
                </div>
                <input
                  type="range"
                  min="-10"
                  max="50"
                  step="0.5"
                  value={drivers.revenueGrowthPct}
                  onChange={(e) => setDrivers({ ...drivers, revenueGrowthPct: parseFloat(e.target.value) })}
                  className="w-full accent-[#8B1E1E] cursor-pointer"
                />
                <p className="font-sans text-xs font-light text-[#A1A1AA] tracking-wide mt-2 leading-relaxed">
                  5-Year CAGR assumption driving explicit cash flow growth.
                </p>
              </div>

              {/* Slider 2: Operating Margin % */}
              <div className="bg-[#0B0B0D] border hairline-border p-6 space-y-4 shadow-md">
                <div className="flex justify-between items-center font-mono text-[11px] tracking-widest">
                  <label className="text-[#8A8A8F] uppercase font-semibold">Operating Margin %</label>
                  <span className="text-[#8B1E1E] font-bold text-lg">{drivers.operatingMarginPct}%</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="70"
                  step="0.5"
                  value={drivers.operatingMarginPct}
                  onChange={(e) => setDrivers({ ...drivers, operatingMarginPct: parseFloat(e.target.value) })}
                  className="w-full accent-[#8B1E1E] cursor-pointer"
                />
                <p className="font-sans text-xs font-light text-[#A1A1AA] tracking-wide mt-2 leading-relaxed">
                  Target EBIT margin applied across the forecast years.
                </p>
              </div>

              {/* Slider 3: Tax Rate % */}
              <div className="bg-[#0B0B0D] border hairline-border p-6 space-y-4 shadow-md">
                <div className="flex justify-between items-center font-mono text-[11px] tracking-widest">
                  <label className="text-[#8A8A8F] uppercase font-semibold">Effective Tax Rate %</label>
                  <span className="text-[#F2F0EA] font-bold text-lg">{drivers.taxRatePct}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="35"
                  step="0.5"
                  value={drivers.taxRatePct}
                  onChange={(e) => setDrivers({ ...drivers, taxRatePct: parseFloat(e.target.value) })}
                  className="w-full accent-[#8B1E1E] cursor-pointer"
                />
                <p className="font-sans text-xs font-light text-[#A1A1AA] tracking-wide mt-2 leading-relaxed">
                  Effective cash tax rate adjusted for R&D credits.
                </p>
              </div>

              {/* Slider 4: CapEx % of Revenue */}
              <div className="bg-[#0B0B0D] border hairline-border p-6 space-y-4 shadow-md">
                <div className="flex justify-between items-center font-mono text-[11px] tracking-widest">
                  <label className="text-[#8A8A8F] uppercase font-semibold">CapEx % of Revenue</label>
                  <span className="text-[#F2F0EA] font-bold text-lg">{drivers.capexPctOfRev}%</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="30"
                  step="0.5"
                  value={drivers.capexPctOfRev}
                  onChange={(e) => setDrivers({ ...drivers, capexPctOfRev: parseFloat(e.target.value) })}
                  className="w-full accent-[#8B1E1E] cursor-pointer"
                />
                <p className="font-sans text-xs font-light text-[#A1A1AA] tracking-wide mt-2 leading-relaxed">
                  Capital expenditures required to sustain projected growth.
                </p>
              </div>

              {/* Slider 5: WACC % */}
              <div className="bg-[#0B0B0D] border hairline-border p-6 space-y-4 shadow-md">
                <div className="flex justify-between items-center font-mono text-[11px] tracking-widest">
                  <label className="text-[#8A8A8F] uppercase font-semibold">WACC % (Discount Rate)</label>
                  <span className="text-[#8B1E1E] font-bold text-lg">{drivers.waccPct}%</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="18"
                  step="0.1"
                  value={drivers.waccPct}
                  onChange={(e) => setDrivers({ ...drivers, waccPct: parseFloat(e.target.value) })}
                  className="w-full accent-[#8B1E1E] cursor-pointer"
                />
                <p className="font-sans text-xs font-light text-[#A1A1AA] tracking-wide mt-2 leading-relaxed">
                  Weighted Average Cost of Capital risk hurdle.
                </p>
              </div>

              {/* Slider 6: Terminal Growth Rate % */}
              <div className="bg-[#0B0B0D] border hairline-border p-6 space-y-4 shadow-md">
                <div className="flex justify-between items-center font-mono text-[11px] tracking-widest">
                  <label className="text-[#8A8A8F] uppercase font-semibold">Terminal Growth Rate %</label>
                  <span className="text-[#F2F0EA] font-bold text-lg">{drivers.terminalGrowthPct}%</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="5.0"
                  step="0.1"
                  value={drivers.terminalGrowthPct}
                  onChange={(e) => setDrivers({ ...drivers, terminalGrowthPct: parseFloat(e.target.value) })}
                  className="w-full accent-[#8B1E1E] cursor-pointer"
                />
                <p className="font-sans text-xs font-light text-[#A1A1AA] tracking-wide mt-2 leading-relaxed">
                  Perpetual long-term GDP growth rate benchmark.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: DCF MODEL OUTPUT */}
        {activeTab === 'DCF_OUTPUT' && !dcfResult.applicable && (
          <div className="p-8 border hairline-border bg-[#0B0B0D] font-mono text-xs text-[#8A8A8F] shadow-inner text-center tracking-wide">
            <strong className="text-[#F2F0EA] block mb-2 uppercase tracking-widest">VALUATION NOT APPLICABLE</strong>
            {dcfResult.message}
          </div>
        )}

        {activeTab === 'DCF_OUTPUT' && dcfResult.applicable && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">

            {!company.engineBacked && (
              <div className="lg:col-span-12 p-4 border hairline-border bg-[#0B0B0D] font-mono text-[10px] text-[#8A8A8F] uppercase tracking-widest text-center">
                Figures illustrative — engine data file not yet built for this company
              </div>
            )}
            
            {/* Left Inputs Summary */}
            <div className="lg:col-span-5 flex flex-col justify-between space-y-6">
              <div className="bg-[#0B0B0D] border hairline-border p-6 space-y-5 shadow-md">
                <div className="font-mono text-[11px] tracking-widest text-[#8A8A8F] uppercase border-b hairline-border-b pb-3 flex justify-between font-semibold">
                  <span>ACTIVE MODEL PARAMETERS</span>
                  <span className="text-[#8B1E1E]">LIVE STATE</span>
                </div>

                <div className="grid grid-cols-2 gap-5 font-mono text-xs">
                  <div>
                    <span className="text-[#8A8A8F] block text-[9px] uppercase tracking-widest mb-1">REVENUE GROWTH %</span>
                    <span className="text-[#F2F0EA] font-bold text-lg tracking-wider">{drivers.revenueGrowthPct}%</span>
                  </div>

                  <div>
                    <span className="text-[#8A8A8F] block text-[9px] uppercase tracking-widest mb-1">TAX RATE %</span>
                    <span className="text-[#F2F0EA] font-bold text-lg tracking-wider">{drivers.taxRatePct}%</span>
                  </div>

                  <div>
                    <span className="text-[#8A8A8F] block text-[9px] uppercase tracking-widest mb-1">CAPEX %</span>
                    <span className="text-[#F2F0EA] font-bold text-lg tracking-wider">{drivers.capexPctOfRev}%</span>
                  </div>

                  <div>
                    <span className="text-[#8A8A8F] block text-[9px] uppercase tracking-widest mb-1">WACC %</span>
                    <span className="text-[#8B1E1E] font-bold text-lg tracking-wider">{drivers.waccPct}%</span>
                  </div>

                  <div>
                    <span className="text-[#8A8A8F] block text-[9px] uppercase tracking-widest mb-1">OP MARGIN %</span>
                    <span className="text-[#F2F0EA] font-bold text-lg tracking-wider">{drivers.operatingMarginPct}%</span>
                  </div>

                  <div>
                    <span className="text-[#8A8A8F] block text-[9px] uppercase tracking-widest mb-1">TERMINAL G %</span>
                    <span className="text-[#F2F0EA] font-bold text-lg tracking-wider">{drivers.terminalGrowthPct}%</span>
                  </div>
                </div>

                <button
                  onClick={() => setActiveTab('DRIVERS')}
                  className="w-full mt-4 font-mono text-[11px] tracking-widest bg-[#222228] text-[#F2F0EA] py-3 uppercase hover:bg-[#8B1E1E] transition-colors flex items-center justify-center gap-2 cursor-pointer font-semibold"
                >
                  <Sliders className="w-4 h-4" />
                  <span>Adjust Assumptions</span>
                </button>
              </div>

              {/* Cash Flow Bridge Breakdown */}
              <div className="bg-[#0B0B0D] border hairline-border p-6 space-y-4 font-mono text-xs shadow-inner">
                <div className="text-[#8A8A8F] uppercase tracking-widest text-[10px] border-b hairline-border-b pb-3 font-semibold">
                  VALUATION BRIDGE COMPONENTS
                </div>
                <div className="flex justify-between text-[#A1A1AA] tracking-wider pt-1">
                  <span>PV of Explicit 5-Yr Cash Flows:</span>
                  <span className="text-[#F2F0EA] font-medium">{company.currencySymbol}{dcfResult.pvExplicitFCF.toLocaleString()}B</span>
                </div>
                <div className="flex justify-between text-[#A1A1AA] tracking-wider">
                  <span>PV of Terminal Value:</span>
                  <span className="text-[#F2F0EA] font-medium">{company.currencySymbol}{dcfResult.pvTerminalValue.toLocaleString()}B</span>
                </div>
                <div className="flex justify-between text-[#8A8A8F] text-[10px] uppercase tracking-widest pt-4 border-t hairline-border-t">
                  <span>Terminal Share of Enterprise Value:</span>
                  <span className="text-[#F2F0EA]">
                    {Math.round(
                      (dcfResult.pvTerminalValue / (dcfResult.pvExplicitFCF + dcfResult.pvTerminalValue)) * 100
                    )}
                    %
                  </span>
                </div>
              </div>
            </div>

            {/* Right Output Valuation Panel */}
            <div className="lg:col-span-7 bg-[#0B0B0D] border hairline-border p-8 flex flex-col justify-between space-y-8 shadow-xl">
              <div>
                <div className="font-mono text-[11px] text-[#8A8A8F] uppercase tracking-widest mb-4 flex items-center justify-between font-semibold border-b hairline-border-b pb-3">
                  <span>MODEL IMPLIED VALUE</span>
                  <span className="text-[#8B1E1E]">MARKET vs. MODEL</span>
                </div>

                <div className="flex flex-wrap items-center gap-4 mb-8 mt-6">
                  <FlashOnChange watch={viewMode} className="px-1 -mx-1">
                    <div className="font-display text-5xl sm:text-6xl text-[#F2F0EA] font-semibold tracking-tight">
                      <TweenNumber
                        value={dcfResult.targetPrice}
                        prefix={company.currencySymbol}
                        flash
                      />
                    </div>
                  </FlashOnChange>

                  <div
                    className={`font-mono text-[11px] px-3.5 py-1.5 font-bold uppercase tracking-widest flex items-center gap-1.5 ${
                      potentialUpsidePct >= 0 ? 'bg-[#8B1E1E] text-[#F2F0EA] shadow-[0_0_15px_rgba(139,30,30,0.4)]' : 'bg-rose-950 text-rose-300 border border-rose-700'
                    }`}
                  >
                    {potentialUpsidePct >= 0 ? (
                      <>
                        <ArrowUpRight className="w-4 h-4" />
                        <span>+{potentialUpsidePct}% UPSIDE</span>
                      </>
                    ) : (
                      <>
                        <ArrowDownRight className="w-4 h-4" />
                        <span>{potentialUpsidePct}% DOWNSIDE</span>
                      </>
                    )}
                  </div>

                  {/* Premium / Discount badge */}
                  <div className={`font-mono text-[10px] px-3.5 py-1.5 font-semibold uppercase tracking-widest border flex items-center gap-2 ${premiumDiscountStyle}`}>
                    <span className="w-2 h-2 rounded-full bg-current" />
                    <span>{premiumDiscountLabel}</span>
                  </div>
                </div>

                {/* Market price vs model implied value */}
                <div className="p-6 border hairline-border bg-[#111114] mb-8 shadow-inner border-l-4 border-l-[#8B1E1E]">
                  <strong className="block mb-2 font-mono text-[11px] text-[#F2F0EA] uppercase tracking-widest">
                    MARKET PRICE vs. MODEL IMPLIED VALUE
                  </strong>
                  <p className="font-sans text-[13px] font-light text-[#A1A1AA] leading-loose tracking-wide">
                    <strong className="font-semibold text-[#F2F0EA]">{company.currencySymbol}{company.price.toFixed(2)}</strong> market price ·{' '}
                    <strong className="font-semibold text-[#F2F0EA]">{company.currencySymbol}{dcfResult.targetPrice.toFixed(2)}</strong> model implied value ·{' '}
                    {premiumToModelPct > 0
                      ? `market trades ${premiumToModelPct}% above this model`
                      : `market trades ${Math.abs(premiumToModelPct)}% below this model`}.
                    {' '}Use the sliders to adjust assumptions and see how the gap changes.
                    This is a calculated gap — not a recommendation.
                  </p>
                </div>

                <p className="font-sans text-xs font-light text-[#A1A1AA] leading-loose tracking-wide max-w-lg">
                  Fair value based on 5-year explicit free cash flow projections discounted at {drivers.waccPct}% WACC and {drivers.terminalGrowthPct}% perpetual growth rate.
                </p>
              </div>

              {/* Enterprise Value to Equity Value Ledger Table */}
              <table className="w-full font-mono text-xs border-collapse">
                <tbody className="tracking-wider">
                  <tr className="border-b hairline-border-b hover:bg-[#1a1a1f] transition-colors">
                    <td className="py-4 text-[#8A8A8F] uppercase tracking-widest text-[10px]">Implied Enterprise Value (EV)</td>
                    <td className="py-4 text-right text-[#F2F0EA] font-semibold text-sm">
                      {company.currencySymbol}{dcfResult.enterpriseValueBillion.toLocaleString()}B
                    </td>
                  </tr>

                  <tr className="border-b hairline-border-b hover:bg-[#1a1a1f] transition-colors">
                    <td className="py-4 text-[#A1A1AA]">
                      {drivers.netDebtBillion < 0 ? 'Plus: Net Cash' : 'Less: Net Debt'}
                    </td>
                    <td className="py-4 text-right text-[#A1A1AA]">
                      {drivers.netDebtBillion < 0
                        ? `+${company.currencySymbol}${Math.abs(drivers.netDebtBillion).toFixed(1)}B`
                        : `(${company.currencySymbol}${drivers.netDebtBillion.toFixed(1)}B)`}
                    </td>
                  </tr>

                  <tr className="border-b hairline-border-b hover:bg-[#1a1a1f] bg-[#111114]/80 transition-colors">
                    <td className="py-4 text-[#F2F0EA] font-semibold uppercase tracking-widest text-[11px]">Implied Equity Value</td>
                    <td className="py-4 text-right text-[#8B1E1E] font-bold text-base">
                      {company.currencySymbol}{dcfResult.impliedEquityValueBillion.toLocaleString()}B
                    </td>
                  </tr>

                  <tr className="hover:bg-[#1a1a1f] transition-colors">
                    <td className="py-4 text-[#A1A1AA]">Diluted Shares Outstanding</td>
                    <td className="py-4 text-right text-[#A1A1AA]">
                      {drivers.sharesOutstandingBillion} Billion
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="font-mono text-[9px] uppercase tracking-widest text-[#8A8A8F] pt-4 border-t hairline-border-t flex justify-between items-center mt-2">
                <span>
                  {company.engineBacked
                    ? 'MARGINALIA ENGINE · VERIFIED AGAINST EXCEL MODEL'
                    : 'MARGINALIA ENGINE · ILLUSTRATIVE INPUTS'}
                </span>
                <span className="text-[#8B1E1E] font-bold">RECALCULATED REAL-TIME</span>
              </div>
            </div>

          </div>
        )}

      </div>
    </section>
  );
};