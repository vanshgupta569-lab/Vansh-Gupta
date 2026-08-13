// FILE: src/components/TerminalDashboard.tsx
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CompanyData, ValuationDrivers, DCFResult, ForecastRow, NewsItem } from '../types';
import { calculateDCFFor, COMPANIES_DATA, AAPL_SOURCE, defaultDriversFor, financialsFromStatements, valuationBandsFor, buildModelFor, buildFullModel } from '../data/companies';
import { FootballField, RatioBand } from './valuationSections';
import { HowCalculated } from './howCalculated';
import { QualitativeAdjustments } from './qualitative';
import { SavedModelsPanel } from './savedModelsPanel';
import { CompsPanel } from './compsPanel';
import { FullScreenPanel, ThreeStatementView, DCFView } from './nerdViews';
import { downloadWorkbook } from '../data/excelExport';
import { reportedRatios, forecastRatios } from '../data/ratios.js';
import { loadDerivedModelData } from '../data/autoCompany';
import { TweenNumber, FlashOnChange, GrowBar } from './motionPrimitives';
import {
  TrendingUp,
  Download,
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

  // The deeper screens open WHOLE SCREENS, not panels on the page. A
  // three-statement model is thirty schedules wide; reading it squeezed under a
  // dashboard is not reading it at all. null means no view is open.
  const [exporting, setExporting] = useState(false);
  const [nerdView, setNerdView] = useState<
    null | 'THREE_STATEMENT' | 'DCF' | 'QUALITATIVE' | 'SAVED' | 'COMPS'
  >(null);


  // Each deep screen is opened from beside the content it relates to, so the
  // reader meets it where the question arises rather than hunting a menu.
  const OpenScreen: React.FC<{
    view: 'THREE_STATEMENT' | 'DCF' | 'QUALITATIVE' | 'SAVED' | 'COMPS';
    label: string;
    strong?: boolean;
  }> = ({ view, label, strong }) => (
    <button
      type="button"
      onClick={() => setNerdView(view)}
      className={`inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest px-4 py-2.5 border transition-colors ${
        strong
          ? 'border-[#8B1E1E] text-[#F2F0EA] bg-[#8B1E1E]/25 hover:bg-[#8B1E1E]/45 font-semibold'
          : 'border-[#222228] text-[#8A8A8F] hover:text-[#F2F0EA] hover:border-[#8B1E1E]'
      }`}
    >
      {label}
    </button>
  );

  // Hand the user a working Excel model: the same run that is on screen,
  // written out with live formulas rather than pasted numbers.
  const exportExcel = () => {
    if (!activeSource) return;
    // Built here rather than reusing the full-screen run, because the single
    // download button lives on the page and must work with no view open.
    let built: any = nerdModel;
    if (!built) {
      try {
        built = buildFullModel(activeSource, drivers);
      } catch {
        return;
      }
    }
    setExporting(true);
    void (async () => {
      try {
        await downloadWorkbook({
          model: built.model,
          dcf: built.dcf,
          source: { ...activeSource, rawStatements: derivedSource?.rawStatements ?? activeSource.rawStatements },
          companyName: company.name,
          ticker: company.ticker,
          currencySymbol: company.currencySymbol,
          unitLabel: activeSource.meta?.unitLabel || `${company.currencySymbol} millions`,
          modelLabel:
            viewMode === 'ANALYST' && company.engineBacked
              ? 'Analyst model, built by hand from the filings'
              : 'Derived model, assumptions taken from reported history',
        });
      } catch (error) {
        console.error('Excel export failed', error);
      } finally {
        setExporting(false);
      }
    })();
  };


  // Escape closes the open view.
  useEffect(() => {
    if (!nerdView) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNerdView(null);
    };
    window.addEventListener('keydown', onKey);
    // Stop the page behind from scrolling while a full screen is open.
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [nerdView]);

  // Live news headlines, fetched from our own /api/news proxy.
  // Starts empty; if the fetch fails or returns nothing, the ticker falls back
  // to whatever placeholder text lives in the company data file.
  const [liveNews, setLiveNews] = useState<NewsItem[]>([]);
  // Whether the news request is still in flight, so the ticker can say so
  // instead of sitting blank.
  const [newsLoading, setNewsLoading] = useState(true);

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
    setNewsLoading(true);

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
        // Silent — the ticker will say there is nothing rather than sit blank.
      })
      .finally(() => {
        if (!cancelled) setNewsLoading(false);
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

  // The headline is ONE number: the two terminal methods, weighted equally.
  //
  // Both are real outputs of the model, neither is more correct than the other,
  // so a 50/50 blend states that plainly rather than picking a winner. What it
  // must not do is hide the disagreement, because the gap between the two IS
  // information: a company whose methods land 20% apart is a different
  // proposition from one where they agree. So both figures stay on screen
  // underneath, and the football field below shows the full spread.
  const blendedValue = useMemo(() => {
    const parts = valuationBands
      .filter((band) => typeof band.point === 'number' && isFinite(band.point) && band.point > 0)
      .map((band) => ({
        label: band.label.replace('DCF — ', ''),
        value: band.point,
      }));
    if (parts.length < 2) return null;
    const value = parts.reduce((sum, part) => sum + part.value, 0) / parts.length;
    return { value, parts };
  }, [valuationBands]);

  // Premium or discount against that blended value.
  const blendedPremiumPct = useMemo(() => {
    if (!blendedValue || blendedValue.value <= 0) return null;
    return Number(
      (((displayPrice - blendedValue.value) / blendedValue.value) * 100).toFixed(1)
    );
  }, [blendedValue, displayPrice]);



  // A figure the filing does not give us is an absence, not a zero.
  const money = (v: number | null | undefined) =>
    v === null || v === undefined ? '—' : `${company.currencySymbol}${v.toLocaleString()}`;
  const pct = (v: number | null | undefined, signed = false) =>
    v === null || v === undefined ? '—' : `${signed && v > 0 ? '+' : ''}${v}%`;

  // The engine run behind whichever full-screen view is open, built from the
  // same source and the same drivers as the value on the front page.
  const nerdModel = useMemo(() => {
    if (
      !nerdView ||
      nerdView === 'QUALITATIVE' ||
      nerdView === 'SAVED' ||
      nerdView === 'COMPS' ||
      !activeSource
    )
      return null;
    try {
      const built = buildFullModel(activeSource, drivers);
      return built;
    } catch {
      return null;
    }
  }, [nerdView, activeSource, drivers]);

  // The comps screen needs this company's own EBITDA, net debt and share
  // count, but not the whole three-statement build, so it gets its own light
  // run rather than forcing the heavier one.
  const nerdDcf = useMemo(() => {
    if (nerdView !== 'COMPS' || !activeSource) return null;
    try {
      return buildFullModel(activeSource, drivers).dcf;
    } catch {
      return null;
    }
  }, [nerdView, activeSource, drivers]);

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
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 mb-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-3">
              <span className="font-mono text-[10px] tracking-widest text-[#8A8A8F] border border-[#222228] px-2 py-0.5 uppercase bg-[#0B0B0D]">
                {company.exchange}: {company.ticker}
              </span>
              <span className="font-mono text-[10px] tracking-widest uppercase text-[#8A8A8F]">{company.sector}</span>
              <span className="font-mono text-[10px] tracking-widest uppercase text-[#8A8A8F]">ISIN: {company.isin}</span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-medium text-[#F2F0EA] tracking-tight">
              {company.name}
            </h1>

            {/* The download sits under the name, on its own, rather than
                crowding the number it is meant to support. */}
            {hasRealModel && dcfResult.applicable !== false && (
              <button
                type="button"
                onClick={exportExcel}
                disabled={exporting}
                className="mt-5 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest px-4 py-2.5 border border-[#8B1E1E] text-[#F2F0EA] bg-[#8B1E1E]/20 hover:bg-[#8B1E1E]/35 disabled:opacity-40 transition-colors"
                title="Download the full model as one Excel workbook"
              >
                <Download className="w-4 h-4" />
                {exporting ? 'Building the workbook…' : 'Download Excel model'}
              </button>
            )}
            {hasRealModel && (
              <button
                type="button"
                onClick={() => setNerdView('SAVED')}
                className="mt-5 ml-3 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest px-4 py-2.5 border border-[#222228] text-[#8A8A8F] hover:text-[#F2F0EA] hover:border-[#8B1E1E] transition-colors"
              >
                Saved models
              </button>
            )}
          </div>

          <div className="flex flex-col gap-6 w-full md:w-auto md:min-w-[340px]">
            <div className="flex flex-wrap items-end justify-start md:justify-end gap-6">
            <div className="text-left md:text-right">
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

            </div>

            {/* Model Implied Value & Premium/Discount — its own row, so the
                price and the model switch never squeeze it. */}
            {hasRealModel ? (
              <div className="bg-[#0B0B0D] border hairline-border p-4 px-5 text-left md:text-right shadow-inner">
                <div className="font-mono text-[10px] text-[#8A8A8F] tracking-widest uppercase mb-1">
                  INTRINSIC VALUE
                </div>
                <div className="flex items-baseline gap-3 flex-wrap md:justify-end">
                  <FlashOnChange watch={viewMode} className="px-1 -mx-1">
                    <span className="font-display text-3xl text-[#8B1E1E] font-bold">
                      <TweenNumber
                        value={blendedValue ? blendedValue.value : dcfResult.targetPrice}
                        prefix={company.currencySymbol}
                      />
                    </span>
                  </FlashOnChange>
                  <span
                    className={`font-mono text-[10px] px-2.5 py-1 font-semibold uppercase tracking-widest border whitespace-nowrap ${
                      blendedPremiumPct === null ? premiumDiscountStyle : premiumDiscountStyle
                    }`}
                  >
                    {blendedPremiumPct === null
                      ? premiumDiscountLabel
                      : blendedPremiumPct > 0
                      ? `${blendedPremiumPct}% premium`
                      : `${Math.abs(blendedPremiumPct)}% discount`}
                  </span>
                </div>

                <div className="font-mono text-[10px] text-[#8A8A8F] mt-2">
                  (the working is explained below)
                </div>
              </div>
            ) : (
              <div className="bg-[#0B0B0D] border hairline-border p-4 px-5 text-left md:text-right shadow-inner">
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

      {/* ------------------------------------------------------------------
          SECTION BAR — anchors only. Each deep screen now has a home beside
          the content it belongs to, so a dropdown of all five here would just
          be a second way to reach things that are already in front of you.

          z-40 and a solid background: at z-30 it slid underneath the condensed
          header that appears on scroll, and the translucent background made
          the overlap look like a rendering fault.
          ------------------------------------------------------------------ */}
      <div className="sticky top-[56px] z-40 -mx-6 lg:-mx-12 px-6 lg:px-12 mb-8 bg-[#0B0B0D] border-y border-[#222228]">
        <div className="flex flex-wrap items-center gap-x-1 gap-y-1 py-2.5">
          {[
            { id: 'ratios', label: 'Ratios' },
            { id: 'football', label: 'Valuation range' },
            { id: 'working', label: 'How it was calculated' },
            { id: 'nerds', label: 'Full working' },
          ].map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() =>
                document
                  .getElementById(entry.id)
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
              className="font-mono text-[11px] uppercase tracking-widest px-3 py-2 text-[#8A8A8F] hover:text-[#F2F0EA] whitespace-nowrap transition-colors"
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>

      {/* Live News Ticker Marquee */}
      <div className="hairline-border border bg-[#0B0B0D] py-3 px-4 overflow-hidden mb-8 relative flex items-center shadow-inner">
      <div className="font-mono text-[11px] text-[#8B1E1E] uppercase tracking-widest font-bold shrink-0 border-r hairline-border-r pr-4 mr-4 flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 animate-pulse" />
          <span>NEWS DISPATCH:</span>
        </div>
        <div className="overflow-hidden relative w-full">
          {newsToShow.length === 0 ? (
            <span className="font-mono text-xs text-[#8A8A8F] tracking-wide">
              {newsLoading ? 'Loading the news…' : 'No recent headlines found for this company.'}
            </span>
          ) : (
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
          )}
        </div>
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
                  
                  // A cell can be non-finite where the discount rate meets the
                  // growth rate, which makes the perpetuity formula diverge.
                  // That is an undefined figure, not a very large one, so it
                  // reads as a dash rather than printing infinity.
                  const usable = typeof val === 'number' && isFinite(val) && val > 0;
                  const ratio = usable ? val / company.price : 0;
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
                        {usable ? `${company.currencySymbol}${Math.round(val)}` : '—'}
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
                    Target:{' '}
                    {typeof hoveredMatrixCell.val === 'number' && isFinite(hoveredMatrixCell.val)
                      ? `${company.currencySymbol}${hoveredMatrixCell.val.toFixed(2)}`
                      : 'not defined at this rate'}
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

      {/* Ratios, the valuation range, and the plain-English walkthrough. */}
      <div className="space-y-6 mb-10">
        <div id="ratios" className="scroll-mt-24">
        <RatioBand
          reported={ratioData.reported as any}
          forecast={ratioData.forecast as any}
        />
        </div>
        {dcfResult.applicable !== false && (
          <div id="football" className="scroll-mt-24">
          <FootballField
            bands={valuationBands}
            marketPrice={displayPrice}
            fiftyTwoWeekHigh={liveQuote?.fiftyTwoWeekHigh ?? company.fiftyTwoWeekHigh}
            fiftyTwoWeekLow={liveQuote?.fiftyTwoWeekLow ?? company.fiftyTwoWeekLow}
            currencySymbol={company.currencySymbol}
          />
          <div className="border border-t-0 border-[#222228] bg-[#111114] px-5 sm:px-7 py-5">
            <p className="text-[14px] leading-relaxed text-[#8A8A8F] max-w-2xl mb-4">
              A second opinion on the same question: what the market is paying
              today for companies in the same business.
            </p>
            <OpenScreen view="COMPS" label="Comparable companies" strong />
          </div>
          </div>
        )}
        {activeSource && (
          <div id="working" className="scroll-mt-24">
          <HowCalculated
            source={activeSource}
            dcfResult={dcfResult}
            drivers={drivers}
            defaults={activeDefaults}
            currencySymbol={company.currencySymbol}
            unitLabel={activeSource.meta?.unitLabel || `${company.currencySymbol} millions`}
            sourceLabel={
              viewMode === 'ANALYST' && company.engineBacked
                ? 'Built by hand from the filings, then checked figure by figure against them'
                : activeSource.meta?.source || company.dataSource || 'the company filings'
            }
            companyName={company.name}
            isDerived={viewMode === 'DERIVED' || !company.engineBacked}
            methods={blendedValue?.parts}
            blendedValue={blendedValue?.value ?? null}
          />
          <div className="border border-t-0 border-[#222228] bg-[#111114] px-5 sm:px-7 py-5">
            <p className="text-[14px] leading-relaxed text-[#8A8A8F] max-w-2xl mb-4">
              A model reads accounts. It cannot read a management team, a
              regulator or a competitor. Put your own judgement through the
              assumptions it belongs in.
            </p>
            <OpenScreen view="QUALITATIVE" label="Qualitative adjustments" strong />
          </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------
          FOR THE NERDS — the detailed working. Kept as its own section at the
          foot of the page, because that is where a reader who has read
          everything else arrives, and it is what they would want next.
          ------------------------------------------------------------------ */}
      <section id="nerds" className="scroll-mt-32 border border-[#222228] bg-[#111114] mb-10 p-5 sm:p-7">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
          <h2 className="font-serif text-xl sm:text-2xl text-[#F2F0EA]">
            For the nerds
          </h2>
          <span className="font-mono text-[10px] tracking-[0.2em] text-[#8A8A8F] uppercase">
            04 — the full working
          </span>
        </div>
        <p className="text-[15px] font-semibold text-[#F2F0EA] max-w-2xl mb-5">
          Check this out for the detailed working behind the scenes and for
          altering the assumptions.
        </p>

        <div className="flex flex-wrap gap-3">
          <OpenScreen view="THREE_STATEMENT" label="3-Statement Model" strong />
          <OpenScreen view="DCF" label="DCF Model" strong />
        </div>
      </section>

      {/* ------------------------------------------------------------------
          THE FULL-SCREEN VIEWS
          ------------------------------------------------------------------ */}
      {nerdView === 'THREE_STATEMENT' && nerdModel && activeSource && (
        <FullScreenPanel
          title={`${company.name} — 3-Statement Model`}
          subtitle={`${viewMode === 'ANALYST' ? 'analyst model' : 'derived model'} · ${
            activeSource.meta?.unitLabel || ''
          }`}
          onClose={() => setNerdView(null)}
        >
          <ThreeStatementView
            historicals={historicals}
            model={nerdModel.model}
            dcf={nerdModel.dcf}
            source={activeSource}
            drivers={drivers}
            defaults={activeDefaults}
            onChange={setDrivers}
            currencySymbol={company.currencySymbol}
            unitLabel={activeSource.meta?.unitLabel || `${company.currencySymbol} millions`}
          />
        </FullScreenPanel>
      )}

      {nerdView === 'DCF' && nerdModel && activeSource && (
        <FullScreenPanel
          title={`${company.name} — DCF Model`}
          subtitle={`${viewMode === 'ANALYST' ? 'analyst model' : 'derived model'} · ${
            activeSource.meta?.unitLabel || ''
          }`}
          onClose={() => setNerdView(null)}
        >
          <DCFView
            model={nerdModel.model}
            dcf={nerdModel.dcf}
            source={activeSource}
            drivers={drivers}
            defaults={activeDefaults}
            onChange={setDrivers}
            currencySymbol={company.currencySymbol}
            unitLabel={activeSource.meta?.unitLabel || `${company.currencySymbol} millions`}
          />
        </FullScreenPanel>
      )}

      {nerdView === 'COMPS' && (
        <FullScreenPanel
          title={`${company.name} — Comparable Companies`}
          subtitle="the market cross-check on the discounted cash flow"
          onClose={() => setNerdView(null)}
        >
          <CompsPanel
            ticker={company.ticker}
            companyName={company.name}
            currencySymbol={company.currencySymbol}
            ebitda={
              Array.isArray(nerdDcf?.ebitda)
                ? nerdDcf.ebitda[nerdDcf.ebitda.length - 1]
                : null
            }
            netDebt={nerdDcf?.netDebt ?? null}
            dilutedShares={nerdDcf?.perpetuity?.dilutedShares ?? null}
            dcfValuePerShare={blendedValue ? blendedValue.value : dcfResult.targetPrice}
          />
        </FullScreenPanel>
      )}

      {nerdView === 'SAVED' && (
        <FullScreenPanel
          title={`${company.name} — Saved Models`}
          subtitle="your assumptions, kept for next time"
          onClose={() => setNerdView(null)}
        >
          <SavedModelsPanel
            ticker={company.ticker}
            companyName={company.name}
            currencySymbol={company.currencySymbol}
            viewMode={viewMode}
            drivers={drivers}
            defaults={activeDefaults}
            valuePerShare={blendedValue ? blendedValue.value : dcfResult.targetPrice}
            onRestore={(restored, mode) => {
              setViewMode(mode);
              // The stored set is applied after the model switch, because
              // switching models resets the sliders to that model's defaults.
              setTimeout(() => setDrivers(restored), 0);
              setNerdView(null);
            }}
          />
        </FullScreenPanel>
      )}

      {nerdView === 'QUALITATIVE' && (
        <FullScreenPanel
          title={`${company.name} — Qualitative Adjustments`}
          subtitle="your judgement, put through the model"
          onClose={() => setNerdView(null)}
        >
          <QualitativeAdjustments
            drivers={drivers}
            defaults={activeDefaults}
            onApply={(next) => setDrivers(next)}
            onReset={() => setDrivers(activeDefaults)}
            onClose={() => setNerdView(null)}
            currencySymbol={company.currencySymbol}
            currentValue={blendedValue ? blendedValue.value : dcfResult.targetPrice}
            companyName={company.name}
            profile={company.profile}
          />
        </FullScreenPanel>
      )}

    </section>
  );
};